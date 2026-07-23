import fs from 'fs';

let content = fs.readFileSync('components/charts/collectr-chart.tsx', 'utf8');

// 1. Replace useMemo logic
content = content.replace(
  `  const { chartData, minPrice, maxPrice } = React.useMemo(() => {
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
    let min = Infinity;
    let max = -Infinity;

    relevantHistory.forEach(h => {
      const date = h.recorded_at.split('T')[0];
      const matchedGrade = activeGrades.find(g => h.grade === g || h.grade === \`psa\${g}\` || h.grade === \`psa-\${g}\`);
      if (!matchedGrade) return;

      if (!chartDataMap.has(date)) {
        chartDataMap.set(date, { date });
      }
      const entry = chartDataMap.get(date)!;
      const key = \`price_\${matchedGrade}\`;
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
    };
  }, [priceHistory, timeRange, activeGrades]);`,
  `  const { chartData, minPrice, maxPrice, activeLines } = React.useMemo(() => {
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
      
      const lineKey = isGraded ? \`\${matchedGrade}_\${source}\` : matchedGrade;
      linesSet.add(lineKey);

      if (!chartDataMap.has(date)) {
        chartDataMap.set(date, { date });
      }
      const entry = chartDataMap.get(date)!;
      const key = \`price_\${lineKey}\`;
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

// 2. Replace the Legend rendering
content = content.replace(
  `            {activeTab === 'GRADED' && activeGrades.map((grade, idx) => {
                const color = GRADE_COLORS[idx % GRADE_COLORS.length];
                return (
                    <div key={grade} className="flex items-center gap-2">
                        <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <h2 className="text-[12px] font-medium text-gray-300 tracking-wide">
                            Foil PSA {grade}
                        </h2>
                        <button onClick={() => toggleGrade(grade)} className="text-gray-500 hover:text-white ml-0.5 text-xs font-bold leading-none">
                            &times;
                        </button>
                    </div>
                )
            })}`,
  `            {activeTab === 'GRADED' && activeLines.map((lineKey, idx) => {
                const color = GRADE_COLORS[idx % GRADE_COLORS.length];
                let title = '';
                if (lineKey.includes('_')) {
                    const parts = lineKey.split('_');
                    const gradeId = parts[0];
                    const source = parts[1];
                    const sourceName = source.charAt(0).toUpperCase() + source.slice(1);
                    title = \`\${sourceName} Foil PSA \${gradeId}\`;
                } else {
                    title = \`Foil PSA \${lineKey}\`;
                }
                
                return (
                    <div key={lineKey} className="flex items-center gap-2">
                        <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <h2 className="text-[12px] font-medium text-gray-300 tracking-wide">
                            {title}
                        </h2>
                    </div>
                )
            })}`
);

// 3. Replace Defs mapping
content = content.replace(
  `                    {activeGrades.map((grade, idx) => (
                        <linearGradient key={grade} id={\`colorGradient\${idx}\`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={GRADE_COLORS[idx % GRADE_COLORS.length]} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={GRADE_COLORS[idx % GRADE_COLORS.length]} stopOpacity={0}/>
                        </linearGradient>
                    ))}`,
  `                    {activeLines.map((lineKey, idx) => (
                        <linearGradient key={lineKey} id={\`colorGradient\${idx}\`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={GRADE_COLORS[idx % GRADE_COLORS.length]} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={GRADE_COLORS[idx % GRADE_COLORS.length]} stopOpacity={0}/>
                        </linearGradient>
                    ))}`
);

// 4. Replace Area mapping
content = content.replace(
  `                {activeGrades.map((grade, idx) => (
                    <Area 
                        key={grade}
                        type="monotone" 
                        dataKey={\`price_\${grade}\`} 
                        stroke={GRADE_COLORS[idx % GRADE_COLORS.length]} 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill={\`url(#colorGradient\${idx})\`} 
                        isAnimationActive={false}
                        connectNulls
                    />
                ))}`,
  `                {activeLines.map((lineKey, idx) => (
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

// 5. Replace toggle buttons in Graded Box area
content = content.replace(
  `                                <button
                                    key={g.grade}
                                    onClick={() => toggleGrade(g.grade)}
                                    className={cn(
                                        "min-w-[80px] flex flex-col items-center py-4 px-2 transition-colors",
                                        idx > 0 && "border-l border-[#333]",
                                        isSelected ? "bg-[#182335] border-t-2 border-t-[#2dd4bf] pt-[14px]" : "bg-[#111] hover:bg-[#1a1a1a]"
                                    )}
                                >`,
  `                                <button
                                    key={g.grade}
                                    onClick={() => setActiveGrades([g.grade])}
                                    className={cn(
                                        "min-w-[80px] flex flex-col items-center py-4 px-2 transition-colors",
                                        idx > 0 && "border-l border-[#333]",
                                        isSelected ? "bg-[#182335] border-t-2 border-t-[#2dd4bf] pt-[14px]" : "bg-[#111] hover:bg-[#1a1a1a]"
                                    )}
                                >`
);

fs.writeFileSync('components/charts/collectr-chart.tsx', content);
