// Контент: ингредиенты, рецепты, клиенты, враги, инструменты.
import { CustomerDef, EnemyDef, IngredientDef, RecipeDef, ToolDef } from './types';

export const ING: IngredientDef[] = [
  { id: 'cow_meat', name: 'Филе демонической коровы', icon: 'meat', base: 34, rarity: 1.0, tags: ['meat'], taste: { umami: .7, salt: .2 }, decay: .0016, circle: 1, weight: 1.2 },
  { id: 'imp_flesh', name: 'Мякоть беса', icon: 'meat', base: 22, rarity: 1.0, tags: ['meat'], taste: { umami: .5, bitter: .2 }, decay: .0022, circle: 1, weight: .8 },
  { id: 'hound_ribs', name: 'Рёбра адской гончей', icon: 'meat', base: 52, rarity: 1.4, tags: ['meat'], taste: { umami: .8, spice: .2 }, decay: .0018, circle: 2, weight: 1.6 },
  { id: 'ash_mushroom', name: 'Пепельный гриб', icon: 'veg', base: 12, rarity: 1.0, tags: ['veg'], taste: { umami: .5, bitter: .3 }, decay: .0030, circle: 1, weight: .2 },
  { id: 'cave_moss', name: 'Пещерный мох', icon: 'veg', base: 7, rarity: 1.0, tags: ['veg'], taste: { bitter: .5, sour: .2 }, decay: .0035, circle: 1, weight: .1 },
  { id: 'scream_onion', name: 'Кричащий лук', icon: 'veg', base: 11, rarity: 1.0, tags: ['veg'], taste: { sweet: .2, umami: .3, spice: .2 }, decay: .0018, circle: 1, weight: .2 },
  { id: 'magma_garlic', name: 'Магмовый чеснок', icon: 'veg', base: 16, rarity: 1.2, tags: ['veg', 'spice'], taste: { umami: .4, spice: .4 }, decay: .0014, circle: 2, weight: .1 },
  { id: 'sulfur_root', name: 'Серный корень', icon: 'veg', base: 14, rarity: 1.1, tags: ['veg'], taste: { bitter: .6, salt: .2 }, decay: .0016, circle: 2, weight: .3 },
  { id: 'hell_salt', name: 'Адская соль', icon: 'spice', base: 9, rarity: 1.0, tags: ['spice'], taste: { salt: 1 }, decay: 0, circle: 1, weight: .1 },
  { id: 'lava_pepper', name: 'Лавовый перец', icon: 'spice', base: 18, rarity: 1.2, tags: ['spice'], taste: { spice: 1, bitter: .1 }, decay: .0008, circle: 1, weight: .1 },
  { id: 'ghost_pepper', name: 'Перец призрака', icon: 'spice', base: 40, rarity: 1.8, tags: ['spice', 'magic'], taste: { spice: 1, sour: .3 }, decay: .0008, circle: 3, weight: .1, mana: 4 },
  { id: 'crystal_thyme', name: 'Кристальный тимьян', icon: 'spice', base: 26, rarity: 1.5, tags: ['spice'], taste: { bitter: .3, sweet: .2, umami: .3 }, decay: .0010, circle: 2, weight: .1 },
  { id: 'brim_sugar', name: 'Серный сахар', icon: 'spice', base: 13, rarity: 1.1, tags: ['spice'], taste: { sweet: 1 }, decay: 0, circle: 1, weight: .2 },
  { id: 'obsidian_flour', name: 'Обсидиановая мука', icon: 'grain', base: 10, rarity: 1.0, tags: ['grain'], taste: { sweet: .1 }, decay: .0004, circle: 1, weight: .5 },
  { id: 'demon_egg', name: 'Яйцо демона', icon: 'egg', base: 20, rarity: 1.2, tags: ['dairy'], taste: { umami: .4, salt: .1 }, decay: .0026, circle: 1, weight: .2 },
  { id: 'cursed_milk', name: 'Проклятое молоко', icon: 'liquid', base: 24, rarity: 1.3, tags: ['dairy', 'cursed'], taste: { sweet: .4, sour: .3 }, decay: .0040, circle: 2, weight: .6 },
  { id: 'blood_wine', name: 'Кровавое вино', icon: 'liquid', base: 44, rarity: 1.6, tags: ['liquid'], taste: { sour: .5, sweet: .3, umami: .2 }, decay: .0004, circle: 2, weight: .8 },
  { id: 'bone_marrow', name: 'Костный мозг', icon: 'meat', base: 30, rarity: 1.3, tags: ['meat'], taste: { umami: .9, salt: .3 }, decay: .0020, circle: 2, weight: .4 },
  { id: 'soul_essence', name: 'Эссенция души', icon: 'magic', base: 90, rarity: 2.2, tags: ['magic', 'cursed'], taste: { sweet: .5, bitter: .5, umami: .5 }, decay: .0002, circle: 3, weight: .1, mana: 12 },
  { id: 'angel_feather', name: 'Перо ангела', icon: 'magic', base: 120, rarity: 2.5, tags: ['magic', 'blessed'], taste: { sweet: .6, sour: .2 }, decay: .0002, circle: 3, weight: .1, mana: 15 },
];
export const ingById = (id: string) => ING.find(i => i.id === id)!;

