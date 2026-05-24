import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redis = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 5000,
      enableOfflineQueue: false,
    });

    redis.on('error', (err) => {
      // Log but don't crash — attendance still works via DB fallback
      console.warn('Redis unavailable:', err.message);
    });
  } catch (err) {
    console.warn('Redis init failed, running without replay protection cache:', err.message);
    redis = null;
  }
} else {
  console.info('REDIS_URL not set — replay protection will use DB only.');
}

export default redis;
