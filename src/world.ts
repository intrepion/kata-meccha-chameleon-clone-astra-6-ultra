import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOUNDS, OBSTACLES, ZONES, type Box } from './map';

export type Pose = 'stand' | 'crouch' | 'flat';
export interface Avatar {
  group: THREE.Group;
  paint(base: string, accent: string, pattern: 'solid' | 'spots' | 'stripes'): void;
  pose(pose: Pose): void;
  animate(time: number, moving: boolean): void;
}

const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const cream = '#eee4cf';
const wood = '#b18a61';
const colors = ['#e899ac', '#83bda8', '#b4a6d4', '#d98869', '#d9ad75'];

function geometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let result = geometryCache.get(key);
  if (!result) {
    result = make();
    geometryCache.set(key, result);
  }
  return result;
}

function material(color: string): THREE.MeshStandardMaterial {
  let result = materialCache.get(color);
  if (!result) {
    result = new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
    materialCache.set(color, result);
  }
  return result;
}

function mesh(
  parent: THREE.Object3D,
  shape: THREE.BufferGeometry,
  color: string | THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const object = new THREE.Mesh(shape, typeof color === 'string' ? material(color) : color);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(
  parent: THREE.Object3D,
  color: string | THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  radius = 0.025,
): THREE.Mesh {
  const r = radius < 0.05 ? 0 : Math.min(radius, w / 2, h / 2, d / 2);
  const key = `box-${w}-${h}-${d}-${r}`;
  const shape = geometry(key, () =>
    r === 0 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r),
  );
  return mesh(parent, shape, color, x, y, z);
}

function ball(
  parent: THREE.Object3D,
  color: string | THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy = sx,
  sz = sx,
): THREE.Mesh {
  const object = mesh(
    parent,
    geometry('sphere', () => new THREE.SphereGeometry(1, 16, 12)),
    color,
    x,
    y,
    z,
  );
  object.scale.set(sx, sy, sz);
  return object;
}

function cylinder(
  parent: THREE.Object3D,
  color: string | THREE.Material,
  x: number,
  y: number,
  z: number,
  top: number,
  bottom: number,
  height: number,
): THREE.Mesh {
  return mesh(
    parent,
    geometry(
      `cylinder-${top}-${bottom}-${height}`,
      () => new THREE.CylinderGeometry(top, bottom, height, 16),
    ),
    color,
    x,
    y,
    z,
  );
}

