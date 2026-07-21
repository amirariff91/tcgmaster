'use client';

import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip } from 'recharts';

interface ChartData {
  name: string;
  count: number;
}

export function HealthAreaChart({ data, color }: { data: ChartData[], color: string }) {
  if (!data || data.length === 0) return <div className="h-full w-full bg-black/20" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`color-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip 
          contentStyle={{ backgroundColor: '#0b1329', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
          itemStyle={{ color: '#fff', fontWeight: 'bold' }}
          labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
        />
        <Area 
          type="monotone" 
          dataKey="count" 
          stroke={color} 
          strokeWidth={2}
          fillOpacity={1} 
          fill={`url(#color-${color})`} 
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HealthBarChart({ data, color }: { data: ChartData[], color: string }) {
  if (!data || data.length === 0) return <div className="h-full w-full bg-black/20" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
        <Tooltip 
          contentStyle={{ backgroundColor: '#0b1329', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
          itemStyle={{ color: '#fff', fontWeight: 'bold' }}
          labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
        />
        <Bar 
          dataKey="count" 
          fill={color} 
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
