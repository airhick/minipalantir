import { Body, Equator, GeoVector, Observer } from 'astronomy-engine';

// ── Scientific constants (hardcoded — no API) ─────────────────────────────────
export interface PlanetData {
  name: string;
  radius_km: number;
  mass_kg: number;
  distance_from_sun_au: number;
  orbital_speed_kmps: number;
  orbit_period_days: number;
  rotation_hours: number;   // negative = retrograde
  surface_gravity_mps2: number;
  moons: number;
  avg_temp_c: number;
  atmosphere: string;
  description: string;
}

export const PLANET_CONSTANTS: Record<string, PlanetData> = {
  MERCURY: {
    name: 'Mercury',
    radius_km: 2_439.7, mass_kg: 3.301e23,
    distance_from_sun_au: 0.387, orbital_speed_kmps: 47.87,
    orbit_period_days: 87.97, rotation_hours: 1_407.6,
    surface_gravity_mps2: 3.7, moons: 0, avg_temp_c: 167,
    atmosphere: 'Virtually none (exosphere)',
    description: 'Smallest planet; extreme temperature swings (−170 to +430°C).',
  },
  VENUS: {
    name: 'Venus',
    radius_km: 6_051.8, mass_kg: 4.867e24,
    distance_from_sun_au: 0.723, orbital_speed_kmps: 35.02,
    orbit_period_days: 224.70, rotation_hours: -5_832.5,
    surface_gravity_mps2: 8.87, moons: 0, avg_temp_c: 464,
    atmosphere: 'CO₂ 96.5%, N₂ 3.5%',
    description: 'Hottest planet; thick toxic atmosphere; retrograde rotation.',
  },
  MARS: {
    name: 'Mars',
    radius_km: 3_389.5, mass_kg: 6.417e23,
    distance_from_sun_au: 1.524, orbital_speed_kmps: 24.07,
    orbit_period_days: 686.97, rotation_hours: 24.62,
    surface_gravity_mps2: 3.72, moons: 2, avg_temp_c: -63,
    atmosphere: 'CO₂ 95%, N₂ 2.6%, Ar 1.9%',
    description: 'Red Planet; Olympus Mons — solar system\'s highest volcano.',
  },
  JUPITER: {
    name: 'Jupiter',
    radius_km: 71_492, mass_kg: 1.898e27,
    distance_from_sun_au: 5.204, orbital_speed_kmps: 13.07,
    orbit_period_days: 4_332.59, rotation_hours: 9.93,
    surface_gravity_mps2: 24.79, moons: 95, avg_temp_c: -108,
    atmosphere: 'H₂ 89%, He 10%',
    description: 'Largest planet; Great Red Spot storm active for 350+ years.',
  },
  SATURN: {
    name: 'Saturn',
    radius_km: 58_232, mass_kg: 5.683e26,
    distance_from_sun_au: 9.537, orbital_speed_kmps: 9.69,
    orbit_period_days: 10_759.22, rotation_hours: 10.66,
    surface_gravity_mps2: 10.44, moons: 146, avg_temp_c: -178,
    atmosphere: 'H₂ 96.3%, He 3.25%',
    description: 'Spectacular ring system; least dense planet (density < water).',
  },
  URANUS: {
    name: 'Uranus',
    radius_km: 25_362, mass_kg: 8.681e25,
    distance_from_sun_au: 19.201, orbital_speed_kmps: 6.80,
    orbit_period_days: 30_688.5, rotation_hours: -17.24,
    surface_gravity_mps2: 8.87, moons: 28, avg_temp_c: -213,
    atmosphere: 'H₂ 83%, He 15%, CH₄ 2.3%',
    description: 'Ice giant; rotates on its side (axial tilt 97.8°).',
  },
  NEPTUNE: {
    name: 'Neptune',
    radius_km: 24_622, mass_kg: 1.024e26,
    distance_from_sun_au: 30.07, orbital_speed_kmps: 5.43,
    orbit_period_days: 60_182, rotation_hours: 16.11,
    surface_gravity_mps2: 11.15, moons: 16, avg_temp_c: -218,
    atmosphere: 'H₂ 80%, He 19%, CH₄ 1.5%',
    description: 'Windiest planet; winds up to 2,100 km/h.',
  },
};

