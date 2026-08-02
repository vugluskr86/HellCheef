// Готовка: пошаговая мини-игра у станции. Никакого реального времени — каждое действие = 1 ход.
import { clamp, RNG } from './core';
import { ingredientQuality } from './economy';
import { planIngredients, removeQty } from './inv';
import { skillFactor, train } from './progress';
import { Item, Player, RecipeDef, Station, Taste } from './types';

export type CookAction = 'heat_up' | 'heat_down' | 'flip' | 'wait' | 'season' | 'finish';

export interface CookSession {
  recipe: RecipeDef; station: Station;
  heat: number; doneness: number; burn: number;
  sinceFlip: number; flips: number; goodFlips: number;
  taste: Taste;
  usedNames: string[]; cursed: boolean; blessed: boolean;
  baseQ: number; turns: number;
  seasonCount: number;
  done: boolean; quality: number; ruined: boolean;
  hint: string;
}

const zeroTaste = (): Taste => ({ sweet: 0, salt: 0, sour: 0, bitter: 0, umami: 0, spice: 0 });
const AXES: (keyof Taste)[] = ['sweet', 'salt', 'sour', 'bitter', 'umami', 'spice'];

export function startCook(p: Player, r: RecipeDef, st: Station): CookSession | string {
  const plan = planIngredients(p, r);
  if (!plan.ok) return `Не хватает: ${plan.missing.join(', ')}`;
  if (st.dur <= 0) return `${r.station}: оборудование сломано, нужен ремонт.`;
  if (p.sp < 4) return 'Слишком устал. Отдохни на койке.';

  const taste = zeroTaste();
  const usedNames: string[] = [];
  const qsrc: { quality: number; freshness: number }[] = [];
  let cursed = false, blessed = false, parts = 0;
  for (const { item, qty } of plan.picks) {
    for (let i = 0; i < qty; i++) {
      for (const a of AXES) taste[a] += (item.def.taste[a] ?? 0);
      qsrc.push({ quality: item.quality, freshness: item.freshness });
      parts++;
    }
    cursed ||= !!item.cursed; blessed ||= !!item.blessed;
    usedNames.push(`${item.def.name} x${qty}`);
    removeQty(p, item, qty);
  }
  for (const a of AXES) taste[a] = taste[a] / Math.max(1, parts * 0.85);

  return {
    recipe: r, station: st,
    heat: r.idealHeat > 0 ? Math.round(r.idealHeat * 0.35) : 0,
    doneness: 0, burn: 0, sinceFlip: 0, flips: 0, goodFlips: 0,
    taste, usedNames, cursed, blessed,
    baseQ: ingredientQuality(qsrc), turns: 0, seasonCount: 0,
    done: false, quality: 0, ruined: false,
    hint: 'Выведи температуру в зелёную зону и доведи готовность до 100%.',
  };
}

export const heatLow = (r: RecipeDef) => Math.max(0, r.idealHeat - r.heatBand);
export const heatHigh = (r: RecipeDef) => r.idealHeat + r.heatBand;

