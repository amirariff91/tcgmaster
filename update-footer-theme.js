const fs = require('fs');
let content = fs.readFileSync('components/layout/footer.tsx', 'utf8');

content = content.replace(/bg-zinc-50/g, 'bg-black');
content = content.replace(/border-zinc-200/g, 'border-zinc-800');
content = content.replace(/text-zinc-900/g, 'text-zinc-100');
content = content.replace(/text-zinc-500/g, 'text-zinc-400');
content = content.replace(/hover:text-zinc-900/g, 'hover:text-sky-400');

fs.writeFileSync('components/layout/footer.tsx', content);
