import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Game,
  HIDE_SECONDS,
  MAX_MISSES,
  PREP_SECONDS,
  SEEK_SECONDS,
  TARGET_COUNT,
  lineOfSight,
  navigationPath,
  walkable,
} from '../src/game.js';
import { BOUNDS, HIDE_SPOTS, OBSTACLES, PATROL_POINTS, SPAWN, ZONES } from '../src/map.js';

const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 0.00001, `${a} should equal ${b}`);

function activeSeeker(): Game {
  const game = new Game(() => 0.5);
  game.start('seeker');
  return game;
}

test('the six-room map is substantially larger and provides remote cover in every room', () => {
  assert.equal((BOUNDS.maxX - BOUNDS.minX) * (BOUNDS.maxZ - BOUNDS.minZ), 3584);
  assert.equal(ZONES.length, 6);
  assert.ok(OBSTACLES.length >= 70);
  assert.ok(
    HIDE_SPOTS.every(
      (spot) => walkable(spot.x, spot.z) && Math.hypot(spot.x - SPAWN.x, spot.z - SPAWN.z) > 12,
    ),
  );
});

test('both roles spawn white; hider has 60 seconds of preparation and 120 seconds to survive', () => {
  const game = new Game();
  assert.equal(game.phase, 'ready');
  game.tick(10);
  assert.equal(game.elapsed, 0);
  game.start('hider');
  assert.equal(game.timeLeft, PREP_SECONDS);
  assert.equal(game.player.base, '#ffffff');
  assert.equal(game.player.x, SPAWN.x);
  assert.equal(game.player.z, SPAWN.z);
  assert.equal(game.player.y, 0);
  assert.ok(game.camouflage < 100);
  game.tick(PREP_SECONDS);
  assert.equal(game.phase, 'seeking');
  close(game.timeLeft, HIDE_SECONDS);
  assert.equal(game.hunters.length, 3);
  game.start('seeker');
  assert.equal(game.timeLeft, SEEK_SECONDS);
  assert.equal(game.targets.length, TARGET_COUNT);
  assert.equal(game.player.x, SPAWN.x);
  assert.equal(game.player.z, SPAWN.z);
});

test('seeker walks at 4.2 meters per second and diagonals do not boost speed', () => {
  const cardinal = activeSeeker();
  cardinal.move(0, -1, 1);
  close(cardinal.player.z, SPAWN.z - 4.2);
  const diagonal = activeSeeker();
  diagonal.move(1, -1, 1);
  close(Math.hypot(diagonal.player.x - SPAWN.x, diagonal.player.z - SPAWN.z), 4.2);
  const hider = new Game();
  hider.start('hider');
  hider.move(0, -1, 1);
  close(hider.player.z, cardinal.player.z);
});

test('large movement deltas cannot tunnel through partitions or exterior walls', () => {
  const game = activeSeeker();
  game.move(0, 1, 30);
  assert.ok(game.player.z <= 27.20001);
  assert.ok(walkable(game.player.x, game.player.z));
  game.player.x = 5;
  game.player.z = 16;
  game.move(0, -1, 30);
  assert.ok(game.player.z >= 11.7999, 'information screen blocks the straight route');
  assert.ok(walkable(game.player.x, game.player.z));
  game.player.x = 0;
  game.player.z = 6;
  game.move(0, -1, 2);
  close(game.player.z, -2.4);
  assert.ok(walkable(game.player.x, game.player.z), 'central doorway is traversable');
});

test('jump rises and settles, cannot double-jump, and cannot cross a tall partition', () => {
  const game = activeSeeker();
  game.jump();
  game.tick(0.3);
  assert.ok(game.player.y > 0.9 && game.player.y < 1.02);
  game.jump();
  game.tick(0.5);
  close(game.player.y, 0);
  game.player.x = 5;
  game.player.z = 16;
  game.jump();
  game.tick(0.2);
  game.move(0, -1, 30);
  assert.ok(game.player.z >= 11.7999);
  assert.ok(walkable(game.player.x, game.player.z, 0.3, game.player.y));
  game.tick(1);
  close(game.player.y, 0);
});

test('jump can land on a low prop and walking off falls back to the floor', () => {
  const game = activeSeeker();
  game.player.x = -5.3;
  game.player.z = 6.3;
  game.jump();
  game.tick(0.2);
  game.move(1, 0, 0.25);
  assert.ok(game.player.x > -4.8 && game.player.x < -3.1);
  game.tick(1);
  close(game.player.y, 0.5);
  game.move(-1, 0, 0.75);
  game.tick(1);
  close(game.player.y, 0);
  assert.ok(walkable(game.player.x, game.player.z));
});

