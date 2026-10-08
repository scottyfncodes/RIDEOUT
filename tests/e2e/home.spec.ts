import { expect, test } from '@playwright/test';
import { collectErrors, mockNetwork } from './mocks';

// Opening screen: the answer comes before the questions.
test.describe('home opens on an answer', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('top pick and RIDE THIS are above the fold with no taps', async ({ page }) => {
    const errors = collectErrors(page);
    await mockNetwork(page);
    await page.goto('/');
    const pick = page.getByTestId('pick');
    await expect(pick.locator('.name')).toHaveText(/\w/);
    await expect(pick.getByTestId('status')).toBeVisible();
    await expect(pick.locator('.why')).toContainText(/WHY/);
    await expect(page.getByTestId('ride-this')).toBeInViewport({ ratio: 1 });
    // The pick is the engine's #1 ranked result for the same filters (tomorrow: no late-day rollover).
    await page.getByTestId('date-tomorrow').click();
    const name = (await pick.locator('.name').textContent())!;
    await page.getByTestId('find').click();
    await expect(page.getByTestId('results').locator('.result').first().locator('.name')).toHaveText(name);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('RIDE THIS opens the area profile', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/');
    const name = (await page.getByTestId('pick').locator('.name').textContent())!;
    await page.getByTestId('ride-this').click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });

  test('the pick follows the filters', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/');
    await page.getByTestId('date-tomorrow').click();
    await expect(page.getByTestId('pick')).toContainText('Top pick · Tomorrow');
    await page.getByTestId('diff-dblack').click();
    await page.getByTestId('drive-30').click();
    await expect(page.getByTestId('pick-empty')).toContainText('No rides match');
    await page.getByTestId('pick-reset').click();
    await expect(page.getByTestId('drive-any')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pick')).toBeVisible();
  });

  test('weather down → the pick still renders, with one line of caveats', async ({ page }) => {
    await mockNetwork(page, { weather: 'fail', routing: 'fail' });
    await page.goto('/');
    await expect(page.getByTestId('pick').locator('.name')).toHaveText(/\w/);
    await expect(page.getByTestId('pick-note')).toContainText('Weather unavailable');
    await expect(page.getByTestId('pick-note')).toHaveCount(1);
  });

  test('no chip row hides an option sideways', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/');
    await page.getByTestId('pick').waitFor();
    const clipped = await page.locator('.main .chips').evaluateAll((rows) =>
      rows.flatMap((row) => [...row.children].filter((c) => c.getBoundingClientRect().right > document.documentElement.clientWidth).map((c) => c.textContent)),
    );
    expect(clipped).toEqual([]);
  });
});
