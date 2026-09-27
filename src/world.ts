import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type Pose = 'stand' | 'crouch' | 'flat';

export interface Avatar {
  group: THREE.Group;
  paint(base: string, accent: string, pattern: 'solid' | 'spots' | 'stripes'): void;
  pose(pose: Pose): void;
  animate(time: number, moving: boolean): void;
}

const cream = '#fff3d9';
const ink = '#3d4647';

function material(color: string, roughness = 0.86): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: string | THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, typeof color === 'string' ? material(color) : color);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
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
  radius = 0.065,
): THREE.Mesh {
  return mesh(
    parent,
    new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)),
    color,
    x,
    y,
    z,
  );
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
  const result = mesh(parent, new THREE.SphereGeometry(1, 24, 16), color, x, y, z);
  result.scale.set(sx, sy, sz);
  return result;
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
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, 24), color, x, y, z);
}

function tube(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  color: string | THREE.Material,
  radius: number,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(parent, new THREE.TubeGeometry(curve, 40, radius, 8, false), color, 0, 0, 0);
}

function plant(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  scale: number,
  potColor: string,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  parent.add(group);
  cylinder(group, potColor, 0, 0.32, 0, 0.44, 0.32, 0.62);
  cylinder(group, potColor, 0, 0.61, 0, 0.47, 0.47, 0.12);
  cylinder(group, '#786e52', 0, 0.675, 0, 0.4, 0.4, 0.018);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399;
    const height = 0.92 + (i % 3) * 0.28;
    const end = new THREE.Vector3(Math.cos(angle) * 0.29, height + 0.34, Math.sin(angle) * 0.29);
    tube(
      group,
      [new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(end.x * 0.5, height, end.z * 0.5), end],
      '#567963',
      0.018,
    );
    const leaf = ball(group, i % 2 ? '#85ad7d' : '#5d9274', end.x, end.y, end.z, 0.16, 0.4, 0.07);
    leaf.rotation.set(Math.sin(angle) * 0.6, angle, Math.cos(angle) * -0.65);
    const vein = box(group, '#9bbd84', end.x, end.y, end.z + 0.005, 0.014, 0.46, 0.012, 0.004);
    vein.rotation.copy(leaf.rotation);
  }
  return group;
}

function paintJar(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: string,
  size = 1,
): void {
  cylinder(parent, color, x, y + 0.12 * size, z, 0.105 * size, 0.105 * size, 0.23 * size);
  cylinder(parent, cream, x, y + 0.245 * size, z, 0.115 * size, 0.115 * size, 0.045 * size);
  box(
    parent,
    '#f9f0d9',
    x,
    y + 0.12 * size,
    z + 0.101 * size,
    0.13 * size,
    0.09 * size,
    0.008,
    0.008,
  );
}

function book(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: string,
  angle = 0,
): void {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = angle;
  parent.add(group);
  box(group, cream, 0, 0.055, 0, 0.43, 0.09, 0.32, 0.012);
  box(group, color, 0, 0.004, 0, 0.47, 0.024, 0.35, 0.012);
  box(group, color, 0, 0.106, 0, 0.47, 0.024, 0.35, 0.012);
  box(group, color, -0.23, 0.055, 0, 0.025, 0.12, 0.35, 0.008);
}

function rug(
  parent: THREE.Object3D,
  x: number,
  z: number,
  w: number,
  d: number,
  color: string,
): void {
  box(parent, color, x, 0.025, z, w, 0.035, d, 0.04);
  for (const side of [-1, 1]) {
    box(parent, '#e8e0c9', x, 0.046, z + side * (d / 2 - 0.14), w - 0.12, 0.009, 0.035, 0.003);
    box(parent, '#e8e0c9', x, 0.046, z + side * (d / 2 - 0.23), w - 0.12, 0.009, 0.018, 0.002);
    for (let i = 0; i < Math.floor(w / 0.12); i++) {
      box(
        parent,
        '#ede3cb',
        x - w / 2 + 0.08 + i * 0.12,
        0.021,
        z + side * (d / 2 + 0.045),
        0.026,
        0.018,
        0.14,
        0.006,
      );
    }
  }
}

