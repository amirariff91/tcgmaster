const fs = require('fs');

const files = [
  'app/contact/page.tsx',
  'app/about/page.tsx',
  'app/login/page.tsx',
  'app/signup/page.tsx',
];

const replacements = [
  [/bg-zinc-50/g, 'bg-[#060c18]'],
  [/bg-white/g, 'bg-[#0b1329]'], // Cards inner background
  [/text-zinc-900/g, 'text-white'],
  [/text-zinc-800/g, 'text-zinc-100'],
  [/border-zinc-200/g, 'border-white/10'],
  [/border-zinc-300/g, 'border-white/20'],
  [/text-zinc-500/g, 'text-zinc-400'],
  [/text-zinc-600/g, 'text-zinc-400'],
  [/"min-h-screen bg-\[\#0b1329\]"/g, '"min-h-screen bg-[#060c18] pt-24"'],
  [/"min-h-screen bg-\[\#060c18\]"/g, '"min-h-screen bg-[#060c18] pt-24"'],
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(([pattern, replacement]) => {
    content = content.replace(pattern, replacement);
  });
  
  // Custom fix for root div bg-[#0b1329] to bg-[#060c18]
  content = content.replace(/className="min-h-screen bg-\[\#0b1329\]/g, 'className="min-h-screen bg-[#060c18] pt-24');
  
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
