export interface Box {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  color: string;
  kind: 'wall' | 'crate' | 'shelf' | 'table' | 'planter' | 'sofa' | 'partition';
  name: string;
}

export const BOUNDS = { minX: -32, maxX: 32, minZ: -28, maxZ: 28 };
export const SPAWN = { x: 0, z: 24 };

export const ZONES = [
  { name: 'Paint Workshop', minX: -32, maxX: -11, minZ: -28, maxZ: -3, color: '#e0bc83' },
  { name: 'Archive', minX: -11, maxX: 11, minZ: -28, maxZ: -3, color: '#b4a6d4' },
  { name: 'Greenhouse', minX: 11, maxX: 32, minZ: -28, maxZ: -3, color: '#83bda8' },
  { name: 'Sculpture Gallery', minX: -32, maxX: -11, minZ: 3, maxZ: 28, color: '#d98869' },
  { name: 'Reception', minX: -11, maxX: 11, minZ: 3, maxZ: 28, color: '#e899ac' },
  { name: 'Loading Studio', minX: 11, maxX: 32, minZ: 3, maxZ: 28, color: '#d9ad75' },
];

const boxes: Box[] = [];
function add(
  id: string,
  name: string,
  kind: Box['kind'],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  height: number,
  color: string,
): void {
  boxes.push({ id, name, kind, minX, maxX, minZ, maxZ, height, color });
}

// Wall coordinates are the same geometry used by rendering, navigation and sight.
add('outer-west', 'West exterior wall', 'wall', -32, -31.5, -28, 28, 6, '#e5d5bf');
add('outer-east', 'East exterior wall', 'wall', 31.5, 32, -28, 28, 6, '#d7ded0');
add('outer-north', 'North exterior wall', 'wall', -32, 32, -28, -27.5, 6, '#d7ded0');
add('outer-south', 'South exterior wall', 'wall', -32, 32, 27.5, 28, 6, '#e5d5bf');
for (const z of [-3, 3]) {
  const spans = [
    [-32, -24],
    [-20, -2],
    [2, 20],
    [24, 32],
  ];
  for (let i = 0; i < spans.length; i++)
    add(
      `hall-${z}-${i}`,
      'Hall wall',
      'wall',
      spans[i][0],
      spans[i][1],
      z - 0.22,
      z + 0.22,
      6,
      '#e5dfcf',
    );
}
for (const x of [-11, 11]) {
  for (const [index, span] of [
    [-28, -18],
    [-14, -3],
    [3, 14],
    [18, 28],
  ].entries()) {
    add(
      `room-divider-${x}-${index}`,
      'Room divider',
      'wall',
      x - 0.22,
      x + 0.22,
      span[0],
      span[1],
      6,
      x < 0 ? '#ded4c8' : '#d4ddcc',
    );
  }
}

// Paint workshop: deep shelving and two offset partitions make a winding route.
add('paint-shelf-west', 'Pigment library', 'shelf', -30.7, -29.3, -24.5, -16.5, 3.5, '#83bda8');
add('paint-shelf-north', 'Paint drying rack', 'shelf', -18.5, -13.0, -26.8, -25.3, 3.2, '#d9ad75');
add('paint-table-near', 'Mixing workbench', 'table', -29.0, -24.5, -10.7, -8.4, 1.12, '#d9ad75');
add(
  'paint-table-far',
  'Printmaking workbench',
  'table',
  -20.0,
  -14.5,
  -22.7,
  -20.3,
  1.16,
  '#d9ad75',
);
add(
  'paint-screen-a',
  'Mint drying screen',
  'partition',
  -26.0,
  -20.0,
  -15.0,
  -14.4,
  2.9,
  '#83bda8',
);
add(
  'paint-screen-b',
  'Mint screen return',
  'partition',
  -26.0,
  -25.4,
  -19.6,
  -15.0,
  2.9,
  '#83bda8',
);
add('paint-crate-a', 'Blush pigment crate', 'crate', -18.8, -16.8, -10.1, -8.1, 1.3, '#e899ac');
add(
  'paint-crate-b',
  'Terracotta pigment crate',
  'crate',
  -28.0,
  -26.0,
  -26.3,
  -24.3,
  1.7,
  '#d98869',
);
add('paint-step', 'Low mixing box', 'crate', -22.8, -20.8, -23.6, -22.1, 0.46, '#b4a6d4');
add('paint-plant', 'Workshop rubber plant', 'planter', -14.7, -13.3, -7.7, -6.3, 0.95, '#d98869');

