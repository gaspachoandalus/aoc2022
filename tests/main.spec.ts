import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __aocPreview?: {
      moduleName: string;
      started: boolean;
      completed: boolean;
    };
  }
}

async function showAllSolutions(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show all solutions' }).click();
}

test('serves day rows generated from the solution manifest', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3000/main.html');
  expect(response.ok()).toBeTruthy();

  const html = await response.text();
  expect(html).toContain('data-day="25"');
  expect(html).toContain('data-solution-id="11.1"');
  expect(html).not.toContain('GENERATED_DAY_ROWS');
});

test('has title', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html#module=test2D');

  await expect(page).toHaveTitle(/AOC 2022/);
});

test('describes the solutions as personal attempts', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const summary = page.locator('.selector-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveText(
    "My Advent of Code 2022 solutions, written as I worked through each puzzle. They're personal attempts, not definitive answers or necessarily the best approach. Try them with your own puzzle input."
  );
});

test('explains that puzzle input stays local to the browser', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const inputNote = page.locator('.input-source-note');
  await expect(inputNote).toBeVisible();
  await expect(inputNote).toHaveText(
    'Both parts of a day use the same input. Your input is processed in your browser and is never sent to a server. After a run, it stays saved in this tab. Sign in to Advent of Code if prompted.'
  );
});

test('shows animated solutions by default and can reveal all solutions', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const day1 = page.locator('[data-day="1"]');
  const day10 = page.locator('[data-day="10"]');
  await expect(day1).toBeHidden();
  await expect(page.getByText('Animated solutions only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Day 9 Both parts solution 09' })).toBeVisible();
  await expect(day10).toContainText('1 solution · Part 2 only');
  await expect(day10.locator('[data-solution-id="10.1"]')).toBeHidden();
  await expect(day10.getByRole('button', { name: 'Select Day 10 Part 2 solution 10' })).toBeVisible();

  await showAllSolutions(page);
  await expect(page).toHaveURL(/solutions=all/);
  await expect(day1).toBeVisible();
  await expect(day10).toContainText('2 solutions · one per part');
  await expect(day10.getByRole('button', { name: 'Select Day 10 Part 1 solution 10.1' })).toBeVisible();
  await expect(page.getByText('All solutions shown')).toBeVisible();

  const day1Solution = day1.getByRole('button', { name: 'Select Day 1 Both parts solution 01' });
  const input = page.getByRole('textbox', { name: 'Puzzle input (required)' });
  await day1Solution.click();
  await input.fill('unsaved draft');
  await page.getByRole('button', { name: 'Show animated solutions only' }).click();

  await expect(page).toHaveURL(/solutions=animated/);
  await expect(day1).toBeVisible();
  await expect(day1Solution).toHaveAttribute('aria-pressed', 'true');
  await expect(input).toHaveValue('unsaved draft');
  await expect(page.locator('[data-day="3"]')).toBeHidden();
  await expect(page.getByText('Selected solution stays visible')).toBeVisible();
});

test('restores the selected solution, filter, and window scroll after returning from a run', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:3000/main.html');

    await showAllSolutions(page);
    await expect(page).toHaveURL(/solutions=all/);
    await page.getByRole('button', { name: 'Select Day 1 Both parts solution 01' }).click();
    await page.getByRole('textbox', { name: 'Puzzle input (required)' }).fill('1000\n2000');

    if (viewport.width > 900) {
      await page.evaluate(() => window.scrollTo(0, 600));
    }
    const runButton = page.getByRole('button', { name: 'Run solution' });
    await runButton.scrollIntoViewIfNeeded();
    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeGreaterThan(0);
    await runButton.click();
    await expect(page).toHaveURL(/solutions=all#module=01/);

    await page.goBack();
    await expect(page.getByText('All solutions shown')).toBeVisible();
    await expect(page.locator('[data-day="1"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Day 1 Both parts solution 01' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('textbox', { name: 'Puzzle input (required)' }))
      .toHaveValue('1000\n2000');
    await page.waitForFunction(
      (expectedPosition) => {
        const selector = document.getElementById('day-selector');
        return selector !== null
          && getComputedStyle(selector).display !== 'none'
          && selector.querySelector('[data-day="1"]') !== null
          && window.scrollY === expectedPosition;
      },
      scrollPosition,
      { timeout: 10_000 },
    );
  }
});

test('requires puzzle input before launching a solution', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const runButton = page.getByRole('button', { name: 'Run solution' });
  const input = page.getByRole('textbox', { name: 'Puzzle input (required)' });
  await expect(input).toBeDisabled();
  await expect(runButton).toBeDisabled();

  await showAllSolutions(page);
  await page.getByRole('button', { name: 'Select Day 1 Both parts solution 01' }).click();
  await expect(input).toBeEnabled();
  await expect(runButton).toBeDisabled();

  await input.fill('123');
  await expect(runButton).toBeEnabled();
});

test('restores saved input for a selected solution', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');
  await page.evaluate(() => sessionStorage.setItem('aoc-input:01', 'saved puzzle input'));
  await page.reload();

  await showAllSolutions(page);
  await page.getByRole('button', { name: 'Select Day 1 Both parts solution 01' }).click();

  await expect(page.getByRole('textbox', { name: 'Puzzle input (required)' }))
    .toHaveValue('saved puzzle input');
  await expect(page.getByRole('button', { name: 'Run solution' })).toBeEnabled();
});

