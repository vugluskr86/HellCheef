// Точка входа: атлас -> рендерер -> UI -> цикл.
import { buildAtlas } from './atlas';
import { newGame } from './game';
import { initMobileOrientation } from './mobile';
import { Renderer } from './render';
import { app, initUI, render } from './ui';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

try {
  initMobileOrientation();
  const atlas = buildAtlas();
  const r = new Renderer(canvas, atlas);
  app.g = newGame('butcher');
  app.g.mode = 'start';
  app.g.log = [];
  initUI(uiRoot, canvas);
  render();

  let last = 0;
  const loop = (t: number) => {
    r.draw(app.g, t);
    if (t - last > 500 && app.g.mode === 'world') { last = t; render(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} catch (e: any) {
  uiRoot.innerHTML = `<div class="scrim"><div class="panel"><h2>Не запустилось</h2><div class="sub">${String(e?.message ?? e)}</div></div></div>`;
}
