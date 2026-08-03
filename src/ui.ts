// Интерфейс: HUD, рейка заказов, панели готовки/лавки/инвентаря. Всё на DOM поверх WebGL.
import { clamp, clockOf, dayOf } from './core';
import { CELL } from './atlas';
import { cookStep, cookXP, dishItem, finishCook, heatHigh, heatLow, startCook } from './cooking';
import { FACTION_NAMES, ingById, RECIPES, SKILL_NAMES, STATION_NAMES, recipeById, toolById } from './data';
import { ARCHETYPES, Game, advance, checkDiscoveries, hasSave, interact, loadGame, move, newGame, repairStation, rest, saveGame, say, shopStock, toolStock, upgradeStation } from './game';
import { addItem, itemName, makeIng, makeTool, MAX_WEIGHT, planIngredients, removeQty, spices, totalWeight } from './inv';
import { serveOrder } from './orders';
import { grantXP, karmaTitle, MAX_LEVEL, repTitle, xpToNext } from './progress';
import { Item } from './types';
import { currentTutorialStep, getTutorialStepMarkup, setTutorialEnabled, advanceTutorial, tutorialWorldTarget } from './tutorial';
import { initTouchControls } from './mobile';

export const app: { g: Game } = { g: null! };
let root: HTMLElement;
let worldCanvas: HTMLElement | null = null;
let sel = { order: -1, spice: 0 };
let lastTouchActionAt = 0;

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const bar = (v: number, max: number, cls: string, label = '') =>
  `<div class="bar ${cls}"><i style="width:${clamp(v / max * 100, 0, 100)}%"></i><b>${label}</b></div>`;
const btn = (act: string, text: string, arg = '', cls = '') =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${esc(String(arg))}">${text}</button>`;

export function initUI(el: HTMLElement, touchTarget?: HTMLElement) {
  root = el;
  worldCanvas = touchTarget ?? null;
  el.addEventListener('click', e => {
    if (performance.now() - lastTouchActionAt < 500) return;
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t) return;
    handle(t.dataset.act!, t.dataset.arg ?? '');
  });
  el.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return;
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t) return;
    e.preventDefault();
    lastTouchActionAt = performance.now();
    handle(t.dataset.act!, t.dataset.arg ?? '');
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'F5') { e.preventDefault(); handle('save'); return; }
    const k = e.key.toLowerCase();
    const g = app.g;
    if (!g) return;
    if (g.mode === 'start' || g.mode === 'dead') return;
    if (g.mode === 'cook') { cookKeys(k, e); return; }
    if (g.mode !== 'world') {
      if (k === 'escape' || k === 'i' || k === 'b' || k === 'c' || k === 'r') { g.mode = 'world'; g.station = null; render(); }
      e.preventDefault();
      return;
    }
    const map: Record<string, [number, number]> = {
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
      arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0],
      ц: [0, -1], ы: [0, 1], ф: [-1, 0], в: [1, 0],
    };
    if (map[k]) { e.preventDefault(); move(g, map[k][0], map[k][1]); render(); return; }
    if (k === 'e' || k === 'у' || k === 'enter') { interact(g); render(); }
    else if (k === 'i' || k === 'ш') { g.mode = 'inv'; render(); }
    else if (k === 'c' || k === 'с') { g.mode = 'char'; render(); }
    else if (k === 'r' || k === 'к') { g.mode = 'recipes'; render(); }
    else if (k === ' ') { e.preventDefault(); advance(g, 1); render(); }
  });
  if (touchTarget) initTouchControls(touchTarget, {
    move: (dx, dy) => {
      const g = app.g;
      if (!g || g.mode !== 'world') return;
      move(g, dx, dy);
      render();
    },
    interact: () => {
      const g = app.g;
      if (!g || g.mode !== 'world') return;
      interact(g);
      render();
    },
  });
}

function cookKeys(k: string, e: KeyboardEvent) {
  const g = app.g;
  if (!g.cook) {
    if (k === 'escape') { g.mode = 'world'; g.station = null; render(); }
    return;
  }
  e.preventDefault();
  const m: Record<string, string> = {
    q: 'heat_up', й: 'heat_up', e: 'heat_down', у: 'heat_down',
    f: g.cook.technique === 'slice' ? 'slice' : g.cook.technique === 'mix' ? 'stir' : 'flip',
    а: g.cook.technique === 'slice' ? 'slice' : g.cook.technique === 'mix' ? 'stir' : 'flip',
    s: 'season', ы: 'season', ' ': 'wait', enter: 'finish',
  };
  if (m[k]) handle('cook_' + m[k]);
  else if (k === 'escape') handle('cook_abort');
}

