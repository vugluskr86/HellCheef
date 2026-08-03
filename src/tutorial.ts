// Отключаемые контекстные подсказки. Они не блокируют игру: игрок сам решает,
// когда прочесть шаг, а нужный объект подсвечивается в UI или прямо в мире.
import type { Game, Mode } from './game.ts';

export interface TutorialWorldTarget {
  x: number;
  y: number;
  label: string;
}

export interface TutorialStepDef {
  id: string;
  title: string;
  description: string;
  selector?: string;
  mode?: Mode | 'any';
  when: (game: Game) => boolean;
}

export interface TutorialConfig {
  enabledByDefault: boolean;
  steps: TutorialStepDef[];
}

export interface TutorialState {
  enabled: boolean;
  currentIndex: number;
  steps: TutorialStepDef[];
}

const hasDish = (g: Game) => g.player.inv.some(item => item.kind === 'dish');

export const TUTORIAL_CONFIG: TutorialConfig = {
  enabledByDefault: true,
  steps: [
    {
      id: 'intro',
      title: 'Подсказки Hell Chef',
      description: 'Это необязательные подсказки по основным механикам. Их можно отключить в любой момент. Нажми «Дальше», чтобы начать знакомство.',
      selector: '[data-tutorial="new-game"]',
      mode: 'start',
      when: g => g.mode === 'start',
    },
    {
      id: 'class',
      title: 'Выбор повара',
      description: 'Выбери класс. Мясник начинает с разделкой и грилем, кондитер — с печью, а алхимик — с котлом и алхимией.',
      selector: '[data-tutorial="new-game"]',
      mode: 'start',
      when: g => g.mode === 'start',
    },
    {
      id: 'order',
      title: 'Получение заказа',
      description: 'Новый заказ появляется на рейке справа. В карточке указаны блюдо, срок, награда и минимальное качество.',
      selector: '[data-tutorial="order-card"]',
      mode: 'world',
      when: g => g.mode === 'world',
    },
    {
      id: 'station',
      title: 'Рабочая станция',
      description: 'Подойди к подсвеченной станции для блюда из текущего заказа и взаимодействуй с ней. Любая станция открывается действием рядом с ней.',
      mode: 'world',
      when: g => g.mode === 'world' && g.level.kind === 'hub' && g.orders.some(order => order.state === 'active'),
    },
    {
      id: 'recipe',
      title: 'Выбор рецепта',
      description: 'Выбери рецепт, для которого хватает ингредиентов. В карточке видны требуемые продукты, навык и цена блюда.',
      selector: '[data-act="cook_start"]',
      mode: 'cook',
      when: g => g.mode === 'cook' && !g.cook,
    },
    {
      id: 'cook',
      title: 'Готовка на разных станциях',
      description: 'Гриль, котёл и печь требуют температуры; гриль ещё и переворачивают. На доске набивают шкалу слайсами, а на алхимическом столе чередуют помешивание и выдержку.',
      selector: '[data-tutorial="cook-panel"]',
      mode: 'cook',
      when: g => g.mode === 'cook' && !!g.cook,
    },
    {
      id: 'serve_counter',
      title: 'Подача заказа',
      description: 'Готовое блюдо лежит в инвентаре. Отнеси его к подсвеченной стойке выдачи и взаимодействуй с ней.',
      mode: 'world',
      when: g => g.mode === 'world' && g.level.kind === 'hub' && hasDish(g),
    },
    {
      id: 'serve',
      title: 'Выдача',
      description: 'Сначала выбери заказ, затем подходящее готовое блюдо. Подача закрывает заказ и приносит награду.',
      selector: '[data-tutorial="serve-panel"]',
      mode: 'serve',
      when: g => g.mode === 'serve',
    },
    {
      id: 'shop_place',
      title: 'Лавка Зага',
      description: 'Подсвеченная лавка продаёт ингредиенты и инструменты. Подойди к ней и взаимодействуй.',
      mode: 'world',
      when: g => g.mode === 'world' && g.level.kind === 'hub',
    },
    {
      id: 'shop',
      title: 'Покупка ингредиентов',
      description: 'В лавке покупай продукты для рецептов. Цены меняются от спроса: выгодно покупать в затишье и продавать в наплыв.',
      selector: '[data-tutorial="shop-buy"]',
      mode: 'shop',
      when: g => g.mode === 'shop',
    },
    {
      id: 'cave',
      title: 'Подземелья',
      description: 'Лифт ведёт в кладовые. Там ищут редкие ингредиенты, но за них придётся сражаться.',
      mode: 'world',
      when: g => g.mode === 'world' && g.level.kind === 'hub',
    },
    {
      id: 'gather',
      title: 'Добыча ресурсов',
      description: 'Наступи на подсвеченный ресурсный узел и нажми действие. Добыча расходует ход, но пополняет ингредиенты.',
      mode: 'world',
      when: g => g.mode === 'world' && g.level.kind === 'cave' && g.level.nodes.some(node => node.left > 0),
    },
    {
      id: 'battle',
      title: 'Боевая система',
      description: 'Сделай шаг в сторону подсвеченного врага, чтобы атаковать. Оружие тратит прочность, а враги отвечают в свой ход.',
      mode: 'world',
      when: g => g.mode === 'world' && g.level.kind === 'cave' && g.level.enemies.length > 0,
    },
    {
      id: 'done',
      title: 'Основы освоены',
      description: 'Ты видел заказы, станции, готовку, подачу, лавку, подземелья, добычу и бой. Подсказки можно включать и выключать на стартовом экране.',
      mode: 'any',
      when: g => g.mode === 'world',
    },
  ],
};

