// Бой: пошаговый, кухонные инструменты как оружие, 4 модели поведения ИИ.
import { clamp, RNG } from './core';
import { addItem, makeIng } from './inv';
import { ingById } from './data';
import { grantXP, train } from './progress';
import { Enemy, Item, Level, Player, Status } from './types';
import { passable, tileAt } from './world';

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function addStatus(list: Status[], s: Status) {
  const cur = list.find(x => x.id === s.id);
  if (cur) { cur.turns = Math.max(cur.turns, s.turns); cur.power = Math.max(cur.power, s.power); }
  else list.push(s);
}
export const hasStatus = (list: Status[], id: Status['id']) => list.some(s => s.id === id);

export function tickStatus(list: Status[], hit: (dmg: number, id: string) => void) {
  for (const s of list) {
    if (s.id === 'burn') hit(s.power, 'burn');
    if (s.id === 'poison') hit(s.power, 'poison');
    if (s.id === 'bleed') hit(s.power, 'bleed');
    s.turns--;
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].turns <= 0) list.splice(i, 1);
}

export function playerAttack(p: Player, e: Enemy, lvl: Level, rng: RNG, log: (s: string) => void) {
  const w = p.weapon;
  if (hasStatus(p.status, 'blind') && rng.chance(0.4)) { log('Промах — глаза жжёт.'); return; }
  const [lo, hi] = w ? w.def.dmg : [2, 4];
  const durF = w ? clamp(0.45 + w.dur / 100 * 0.55, 0.45, 1) : 1;
  let dmg = rng.range(lo, hi) * (1 + p.stats.str / 25) * durF;
  const crit = rng.chance(0.05 + p.stats.luck / 100 + p.skills.butcher / 500);
  if (crit) dmg *= 1.8;
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  log(`${crit ? 'Точный удар! ' : ''}${w ? w.def.name : 'Кулак'} → ${e.def.name}: −${dmg} HP.`);

  if (w) {
    w.dur = clamp(w.dur - 1.1, 0, 100);
    if (w.def.effect === 'burn') addStatus(e.status, { id: 'burn', turns: 3, power: 3 });
    if (w.def.effect === 'stun' && rng.chance(0.3)) addStatus(e.status, { id: 'stun', turns: 1, power: 1 });
    if (w.def.effect === 'blind' && rng.chance(0.5)) addStatus(e.status, { id: 'blind', turns: 3, power: 1 });
    if (w.def.effect === 'bleed') addStatus(e.status, { id: 'bleed', turns: 4, power: 2 });
    if (w.dur <= 0) { log(`${w.def.name} сломан!`); p.weapon = null; }
  }
  train(p, 'butcher', 0.4);
  p.sp = Math.max(0, p.sp - 1);

  if (e.hp <= 0) {
    const i = lvl.enemies.indexOf(e);
    if (i >= 0) lvl.enemies.splice(i, 1);
    p.kills++;
    grantXP(p, e.def.xp, log);
    log(`${e.def.name} повержен.`);
    if (e.carrying) lvl.ground.push({ x: e.x, y: e.y, item: e.carrying });
    if (e.def.drops && rng.chance(0.65)) {
      const def = ingById(rng.pick(e.def.drops));
      lvl.ground.push({ x: e.x, y: e.y, item: makeIng(def, rng.range(40, 75)) });
    }
  }
}

function stepToward(e: Enemy, tx: number, ty: number, lvl: Level, away = false) {
  const sx = Math.sign(tx - e.x) * (away ? -1 : 1);
  const sy = Math.sign(ty - e.y) * (away ? -1 : 1);
  const opts = [[sx, sy], [sx, 0], [0, sy]].filter(([dx, dy]) => dx || dy);
  for (const [dx, dy] of opts) {
    const nx = e.x + dx, ny = e.y + dy;
    if (passable(lvl, nx, ny) && !lvl.enemies.some(o => o !== e && o.x === nx && o.y === ny)) { e.x = nx; e.y = ny; return true; }
  }
  return false;
}

export function enemiesTurn(lvl: Level, p: Player, rng: RNG, log: (s: string) => void) {
  for (const e of [...lvl.enemies]) {
    tickStatus(e.status, dmg => { e.hp -= dmg; });
    if (e.hp <= 0) { const i = lvl.enemies.indexOf(e); if (i >= 0) lvl.enemies.splice(i, 1); continue; }
    if (hasStatus(e.status, 'stun')) continue;
    e.cd++;
    if (e.cd < e.def.speed) continue;
    e.cd = 0;

    const d = dist(e, p);
    const hit = (mult = 1) => {
      const dmg = Math.max(1, Math.round(e.def.dmg * mult * rng.range(0.8, 1.2) * (1 - clamp(p.stats.end / 60, 0, 0.35))));
      p.hp -= dmg;
      log(`${e.def.name} бьёт: −${dmg} HP.`);
    };

    if (e.fleeing) { stepToward(e, p.x, p.y, lvl, true); continue; }

    switch (e.def.ai) {
      case 'chaser':
        if (d <= 1) hit(); else if (d < 12) stepToward(e, p.x, p.y, lvl);
        break;
      case 'brute':
        if (d <= 1) hit(1.4); else if (d < 10) stepToward(e, p.x, p.y, lvl);
        break;
      case 'ranged':
        if (d <= 6 && d > 2 && rng.chance(0.6)) { hit(0.8); log(`${e.def.name} швыряет сгусток души.`); }
        else if (d <= 2) stepToward(e, p.x, p.y, lvl, true);
        else if (d < 10) stepToward(e, p.x, p.y, lvl);
        break;
      case 'thief':
        if (d <= 1) {
          const loot = p.inv.filter(i => i.kind === 'ing');
          if (loot.length && rng.chance(0.6)) {
            const it = rng.pick(loot) as Item & { kind: 'ing' };
            const stolen: Item = { ...it, qty: 1 };
            it.qty--; if (it.qty <= 0) p.inv.splice(p.inv.indexOf(it), 1);
            e.carrying = stolen; e.fleeing = true;
            log(`${e.def.name} стащил «${it.def.name}» и удирает!`);
          } else hit(0.7);
        } else if (d < 9) stepToward(e, p.x, p.y, lvl);
        break;
    }
  }
}

/** Лава жжёт того, кто по ней ходит. */
export function hazardTick(lvl: Level, p: Player, log: (s: string) => void) {
  if (tileAt(lvl, p.x, p.y) === 2) {
    p.hp -= 4;
    addStatus(p.status, { id: 'burn', turns: 2, power: 2 });
    log('Ты стоишь в лаве. −4 HP.');
  }
}

export function pickUp(lvl: Level, p: Player, log: (s: string) => void) {
  const i = lvl.ground.findIndex(g => g.x === p.x && g.y === p.y);
  if (i < 0) return false;
  const g = lvl.ground[i];
  if (!addItem(p, g.item)) { log('Инвентарь переполнен.'); return false; }
  lvl.ground.splice(i, 1);
  log(`Подобрано: ${g.item.kind === 'ing' ? g.item.def.name : g.item.kind === 'tool' ? g.item.def.name : g.item.recipe.name}.`);
  return true;
}