test('shares saved input across part-specific solutions for the same day', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');
  await page.evaluate(() => sessionStorage.setItem('aoc-input:11.1', 'shared puzzle input'));
  await page.reload();

  await showAllSolutions(page);
  const input = page.getByRole('textbox', { name: 'Puzzle input (required)' });
  await page.getByRole('button', { name: 'Select Day 11 Part 2 solution 11.2' }).click();
  await expect(input).toHaveValue('shared puzzle input');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('aoc-input:11')))
    .toBe('shared puzzle input');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('aoc-input:11.1')))
    .toBeNull();

  await page.getByRole('button', { name: 'Select Day 11 Part 1 solution 11.1' }).click();
  await expect(input).toHaveValue('shared puzzle input');
  await page.getByRole('button', { name: 'Clear saved input for day 11' }).click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Run solution' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('aoc-input:11')))
    .toBeNull();
});

test('links a selected solution to its Advent of Code input page', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');
  await showAllSolutions(page);
  await page.getByRole('button', { name: 'Select Day 3 Part 1 solution 03.1' }).click();

  const inputLink = page.getByRole('link', { name: 'Open Day 3 input on Advent of Code (new tab)' });
  await expect(inputLink).toHaveAttribute('href', 'https://adventofcode.com/2022/day/3/input');
  await expect(inputLink).toHaveAttribute('target', '_blank');
  await expect(inputLink).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByText(/won't fetch your Advent of Code input automatically/)).toBeVisible();
  await expect(page.getByText(/Sign in to Advent of Code if prompted/)).toBeVisible();
});

test('groups solutions by day and labels part coverage explicitly', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');
  await showAllSolutions(page);

  const day1 = page.locator('[data-day="1"]');
  await expect(day1).toContainText('1 solution · both parts');
  await expect(day1.getByRole('button', { name: 'Select Day 1 Both parts solution 01' })).toBeVisible();

  const day10 = page.locator('[data-day="10"]');
  await expect(day10).toContainText('2 solutions · one per part');
  await expect(day10.getByRole('button', { name: 'Select Day 10 Part 1 solution 10.1' })).toBeVisible();
  await expect(day10.getByRole('button', { name: 'Select Day 10 Part 2 solution 10' })).toBeVisible();

  const day22 = page.locator('[data-day="22"]');
  await expect(day22).toContainText('2 solutions · one per part');
  await expect(day22.getByRole('button', { name: 'Select Day 22 Part 1 solution 22.1' })).toBeVisible();
  await expect(day22.getByRole('button', { name: 'Select Day 22 Part 2 solution 22' })).toBeVisible();

  const day14 = page.locator('[data-day="14"]');
  await expect(day14.getByRole('button', { name: 'Select Day 14 Both parts solution 14' })).toBeVisible();
  await expect(day14.locator('[data-solution-id="14.1"]')).toBeHidden();

  const day25 = page.locator('[data-day="25"]');
  await expect(day25).toContainText('1 solution · Part 1 only');
  await expect(day25.getByRole('button', { name: 'Select Day 25 Part 1 solution 25' })).toBeVisible();
});

test('stacks part-specific solutions and lets single solutions fill the shared area', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');
  await showAllSolutions(page);

  const day3 = page.locator('[data-day="3"]');
  const day3Part1 = day3.getByRole('button', { name: 'Select Day 3 Part 1 solution 03.1' });
  const day3Part2 = day3.getByRole('button', { name: 'Select Day 3 Part 2 solution 03.2' });
  const part1Box = await day3Part1.boundingBox();
  const part2Box = await day3Part2.boundingBox();
  if (!part1Box || !part2Box) {
    throw new Error('Expected both Day 3 solution buttons to have layout boxes.');
  }
  expect(Math.abs(part1Box.x - part2Box.x)).toBeLessThan(1);
  expect(Math.abs(part1Box.width - part2Box.width)).toBeLessThan(1);
  expect(part2Box.y).toBeGreaterThan(part1Box.y);

  const day1 = page.locator('[data-day="1"]');
  const day1Solution = day1.getByRole('button', { name: 'Select Day 1 Both parts solution 01' });
  const day1Solutions = day1.locator('.day-option__solutions');
  const day1Box = await day1.boundingBox();
  const day3Box = await day3.boundingBox();
  const singleSolutionBox = await day1Solution.boundingBox();
  const singleAreaBox = await day1Solutions.boundingBox();
  if (!day1Box || !day3Box || !singleSolutionBox || !singleAreaBox) {
    throw new Error('Expected the Day 1 and Day 3 solution areas to have layout boxes.');
  }
  expect(Math.abs(day1Box.height - day3Box.height)).toBeLessThan(1);
  expect(Math.abs(singleSolutionBox.height - singleAreaBox.height)).toBeLessThan(1);

  const day10Part1 = page.getByRole('button', { name: 'Select Day 10 Part 1 solution 10.1' });
  const day10Part1Box = await day10Part1.boundingBox();
  const day10Part2 = page.getByRole('button', { name: 'Select Day 10 Part 2 solution 10' });
  const day10Part2Box = await day10Part2.boundingBox();
  const day10PreviewBox = await day10Part2.locator('.solution-option__preview').boundingBox();
  if (!day10Part1Box || !day10Part2Box || !day10PreviewBox) {
    throw new Error('Expected the Day 10 part 2 preview to have a layout box.');
  }
  expect(day10Part1Box.height).toBeLessThan(day10Part2Box.height);
  expect(day10PreviewBox.width).toBeGreaterThan(day10Part2Box.width * 0.9);
});