export const RECIPES: RecipeDef[] = [
  // Станция: доска — быстрые заготовки и холодные блюда
  { id: 'r_tartare', name: 'Тартар из беса', tier: 1, station: 'board', skill: 'butcher', time: 6, difficulty: 10, needs: [{ tag: 'meat', qty: 1 }, { id: 'hell_salt', qty: 1 }], target: { umami: .6, salt: .5 }, idealHeat: 0, heatBand: 100, flipEvery: 0, base: 44, tags: ['meaty'], heal: 10 },
  { id: 'r_mosssalad', name: 'Салат из мха', tier: 1, station: 'board', skill: 'plating', time: 5, difficulty: 8, needs: [{ id: 'cave_moss', qty: 2 }, { tag: 'veg', qty: 1 }], target: { bitter: .5, sour: .3 }, idealHeat: 0, heatBand: 100, flipEvery: 0, base: 28, tags: ['light'], heal: 6 },
  { id: 'r_carpaccio', name: 'Карпаччо с тимьяном', tier: 3, station: 'board', skill: 'plating', time: 9, difficulty: 45, needs: [{ id: 'cow_meat', qty: 1 }, { id: 'crystal_thyme', qty: 1 }, { id: 'blood_wine', qty: 1 }], target: { umami: .6, sour: .4, salt: .3 }, idealHeat: 0, heatBand: 100, flipEvery: 0, base: 140, tags: ['elegant', 'meaty'], heal: 14 },
  // Гриль
  { id: 'r_grillmeat', name: 'Жареное мясо бесов', tier: 2, station: 'grill', skill: 'grill', time: 8, difficulty: 22, needs: [{ tag: 'meat', qty: 1 }, { id: 'hell_salt', qty: 1 }], target: { umami: .7, salt: .5 }, idealHeat: 520, heatBand: 130, flipEvery: 3, base: 62, tags: ['meaty', 'hearty'], heal: 22 },
  { id: 'r_ribs', name: 'Рёбра в лавовой глазури', tier: 3, station: 'grill', skill: 'grill', time: 12, difficulty: 45, needs: [{ id: 'hound_ribs', qty: 1 }, { id: 'lava_pepper', qty: 1 }, { id: 'brim_sugar', qty: 1 }], target: { umami: .8, spice: .6, sweet: .4 }, idealHeat: 640, heatBand: 110, flipEvery: 3, base: 155, tags: ['meaty', 'spicy', 'hearty'], heal: 34 },
  { id: 'r_skewer', name: 'Шашлык обжоры', tier: 4, station: 'grill', skill: 'grill', time: 15, difficulty: 62, needs: [{ tag: 'meat', qty: 2 }, { id: 'magma_garlic', qty: 1 }, { id: 'lava_pepper', qty: 1 }], target: { umami: .9, spice: .5, salt: .4 }, idealHeat: 700, heatBand: 90, flipEvery: 2, base: 240, tags: ['meaty', 'hearty', 'spicy'], heal: 45 },
  // Котёл
  { id: 'r_soup', name: 'Похлёбка грешника', tier: 1, station: 'pot', skill: 'boil', time: 9, difficulty: 12, needs: [{ tag: 'veg', qty: 2 }, { id: 'hell_salt', qty: 1 }], target: { salt: .5, umami: .4 }, idealHeat: 100, heatBand: 40, flipEvery: 0, base: 38, tags: ['hearty'], heal: 18 },
  { id: 'r_marrow', name: 'Бульон на костном мозге', tier: 3, station: 'pot', skill: 'boil', time: 14, difficulty: 42, needs: [{ id: 'bone_marrow', qty: 1 }, { id: 'scream_onion', qty: 1 }, { id: 'crystal_thyme', qty: 1 }], target: { umami: .9, salt: .4 }, idealHeat: 120, heatBand: 30, flipEvery: 0, base: 150, tags: ['hearty', 'elegant'], heal: 40 },
  { id: 'r_stew', name: 'Рагу девятого круга', tier: 4, station: 'pot', skill: 'boil', time: 18, difficulty: 60, needs: [{ tag: 'meat', qty: 1 }, { tag: 'veg', qty: 2 }, { id: 'blood_wine', qty: 1 }], target: { umami: .8, sour: .4, salt: .4 }, idealHeat: 140, heatBand: 25, flipEvery: 0, base: 265, tags: ['hearty', 'meaty'], heal: 55 },
  // Печь
  { id: 'r_bread', name: 'Пепельный хлеб', tier: 1, station: 'oven', skill: 'bake', time: 10, difficulty: 15, needs: [{ id: 'obsidian_flour', qty: 1 }, { id: 'hell_salt', qty: 1 }], target: { salt: .3, sweet: .2 }, idealHeat: 230, heatBand: 45, flipEvery: 0, base: 32, tags: ['light'], heal: 14 },
  { id: 'r_pie', name: 'Пирог с бесятиной', tier: 3, station: 'oven', skill: 'bake', time: 16, difficulty: 40, needs: [{ id: 'obsidian_flour', qty: 1 }, { tag: 'meat', qty: 1 }, { id: 'scream_onion', qty: 1 }], target: { umami: .7, salt: .4, sweet: .2 }, idealHeat: 210, heatBand: 35, flipEvery: 0, base: 145, tags: ['hearty', 'meaty'], heal: 36 },
  { id: 'r_cake', name: 'Торт «Искушение»', tier: 4, station: 'oven', skill: 'bake', time: 20, difficulty: 66, needs: [{ id: 'obsidian_flour', qty: 1 }, { id: 'brim_sugar', qty: 2 }, { id: 'demon_egg', qty: 1 }, { id: 'cursed_milk', qty: 1 }], target: { sweet: .9, sour: .2 }, idealHeat: 190, heatBand: 25, flipEvery: 0, base: 300, tags: ['sweet', 'elegant'], heal: 30 },
  // Алхимия
  { id: 'r_souffle', name: 'Суфле из эссенции души', tier: 5, station: 'alchemy', skill: 'alchemy', time: 22, difficulty: 78, needs: [{ id: 'soul_essence', qty: 1 }, { id: 'demon_egg', qty: 2 }, { id: 'brim_sugar', qty: 1 }], target: { sweet: .7, umami: .4, bitter: .3 }, idealHeat: 0, heatBand: 0, flipEvery: 0, base: 460, tags: ['elegant', 'sweet', 'cursed'], heal: 60 },
  { id: 'r_ambrosia', name: 'Амброзия падшего', tier: 5, station: 'alchemy', skill: 'alchemy', time: 24, difficulty: 85, needs: [{ id: 'angel_feather', qty: 1 }, { id: 'blood_wine', qty: 1 }, { id: 'crystal_thyme', qty: 1 }], target: { sweet: .6, sour: .4, umami: .4 }, idealHeat: 0, heatBand: 0, flipEvery: 0, base: 520, tags: ['elegant', 'blessed'], heal: 80 },
];
export const recipeById = (id: string) => RECIPES.find(r => r.id === id)!;
/** Стартовая книга рецептов нового забега. */
export const STARTER_RECIPES = ['r_tartare', 'r_mosssalad', 'r_grillmeat', 'r_soup', 'r_bread'];

