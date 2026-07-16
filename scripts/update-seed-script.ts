import fs from 'fs';

const filePath = 'scripts/seed-one-piece.ts';
let content = fs.readFileSync(filePath, 'utf8');

const helper = `
function formatSetName(rawTitle: string): string {
  const match = rawTitle.match(/\\[(.*?)\\]|【(.*?)】/);
  const code = match ? (match[1] || match[2]) : null;
  if (!code) return rawTitle;
  
  let name = rawTitle.replace(/\\[.*?\\]|【.*?】/, '').trim();
  name = name.replace(/^(BOOSTER PACK|EXTRA BOOSTER|PREMIUM BOOSTER|STARTER DECK(?: EX)?|ULTRA DECK)\\s*-?/i, '');
  name = name.replace(/^(ブースターパック|エクストラブースター|プレミアムブースター|スタートデッキ|アルティメットデッキ)\\s*/, '');
  name = name.replace(/^-+|-+$/g, '').trim();
  
  if (!name) {
     name = rawTitle.replace(/\\[.*?\\]|【.*?】/, '').trim();
  }
  
  return \`\${code} : \${name}\`;
}
`;

// Insert the helper at the top after imports
content = content.replace('const supabase = createClient(supabaseUrl, supabaseKey);', 'const supabase = createClient(supabaseUrl, supabaseKey);' + helper);

// Replace the setName assignment
content = content.replace(
  'const setName = pack.raw_title;',
  'const setName = formatSetName(pack.raw_title);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done updating seed script');
