import fs from 'fs';

const path = 'lib/price-engine/snkrdunk.ts';
let code = fs.readFileSync(path, 'utf8');

// The replacement logic:
const newLogic = `
    // If we're passed an exact SNKRDUNK product URL, go straight to it!
    if (isUrl && rawQuery.includes('/trading-cards/')) {
      const match = rawQuery.match(/\\/trading-cards\\/(\\d+)/);
      if (!match) return null;
      
      const productId = match[1];
      const productCode = \`SW---\${productId}\`;
      const HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      };

      // Fetch Product Details for Title
      const prodRes = await fetch(\`https://snkrdunk.com/en/v1/products/\${productCode}\`, { headers: HEADERS });
      const prodData = await prodRes.json() as any;
      const externalTitle = prodData?.product?.name || 'Snkrdunk Card';

      // Fetch Used Listings for Prices
      const listingsRes = await fetch(\`https://snkrdunk.com/en/v1/products/\${productCode}/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=false\`, { headers: HEADERS });
      const listingsData = await listingsRes.json() as any;
      const listings = Array.isArray(listingsData?.usedListings) ? listingsData.usedListings : [];

      const gradedPrices: Record<string, number> = {};
      const seenSoldGrades = new Set<string>();

      for (const listing of listings) {
        if (typeof listing !== 'object' || listing === null) continue;
        const condition = listing.condition || 'A';
        const price = Number(listing.priceAmount);
        if (isNaN(price) || price <= 0) continue;

        let parsedGrade = 'raw';
        if (!['B', 'C', 'D', 'S', 'A'].includes(condition)) {
           const gradeMatch = condition.match(/^(PSA|BGS|CGC|TAG|AGS|ARS).*?\\s+([0-9]+\\.?[0-9]*\\+?)$/i) || condition.match(/PSA\\s*([0-9]+\\.?[0-9]*)/i);
           if (gradeMatch) {
             const company = gradeMatch[1].toLowerCase();
             const numeric = gradeMatch[2].replace('+', '').replace('.', '');
             parsedGrade = \`\${company}\${numeric}\`;
           } else {
             // Basic fallback
             if (condition.includes('PSA 10')) parsedGrade = 'psa10';
             else if (condition.includes('PSA 9')) parsedGrade = 'psa9';
             else if (condition.includes('BGS 10')) parsedGrade = 'bgs10';
           }
        } else if (['B', 'C', 'D'].includes(condition)) {
           continue; // Skip lower grades
        }

        if (listing.isSold) {
          if (!seenSoldGrades.has(parsedGrade)) {
            seenSoldGrades.add(parsedGrade);
            gradedPrices[parsedGrade] = price;
          }
        } else {
          // If not sold, it's an Ask price. We only save it if we haven't seen a Sold price AND haven't saved a lower Ask price yet.
          if (!seenSoldGrades.has(parsedGrade)) {
            if (!gradedPrices[parsedGrade] || price < gradedPrices[parsedGrade]) {
              gradedPrices[parsedGrade] = price;
            }
          }
        }
      }

      let headlinePrice: number | undefined;
      if (gradedPrices['raw']) {
        headlinePrice = gradedPrices['raw'];
        delete gradedPrices['raw'];
      } else {
        // Fallback to whichever is available if raw isn't
        headlinePrice = Object.values(gradedPrices)[0];
      }

      if (headlinePrice !== undefined || Object.keys(gradedPrices).length > 0) {
        return {
          price: headlinePrice || 0,
          ...(Object.keys(gradedPrices).length > 0 ? { gradedPrices } : {}),
          url: rawQuery,
          evidence: {
            externalUrl: rawQuery,
            externalTitle,
            matchedBy: 'cached-url',
          },
        };
      }
      return null;
    }
`;

// Extract old block
const startStr = "// If we're passed an exact SNKRDUNK product URL, go straight to it!";
const endStr = "// Otherwise, we are doing a search query.";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find boundaries.');
  process.exit(1);
}

const before = code.slice(0, startIndex);
const after = code.slice(endIndex);

const newCode = before + newLogic + '\n    ' + after;

fs.writeFileSync(path, newCode);
console.log('Successfully updated snkrdunk.ts');
