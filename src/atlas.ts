// Атлас спрайтов 16x16, собирается в рантайме: ни одного внешнего ассета.
import { RNG } from './core';

export const CELL = 16, COLS = 16, ATLAS = CELL * COLS;

const PAL: Record<string, string> = {
  '0': '#0b0710', '1': '#1a1024', '2': '#2b1a33', '3': '#3d2440', '4': '#56344b', '5': '#7a4a55',
  '6': '#a06a5e', '7': '#d99a6c', '8': '#f2d3a0', '9': '#ff7b2e', 'a': '#ff4520', 'b': '#b31414',
  'c': '#6e0d12', 'd': '#2e6b6b', 'e': '#4fd6c8', 'f': '#f7f0e0', 'g': '#8c8c9a', 'h': '#c6c6d4',
  'i': '#4a3524', 'j': '#7a5533', 'k': '#b08040', 'l': '#ffd447', 'm': '#3a7a3a', 'n': '#7fd45a',
  'o': '#5a2d6b', 'p': '#b06ad6',
};

const S: Record<string, string[]> = {
  chef: [
    '................', '.....ffff.......', '....ffffffff....', '....ffffffff....',
    '.....ffffff.....', '.....677776.....', '.....707706.....', '.....677776.....',
    '......6666......', '....ffffffff....', '...6ffffffff6...', '...6ffffffff6...',
    '....ffffffff....', '....11111111....', '....11....11....', '....00....00....'],
  demon: [
    '................', '..g..........g..', '..gg........gg..', '...ggb....bgg...',
    '....bbbbbbbb....', '...bb8bbbb8bb...', '...bbbbbbbbbb...', '....bfffffb.....',
    '....bbbbbbbb....', '...cbbbbbbbbc...', '..ccbbbbbbbbcc..', '..cc.bbbbbb.cc..',
    '...ccbbbbbbcc...', '....cc....cc....', '....cc....cc....', '....00....00....'],
  imp: [
    '................', '................', '................', '....g......g....',
    '....gb....bg....', '.....bbbbbb.....', '.....b9bb9b.....', '.....bbbbbb.....',
    '......bffb......', '.....cbbbbc.....', '....ccbbbbcc....', '.....cbbbbc.....',
    '......c..c......', '......c..c......', '......0..0......', '................'],
  hound: [
    '................', '................', '................', '..........a..a..',
    '..........aaaa..', '...aaaaaaaaaa9a.', '..aaaaaaaaaaaaa.', '..baaaaaaaaabba.',
    '..bbaaaaaaabbb..', '...b.b....b.b...', '...b.b....b.b...', '...9.9....9.9...',
    '................', '................', '................', '................'],
  wisp: [
    '................', '.......ee.......', '......eeee......', '.....eeeeee.....',
    '.....ef00fe.....', '.....eeeeee.....', '......eeee......', '.....e.ee.e.....',
    '....e..dd..e....', '.......dd.......', '......d..d......', '.....d....d.....',
    '................', '................', '................', '................'],
  golem: [
    '................', '................', '....jjjjjjjj....', '...jjjjjjjjjj...',
    '..jjj9jjjj9jjj..', '..jjjjjjjjjjjj..', '..jjjjffffjjjj..', '.jjjjjjjjjjjjjj.',
    '.jkjjjjjjjjjjkj.', '.jjjjjjjjjjjjjj.', '..jjjjjjjjjjjj..', '...jjjjjjjjjj...',
    '....jj....jj....', '....jj....jj....', '....ii....ii....', '................'],
  grill: [
    '................', '.gggggggggggggg.', '.g............g.', '.g.aaaaaaaaaa.g.',
    '.g.a99999999a.g.', '.g.a9aaaaaa9a.g.', '.g.a9a9999a9a.g.', '.g.a9a9999a9a.g.',
    '.g.a9aaaaaa9a.g.', '.g.a99999999a.g.', '.g.aaaaaaaaaa.g.', '.g............g.',
    '.gggggggggggggg.', '.hh..........hh.', '................', '................'],
  pot: [
    '................', '................', '..gggggggggggg..', '..g..........g..',
    '..g.dddddddd.g..', '..g.deeeeeed.g..', '..g.deffffed.g..', '..g.deeeeeed.g..',
    '..g.dddddddd.g..', '..g..........g..', '..gggggggggggg..', '...9........9...',
    '..99a......a99..', '...9a........9..', '................', '................'],
  oven: [
    '................', '.hhhhhhhhhhhhhh.', '.h............h.', '.h.iiiiiiiiii.h.',
    '.h.i99999999i.h.', '.h.i9aaaaaa9i.h.', '.h.i9aaaaaa9i.h.', '.h.i99999999i.h.',
    '.h.iiiiiiiiii.h.', '.h............h.', '.h.gg......gg.h.', '.hhhhhhhhhhhhhh.',
    '................', '................', '................', '................'],
  board: [
    '................', '................', '..jjjjjjjjjjjj..', '..jkkkkkkkkkkj..',
    '..jkkkkkkkkkkj..', '..jkkbbkkkkkkj..', '..jkkbbkkhhhhj..', '..jkkkkkkhkkkj..',
    '..jkkkkkkkkkkj..', '..jkkkkkkkkkkj..', '..jjjjjjjjjjjj..', '................',
    '................', '................', '................', '................'],
  alchemy: [
    '................', '..oooooooooooo..', '..o..........o..', '..o..p....p..o..',
    '..o.pep..pep.o..', '..o.ppp..ppp.o..', '..o..p....p..o..', '..o.eee..eee.o..',
    '..o..........o..', '..o.ffffffff.o..', '..o.fpppppdf.o..', '..o.ffffffff.o..',
    '..oooooooooooo..', '................', '................', '................'],
  shop: [
    '................', '.bbbbbbbbbbbbbb.', '.bffbffbffbffbb.', '.bbbbbbbbbbbbbb.',
    '..i..........i..', '..i.kkkkkkkk.i..', '..i.kllllllk.i..', '..i.kllllllk.i..',
    '..i.kkkkkkkk.i..', '..i..........i..', '..iiiiiiiiiiii..', '..i..........i..',
    '..i..........i..', '..ii........ii..', '................', '................'],
  counter: [
    '................', '................', '..jjjjjjjjjjjj..', '..jffffffffffj..',
    '..jfhhffhhfffj..', '..jffffffffffj..', '..jjjjjjjjjjjj..', '..ii........ii..',
    '..ii........ii..', '..ii........ii..', '..ii........ii..', '................',
    '................', '................', '................', '................'],
  portal: [
    '................', '.....pppppp.....', '...pp......pp...', '..p..oooooo..p..',
    '..p.oo....oo.p..', '.p.o..eeee..o.p.', '.p.o.ee..ee.o.p.', '.p.o.ee..ee.o.p.',
    '.p.o..eeee..o.p.', '..p.oo....oo.p..', '..p..oooooo..p..', '...pp......pp...',
    '.....pppppp.....', '................', '................', '................'],
  bed: [
    '................', '..iiiiiiiiiiii..', '..iffffffffffi..', '..iffffffffffi..',
    '..ibbbbbbbbbbi..', '..ibbbbbbbbbbi..', '..ibbbbbbbbbbi..', '..iiiiiiiiiiii..',
    '..i..........i..', '..i..........i..', '................', '................',
    '................', '................', '................', '................'],
  node: [
    '................', '................', '................', '.......mm.......',
    '......mnnm......', '.....mnnnnm.....', '....jnnnnnnj....', '....jjnnnnjj....',
    '...jjjjjjjjjj...', '...jkkkkkkkkj...', '....jjjjjjjj....', '................',
    '................', '................', '................', '................'],
  sack: [
    '................', '................', '................', '................',
    '.......jj.......', '......jjjj......', '.....jkkkkj.....', '....jkkkkkkj....',
    '....jkkkkkkj....', '....jkkkkkkj....', '.....jkkkkj.....', '......jjjj......',
    '................', '................', '................', '................'],
  plate: [
    '................', '................', '................', '.....ffffff.....',
    '....ffhhhhff....', '...ffh9aa9hff...', '...ffhaaaahff...', '...ffh9aa9hff...',
    '....ffhhhhff....', '.....ffffff.....', '................', '................',
    '................', '................', '................', '................'],
};