// Archive: staggered, solid-backed shelving creates several hidden aisles.
add('archive-shelf-a', 'Indigo folio shelf', 'shelf', -8.3, -6.8, -25.8, -19.6, 3.6, '#b4a6d4');
add('archive-shelf-b', 'Sage folio shelf', 'shelf', -2.5, -1.0, -23.4, -17.7, 3.6, '#83bda8');
add('archive-shelf-c', 'Ochre folio shelf', 'shelf', 3.6, 5.1, -26.2, -20.5, 3.6, '#d9ad75');
add('archive-shelf-d', 'Blush folio shelf', 'shelf', 6.3, 8.0, -12.3, -6.0, 3.3, '#e899ac');
add('archive-shelf-e', 'Reference shelf', 'shelf', -8.4, -3.6, -11.1, -9.6, 3.2, '#d9ad75');
add('archive-table', 'Map reading table', 'table', -1.5, 3.7, -11.2, -8.9, 1.1, '#d9ad75');
add('archive-crate-a', 'Lavender print case', 'crate', 6.7, 8.7, -25.3, -23.3, 1.3, '#b4a6d4');
add('archive-crate-b', 'Mint folio box', 'crate', -5.8, -3.8, -26.3, -24.3, 0.95, '#83bda8');
add(
  'archive-screen',
  'Archive display screen',
  'partition',
  1.8,
  6.2,
  -15.4,
  -14.8,
  2.6,
  '#b4a6d4',
);
add('archive-step', 'Low archive box', 'crate', -8.7, -7.0, -6.9, -5.4, 0.45, '#e899ac');

// Greenhouse: planter islands alternate with potting benches and tall screens.
add('green-bed-a', 'Mint raised bed', 'planter', 14.4, 18.3, -24.4, -21.8, 1.0, '#83bda8');
add('green-bed-b', 'Terracotta raised bed', 'planter', 25.0, 29.1, -12.0, -9.4, 1.0, '#d98869');
add('green-bed-c', 'Central propagation bed', 'planter', 21.0, 24.8, -20.0, -17.5, 1.25, '#83bda8');
add('green-shelf', 'Botanical specimen shelf', 'shelf', 29.6, 30.9, -24.8, -18.1, 3.2, '#d9ad75');
add('green-table', 'Potting bench', 'table', 14.0, 18.8, -9.6, -7.4, 1.15, '#d9ad75');
add('green-screen-a', 'Botanical screen', 'partition', 15.0, 20.0, -13.8, -13.2, 3.0, '#83bda8');
add(
  'green-screen-b',
  'Botanical screen return',
  'partition',
  19.4,
  20.0,
  -13.8,
  -10.0,
  3.0,
  '#83bda8',
);
add('green-crate', 'Clay pot crate', 'crate', 25.8, 27.9, -26.1, -23.8, 1.6, '#d98869');
add('green-step', 'Seedling step', 'crate', 21.7, 23.7, -8.5, -7.0, 0.42, '#d9ad75');
add('green-pot', 'Ceramic specimen pot', 'planter', 28.2, 29.8, -6.7, -5.1, 1.3, '#b4a6d4');

