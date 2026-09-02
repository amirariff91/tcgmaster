export interface SetSortItem {
  id: string;
  name: string;
  slug: string;
  release_date?: string | null;
  card_count?: number | null;
  priority?: number | null;
}

/**
 * Sorts sets for a given game according to collector hierarchy and release dates.
 */
export function sortSetsForGame<T extends SetSortItem>(sets: T[], gameSlug: string): T[] {
  const sorted = [...sets];

  if (gameSlug === 'pokemon' || gameSlug === 'riftbound' || gameSlug === 'boboiboy') {
    // Pure chronological: Latest release date on top -> Oldest at bottom
    return sorted.sort((a, b) => {
      const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
      const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return a.name.localeCompare(b.name);
    });
  }

  if (gameSlug === 'one-piece') {
    // Prefix Tier Bundling: OP (latest first) -> EB -> PRB -> ST -> Promos/Others
    const getOpTier = (s: SetSortItem): number => {
      const slug = (s.slug || '').toLowerCase();
      const name = (s.name || '').toUpperCase();
      if (slug.startsWith('op-op-') || name.startsWith('OP-') || name.startsWith('OP ')) return 1;
      if (slug.startsWith('op-eb-') || name.startsWith('EB-') || name.startsWith('EB ')) return 2;
      if (slug.startsWith('op-prb-') || name.startsWith('PRB-') || name.startsWith('PRB ')) return 3;
      if (slug.startsWith('op-st-') || name.startsWith('ST-') || name.startsWith('ST ')) return 4;
      return 5;
    };

    return sorted.sort((a, b) => {
      const tierA = getOpTier(a);
      const tierB = getOpTier(b);
      if (tierA !== tierB) return tierA - tierB;

      // Within the same tier, sort by release_date DESC first
      const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
      const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      // Fallback: natural numerical slug sort (e.g. op-op-16 > op-op-01)
      return b.slug.localeCompare(a.slug, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  if (gameSlug === 'dbfw') {
    // Prefix Tier Bundling: FB (latest first) -> SB -> FS -> Promos/Others
    const getDbfwTier = (s: SetSortItem): number => {
      const slug = (s.slug || '').toLowerCase();
      const name = (s.name || '').toUpperCase();
      if (slug.startsWith('dbfw-fb') || name.startsWith('FB') || name.includes('AWAKENED PULSE') || name.includes('BLAZING AURA') || name.includes('RAGING ROAR') || name.includes('ULTRA LIMIT')) return 1;
      if (slug.startsWith('dbfw-sb') || name.startsWith('SB')) return 2;
      if (slug.startsWith('dbfw-fs') || name.startsWith('FS') || name.includes('STARTER DECK')) return 3;
      return 4;
    };

    return sorted.sort((a, b) => {
      const tierA = getDbfwTier(a);
      const tierB = getDbfwTier(b);
      if (tierA !== tierB) return tierA - tierB;

      // Within the same tier, sort by release_date DESC first
      const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
      const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      // Fallback: natural numerical slug sort (e.g. dbfw-fb10 > dbfw-fb01)
      return b.slug.localeCompare(a.slug, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  // Default fallback: priority then release_date DESC then name
  return sorted.sort((a, b) => {
    if (a.priority != null && b.priority != null && a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
    const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return a.name.localeCompare(b.name);
  });
}
