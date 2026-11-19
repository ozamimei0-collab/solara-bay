// Solara Bay simulation: city, traffic, pedestrians, police, wanted level,
// missions, combat, pickups and particles. No drawing and no browser in here —
// the renderer paints `state`, the loop feeds `step()` an input object.
import { CAR, MISSIONS, PALETTE, PLAYER, ROAD_SPACING, ROAD_WIDTH, WORLD } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;
export const EVENT_SHOOT = 16;
export const EVENT_VICTORY = 32;
export const EVENT_WANTED = 64;

const VX = [48, 448, 848, 1248, 1648, 2048, 2448, 2848];
const HY = [48, 448, 848, 1248, 1648, 2048];
const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33a', '#e8e8e8', '#2f3338', '#7a3dd9', '#3dd9a0', '#d97a3d', '#9ab3c8'];
const PED_COLORS = ['#e8b04b', '#7ab3e8', '#e87ab3', '#9be87a', '#c9c9c9', '#e87a7a', '#8a7ae8'];
const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function randRange(r, a, b) { return a + r() * (b - a); }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

export function createWorld(random) {
  const r = random;
  // ---- city generation (seeded, deterministic) ----
  const buildings = [];
  const parks = [];
  const landmarks = [
    { name: "RICO'S GARAGE", x: 1180, y: 380, w: 120, h: 70, color: '#8c4a5a' },
    { name: 'SOLARA BANK', x: 1580, y: 1180, w: 130, h: 80, color: '#4a6a8c' },
    { name: 'CAFE LUNA', x: 380, y: 780, w: 110, h: 60, color: '#9c7a3a' },
    { name: 'NEON CASINO', x: 1980, y: 780, w: 140, h: 80, color: '#7a5a8c' },
    { name: 'MARINA', x: 2780, y: 1580, w: 120, h: 60, color: '#4a8c7a' },
    { name: 'DOCKS', x: 2780, y: 1980, w: 120, h: 60, color: '#6a6a7a' },
    { name: 'AIRFIELD', x: 380, y: 1980, w: 130, h: 60, color: '#5a7a5a' },
    { name: 'SAFEHOUSE', x: 2380, y: 380, w: 110, h: 60, color: '#8c6a4a' },
    { name: 'YACHT CLUB', x: 2780, y: 1780, w: 100, h: 50, color: '#4a8c7a' },
  ];
  for (const lm of landmarks) buildings.push({ x: lm.x, y: lm.y, w: lm.w, h: lm.h, color: lm.color, label: lm.name });
  for (let i = 0; i < VX.length - 1; i += 1) {
    for (let j = 0; j < HY.length - 1; j += 1) {
      const bx = VX[i] + ROAD_WIDTH / 2 + 14;
      const by = HY[j] + ROAD_WIDTH / 2 + 14;
      const bw = ROAD_SPACING - ROAD_WIDTH - 28;
      const bh = ROAD_SPACING - ROAD_WIDTH - 28;
      const roll = r();
      if (roll < 0.16) {
        const trees = [];
        for (let t = 0; t < 9; t += 1) trees.push({ x: bx + r() * bw, y: by + r() * bh, s: 10 + r() * 14 });
        parks.push({ x: bx, y: by, w: bw, h: bh, trees });
        continue;
      }
      const cols = 2, rows = 2;
      for (let c = 0; c < cols; c += 1) for (let rw = 0; rw < rows; rw += 1) {
        if (r() < 0.12) continue;
        const w = bw / cols - 18, h = bh / rows - 18;
        const x = bx + c * (bw / cols) + 9, y = by + rw * (bh / rows) + 9;
        const ci = Math.floor(r() * PALETTE.building.length);
        buildings.push({ x, y, w, h, color: PALETTE.building[ci], roof: PALETTE.roof[ci] });
      }
    }
  }
  const onRoad = (x, y) => VX.some((vx) => Math.abs(x - vx) < ROAD_WIDTH / 2 + 4) || HY.some((hy) => Math.abs(y - hy) < ROAD_WIDTH / 2 + 4);
  const hitsBuilding = (x, y, rad) => {
    for (const b of buildings) if (x + rad > b.x && x - rad < b.x + b.w && y + rad > b.y && y - rad < b.y + b.h) return b;
    return null;
  };
  function resolveCircle(e, rad) {
    const b = hitsBuilding(e.x, e.y, rad);
    if (!b) return;
    const cx = clamp(e.x, b.x, b.x + b.w), cy = clamp(e.y, b.y, b.y + b.h);
    let dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0.01) { const d = Math.sqrt(d2); e.x = cx + (dx / d) * rad; e.y = cy + (dy / d) * rad; }
    else if (e.x < b.x + b.w / 2) e.x = b.x - rad; else e.x = b.x + b.w + rad;
  }

  const state = {
    time: 0, clock: 10.0, clockBase: 10.0, money: 120, health: PLAYER.health,
    wanted: 0, wantedTimer: 0, crimeCooldown: 0,
    missionIndex: 0, stageIndex: 0, holdProgress: 0, stageWantedApplied: false,
    dialogue: null, banner: null, victory: false, over: false,
    stats: { stolen: 0, shots: 0, earned: 0, missionsDone: 0 },
    player: null, cars: [], peds: [], policeCars: [], policeFoot: [],
    bullets: [], particles: [], skids: [], pickups: [],
    buildings, parks, landmarks, camera: { x: 0, y: 0 },
    speed: 0, lastDamage: 0, regenDelay: 0,
  };

  function spawnTrafficCar() {
    const vertical = r() < 0.5;
    const road = vertical ? pick(r, VX) : pick(r, HY);
    const along = randRange(r, 100, (vertical ? WORLD.height : WORLD.width) - 100);
    const dir = r() < 0.5 ? 1 : -1;
    const lane = 22;
    return {
      x: vertical ? road + (dir > 0 ? lane : -lane) : along,
      y: vertical ? along : road + (dir > 0 ? lane : -lane),
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: randRange(r, 110, 175), color: pick(r, CAR_COLORS), traffic: true, police: false,
      hp: CAR.hp, vertical, road, dir, turnCooldown: 2 + r() * 3, driver: true,
    };
  }
  function spawnPed() {
    const vertical = r() < 0.5;
    const road = pick(r, vertical ? VX : HY);
    const along = randRange(r, 100, (vertical ? WORLD.height : WORLD.width) - 100);
    return {
      x: vertical ? road + (r() < 0.5 ? 58 : -58) : along,
      y: vertical ? along : road + (r() < 0.5 ? 58 : -58),
      angle: r() * TAU, speed: randRange(r, 35, 70), color: pick(r, PED_COLORS),
      tx: 0, ty: 0, pause: 0, hp: 40, kind: 'ped',
    };
  }
  function spawnPickup(kind) {
    let x, y, tries = 0;
    do { x = randRange(r, 120, WORLD.width - 120); y = randRange(r, 120, 2050); tries += 1; } while (hitsBuilding(x, y, 20) && tries < 20);
    return { x, y, kind, amount: kind === 'cash' ? 50 + Math.floor(r() * 100) : 30, bob: r() * TAU };
  }
  function addParticles(x, y, n, color, speed, life) {
    for (let i = 0; i < n; i += 1) {
      if (state.particles.length > 320) return;
      const a = r() * TAU, s = speed * (0.4 + r() * 0.8);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + r() * 0.7), maxLife: life, color, size: 2 + r() * 4 });
    }
  }
  function raiseWanted(n) {
    if (state.crimeCooldown > 0 && n <= 1) return;
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.wantedTimer = 0;
    state.crimeCooldown = 0.8;
    if (state.wanted > before) return EVENT_WANTED;
    return 0;
  }
  function setBanner(text, sub) { state.banner = { text, sub: sub || '', timer: 3.2 }; }
  function setDialogue(lines) { state.dialogue = { lines, index: 0, timer: 0 }; }

  function currentMission() { return MISSIONS[state.missionIndex] || null; }
  function currentStage() { const m = currentMission(); return m ? m.stages[state.stageIndex] : null; }
  function startStage() {
    const st = currentStage();
    state.holdProgress = 0; state.stageWantedApplied = false;
    if (st && st.setWanted) { state.wanted = st.setWanted; state.stageWantedApplied = true; }
  }
  function completeStage(events) {
    const m = currentMission(); const st = currentStage();
    const per = Math.floor(m.reward / m.stages.length);
    state.money += per; state.stats.earned += per;
    addParticles(state.player.x, state.player.y, 26, PALETTE.gold, 180, 0.8);
    if (st && st.clearWantedOnArrive) state.wanted = 0;
    if (state.stageIndex + 1 < m.stages.length) {
      state.stageIndex += 1; startStage();
      setBanner('Objective complete', `+$${per} — ${currentStage().label}`);
      return events | EVENT_MISSION;
    }
    state.stats.missionsDone += 1;
    setBanner(`${m.title} — complete!`, `+$${per} earned`);
    if (state.missionIndex + 1 < MISSIONS.length) {
      state.missionIndex += 1; state.stageIndex = 0; startStage();
      setDialogue(currentMission().intro);
      saveHint();
    } else {
      state.victory = true;
      setBanner('STORY COMPLETE', 'Solara Bay is yours, legend.');
      return events | EVENT_MISSION | EVENT_VICTORY;
    }
    return events | EVENT_MISSION;
  }
  function saveHint() { /* main.js persists on mission complete */ }

  function reset() {
    state.time = 0; state.clock = 10.0; state.clockBase = 10.0; state.money = 120; state.health = PLAYER.health;
    state.wanted = 0; state.wantedTimer = 0; state.crimeCooldown = 0;
    state.missionIndex = 0; state.stageIndex = 0; state.holdProgress = 0;
    state.victory = false; state.over = false;
    state.stats = { stolen: 0, shots: 0, earned: 0, missionsDone: 0 };
    state.bullets = []; state.particles = []; state.skids = []; state.policeCars = []; state.policeFoot = [];
    state.player = { x: 448, y: 448, angle: 0, health: PLAYER.health, car: null, speed: 0, aimAngle: 0, shootCd: 0, punchCd: 0, invuln: 0, moving: false };
    state.cars = [];
    for (let i = 0; i < 14; i += 1) state.cars.push(spawnTrafficCar());
    // Parked, stealable cars at the roadside (on a road lane, never inside a block).
    const parkedSpots = [[470, 470], [870, 470], [1270, 870], [1670, 470], [2070, 1270], [2470, 870], [470, 1270], [2870, 470], [870, 1670], [1670, 1670]];
    for (const [x, y] of parkedSpots) state.cars.push({ x, y, angle: (r() < 0.5 ? 0 : Math.PI / 2), speed: 0, color: pick(r, CAR_COLORS), traffic: false, police: false, hp: CAR.hp, driver: false });
    state.peds = [];
    for (let i = 0; i < 26; i += 1) state.peds.push(spawnPed());
    state.pickups = [];
    for (let i = 0; i < 10; i += 1) state.pickups.push(spawnPickup(i % 3 === 0 ? 'health' : 'cash'));
    state.camera.x = state.player.x - 640; state.camera.y = state.player.y - 360;
    setDialogue(MISSIONS[0].intro);
    startStage();
  }

  function enterCar(car) {
    const p = state.player;
    p.car = car; car.driver = true; car.traffic = false;
    state.stats.stolen += 1;
    setBanner('Car stolen!', 'Drive to the marker — watch the heat.');
    return raiseWanted(1);
  }
  function exitCar() {
    const p = state.player; const car = p.car;
    if (!car) return 0;
    car.speed = 0;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    p.angle = car.angle;
    resolveCircle(p, PLAYER.radius);
    return 0;
  }

  function damagePlayer(amount, events) {
    const p = state.player;
    if (p.invuln > 0) return events;
    // A car absorbs half the hit — the driver is safer inside it.
    if (p.car) amount = Math.ceil(amount / 2);
    p.health -= amount; state.health = p.health; state.lastDamage = state.time; state.regenDelay = 5;
    p.invuln = 0.6;
    addParticles(p.x, p.y, 10, '#e5534b', 160, 0.5);
    if (p.health <= 0) { p.health = 0; state.health = 0; state.over = true; return events | EVENT_HIT | EVENT_OVER; }
    return events | EVENT_HIT;
  }

  function step(dt, inp, harmless) {
    let events = 0;
    const p = state.player;
    state.time += dt;
    state.clock = (state.clockBase + state.time / 60) % 24;
    if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
    if (state.banner) { state.banner.timer -= dt; if (state.banner.timer <= 0) state.banner = null; }
    if (state.dialogue) {
      state.dialogue.timer += dt;
      if (state.dialogue.timer > 4.5) { state.dialogue.index += 1; state.dialogue.timer = 0; if (state.dialogue.index >= state.dialogue.lines.length) state.dialogue = null; }
    }
    // Wanted decays when the player stays out of trouble.
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      const nearPolice = state.policeCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 500) || state.policeFoot.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 300);
      if (!nearPolice && state.wantedTimer > 18) { state.wanted -= 1; state.wantedTimer = 0; }
    }
    // Health regen after a calm stretch.
    if (state.regenDelay > 0) state.regenDelay -= dt;
    else if (p.health < PLAYER.health && state.wanted === 0) { p.health = Math.min(PLAYER.health, p.health + 3 * dt); state.health = p.health; }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;

    // ---- player movement ----
    p.moving = false;
    if (p.car) {
      const car = p.car;
      const fwd = (inp.accel ? 1 : 0) - (inp.brake ? 0.7 : 0);
      const steer = clamp(inp.steer || 0, -1, 1);
      const spd = car.speed;
      car.speed += (fwd > 0 ? CAR.accel * fwd : fwd < 0 ? -CAR.brake * 0.7 : -Math.sign(spd) * CAR.drag * 60) * dt;
      if (!inp.accel && !inp.brake) car.speed -= Math.sign(spd) * CAR.drag * 90 * dt;
      if (Math.abs(car.speed) < 4 && !inp.accel) car.speed = 0;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const turn = steer * CAR.turnRate * clamp(Math.abs(spd) / 220, 0, 1) * (spd < 0 ? -1 : 1);
      car.angle += turn * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 30, WORLD.width - 30); car.y = clamp(car.y, 30, WORLD.height - 30);
      // Building collision: bounce and damage at speed.
      const before = { x: car.x, y: car.y };
      resolveCircle(car, 24);
      if ((car.x !== before.x || car.y !== before.y) && Math.abs(car.speed) > 300) {
        car.speed *= -0.25; car.hp -= 5;
        addParticles(car.x, car.y, 8, '#cccccc', 120, 0.4);
        events |= EVENT_HIT;
      }
      if (Math.abs(steer) > 0.6 && Math.abs(car.speed) > 260) {
        state.skids.push({ x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18, angle: car.angle, life: 7 });
        if (state.skids.length > 240) state.skids.shift();
      }
      if (car.hp <= 0) { car.hp = 0; car.speed = 0; addParticles(car.x, car.y, 20, '#888888', 100, 1); exitCar(); }
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      state.speed = Math.abs(car.speed);
      p.moving = Math.abs(car.speed) > 20;
      if (inp.interact) { events |= exitCar(); inp.interact = false; }
    } else {
      const mx = inp.mx || 0, my = inp.my || 0;
      const len = Math.hypot(mx, my);
      if (len > 0.01) {
        const sp = PLAYER.walkSpeed;
        p.x += (mx / Math.max(1, len)) * sp * dt;
        p.y += (my / Math.max(1, len)) * sp * dt;
        p.angle = Math.atan2(my, mx);
        p.moving = true;
      }
      p.x = clamp(p.x, 20, WORLD.width - 20); p.y = clamp(p.y, 20, WORLD.height - 20);
      resolveCircle(p, PLAYER.radius);
      state.speed = p.moving ? PLAYER.walkSpeed : 0;
      if (inp.interact) {
        inp.interact = false;
        let best = null, bestD = 80;
        for (const car of state.cars) {
          if (car.police) continue;
          const d = Math.hypot(car.x - p.x, car.y - p.y);
          if (d < bestD) { bestD = d; best = car; }
        }
        if (best) { best.speed = 0; events |= enterCar(best); }
      }
    }
    // Aim follows the mouse (world coords).
    if (inp.aimX !== undefined) p.aimAngle = Math.atan2(inp.aimY - p.y, inp.aimX - p.x);

    // ---- combat ----
    if (inp.punch && p.punchCd <= 0 && !p.car) {
      p.punchCd = 0.35;
      const targets = [...state.peds, ...state.policeFoot];
      for (const t of targets) {
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d < PLAYER.punchRange && Math.abs(angDiff(p.aimAngle, Math.atan2(t.y - p.y, t.x - p.x))) < PLAYER.punchArc) {
          t.hp -= PLAYER.punchDamage;
          t.x += Math.cos(p.aimAngle) * 26; t.y += Math.sin(p.aimAngle) * 26;
          addParticles(t.x, t.y, 8, '#ffd27a', 140, 0.4);
          if (t.kind === 'cop') events |= raiseWanted(2); else events |= raiseWanted(1);
          if (t.hp <= 0) { t.dead = true; }
        }
      }
      for (const car of [...state.cars, ...state.policeCars]) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < 60) { car.hp -= 10; if (car.hp <= 0) addParticles(car.x, car.y, 16, '#888', 120, 0.8); }
      }
    }
    if (inp.firing && p.shootCd <= 0) {
      p.shootCd = PLAYER.shootCooldown;
      state.stats.shots += 1;
      const a = p.aimAngle;
      state.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed, life: 0.9 });
      addParticles(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, 4, '#ffe08a', 200, 0.15);
      events |= EVENT_SHOOT;
    }
    // Bullets.
    for (const b of state.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) { b.dead = true; continue; }
      if (hitsBuilding(b.x, b.y, 2)) { b.dead = true; addParticles(b.x, b.y, 5, '#cccccc', 100, 0.3); continue; }
      for (const t of [...state.peds, ...state.policeFoot]) {
        if (t.dead) continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) < 16) {
          t.hp -= PLAYER.bulletDamage; b.dead = true;
          addParticles(b.x, b.y, 8, '#e5534b', 150, 0.4);
          if (t.hp <= 0) t.dead = true;
          events |= raiseWanted(t.kind === 'cop' ? 2 : 1);
          break;
        }
      }
      if (b.dead) continue;
      for (const car of [...state.cars, ...state.policeCars]) {
        if (car === p.car) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          car.hp -= PLAYER.bulletDamage; b.dead = true;
          addParticles(b.x, b.y, 6, '#ffd27a', 130, 0.3);
          if (car.police) events |= raiseWanted(1);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    state.peds = state.peds.filter((t) => !t.dead);
    state.policeFoot = state.policeFoot.filter((t) => !t.dead);
    while (state.peds.length < 22 && !harmless) state.peds.push(spawnPed());

    // ---- traffic ----
    for (const car of state.cars) {
      if (!car.traffic || car === p.car) continue;
      car.turnCooldown -= dt;
      // Slow for a car ahead on the same road.
      let ahead = false;
      for (const o of state.cars) {
        if (o === car || o === p.car) continue;
        const d = Math.hypot(o.x - car.x, o.y - car.y);
        if (d < 70 && Math.abs(angDiff(car.angle, Math.atan2(o.y - car.y, o.x - car.x))) < 0.6) { ahead = true; break; }
      }
      const target = ahead ? 0 : car.speed < 130 ? 130 : car.speed;
      car.speed += clamp(target - car.speed, -200 * dt, 120 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.turnCooldown <= 0) {
        const nearV = VX.find((vx) => Math.abs(car.x - vx) < 30);
        const nearH = HY.find((hy) => Math.abs(car.y - hy) < 30);
        if (nearV !== undefined && nearH !== undefined && r() < 0.4) {
          car.vertical = !car.vertical;
          car.road = car.vertical ? nearV : nearH;
          car.angle = car.vertical ? (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (r() < 0.5 ? 0 : Math.PI);
          car.turnCooldown = 3 + r() * 3;
        }
      }
      if (car.x < 20 || car.x > WORLD.width - 20 || car.y < 20 || car.y > WORLD.height - 20) {
        Object.assign(car, spawnTrafficCar());
      }
      resolveCircle(car, 22);
    }
    // Parked / player car vs traffic: simple separation.
    for (let i = 0; i < state.cars.length; i += 1) for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i], b = state.cars[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 48) { const push = (48 - d) / 2; const nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
    }

    // ---- pedestrians ----
    for (const t of state.peds) {
      if (t.pause > 0) { t.pause -= dt; continue; }
      if (Math.hypot(t.tx - t.x, t.y - t.ty) < 20 || (t.tx === 0 && t.ty === 0)) {
        const vertical = r() < 0.5;
        const road = pick(r, vertical ? VX : HY);
        const along = randRange(r, 100, (vertical ? WORLD.height : WORLD.width) - 100);
        t.tx = vertical ? road + (r() < 0.5 ? 58 : -58) : along;
        t.ty = vertical ? along : road + (r() < 0.5 ? 58 : -58);
        if (r() < 0.2) t.pause = 1 + r() * 2;
      }
      const a = Math.atan2(t.ty - t.y, t.tx - t.x);
      t.angle = a;
      t.x += Math.cos(a) * t.speed * dt;
      t.y += Math.sin(a) * t.speed * dt;
      // Flee from gunfire / a speeding car.
      const pd = Math.hypot(p.x - t.x, p.y - t.y);
      if (pd < 90 && (inp.firing || state.speed > 300)) { t.x += (t.x - p.x) / pd * 60 * dt; t.y += (t.y - p.y) / pd * 60 * dt; }
    }

    // ---- police ----
    const wantCars = state.wanted >= 1 ? Math.min(state.wanted, 4) : 0;
    while (state.policeCars.length < wantCars) {
      const a = r() * TAU;
      state.policeCars.push({ x: clamp(p.x + Math.cos(a) * 650, 40, WORLD.width - 40), y: clamp(p.y + Math.sin(a) * 650, 40, WORLD.height - 40), angle: 0, speed: 0, color: '#1c2733', police: true, traffic: false, hp: 120, ramCd: 0 });
    }
    while (state.policeCars.length > wantCars) state.policeCars.pop();
    const wantFoot = state.wanted >= 2 ? Math.min(state.wanted - 1, 3) : 0;
    while (state.policeFoot.length < wantFoot) {
      const a = r() * TAU;
      state.policeFoot.push({ x: clamp(p.x + Math.cos(a) * 220, 40, WORLD.width - 40), y: clamp(p.y + Math.sin(a) * 220, 40, WORLD.height - 40), angle: 0, speed: 210, color: '#1c2733', hp: 50, kind: 'cop', tx: 0, ty: 0, pause: 0, hitCd: 0 });
    }
    while (state.policeFoot.length > wantFoot) state.policeFoot.pop();
    for (const c of state.policeCars) {
      const a = Math.atan2(p.y - c.y, p.x - c.x);
      c.angle += clamp(angDiff(c.angle, a), -2.4 * dt, 2.4 * dt);
      const target = 300 + state.wanted * 25;
      c.speed += clamp(target - c.speed, -400 * dt, 260 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      resolveCircle(c, 22);
      c.ramCd -= dt;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 52 && c.ramCd <= 0) {
        c.ramCd = 2.5; c.speed *= 0.3;
        if (p.car) { p.car.hp -= 4; if (p.car.hp <= 0) addParticles(p.car.x, p.car.y, 18, '#888', 120, 0.8); }
        events = damagePlayer(4, events);
        addParticles(p.x, p.y, 10, '#ffd27a', 160, 0.4);
      }
    }
    for (const c of state.policeFoot) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      const a = Math.atan2(p.y - c.y, p.x - c.x);
      c.angle = a;
      if (d > 26) { c.x += Math.cos(a) * c.speed * dt; c.y += Math.sin(a) * c.speed * dt; }
      c.hitCd -= dt;
      if (d < 32 && c.hitCd <= 0) { c.hitCd = 1.2; events = damagePlayer(6, events); }
    }

    // ---- pickups ----
    for (const pk of state.pickups) {
      pk.bob += dt * 3;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < (p.car ? 44 : 30)) {
        pk.taken = true;
        if (pk.kind === 'cash') { state.money += pk.amount; state.stats.earned += pk.amount; setBanner(`+$${pk.amount}`, 'Cash found'); events |= EVENT_COIN; }
        else { p.health = Math.min(PLAYER.health, p.health + pk.amount); state.health = p.health; setBanner('Health +30', 'Patched up'); events |= EVENT_COIN; }
        addParticles(pk.x, pk.y, 12, PALETTE.green, 140, 0.5);
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    while (state.pickups.length < 10) state.pickups.push(spawnPickup(r() < 0.7 ? 'cash' : 'health'));

    // ---- particles / skids ----
    for (const pt of state.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.96; pt.vy *= 0.96; pt.life -= dt; }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const s of state.skids) s.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);

    // ---- missions ----
    if (!harmless && !state.victory && !state.over) {
      const st = currentStage();
      if (st) {
        const d = Math.hypot(st.x - p.x, st.y - p.y);
        if (st.needCar && !p.car) { /* must arrive in a car */ }
        else if (d < 95) {
          if (st.holdSeconds) {
            state.holdProgress += dt;
            if (state.holdProgress >= st.holdSeconds) events = completeStage(events);
          } else events = completeStage(events);
        } else state.holdProgress = 0;
      }
    }

    // ---- camera ----
    const tx = clamp(p.x - 640, 0, WORLD.width - 1280);
    const ty = clamp(p.y - 360, 0, WORLD.height - 720);
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
    return events;
  }

  reset();
  return { state, reset, step, currentMission, currentStage, onRoad, hitsBuilding };
}
