// Screenshot scenes behind ?shot=start|play|chase|end (with &seed=N).
// Each plays the real simulation forward from a fresh world, steered by an
// autopilot that drives along the roads (Manhattan routing between road
// intersections) toward the current mission marker, so the frame is what a
// real game looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// Waypoints along roads: first along the current horizontal road to the
// target's vertical road, then along that road to the target intersection.
function routeWaypoints(fromX, fromY, tx, ty) {
  return [{ x: tx, y: fromY }, { x: tx, y: ty }];
}

function driveTo(state, tx, ty) {
  const car = state.player.car;
  const dx = tx - car.x, dy = ty - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const dist = Math.hypot(dx, dy);
  if (dist < 55) return { mx: 0, my: 0, accel: false, brake: true, steer: 0, aimX: tx, aimY: ty, firing: false, punch: false, interact: false };
  // Obstacle probe: if a building is right ahead, swing around it.
  const probeX = car.x + Math.cos(car.angle) * 95, probeY = car.y + Math.sin(car.angle) * 95;
  const blocked = state.buildings.some((b) => probeX > b.x - 20 && probeX < b.x + b.w + 20 && probeY > b.y - 20 && probeY < b.y + b.h + 20);
  const steer = blocked ? (diff >= 0 ? 1 : -1) : Math.max(-1, Math.min(1, diff * 1.8));
  // Speed target: slow for turns and for the final approach, fast on straights.
  const desired = blocked ? 120 : (dist < 200 || Math.abs(diff) > 0.6 ? 150 : 430);
  const tooFast = Math.abs(car.speed) > desired;
  return {
    mx: 0, my: 0,
    accel: !tooFast && Math.abs(diff) < 1.2, brake: tooFast || (Math.abs(diff) >= 1.2 && Math.abs(car.speed) > 120),
    steer,
    aimX: tx, aimY: ty, firing: false, punch: false, interact: false,
  };
}
function onFootTo(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  return { mx: dx / d, my: dy / d, accel: false, brake: false, steer: 0, aimX: tx, aimY: ty, firing: false, punch: false, interact: false };
}

export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  const idle = { mx: 0, my: 0, accel: false, brake: false, steer: 0, aimX: 0, aimY: 0, firing: false, punch: false, interact: false };
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    state.clockBase = 17.5;
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, idle, true);
    return { screen: SCREEN_TITLE, best: 0, saveExists: false };
  }
  if (name === 'end') {
    // Victory: all five missions done, dusk at the Marina yacht, fireworks.
    state.clockBase = 19.5;
    state.missionIndex = 5; state.victory = true;
    state.money = 8420; state.stats.earned = 8300; state.stats.stolen = 7; state.stats.missionsDone = 5;
    const car = state.cars.find((c) => !c.traffic && !c.police);
    if (car) { car.x = 2760; car.y = 1720; car.angle = Math.PI / 2; state.player.car = car; }
    state.player.x = 2760; state.player.y = 1720;
    state.wanted = 0;
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, idle, true);
    for (let k = 0; k < 5; k += 1) {
      const x = 2200 + k * 190, y = 1480 + (k % 2) * 40;
      for (let j = 0; j < 14; j += 1) {
        const a = (j / 14) * Math.PI * 2;
        state.particles.push({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.9, maxLife: 0.9, color: ['#f2c94c', '#4fc3f7', '#e5534b'][k % 3], size: 4 });
      }
    }
    state.banner = { text: 'STORY COMPLETE', sub: 'The Big Score is yours — $8,420 in the bag.', timer: 99 };
    return { screen: SCREEN_COMPLETE, best: 8420, saveExists: false };
  }
  // play / chase: put the player in a car at the start intersection and drive
  // the roads to the mission marker.
  state.clockBase = name === 'chase' ? 21.0 : 12.0;
  const car = state.cars.find((c) => !c.traffic && !c.police);
  if (car) {
    car.x = state.player.x; car.y = state.player.y; car.angle = 0;
    state.player.car = car; car.driver = true; car.traffic = false;
  }
  if (name === 'chase') {
    state.wanted = 4; state.missionIndex = 3; state.stageIndex = 1;
    state.money = 3100;
  } else {
    state.wanted = 2; state.money = 640;
  }
  const seconds = name === 'chase' ? 14 : 22;
  let waypoints = null, lastStage = null, stuckTimer = 0, lastX = state.player.x, lastY = state.player.y, reversing = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const st = world.currentStage();
    if (!st) break;
    const key = `${state.missionIndex}:${state.stageIndex}`;
    if (key !== lastStage) {
      lastStage = key;
      waypoints = routeWaypoints(state.player.x, state.player.y, st.x, st.y);
    }
    let wp = waypoints[0];
    if (waypoints.length > 1 && Math.hypot(wp.x - state.player.x, wp.y - state.player.y) < 60) waypoints.shift();
    wp = waypoints[0];
    // Stuck detection: barely moved in 1.5 s while driving.
    if (Math.hypot(state.player.x - lastX, state.player.y - lastY) < 6) stuckTimer += STEP; else stuckTimer = 0;
    lastX = state.player.x; lastY = state.player.y;
    if (stuckTimer > 1.5) { reversing = 1.0; stuckTimer = 0; }
    let inp;
    if (reversing > 0) {
      reversing -= STEP;
      inp = { mx: 0, my: 0, accel: false, brake: true, steer: 1, aimX: wp.x, aimY: wp.y, firing: false, punch: false, interact: false };
    } else if (state.player.car) inp = driveTo(state, wp.x, wp.y);
    else inp = onFootTo(state, wp.x, wp.y);
    if (name === 'chase' && state.policeCars.length && i % 90 === 0) {
      const pc = state.policeCars[0];
      inp.firing = true; inp.aimX = pc.x; inp.aimY = pc.y;
    }
    world.step(STEP, inp, false);
    if (state.over) break;
  }
  return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.money, saveExists: false };
}