function textTexture(
  text: string,
  subtitle: string,
  background: string,
  foreground = '#3c4543',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 66px sans-serif';
  ctx.fillText(text.toUpperCase(), 512, subtitle ? 104 : 133, 940);
  if (subtitle) {
    ctx.font = '500 26px sans-serif';
    ctx.fillText(subtitle.toUpperCase(), 512, 181, 930);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function sign(
  parent: THREE.Object3D,
  text: string,
  subtitle: string,
  background: string,
  x: number,
  y: number,
  z: number,
  width: number,
  angle = 0,
): THREE.Mesh {
  const signMaterial = new THREE.MeshStandardMaterial({
    map: textTexture(text, subtitle, background),
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const result = mesh(
    parent,
    geometry('sign-plane', () => new THREE.PlaneGeometry(1, 0.25)),
    signMaterial,
    x,
    y,
    z,
  );
  result.scale.setScalar(width);
  result.rotation.y = angle;
  result.castShadow = false;
  return result;
}

function plant(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  scale = 1,
  potColor = '#d98869',
): void {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  parent.add(group);
  cylinder(group, potColor, 0, 0.25, 0, 0.3, 0.23, 0.5);
  cylinder(group, '#665f47', 0, 0.51, 0, 0.27, 0.27, 0.025);
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.399;
    const height = 0.91 + (i % 3) * 0.21;
    const dx = Math.cos(angle) * 0.18;
    const dz = Math.sin(angle) * 0.18;
    const stem = cylinder(
      group,
      '#5a7855',
      dx / 2,
      (height + 0.5) / 2,
      dz / 2,
      0.012,
      0.016,
      height - 0.5,
    );
    stem.rotation.set(dz * 0.8, 0, -dx * 0.8);
    const leaf = ball(group, i % 2 ? '#7e9e66' : '#517e5b', dx, height, dz, 0.15, 0.31, 0.055);
    leaf.rotation.set(Math.sin(angle) * 0.6, angle, Math.cos(angle) * -0.6);
  }
}

function jar(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: string,
  scale = 1,
): void {
  cylinder(parent, color, x, y + 0.12 * scale, z, 0.11 * scale, 0.11 * scale, 0.24 * scale);
  cylinder(parent, cream, x, y + 0.253 * scale, z, 0.117 * scale, 0.117 * scale, 0.035 * scale);
}

function book(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: string,
  standing = false,
): void {
  if (standing) {
    box(parent, color, x, y + 0.25, z, 0.095, 0.5, 0.33, 0.008);
    box(parent, '#e7ddc6', x, y + 0.25, z + 0.17, 0.065, 0.43, 0.007, 0);
  } else {
    box(parent, color, x, y + 0.055, z, 0.4, 0.11, 0.29, 0.008);
    box(parent, '#e7ddc6', x, y + 0.055, z + 0.147, 0.35, 0.075, 0.005, 0);
  }
}

function artwork(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  size: number,
  seed: number,
  angle = 0,
): void {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = angle;
  parent.add(group);
  box(group, wood, 0, 0, 0, size, size * 1.18, 0.06, 0.014);
  box(group, cream, 0, 0, 0.041, size - 0.1, size * 1.18 - 0.1, 0.018, 0);
  ball(group, colors[seed % 5], size * 0.14, size * 0.21, 0.058, size * 0.17, size * 0.17, 0.008);
  const shape = ball(
    group,
    colors[(seed + 2) % 5],
    -size * 0.13,
    -size * 0.18,
    0.07,
    size * 0.28,
    size * 0.2,
    0.01,
  );
  shape.rotation.z = 0.4;
  box(
    group,
    colors[(seed + 3) % 5],
    size * 0.14,
    -size * 0.3,
    0.09,
    size * 0.34,
    size * 0.12,
    0.014,
    0,
  );
}

export function createAvatar(base = '#83bda8'): Avatar {
  const group = new THREE.Group();
  group.name = 'Paintable mannequin';
  const body = new THREE.Group();
  group.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: base, roughness: 0.84 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: base, roughness: 0.92 });
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  for (const [leg, side] of [
    [leftLeg, -1],
    [rightLeg, 1],
  ] as const) {
    leg.position.set(side * 0.105, 0.69, 0);
    body.add(leg);
    ball(leg, skin, 0, -0.28, 0, 0.095, 0.32, 0.1);
    ball(leg, skin, 0, -0.6, 0.045, 0.11, 0.09, 0.16);
  }
  ball(body, skin, 0, 0.78, 0, 0.22, 0.18, 0.16);
  ball(body, skin, 0, 1.065, 0, 0.24, 0.315, 0.16);
  cylinder(body, skin, 0, 1.36, 0, 0.074, 0.08, 0.13);
  const head = ball(body, skin, 0, 1.51, 0, 0.165, 0.21, 0.16);
  for (const side of [-1, 1])
    ball(body, eyeMaterial, side * 0.052, 1.55, 0.149, 0.012, 0.012, 0.005);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, 1.21, 0);
    body.add(arm);
    ball(arm, skin, side * 0.03, -0.16, 0, 0.074, 0.21, 0.078);
    ball(arm, skin, side * 0.045, -0.42, 0.01, 0.06, 0.15, 0.065);
    ball(arm, skin, side * 0.045, -0.54, 0.015, 0.065, 0.077, 0.07);
    arms.push(arm);
  }
  let activePose: Pose = 'stand';
  let currentHeight = 1;
  let currentWidth = 1;
  let texture: THREE.CanvasTexture | null = null;

  function paint(baseColor: string, accent: string, pattern: 'solid' | 'spots' | 'stripes'): void {
    texture?.dispose();
    texture = null;
    skin.map = null;
    skin.color.set(baseColor);
    eyeMaterial.color.set(baseColor).lerp(new THREE.Color('#363d3b'), 0.3);
    if (pattern !== 'solid') {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = accent;
      if (pattern === 'spots') {
        for (let row = 0; row < 4; row++)
          for (let col = 0; col < 4; col++) {
            ctx.beginPath();
            ctx.ellipse(col * 64 + 22 + (row % 2) * 18, row * 64 + 30, 13, 17, 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
      } else {
        for (let i = -256; i < 512; i += 66) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 23, 0);
          ctx.lineTo(i + 115, 256);
          ctx.lineTo(i + 92, 256);
          ctx.closePath();
          ctx.fill();
        }
      }
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      skin.map = texture;
      skin.color.set('#ffffff');
    }
    skin.needsUpdate = true;
  }
  paint(base, '#527964', 'solid');
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.castShadow = false;
  });
  const shadow = new THREE.Mesh(
    geometry('avatar-shadow', () => new THREE.CircleGeometry(0.32, 24)),
    new THREE.MeshBasicMaterial({
      color: '#344639',
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  shadow.userData.ignoreAim = true;
  group.add(shadow);
  return {
    group,
    paint,
    pose(pose) {
      activePose = pose;
    },
    animate(time, moving) {
      shadow.position.y = 0.025 - group.position.y;
      shadow.scale.setScalar(Math.max(0.55, 1 - group.position.y * 0.16));
      const height = activePose === 'flat' ? 0.19 : activePose === 'crouch' ? 0.55 : 1;
      const width = activePose === 'flat' ? 1.48 : activePose === 'crouch' ? 1.13 : 1;
      currentHeight = THREE.MathUtils.lerp(currentHeight, height, 0.2);
      currentWidth = THREE.MathUtils.lerp(currentWidth, width, 0.2);
      body.scale.set(currentWidth, currentHeight, currentWidth);
      body.position.y =
        (moving ? Math.abs(Math.sin(time * 10)) * 0.025 : Math.sin(time * 2.2) * 0.004) *
        currentHeight;
      leftLeg.rotation.x = moving ? Math.sin(time * 10) * 0.42 : 0;
      rightLeg.rotation.x = moving ? -Math.sin(time * 10) * 0.42 : 0;
      arms[0].rotation.x = moving ? -Math.sin(time * 10) * 0.32 : 0;
      arms[1].rotation.x = moving ? Math.sin(time * 10) * 0.32 : 0;
      head.rotation.z = moving ? Math.sin(time * 5) * 0.014 : 0;
    },
  };
}

function makeFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fbf7ed';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#eee9dc';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);
  let random = 48271;
  for (let i = 0; i < 1900; i++) {
    random = (random * 16807) % 2147483647;
    const x = random % 256;
    random = (random * 16807) % 2147483647;
    const y = random % 256;
    ctx.fillStyle = i % 3 ? '#c8c1ae38' : '#ffffff45';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.strokeStyle = '#bbb6a33c';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 128, 128);
  ctx.strokeRect(128, 128, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function drawWall(parent: THREE.Group, obstacle: Box): void {
  const w = obstacle.maxX - obstacle.minX;
  const d = obstacle.maxZ - obstacle.minZ;
  const x = (obstacle.minX + obstacle.maxX) / 2;
  const z = (obstacle.minZ + obstacle.maxZ) / 2;
  box(parent, obstacle.color, x, obstacle.height / 2, z, w, obstacle.height, d, 0);
  // Slightly inset painted dado and skirting keep the collider's outer bounds.
  const horizontal = w > d;
  for (const side of [-1, 1]) {
    box(
      parent,
      '#c7cbbb',
      x + (horizontal ? 0 : side * (w / 2 + 0.004)),
      0.75,
      z + (horizontal ? side * (d / 2 + 0.004) : 0),
      horizontal ? w : 0.009,
      1.5,
      horizontal ? 0.009 : d,
      0,
    );
    box(
      parent,
      '#a5ac99',
      x + (horizontal ? 0 : side * (w / 2 + 0.01)),
      0.11,
      z + (horizontal ? side * (d / 2 + 0.01) : 0),
      horizontal ? w : 0.018,
      0.22,
      horizontal ? 0.018 : d,
      0,
    );
  }
}

function drawShelf(parent: THREE.Group, obstacle: Box, seed: number): void {
  const width = obstacle.maxX - obstacle.minX;
  const depth = obstacle.maxZ - obstacle.minZ;
  const alongZ = depth > width;
  const length = alongZ ? depth : width;
  const thickness = alongZ ? width : depth;
  const group = new THREE.Group();
  group.position.set((obstacle.minX + obstacle.maxX) / 2, 0, (obstacle.minZ + obstacle.maxZ) / 2);
  group.rotation.y = alongZ ? Math.PI / 2 : 0;
  parent.add(group);
  // Solid backing fills the full collision footprint; shallow open cubbies are decorative.
  box(group, obstacle.color, 0, obstacle.height / 2, 0, length, obstacle.height, thickness, 0.035);
  const levels = 4;
  for (const side of [-1, 1]) {
    for (let row = 0; row < levels; row++) {
      const y = 0.19 + (row * (obstacle.height - 0.45)) / levels;
      box(
        group,
        '#536c61',
        0,
        y + 0.24,
        side * (thickness / 2 + 0.005),
        length - 0.2,
        0.5,
        0.015,
        0,
      );
      box(
        group,
        obstacle.color,
        0,
        y - 0.015,
        side * (thickness / 2 + 0.1),
        length,
        0.1,
        0.22,
        0.015,
      );
      const count = Math.floor(length / 0.65);
      for (let item = 0; item < count; item++) {
        const x = -length / 2 + 0.4 + item * 0.65;
        const itemColor = colors[(seed + item + row) % colors.length];
        const itemZ = side * (thickness / 2 + 0.075);
        if (obstacle.id.includes('archive')) {
          for (let spine = 0; spine < 3; spine++)
            box(
              group,
              colors[(seed + row + item + spine) % 5],
              x + spine * 0.12,
              y + 0.21,
              itemZ,
              0.09,
              0.4 + spine * 0.025,
              0.11,
              0.006,
            );
        } else if (obstacle.id.includes('green')) {
          cylinder(group, itemColor, x, y + 0.15, itemZ, 0.12, 0.075, 0.3);
          ball(group, '#6c8f5c', x, y + 0.4, itemZ, 0.15, 0.19, 0.1);
        } else {
          jar(group, x, y + 0.035, itemZ, itemColor, 1.1);
        }
      }
    }
  }
  sign(
    group,
    obstacle.name,
    'COLOR HOUSE COLLECTION',
    '#ece1c8',
    0,
    obstacle.height - 0.18,
    thickness / 2 + 0.022,
    Math.min(length - 0.2, 2.5),
  );
}

function drawCrate(parent: THREE.Group, obstacle: Box, seed: number): void {
  const w = obstacle.maxX - obstacle.minX;
  const d = obstacle.maxZ - obstacle.minZ;
  const x = (obstacle.minX + obstacle.maxX) / 2;
  const z = (obstacle.minZ + obstacle.maxZ) / 2;
  box(parent, obstacle.color, x, obstacle.height / 2, z, w, obstacle.height, d, 0.045);
  if (obstacle.id.startsWith('gallery')) {
    if (obstacle.height < 0.8) {
      for (let i = 0; i < 3; i++)
        cylinder(
          parent,
          ['#eee4cf', '#a7b59d', '#c69279'][i],
          x - 0.65 + i * 0.65,
          obstacle.height + 0.18 + i * 0.05,
          z,
          0.13 + i * 0.04,
          0.19,
          0.36 + i * 0.1,
        );
    } else {
      const sculpture = new THREE.Group();
      sculpture.position.set(x, obstacle.height, z);
      parent.add(sculpture);
      cylinder(sculpture, '#eee4cf', 0, 0.08, 0, 0.4, 0.4, 0.16);
      const torus = mesh(
        sculpture,
        geometry(
          'sculpture-ring',
          () => new THREE.TorusGeometry(0.48, 0.13, 12, 28, Math.PI * 1.72),
        ),
        seed % 2 ? '#d7c5a2' : '#8ca496',
        0,
        0.69,
        0,
      );
      torus.rotation.z = -0.3;
      ball(sculpture, '#c1915b', 0.02, 0.69, 0.01, 0.18);
    }
    return;
  }
  const edge = new THREE.Color(obstacle.color).multiplyScalar(0.78).getStyle();
  for (const side of [-1, 1]) {
    box(
      parent,
      edge,
      x,
      obstacle.height * 0.23,
      z + side * (d / 2 + 0.008),
      w - 0.09,
      0.07,
      0.017,
      0,
    );
    box(
      parent,
      edge,
      x,
      obstacle.height * 0.77,
      z + side * (d / 2 + 0.008),
      w - 0.09,
      0.07,
      0.017,
      0,
    );
    box(
      parent,
      edge,
      x + side * (w / 2 + 0.008),
      obstacle.height * 0.5,
      z,
      0.017,
      0.07,
      d - 0.09,
      0,
    );
  }
  if (obstacle.height > 0.8) {
    sign(
      parent,
      `CH / ${String(seed + 1).padStart(2, '0')}`,
      'ART MATERIALS',
      cream,
      x,
      obstacle.height * 0.51,
      z + d / 2 + 0.02,
      Math.min(w * 0.6, 1.1),
    );
    box(parent, '#d8c7a3', x, obstacle.height + 0.006, z, 0.15, 0.012, d - 0.05, 0);
  }
}

function drawTable(parent: THREE.Group, obstacle: Box, seed: number): void {
  const w = obstacle.maxX - obstacle.minX;
  const d = obstacle.maxZ - obstacle.minZ;
  const x = (obstacle.minX + obstacle.maxX) / 2;
  const z = (obstacle.minZ + obstacle.maxZ) / 2;
  // Cabinet workbenches are solid to the floor, matching navigation and jump physics.
  box(parent, obstacle.color, x, obstacle.height / 2, z, w, obstacle.height, d, 0.04);
  box(parent, '#bb9166', x, obstacle.height - 0.07, z, w, 0.14, d, 0.025);
  for (let drawer = 0; drawer < 3; drawer++) {
    const drawerX = obstacle.minX + ((drawer + 0.5) * w) / 3;
    box(
      parent,
      '#ccaa7d',
      drawerX,
      obstacle.height * 0.5,
      obstacle.maxZ + 0.007,
      w / 3 - 0.08,
      obstacle.height * 0.69,
      0.018,
      0.012,
    );
    box(
      parent,
      '#7d705d',
      drawerX,
      obstacle.height * 0.68,
      obstacle.maxZ + 0.025,
      0.22,
      0.035,
      0.03,
      0.007,
    );
  }
  box(parent, '#e8dfcc', x, obstacle.height + 0.015, z, w * 0.4, 0.025, d * 0.55, 0);
  ball(parent, colors[seed % 5], x - 0.25, obstacle.height + 0.035, z + 0.08, 0.27, 0.008, 0.18);
  book(parent, obstacle.minX + 0.48, obstacle.height + 0.015, z, colors[(seed + 1) % 5]);
  book(parent, obstacle.minX + 0.5, obstacle.height + 0.14, z + 0.04, colors[(seed + 3) % 5]);
  for (let i = 0; i < 3; i++)
    jar(
      parent,
      obstacle.maxX - 0.38 - i * 0.31,
      obstacle.height + 0.01,
      obstacle.minZ + 0.3,
      colors[(seed + i) % 5],
    );
  cylinder(
    parent,
    cream,
    obstacle.maxX - 0.4,
    obstacle.height + 0.17,
    obstacle.maxZ - 0.33,
    0.12,
    0.105,
    0.34,
  );
  for (let i = 0; i < 3; i++) {
    const brush = cylinder(
      parent,
      wood,
      obstacle.maxX - 0.46 + i * 0.055,
      obstacle.height + 0.43,
      obstacle.maxZ - 0.33,
      0.012,
      0.014,
      0.47,
    );
    brush.rotation.z = (i - 1) * 0.13;
  }
}

function drawPlanter(parent: THREE.Group, obstacle: Box): void {
  const w = obstacle.maxX - obstacle.minX;
  const d = obstacle.maxZ - obstacle.minZ;
  const x = (obstacle.minX + obstacle.maxX) / 2;
  const z = (obstacle.minZ + obstacle.maxZ) / 2;
  box(parent, obstacle.color, x, obstacle.height / 2, z, w, obstacle.height, d, 0.06);
  box(parent, '#5d644b', x, obstacle.height + 0.003, z, w - 0.17, 0.02, d - 0.17, 0);
  const count = w > 2 ? 4 : 1;
  for (let i = 0; i < count; i++)
    plant(
      parent,
      x + (i - (count - 1) / 2) * 0.75,
      obstacle.height + 0.02,
      z,
      count > 1 ? 0.64 : 0.83,
      obstacle.color,
    );
}

function drawSofa(parent: THREE.Group, obstacle: Box): void {
  const w = obstacle.maxX - obstacle.minX;
  const d = obstacle.maxZ - obstacle.minZ;
  const x = (obstacle.minX + obstacle.maxX) / 2;
  const z = (obstacle.minZ + obstacle.maxZ) / 2;
  box(
    parent,
    obstacle.color,
    x,
    (obstacle.height - 0.11) / 2,
    z,
    w,
    obstacle.height - 0.11,
    d,
    0.12,
  );
  const count = Math.max(2, Math.round(d / 1.3));
  for (let i = 0; i < count; i++) {
    const seatZ = obstacle.minZ + ((i + 0.5) * d) / count;
    box(
      parent,
      new THREE.Color(obstacle.color).lerp(new THREE.Color('#fff1d2'), 0.14).getStyle(),
      x,
      obstacle.height - 0.055,
      seatZ,
      w - 0.23,
      0.11,
      d / count - 0.07,
      0.08,
    );
  }
}

function drawPartition(parent: THREE.Group, obstacle: Box, seed: number): void {
  const w = obstacle.maxX - obstacle.minX;
  const d = obstacle.maxZ - obstacle.minZ;
  const x = (obstacle.minX + obstacle.maxX) / 2;
  const z = (obstacle.minZ + obstacle.maxZ) / 2;
  box(parent, obstacle.color, x, obstacle.height / 2, z, w, obstacle.height, d, 0.025);
  if (obstacle.height < 2) {
    sign(
      parent,
      'WELCOME',
      'MAPS · CLASSES · MATERIALS',
      cream,
      x,
      obstacle.height * 0.65,
      obstacle.maxZ + 0.015,
      Math.min(w - 0.2, 2.7),
    );
    book(parent, x - 0.4, obstacle.height + 0.01, z, '#83bda8');
    plant(parent, x + 1.1, obstacle.height, z, 0.42);
  } else if (w > d) {
    artwork(parent, x - w * 0.23, obstacle.height * 0.61, obstacle.maxZ + 0.037, 0.84, seed);
    artwork(parent, x + w * 0.23, obstacle.height * 0.61, obstacle.maxZ + 0.037, 0.84, seed + 1);
    artwork(parent, x, obstacle.height * 0.61, obstacle.minZ - 0.037, 1.0, seed + 2, Math.PI);
  } else {
    artwork(parent, obstacle.maxX + 0.037, obstacle.height * 0.62, z, 0.94, seed, Math.PI / 2);
    artwork(parent, obstacle.minX - 0.037, obstacle.height * 0.62, z, 0.94, seed + 1, -Math.PI / 2);
  }
}

function windowPanel(parent: THREE.Group, x: number, z: number, width: number, angle = 0): void {
  const group = new THREE.Group();
  group.position.set(x, 4.05, z);
  group.rotation.y = angle;
  parent.add(group);
  box(group, '#758f8a', 0, 0, 0, width, 2.25, 0.05, 0.025);
  const glass = new THREE.MeshStandardMaterial({
    color: '#c8ddd6',
    emissive: '#b3d2d1',
    emissiveIntensity: 0.25,
    roughness: 0.45,
  });
  box(group, glass, 0, 0, 0.031, width - 0.13, 2.1, 0.023, 0);
  for (let i = 1; i < 4; i++)
    box(group, cream, -width / 2 + (width * i) / 4, 0, 0.065, 0.055, 2.14, 0.055, 0);
  box(group, cream, 0, -0.22, 0.065, width, 0.055, 0.055, 0);
  box(group, cream, 0, -1.16, 0.11, width + 0.12, 0.14, 0.28, 0.02);
}

function batchStaticMeshes(world: THREE.Group): void {
  world.updateMatrixWorld(true);
  const buckets = new Map<string, THREE.Mesh[]>();
  function surface(object: THREE.Object3D, key: string): unknown {
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
      if (parent.userData[key] !== undefined) return parent.userData[key];
    }
    return undefined;
  }
  world.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const color = surface(object, 'surfaceColor');
    const name = surface(object, 'surfaceName');
    const key = `${object.material.uuid}/${color}/${name}/${object.castShadow}`;
    const entries = buckets.get(key) ?? [];
    entries.push(object);
    buckets.set(key, entries);
  });
  const inverse = world.matrixWorld.clone().invert();
  const matrix = new THREE.Matrix4();
  for (const entries of buckets.values()) {
    if (entries.length < 2) continue;
    const first = entries[0];
    let batch: THREE.Mesh;
    if (entries.every((entry) => entry.geometry === first.geometry)) {
      const instances = new THREE.InstancedMesh(first.geometry, first.material, entries.length);
      entries.forEach((entry, index) => {
        matrix.multiplyMatrices(inverse, entry.matrixWorld);
        instances.setMatrixAt(index, matrix);
      });
      instances.computeBoundingSphere();
      batch = instances;
    } else {
      const parts = entries.map((entry) => {
        matrix.multiplyMatrices(inverse, entry.matrixWorld);
        const part = entry.geometry.index ? entry.geometry.toNonIndexed() : entry.geometry.clone();
        return part.applyMatrix4(matrix);
      });
      const combined = mergeGeometries(parts, false);
      parts.forEach((part) => part.dispose());
      if (!combined) continue;
      combined.computeBoundingSphere();
      batch = new THREE.Mesh(combined, first.material);
    }
    batch.name = `${first.parent?.name || 'Studio detail'} batch`;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.userData.surfaceColor = surface(first, 'surfaceColor');
    batch.userData.surfaceName = surface(first, 'surfaceName');
    entries.forEach((entry) => entry.removeFromParent());
    world.add(batch);
  }
}

