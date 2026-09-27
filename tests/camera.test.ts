import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraView, movementDirection, lookDirection } from '../src/camera';
import type { Box } from '../src/map';

const player = { x: 0, y: 0, z: 0, pose: 'stand' as const };
const wall: Box = {
  id: 'wall',
  minX: -5,
  maxX: 5,
  minZ: 2,
  maxZ: 2.3,
  height: 6,
  color: '#ffffff',
  kind: 'wall',
  name: 'Wall',
};

test('seeker camera is at the player eye and aims where the mouse looks', () => {
  const view = cameraView(player, 'seeker', Math.PI / 2, 0, 4, []);
  assert.deepEqual(view.position, { x: 0, y: 1.57, z: 0 });
  assert.ok(view.target.x > 0.99);
  assert.equal(view.distance, 0);
  assert.ok(lookDirection(0, 0.5).y > 0);
});
test('hider camera follows behind instead of orbiting around the map', () => {
  const a = cameraView(player, 'hider', 0, 0, 4, []);
  const b = cameraView({ ...player, x: 10, z: -9 }, 'hider', 0, 0, 4, []);
  assert.deepEqual(a.position, { x: 0, y: 1.57, z: 4 });
  assert.equal(b.position.x - a.position.x, 10);
  assert.equal(b.position.z - a.position.z, -9);
});
test('third-person camera cannot cross a wall, a prop, or the floor', () => {
  const view = cameraView(player, 'hider', 0, 0, 4, [wall]);
  assert.ok(view.position.z < wall.minZ - 0.18);
  assert.ok(view.distance > 1);
  const floor = cameraView(player, 'hider', 0, 1, 4, []);
  assert.ok(floor.position.y >= 0.179);
});
test('WASD follows view yaw and diagonal movement has no speed advantage', () => {
  const forward = movementDirection(Math.PI / 2, 0, 1);
  assert.ok(forward.x > 0.99);
  assert.ok(Math.abs(forward.z) < 1e-8);
  const diagonal = movementDirection(0, 1, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-8);
  assert.deepEqual(movementDirection(0, 0, 0), { x: 0, z: 0 });
});