test('keeps solution buttons in place when saved input is shown', async ({ page }) => {
  const solutionName = 'Select Day 10 Part 1 solution 10.1';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3000/main.html');
  await showAllSolutions(page);
  await page.locator('.selector-shell').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const beforeTop = await page.getByRole('button', { name: solutionName })
    .evaluate((element) => element.getBoundingClientRect().top);

  await page.evaluate(() => sessionStorage.setItem('aoc-input:10', 'saved puzzle input'));
  await page.reload();

  await expect(page).toHaveURL(/solutions=all/);
  const savedDay = page.locator('[data-day="10"]');
  await expect(savedDay).toContainText('Saved input');
  await page.locator('.selector-shell').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const afterTop = await savedDay.getByRole('button', { name: solutionName })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(afterTop).toBe(beforeTop);
});

test('shows animation previews only for visual solutions and uses stills for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3000/main.html');

  const ropeSolution = page.getByRole('button', { name: 'Select Day 9 Both parts solution 09' });
  await expect(ropeSolution).toHaveClass(/has-preview/);
  const preview = ropeSolution.locator('picture.solution-option__preview');
  await expect(preview.locator('source')).toHaveAttribute('media', '(prefers-reduced-motion: reduce)');
  await expect(preview.locator('source')).toHaveAttribute('srcset', 'previews/09-poster.webp');
  await expect(preview.locator('img')).toHaveAttribute('loading', 'lazy');
  await expect(preview.locator('img')).toHaveAttribute('src', 'previews/09-poster.webp');
  await expect(page.locator('[data-solution-id="17.2"]')).toBeHidden();
  await showAllSolutions(page);
  await expect(page.getByRole('button', { name: 'Select Day 17 Part 2 solution 17.2' }))
    .not.toHaveClass(/has-preview/);

  const animation = await page.request.get('http://127.0.0.1:3000/previews/09.webp');
  const poster = await page.request.get('http://127.0.0.1:3000/previews/09-poster.webp');
  expect(animation.ok()).toBeTruthy();
  expect(poster.ok()).toBeTruthy();
});

test('preview mode runs without stats or configuration overlays', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem(
    'aoc-input:9',
    'R 3\nU 2\nL 2\nD 1'
  ));
  await page.goto('http://127.0.0.1:3000/main.html#module=09;preview=1;zoom=3');

  const canvas = page.locator('canvas[data-aoc-renderer="true"]');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#stats')).toHaveCount(0);
  await expect(page.locator('.lil-gui')).toHaveCount(0);
  await expect(page.locator('#info')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__aocPreview?.started ?? false)).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => {
    const scale = element.getContext('2d')?.getTransform().a ?? 0;
    const stepIndex = Math.sqrt(scale) / 0.05;
    return scale <= 3 && Math.abs(stepIndex - Math.round(stepIndex)) < 1e-5;
  })).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => {
    const context = element.getContext('2d');
    if (!context) return false;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] || pixels[i + 1] || pixels[i + 2]) return true;
    }
    return false;
  }), { timeout: 10_000 }).toBe(true);
});

test('rate 0 runs the preview without per-step pacing', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem(
    'aoc-input:9',
    'R 3\nU 2\nL 2\nD 1'
  ));
  await page.goto('http://127.0.0.1:3000/main.html#module=09;preview=1;rate=0');

  await expect.poll(
    () => page.evaluate(() => window.__aocPreview?.completed ?? false),
    { timeout: 5_000 }
  ).toBe(true);
});

test('3D preview continues through automatic pauses without overlays', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('aoc-input:18', '0,0,0'));
  await page.goto('http://127.0.0.1:3000/main.html#module=18;preview=1;rate=0');

  await expect(page.locator('canvas[data-aoc-renderer="true"]')).toBeVisible();
  await expect(page.locator('#stats')).toHaveCount(0);
  await expect(page.locator('.lil-gui')).toHaveCount(0);
  await expect(page.locator('.display-controls--2d')).toHaveCount(0);
  await expect.poll(
    () => page.evaluate(() => window.__aocPreview?.completed ?? false),
    { timeout: 20_000 }
  ).toBe(true);
});

test('Day 24 preview completes for a route extending in depth', async ({ page }) => {
  await page.addInitScript(() => {
    const width = 50;
    const height = 1;
    const lines = [
      '#.' + '#'.repeat(width),
      ...Array.from({ length: height }, () => '#' + '.'.repeat(width) + '#'),
      '#'.repeat(width) + '.#'
    ];
    sessionStorage.setItem('aoc-input:24', lines.join('\n'));
  });
  await page.goto('http://127.0.0.1:3000/main.html#module=24;preview=1;rate=0');

  const canvas = page.locator('canvas[data-aoc-renderer="true"]');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveClass(/display-canvas--3d/);
  await expect.poll(
    () => page.evaluate(() => window.__aocPreview?.completed ?? false),
    { timeout: 20_000 }
  ).toBe(true);
  await expect(page.locator('body')).toContainText('Result part1: 51');
  await expect(page.locator('body')).toContainText('Result part2: 153');
});

