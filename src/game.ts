// Игровой цикл: состояние, ход, взаимодействия, сохранения, смерть.
import { clamp, crc32, dayOf, RNG, Store, TURNS_PER_DAY } from './core';
import { CookSession } from './cooking';
import { CUSTOMERS, ING, ingById, recipeById, RECIPES, STARTER_RECIPES, TOOLS, toolById } from './data';
import { Market } from './economy';
import { enemiesTurn, hazardTick, pickUp, playerAttack, tickStatus } from './combat';
import { addItem, makeIng, makeTool, MAX_WEIGHT, totalWeight } from './inv';
import { expireOrders, nextOrderDelay, pickOrder } from './orders';
import { absorbRun, loadMeta, saveMeta } from './progress';
import { Item, Level, Meta, Order, Player, SkillId, Station } from './types';
import { CIRCLE_NAMES, makeCave, makeHub, passable, tileAt } from './world';

export type Mode = 'world' | 'cook' | 'shop' | 'inv' | 'serve' | 'menu' | 'dead' | 'char' | 'recipes' | 'start';

export interface Contract { need: number; done: number; minQ: number }

export interface Game {
  rng: RNG; seed: number;
  turn: number; circle: number; depth: number;
  player: Player; level: Level; hub: Level;
  market: Market; orders: Order[]; nextOrderAt: number;
  known: string[]; meta: Meta;
  log: string[]; mode: Mode; cook: CookSession | null;
  contract: Contract; dead: boolean; lastDayTick: number;
  station: Station | null; flash: string;
}

export const ARCHETYPES = [
  { id: 'butcher', name: 'Мясник', desc: 'Гриль и разделка. Стартовый тесак.', skills: { butcher: 25, grill: 20 } as Partial<Record<SkillId, number>>, tool: 't_cleaver' },
  { id: 'baker', name: 'Кондитер', desc: 'Печь и подача. Стартовый нож.', skills: { bake: 25, plating: 20 } as Partial<Record<SkillId, number>>, tool: 't_knife' },
  { id: 'alchemist', name: 'Алхимик', desc: 'Варка и алхимия. Горелка.', skills: { alchemy: 22, boil: 22 } as Partial<Record<SkillId, number>>, tool: 't_torch' },
];

function newPlayer(meta: Meta, arch: typeof ARCHETYPES[number]): Player {
  const skills: Record<SkillId, number> = { grill: 5, boil: 5, bake: 5, alchemy: 0, butcher: 5, season: 5, plating: 5 };
  for (const k of Object.keys(skills) as SkillId[]) {
    skills[k] = Math.max(skills[k], meta.skillFloor[k] ?? 0, arch.skills[k] ?? 0);
  }
  const p: Player = {
    x: 13, y: 13, hp: 60, maxHp: 60, sp: 40, maxSp: 40,
    level: 1, xp: 0, money: 220 + meta.souls * 3,
    stats: { str: 6, agi: 6, end: 6, int: 6, cha: 6, luck: 4 },
    skills, inv: [], weapon: null,
    rep: { warriors: 0, nobles: 0, merchants: 0, cultists: 0, angels: -50, guild: 0 },
    global: 0, karma: 0, status: [],
    dishesCooked: 0, ordersDone: 0, ordersFailed: 0, kills: 0,
  };
  const tool = makeTool(toolById(arch.tool)) as Extract<Item, { kind: 'tool' }>;
  p.weapon = tool;
  for (const id of ['cow_meat', 'hell_salt', 'ash_mushroom', 'obsidian_flour', 'scream_onion']) {
    addItem(p, makeIng(ingById(id), 55, 1, id === 'hell_salt' ? 4 : 2));
  }
  return p;
}

export function newGame(archId = 'butcher', seed = Date.now() >>> 0): Game {
  const meta = loadMeta();
  const rng = new RNG(seed);
  const arch = ARCHETYPES.find(a => a.id === archId) ?? ARCHETYPES[0];
  const circle = 1;
  const hub = makeHub(circle, rng);
  const p = newPlayer(meta, arch);
  p.x = hub.entry.x; p.y = hub.entry.y;
  const g: Game = {
    rng, seed, turn: 8 * 60, circle, depth: 0,
    player: p, level: hub, hub,
    market: new Market(rng), orders: [], nextOrderAt: 8 * 60 + 20,
    known: [...new Set([...STARTER_RECIPES, ...meta.recipes])],
    meta, log: [], mode: 'world', cook: null,
    contract: contractFor(circle), dead: false, lastDayTick: 0,
    station: null, flash: '',
  };
  say(g, `Круг ${circle}. ${CIRCLE_NAMES[0]}. Ты — повар, и это твой единственный способ не стать блюдом.`);
  say(g, `Контракт круга: ${g.contract.need} заказа с качеством ${g.contract.minQ}+.`);
  return g;
}