// Sculpture gallery: offset exhibition walls, sculptures and low platforms.
add(
  'gallery-screen-a',
  'Pink exhibition wall',
  'partition',
  -28.8,
  -22.7,
  9.0,
  9.7,
  3.4,
  '#e899ac',
);
add(
  'gallery-screen-b',
  'Lavender exhibition wall',
  'partition',
  -20.1,
  -14.0,
  21.0,
  21.7,
  3.4,
  '#b4a6d4',
);
add(
  'gallery-screen-c',
  'Terracotta exhibition wall',
  'partition',
  -24.4,
  -23.7,
  18.8,
  24.6,
  3.4,
  '#d98869',
);
add('gallery-plinth-a', 'Sage sculpture plinth', 'crate', -28.8, -26.6, 20.0, 22.2, 1.3, '#83bda8');
add(
  'gallery-plinth-b',
  'Lilac sculpture plinth',
  'crate',
  -18.5,
  -16.3,
  10.0,
  12.2,
  1.6,
  '#b4a6d4',
);
add(
  'gallery-plinth-c',
  'Rose sculpture plinth',
  'crate',
  -21.5,
  -19.3,
  25.0,
  26.8,
  0.65,
  '#e899ac',
);
add('gallery-sofa', 'Gallery bench', 'sofa', -30.8, -29.1, 12.0, 16.0, 1.15, '#e899ac');
add('gallery-crate', 'Covered sculpture case', 'crate', -17.9, -15.4, 25.0, 27.0, 2.0, '#d9ad75');
add('gallery-plant', 'Gallery palm', 'planter', -14.3, -12.7, 5.2, 6.8, 1.1, '#d98869');
add('gallery-step', 'Low display platform', 'crate', -28.1, -25.1, 5.2, 6.5, 0.4, '#b4a6d4');

// Reception has generous spawn clearance; its hiding nooks are at the far end.
add('reception-desk', 'Welcome counter', 'partition', -7.9, -2.5, 9.3, 10.6, 1.5, '#d9ad75');
add('reception-screen', 'Information screen', 'partition', 3.0, 8.7, 10.8, 11.5, 2.8, '#e899ac');
add(
  'reception-return',
  'Information screen return',
  'partition',
  8.0,
  8.7,
  6.5,
  10.8,
  2.8,
  '#e899ac',
);
add('reception-sofa-west', 'Sage waiting sofa', 'sofa', -9.6, -7.8, 19.0, 23.5, 1.3, '#83bda8');
add('reception-sofa-east', 'Rose waiting sofa', 'sofa', 7.8, 9.6, 19.0, 23.5, 1.3, '#e899ac');
add('reception-table', 'Reception coffee table', 'table', -5.2, -2.5, 19.0, 20.7, 0.65, '#d9ad75');
add('reception-shelf', 'Course materials shelf', 'shelf', -9.5, -8.1, 4.8, 9.3, 3.1, '#b4a6d4');
add('reception-planter', 'Welcome planter', 'planter', 4.0, 5.7, 5.1, 6.8, 1.1, '#d98869');
add('reception-step', 'Welcome display stand', 'crate', -4.8, -3.1, 5.5, 7.2, 0.5, '#b4a6d4');

// Loading studio: stacked shipping cases form a second, deliberately uneven maze.
add(
  'loading-crate-a',
  'Tall lavender shipping case',
  'crate',
  14.0,
  16.8,
  7.0,
  9.8,
  2.7,
  '#b4a6d4',
);
add('loading-crate-b', 'Mint shipping case', 'crate', 18.0, 21.0, 11.0, 14.0, 1.9, '#83bda8');
add('loading-crate-c', 'Rose shipping case', 'crate', 24.7, 27.3, 7.0, 9.6, 2.2, '#e899ac');
add('loading-crate-d', 'Ochre shipping case', 'crate', 27.5, 30.2, 17.3, 20.0, 2.5, '#d9ad75');
add('loading-crate-e', 'Clay shipping case', 'crate', 22.5, 25.5, 23.5, 26.5, 1.8, '#d98869');
add('loading-crate-f', 'Mint packing box', 'crate', 14.0, 16.2, 23.5, 25.7, 1.1, '#83bda8');
add('loading-screen', 'Packing divider', 'partition', 20.7, 21.4, 17.9, 23.3, 3.2, '#d9ad75');
add('loading-shelf', 'Packing supply shelf', 'shelf', 29.2, 30.8, 5.0, 12.0, 3.4, '#83bda8');
add('loading-table', 'Packing workbench', 'table', 13.8, 18.2, 19.0, 21.2, 1.2, '#d9ad75');
add('loading-step-a', 'Low packing step', 'crate', 24.2, 26.2, 12.2, 13.7, 0.45, '#e899ac');
add('loading-step-b', 'Packing step', 'crate', 24.2, 26.2, 13.7, 15.2, 0.9, '#e899ac');

