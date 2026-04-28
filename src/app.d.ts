declare global {
	namespace App {
		interface Platform {
			env: CloudflareEnv;
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

type CloudflareEnv = object;

export {};
