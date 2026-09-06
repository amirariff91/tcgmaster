import fs from 'fs';
import path from 'path';

const PROFILES_PATH = path.join(process.cwd(), 'lib/artists/artist-profiles.json');

// Map of verified high-quality headshots and studio emblems
const VERIFIED_AVATARS: Record<string, { photoUrl: string }> = {
  // Legendary Illustrators
  'mitsuhiro-arita': {
    photoUrl: 'https://archives.bulbagarden.net/media/upload/thumb/c/cf/Mitsuhiro_Arita.png/400px-Mitsuhiro_Arita.png',
  },
  'ken-sugimori': {
    photoUrl: 'https://archives.bulbagarden.net/media/upload/thumb/0/06/Ken_Sugimori_2018.jpg/400px-Ken_Sugimori_2018.jpg',
  },
  'naoki-saito': {
    photoUrl: 'https://archives.bulbagarden.net/media/upload/thumb/2/2e/Naoki_Saito.png/400px-Naoki_Saito.png',
  },
  'eiichiro-oda': {
    photoUrl: 'https://static.wikia.nocookie.net/onepiece/images/3/32/Eiichiro_Oda_Infobox.png/revision/latest?cb=20151007150928',
  },
  // Key Animation & Card Studios
  '5ban-graphics': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Creatures_%28company%29_logo.svg/440px-Creatures_%28company%29_logo.svg.png',
  },
  'six-more-vodka': {
    photoUrl: 'https://static.wikia.nocookie.net/leagueoflegends/images/c/c2/SIXMOREVODKA_profileicon.png/revision/latest?cb=20210705001247',
  },
  'kudos-productions': {
    photoUrl: 'https://static.wikia.nocookie.net/leagueoflegends/images/6/6f/Kudos_Productions_profileicon.png/revision/latest?cb=20210705001258',
  },
};

// Additional prominent artists with Bulbapedia entries
const BULBAPEDIA_CANDIDATES: Record<string, string> = {
  'kagemaru-himeno': 'Kagemaru_Himeno',
  'atsuko-nishida': 'Atsuko_Nishida',
  'kouki-saitou': 'Kouki_Saitou',
  'masakazu-fukuda': 'Masakazu_Fukuda',
  'midori-harada': 'Midori_Harada',
  'tomokazu-komiya': 'Tomokazu_Komiya',
  'yuka-morii': 'Yuka_Morii',
  'shin-nagasawa': 'Shin_Nagasawa',
  'naoyo-kimura': 'Naoyo_Kimura',
  'akira-komayama': 'Akira_Komayama',
  'hajime-kusajima': 'Hajime_Kusajima',
  'keiji-kinebuchi': 'Keiji_Kinebuchi',
  'sumiyoshi-kizuki': 'Sumiyoshi_Kizuki',
};

async function fetchBulbapediaPhoto(wikiTitle: string): Promise<string | null> {
  try {
    const url = `https://bulbapedia.bulbagarden.net/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=400`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TCGMaster/1.0 (contact@tcgmaster.com)' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    const pages = json?.query?.pages;
    if (!pages) return null;
    for (const id of Object.keys(pages)) {
      const p = pages[id];
      if (p?.thumbnail?.source) {
        return p.thumbnail.source;
      }
    }
  } catch (err) {
    console.error(`Failed to fetch for ${wikiTitle}:`, err);
  }
  return null;
}

async function run() {
  const raw = fs.readFileSync(PROFILES_PATH, 'utf-8');
  const profiles = JSON.parse(raw);

  // 1. Apply verified avatars
  for (const [slug, data] of Object.entries(VERIFIED_AVATARS)) {
    if (profiles[slug]) {
      profiles[slug].photoUrl = data.photoUrl;
      console.log(`[Verified] Added photo for ${slug}`);
    }
  }

  // 2. Query Bulbapedia for other major illustrators
  for (const [slug, wikiTitle] of Object.entries(BULBAPEDIA_CANDIDATES)) {
    if (profiles[slug] && !profiles[slug].photoUrl) {
      console.log(`Checking Bulbapedia for ${wikiTitle}...`);
      const photo = await fetchBulbapediaPhoto(wikiTitle);
      if (photo) {
        profiles[slug].photoUrl = photo;
        console.log(`[Bulbapedia] Found photo for ${slug}: ${photo}`);
      }
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
  console.log('Successfully updated artist-profiles.json!');
}

run();