/** Один ход готовки. Возвращает текст события. */
export function cookStep(s: CookSession, p: Player, act: CookAction, spice: (Item & { kind: 'ing' }) | null, rng: RNG): string {
  if (s.done) return '';
  const r = s.recipe;
  let msg = '';
  const power = 55 + s.station.tier * 12;

  if (act === 'heat_up') { s.heat += power; msg = 'Прибавил жара.'; }
  else if (act === 'heat_down') { s.heat -= power; msg = 'Убавил жар.'; }
  else if (act === 'flip') {
    if (r.flipEvery === 0) { msg = 'Тут нечего переворачивать.'; }
    else {
      s.flips++;
      if (s.sinceFlip >= r.flipEvery - 1 && s.sinceFlip <= r.flipEvery + 1) { s.goodFlips++; msg = 'Идеальный переворот.'; }
      else { msg = 'Перевернул не вовремя.'; s.burn += 1.5; }
      s.sinceFlip = 0;
    }
  } else if (act === 'season' && spice) {
    for (const a of AXES) s.taste[a] = clamp(s.taste[a] + (spice.def.taste[a] ?? 0) * 0.45, 0, 2);
    s.seasonCount++;
    removeQty(p, spice, 1);
    train(p, 'season', 0.6);
    msg = `Добавил: ${spice.def.name}.`;
  } else if (act === 'wait') msg = 'Ждёшь.';

  // Естественное остывание.
  s.heat = clamp(s.heat - Math.max(0, (s.heat - 18) * 0.05), 0, 950);

  // Прогрев блюда.
  const off = Math.abs(s.heat - r.idealHeat);
  const eff = clamp(1.25 - off / (r.heatBand * 1.7), 0.12, 1.25);
  s.doneness = clamp(s.doneness + (100 / r.time) * eff, 0, 160);

  // Пригорание: перегрев и забытая сторона.
  if (s.heat > heatHigh(r)) s.burn += (s.heat - heatHigh(r)) * 0.045 + 0.6;
  if (r.flipEvery > 0) {
    s.sinceFlip++;
    if (s.sinceFlip > r.flipEvery + 1) s.burn += 2.2;
  }
  if (s.doneness > 115) s.burn += 1.6;

  s.turns++;
  p.sp = Math.max(0, p.sp - 0.5);
  s.station.dur = clamp(s.station.dur - 0.22 - r.tier * 0.05, 0, 100);
  if (s.station.dur < 25 && rng.chance(0.05)) { s.burn += 3; msg += ' Станция барахлит.'; }

  s.hint = s.heat > heatHigh(r) ? '⚠ Перегрев! Убавь огонь.'
    : s.heat < heatLow(r) ? 'Холодно — прибавь жара.'
      : (r.flipEvery > 0 && s.sinceFlip > r.flipEvery) ? '⚠ Пора переворачивать.'
        : s.doneness >= 90 ? 'Готово — можно подавать.' : 'Температура в норме.';

  if (s.burn >= 60) { finishCook(s, p, rng); s.ruined = true; }
  return msg;
}

/** Итоговое качество: ингредиенты + навык + прожарка + вкус − пригар − износ. */
export function finishCook(s: CookSession, p: Player, rng: RNG) {
  if (s.done) return;
  const r = s.recipe;
  const doneScore = clamp(100 - Math.abs(s.doneness - 100) * 1.3, 0, 100);
  const sf = skillFactor(p.skills[r.skill], r.difficulty);
  const skillScore = clamp(sf * 82, 0, 100);

  let dev = 0;
  for (const a of AXES) {
    const t = r.target[a] ?? 0;
    dev += Math.abs(clamp(s.taste[a], 0, 1.4) - t);
  }
  const tasteScore = clamp(100 - dev * 46, 0, 100);

  const flipScore = r.flipEvery > 0 ? clamp(s.goodFlips / Math.max(1, Math.floor(r.time / r.flipEvery)) * 100, 0, 100) : 100;
  const wear = (100 - s.station.dur) * 0.14;
  const plating = p.skills.plating * 0.08;

  let q = 0.32 * s.baseQ + 0.24 * skillScore + 0.20 * doneScore + 0.16 * tasteScore + 0.08 * flipScore
    + plating - s.burn - wear + rng.range(-3, 3);
  if (s.blessed) q += 4;
  s.quality = Math.round(clamp(q, 0, 100));
  s.done = true;

  train(p, r.skill, 1 + r.tier * 0.25);
  train(p, 'plating', 0.35);
  p.dishesCooked++;
}

export function dishItem(s: CookSession): Item {
  return { kind: 'dish', recipe: s.recipe, quality: s.ruined ? 0 : s.quality, qty: 1, cursedMade: s.cursed };
}

/** Опыт за готовку: масштаб по сложности и качеству — 15..90 XP. */
export const cookXP = (s: CookSession) => Math.round(12 + s.recipe.tier * 8 + s.quality * 0.35);
