import { BOUNDS, HIDE_SPOTS, OBSTACLES, PATROL_POINTS, SPAWN, ZONES } from './map';

export { BOUNDS, OBSTACLES } from './map';
export type Pose = 'stand' | 'crouch' | 'flat';
export type Pattern = 'solid' | 'spots' | 'stripes';
export type Phase = 'ready' | 'hiding' | 'seeking' | 'won' | 'lost';
export type Role = 'hider' | 'seeker';
export const TARGET_COUNT = 8;
export const MAX_MISSES = 8;
export const PREP_SECONDS = 60;
export const HIDE_SECONDS = 120;
export const SEEK_SECONDS = 180;
export const TAG_RANGE = 14;
export const SEEKER_EYE_HEIGHT = 1.57;
export const EYE_HEIGHTS: Record<Pose, number> = { stand: 1.57, crouch: 0.99, flat: 0.48 };
export const HUNTER_VIEW_DISTANCE = 18;
export const HUNTER_HALF_ANGLE = (Math.PI * 65) / 180;
export const PLAYER_RADIUS = 0.3;

export const PALETTE = [
  { name: 'White', color: '#ffffff' },
  { name: 'Matcha', color: '#83bda8' },
  { name: 'Rose', color: '#e899ac' },
  { name: 'Lavender', color: '#b4a6d4' },
  { name: 'Sand', color: '#dfcda8' },
  { name: 'Honey', color: '#d9ad75' },
  { name: 'Clay', color: '#d98869' },
  { name: 'Ink', color: '#454955' },
];

type Position = { x: number; z: number };
export type Point3 = Position & { y: number };
export type Character = Point3 & {
  angle: number;
  base: string;
  accent: string;
  pattern: Pattern;
  pose: Pose;
};
export type Target = Character & { id: number; found: boolean };
type Hunter = Position & { angle: number };
type Surface = { name: string; color: string };
type Patrol = {
  route: number;
  path: Position[];
  scan: number;
  memory: number;
  repath: number;
  lastSeen: Position | null;
};
const GRAVITY = 16;
const JUMP_VELOCITY = 5.7;
const POSE_SCALES: Record<Pose, { height: number; width: number }> = {
  stand: { height: 1, width: 1 },
  crouch: { height: 0.55, width: 1.13 },
  flat: { height: 0.19, width: 1.48 },
};
const HEIGHTS: Record<Pose, number> = { stand: 1.72, crouch: 1.72 * 0.55, flat: 1.72 * 0.19 };
const FLOOR: Surface = { name: 'Studio floor', color: '#dfcda8' };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function overlaps(x: number, z: number, box: (typeof OBSTACLES)[number], radius: number): boolean {
  return (
    x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius
  );
}

/** Whether a player's feet can occupy this position without intersecting a solid. */
export function walkable(x: number, z: number, radius = PLAYER_RADIUS, y = 0): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Number.isFinite(y) &&
    x >= BOUNDS.minX + radius &&
    x <= BOUNDS.maxX - radius &&
    z >= BOUNDS.minZ + radius &&
    z <= BOUNDS.maxZ - radius &&
    !OBSTACLES.some((box) => box.height > y + 0.001 && overlaps(x, z, box, radius))
  );
}

/** Segment against solid 3D boxes: low props can conceal a flattened character. */
export function lineOfSight(from: Point3, to: Point3): boolean {
  return !OBSTACLES.some((box) => {
    let enter = 0;
    let leave = 1;
    for (const [origin, delta, low, high] of [
      [from.x, to.x - from.x, box.minX, box.maxX],
      [from.y, to.y - from.y, 0, box.height],
      [from.z, to.z - from.z, box.minZ, box.maxZ],
    ] as const) {
      if (Math.abs(delta) < 0.000001) {
        if (origin < low || origin > high) return false;
      } else {
        const a = (low - origin) / delta;
        const b = (high - origin) / delta;
        enter = Math.max(enter, Math.min(a, b));
        leave = Math.min(leave, Math.max(a, b));
        if (enter > leave) return false;
      }
    }
    return enter < 0.9999 && leave > 0.0001;
  });
}

