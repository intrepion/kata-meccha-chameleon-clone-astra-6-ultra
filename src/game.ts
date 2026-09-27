export type Pose = 'stand' | 'crouch' | 'flat';
export type Pattern = 'solid' | 'spots' | 'stripes';
export type Phase = 'ready' | 'hiding' | 'seeking' | 'won' | 'lost';
export type Role = 'hider' | 'seeker';

export const PALETTE = [
  { name: 'Matcha', color: '#83bda8' },
  { name: 'Rose', color: '#e899ac' },
  { name: 'Lavender', color: '#b4a6d4' },
  { name: 'Sand', color: '#dfcda8' },
  { name: 'Honey', color: '#d9ad75' },
  { name: 'Clay', color: '#d98869' },
  { name: 'Cream', color: '#f4efdf' },
  { name: 'Ink', color: '#454955' },
];

export const OBSTACLES = [
  { minX: -4.7, maxX: -1.3, minZ: -3.9, maxZ: -2.3 },
  { minX: 1.5, maxX: 4.8, minZ: -4.0, maxZ: -2.5 },
  { minX: -5.7, maxX: -4.7, minZ: -0.9, maxZ: 1.1 },
  { minX: 3.8, maxX: 4.9, minZ: 2.7, maxZ: 3.8 },
  { minX: 1.1, maxX: 2.1, minZ: -0.3, maxZ: 0.7 },
];

type Position = { x: number; z: number };
export type Character = Position & {
  angle: number;
  base: string;
  accent: string;
  pattern: Pattern;
  pose: Pose;
};
export type Target = Omit<Character, 'angle'> & { id: number; found: boolean };
type Hunter = Position & { angle: number };
type Surface = { name: string; color: string };
type Patrol = { route: number; path: Position[] };

const FLOOR: Surface = { name: 'Warm oak floor', color: '#dfcda8' };
const PROP_SURFACES: Surface[] = [
  { name: 'Rose sofa', color: '#e899ac' },
  { name: 'Honey desk', color: '#d9ad75' },
  { name: 'Matcha cabinet', color: '#83bda8' },
  { name: 'Clay planter', color: '#d98869' },
  { name: 'Lavender pedestal', color: '#b4a6d4' },
];
const ROUTE: Position[] = [
  { x: -5.5, z: -4.5 },
  { x: 0, z: -4.5 },
  { x: 5.5, z: -1.5 },
  { x: 5.5, z: 4.5 },
  { x: 0, z: 3.5 },
  { x: -4, z: 2 },
  { x: -4, z: -1.5 },
];
const TARGET_SPOTS: Position[] = [
  { x: -4, z: -1 },
  { x: -3.2, z: 1.5 },
  { x: -1, z: 3 },
  { x: 3.8, z: 0.2 },
  { x: 3.1, z: -1 },
  { x: 0.1, z: -3.3 },
  { x: 5.3, z: -1.6 },
  { x: -4.5, z: 3.5 },
  { x: 0.3, z: -0.8 },
  { x: 2.7, z: 3.5 },
  { x: -0.5, z: -1.3 },
  { x: 4.6, z: 1.9 },
];

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function walkable(x: number, z: number, radius = 0.3): boolean {
  return (
    x >= -6 + radius &&
    x <= 6 - radius &&
    z >= -5 + radius &&
    z <= 5 - radius &&
    !OBSTACLES.some(
      (o) =>
        x > o.minX - radius && x < o.maxX + radius && z > o.minZ - radius && z < o.maxZ + radius,
    )
  );
}

function surfaceAt(x: number, z: number): Surface {
  if (x >= -3.8 && x <= -0.2 && z >= 0.3 && z <= 3.6) {
    return { name: 'Matcha rug', color: '#83bda8' };
  }
  if (x >= 2.3 && x <= 5.3 && z >= -1.7 && z <= 1.4) {
    return { name: 'Lavender rug', color: '#b4a6d4' };
  }
  let nearest = -1;
  let distance = 0.85;
  OBSTACLES.forEach((o, index) => {
    const gap = Math.hypot(
      Math.max(o.minX - x, 0, x - o.maxX),
      Math.max(o.minZ - z, 0, z - o.maxZ),
    );
    if (gap < distance) {
      nearest = index;
      distance = gap;
    }
  });
  return nearest >= 0 ? PROP_SURFACES[nearest]! : FLOOR;
}

