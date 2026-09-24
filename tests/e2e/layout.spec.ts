import { expect, test } from '@playwright/test';
import { mockNetwork } from './mocks';

// Phone-width layout guard: no horizontal page scroll, and the fixed nav fits the screen.
for (const path of ['/#/', '/#/area/walker-ranch', '/#/garage', '/#/garage/bike', '/#/settings', '/#/sources']) {
  test(`no horizontal overflow at phone width: ${path}`, async ({ page }) => {
    await mockNetwork(page);
    await page.goto('/');
    await page.getByTestId('date-tomorrow').click();
    await page.getByTestId('find').click();
    await page.goto(path);
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => ({
      inner: window.innerWidth,
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      nav: document.querySelector('.nav')!.getBoundingClientRect().right,
    }));
    expect(m.scroll).toBeLessThanOrEqual(m.client);
    expect(m.inner).toBe(m.client);
    expect(m.nav).toBeLessThanOrEqual(m.client);
  });
}