function surfaceAt(x: number, z: number, y = 0): Surface {
  let nearest: (typeof OBSTACLES)[number] | undefined;
  let distance = 1.15;
  for (const box of OBSTACLES) {
    const horizontal = Math.hypot(
      Math.max(box.minX - x, 0, x - box.maxX),
      Math.max(box.minZ - z, 0, z - box.maxZ),
    );
    const gap = Math.hypot(horizontal, Math.max(0, y - box.height));
    if (gap < distance) {
      nearest = box;
      distance = gap;
    }
  }
  if (nearest) return { name: nearest.name, color: nearest.color };
  const zone = ZONES.find(
    (zone) => x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ,
  );
  return zone ? { name: zone.name, color: zone.color } : FLOOR;
}

function colorDistance(a: string, b: string): number {
  const channels = (color: string) =>
    [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  const first = channels(a);
  const second = channels(b);
  return Math.hypot(...first.map((value, index) => value - second[index]!));
}

function visibleBodyPoints(character: Character): Point3[] {
  const { height, width } = POSE_SCALES[character.pose];
  const cosine = Math.cos(character.angle);
  const sine = Math.sin(character.angle);
  return [
    [0, 0.78 * height, 0],
    [0, 1.51 * height, 0],
    [0, 1.7 * height, 0],
    [-0.052 * width, 1.55 * height, 0.149 * width],
    [0.052 * width, 1.55 * height, 0.149 * width],
    [-0.27 * width, 1.05 * height, 0],
    [0.27 * width, 1.05 * height, 0],
  ].map(([x, y, z]) => ({
    x: character.x + x! * cosine + z! * sine,
    y: character.y + y!,
    z: character.z - x! * sine + z! * cosine,
  }));
}

// Every grid edge is validated as well as its endpoints, including narrow wall pieces.
const GRID_STEP = 0.5;
const GRID_WIDTH = Math.floor((BOUNDS.maxX - BOUNDS.minX - 1) / GRID_STEP) + 1;
const GRID_DEPTH = Math.floor((BOUNDS.maxZ - BOUNDS.minZ - 1) / GRID_STEP) + 1;
function gridPosition(index: number): Position {
  return {
    x: BOUNDS.minX + 0.5 + (index % GRID_WIDTH) * GRID_STEP,
    z: BOUNDS.minZ + 0.5 + Math.floor(index / GRID_WIDTH) * GRID_STEP,
  };
}
const GRID = Array.from({ length: GRID_WIDTH * GRID_DEPTH }, (_, index) => {
  const point = gridPosition(index);
  return walkable(point.x, point.z);
});
const EDGES: number[][] = GRID.map((available, index) => {
  if (!available) return [];
  const x = index % GRID_WIDTH;
  const z = Math.floor(index / GRID_WIDTH);
  const point = gridPosition(index);
  return [
    ...(x > 0 ? [index - 1] : []),
    ...(x < GRID_WIDTH - 1 ? [index + 1] : []),
    ...(z > 0 ? [index - GRID_WIDTH] : []),
    ...(z < GRID_DEPTH - 1 ? [index + GRID_WIDTH] : []),
  ].filter((next) => {
    if (!GRID[next]) return false;
    const destination = gridPosition(next);
    return walkable((point.x + destination.x) / 2, (point.z + destination.z) / 2);
  });
});
function nearestGrid(point: Position): number {
  let result = 0;
  let distance = Infinity;
  for (let index = 0; index < GRID.length; index++) {
    if (!GRID[index]) continue;
    const candidate = gridPosition(index);
    const gap = Math.hypot(candidate.x - point.x, candidate.z - point.z);
    if (gap < distance) {
      distance = gap;
      result = index;
    }
  }
  return result;
}

/** Ground navigation shared by patrols and tests; routes cross actual open doorways. */
export function navigationPath(from: Position, to: Position): Position[] {
  const start = nearestGrid(from);
  const end = nearestGrid(to);
  const queue = [start];
  const previous = new Int32Array(GRID.length).fill(-2);
  previous[start] = -1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    if (current === end) break;
    for (const next of EDGES[current]!) {
      if (previous[next] === -2) {
        previous[next] = current;
        queue.push(next);
      }
    }
  }
  if (previous[end] === -2) return [];
  const path: Position[] = [];
  for (let cursor = end; cursor !== -1; cursor = previous[cursor]!) path.push(gridPosition(cursor));
  path.reverse();
  if (path.length && Math.hypot(path[0]!.x - from.x, path[0]!.z - from.z) < 0.00001) path.shift();
  return path;
}

export class Game {
  role: Role = 'hider';
  phase: Phase = 'ready';
  timeLeft = PREP_SECONDS;
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
  lastEvent = 'Explore the studio, find cover, and borrow its color.';
  private movingFor = 0;
  private verticalVelocity = 0;
  private patrols: Patrol[] = [];

