// Инвентарь: стеки, вес, подбор ингредиентов под рецепт.
import { IngredientDef, Item, Player, RecipeDef, ToolDef } from './types';

export const MAX_WEIGHT = 50;
export const MAX_SLOTS = 30;

export function itemWeight(it: Item): number {
  if (it.kind === 'ing') return it.def.weight * it.qty;
  if (it.kind === 'tool') return it.def.weight * it.qty;
  return 0.6 * it.qty;
}
export const totalWeight = (p: Player) => p.inv.reduce((s, i) => s + itemWeight(i), 0);
export const itemName = (it: Item) =>
  it.kind === 'ing' ? it.def.name : it.kind === 'dish' ? it.recipe.name : it.def.name;

export function addItem(p: Player, it: Item): boolean {
  if (totalWeight(p) + itemWeight(it) > MAX_WEIGHT) return false;
  if (it.kind === 'ing') {
    const same = p.inv.find(o => o.kind === 'ing' && o.def.id === it.def.id
      && Math.abs(o.quality - it.quality) < 6 && Math.abs(o.freshness - it.freshness) < 0.08) as any;
    if (same) { same.qty += it.qty; return true; }
  }
  if (p.inv.length >= MAX_SLOTS) return false;
  p.inv.push(it);
  return true;
}

export function removeQty(p: Player, it: Item, qty = 1) {
  it.qty -= qty;
  if (it.qty <= 0) p.inv.splice(p.inv.indexOf(it), 1);
}

export function makeIng(def: IngredientDef, quality: number, freshness = 1, qty = 1): Item {
  return {
    kind: 'ing', def, quality: Math.round(quality), freshness, qty,
    cursed: def.tags.includes('cursed'), blessed: def.tags.includes('blessed'),
  };
}
export function makeTool(def: ToolDef, dur = 100): Item {
  return { kind: 'tool', def, dur, qty: 1 };
}

/** Что именно уйдёт в блюдо: берём лучшее по качеству и свежести. */
export function planIngredients(p: Player, r: RecipeDef): { ok: boolean; picks: { item: Item & { kind: 'ing' }; qty: number }[]; missing: string[] } {
  const picks: { item: Item & { kind: 'ing' }; qty: number }[] = [];
  const missing: string[] = [];
  const reserved = new Map<Item, number>();
  for (const need of r.needs) {
    let left = need.qty;
    const cands = p.inv.filter(i => i.kind === 'ing'
      && (need.id ? i.def.id === need.id : i.def.tags.includes(need.tag!))) as (Item & { kind: 'ing' })[];
    cands.sort((a, b) => (b.quality * b.freshness) - (a.quality * a.freshness));
    for (const c of cands) {
      const free = c.qty - (reserved.get(c) ?? 0);
      if (free <= 0) continue;
      const take = Math.min(free, left);
      reserved.set(c, (reserved.get(c) ?? 0) + take);
      picks.push({ item: c, qty: take });
      left -= take;
      if (!left) break;
    }
    if (left > 0) missing.push(`${need.id ?? need.tag} x${left}`);
  }
  return { ok: missing.length === 0, picks, missing };
}

export const spices = (p: Player) =>
  p.inv.filter(i => i.kind === 'ing' && i.def.tags.includes('spice')) as (Item & { kind: 'ing' })[];
