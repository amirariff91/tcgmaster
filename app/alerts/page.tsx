'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Settings,
  Check,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { formatPrice, formatDate } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertCardData {
  name: string;
  setName: string;
  imageUrl: string | null;
  currentPrice: number | null;
}

interface AlertData {
  id: string;
  user_id: string;
  card_id: string;
  variant_id: string | null;
  grade: string;
  grading_company_id: string | null;
  threshold_percent: number;
  direction: 'up' | 'down' | 'both';
  baseline_price: number | null;
  is_active: boolean;
  last_triggered: string | null;
  trigger_count: number;
  delivery_method: 'email' | 'push' | 'both';
  created_at: string;
}

interface AlertEntry {
  alert: AlertData;
  card: AlertCardData;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const directionOptions = [
  { value: 'both', label: 'Price moves ±%' },
  { value: 'up', label: 'Price increases' },
  { value: 'down', label: 'Price decreases' },
];

const thresholdOptions = [
  { value: '3', label: '3%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
  { value: 'custom', label: 'Custom' },
];

const frequencyOptions = [
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Digest' },
];

// FIX 5 — Explicit filter label map
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  active: 'Active',
  inactive: 'Paused',
};

// ---------------------------------------------------------------------------
// AlertSettingsModal
// ---------------------------------------------------------------------------

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AlertSettingsModal({ isOpen, onClose }: AlertSettingsModalProps) {
  const [emailFrequency, setEmailFrequency] = React.useState('daily');
  const [emailEnabled, setEmailEnabled] = React.useState(true);
  // FIX 2 — hook fake selects to real state
  const [defaultDirection, setDefaultDirection] = React.useState('both');
  const [defaultThreshold, setDefaultThreshold] = React.useState('5');
  // FIX 1 — saved state for success indicator
  const [saved, setSaved] = React.useState(false);

  // FIX 1 — load from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('alertSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.emailEnabled !== undefined) setEmailEnabled(parsed.emailEnabled);
        if (parsed.emailFrequency) setEmailFrequency(parsed.emailFrequency);
        if (parsed.defaultDirection) setDefaultDirection(parsed.defaultDirection);
        if (parsed.defaultThreshold) setDefaultThreshold(parsed.defaultThreshold);
      } catch {
        // ignore
      }
    }
  }, []);

  // FIX 1 — real save handler
  const handleSave = async () => {
    try {
      localStorage.setItem(
        'alertSettings',
        JSON.stringify({ emailEnabled, emailFrequency, defaultDirection, defaultThreshold }),
      );
      setSaved(true);
      setTimeout(() => {
        onClose();
        setSaved(false);
      }, 800);
    } catch {
      // ignore
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <ModalTitle>Alert Settings</ModalTitle>
      </ModalHeader>
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">Email Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Enable email alerts</span>
              {/* FIX 3 — ARIA for email toggle */}
              <button
                role="switch"
                aria-checked={emailEnabled}
                aria-label="Toggle email alerts"
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  emailEnabled ? 'bg-blue-600' : 'bg-zinc-200'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    emailEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </label>
            {emailEnabled && (
              <div>
                <label className="mb-2 block text-sm text-zinc-600">Notification frequency</label>
                <Select options={frequencyOptions} value={emailFrequency} onChange={setEmailFrequency} />
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">Default Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm text-zinc-600">Default threshold</label>
              {/* FIX 2 — hooked to real state */}
              <Select
                options={thresholdOptions.filter((o) => o.value !== 'custom')}
                value={defaultThreshold}
                onChange={(e) => setDefaultThreshold(e)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-zinc-600">Default direction</label>
              {/* FIX 2 — hooked to real state */}
              <Select
                options={directionOptions}
                value={defaultDirection}
                onChange={(e) => setDefaultDirection(e)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {/* FIX 1 — real save with success state */}
          <Button onClick={handleSave}>
            {saved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Search result type for CreateAlertModal
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  name: string;
  subtitle: string;
  price: number | null;
  image_url: string | null;
}

// ---------------------------------------------------------------------------
// CreateAlertModal
// ---------------------------------------------------------------------------

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (entry: AlertEntry) => void;
}

function CreateAlertModal({ isOpen, onClose, onCreated }: CreateAlertModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [selectedCard, setSelectedCard] = React.useState<SearchResult | null>(null);
  const [threshold, setThreshold] = React.useState('5');
  const [customThreshold, setCustomThreshold] = React.useState('');
  const [direction, setDirection] = React.useState('both');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  React.useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&autocomplete=true&limit=6`);
        if (res.ok) {
          const json = await res.json();
          const cards: SearchResult[] = (json.results ?? [])
            .filter((r: { type: string }) => r.type === 'card')
            .map((r: { id: string; name: string; subtitle: string; price: number | null; image_url: string | null }) => ({
              id: r.id,
              name: r.name,
              subtitle: r.subtitle,
              price: r.price,
              image_url: r.image_url,
            }));
          setSearchResults(cards);
        }
      } catch {
        // ignore search errors
      }
    }, 300);
  }, [searchQuery]);

  const handleSelectCard = (card: SearchResult) => {
    setSelectedCard(card);
    setSearchQuery(card.name);
    setSearchResults([]);
  };

  const handleCreate = async () => {
    if (!selectedCard) {
      setError('Please select a card');
      return;
    }
    const thresholdVal = threshold === 'custom' ? parseFloat(customThreshold) : parseFloat(threshold);
    if (!thresholdVal || thresholdVal <= 0) {
      setError('Please enter a valid threshold');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: selectedCard.id,
          thresholdPercent: thresholdVal,
          direction,
          deliveryMethod: 'email',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Failed to create alert');
        return;
      }

      onCreated({
        alert: json.data,
        card: {
          name: selectedCard.name,
          setName: selectedCard.subtitle,
          imageUrl: selectedCard.image_url,
          currentPrice: selectedCard.price,
        },
      });
      onClose();
      // Reset state
      setSearchQuery('');
      setSelectedCard(null);
      setThreshold('5');
      setCustomThreshold('');
      setDirection('both');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <ModalTitle>Create Price Alert</ModalTitle>
      </ModalHeader>
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700">Search for a card</label>
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedCard(null);
            }}
            placeholder="Search cards..."
          />
          {searchResults.length > 0 && (
            <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              {searchResults.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleSelectCard(card)}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="h-12 w-9 flex-shrink-0 rounded bg-zinc-100 overflow-hidden">
                    {card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image_url} alt={card.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-zinc-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{card.name}</p>
                    <p className="text-sm text-zinc-500 truncate">{card.subtitle}</p>
                  </div>
                  {card.price != null && (
                    <span className="ml-auto text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex-shrink-0">
                      {formatPrice(card.price)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Threshold</label>
            <Select options={thresholdOptions} value={threshold} onChange={setThreshold} />
            {threshold === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  value={customThreshold}
                  onChange={(e) => setCustomThreshold(e.target.value)}
                  placeholder="Enter %"
                  className="w-24"
                />
                <span className="text-zinc-500">%</span>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Direction</label>
            <Select options={directionOptions} value={direction} onChange={setDirection} />
          </div>
        </div>

        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-4">
          <p className="text-sm text-zinc-600">
            You will be notified when the price{' '}
            {direction === 'both' ? 'moves' : direction === 'up' ? 'increases' : 'decreases'} by{' '}
            {threshold === 'custom' ? customThreshold || '?' : threshold}% from the current price.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting || !selectedCard}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Create Alert
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// AlertsPage
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = React.useState<AlertEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showCreateAlert, setShowCreateAlert] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'active' | 'inactive'>('all');

  // Load alerts on mount
  React.useEffect(() => {
    const loadAlerts = async () => {
      try {
        const res = await fetch('/api/alerts');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) {
          const json = await res.json();
          setError(json.error ?? 'Failed to load alerts');
          return;
        }
        const json = await res.json();
        setAlerts(json.data ?? []);
      } catch {
        setError('Network error. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, [router]);

  const filteredAlerts = alerts.filter((entry) => {
    if (filter === 'active') return entry.alert.is_active;
    if (filter === 'inactive') return !entry.alert.is_active;
    return true;
  });

  const toggleAlert = async (id: string) => {
    // Optimistic update
    setAlerts((prev) =>
      prev.map((e) =>
        e.alert.id === id ? { ...e, alert: { ...e.alert, is_active: !e.alert.is_active } } : e
      )
    );

    const res = await fetch(`/api/alerts/${id}`, { method: 'PATCH' });
    if (!res.ok) {
      // Revert on failure
      setAlerts((prev) =>
        prev.map((e) =>
          e.alert.id === id ? { ...e, alert: { ...e.alert, is_active: !e.alert.is_active } } : e
        )
      );
    }
  };

  const deleteAlert = async (id: string) => {
    // Optimistic update
    const previous = alerts;
    setAlerts((prev) => prev.filter((e) => e.alert.id !== id));

    const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setAlerts(previous);
    }
  };

  const handleAlertCreated = (entry: AlertEntry) => {
    setAlerts((prev) => [entry, ...prev]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // FIX 6 — Improved error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Alerts failed to load</h2>
          <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
            We couldn&apos;t reach the server. Check your connection and try again.
          </p>
          <Button onClick={() => window.location.reload()} className="mt-6">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    // FIX 7 — dark mode for top-level container
    <div className="min-h-screen pb-16 bg-white dark:bg-zinc-900">
      {/* Header — FIX 7 dark mode */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Price Alerts</h1>
              <p className="mt-1 text-zinc-500">Get notified when card prices change</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button onClick={() => setShowCreateAlert(true)}>
                <Plus className="h-4 w-4" />
                New Alert
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Alerts List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Active Alerts</p>
                    <Bell className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {alerts.filter((e) => e.alert.is_active).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Total Triggers</p>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {alerts.reduce((sum, e) => sum + (e.alert.trigger_count ?? 0), 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Total Alerts</p>
                    <TrendingDown className="h-4 w-4 text-zinc-400" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{alerts.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter Tabs — FIX 5 explicit label map */}
            <div className="flex items-center gap-2">
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  }`}
                >
                  {FILTER_LABELS[f] ?? f}
                  {f === 'all' && ` (${alerts.length})`}
                  {f === 'active' && ` (${alerts.filter((e) => e.alert.is_active).length})`}
                  {f === 'inactive' && ` (${alerts.filter((e) => !e.alert.is_active).length})`}
                </button>
              ))}
            </div>

            {/* Alerts */}
            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BellOff className="h-12 w-12 text-zinc-300" />
                    <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">No alerts found</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Create an alert to get notified of price changes
                    </p>
                    <Button className="mt-4" onClick={() => setShowCreateAlert(true)}>
                      <Plus className="h-4 w-4" />
                      Create Alert
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredAlerts.map((entry) => {
                  const { alert, card } = entry;
                  const priceChange =
                    card.currentPrice != null && alert.baseline_price != null
                      ? ((card.currentPrice - alert.baseline_price) / alert.baseline_price) * 100
                      : null;
                  const isTriggered =
                    priceChange != null && Math.abs(priceChange) >= alert.threshold_percent;

                  return (
                    <Card key={alert.id} className={!alert.is_active ? 'opacity-60' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-10 items-center justify-center rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                            {card.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-lg font-bold text-zinc-400">?</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{card.name}</h3>
                              {isTriggered && alert.is_active && (
                                <Badge variant="warning" className="gap-1">
                                  <Bell className="h-3 w-3" />
                                  Triggered
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">
                              {card.setName} · {alert.grade}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                              <span className="text-zinc-600">
                                Alert at{' '}
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {alert.direction === 'both' ? '±' : alert.direction === 'up' ? '+' : '-'}
                                  {alert.threshold_percent}%
                                </span>
                              </span>
                              {alert.baseline_price != null && (
                                <>
                                  <span className="text-zinc-300">|</span>
                                  <span className="text-zinc-600">
                                    Baseline:{' '}
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                      {formatPrice(alert.baseline_price)}
                                    </span>
                                  </span>
                                </>
                              )}
                              {priceChange != null && (
                                <>
                                  <span className="text-zinc-300">|</span>
                                  <span className={priceChange >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                    {priceChange >= 0 ? '+' : ''}
                                    {priceChange.toFixed(1)}% since set
                                  </span>
                                </>
                              )}
                              {alert.trigger_count > 0 && (
                                <>
                                  <span className="text-zinc-300">|</span>
                                  <span className="text-zinc-500">
                                    {alert.trigger_count}× triggered
                                  </span>
                                </>
                              )}
                            </div>
                            {alert.last_triggered && (
                              <p className="mt-1 text-xs text-zinc-400">
                                Last triggered: {formatDate(alert.last_triggered)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {card.currentPrice != null && (
                              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                {formatPrice(card.currentPrice)}
                              </span>
                            )}
                            {/* FIX 3 — ARIA for alert row toggle */}
                            <button
                              role="switch"
                              aria-checked={alert.is_active}
                              aria-label={`Toggle alert for ${card.name}`}
                              onClick={() => toggleAlert(alert.id)}
                              className={`relative h-6 w-11 rounded-full transition-colors ${
                                alert.is_active ? 'bg-blue-600' : 'bg-zinc-200'
                              }`}
                            >
                              <span
                                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                                  alert.is_active ? 'left-6' : 'left-1'
                                }`}
                              />
                            </button>
                            {/* FIX 4 — aria-label on delete button */}
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              aria-label={`Delete alert for ${card.name}`}
                              className="rounded p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alert Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-zinc-600">
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Set wider thresholds (10–15%) for volatile cards</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Use tighter thresholds (3–5%) for stable vintage cards</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Alerts are checked every 4–6 hours automatically</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Enable email digests to avoid notification overload</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <CreateAlertModal
        isOpen={showCreateAlert}
        onClose={() => setShowCreateAlert(false)}
        onCreated={handleAlertCreated}
      />
    </div>
  );
}
