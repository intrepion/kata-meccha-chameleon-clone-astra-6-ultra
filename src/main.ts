import * as THREE from 'three';
import {
  Game,
  PALETTE,
  TARGET_COUNT,
  MAX_MISSES,
  TAG_RANGE,
  type Role,
  type Pose,
  type Pattern,
} from './game';
import { OBSTACLES, ZONES } from './map';
import { cameraView, movementDirection } from './camera';
import { buildWorld, createAvatar, type Avatar } from './world';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const icons = {
  eye: svg(
    '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  ),
  paint: svg('<path d="m15 3 6 6-10 10H5v-6L15 3ZM3 21h5M12 6l6 6"/>'),
  arrow: svg('<path d="M4 12h16m-6-6 6 6-6 6"/>'),
  pause: svg('<path d="M8 5v14m8-14v14"/>'),
  close: svg('<path d="m6 6 12 12M6 18 18 6"/>'),
  speaker: svg('<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8"/>'),
  expand: svg('<path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 .8-2 1-2 3m0 3v.1"/>'),
};
const mark =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="20" fill="#ec7750"/><path d="M44 36c12 0 11 17 1 17-7 0-9-9-3-9M44 36H24c-15 0-17-19-4-23 9-3 22 4 25 13z" fill="none" stroke="#fff8e9" stroke-width="5" stroke-linecap="round"/><circle cx="22" cy="23" r="3" fill="#fff8e9"/></svg>';

$('#app').innerHTML = `
<main id="stage" data-phase="ready" data-role="hider" data-camera="third-person" aria-label="3D art school playground">
  <header class="topbar">
    <a class="brand" href="./" aria-label="Meccha Chameleon home">${mark}<span>MECCHA<small>CHAMELEON</small></span></a>
    <span class="map-label">THE OLD ART SCHOOL <span>64 × 56 m · 6 rooms</span></span>
    <nav aria-label="Game tools"><button id="help-button" aria-label="How to play" title="How to play">${icons.help}</button><button id="sound-button" aria-label="Enable sound" title="Toggle sound" aria-pressed="false">${icons.speaker}</button><button id="fullscreen" aria-label="Fullscreen" title="Fullscreen">${icons.expand}</button><button id="pause" aria-label="Pause game" title="Pause (Esc)">${icons.pause}</button></nav>
  </header>
  <section class="hud" aria-label="Round information">
    <div class="location"><span class="tiny">YOU ARE IN</span><strong id="zone">Reception</strong><span id="coordinates" class="coordinates">0.0 / 24.0</span></div>
    <div class="clock"><span id="phase-label">YOUR NEXT HIDING PLACE</span><strong id="timer">03:00</strong><small id="camera-label">THIRD-PERSON HIDER</small></div>
    <div id="objective" class="objective"><span class="tiny" id="objective-label">CAMOUFLAGE</span><strong id="objective-value">0%</strong><span id="objective-detail">Find a surface. Borrow its color.</span></div>
  </section>
  <div id="crosshair" aria-label="Aim at the center of the screen"><span></span><span></span><span></span><span></span></div>
  <div id="aim-label" class="aim-label"></div>
  <section id="lobby" class="lobby" aria-labelledby="lobby-title">
    <p class="eyebrow">HIDE IN PLAIN SIGHT</p><h1 id="lobby-title">A whole world<br>to <em>disappear in.</em></h1>
    <p class="lobby-description">An abandoned art school. Six rooms full of cover.<br>Paint yourself into the scenery—or hunt from eye level.</p>
    <div class="role-switch" aria-label="Choose role"><button data-role="hider" aria-pressed="true" class="selected">${icons.paint}<span>Hide<small>Third-person camera</small></span></button><button data-role="seeker" aria-pressed="false">${icons.eye}<span>Seek<small>First-person camera</small></span></button></div>
    <p id="role-description" class="role-description">You have a minute to hide. Paint, pose, and stay out of sight while three seekers search the school.</p>
    <button id="start" class="primary">Enter as hider ${icons.arrow}</button>
    <div class="lobby-controls"><span><kbd>W A S D</kbd> move</span><span><span class="mouse-icon">↔</span> mouse to look</span><span><kbd>Space</kbd> jump</span></div>
    <p class="solo-note">Single-player with AI opponents · Original fan-made adaptation</p>
  </section>
  <div id="play-hud" class="play-hud" hidden>
    <div class="round-banner" id="round-banner" role="status"></div>
    <div class="exposure" id="exposure"><span>NOTICED <strong id="suspicion">0%</strong></span><div><i id="suspicion-fill"></i></div></div>
    <div class="bottom-left"><span class="camera-chip" id="view-chip">THIRD PERSON</span><button id="paint-button" class="glass-button">${icons.paint} Paint & pose <kbd>F</kbd></button><button id="skip" class="glass-button">I'm ready ${icons.arrow}</button></div>
    <div class="bottom-center"><button id="enter-room" class="glass-button">Click to capture mouse</button><span id="control-hint">WASD move · Mouse look · Space jump · E sample · F paint · Esc release</span></div>
    <div class="bottom-right" id="seeker-count"><strong id="found-count">0 / 8</strong><span>CHAMELEONS FOUND</span><small>Misses left: <b id="miss-count">8 / 8</b></small></div>
  </div>
  <aside id="paint-panel" class="paint-panel" hidden aria-label="Paint and pose">
    <div class="panel-head"><div><p class="eyebrow">YOUR TRUE COLORS</p><h2>Become the scenery.</h2></div><button id="close-paint" aria-label="Close paint panel">${icons.close}</button></div>
    <div id="avatar-preview" aria-label="Your painted character"></div>
    <div class="control-heading">Body paint <span>01 / COLOR</span></div><div class="palette" id="palette"></div>
    <div class="color-tools"><button id="sample">${icons.paint} Sample ahead <kbd>E</kbd></button><label><input id="custom-color" type="color" value="#f4efdf" aria-label="Custom body color">Custom</label></div>
    <div class="pattern-row"><button data-pattern="solid" class="selected" aria-pressed="true">Solid</button><button data-pattern="spots" aria-pressed="false">Spots</button><button data-pattern="stripes" aria-pressed="false">Stripes</button></div>
    <div class="control-heading">Your silhouette <span>02 / POSE</span></div><div class="pose-row"><button data-pose="stand" aria-pressed="true" class="selected">Stand</button><button data-pose="crouch" aria-pressed="false">Crouch</button><button data-pose="flat" aria-pressed="false">Flatten</button></div>
    <div class="blend-box"><span>Nearby surface match <strong id="blend-value">0%</strong></span><div class="meter"><i id="blend-fill"></i></div><p id="blend-caption">Get close to a surface and sample its color.</p></div>
    <button id="finish-paint" class="primary">Back to hiding ${icons.arrow}</button><p class="panel-note">The clock keeps ticking while you paint.</p>
  </aside>
  <div class="touch-controls" hidden aria-label="Touch movement"><button data-move="up" aria-label="Move forward">↑</button><button data-move="left" aria-label="Move left">←</button><button data-move="down" aria-label="Move backward">↓</button><button data-move="right" aria-label="Move right">→</button></div><div class="touch-actions" hidden><button id="touch-jump" aria-label="Jump">↑</button><button id="touch-tag" aria-label="Tag at crosshair">◎</button></div>
  <section class="pause-screen" id="pause-screen" hidden aria-label="Game paused"><p class="eyebrow">TAKE A BREATHER</p><h2>Perfectly still.</h2><p>The round is paused. Take your time.</p><button id="resume" class="primary">Resume & capture mouse ${icons.arrow}</button><button id="restart" class="secondary">Restart this round</button><button id="back-lobby" class="text-button">Choose a different role</button></section>
  <div id="toast" class="toast" role="status"></div><div id="a11y-status" class="sr-only" aria-live="polite"></div>
</main>
<dialog id="help-dialog" aria-labelledby="help-title"><button class="close-dialog" data-close="help-dialog" aria-label="Close instructions">${icons.close}</button><p class="eyebrow">GET LOST. BLEND IN.</p><h2 id="help-title">This is hide & seek.</h2><p><b>Seeker — first person.</b> Walk through the school and aim the center crosshair at a chameleon. Left-click to tag within ${TAG_RANGE} meters. Walls and furniture block your shot. Find all eight in three minutes; eight misses end the round.</p><p><b>Hider — third person.</b> You get 60 seconds to find a hiding place, then survive a two-minute search. Press F to paint your body. Aim at a surface and press E to sample its color. Crouch or flatten, get behind cover, and stay still. A close inspection can still give you away.</p><div class="key-guide"><span><kbd>WASD</kbd> Move / strafe</span><span><kbd>Mouse</kbd> Look around</span><span><kbd>Space</kbd> Jump</span><span><kbd>C / Ctrl</kbd> Crouch</span><span><kbd>F</kbd> Paint panel</span><span><kbd>R</kbd> Cycle poses</span><span><kbd>E</kbd> Sample color</span><span><kbd>Esc</kbd> Pause / release mouse</span></div><p>Click the room to capture your mouse. If mouse capture isn't available, drag the room to look. On touch screens, use the movement pad, drag to look, and tap ◎ to tag.</p><p class="muted">Single-player browser adaptation. This version has AI opponents; it does not have online multiplayer.</p><button class="primary" data-close="help-dialog">Got it ${icons.arrow}</button></dialog>
<dialog id="result-dialog" aria-labelledby="result-title"><p class="eyebrow" id="result-eyebrow">ROUND COMPLETE</p><h2 id="result-title">What chameleon?</h2><p id="result-description"></p><div class="result-score"><div><strong id="round-score">0</strong><span>ROUND SCORE</span></div><div><strong id="best-score">0</strong><span>PERSONAL BEST</span></div></div><button id="play-again" class="primary">Play another round ${icons.arrow}</button><button id="switch-role" class="secondary">Switch roles</button><button id="result-lobby" class="text-button">Back to the school</button></dialog>`;

let game = new Game();
let chosenRole: Role = 'hider';
let paused = false;
let paintOpen = false;
let ready = false;
let controlsEntered = false;
let captureUnavailable = false;
let ignoreUnlock = false;
let yaw = 0;
let pitch = -0.13;
let thirdPersonDistance = 4.1;
let sound = false;
let best = 0;
try {
  best = Number(localStorage.getItem('color-club-best')) || 0;
  sound = localStorage.getItem('color-club-sound') === 'on';
} catch {}
const stage = $('#stage');
const help = $<HTMLDialogElement>('#help-dialog');
const result = $<HTMLDialogElement>('#result-dialog');
const keys = new Set<string>();
const coarse = matchMedia('(pointer: coarse)').matches;
let renderer: THREE.WebGLRenderer;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let playerAvatar: Avatar;
let previewAvatar: Avatar;
let previewRenderer: THREE.WebGLRenderer;
let previewScene: THREE.Scene;
let previewCamera: THREE.PerspectiveCamera;
let tagger: THREE.Group;
let hunterAvatars: Avatar[] = [];
let targetAvatars: Avatar[] = [];
let lastPhase = game.phase;
let audio: AudioContext | undefined;
let toastTimer = 0;
let recoil = 0;
let lastShot = -Infinity;
let aimHit: THREE.Intersection | undefined;
const raycaster = new THREE.Raycaster();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const neutral = new THREE.Vector2(0, 0);

function active() {
  return game.phase === 'hiding' || game.phase === 'seeking';
}
function frozen() {
  return paused || help.open || result.open || document.hidden;
}
function canPaint() {
  return chosenRole === 'hider' && !frozen() && !['won', 'lost'].includes(game.phase);
}
function toast(message: string) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}
function chirp(kind: 'paint' | 'tag' | 'win' | 'lose') {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const notes = { paint: [620], tag: [240, 580], win: [523, 659, 784], lose: [260, 180] }[kind];
    notes.forEach((hz, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      const t = audio!.currentTime + i * 0.09;
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  } catch {}
}
function updateSound() {
  $('#sound-button').setAttribute('aria-pressed', String(sound));
  $('#sound-button').setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
}
$('#sound-button').onclick = () => {
  sound = !sound;
  updateSound();
  try {
    localStorage.setItem('color-club-sound', sound ? 'on' : 'off');
  } catch {}
  chirp('paint');
};
updateSound();
$('#fullscreen').onclick = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else
    void stage
      .requestFullscreen()
      .catch(() => toast('Fullscreen is unavailable here. You can still play in this window.'));
};