// ── Действия ────────────────────────────────────────────────────────────────
function handle(act: string, arg = '') {
  const g = app.g;
  switch (act) {
    case 'newgame': {
      const tutorial = app.g?.tutorial;
      // При выборе класса сохраняем текущий учебный прогресс, а не создаём
      // подсказки заново. Если игрок пропустил карточку выбора, пропускаем её
      // автоматически и переходим к подсказке о заказах.
      if (tutorial && app.g?.mode === 'start') {
        advanceTutorial(tutorial, app.g);
        advanceTutorial(tutorial, app.g);
      }
      app.g = newGame(arg);
      if (tutorial) app.g.tutorial = tutorial;
      break;
    }
    case 'continue': { const l = loadGame(); if (l) app.g = l; else say(g, 'Сохранение не найдено.'); break; }
    case 'save': say(g, saveGame(g) ? 'Сохранено.' : 'Не удалось сохранить.'); break;
    case 'close': g.mode = 'world'; g.station = null; break;
    case 'open': g.mode = arg as any; break;
    case 'tutorial_toggle':
      setTutorialEnabled(g.tutorial, !g.tutorial.enabled);
      say(g, g.tutorial.enabled ? 'Подсказки включены.' : 'Подсказки отключены.');
      break;
    case 'tutorial_next':
      advanceTutorial(g.tutorial, g);
      break;
    case 'rest': rest(g); break;
    case 'repair': repairStation(g, g.station!); break;
    case 'upgrade': upgradeStation(g, g.station!); break;

    case 'cook_start': {
      const r = recipeById(arg);
      const res = startCook(g.player, r, g.station!);
      if (typeof res === 'string') say(g, res);
      else { g.cook = res; say(g, `Начал готовить «${r.name}».`); }
      break;
    }
    case 'cook_heat_up': case 'cook_heat_down': case 'cook_flip': case 'cook_slice': case 'cook_stir': case 'cook_wait': case 'cook_season': {
      const s = g.cook!;
      const sp = act === 'cook_season' ? (spices(g.player)[sel.spice] ?? null) : null;
      if (act === 'cook_season' && !sp) { say(g, 'Специй нет.'); break; }
      const msg = cookStep(s, g.player, act.slice(5) as any, sp, g.rng);
      if (msg) say(g, msg);
      advance(g, 1);
      if (s.ruined) { say(g, 'Блюдо сгорело дотла.'); finishSession(false); }
      break;
    }
    case 'cook_finish': {
      const s = g.cook!;
      if (s.doneness < 55) { say(g, 'Слишком сырое — клиент это заметит.'); }
      finishCook(s, g.player, g.rng);
      finishSession(true);
      break;
    }
    case 'cook_abort': {
      if (g.cook) { say(g, 'Ты бросил блюдо. Продукты пропали.'); g.cook = null; }
      g.mode = 'world'; g.station = null;
      break;
    }
    case 'spice_pick': sel.spice = +arg; break;

    case 'serve_pick': sel.order = +arg; break;
    case 'serve_do': {
      const o = g.orders.find(x => x.id === sel.order);
      const dish = g.player.inv[+arg];
      if (!o || !dish || dish.kind !== 'dish') break;
      if (o.state !== 'active') { say(g, 'Этот заказ уже закрыт.'); break; }
      const res = serveOrder(o, dish, g.player, g.turn);
      removeQty(g.player, dish, 1);
      grantXP(g.player, res.xp, s => say(g, s));
      if (res.ok && res.q >= g.contract.minQ) {
        g.contract.done++;
        if (g.contract.done >= g.contract.need) say(g, 'Контракт круга выполнен — врата открыты.');
      }
      say(g, res.text);
      checkDiscoveries(g);
      sel.order = -1; // сброс — заказ закрыт
      advance(g, 2);
      break;
    }
    case 'refuse': {
      const o = g.orders.find(x => x.id === +arg);
      if (!o) break;
      o.state = 'failed';
      g.player.karma += 2;
      g.player.rep[o.cust.faction] = clamp(g.player.rep[o.cust.faction] - 18, -1000, 1000);
      say(g, `Ты отказал: ${o.cust.name}. Совесть чуть чище, репутация — нет.`);
      break;
    }

    case 'buy': {
      const def = shopStock(g).find(i => i.id === arg)!;
      const price = g.market.buyPrice(def.id);
      if (g.player.money < price) { say(g, 'Не хватает монет.'); break; }
      if (!addItem(g.player, makeIng(def, 60 + g.rng.int(20)))) { say(g, 'Некуда класть.'); break; }
      g.player.money -= price; g.market.onBuy(def.id, 1);
      say(g, `Куплено: ${def.name} за ${price}.`);
      advance(g, 2);
      break;
    }
    case 'buytool': {
      const def = toolById(arg);
      if (g.player.money < def.price) { say(g, 'Не хватает монет.'); break; }
      g.player.money -= def.price;
      addItem(g.player, makeTool(def));
      say(g, `Куплено: ${def.name}.`);
      advance(g, 2);
      break;
    }
    case 'sell': {
      const it = g.player.inv[+arg];
      if (!it) break;
      let price = 0;
      if (it.kind === 'ing') { price = g.market.sellPrice(it.def.id, it.quality, it.freshness); g.market.onSell(it.def.id, 1); }
      else if (it.kind === 'dish') price = Math.round(it.recipe.base * (0.35 + it.quality / 100 * 0.5));
      else price = Math.round(it.def.price * 0.4 * (it.dur / 100));
      g.player.money += price;
      removeQty(g.player, it, 1);
      say(g, `Продано за ${price}.`);
      break;
    }
    case 'equip': {
      const it = g.player.inv[+arg];
      if (!it || it.kind !== 'tool') break;
      const old = g.player.weapon;
      g.player.weapon = it as any;
      removeQty(g.player, it, 1);
      if (old) addItem(g.player, old);
      say(g, `В руках: ${it.def.name}.`);
      break;
    }
    case 'eat': {
      const it = g.player.inv[+arg];
      if (!it || it.kind !== 'dish') break;
      const heal = Math.round((it.recipe.heal ?? 10) * (0.4 + it.quality / 100 * 0.8));
      g.player.hp = clamp(g.player.hp + heal, 0, g.player.maxHp);
      g.player.sp = clamp(g.player.sp + heal * 0.6, 0, g.player.maxSp);
      removeQty(g.player, it, 1);
      say(g, `Съел «${it.recipe.name}»: +${heal} HP.`);
      advance(g, 5);
      break;
    }
    case 'drop': {
      const it = g.player.inv[+arg];
      if (!it) break;
      g.level.ground.push({ x: g.player.x, y: g.player.y, item: { ...it, qty: 1 } as Item });
      removeQty(g.player, it, 1);
      break;
    }
  }
  render();
}

