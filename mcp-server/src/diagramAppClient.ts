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

app.ontoolresult = result => {
  if (result.isError) {
    showError('The render_diagram tool reported an error.');
    return;
  }

  const output = (result.structuredContent ?? {}) as DiagramResult;
  if (typeof output.content !== 'string') {
    showError('The renderer result did not include diagram content.');
    return;
  }

  if (output.format === 'html') {
    mountHtml(output.content);
  } else if (output.format === 'svg') {
    mountSvg(output.content);
  } else {
    showError('The renderer returned an unsupported diagram format.');
  }
};

app.connect().catch(error => {
  showError(error instanceof Error ? error.message : 'Could not connect to the host.');
});