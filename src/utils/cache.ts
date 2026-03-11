export interface CacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface CacheFactory {
  create(): CacheProvider;
}

class NoopCacheProvider implements CacheProvider {
  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(_key: string, _value: string, _ttlSeconds?: number): Promise<void> {
    // Stub for future learner task (Redis/Valkey implementation).
  }

  async del(_key: string): Promise<void> {
    // Stub for future learner task (Redis/Valkey implementation).
  }
}

class NoopCacheFactory implements CacheFactory {
  create(): CacheProvider {
    return new NoopCacheProvider();
  }
}

export const cacheFactory: CacheFactory = new NoopCacheFactory();
export const cache: CacheProvider = cacheFactory.create();
