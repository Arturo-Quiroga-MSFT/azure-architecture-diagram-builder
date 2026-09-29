import { App } from '@modelcontextprotocol/ext-apps/app-with-deps';

type DiagramResult = {
  format?: unknown;
  content?: unknown;
};

const app = new App(
  { name: 'Azure Architecture Diagram Viewer', version: '1.0.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
  { autoResize: false },
);

function requestBoundedHeight(): void {
  requestAnimationFrame(() => {
    const canvas = document.querySelector<HTMLElement>('.canvas');
    const canvasWidth = Number.parseFloat(canvas?.style.width ?? '') || 800;
    const canvasHeight = Number.parseFloat(canvas?.style.height ?? '') || 420;
    const hostDimensions = app.getHostContext()?.containerDimensions;
    const hostWidth = hostDimensions && 'width' in hostDimensions
      ? hostDimensions.width
      : document.documentElement.clientWidth || 640;
    const fittedScale = Math.min(1, Math.max(0.35, (hostWidth - 32) / canvasWidth));
    const height = Math.round(Math.min(720, Math.max(420, canvasHeight * fittedScale + 150)));
    void app.sendSizeChanged({ height });
  });
}

function showError(message: string): void {
  document.body.className = '';
  document.body.innerHTML = `
    <div class="status error">
      <strong>Unable to display the diagram</strong>
      <span></span>
    </div>`;
  const detail = document.querySelector<HTMLSpanElement>('.status span');
  if (detail) detail.textContent = message;
}

function mountHtml(markup: string): void {
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  if (parsed.querySelector('parsererror')) {
    showError('The renderer returned invalid HTML.');
    return;
  }

  document.title = parsed.title || document.title;
  document.head.querySelectorAll('[data-diagram-style]').forEach(node => node.remove());
  parsed.head.querySelectorAll('style').forEach(style => {
    const mountedStyle = document.createElement('style');
    mountedStyle.dataset.diagramStyle = 'true';
    mountedStyle.textContent = style.textContent;
    document.head.appendChild(mountedStyle);
  });

  document.body.className = parsed.body.className;
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.querySelectorAll('script').forEach(script => {
    const executable = document.createElement('script');
    executable.textContent = script.textContent;
    script.replaceWith(executable);
  });
  requestBoundedHeight();
}

function mountSvg(markup: string): void {
  document.body.className = '';
  document.body.innerHTML = '<main class="svg-output"></main>';
  const output = document.querySelector<HTMLElement>('.svg-output');
  if (output) output.innerHTML = markup;
  requestBoundedHeight();
}

type ToolResultLike = {
  isError?: boolean;
  structuredContent?: unknown;
  content?: Array<{ type?: string; text?: unknown }>;
};

let toolArguments: Record<string, unknown> | undefined;
let refetched = false;

app.ontoolinput = params => {
  toolArguments = params.arguments;
};

function inferFormat(markup: string): 'svg' | 'html' | undefined {
  const head = markup.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'svg';
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'html';
  return undefined;
}

// Hosts may drop or truncate large structuredContent (VS Code caches big tool
// results), so fall back to the text block, which carries the same markup.
function extractDiagram(result: ToolResultLike): { format: 'svg' | 'html'; content: string } | undefined {
  const structured = (result.structuredContent ?? {}) as DiagramResult;
  if (typeof structured.content === 'string' && (structured.format === 'svg' || structured.format === 'html')) {
    return { format: structured.format, content: structured.content };
  }
  for (const block of result.content ?? []) {
    if (block?.type !== 'text' || typeof block.text !== 'string') continue;
    const format = inferFormat(block.text);
    if (format) return { format, content: block.text };
  }
  return undefined;
}

function render(result: ToolResultLike): boolean {
  if (result.isError) {
    showError('The render_diagram tool reported an error.');
    return true;
  }
  const diagram = extractDiagram(result);
  if (!diagram) return false;
  if (diagram.format === 'html') mountHtml(diagram.content);
  else mountSvg(diagram.content);
  return true;
}

// Last resort: re-run the (idempotent, read-only) tool from the app itself so
// the markup comes straight from the server instead of the host's cached copy.
async function refetch(): Promise<boolean> {
  if (refetched || !toolArguments) return false;
  refetched = true;
  try {
    const result = await app.callServerTool({ name: 'render_diagram', arguments: toolArguments });
    return render(result as ToolResultLike);
  } catch {
    return false;
  }
}

app.ontoolresult = async result => {
  if (render(result as ToolResultLike)) return;
  if (await refetch()) return;
  showError('The renderer result did not include diagram content.');
};

app.connect().catch(error => {
  showError(error instanceof Error ? error.message : 'Could not connect to the host.');
});