export const contractFor = (circle: number): Contract => ({ need: 2 + circle, done: 0, minQ: 40 + circle * 4 });

export function say(g: Game, s: string) {
  g.log.push(s);
  if (g.log.length > 120) g.log.shift();
  g.flash = s;
}

// ── Течение времени ──────────────────────────────────────────────────────────
export function advance(g: Game, turns: number) {
  const p = g.player;
  for (let t = 0; t < turns; t++) {
    g.turn++;
    // Порча продуктов.
    for (const it of p.inv) {
      if (it.kind !== 'ing') continue;
      it.freshness = clamp(it.freshness - it.def.decay, 0, 1);
    }
    // Восстановление: медленно само по себе, быстро — сном и едой.
    if (g.turn % 8 === 0) p.sp = clamp(p.sp + (g.level.kind === 'hub' ? 0.6 : 0.3), 0, p.maxSp);
    if (g.turn % 90 === 0) p.hp = clamp(p.hp + (g.level.kind === 'hub' ? 2 : 1), 0, p.maxHp);
    if (g.turn - g.lastDayTick >= TURNS_PER_DAY) {
      g.lastDayTick = g.turn;
      g.market.daily(g.rng);
      say(g, `Новый день в аду. День ${dayOf(g.turn)}. Адская администрация списала налог.`);
      const tax = Math.round(20 + g.circle * 15 + p.money * 0.02);
      p.money = Math.max(0, p.money - tax);
    }
    if (g.turn >= g.nextOrderAt && g.orders.filter(o => o.state === 'active').length < 4) {
      const o = pickOrder(g.rng, g.circle, g.known, p, g.turn);
      g.orders.push(o);
      g.nextOrderAt = g.turn + nextOrderDelay(g.rng, g.turn, p.global);
      say(g, `Новый заказ: ${o.cust.name} — «${o.recipe.name}» (${o.deadline - g.turn} ходов).`);
    }
    expireOrders(g.orders, p, g.turn, s => say(g, s));
  }
  tickStatus(p.status, (dmg, id) => {
    p.hp -= dmg;
    if (id === 'burn') say(g, `Ожог: −${dmg} HP.`);
  });
  hazardTick(g.level, p, s => say(g, s));
  if (g.level.kind === 'cave') enemiesTurn(g.level, p, g.rng, s => say(g, s));
  if (p.hp <= 0) die(g);
}

export function die(g: Game) {
  if (g.dead) return;
  g.dead = true; g.mode = 'dead';
  absorbRun(g.meta, g.player, dayOf(g.turn), g.circle, g.known);
  say(g, 'Ты умер. Ад запомнит твои рецепты — и подберёт нового повара.');
}

// ── Перемещение и взаимодействие ─────────────────────────────────────────────
export function move(g: Game, dx: number, dy: number) {
  if (g.mode !== 'world' || g.dead) return;
  const p = g.player, l = g.level;
  const nx = p.x + dx, ny = p.y + dy;
  const foe = l.enemies.find(e => e.x === nx && e.y === ny);
  if (foe) {
    playerAttack(p, foe, l, g.rng, s => say(g, s));
    advance(g, 1);
    return;
  }
  if (!passable(l, nx, ny)) { bump(g, nx, ny); return; }
  const over = totalWeight(p) > MAX_WEIGHT * 0.9;
  p.x = nx; p.y = ny;
  advance(g, over ? 2 : 1);
  if (l.ground.some(gr => gr.x === nx && gr.y === ny)) pickUp(l, p, s => say(g, s));
  if (tileAt(l, nx, ny) === 4 && l.kind === 'cave') say(g, 'Портал наверх. Нажми E, чтобы вернуться на кухню.');
}