function releaseMouse() {
  keys.clear();
  if (document.pointerLockElement) {
    ignoreUnlock = true;
    document.exitPointerLock();
  }
}
async function enterControls() {
  if (!ready || !active() || frozen() || paintOpen) return;
  controlsEntered = true;
  if (coarse) {
    updateHUD();
    return;
  }
  try {
    await renderer.domElement.requestPointerLock();
  } catch (error) {
    captureUnavailable = true;
    console.info(
      'Mouse capture unavailable:',
      error instanceof Error ? error.message : String(error),
    );
    toast('Drag the room to look. Click to tag as seeker.');
  }
  updateHUD();
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer?.domElement) {
    controlsEntered = true;
    ignoreUnlock = false;
    captureUnavailable = false;
  } else if (ignoreUnlock) ignoreUnlock = false;
  else if (active() && !paintOpen && !help.open && !result.open) setPaused(true);
  updateHUD();
});
document.addEventListener('pointerlockerror', () => {
  controlsEntered = true;
  captureUnavailable = true;
  toast('Mouse capture unavailable. Drag to look instead.');
});
$('#enter-room').onclick = () => void enterControls();
function setPaused(value: boolean) {
  if (!active()) return;
  paused = value;
  keys.clear();
  $('#pause-screen').hidden = !value;
  $('#pause').setAttribute('aria-label', value ? 'Resume game' : 'Pause game');
  if (value) releaseMouse();
  updateHUD();
}
$('#pause').onclick = () => {
  if (paused) {
    setPaused(false);
    void enterControls();
  } else setPaused(true);
};
$('#resume').onclick = () => {
  setPaused(false);
  void enterControls();
};
$('#restart').onclick = () => startRound();
$('#help-button').onclick = () => {
  releaseMouse();
  help.showModal();
  updateHUD();
};
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close]'))
  button.onclick = () => {
    $<HTMLDialogElement>(`#${button.dataset.close}`).close();
    updateHUD();
  };