export interface PlanetInfo {
  name: string;                       // 'MERCURY', 'VENUS', …
  lon: number;
  lat: number;
  altitude: number;
  distanceFromEarth_au: number;       // live from astronomy-engine GeoVector
  data: PlanetData;
}

// ── Canvas planet drawing ─────────────────────────────────────────────────────
const _iconCache = new Map<string, HTMLCanvasElement>();

export function getPlanetCanvas(name: string): HTMLCanvasElement {
  if (_iconCache.has(name)) return _iconCache.get(name)!;
  const canvas = _drawPlanet(name);
  _iconCache.set(name, canvas);
  return canvas;
}

function _circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
}

function _shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  const sh = ctx.createRadialGradient(cx + R * 0.45, cy, 0, cx, cy, R);
  sh.addColorStop(0.65, 'transparent'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = sh; _circle(ctx, cx, cy, R); ctx.fill();
}

function _glow(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, col: string) {
  const g = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.6);
  g.addColorStop(0, col); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
}

function _drawPlanet(name: string): HTMLCanvasElement {
  switch (name) {
    case 'MERCURY': return _mercury();
    case 'VENUS': return _venus();
    case 'MARS': return _mars();
    case 'JUPITER': return _jupiter();
    case 'SATURN': return _saturn();
    case 'URANUS': return _uranus();
    case 'NEPTUNE': return _neptune();
    default: {
      const c = document.createElement('canvas');
      c.width = c.height = 60;
      return c;
    }
  }
}

function _mercury(): HTMLCanvasElement {
  const R = 36, S = (R + 6) * 2, cx = S / 2, cy = S / 2;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  _glow(ctx, cx, cy, R, 'rgba(180,180,180,0.3)');
  const g = ctx.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R);
  g.addColorStop(0, '#d4d4d4'); g.addColorStop(0.55, '#9e9e9e'); g.addColorStop(1, '#5c5c5c');
  ctx.fillStyle = g; _circle(ctx, cx, cy, R); ctx.fill();
  // craters
  ctx.save(); _circle(ctx, cx, cy, R); ctx.clip();
  [[-.4, -.3, 7], [.3, .45, 5], [-.15, .5, 4], [.5, -.2, 6], [-.55, .15, 4]].forEach(([fx, fy, fr]) => {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; _circle(ctx, cx + (fx as number) * R, cy + (fy as number) * R, fr as number); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; _circle(ctx, cx + (fx as number) * R - 1, cy + (fy as number) * R - 1, (fr as number) * 0.5); ctx.fill();
  });
  ctx.restore(); _shadow(ctx, cx, cy, R); return c;
}

function _venus(): HTMLCanvasElement {
  const R = 52, S = (R + 6) * 2, cx = S / 2, cy = S / 2;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  _glow(ctx, cx, cy, R, 'rgba(245,230,160,0.35)');
  const g = ctx.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R);
  g.addColorStop(0, '#fefbe4'); g.addColorStop(0.5, '#f0d878'); g.addColorStop(1, '#b89030');
  ctx.fillStyle = g; _circle(ctx, cx, cy, R); ctx.fill();
  // cloud bands
  ctx.save(); _circle(ctx, cx, cy, R); ctx.clip();
  for (let i = -4; i <= 4; i++) {
    ctx.fillStyle = `rgba(255,250,210,${0.1 + Math.abs(i) * 0.015})`;
    ctx.fillRect(cx - R, cy + i * 11 - 4, R * 2, 7);
  }
  ctx.restore(); _shadow(ctx, cx, cy, R); return c;
}

function _mars(): HTMLCanvasElement {
  const R = 42, S = (R + 6) * 2, cx = S / 2, cy = S / 2;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  _glow(ctx, cx, cy, R, 'rgba(200,80,50,0.35)');
  const g = ctx.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R);
  g.addColorStop(0, '#e87055'); g.addColorStop(0.5, '#c1440e'); g.addColorStop(1, '#7a2800');
  ctx.fillStyle = g; _circle(ctx, cx, cy, R); ctx.fill();
  // terrain
  ctx.save(); _circle(ctx, cx, cy, R); ctx.clip();
  ctx.fillStyle = 'rgba(180,100,50,0.3)'; _circle(ctx, cx - R * .2, cy + R * .3, R * .4); ctx.fill();
  ctx.fillStyle = 'rgba(120,60,20,0.25)'; _circle(ctx, cx + R * .3, cy - R * .1, R * .3); ctx.fill();
  // polar ice cap
  ctx.fillStyle = 'rgba(255,250,250,0.82)';
  ctx.beginPath(); ctx.ellipse(cx, cy - R * .88, R * .38, R * .16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); _shadow(ctx, cx, cy, R); return c;
}