export function createTutorialState(config: TutorialConfig = TUTORIAL_CONFIG): TutorialState {
  return { enabled: config.enabledByDefault, currentIndex: 0, steps: [...config.steps] };
}

export function currentTutorialStep(state: TutorialState, game: Game): TutorialStepDef | null {
  if (!state.enabled || !state.steps.length) return null;
  const safeIndex = Math.max(0, Math.min(state.currentIndex, state.steps.length - 1));
  const current = state.steps[safeIndex];
  if (current?.when(game)) return current;
  return state.steps.slice(safeIndex + 1).find(step => step.when(game)) ?? null;
}

export function advanceTutorial(state: TutorialState, game: Game): TutorialStepDef | null {
  const current = currentTutorialStep(state, game);
  if (!current) return null;
  const index = state.steps.findIndex(step => step.id === current.id);
  state.currentIndex = Math.min(index + 1, state.steps.length - 1);
  return state.steps[state.currentIndex] ?? null;
}

export function setTutorialEnabled(state: TutorialState, enabled: boolean) {
  state.enabled = enabled;
  if (!enabled) state.currentIndex = 0;
}

export function tutorialWorldTarget(game: Game): TutorialWorldTarget | null {
  const step = currentTutorialStep(game.tutorial, game);
  if (!step || game.mode !== 'world') return null;

  if (step.id === 'station') {
    const order = game.orders.find(item => item.state === 'active');
    const stationId = order?.recipe.station;
    const station = game.level.stations.find(item => item.id === stationId) ?? game.level.stations[0];
    return station ? { x: station.x, y: station.y, label: 'СТАНЦИЯ' } : null;
  }
  if (step.id === 'serve_counter') return { x: 13, y: 15, label: 'ВЫДАЧА' };
  if (step.id === 'shop_place') return { x: 3, y: 15, label: 'ЛАВКА' };
  if (step.id === 'cave') return { x: 24, y: 3, label: 'ЛИФТ' };
  if (step.id === 'gather') {
    const node = game.level.nodes.find(item => item.left > 0);
    return node ? { x: node.x, y: node.y, label: 'ДОБЫЧА' } : null;
  }
  if (step.id === 'battle') {
    const enemy = [...game.level.enemies].sort((a, b) =>
      Math.abs(a.x - game.player.x) + Math.abs(a.y - game.player.y) - Math.abs(b.x - game.player.x) - Math.abs(b.y - game.player.y),
    )[0];
    return enemy ? { x: enemy.x, y: enemy.y, label: 'ВРАГ' } : null;
  }
  return null;
}

export function getTutorialStepMarkup(step: TutorialStepDef | null) {
  if (!step) return '';
  return '<div class="tutorial-card" data-tutorial="tutorial-card">'
    + '<div class="tutorial-title">' + step.title + '</div>'
    + '<div class="tutorial-body">' + step.description + '</div>'
    + '<div class="tutorial-actions">'
    + '<button type="button" class="btn mini" data-act="tutorial_toggle">Отключить подсказки</button>'
    + '<button type="button" class="btn primary mini" data-act="tutorial_next">Дальше</button>'
    + '</div></div>';
}