/** Упёрся в мебель — это тоже взаимодействие: станции и стойка стоят стеной. */
function bump(g: Game, x: number, y: number) {
  const t = tileAt(g.level, x, y);
  if (t === 3) { const st = g.level.stations.find(s => s.x === x && s.y === y); if (st) { g.station = st; g.mode = 'cook'; } }
  else if (t === 6) g.mode = 'serve';
  else if (t === 5) g.mode = 'shop';
  else if (t === 7) rest(g);
}

export function interact(g: Game) {
  if (g.mode !== 'world' || g.dead) return;
  const p = g.player, l = g.level;
  const here = tileAt(l, p.x, p.y);
  const near: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

  if (here === 8) { gather(g); return; }
  if (here === 4) {
    if (l.kind === 'cave') { toHub(g); return; }
    const sp = l.special.find(s => s.x === p.x && s.y === p.y);
    if (sp?.kind === 'lift') { toCave(g); return; }
    if (sp?.kind === 'gate') { nextCircle(g); return; }
  }
  for (const [dx, dy] of near) {
    const t = tileAt(l, p.x + dx, p.y + dy);
    if (t === 3) { const st = l.stations.find(s => s.x === p.x + dx && s.y === p.y + dy)!; g.station = st; g.mode = 'cook'; return; }
    if (t === 6) { g.mode = 'serve'; return; }
    if (t === 5) { g.mode = 'shop'; return; }
    if (t === 7) { rest(g); return; }
  }
  if (pickUp(l, p, s => say(g, s))) advance(g, 1);
  else say(g, 'Здесь ничего нет.');
}

export function gather(g: Game) {
  const l = g.level, p = g.player;
  const n = l.nodes.find(n => n.x === p.x && n.y === p.y);
  if (!n || n.left <= 0) { say(g, 'Пусто.'); return; }
  const def = ingById(n.ing);
  const q = clamp(35 + p.skills.butcher * 0.25 + p.stats.luck * 1.5 + g.rng.range(-12, 22), 5, 100);
  if (!addItem(p, makeIng(def, q))) { say(g, 'Не унесёшь — инвентарь полон.'); return; }
  n.left--;
  if (n.left <= 0) l.tiles[n.y * l.w + n.x] = 0;
  say(g, `Собрано: ${def.name} (качество ${Math.round(q)}).`);
  advance(g, 3);
}

export function rest(g: Game) {
  const p = g.player;
  p.hp = clamp(p.hp + p.maxHp * 0.5, 0, p.maxHp);
  p.sp = p.maxSp;
  say(g, 'Ты спишь час. Заказы ждать не будут.');
  advance(g, 60);
}

export function toCave(g: Game) {
  g.depth++;
  g.level = makeCave(g.circle, g.depth, g.rng);
  g.player.x = g.level.entry.x; g.player.y = g.level.entry.y;
  say(g, `Спуск в кладовые (уровень ${g.depth}). Тут водятся ингредиенты и то, что ими питается.`);
  advance(g, 20);
}
export function toHub(g: Game) {
  g.level = g.hub;
  g.player.x = g.hub.entry.x; g.player.y = g.hub.entry.y;
  say(g, 'Ты вернулся на кухню.');
  advance(g, 20);
}
export function nextCircle(g: Game) {
  if (g.contract.done < g.contract.need) {
    say(g, `Врата заперты. Контракт: ${g.contract.done}/${g.contract.need} заказов качеством ${g.contract.minQ}+.`);
    return;
  }
  if (g.circle >= 9) { say(g, 'Девятый круг пройден. Ты — легенда адской кухни.'); return; }
  g.circle++;
  g.depth = 0;
  g.hub = makeHub(g.circle, g.rng);
  g.level = g.hub;
  g.player.x = g.hub.entry.x; g.player.y = g.hub.entry.y;
  g.contract = contractFor(g.circle);
  g.orders = g.orders.filter(o => o.state === 'active').slice(0, 1);
  g.meta.unlockedCircle = Math.max(g.meta.unlockedCircle, g.circle);
  saveMeta(g.meta);
  say(g, `${CIRCLE_NAMES[g.circle - 1]}. Клиенты злее, цены выше, контракт: ${g.contract.need} заказа качеством ${g.contract.minQ}+.`);
  advance(g, 60);
}