function colorDistance(a: string, b: string): number {
  const channels = (color: string) =>
    [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  const first = channels(a);
  const second = channels(b);
  return Math.hypot(...first.map((value, index) => value - second[index]!));
}

function hasLineOfSight(from: Position, to: Position): boolean {
  // Segment / rectangle intersection: furniture blocks sight even when very thin.
  return !OBSTACLES.some((o) => {
    let enter = 0;
    let leave = 1;
    for (const [origin, delta, low, high] of [
      [from.x, to.x - from.x, o.minX, o.maxX],
      [from.z, to.z - from.z, o.minZ, o.maxZ],
    ] as const) {
      if (Math.abs(delta) < 0.00001) {
        if (origin < low || origin > high) return false;
      } else {
        const a = (low - origin) / delta;
        const b = (high - origin) / delta;
        enter = Math.max(enter, Math.min(a, b));
        leave = Math.min(leave, Math.max(a, b));
        if (enter > leave) return false;
      }
    }
    return enter <= leave;
  });
}

// A small cardinal grid makes every patrol route respect the same room geometry.
const GRID_WIDTH = 23;
const GRID_DEPTH = 19;
function gridPosition(index: number): Position {
  return { x: -5.5 + (index % GRID_WIDTH) * 0.5, z: -4.5 + Math.floor(index / GRID_WIDTH) * 0.5 };
}
const GRID = Array.from({ length: GRID_WIDTH * GRID_DEPTH }, (_, index) => {
  const point = gridPosition(index);
  return walkable(point.x, point.z);
});

function findPath(from: Position, to: Position): Position[] {
  const nearest = (p: Position) => {
    let result = 0;
    let distance = Infinity;
    GRID.forEach((available, index) => {
      if (!available) return;
      const point = gridPosition(index);
      const gap = Math.hypot(point.x - p.x, point.z - p.z);
      if (gap < distance) {
        distance = gap;
        result = index;
      }
    });
    return result;
  };
  const start = nearest(from);
  const end = nearest(to);
  const queue = [start];
  const previous = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    if (current === end) break;
    const x = current % GRID_WIDTH;
    const z = Math.floor(current / GRID_WIDTH);
    const neighbors = [
      ...(x > 0 ? [current - 1] : []),
      ...(x < GRID_WIDTH - 1 ? [current + 1] : []),
      ...(z > 0 ? [current - GRID_WIDTH] : []),
      ...(z < GRID_DEPTH - 1 ? [current + GRID_WIDTH] : []),
    ];
    for (const next of neighbors) {
      if (GRID[next] && !previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(end)) return [];
  const path: Position[] = [];
  for (let cursor = end; cursor !== start; cursor = previous.get(cursor)!)
    path.push(gridPosition(cursor));
  return path.reverse();
}

export class Game {
  role: Role = 'hider';
  phase: Phase = 'ready';
  timeLeft = 25;
  elapsed = 0;
  round = 1;
  score = 0;
  player: Character = this.freshPlayer();
  hunters: Hunter[] = [];
  targets: Target[] = [];
  suspicion = 0;
  camouflage = 0;
  found = 0;
  misses = 0;
  lastEvent = 'Choose your colors. Find your hiding place.';
  private movingFor = 0;
  private patrols: Patrol[] = [];

  constructor(private readonly random: () => number = Math.random) {
    this.resetHunters();
    this.updateCamouflage();
  }

  get environment(): Surface {
    return surfaceAt(this.player.x, this.player.z);
  }

  start(role: Role): void {
    this.role = role;
    this.phase = role === 'hider' ? 'hiding' : 'seeking';
    this.timeLeft = role === 'hider' ? 25 : 60;
    this.elapsed = 0;
    this.score = 0;
    this.suspicion = 0;
    this.found = 0;
    this.misses = 0;
    this.movingFor = 0;
    this.player = this.freshPlayer();
    this.resetHunters();
    this.targets = role === 'seeker' ? this.createTargets() : [];
    this.lastEvent =
      role === 'hider'
        ? 'You have 25 seconds to blend in.'
        : 'Find all 5 hidden chameleons. You have 5 guesses to spare.';
    this.updateCamouflage();
  }

  restart(): void {
    this.round += 1;
    this.start(this.role);
  }

  tick(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Fixed-size simulation steps also preserve phase changes across a long frame.
    let remaining = Math.min(dt, 120);
    while (remaining > 0.000001 && (this.phase === 'hiding' || this.phase === 'seeking')) {
      const step = Math.min(remaining, 0.1, this.timeLeft);
      this.elapsed += step;
      this.timeLeft = Math.max(0, this.timeLeft - step);
      this.updateCamouflage();
      if (this.phase === 'seeking' && this.role === 'hider') {
        this.moveHunters(step);
        this.detectPlayer(step);
      }
      this.movingFor = Math.max(0, this.movingFor - step);
      remaining -= step;
      if (this.timeLeft < 0.000001 && this.phase === 'hiding') this.beginSeeking();
      else if (this.timeLeft < 0.000001 && this.phase === 'seeking') {
        this.timeLeft = 0;
        if (this.role === 'hider') {
          this.phase = 'won';
          this.score = 500 + Math.round(this.camouflage * 2);
          this.lastEvent = 'Perfectly ordinary furniture. You stayed hidden!';
        } else {
          this.phase = 'lost';
          this.lastEvent = `Time is up! You found ${this.found} of 5 chameleons.`;
        }
      }
    }
  }

  move(dx: number, dz: number, dt: number): void {
    if (
      (this.phase !== 'hiding' && this.phase !== 'seeking') ||
      ![dx, dz, dt].every(Number.isFinite) ||
      dt <= 0
    )
      return;
    const length = Math.hypot(dx, dz);
    if (length < 0.0001) return;
    const speed = { stand: 2.7, crouch: 1.65, flat: 0.95 }[this.player.pose];
    const distance = speed * Math.min(dt, 10);
    const x = (dx / Math.max(1, length)) * distance;
    const z = (dz / Math.max(1, length)) * distance;
    const steps = Math.max(1, Math.ceil(Math.hypot(x, z) / 0.12));
    let moved = false;
    for (let i = 0; i < steps; i++) {
      const nx = clamp(this.player.x + x / steps, -5.7, 5.7);
      if (walkable(nx, this.player.z)) {
        moved ||= nx !== this.player.x;
        this.player.x = nx;
      }
      const nz = clamp(this.player.z + z / steps, -4.7, 4.7);
      if (walkable(this.player.x, nz)) {
        moved ||= nz !== this.player.z;
        this.player.z = nz;
      }
    }
    this.player.angle = Math.atan2(dx, dz);
    if (moved) this.movingFor = 0.22;
    this.updateCamouflage();
  }

  paint(base: string, accent: string, pattern: Pattern): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    if (!/^#[\da-f]{6}$/i.test(base) || !/^#[\da-f]{6}$/i.test(accent)) return;
    if (!['solid', 'spots', 'stripes'].includes(pattern)) return;
    this.player.base = base;
    this.player.accent = accent;
    this.player.pattern = pattern;
    this.updateCamouflage();
  }

  setPose(pose: Pose): void {
    if (
      this.phase === 'won' ||
      this.phase === 'lost' ||
      !['stand', 'crouch', 'flat'].includes(pose)
    )
      return;
    this.player.pose = pose;
  }

  sample(): string {
    return this.environment.color;
  }

  beginSeeking(): void {
    if (this.phase !== 'hiding' || this.role !== 'hider') return;
    this.phase = 'seeking';
    this.timeLeft = 45;
    this.lastEvent = 'The seekers are here. Stay still and stay small.';
  }

  tag(id: number | null): boolean {
    if (this.role !== 'seeker' || this.phase !== 'seeking') return false;
    const target = this.targets.find((candidate) => candidate.id === id);
    if (target?.found) return false;
    if (!target) {
      this.misses += 1;
      this.lastEvent = `Just furniture! ${5 - this.misses} guesses remaining.`;
      if (this.misses >= 5) {
        this.phase = 'lost';
        this.lastEvent = 'Out of guesses. Those chameleons are sneaky!';
      }
      return false;
    }
    target.found = true;
    this.found += 1;
    this.score += 100;
    this.lastEvent = `Found one! ${this.found} of 5 chameleons spotted.`;
    if (this.found === 5) {
      this.phase = 'won';
      this.score += 250 + Math.ceil(this.timeLeft) * 5;
      this.lastEvent = 'Sharp eyes! You found every chameleon.';
    }
    return true;
  }

  private freshPlayer(): Character {
    return {
      x: -2,
      z: 1.8,
      angle: Math.PI / 4,
      base: '#83bda8',
      accent: '#f4efdf',
      pattern: 'solid',
      pose: 'stand',
    };
  }

  private updateCamouflage(): void {
    const weight = { solid: 0, spots: 0.22, stripes: 0.34 }[this.player.pattern];
    const distance =
      colorDistance(this.player.base, this.environment.color) * (1 - weight) +
      colorDistance(this.player.accent, this.environment.color) * weight;
    this.camouflage = Math.round(clamp(1 - distance / 170, 0, 1) * 100);
  }

  private resetHunters(): void {
    this.hunters = [0, 3].map((index) => ({
      ...ROUTE[index]!,
      angle: index === 0 ? Math.PI / 2 : -Math.PI / 2,
    }));
    this.patrols = [1, 4].map((route, index) => ({
      route,
      path: findPath(this.hunters[index]!, ROUTE[route]!),
    }));
  }

  private moveHunters(dt: number): void {
    this.hunters.forEach((hunter, index) => {
      const patrol = this.patrols[index]!;
      let travel = 1.35 * dt;
      while (travel > 0) {
        if (patrol.path.length === 0) {
          patrol.route = (patrol.route + 1) % ROUTE.length;
          patrol.path = findPath(hunter, ROUTE[patrol.route]!);
          if (patrol.path.length === 0) break;
        }
        const destination = patrol.path[0]!;
        const dx = destination.x - hunter.x;
        const dz = destination.z - hunter.z;
        const distance = Math.hypot(dx, dz);
        hunter.angle = Math.atan2(dx, dz);
        if (distance <= travel) {
          hunter.x = destination.x;
          hunter.z = destination.z;
          patrol.path.shift();
          travel -= distance;
        } else {
          hunter.x += (dx / distance) * travel;
          hunter.z += (dz / distance) * travel;
          travel = 0;
        }
      }
    });
  }

  private detectPlayer(dt: number): void {
    const poseExposure = { stand: 0.34, crouch: 0.12, flat: 0.02 }[this.player.pose];
    const exposure =
      poseExposure + (1 - this.camouflage / 100) * 0.75 + (this.movingFor > 0 ? 0.45 : 0);
    let strongest = 0;
    for (const hunter of this.hunters) {
      const dx = this.player.x - hunter.x;
      const dz = this.player.z - hunter.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 5.4 || !hasLineOfSight(hunter, this.player)) continue;
      const facing =
        (Math.sin(hunter.angle) * dx + Math.cos(hunter.angle) * dz) / Math.max(distance, 0.001);
      if (distance > 1.4 && facing < Math.cos((Math.PI * 80) / 180)) continue;
      const proximity = clamp(1 - distance / 7, 0.23, 1);
      strongest = Math.max(strongest, Math.max(0, exposure - 0.14) * 40 * proximity);
    }
    this.suspicion = clamp(this.suspicion + (strongest > 0 ? strongest : -3) * dt, 0, 100);
    if (this.suspicion >= 100) {
      this.phase = 'lost';
      this.lastEvent = 'Spotted! Match your surroundings, get low, and stay still.';
    }
  }

  private createTargets(): Target[] {
    const points = TARGET_SPOTS.map((point) => ({ ...point }));
    const random = () => clamp(this.random(), 0, 0.999999);
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [points[i], points[j]] = [points[j]!, points[i]!];
    }
    return points.slice(0, 5).map((point, index) => {
      const x = point.x + (random() - 0.5) * 0.35;
      const z = point.z + (random() - 0.5) * 0.35;
      const position = walkable(x, z) ? { x, z } : point;
      const surface = surfaceAt(position.x, position.z);
      return {
        id: index + 1,
        ...position,
        base: surface.color,
        accent: index % 2 === 0 ? '#f4efdf' : surface.color,
        pattern: (['solid', 'spots', 'stripes'] as const)[index % 3]!,
        pose: (['crouch', 'flat', 'stand'] as const)[index % 3]!,
        found: false,
      };
    });
  }
}