function finishSession(keep: boolean) {
  const g = app.g, s = g.cook!;
  if (keep && !s.ruined) {
    const it = dishItem(s);
    if (!addItem(g.player, it)) { g.level.ground.push({ x: g.player.x, y: g.player.y, item: it }); say(g, 'Инвентарь полон — блюдо на полу.'); }
    grantXP(g.player, cookXP(s), t => say(g, t));
    say(g, `Готово: «${s.recipe.name}», качество ${s.quality}.`);
    checkDiscoveries(g);
  }
  g.cook = null;
  g.mode = 'world'; g.station = null;
}

// ── Отрисовка интерфейса ────────────────────────────────────────────────────
export function render() {
  const g = app.g;
  if (!g) return;
  if (g.mode === 'start') {
    root.innerHTML = startScreen() + tutorialOverlay(g);
    syncTutorialHighlight();
    return;
  }
  root.innerHTML = hud(g) + chits(g) + logBox(g) + modal(g) + tutorialOverlay(g);
  syncTutorialHighlight();
}

function syncTutorialHighlight() {
  const g = app.g;
  const step = currentTutorialStep(g.tutorial, g);
  if (!g.tutorial.enabled || !step) return;
  const focus = root.querySelector('#tutorial-focus') as HTMLElement | null;
  const target = step.selector ? root.querySelector(step.selector) as HTMLElement | null : null;
  if (focus) {
    if (target) {
      const rect = target.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      focus.style.display = 'block';
      focus.style.left = `${rect.left - rootRect.left - 12}px`;
      focus.style.top = `${rect.top - rootRect.top - 12}px`;
      focus.style.width = `${rect.width + 24}px`;
      focus.style.height = `${rect.height + 24}px`;
      target.classList.add('tutorial-target');
    } else focus.style.display = 'none';
  }

  const pointer = root.querySelector('#tutorial-world-pointer') as HTMLElement | null;
  const worldTarget = tutorialWorldTarget(g);
  if (!pointer || !worldCanvas || !worldTarget) {
    if (pointer) pointer.style.display = 'none';
    return;
  }
  const point = worldTargetScreenPoint(g, worldCanvas, worldTarget.x, worldTarget.y);
  pointer.style.display = 'block';
  pointer.style.left = `${point.x}px`;
  pointer.style.top = `${point.y}px`;
}

