import * as THREE from 'three';
import { Game, PALETTE, type Role, type Pose, type Pattern } from './game';
import { buildWorld, createAvatar, type Avatar } from './world';
import './style.css';

const icons: Record<string, string> = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  hide: '<path d="m3 3 18 18M10.5 5.1A12 12 0 0 1 22 12a18 18 0 0 1-3.1 3.7M6.3 6.3A19 19 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5.7-1.7M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 .8-2 1-2 3m0 3v.1"/>',
  dropper: '<path d="m14 5 5 5M3 21l4-1L20 7a2.1 2.1 0 0 0-3-3L4 17l-1 4Z"/>',
  leaf: '<path d="M20 3C8 2 2 9 5 16s17 8 15-13ZM5 20 16 9"/>',
  rotate: '<path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14m-7-7v14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  stand: '<circle cx="12" cy="4" r="2"/><path d="M12 7v8m0-6L7 12m5-3 5 3m-5 3-4 6m4-6 4 6"/>',
  crouch:
    '<circle cx="11" cy="5" r="2"/><path d="m11 8-1 5 5 3-5 4h7m-6-10 5 2 3-3M10 13l-5 3 3 4H3"/>',
  flat: '<circle cx="5" cy="15" r="2"/><path d="M8 16h7l5 3m-9-3 3 4m1-4 5-3M2 22h20"/>',
  spark: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = (name: string, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
const brandMark =
  '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="20" fill="#ee714d"/><path d="M44 36c12 0 11 17 1 17-7 0-9-9-3-9M44 36H24c-15 0-17-19-4-23 9-3 22 4 25 13z" fill="none" stroke="#fff8e9" stroke-width="5" stroke-linecap="round"/><circle cx="22" cy="23" r="3" fill="#fff8e9"/></svg>';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

$('#app').innerHTML = `
  <div class="shell">
    <header>
      <a class="brand" href="./" aria-label="Meccha Chameleon home">${brandMark}<div class="wordmark">MECCHA<span>CHAMELEON</span></div></a>
      <nav class="top-links" aria-label="Main navigation">
        <span class="nav-button active"><span class="dot"></span> The playground</span>
        <button class="nav-button" id="help-button">${icon('help')} How to play</button>
        <span class="top-divider"></span>
        <button class="nav-button" id="sound-button" aria-pressed="false">${icon('mute')} Sound off</button>
      </nav>
    </header>
    <main>
      <section class="intro" aria-labelledby="page-title">
        <div><p class="eyebrow">The art of hiding in plain sight</p><h1 id="page-title">Out of sight. <em>Into the fun.</em></h1></div>
        <div class="intro-note">${icon('spark', 'doodle')}<p>A little paint. A perfect pose.<br>Be the thing nobody notices.</p></div>
      </section>
      <div class="game-layout">
        <section class="stage-card" aria-label="Game playground">
          <div id="stage" class="stage" data-phase="ready">
            <div class="scene-label"><div class="room-tag"><span>01</span> YOUR LITTLE HIDEAWAY</div><h2>The art room</h2></div>
            <div class="map-time" id="timer"><span class="live-dot"></span> A little room, endless possibilities</div>
            <div class="round-banner" id="round-banner" role="status"></div>
            <div class="stage-hint"><small id="hint-label">WELCOME TO THE COLOR CLUB</small><p id="stage-hint">Make yourself at home.<br>Then make yourself <strong>disappear.</strong></p></div>
            <div class="stage-tools">
              <button class="tool-btn" id="rotate" aria-label="Rotate camera" title="Rotate camera (Q)">${icon('rotate')}</button>
              <button class="tool-btn" id="zoom-out" aria-label="Zoom out" title="Zoom out">${icon('minus')}</button>
              <button class="tool-btn" id="zoom-in" aria-label="Zoom in" title="Zoom in">${icon('plus')}</button>
              <button class="tool-btn" id="pause" aria-label="Pause game" title="Pause (Escape)">${icon('pause')}</button>
            </div>
            <div class="touch-controls" aria-label="Movement controls"><button data-move="up" aria-label="Move forward">↑</button><button data-move="left" aria-label="Move left">←</button><button data-move="down" aria-label="Move backward">↓</button><button data-move="right" aria-label="Move right">→</button></div>
            <div class="pause-screen" id="pause-screen" hidden><p class="eyebrow">Take a breather</p><h2>Perfectly still.</h2><button class="start-button" id="resume">Keep playing ${icon('arrow')}</button><button class="secondary-button" id="restart">Start a new round</button></div>
          </div>
          <div class="stage-bottom"><div class="keyboard-hint"><span class="key-pair"><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> Move</span><span class="key-pair"><kbd>E</kbd> Match color</span><span class="key-pair optional"><kbd>R</kbd> Pose</span><span class="key-pair optional"><kbd>Q</kbd> Rotate</span></div><span class="view-label">${icon('leaf')} CLICK THE FLOOR TO MOVE</span></div>
        </section>
        <aside class="sidebar" aria-label="Game controls">
          <div class="sidebar-head"><p class="eyebrow">Your true colors</p><span class="edition">SOLO CLUB</span></div>
          <div class="role-switch" aria-label="Choose role"><button data-role="hider" class="selected" aria-pressed="true">${icon('hide')} Hide</button><button data-role="seeker" aria-pressed="false">${icon('eye')} Seek</button></div>
          <div class="avatar-row"><h2 id="avatar-heading">Born to<br><span>blend in.</span></h2><div class="avatar-preview" id="avatar-preview" aria-label="Your painted character"></div></div>
          <div class="paint-controls" id="paint-controls">
            <div class="control-heading">Pick your palette <span>01 / PAINT</span></div>
            <div class="palette" id="palette" aria-label="Body color"></div>
            <div class="paint-details"><button id="sample" class="sample-button">${icon('dropper')} Match surface <kbd>E</kbd></button><label class="custom-color" title="Choose any body color"><input id="custom-color" type="color" value="#83bda8" aria-label="Custom body color"> Custom</label></div>
            <div class="pattern-row" aria-label="Paint pattern"><button class="pattern-button selected" data-pattern="solid" aria-pressed="true"><span class="pattern-dot"></span> Solid</button><button class="pattern-button" data-pattern="spots" aria-pressed="false"><span class="pattern-dot spots"></span> Spots</button><button class="pattern-button" data-pattern="stripes" aria-pressed="false"><span class="pattern-dot stripes"></span> Stripes</button></div>
            <div class="control-heading">Strike a pose <span>02 / HIDE</span></div>
            <div class="pose-row" aria-label="Character pose"><button class="pose-button selected" data-pose="stand" aria-pressed="true">${icon('stand')} Stand</button><button class="pose-button" data-pose="crouch" aria-pressed="false">${icon('crouch')} Crouch</button><button class="pose-button" data-pose="flat" aria-pressed="false">${icon('flat')} Flatten</button></div>
          </div>
          <div class="seeker-controls" id="seeker-controls"><div class="control-heading">A room full of secrets <span>01 / SEEK</span></div><h3>Something looks a little… alive.</h3><p>Five chameleons have painted themselves into this room. Click them before time runs out.</p><div class="target-dots" id="target-dots"></div><div class="seeker-stat"><span>Chameleons found</span><strong id="found-count">0 / 5</strong></div><div class="seeker-stat"><span>Mistakes remaining</span><strong id="miss-count">5 / 5</strong></div><p>Rotate the room with <kbd>Q</kbd> to see behind furniture. Look for little eyes and curly tails.</p></div>
          <div class="blend-box" id="blend-box"><div class="blend-top"><span>${icon('leaf')} Camouflage match</span><strong id="blend-value">0%</strong></div><div class="meter"><div class="meter-fill" id="blend-fill"></div></div><div class="blend-caption" id="blend-caption">Find a surface. Borrow its color.</div></div>
          <button class="start-button" id="start">Let's play hide & seek ${icon('arrow')}</button><p class="solo-note">Just you, a little color & two very curious seekers.</p>
        </aside>
      </div>
      <section class="steps" aria-label="The basics">
        <div class="step"><span class="step-number">01</span><div><h3>Find your happy place.</h3><p>A quiet corner. A plant. That suspiciously cozy rug.</p></div><span class="step-icon">${icon('leaf')}</span></div>
        <div class="step"><span class="step-number">02</span><div><h3>A little color goes a long way.</h3><p>Borrow a shade from the room. Become part of it.</p></div><span class="step-icon">${icon('dropper')}</span></div>
        <div class="step"><span class="step-number">03</span><div><h3>Nothing to see here.</h3><p>Strike a pose, stay still, and let them walk right past.</p></div><span class="step-icon">${icon('hide')}</span></div>
      </section>
    </main>
    <footer class="footer"><span>An independent fan-made playground. Inspired by <a href="https://store.steampowered.com/app/4704690/MECCHA_CHAMELEON/" target="_blank" rel="noopener noreferrer">Meccha Chameleon ↗</a></span><span>Life’s more fun in full color.</span></footer>
  </div>
  <dialog id="help-dialog" aria-labelledby="help-title"><button class="close-dialog" data-close="help-dialog" aria-label="Close instructions">${icon('close')}</button><p class="eyebrow">A crash course in doing nothing</p><h2 id="help-title">Paint. Pose. Poof.</h2><p>Welcome to your own little camouflage club. Choose a role, then make the art room your playground.</p><div class="instruction"><span class="number">01</span><div><b>Hide: you have 25 seconds to get ready.</b><p>Move with WASD, arrow keys, the touch buttons, or click the floor. Get next to a prop or onto a rug. Press E to sample its color.</p></div></div><div class="instruction"><span class="number">02</span><div><b>Make yourself hard to notice.</b><p>Pick a color and pattern, then press R to crouch or flatten. Good color matching and a low pose reduce detection. Stay still for 45 seconds while two seekers patrol. You can repaint and move, but moving draws attention!</p></div></div><div class="instruction"><span class="number">03</span><div><b>Seek: a tiny room, five sneaky faces.</b><p>Find and click all five hidden chameleons in 60 seconds. You have five mistakes. Press Q or the rotate button to look behind props; use + and − to zoom.</p></div></div><p><kbd>Esc</kbd> pauses your round. Your best score stays on this browser. All characters in this playground are computer controlled.</p><button class="start-button" data-close="help-dialog">I've got a good hiding feeling ${icon('arrow')}</button></dialog>
  <dialog id="result-dialog" aria-labelledby="result-title"><button class="close-dialog" data-close="result-dialog" aria-label="Close results">${icon('close')}</button><span class="result-stamp" id="result-stamp">✦</span><p class="eyebrow" id="result-eyebrow">An artist of disappearance</p><h2 id="result-title">A perfect vanishing act.</h2><p id="result-description"></p><div class="result-score"><div><strong id="round-score">0</strong><small>ROUND SCORE</small></div><div><strong id="best-score">0</strong><small>PERSONAL BEST</small></div></div><div class="result-actions"><button class="secondary-button" id="switch-role">Try seeking</button><button class="start-button" id="play-again">One more round ${icon('arrow')}</button></div></dialog>
  <div class="toast" id="toast" role="status"></div><div id="a11y-status" class="sr-only" aria-live="polite"></div>`;

const game = new Game();
let chosenRole: Role = 'hider';
let paused = false;
let sound = false;
let best = 0;
try {
  best = Number(localStorage.getItem('color-club-best')) || 0;
  sound = localStorage.getItem('color-club-sound') === 'on';
} catch {
  /* Storage may be unavailable in private contexts. */
}
let audio: AudioContext | undefined;
function chirp(kind: 'paint' | 'found' | 'win' | 'lose' | 'start') {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const notes = {
      paint: [620],
      found: [440, 660],
      win: [523, 659, 784, 1047],
      lose: [320, 240],
      start: [330, 440, 660],
    }[kind];
    notes.forEach((hz, i) => {
      const oscillator = audio!.createOscillator();
      const gain = audio!.createGain();
      const when = audio!.currentTime + i * 0.11;
      oscillator.type = 'sine';
      oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.07, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.19);
      oscillator.connect(gain);
      gain.connect(audio!.destination);
      oscillator.start(when);
      oscillator.stop(when + 0.2);
    });
  } catch {
    /* Gameplay still works without audio. */
  }
}
function renderSound() {
  $('#sound-button').innerHTML = `${icon(sound ? 'sound' : 'mute')} Sound ${sound ? 'on' : 'off'}`;
  $('#sound-button').setAttribute('aria-pressed', String(sound));
}
renderSound();
$('#sound-button').onclick = () => {
  sound = !sound;
  renderSound();
  try {
    localStorage.setItem('color-club-sound', sound ? 'on' : 'off');
  } catch {}
  chirp('paint');
};
let toastTimer = 0;
function toast(message: string) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}
const help = $<HTMLDialogElement>('#help-dialog');
const result = $<HTMLDialogElement>('#result-dialog');
$('#help-button').onclick = () => {
  keys.clear();
  destination = null;
  help.showModal();
};
document
  .querySelectorAll<HTMLButtonElement>('[data-close]')
  .forEach(
    (button) => (button.onclick = () => $<HTMLDialogElement>(`#${button.dataset.close}`).close()),
  );
