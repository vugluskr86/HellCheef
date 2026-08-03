// Готовка: пошаговая мини-игра у станции. Никакого реального времени — каждое действие = 1 ход.
import { clamp, RNG } from './core';
import { ingredientQuality } from './economy';
import { planIngredients, removeQty } from './inv';
import { skillFactor, train } from './progress';
import { Item, Player, RecipeDef, Station, StationId, Taste } from './types';

export type CookAction = 'heat_up' | 'heat_down' | 'flip' | 'slice' | 'stir' | 'wait' | 'season' | 'finish';
export type CookTechnique = 'heat' | 'slice' | 'mix';

export interface CookSession {
  recipe: RecipeDef; station: Station;
  technique: CookTechnique;
  heat: number; doneness: number; burn: number;
  sinceFlip: number; flips: number; goodFlips: number;
  goodActions: number; mixPhase: 'stir' | 'rest'; stability: number;
  taste: Taste;
  usedNames: string[]; cursed: boolean; blessed: boolean;
  baseQ: number; turns: number;
  seasonCount: number;
  done: boolean; quality: number; ruined: boolean;
  hint: string;
}

const zeroTaste = (): Taste => ({ sweet: 0, salt: 0, sour: 0, bitter: 0, umami: 0, spice: 0 });
const AXES: (keyof Taste)[] = ['sweet', 'salt', 'sour', 'bitter', 'umami', 'spice'];
const techniqueFor = (station: StationId): CookTechnique =>
  station === 'board' ? 'slice' : station === 'alchemy' ? 'mix' : 'heat';

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

  const technique = techniqueFor(st.id);
  const hint = technique === 'slice'
    ? 'Делай ровные слайсы и остановись, когда шкала будет около 100%.'
    : technique === 'mix'
      ? 'Чередуй помешивание и выдержку, чтобы удержать смесь стабильной.'
      : 'Выведи температуру в зелёную зону и доведи готовность до 100%.';

  return {
    recipe: r, station: st,
    technique,
    heat: r.idealHeat > 0 ? Math.round(r.idealHeat * 0.35) : 0,
    doneness: 0, burn: 0, sinceFlip: 0, flips: 0, goodFlips: 0,
    goodActions: 0, mixPhase: 'stir', stability: 100,
    taste, usedNames, cursed, blessed,
    baseQ: ingredientQuality(qsrc), turns: 0, seasonCount: 0,
    done: false, quality: 0, ruined: false,
    hint,
  };
}

export const heatLow = (r: RecipeDef) => Math.max(0, r.idealHeat - r.heatBand);
export const heatHigh = (r: RecipeDef) => r.idealHeat + r.heatBand;

/** Один ход готовки. Возвращает текст события. */
export function cookStep(s: CookSession, p: Player, act: CookAction, spice: (Item & { kind: 'ing' }) | null, rng: RNG): string {
  if (s.done) return '';
  if (s.technique === 'slice') return sliceStep(s, p, act, spice, rng);
  if (s.technique === 'mix') return mixStep(s, p, act, spice, rng);
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

function addSeasoning(s: CookSession, p: Player, spice: (Item & { kind: 'ing' }) | null) {
  if (!spice) return 'Специй нет.';
  for (const a of AXES) s.taste[a] = clamp(s.taste[a] + (spice.def.taste[a] ?? 0) * 0.45, 0, 2);
  s.seasonCount++;
  removeQty(p, spice, 1);
  train(p, 'season', 0.6);
  return `Добавил: ${spice.def.name}.`;
}

function specialTurn(s: CookSession, p: Player, rng: RNG, penalty: () => void) {
  const r = s.recipe;
  s.turns++;
  p.sp = Math.max(0, p.sp - 0.5);
  s.station.dur = clamp(s.station.dur - 0.22 - r.tier * 0.05, 0, 100);
  if (s.station.dur < 25 && rng.chance(0.05)) penalty();
}

function sliceStep(s: CookSession, p: Player, act: CookAction, spice: (Item & { kind: 'ing' }) | null, rng: RNG) {
  const cutSize = 100 / Math.max(3, Math.ceil(s.recipe.time / 1.5));
  let msg = '';
  if (act === 'slice') {
    s.goodActions++;
    s.doneness = clamp(s.doneness + cutSize, 0, 135);
    msg = s.doneness > 108 ? 'Слишком тонко — остановись, пока слайсы не превратились в кашу.' : 'Ровный слайс.';
  } else if (act === 'season') msg = addSeasoning(s, p, spice);
  else if (act === 'wait') msg = 'Прикидываешь следующий рез.';
  else msg = 'На доске нужен нож, а не жар.';

  specialTurn(s, p, rng, () => { s.burn += 3; msg += ' Доска треснула под ножом.'; });
  s.hint = s.doneness < 90 ? 'Продолжай нарезку: остановиться лучше чуть раньше, чем превратить всё в фарш.'
    : s.doneness <= 106 ? 'Слайсы готовы — можно подавать.'
      : 'Нарезка перешла в кашу: подавай сейчас, чтобы не потерять ещё больше.';
  return msg;
}

function mixStep(s: CookSession, p: Player, act: CookAction, spice: (Item & { kind: 'ing' }) | null, rng: RNG) {
  const progress = 100 / s.recipe.time;
  let msg = '';
  if (act === 'stir') {
    s.doneness = clamp(s.doneness + progress, 0, 130);
    if (s.mixPhase === 'stir') {
      s.goodActions++;
      s.stability = clamp(s.stability + 3, 0, 100);
      msg = 'Смесь послушно закрутилась.';
    } else {
      s.stability = clamp(s.stability - 12, 0, 100);
      msg = 'Слишком рано: вихрь разбалансировал смесь.';
    }
    s.mixPhase = 'rest';
  } else if (act === 'wait') {
    s.doneness = clamp(s.doneness + progress, 0, 130);
    if (s.mixPhase === 'rest') {
      s.goodActions++;
      msg = 'Смесь выдержана.';
    } else {
      s.stability = clamp(s.stability - 10, 0, 100);
      msg = 'Передержал: смесь дрогнула.';
    }
    s.mixPhase = 'stir';
  } else if (act === 'season') msg = addSeasoning(s, p, spice);
  else msg = 'Алхимическая смесь не нуждается в огне.';

  specialTurn(s, p, rng, () => { s.stability = clamp(s.stability - 8, 0, 100); msg += ' Стол вибрирует.'; });
  s.hint = s.stability <= 0 ? '⚠ Смесь рассыпалась — эксперимент провален.'
    : s.doneness >= 90 ? 'Эликсир почти готов — подавай, пока реакция стабильна.'
      : s.mixPhase === 'stir' ? 'Смесь отстоялась: пора помешать.'
        : 'Теперь дай смеси немного постоять.';
  if (s.stability <= 0) { finishCook(s, p, rng); s.ruined = true; }
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

  const techniqueScore = s.technique === 'mix'
    ? clamp(s.goodActions / r.time * 100, 0, 100)
    : s.technique === 'slice'
      ? clamp(s.goodActions / Math.max(3, Math.ceil(r.time / 1.5)) * 100, 0, 100)
      : r.flipEvery > 0
        ? clamp(s.goodFlips / Math.max(1, Math.floor(r.time / r.flipEvery)) * 100, 0, 100)
        : 100;
  const wear = (100 - s.station.dur) * 0.14;
  const plating = p.skills.plating * 0.08;

  let q = 0.32 * s.baseQ + 0.24 * skillScore + 0.20 * doneScore + 0.16 * tasteScore + 0.08 * techniqueScore
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
