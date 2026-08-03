// Сенсорное управление игровым полем. Интерфейсные панели остаются обычными
// HTML-кнопками: браузер уже умеет надёжно обрабатывать их касанием.
export interface TouchControls {
  move(dx: number, dy: number): void;
  interact(): void;
}

export type MobileOrientation = 'portrait' | 'landscape';

export interface MobileOrientationConfig {
  // Раскладка при отключённом автоповороте.
  defaultOrientation: MobileOrientation;
  // true — раскладка следует за поворотом устройства.
  // false — используется defaultOrientation и запрашивается блокировка экрана.
  autoRotate: boolean;
}

// Мобильная конфигурация. Измени значения здесь, чтобы задать поведение сборки.
export const MOBILE_ORIENTATION_CONFIG: MobileOrientationConfig = {
  defaultOrientation: 'landscape',
  autoRotate: true,
};

const SWIPE_DISTANCE = 22;
const TAP_DISTANCE = 12;
const TAP_DURATION = 350;

export function initMobileOrientation(config = MOBILE_ORIENTATION_CONFIG) {
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const orientationQuery = window.matchMedia('(orientation: portrait)');
  const screenOrientation = screen.orientation;

  const apply = () => {
    if (!coarsePointer.matches) {
      delete document.documentElement.dataset.mobileOrientation;
      return;
    }
    const orientation = config.autoRotate
      ? (orientationQuery.matches ? 'portrait' : 'landscape')
      : config.defaultOrientation;
    document.documentElement.dataset.mobileOrientation = orientation;
  };

  const lockOrientation = () => {
    if (!coarsePointer.matches) return;
    if (config.autoRotate) {
      screenOrientation?.unlock();
      return;
    }
    // Блокировка поддерживается не всеми браузерами и часто требует fullscreen.
    // CSS-раскладка выше остаётся рабочим запасным вариантом.
    screenOrientation?.lock(config.defaultOrientation).catch(() => undefined);
  };

  apply();
  lockOrientation();
  coarsePointer.addEventListener('change', apply);
  orientationQuery.addEventListener('change', apply);
  screenOrientation?.addEventListener('change', apply);
}

export function initTouchControls(target: HTMLElement, controls: TouchControls) {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startTime = 0;
  let moved = false;

  const reset = () => { pointerId = null; moved = false; };

  target.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || pointerId !== null) return;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    startTime = e.timeStamp;
    moved = false;
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  target.addEventListener('pointermove', e => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;

    moved = true;
    if (Math.abs(dx) > Math.abs(dy)) controls.move(dx > 0 ? 1 : -1, 0);
    else controls.move(0, dy > 0 ? 1 : -1);
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  });

  target.addEventListener('pointerup', e => {
    if (e.pointerId !== pointerId) return;
    const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (!moved && distance < TAP_DISTANCE && e.timeStamp - startTime < TAP_DURATION) controls.interact();
    reset();
    e.preventDefault();
  });

  target.addEventListener('pointercancel', e => {
    if (e.pointerId === pointerId) reset();
  });
}
