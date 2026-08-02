// Отрисовка мира: камера, статическая карта света, анимация огня.
import { AtlasData, CELL } from './atlas';
import { Batch } from './gl';
import { isNight } from './core';
import { Game } from './game';
import { Level } from './types';

const CUSTOMER_TINT: Record<string, [number, number, number]> = {
  baron: [1.0, 0.75, 0.55], lady: [1.0, 0.6, 0.85], gremlin: [0.7, 1.0, 0.6],
  barzul: [0.85, 0.85, 1.0], zag: [1.0, 0.95, 0.6], cultist: [0.8, 0.6, 1.0],
};

const lightCache = new WeakMap<Level, Float32Array>();

function computeLight(l: Level): Float32Array {
  const map = new Float32Array(l.w * l.h);
  const ambient = l.kind === 'hub' ? 0.5 : 0.2;
  map.fill(ambient);
  const add = (cx: number, cy: number, r: number, power: number) => {
    for (let y = Math.max(0, cy - r); y <= Math.min(l.h - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(l.w - 1, cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        map[y * l.w + x] += power * (1 - d / r) ** 1.6;
      }
    }
  };
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
    if (l.tiles[y * l.w + x] === 2) add(x, y, 5, 0.75);
    if (l.tiles[y * l.w + x] === 4) add(x, y, 4, 0.45);
  }
  for (const s of l.stations) if (s.id === 'grill' || s.id === 'oven' || s.id === 'alchemy') add(s.x, s.y, 4, 0.5);
  for (let i = 0; i < map.length; i++) map[i] = Math.min(1.35, map[i]);
  lightCache.set(l, map);
  return map;
}

export class Renderer {
  batch: Batch;
  idx: Record<string, number>;
  scale = 3;
  constructor(public canvas: HTMLCanvasElement, atlas: AtlasData) {
    this.batch = new Batch(canvas, atlas.canvas);
    this.idx = atlas.index;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.scale = Math.max(2, Math.min(6, Math.floor(Math.min(w / (26 * CELL), h / (17 * CELL)))));
  }

  draw(g: Game, t: number) {
    this.resize();
    const b = this.batch, l = g.level, p = g.player;
    const vw = this.canvas.width / this.scale, vh = this.canvas.height / this.scale;
    let camX = (p.x + 0.5) * CELL - vw / 2, camY = (p.y + 0.5) * CELL - vh / 2;
    camX = Math.max(-8, Math.min(l.w * CELL - vw + 8, camX));
    camY = Math.max(-8, Math.min(l.h * CELL - vh + 8, camY));
    if (l.w * CELL < vw) camX = (l.w * CELL - vw) / 2;
    if (l.h * CELL < vh) camY = (l.h * CELL - vh) / 2;

    b.begin(camX, camY, vw, vh);
    const light = lightCache.get(l) ?? computeLight(l);
    const flicker = 0.94 + Math.sin(t / 190) * 0.04 + Math.sin(t / 71) * 0.02;
    const night = isNight(g.turn) ? 0.86 : 1;

    const x0 = Math.max(0, Math.floor(camX / CELL) - 1), x1 = Math.min(l.w - 1, Math.ceil((camX + vw) / CELL));
    const y0 = Math.max(0, Math.floor(camY / CELL) - 1), y1 = Math.min(l.h - 1, Math.ceil((camY + vh) / CELL));

    const lit = (x: number, y: number, extra = 0) => {
      const dp = Math.hypot(x - p.x, y - p.y);
      const torch = Math.max(0, 1 - dp / 7) * 0.75;
      return Math.min(1.5, (light[y * l.w + x] + torch + extra) * flicker * night);
    };

    // Пол и стены.
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tile = l.tiles[y * l.w + x], v = l.variant[y * l.w + x];
      const L = lit(x, y);
      if (L < 0.06) continue;
      let name: string;
      if (tile === 1) name = 'wall' + (v % 2);
      else if (tile === 2) name = 'lava' + ((v + Math.floor(t / 260)) % 2);
      else name = (l.kind === 'hub' ? 'floor' : 'cave') + (v % 3);
      const c = tile === 2 ? 1 : L;
      b.draw(this.idx[name], x * CELL, y * CELL, CELL, CELL, c, c * 0.97, c * 1.0, 1);
    }

