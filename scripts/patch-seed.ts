import fs from 'fs';

const filePath = 'scripts/seed-one-piece.ts';
let content = fs.readFileSync(filePath, 'utf8');

const TRANSLATIONS = `const TRANSLATIONS: Record<string, string> = {
  "ファミリーデッキセット": "Family Deck Set",
  "限定商品収録カード": "Limited Product Cards",
  "プロモーションカード": "Promotion Cards",
  "ST-31 : 赤 モンキー・D・ルフィ": "ST-31 : Red Monkey.D.Luffy",
  "ST-32 : 緑 ロロノア・ゾロ": "ST-32 : Green Roronoa Zoro",
  "ST-33 : 青 クザン": "ST-33 : Blue Kuzan",
  "ST-34 : 紫 シャーロット・カタクリ": "ST-34 : Purple Charlotte Katakuri",
  "ST-35 : 赤黒 サボ": "ST-35 : Red/Black Sabo",
  "ST-36 : 黄 ユースタス・キッド": "ST-36 : Yellow Eustass Kid",
  "OP-14 : 蒼海の七傑": "OP-14 : The Azure Sea's Seven",
  "OP-15 : 神の島の冒険": "OP-15 : Adventure on God's Island",
};
`;

const newFormatSetName = `function formatSetName(rawTitle: string): string {
  const match = rawTitle.match(/\\[(.*?)\\]|【(.*?)】/);
  let code = match ? (match[1] || match[2]) : null;
  
  let name = rawTitle.replace(/\\[.*?\\]|【.*?】/, '').trim();
  name = name.replace(/^(BOOSTER PACK|EXTRA BOOSTER|PREMIUM BOOSTER|STARTER DECK(?: EX)?|ULTRA DECK)\\s*-?/i, '');
  name = name.replace(/^(ブースターパック|エクストラブースター|プレミアムブースター|スタートデッキ|アルティメットデッキ)\\s*/, '');
  name = name.replace(/^-+|-+$/g, '').trim();
  
  if (!name) {
     name = rawTitle.replace(/\\[.*?\\]|【.*?】/, '').trim();
  }
  
  let finalName = code ? \`\${code} : \${name}\` : name;
  
  // Remove trailing BOOSTER PACK if it ended up like OP15-EB04 : BOOSTER PACK
  if (finalName.includes("BOOSTER PACK")) {
    finalName = finalName.replace("BOOSTER PACK", "").replace(" : ", "").trim();
  }
  
  if (TRANSLATIONS[finalName]) {
    finalName = TRANSLATIONS[finalName];
  }
  
  return finalName;
}`;

content = content.replace(/function formatSetName\(rawTitle: string\): string \{[\s\S]*?return `\$\{code\} : \$\{name\}`;[\s\n]*\}/, TRANSLATIONS + "\n" + newFormatSetName);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Patched seed script.");
