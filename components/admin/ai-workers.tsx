import { Bot, Terminal } from 'lucide-react';
import fs from 'fs';
import path from 'path';

async function getPM2Logs(logPath: string) {
  try {
    const absolutePath = path.join(process.cwd(), logPath);
    if (!fs.existsSync(absolutePath)) return ["Log file not found."];

    const stat = await fs.promises.stat(absolutePath);
    if (stat.size === 0) return ["Waiting for activity..."];

    const readSize = Math.min(stat.size, 4096);
    const buffer = Buffer.alloc(readSize);
    const fileHandle = await fs.promises.open(absolutePath, 'r');

    try {
      await fileHandle.read(buffer, 0, readSize, stat.size - readSize);
    } finally {
      await fileHandle.close();
    }

    const output = buffer.toString('utf8').trim();
    if (!output) return ["Waiting for activity..."];

    const lines = output.split('\n').filter(Boolean).slice(-6);
    return lines.map(line => {
      const match = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}:\s*(.*)/);
      if (match) return match[1];
      return line.replace(/^\d+\|[^|]+\|\s*/, '');
    });
  } catch (e) {
    return ["Failed to read PM2 logs."];
  }
}

export async function AIWorkerClusters() {
  const geminiLogs = await getPM2Logs('logs/artist-vision.log');
  const ollamaLogs = await getPM2Logs('logs/variant-mapper.log');

  return (
    <div className="pt-8 border-t border-white/10">
      <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
         <Bot className="w-6 h-6 text-purple-400" /> AI Worker Clusters
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Gemini Artist Extractor */}
        <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col relative overflow-hidden group">
          <div className="flex justify-between items-start mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                <h3 className="font-black text-white text-lg tracking-tight">Gemini Vision OCR</h3>
              </div>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Artist Extractor Engine</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Architecture</p>
              <p className="font-bold tabular-nums text-sm text-purple-400">gemini-1.5-flash</p>
            </div>
          </div>

          <div className="mt-auto">
            <div className="bg-black/60 border border-white/5 rounded-xl p-3.5 relative">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-2.5">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live PM2 Terminal</p>
              </div>
              <div className="space-y-2 font-mono text-[11px] leading-relaxed break-all">
                {geminiLogs.map((log, i) => (
                  <div key={i} className="flex gap-2.5 text-zinc-400 items-start">
                    <span className="text-purple-500 flex-shrink-0 mt-px">{'->'}</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Variant Mapper */}
        <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col relative overflow-hidden group">
          <div className="flex justify-between items-start mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                <h3 className="font-black text-white text-lg tracking-tight">Variant Canonical Resolver</h3>
              </div>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Cross-Set Matcher</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Architecture</p>
              <p className="font-bold tabular-nums text-sm text-indigo-400">ollama/qwen2.5:14b</p>
            </div>
          </div>

          <div className="mt-auto">
            <div className="bg-black/60 border border-white/5 rounded-xl p-3.5 relative">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-2.5">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live PM2 Terminal</p>
              </div>
              <div className="space-y-2 font-mono text-[11px] leading-relaxed break-all">
                {ollamaLogs.map((log, i) => (
                  <div key={i} className="flex gap-2.5 text-zinc-400 items-start">
                    <span className="text-indigo-500 flex-shrink-0 mt-px">{'->'}</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