function worldTargetScreenPoint(g: Game, canvas: HTMLElement, x: number, y: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = canvas.clientWidth * dpr;
  const height = canvas.clientHeight * dpr;
  const scale = Math.max(2, Math.min(6, Math.floor(Math.min(width / (26 * CELL), height / (17 * CELL)))));
  const vw = width / scale, vh = height / scale;
  let camX = (g.player.x + 0.5) * CELL - vw / 2;
  let camY = (g.player.y + 0.5) * CELL - vh / 2;
  camX = Math.max(-8, Math.min(g.level.w * CELL - vw + 8, camX));
  camY = Math.max(-8, Math.min(g.level.h * CELL - vh + 8, camY));
  if (g.level.w * CELL < vw) camX = (g.level.w * CELL - vw) / 2;
  if (g.level.h * CELL < vh) camY = (g.level.h * CELL - vh) / 2;
  return {
    x: ((x + 0.5) * CELL - camX) * scale / dpr,
    y: (y * CELL - camY) * scale / dpr,
  };
}

function tutorialOverlay(g: Game) {
  const step = currentTutorialStep(g.tutorial, g);
  if (!g.tutorial.enabled || !step) return '';
  return `<div class="tutorial-layer" aria-live="polite">
    <div id="tutorial-focus" class="tutorial-focus"></div>
    <div id="tutorial-world-pointer" class="tutorial-world-pointer" aria-hidden="true"></div>
    ${getTutorialStepMarkup(step)}
  </div>`;
}

function hud(g: Game) {
  const p = g.player;
  return `<div class="hud">
    <div class="hud-l">
      <div class="row">${bar(p.hp, p.maxHp, 'hp', `HP ${Math.round(p.hp)}/${p.maxHp}`)}${bar(p.sp, p.maxSp, 'sp', `Силы ${Math.round(p.sp)}`)}</div>
      <div class="row">${bar(p.xp, xpToNext(p.level), 'xp', `Ур. ${p.level}${p.level < MAX_LEVEL ? ` · ${p.xp}/${xpToNext(p.level)} XP` : ' · макс'}`)}</div>
    </div>
    <div class="hud-r">
      <span class="coin">${p.money} монет</span>
      <span>${clockOf(g.turn)} · день ${dayOf(g.turn)}</span>
      <span>Круг ${g.circle} · ${g.level.kind === 'hub' ? 'кухня' : 'кладовые ' + g.depth}</span>
      <span class="rep">${repTitle(p.global)}</span>
      <span class="contract">Контракт ${g.contract.done}/${g.contract.need} (кач. ${g.contract.minQ}+)</span>
    </div>
  </div>`;
}

function chits(g: Game) {
  const act = g.orders.filter(o => o.state === 'active');
  if (!act.length) return `<div class="rail"><div class="rail-title">Рейка заказов</div><div class="empty">Пока тихо. Заказы приходят сами — чаще ночью и при хорошей репутации.</div></div>`;
  return `<div class="rail"><div class="rail-title">Рейка заказов</div>` + act.map(o => {
    const left = o.deadline - g.turn;
    const total = o.deadline - o.placedTurn;
    const frac = clamp(left / total, 0, 1);
    const state = left < 0 ? 'over' : frac < 0.3 ? 'hot' : '';
    return `<div class="chit ${state}" data-tutorial="order-card" style="--burn:${(1 - frac) * 100}%">
      <div class="chit-top"><b>${esc(o.cust.name)}</b><span>${left < 0 ? 'ПРОСРОЧЕН' : left + ' ход.'}</span></div>
      <div class="chit-dish">${esc(o.recipe.name)}</div>
      <div class="chit-bot"><span>кач. ${o.minQuality}+</span><span>~${o.reward}💰</span>${btn('refuse', 'отказать', String(o.id), 'mini')}</div>
    </div>`;
  }).join('') + `</div>`;
}

