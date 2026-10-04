import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.ico': 'image/x-icon',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain',
	'.woff2': 'font/woff2'
};

async function resolveFile(dir: string, pathname: string): Promise<string | null> {
	const base = join(dir, decodeURIComponent(pathname));
	for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) {
		try {
			if ((await stat(candidate)).isFile()) return candidate;
		} catch {
			// Try the next candidate.
		}
	}
	return null;
}

/**
 * Serves a build directory the way GitHub Pages does: `/page` finds `page.html`, and unknown
 * paths get `404.html` with a 404 status. Unlike `vite preview`, nothing is rendered on the fly.
 * Resolves to the server's origin and a function that stops it.
 */
export async function serveStatic(
	dir: string
): Promise<{ origin: string; close: () => Promise<void> }> {
	const server = createServer(async (req, res) => {
		const file = await resolveFile(dir, new URL(req.url ?? '/', 'http://x').pathname);
		const notFound = file ? null : await resolveFile(dir, '/404.html');
		const served = file ?? notFound;
		if (!served) return res.writeHead(404).end();
		res.writeHead(file ? 200 : 404, {
			'content-type': TYPES[extname(served)] ?? 'application/octet-stream',
			'cache-control': 'no-cache'
		});
		res.end(await readFile(served));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	return {
		origin: `http://127.0.0.1:${port}`,
		close: () => new Promise((resolve) => server.close(() => resolve()))
	};
}