test('3D line of sight respects wall height and lets low cover hide a flat body', () => {
  assert.equal(lineOfSight({ x: -10, y: 1.57, z: 6 }, { x: -12, y: 1.1, z: 6 }), false);
  assert.equal(lineOfSight({ x: -10, y: 7, z: 6 }, { x: -12, y: 7, z: 6 }), true);
  const eye = { x: -7, y: 1.57, z: 6.3 };
  assert.equal(lineOfSight(eye, { x: -2.5, y: 1.28, z: 6.3 }), true);
  assert.equal(lineOfSight(eye, { x: -2.5, y: 0.32, z: 6.3 }), false);
});

test('navigation reaches all patrol locations through open doors without crossing walls', () => {
  for (let i = 0; i < PATROL_POINTS.length; i++) {
    const from = PATROL_POINTS[i]!;
    const to = PATROL_POINTS[(i + 1) % PATROL_POINTS.length]!;
    const path = navigationPath(from, to);
    assert.ok(path.length > 0, `patrol route ${i} must connect`);
    let last = from;
    for (const point of path) {
      const distance = Math.hypot(point.x - last.x, point.z - last.z);
      const steps = Math.max(1, Math.ceil(distance / 0.1));
      for (let step = 1; step <= steps; step++) {
        const ratio = step / steps;
        assert.ok(
          walkable(last.x + (point.x - last.x) * ratio, last.z + (point.z - last.z) * ratio),
          `patrol ${i} crossed a solid`,
        );
      }
      last = point;
    }
    assert.ok(Math.hypot(last.x - to.x, last.z - to.z) < 1.1);
  }
});

test('three seekers move on legal routes and exposed default standing is not an automatic win', () => {
  const game = new Game();
  game.start('hider');
  game.beginSeeking();
  const origins = game.hunters.map((hunter) => ({ ...hunter }));
  for (let step = 0; step < HIDE_SECONDS * 10 && game.phase === 'seeking'; step++) {
    game.tick(0.1);
    for (const hunter of game.hunters)
      assert.ok(walkable(hunter.x, hunter.z), 'hunters stay outside solids');
  }
  assert.notDeepEqual(game.hunters, origins);
  assert.equal(game.phase, 'lost');
  assert.equal(game.suspicion, 100);
  assert.ok(game.timeLeft > 0);
});

test('perfect matching crouch is safer but close eye contact still raises suspicion', () => {
  const matched = new Game();
  matched.start('hider');
  matched.paint(matched.sample(), matched.sample(), 'solid');
  matched.setPose('crouch');
  matched.beginSeeking();
  matched.tick(0.2);
  const exposed = new Game();
  exposed.start('hider');
  exposed.beginSeeking();
  exposed.tick(0.2);
  assert.equal(matched.camouflage, 100);
  assert.ok(matched.suspicion > 0, 'matching is concealment rather than immunity');
  assert.ok(exposed.suspicion > matched.suspicion * 2);
});

test('well-chosen matching cover can win while the three patrols search all six rooms', () => {
  const game = new Game();
  const spot = HIDE_SPOTS[0]!;
  game.start('hider');
  game.player.x = spot.x;
  game.player.z = spot.z;
  game.paint(game.sample(), game.sample(), 'solid');
  game.setPose('flat');
  game.beginSeeking();
  const visited = new Set<string>();
  for (let frame = 0; frame < HIDE_SECONDS * 4; frame++) {
    game.tick(0.25);
    for (const hunter of game.hunters) {
      assert.ok(walkable(hunter.x, hunter.z));
      const room = ZONES.find(
        (zone) =>
          hunter.x >= zone.minX &&
          hunter.x <= zone.maxX &&
          hunter.z >= zone.minZ &&
          hunter.z <= zone.maxZ,
      );
      if (room) visited.add(room.name);
    }
  }
  assert.equal(game.phase, 'won');
  assert.equal(game.timeLeft, 0);
  assert.ok(game.score >= 800);
  assert.equal(visited.size, 6);
});

test('target generation distributes eight walkable hidden characters across all six rooms', () => {
  for (const sample of [0, 0.01, 0.5, 0.99, 1, Number.NaN]) {
    const game = new Game(() => sample);
    game.start('seeker');
    assert.equal(game.targets.length, TARGET_COUNT);
    assert.equal(new Set(game.targets.map((target) => target.id)).size, TARGET_COUNT);
    assert.ok(
      game.targets.every(
        (target) =>
          walkable(target.x, target.z) &&
          Math.hypot(target.x - SPAWN.x, target.z - SPAWN.z) > 12 &&
          Number.isFinite(target.angle),
      ),
    );
    assert.ok(
      ZONES.every((zone) =>
        game.targets.some(
          (target) =>
            target.x >= zone.minX &&
            target.x <= zone.maxX &&
            target.z >= zone.minZ &&
            target.z <= zone.maxZ,
        ),
      ),
    );
  }
});

