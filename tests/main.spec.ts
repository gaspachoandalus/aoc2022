import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('http://localhost:3000/main.html#module=test2D');

  await expect(page).toHaveTitle(/AOC 2022/);
});

test('2D ok', async ({ page }) => {
  await page.goto('http://localhost:3000/main.html#module=test2D');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveScreenshot(
    "test2D-canvas.png",
    {
      animations: "disabled",
      caret: "hide",
      mask: [
        page.locator("#stats")
      ]
    }
  );
});

test('3D ok', async ({ page }) => {
  await page.goto('http://localhost:3000/main.html#module=test3D');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveScreenshot(
    "test3D.png",
    {
      animations: "disabled",
      caret: "hide",
      mask: [
        page.locator("#stats")
      ]
    }
  );
});