help.addEventListener('close', () => updateHUD());
help.addEventListener('cancel', () => keys.clear());
result.addEventListener('cancel', (event) => {
  event.preventDefault();
  lobby();
});

function setSelected(button: HTMLButtonElement, selected: boolean) {
  button.classList.toggle('selected', selected);
  button.setAttribute('aria-pressed', String(selected));
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
    .forEach((b) => setSelected(b, b.dataset.color === game.player.base));
  document
    .querySelectorAll<HTMLButtonElement>('[data-pattern]')
    .forEach((b) => setSelected(b, b.dataset.pattern === game.player.pattern));
  document
    .querySelectorAll<HTMLButtonElement>('[data-pose]')
    .forEach((b) => setSelected(b, b.dataset.pose === game.player.pose));
}
function paint(color: string) {
  if (!canPaint()) return;
  game.paint(
    color,
    `#${new THREE.Color(color).multiplyScalar(0.8).getHexString()}`,
    game.player.pattern,
  );
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
  .forEach((b) => (b.onclick = () => paint(b.dataset.color!)));
$<HTMLInputElement>('#custom-color').oninput = (e) => paint((e.target as HTMLInputElement).value);
document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(
  (b) =>
    (b.onclick = () => {
      if (!canPaint()) return;
      game.paint(game.player.base, game.player.accent, b.dataset.pattern as Pattern);
      syncPaint();
    }),
);
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(
  (b) =>
    (b.onclick = () => {
      if (!canPaint()) return;
      game.setPose(b.dataset.pose as Pose);
      syncPaint();
    }),
);
function openPaint(value: boolean) {
  if (chosenRole !== 'hider' || (!canPaint() && value)) return;
  paintOpen = value;
  $('#paint-panel').hidden = !value;
  keys.clear();
  if (value) releaseMouse();
  else if (active()) void enterControls();
  resize();
  updateHUD();
}
$('#paint-button').onclick = () => openPaint(!paintOpen);
$('#close-paint').onclick = $('#finish-paint').onclick = () => openPaint(false);
function parentFlag(object: THREE.Object3D, flag: string): unknown {
  for (let p: THREE.Object3D | null = object; p; p = p.parent)
    if (p.userData[flag] !== undefined) return p.userData[flag];
  return undefined;
}
function visible(object: THREE.Object3D) {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function castAim(maxDistance = 30) {
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  raycaster.setFromCamera(neutral, camera);
  raycaster.far = maxDistance;
  return raycaster
    .intersectObjects(scene.children, true)
    .find(
      (hit) =>
        hit.object instanceof THREE.Mesh &&
        visible(hit.object) &&
        !parentFlag(hit.object, 'ignoreAim'),
    );
}
function sample() {
  if (!canPaint() || !ready) return;
  const hit = castAim(10);
  if (!hit) {
    toast('Aim at a nearby surface to sample its color.');
    return;
  }
  let color = parentFlag(hit.object, 'surfaceColor');
  if (typeof color !== 'string' && hit.object instanceof THREE.Mesh) {
    const material = Array.isArray(hit.object.material)
      ? hit.object.material[0]
      : hit.object.material;
    if ('color' in material) color = `#${(material.color as THREE.Color).getHexString()}`;
  }
  if (typeof color === 'string') {
    paint(color);
    toast('Color sampled. Match your silhouette to the surroundings.');
  }
}
$('#sample').onclick = sample;

function clearAvatars(avatars: Avatar[]) {
  for (const avatar of avatars) {
    scene.remove(avatar.group);
    const materials = new Set<THREE.Material>();
    avatar.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
      }
    });
    // Primitive geometry is shared with the school and other live avatars.
    for (const m of materials) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  }
}
function selectRole(role: Role) {
  if (active()) return;
  chosenRole = role;
  stage.dataset.role = role;
  stage.dataset.camera = role === 'seeker' ? 'first-person' : 'third-person';
  document
    .querySelectorAll<HTMLButtonElement>('button[data-role]')
    .forEach((b) => setSelected(b, b.dataset.role === role));
  $('#start').innerHTML = `Enter as ${role} ${icons.arrow}`;
  $('#role-description').textContent =
    role === 'hider'
      ? 'You have a minute to hide. Paint, pose, and stay out of sight while three seekers search the school.'
      : 'Walk the school in first person. Find eight carefully hidden chameleons in three minutes. Watch the corners. Check behind cover.';
  if (ready) {
    playerAvatar.group.visible = role === 'hider';
    tagger.visible = role === 'seeker';
  }
  updateHUD();
}
document
  .querySelectorAll<HTMLButtonElement>('button[data-role]')
  .forEach((b) => (b.onclick = () => selectRole(b.dataset.role as Role)));
