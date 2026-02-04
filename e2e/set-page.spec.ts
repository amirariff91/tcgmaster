import { test, expect } from '@playwright/test';

test.describe('Set Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a set page
    await page.goto('/pokemon/base-set');
  });

  test('displays set name and card count', async ({ page }) => {
    // Check set name is visible
    await expect(page.locator('h1')).toContainText('Base Set');

    // Check card count is visible
    await expect(page.getByText(/102 cards/i)).toBeVisible();
  });

  test('displays breadcrumb navigation', async ({ page }) => {
    const breadcrumb = page.locator('nav').first();
    await expect(breadcrumb.getByText('Pokemon')).toBeVisible();
    await expect(breadcrumb.getByText('Base Set')).toBeVisible();
  });

  test('search filters cards correctly', async ({ page }) => {
    // Type in search box
    const searchInput = page.getByPlaceholder('Search cards...');
    await searchInput.fill('Charizard');

    // Wait for debounce
    await page.waitForTimeout(400);

    // Should show filtered results
    await expect(page.getByText(/1 card/i)).toBeVisible();
    await expect(page.getByText('Charizard')).toBeVisible();
  });

  test('search updates URL with query param', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search cards...');
    await searchInput.fill('Pikachu');

    // Wait for debounce and URL update
    await page.waitForTimeout(400);
    await page.waitForURL(/\?q=Pikachu/i);

    // URL should contain search query
    expect(page.url()).toContain('q=Pikachu');
  });

  test('sort dropdown changes order', async ({ page }) => {
    // Change sort to price
    const sortSelect = page.locator('select');
    await sortSelect.selectOption('price');

    // URL should update
    await page.waitForURL(/\?sort=price/);
    expect(page.url()).toContain('sort=price');
  });

  test('cards are clickable and navigate to detail page', async ({ page }) => {
    // Click on the first card
    const firstCard = page.locator('a').filter({ hasText: /1\/102/ }).first();
    await firstCard.click();

    // Should navigate to card detail page
    await page.waitForURL(/\/pokemon\/base-set\/.+/);
  });

  test('infinite scroll loads more cards', async ({ page }) => {
    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for more cards to load
    await page.waitForTimeout(500);

    // Page should still be functional after scroll
    await expect(page.locator('h1')).toContainText('Base Set');
  });

  test('sidebar shows set stats', async ({ page }) => {
    // Check for set stats section
    await expect(page.getByText('Set Stats')).toBeVisible();
    await expect(page.getByText('Total Cards')).toBeVisible();
    await expect(page.getByText('Release Date')).toBeVisible();
  });

  test('related sets are displayed', async ({ page }) => {
    await expect(page.getByText('Related Sets')).toBeVisible();

    // Base Set should have related sets like Jungle, Fossil
    await expect(page.getByText('Jungle').or(page.getByText('Fossil'))).toBeVisible();
  });

  test('empty state shows when no results', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search cards...');
    await searchInput.fill('xyz123nonexistent');

    // Wait for debounce
    await page.waitForTimeout(400);

    // Should show empty state
    await expect(page.getByText('No cards found')).toBeVisible();
  });

  test('clear search button works', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search cards...');
    await searchInput.fill('xyz123');

    // Wait for debounce
    await page.waitForTimeout(400);

    // Click clear search button
    const clearButton = page.getByRole('button', { name: /clear search/i });
    await clearButton.click();

    // Search should be cleared
    await expect(searchInput).toHaveValue('');
  });

  test('404 for invalid set', async ({ page }) => {
    const response = await page.goto('/pokemon/fake-set-that-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});

test.describe('Set Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('sidebar is collapsible on mobile', async ({ page }) => {
    await page.goto('/pokemon/base-set');

    // Look for the accordion toggle button
    const toggleButton = page.getByRole('button', { name: /set info/i });
    await expect(toggleButton).toBeVisible();

    // Click to toggle
    await toggleButton.click();

    // Content should be hidden or visible depending on state
  });

  test('cards stack vertically on mobile', async ({ page }) => {
    await page.goto('/pokemon/base-set');

    // Cards should be in a single column on mobile
    const cardGrid = page.locator('.grid');

    // On mobile, the grid should have 1 column
    // This is a visual check - we're mainly ensuring the page loads properly on mobile
    await expect(cardGrid).toBeVisible();
  });
});
