const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Colors & Backgrounds
content = content.replace(/bg-\[var\(--surface-warm\)\]/g, 'bg-black');
content = content.replace(/bg-\[var\(--surface-paper\)\]/g, 'bg-zinc-950');
content = content.replace(/text-stone-950/g, 'text-zinc-50');
content = content.replace(/text-stone-700/g, 'text-zinc-300');
content = content.replace(/text-stone-600/g, 'text-zinc-400');
content = content.replace(/text-stone-500/g, 'text-zinc-500');
content = content.replace(/text-stone-400/g, 'text-zinc-500');
content = content.replace(/text-stone-300/g, 'text-zinc-600');
content = content.replace(/text-amber-700/g, 'text-sky-400');
content = content.replace(/text-amber-300/g, 'text-sky-400');
content = content.replace(/bg-amber-50\/50/g, 'bg-sky-950/30');

// Borders
content = content.replace(/border-stone-200/g, 'border-zinc-800');
content = content.replace(/border-stone-300/g, 'border-zinc-700');
content = content.replace(/border-white\/10/g, 'border-zinc-800');

// Component specific changes (cards)
content = content.replace(/bg-white/g, 'bg-zinc-900/50 backdrop-blur-md');
content = content.replace(/bg-stone-950/g, 'bg-zinc-950/80 backdrop-blur-md');
content = content.replace(/bg-stone-100/g, 'bg-zinc-800');

fs.writeFileSync('app/page.tsx', content);
