const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

content = content.replace(/bg-zinc-900\/50 backdrop-blur-md\/5/g, 'bg-zinc-900/50 backdrop-blur-md');
content = content.replace(/bg-zinc-900\/50 backdrop-blur-md\/\[0\.04\]/g, 'bg-zinc-900/50 backdrop-blur-md');
content = content.replace(/hover:border-amber-700/g, 'hover:border-sky-400');
content = content.replace(/hover:bg-amber-50\/50/g, 'hover:bg-sky-950/30');

fs.writeFileSync('app/page.tsx', content);