test('seeker tagging requires proximity and unblocked 3D sight', () => {
  const game = activeSeeker();
  const far = game.targets.find(
    (target) => Math.hypot(target.x - SPAWN.x, target.z - SPAWN.z) > 14,
  )!;
  assert.equal(game.tag(far.id), false);
  assert.equal(game.found, 0);
  assert.equal(game.misses, 0);
  const target = game.targets[0]!;
  target.x = -12;
  target.z = 6;
  game.player.x = -10;
  game.player.z = 6;
  assert.equal(game.tag(target.id), false, 'cannot tag through a room divider');
  assert.equal(game.found, 0);
  game.player.x = target.x;
  game.player.z = target.z + 1;
  assert.equal(game.tag(target.id), true);
  assert.equal(game.tag(target.id), false);
  assert.equal(game.found, 1);
  assert.equal(game.misses, 0);
});

test('standing seeker can tag a visible mannequin head, while crouching loses that sightline', () => {
  const game = activeSeeker();
  const target = game.targets[0]!;
  Object.assign(target, { x: -17.4, z: 12.8, y: 0, angle: 0, pose: 'stand' });
  Object.assign(game.player, { x: -17.4, z: 8.8, y: 0 });
  game.setPose('crouch');
  assert.equal(game.tag(target.id), false, 'the lowered camera cannot see over the 1.6m plinth');
  game.setPose('stand');
  assert.equal(game.tag(target.id), true, 'the 1.72m mannequin head is visible over the plinth');
});

test('a fully hidden mannequin cannot be tagged using a nonexistent chameleon tail', () => {
  const game = activeSeeker();
  const target = game.targets[0]!;
  Object.assign(target, { x: 3.3, z: 11.98, y: 0, angle: Math.PI / 2, pose: 'stand' });
  Object.assign(game.player, { x: 2.6, z: 9.6, y: 0 });
  assert.equal(
    game.tag(target.id),
    false,
    'the complete human body is behind the information screen',
  );
  assert.equal(game.found, 0);
});

test('navigation can approach every hiding position including narrow passages behind crates', () => {
  for (const spot of HIDE_SPOTS) {
    const path = navigationPath(SPAWN, spot);
    const end = path.at(-1);
    assert.ok(end, 'every hide spot is connected to the spawn');
    for (let step = 1; step <= 20; step++) {
      const ratio = step / 20;
      assert.ok(
        walkable(end.x + (spot.x - end.x) * ratio, end.z + (spot.z - end.z) * ratio),
        'the final approach to cover must be walkable',
      );
    }
  }
});

test('all eight distinct targets are required to win, and fake IDs never score', () => {
  const game = activeSeeker();
  assert.equal(game.tag(99999), false);
  assert.equal(game.misses, 1);
  assert.equal(game.score, 0);
  for (const target of game.targets) {
    game.player.x = target.x;
    game.player.z = target.z;
    assert.equal(game.tag(target.id), true);
  }
  assert.equal(game.phase, 'won');
  assert.equal(game.found, TARGET_COUNT);
  assert.ok(game.score >= 1600);
});

test('eight mistakes or three minutes end seeking; restart clears progress and physics', () => {
  const game = activeSeeker();
  for (let i = 0; i < MAX_MISSES; i++) game.tag(null);
  assert.equal(game.phase, 'lost');
  assert.equal(game.misses, MAX_MISSES);
  game.restart();
  assert.equal(game.round, 2);
  assert.equal(game.phase, 'seeking');
  assert.equal(game.misses, 0);
  assert.equal(game.found, 0);
  assert.equal(game.score, 0);
  assert.equal(game.player.y, 0);
  assert.ok(game.targets.every((target) => !target.found));
  game.tick(SEEK_SECONDS);
  assert.equal(game.phase, 'lost');
  assert.equal(game.timeLeft, 0);
});

test('inactive and terminal rounds ignore movement, jump, painting and tags', () => {
  const game = new Game();
  const before = JSON.stringify(game);
  game.jump();
  game.move(1, 1, 1);
  game.tick(1);
  assert.equal(JSON.stringify(game), before);
  game.start('seeker');
  game.tick(SEEK_SECONDS);
  const terminal = JSON.stringify(game);
  game.tick(30);
  game.move(1, 1, 1);
  game.jump();
  game.paint('#ffffff', '#ffffff', 'stripes');
  game.setPose('flat');
  game.tag(game.targets[0]!.id);
  assert.equal(JSON.stringify(game), terminal);
});

test('surface colors and accent contrast affect camouflage, and invalid input is ignored', () => {
  const game = new Game();
  game.start('hider');
  game.paint(game.sample(), '#111111', 'solid');
  assert.equal(game.camouflage, 100);
  game.paint(game.sample(), '#111111', 'stripes');
  assert.ok(game.camouflage < 100);
  const before = JSON.stringify(game.player);
  game.paint('invalid', '#000000', 'solid');
  assert.equal(JSON.stringify(game.player), before);
  game.tick(Number.NaN);
  game.move(Number.NaN, 0, 1);
  assert.ok(Number.isFinite(game.player.x));
  assert.ok(Number.isFinite(game.timeLeft));
});
