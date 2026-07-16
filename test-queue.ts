import { execSync } from 'child_process';
try {
  const output = execSync('bun run scripts/price-engine/queue-english-op.ts', { encoding: 'utf-8', timeout: 30000 });
  console.log(output);
} catch (e: any) {
  console.log(e.stdout);
  console.error(e.stderr);
}