function logBox(g: Game) {
  const last = g.log.slice(-4).reverse();
  return `<div class="log">${last.map((l, i) => `<div class="${i ? 'old' : 'new'}">${esc(l)}</div>`).join('')}
    <div class="keys">Свайп — идти · тап по полю — действие · WASD/E/I/C/R · F5 — сохранить</div></div>`;
}

function modal(g: Game) {
  switch (g.mode) {
    case 'cook': return wrap(g.cook ? cookPanel(g) : stationPanel(g));
    case 'serve': return wrap(servePanel(g));
    case 'shop': return wrap(shopPanel(g));
    case 'inv': return wrap(invPanel(g));
    case 'char': return wrap(charPanel(g));
    case 'recipes': return wrap(recipesPanel(g));
    case 'dead': return wrap(deadPanel(g), true);
    default: return '';
  }
}
const wrap = (inner: string, hard = false) =>
  `<div class="scrim"><div class="panel">${inner}${hard ? '' : `<div class="panel-foot">${btn('close', 'Закрыть (Esc)')}</div>`}</div></div>`;

function stationPanel(g: Game) {
  const st = g.station!;
  const list = g.known.map(recipeById).filter(r => r.station === st.id);
  const rows = list.map(r => {
    const plan = planIngredients(g.player, r);
    const skill = g.player.skills[r.skill];
    const locked = skill < r.difficulty - 15;
    return `<div class="rec ${plan.ok && !locked ? '' : 'dim'}">
      <div><b>${esc(r.name)}</b> <span class="tier">${'★'.repeat(r.tier)}</span></div>
      <div class="sub">${SKILL_NAMES[r.skill]} ${Math.round(skill)}/${r.difficulty} · ${r.time} ходов · база ${r.base}💰</div>
      <div class="sub">${r.needs.map(n => `${n.id ? esc(recipeNeedName(n.id)) : 'любой ' + tagName(n.tag!)} ×${n.qty}`).join(', ')}</div>
      ${locked ? `<div class="warn">Навык слишком низок.</div>` : plan.ok ? btn('cook_start', 'Готовить', r.id) : `<div class="warn">Нет: ${esc(plan.missing.join(', '))}</div>`}
    </div>`;
  }).join('');
  return `<h2>${STATION_NAMES[st.id]} <span class="tier">ур. ${st.tier}</span></h2>
    <div class="sub">Износ: ${Math.round(st.dur)}% ${st.dur < 40 ? '— качество падает, случаются сбои' : ''}</div>
    <div class="rowbtns">${btn('repair', `Починить (${Math.round((100 - st.dur) * 3.5)}💰)`)}${st.tier < 3 ? btn('upgrade', `Улучшить (${400 * st.tier}💰)`) : ''}</div>
    <div class="recs" data-tutorial="station-button">${rows || '<div class="empty">Для этой станции пока нет освоенных рецептов.</div>'}</div>`;
}

const recipeNeedName = (id: string) => ingById(id).name;
function tagName(t: string) {
  return ({ meat: 'мясо', veg: 'овощ', spice: 'специя', grain: 'мука', dairy: 'молочное', liquid: 'жидкость', magic: 'магия' } as any)[t] ?? t;
}