export const CUSTOMERS: CustomerDef[] = [
  {
    id: 'baron', name: 'Барон Обжорович', title: 'Демон чревоугодия', sprite: 'baron', faction: 'nobles',
    patience: 35, urgency: 1.3, pay: 1.5, likes: ['meaty', 'hearty'], dislikes: ['light'], minQuality: 35, caresPlating: .1, circle: 1,
    lines: ['Я ГОЛОДЕН! Неси мяса, и побольше!', 'Ещё! Порции у тебя как для воробья.', 'Если это овощ — я съем тебя.'],
  },
  {
    id: 'lady', name: 'Леди Изящество', title: 'Суккуб', sprite: 'succubus', faction: 'nobles',
    patience: 65, urgency: .95, pay: 1.7, likes: ['sweet', 'elegant'], dislikes: ['hearty'], minQuality: 60, caresPlating: .55, circle: 1,
    lines: ['Удиви меня, повар. Глазами я ем первой.', 'Десерт. И чтобы он был красив.', 'Небрежность я чувствую по запаху.'],
  },
  {
    id: 'gremlin', name: 'Гремлин Хаос', title: 'Демон разрушения', sprite: 'gremlin', faction: 'cultists',
    patience: 22, urgency: 1.45, pay: 1.2, likes: ['spicy'], dislikes: ['light', 'elegant'], minQuality: 25, caresPlating: 0, circle: 1,
    lines: ['ОСТРОЕ! ЖГУЧЕЕ! БЫСТРО!', 'Если не взорвётся во рту — сломаю тебе плиту.', 'Хи-хи-хи. Время пошло!'],
  },
  {
    id: 'barzul', name: 'Барзул Клинок', title: 'Демон-воин', sprite: 'warrior', faction: 'warriors',
    patience: 50, urgency: 1.1, pay: 1.3, likes: ['hearty', 'meaty'], dislikes: ['sweet'], minQuality: 45, caresPlating: .05, circle: 2,
    lines: ['Мне нужна еда, что держится в брюхе до утра.', 'Соли не жалей, повар.', 'Сладкое — для трусов.'],
  },
  {
    id: 'zag', name: 'Заг Тройной Процент', title: 'Торговец', sprite: 'merchant', faction: 'merchants',
    patience: 70, urgency: .85, pay: 1.1, likes: ['elegant'], dislikes: [], minQuality: 55, caresPlating: .3, circle: 2,
    lines: ['Качество, повар. Я плачу за качество.', 'Ужин деловой. Не подведи.', 'Хорошая репутация дороже монет. Но монеты тоже неплохи.'],
  },
  {
    id: 'cultist', name: 'Сестра Мора', title: 'Культистка', sprite: 'cultist', faction: 'cultists',
    patience: 45, urgency: 1.05, pay: 1.35, likes: ['cursed', 'spicy'], dislikes: ['blessed'], minQuality: 50, caresPlating: .2, circle: 3,
    lines: ['Готовь на проклятом. Пусть блюдо кричит.', 'Чистая еда — пресная еда.', 'Мы платим щедро. Душами и монетой.'],
  },
];

