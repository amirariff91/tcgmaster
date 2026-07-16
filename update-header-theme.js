const fs = require('fs');
let content = fs.readFileSync('components/layout/header.tsx', 'utf8');

content = content.replace(/bg-\[var\(--surface-paper\)\]/g, 'bg-zinc-950');
content = content.replace(/border-stone-200/g, 'border-zinc-800');
content = content.replace(/text-stone-950/g, 'text-zinc-50');
content = content.replace(/border-zinc-200/g, 'border-zinc-800');
content = content.replace(/bg-white/g, 'bg-zinc-950');
content = content.replace(/text-stone-600/g, 'text-zinc-400');
content = content.replace(/hover:text-stone-900/g, 'hover:text-white');
content = content.replace(/hover:bg-stone-50/g, 'hover:bg-zinc-900');

fs.writeFileSync('components/layout/header.tsx', content);
