import { redis } from '../lib/redis/client';
async function run() {
  await redis.del('api:games:all');
  await redis.del('api:sets:one-piece');
  await redis.del('api:sets:dbfw');
  await redis.del('api:sets:pokemon');
  await redis.del('api:sets:riftbound');
  console.log('Cleared redis cache for games and sets');
}
run();
