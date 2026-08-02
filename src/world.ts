// Генерация уровней: хаб-кухня (ручная планировка) и пещеры (клеточный автомат).
import { RNG } from './core';
import { ENEMIES, ING } from './data';
import { Enemy, Level, StationId } from './types';

export const CIRCLE_NAMES = [
  'Первый круг: Лимб-столовая', 'Второй круг: Похоть', 'Третий круг: Чревоугодие',
  'Четвёртый круг: Жадность', 'Пятый круг: Гнев', 'Шестой круг: Ересь',
  'Седьмой круг: Насилие', 'Восьмой круг: Обман', 'Девятый круг: Предательство',
];

function blank(w: number, h: number, kind: Level['kind'], circle: number, name: string): Level {
  return {
    kind, name, circle, w, h,
    tiles: new Uint8Array(w * h), variant: new Uint8Array(w * h),
    stations: [], nodes: [], enemies: [], ground: [],
    exit: null, entry: { x: 2, y: 2 }, special: [],
  };
}

export const idx = (l: Level, x: number, y: number) => y * l.w + x;
export const tileAt = (l: Level, x: number, y: number) =>
  (x < 0 || y < 0 || x >= l.w || y >= l.h) ? 1 : l.tiles[idx(l, x, y)];
/** Проходимость: стены и мебель блокируют, лава проходима (и жжёт). */
export const passable = (l: Level, x: number, y: number) => {
  const t = tileAt(l, x, y);
  return t !== 1 && t !== 3 && t !== 5 && t !== 6 && t !== 7;
};

export function makeHub(circle: number, rng: RNG): Level {
  const w = 27, h = 19;
  const l = blank(w, h, 'hub', circle, `Кухня — ${CIRCLE_NAMES[circle - 1]}`);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wall = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    l.tiles[idx(l, x, y)] = wall ? 1 : 0;
    l.variant[idx(l, x, y)] = rng.int(3);
  }
  // Очаг посреди кухни — лава как источник огня и света.
  for (let y = 9; y <= 11; y++) for (let x = 12; x <= 14; x++) l.tiles[idx(l, x, y)] = 2;

  const st: [StationId, number, number][] = [
    ['board', 5, 3], ['grill', 9, 3], ['pot', 13, 3], ['oven', 17, 3], ['alchemy', 21, 3],
  ];
  for (const [id, x, y] of st) {
    l.tiles[idx(l, x, y)] = 3;
    l.stations.push({ id, x, y, dur: 100, busy: false, tier: 1 });
  }
  // Стойка выдачи (клиенты подходят с той стороны).
  for (let x = 10; x <= 16; x++) l.tiles[idx(l, x, 15)] = 6;
  // Лавка, койка, ремонт.
  l.tiles[idx(l, 3, 15)] = 5;
  l.tiles[idx(l, 23, 15)] = 7;
  l.special.push({ x: 3, y: 15, kind: 'repair' });
  // Лифт в пещеры и врата в следующий круг.
  l.tiles[idx(l, 24, 3)] = 4; l.special.push({ x: 24, y: 3, kind: 'lift' });
  l.tiles[idx(l, 2, 3)] = 4; l.special.push({ x: 2, y: 3, kind: 'gate' });
  l.exit = { x: 24, y: 3 };
  l.entry = { x: 13, y: 13 };
  return l;
}

export function makeCave(circle: number, depth: number, rng: RNG): Level {
  const w = 46, h = 34;
  const l = blank(w, h, 'cave', circle, `Кладовые ада — уровень ${depth}`);
  const T = l.tiles;
  for (let i = 0; i < w * h; i++) T[i] = rng.chance(0.45) ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) T[idx(l, x, y)] = 1;

  for (let pass = 0; pass < 5; pass++) {
    const next = T.slice();
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        if (dx || dy) n += T[idx(l, x + dx, y + dy)] === 1 ? 1 : 0;
      next[idx(l, x, y)] = n > 4 ? 1 : n < 4 ? 0 : T[idx(l, x, y)];
    }
    T.set(next);
  }

  // Оставляем только крупнейшую полость.
  const seen = new Uint8Array(w * h);
  let best: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (T[i] === 1 || seen[i]) continue;
    const stack = [i], region: number[] = [];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!; region.push(c);
      const x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, ni = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ni] || T[ni] === 1) continue;
        seen[ni] = 1; stack.push(ni);
      }
    }
    if (region.length > best.length) best = region;
  }
  T.fill(1);
  for (const i of best) T[i] = 0;
  for (let i = 0; i < w * h; i++) l.variant[i] = rng.int(3);

  const floors = best.slice();
  rng.shuffle(floors);
  const pos = (i: number) => ({ x: floors[i] % w, y: (floors[i] / w) | 0 });

  // Лавовые лужи.
  const pools = 3 + circle;
  for (let p = 0; p < pools; p++) {
    const c = pos(rng.int(floors.length));
    const r = rng.irange(1, 2);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (x > 1 && y > 1 && x < w - 2 && y < h - 2 && T[idx(l, x, y)] === 0 && dx * dx + dy * dy <= r * r) T[idx(l, x, y)] = 2;
    }
  }

  const free = floors.filter(i => T[i] === 0);
  rng.shuffle(free);
  let k = 0;
  const take = () => { const i = free[k++]; return { x: i % w, y: (i / w) | 0 }; };

  l.entry = take();
  // Выход подальше от входа.
  let exit = take();
  for (let tries = 0; tries < 40; tries++) {
    const c = take();
    if (Math.abs(c.x - l.entry.x) + Math.abs(c.y - l.entry.y) > Math.abs(exit.x - l.entry.x) + Math.abs(exit.y - l.entry.y)) exit = c;
  }
  l.exit = exit; T[idx(l, exit.x, exit.y)] = 4;

  // Ингредиентные точки: чем глубже, тем ценнее.
  const pool = ING.filter(i => i.circle <= circle);
  const rich = ING.filter(i => i.circle <= circle && i.rarity >= 1.3);
  const nodeCount = 9 + circle * 2;
  for (let i = 0; i < nodeCount; i++) {
    const c = take();
    if (!c) break;
    const def = rng.chance(0.25 + depth * 0.05) && rich.length ? rng.pick(rich) : rng.pick(pool);
    l.nodes.push({ x: c.x, y: c.y, ing: def.id, left: rng.irange(1, 3) });
    T[idx(l, c.x, c.y)] = 8;
  }

  // Враги.
  const bag = ENEMIES.filter(e => e.circle <= circle);
  const count = 4 + circle * 2 + depth;
  for (let i = 0; i < count; i++) {
    const c = take();
    if (!c) break;
    const def = rng.pick(bag);
    const boost = 1 + (circle - def.circle) * 0.25 + depth * 0.1;
    const e: Enemy = { def, x: c.x, y: c.y, hp: Math.round(def.hp * boost), cd: 0, status: [] };
    l.enemies.push(e);
  }
  return l;
}
