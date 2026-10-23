// Overlay layer injected into AADB for filming: title cards, subtitles, tags, highlight
// rings with callouts, a full-screen stage for images/slides, and eased scrolling.
// Every overlay is pointer-events:none so the app stays clickable underneath.
export function overlayInit() {
  // Init scripts run in every frame; the overlay belongs to the top page only.
  if (window !== window.top) return;
  try {
    localStorage.setItem('darkMode', 'true');
    localStorage.setItem('azure-diagram-builder.layoutHintSeen.v1', '1');
  } catch { /* ignore */ }
  const CSS = `
  #v-card, #v-sub, #v-tag, #v-ring, #v-call, #v-stage { pointer-events: none; }
  .react-flow__minimap, .canvas-layout-hint, .model-generation-badge, .feedback-toast, .feedback-fab, .canvas-nav-hint { display: none !important; }
  #v-card { position: fixed; inset: 0; z-index: 99999; display: none; align-items: center; justify-content: center; flex-direction: column;
    background: radial-gradient(1200px 700px at 20% 15%, #1d4ed855, transparent 60%), radial-gradient(1000px 700px at 85% 90%, #a21caf44, transparent 60%), #050b1f;
    color: #fff; font-family: 'Segoe UI', system-ui, sans-serif; text-align: center; overflow: hidden; }
  #v-card .grid { position: absolute; inset: -50%; background-image: linear-gradient(#ffffff0a 1px, transparent 1px), linear-gradient(90deg, #ffffff0a 1px, transparent 1px);
    background-size: 64px 64px; transform: perspective(900px) rotateX(58deg); animation: vgrid 18s linear infinite; }
  @keyframes vgrid { to { background-position: 0 640px; } }
  #v-card .in { position: relative; opacity: 0; transform: translateY(26px); animation: vin .9s cubic-bezier(.2,.7,.2,1) forwards; }
  @keyframes vin { to { opacity: 1; transform: none; } }
  #v-card .eyebrow { font-size: 20px; letter-spacing: .32em; color: #93c5fd; text-transform: uppercase; }
  #v-card h1 { font-size: 74px; line-height: 1.08; margin: 22px 0; font-weight: 750; letter-spacing: -.02em; }
  #v-card h1 .g { background: linear-gradient(90deg, #60a5fa, #c084fc, #f472b6); -webkit-background-clip: text; color: transparent; }
  #v-card .sub { font-size: 28px; color: #cbd5e1; max-width: 1300px; }
  #v-card .stats { display: flex; gap: 70px; margin-top: 46px; }
  #v-card .stat b { display: block; font-size: 96px; font-weight: 800; background: linear-gradient(180deg, #fff, #93c5fd); -webkit-background-clip: text; color: transparent; }
  #v-card .stat span { font-size: 22px; color: #94a3b8; letter-spacing: .12em; text-transform: uppercase; }
  #v-card .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; max-width: 1400px; margin-top: 44px; }
  #v-card .chip { padding: 10px 20px; border-radius: 999px; border: 1px solid #60a5fa66; background: #1e3a8a33; font-size: 21px; color: #dbeafe; }
  #v-card .q { font-size: 56px; font-weight: 700; margin: 14px 0; }
  #v-card .flow { display: flex; align-items: center; gap: 0; margin-top: 56px; }
  #v-card .node { width: 270px; padding: 26px 18px; border-radius: 22px; background: #0f172acc; border: 1px solid #334155; box-shadow: 0 0 0 1px #ffffff08, 0 20px 60px #00000080; }
  #v-card .node .ic { font-size: 50px; } #v-card .node b { display: block; font-size: 25px; margin-top: 10px; } #v-card .node span { display: block; font-size: 17px; color: #94a3b8; margin-top: 6px; }
  #v-card .node.hot { border-color: #a78bfa; box-shadow: 0 0 40px #8b5cf688, 0 20px 60px #00000080; }
  #v-card .arrow { width: 90px; height: 3px; background: linear-gradient(90deg, #60a5fa, #c084fc); position: relative; overflow: hidden; }
  #v-card .arrow::after { content: ''; position: absolute; top: -3px; left: -30px; width: 30px; height: 9px; border-radius: 9px; background: #fff; box-shadow: 0 0 14px #fff; animation: vpulse 1.6s linear infinite; }
  @keyframes vpulse { to { left: 100%; } }
  #v-card .files { display: grid; grid-template-columns: repeat(3, 360px); gap: 18px; margin-top: 40px; }
  #v-card .file { text-align: left; padding: 18px 22px; border-radius: 14px; background: #0f172acc; border: 1px solid #334155; font-size: 21px; }
  #v-card .file small { display: block; color: #94a3b8; font-size: 16px; margin-top: 4px; }
  #v-sub { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%); z-index: 100001; max-width: 1500px; padding: 12px 26px; border-radius: 12px;
    background: #020617d9; color: #f8fafc; font: 500 25px/1.4 'Segoe UI', system-ui, sans-serif; text-align: center; display: none; box-shadow: 0 10px 40px #0009; }
  #v-tag { position: fixed; left: 40px; top: 34px; z-index: 100001; padding: 10px 20px; border-radius: 10px; background: linear-gradient(90deg, #1d4ed8, #7c3aed);
    color: #fff; font: 600 21px 'Segoe UI', system-ui, sans-serif; letter-spacing: .04em; display: none; box-shadow: 0 10px 30px #0008; }
  #v-ring { position: fixed; z-index: 100000; border-radius: 14px; border: 3px solid #facc15; box-shadow: 0 0 0 9999px #00000080, 0 0 36px #facc15aa;
    pointer-events: none; display: none; transition: all .6s cubic-bezier(.2,.7,.2,1); }
  #v-call { position: fixed; z-index: 100001; padding: 10px 18px; border-radius: 10px; background: #facc15; color: #111827; font: 700 22px 'Segoe UI', system-ui, sans-serif; display: none; }
  #v-stage { position: fixed; inset: 0; z-index: 99990; display: none; background: #050b1f; align-items: center; justify-content: center; }
  #v-stage .scroller { width: 1380px; height: 940px; overflow: hidden; border-radius: 16px; background: #fff; box-shadow: 0 30px 90px #000c; }
  #v-stage .scroller img { display: block; width: 1380px; }
  #v-stage .slide { position: absolute; width: 1500px; border-radius: 12px; box-shadow: 0 30px 90px #000c; opacity: 0; transition: opacity 1s, transform 6s linear; transform: scale(1); }
  #v-stage .slide.on { opacity: 1; transform: scale(1.05); }
  `;
  const boot = () => {
    if (document.getElementById('v-card')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    for (const id of ['v-card', 'v-sub', 'v-tag', 'v-ring', 'v-call', 'v-stage']) {
      const el = document.createElement('div'); el.id = id; document.body.appendChild(el);
    }
    const card = document.getElementById('v-card');
    card.style.display = 'flex';
    card.innerHTML = '<div class="grid"></div>';
  };
  document.addEventListener('DOMContentLoaded', boot);
  window.__v = {
    card(html) {
      const c = document.getElementById('v-card');
      if (!html) { c.style.transition = 'opacity .7s'; c.style.opacity = '0'; setTimeout(() => { c.style.display = 'none'; c.style.opacity = '1'; c.style.transition = ''; }, 700); return; }
      c.style.display = 'flex'; c.style.opacity = '1';
      c.innerHTML = '<div class="grid"></div>' + html;
    },
    sub(text) { const s = document.getElementById('v-sub'); s.textContent = text || ''; s.style.display = text ? 'block' : 'none'; },
    tag(text) { const s = document.getElementById('v-tag'); s.textContent = text || ''; s.style.display = text ? 'block' : 'none'; },
    ring(sel, label, pad = 8) {
      const r = document.getElementById('v-ring'), c = document.getElementById('v-call');
      const el = sel && document.querySelector(sel);
      if (!el) { r.style.display = 'none'; c.style.display = 'none'; return false; }
      const b = el.getBoundingClientRect();
      Object.assign(r.style, { display: 'block', left: `${b.left - pad}px`, top: `${b.top - pad}px`, width: `${b.width + 2 * pad}px`, height: `${b.height + 2 * pad}px` });
      if (label) {
        c.textContent = label; c.style.display = 'block';
        const below = b.bottom + 90 < innerHeight;
        c.style.left = `${Math.min(Math.max(20, b.left), innerWidth - 640)}px`;
        c.style.top = below ? `${b.bottom + pad + 14}px` : `${b.top - pad - 60}px`;
      } else c.style.display = 'none';
      return true;
    },
    stage(html) { const s = document.getElementById('v-stage'); s.innerHTML = html || ''; s.style.display = html ? 'flex' : 'none'; },
    // Smooth eased scroll of an element (or the report iframe) over ms.
    glide(target, to, ms) {
      const el = target === 'iframe' ? document.querySelector('#v-stage iframe').contentDocument.scrollingElement : document.querySelector(target);
      if (!el) return;
      const from = el.scrollTop, end = to === 'bottom' ? el.scrollHeight - el.clientHeight : to, t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; el.scrollTop = from + (end - from) * e; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    },
  };
}
