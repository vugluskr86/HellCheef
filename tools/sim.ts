// Балансовый прогон без DOM: проверяет выполнимость дедлайнов, экономику, темп прогрессии.
import { RNG, dayOf } from '../src/core';
import { CUSTOMERS, ING, RECIPES, ingById, recipeById } from '../src/data';
import { Market, orderPayout } from '../src/economy';
import { cookStep, finishCook, heatHigh, heatLow, startCook } from '../src/cooking';
import { deadlineFor, serveOrder } from '../src/orders';
import { xpToNext } from '../src/progress';
import { addItem, makeIng } from '../src/inv';
import { advance, newGame } from '../src/game';

let failures = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { failures++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

console.log('\n1. Дедлайны выполнимы для всех пар рецепт × клиент');
let worst = Infinity, worstPair = '';
for (const r of RECIPES) for (const c of CUSTOMERS) {
  const dl = deadlineFor(r, c);
  const slack = dl - r.time;
  if (slack < worst) { worst = slack; worstPair = `${r.name} / ${c.name}`; }
}
ok(worst >= 14, `минимальный запас поверх времени готовки: ${worst} ходов (${worstPair})`);

console.log('\n2. Экономика: 200 дней рынка без разгона цен');
const rng = new RNG(7);
const m = new Market(rng);
let maxDev = 0, maxDaily = 0;
const prev: Record<string, number> = {};
for (const i of ING) prev[i.id] = m.rows[i.id].price;
for (let d = 0; d < 200; d++) {
  m.daily(rng);
  for (const i of ING) {
    const p = m.rows[i.id].price;
    maxDev = Math.max(maxDev, Math.abs(p - i.base) / i.base);
    maxDaily = Math.max(maxDaily, Math.abs(p - prev[i.id]) / prev[i.id]);
    prev[i.id] = p;
  }
}
ok(maxDev <= 1.0, `максимальное отклонение от базовой цены: ${(maxDev * 100).toFixed(0)}%`);
ok(maxDaily <= 0.25, `максимальный дневной скачок: ${(maxDaily * 100).toFixed(1)}%`);

console.log('\n3. Разброс выплаты за заказ');
const g0 = newGame('butcher', 42);
let lo = Infinity, hi = 0;
for (const r of RECIPES) for (const c of CUSTOMERS) for (const q of [0, 25, 50, 75, 100]) {
  const pay = orderPayout(r, q, c, g0.player, 20 * 60, false) / r.base;
  lo = Math.min(lo, pay); hi = Math.max(hi, pay);
}
ok(hi / lo <= 10, `множитель цены x${lo.toFixed(2)}..x${hi.toFixed(2)} (в ТЗ выходило x0.25..x23)`);

console.log('\n4. Прогрессия: сколько заказов до 10 уровня');
let xp = 0, lvl = 1, orders = 0;
while (lvl < 10 && orders < 5000) {
  xp += 90; orders++; // готовка + выдача
  while (xp >= xpToNext(lvl)) { xp -= xpToNext(lvl); lvl++; }
}
ok(orders >= 25 && orders <= 120, `${orders} заказов среднего размера до 10 уровня`);

console.log('\n5. Автоповар: 60 игровых часов полного цикла');
const g = newGame('butcher', 99);
// Снабжаем кухню, чтобы проверять именно готовку и заказы.
for (const id of ['cow_meat', 'imp_flesh', 'hell_salt', 'ash_mushroom', 'cave_moss', 'obsidian_flour', 'scream_onion'])
  addItem(g.player, makeIng(ingById(id), 65, 1, 9));

const qualities: number[] = [];
let served = 0, failed = 0, guard = 0;
while (dayOf(g.turn) <= 3 && guard++ < 40000) {
  const order = g.orders.find(o => o.state === 'active');
  if (!order) { advance(g, 5); continue; }
  const st = g.hub.stations.find(s => s.id === order.recipe.station)!;
  const sess = startCook(g.player, order.recipe, st);
  if (typeof sess === 'string') {
    if (sess.includes('устал')) { g.player.sp = g.player.maxSp; g.player.hp = g.player.maxHp; advance(g, 60); continue; }
    // Нет продуктов — докупаем на рынке.
    for (const need of order.recipe.needs) {
      const def = need.id ? ingById(need.id) : ING.find(i => i.tags.includes(need.tag!))!;
      if (addItem(g.player, makeIng(def, 60, 1, need.qty))) g.player.money -= g.market.buyPrice(def.id) * need.qty;
    }
    advance(g, 3);
    continue;
  }
  const r = order.recipe;
  while (!sess.done && sess.turns < r.time * 4) {
    let act: any = 'wait';
    if (r.idealHeat > 0 && sess.heat < heatLow(r) + r.heatBand * 0.3) act = 'heat_up';
    else if (r.idealHeat > 0 && sess.heat > heatHigh(r) - r.heatBand * 0.2) act = 'heat_down';
    else if (r.flipEvery && sess.sinceFlip >= r.flipEvery) act = 'flip';
    cookStep(sess, g.player, act, null, g.rng);
    advance(g, 1);
    if (sess.doneness >= 96) break;
  }
  if (!sess.done) finishCook(sess, g.player, g.rng);
  qualities.push(sess.quality);
  const res = serveOrder(order, { kind: 'dish', recipe: r, quality: sess.quality, qty: 1 }, g.player, g.turn);
  res.ok ? served++ : failed++;
  advance(g, 2);
  if (g.player.hp <= 0) break;
}
const avg = qualities.reduce((a, b) => a + b, 0) / Math.max(1, qualities.length);
console.log(`  блюд: ${qualities.length}, среднее качество: ${avg.toFixed(1)}, выдано: ${served}, провалов: ${failed}`);
console.log(`  монет: ${g.player.money}, уровень: ${g.player.level}, гриль-навык: ${g.player.skills.grill.toFixed(1)}, износ гриля: ${g.hub.stations[1].dur.toFixed(0)}%`);
ok(qualities.length > 5, 'цикл заказ → готовка → выдача работает');
ok(avg > 30 && avg < 95, `среднее качество новичка в разумном коридоре: ${avg.toFixed(1)}`);
ok(served > failed, `успешных выдач больше, чем провалов (${served}/${failed})`);
ok(g.player.money > 0, `экономика не уходит в минус: ${g.player.money} монет`);

console.log(`\n${failures ? failures + ' проверок провалено' : 'Все проверки пройдены'}\n`);
process.exit(failures ? 1 : 0);
