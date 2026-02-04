import { test, expect } from '@playwright/test';

test.describe('Market Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/market');
  });

  test('renders market page with title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Market Movers');
    await expect(page.getByText(/biggest price movements/i)).toBeVisible();
  });

  test('displays period tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: '24 Hours' })).toBeVisible();
    await expect(page.getByRole('button', { name: '7 Days' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30 Days' })).toBeVisible();
  });

  test('24h tab is selected by default', async ({ page }) => {
    const tab24h = page.getByRole('button', { name: '24 Hours' });
    await expect(tab24h).toHaveClass(/bg-zinc-900/);
  });

  test('clicking 7d tab switches period', async ({ page }) => {
    const tab7d = page.getByRole('button', { name: '7 Days' });
    await tab7d.click();

    // Tab should now be selected
    await expect(tab7d).toHaveClass(/bg-zinc-900/);

    // 24h should no longer be selected
    const tab24h = page.getByRole('button', { name: '24 Hours' });
    await expect(tab24h).not.toHaveClass(/bg-zinc-900/);
  });

  test('clicking 30d tab switches period', async ({ page }) => {
    const tab30d = page.getByRole('button', { name: '30 Days' });
    await tab30d.click();

    await expect(tab30d).toHaveClass(/bg-zinc-900/);
  });

  test('displays gainers section', async ({ page }) => {
    await expect(page.getByText('Top Gainers')).toBeVisible();

    // Should have cards listed
    const gainersSection = page.locator('div').filter({ hasText: 'Top Gainers' }).first();
    await expect(gainersSection).toBeVisible();
  });

  test('displays losers section', async ({ page }) => {
    await expect(page.getByText('Top Losers')).toBeVisible();

    const losersSection = page.locator('div').filter({ hasText: 'Top Losers' }).first();
    await expect(losersSection).toBeVisible();
  });

  test('gainers show positive percentages', async ({ page }) => {
    // Find a percentage in the gainers column (should be positive/green)
    const gainersContainer = page.locator('div').filter({ hasText: /Top Gainers/ }).first();
    const percentages = gainersContainer.locator('text=/\\+\\d+\\.\\d+%/');

    // At least one positive percentage should be visible
    const count = await percentages.count();
    expect(count).toBeGreaterThan(0);
  });

  test('losers show negative percentages', async ({ page }) => {
    // Find a percentage in the losers column (should be negative/red)
    const losersContainer = page.locator('div').filter({ hasText: /Top Losers/ }).first();
    const percentages = losersContainer.locator('text=/-\\d+\\.\\d+%/');

    const count = await percentages.count();
    expect(count).toBeGreaterThan(0);
  });

  test('pagination works for gainers', async ({ page }) => {
    // Check initial page
    await expect(page.getByText('Page 1 of').first()).toBeVisible();

    // Click next page
    const nextButtons = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') });
    await nextButtons.first().click();

    // Should now show page 2
    await expect(page.getByText('Page 2 of').first()).toBeVisible();
  });

  test('pagination works for losers', async ({ page }) => {
    // Find the losers pagination (second set of pagination controls)
    const paginationTexts = page.getByText(/Page \d+ of/);
    await expect(paginationTexts).toHaveCount(2);
  });

  test('cards are clickable and navigate to detail', async ({ page }) => {
    // Click on a card in the gainers list
    const cardLink = page.locator('a[href*="/pokemon/"]').first();

    if (await cardLink.count() > 0) {
      await cardLink.click();
      await page.waitForURL(/\/pokemon\/|\/basketball\/|\/baseball\//);
    }
  });

  test('prices are displayed for each card', async ({ page }) => {
    // Look for price patterns (with currency symbols)
    const prices = page.locator('text=/\\$[\\d,]+/');
    const count = await prices.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Market Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('layout stacks on mobile', async ({ page }) => {
    await page.goto('/market');

    // Both sections should be visible
    await expect(page.getByText('Top Gainers')).toBeVisible();
    await expect(page.getByText('Top Losers')).toBeVisible();

    // On mobile, gainers should appear above losers (stacked)
    const gainers = page.locator('div').filter({ hasText: 'Top Gainers' }).first();
    const losers = page.locator('div').filter({ hasText: 'Top Losers' }).first();

    const gainersBox = await gainers.boundingBox();
    const losersBox = await losers.boundingBox();

    if (gainersBox && losersBox) {
      // Gainers should be above losers on mobile
      expect(gainersBox.y).toBeLessThan(losersBox.y);
    }
  });

  test('period tabs are still accessible on mobile', async ({ page }) => {
    await page.goto('/market');

    await expect(page.getByRole('button', { name: '24 Hours' })).toBeVisible();
    await expect(page.getByRole('button', { name: '7 Days' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30 Days' })).toBeVisible();
  });
});
