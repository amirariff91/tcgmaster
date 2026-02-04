// PostHog analytics integration for TCGMaster

import posthog from 'posthog-js';

// PostHog configuration
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

// Track whether PostHog has been initialized
let isInitialized = false;

/**
 * Initialize PostHog analytics
 * Should be called once in the app's root layout or provider
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  if (!POSTHOG_KEY) {
    console.warn('PostHog key not configured. Analytics disabled.');
    return;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Respect user privacy settings
      respect_dnt: true,
      // Capture pageviews automatically
      capture_pageview: true,
      // Capture page leaves for session duration
      capture_pageleave: true,
      // Disable session recording by default
      disable_session_recording: true,
      // Persist user identity across sessions
      persistence: 'localStorage',
      // Bootstrap with existing data if available
      bootstrap: {
        distinctID: getStoredDistinctId(),
      },
    });

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }
}

/**
 * Get stored distinct ID from localStorage
 */
function getStoredDistinctId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem('posthog_distinct_id') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Track a custom event
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!isInitialized && !POSTHOG_KEY) return;

  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

/**
 * Identify a user (after login)
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!isInitialized && !POSTHOG_KEY) return;

  try {
    posthog.identify(userId, traits);
  } catch (error) {
    console.error('Failed to identify user:', error);
  }
}

/**
 * Reset user identity (after logout)
 */
export function resetUser(): void {
  if (typeof window === 'undefined') return;
  if (!isInitialized && !POSTHOG_KEY) return;

  try {
    posthog.reset();
  } catch (error) {
    console.error('Failed to reset user:', error);
  }
}

/**
 * Set user properties without identifying
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!isInitialized && !POSTHOG_KEY) return;

  try {
    posthog.people.set(properties);
  } catch (error) {
    console.error('Failed to set user properties:', error);
  }
}

// ============================================
// PREDEFINED EVENTS
// ============================================

/**
 * Track page view
 */
export function trackPageView(path: string, title: string): void {
  track('page_view', { path, title });
}

/**
 * Track set page viewed
 */
export function trackSetViewed(game: string, setSlug: string, setName: string): void {
  track('set_viewed', { game, set_slug: setSlug, set_name: setName });
}

/**
 * Track card clicked from grid
 */
export function trackCardClicked(
  game: string,
  setSlug: string,
  cardSlug: string,
  cardName: string,
  price: number | null
): void {
  track('card_clicked', {
    game,
    set: setSlug,
    card: cardSlug,
    card_name: cardName,
    price,
  });
}

/**
 * Track card added to collection
 */
export function trackCardAddedToCollection(
  game: string,
  setSlug: string,
  cardSlug: string,
  grade: string
): void {
  track('card_added_to_collection', {
    game,
    set: setSlug,
    card: cardSlug,
    grade,
  });
}

/**
 * Track search performed
 */
export function trackSearchPerformed(
  query: string,
  page: string,
  resultsCount: number
): void {
  track('search_performed', {
    query,
    page,
    results_count: resultsCount,
  });
}

/**
 * Track currency changed
 */
export function trackCurrencyChanged(from: string, to: string): void {
  track('currency_changed', { from, to });
}

/**
 * Track contact form submitted
 */
export function trackContactFormSubmitted(topic: string): void {
  track('contact_form_submitted', { topic });
}

/**
 * Track market page viewed
 */
export function trackMarketViewed(period: string): void {
  track('market_viewed', { period });
}

/**
 * Track settings changed
 */
export function trackSettingsChanged(setting: string, value: unknown): void {
  track('settings_changed', { setting, value });
}

/**
 * Track collection quick add used
 */
export function trackQuickAddUsed(cardId: string, grade: string): void {
  track('quick_add_used', { card_id: cardId, grade });
}

/**
 * Track infinite scroll triggered
 */
export function trackInfiniteScroll(page: string, batchNumber: number): void {
  track('infinite_scroll', { page, batch_number: batchNumber });
}

/**
 * Track error occurred
 */
export function trackError(errorType: string, errorMessage: string, context?: Record<string, unknown>): void {
  track('error_occurred', {
    error_type: errorType,
    error_message: errorMessage,
    ...context,
  });
}
