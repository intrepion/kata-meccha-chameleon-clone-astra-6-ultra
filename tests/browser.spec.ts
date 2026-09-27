import { test, expect, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();

async function coordinates(page: Page) {
  const text = await page.locator('#coordinates').innerText();
  const values = text.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  return { x: values[0]!, z: values[1]!, y: values[2]! };
}

async function start(page: Page, role: 'hider' | 'seeker') {
  await page.locator(`button[data-role="${role}"]`).click();
  await expect(page.locator(`button[data-role="${role}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#start')).toContainText(`Enter as ${role}`);
  await page.locator('#start').click();
  await expect(page.locator('#lobby')).not.toBeVisible();
  await expect(page.locator('#stage')).toHaveAttribute(
    'data-phase',
    role === 'hider' ? 'hiding' : 'seeking',
  );
}

async function moveNorth(page: Page) {
  const before = await coordinates(page);
  await page.keyboard.down('w');
  try {
    await expect
      .poll(async () => (await coordinates(page)).z, { timeout: 10_000 })
      .toBeLessThan(before.z - 0.5);
  } finally {
    await page.keyboard.up('w');
  }
  return { before, after: await coordinates(page) };
}

async function openHelp(page: Page) {
  // Keyboard activation works while the room has captured the mouse.
  await page.locator('#help-button').press('Enter');
  await expect(page.getByRole('dialog', { name: 'This is hide & seek.' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('#stage > canvas')).toBeVisible();
  await expect(page.locator('#start')).toBeEnabled();
});

test.afterEach(async ({ page }) => {
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(pageErrors.get(page), 'The game should not report browser or rendering errors').toEqual(
    [],
  );
});

test('renders the school across the viewport with a third-person hider camera', async ({
  page,
}) => {
  await expect(page.getByRole('heading', { name: 'A whole world to disappear in.' })).toBeVisible();
  const room = page.locator('#stage > canvas');
  const bounds = (await room.boundingBox())!;
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
  expect(bounds.width).toBe(1440);
  expect(bounds.height).toBe(1050);
  expect((await room.screenshot()).byteLength).toBeGreaterThan(25_000);
  await expect(page.locator('#stage')).toHaveAttribute('data-camera', 'third-person');
  await expect(page.locator('button[data-role="hider"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.map-label')).toContainText('6 rooms');
  await page.screenshot({ path: 'test-results/desktop-preview.png' });
  await start(page, 'hider');
  await page.screenshot({ path: 'test-results/hider-third-person.png' });
});

test('opens paint with F and preserves custom paint, pattern, and pose when entering the school', async ({
  page,
}) => {
  await page.keyboard.press('f');
  await expect(page.locator('#paint-panel')).toBeVisible();
  await expect(page.locator('#avatar-preview canvas')).toBeVisible();
  const rose = page.getByRole('button', { name: 'Paint Rose' });
  const custom = page.getByLabel('Custom body color');
  await rose.click();
  await expect(rose).toHaveAttribute('aria-pressed', 'true');
  await expect(custom).toHaveValue('#e899ac');
  await custom.fill('#5a9dc7');
  await expect(rose).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Stripes', exact: true }).click();
  await page.getByRole('button', { name: 'Flatten', exact: true }).click();
  await page.getByRole('button', { name: 'Close paint panel' }).click();
  await start(page, 'hider');
  await page.keyboard.press('f');
  await expect(page.locator('#paint-panel')).toBeVisible();
  await expect(custom).toHaveValue('#5a9dc7');
  await expect(page.getByRole('button', { name: 'Stripes', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Flatten', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#pause-screen')).not.toBeVisible();
  const time = await page.locator('#timer').innerText();
  await expect(page.locator('#timer')).not.toHaveText(time, { timeout: 5000 });
});

test('seeker walks in first person and looks with mouse capture or the supported drag fallback', async ({
  page,
}) => {
  const captureMessages: string[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('Mouse capture unavailable:'))
      captureMessages.push(message.text());
  });
  await start(page, 'seeker');
  await expect(page.locator('#stage')).toHaveAttribute('data-camera', 'first-person');
  await expect(page.locator('#camera-label')).toHaveText('FIRST-PERSON SEEKER');
  await expect(page.locator('#crosshair')).toBeVisible();
  const captured = await page.evaluate(() => document.pointerLockElement?.tagName === 'CANVAS');
  if (!captured) {
    await expect(page.locator('#enter-room')).toContainText('Drag to look');
    console.info(captureMessages.join('\n'));
  }
  const movement = await moveNorth(page);
  expect(Math.abs(movement.after.x - movement.before.x)).toBeLessThan(0.2);
  expect(movement.after.z).toBeLessThan(movement.before.z - 0.5);
  const crop = { x: 440, y: 250, width: 560, height: 400 };
  const beforeLook = await page.screenshot({ clip: crop });
  await page.mouse.move(1040, 500);
  if (!captured) await page.mouse.down();
  await page.mouse.move(740, 440, { steps: 8 });
  if (!captured) await page.mouse.up();
  const afterLook = await page.screenshot({ clip: crop });
  expect(beforeLook.equals(afterLook), 'Mouse look should visibly turn the 3D camera').toBe(false);
  await page.screenshot({ path: 'test-results/seeker-first-person.png' });
});

test('Escape pauses movement and time, then resume returns control to the seeker', async ({
  page,
}) => {
  await start(page, 'seeker');
  await moveNorth(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Perfectly still.' })).toBeVisible();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', 'Resume game');
  const position = await page.locator('#coordinates').innerText();
  const time = await page.locator('#timer').innerText();
  await page.keyboard.down('w');
  await page.waitForTimeout(1250);
  await page.keyboard.up('w');
  await expect(page.locator('#coordinates')).toHaveText(position);
  await expect(page.locator('#timer')).toHaveText(time);
  await page.locator('#resume').click();
  await expect(page.locator('#pause-screen')).not.toBeVisible();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', 'Pause game');
  await moveNorth(page);
  await expect(page.locator('#timer')).not.toHaveText(time, { timeout: 5000 });
});

test('instructions freeze an active round and closing them allows movement again', async ({
  page,
}) => {
  await start(page, 'seeker');
  await openHelp(page);
  const dialog = page.getByRole('dialog', { name: 'This is hide & seek.' });
  await expect(dialog).toContainText('Walls and furniture block your shot');
  const position = await page.locator('#coordinates').innerText();
  const time = await page.locator('#timer').innerText();
  await page.keyboard.down('w');
  await page.waitForTimeout(1250);
  await page.keyboard.up('w');
  await expect(page.locator('#coordinates')).toHaveText(position);
  await expect(page.locator('#timer')).toHaveText(time);
  await page.getByRole('button', { name: 'Close instructions' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#pause-screen')).not.toBeVisible();
  await moveNorth(page);
  await expect(page.locator('#timer')).not.toHaveText(time, { timeout: 5000 });
  await openHelp(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('HUD clicks do not fire tags and clicking the room fires along the crosshair', async ({
  page,
}) => {
  await start(page, 'seeker');
  await openHelp(page);
  await page.getByRole('button', { name: 'Close instructions' }).click();
  await expect(page.locator('#miss-count')).toHaveText('8 / 8');
  await page.locator('#sound-button').click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#miss-count')).toHaveText('8 / 8');
  // Spawn faces the empty central passage. The shot uses the center aim ray,
  // even though this click lands away from the center of the canvas.
  await page.locator('#stage > canvas').click({ position: { x: 220, y: 450 } });
  await expect(page.locator('#miss-count')).toHaveText('7 / 8');
  await expect(page.locator('#found-count')).toHaveText('0 / 8');
  await page.locator('#pause').press('Enter');
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.locator('#restart').click();
  await expect(page.locator('#pause-screen')).not.toBeVisible();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', 'Pause game');
  await expect(page.locator('#miss-count')).toHaveText('8 / 8');
});

test('hider can skip preparation and return to the lobby to switch perspective', async ({
  page,
}) => {
  await start(page, 'hider');
  await expect(page.locator('#timer')).toHaveText(/(?:01:00|00:5\d)/);
  await page.locator('#skip').press('Enter');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'seeking');
  await expect(page.locator('#exposure')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#back-lobby').click();
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'ready');
  await page.locator('button[data-role="seeker"]').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-camera', 'first-person');
  await expect(page.locator('#start')).toContainText('Enter as seeker');
});

test('eight missed crosshair shots end the round and Escape returns to a playable lobby', async ({
  page,
}) => {
  await start(page, 'seeker');
  for (let remaining = 7; remaining >= 0; remaining--) {
    await page.locator('#stage > canvas').click({ position: { x: 220, y: 450 } });
    await expect(page.locator('#miss-count')).toHaveText(`${remaining} / 8`);
    if (remaining > 0) await page.waitForTimeout(400);
  }
  await expect(page.locator('#result-dialog')).toBeVisible();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'lost');
  await expect(page.locator('#result-description')).toContainText('Too many missed tags');
  await page.keyboard.press('Escape');
  await expect(page.locator('#result-dialog')).not.toBeVisible();
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'ready');
  await start(page, 'seeker');
  await expect(page.locator('#miss-count')).toHaveText('8 / 8');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('fits the viewport and supports movement, look dragging, and pause on touch screens', async ({
    page,
  }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await start(page, 'seeker');
    const forward = page.getByRole('button', { name: 'Move forward', exact: true });
    await expect(forward).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tag at crosshair' })).toBeVisible();
    const before = await coordinates(page);
    const button = (await forward.boundingBox())!;
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    try {
      await expect
        .poll(async () => (await coordinates(page)).z, { timeout: 10_000 })
        .toBeLessThan(before.z - 0.3);
    } finally {
      await page.mouse.up();
    }
    const crop = { x: 80, y: 260, width: 230, height: 230 };
    const beforeLook = await page.screenshot({ clip: crop });
    await page.mouse.move(300, 350);
    await page.mouse.down();
    await page.mouse.move(100, 380, { steps: 10 });
    await page.mouse.up();
    const afterLook = await page.screenshot({ clip: crop });
    expect(beforeLook.equals(afterLook), 'Dragging should change the mobile camera view').toBe(
      false,
    );
    await page.locator('#pause').tap();
    await expect(page.locator('#pause-screen')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await page.locator('#back-lobby').tap();
    await page.locator('#help-button').tap();
    await expect(page.getByRole('dialog', { name: 'This is hide & seek.' })).toBeVisible();
    await page.getByRole('button', { name: 'Close instructions' }).tap();
    await page.screenshot({ path: 'test-results/mobile-view.png' });
  });
});