function _jupiter(): HTMLCanvasElement {
  const R = 80, S = (R + 6) * 2, cx = S / 2, cy = S / 2;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  _glow(ctx, cx, cy, R, 'rgba(210,180,130,0.3)');
  const base = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  base.addColorStop(0, '#e8d5b0'); base.addColorStop(.18, '#c4956a'); base.addColorStop(.33, '#e8cfa0');
  base.addColorStop(.50, '#b8834a'); base.addColorStop(.65, '#e8c880'); base.addColorStop(.82, '#c49860'); base.addColorStop(1, '#d4b875');
  ctx.fillStyle = base; _circle(ctx, cx, cy, R); ctx.fill();
  ctx.save(); _circle(ctx, cx, cy, R); ctx.clip();
  // Bands
  const bands: [number, number, string][] = [
    [-.72, 7, 'rgba(160,100,50,0.5)'], [-.52, 5, 'rgba(190,130,70,0.45)'], [-.28, 9, 'rgba(140,85,40,0.5)'],
    [-.05, 7, 'rgba(180,115,55,0.45)'], [.18, 6, 'rgba(155,95,45,0.5)'], [.40, 8, 'rgba(195,140,75,0.4)'],
    [.62, 5, 'rgba(150,90,40,0.45)'], [.78, 6, 'rgba(175,120,60,0.4)'],
  ];
  bands.forEach(([yf, h, col]) => { ctx.fillStyle = col; ctx.fillRect(cx - R, cy + yf * R - h / 2, R * 2, h); });
  // GRS
  ctx.fillStyle = 'rgba(185,55,35,0.75)';
  ctx.beginPath(); ctx.ellipse(cx + R * .28, cy + R * .12, R * .2, R * .1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(215,90,60,0.5)';
  ctx.beginPath(); ctx.ellipse(cx + R * .28, cy + R * .12, R * .15, R * .07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); _shadow(ctx, cx, cy, R); return c;
}

function _saturn(): HTMLCanvasElement {
  const R = 60, W = 320, H = 200, cx = W / 2, cy = H / 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  _glow(ctx, cx, cy, R, 'rgba(210,190,120,0.3)');

  const drawRings = (alpha: number, frontHalf = false) => {
    if (frontHalf) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cy); ctx.clip(); }
    const rings: [number, number, string][] = [
      [R * 1.2, R * 1.45, `rgba(195,175,130,${alpha})`], [R * 1.46, R * 1.65, `rgba(165,145,105,${alpha})`],
      [R * 1.66, R * 1.92, `rgba(215,195,155,${alpha})`], [R * 1.93, R * 2.12, `rgba(180,160,120,${alpha})`],
      [R * 2.13, R * 2.4, `rgba(145,125,90,${alpha})`],
    ];
    rings.forEach(([ri, ro, col]) => {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, ro, ro * .3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy, ri, ri * .3, 0, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill('evenodd'); ctx.restore();
    });
    if (frontHalf) ctx.restore();
  };

  drawRings(0.7); // back rings
  // Planet body
  const g = ctx.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R);
  g.addColorStop(0, '#faf0c0'); g.addColorStop(.5, '#d4b858'); g.addColorStop(1, '#8a6818');
  ctx.fillStyle = g; _circle(ctx, cx, cy, R); ctx.fill();
  ctx.save(); _circle(ctx, cx, cy, R); ctx.clip();
  [[-.5, 9, 'rgba(185,155,70,0.4)'], [0, 11, 'rgba(170,140,60,0.35)'], [.45, 7, 'rgba(190,160,80,0.4)']].forEach(([yf, h, col]) => {
    ctx.fillStyle = col as string; ctx.fillRect(cx - R, cy + (yf as number) * R - (h as number) / 2, R * 2, h as number);
  });
  ctx.restore();
  _shadow(ctx, cx, cy, R);
  drawRings(0.9, true); // front rings
  return c;
}