test('shows 2D controls in a keyboard-accessible disclosure', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:3000/main.html#module=test2D');

    await expect(page.locator('canvas[data-aoc-renderer="true"]')).toBeVisible();
    const controls = page.locator('.display-controls--2d');
    const summary = controls.locator('summary');
    const panel = controls.locator('.display-controls__panel');

    await expect(summary).toHaveText('2D controls');
    await expect(panel).toBeHidden();
    await summary.focus();
    await page.keyboard.press('Space');
    await expect(controls).toHaveAttribute('open', '');
    await expect(panel).toContainText('Drag to pan; scroll to zoom around the pointer.');
    await expect(panel).toContainText('One finger to pan; pinch to zoom.');
    await expect(panel).toContainText('Pause or resume the simulation.');
    await expect(panel).toContainText('Advance one step.');

    const panelBounds = await panel.boundingBox();
    if (!panelBounds) {
      throw new Error('Expected the 2D controls panel to have a layout box.');
    }
    expect(panelBounds.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds.y).toBeGreaterThanOrEqual(0);
    expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(viewport.width);
    expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(viewport.height);

    await page.keyboard.press('Space');
    await expect(panel).toBeHidden();
  }
});

test('handles pointer movement during a two-finger touch gesture', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:3000/main.html#module=test2D');
  await expect(page.locator('canvas[data-aoc-renderer="true"]')).toBeVisible();

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-aoc-renderer="true"]');
    if (!canvas) {
      throw new Error('Expected the 2D renderer canvas to exist.');
    }

    const touch = (clientX: number, clientY: number) => ({ clientX, clientY });
    const dispatchTouch = (type: string, touches: { clientX: number; clientY: number }[]) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'touches', { value: touches });
      canvas.dispatchEvent(event);
    };

    dispatchTouch('touchstart', [touch(10, 10), touch(110, 10)]);
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 20,
      clientY: 10,
    }));
    dispatchTouch('touchmove', [touch(20, 10), touch(130, 10)]);
    canvas.dispatchEvent(new Event('touchend', { bubbles: true }));
  });

  expect(pageErrors).toEqual([]);
});

test('labels simulation traces and preserves the title when logs update', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('aoc-input:18', '0,0,0'));
  await page.goto('http://127.0.0.1:3000/main.html#module=18');

  const title = page.locator('#simulation-title');
  await expect(title).toHaveText('Day 18 · Boiling boulders · Both parts');
  await expect(page.locator('#info')).toBeVisible();
  await expect(page.locator('#info')).not.toContainText('Description');
  await expect(page.locator('#info')).toHaveCSS('padding-top', '8px');
  await expect(page.locator('#info')).toHaveCSS('border-top-width', '1px');

  await page.evaluate(async () => {
    const { Log } = await import('./utils/Log.js');
    Log.log('trace marker');
    Log.update();
  });

  await expect(title).toHaveText('Day 18 · Boiling boulders · Both parts');
  await expect(page.locator('#simulation-traces')).toContainText('trace marker');
});

test('FPS stats start hidden and can be shown beside traces in both renderers', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 641, height: 844 },
    { width: 640, height: 844 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);

    for (const module of ['test2D', 'test3D']) {
      await page.goto(`http://127.0.0.1:3000/main.html#module=${module}`);

      if (module === 'test2D') {
        await page.getByRole('button', { name: 'Debug' }).waitFor();
        const controlsByFolder = await page.evaluate(() => {
          const controls = (name: string) => {
            const title = Array.from(document.querySelectorAll('.lil-gui .title')).find(element =>
              element.textContent?.trim() === name
            );
            const folder = title?.parentElement;
            return Array.from(folder?.querySelectorAll('.controller') ?? [])
              .map(element => element.textContent?.trim() ?? '');
          };
          return {
            debug: controls('Debug'),
            simulation: controls('Simulation')
          };
        });
        expect(controlsByFolder.debug).toContain('show FPS');
        expect(controlsByFolder.debug).toContain('show quadtree');
        expect(controlsByFolder.simulation).not.toContain('show FPS');
        expect(controlsByFolder.simulation).not.toContain('show quadtree');
        if (viewport.width <= 640) {
          const guiBounds = await page.locator('.lil-gui.root').boundingBox();
          const quadtreeControlBounds = await page.locator('.lil-gui .controller.boolean')
            .filter({ hasText: 'show quadtree' })
            .boundingBox();
          if (!guiBounds || !quadtreeControlBounds) {
            throw new Error('Expected the 2D Debug controls to be visible.');
          }
          expect(quadtreeControlBounds.y + quadtreeControlBounds.height)
            .toBeLessThanOrEqual(guiBounds.y + guiBounds.height);
        }
      }

      const stats = page.locator('#stats');
      const toggle = page.locator('.lil-gui .controller.boolean')
        .filter({ hasText: 'show FPS' })
        .locator('input[type="checkbox"]');

      await expect(stats).toHaveClass(/hidden/);
      await expect(stats).toBeHidden();
      await expect(toggle).not.toBeChecked();

      await toggle.check({ force: true });
      await expect(stats).toBeVisible();

      await page.evaluate(async () => {
        const { Log } = await import('./utils/Log.js');
        Log.log('trace line '.repeat(60));
        Log.update();
      });

      const placement = await page.evaluate(() => {
        const bounds = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
        const info = bounds('#info');
        const stats = bounds('#stats');
        const overlays = bounds('#simulation-overlays');
        const gui = bounds('.lil-gui');
        const controls = bounds('.display-controls');
        return {
          infoRight: info?.right ?? 0,
          statsLeft: stats?.left ?? 0,
          statsRight: stats?.right ?? window.innerWidth,
          viewportWidth: window.innerWidth,
          overlaysLeft: overlays?.left ?? 0,
          overlaysRight: overlays?.right ?? window.innerWidth,
          overlaysTop: overlays?.top ?? 0,
          overlaysBottom: overlays?.bottom ?? window.innerHeight,
          guiLeft: gui?.left ?? 0,
          guiRight: gui?.right ?? 0,
          guiTop: gui?.top ?? 0,
          guiBottom: gui?.bottom ?? 0,
          controlsTop: controls?.top ?? window.innerHeight
        };
      });
      expect(placement.overlaysLeft).toBe(16);
      expect(placement.statsLeft).toBeGreaterThanOrEqual(placement.infoRight);
      expect(placement.statsRight).toBeLessThanOrEqual(placement.viewportWidth);
      expect(
        placement.overlaysRight <= placement.guiLeft
          || placement.overlaysLeft >= placement.guiRight
          || placement.overlaysBottom <= placement.guiTop
          || placement.overlaysTop >= placement.guiBottom
      ).toBe(true);
      expect(placement.overlaysBottom).toBeLessThanOrEqual(placement.controlsTop);

      await toggle.uncheck({ force: true });
      await expect(stats).toBeHidden();
    }
  }
});

