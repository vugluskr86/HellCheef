// Заказы: генерация, дедлайны в ходах, выдача, провал.
import { clamp, demandOfHour, RNG } from './core';
import { CUSTOMERS, recipeById } from './data';
import { orderPayout } from './economy';
import { addRep } from './progress';
import { CustomerDef, Item, Order, Player, RecipeDef } from './types';

export const MAX_ACTIVE = 4;
let nextId = 1;

/**
 * Дедлайн. В ТЗ формула умножала время на «срочность» — чем нетерпеливее клиент,
 * тем БОЛЬШЕ времени он давал, а у гремлина (3 мин) заказ был физически невыполним.
 * Здесь срочность делит, а снизу стоит жёсткий пол: время готовки + запас на подход и сбор.
 */
export function deadlineFor(r: RecipeDef, c: CustomerDef) {
  const patienceF = 0.85 + (c.patience / 100) * 0.95;
  const complexity = r.difficulty / 100;
  const raw = r.time * (1 + 0.7 * complexity) * patienceF / c.urgency;
  const floor = Math.round(r.time * 1.7) + 14;
  return Math.max(floor, Math.round(raw) + 14);
}

export function pickOrder(rng: RNG, circle: number, known: string[], p: Player, turn: number): Order {
  const custs = CUSTOMERS.filter(c => c.circle <= circle);
  const cust = rng.pick(custs);
  // Клиент чаще просит то, что любит, но иногда — что угодно из освоенного.
  const pool = known.map(recipeById).filter(r => r.tier <= Math.min(5, circle + 1));
  const liked = pool.filter(r => r.tags.some(t => cust.likes.includes(t)) && !r.tags.some(t => cust.dislikes.includes(t)));
  const recipe = (liked.length && rng.chance(0.7)) ? rng.pick(liked) : rng.pick(pool);
  const dl = deadlineFor(recipe, cust);
  return {
    id: nextId++, cust, recipe,
    placedTurn: turn, deadline: turn + dl,
    reward: orderPayout(recipe, 70, cust, p, turn, false),
    minQuality: clamp(cust.minQuality + (circle - 1) * 3, 10, 90),
    seat: 0, state: 'active',
  };
}

/** Интервал между заказами: ночью гуще, репутация притягивает клиентов. */
export function nextOrderDelay(rng: RNG, turn: number, global: number) {
  const base = rng.irange(70, 130);
  const f = demandOfHour(turn) * (1 + clamp(global, -400, 1000) / 2500);
  return Math.max(25, Math.round(base / f));
}

export interface ServeResult { ok: boolean; text: string; pay: number; xp: number; q: number }

export function serveOrder(o: Order, dish: Extract<Item, { kind: 'dish' }>, p: Player, turn: number): ServeResult {
  if (dish.recipe.id !== o.recipe.id) return { ok: false, text: `${o.cust.name} заказывал «${o.recipe.name}», а не это.`, pay: 0, xp: 0, q: 0 };
  const late = turn > o.deadline;
  const q = dish.quality;
  const c = o.cust;

  // Подача учитывается ровно настолько, насколько клиенту это важно.
  const effQ = clamp(q * (1 - c.caresPlating) + q * c.caresPlating * (0.6 + p.skills.plating / 250), 0, 100);
  if (effQ < o.minQuality * 0.6 || q === 0) {
    o.state = 'failed';
    addRep(p, c.faction, -28);
    p.ordersFailed++;
    return { ok: false, text: `${c.name} выплёвывает блюдо. Репутация падает.`, pay: 0, xp: 5, q: effQ };
  }

  const pay = orderPayout(o.recipe, effQ, c, p, turn, late);
  const shortfall = effQ < o.minQuality;
  const tip = (!late && !shortfall && effQ > 85) ? Math.round(pay * 0.25 * (1 + p.stats.cha / 20)) : 0;

  o.state = 'done';
  p.money += pay + tip;
  p.ordersDone++;

  // Репутация: +8..+26 за успех, штраф за опоздание и недотяг по качеству.
  let rep = 8 + Math.round(effQ / 6);
  if (late) rep -= 22;
  if (shortfall) rep -= 10;
  addRep(p, c.faction, rep);
  if (dish.cursedMade) { p.karma -= 2; addRep(p, 'angels', -6); addRep(p, 'cultists', 4); }
  if (dish.recipe.tags.includes('blessed')) { p.karma += 3; addRep(p, 'angels', 8); addRep(p, 'cultists', -5); }

  const xp = Math.round(18 + o.recipe.tier * 10 + effQ * 0.3);
  const parts = [`${c.name}: ${effQ >= 85 ? 'превосходно!' : effQ >= o.minQuality ? 'сойдёт.' : 'слабовато…'}`, `+${pay} монет`];
  if (tip) parts.push(`чаевые +${tip}`);
  if (late) parts.push('но ты опоздал');
  return { ok: true, text: parts.join(', ') + '.', pay: pay + tip, xp, q: effQ };
}

export function expireOrders(orders: Order[], p: Player, turn: number, log: (s: string) => void) {
  for (const o of orders) {
    if (o.state !== 'active' || turn <= o.deadline + 10) continue;
    o.state = 'failed';
    p.ordersFailed++;
    addRep(p, o.cust.faction, -35);
    log(`${o.cust.name} ушёл, не дождавшись «${o.recipe.name}».`);
  }
}
