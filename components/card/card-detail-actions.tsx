'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, Link2, Loader2, Plus, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardDetailActionsProps {
  cardId: string;
  cardName: string;
  /** Grade the page is currently showing — pre-selects the same grade here. */
  defaultGrade?: string;
}

interface Collection {
  id: string;
  name: string;
  type: string;
}

const GRADES = [
  { value: 'raw', label: 'Raw' },
  { value: '7', label: 'PSA 7' },
  { value: '8', label: 'PSA 8' },
  { value: '9', label: 'PSA 9' },
  { value: '10', label: 'PSA 10' },
];

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
  'absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-white/10 bg-[#0b1329] p-1.5 shadow-2xl shadow-black/60';
const optionClass =
  'w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50';

export function CardDetailActions({ cardId, cardName, defaultGrade = 'raw' }: CardDetailActionsProps) {
  const [openMenu, setOpenMenu] = useState<'collection' | 'alert' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [shared, setShared] = useState(false);

  const containerRef = useDismissOnOutsideClick(() => setOpenMenu(null), openMenu !== null);

  const toggle = (menu: 'collection' | 'alert') => {
    setStatus({ kind: 'idle' });
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  async function addToCollection(grade: string) {
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
              {GRADES.map((grade) => (
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