  constructor(private readonly random: () => number = Math.random) {
    this.resetHunters();
    this.updateCamouflage();
  }

  get environment(): Surface {
    return surfaceAt(this.player.x, this.player.z, this.player.y);
  }
  get zoneName(): string {
    return (
      ZONES.find(
        (zone) =>
          this.player.x >= zone.minX &&
          this.player.x <= zone.maxX &&
          this.player.z >= zone.minZ &&
          this.player.z <= zone.maxZ,
      )?.name ?? 'Connecting hallway'
    );
  }

  start(role: Role): void {
    this.role = role;
    this.phase = role === 'hider' ? 'hiding' : 'seeking';
    this.timeLeft = role === 'hider' ? PREP_SECONDS : SEEK_SECONDS;
    this.elapsed = 0;
    this.score = 0;
    this.suspicion = 0;
    this.found = 0;
    this.misses = 0;
    this.movingFor = 0;
    this.verticalVelocity = 0;
    this.player = this.freshPlayer();
    this.resetHunters();
    this.targets = role === 'seeker' ? this.createTargets() : [];
    this.lastEvent =
      role === 'hider'
        ? '60 seconds to find cover. White stands out: sample a nearby surface.'
        : 'Explore all six rooms. Find 8 chameleons in 3 minutes.';
    this.updateCamouflage();
  }

  restart(): void {
    this.round += 1;
    this.start(this.role);
  }

