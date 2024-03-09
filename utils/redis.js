import redis from 'redis';
import { promisify } from 'util';

class RedisClient{
  constructor() {
    this.client = redis.createClient();
    this.clientIsConnected = true;

    this.client.on('error', (err) => {
      console.error(`Redis client error: ${err}`);
      this.clientIsConnected = false;
    });

    this.client.on('connect', () => {
      this.clientIsConnected = true;
    });
  }

  isAlive() {
    return this.clientIsConnected;
  }

  async get(key) {
    const getAsync = promisify(this.client.get).bind(this.client);

    const value = await getAsync(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, duration) {
    this.client.set(key, JSON.stringify(value), 'EX', duration);
  }

  async del(key) {
    this.client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
