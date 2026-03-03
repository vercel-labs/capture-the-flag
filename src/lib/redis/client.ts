import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop) {
    if (!_redis) {
      _redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    }
    return (_redis as unknown as Record<string | symbol, unknown>)[prop];
  },
});
