import IORedis from "ioredis";
import { env } from "./env.js";

let redis;

export function getRedis() {
  if (!redis) {
    redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }

  return redis;
}
