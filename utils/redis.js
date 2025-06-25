import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    this.client.connect()
      .then(() => {
        console.log('Connected to Redis');
      })
      .catch((err) => {
        console.error('Redis Connection Error', err);
      });
  }

  // Method to check if Redis connection is successful
  isAlive() {
    return this.client.isOpen;
  }

  async get(key) {
    try {
      const value = this.client.get(key);
      return value;
    } catch (err) {
      console.error(`Error getting key "${key}":`, err);
      return null;
    }
  }

  // Method for setting key, value with duration
  async set(key, value, duration) {
    try {
      await this.client.set(key, value, {
        EX: duration,
      });
    } catch (err) {
      console.error(`Error setting key "${key}":`, err);
    }
  }

  async del(key) {
    try {
      this.client.del(key);
    } catch (err) {
      console.error(`Error deleting key "${key}":`, err);
    }
  }
}

// Export Redis instance
const redisClient = new RedisClient();
export default redisClient;

