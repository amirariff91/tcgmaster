import * as fs from 'fs';
import { resolve } from 'path';

const envContent = fs.readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.includes('=')) {
    const [key, ...values] = line.split('=');
    if (!process.env[key]) {
      process.env[key] = values.join('=').trim().replace(/(^"|"$)/g, '');
    }
  }
}

import { pptClient } from '../lib/ppt/index';

async function run() {
  console.log("Searching PPT for OP01-120...");
  try {
    const result = await pptClient.searchCards('OP01-120');
    console.log(JSON.stringify(result, null, 2));
  } catch(e) {
    console.error(e);
  }
}

run();