function startRound() {
  if (!ready) return;
  const { base, accent, pattern, pose } = game.player;
  game.start(chosenRole);
  if (chosenRole === 'hider') {
    game.paint(base, accent, pattern);
    game.setPose(pose);
  }
  yaw = 0;
  pitch = chosenRole === 'hider' ? -0.13 : 0;
  paused = false;
  paintOpen = false;
  controlsEntered = false;
  keys.clear();
  $('#paint-panel').hidden = true;
  $('#pause-screen').hidden = true;
  $('#pause').setAttribute('aria-label', 'Pause game');
  result.close();
  clearAvatars(targetAvatars);
  clearAvatars(hunterAvatars);
  targetAvatars = [];
  hunterAvatars = [];
  for (const target of game.targets) {
    const avatar = createAvatar(target.base);
    avatar.paint(target.base, target.accent, target.pattern);
    avatar.pose(target.pose);
    avatar.group.position.set(target.x, target.y, target.z);
    avatar.group.rotation.y = target.angle;
    avatar.group.userData.targetId = target.id;
    scene.add(avatar.group);
    targetAvatars.push(avatar);
  }
  for (const hunter of game.hunters) {
    const avatar = createAvatar('#d39b56');
    avatar.paint('#d39b56', '#433d37', 'solid');
    avatar.group.position.set(hunter.x, 0, hunter.z);
    avatar.group.userData.ignoreAim = true;
    scene.add(avatar.group);
    hunterAvatars.push(avatar);
  }
  lastPhase = game.phase;
  syncPaint();
  updateHUD();
  chirp('paint');
  void enterControls();
  $('#a11y-status').textContent =
    chosenRole === 'hider'
      ? 'You have sixty seconds to hide.'
      : 'Find eight chameleons. First-person controls active.';
}
function lobby() {
  releaseMouse();
  result.close();
  help.close();
  paused = false;
  paintOpen = false;
  controlsEntered = false;
  clearAvatars(targetAvatars);
  clearAvatars(hunterAvatars);
  targetAvatars = [];
  hunterAvatars = [];
  game = new Game();
  lastPhase = game.phase;
  yaw = 0;
  pitch = -0.13;
  $('#pause-screen').hidden = true;
  $('#paint-panel').hidden = true;
  $('#pause').setAttribute('aria-label', 'Pause game');
  selectRole(chosenRole);
  syncPaint();
  updateHUD();
}
$('#start').onclick = startRound;
$('#play-again').onclick = startRound;
$('#back-lobby').onclick = $('#result-lobby').onclick = lobby;
$('#switch-role').onclick = () => {
  chosenRole = chosenRole === 'hider' ? 'seeker' : 'hider';
  lobby();
  startRound();
};
$('#skip').onclick = () => {
  game.beginSeeking();
  updateHUD();
  void enterControls();
};
function shoot() {
  if (chosenRole !== 'seeker' || game.phase !== 'seeking' || frozen() || !controlsEntered) return;
  const now = performance.now();
  if (now - lastShot < 350) return;
  lastShot = now;
  recoil = 0.12;
  const hit = castAim(90);
  const id = hit ? parentFlag(hit.object, 'targetId') : undefined;
  const tagged = game.tag(typeof id === 'number' ? id : null);
  stage.classList.remove('tagged', 'missed');
  stage.classList.add(tagged ? 'tagged' : 'missed');
  setTimeout(() => stage.classList.remove('tagged', 'missed'), 220);
  chirp(tagged ? 'tag' : 'lose');
  toast(tagged ? `Found one. ${game.found} of ${TARGET_COUNT}.` : game.lastEvent);
  updateHUD();
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#c8d9d4');
  scene.fog = new THREE.Fog('#c8d9d4', 30, 90);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    'aria-label',
    '3D school. WASD to move, mouse to look, Space to jump.',
  );
  stage.prepend(renderer.domElement);
  buildWorld(scene);
  camera = new THREE.PerspectiveCamera(76, 1, 0.06, 150);
  scene.add(camera);
  playerAvatar = createAvatar(game.player.base);
  playerAvatar.group.userData.ignoreAim = true;
  scene.add(playerAvatar.group);
  tagger = new THREE.Group();
  tagger.userData.ignoreAim = true;
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.23, 0.14),
    new THREE.MeshStandardMaterial({ color: '#35423e', roughness: 0.7 }),
  );
  grip.position.set(0, -0.1, 0.06);
  tagger.add(grip);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.13, 0.42, 16),
    new THREE.MeshStandardMaterial({ color: '#e8b960', roughness: 0.5 }),
  );
  barrel.rotation.x = Math.PI / 2;
  tagger.add(barrel);
  const tip = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.025, 8, 24),
    new THREE.MeshStandardMaterial({ color: '#f6edd3' }),
  );
  tip.position.z = -0.22;
  tagger.add(tip);
  tagger.scale.setScalar(0.62);
  tagger.position.set(0.31, -0.23, -0.75);
  camera.add(tagger);
  previewScene = new THREE.Scene();
  previewScene.add(new THREE.HemisphereLight('#fff4df', '#637b71', 2.5));
  const light = new THREE.DirectionalLight('#fff0db', 3);
  light.position.set(2, 4, 3);
  previewScene.add(light);
  previewAvatar = createAvatar(game.player.base);
  previewAvatar.group.rotation.y = -0.4;
  previewScene.add(previewAvatar.group);
  previewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  previewCamera.position.set(2, 1.8, 3.3);
  previewCamera.lookAt(0, 0.7, 0);
  previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  previewRenderer.toneMappingExposure = 0.95;
  $('#avatar-preview').append(previewRenderer.domElement);
  new ResizeObserver(resize).observe(stage);
  ready = true;
  resize();
  syncPaint();
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    setPaused(true);
    toast('Graphics were interrupted. Reload to restore the school.');
  });
  let drag: { x: number; y: number; distance: number; id: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!active() || frozen() || paintOpen) return;
    if (document.pointerLockElement === renderer.domElement) {
      if (event.button === 0) shoot();
      return;
    }
    if (!controlsEntered) {
      void enterControls();
      return;
    }
    drag = { x: event.clientX, y: event.clientY, distance: 0, id: event.pointerId };
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!drag || frozen() || paintOpen) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    drag.distance += Math.abs(dx) + Math.abs(dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    look(dx, dy);
  });
  renderer.domElement.addEventListener('pointerup', () => {
    if (drag && drag.distance < 5) shoot();
    drag = null;
  });
  renderer.domElement.addEventListener('pointercancel', () => (drag = null));
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  renderer.domElement.addEventListener(
    'wheel',
    (event) => {
      if (chosenRole === 'hider' && active()) {
        event.preventDefault();
        thirdPersonDistance = THREE.MathUtils.clamp(
          thirdPersonDistance + event.deltaY * 0.004,
          2,
          5.5,
        );
      }
    },
    { passive: false },
  );
}
function resize() {
  if (!renderer || !camera) return;
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  if (previewRenderer && !$('#paint-panel').hidden) {
    const el = $('#avatar-preview');
    previewRenderer.setSize(el.clientWidth, el.clientHeight, false);
    previewCamera.aspect = el.clientWidth / el.clientHeight;
    previewCamera.updateProjectionMatrix();
  }
}
function look(dx: number, dy: number) {
  yaw += dx * 0.0023;
  pitch = THREE.MathUtils.clamp(pitch - dy * 0.0023, -1.22, 1.22);
}
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === renderer?.domElement && !frozen() && !paintOpen)
    look(event.movementX, event.movementY);
});
const movementKeys = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
]);
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || help.open || result.open) return;
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    event.preventDefault();
    if (active()) setPaused(!paused);
    return;
  }
  if (frozen()) return;
  if (movementKeys.has(key)) {
    event.preventDefault();
    if (!paintOpen) keys.add(key);
  }
  if (event.repeat) return;
  if (key === 'f') {
    event.preventDefault();
    openPaint(!paintOpen);
  }
  if (key === 'e') sample();
  if (key === 'r' && canPaint()) {
    const poses: Pose[] = ['stand', 'crouch', 'flat'];
    game.setPose(poses[(poses.indexOf(game.player.pose) + 1) % 3]);
    syncPaint();
  }
  if ((key === 'c' || key === 'control') && active() && !paintOpen) {
    event.preventDefault();
    game.setPose(game.player.pose === 'crouch' ? 'stand' : 'crouch');
    syncPaint();
  }
  if (key === ' ' && active() && !paintOpen) {
    event.preventDefault();
    game.jump();
  }
});
document.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => {
  keys.clear();
  if (active()) setPaused(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && active()) setPaused(true);
});
document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
  const key = ({ up: 'w', left: 'a', down: 's', right: 'd' } as Record<string, string>)[
    button.dataset.move!
  ];
  button.onpointerdown = (event) => {
    if (frozen() || paintOpen) return;
    event.preventDefault();
    controlsEntered = true;
    button.setPointerCapture(event.pointerId);
    keys.add(key);
  };
  button.onpointerup =
    button.onpointercancel =
    button.onlostpointercapture =
      () => {
        keys.delete(key);
      };
});
$('#touch-jump').onclick = () => game.jump();
$('#touch-tag').onclick = shoot;

