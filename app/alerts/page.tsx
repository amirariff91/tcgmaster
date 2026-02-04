'use client';

import * as React from 'react';
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Settings,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { formatPrice, formatDate } from '@/lib/utils';

// Mock alerts data
const mockAlerts = [
  {
    id: '1',
    card: {
      id: 'c1',
      name: 'Charizard',
      set: 'Base Set',
      grade: 'PSA 10',
      current_price: 42000,
      image_url: null,
    },
    threshold_percent: 5,
    direction: 'both' as const,
    baseline_price: 40000,
    is_active: true,
    created_at: '2024-01-10',
    last_triggered: '2024-01-18',
    triggered_count: 3,
  },
  {
    id: '2',
    card: {
      id: 'c2',
      name: 'Lugia',
      set: 'Neo Genesis',
      grade: 'PSA 9',
      current_price: 12500,
      image_url: null,
    },
    threshold_percent: 10,
    direction: 'down' as const,
    baseline_price: 13000,
    is_active: true,
    created_at: '2024-01-05',
    last_triggered: null,
    triggered_count: 0,
  },
  {
    id: '3',
    card: {
      id: 'c3',
      name: 'Michael Jordan Rookie',
      set: '1986-87 Fleer',
      grade: 'PSA 10',
      current_price: 450000,
      image_url: null,
    },
    threshold_percent: 3,
    direction: 'up' as const,
    baseline_price: 420000,
    is_active: false,
    created_at: '2023-12-01',
    last_triggered: '2024-01-02',
    triggered_count: 5,
  },
];

