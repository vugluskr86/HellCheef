// Экономика: рынок ингредиентов с возвратом к среднему и расчёт цены блюда.
import { clamp, demandOfHour, RNG } from './core';
import { ING, ingById } from './data';
import { CustomerDef, MarketRow, Player, RecipeDef } from './types';
import { repPriceMod } from './progress';

export class Market {
  rows: Record<string, MarketRow> = {};
  constructor(rng: RNG) {
    for (const i of ING) this.rows[i.id] = { price: i.base, demand: rng.range(0.9, 1.1), supply: 1 };
  }

  /** Раз в сутки: шок спроса + возврат к 1.0, цена тянется к равновесию. Без экспоненциального разгона. */
  daily(rng: RNG) {
    for (const i of ING) {
      const r = this.rows[i.id];
      r.demand = clamp(r.demand + (1 - r.demand) * 0.28 + rng.range(-0.11, 0.11), 0.7, 1.35);
      r.supply = clamp(r.supply + (1 - r.supply) * 0.35, 0.6, 1.5);
      const target = i.base * (0.55 + 0.45 * i.rarity) * (r.demand / r.supply);
      r.price = clamp(r.price + (target - r.price) * 0.3, i.base * 0.5, i.base * 2.0);
    }
  }

  /** Покупка двигает спрос вверх, продажа — предложение: игрок влияет на рынок, но мягко. */
  buyPrice(id: string) { return Math.max(1, Math.round(this.rows[id].price * 1.15)); }
  sellPrice(id: string, quality: number, freshness: number) {
    const q = 0.5 + (quality / 100) * 0.8;
    return Math.max(1, Math.round(this.rows[id].price * 0.7 * q * (0.6 + freshness * 0.4)));
  }
  onBuy(id: string, qty: number) { const r = this.rows[id]; r.demand = clamp(r.demand + 0.03 * qty, 0.7, 1.5); }
  onSell(id: string, qty: number) { const r = this.rows[id]; r.supply = clamp(r.supply + 0.04 * qty, 0.6, 1.8); }
}

/** Качество 0..100 -> множитель 0.55..1.60 (линейно, без разрывов). */
export const qualityMod = (q: number) => 0.55 + clamp(q, 0, 100) / 100 * 1.05;

/**
 * Итоговая оплата заказа. В ТЗ шесть множителей давали разброс x0.25..x23 —
 * здесь четыре, и общий множитель зажат в [0.35, 3.2].
 */
export function orderPayout(recipe: RecipeDef, quality: number, cust: CustomerDef, p: Player, turn: number, late: boolean) {
  let mult = qualityMod(quality) * cust.pay * repPriceMod(p.global) * demandOfHour(turn);
  // Вкусы клиента: попадание в предпочтения ощутимо, но не решает всё.
  const likes = recipe.tags.filter(t => cust.likes.includes(t)).length;
  const hates = recipe.tags.filter(t => cust.dislikes.includes(t)).length;
  mult *= 1 + likes * 0.12 - hates * 0.18;
  if (late) mult *= 0.45;
  mult = clamp(mult, 0.35, 3.2);
  return Math.round(recipe.base * mult);
}

/** Базовое качество из ингредиентов: их качество и свежесть. */
export function ingredientQuality(items: { quality: number; freshness: number }[]) {
  if (!items.length) return 0;
  let s = 0;
  for (const it of items) s += it.quality * (0.55 + it.freshness * 0.45);
  return s / items.length;
}

export const ingredientValue = (id: string) => ingById(id).base;