export interface AtlasData { canvas: HTMLCanvasElement; index: Record<string, number> }

function px(ctx: CanvasRenderingContext2D, ox: number, oy: number, x: number, y: number, col: string) {
  ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1);
}

function tint(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

/** Каменный пол: кирпичная кладка со швами и зерном. */
function stoneFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number, rng: RNG, base: string, mortar: string, warm: number) {
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const row = Math.floor(y / 8);
    const seam = y % 8 === 0 || (x + row * 8) % 8 === 0;
    const f = seam ? 0.62 : 0.86 + rng.next() * 0.32;
    px(ctx, ox, oy, x, y, tint(seam ? mortar : base, f));
  }
  const marks = rng.int(4);
  for (let i = 0; i < marks; i++) px(ctx, ox, oy, rng.int(CELL), rng.int(CELL), tint(base, 0.55 + warm));
}

/** Стена: грубая порода с подсветкой сверху. */
function stoneWall(ctx: CanvasRenderingContext2D, ox: number, oy: number, rng: RNG, base: string) {
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const blob = Math.sin(x * 1.7 + y * 0.9) * 0.08;
    const f = 0.7 + rng.next() * 0.4 + blob + (y < 3 ? 0.28 : 0) - (y > 12 ? 0.18 : 0);
    px(ctx, ox, oy, x, y, tint(base, Math.max(0.35, f)));
  }
}