export function repairStation(g: Game, st: Station) {
  const cost = Math.round((100 - st.dur) * 3.5);
  if (g.player.money < cost) { say(g, `Ремонт стоит ${cost} монет — не хватает.`); return; }
  g.player.money -= cost;
  st.dur = 100;
  say(g, `Ремонт ${st.id}: −${cost} монет.`);
  advance(g, 15);
}

export function upgradeStation(g: Game, st: Station) {
  if (st.tier >= 3) { say(g, 'Станция уже на максимуме.'); return; }
  const cost = 400 * st.tier;
  if (g.player.money < cost) { say(g, `Апгрейд стоит ${cost} монет.`); return; }
  g.player.money -= cost; st.tier++; st.dur = 100;
  say(g, `Станция улучшена до уровня ${st.tier}: мощнее нагрев, меньше износ.`);
  advance(g, 30);
}

/** Открытие рецептов: за уровень навыка и круг. Знание переносится между забегами. */
export function checkDiscoveries(g: Game) {
  for (const r of RECIPES) {
    if (g.known.includes(r.id)) continue;
    const skill = g.player.skills[r.skill];
    if (skill >= r.difficulty - 10 && g.circle >= Math.ceil(r.tier / 2)) {
      g.known.push(r.id);
      say(g, `Новый рецепт: «${r.name}». Опыт кухни подсказал состав.`);
    }
  }
}

// ── Сохранения ───────────────────────────────────────────────────────────────
const SAVE_KEY = 'hellchef.save.v1';
export function saveGame(g: Game): boolean {
  try {
    const data = JSON.stringify({
      seed: g.seed, turn: g.turn, circle: g.circle, depth: g.depth,
      player: { ...g.player, inv: g.player.inv.map(serItem), weapon: g.player.weapon ? serItem(g.player.weapon) : null },
      market: g.market.rows, orders: g.orders.map(o => ({ ...o, cust: o.cust.id, recipe: o.recipe.id })),
      known: g.known, contract: g.contract, lastDayTick: g.lastDayTick,
    });
    Store.set(SAVE_KEY, JSON.stringify({ v: 1, data, sum: crc32(data) }));
    return true;
  } catch { return false; }
}
export const hasSave = () => !!Store.get(SAVE_KEY);

function serItem(it: any): any {
  if (it.kind === 'ing') return { k: 'ing', id: it.def.id, q: it.quality, f: it.freshness, n: it.qty };
  if (it.kind === 'tool') return { k: 'tool', id: it.def.id, d: it.dur, n: it.qty };
  return { k: 'dish', id: it.recipe.id, q: it.quality, n: it.qty, c: it.cursedMade };
}
function deItem(s: any): any {
  if (s.k === 'ing') return makeIng(ingById(s.id), s.q, s.f, s.n);
  if (s.k === 'tool') return { kind: 'tool', def: toolById(s.id), dur: s.d, qty: s.n };
  return { kind: 'dish', recipe: recipeById(s.id), quality: s.q, qty: s.n, cursedMade: s.c };
}

export function loadGame(): Game | null {
  const raw = Store.get(SAVE_KEY);
  if (!raw) return null;
  try {
    const outer = JSON.parse(raw);
    if (crc32(outer.data) !== outer.sum) return null;
    const d = JSON.parse(outer.data);
    const g = newGame('butcher', d.seed);
    g.turn = d.turn; g.circle = d.circle; g.depth = d.depth; g.lastDayTick = d.lastDayTick;
    g.hub = makeHub(g.circle, new RNG(d.seed + g.circle));
    g.level = g.hub;
    g.player = { ...d.player, inv: d.player.inv.map(deItem), weapon: d.player.weapon ? deItem(d.player.weapon) : null };
    g.market.rows = d.market;
    g.known = d.known; g.contract = d.contract;
    g.orders = d.orders.map((o: any) => ({ ...o, cust: CUSTOMERS.find((c: any) => c.id === o.cust), recipe: recipeById(o.recipe) }));
    g.player.x = g.hub.entry.x; g.player.y = g.hub.entry.y;
    say(g, 'Игра загружена.');
    return g;
  } catch { return null; }
}

export function shopStock(g: Game) {
  return ING.filter(i => i.circle <= g.circle);
}
export function toolStock(g: Game) {
  return TOOLS.filter(t => t.price <= 200 + g.circle * 120);
}
