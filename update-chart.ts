import fs from 'fs';

let content = fs.readFileSync('components/charts/collectr-chart.tsx', 'utf8');

// Replace chartData generation logic to support activeLines
content = content.replace(
  /const { chartData, minPrice, maxPrice } = React\.useMemo\(\(\) => \{[\s\S]*?return \{\n\s*chartData: finalData,\n\s*minPrice: min === Infinity \? 0 : min,\n\s*maxPrice: max === -Infinity \? 100 : max,\n\s*\};\n  \}, \[priceHistory, timeRange, activeGrades\]\);/,
  `const { chartData, minPrice, maxPrice, activeLines } = React.useMemo(() => {
    const now = new Date();
    const ranges: Record<TimeRange, number> = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '12M': 365,
      MAX: Infinity,
    };

    const daysAgo = ranges[timeRange];
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const relevantHistory = priceHistory.filter(point => {
      if (timeRange !== 'MAX' && new Date(point.recorded_at) < cutoff) return false;
      return activeGrades.includes(point.grade) || activeGrades.includes(point.grade.replace('psa', '').replace('-', ''));
    });

    const chartDataMap = new Map<string, Record<string, string | number>>();
    const linesSet = new Set<string>();
    let min = Infinity;
    let max = -Infinity;

    relevantHistory.forEach(h => {
      const date = h.recorded_at.split('T')[0];
      const matchedGrade = activeGrades.find(g => h.grade === g || h.grade === \`psa\${g}\` || h.grade === \`psa-\${g}\`);
      if (!matchedGrade) return;
      
      const source = h.source || 'market';
      const isGraded = matchedGrade !== 'raw';
      
      // Distinct key for source if graded
      const lineKey = isGraded ? \`\${matchedGrade}_\${source}\` : matchedGrade;
      linesSet.add(lineKey);
      
      const key = \`price_\${lineKey}\`;

      if (!chartDataMap.has(date)) {
        chartDataMap.set(date, { date });
      }
      const entry = chartDataMap.get(date)!;
      entry[key] = h.price;
      
      if (h.price < min) min = h.price;
      if (h.price > max) max = h.price;
    });

    const finalData = Array.from(chartDataMap.values()).map(entry => {
        return {
            ...entry,
            dateDisplay: entry.date
        };
    }).sort((a, b) => new Date(a.dateDisplay as string).getTime() - new Date(b.dateDisplay as string).getTime());

    return {
      chartData: finalData,
      minPrice: min === Infinity ? 0 : min,
      maxPrice: max === -Infinity ? 100 : max,
      activeLines: Array.from(linesSet).sort(),
    };
  }, [priceHistory, timeRange, activeGrades]);`
);

// Replace legend
content = content.replace(
  /\{activeTab === 'GRADED' && activeGrades\.map\(\(grade, idx\) => \{[\s\S]*?\}\)\}/,
  `{activeTab === 'GRADED' && activeLines.map((lineKey, idx) => {
                const color = GRADE_COLORS[idx % GRADE_COLORS.length];
                let title = '';
                let gradeId = lineKey;
                if (lineKey.includes('_')) {
                    const parts = lineKey.split('_');
                    gradeId = parts[0];
                    const source = parts[1];
                    const sourceName = source.charAt(0).toUpperCase() + source.slice(1);
                    title = \`\${sourceName} Foil PSA \${gradeId}\`;
                } else {
                    title = \`Foil PSA \${gradeId}\`;
                }
                
                return (
                    <div key={lineKey} className="flex items-center gap-2">
                        <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <h2 className="text-[12px] font-medium text-gray-300 tracking-wide">
                            {title}
                        </h2>
                        {/* 
                        <button onClick={() => toggleGrade(gradeId)} className="text-gray-500 hover:text-white ml-0.5 text-xs font-bold leading-none">
                            &times;
                        </button>
                        */}
                    </div>
                )
            })}`
);

// Replace gradients
content = content.replace(
  /<defs>\s*\{activeGrades\.map\(\(grade, idx\) => \([\s\S]*?\}\s*<\/defs>/,
  `<defs>
                    {activeLines.map((lineKey, idx) => (
                        <linearGradient key={lineKey} id={\`colorGradient\${idx}\`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={GRADE_COLORS[idx % GRADE_COLORS.length]} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={GRADE_COLORS[idx % GRADE_COLORS.length]} stopOpacity={0}/>
                        </linearGradient>
                    ))}
                </defs>`
);

// Replace areas
content = content.replace(
  /\{activeGrades\.map\(\(grade, idx\) => \([\s\S]*?\}\)\}/,
  `{activeLines.map((lineKey, idx) => (
                    <Area 
                        key={lineKey}
                        type="monotone" 
                        dataKey={\`price_\${lineKey}\`} 
                        stroke={GRADE_COLORS[idx % GRADE_COLORS.length]} 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill={\`url(#colorGradient\${idx})\`} 
                        isAnimationActive={false}
                        connectNulls
                    />
                ))}`
);


fs.writeFileSync('components/charts/collectr-chart.tsx', content);
