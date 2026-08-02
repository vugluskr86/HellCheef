// Типы игровых данных.

export type SkillId = 'grill' | 'boil' | 'bake' | 'alchemy' | 'butcher' | 'season' | 'plating';
export type StationId = 'grill' | 'pot' | 'oven' | 'board' | 'alchemy';
export type FactionId = 'warriors' | 'nobles' | 'merchants' | 'cultists' | 'angels' | 'guild';
export type Taste = { sweet: number; salt: number; sour: number; bitter: number; umami: number; spice: number };

export interface IngredientDef {
  id: string; name: string; icon: string;
  base: number;            // базовая цена
  rarity: number;          // 1.0 .. 2.5
  tags: string[];          // meat, veg, spice, grain, dairy, magic, cursed, blessed, liquid
  taste: Partial<Taste>;
  decay: number;           // потеря свежести за ход
  circle: number;          // минимальный круг, где встречается
  weight: number;
  mana?: number;
}

export interface RecipeStepDef { text: string; }

export interface RecipeDef {
  id: string; name: string; tier: number;      // 1..5 в прототипе (шкала ТЗ 1..10)
  station: StationId; skill: SkillId;
  time: number;                                // ходов активной готовки
  difficulty: number;                          // 1..100, порог навыка
  needs: { tag?: string; id?: string; qty: number }[];
  target: Partial<Taste>;                      // целевой вкусовой профиль
  idealHeat: number; heatBand: number;         // окно температуры
  flipEvery: number;                           // 0 = переворачивать не надо
  base: number;                                // базовая цена блюда
  tags: string[];                              // meaty, sweet, spicy, elegant, hearty, cursed
  heal?: number;
}

export interface CustomerDef {
  id: string; name: string; title: string; sprite: string;
  faction: FactionId;
  patience: number;      // 10..100 -> множитель дедлайна
  urgency: number;       // 0.75..1.5 -> чем больше, тем меньше времени
  pay: number;           // множитель оплаты
  likes: string[]; dislikes: string[];
  minQuality: number;    // требование к качеству
  caresPlating: number;  // 0..1 вклад подачи
  lines: string[];
  circle: number;
}

export interface EnemyDef {
  id: string; name: string; sprite: string;
  hp: number; dmg: number; speed: number;      // ходов между действиями (1 = каждый ход)
  ai: 'chaser' | 'thief' | 'ranged' | 'brute';
  xp: number; circle: number;
  drops?: string[];
}

export interface ToolDef {
  id: string; name: string; slot: 'weapon' | 'tool';
  dmg: [number, number]; speed: number;
  bonus?: Partial<Record<SkillId, number>>;
  effect?: 'stun' | 'burn' | 'blind' | 'bleed';
  price: number; weight: number;
}

export type Item =
  | { kind: 'ing'; def: IngredientDef; quality: number; freshness: number; qty: number; cursed?: boolean; blessed?: boolean }
  | { kind: 'dish'; recipe: RecipeDef; quality: number; qty: number; cursedMade?: boolean }
  | { kind: 'tool'; def: ToolDef; dur: number; qty: number };

export interface Status { id: 'burn' | 'poison' | 'stun' | 'blind' | 'bleed' | 'wellfed'; turns: number; power: number }

export interface Player {
  x: number; y: number;
  hp: number; maxHp: number; sp: number; maxSp: number;
  level: number; xp: number; money: number;
  stats: { str: number; agi: number; end: number; int: number; cha: number; luck: number };
  skills: Record<SkillId, number>;
  inv: Item[];
  weapon: Extract<Item, { kind: 'tool' }> | null;
  rep: Record<FactionId, number>;
  global: number;
  karma: number;
  status: Status[];
  dishesCooked: number; ordersDone: number; ordersFailed: number; kills: number;
}

export interface Order {
  id: number;
  cust: CustomerDef;
  recipe: RecipeDef;
  placedTurn: number; deadline: number;
  reward: number; minQuality: number;
  seat: number;
  state: 'active' | 'done' | 'failed';
}

export interface Station {
  id: StationId; x: number; y: number;
  dur: number;               // 0..100 износ
  busy: boolean;
  tier: number;              // апгрейд 1..3
}

export type TileId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
// 0 пол, 1 стена, 2 лава, 3 станция, 4 портал/лифт, 5 лавка, 6 стойка выдачи, 7 койка, 8 ресурс

export interface Node { x: number; y: number; ing: string; left: number }

export interface Level {
  kind: 'hub' | 'cave';
  name: string; circle: number;
  w: number; h: number;
  tiles: Uint8Array; variant: Uint8Array;
  stations: Station[];
  nodes: Node[];
  enemies: Enemy[];
  ground: { x: number; y: number; item: Item }[];
  exit: { x: number; y: number } | null;
  entry: { x: number; y: number };
  special: { x: number; y: number; kind: 'lift' | 'gate' | 'repair' }[];
}

export interface Enemy {
  def: EnemyDef; x: number; y: number; hp: number;
  cd: number; status: Status[]; carrying?: Item; fleeing?: boolean;
}

export interface MarketRow { price: number; demand: number; supply: number }

export interface Meta {
  recipes: string[];       // открытые рецепты (переносятся между забегами)
  skillFloor: Partial<Record<SkillId, number>>;
  souls: number;           // мета-валюта
  runs: number; bestDay: number; bestCircle: number;
  unlockedCircle: number;
}
