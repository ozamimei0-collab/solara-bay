// Solara Bay — tuning, palette, city layout and the story.
// The world is 3200 x 2400 units. Roads run on a 400-unit grid; the camera shows
// a 1280 x 720 window of it. Everything below is original: no names, art or music
// from any commercial game.
export const STEP = 1 / 60;
export const WORLD = { width: 3200, height: 2400 };
export const ROAD_SPACING = 400;
export const ROAD_WIDTH = 96;
export const BEST_KEY = 'solara-bay.best';
export const SAVE_KEY = 'solara-bay.save';

export const PLAYER = {
  radius: 14, walkSpeed: 230, runSpeed: 300,
  health: 100, punchDamage: 22, punchRange: 46, punchArc: 1.1,
  shootCooldown: 0.16, bulletSpeed: 950, bulletDamage: 34,
};
export const CAR = {
  length: 52, width: 26, accel: 420, brake: 620, reverseAccel: 220,
  maxSpeed: 560, maxReverse: 180, turnRate: 2.6, drag: 0.55, grip: 6.5, hp: 100,
};
export const MISSIONS = [
  {
    id: 'first-wheels', title: '1 — First Wheels', reward: 300,
    intro: ['Rico: "You\'re new in Solara Bay, kid. First rule — wheels are everything."', '"Steal a car and bring it to my garage. Any car. Don\'t get caught."'],
    stages: [{ label: 'Steal a car and drive to Rico\'s Garage', x: 1248, y: 448, needCar: true }],
  },
  {
    id: 'courier', title: '2 — The Courier', reward: 500,
    intro: ['Maya: "A package is waiting at the Marina. No questions, no peeking."', '"Deliver it to the cafe in Old Town. The cops are jumpy today — keep it smooth."'],
    stages: [
      { label: 'Pick up the package at the Marina', x: 2848, y: 1648, needCar: false },
      { label: 'Deliver the package to Cafe Luna, Old Town', x: 448, y: 848, needCar: false },
    ],
  },
  {
    id: 'heat', title: '3 — Heat Rising', reward: 700,
    intro: ['Rico: "You made the news, kid. Three stars and every cruiser in the city is looking."', '"Lose them. Get to the safehouse on the Hills and stay out of sight until it cools off."'],
    stages: [{ label: 'Lose the police and reach the Hills Safehouse', x: 2448, y: 448, needCar: false, setWanted: 3, clearWantedOnArrive: true }],
  },
  {
    id: 'bank', title: '4 — The Bank Job', reward: 2500,
    intro: ['Maya: "Solara Bank. In, out, nobody gets hurt — unless they get in the way."', '"Stand in the bank lobby, grab the cash, then run. The safehouse is your only friend after this."'],
    stages: [
      { label: 'Get inside Solara Bank', x: 1648, y: 1248, needCar: false, holdSeconds: 3 },
      { label: 'Escape to the Hills Safehouse — wanted level 4!', x: 2448, y: 448, needCar: false, setWanted: 4 },
    ],
  },
  {
    id: 'big-score', title: '5 — The Big Score', reward: 4000,
    intro: ['Rico: "One last job. Three drops, then the yacht. After tonight, Solara Bay is ours."', '"Hit the Casino, the Docks, and the Airfield — then get to the yacht at the Marina and sail out a legend."'],
    stages: [
      { label: 'Hit the Casino drop', x: 2048, y: 848, needCar: false },
      { label: 'Hit the Docks drop', x: 2848, y: 2048, needCar: false },
      { label: 'Hit the Airfield drop', x: 448, y: 2048, needCar: false },
      { label: 'Escape to the yacht at the Marina!', x: 2848, y: 1848, needCar: false },
    ],
  },
];

export const PALETTE = {
  backdrop: '#0b0e14', grass: '#3f7a44', grassDark: '#356b3a', park: '#2e6b34',
  sand: '#d9c08a', water: '#1d5f8a', waterDeep: '#14486b',
  road: '#2b2f36', roadLine: '#d8c95a', sidewalk: '#8a8f96', sidewalkDark: '#767b83',
  building: ['#7a5a8c', '#8c6a4a', '#4a6a8c', '#8c4a5a', '#5a7a5a', '#6a6a7a', '#9c7a3a', '#4a8c7a'],
  roof: ['#5d4370', '#6d5238', '#38536e', '#6e3846', '#466046', '#52525e'],
  text: '#f2f4f7', muted: '#aab2bd', panel: 'rgba(12,16,24,0.92)',
  gold: '#f2c94c', green: '#58d68d', red: '#e5534b', blue: '#4fc3f7',
  police: '#1c2733', policeWhite: '#e8ecf0',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const DISTRICTS = [
  { name: 'DOWNTOWN', x: 1200, y: 400, w: 800, h: 800 },
  { name: 'OLD TOWN', x: 0, y: 800, w: 800, h: 800 },
  { name: 'THE HILLS', x: 2000, y: 0, w: 1200, h: 800 },
  { name: 'MARINA', x: 2400, y: 1200, w: 800, h: 800 },
  { name: 'BEACHFRONT', x: 0, y: 2000, w: 3200, h: 400 },
];
