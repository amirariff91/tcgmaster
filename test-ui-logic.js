const priceHistoryData = [
  { source: 'yuyutei', price: 10, recorded_at: '2026-07-10T12:00:00Z', grade: 'raw' },
  { source: 'tcgplayer', price: 12, recorded_at: '2026-07-11T12:00:00Z', grade: 'raw' },
  { source: 'yuyutei', price: 11, recorded_at: '2026-07-12T12:00:00Z', grade: 'raw' },
];

const latestPrices = new Map();
priceHistoryData.forEach(h => {
  if (h.grade !== 'raw') return;
  const current = latestPrices.get(h.source);
  if (!current || new Date(h.recorded_at) > new Date(current.recorded_at)) {
    latestPrices.set(h.source, h);
  }
});

console.log(Array.from(latestPrices.values()));
