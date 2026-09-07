'use client';

import * as React from 'react';
import { 
  AlertCircle, 
  X, 
  CheckCircle2, 
  Loader2, 
  DollarSign, 
  GitCompare, 
  Link as LinkIcon, 
  HelpCircle,
  Check
} from 'lucide-react';

export interface CardReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  cardName: string;
  cardNumber?: string;
  currentPrice?: number | null;
  currentSource?: string | null;
  initialCategory?: string;
}

const ISSUE_CATEGORIES = [
  {
    id: 'wrong_price',
    label: 'Wrong or Outdated Price',
    icon: DollarSign,
    description: 'Price differs significantly from actual recent sales.',
    hasPriceInput: true,
  },
  {
    id: 'variant_mismatch',
    label: 'Variant Mismatch',
    icon: GitCompare,
    description: 'Base card mixed up with Alternate Art, Manga, or Parallel.',
  },
  {
    id: 'incorrect_link',
    label: 'Incorrect External Link',
    icon: LinkIcon,
    description: 'Snkrdunk or TCGPlayer link points to the wrong card.',
    hasUrlInput: true,
  },
  {
    id: 'other',
    label: 'Other Issue / Notes',
    icon: HelpCircle,
    description: 'Condition confusion, metadata typo, or custom feedback.',
  },
];

export function CardReportModal({
  isOpen,
  onClose,
  cardId,
  cardName,
  cardNumber,
  currentPrice,
  currentSource,
  initialCategory = 'wrong_price',
}: CardReportModalProps) {
  const [category, setCategory] = React.useState<string>(initialCategory);
  const [expectedPrice, setExpectedPrice] = React.useState<string>('');
  const [suggestedUrl, setSuggestedUrl] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [isSuccess, setIsSuccess] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setIsSuccess(false);
      setErrorMessage(null);
    }
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  const selectedCategoryObj = ISSUE_CATEGORIES.find((c) => c.id === category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/cards/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          category,
          expectedPrice: expectedPrice ? expectedPrice : undefined,
          suggestedUrl: suggestedUrl ? suggestedUrl : undefined,
          description: description ? description : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report.');
      }

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
      {/* Dark Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog (Bottom sheet on mobile, centered card on desktop) */}
      <div className="relative w-full sm:max-w-md bg-[#0a1122] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/80 text-white z-10 space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Report Issue</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
              {cardName} {cardNumber && <span className="text-zinc-400 font-medium">({cardNumber})</span>}
            </h2>
            {currentPrice != null && (
              <p className="text-xs text-zinc-400">
                Current price on site: <span className="text-amber-400 font-semibold">${currentPrice.toFixed(2)}</span>
                {currentSource && <span className="text-zinc-500 font-normal"> ({currentSource})</span>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-in zoom-in-50 duration-300" />
            <h3 className="text-base sm:text-lg font-bold text-white">Report Submitted!</h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Thank you! Our data audit pipeline has received your report and queued this card for verification.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full-width single column category selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                What is the issue?
              </label>
              
              <div className="space-y-2">
                {ISSUE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/30'
                          : 'bg-white/[0.02] border-white/5 text-zinc-300 hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-400'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-snug">
                            {cat.label}
                          </div>
                          <div className="text-xs text-zinc-400 leading-normal mt-0.5">
                            {cat.description}
                          </div>
                        </div>
                      </div>

                      {/* Clean Radio Indicator */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected 
                          ? 'border-amber-500 bg-amber-500 text-black' 
                          : 'border-white/20 bg-transparent'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Field: Expected Price */}
            {selectedCategoryObj?.hasPriceInput && (
              <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-200">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                  Expected / Actual Market Price ($ USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 15.00"
                    value={expectedPrice}
                    onChange={(e) => setExpectedPrice(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-[#060b17] border border-white/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Dynamic Field: Suggested URL */}
            {selectedCategoryObj?.hasUrlInput && (
              <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-200">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                  Correct Listing URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://snkrdunk.com/... or https://tcgplayer.com/..."
                  value={suggestedUrl}
                  onChange={(e) => setSuggestedUrl(e.target.value)}
                  className="w-full px-3.5 py-3 bg-[#060b17] border border-white/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}

            {/* Freeform Notes */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                Additional Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Add any extra context to help us fix this faster..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#060b17] border border-white/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <p className="text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                {errorMessage}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-1/3 py-3 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
