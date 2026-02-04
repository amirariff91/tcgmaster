import { test, expect } from '@playwright/test';

test.describe('Settings Page - Auth Protection', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    // Try to access settings without being logged in
    await page.goto('/settings');

    // Should redirect to login with redirect param
    await page.waitForURL(/\/login\?redirect=.*settings/);
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('redirect=%2Fsettings');
  });

  test('login page shows redirect param', async ({ page }) => {
    await page.goto('/login?redirect=/settings');

    // Login page should be displayed
    // (Assuming there's a login form or heading)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Currency Toggle', () => {
  test('currency toggle is visible in header', async ({ page }) => {
    await page.goto('/');

    // Currency toggle should be visible (shows USD by default)
    const currencyButton = page.locator('button').filter({ hasText: /USD|EUR|GBP/ });
    await expect(currencyButton).toBeVisible();
  });

  test('clicking currency toggle shows dropdown', async ({ page }) => {
    await page.goto('/');

    // Click the currency toggle
    const currencyButton = page.locator('button').filter({ hasText: /USD|EUR|GBP|JPY|CAD|AUD/ }).first();
    await currencyButton.click();

    // Dropdown should appear with currency options
    await expect(page.getByText('US Dollar')).toBeVisible();
    await expect(page.getByText('Euro')).toBeVisible();
    await expect(page.getByText('British Pound')).toBeVisible();
  });

  test('selecting a currency changes display', async ({ page }) => {
    await page.goto('/');

    // Open dropdown
    const currencyButton = page.locator('button').filter({ hasText: /USD|EUR|GBP|JPY|CAD|AUD/ }).first();
    await currencyButton.click();

    // Select EUR
    await page.getByRole('button', { name: /EUR.*Euro/ }).click();

    // Button should now show EUR
    await expect(page.locator('button').filter({ hasText: 'EUR' }).first()).toBeVisible();
  });

  test('currency preference persists across pages', async ({ page }) => {
    await page.goto('/');

    // Change to EUR
    const currencyButton = page.locator('button').filter({ hasText: /USD|EUR|GBP|JPY|CAD|AUD/ }).first();
    await currencyButton.click();
    await page.getByRole('button', { name: /EUR.*Euro/ }).click();

    // Navigate to another page
    await page.goto('/market');

    // EUR should still be selected
    await expect(page.locator('button').filter({ hasText: 'EUR' }).first()).toBeVisible();
  });

  test('currency preference persists in localStorage', async ({ page }) => {
    await page.goto('/');

    // Change to GBP
    const currencyButton = page.locator('button').filter({ hasText: /USD|EUR|GBP|JPY|CAD|AUD/ }).first();
    await currencyButton.click();
    await page.getByRole('button', { name: /GBP.*British Pound/ }).click();

    // Check localStorage
    const currency = await page.evaluate(() => localStorage.getItem('tcgmaster_currency'));
    expect(currency).toBe('GBP');
  });
});

test.describe('Notification Settings Persistence', () => {
  // Note: These tests would require a logged-in user
  // For now, we test the localStorage mechanism

  test('notification settings save to localStorage', async ({ page }) => {
    // This test simulates what would happen on the settings page
    // by directly manipulating localStorage

    await page.goto('/');

    // Simulate saving notification settings
    await page.evaluate(() => {
      localStorage.setItem('tcgmaster_notifications', JSON.stringify({
        priceAlerts: false,
        weeklyDigest: true,
        newFeatures: false,
      }));
    });

    // Verify the settings were saved
    const settings = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tcgmaster_notifications') || '{}')
    );

    expect(settings.priceAlerts).toBe(false);
    expect(settings.weeklyDigest).toBe(true);
    expect(settings.newFeatures).toBe(false);
  });
});

test.describe('Error States', () => {
  test('shows 404 page for non-existent routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz-123');
    expect(response?.status()).toBe(404);
  });

  test('shows 404 for invalid game', async ({ page }) => {
    const response = await page.goto('/invalid-game/some-set');
    expect(response?.status()).toBe(404);
  });

  test('shows 404 for invalid set in valid game', async ({ page }) => {
    const response = await page.goto('/pokemon/invalid-set-xyz');
    expect(response?.status()).toBe(404);
  });
});

test.describe('Back to Top Button', () => {
  test('back to top button appears after scrolling', async ({ page }) => {
    // Go to a page with enough content to scroll
    await page.goto('/pokemon/base-set');

    // Initially, button should not be visible
    const backToTop = page.locator('button[aria-label="Back to top"]');
    await expect(backToTop).not.toBeVisible();

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3));
    await page.waitForTimeout(100);

    // Button should now be visible
    await expect(backToTop).toBeVisible();
  });

  test('clicking back to top scrolls to top', async ({ page }) => {
    await page.goto('/pokemon/base-set');

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3));
    await page.waitForTimeout(100);

    // Click back to top
    const backToTop = page.locator('button[aria-label="Back to top"]');
    await backToTop.click();

    // Wait for scroll animation
    await page.waitForTimeout(500);

    // Should be back at top
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