const mockTriggeredAlerts = [
  {
    id: 't1',
    alert_id: '1',
    card_name: 'Charizard',
    card_set: 'Base Set',
    previous_price: 40000,
    new_price: 42000,
    change_percent: 5,
    triggered_at: '2024-01-18T14:30:00Z',
    read: false,
  },
  {
    id: 't2',
    alert_id: '1',
    card_name: 'Charizard',
    card_set: 'Base Set',
    previous_price: 38500,
    new_price: 40000,
    change_percent: 3.9,
    triggered_at: '2024-01-15T09:15:00Z',
    read: true,
  },
  {
    id: 't3',
    alert_id: '3',
    card_name: 'Michael Jordan Rookie',
    card_set: '1986-87 Fleer',
    previous_price: 400000,
    new_price: 420000,
    change_percent: 5,
    triggered_at: '2024-01-02T11:00:00Z',
    read: true,
  },
];

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

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AlertSettingsModal({ isOpen, onClose }: AlertSettingsModalProps) {
  const [emailFrequency, setEmailFrequency] = React.useState('daily');
  const [emailEnabled, setEmailEnabled] = React.useState(true);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <ModalTitle>Alert Settings</ModalTitle>
      </ModalHeader>
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 font-medium text-zinc-900">
            Email Notifications
          </h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">
                Enable email alerts
              </span>
              <button
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
                <label className="mb-2 block text-sm text-zinc-600">
                  Notification frequency
                </label>
                <Select
                  options={frequencyOptions}
                  value={emailFrequency}
                  onChange={setEmailFrequency}
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-medium text-zinc-900">
            Default Settings
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm text-zinc-600">
                Default threshold
              </label>
              <Select
                options={thresholdOptions.filter(o => o.value !== 'custom')}
                value="5"
                onChange={() => {}}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-zinc-600">
                Default direction
              </label>
              <Select
                options={directionOptions}
                value="both"
                onChange={() => {}}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save Settings</Button>
        </div>
      </div>
    </Modal>
  );
}

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CreateAlertModal({ isOpen, onClose }: CreateAlertModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [threshold, setThreshold] = React.useState('5');
  const [customThreshold, setCustomThreshold] = React.useState('');
  const [direction, setDirection] = React.useState('both');

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <ModalTitle>Create Price Alert</ModalTitle>
      </ModalHeader>
      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700">
            Search for a card
          </label>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
          />
          {searchQuery && (
            <div className="mt-2 rounded-lg border border-zinc-200 bg-white">
              {/* Mock search results */}
              <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-50">
                <div className="h-12 w-9 rounded bg-zinc-200" />
                <div>
                  <p className="font-medium text-zinc-900">Charizard</p>
                  <p className="text-sm text-zinc-500">Base Set - PSA 10</p>
                </div>
                <span className="ml-auto text-sm font-semibold text-zinc-900">
                  $42,000
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Threshold
            </label>
            <Select
              options={thresholdOptions}
              value={threshold}
              onChange={setThreshold}
            />
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
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Direction
            </label>
            <Select
              options={directionOptions}
              value={direction}
              onChange={setDirection}
            />
          </div>
        </div>

        <div className="rounded-lg bg-zinc-50 p-4">
          <p className="text-sm text-zinc-600">
            You will be notified when the price{' '}
            {direction === 'both' ? 'moves' : direction === 'up' ? 'increases' : 'decreases'}{' '}
            by {threshold === 'custom' ? customThreshold || '?' : threshold}% from the current price.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>
            <Bell className="h-4 w-4" />
            Create Alert
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = React.useState(mockAlerts);
  const [triggeredAlerts, setTriggeredAlerts] = React.useState(mockTriggeredAlerts);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showCreateAlert, setShowCreateAlert] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'active' | 'inactive'>('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'active') return alert.is_active;
    if (filter === 'inactive') return !alert.is_active;
    return true;
  });

  const unreadCount = triggeredAlerts.filter((t) => !t.read).length;

  const toggleAlert = (id: string) => {
    setAlerts(
      alerts.map((a) => (a.id === id ? { ...a, is_active: !a.is_active } : a))
    );
  };

  const deleteAlert = (id: string) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  const markAllRead = () => {
    setTriggeredAlerts(triggeredAlerts.map((t) => ({ ...t, read: true })));
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Price Alerts</h1>
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
                  <p className="mt-2 text-2xl font-bold text-zinc-900">
                    {alerts.filter((a) => a.is_active).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Triggered Today</p>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900">
                    {triggeredAlerts.filter((t) => {
                      const today = new Date().toDateString();
                      return new Date(t.triggered_at).toDateString() === today;
                    }).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Total Triggers</p>
                    <TrendingDown className="h-4 w-4 text-zinc-400" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900">
                    {alerts.reduce((sum, a) => sum + a.triggered_count, 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'all' && ` (${alerts.length})`}
                  {f === 'active' && ` (${alerts.filter((a) => a.is_active).length})`}
                  {f === 'inactive' && ` (${alerts.filter((a) => !a.is_active).length})`}
                </button>
              ))}
            </div>

            {/* Alerts */}
            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BellOff className="h-12 w-12 text-zinc-300" />
                    <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                      No alerts found
                    </h3>
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
                filteredAlerts.map((alert) => {
                  const priceChange =
                    ((alert.card.current_price - alert.baseline_price) /
                      alert.baseline_price) *
                    100;
                  const isTriggered = Math.abs(priceChange) >= alert.threshold_percent;

                  return (
                    <Card
                      key={alert.id}
                      className={!alert.is_active ? 'opacity-60' : ''}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-10 items-center justify-center rounded bg-zinc-100">
                            <span className="text-lg font-bold text-zinc-400">?</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-zinc-900 truncate">
                                {alert.card.name}
                              </h3>
                              {isTriggered && alert.is_active && (
                                <Badge variant="warning" className="gap-1">
                                  <Bell className="h-3 w-3" />
                                  Triggered
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">
                              {alert.card.set} - {alert.card.grade}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                              <span className="text-zinc-600">
                                Alert at{' '}
                                <span className="font-medium text-zinc-900">
                                  ±{alert.threshold_percent}%
                                </span>
                              </span>
                              <span className="text-zinc-300">|</span>
                              <span className="text-zinc-600">
                                Baseline:{' '}
                                <span className="font-medium text-zinc-900">
                                  {formatPrice(alert.baseline_price)}
                                </span>
                              </span>
                              <span className="text-zinc-300">|</span>
                              <span
                                className={
                                  priceChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }
                              >
                                {priceChange >= 0 ? '+' : ''}
                                {priceChange.toFixed(1)}% since set
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-zinc-900">
                              {formatPrice(alert.card.current_price)}
                            </span>
                            <button
                              onClick={() => toggleAlert(alert.id)}
                              className={`relative h-6 w-11 rounded-full transition-colors ${
                                alert.is_active
                                  ? 'bg-blue-600'
                                  : 'bg-zinc-200'
                              }`}
                            >
                              <span
                                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                                  alert.is_active ? 'left-6' : 'left-1'
                                }`}
                              />
                            </button>
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              className="rounded p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-500"
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

          {/* Notification Feed */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Recent Notifications
                    {unreadCount > 0 && (
                      <Badge variant="default">{unreadCount}</Badge>
                    )}
                  </CardTitle>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {triggeredAlerts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    No notifications yet
                  </p>
                ) : (
                  triggeredAlerts.map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-lg p-3 ${
                        notification.read
                          ? 'bg-zinc-50'
                          : 'bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 rounded-full p-1 ${
                            notification.change_percent >= 0
                              ? 'bg-emerald-100'
                              : 'bg-red-100'
                          }`}
                        >
                          {notification.change_percent >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900">
                            {notification.card_name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {notification.card_set}
                          </p>
                          <p className="mt-1 text-sm">
                            <span className="text-zinc-500">
                              {formatPrice(notification.previous_price)}
                            </span>
                            <span className="mx-1 text-zinc-400">→</span>
                            <span className="font-medium text-zinc-900">
                              {formatPrice(notification.new_price)}
                            </span>
                            <span
                              className={`ml-2 ${
                                notification.change_percent >= 0
                                  ? 'text-emerald-600'
                                  : 'text-red-600'
                              }`}
                            >
                              ({notification.change_percent >= 0 ? '+' : ''}
                              {notification.change_percent.toFixed(1)}%)
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {formatDate(notification.triggered_at)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alert Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-zinc-600">
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Set wider thresholds (10-15%) for volatile cards</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Use tighter thresholds (3-5%) for stable vintage cards</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Enable daily digests to avoid notification overload</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <CreateAlertModal isOpen={showCreateAlert} onClose={() => setShowCreateAlert(false)} />
    </div>
  );
}