export function buildWorld(scene: THREE.Scene): { dispose(): void } {
  const world = new THREE.Group();
  world.name = 'Color House Art School';
  scene.add(world);
  const ambient = new THREE.HemisphereLight('#f4f0df', '#909486', 2.05);
  world.add(ambient);
  const sun = new THREE.DirectionalLight('#ffeed0', 2.1);
  sun.position.set(-20, 42, 15);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -44,
    right: 44,
    top: 42,
    bottom: -42,
    near: 0.5,
    far: 100,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00008;
  sun.shadow.radius = 3;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  world.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#bbd4dd', 0.35);
  fill.position.set(25, 18, -22);
  world.add(fill);

  const floorTextures: THREE.Texture[] = [];
  const baseTexture = makeFloorTexture();
  baseTexture.repeat.set(32, 28);
  floorTextures.push(baseTexture);
  const mainFloor = box(
    world,
    new THREE.MeshStandardMaterial({ color: '#d6cdb5', map: baseTexture, roughness: 0.95 }),
    0,
    -0.16,
    0,
    BOUNDS.maxX - BOUNDS.minX,
    0.32,
    BOUNDS.maxZ - BOUNDS.minZ,
    0,
  );
  mainFloor.userData.surfaceColor = '#d6cdb5';
  mainFloor.userData.surfaceName = 'Main hall floor';
  for (const zone of ZONES) {
    const width = zone.maxX - zone.minX;
    const depth = zone.maxZ - zone.minZ;
    const texture = baseTexture.clone();
    texture.repeat.set(width / 2, depth / 2);
    floorTextures.push(texture);
    const floorColor = new THREE.Color(zone.color);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: floorColor,
      map: texture,
      roughness: 0.97,
    });
    const zoneFloor = box(
      world,
      floorMaterial,
      (zone.minX + zone.maxX) / 2,
      0.006,
      (zone.minZ + zone.maxZ) / 2,
      width - 0.15,
      0.012,
      depth - 0.15,
      0,
    );
    zoneFloor.userData.surfaceColor = zone.color;
    zoneFloor.userData.surfaceName = `${zone.name} floor`;
  }
  // An uninterrupted main corridor and six color-coded thresholds orient players.
  for (const side of [-1, 1]) box(world, '#969e88', 0, 0.014, side * 1.79, 63, 0.018, 0.075, 0);
  for (let i = 0; i < ZONES.length; i++) {
    const zone = ZONES[i];
    const x = i % 3 === 0 ? -22 : i % 3 === 1 ? 0 : 22;
    const north = i < 3;
    const z = north ? -3 : 3;
    box(world, zone.color, x, 0.022, z, 3.85, 0.025, 0.7, 0);
    for (let mark = 0; mark < 4; mark++)
      box(
        world,
        zone.color,
        x,
        0.021,
        z + (north ? -1 : 1) * (1.0 + mark * 0.55),
        0.13,
        0.022,
        0.3,
        0,
      );
    // Door lintels sit above walking/jumping height; the four-metre opening remains clear.
    box(world, '#dad9c8', x, 5.12, z, 4, 1.76, 0.44, 0);
    sign(
      world,
      zone.name,
      `0${i + 1} / COLOR HOUSE`,
      zone.color,
      x,
      4.73,
      z + (north ? 0.235 : -0.235),
      3.65,
      north ? 0 : Math.PI,
    );
    sign(
      world,
      'MAIN HALL',
      'PAINT · MAKE · EXPLORE',
      '#ded8c7',
      x,
      4.73,
      z + (north ? -0.235 : 0.235),
      3.65,
      north ? Math.PI : 0,
    );
    for (const side of [-1, 1])
      box(world, zone.color, x + side * 2.02, 2.09, z, 0.11, 4.18, 0.48, 0);
  }
  for (const x of [-11, 11])
    for (const z of [-16, 16]) {
      box(world, '#dad9c8', x, 5.12, z, 0.44, 1.76, 4, 0);
      for (const side of [-1, 1])
        box(world, '#b8bfac', x, 2.09, z + side * 2.02, 0.48, 4.18, 0.11, 0);
      const west = ZONES.find((zone) => zone.maxX === x && z > zone.minZ && z < zone.maxZ)!;
      const east = ZONES.find((zone) => zone.minX === x && z > zone.minZ && z < zone.maxZ)!;
      sign(world, west.name, 'COLOR HOUSE', west.color, x + 0.235, 4.73, z, 3.65, Math.PI / 2);
      sign(world, east.name, 'COLOR HOUSE', east.color, x - 0.235, 4.73, z, 3.65, -Math.PI / 2);
    }

  for (const [index, obstacle] of OBSTACLES.entries()) {
    const group = new THREE.Group();
    group.name = obstacle.name;
    group.userData.surfaceColor = obstacle.color;
    group.userData.surfaceName = obstacle.name;
    world.add(group);
    switch (obstacle.kind) {
      case 'wall':
        drawWall(group, obstacle);
        break;
      case 'shelf':
        drawShelf(group, obstacle, index);
        break;
      case 'crate':
        drawCrate(group, obstacle, index);
        break;
      case 'table':
        drawTable(group, obstacle, index);
        break;
      case 'planter':
        drawPlanter(group, obstacle);
        break;
      case 'sofa':
        drawSofa(group, obstacle);
        break;
      case 'partition':
        drawPartition(group, obstacle, index);
        break;
    }
  }

  for (const x of [-22, 0, 22]) windowPanel(world, x, -27.465, 8.8);
  for (const z of [-16, 16]) {
    windowPanel(world, -31.465, z, 8.5, Math.PI / 2);
    windowPanel(world, 31.465, z, 8.5, -Math.PI / 2);
  }
  windowPanel(world, -22, 27.465, 8, Math.PI);
  windowPanel(world, 22, 27.465, 8, Math.PI);
  box(world, '#77988d', 0, 2.4, 27.42, 5.9, 4.8, 0.08, 0.03);
  box(world, '#c1d4c6', 0, 2.5, 27.36, 5.55, 4.3, 0.025, 0);
  box(world, cream, 0, 2.5, 27.325, 0.1, 4.34, 0.055, 0);
  sign(world, 'COLOR HOUSE', 'ART SCHOOL / EST. 1986', '#ded8c7', 0, 5.16, 27.32, 6.0, Math.PI);
  sign(
    world,
    'WELCOME TO THE COLOR HOUSE',
    'SIX ROOMS. COUNTLESS PLACES TO DISAPPEAR.',
    '#ded8c7',
    0,
    2.68,
    27.3,
    5.0,
    Math.PI,
  );

  for (let i = 0; i < 6; i++) artwork(world, -28 + i * 10.7, 2.8, -2.755, 1.12, i);
  sign(
    world,
    'WEST',
    '01 PAINT WORKSHOP / 04 SCULPTURE GALLERY',
    '#ded8c7',
    -31.45,
    2.8,
    0,
    4,
    Math.PI / 2,
  );
  sign(
    world,
    'EAST',
    '03 GREENHOUSE / 06 LOADING STUDIO',
    '#ded8c7',
    31.45,
    2.8,
    0,
    4,
    -Math.PI / 2,
  );
  // Ceiling beams leave the large industrial rooms open while retaining scale.
  for (const zone of ZONES) {
    const centerX = (zone.minX + zone.maxX) / 2;
    const centerZ = (zone.minZ + zone.maxZ) / 2;
    for (const offset of [-6, 6]) {
      box(world, '#bec5b6', centerX, 5.88, centerZ + offset, zone.maxX - zone.minX, 0.22, 0.2, 0);
      box(world, '#ebe7d6', centerX, 5.73, centerZ + offset, 3.2, 0.1, 0.32, 0.025);
      const diffuser = new THREE.MeshStandardMaterial({
        color: '#fff4d4',
        emissive: '#fff4d4',
        emissiveIntensity: 0.65,
        roughness: 0.8,
      });
      box(world, diffuser, centerX, 5.672, centerZ + offset, 2.95, 0.025, 0.23, 0);
    }
  }

  batchStaticMeshes(world);

  return {
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>(floorTextures);
      world.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const entries = Array.isArray(object.material) ? object.material : [object.material];
        entries.forEach((entry) => {
          materials.add(entry);
          if (entry instanceof THREE.MeshStandardMaterial && entry.map) textures.add(entry.map);
        });
      });
      geometries.forEach((entry) => entry.dispose());
      materials.forEach((entry) => entry.dispose());
      textures.forEach((entry) => entry.dispose());
      geometryCache.clear();
      materialCache.clear();
      sun.shadow.map?.dispose();
      scene.remove(world);
    },
  };
}