for (const dialog of [help, result])
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });

let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let previewRenderer: THREE.WebGLRenderer;
let previewScene: THREE.Scene;
let previewCamera: THREE.PerspectiveCamera;
let playerAvatar: Avatar;
let previewAvatar: Avatar;
const hunterAvatars: Avatar[] = [];
let targetAvatars: Avatar[] = [];
const viewCones: THREE.Mesh[] = [];
const stage = $('#stage');
let cameraQuarter = 0;
let cameraAngle = 0.68;
let desiredCameraAngle = 0.68;
let zoom = 1;
let ready = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let destination: THREE.Vector3 | null = null;
let moveMarker: THREE.Mesh;
let moveMarkerLife = 0;
let world: ReturnType<typeof buildWorld>;

function setupScene() {
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.domElement.setAttribute('aria-label', '3D art room. Move with WASD or click the floor.');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    paused = true;
    toast('The graphics context was interrupted. Reload to restore the room.');
  });
  stage.prepend(renderer.domElement);
  world = buildWorld(scene);
  camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 150);
  playerAvatar = createAvatar(game.player.base);
  scene.add(playerAvatar.group);
  for (let i = 0; i < 2; i++) {
    const avatar = createAvatar('#edb25a');
    avatar.paint('#edb25a', '#b17035', 'stripes');
    avatar.group.scale.setScalar(1.05);
    avatar.group.visible = false;
    scene.add(avatar.group);
    hunterAvatars.push(avatar);
    const cone = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 48, (-Math.PI * 80) / 180, (Math.PI * 160) / 180),
      new THREE.MeshBasicMaterial({
        color: '#edb25a',
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.y = 0.035;
    scene.add(cone);
    cone.visible = false;
    viewCones.push(cone);
  }
  moveMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.19, 0.25, 40),
    new THREE.MeshBasicMaterial({
      color: '#f47851',
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  moveMarker.rotation.x = -Math.PI / 2;
  moveMarker.visible = false;
  scene.add(moveMarker);
  previewScene = new THREE.Scene();
  previewScene.add(new THREE.HemisphereLight('#fff8e6', '#75886c', 2.6));
  const light = new THREE.DirectionalLight('#fff5df', 3.2);
  light.position.set(3, 5, 4);
  previewScene.add(light);
  previewAvatar = createAvatar(game.player.base);
  previewScene.add(previewAvatar.group);
  previewAvatar.group.rotation.y = -0.45;
  previewCamera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
  previewCamera.position.set(2.5, 2.1, 4);
  previewCamera.lookAt(0, 0.73, 0);
  previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  previewRenderer.toneMappingExposure = 0.92;
  $('#avatar-preview').append(previewRenderer.domElement);
  new ResizeObserver(resize).observe(stage);
  new ResizeObserver(resize).observe($('#avatar-preview'));
  resize();
  renderer.domElement.addEventListener('pointerup', clickRoom);
  ready = true;
  syncPaint();
}
function resize() {
  if (!renderer || !camera) return;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const span = aspect < 1.2 ? 19 / aspect : 16.4;
  camera.left = (-span * aspect) / 2;
  camera.right = (span * aspect) / 2;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  if (previewRenderer) {
    const element = $('#avatar-preview');
    previewRenderer.setSize(element.clientWidth, element.clientHeight, false);
    previewCamera.aspect = element.clientWidth / element.clientHeight;
    previewCamera.updateProjectionMatrix();
  }
}
function clickRoom(event: PointerEvent) {
  if (!ready || isPaused() || ['won', 'lost'].includes(game.phase)) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    (-(event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  if (chosenRole === 'seeker') {
    if (game.phase !== 'seeking') {
      toast('Start a round to find the hidden chameleons.');
      return;
    }
    scene.updateMatrixWorld(true);
    const hits = raycaster
      .intersectObjects(scene.children, true)
      .filter(
        (hit) =>
          hit.object instanceof THREE.Mesh &&
          hit.object.visible &&
          hit.object !== moveMarker &&
          !viewCones.includes(hit.object) &&
          isVisible(hit.object),
      );
    const first = hits[0];
    let object: THREE.Object3D | null = first?.object || null;
    let id: number | null = null;
    while (object) {
      if (typeof object.userData.targetId === 'number') {
        id = object.userData.targetId;
        break;
      }
      object = object.parent;
    }
    const tagged = game.tag(id);
    chirp(tagged ? 'found' : 'lose');
    toast(
      tagged
        ? 'Found you! A very suspicious little decoration.'
        : `Just part of the room. ${Math.max(0, 5 - game.misses)} mistakes left.`,
    );
    updateHUD();
  } else {
    if (game.phase === 'ready') {
      toast('Start a round, then click a clear spot to explore.');
      return;
    }
    const hit = raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
    if (hit && Math.abs(hit.x) < 5.7 && Math.abs(hit.z) < 4.7) {
      destination = hit;
      moveMarker.position.set(hit.x, 0.04, hit.z);
      moveMarkerLife = 1;
    }
  }
}
function isVisible(object: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function syncPaint() {
  if (ready)
    for (const avatar of [playerAvatar, previewAvatar]) {
      avatar.paint(game.player.base, game.player.accent, game.player.pattern);
      avatar.pose(game.player.pose);
    }
  $<HTMLInputElement>('#custom-color').value = game.player.base;
  document
    .querySelectorAll<HTMLButtonElement>('[data-color]')
    .forEach((button) => setSelected(button, button.dataset.color === game.player.base));
  document
    .querySelectorAll<HTMLButtonElement>('[data-pattern]')
    .forEach((button) => setSelected(button, button.dataset.pattern === game.player.pattern));
  document
    .querySelectorAll<HTMLButtonElement>('[data-pose]')
    .forEach((button) => setSelected(button, button.dataset.pose === game.player.pose));
}
function setSelected(button: HTMLButtonElement, selected: boolean) {
  button.classList.toggle('selected', selected);
  button.setAttribute('aria-pressed', String(selected));
}
function canPaint() {
  return chosenRole === 'hider' && !isPaused() && !['won', 'lost'].includes(game.phase);
}
function paint(color: string) {
  if (!canPaint()) return;
  const accent = new THREE.Color(color).multiplyScalar(0.73).getHexString();
  game.paint(color, `#${accent}`, game.player.pattern);
  syncPaint();
  chirp('paint');
  updateHUD();
}
$('#palette').innerHTML = PALETTE.map(
  ({ name, color }) =>
    `<button class="swatch" data-color="${color}" style="background:${color}" aria-label="Paint ${name}" aria-pressed="false" title="${name}"></button>`,
).join('');
document
  .querySelectorAll<HTMLButtonElement>('[data-color]')
  .forEach((button) => (button.onclick = () => paint(button.dataset.color!)));
$<HTMLInputElement>('#custom-color').oninput = (event) =>
  paint((event.target as HTMLInputElement).value);
document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(
  (button) =>
    (button.onclick = () => {
      if (!canPaint()) return;
      game.paint(
        game.player.base,
        `#${new THREE.Color(game.player.base).multiplyScalar(0.73).getHexString()}`,
        button.dataset.pattern as Pattern,
      );
      syncPaint();
      chirp('paint');
    }),
);
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(
  (button) =>
    (button.onclick = () => {
      if (!canPaint()) return;
      game.setPose(button.dataset.pose as Pose);
      syncPaint();
      chirp('paint');
    }),
);
function sample() {
  if (!canPaint()) return;
  const color = game.sample();
  paint(color);
  toast(`Borrowed a little ${game.environment.name.toLowerCase()}. Looking good.`);
}
$('#sample').onclick = sample;

function selectRole(role: Role) {
  if (['hiding', 'seeking'].includes(game.phase)) {
    toast('Finish this round, or pause to start a new one.');
    return;
  }
  chosenRole = role;
  document
    .querySelectorAll<HTMLButtonElement>('[data-role]')
    .forEach((button) => setSelected(button, button.dataset.role === role));
  const hider = role === 'hider';
  $('#paint-controls').style.display = hider ? '' : 'none';
  $('#blend-box').style.display = hider ? '' : 'none';
  $('#seeker-controls').style.display = hider ? 'none' : 'block';
  $('#avatar-heading').innerHTML = hider
    ? 'Born to<br><span>blend in.</span>'
    : 'An eye for<br><span>the unusual.</span>';
  $('.solo-note').textContent = hider
    ? 'Just you, a little color & two very curious seekers.'
    : 'Five hiding chameleons. One very curious you.';
  $('#start').innerHTML =
    `${hider ? "Let's play hide & seek" : 'Ready, set, find them'} ${icon('arrow')}`;
  $('#target-dots').innerHTML = Array.from(
    { length: 5 },
    () => `<span class="target-dot">${icon('eye')}</span>`,
  ).join('');
  if (ready) {
    playerAvatar.group.visible = hider;
    previewAvatar.paint(
      hider ? game.player.base : '#edb25a',
      '#b17035',
      hider ? game.player.pattern : 'stripes',
    );
  }
  updateHUD();
}
document
  .querySelectorAll<HTMLButtonElement>('[data-role]')
  .forEach((button) => (button.onclick = () => selectRole(button.dataset.role as Role)));
function clearTargets() {
  for (const avatar of targetAvatars) {
    scene.remove(avatar.group);
    avatar.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          (material as THREE.MeshStandardMaterial).map?.dispose();
          material.dispose();
        }
      }
    });
  }
  targetAvatars = [];
}
function startRound() {
  if (!ready) return;
  const { base, accent, pattern, pose } = game.player;
  game.start(chosenRole);
  game.paint(base, accent, pattern);
  game.setPose(pose);
  paused = false;
  keys.clear();
  destination = null;
  $('#pause-screen').hidden = true;
  $('#pause').setAttribute('aria-label', 'Pause game');
  result.close();
  clearTargets();
  for (const target of game.targets) {
    const avatar = createAvatar(target.base);
    avatar.paint(target.base, target.accent, target.pattern);
    avatar.pose(target.pose);
    avatar.group.position.set(target.x, 0, target.z);
    avatar.group.rotation.y = target.id * 1.7;
    avatar.group.userData.targetId = target.id;
    scene.add(avatar.group);
    targetAvatars.push(avatar);
  }
  playerAvatar.group.visible = chosenRole === 'hider';
  syncPaint();
  if (chosenRole === 'seeker') previewAvatar.paint('#edb25a', '#b17035', 'stripes');
  previousPhase = game.phase;
  $('#a11y-status').textContent =
    chosenRole === 'hider'
      ? 'Round started. You have 25 seconds to hide.'
      : 'Round started. Find five chameleons in sixty seconds.';
  chirp('start');
  updateHUD();
}
$('#start').onclick = () => {
  if (game.phase === 'hiding') {
    game.beginSeeking();
    toast('Ready or not, here they come!');
  } else if (game.phase === 'seeking') {
    togglePause();
  } else startRound();
};
$('#play-again').onclick = startRound;
$('#switch-role').onclick = () => {
  result.close();
  selectRole(chosenRole === 'hider' ? 'seeker' : 'hider');
  startRound();
};
function togglePause() {
  if (!['hiding', 'seeking'].includes(game.phase)) return;
  paused = !paused;
  keys.clear();
  destination = null;
  $('#pause-screen').hidden = !paused;
  $('#pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
}
$('#pause').onclick = togglePause;
$('#resume').onclick = togglePause;
$('#restart').onclick = startRound;
function rotateCamera() {
  cameraQuarter = (cameraQuarter + 1) % 4;
  desiredCameraAngle += Math.PI / 2;
  if (reducedMotion) cameraAngle = desiredCameraAngle;
}
$('#rotate').onclick = rotateCamera;
$('#zoom-out').onclick = () => {
  zoom = Math.max(0.75, zoom - 0.15);
  resize();
};
$('#zoom-in').onclick = () => {
  zoom = Math.min(1.75, zoom + 0.15);
  resize();
};
const keys = new Set<string>();
const movements = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLInputElement || help.open || result.open) return;
  const key = event.key.toLowerCase();
  if (movements.has(key)) {
    event.preventDefault();
    if (!isPaused()) {
      keys.add(key);
      destination = null;
    }
  }
  if (event.repeat) return;
  if (key === 'e') sample();
  if (key === 'r' && canPaint()) {
    const poses: Pose[] = ['stand', 'crouch', 'flat'];
    game.setPose(poses[(poses.indexOf(game.player.pose) + 1) % 3]);
    syncPaint();
  }
  if (key === 'q') rotateCamera();
  if (key === 'escape') {
    event.preventDefault();
    togglePause();
  }
});
document.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => {
  keys.clear();
  destination = null;
  if (['hiding', 'seeking'].includes(game.phase) && !paused) togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    destination = null;
    if (['hiding', 'seeking'].includes(game.phase) && !paused) togglePause();
  }
});
document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
  const key = { up: 'w', left: 'a', down: 's', right: 'd' }[button.dataset.move!]!;
  button.onpointerdown = (event) => {
    event.preventDefault();
    if (isPaused()) return;
    button.setPointerCapture(event.pointerId);
    keys.add(key);
    destination = null;
  };
  button.onpointerup = button.onpointercancel = () => {
    keys.delete(key);
  };
  button.onlostpointercapture = () => keys.delete(key);
});
if (matchMedia('(pointer: coarse)').matches) {
  $('.touch-controls').classList.add('enabled');
  stage.classList.add('touch-active');
}
function isPaused() {
  return paused || help.open || result.open || document.hidden;
}
let previousPhase = game.phase;
let displayedSecond = -1;
function updateHUD() {
  const active = ['hiding', 'seeking'].includes(game.phase);
  stage.dataset.phase = game.phase;
  const second = Math.ceil(game.timeLeft);
  if (active) {
    if (second !== displayedSecond || !$('#timer').classList.contains('running')) {
      $('#timer').innerHTML =
        `${icon(game.phase === 'hiding' ? 'hide' : 'eye')} ${String(Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}`;
      displayedSecond = second;
    }
  } else
    $('#timer').innerHTML = '<span class="live-dot"></span> A little room, endless possibilities';
  $('#timer').classList.toggle('running', active);
  const banner =
    game.phase === 'hiding'
      ? 'A little alone time. Find a spot & get painting.'
      : game.phase === 'seeking'
        ? chosenRole === 'hider'
          ? `Seekers are looking · ${Math.round(game.suspicion)}% noticed`
          : `A good eye sees everything · ${game.found} / 5 found`
        : '';
  $('#round-banner').textContent = banner;
  $('#round-banner').style.background =
    game.suspicion > 55 && chosenRole === 'hider' ? '#c66c4e' : '';
  const blend = Math.round(game.camouflage);
  $('#blend-value').textContent = `${blend}%`;
  $('#blend-fill').style.width = `${blend}%`;
  $('#blend-caption').textContent =
    `${game.environment.name} · ${blend >= 80 ? 'You look right at home. Now stay still.' : 'Match the color. Get low. Stay still.'}`;
  $('#found-count').textContent = `${game.found} / 5`;
  $('#miss-count').textContent = `${Math.max(0, 5 - game.misses)} / 5`;
  document.querySelectorAll('.target-dot').forEach((dot, i) => {
    dot.classList.toggle('found', i < game.found);
    dot.innerHTML = icon(i < game.found ? 'check' : 'eye');
  });
  const text =
    game.phase === 'hiding'
      ? 'Ready or not, here they come'
      : game.phase === 'seeking'
        ? 'Take a little breather'
        : chosenRole === 'hider'
          ? "Let's play hide & seek"
          : 'Ready, set, find them';
  const markup = `${text} ${icon(game.phase === 'seeking' ? 'pause' : 'arrow')}`;
  if ($('#start').innerHTML !== markup) $('#start').innerHTML = markup;
  document
    .querySelectorAll<HTMLButtonElement>('[data-role]')
    .forEach((button) => (button.disabled = active));
  document
    .querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      '#paint-controls button, #paint-controls input',
    )
    .forEach((control) => (control.disabled = !canPaint()));
  $('#hint-label').textContent = active
    ? chosenRole === 'hider'
      ? game.phase === 'hiding'
        ? 'YOUR MOMENT TO DISAPPEAR'
        : 'NOTHING TO SEE HERE'
      : 'TRUST YOUR EYES'
    : 'WELCOME TO THE COLOR CLUB';
  $('#stage-hint').innerHTML = active
    ? chosenRole === 'hider'
      ? 'Match your surroundings.<br><strong>A low pose makes all the difference.</strong>'
      : 'Look for eyes and curly tails.<br><strong>Click a chameleon to tag it.</strong>'
    : 'Make yourself at home.<br>Then make yourself <strong>disappear.</strong>';
}
function showResult() {
  const won = game.phase === 'won';
  const roundScore = Math.max(0, Math.round(game.score));
  best = Math.max(best, roundScore);
  try {
    localStorage.setItem('color-club-best', String(best));
  } catch {}
  $('#result-stamp').textContent = won ? '✦' : '◌';
  $('#result-stamp').style.color = won ? '#83a26f' : '#ee714d';
  $('#result-eyebrow').textContent = won
    ? 'A very good day to be a chameleon'
    : 'Even a masterpiece takes practice';
  $('#result-title').textContent = won
    ? chosenRole === 'hider'
      ? 'What chameleon?'
      : 'Nothing gets past you.'
    : chosenRole === 'hider'
      ? 'Oh, there you are.'
      : 'A few sneaky little secrets.';
  $('#result-description').textContent = won
    ? chosenRole === 'hider'
      ? 'You became part of the room. The seekers walked on by, and your vanishing act was a success.'
      : 'Five chameleons found. The room is just a room again. For now.'
    : chosenRole === 'hider'
      ? 'The seekers spotted you! Try matching the nearest surface with E, flattening with R, and holding still.'
      : `You found ${game.found} of 5 chameleons. ${game.misses >= 5 ? 'Five mistakes ended the hunt.' : 'Time slipped away.'} Rotate the room to check behind the furniture.`;
  $('#round-score').textContent = String(roundScore);
  $('#best-score').textContent = String(best);
  $('#switch-role').textContent = chosenRole === 'hider' ? 'Try seeking' : 'Try hiding';
  keys.clear();
  destination = null;
  result.showModal();
  chirp(won ? 'win' : 'lose');
}
let previousTime = performance.now();
let hudTime = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  if (!ready) return;
  const elapsed = (now - previousTime) / 1000;
  const dt = Math.min(elapsed, 0.1);
  previousTime = now;
  let moving = false;
  if (!isPaused()) {
    if (chosenRole === 'hider' && !['won', 'lost'].includes(game.phase)) {
      let dx =
        (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
        (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      let dz =
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
        (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      if (dx || dz) {
        const c = Math.cos(cameraAngle),
          s = Math.sin(cameraAngle);
        const x = dx * c + dz * s;
        dz = -dx * s + dz * c;
        dx = x;
      } else if (destination) {
        dx = destination.x - game.player.x;
        dz = destination.z - game.player.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.13) {
          destination = null;
          dx = 0;
          dz = 0;
        } else {
          dx /= distance;
          dz /= distance;
        }
      }
      if (dx || dz) {
        const beforeX = game.player.x,
          beforeZ = game.player.z;
        game.move(dx, dz, dt);
        moving = Math.hypot(game.player.x - beforeX, game.player.z - beforeZ) > 0.001;
        if (!moving && destination) {
          destination = null;
          toast('A little furniture in the way. Try going around.');
        }
      }
    }
    game.tick(elapsed);
    if (game.phase !== previousPhase) {
      if (game.phase === 'seeking') {
        chirp('start');
        $('#a11y-status').textContent = 'Seekers are now searching. Stay still!';
      }
      if (game.phase === 'won' || game.phase === 'lost') showResult();
      previousPhase = game.phase;
    }
  }
  playerAvatar.group.position.set(game.player.x, 0, game.player.z);
  playerAvatar.group.rotation.y = game.player.angle;
  playerAvatar.animate(now / 1000, moving && !isPaused());
  previewAvatar.animate(reducedMotion ? 0 : now / 1000, false);
  for (let i = 0; i < hunterAvatars.length; i++) {
    const hunter = game.hunters[i];
    const avatar = hunterAvatars[i];
    const visible =
      chosenRole === 'hider' && ['seeking', 'won', 'lost'].includes(game.phase) && !!hunter;
    avatar.group.visible = visible;
    viewCones[i].visible = visible;
    if (hunter) {
      avatar.group.position.set(hunter.x, 0, hunter.z);
      avatar.group.rotation.y = hunter.angle;
      avatar.animate(now / 1000, !isPaused() && game.phase === 'seeking');
      viewCones[i].position.set(hunter.x, 0.035, hunter.z);
      viewCones[i].rotation.z = hunter.angle - Math.PI / 2;
    }
  }
  for (let i = 0; i < targetAvatars.length; i++) {
    targetAvatars[i].group.visible = !game.targets[i].found;
    targetAvatars[i].animate(reducedMotion ? 0 : now / 1000, false);
  }
  moveMarkerLife = Math.max(0, moveMarkerLife - dt);
  moveMarker.visible = moveMarkerLife > 0;
  (moveMarker.material as THREE.MeshBasicMaterial).opacity = moveMarkerLife * 0.8;
  cameraAngle += (desiredCameraAngle - cameraAngle) * Math.min(1, dt * 7);
  camera.position.set(Math.sin(cameraAngle) * 19, 17, Math.cos(cameraAngle) * 19);
  camera.lookAt(0, 1.05, 0);
  world.updateView(camera.position);
  renderer.render(scene, camera);
  previewRenderer.render(previewScene, previewCamera);
  hudTime += dt;
  if (hudTime > 0.15) {
    updateHUD();
    hudTime = 0;
  }
}
try {
  setupScene();
  selectRole('hider');
  updateHUD();
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  stage.insertAdjacentHTML(
    'afterbegin',
    '<div class="fatal" role="alert"><h2>The art room needs WebGL.</h2><p>Enable graphics acceleration in your browser and reload to bring this little world to life.</p></div>',
  );
  $<HTMLButtonElement>('#start').disabled = true;
}
