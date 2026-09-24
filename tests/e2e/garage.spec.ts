import { expect, test } from '@playwright/test';
import { collectErrors, mockNetwork } from './mocks';

test.describe('Garage', () => {
  test('empty state → create bike with a few fields → reload → edit via Setup (same bike)', async ({ page }) => {
    const errors = collectErrors(page);
    await mockNetwork(page);
    await page.goto('/#/garage');
    await expect(page.getByRole('heading', { level: 1, name: 'Garage' })).toBeVisible();
    await expect(page.getByTestId('bike-empty')).toContainText('Tell RIDEOUT what you’re riding.');

    await page.getByTestId('add-bike').click();
    await expect(page.getByTestId('bike-form')).toBeVisible();
    await expect(page.getByTestId('save-bike')).toBeDisabled();
    await page.getByLabel(/Bike name/).fill('Trail Bike');
    await page.getByTestId('wheel-29').click();
    await page.getByLabel('Front travel (mm)').fill('150');
    await page.getByLabel('Rear travel (mm)').fill('140');
    await page.getByTestId('tubeless-yes').click();
    await page.getByLabel('Front PSI (usual)').fill('23');
    await page.getByLabel('Rear PSI (usual)').fill('25');
    await page.getByTestId('save-bike').click();

    const card = page.getByTestId('bike-card');
    await expect(card).toContainText('Trail Bike');
    await expect(card).toContainText('29″ · 150 / 140mm · Tubeless');
    await expect(page.getByTestId('bike-psi')).toContainText('23 PSI');
    await expect(page.getByTestId('bike-psi')).toContainText('25 PSI');

    await page.reload();
    await expect(page.getByTestId('bike-card')).toContainText('Trail Bike');

    // Setup → My Bike edits the same saved bike.
    await page.goto('/#/settings');
    await expect(page.getByTestId('bike-card')).toContainText('Trail Bike');
    await page.getByTestId('edit-bike').click();
    await expect(page.getByLabel(/Bike name/)).toHaveValue('Trail Bike');
    await page.getByText('More details (optional)').click();
    await page.getByLabel('Brakes').fill('SRAM Code');
    await page.getByTestId('save-bike').click();
    await expect(page).toHaveURL(/#\/settings$/);
    await page.goto('/#/garage');
    await expect(page.getByTestId('bike-card')).toContainText('SRAM Code');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('pre-ride checklist ticks, survives reload the same day, and clears', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/#/garage');
    const progress = page.getByTestId('checklist-progress');
    const total = await page.getByTestId('checklist').locator('li').count();
    await expect(progress).toHaveText(`0/${total}`);
    await page.getByTestId('check-pressure').check();
    await page.getByTestId('check-brakes').check();
    await expect(progress).toHaveText(`2/${total}`);
    await page.reload();
    await expect(page.getByTestId('check-pressure')).toBeChecked();
    for (const box of await page.getByTestId('checklist').locator('input').all()) await box.check();
    await expect(progress).toHaveText('Ready to roll');
    await page.getByTestId('checklist-reset').click();
    await expect(progress).toHaveText(`0/${total}`);
  });

  test('service log records dates and notes', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/#/garage');
    await page.getByTestId('svc-brakes').fill('2026-06-01');
    await page.getByTestId('svc-notes').fill('Rear brake a bit soft');
    await page.getByTestId('svc-notes').blur();
    await page.reload();
    await expect(page.getByTestId('svc-brakes')).toHaveValue('2026-06-01');
    await expect(page.getByTestId('svc-notes')).toHaveValue('Rear brake a bit soft');
    await expect(page.getByTestId('service')).toContainText(/ago|today/);
  });

  test('bike shops reuse the OSM shop list, near home or a riding area, with service filters', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/#/garage');
    const shops = page.locator('#garage-shops');
    await expect(shops.getByTestId('shops')).toContainText('Test Cyclery');
    await expect(shops).toContainText('from home');
    await page.getByTestId('shop-filter-wash').click();
    await expect(shops).toContainText('No nearby shops are tagged with that service');
    await page.getByTestId('shop-filter-repair').click();
    await expect(shops.getByTestId('shops')).toContainText('Repairs');
    await page.getByTestId('shop-where').selectOption('buffalo-creek');
    await expect(shops).toContainText('Buffalo Creek trailhead');
    await expect(shops.getByTestId('shops')).toContainText('Test Cyclery');
  });

  test('trailside help opens with an escalation point', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/#/garage');
    await page.getByText('Flat tire').click();
    await expect(page.getByTestId('trailside')).toContainText('stop riding and arrange help');
  });
});

test.describe('Bike Prep on the ride', () => {
  test('technical ride shows tailored prep; mellow ride shows none', async ({ page }) => {
    const errors = collectErrors(page);
    await mockNetwork(page);
    await page.addInitScript(() => {
      localStorage.setItem('rideout:bike:v1', JSON.stringify({ nickname: 'Trail Bike', type: 'mtb', tubeless: false, frontPsi: 23, rearPsi: 25 }));
    });
    // Plan for tomorrow so the test doesn't depend on how much daylight is left right now.
    await page.goto('/');
    await page.getByTestId('date-tomorrow').click();
    await page.goto('/#/area/walker-ranch');
    const prep = page.getByTestId('bike-prep');
    await expect(prep).toBeVisible();
    await expect(prep).toContainText('Check tire pressure');
    await expect(prep).toContainText('Check brake feel');
    await expect(page.getByTestId('prep-psi')).toContainText('not a recommendation');
    await expect(page.locator('#prep')).toContainText('isn’t a mechanical inspection');

    await page.goto('/#/area/marshall-mesa');
    await expect(page.getByTestId('area')).toBeVisible();
    await expect(page.getByTestId('ride-window')).toBeVisible();
    await expect(page.getByTestId('bike-prep')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('with no bike saved, prep still works and invites adding one', async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/#/area/staunton');
    await expect(page.getByTestId('bike-prep')).toBeVisible();
    await expect(page.locator('#prep').getByRole('link', { name: 'Add your bike' })).toBeVisible();
  });
});