function cookPanel(g: Game) {
  const s = g.cook!, r = s.recipe;
  if (s.technique === 'slice') return slicePanel(g);
  if (s.technique === 'mix') return mixPanel(g);
  const lo = heatLow(r), hi = heatHigh(r);
  const sp = spices(g.player);
  if (sel.spice >= sp.length) sel.spice = 0;
  const heatPct = r.idealHeat > 0 ? clamp(s.heat / (r.idealHeat * 2), 0, 1) * 100 : 0;
  const bandL = r.idealHeat > 0 ? clamp(lo / (r.idealHeat * 2), 0, 1) * 100 : 0;
  const bandW = r.idealHeat > 0 ? clamp((hi - lo) / (r.idealHeat * 2), 0, 1) * 100 : 100;
  return `<h2 data-tutorial="cook-panel">${esc(r.name)}</h2>
  <div class="sub">${STATION_NAMES[r.station]} · ${s.usedNames.join(', ')}</div>
  ${r.idealHeat > 0 ? `<div class="heat">
    <div class="heat-band" style="left:${bandL}%;width:${bandW}%"></div>
    <div class="heat-fill" style="width:${heatPct}%"></div>
    <b>${Math.round(s.heat)}°C · цель ${lo}–${hi}</b>
  </div>` : '<div class="sub">Холодная станция: важны темп, специи и рука.</div>'}
  <div class="row">${bar(s.doneness, 100, 'done', `Готовность ${Math.round(s.doneness)}%`)}</div>
  <div class="row">${bar(s.burn, 60, 'burn', `Пригар ${Math.round(s.burn)}`)}</div>
  ${r.flipEvery ? `<div class="sub">Переворот каждые ${r.flipEvery} ходов · с прошлого: ${s.sinceFlip}</div>` : ''}
  <div class="hint">${esc(s.hint)}</div>
  <div class="rowbtns">
    ${r.idealHeat > 0 ? btn('cook_heat_up', 'Жар + (Q)') + btn('cook_heat_down', 'Жар − (E)') : ''}
    ${r.flipEvery ? btn('cook_flip', 'Перевернуть (F)') : ''}
    ${btn('cook_wait', 'Ждать (Пробел)')}
    ${btn('cook_finish', 'Подавать (Enter)', '', 'primary')}
    ${btn('cook_abort', 'Бросить (Esc)', '', 'danger')}
  </div>
  <div class="spices">Специя: ${sp.length ? sp.map((x, i) => `<button class="chip ${i === sel.spice ? 'on' : ''}" data-act="spice_pick" data-arg="${i}">${esc(x.def.name)} ×${x.qty}</button>`).join('') : '<span class="dim">нет</span>'}
    ${sp.length ? btn('cook_season', 'Добавить (S)') : ''}</div>`;
}

function slicePanel(g: Game) {
  const s = g.cook!, r = s.recipe;
  return `<h2 data-tutorial="cook-panel">${esc(r.name)}</h2>
  <div class="sub">Разделочная доска · ${s.usedNames.join(', ')}</div>
  <div class="sub">Набивай шкалу слайсами и остановись около 100%.</div>
  <div class="row">${bar(s.doneness, 100, 'done', `Нарезка ${Math.round(s.doneness)}%`)}</div>
  <div class="hint">${esc(s.hint)}</div>
  <div class="rowbtns">
    ${btn('cook_slice', 'Нарезать (F)', '', 'primary')}
    ${btn('cook_finish', 'Подавать (Enter)', '', 'primary')}
    ${btn('cook_abort', 'Бросить (Esc)', '', 'danger')}
  </div>`;
}

function mixPanel(g: Game) {
  const s = g.cook!, r = s.recipe;
  const next = s.mixPhase === 'stir' ? 'Помешать' : 'Выдержать';
  return `<h2 data-tutorial="cook-panel">${esc(r.name)}</h2>
  <div class="sub">Алхимический стол · ${s.usedNames.join(', ')}</div>
  <div class="sub">Чередуй «Помешать» и «Выдержать». Сейчас: ${next}.</div>
  <div class="row">${bar(s.doneness, 100, 'done', `Реакция ${Math.round(s.doneness)}%`)}</div>
  <div class="row">${bar(s.stability, 100, 'skill', `Стабильность ${Math.round(s.stability)}%`)}</div>
  <div class="hint">${esc(s.hint)}</div>
  <div class="rowbtns">
    ${btn('cook_stir', 'Помешать (F)', '', s.mixPhase === 'stir' ? 'primary' : '')}
    ${btn('cook_wait', 'Выдержать (Пробел)', '', s.mixPhase === 'rest' ? 'primary' : '')}
    ${btn('cook_finish', 'Подавать (Enter)', '', 'primary')}
    ${btn('cook_abort', 'Бросить (Esc)', '', 'danger')}
  </div>`;
}

