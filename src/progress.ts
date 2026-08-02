// Прогрессия: опыт, навыки, репутация, карма, мета между забегами.
import { clamp, crc32, Store } from './core';
import { STARTER_RECIPES } from './data';
import { FactionId, Meta, Player, SkillId } from './types';

export const MAX_LEVEL = 30;
/** Опыт до следующего уровня. Кривая ТЗ (level*1000 + level^2*100) требовала тысяч блюд — сжата. */
export const xpToNext = (level: number) => 55 * level + 10 * level * level;

export function grantXP(p: Player, amount: number, log: (s: string) => void) {
  if (p.level >= MAX_LEVEL) return;
  p.xp += Math.round(amount);
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.maxHp += 5 + Math.floor(p.stats.end / 3);
    p.maxSp += 4;
    p.hp = p.maxHp; p.sp = p.maxSp;
    log(`Уровень ${p.level}. Максимум HP ${p.maxHp}, выносливости ${p.maxSp}.`);
  }
}

/** Навык растёт от использования, с затуханием: первые 40 очков быстро, последние 20 — долго. */
export function train(p: Player, skill: SkillId, weight = 1) {
  const cur = p.skills[skill];
  const gain = (2.2 * weight) / (1 + cur / 14);
  p.skills[skill] = clamp(cur + gain, 0, 100);
}

export const SKILL_TIERS = [20, 40, 60, 80, 100];
export const skillTier = (v: number) => SKILL_TIERS.filter(t => v >= t).length;

/** Порог допуска: рецепт сложности D доступен при навыке >= D-15, идеал — при D+20. */
export function skillFactor(skill: number, difficulty: number) {
  return clamp(0.35 + (skill - difficulty + 25) / 60, 0.2, 1.25);
}

export function addRep(p: Player, f: FactionId, d: number) {
  p.rep[f] = clamp(p.rep[f] + d, -1000, 1000);
  p.global = clamp(p.global + d * 0.6, -1000, 1000);
}

export function repTitle(g: number) {
  if (g < -500) return 'Проклятие кухни';
  if (g < -150) return 'Позор';
  if (g < 120) return 'Никто';
  if (g < 380) return 'Известный';
  if (g < 700) return 'Уважаемый';
  return 'Легенда ада';
}
/** Репутация даёт 0.85..1.25 к цене — а не 0.8..1.3 поверх ещё пяти множителей. */
export const repPriceMod = (g: number) => 0.85 + clamp((g + 1000) / 2000, 0, 1) * 0.4;

export function karmaTitle(k: number) {
  if (k <= -60) return 'Пропащий';
  if (k <= -20) return 'Запятнанный';
  if (k < 20) return 'Равнодушный';
  if (k < 60) return 'Сострадающий';
  return 'Светлый';
}

// ── Мета-прогрессия ──────────────────────────────────────────────────────────
const META_KEY = 'hellchef.meta.v1';
export const emptyMeta = (): Meta => ({
  recipes: [...STARTER_RECIPES], skillFloor: {}, souls: 0, runs: 0, bestDay: 0, bestCircle: 1, unlockedCircle: 1,
});

export function loadMeta(): Meta {
  const raw = Store.get(META_KEY);
  if (!raw) return emptyMeta();
  try {
    const { data, sum } = JSON.parse(raw);
    if (crc32(data) !== sum) return emptyMeta();
    return { ...emptyMeta(), ...JSON.parse(data) };
  } catch { return emptyMeta(); }
}
export function saveMeta(m: Meta) {
  const data = JSON.stringify(m);
  Store.set(META_KEY, JSON.stringify({ data, sum: crc32(data) }));
}

/** Смерть: рецепты и часть мастерства остаются, всё остальное сгорает. */
export function absorbRun(m: Meta, p: Player, day: number, circle: number, knownRecipes: string[]) {
  m.runs++;
  m.bestDay = Math.max(m.bestDay, day);
  m.bestCircle = Math.max(m.bestCircle, circle);
  m.unlockedCircle = Math.max(m.unlockedCircle, circle);
  for (const r of knownRecipes) if (!m.recipes.includes(r)) m.recipes.push(r);
  for (const k of Object.keys(p.skills) as SkillId[]) {
    const floor = Math.floor(p.skills[k] * 0.3);
    if (floor > (m.skillFloor[k] ?? 0)) m.skillFloor[k] = floor;
  }
  m.souls += Math.floor(p.ordersDone * 2 + p.kills + p.money / 200);
  saveMeta(m);
}
