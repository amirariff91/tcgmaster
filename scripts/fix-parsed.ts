import fs from 'fs';
const filePath = 'lib/search/service.ts';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  `        parsed: {
          originalQuery: query,
          cardName: null,
          setName: null,
          rarity: null,
          suggestions: [],
        },`,
  `        parsed: parseSearchQuery(query),`
);

fs.writeFileSync(filePath, content, 'utf8');
