import { redis } from '../lib/redis/client';

async function run() {
  await redis.flushall();
  console.log("Flushed redis cache");
}

run();
