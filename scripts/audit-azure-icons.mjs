#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const config = JSON.parse(readFileSync(resolve(here, 'azure-icons-v24.source.json'), 'utf8'));
const baselinePath = resolve(here, 'azure-icons-pre-v24-baseline.json');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalized(path) {
  return path.split(sep).join('/');
}

function walk(root) {
  const output = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...walk(path));
    else if (entry.name.toLowerCase().endsWith('.svg')) output.push(path);
  }
  return output;
}

function fsInventory(root) {
  return walk(root).map(path => ({
    path: normalized(relative(root, path)),
    sha256: sha256(readFileSync(path)),
  })).sort((a, b) => a.path.localeCompare(b.path));
}

function gitInventory(ref) {
  const prefix = 'Azure_Public_Service_Icons/Icons/';
  const paths = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', ref, '--', 'Azure_Public_Service_Icons/Icons'],
    { cwd: repoRoot, encoding: 'utf8' },
  ).split(/\r?\n/).filter(path => path.toLowerCase().endsWith('.svg'));
  return paths.map(repoPath => ({
    path: repoPath.slice(prefix.length),
    sha256: sha256(execFileSync('git', ['show', `${ref}:${repoPath}`], { cwd: repoRoot })),
  })).sort((a, b) => a.path.localeCompare(b.path));
}

function gitText(ref, path) {
  return execFileSync('git', ['show', `${ref}:${path}`], { cwd: repoRoot, encoding: 'utf8' });
}

function parseServiceMappings(text) {
  const mappings = {};
  const entryPattern = /'([^']+)'\s*:\s*\{/g;
  let match;
  while ((match = entryPattern.exec(text)) !== null) {
    let depth = 1;
    let index = entryPattern.lastIndex;
    while (index < text.length && depth > 0) {
      if (text[index] === '{') depth++;
      else if (text[index] === '}') depth--;
      index++;
    }
    const block = text.slice(match.index, index);
    const iconFile = block.match(/iconFile:\s*'([^']+)'/)?.[1];
    const category = block.match(/category:\s*'([^']+)'/)?.[1];
    if (iconFile && category) mappings[match[1]] = { iconFile, category };
  }
  return mappings;
}

function byHash(items) {
  const index = new Map();
  for (const item of items) {
    const values = index.get(item.sha256) ?? [];
    values.push(item.path);
    index.set(item.sha256, values);
  }
  return index;
}

function duplicates(items) {
  return [...byHash(items)]
    .filter(([, paths]) => paths.length > 1)
    .map(([hash, paths]) => ({ sha256: hash, paths: paths.sort() }))
    .sort((a, b) => a.sha256.localeCompare(b.sha256));
}

function digest(items) {
  return sha256(Buffer.from(items.map(item => `${item.path}\t${item.sha256}\n`).join(''), 'utf8'));
}

function parseArgs(argv) {
  const result = {
    official: null,
    gitRef: null,
    output: null,
    checkOnly: false,
    updateBaseline: false,
  };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--official') result.official = argv[++index];
    else if (argv[index] === '--git-ref') result.gitRef = argv[++index];
    else if (argv[index] === '--output') result.output = resolve(argv[++index]);
    else if (argv[index] === '--check') result.checkOnly = true;
    else if (argv[index] === '--update-baseline') result.updateBaseline = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (result.updateBaseline && !result.gitRef) {
    throw new Error('--update-baseline requires --git-ref <commit>');
  }
  return result;
}