export const OBSTACLES: Box[] = boxes;

export interface HideSpot {
  x: number;
  z: number;
  angle: number;
  pose: 'stand' | 'crouch' | 'flat';
  color: string;
}

// Place hiding candidates against the far side of actual cover. Every candidate
// has standing-radius clearance and lies at least twelve metres from spawn.
export const HIDE_SPOTS: HideSpot[] = [];
for (const obstacle of OBSTACLES.filter((entry) => entry.kind !== 'wall')) {
  const cx = (obstacle.minX + obstacle.maxX) / 2;
  const cz = (obstacle.minZ + obstacle.maxZ) / 2;
  const dx = cx - SPAWN.x;
  const dz = cz - SPAWN.z;
  const alongX = Math.abs(dx) > Math.abs(dz);
  const side = Math.sign(alongX ? dx : dz) || -1;
  const candidates = alongX
    ? [-0.24, 0.24].map((offset) => ({
        x: side > 0 ? obstacle.maxX + 0.48 : obstacle.minX - 0.48,
        z: cz + (obstacle.maxZ - obstacle.minZ) * offset,
      }))
    : [-0.24, 0.24].map((offset) => ({
        x: cx + (obstacle.maxX - obstacle.minX) * offset,
        z: side > 0 ? obstacle.maxZ + 0.48 : obstacle.minZ - 0.48,
      }));
  for (const point of candidates) {
    if (Math.hypot(point.x - SPAWN.x, point.z - SPAWN.z) <= 12) continue;
    if (
      point.x < BOUNDS.minX + 0.85 ||
      point.x > BOUNDS.maxX - 0.85 ||
      point.z < BOUNDS.minZ + 0.85 ||
      point.z > BOUNDS.maxZ - 0.85
    )
      continue;
    if (
      OBSTACLES.some(
        (box) =>
          point.x > box.minX - 0.36 &&
          point.x < box.maxX + 0.36 &&
          point.z > box.minZ - 0.36 &&
          point.z < box.maxZ + 0.36,
      )
    )
      continue;
    if (HIDE_SPOTS.some((other) => Math.hypot(point.x - other.x, point.z - other.z) < 0.9))
      continue;
    HIDE_SPOTS.push({
      ...point,
      angle: alongX ? (side * Math.PI) / 2 : side < 0 ? Math.PI : 0,
      pose: obstacle.height >= 1.7 ? 'stand' : obstacle.height >= 0.8 ? 'crouch' : 'flat',
      color: obstacle.color,
    });
  }
}

export const PATROL_POINTS = [
  { x: 0, z: 24 },
  { x: 0, z: 16 },
  { x: 0, z: 5 },
  { x: 0, z: 0 },
  { x: -22, z: 0 },
  { x: -22, z: -6 },
  { x: -22, z: -11.5 },
  { x: -28, z: -14 },
  { x: -28, z: -21.5 },
  { x: -23, z: -21 },
  { x: -22, z: -25 },
  { x: -13, z: -18 },
  { x: -11, z: -16 },
  { x: -5, z: -16 },
  { x: -5, z: -21 },
  { x: 1, z: -25.5 },
  { x: 7, z: -19 },
  { x: 9, z: -16 },
  { x: 11, z: -16 },
  { x: 16, z: -18 },
  { x: 19, z: -25 },
  { x: 24, z: -22 },
  { x: 27, z: -16 },
  { x: 23, z: -12 },
  { x: 22, z: -5 },
  { x: 22, z: 0 },
  { x: 22, z: 5 },
  { x: 22.5, z: 10.5 },
  { x: 28.5, z: 14 },
  { x: 25, z: 21 },
  { x: 18, z: 25.5 },
  { x: 18.5, z: 17 },
  { x: 11, z: 16 },
  { x: 4, z: 16 },
  { x: -4, z: 16 },
  { x: -11, z: 16 },
  { x: -17, z: 16 },
  { x: -22, z: 18 },
  { x: -27, z: 18 },
  { x: -26, z: 25 },
  { x: -21, z: 23 },
  { x: -22, z: 6 },
  { x: -22, z: 0 },
  { x: 0, z: 0 },
];