test('2D camera follows a target before its first render frame', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const result = await page.evaluate(async () => {
    const { DisplayWeb2D } = await import('./utils/DisplayWeb2D.js');
    const display = new DisplayWeb2D();
    const target = { x: 1000, y: 1000 };

    display.init();
    display.scrollIntoView(target, false);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    const parsePoint = (value: string) => value.split(',').map(Number);
    const [left, top] = parsePoint(display.simulation.boundaries);
    const [width, height] = parsePoint(display.simulation.size);

    return {
      boundaries: { x: left, y: top },
      size: { width, height },
      targetVisible: target.x >= left
        && target.x <= left + width
        && target.y >= top
        && target.y <= top + height
    };
  });

  expect(Number.isFinite(result.boundaries.x)).toBe(true);
  expect(Number.isFinite(result.boundaries.y)).toBe(true);
  expect(result.size.width).toBeGreaterThan(0);
  expect(result.size.height).toBeGreaterThan(0);
  expect(result.targetVisible).toBe(true);
});

test('3D camera only follows targets outside its safe frame', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const result = await page.evaluate(async () => {
    const [{ WebDisplay3D }, THREE] = await Promise.all([
      import('./utils/DisplayWeb3D.js'),
      import('three')
    ]);

    const display = new WebDisplay3D({
      cameraFollow: { positionDirection: [0, 1, 1] }
    });
    display.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      1,
      100_000
    );
    display.camera.position.set(0, 0, 5_000);
    display.camera.lookAt(0, 0, 0);
    display.camera.updateMatrixWorld(true);
    display.cameraTarget = new THREE.Vector3(100, 0, 0);

    const initialPosition = display.camera.position.clone();
    const initialRotation = display.camera.quaternion.clone();
    display.updateCameraFollow(1 / 60);
    const heldWhileVisible = display.camera.position.equals(initialPosition)
      && display.camera.quaternion.equals(initialRotation);

    display.cameraTarget.set(10_000, 0, 0);
    display.updateCameraFollow(1 / 60);
    const followedAfterLeaving = !display.camera.position.equals(initialPosition)
      && !display.camera.quaternion.equals(initialRotation);

    const preview = new WebDisplay3D({ preview: true });
    preview.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      1,
      100_000
    );
    preview.camera.position.set(0, 0, 5_000);
    preview.camera.lookAt(0, 0, 0);
    preview.center(0, 0, 0);
    const previewPosition = preview.camera.position.clone();
    const previewRotation = preview.camera.quaternion.clone();
    preview.center(0, 0, 0.01);
    const previewHeldWhileVisible = preview.camera.position.equals(previewPosition)
      && preview.camera.quaternion.equals(previewRotation);

    const initiallyCentered = new WebDisplay3D({
      cameraFollow: {
        distanceMultiplier: 1.5,
        positionDirection: [1, 0.85, 0.25],
        snapToInitialTarget: true
      }
    });
    initiallyCentered.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      1,
      100_000
    );
    initiallyCentered.camera.position.set(0, 3_000, 3_000);
    initiallyCentered.center(2, 2, 14);
    initiallyCentered.camera.updateMatrixWorld(true);
    const initialTargetProjection = new THREE.Vector3(150, 150, 750)
      .project(initiallyCentered.camera);

    return {
      heldWhileVisible,
      followedAfterLeaving,
      previewHeldWhileVisible,
      initialTargetCentered: Math.abs(initialTargetProjection.x) < 1e-8
        && Math.abs(initialTargetProjection.y) < 1e-8,
      initialCameraDistance: initiallyCentered.camera.position.distanceTo(
        new THREE.Vector3(150, 150, 750)
      )
    };
  });

  expect(result.heldWhileVisible).toBe(true);
  expect(result.followedAfterLeaving).toBe(true);
  expect(result.previewHeldWhileVisible).toBe(true);
  expect(result.initialTargetCentered).toBe(true);
  expect(result.initialCameraDistance).toBeCloseTo(2_700);
});

