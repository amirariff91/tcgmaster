import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';

const updates = [
  { slug: 'dbfw-fb10', date: '2026-05-29T00:00:00Z' },
  { slug: 'dbfw-fb09', date: '2026-02-27T00:00:00Z' },
  { slug: 'dbfw-fs11', date: '2026-01-30T00:00:00Z' },
  { slug: 'dbfw-fs12', date: '2026-01-30T00:00:00Z' },
  { slug: 'dbfw-sb02', date: '2025-12-19T00:00:00Z' },
  { slug: 'dbfw-fb08', date: '2025-11-28T00:00:00Z' },
  { slug: 'dbfw-fb07', date: '2025-08-29T00:00:00Z' },
  { slug: 'dbfw-fb06', date: '2025-05-30T00:00:00Z' },
  { slug: 'dbfw-fs09', date: '2025-05-30T00:00:00Z' },
  { slug: 'dbfw-fs10', date: '2025-05-30T00:00:00Z' },
  { slug: 'dbfw-sb01', date: '2025-03-28T00:00:00Z' },
  { slug: 'dbfw-fb05', date: '2025-02-28T00:00:00Z' },
  { slug: 'dbfw-fs08', date: '2025-02-28T00:00:00Z' },
  { slug: 'dbfw-fs06', date: '2024-11-08T00:00:00Z' },
  { slug: 'dbfw-fs07', date: '2024-11-08T00:00:00Z' },
  { slug: 'dbfw-fb04', date: '2024-11-08T00:00:00Z' },
  { slug: 'dbfw-fb03', date: '2024-08-09T00:00:00Z' },
  { slug: 'dbfw-fs05', date: '2024-08-09T00:00:00Z' },
  { slug: 'dbfw-fb02', date: '2024-05-10T00:00:00Z' },
  { slug: 'dbfw-fb01', date: '2024-02-23T00:00:00Z' },
  { slug: 'dbfw-fs01', date: '2024-02-23T00:00:00Z' },
  { slug: 'dbfw-fs02', date: '2024-02-23T00:00:00Z' },
  { slug: 'dbfw-fs03', date: '2024-02-23T00:00:00Z' },
  { slug: 'dbfw-fs04', date: '2024-02-23T00:00:00Z' },
  { slug: 'dbfw-promo', date: '2024-02-01T00:00:00Z' },
];

async function run() {
  for (const u of updates) {
    await dbQuery(`UPDATE sets SET release_date = $1::timestamptz WHERE slug = $2`, [u.date, u.slug]);
  }
  console.log('Successfully updated all DBFW set release dates');
}

run()
  .catch(console.error)
  .finally(async () => {
    await pool.end();
  });
