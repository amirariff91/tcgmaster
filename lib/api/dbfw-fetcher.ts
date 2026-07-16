export async function fetchDBFWCards(setCode = 'fb01') {
  try {
    const url = `https://raw.githubusercontent.com/apitcg/dragon-ball-fusion-tcg-data/main/cards/en/${setCode}.json`;
    console.log(`Fetching DBFW cards from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const cards = await response.json();
    console.log(`Successfully fetched ${cards.length} cards from ${setCode}`);
    
    // Log the first 5 for verification
    console.log('--- First 5 DBFW Cards ---');
    cards.slice(0, 5).forEach((card: any, idx: number) => {
      console.log(`${idx + 1}. ${card.code} - ${card.name} (${card.rarity})`);
    });
    
    return cards;
  } catch (error) {
    console.error('Error fetching DBFW cards:', error);
    return [];
  }
}

// Simple test script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchDBFWCards().catch(console.error);
}