test('3D axes are visible by default', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const axes = await page.evaluate(async () => {
    const { WebDisplay3D } = await import('./utils/DisplayWeb3D.js');
    const display = new WebDisplay3D({ preview: true });
    display.init();

    return {
      visible: display.axes.visible,
      attachedToScene: display.scene.children.includes(display.axes)
    };
  });

  expect(axes).toEqual({ visible: true, attachedToScene: true });
});

test('3D wheel adjusts field of view without moving the camera', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const result = await page.evaluate(async () => {
    const [{ WebDisplay3D }, THREE] = await Promise.all([
      import('./utils/DisplayWeb3D.js'),
      import('three')
    ]);

    const display = new WebDisplay3D({ preview: true });
    const canvas = document.createElement('canvas');
    const controls = document.createElement('div');
    const gui = document.createElement('div');
    const outside = document.createElement('div');
    controls.classList.add('display-controls');
    gui.classList.add('lil-gui');
    document.body.append(canvas, controls, gui, outside);
    display.camera = new THREE.PerspectiveCamera(50, 1, 1, 10_000);
    Reflect.set(display, 'renderer', { domElement: canvas });
    Reflect.set(display, 'pointerLockControls', { isLocked: false });

    const onWheel = Reflect.get(display, 'onWheel') as (event: WheelEvent) => void;
    const dispatchWheel = (
      target: Element,
      deltaY: number,
      deltaMode = WheelEvent.DOM_DELTA_PIXEL
    ) => {
      const event = new WheelEvent('wheel', {
        deltaY,
        deltaMode,
        bubbles: true,
        cancelable: true
      });
      window.addEventListener('wheel', onWheel.bind(display), { once: true, passive: false });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };

    const initialFov = display.camera.fov;
    const initialPosition = display.camera.position.clone();
    const initialRotation = display.camera.quaternion.clone();
    const initialProjection = display.camera.projectionMatrix.clone();
    const widenedWheelPrevented = dispatchWheel(canvas, 100);
    const widenedFov = display.camera.fov;
    const projectionUpdated = !display.camera.projectionMatrix.equals(initialProjection);
    const narrowedWheelPrevented = dispatchWheel(canvas, -100);
    const restoredFov = display.camera.fov;

    dispatchWheel(canvas, 3, WheelEvent.DOM_DELTA_LINE);
    const lineModeFov = display.camera.fov;
    dispatchWheel(canvas, -3, WheelEvent.DOM_DELTA_LINE);
    dispatchWheel(canvas, 1, WheelEvent.DOM_DELTA_PAGE);
    const pageModeFov = display.camera.fov;
    dispatchWheel(canvas, -1, WheelEvent.DOM_DELTA_PAGE);

    const controlsWheelPrevented = dispatchWheel(controls, 100);
    const guiWheelPrevented = dispatchWheel(gui, 100);
    const outsideWheelPrevented = dispatchWheel(outside, 100);
    const unchangedOutsideFov = display.camera.fov;

    Reflect.set(display, 'pointerLockControls', { isLocked: true });
    const lockedWheelPrevented = dispatchWheel(outside, 100);
    const lockedFov = display.camera.fov;

    for (let index = 0; index < 20; index += 1) {
      dispatchWheel(canvas, 100);
    }
    const maximumFov = display.camera.fov;
    for (let index = 0; index < 20; index += 1) {
      dispatchWheel(canvas, -100);
    }
    const minimumFov = display.camera.fov;

    canvas.remove();
    controls.remove();
    gui.remove();
    outside.remove();

    return {
      initialFov,
      widenedFov,
      restoredFov,
      lineModeFov,
      pageModeFov,
      projectionUpdated,
      cameraUnchanged: display.camera.position.equals(initialPosition)
        && display.camera.quaternion.equals(initialRotation),
      widenedWheelPrevented,
      narrowedWheelPrevented,
      controlsWheelPrevented,
      guiWheelPrevented,
      outsideWheelPrevented,
      unchangedOutsideFov,
      lockedWheelPrevented,
      lockedFov,
      maximumFov,
      minimumFov,
      movementUnchanged: !display.moveForward && !display.moveBackward
    };
  });

  expect(result.initialFov).toBe(50);
  expect(result.widenedFov).toBeGreaterThan(result.initialFov);
  expect(result.widenedFov).toBe(55);
  expect(result.restoredFov).toBeCloseTo(result.initialFov);
  expect(result.lineModeFov).toBeCloseTo(52.4);
  expect(result.pageModeFov).toBe(55);
  expect(result.projectionUpdated).toBe(true);
  expect(result.cameraUnchanged).toBe(true);
  expect(result.widenedWheelPrevented).toBe(true);
  expect(result.narrowedWheelPrevented).toBe(true);
  expect(result.controlsWheelPrevented).toBe(false);
  expect(result.guiWheelPrevented).toBe(false);
  expect(result.outsideWheelPrevented).toBe(false);
  expect(result.unchangedOutsideFov).toBeCloseTo(result.initialFov);
  expect(result.lockedWheelPrevented).toBe(true);
  expect(result.lockedFov).toBeGreaterThan(result.initialFov);
  expect(result.maximumFov).toBe(100);
  expect(result.minimumFov).toBe(25);
  expect(result.movementUnchanged).toBe(true);
});

