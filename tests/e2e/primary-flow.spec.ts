import { expect, test } from '@playwright/test';
import { collectErrors, mockNetwork } from './mocks';

test.describe('RIDEOUT primary flow', () => {
  test('find a ride → profile → window, weather, trail, parking, shops, apres → share card', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = collectErrors(page);
    await mockNetwork(page);

    // 1. Open RIDEOUT
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /where should i ride/i })).toBeVisible();

    // 2–4. Date, ride type, difficulty
    await page.getByTestId('date-tomorrow').click();
    await expect(page.getByTestId('date-tomorrow')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('mode-half').click();
    await page.getByTestId('diff-blue').click();
    await page.getByTestId('find').click();

    // 5. Recommendations
    const results = page.getByTestId('results');
    await expect(results).toBeVisible();
    await expect(results.locator('.result').first()).toBeVisible();
    await expect(results.locator('.result').first()).toContainText(/WHY/);
    await expect(results.getByTestId('result-marshall-mesa')).toBeVisible();

    // 6. Open a riding area
    await results.getByTestId('result-hall-ranch').click();
    await expect(page.getByTestId('area')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Hall Ranch' })).toBeVisible();
    await expect(page.getByTestId('status').first()).toBeVisible();

    // 7. Ride window (stormy afternoon tomorrow → window ends by ~1pm)
    await expect(page.getByTestId('ride-window')).toContainText(/AM/);
    await expect(page.getByTestId('hours')).toBeVisible();
    await expect(page.getByText(/not a trail report/i).first()).toBeVisible();

    // 8. Weather
    await expect(page.getByTestId('weather-grid')).toContainText('High');
    await expect(page.getByText(/Storm risk:/)).toBeVisible();

    // 9. Trail info: stats, character, conditions distinct from forecast
    await expect(page.getByTestId('stats')).toContainText('9.9 mi');
    await expect(page.getByTestId('rating-technical')).toBeVisible();
    await expect(page.getByTestId('trail-condition')).toContainText('Not reported');
    await expect(page.getByTestId('mud-risk')).toBeVisible();

    // Getting there
    await expect(page.getByTestId('itinerary')).toContainText('Leave home');

    // 10. Parking
    await expect(page.getByTestId('parking')).toContainText('Hall Ranch');

    // 11. Bike shops
    await expect(page.getByTestId('shops')).toContainText('Test Cyclery');
    await expect(page.getByTestId('shops')).toContainText('Repairs');

    // 12. Apres
    await expect(page.getByTestId('apres-list')).toContainText('Trailside Brewing');
    await page.getByTestId('apres-mexican').click();
    await expect(page.getByTestId('apres-list')).toContainText('Taco Line');

    // 13. Share card
    await page.getByTestId('make-card').click();
    await expect(page.getByTestId('share-card')).toBeVisible();
    await page.getByTestId('copy').click();
    await expect(page.getByRole('status').filter({ hasText: /Copied|Copy failed/ })).toBeVisible();
    await page.getByText('Text version').click();
    await expect(page.getByTestId('share-text')).toContainText('HALL RANCH');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('map shows tappable status markers', async ({ page }) => {
    const errors = collectErrors(page);
    await mockNetwork(page);
    await page.goto('/#/map');
    await expect(page.getByTestId('map')).toBeVisible();
    const marker = page.locator('.leaflet-marker-icon[title="Buffalo Creek"]');
    await expect(marker).toBeVisible();
    await expect(page.locator('.leaflet-marker-icon .mk').first()).toHaveAttribute('aria-label', /: (RIDE|MAYBE|CONDITIONS|NOPE|UNKNOWN)$/);
    await expect(page.getByLabel('Legend')).toContainText('RIDE');
    await marker.click();
    await expect(page.getByTestId('map-sheet')).toContainText('Buffalo Creek');
    await page.getByRole('link', { name: /open rideout profile/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Buffalo Creek' })).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('graceful degradation', () => {
  test('weather API down → UNKNOWN, no crash, rest of profile still works', async ({ page }) => {
    const errors = collectErrors(page);
    await mockNetwork(page, { weather: 'fail' });
    await page.goto('/');
    await page.getByTestId('date-tomorrow').click();
    await page.getByTestId('find').click();
    await expect(page.getByText(/Weather unavailable for all areas/)).toBeVisible();
    await expect(page.getByTestId('status').first()).toHaveText(/UNKNOWN|SKIP IT/);
    await page.getByTestId('result-apex').click();
    await expect(page.getByTestId('weather-unavailable')).toBeVisible();
    await expect(page.getByTestId('parking')).toBeVisible();
    await expect(page.getByTestId('stats')).toContainText('8 mi');
    // Only the expected failed-resource console noise (the 503) is allowed.
    expect(errors.filter((e) => !/503|Failed to load resource/.test(e))).toEqual([]);
  });

  test('routing and places down → estimates and honest messages', async ({ page }) => {
    await mockNetwork(page, { routing: 'fail', places: 'fail' });
    await page.goto('/');
    await page.getByTestId('date-tomorrow').click();
    await page.getByTestId('find').click();
    await expect(page.getByText(/Routing unavailable/)).toBeVisible();
    await expect(page.locator('.pill', { hasText: '(est.)' }).first()).toBeVisible();
    await page.getByTestId('result-white-ranch').click();
    await expect(page.getByTestId('shops-unavailable')).toBeVisible();
    await expect(page.getByTestId('apres-unavailable')).toBeVisible();
  });

  test('no-results scenario explains itself', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/');
    await page.getByTestId('diff-dblack').click();
    await page.getByTestId('drive-30').click();
    await page.getByTestId('find').click();
    await expect(page.getByTestId('no-results')).toContainText(/No rides match/);
  });

  test('preferences persist on device', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/#/settings');
    await page.getByTestId('home-select').selectOption('boulder');
    await page.getByLabel('Likes flow').check();
    await page.reload();
    await expect(page.getByTestId('home-select')).toHaveValue('boulder');
    await expect(page.getByLabel('Likes flow')).toBeChecked();
    await page.goto('/#/');
    await expect(page.getByText('From Boulder')).toBeVisible();
  });
});

test('PWA metadata is present', async ({ page, request }) => {
  await mockNetwork(page);
  await page.goto('/');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', './apple-touch-icon.png');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);
  expect((await request.get('/sw.js')).status()).toBe(200);
});