function _uranus(): HTMLCanvasElement {
  const R = 50, S = (R + 6) * 2, cx = S / 2, cy = S / 2;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  _glow(ctx, cx, cy, R, 'rgba(127,255,212,0.3)');
  const g = ctx.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R);
  g.addColorStop(0, '#c0f5e8'); g.addColorStop(0.5, '#7fffd4'); g.addColorStop(1, '#3a8a78');
  ctx.fillStyle = g; _circle(ctx, cx, cy, R); ctx.fill();
  // subtle banding
  ctx.save(); _circle(ctx, cx, cy, R); ctx.clip();
  for (let i = -3; i <= 3; i++) {
    ctx.fillStyle = `rgba(100,220,200,${0.07 + Math.abs(i) * 0.01})`;
    ctx.fillRect(cx - R, cy + i * 14 - 4, R * 2, 6);
  }
  ctx.restore(); _shadow(ctx, cx, cy, R); return c;
}

function _neptune(): HTMLCanvasElement {
  const R = 48, S = (R + 6) * 2, cx = S / 2, cy = S / 2;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  _glow(ctx, cx, cy, R, 'rgba(30,90,200,0.35)');
  const g = ctx.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R);
  g.addColorStop(0, '#5090e0'); g.addColorStop(0.5, '#1e5ba8'); g.addColorStop(1, '#0a2556');
  ctx.fillStyle = g; _circle(ctx, cx, cy, R); ctx.fill();
  ctx.save(); _circle(ctx, cx, cy, R); ctx.clip();
  // Dark spot (storm)
  ctx.fillStyle = 'rgba(10,20,70,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - R * .25, cy + R * .15, R * .22, R * .13, -0.3, 0, Math.PI * 2); ctx.fill();
  // light bands
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = `rgba(80,140,220,0.12)`;
    ctx.fillRect(cx - R, cy + i * 16 - 4, R * 2, 6);
  }
  ctx.restore(); _shadow(ctx, cx, cy, R); return c;
}

// ── Position + distance computation ──────────────────────────────────────────
const PLANET_BODIES: Array<{ body: Body; key: string }> = [
  { body: Body.Mercury, key: 'MERCURY' },
  { body: Body.Venus, key: 'VENUS' },
  { body: Body.Mars, key: 'MARS' },
  { body: Body.Jupiter, key: 'JUPITER' },
  { body: Body.Saturn, key: 'SATURN' },
  { body: Body.Uranus, key: 'URANUS' },
  { body: Body.Neptune, key: 'NEPTUNE' },
];

// Display altitude: planets orbit as decorative elements around Earth's visualization space
const DISPLAY_ALTITUDE = 55_000_000;
const GEOCENTRIC_OBSERVER = new Observer(0, 0, 0);

function gmstDegrees(): number {
  const JD = Date.now() / 86_400_000 + 2_440_587.5;
  const gmst = 280.46061837 + 360.98564736629 * (JD - 2_451_545.0);
  return ((gmst % 360) + 360) % 360;
}

export function getPlanetPositions(): PlanetInfo[] {
  const date = new Date();
  const gmst = gmstDegrees();

  return PLANET_BODIES.map(({ body, key }) => {
    const eq = Equator(body, date, GEOCENTRIC_OBSERVER, true, true);
    const raDeg = eq.ra * 15;
    let lon = raDeg - gmst;
    lon = ((lon + 540) % 360) - 180;

    // Live distance from Earth via geocentric vector
    let dist_au = PLANET_CONSTANTS[key].distance_from_sun_au;
    try {
      const vec = GeoVector(body, date, false);
      dist_au = Math.sqrt(vec.x ** 2 + vec.y ** 2 + vec.z ** 2);
    } catch { /* use constant fallback */ }

    return {
      name: key,
      lon,
      lat: eq.dec,
      altitude: DISPLAY_ALTITUDE,
      distanceFromEarth_au: dist_au,
      data: PLANET_CONSTANTS[key],
    };
  });
}
