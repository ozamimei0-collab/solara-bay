// Keyboard + mouse. WASD/arrows move or drive, mouse aims, click shoots,
// E enters/exits a car, F punches, P/Esc pauses, M mutes, Space confirms.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_SAVE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;
  let interact = false, punch = false;

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'KeyE') { if (!event.repeat) interact = true; }
    else if (event.code === 'KeyF') { if (!event.repeat) punch = true; }
    else if (event.code === 'KeyL') { if (!event.repeat) actions |= ACTION_SAVE; }
    else if (!UP.has(event.code) && !DOWN.has(event.code) && !LEFT.has(event.code) && !RIGHT.has(event.code)) return;
    keys.add(event.code);
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => { mouseX = event.clientX; mouseY = event.clientY; });
  canvas.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX; mouseY = event.clientY; mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const has = (set) => [...set].some((c) => keys.has(c));
  return {
    move() {
      return { x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0), y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0) };
    },
    drive() {
      return {
        accel: has(UP), brake: has(DOWN),
        steer: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
      };
    },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeInteract() { const v = interact; interact = false; return v; },
    takePunch() { const v = punch; punch = false; return v; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
