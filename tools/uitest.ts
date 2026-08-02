// Дымовой тест интерфейса без браузера: каждая панель должна собираться без падений.
const listeners: any[] = [];
(globalThis as any).window = { addEventListener: (_: string, f: any) => listeners.push(f) };
(globalThis as any).document = { addEventListener: () => { } };

import { newGame } from '../src/game';
import { app, initUI, render } from '../src/ui';
import { startCook } from '../src/cooking';
import { recipeById } from '../src/data';
import { addItem, makeIng } from '../src/inv';
import { ingById } from '../src/data';

let html = '';
const root: any = { addEventListener: () => { }, set innerHTML(v: string) { html = v; }, get innerHTML() { return html; } };

app.g = newGame('baker', 5);
initUI(root);

const modes = ['world', 'inv', 'char', 'recipes', 'serve', 'shop'] as const;
let bad = 0;
for (const m of modes) {
  app.g.mode = m as any;
  try { render(); if (!html.length) throw new Error('пусто'); console.log(`  ✓ панель ${m} (${html.length} символов)`); }
  catch (e: any) { bad++; console.log(`  ✗ панель ${m}: ${e.message}`); }
}

// Панель станции и активная готовка.
app.g.station = app.g.hub.stations.find(s => s.id === 'oven')!;
app.g.mode = 'cook';
try { render(); console.log('  ✓ панель станции'); } catch (e: any) { bad++; console.log('  ✗ панель станции: ' + e.message); }

for (const id of ['obsidian_flour', 'hell_salt']) addItem(app.g.player, makeIng(ingById(id), 70, 1, 3));
const s = startCook(app.g.player, recipeById('r_bread'), app.g.station!);
if (typeof s === 'string') { bad++; console.log('  ✗ старт готовки: ' + s); }
else {
  app.g.cook = s;
  try { render(); console.log('  ✓ панель готовки'); } catch (e: any) { bad++; console.log('  ✗ панель готовки: ' + e.message); }
}

// Экран смерти и стартовый экран.
app.g.mode = 'dead';
try { render(); console.log('  ✓ экран смерти'); } catch (e: any) { bad++; console.log('  ✗ экран смерти: ' + e.message); }
app.g.mode = 'start';
try { render(); console.log('  ✓ стартовый экран'); } catch (e: any) { bad++; console.log('  ✗ стартовый экран: ' + e.message); }

console.log(bad ? `\n${bad} панелей сломано\n` : '\nИнтерфейс собирается целиком\n');
process.exit(bad ? 1 : 0);
