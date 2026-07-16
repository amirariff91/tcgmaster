export async function fetchOnePieceCards() {
  const apiKey = process.env.OPTCG_API_KEY || process.env.RAPIDAPI_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ No API key found for One Piece TCG. Please sign up for a free key at RapidAPI or JustTCG and add it to your .env');
    console.log('Skipping One Piece fetch for now to maintain $0 cost constraint.');
    return [];
  }

  try {
    // Example using a standard API format for One Piece
    const url = 'https://optcgapi.com/api/cards'; // or your RapidAPI endpoint
    console.log(`Fetching One Piece cards from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        // 'X-RapidAPI-Key': apiKey // if using RapidAPI
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const cards = Array.isArray(data) ? data : (data.cards || data.data || []);
    
    console.log(`Successfully fetched ${cards.length} One Piece cards`);
    
    // Log the first 5 for verification
    console.log('--- First 5 One Piece Cards ---');
    cards.slice(0, 5).forEach((card: any, idx: number) => {
      console.log(`${idx + 1}. ${card.id} - ${card.name}`);
    });
    
    return cards;
  } catch (error) {
    console.error('Error fetching One Piece cards:', error);
    return [];
  }
}

// Simple test script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchOnePieceCards().catch(console.error);
}
