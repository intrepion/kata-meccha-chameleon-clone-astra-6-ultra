import type { Box } from './map';
import { EYE_HEIGHTS } from './game';

export type Point = { x: number; y: number; z: number };
type Body = Point & { pose: 'stand' | 'crouch' | 'flat' };

export function lookDirection(yaw: number, pitch: number): Point {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}

export function movementDirection(yaw: number, strafe: number, forward: number) {
  const length = Math.max(1, Math.hypot(strafe, forward));
  return {
    x: (strafe * Math.cos(yaw) + forward * Math.sin(yaw)) / length,
    z: (strafe * Math.sin(yaw) - forward * Math.cos(yaw)) / length,
  };
}

// Swept camera sphere against exactly the same solids that stop the player.
function cameraDistance(origin: Point, direction: Point, distance: number, boxes: Box[]): number {
  let available = distance;
  for (const box of boxes) {
    let near = 0;
    let far = distance;
    let intersects = true;
    for (const [axis, low, high] of [
      ['x', box.minX - 0.18, box.maxX + 0.18],
      ['y', -0.18, box.height + 0.18],
      ['z', box.minZ - 0.18, box.maxZ + 0.18],
    ] as const) {
      const d = direction[axis];
      if (Math.abs(d) < 1e-7) {
        if (origin[axis] < low || origin[axis] > high) {
          intersects = false;
          break;
        }
      } else {
        const a = (low - origin[axis]) / d;
        const b = (high - origin[axis]) / d;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) {
          intersects = false;
          break;
        }
      }
    }
    if (intersects && far > 0) available = Math.min(available, Math.max(0.06, near - 0.06));
  }
  if (direction.y < 0) available = Math.min(available, (origin.y - 0.18) / -direction.y);
  return Math.max(0.06, available);
}

export function cameraView(
  body: Body,
  role: 'hider' | 'seeker',
  yaw: number,
  pitch: number,
  distance: number,
  boxes: Box[],
) {
  const forward = lookDirection(yaw, pitch);
  const anchor = { x: body.x, y: body.y + EYE_HEIGHTS[body.pose], z: body.z };
  if (role === 'seeker')
    return {
      position: anchor,
      target: { x: anchor.x + forward.x, y: anchor.y + forward.y, z: anchor.z + forward.z },
      distance: 0,
    };
  const backward = { x: -forward.x, y: -forward.y, z: -forward.z };
  const safeDistance = cameraDistance(anchor, backward, distance, boxes);
  return {
    position: {
      x: anchor.x + backward.x * safeDistance,
      y: anchor.y + backward.y * safeDistance,
      z: anchor.z + backward.z * safeDistance,
    },
    target: anchor,
    distance: safeDistance,
  };
}
