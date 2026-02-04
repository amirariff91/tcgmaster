'use client';

import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { User as UserIcon, Bell, Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';
import { type SupportedCurrency, currencyInfo } from '@/lib/currency';
import { trackSettingsChanged } from '@/lib/analytics';

interface SettingsClientProps {
  user: User;
}

interface NotificationSettings {
  priceAlerts: boolean;
  weeklyDigest: boolean;
  newFeatures: boolean;
}

const NOTIFICATIONS_KEY = 'tcgmaster_notifications';

function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') {
    return { priceAlerts: true, weeklyDigest: false, newFeatures: true };
  }

  try {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore errors
  }

  return { priceAlerts: true, weeklyDigest: false, newFeatures: true };
}

function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore errors
  }
}

export function SettingsClient({ user }: SettingsClientProps) {
  const { currency, setCurrency } = useCurrencyContext();
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    getNotificationSettings()
  );
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleNotificationChange = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    saveNotificationSettings(newSettings);

    // Track the change
    trackSettingsChanged(`notification_${key}`, value);

    // Show saved message
    showSavedMessage();
  };

  const handleCurrencyChange = (newCurrency: SupportedCurrency) => {
    setCurrency(newCurrency);
    trackSettingsChanged('currency', newCurrency);
    showSavedMessage();
  };

  const showSavedMessage = () => {
    setSavedMessage('Settings saved');
    setTimeout(() => setSavedMessage(null), 2000);
  };

  // Format member since date
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : 'Unknown';

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
            <p className="text-zinc-500 mt-1">
              Manage your account preferences and notifications.
            </p>
          </div>

          {/* Saved indicator */}
          {savedMessage && (
            <div
              className={cn(
                'fixed top-20 right-4 z-50',
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-emerald-100 text-emerald-700',
                'animate-in fade-in-0 slide-in-from-right-5 duration-200'
              )}
            >
              <Check className="h-4 w-4" />
              {savedMessage}
            </div>
          )}

          <div className="space-y-6">
            {/* Account Section */}
            <section className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 flex items-center gap-3">
                <UserIcon className="h-5 w-5 text-zinc-500" />
                <h2 className="font-semibold text-zinc-900">Account</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Email</p>
                    <p className="font-medium text-zinc-900">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Member since</p>
                    <p className="font-medium text-zinc-900">{memberSince}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Notifications Section */}
            <section className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 flex items-center gap-3">
                <Bell className="h-5 w-5 text-zinc-500" />
                <h2 className="font-semibold text-zinc-900">Notifications</h2>
              </div>
              <div className="p-6 space-y-4">
                <ToggleSetting
                  label="Price Alerts"
                  description="Get notified when cards hit your target price"
                  checked={notifications.priceAlerts}
                  onChange={(value) => handleNotificationChange('priceAlerts', value)}
                />
                <ToggleSetting
                  label="Weekly Digest"
                  description="Receive a weekly summary of your portfolio performance"
                  checked={notifications.weeklyDigest}
                  onChange={(value) => handleNotificationChange('weeklyDigest', value)}
                />
                <ToggleSetting
                  label="New Features"
                  description="Be the first to know about new features and updates"
                  checked={notifications.newFeatures}
                  onChange={(value) => handleNotificationChange('newFeatures', value)}
                />
              </div>
            </section>

            {/* Display Section */}
            <section className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 flex items-center gap-3">
                <Palette className="h-5 w-5 text-zinc-500" />
                <h2 className="font-semibold text-zinc-900">Display</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900">Currency</p>
                    <p className="text-sm text-zinc-500">
                      Choose your preferred currency for prices
                    </p>
                  </div>
                  <select
                    value={currency}
                    onChange={(e) =>
                      handleCurrencyChange(e.target.value as SupportedCurrency)
                    }
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm',
                      'bg-zinc-50 border border-zinc-200',
                      'text-zinc-900',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500'
                    )}
                  >
                    {Object.entries(currencyInfo).map(([code, info]) => (
                      <option key={code} value={code}>
                        {info.symbol} {code} - {info.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Theme placeholder for future */}
                <div className="flex items-center justify-between opacity-50">
                  <div>
                    <p className="font-medium text-zinc-900">Theme</p>
                    <p className="text-sm text-zinc-500">Coming soon</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg text-sm bg-zinc-100 text-zinc-400">
                    Light
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-zinc-900">{label}</p>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          checked ? 'bg-blue-600' : 'bg-zinc-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white',
            'transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
