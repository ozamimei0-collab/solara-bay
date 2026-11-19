// Drawing only: city, cars, people, HUD, minimap and every screen.
// The camera shows a 1280x720 window of the 3200x2400 world, scaled to fit.
import { DISTRICTS, FONT, MISSIONS, PALETTE, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const ROAD_W = 96;
const VX = [48, 448, 848, 1248, 1648, 2048, 2448, 2848];
const HY = [48, 448, 848, 1248, 1648, 2048];

function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  return 'SOLARA BAY';
}
function darkness(clock) {
  if (clock >= 7 && clock < 17.5) return 0;
  if (clock >= 18.5 && clock < 24 || clock < 5.5) return 0.42;
  if (clock >= 17.5) return 0.42 * ((clock - 17.5) / 1);
  if (clock >= 5.5) return 0.42 * (1 - (clock - 5.5) / 1.5);
  return 0.2;
}
function fmtClock(clock) {
  const h = Math.floor(clock) % 24, m = Math.floor((clock % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0 };
  const fonts = new Map();
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / 1280, canvas.height / 720);
    view.ox = (canvas.width - 1280 * view.scale) / 2;
    view.oy = (canvas.height - 720 * view.scale) / 2;
  }
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function textPlain(value, x, y, size, color, align) {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    ctx.font = fonts.get('p' + size);
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawCarShape(c, isPlayer) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(-26, -12, 52, 26, 8); ctx.fill();
    ctx.fillStyle = c.color; rr(-26, -13, 52, 26, 8); ctx.fill();
    ctx.fillStyle = c.police ? '#e8ecf0' : 'rgba(20,24,32,0.75)'; rr(-4, -11, 20, 22, 4); ctx.fill();
    ctx.fillStyle = '#20242c'; rr(12, -11, 8, 22, 3); ctx.fill();
    if (c.police) {
      const flash = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff'; ctx.fillRect(-8, -13, 8, 5);
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30'; ctx.fillRect(0, -13, 8, 5);
    }
    if (c.hp !== undefined && c.hp < 60) { ctx.fillStyle = 'rgba(120,120,120,0.7)'; ctx.beginPath(); ctx.arc(18, 0, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (isPlayer) { ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, c.y, 32, 0, Math.PI * 2); ctx.stroke(); }
  }
  function drawPersonShape(p, isPlayer, isCop) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 5, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isCop ? '#1c2733' : p.color; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 5.5, 0, Math.PI * 2); ctx.fill();
    if (isPlayer) { ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  function drawWorld(state, timeMs) {
    const cam = state.camera;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox - cam.x * view.scale, view.oy - cam.y * view.scale);
    // Ground, beach and water.
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, 2140, WORLD.width, 110);
    ctx.fillStyle = PALETTE.water; ctx.fillRect(0, 2250, WORLD.width, 150);
    ctx.fillStyle = PALETTE.waterDeep; ctx.fillRect(0, 2320, WORLD.width, 80);
    // Parks.
    for (const pk of state.parks) {
      ctx.fillStyle = PALETTE.park; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      for (const t of pk.trees) { ctx.fillStyle = '#2a5c2e'; ctx.beginPath(); ctx.arc(t.x, t.y, t.s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3f8a44'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.s * 0.7, 0, Math.PI * 2); ctx.fill(); }
    }
    // Roads + sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const vx of VX) ctx.fillRect(vx - ROAD_W / 2 - 10, 0, ROAD_W + 20, 2140);
    for (const hy of HY) ctx.fillRect(0, hy - ROAD_W / 2 - 10, WORLD.width, ROAD_W + 20);
    ctx.fillStyle = PALETTE.road;
    for (const vx of VX) ctx.fillRect(vx - ROAD_W / 2, 0, ROAD_W, 2140);
    for (const hy of HY) ctx.fillRect(0, hy - ROAD_W / 2, WORLD.width, ROAD_W);
    ctx.fillStyle = PALETTE.roadLine;
    for (const vx of VX) for (let y = 0; y < 2140; y += 64) ctx.fillRect(vx - 2, y, 4, 32);
    for (const hy of HY) for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, hy - 2, 32, 4);
    // Buildings.
    for (const b of state.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof || 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(255,240,180,0.75)';
      for (let wx = b.x + 16; wx < b.x + b.w - 14; wx += 26) for (let wy = b.y + 16; wy < b.y + b.h - 14; wy += 26) ctx.fillRect(wx, wy, 10, 12);
      if (b.label) { textPlain(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4, 13, '#ffffff', 'center'); }
    }
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 4;
    for (const s of state.skids) { ctx.globalAlpha = Math.min(0.6, s.life / 7); ctx.beginPath(); ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10); ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      ctx.fillStyle = pk.kind === 'cash' ? PALETTE.gold : PALETTE.green;
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#12200f'; textPlain(pk.kind === 'cash' ? '$' : '+', pk.x, pk.y + bob + 5, 14, '#12200f', 'center');
    }
    // Mission marker beacon.
    const st = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex].stages[state.stageIndex] : null;
    if (st && !state.victory) {
      const pulse = 1 + Math.sin(timeMs / 300) * 0.12;
      ctx.fillStyle = 'rgba(242,201,76,0.25)'; ctx.beginPath(); ctx.arc(st.x, st.y, 60 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(st.x, st.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.moveTo(st.x, st.y - 26); ctx.lineTo(st.x + 14, st.y + 8); ctx.lineTo(st.x - 14, st.y + 8); ctx.closePath(); ctx.fill();
    }
    // Cars, people, police.
    for (const car of state.cars) drawCarShape(car, state.player.car === car);
    for (const car of state.policeCars) drawCarShape(car, false);
    for (const ped of state.peds) drawPersonShape(ped, false, false);
    for (const cop of state.policeFoot) drawPersonShape(cop, false, true);
    const p = state.player;
    if (!p.car) drawPersonShape(p, true, false);
    else { // aim indicator when on foot is the player; in a car show heading
    }
    // Bullets.
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3;
    for (const b of state.bullets) { ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    // Particles.
    for (const pt of state.particles) { ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife); ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // Aim crosshair (on foot).
    if (!p.car) {
      const ax = p.x + Math.cos(p.aimAngle) * 34, ay = p.y + Math.sin(p.aimAngle) * 34;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax - 13, ay); ctx.lineTo(ax - 5, ay); ctx.moveTo(ax + 5, ay); ctx.lineTo(ax + 13, ay); ctx.moveTo(ax, ay - 13); ctx.lineTo(ax, ay - 5); ctx.moveTo(ax, ay + 5); ctx.lineTo(ax, ay + 13); ctx.stroke();
    }
    // Day / night tint + headlights.
    const dark = darkness(state.clock);
    if (dark > 0) { ctx.fillStyle = `rgba(8,14,38,${dark})`; ctx.fillRect(cam.x - 20, cam.y - 20, 1320, 760); }
    if (dark > 0.15) {
      for (const car of [...state.cars, ...state.policeCars]) {
        if (Math.abs(car.speed) < 5 && car !== state.player.car) continue;
        ctx.fillStyle = 'rgba(255,240,170,0.14)';
        ctx.beginPath(); ctx.moveTo(car.x, car.y);
        ctx.lineTo(car.x + Math.cos(car.angle - 0.25) * 130, car.y + Math.sin(car.angle - 0.25) * 130);
        ctx.lineTo(car.x + Math.cos(car.angle + 0.25) * 130, car.y + Math.sin(car.angle + 0.25) * 130);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  function drawHud(state, screen) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const p = state.player;
    // Top-left: health, money, wanted, speed, clock, district.
    ctx.fillStyle = 'rgba(10,14,20,0.72)'; rr(14, 12, 300, 96, 10); ctx.fill();
    text(`$${state.money.toLocaleString()}`, 28, 42, 26, PALETTE.gold, 'left');
    textPlain(districtAt(p.x, p.y), 28, 66, 14, PALETTE.muted, 'left');
    textPlain(fmtClock(state.clock) + (state.clock >= 19 || state.clock < 6 ? '  •  NIGHT' : '  •  DAY'), 28, 88, 14, PALETTE.text, 'left');
    ctx.fillStyle = '#222'; rr(170, 24, 130, 14, 7); ctx.fill();
    ctx.fillStyle = p.health > 40 ? PALETTE.green : PALETTE.red; rr(170, 24, 130 * Math.max(0, p.health / 100), 14, 7); ctx.fill();
    textPlain('HP', 152, 36, 12, PALETTE.text, 'right');
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, 28, 126, 24, state.wanted ? '#ffcf4d' : '#8b93a3', 'left');
    textPlain(p.car ? `${Math.round(Math.abs(p.car.speed) * 0.22)} km/h` : 'ON FOOT', 28, 164, 14, PALETTE.text, 'left');
    if (p.car) { ctx.fillStyle = '#222'; rr(170, 154, 130, 10, 5); ctx.fill(); ctx.fillStyle = '#4fc3f7'; rr(170, 154, 130 * Math.max(0, p.car.hp / 100), 10, 5); ctx.fill(); textPlain('CAR', 152, 164, 12, PALETTE.text, 'right'); }
    // Mission tracker.
    if (state.missionIndex < MISSIONS.length && !state.victory) {
      const m = MISSIONS[state.missionIndex]; const st = m.stages[state.stageIndex];
      const d = Math.round(Math.hypot(st.x - p.x, st.y - p.y));
      ctx.fillStyle = 'rgba(10,14,20,0.72)'; rr(14, 172, 360, 88, 10); ctx.fill();
      text(m.title, 28, 198, 18, PALETTE.gold, 'left');
      textPlain(st.label, 28, 222, 14, PALETTE.text, 'left');
      textPlain(`${d}m away  ${st.holdSeconds ? `HOLD ${Math.max(0, st.holdSeconds - state.holdProgress).toFixed(1)}s` : ''}`, 28, 246, 12, PALETTE.muted, 'left');
      if (st.holdSeconds && state.holdProgress > 0) { ctx.fillStyle = '#222'; rr(28, 252, 200, 6, 3); ctx.fill(); ctx.fillStyle = PALETTE.gold; rr(28, 252, 200 * (state.holdProgress / st.holdSeconds), 6, 3); ctx.fill(); }
    }
    // Minimap.
    const mx = 1280 - 238, my = 12, mw = 224, mh = 168, s = mw / WORLD.width;
    ctx.fillStyle = 'rgba(10,14,20,0.85)'; rr(mx - 6, my - 6, mw + 12, mh + 12, 10); ctx.fill();
    ctx.fillStyle = '#1d5f8a'; ctx.fillRect(mx, my + mh - 14, mw, 14);
    ctx.fillStyle = '#3f7a44'; ctx.fillRect(mx, my, mw, mh - 14);
    ctx.fillStyle = '#2b2f36';
    for (const vx of VX) ctx.fillRect(mx + vx * s - 1, my, 2, mh);
    for (const hy of HY) ctx.fillRect(mx, my + hy * s - 1, mw, 2);
    ctx.fillStyle = '#8a8f96';
    for (const b of state.buildings) ctx.fillRect(mx + b.x * s, my + b.y * s, Math.max(1, b.w * s), Math.max(1, b.h * s));
    if (state.missionIndex < MISSIONS.length && !state.victory) {
      const st = MISSIONS[state.missionIndex].stages[state.stageIndex];
      ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(mx + st.x * s, my + st.y * s, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e5534b';
    for (const c of state.policeCars) { ctx.beginPath(); ctx.arc(mx + c.x * s, my + c.y * s, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    ctx.save(); ctx.translate(mx + p.x * s, my + p.y * s); ctx.rotate(p.angle); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    // Controls hint.
    textPlain('WASD move/drive • Mouse aim • Click shoot • F punch • E steal/exit car • P pause • M mute', 640, 706, 13, 'rgba(255,255,255,0.75)', 'center');
    // Dialogue.
    if (state.dialogue && screen === SCREEN_PLAY) {
      const line = state.dialogue.lines[state.dialogue.index];
      ctx.fillStyle = 'rgba(10,14,20,0.88)'; rr(280, 596, 720, 64, 10); ctx.fill();
      ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2; rr(280, 596, 720, 64, 10); ctx.stroke();
      textPlain(line, 640, 634, 16, PALETTE.text, 'center');
    }
    // Banner.
    if (state.banner) {
      ctx.globalAlpha = Math.min(1, state.banner.timer);
      text(state.banner.text, 640, 310, 40, PALETTE.gold, 'center');
      if (state.banner.sub) textPlain(state.banner.sub, 640, 342, 18, PALETTE.text, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function wrapLines(lines, maxWidth, size) {
    ctx.font = `${size}px ${FONT}`;
    const out = [];
    for (const ln of lines) {
      if (!ln) { out.push(''); continue; }
      const words = ln.split(' ');
      let cur = '';
      for (const w of words) {
        const trial = cur ? cur + ' ' + w : w;
        if (ctx.measureText(trial).width > maxWidth && cur) { out.push(cur); cur = w; }
        else cur = trial;
      }
      out.push(cur);
    }
    return out;
  }
  function drawPanel(title, lines, prompt, accent) {
    const w = 760;
    const wrapped = wrapLines(lines, w - 80, 18);
    const h = 150 + wrapped.length * 30 + 70;
    const x = (1280 - w) / 2, y = (720 - h) / 2;
    ctx.fillStyle = PALETTE.panel; rr(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold; ctx.lineWidth = 2; rr(x, y, w, h, 14); ctx.stroke();
    text(title, 640, y + 72, 46, accent || PALETTE.text, 'center');
    wrapped.forEach((ln, i) => textPlain(ln, 640, y + 120 + i * 30, 18, PALETTE.muted, 'center'));
    text(prompt, 640, y + h - 34, 20, PALETTE.gold, 'center');
  }

  function draw(state, screen, best, opts) {
    const timeMs = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(state, timeMs);
    if (screen === SCREEN_TITLE) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
      ctx.fillStyle = 'rgba(8,10,16,0.30)'; ctx.fillRect(0, 0, 1280, 720);
      drawPanel('SOLARA BAY', [
        'An original open-world crime story. Five missions. One city. No rules but yours.',
        'Steal cars, outrun the police, pull jobs for Rico and Maya — and take the Big Score.',
        'WASD move & drive • Mouse aim • Click shoot • F punch • E steal / exit car • P pause',
        best ? `Best haul so far: $${best.toLocaleString()}` : 'Your first haul is waiting.',
      ], opts && opts.saveExists ? 'Press Enter to start  •  L to load your save' : 'Press Enter or click to start', PALETTE.gold);
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_PAUSED) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
      drawPanel('PAUSED', ['The city waits for you.', 'L — save your progress   •   M — mute   •   P — resume'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
      drawPanel('BUSTED — GAME OVER', [
        `You earned $${state.stats.earned.toLocaleString()} and finished ${state.stats.missionsDone} of 5 missions.`,
        'Solara Bay is unforgiving. Next time, watch the stars.',
      ], 'Press Enter or click to try again', PALETTE.red);
    } else if (screen === SCREEN_COMPLETE) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
      drawPanel('STORY COMPLETE', [
        `The Big Score is yours — $${state.money.toLocaleString()} in the bag, ${state.stats.stolen} cars stolen.`,
        'Rico and Maya are waiting on the yacht. Solara Bay is yours, legend.',
      ], 'Press Enter or click to play again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
