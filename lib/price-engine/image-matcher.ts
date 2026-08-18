import 'dotenv/config';

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma4:31b';
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com';

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (err) {
    console.error('Failed to fetch image:', url, err);
    return null;
  }
}

/**
 * Verifies if the source image matches our reference image using Ollama Vision.
 */
export async function verifyImageMatch(
  ourImageUrl: string,
  sourceImageUrl: string,
  cardName: string,
  cardNumber: string,
  variantType: string = ''
): Promise<{ match: boolean; confidence: number; detectedCard: string }> {
  if (!OLLAMA_API_KEY) {
    console.log('No Ollama API key available for vision matching.');
    return { match: false, confidence: 0, detectedCard: 'No API Key' };
  }

  const referenceBase64 = await fetchImageAsBase64(ourImageUrl);
  const sourceBase64 = await fetchImageAsBase64(sourceImageUrl);

  if (!referenceBase64) {
    console.log('Failed to fetch reference image for comparison:', ourImageUrl);
    return { match: false, confidence: 0, detectedCard: 'Reference Fetch Error' };
  }

  if (!sourceBase64) {
    console.log('Failed to fetch source image for comparison:', sourceImageUrl);
    return { match: false, confidence: 0, detectedCard: 'Fetch Error' };
  }

  const cleanName = cardName.split(' (')[0];
  const variantHint = variantType ? `This card is expected to be a ${variantType} variant.` : '';

  const prompt = `You are comparing two One Piece Trading Card Game images.
Image 1 is the trusted reference card from our catalog.
Image 2 is the card image from a third-party marketplace.

Please compare Image 2 against Image 1 and determine whether they depict the same exact card and variant.
Use the printed card number, character, artwork, rarity, and variant treatment as evidence. Do not infer a match from the text description alone.
The catalog metadata is:
Name: ${cleanName}
Number: ${cardNumber}
${variantHint}

Tell me:
1) Character Name
2) Card Number
3) Variant Type (Base, Alternate Art, Manga Art, Special Card, Serialized, etc)
4) MATCH: (YES or NO - Does it perfectly match the requested Name, Number, and Variant Type?)

Keep your response to exactly 4 short lines.`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [{
          role: 'user',
          content: prompt,
        images: [referenceBase64, sourceBase64]
        }],
      }),
    });

    if (!res.ok) {
      console.log('Ollama API error:', res.status, res.statusText);
      return { match: false, confidence: 0, detectedCard: 'API Error' };
    }

    const data = await res.json();
    const text = data?.message?.content || '';

    // Parse the result
    const isMatch = text.toUpperCase().includes('MATCH: YES');
    const confidence = isMatch ? 100 : (text.toUpperCase().includes('YES') ? 80 : 0);

    return {
      match: isMatch || confidence > 0,
      confidence,
      detectedCard: text.replace(/\n/g, ' | ')
    };
  } catch (err) {
    console.error('Ollama API call failed:', err);
    return { match: false, confidence: 0, detectedCard: 'Exception' };
  }
}