/** Лава: слои оранжевого с чёрной коркой. */
function lavaTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, rng: RNG, phase: number) {
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const v = Math.sin((x + phase * 3) * 0.8) * Math.cos((y - phase * 2) * 0.7);
    const hot = v > 0.35 || rng.next() > 0.9;
    const crust = v < -0.55;
    px(ctx, ox, oy, x, y, crust ? tint('#2b1a33', 0.9 + rng.next() * .2) : hot ? tint('#ffd447', 0.85 + rng.next() * .25) : tint('#ff4520', 0.75 + rng.next() * .4));
  }
}

export function buildAtlas(): AtlasData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ATLAS, ATLAS);
  const rng = new RNG(1337);
  const index: Record<string, number> = {};
  let slot = 0;
  const put = (name: string, draw: (ox: number, oy: number) => void) => {
    const ox = (slot % COLS) * CELL, oy = Math.floor(slot / COLS) * CELL;
    index[name] = slot++; draw(ox, oy);
  };

  for (let i = 0; i < 3; i++) put('floor' + i, (ox, oy) => stoneFloor(ctx, ox, oy, rng, '#3d2440', '#1a1024', 0.1));
  for (let i = 0; i < 3; i++) put('cave' + i, (ox, oy) => stoneFloor(ctx, ox, oy, rng, '#2b1a33', '#0b0710', 0.25));
  for (let i = 0; i < 2; i++) put('wall' + i, (ox, oy) => stoneWall(ctx, ox, oy, rng, '#56344b'));
  for (let i = 0; i < 2; i++) put('lava' + i, (ox, oy) => lavaTile(ctx, ox, oy, rng, i));

  for (const name of Object.keys(S)) {
    put(name, (ox, oy) => {
      const rows = S[name];
      for (let y = 0; y < rows.length; y++) {
        const r = rows[y];
        for (let x = 0; x < r.length; x++) {
          const c = r[x];
          if (c === '.') continue;
          px(ctx, ox, oy, x, y, PAL[c] || '#f0f');
        }
      }
    });
  }

  // Радиальное свечение для факелов/огня.
  put('glow', (ox, oy) => {
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy) / 8;
      const a = Math.max(0, 1 - d) ** 2;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
  put('spark', (ox, oy) => {
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(ctx, ox, oy, x, y, '#ffd447');
  });

  return { canvas, index };
}