  tick(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, PREP_SECONDS + HIDE_SECONDS + SEEK_SECONDS);
    while (remaining > 0.000001 && this.active()) {
      const step = Math.min(remaining, 1 / 30, this.timeLeft);
      this.elapsed += step;
      this.timeLeft = Math.max(0, this.timeLeft - step);
      this.updateVertical(step);
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
          this.score = 800 + Math.round(this.camouflage * 3);
          this.lastEvent = 'The search is over. Your hiding place held up!';
        } else {
          this.phase = 'lost';
          this.lastEvent = `Time is up! You found ${this.found} of ${TARGET_COUNT} chameleons.`;
        }
      }
    }
  }

  move(dx: number, dz: number, dt: number): void {
    if (!this.active() || ![dx, dz, dt].every(Number.isFinite) || dt <= 0) return;
    const length = Math.hypot(dx, dz);
    if (length < 0.0001) return;
    const speed =
      this.role === 'seeker' ? 4.2 : { stand: 4.2, crouch: 2.55, flat: 1.35 }[this.player.pose];
    const distance = speed * Math.min(dt, 30);
    const x = (dx / Math.max(1, length)) * distance;
    const z = (dz / Math.max(1, length)) * distance;
    const steps = Math.max(1, Math.ceil(Math.hypot(x, z) / 0.1));
    let moved = false;
    for (let i = 0; i < steps; i++) {
      const nx = clamp(
        this.player.x + x / steps,
        BOUNDS.minX + PLAYER_RADIUS,
        BOUNDS.maxX - PLAYER_RADIUS,
      );
      if (walkable(nx, this.player.z, PLAYER_RADIUS, this.player.y)) {
        moved ||= nx !== this.player.x;
        this.player.x = nx;
      }
      const nz = clamp(
        this.player.z + z / steps,
        BOUNDS.minZ + PLAYER_RADIUS,
        BOUNDS.maxZ - PLAYER_RADIUS,
      );
      if (walkable(this.player.x, nz, PLAYER_RADIUS, this.player.y)) {
        moved ||= nz !== this.player.z;
        this.player.z = nz;
      }
    }
    this.player.angle = Math.atan2(dx, dz);
    if (moved) this.movingFor = 0.2;
    this.updateCamouflage();
  }

  jump(): void {
    if (
      !this.active() ||
      Math.abs(this.verticalVelocity) > 0.001 ||
      Math.abs(this.player.y - this.supportHeight()) > 0.02
    )
      return;
    this.verticalVelocity = JUMP_VELOCITY;
    this.movingFor = 0.8;
  }

  paint(base: string, accent: string, pattern: Pattern): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    if (!/^#[\da-f]{6}$/i.test(base) || !/^#[\da-f]{6}$/i.test(accent)) return;
    if (!['solid', 'spots', 'stripes'].includes(pattern)) return;
    Object.assign(this.player, { base, accent, pattern });
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
    this.timeLeft = HIDE_SECONDS;
    this.lastEvent = 'Three seekers are searching. Break their sight with cover.';
  }

  tag(id: number | null): boolean {
    if (this.role !== 'seeker' || this.phase !== 'seeking') return false;
    const target = this.targets.find((candidate) => candidate.id === id);
    if (target?.found) return false;
    if (!target) {
      this.misses += 1;
      this.lastEvent = `Just scenery. ${MAX_MISSES - this.misses} mistakes remaining.`;
      if (this.misses >= MAX_MISSES) {
        this.phase = 'lost';
        this.lastEvent = 'Out of guesses. Keep an eye out for faces and tails.';
      }
      return false;
    }
    const eye = {
      x: this.player.x,
      y: this.player.y + EYE_HEIGHTS[this.player.pose],
      z: this.player.z,
    };
    if (Math.hypot(target.x - eye.x, target.z - eye.z, target.y - this.player.y) > TAG_RANGE) {
      this.lastEvent = 'Too far away. Move within 14 meters to tag that chameleon.';
      return false;
    }
    // Head and shoulder points follow the rendered human mannequin geometry.
    const visible = visibleBodyPoints(target).some((point) => lineOfSight(eye, point));
    if (!visible) {
      this.lastEvent = 'Something blocks your view. Find another angle.';
      return false;
    }
    target.found = true;
    this.found += 1;
    this.score += 150;
    this.lastEvent = `Found one! ${this.found} of ${TARGET_COUNT} spotted.`;
    if (this.found === TARGET_COUNT) {
      this.phase = 'won';
      this.score += 400 + Math.ceil(this.timeLeft) * 5;
      this.lastEvent = 'Sharp eyes! Every chameleon found.';
    }
    return true;
  }

  private active(): boolean {
    return this.phase === 'hiding' || this.phase === 'seeking';
  }
  private freshPlayer(): Character {
    return {
      ...SPAWN,
      y: 0,
      angle: Math.PI,
      base: '#ffffff',
      accent: '#d7d9dd',
      pattern: 'solid',
      pose: 'stand',
    };
  }
  private supportHeight(): number {
    let support = 0;
    for (const box of OBSTACLES) {
      if (
        box.height <= this.player.y + 0.025 &&
        overlaps(this.player.x, this.player.z, box, PLAYER_RADIUS)
      ) {
        support = Math.max(support, box.height);
      }
    }
    return support;
  }
  private updateVertical(dt: number): void {
    const support = this.supportHeight();
    if (this.verticalVelocity === 0 && this.player.y <= support + 0.001) {
      this.player.y = support;
      return;
    }
    const next = this.player.y + this.verticalVelocity * dt - (GRAVITY * dt * dt) / 2;
    this.verticalVelocity -= GRAVITY * dt;
    if (this.verticalVelocity <= 0 && next <= support) {
      this.player.y = support;
      this.verticalVelocity = 0;
    } else this.player.y = next;
  }
  private updateCamouflage(): void {
    const weight = { solid: 0, spots: 0.22, stripes: 0.34 }[this.player.pattern];
    const distance =
      colorDistance(this.player.base, this.environment.color) * (1 - weight) +
      colorDistance(this.player.accent, this.environment.color) * weight;
    this.camouflage = Math.round(clamp(1 - distance / 170, 0, 1) * 100);
  }
  private resetHunters(): void {
    const starts = [
      0,
      Math.floor(PATROL_POINTS.length / 3),
      Math.floor((PATROL_POINTS.length * 2) / 3),
    ];
    this.hunters = starts.map((route) => ({
      ...gridPosition(nearestGrid(PATROL_POINTS[route]!)),
      angle: 0,
    }));
    this.patrols = starts.map((route, index) => {
      const next = (route + 1) % PATROL_POINTS.length;
      return {
        route: next,
        path: navigationPath(this.hunters[index]!, PATROL_POINTS[next]!),
        scan: 0,
        memory: 0,
        repath: 0,
        lastSeen: null,
      };
    });
  }
  private moveHunters(dt: number): void {
    this.hunters.forEach((hunter, index) => {
      const patrol = this.patrols[index]!;
      patrol.memory = Math.max(0, patrol.memory - dt);
      patrol.repath -= dt;
      if (patrol.lastSeen && patrol.memory === 0) {
        patrol.lastSeen = null;
        patrol.path = navigationPath(hunter, PATROL_POINTS[patrol.route]!);
      }
      if (patrol.lastSeen && patrol.repath <= 0) {
        patrol.path = navigationPath(hunter, patrol.lastSeen);
        patrol.repath = 0.65;
      }
      if (!patrol.lastSeen && patrol.scan > 0) {
        patrol.scan -= dt;
        hunter.angle += dt * 2.2;
        return;
      }
      let travel = (patrol.lastSeen ? 3.55 : 2.5) * dt;
      while (travel > 0) {
        if (!patrol.path.length) {
          if (patrol.lastSeen) {
            hunter.angle += dt * 1.8;
            break;
          }
          patrol.scan = 1.5;
          patrol.route = (patrol.route + 1) % PATROL_POINTS.length;
          patrol.path = navigationPath(hunter, PATROL_POINTS[patrol.route]!);
          break;
        }
        const destination = patrol.path[0]!;
        const dx = destination.x - hunter.x;
        const dz = destination.z - hunter.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.000001) hunter.angle = Math.atan2(dx, dz);
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
    const mismatch = 1 - this.camouflage / 100;
    const poseExposure = { stand: 8, crouch: 0.65, flat: 0.2 }[this.player.pose];
    const motion = this.movingFor > 0 || Math.abs(this.verticalVelocity) > 0.01 ? 12 : 0;
    let strongest = 0;
    for (let index = 0; index < this.hunters.length; index++) {
      const hunter = this.hunters[index]!;
      const dx = this.player.x - hunter.x;
      const dz = this.player.z - hunter.z;
      const distance = Math.hypot(dx, dz);
      if (distance > HUNTER_VIEW_DISTANCE) continue;
      const facing =
        (Math.sin(hunter.angle) * dx + Math.cos(hunter.angle) * dz) / Math.max(distance, 0.001);
      if (distance > 1.35 && facing < Math.cos(HUNTER_HALF_ANGLE)) continue;
      const eye = { x: hunter.x, y: SEEKER_EYE_HEIGHT, z: hunter.z };
      const visible = [0.55, 1].some((height) =>
        lineOfSight(eye, {
          x: this.player.x,
          y: this.player.y + HEIGHTS[this.player.pose] * height,
          z: this.player.z,
        }),
      );
      if (!visible) continue;
      const proximity = clamp(1 - distance / 23, 0.2, 1);
      const closeExposure = distance < 3 ? (3 - distance) * 1.8 : 0;
      const risk = (poseExposure + mismatch * 23 + motion + closeExposure) * proximity;
      strongest = Math.max(strongest, risk);
      if (this.suspicion > 22 && risk > 3) {
        const patrol = this.patrols[index]!;
        patrol.lastSeen = { x: this.player.x, z: this.player.z };
        patrol.memory = 7;
      }
    }
    this.suspicion = clamp(this.suspicion + (strongest > 0 ? strongest : -5) * dt, 0, 100);
    if (this.suspicion >= 100) {
      this.phase = 'lost';
      this.lastEvent = 'Spotted! Use cover, match its color, and keep your profile low.';
    }
  }
  private createTargets(): Target[] {
    const points = HIDE_SPOTS.filter(
      (spot) => walkable(spot.x, spot.z) && Math.hypot(spot.x - SPAWN.x, spot.z - SPAWN.z) > 12,
    ).map((spot) => ({ ...spot }));
    const random = () => {
      const value = this.random();
      return Number.isFinite(value) ? clamp(value, 0, 0.999999) : 0.5;
    };
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [points[i], points[j]] = [points[j]!, points[i]!];
    }
    if (points.length < TARGET_COUNT)
      throw new Error('Map needs at least eight walkable hiding spots away from the entrance.');
    const selected = ZONES.flatMap((zone) => {
      const spot = points.find(
        (point) =>
          point.x >= zone.minX &&
          point.x <= zone.maxX &&
          point.z >= zone.minZ &&
          point.z <= zone.maxZ,
      );
      return spot ? [spot] : [];
    });
    for (const point of points) {
      if (selected.length >= TARGET_COUNT) break;
      if (
        !selected.includes(point) &&
        selected.every((spot) => Math.hypot(spot.x - point.x, spot.z - point.z) >= 1.2)
      )
        selected.push(point);
    }
    if (selected.length < TARGET_COUNT)
      throw new Error('Map needs eight distinct, separated hiding spots.');
    return selected.slice(0, TARGET_COUNT).map((point, index) => ({
      id: index + 1,
      x: point.x,
      y: 0,
      z: point.z,
      angle: point.angle,
      base: point.color,
      accent: point.color,
      pattern: (index % 4 === 0 ? 'spots' : 'solid') as Pattern,
      pose: point.pose as Pose,
      found: false,
    }));
  }
}