function updateHUD() {
  const playing = active();
  stage.dataset.phase = game.phase;
  stage.dataset.role = chosenRole;
  stage.dataset.camera = chosenRole === 'hider' ? 'third-person' : 'first-person';
  $('#lobby').hidden = game.phase !== 'ready';
  $('#play-hud').hidden = !playing;
  $('#crosshair').hidden = !playing || paused;
  $('.hud').hidden = !playing;
  $('#zone').textContent =
    ZONES.find(
      (zone) =>
        game.player.x >= zone.minX &&
        game.player.x <= zone.maxX &&
        game.player.z >= zone.minZ &&
        game.player.z <= zone.maxZ,
    )?.name || 'Central passage';
  $('#coordinates').textContent =
    `${game.player.x.toFixed(1)} / ${game.player.z.toFixed(1)} · ${game.player.y.toFixed(1)} m`;
  const seconds = Math.ceil(game.timeLeft);
  $('#timer').textContent = playing
    ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : 'EXPLORE & DISAPPEAR';
  $('#phase-label').textContent =
    game.phase === 'hiding'
      ? 'FIND YOUR HIDING PLACE'
      : playing
        ? 'THE SEARCH IS ON'
        : 'THE OLD ART SCHOOL';
  $('#camera-label').textContent =
    chosenRole === 'hider' ? 'THIRD-PERSON HIDER' : 'FIRST-PERSON SEEKER';
  $('#view-chip').textContent = chosenRole === 'hider' ? 'THIRD PERSON' : 'FIRST PERSON';
  $('#objective-label').textContent = chosenRole === 'hider' ? 'CAMOUFLAGE' : 'TARGETS FOUND';
  $('#objective-value').textContent =
    chosenRole === 'hider' ? `${Math.round(game.camouflage)}%` : `${game.found} / ${TARGET_COUNT}`;
  $('#objective-detail').textContent =
    chosenRole === 'hider'
      ? game.environment.name
      : `${MAX_MISSES - game.misses} mistakes remaining`;
  $('#found-count').textContent = `${game.found} / ${TARGET_COUNT}`;
  $('#miss-count').textContent = `${Math.max(0, MAX_MISSES - game.misses)} / ${MAX_MISSES}`;
  $('#seeker-count').hidden = chosenRole !== 'seeker';
  $('#paint-button').hidden = chosenRole !== 'hider';
  $('#skip').hidden = game.phase !== 'hiding';
  $('#exposure').hidden = chosenRole !== 'hider' || game.phase !== 'seeking';
  $('#suspicion').textContent = `${Math.round(game.suspicion)}%`;
  $('#suspicion-fill').style.width = `${game.suspicion}%`;
  $('#round-banner').textContent =
    game.phase === 'hiding'
      ? 'Find cover. Match the surface. Lose the silhouette.'
      : chosenRole === 'hider'
        ? 'They are looking. Stay still. Stay out of sight.'
        : 'Eight chameleons. Six rooms. Trust your eyes.';
  $('#enter-room').textContent = captureUnavailable
    ? 'Drag to look · retry mouse capture'
    : 'Click to capture mouse';
  $('#enter-room').hidden =
    coarse || document.pointerLockElement === renderer?.domElement || paintOpen || paused;
  $('#control-hint').textContent =
    chosenRole === 'hider'
      ? 'WASD move · Mouse look · Space jump · E sample · F paint · Esc pause'
      : 'WASD move · Mouse look · Left-click tag · Space jump · C crouch · Esc pause';
  $('#blend-value').textContent = `${Math.round(game.camouflage)}%`;
  $('#blend-fill').style.width = `${game.camouflage}%`;
  $('#blend-caption').textContent =
    `${game.environment.name}. Cover and pose matter as much as color.`;
  document
    .querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      '#paint-panel button:not(#close-paint):not(#finish-paint),#paint-panel input',
    )
    .forEach((control) => (control.disabled = !canPaint()));
  $('.touch-controls').hidden = !coarse || !playing || paintOpen || paused;
  $('.touch-actions').hidden = !coarse || !playing || paintOpen || paused;
  $('#touch-tag').hidden = chosenRole !== 'seeker';
}
function showResult() {
  releaseMouse();
  paintOpen = false;
  $('#paint-panel').hidden = true;
  const won = game.phase === 'won';
  const score = Math.max(0, Math.round(game.score));
  best = Math.max(best, score);
  try {
    localStorage.setItem('color-club-best', String(best));
  } catch {}
  $('#result-eyebrow').textContent = won
    ? 'A VERY GOOD DAY TO BE A CHAMELEON'
    : 'A LITTLE MORE PRACTICE';
  $('#result-title').textContent = won
    ? chosenRole === 'hider'
      ? 'What chameleon?'
      : 'An eye for everything.'
    : chosenRole === 'hider'
      ? 'Oh, there you are.'
      : 'Some secrets stayed hidden.';
  $('#result-description').textContent = won
    ? chosenRole === 'hider'
      ? 'You stayed hidden through the search. The school has a new masterpiece.'
      : 'All eight found. Every room searched. Nothing gets past you.'
    : chosenRole === 'hider'
      ? 'The seekers spotted you. Break their line of sight, match your surroundings, and get low.'
      : `You found ${game.found} of ${TARGET_COUNT}. ${game.misses >= MAX_MISSES ? 'Too many missed tags ended the round.' : 'Time ran out.'} Explore the other rooms and inspect cover from more than one angle.`;
  $('#round-score').textContent = String(score);
  $('#best-score').textContent = String(best);
  result.showModal();
  chirp(won ? 'win' : 'lose');
}
let previousTime = performance.now();
let hudTime = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  if (!ready) return;
  const elapsed = Math.min((now - previousTime) / 1000, 1);
  previousTime = now;
  const dt = Math.min(elapsed, 0.08);
  let moving = false;
  if (!frozen()) {
    if (active() && !paintOpen && controlsEntered) {
      const strafe =
        (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
        (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const forward =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const direction = movementDirection(yaw, strafe, forward);
      const oldX = game.player.x,
        oldZ = game.player.z;
      game.move(direction.x, direction.z, elapsed);
      moving = Math.hypot(game.player.x - oldX, game.player.z - oldZ) > 0.001;
    }
    game.tick(elapsed);
    if (game.phase !== lastPhase) {
      if (game.phase === 'seeking' && chosenRole === 'hider')
        toast('The seekers have entered the school.');
      if (game.phase === 'won' || game.phase === 'lost') showResult();
      lastPhase = game.phase;
    }
  }
  playerAvatar.group.position.set(game.player.x, game.player.y, game.player.z);
  playerAvatar.group.rotation.y = game.player.angle;
  playerAvatar.animate(reducedMotion ? 0 : now / 1000, moving);
  const view = cameraView(game.player, chosenRole, yaw, pitch, thirdPersonDistance, OBSTACLES);
  camera.position.set(view.position.x, view.position.y, view.position.z);
  camera.lookAt(view.target.x, view.target.y, view.target.z);
  playerAvatar.group.visible = chosenRole === 'hider' && view.distance > 0.6;
  tagger.visible = chosenRole === 'seeker' && active();
  recoil = Math.max(0, recoil - dt * 0.8);
  tagger.position.z = -0.75 + recoil;
  tagger.rotation.x = recoil * 0.8;
  for (let i = 0; i < hunterAvatars.length; i++) {
    const hunter = game.hunters[i];
    const avatar = hunterAvatars[i];
    avatar.group.visible = chosenRole === 'hider' && game.phase !== 'hiding';
    avatar.group.position.set(hunter.x, 0, hunter.z);
    avatar.group.rotation.y = hunter.angle;
    avatar.animate(reducedMotion ? 0 : now / 1000, !frozen() && game.phase === 'seeking');
  }
  for (let i = 0; i < targetAvatars.length; i++) {
    targetAvatars[i].group.visible = !game.targets[i].found;
    targetAvatars[i].animate(0, false);
  }
  renderer.render(scene, camera);
  if (paintOpen) {
    previewAvatar.animate(reducedMotion ? 0 : now / 1000, false);
    previewRenderer.render(previewScene, previewCamera);
  }
  hudTime += dt;
  if (hudTime > 0.12) {
    updateHUD();
    if (active() && chosenRole === 'hider' && !frozen()) {
      aimHit = castAim(10);
      const surface = aimHit ? parentFlag(aimHit.object, 'surfaceName') : null;
      $('#aim-label').textContent = typeof surface === 'string' ? `${surface} · E to sample` : '';
    } else $('#aim-label').textContent = '';
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
    'beforeend',
    '<section class="fatal" role="alert"><h2>The school needs WebGL.</h2><p>Enable graphics acceleration and reload to enter the room.</p></section>',
  );
  $<HTMLButtonElement>('#start').disabled = true;
}
