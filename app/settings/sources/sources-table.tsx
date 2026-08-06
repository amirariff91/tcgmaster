'use client';

import { useState } from 'react';
import { Check, Edit2, Link2, Loader2, Save, X } from 'lucide-react';
import Link from 'next/link';

interface Card {
  id: string;
  slug: string;
  name: string;
  number: string;
  snkrdunk_url: string | null;
  pricecharting_url: string | null;
  yuyutei_url: string | null;
  price_cache_ttl: number | null;
  curation_status: string | null;
}

export function SourcesTable({ initialCards }: { initialCards: Card[] }) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Edit state
  const [snkrUrl, setSnkrUrl] = useState('');
  const [pcUrl, setPcUrl] = useState('');
  const [yuyuUrl, setYuyuUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = (card: Card) => {
    setEditingId(card.id);
    setSnkrUrl(card.snkrdunk_url || '');
    setPcUrl(card.pricecharting_url || '');
    setYuyuUrl(card.yuyutei_url || '');
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/${id}/sources`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snkrdunk_url: snkrUrl || null,
          pricecharting_url: pcUrl || null,
          yuyutei_url: yuyuUrl || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');
      const { data } = await res.json();

      setCards(cards.map(c => c.id === id ? data : c));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to save URLs');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-zinc-300">
        <thead className="text-xs uppercase bg-[#14203a] text-zinc-400 border-b border-white/10">
          <tr>
            <th className="px-4 py-4 font-medium">Card</th>
            <th className="px-4 py-4 font-medium w-24">Price</th>
            <th className="px-4 py-4 font-medium w-24">Status</th>
            <th className="px-4 py-4 font-medium w-64">Snkrdunk</th>
            <th className="px-4 py-4 font-medium w-64">PriceCharting</th>
            <th className="px-4 py-4 font-medium w-64">Yuyutei</th>
            <th className="px-4 py-4 font-medium text-right w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {cards.map((card) => {
            const isEditing = editingId === card.id;
            const price = card.price_cache_ttl ? `$${(card.price_cache_ttl / 100).toFixed(2)}` : '--';

            return (
              <tr key={card.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/one-piece-card-game/japanese-op01/${card.slug}`} className="font-medium text-white hover:text-blue-400 line-clamp-1" title={card.name}>
                    {card.name}
                  </Link>
                  <div className="text-xs text-zinc-500 mt-0.5">{card.number}</div>
                </td>
                <td className="px-4 py-3">{price}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    card.curation_status === 'curated' ? 'bg-green-500/10 text-green-400' :
                    card.curation_status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {card.curation_status}
                  </span>
                </td>

                {isEditing ? (
                  <>
                    <td className="px-4 py-2"><input type="text" value={snkrUrl} onChange={e => setSnkrUrl(e.target.value)} placeholder="Snkrdunk URL" className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs" /></td>
                    <td className="px-4 py-2"><input type="text" value={pcUrl} onChange={e => setPcUrl(e.target.value)} placeholder="PriceCharting URL" className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs" /></td>
                    <td className="px-4 py-2"><input type="text" value={yuyuUrl} onChange={e => setYuyuUrl(e.target.value)} placeholder="Yuyutei URL" className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs" /></td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={handleCancel} disabled={saving} className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleSave(card.id)} disabled={saving} className="p-1.5 hover:bg-green-500/20 rounded text-green-500 transition-colors bg-green-500/10">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      {card.snkrdunk_url ? (
                        <a href={card.snkrdunk_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs truncate max-w-[200px]">
                          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <span className="truncate">{card.snkrdunk_url.split('.com')[1]}</span>
                        </a>
                      ) : <span className="text-zinc-600 text-xs">Missing</span>}
                    </td>
                    <td className="px-4 py-3">
                      {card.pricecharting_url ? (
                        <a href={card.pricecharting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs truncate max-w-[200px]">
                          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <span className="truncate">{card.pricecharting_url.split('/game')[1]}</span>
                        </a>
                      ) : <span className="text-zinc-600 text-xs">Missing</span>}
                    </td>
                    <td className="px-4 py-3">
                      {card.yuyutei_url ? (
                        <a href={card.yuyutei_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs truncate max-w-[200px]">
                          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <span className="truncate">{card.yuyutei_url.split('.jp')[1]}</span>
                        </a>
                      ) : <span className="text-zinc-600 text-xs">Missing</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(card)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/10">
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
