import { redis } from '../lib/redis/client';
async function run() {
  await redis.del('api:sets:one-piece');
  await redis.del('api:sets:dbfw');
  await redis.del('api:sets:pokemon');
  console.log('Cleared redis cache for sets');
}
run();
