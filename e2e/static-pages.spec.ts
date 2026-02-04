import { test, expect } from '@playwright/test';

test.describe('Static Pages', () => {
  test.describe('About Page', () => {
    test('renders about page content', async ({ page }) => {
      await page.goto('/about');

      // Check main heading
      await expect(page.locator('h1')).toContainText('Collect & Invest');

      // Check features section
      await expect(page.getByText('Real-Time Price Tracking')).toBeVisible();
      await expect(page.getByText('Grading Intelligence')).toBeVisible();
    });

    test('has signup CTA button', async ({ page }) => {
      await page.goto('/about');

      const ctaButton = page.getByRole('link', { name: /get started free/i });
      await expect(ctaButton).toBeVisible();

      // Click CTA should navigate to signup
      await ctaButton.click();
      await page.waitForURL('/signup');
    });

    test('has stats section', async ({ page }) => {
      await page.goto('/about');

      await expect(page.getByText(/500K\+/)).toBeVisible();
      await expect(page.getByText('Cards Tracked')).toBeVisible();
    });
  });

  test.describe('Blog Page', () => {
    test('shows coming soon message', async ({ page }) => {
      await page.goto('/blog');

      await expect(page.locator('h1')).toContainText('Blog Coming Soon');
      await expect(page.getByText(/working on articles/i)).toBeVisible();
    });

    test('shows topic preview tags', async ({ page }) => {
      await page.goto('/blog');

      await expect(page.getByText('Market Analysis')).toBeVisible();
      await expect(page.getByText('Collecting Tips')).toBeVisible();
    });
  });

  test.describe('Contact Page', () => {
    test('renders contact form', async ({ page }) => {
      await page.goto('/contact');

      await expect(page.locator('h1')).toContainText('Contact Us');
      await expect(page.getByLabel('Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Topic')).toBeVisible();
      await expect(page.getByLabel('Message')).toBeVisible();
    });

    test('validates required fields', async ({ page }) => {
      await page.goto('/contact');

      // Try to submit empty form
      await page.getByRole('button', { name: /send message/i }).click();

      // Should show validation errors
      await expect(page.getByText(/name must be/i)).toBeVisible();
    });

    test('submits form successfully', async ({ page }) => {
      await page.goto('/contact');

      // Fill out the form
      await page.getByLabel('Name').fill('Test User');
      await page.getByLabel('Email').fill('test@example.com');
      await page.getByLabel('Topic').selectOption('feedback');
      await page.getByLabel('Message').fill('This is a test message for the contact form.');

      // Submit
      await page.getByRole('button', { name: /send message/i }).click();

      // Should show success message
      await expect(page.getByText(/message sent/i)).toBeVisible();
    });

    test('can send another message after success', async ({ page }) => {
      await page.goto('/contact');

      // Fill and submit
      await page.getByLabel('Name').fill('Test User');
      await page.getByLabel('Email').fill('test@example.com');
      await page.getByLabel('Topic').selectOption('support');
      await page.getByLabel('Message').fill('Test message content here.');
      await page.getByRole('button', { name: /send message/i }).click();

      // Wait for success
      await expect(page.getByText(/message sent/i)).toBeVisible();

      // Click to send another
      await page.getByRole('button', { name: /send another/i }).click();

      // Form should be visible again
      await expect(page.getByLabel('Name')).toBeVisible();
    });
  });

  test.describe('Privacy Page', () => {
    test('renders privacy policy', async ({ page }) => {
      await page.goto('/privacy');

      await expect(page.locator('h1')).toContainText('Privacy Policy');
      await expect(page.getByText('Last Updated: January 2026')).toBeVisible();
    });

    test('has required sections', async ({ page }) => {
      await page.goto('/privacy');

      await expect(page.getByText('Information We Collect')).toBeVisible();
      await expect(page.getByText('How We Use Your Information')).toBeVisible();
      await expect(page.getByText('Your Rights')).toBeVisible();
    });

    test('has disclaimer about affiliations', async ({ page }) => {
      await page.goto('/privacy');

      await expect(page.getByText(/not affiliated with/i)).toBeVisible();
      await expect(page.getByText(/Pokemon Company/i)).toBeVisible();
    });
  });

  test.describe('Terms Page', () => {
    test('renders terms of service', async ({ page }) => {
      await page.goto('/terms');

      await expect(page.locator('h1')).toContainText('Terms of Service');
      await expect(page.getByText('Last Updated: January 2026')).toBeVisible();
    });

    test('has required sections', async ({ page }) => {
      await page.goto('/terms');

      await expect(page.getByText('Acceptance of Terms')).toBeVisible();
      await expect(page.getByText('Description of Service')).toBeVisible();
      await expect(page.getByText('Limitation of Liability')).toBeVisible();
    });

    test('has disclaimer about affiliations', async ({ page }) => {
      await page.goto('/terms');

      await expect(page.getByText(/not affiliated with/i)).toBeVisible();
    });
  });

  test.describe('Footer Links', () => {
    test('all footer links resolve without 404', async ({ page }) => {
      await page.goto('/');

      const footerLinks = [
        '/about',
        '/blog',
        '/contact',
        '/privacy',
        '/terms',
      ];

      for (const link of footerLinks) {
        const response = await page.goto(link);
        expect(response?.status(), `${link} should not be 404`).not.toBe(404);
      }
    });
  });
});
