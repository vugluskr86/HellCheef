// Утилиты: детерминированный RNG, математика, время, хранилище.

export class RNG {
  private s: number;
  constructor(seed = Date.now()) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next(): number {
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
  int(n: number) { return Math.floor(this.next() * n); }
  irange(a: number, b: number) { return a + this.int(b - a + 1); }
  range(a: number, b: number) { return a + this.next() * (b - a); }
  pick<T>(a: readonly T[]): T { return a[this.int(a.length)]; }
  chance(p: number) { return this.next() < p; }
  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
}

export const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Ход = 1 игровая минута. Сутки = 1440 ходов. */
export const TURNS_PER_DAY = 1440;
export function clockOf(turn: number) {
  const t = turn % TURNS_PER_DAY;
  const h = Math.floor(t / 60), m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function dayOf(turn: number) { return Math.floor(turn / TURNS_PER_DAY) + 1; }
/** Демоны едят ночью: множитель спроса по времени суток. */
export function demandOfHour(turn: number) {
  const h = Math.floor((turn % TURNS_PER_DAY) / 60);
  if (h >= 20 || h < 4) return 1.25;
  if (h >= 16 || h < 8) return 1.0;
  return 0.8;
}
export function isNight(turn: number) {
  const h = Math.floor((turn % TURNS_PER_DAY) / 60);
  return h >= 19 || h < 6;
}

/** Хранилище: localStorage, если доступен, иначе память (для песочниц/iframe). */
const mem = new Map<string, string>();
let useLS = false;
try { const k = '__hc'; localStorage.setItem(k, '1'); localStorage.removeItem(k); useLS = true; } catch { useLS = false; }
export const Store = {
  get(k: string): string | null { try { return useLS ? localStorage.getItem(k) : (mem.get(k) ?? null); } catch { return mem.get(k) ?? null; } },
  set(k: string, v: string) { try { useLS ? localStorage.setItem(k, v) : mem.set(k, v); } catch { mem.set(k, v); } },
  del(k: string) { try { useLS ? localStorage.removeItem(k) : mem.delete(k); } catch { mem.delete(k); } },
  persistent: () => useLS,
};

/** CRC32 для валидации сохранений (как в ТЗ, только по-человечески). */
const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
  return t;
})();
export function crc32(s: string) {
  let c = 0xffffffff;
  for (let i = 0; i < s.length; i++) c = CRC_TAB[(c ^ s.charCodeAt(i)) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16);
}
