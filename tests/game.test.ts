import assert from 'node:assert/strict';
import test from 'node:test';
import { Game, OBSTACLES } from '../src/game.js';

function clearOfFurniture(x: number, z: number): boolean {
  return (
    x >= -5.7 &&
    x <= 5.7 &&
    z >= -4.7 &&
    z <= 4.7 &&
    !OBSTACLES.some(
      (o) => x > o.minX - 0.299 && x < o.maxX + 0.299 && z > o.minZ - 0.299 && z < o.maxZ + 0.299,
    )
  );
}

test('hider gets preparation followed by a complete seeking phase', () => {
  const game = new Game(() => 0.5);
  assert.equal(game.phase, 'ready');
  game.tick(10);
  assert.equal(game.elapsed, 0);
  game.start('hider');
  game.setPose('flat');
  game.paint(game.sample(), game.sample(), 'solid');
  game.tick(30);
  assert.equal(game.phase, 'seeking');
  assert.ok(Math.abs(game.timeLeft - 40) < 0.00001);
  game.tick(40);
  assert.equal(game.phase, 'won');
  assert.equal(game.timeLeft, 0);
  assert.ok(game.score > 0);
});

test('matching colors and staying crouched survives both autonomous patrols', () => {
  const game = new Game();
  game.start('hider');
  game.paint(game.sample(), game.sample(), 'stripes');
  game.setPose('crouch');
  game.beginSeeking();
  const origin = game.hunters.map((hunter) => ({ ...hunter }));
  for (let frame = 0; frame < 450; frame++) {
    game.tick(0.1);
    for (const hunter of game.hunters) assert.ok(clearOfFurniture(hunter.x, hunter.z));
  }
  assert.equal(game.camouflage, 100);
  assert.equal(game.suspicion, 0);
  assert.equal(game.phase, 'won');
  assert.notDeepEqual(game.hunters, origin);
});

test('an exposed standing chameleon is detected before time runs out', () => {
  const game = new Game();
  game.start('hider');
  game.paint('#111111', '#111111', 'solid');
  game.beginSeeking();
  game.tick(45);
  assert.equal(game.phase, 'lost');
  assert.equal(game.suspicion, 100);
  assert.ok(game.timeLeft > 0);
});

test('movement cannot tunnel through furniture or room boundaries', () => {
  const game = new Game();
  game.start('hider');
  game.move(0, -1, 10);
  assert.ok(game.player.z >= -2.00001, 'sofa stops a large movement step');
  assert.ok(clearOfFurniture(game.player.x, game.player.z));
  for (const [x, z] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [-1, -1],
    [1, 1],
  ]) {
    game.move(x!, z!, 10);
    assert.ok(clearOfFurniture(game.player.x, game.player.z));
  }
});

test('seeker must find five distinct real targets; repeated finds do not count', () => {
  const game = new Game(() => 0.5);
  game.start('seeker');
  assert.equal(game.timeLeft, 60);
  assert.equal(game.targets.length, 5);
  for (const target of game.targets) assert.ok(clearOfFurniture(target.x, target.z));
  const first = game.targets[0]!;
  assert.equal(game.tag(first.id), true);
  assert.equal(game.tag(first.id), false);
  assert.equal(game.found, 1);
  assert.equal(game.misses, 0);
  assert.equal(game.tag(999), false);
  assert.equal(game.found, 1);
  assert.equal(game.misses, 1);
  for (const target of game.targets.slice(1)) assert.equal(game.tag(target.id), true);
  assert.equal(game.phase, 'won');
  assert.equal(game.found, 5);
  assert.ok(game.score >= 750);
});

test('five misses and an expired seeker clock both lose the round', () => {
  const game = new Game();
  game.start('seeker');
  for (let i = 0; i < 5; i++) game.tag(null);
  assert.equal(game.phase, 'lost');
  assert.equal(game.misses, 5);
  game.restart();
  assert.equal(game.round, 2);
  assert.equal(game.phase, 'seeking');
  assert.equal(game.misses, 0);
  assert.equal(game.found, 0);
  assert.equal(game.score, 0);
  assert.ok(game.targets.every((target) => !target.found));
  game.tick(60);
  assert.equal(game.phase, 'lost');
  assert.equal(game.timeLeft, 0);
});

test('inactive and terminal rounds ignore actions and freeze their state', () => {
  const game = new Game();
  assert.equal(game.tag(1), false);
  const original = { ...game.player };
  game.move(1, 1, 1);
  assert.deepEqual(game.player, original);
  game.start('hider');
  assert.equal(game.tag(1), false);
  game.start('seeker');
  game.tick(60);
  const terminal = JSON.stringify(game);
  game.tick(30);
  game.move(1, 1, 1);
  game.paint('#ffffff', '#ffffff', 'stripes');
  game.setPose('flat');
  game.tag(game.targets[0]!.id);
  assert.equal(JSON.stringify(game), terminal);
});

test('randomized rounds always generate valid targets, including edge RNG values', () => {
  for (const sample of [0, 0.01, 0.5, 0.99, 1]) {
    const game = new Game(() => sample);
    game.start('seeker');
    assert.equal(new Set(game.targets.map((target) => target.id)).size, 5);
    assert.ok(game.targets.every((target) => clearOfFurniture(target.x, target.z)));
  }
});

test('surface sampling and accent patterns contribute to camouflage', () => {
  const game = new Game();
  game.start('hider');
  assert.equal(game.environment.name, 'Matcha rug');
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
