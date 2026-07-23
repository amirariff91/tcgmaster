const fs = require('fs');
const file = 'components/charts/collectr-chart.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const finalData = initialData;/g, `// Forward-fill algorithm
    const activeSourcesArr = Array.from(activeSourcesSet);
    const lastKnownPrices: Record<string, number> = {};
    
    const finalData = initialData.map(row => {
        const newRow = { ...row };
        activeSourcesArr.forEach(source => {
            if (row[source] !== undefined) {
                lastKnownPrices[source] = row[source] as number;
            } else if (lastKnownPrices[source] !== undefined) {
                newRow[source] = lastKnownPrices[source];
            }
        });
        return newRow;
    });`);

fs.writeFileSync(file, content);
console.log("Restored forward-fill");
