// Solara Bay boot and loop: fixed 1/60 s steps, screens title / play / paused /
// game over / story complete, save & load via localStorage, WebAudio sound.
// ?seed=N fixes the world. ?shot=start|play|chase|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_COIN, EVENT_HIT, EVENT_MISSION, EVENT_OVER, EVENT_SHOOT, EVENT_VICTORY, EVENT_WANTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE, createInput } from './input.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage off */ }
}
function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money, health: state.player.health, missionIndex: state.missionIndex,
      stageIndex: state.stageIndex, x: state.player.x, y: state.player.y, clock: state.clock,
      earned: state.stats.earned, missionsDone: state.stats.missionsDone, stolen: state.stats.stolen,
      savedAt: Date.now(),
    }));
    return true;
  } catch { return false; }
}
function applySave(state, save) {
  state.money = save.money; state.player.health = save.health; state.health = save.health;
  state.missionIndex = save.missionIndex; state.stageIndex = save.stageIndex;
  state.player.x = save.x; state.player.y = save.y; state.clock = save.clock ?? 10;
  state.stats.earned = save.earned || 0; state.stats.missionsDone = save.missionsDone || 0; state.stats.stolen = save.stolen || 0;
  state.player.car = null; state.wanted = 0;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { saveExists: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let savedFlash = 0;

  function announce(message) { status.textContent = message; }
  function startGame(fromSave) {
    world.reset();
    if (fromSave && save) applySave(world.state, save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.start();
    announce('Playing Solara Bay. Steal a car and reach Rico\'s Garage.');
  }
  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.money > best) { best = world.state.money; saveBest(best); }
    announce(`Game over. You earned $${world.state.money}.`);
  }
  function completeGame() {
    screen = SCREEN_COMPLETE;
    if (world.state.money > best) { best = world.state.money; saveBest(best); }
    announce('Story complete. Solara Bay is yours.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) { const m = audio.toggleMute(); announce(m ? 'Muted.' : 'Sound on.'); }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) { audio.start(); audio.click(); startGame(false); }
      else if (actions & ACTION_SAVE && save) startGame(true);
    } else if (screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) { audio.click(); startGame(false); }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PAUSED; announce('Paused.'); }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PLAY; announce('Playing.'); }
      else if (actions & ACTION_SAVE) {
        savedFlash = 2;
        announce(writeSave(world.state) ? 'Progress saved.' : 'Could not save.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      const inp = { mx: 0, my: 0, accel: false, brake: false, steer: 0, aimX: 0, aimY: 0, firing: false, punch: false, interact: false };
      world.step(STEP, inp, true);
      return;
    }
    const mv = input.move();
    const dr = input.drive();
    const mouse = input.mouse();
    const rect = canvas.getBoundingClientRect();
    // Mouse position in world coords: canvas is scaled to a 1280x720 viewport.
    const scaleX = 1280 / rect.width, scaleY = 720 / rect.height;
    const aimScreenX = (mouse.x - rect.left) * scaleX;
    const aimScreenY = (mouse.y - rect.top) * scaleY;
    const cam = world.state.camera;
    const inp = {
      mx: mv.x, my: mv.y, accel: dr.accel, brake: dr.brake, steer: dr.steer,
      aimX: cam.x + aimScreenX, aimY: cam.y + aimScreenY,
      firing: mouse.down, punch: input.takePunch(), interact: input.takeInteract(),
    };
    const events = world.step(STEP, inp, false);
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_COIN) audio.pickup();
    if (events & EVENT_HIT) audio.crash();
    if (events & EVENT_MISSION) { audio.mission(); save = readSave(); writeSave(world.state); }
    if (events & EVENT_WANTED) announce(`Wanted level ${world.state.wanted}.`);
    if (events & EVENT_VICTORY) completeGame();
    else if (events & EVENT_OVER) endGame();
    audio.setEngine(world.state.speed, Boolean(world.state.player.car));
    audio.setSiren(world.state.wanted > 0);
    if (savedFlash > 0) savedFlash -= STEP;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else accumulator = 0;
    renderer.draw(world.state, screen, best, { saveExists: Boolean(save), savedFlash });
  }

  // Read-only probe for automated play-testing (no cheats: it only reports state).
  window.__solara = {
    state: () => ({
      inCar: Boolean(world.state.player.car), money: world.state.money,
      mission: world.state.missionIndex, stage: world.state.stageIndex,
      wanted: world.state.wanted, x: Math.round(world.state.player.x),
      y: Math.round(world.state.player.y), health: Math.round(world.state.player.health),
      screen,
    }),
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Solara Bay. Press Enter or click to start. L loads a save.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
