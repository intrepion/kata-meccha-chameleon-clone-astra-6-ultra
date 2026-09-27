import { test, expect, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(page.locator('#start')).toBeEnabled();
});

test.afterEach(async ({ page }) => {
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(pageErrors.get(page), 'The game should not report browser or rendering errors').toEqual(
    [],
  );
});

test('renders a real 3D room and an interactive character preview', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Out of sight. Into the fun.' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(2);
  const room = page.locator('#stage canvas');
  const dimensions = await room.evaluate((canvas) => ({
    width: (canvas as HTMLCanvasElement).width,
    height: (canvas as HTMLCanvasElement).height,
  }));
  expect(dimensions.width).toBeGreaterThan(500);
  expect(dimensions.height).toBeGreaterThan(300);
  // A rendered room has substantially more visual detail than a blank canvas.
  expect((await room.screenshot()).byteLength).toBeGreaterThan(20_000);
  await expect(page.getByRole('button', { name: 'Hide', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Paint Matcha' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: 'test-results/desktop-preview.png', fullPage: true });
});

test('paints custom colors, changes patterns and poses, and samples the room', async ({ page }) => {
  const rose = page.getByRole('button', { name: 'Paint Rose' });
  const custom = page.getByLabel('Custom body color');
  await rose.click();
  await expect(rose).toHaveAttribute('aria-pressed', 'true');
  await expect(custom).toHaveValue('#e899ac');
  await custom.fill('#123456');
  await expect(custom).toHaveValue('#123456');
  await expect(rose).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.swatch[aria-pressed="true"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Spots', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spots', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Solid', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Flatten', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Flatten', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('r');
  await expect(page.getByRole('button', { name: 'Stand', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Match surface' }).click();
  await expect(custom).not.toHaveValue('#123456');
  await expect(page.locator('#toast')).toContainText('Borrowed a little');
});

test('preserves the preview color, pattern, and pose when a hiding round begins', async ({
  page,
}) => {
  const custom = page.getByLabel('Custom body color');
  const stripes = page.getByRole('button', { name: 'Stripes', exact: true });
  const flatten = page.getByRole('button', { name: 'Flatten', exact: true });
  await custom.fill('#5a9dc7');
  await stripes.click();
  await flatten.click();
  await page.getByRole('button', { name: "Let's play hide & seek" }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'hiding');
  await expect(custom).toHaveValue('#5a9dc7');
  await expect(stripes).toHaveAttribute('aria-pressed', 'true');
  await expect(flatten).toHaveAttribute('aria-pressed', 'true');
});

test('opens and dismisses instructions with both the button and Escape', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Paint. Pose. Poof.' });
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('five mistakes');
  await page.getByRole('button', { name: 'Close instructions' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'How to play' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('starts hiding, skips preparation, and freezes the timer while paused or reading help', async ({
  page,
}) => {
  const stage = page.locator('#stage');
  const timer = page.locator('#timer');
  await page.getByRole('button', { name: "Let's play hide & seek" }).click();
  await expect(stage).toHaveAttribute('data-phase', 'hiding');
  await expect(timer).toHaveText(/00:2\d/);
  await expect(page.getByRole('button', { name: 'Seek', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ready or not, here they come' }).click();
  await expect(stage).toHaveAttribute('data-phase', 'seeking');
  await expect(timer).toHaveText(/00:4\d/);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Perfectly still.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume game', exact: true })).toBeVisible();
  const pausedTime = await timer.textContent();
  await page.waitForTimeout(1250);
  await expect(timer).toHaveText(pausedTime!);
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.locator('#pause-screen')).not.toBeVisible();
  await expect(timer).not.toHaveText(pausedTime!, { timeout: 5000 });

  await page.getByRole('button', { name: 'How to play' }).click();
  const helpTime = await timer.textContent();
  await page.waitForTimeout(1250);
  await expect(timer).toHaveText(helpTime!);
  await page.getByRole('button', { name: 'Close instructions' }).click();
  await expect(timer).not.toHaveText(helpTime!, { timeout: 5000 });
});

test('switches to seeking and supports camera, pause, and new-round controls', async ({ page }) => {
  const seek = page.getByRole('button', { name: 'Seek', exact: true });
  await seek.click();
  await expect(seek).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#paint-controls')).not.toBeVisible();
  await expect(page.locator('#seeker-controls')).toBeVisible();
  await expect(page.locator('#found-count')).toHaveText('0 / 5');
  await page.getByRole('button', { name: 'Ready, set, find them' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'seeking');
  await expect(page.locator('#timer')).toHaveText(/(?:01:00|00:5\d)/);
  await expect(seek).toBeDisabled();
  await page.getByRole('button', { name: 'Rotate camera', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Take a little breather' }).click();
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Start a new round' }).click();
  await expect(page.locator('#pause-screen')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause game', exact: true })).toBeVisible();
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'seeking');
  await expect(page.locator('#found-count')).toHaveText('0 / 5');
  await expect(page.locator('#miss-count')).toHaveText('5 / 5');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('keeps the room and controls within the viewport and exposes touch movement', async ({
    page,
  }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Move forward', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Move left', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Paint Lavender' }).tap();
    await expect(page.getByRole('button', { name: 'Paint Lavender' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: "Let's play hide & seek" }).tap();
    await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'hiding');
    await expect(page.locator('#round-banner')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  });
});