function officialIconsRoot(input) {
  const root = resolve(input);
  for (const candidate of [
    join(root, 'Icons'),
    join(root, config.packageRoot, 'Icons'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find ${config.packageRoot}/Icons under ${root}`);
}

function loadBaseline(args) {
  if (args.gitRef) {
    const resolvedGitRef = execFileSync('git', ['rev-parse', args.gitRef], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    const baseline = {
      schemaVersion: 1,
      commit: resolvedGitRef,
      iconInventory: gitInventory(resolvedGitRef),
      serviceIconMappings: parseServiceMappings(
        gitText(resolvedGitRef, 'src/data/serviceIconMapping.ts'),
      ),
    };
    if (args.updateBaseline) {
      writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
      console.log(`[audit-azure-icons] wrote ${baselinePath}`);
    }
    return baseline;
  }
  if (!existsSync(baselinePath)) {
    throw new Error(`Missing pinned pre-V24 baseline: ${baselinePath}`);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (baseline.commit !== config.auditBaselineCommit) {
    throw new Error('Pinned baseline commit does not match source metadata');
  }
  return baseline;
}

function verifyExpectedAudit(report) {
  const expected = config.expectedAudit;
  const mismatches = [];
  if (report.inputs.repositoryInventorySha256 !== expected.repositoryInventorySha256) {
    mismatches.push('pre-V24 repository inventory digest');
  }
  if (report.inputs.currentInventorySha256 !== expected.currentInventorySha256) {
    mismatches.push('current merged inventory digest');
  }
  for (const [name, value] of Object.entries(expected.counts)) {
    if (report.counts[name] !== value) {
      mismatches.push(`${name}: expected ${value}, got ${report.counts[name]}`);
    }
  }
  for (const [name, values] of Object.entries(report.coverage)) {
    if (name !== 'mappedPaths' && name !== 'unmappedCurrentPaths' && values.length > 0) {
      mismatches.push(`${name}: ${values.length} unresolved item(s)`);
    }
  }
  const wrongOfficialMappings = report.serviceMappingChanges.filter(
    item => item.currentPath && item.status !== 'removed' && !item.currentOfficialPathAndHash,
  );
  if (wrongOfficialMappings.length > 0) {
    mismatches.push(`${wrongOfficialMappings.length} changed mapping(s) do not match V24 path and hash`);
  }
  if (mismatches.length > 0) {
    throw new Error(`Audit differs from reviewed expectations:\n${mismatches.map(item => `- ${item}`).join('\n')}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseline = loadBaseline(args);
  const official = args.official
    ? fsInventory(officialIconsRoot(args.official))
    : JSON.parse(readFileSync(resolve(here, 'azure-icons-v24.manifest.json'), 'utf8')).official;
  if (official.length !== config.officialIconCount || digest(official) !== config.officialInventorySha256) {
    throw new Error(`Official inventory does not match pinned ${config.version} metadata`);
  }
  const repository = baseline.iconInventory;
  const current = fsInventory(resolve(repoRoot, 'Azure_Public_Service_Icons', 'Icons'));
  const officialByPath = new Map(official.map(item => [item.path, item]));
  const repoByPath = new Map(repository.map(item => [item.path, item]));
  const currentByPath = new Map(current.map(item => [item.path, item]));
  const officialHashes = byHash(official);
  const repoHashes = byHash(repository);

  const exactPathAndHash = official
    .filter(item => repoByPath.get(item.path)?.sha256 === item.sha256);
  const sharedPathsChangedContent = official
    .filter(item => repoByPath.has(item.path) && repoByPath.get(item.path).sha256 !== item.sha256)
    .map(item => ({
      path: item.path,
      officialSha256: item.sha256,
      repositorySha256: repoByPath.get(item.path).sha256,
    }));
  const officialPathsMissingFromRepository = official
    .filter(item => !repoByPath.has(item.path))
    .map(item => ({ ...item, exactRepositoryPaths: repoHashes.get(item.sha256) ?? [] }));
  const repositoryPathsMissingFromOfficial = repository
    .filter(item => !officialByPath.has(item.path))
    .map(item => ({ ...item, exactOfficialPaths: officialHashes.get(item.sha256) ?? [] }));
  const officialContentMissing = official.filter(item => !repoHashes.has(item.sha256));
  const repositoryContentAbsentOfficial = repository.filter(item => !officialHashes.has(item.sha256));

  const iconMap = JSON.parse(readFileSync(resolve(repoRoot, 'mcp-server', 'src', 'iconMap.generated.json'), 'utf8'));
  const catalog = JSON.parse(readFileSync(resolve(repoRoot, 'mcp-server', 'src', 'serviceCatalog.generated.json'), 'utf8'));
  const baselineIconMap = baseline.serviceIconMappings;
  const mappedPaths = new Set(Object.values(iconMap).map(
    entry => `${entry.category}/${entry.iconFile}.svg`,
  ));
  const currentPaths = new Set(current.map(item => item.path));
  const serviceMappingChanges = [...new Set([...Object.keys(baselineIconMap), ...Object.keys(iconMap)])]
    .map(service => {
      const baseline = baselineIconMap[service];
      const mapped = iconMap[service];
      const baselinePath = baseline ? `${baseline.category}/${baseline.iconFile}.svg` : null;
      const currentPath = mapped ? `${mapped.category}/${mapped.iconFile}.svg` : null;
      if (baselinePath === currentPath) return null;
      const baselineHash = baselinePath ? repoByPath.get(baselinePath)?.sha256 ?? null : null;
      const currentHash = currentPath ? currentByPath.get(currentPath)?.sha256 ?? null : null;
      return {
        service,
        status: !baselinePath ? 'added' : !currentPath ? 'removed' : 'repointed',
        baselinePath,
        currentPath,
        baselineSha256: baselineHash,
        currentSha256: currentHash,
        contentIdentical: baselineHash && currentHash ? baselineHash === currentHash : null,
        currentOfficialPathAndHash: currentPath
          ? officialByPath.get(currentPath)?.sha256 === currentHash
          : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.service.localeCompare(b.service));

  const report = {
    schemaVersion: 1,
    inputs: {
      officialVersion: config.version,
      officialInventorySha256: digest(official),
      repositoryGitRef: baseline.commit,
      repositoryInventorySha256: digest(repository),
      currentInventorySha256: digest(current),
    },
    counts: {
      official: official.length,
      repositoryBaseline: repository.length,
      current: current.length,
      exactPathAndHash: exactPathAndHash.length,
      sharedPathsChangedContent: sharedPathsChangedContent.length,
      officialPathsMissingFromRepository: officialPathsMissingFromRepository.length,
      repositoryPathsMissingFromOfficial: repositoryPathsMissingFromOfficial.length,
      officialContentMissing: officialContentMissing.length,
      repositoryContentAbsentOfficial: repositoryContentAbsentOfficial.length,
      repositoryDuplicateGroups: duplicates(repository).length,
      officialDuplicateGroups: duplicates(official).length,
      currentDuplicateGroups: duplicates(current).length,
      mappedServices: Object.keys(iconMap).length,
      mappedUniqueIcons: mappedPaths.size,
      unmappedCurrentIcons: current.filter(item => !mappedPaths.has(item.path)).length,
      catalogServices: Object.keys(catalog).length,
      serviceMappingChanges: serviceMappingChanges.length,
      repointedMappings: serviceMappingChanges.filter(item => item.status === 'repointed').length,
      repointedWithIdenticalContent: serviceMappingChanges.filter(
        item => item.status === 'repointed' && item.contentIdentical,
      ).length,
      repointedWithUpdatedContent: serviceMappingChanges.filter(
        item => item.status === 'repointed' && item.contentIdentical === false,
      ).length,
    },
    exactPathAndHash,
    sharedPathsChangedContent,
    exactContentRelocations: officialPathsMissingFromRepository.filter(item => item.exactRepositoryPaths.length > 0),
    officialContentMissing,
    repositoryContentAbsentOfficial,
    officialPathsMissingFromRepository,
    repositoryPathsMissingFromOfficial,
    logicalContentReplacements: config.logicalContentReplacements,
    serviceMappingChanges,
    duplicates: {
      official: duplicates(official),
      repository: duplicates(repository),
      current: duplicates(current),
    },
    coverage: {
      mappedPaths: [...mappedPaths].sort(),
      missingMappedPaths: [...mappedPaths].filter(path => !currentPaths.has(path)).sort(),
      unmappedCurrentPaths: current.filter(item => !mappedPaths.has(item.path)).map(item => item.path),
      mappingOnlyServices: Object.keys(iconMap).filter(key => !catalog[key]).sort(),
      catalogOnlyServices: Object.keys(catalog).filter(key => !iconMap[key]).sort(),
    },
  };
  verifyExpectedAudit(report);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    writeFileSync(args.output, output, 'utf8');
    console.log(`[audit-azure-icons] wrote ${args.output}`);
  } else if (args.checkOnly) {
    console.log('[audit-azure-icons] verified pinned V24 audit expectations');
  }
  console.log(JSON.stringify(report.counts));
}

try {
  main();
} catch (error) {
  console.error(`[audit-azure-icons] ${error.message}`);
  process.exitCode = 1;
}