test('3D movement toggles slow speed with Ctrl and lets Shift temporarily override it', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const speeds = await page.evaluate(async () => {
    const [{ WebDisplay3D }, THREE] = await Promise.all([
      import('./utils/DisplayWeb3D.js'),
      import('three')
    ]);

    const display = new WebDisplay3D();
    const position = new THREE.Vector3();
    display.camera = new THREE.PerspectiveCamera();
    Object.assign(display, {
      pointerLockControls: {
        isLocked: true,
        getDirection: (target: { set(x: number, y: number, z: number): object }) =>
          target.set(0, 0, -1),
        getObject: () => ({ position })
      }
    });

    const onKeyDown = Reflect.get(display, 'onKeyDown') as (event: KeyboardEvent) => void;
    const onKeyUp = Reflect.get(display, 'onKeyUp') as (event: KeyboardEvent) => void;
    const animatePointerLockControls = Reflect.get(
      display,
      'animatePointerLockControls'
    ) as (delta: number) => void;
    const toggleSlowMode = () => {
      onKeyDown.call(
        display,
        new KeyboardEvent('keydown', { code: 'ControlLeft', ctrlKey: true })
      );
      onKeyDown.call(
        display,
        new KeyboardEvent('keydown', { code: 'ControlLeft', ctrlKey: true, repeat: true })
      );
      onKeyUp.call(display, new KeyboardEvent('keyup', { code: 'ControlLeft' }));
    };
    const measureSpeed = (modifiers: { shiftKey?: boolean } = {}) => {
      display.velocity.set(0, 0, 0);
      position.set(0, 0, 0);
      onKeyDown.call(
        display,
        new KeyboardEvent('keydown', { code: 'KeyW', ...modifiers })
      );
      animatePointerLockControls.call(display, 1 / 60);
      return display.velocity.length();
    };
    const measureAfterReleasingShift = () => {
      display.velocity.set(0, 0, 0);
      onKeyUp.call(display, new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
      animatePointerLockControls.call(display, 1 / 60);
      return display.velocity.length();
    };

    const normal = measureSpeed({});
    toggleSlowMode();
    const slow = measureSpeed();
    const fastWhileSlow = measureSpeed({ shiftKey: true });
    const slowAfterShift = measureAfterReleasingShift();
    toggleSlowMode();
    const restoredNormal = measureSpeed();
    const fast = measureSpeed({ shiftKey: true });
    const normalAfterShift = measureAfterReleasingShift();
    return {
      normal,
      slow,
      fastWhileSlow,
      slowAfterShift,
      restoredNormal,
      fast,
      normalAfterShift
    };
  });

  expect(speeds.slow).toBeCloseTo(speeds.normal / 4);
  expect(speeds.fastWhileSlow).toBeCloseTo(speeds.normal * 2);
  expect(speeds.slowAfterShift).toBeCloseTo(speeds.slow);
  expect(speeds.restoredNormal).toBeCloseTo(speeds.normal);
  expect(speeds.fast).toBeCloseTo(speeds.normal * 2);
  expect(speeds.normalAfterShift).toBeCloseTo(speeds.normal);

  await page.goto('http://127.0.0.1:3000/main.html#module=test3D');
  await expect(page.locator('.lil-gui.root')).toContainText('FOV (°)');
  const speedStatus = page.locator('.display-controls--3d > summary [aria-live="polite"]');
  await expect(speedStatus).toHaveText('Normal speed');
  await page.keyboard.down('Control');
  await page.keyboard.up('Control');
  await expect(speedStatus).toHaveText('Slow speed');
  await page.keyboard.down('Shift');
  await expect(speedStatus).toHaveText('Fast speed');
  await page.keyboard.up('Shift');
  await expect(speedStatus).toHaveText('Slow speed');
  await page.keyboard.down('Control');
  await page.keyboard.up('Control');
  await expect(speedStatus).toHaveText('Normal speed');
});

