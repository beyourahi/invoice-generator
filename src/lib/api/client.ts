type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const send = async <T>(method: Method, path: string, body?: unknown): Promise<T> => {
	const res = await fetch(path, {
		method,
		headers: body !== undefined ? { "content-type": "application/json" } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `${method} ${path} failed with ${res.status}`);
	}
	if (res.status === 204) return undefined as T;
	const ct = res.headers.get("content-type") ?? "";
	return ct.includes("application/json") ? ((await res.json()) as T) : (undefined as T);
};

export const api = {
	get: <T>(path: string) => send<T>("GET", path),
	post: <T>(path: string, body?: unknown) => send<T>("POST", path, body),
	patch: <T>(path: string, body?: unknown) => send<T>("PATCH", path, body),
	put: <T>(path: string, body?: unknown) => send<T>("PUT", path, body),
	delete: <T>(path: string) => send<T>("DELETE", path)
};

const pending = new Map<string, ReturnType<typeof setTimeout>>();

export const debounceSync = <T>(key: string, delayMs: number, fn: () => Promise<T>): void => {
	const existing = pending.get(key);
	if (existing) clearTimeout(existing);
	const timer = setTimeout(async () => {
		pending.delete(key);
		try {
			await fn();
		} catch (err) {
			console.error("[sync]", key, err);
		}
	}, delayMs);
	pending.set(key, timer);
};

export const sync = async <T>(fn: () => Promise<T>): Promise<T | null> => {
	try {
		return await fn();
	} catch (err) {
		console.error("[sync]", err);
		return null;
	}
};
