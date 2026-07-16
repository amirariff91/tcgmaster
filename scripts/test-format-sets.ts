function formatSetName(rawTitle: string): string {
  const match = rawTitle.match(/\[(.*?)\]|【(.*?)】/);
  const code = match ? (match[1] || match[2]) : null;
  
  if (!code) return rawTitle;
  
  let name = rawTitle.replace(/\[.*?\]|【.*?】/, '').trim();
  
  name = name.replace(/^(BOOSTER PACK|EXTRA BOOSTER|PREMIUM BOOSTER|STARTER DECK(?: EX)?|ULTRA DECK)\s*-?/i, '');
  name = name.replace(/^(ブースターパック|エクストラブースター|プレミアムブースター|スタートデッキ|アルティメットデッキ)\s*/, '');
  
  name = name.replace(/^-+|-+$/g, '').trim();
  
  if (!name) {
     name = rawTitle.replace(/\[.*?\]|【.*?】/, '').trim();
  }
  
  return `${code} : ${name}`;
}

const tests = [
  "BOOSTER PACK -ROMANCE DAWN- [OP-01]",
  "STARTER DECK -Straw Hat Crew- [ST-01]",
  "BOOSTER PACK [OP15-EB04]",
  "スタートデッキ 青 クザン【ST-33】",
  "ブースターパック 神の島の冒険【OP-15】",
  "BOOSTER PACK -500 YEARS IN THE FUTURE- [OP-07]"
];

tests.forEach(t => console.log(formatSetName(t)));