function servePanel(g: Game) {
  const act = g.orders.filter(o => o.state === 'active');
  const dishes = g.player.inv.map((it, i) => ({ it, i })).filter(x => x.it.kind === 'dish');
  // Авто-выбор первого активного заказа, если ничего не выбрано или выбран закрытый
  if (!act.find(x => x.id === sel.order)) sel.order = act.length ? act[0].id : -1;
  const o = g.orders.find(x => x.id === sel.order);
  return `<h2 data-tutorial="serve-panel">Стойка выдачи</h2>
  <div class="cols">
    <div><h3>Заказы</h3>${act.map(x => `<button class="rowitem ${x.id === sel.order ? 'on' : ''}" data-act="serve_pick" data-arg="${x.id}">
      <b>${esc(x.cust.name)}</b><span>${esc(x.recipe.name)}</span><span class="dim">кач. ${x.minQuality}+ · ${x.deadline - g.turn} ход.</span></button>`).join('') || '<div class="empty">Заказов нет.</div>'}</div>
    <div><h3>Готовые блюда</h3>${dishes.map(({ it, i }) => it.kind === 'dish' ? `<button class="rowitem" data-act="serve_do" data-arg="${i}" ${o ? '' : 'disabled'}>
      <b>${esc(it.recipe.name)}</b><span>качество ${it.quality}${it.cursedMade ? ' · проклятое' : ''}</span></button>` : '').join('') || '<div class="empty">Нечего подавать.</div>'}</div>
  </div>
  ${o ? `<div class="quote">«${esc(o.cust.lines[0])}» — ${esc(o.cust.title)}</div>` : '<div class="sub">Выбери заказ слева, потом блюдо справа.</div>'}`;
}

function shopPanel(g: Game) {
  const stock = shopStock(g);
  const tools = toolStock(g);
  return `<h2>Лавка Зага</h2><div class="sub">Цены ходят за спросом: скупай в затишье, продавай в наплыв.</div>
  <div class="cols">
    <div data-tutorial="shop-buy"><h3>Купить</h3>
      ${stock.map(i => `<button class="rowitem" data-act="buy" data-arg="${i.id}"><b>${esc(i.name)}</b><span>${g.market.buyPrice(i.id)}💰</span>
        <span class="dim">спрос ${(g.market.rows[i.id].demand).toFixed(2)}</span></button>`).join('')}
      ${tools.map(t => `<button class="rowitem" data-act="buytool" data-arg="${t.id}"><b>${esc(t.name)}</b><span>${t.price}💰</span>
        <span class="dim">урон ${t.dmg[0]}–${t.dmg[1]}</span></button>`).join('')}
    </div>
    <div><h3>Продать</h3>
      ${g.player.inv.map((it, i) => `<button class="rowitem" data-act="sell" data-arg="${i}"><b>${esc(itemName(it))}</b>
        <span>${it.kind === 'ing' ? g.market.sellPrice(it.def.id, it.quality, it.freshness) : it.kind === 'dish' ? Math.round(it.recipe.base * (0.35 + it.quality / 100 * 0.5)) : Math.round(it.def.price * 0.4)}💰</span>
        <span class="dim">×${it.qty}</span></button>`).join('') || '<div class="empty">Сумка пуста.</div>'}
    </div>
  </div>`;
}

function invPanel(g: Game) {
  const p = g.player;
  return `<h2>Сумка <span class="sub">${totalWeight(p).toFixed(1)}/${MAX_WEIGHT} кг</span></h2>
  <div class="sub">В руках: ${p.weapon ? `${esc(p.weapon.def.name)} (прочность ${Math.round(p.weapon.dur)}%)` : 'ничего'}</div>
  <div class="items">${p.inv.map((it, i) => {
    const meta = it.kind === 'ing' ? `качество ${it.quality} · свежесть ${Math.round(it.freshness * 100)}%${it.cursed ? ' · проклятый' : ''}`
      : it.kind === 'dish' ? `качество ${it.quality}` : `прочность ${Math.round(it.dur)}%`;
    return `<div class="item"><div><b>${esc(itemName(it))}</b> ×${it.qty}</div><div class="dim">${meta}</div>
      <div class="rowbtns">${it.kind === 'tool' ? btn('equip', 'В руки', String(i)) : ''}${it.kind === 'dish' ? btn('eat', 'Съесть', String(i)) : ''}${btn('drop', 'Бросить', String(i), 'mini')}</div></div>`;
  }).join('') || '<div class="empty">Пусто.</div>'}</div>`;
}