    // Мебель и объекты.
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tile = l.tiles[y * l.w + x];
      const L = lit(x, y, 0.12);
      if (L < 0.08 || tile === 0 || tile === 1 || tile === 2) continue;
      let name = '';
      if (tile === 3) name = l.stations.find(s => s.x === x && s.y === y)?.id === 'pot' ? 'pot' : (l.stations.find(s => s.x === x && s.y === y)!.id);
      else if (tile === 4) name = 'portal';
      else if (tile === 5) name = 'shop';
      else if (tile === 6) name = 'counter';
      else if (tile === 7) name = 'bed';
      else if (tile === 8) name = 'node';
      if (name === 'board' || name === 'grill' || name === 'oven' || name === 'alchemy' || name === 'pot') { /* совпадает с именем спрайта */ }
      const s = this.idx[name];
      if (s === undefined) continue;
      b.draw(s, x * CELL, y * CELL, CELL, CELL, L, L, L, 1);
    }

    // Предметы на полу.
    for (const gr of l.ground) {
      const L = lit(gr.x, gr.y, 0.15);
      if (L < 0.08) continue;
      b.draw(this.idx.sack, gr.x * CELL, gr.y * CELL, CELL, CELL, L, L, L, 1);
    }

    // Клиенты у стойки (хаб).
    if (l.kind === 'hub') {
      const active = g.orders.filter(o => o.state === 'active');
      active.forEach((o, i) => {
        const x = 10 + i * 2, y = 16;
        const tintc = CUSTOMER_TINT[o.cust.id] ?? [1, 1, 1];
        const L = lit(x, y, 0.25);
        const bob = Math.sin(t / 300 + i) * 0.6;
        b.draw(this.idx.demon, x * CELL, y * CELL + bob, CELL, CELL, tintc[0] * L, tintc[1] * L, tintc[2] * L, 1);
      });
    }

    // Враги.
    for (const e of l.enemies) {
      const L = lit(e.x, e.y, 0.2);
      if (L < 0.06) continue;
      const s = this.idx[e.def.sprite] ?? this.idx.imp;
      b.draw(s, e.x * CELL, e.y * CELL, CELL, CELL, L, L, L, 1);
    }

    // Игрок.
    const bob = Math.sin(t / 240) * 0.5;
    b.draw(this.idx.chef, p.x * CELL, p.y * CELL + bob, CELL, CELL, 1, 1, 1, 1);

    // Свечение и искры — аддитивно.
    b.setBlend('add');
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tile = l.tiles[y * l.w + x];
      if (tile === 2) {
        const a = 0.28 + Math.sin(t / 300 + x * 0.6 + y * 0.4) * 0.1;
        b.draw(this.idx.glow, (x - 1.5) * CELL, (y - 1.5) * CELL, CELL * 4, CELL * 4, 1, 0.42, 0.12, a);
        if ((x + y + Math.floor(t / 400)) % 7 === 0) {
          const fy = y * CELL - ((t / 22) % 22);
          b.draw(this.idx.spark, x * CELL, fy, CELL, CELL, 1, 0.7, 0.2, 0.7);
        }
      } else if (tile === 4) {
        b.draw(this.idx.glow, (x - 1) * CELL, (y - 1) * CELL, CELL * 3, CELL * 3, 0.4, 0.9, 0.9, 0.3);
      }
    }
    for (const s of l.stations) {
      if (s.id !== 'grill' && s.id !== 'oven' && s.id !== 'alchemy') continue;
      const col: [number, number, number] = s.id === 'alchemy' ? [0.6, 0.4, 1] : [1, 0.5, 0.15];
      b.draw(this.idx.glow, (s.x - 1) * CELL, (s.y - 1) * CELL, CELL * 3, CELL * 3, col[0], col[1], col[2], 0.26 + Math.sin(t / 260) * 0.06);
    }
    b.draw(this.idx.glow, (p.x - 2.5) * CELL, (p.y - 2.5) * CELL, CELL * 6, CELL * 6, 1, 0.72, 0.4, 0.16);
    b.end();
  }
}