test('3D display clears held keys and the selected wireframe when the window loses focus', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html');

  const state = await page.evaluate(async () => {
    const [{ WebDisplay3D }, THREE] = await Promise.all([
      import('./utils/DisplayWeb3D.js'),
      import('three')
    ]);

    const display = new WebDisplay3D({ preview: true });
    display.init();
    display.start();
    display.renderer.setAnimationLoop(null);

    const material = new THREE.MeshBasicMaterial({ wireframe: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    display.scene.add(mesh);
    display.previousIntersectObject = mesh;
    Object.assign(display, {
      altKey: true,
      moveForward: true,
      moveBackward: true,
      moveUp: true,
      moveDown: true,
      moveLeft: true,
      moveRight: true,
      moveFast: true,
      moveSlowMode: true
    });

    const speedStatus = document.createElement('span');
    Reflect.set(display, 'movementSpeedStatus', speedStatus);
    window.dispatchEvent(new Event('blur'));

    const result = {
      altKey: display.altKey,
      movement: [
        display.moveForward,
        display.moveBackward,
        display.moveUp,
        display.moveDown,
        display.moveLeft,
        display.moveRight
      ],
      moveFast: display.moveFast,
      moveSlowMode: display.moveSlowMode,
      speedStatus: speedStatus.textContent,
      wireframe: material.wireframe
    };

    display.renderer.dispose();
    display.renderer.domElement.remove();
    return result;
  });

  expect(state).toEqual({
    altKey: false,
    movement: [false, false, false, false, false, false    ],
    moveFast: false,
    moveSlowMode: true,
    speedStatus: 'Slow speed',
    wireframe: false
  });
});

test('2D camera fits combined content bounds without zooming in', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:3000/main.html');

    const result = await page.evaluate(async () => {
      document.body.classList.remove('selector-mode');

      const { DisplayWeb2D } = await import('./utils/DisplayWeb2D.js');
      const display = new DisplayWeb2D();
      display.init();
      display
        .setItems([{ x: 0, y: 0 }], 0)
        .setItems([{ x: 39, y: 5 }], 1)
        .fitBounds();
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      const parsePoint = (value: string) => value.split(',').map(Number);
      const [left, top] = parsePoint(display.simulation.boundaries);
      const [width, height] = parsePoint(display.simulation.size);

      return {
        centerX: left + width / 2,
        centerY: top + height / 2,
        scale: display.scale,
        visible: left <= 0 && top <= 0 && left + width >= 40 && top + height >= 6
      };
    });

    expect(result.centerX).toBeCloseTo(20, 1);
    expect(result.centerY).toBeCloseTo(3, 1);
    expect(result.visible).toBe(true);
    expect(result.scale).toBeLessThanOrEqual(1);
    if (viewport.width === 1280) {
      expect(result.scale).toBe(1);
    }
  }
});

// fitBounds selects a wheel scale so the zoom starts on the same discrete ladder.
test('2D fit scale aligns with reversible wheel zoom steps', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:3000/main.html');

    const result = await page.evaluate(async () => {
      document.body.classList.remove('selector-mode');

      const { DisplayWeb2D } = await import('./utils/DisplayWeb2D.js');
      const display = new DisplayWeb2D();
      display.init();
      display.fitBounds({ min: { x: 0, y: 0 }, max: { x: 100, y: 1 } });
      const fitScale = display.scale;
      const fitStepIndex = Math.round(display.scaleLevel / 0.05);

      // Sends DOM wheel events so each notch reaches the real canvas handler.
      const dispatchWheel = (deltaY: number) => display.canvas.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY,
          clientX: 100,
          clientY: 100,
          bubbles: true,
          cancelable: true
        })
      );
      // Waits for DisplayWeb2D's animation loop to apply the queued zoom.
      const waitForFrame = () => new Promise<void>(
        (resolve) => window.requestAnimationFrame(() => resolve())
      );

      for (let i = 0; i < 3; i++) {
        dispatchWheel(-1);
      }
      await waitForFrame();
      const zoomedScale = display.scale;

      for (let i = 0; i < 3; i++) {
        dispatchWheel(1);
      }
      await waitForFrame();

      return {
        fitScale,
        fitStepIndex,
        zoomedScale,
        expectedFitScale: Math.pow(fitStepIndex * 0.05, 2),
        expectedZoomedScale: Math.pow((fitStepIndex + 3) * 0.05, 2),
        returnedScale: display.scale
      };
    });

    expect(result.fitScale).toBe(result.expectedFitScale);
    expect(result.zoomedScale).toBe(result.expectedZoomedScale);
    expect(result.returnedScale).toBe(result.fitScale);
  }
});

test('Day 10 starts with its full CRT bounds centered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://127.0.0.1:3000/main.html');

  const result = await page.evaluate(async () => {
    document.body.classList.remove('selector-mode');

    const [{ DisplayWeb2D }, { AOC }] = await Promise.all([
      import('./utils/DisplayWeb2D.js'),
      import('./10.js')
    ]);
    const display = new DisplayWeb2D();
    await new AOC(display).Run(['noop']);

    const parsePoint = (value: string) => value.split(',').map(Number);
    const [left, top] = parsePoint(display.simulation.boundaries);
    const [width, height] = parsePoint(display.simulation.size);
    return {
      centerX: left + width / 2,
      centerY: top + height / 2,
      scale: display.scale
    };
  });

  expect(result.centerX).toBeCloseTo(20, 1);
  expect(result.centerY).toBeCloseTo(3, 1);
  expect(result.scale).toBe(1);
});

test('2D ok', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html#module=test2D');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveScreenshot(
    "test2D-canvas.png",
    {
      animations: "disabled",
      caret: "hide",
      mask: [
        page.locator("#stats"),
        page.locator(".display-controls--2d")
      ]
    }
  );
});

test('3D ok', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/main.html#module=test3D');

  await expect(page.locator('.display-controls--2d')).toHaveCount(0);
  const canvas = page.locator('canvas[data-aoc-renderer="true"]');
  await expect(canvas).toHaveClass(/display-canvas--3d/);
  expect(await canvas.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('linear-gradient');
  await expect(page.locator('.lil-gui input[type="checkbox"]').first()).toBeChecked({
    timeout: 15_000
  });
  // Expect a title "to contain" a substring.
  await expect(page).toHaveScreenshot(
    "test3D.png",
    {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 32,
      mask: [
        page.locator("#stats")
      ]
    }
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(
    () => canvas.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    })
  ).toEqual({ width: 390, height: 844 });
});