function charPanel(g: Game) {
  const p = g.player;
  return `<h2>Повар</h2>
  <div class="cols">
    <div><h3>Навыки</h3>${(Object.keys(p.skills) as (keyof typeof p.skills)[]).map(k =>
    `<div class="skill">${SKILL_NAMES[k]}${bar(p.skills[k], 100, 'skill', String(Math.round(p.skills[k])))}</div>`).join('')}
      <h3>Характеристики</h3><div class="stats">${Object.entries(p.stats).map(([k, v]) => `<span>${k.toUpperCase()} ${v}</span>`).join('')}</div>
    </div>
    <div><h3>Репутация · ${repTitle(p.global)} (${Math.round(p.global)})</h3>
      ${Object.entries(p.rep).map(([k, v]) => `<div class="skill">${FACTION_NAMES[k]}${bar(v + 1000, 2000, 'rep', String(Math.round(v)))}</div>`).join('')}
      <h3>Карма · ${karmaTitle(p.karma)} (${p.karma})</h3>
      <div class="sub">Проклятые блюда тянут вниз, благословлённые — вверх. От кармы зависит, кто придёт за тобой в девятом круге.</div>
      <h3>Статистика</h3><div class="sub">Блюд: ${p.dishesCooked} · заказов: ${p.ordersDone} · провалов: ${p.ordersFailed} · убийств: ${p.kills}</div>
      <div class="sub">Души (мета): ${g.meta.souls} · забегов: ${g.meta.runs}</div>
    </div>
  </div>`;
}

function recipesPanel(g: Game) {
  return `<h2>Книга рецептов <span class="sub">${g.known.length}/${RECIPES.length}</span></h2>
  <div class="sub">Рецепты остаются с тобой после смерти — это и есть мета-прогрессия.</div>
  <div class="recs">${g.known.map(recipeById).map(r => `<div class="rec">
    <div><b>${esc(r.name)}</b> <span class="tier">${'★'.repeat(r.tier)}</span></div>
    <div class="sub">${STATION_NAMES[r.station]} · ${SKILL_NAMES[r.skill]} ${r.difficulty} · ${r.time} ходов · ${r.base}💰</div>
    <div class="sub">Профиль: ${Object.entries(r.target).map(([k, v]) => `${tasteName(k)} ${Math.round((v as number) * 100)}%`).join(', ')}</div>
  </div>`).join('')}</div>`;
}
const tasteName = (k: string) => ({ sweet: 'сладость', salt: 'соль', sour: 'кислота', bitter: 'горечь', umami: 'умами', spice: 'острота' } as any)[k] ?? k;

function deadPanel(g: Game) {
  const p = g.player;
  return `<h2 class="dead">Ты умер</h2>
  <div class="sub">День ${dayOf(g.turn)} · круг ${g.circle} · ${p.ordersDone} заказов · ${p.dishesCooked} блюд</div>
  <div class="sub">Сохранено навсегда: ${g.known.length} рецептов, ${g.meta.souls} душ, мастерство (30% навыков).</div>
  <div class="rowbtns">${ARCHETYPES.map(a => btn('newgame', 'Новый забег: ' + a.name, a.id, 'primary')).join('')}</div>`;
}

function startScreen() {
  return `<div class="scrim start"><div class="panel">
    <h1>HELL<span>CHEF</span></h1>
    <div class="tag">Кулинарный рогалик. Ты готовишь для демонов, потому что альтернатива — быть поданным.</div>
    <div class="rowbtns" data-tutorial="new-game">${ARCHETYPES.map(a => `<button class="btn primary tall" data-act="newgame" data-arg="${a.id}"><b>${a.name}</b><span>${a.desc}</span></button>`).join('')}</div>
    ${hasSave() ? `<div class="rowbtns">${btn('continue', 'Продолжить сохранение')}</div>` : ''}
    <div class="sub">WASD — ходить · E — действие · I — сумка · C — герой · R — рецепты · F5 — сохранить</div>
    <div class="rowbtns"><button class="btn mini" data-act="tutorial_toggle" data-tutorial="hint-toggle">Подсказки: ${app.g?.tutorial.enabled ? 'включены' : 'выключены'}</button></div>
  </div></div>`;
}
