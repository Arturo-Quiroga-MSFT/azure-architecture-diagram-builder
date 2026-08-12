import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Page } from '@playwright/test';

import {
  buildArchitectureGenerationSystemPrompt,
  TOPOLOGY_CONTRACT_VERSION,
} from '../../src/services/architectureGenerationContract';

interface CaptureRole {
  role: string;
  preferences: string[];
}

interface CaptureCase {
  id: string;
  title: string;
  promptStyle: string;
  difficulty: string;
  source: string;
  prompt: string;
  expectedBehavior: string;
  requirements: Record<string, unknown>;
}

interface CaptureConfig {
  name: string;
  version: string;
  mode: string;
  capture: {
    attemptsPerModel: number;
    modelRoles: CaptureRole[];
  };
  cases: CaptureCase[];
}

interface AvailableModel {
  model: string;
  displayName: string;
  deployment: string;
  apiFormat: 'responses' | 'chat-completions';
  reasoningEffort: 'none' | 'medium';
  isReasoning: boolean;
}

interface SelectedModel extends AvailableModel {
  role: string;
}

interface CaptureTask {
  attemptId: string;
  attemptNumber: number;
  scenario: CaptureCase;
  model: SelectedModel;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = join(root, 'evaluations/aadb/cases.v2.json');
const outputDir = join(root, '.foundry/captures');
const outputPath = join(outputDir, 'aadb-v2-attempts.jsonl');
const partialPath = `${outputPath}.partial`;
const summaryPath = join(outputDir, 'aadb-v2-capture.json');

const args = process.argv.slice(2);
const hasFlag = (flag: string) => args.includes(flag);
const valueArg = (name: string, fallback: string) => {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

if (hasFlag('--help')) {
  console.log(`Usage: tsx scripts/evaluations/capture-aadb-v2.ts [options]

Options:
  --base-url=<url>      Running AADB Vite URL (default: http://localhost:3000)
  --concurrency=<n>     Browser worker count (default: 3)
  --dry-run             Resolve deployed models and print the matrix without calls
  --resume              Resume an existing .partial capture
  --force               Remove existing final and partial v2 captures
  --help                Show this help`);
  process.exit(0);
}

const baseUrl = valueArg('--base-url', 'http://localhost:3000');
const concurrency = Number.parseInt(valueArg('--concurrency', '3'), 10);
const dryRun = hasFlag('--dry-run');
const resume = hasFlag('--resume');
const force = hasFlag('--force');

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
  throw new Error('--concurrency must be an integer from 1 to 8');
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function git(...gitArgs: string[]): string {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    const status = 'status' in error ? Number((error as Error & { status?: number }).status) : undefined;
    return {
      name: error.name,
      message: error.message.slice(0, 2_000),
      ...(Number.isFinite(status) ? { status } : {}),
    };
  }
  return { name: 'Error', message: String(error).slice(0, 2_000) };
}

function readJsonLines(path: string): any[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL in ${path} at line ${index + 1}: ${safeError(error).message}`);
      }
    });
}

async function loadAvailableModels(page: Page): Promise<AvailableModel[]> {
  return page.evaluate(async () => {
    // Vite resolves this module in the same browser environment as AADB.
    // @ts-expect-error Browser-only Vite module path.
    const store = await import('/src/stores/modelSettingsStore.ts');
    return store.getAvailableModels().map((model: string) => {
      const config = store.MODEL_CONFIG[model];
      return {
        model,
        displayName: config.displayName,
        deployment: store.getDeploymentName(model),
        apiFormat: config.apiFormat || 'responses',
        reasoningEffort: config.isReasoning ? 'medium' : 'none',
        isReasoning: config.isReasoning,
      };
    });
  });
}

function selectModels(roles: CaptureRole[], available: AvailableModel[]): SelectedModel[] {
  const availableByName = new Map(available.map((item) => [item.model, item]));
  const used = new Set<string>();
  return roles.map((role) => {
    const selectedName = role.preferences.find(
      (candidate) => availableByName.has(candidate) && !used.has(candidate),
    );
    if (!selectedName) {
      throw new Error(
        `No distinct deployed model satisfies role ${role.role}. Preferences: ${role.preferences.join(', ')}`,
      );
    }
    used.add(selectedName);
    return { ...availableByName.get(selectedName)!, role: role.role };
  });
}

async function captureTask(page: Page, task: CaptureTask, lineage: Record<string, unknown>) {
  const capturedAt = new Date().toISOString();
  const result = await page.evaluate(async ({ prompt, model, reasoningEffort }) => {
    const started = performance.now();
    try {
      // @ts-expect-error Browser-only Vite module path.
      const service = await import('/src/services/azureOpenAI.ts');
      const architecture = await service.generateArchitectureWithAI(prompt, {
        model,
        reasoningEffort,
      });
      return {
        status: 'success' as const,
        elapsedTimeMs: Math.round(performance.now() - started),
        architecture,
      };
    } catch (error: any) {
      return {
        status: 'error' as const,
        elapsedTimeMs: Math.round(performance.now() - started),
        error: {
          name: String(error?.name || 'Error'),
          message: String(error?.message || error).slice(0, 2_000),
          status: Number.isFinite(Number(error?.status)) ? Number(error.status) : undefined,
        },
      };
    }
  }, {
    prompt: task.scenario.prompt,
    model: task.model.model,
    reasoningEffort: task.model.reasoningEffort,
  });

  const architecture = result.status === 'success' ? result.architecture : undefined;
  const metrics = architecture?.metrics ?? {};
  return {
    attempt_id: task.attemptId,
    attempt_number: task.attemptNumber,
    captured_at: capturedAt,
    status: result.status,
    scenario: {
      id: task.scenario.id,
      title: task.scenario.title,
      promptStyle: task.scenario.promptStyle,
      difficulty: task.scenario.difficulty,
      source: task.scenario.source,
    },
    prompt: task.scenario.prompt,
    prompt_sha256: sha256(task.scenario.prompt),
    expected_behavior: task.scenario.expectedBehavior,
    requirements: task.scenario.requirements,
    model: {
      role: task.model.role,
      id: task.model.model,
      displayName: task.model.displayName,
      deployment: task.model.deployment,
      apiFormat: task.model.apiFormat,
      reasoningEffort: task.model.reasoningEffort,
    },
    elapsed_time_ms: result.elapsedTimeMs,
    metrics,
    raw_content_available: false,
    ...(architecture ? { architecture } : {}),
    ...(result.status === 'error' ? { error: result.error } : {}),
    lineage,
  };
}

async function main() {
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as CaptureConfig;
  if (config.version !== 'v2' || config.mode !== 'topology') {
    throw new Error('Capture config must target topology v2');
  }

  if (force) {
    rmSync(outputPath, { force: true });
    rmSync(partialPath, { force: true });
    rmSync(summaryPath, { force: true });
  }
  if (existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite completed capture ${outputPath}; use --force intentionally`);
  }
  if (existsSync(partialPath) && !resume) {
    throw new Error(`Partial capture exists at ${partialPath}; use --resume or --force`);
  }

  const response = await fetch(baseUrl);
  if (!response.ok) throw new Error(`AADB URL ${baseUrl} returned HTTP ${response.status}`);

  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (edgeError) {
    console.warn(`Microsoft Edge launch failed; trying Playwright Chromium: ${safeError(edgeError).message}`);
    browser = await chromium.launch({ headless: true });
  }
  try {
    const probePage = await browser.newPage();
    await probePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const availableModels = await loadAvailableModels(probePage);
    const selectedModels = selectModels(config.capture.modelRoles, availableModels);
    await probePage.close();

    const tasks: CaptureTask[] = config.cases.flatMap((scenario) =>
      selectedModels.flatMap((model) =>
        Array.from({ length: config.capture.attemptsPerModel }, (_, index) => ({
          attemptId: `${scenario.id}::${model.model}::${index + 1}`,
          attemptNumber: index + 1,
          scenario,
          model,
        })),
      ),
    );

    const contract = buildArchitectureGenerationSystemPrompt();
    const sourceFiles = [
      'src/services/architectureGenerationContract.ts',
      'src/services/architecturePostProcessing.ts',
      'src/services/azureOpenAI.ts',
      'src/data/serviceIconMapping.ts',
      'src/stores/modelSettingsStore.ts',
      'evaluations/aadb/cases.v2.json',
    ];
    const sourceFingerprint = sourceFiles
      .map((path) => `${path}\0${readFileSync(join(root, path), 'utf8')}`)
      .join('\0');
    const dirtyFiles = git('status', '--porcelain').split('\n').filter(Boolean);
    const lineage = {
      app_commit: git('rev-parse', 'HEAD'),
      app_branch: git('branch', '--show-current'),
      dirty_worktree: dirtyFiles.length > 0,
      dirty_files: dirtyFiles,
      topology_contract_version: TOPOLOGY_CONTRACT_VERSION,
      topology_contract_sha256: sha256(contract),
      source_fingerprint_sha256: sha256(sourceFingerprint),
      config_file: 'evaluations/aadb/cases.v2.json',
      config_sha256: sha256(readFileSync(configPath)),
      capture_harness: 'scripts/evaluations/capture-aadb-v2.ts',
      base_url: baseUrl,
    };

    const matrix = {
      scenarios: config.cases.length,
      models: selectedModels.map(({ role, model, displayName, deployment, apiFormat, reasoningEffort }) => ({
        role,
        model,
        displayName,
        deployment,
        apiFormat,
        reasoningEffort,
      })),
      attemptsPerModel: config.capture.attemptsPerModel,
      totalAttempts: tasks.length,
    };
    console.log(JSON.stringify(matrix, null, 2));
    if (tasks.length !== 48) throw new Error(`Expected 48 tasks, resolved ${tasks.length}`);
    if (dryRun) return;

    mkdirSync(outputDir, { recursive: true });
    const completed = resume ? readJsonLines(partialPath) : [];
    const completedIds = new Set(completed.map((item) => item.attempt_id));
    const remainingTasks = tasks.filter((task) => !completedIds.has(task.attemptId));
    let taskIndex = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, remainingTasks.length || 1) },
      async (_, workerIndex) => {
        const page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        try {
          while (taskIndex < remainingTasks.length) {
            const task = remainingTasks[taskIndex++];
            console.log(`[worker ${workerIndex + 1}] ${task.attemptId}`);
            let row;
            try {
              row = await captureTask(page, task, lineage);
            } catch (error) {
              row = {
                attempt_id: task.attemptId,
                attempt_number: task.attemptNumber,
                captured_at: new Date().toISOString(),
                status: 'harness_error',
                scenario: { id: task.scenario.id },
                prompt: task.scenario.prompt,
                prompt_sha256: sha256(task.scenario.prompt),
                expected_behavior: task.scenario.expectedBehavior,
                requirements: task.scenario.requirements,
                model: task.model,
                error: safeError(error),
                lineage,
              };
            }
            appendFileSync(partialPath, `${JSON.stringify(row)}\n`);
            console.log(`[worker ${workerIndex + 1}] ${task.attemptId}: ${row.status}`);
          }
        } finally {
          await page.close();
        }
      },
    );
    await Promise.all(workers);

    const rows = readJsonLines(partialPath);
    const uniqueIds = new Set(rows.map((row) => row.attempt_id));
    if (rows.length !== tasks.length || uniqueIds.size !== tasks.length) {
      throw new Error(`Capture incomplete: ${rows.length} rows, ${uniqueIds.size} unique, ${tasks.length} planned`);
    }
    const statusCounts = rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
      return counts;
    }, {});
    const summary = {
      dataset: { name: config.name, version: config.version, mode: config.mode },
      capturedAt: new Date().toISOString(),
      matrix,
      statusCounts,
      attemptFile: '.foundry/captures/aadb-v2-attempts.jsonl',
      attemptFileSha256: sha256(readFileSync(partialPath)),
      lineage,
    };
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    renameSync(partialPath, outputPath);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