export const ENEMIES: EnemyDef[] = [
  { id: 'imp', name: 'Бес-воришка', sprite: 'imp', hp: 14, dmg: 3, speed: 1, ai: 'thief', xp: 12, circle: 1, drops: ['imp_flesh'] },
  { id: 'hound', name: 'Лавовая гончая', sprite: 'hound', hp: 26, dmg: 7, speed: 1, ai: 'chaser', xp: 22, circle: 1, drops: ['hound_ribs'] },
  { id: 'wisp', name: 'Блуждающая душа', sprite: 'wisp', hp: 18, dmg: 6, speed: 2, ai: 'ranged', xp: 26, circle: 2, drops: ['soul_essence'] },
  { id: 'golem', name: 'Жировой голем', sprite: 'golem', hp: 60, dmg: 12, speed: 2, ai: 'brute', xp: 48, circle: 3, drops: ['bone_marrow', 'cow_meat'] },
];

export const TOOLS: ToolDef[] = [
  { id: 't_knife', name: 'Острый нож повара', slot: 'weapon', dmg: [5, 9], speed: 1, bonus: { butcher: 8, plating: 4 }, price: 120, weight: .5 },
  { id: 't_cleaver', name: 'Тесак мясника', slot: 'weapon', dmg: [9, 16], speed: 1, bonus: { butcher: 14 }, effect: 'bleed', price: 260, weight: 1.8 },
  { id: 't_pan', name: 'Чугунная сковорода', slot: 'weapon', dmg: [7, 12], speed: 1, bonus: { grill: 10 }, effect: 'stun', price: 220, weight: 2.4 },
  { id: 't_ladle', name: 'Раскалённый половник', slot: 'weapon', dmg: [4, 8], speed: 1, bonus: { boil: 12 }, effect: 'burn', price: 200, weight: .9 },
  { id: 't_pepper', name: 'Перечница-распылитель', slot: 'weapon', dmg: [2, 4], speed: 1, bonus: { season: 12 }, effect: 'blind', price: 180, weight: .3 },
  { id: 't_torch', name: 'Горелка алхимика', slot: 'weapon', dmg: [6, 11], speed: 1, bonus: { alchemy: 12, bake: 6 }, effect: 'burn', price: 300, weight: 1.1 },
];
export const toolById = (id: string) => TOOLS.find(t => t.id === id)!;

export const SKILL_NAMES: Record<string, string> = {
  grill: 'Гриль', boil: 'Варка', bake: 'Выпечка', alchemy: 'Алхимия', butcher: 'Мясничество', season: 'Специи', plating: 'Подача',
};
export const STATION_NAMES: Record<string, string> = {
  grill: 'Гриль', pot: 'Котёл', oven: 'Печь', board: 'Разделочная доска', alchemy: 'Алхимический стол',
};
export const FACTION_NAMES: Record<string, string> = {
  warriors: 'Демоны-воины', nobles: 'Знать', merchants: 'Торговцы', cultists: 'Культисты', angels: 'Ангелы', guild: 'Гильдия поваров',
};
