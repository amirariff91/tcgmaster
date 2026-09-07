'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, Flag, Link2, Loader2, Plus, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GRADE_OPTIONS } from '@/lib/pricing/grades';
import type { CanonicalGrade } from '@/lib/pricing/grades';
import { CardReportModal } from './card-report-modal';

interface CardDetailActionsProps {
  cardId: string;
  cardName: string;
  cardNumber?: string;
  currentPrice?: number | null;
  currentSource?: string | null;
  /** Grade the page is currently showing — pre-selects the same grade here. */
  defaultGrade?: string;
}

interface Collection {
  id: string;
  name: string;
  type: string;
}

const ALERT_THRESHOLDS = [5, 10, 20];

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; message: string }
  | { kind: 'signin' }
  | { kind: 'error'; message: string };

function useDismissOnOutsideClick(onDismiss: () => void, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss();
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [active, onDismiss]);

  return ref;
}

const panelClass =
  'absolute left-0 right-0 top-full mt-2.5 z-50 rounded-2xl border border-white/10 bg-[#0b1329]/95 backdrop-blur-xl p-2 shadow-[0_16px_40px_rgba(0,0,0,0.85)] ring-1 ring-white/5';
const optionClass =
  'w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-zinc-200 transition-all duration-150 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

export function CardDetailActions({ 
  cardId, 
  cardName, 
  cardNumber,
  currentPrice,
  currentSource,
  defaultGrade = 'raw' 
}: CardDetailActionsProps) {
  const [openMenu, setOpenMenu] = useState<'collection' | 'alert' | 'report' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [shared, setShared] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherText, setOtherText] = useState('');

  const containerRef = useDismissOnOutsideClick(() => {
    setOpenMenu(null);
    setShowOtherInput(false);
  }, openMenu !== null);

  const toggle = (menu: 'collection' | 'alert' | 'report') => {
    setStatus({ kind: 'idle' });
    setShowOtherInput(false);
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  async function submitQuickReport(category: string, description?: string) {
    setStatus({ kind: 'busy' });
    setOpenMenu(null);
    setShowOtherInput(false);
    try {
      const res = await fetch('/api/cards/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          category,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit report');
      }

      setStatus({ kind: 'done', message: 'Report submitted. Thank you!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting report';
      setStatus({ kind: 'error', message: msg });
    }
  }

  async function addToCollection(grade: CanonicalGrade) {
    setStatus({ kind: 'busy' });
    try {
      const listRes = await fetch('/api/collections');
      if (listRes.status === 401) {
        setStatus({ kind: 'signin' });
        return;
      }
      if (!listRes.ok) throw new Error('collections');

      const { data } = (await listRes.json()) as { data: Collection[] };
      let target = data?.[0];

      // First-time users have no collection yet — create the default one for them.
      if (!target) {
        const createRes = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Collection', type: 'personal' }),
        });
        if (!createRes.ok) throw new Error('create');
        target = ((await createRes.json()) as { data: Collection }).data;
      }

      const addRes = await fetch(`/api/collections/${target.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: cardId,
          grade,
          grading_company_id: null,
        }),
      });
      if (!addRes.ok) throw new Error('add');

      setStatus({ kind: 'done', message: `Added to ${target.name}` });
      setOpenMenu(null);
    } catch {
      setStatus({ kind: 'error', message: 'Could not add this card. Try again.' });
    }
  }

  async function createAlert(thresholdPercent: number) {
    setStatus({ kind: 'busy' });
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          grade: defaultGrade,
          thresholdPercent,
          direction: 'both',
        }),
      });
      if (res.status === 401) {
        setStatus({ kind: 'signin' });
        return;
      }
      if (!res.ok) throw new Error('alert');

      setStatus({ kind: 'done', message: `Alerting on ±${thresholdPercent}% moves` });
      setOpenMenu(null);
    } catch {
      setStatus({ kind: 'error', message: 'Could not create the alert. Try again.' });
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: cardName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  }

  const busy = status.kind === 'busy';

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => toggle('collection')}
            disabled={busy}
            aria-expanded={openMenu === 'collection'}
            aria-haspopup="listbox"
            className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold tracking-wide text-[#060c18] shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-200 hover:bg-zinc-200 hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : status.kind === 'done' ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add to Collection
          </button>

          {openMenu === 'collection' && (
            <div className={panelClass} role="listbox" aria-label="Select grade">
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Which grade do you own?
              </p>
              {GRADE_OPTIONS.map((grade) => (
                <button
                  key={grade.value}
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={busy}
                  onClick={() => addToCollection(grade.value)}
                  className={optionClass}
                >
                  {grade.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggle('alert')}
            disabled={busy}
            aria-label={`Track the price of ${cardName}`}
            aria-expanded={openMenu === 'alert'}
            aria-haspopup="listbox"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors duration-200 hover:bg-white/10 disabled:opacity-60"
          >
            <Bell className="h-4 w-4 text-zinc-300" />
          </button>

          {openMenu === 'alert' && (
            <div className={cn(panelClass, 'left-auto right-0 w-56')} role="listbox" aria-label="Alert threshold">
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Notify me when it moves
              </p>
              {ALERT_THRESHOLDS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={busy}
                  onClick={() => createAlert(pct)}
                  className={optionClass}
                >
                  ±{pct}%
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={share}
          aria-label={`Share ${cardName}`}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors duration-200 hover:bg-white/10"
        >
          {shared ? <Link2 className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4 text-zinc-300" />}
        </button>

        {/* Report / Flag Button with Simple Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggle('report')}
            disabled={busy}
            aria-label={`Report an issue with ${cardName}`}
            aria-expanded={openMenu === 'report'}
            aria-haspopup="listbox"
            title="Report price or variant mismatch"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors duration-200 hover:bg-white/10 disabled:opacity-60"
          >
            <Flag className="h-4 w-4 text-zinc-300 hover:text-amber-400 transition-colors" />
          </button>

          {openMenu === 'report' && (
            <div className={cn(panelClass, 'left-auto right-0 w-64')} role="menu">
              <p className="px-3 pb-2 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-white/5 mb-1">
                Report an Issue
              </p>

              {!showOtherInput ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submitQuickReport('wrong_price')}
                    className={cn(optionClass, 'flex items-center gap-2.5 py-2.5 text-xs font-medium')}
                  >
                    <span>🏷️</span>
                    <span>Wrong Price</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submitQuickReport('variant_mismatch')}
                    className={cn(optionClass, 'flex items-center gap-2.5 py-2.5 text-xs font-medium')}
                  >
                    <span>🔀</span>
                    <span>Variant Mismatch</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submitQuickReport('incorrect_link')}
                    className={cn(optionClass, 'flex items-center gap-2.5 py-2.5 text-xs font-medium')}
                  >
                    <span>🔗</span>
                    <span>Wrong External Link</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowOtherInput(true)}
                    className={cn(optionClass, 'flex items-center gap-2.5 py-2.5 text-xs font-medium text-zinc-400 hover:text-white')}
                  >
                    <span>✏️</span>
                    <span>Other issue...</span>
                  </button>
                </>
              ) : (
                <div className="p-2 space-y-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Describe issue..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    className="w-full px-2.5 py-2 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowOtherInput(false)}
                      className="px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-white"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!otherText.trim()}
                      onClick={() => submitQuickReport('other', otherText)}
                      className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold disabled:opacity-50"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {status.kind === 'done' && (
          <p className="mt-2 text-center text-xs font-medium text-emerald-400">{status.message}</p>
        )}
        {status.kind === 'error' && (
          <p className="mt-2 text-center text-xs font-medium text-red-400">{status.message}</p>
        )}
        {status.kind === 'signin' && (
          <p className="mt-2 text-center text-xs font-medium text-zinc-400">
            <Link href="/login" className="text-white underline underline-offset-2 hover:text-zinc-200">
              Sign in
            </Link>{' '}
            to save cards and set alerts.
          </p>
        )}
        {shared && status.kind === 'idle' && (
          <p className="mt-2 text-center text-xs font-medium text-emerald-400">Link copied</p>
        )}
      </div>
    </div>
  );
}