export function createAvatar(base = '#83bda8'): Avatar {
  const group = new THREE.Group();
  group.name = 'Chameleon';
  const body = new THREE.Group();
  group.add(body);
  const skin = material(base);
  const lightSkin = material('#c9d995');
  const leftFoot = ball(body, skin, -0.17, 0.13, 0.08, 0.115, 0.12, 0.19);
  const rightFoot = ball(body, skin, 0.17, 0.13, 0.08, 0.115, 0.12, 0.19);
  ball(body, skin, 0, 0.56, 0, 0.31, 0.41, 0.28);
  ball(body, lightSkin, 0, 0.55, 0.231, 0.205, 0.28, 0.06);
  const head = new THREE.Group();
  head.position.y = 1.025;
  body.add(head);
  ball(head, skin, 0, 0, 0.055, 0.36, 0.3, 0.34);
  ball(head, skin, 0, -0.08, 0.3, 0.31, 0.17, 0.17);
  for (const side of [-1, 1]) {
    ball(head, skin, side * 0.29, 0.1, 0.15, 0.17, 0.19, 0.17);
    ball(head, '#fff9e9', side * 0.315, 0.115, 0.264, 0.112, 0.128, 0.08);
    ball(head, ink, side * 0.315, 0.115, 0.329, 0.056, 0.077, 0.026);
    ball(head, '#ffffff', side * 0.298, 0.145, 0.35, 0.02, 0.025, 0.011);
    ball(head, '#d9a88c', side * 0.255, -0.075, 0.36, 0.049, 0.029, 0.013);
    ball(head, '#537862', side * 0.094, -0.025, 0.454, 0.017, 0.012, 0.01);
  }
  tube(
    head,
    [
      new THREE.Vector3(-0.12, -0.14, 0.435),
      new THREE.Vector3(0, -0.163, 0.46),
      new THREE.Vector3(0.12, -0.14, 0.435),
    ],
    '#557962',
    0.009,
  );
  for (let i = 0; i < 4; i++) {
    const crest = mesh(
      head,
      new THREE.ConeGeometry(0.065, 0.13, 4),
      lightSkin,
      0,
      0.265 - i * 0.016,
      0.1 - i * 0.115,
    );
    crest.rotation.y = Math.PI / 4;
  }
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.28, 0.67, 0.01);
    body.add(arm);
    const upper = ball(arm, skin, side * 0.055, -0.14, 0.015, 0.091, 0.22, 0.092);
    upper.rotation.z = side * 0.3;
    ball(arm, skin, side * 0.1, -0.28, 0.055, 0.097, 0.085, 0.1);
    arms.push(arm);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.39, -0.2);
  body.add(tail);
  const tailPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.07, -0.22),
    new THREE.Vector3(0, 0.0, -0.48),
  ];
  for (let i = 0; i <= 20; i++) {
    const angle = -Math.PI / 2 - (i / 20) * Math.PI * 1.85;
    const radius = 0.26 * (1 - i / 27);
    tailPoints.push(
      new THREE.Vector3(0, 0.24 + Math.sin(angle) * radius, -0.48 + Math.cos(angle) * radius),
    );
  }
  tube(tail, tailPoints, skin, 0.065);
  let currentPose: Pose = 'stand';
  let currentScale = 1;
  let currentWidth = 1;
  let texture: THREE.CanvasTexture | null = null;

  function paint(baseColor: string, accent: string, pattern: 'solid' | 'spots' | 'stripes'): void {
    texture?.dispose();
    texture = null;
    skin.map = null;
    skin.color.set(baseColor);
    lightSkin.color.set(baseColor).lerp(new THREE.Color('#fff4c5'), 0.4);
    if (pattern !== 'solid') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = accent;
        if (pattern === 'spots') {
          for (let row = 0; row < 4; row++) {
            for (let column = 0; column < 4; column++) {
              ctx.beginPath();
              ctx.ellipse(
                column * 64 + 22 + (row % 2) * 18,
                row * 64 + 30,
                13,
                17,
                0.4,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
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
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        skin.map = texture;
        skin.color.set('#ffffff');
      }
    }
    skin.needsUpdate = true;
  }

  paint(base, '#5a8d79', 'solid');
  return {
    group,
    paint,
    pose(pose) {
      currentPose = pose;
    },
    animate(time, moving) {
      const scaleTarget = currentPose === 'flat' ? 0.24 : currentPose === 'crouch' ? 0.63 : 1;
      const widthTarget = currentPose === 'flat' ? 1.35 : currentPose === 'crouch' ? 1.1 : 1;
      currentScale = THREE.MathUtils.lerp(currentScale, scaleTarget, 0.18);
      currentWidth = THREE.MathUtils.lerp(currentWidth, widthTarget, 0.18);
      body.scale.set(currentWidth, currentScale, currentWidth);
      body.position.y = moving
        ? Math.abs(Math.sin(time * 11)) * 0.047 * currentScale
        : Math.sin(time * 2.5) * 0.013 * currentScale;
      head.rotation.z = Math.sin(time * 2) * 0.025;
      tail.rotation.y = Math.sin(time * (moving ? 8 : 2.2)) * (moving ? 0.2 : 0.09);
      leftFoot.rotation.x = moving ? Math.sin(time * 11) * 0.55 : 0;
      rightFoot.rotation.x = moving ? -Math.sin(time * 11) * 0.55 : 0;
      arms[0].rotation.x = moving ? -Math.sin(time * 11) * 0.45 : Math.sin(time * 2.5) * 0.03;
      arms[1].rotation.x = moving ? Math.sin(time * 11) * 0.45 : -Math.sin(time * 2.5) * 0.03;
    },
  };
}

export function buildWorld(scene: THREE.Scene): {
  updateView(cameraPosition: THREE.Vector3): void;
  dispose(): void;
} {
  const world = new THREE.Group();
  world.name = 'The Color House';
  scene.add(world);

  const ambient = new THREE.HemisphereLight('#fff6df', '#aaa6bd', 2.6);
  world.add(ambient);
  const sun = new THREE.DirectionalLight('#fff1d4', 3.2);
  sun.position.set(2, 10, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.1,
    far: 35,
  });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.0001;
  sun.shadow.radius = 5;
  world.add(sun);
  const fill = new THREE.DirectionalLight('#c6dbf2', 0.8);
  fill.position.set(-5, 5, -3);
  world.add(fill);

  box(world, '#bfab87', 0, -0.27, 0, 12.35, 0.54, 10.35, 0.25);
  box(world, '#f6e8cc', 0, -0.095, 0, 12.3, 0.18, 10.3, 0.11);
  const floorGeometry = new THREE.BoxGeometry(0.998, 0.03, 0.998);
  const floorMaterials = [material('#dfcda8'), material('#ecddbe')];
  for (let x = 0; x < 12; x++) {
    for (let z = 0; z < 10; z++)
      mesh(world, floorGeometry, floorMaterials[(x + z) % 2], x - 5.5, -0.011, z - 4.5);
  }

  const backWall = new THREE.Group();
  backWall.name = 'Back wall and attached decor';
  const leftWall = new THREE.Group();
  leftWall.name = 'Left wall and attached decor';
  world.add(backWall, leftWall);

  box(backWall, '#b9cebc', 0, 2.4, -5.06, 12.25, 4.8, 0.2, 0.065);
  box(leftWall, '#edc6ab', -6.06, 2.4, 0, 0.2, 4.8, 10.25, 0.065);
  box(backWall, '#d5dfc8', 0, 4.79, -5.045, 12.26, 0.13, 0.25, 0.04);
  box(leftWall, '#f2d5b9', -6.045, 4.79, 0, 0.25, 0.13, 10.24, 0.04);
  box(backWall, '#f4e8cf', 0, 0.16, -4.92, 12, 0.28, 0.11, 0.02);
  box(leftWall, '#f4e8cf', -5.92, 0.16, 0, 0.11, 0.28, 10, 0.02);

  // The broad studio window provides a cool counterpoint to the warm furniture.
  box(backWall, '#90afbd', 3.28, 3.07, -4.92, 3.78, 2.57, 0.06, 0.13);
  box(backWall, '#d9e8e3', 3.28, 3.1, -4.86, 3.5, 2.27, 0.07, 0.07);
  const sky = new THREE.MeshStandardMaterial({
    color: '#c8e2df',
    roughness: 0.8,
    emissive: '#bbd9dc',
    emissiveIntensity: 0.12,
  });
  box(backWall, sky, 3.28, 3.1, -4.805, 3.3, 2.1, 0.045, 0.02);
  ball(backWall, '#f9e8b1', 4.2, 3.66, -4.77, 0.29, 0.29, 0.02);
  for (let i = 0; i < 4; i++) {
    ball(
      backWall,
      i % 2 ? '#afc8b0' : '#bad1bf',
      1.9 + i * 0.85,
      2.14 + (i % 2) * 0.07,
      -4.76,
      0.68,
      0.4,
      0.025,
    );
  }
  box(backWall, cream, 3.28, 3.1, -4.69, 0.085, 2.23, 0.1, 0.014);
  box(backWall, cream, 3.28, 3.1, -4.69, 3.5, 0.085, 0.1, 0.014);
  box(backWall, cream, 3.28, 1.93, -4.7, 3.92, 0.16, 0.43, 0.04);
  plant(backWall, 4.59, 2.01, -4.63, 0.43, '#d6977c');

  // A framed, original paper-cut style landscape over the sofa.
  box(backWall, '#bf9271', -3.25, 3.42, -4.87, 2.19, 1.85, 0.17, 0.045);
  box(backWall, '#fff1d4', -3.25, 3.42, -4.765, 1.98, 1.64, 0.055, 0.012);
  ball(backWall, '#e8b75f', -2.91, 3.75, -4.715, 0.27, 0.27, 0.02);
  const hill = ball(backWall, '#93b2a0', -3.62, 3.15, -4.71, 0.55, 0.43, 0.022);
  hill.rotation.z = -0.25;
  ball(backWall, '#d39680', -2.97, 2.99, -4.675, 0.67, 0.3, 0.022);
  box(backWall, '#edd8b5', -3.25, 2.73, -4.64, 1.98, 0.21, 0.035, 0.006);

  // Floating shelves and their deliberately mismatched paint collection.
  box(backWall, '#bd946c', -0.39, 3.58, -4.64, 1.94, 0.14, 0.54, 0.035);
  box(backWall, '#bd946c', -0.39, 2.57, -4.64, 1.94, 0.14, 0.54, 0.035);
  const jarColors = ['#e899ac', '#e6ba64', '#83bda8', '#b4a6d4'];
  for (let i = 0; i < 4; i++) paintJar(backWall, -1.03 + i * 0.42, 3.66, -4.61, jarColors[i], 1.18);
  book(backWall, -0.94, 2.65, -4.61, '#db9a83', -0.06);
  book(backWall, -0.91, 2.78, -4.61, '#8baab6', 0.07);
  plant(backWall, 0.17, 2.65, -4.6, 0.45, '#eee0bd');
  for (const x of [-1.08, 0.27]) {
    box(backWall, '#9b795d', x, 3.44, -4.82, 0.06, 0.22, 0.2, 0.015);
    box(backWall, '#9b795d', x, 2.44, -4.82, 0.06, 0.22, 0.2, 0.015);
  }

  rug(world, -2, 1.95, 3.6, 3.3, '#83bda8');
  rug(world, 3.8, -0.15, 3, 3.1, '#b4a6d4');

  // Sofa footprint: x[-4.7,-1.3], z[-3.9,-2.3].
  const couch = new THREE.Group();
  couch.position.set(-3, 0, -3.1);
  world.add(couch);
  for (const x of [-1.38, 1.38])
    for (const z of [-0.54, 0.54]) cylinder(couch, '#b28969', x, 0.18, z, 0.085, 0.065, 0.32);
  box(couch, '#d48097', 0, 0.43, 0, 3.34, 0.45, 1.55, 0.17);
  box(couch, '#e899ac', 0, 0.98, -0.58, 3.34, 1.02, 0.43, 0.19);
  for (const x of [-1.49, 1.49]) box(couch, '#e899ac', x, 0.76, 0.035, 0.42, 0.65, 1.51, 0.19);
  for (const x of [-0.68, 0.68]) box(couch, '#efa6b7', x, 0.72, 0.085, 1.31, 0.3, 1.16, 0.145);
  const pillowA = box(couch, '#f6d596', -0.94, 1.0, -0.2, 0.62, 0.58, 0.24, 0.16);
  pillowA.rotation.set(-0.15, 0.12, -0.2);
  const pillowB = box(couch, '#adbaa0', 0.97, 1.0, -0.22, 0.54, 0.59, 0.23, 0.16);
  pillowB.rotation.set(-0.16, -0.1, 0.19);
  box(couch, '#f1d6bf', 0.46, 0.905, 0.38, 0.51, 0.04, 0.71, 0.025);
  box(couch, '#f1d6bf', 0.46, 0.65, 0.695, 0.51, 0.51, 0.04, 0.02);
  for (let i = 0; i < 4; i++)
    box(couch, '#dba890', 0.27 + i * 0.13, 0.653, 0.72, 0.025, 0.49, 0.008, 0.002);

  // Writing desk footprint: x[1.5,4.8], z[-4,-2.5].
  const desk = new THREE.Group();
  desk.position.set(3.15, 0, -3.25);
  world.add(desk);
  box(desk, '#d9ad75', 0, 1.11, 0, 3.3, 0.19, 1.5, 0.09);
  box(desk, '#c79969', 0, 0.86, -0.05, 2.93, 0.31, 1.21, 0.025);
  for (const x of [-1.36, 1.36])
    for (const z of [-0.53, 0.53]) box(desk, '#c09262', x, 0.48, z, 0.16, 0.94, 0.16, 0.025);
  box(desk, '#e4bb83', 0, 0.84, 0.575, 1.09, 0.28, 0.06, 0.025);
  cylinder(desk, '#b38358', 0, 0.84, 0.623, 0.055, 0.055, 0.035).rotation.x = Math.PI / 2;
  const paper = box(desk, '#fff5dc', -0.13, 1.218, 0.03, 1.14, 0.018, 0.76, 0.008);
  paper.rotation.y = -0.13;
  ball(desk, '#90b9a5', -0.19, 1.235, 0.07, 0.22, 0.008, 0.2);
  ball(desk, '#e5bc6c', 0.06, 1.238, -0.02, 0.1, 0.008, 0.09);
  paintJar(desk, 1.18, 1.22, -0.28, '#b4a6d4', 1.3);
  paintJar(desk, 0.92, 1.22, 0.17, '#e899ac', 1.1);
  cylinder(desk, '#efe1be', -1.23, 1.41, -0.33, 0.15, 0.13, 0.38);
  for (let i = 0; i < 5; i++) {
    const brush = cylinder(
      desk,
      i % 2 ? '#9ba994' : '#c58a6b',
      -1.29 + i * 0.03,
      1.7,
      -0.33 + (i % 2) * 0.035,
      0.015,
      0.015,
      0.55,
    );
    brush.rotation.z = (i - 2) * 0.075;
  }
  book(desk, -0.92, 1.22, 0.3, '#87a99e', -0.1);
  const stool = new THREE.Group();
  stool.position.set(3.16, 0, -2.87);
  world.add(stool);
  cylinder(stool, '#e7c891', 0, 0.58, 0, 0.34, 0.34, 0.14);
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    cylinder(
      stool,
      '#bd9569',
      Math.cos(angle) * 0.23,
      0.27,
      Math.sin(angle) * 0.23,
      0.04,
      0.052,
      0.55,
    );
  }

  // Paint cupboard footprint: x[-5.7,-4.7], z[-0.9,1.1].
  box(world, '#73a892', -5.25, 0.69, 0.1, 0.9, 1.36, 2, 0.065);
  box(world, '#a4cbb3', -5.2, 1.4, 0.1, 1, 0.13, 2, 0.045);
  for (let i = 0; i < 3; i++) {
    box(world, '#83bda8', -4.765, 0.29 + i * 0.4, 0.1, 0.045, 0.34, 1.83, 0.025);
    box(world, '#e8d8ac', -4.72, 0.29 + i * 0.4, 0.1, 0.04, 0.045, 0.37, 0.012);
  }
  plant(world, -5.25, 1.48, -0.5, 0.54, '#e7b66f');
  for (let i = 0; i < 3; i++) paintJar(world, -5.12, 1.48, 0.04 + i * 0.31, jarColors[i], 1.05);

  // Tall rubber plant footprint: x[3.8,4.9], z[2.7,3.8].
  plant(world, 4.35, 0, 3.25, 1.13, '#d98869');

  // Lavender display plinth footprint: x[1.1,2.1], z[-0.3,0.7].
  box(world, '#b4a6d4', 1.6, 0.35, 0.2, 1, 0.7, 1, 0.09);
  box(world, '#c6bbdf', 1.6, 0.73, 0.2, 1, 0.09, 1, 0.055);
  const sculpture = new THREE.Group();
  sculpture.position.set(1.6, 0.785, 0.2);
  world.add(sculpture);
  cylinder(sculpture, '#f5e7cd', 0, 0.07, 0, 0.24, 0.24, 0.14);
  const sculptureArc = mesh(
    sculpture,
    new THREE.TorusGeometry(0.19, 0.075, 12, 32, Math.PI * 1.65),
    '#f5e7cd',
    0,
    0.3,
    0,
  );
  sculptureArc.rotation.z = -0.35;
  ball(sculpture, '#e4b665', 0.025, 0.3, 0.02, 0.088);

  // Small hanging banners on the peach wall make the studio feel inhabited.
  for (let i = 0; i < 3; i++) {
    box(leftWall, '#c2946f', -5.87, 3.49, 0.3 + i * 0.98, 0.09, 1.05, 0.74, 0.025);
    box(
      leftWall,
      ['#efe1be', '#b8c9b0', '#dfb1a6'][i],
      -5.8,
      3.49,
      0.3 + i * 0.98,
      0.04,
      0.91,
      0.6,
      0.014,
    );
    ball(
      leftWall,
      ['#d7a466', '#779f8f', '#b18ba2'][i],
      -5.768,
      3.54,
      0.3 + i * 0.98,
      0.018,
      0.23,
      0.22,
    );
  }

  return {
    updateView(cameraPosition) {
      // Cut away the near walls as the view crosses to their outside quadrant.
      // A small dead zone keeps edge-on views from flickering during a rotation.
      if (cameraPosition.z < -0.25) backWall.visible = false;
      else if (cameraPosition.z > 0.25) backWall.visible = true;
      if (cameraPosition.x < -0.25) leftWall.visible = false;
      else if (cameraPosition.x > 0.25) leftWall.visible = true;
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      world.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          if (Array.isArray(object.material))
            object.material.forEach((entry) => materials.add(entry));
          else materials.add(object.material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((entry) => entry.dispose());
      sun.shadow.map?.dispose();
      scene.remove(world);
    },
  };
}
