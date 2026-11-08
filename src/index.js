import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { AppShell } from './shell.js';

const app = new Hono();

const DEFAULT_API_ORIGIN = 'https://stpaulsleague.joelheath.net';

function getApiOrigin(c) {
	return (c.env && c.env.API_ORIGIN) ? c.env.API_ORIGIN.replace(/\/$/, '') : DEFAULT_API_ORIGIN;
}

/**
 * Proxy /api/* requests to https://stpaulsleague.joelheath.net/api/*
 * Forwards cookies from the client to the backend API and forwards any
 * refreshed Set-Cookie headers back to the client.
 */
app.all('/api/*', async (c) => {
	const origin = getApiOrigin(c);
	const incomingUrl = new URL(c.req.url);
	const targetUrl = `${origin}${incomingUrl.pathname}${incomingUrl.search}`;
	const isLocalHttp = incomingUrl.protocol === 'http:';

	const headers = new Headers();
	const cookie = c.req.header('cookie');
	if (cookie) headers.set('cookie', cookie);

	const contentType = c.req.header('content-type');
	if (contentType) headers.set('content-type', contentType);

	const accept = c.req.header('accept');
	if (accept) headers.set('accept', accept);

	const method = c.req.method;
	const init = {
		method,
		headers,
		redirect: 'manual'
	};

	if (method !== 'GET' && method !== 'HEAD') {
		init.body = await c.req.arrayBuffer();
	}

	try {
		const upstream = await fetch(targetUrl, init);
		const responseHeaders = new Headers();

		const upstreamContentType = upstream.headers.get('content-type');
		if (upstreamContentType) {
			responseHeaders.set('content-type', upstreamContentType);
		}
		responseHeaders.set('cache-control', 'no-store');

		// Forward Set-Cookie headers (e.g. when the backend refreshes an expired 15m JWT)
		const setCookies =
			typeof upstream.headers.getSetCookie === 'function'
				? upstream.headers.getSetCookie()
				: upstream.headers.get('set-cookie')
				? [upstream.headers.get('set-cookie')]
				: [];

		for (const rawCookie of setCookies) {
			let adapted = rawCookie.replace(/;\s*Domain=[^;]+/gi, '');
			if (isLocalHttp) {
				adapted = adapted.replace(/;\s*Secure/gi, '');
			}
			responseHeaders.append('set-cookie', adapted);
		}

		return new Response(upstream.body, {
			status: upstream.status,
			headers: responseHeaders
		});
	} catch (err) {
		return c.json({ message: "Failed to reach St Paul's League API", error: err.message }, 502);
	}
});

/**
 * Auth routes:
 * 1. /auth/google/login redirects to the main backend OAuth flow with ?return_to=
 * 2. /auth/token-callback receives the signed JWT handoff from the backend and sets
 *    the HttpOnly auth_token cookie on this worker's domain.
 * 3. /auth/logout clears the cookie on this domain and logs out upstream.
 */
app.get('/auth/google/login', (c) => {
	const origin = getApiOrigin(c);
	const incomingUrl = new URL(c.req.url);
	const returnTo = `${incomingUrl.origin}/auth/token-callback`;
	const loginUrl = new URL(`${origin}/auth/google/login`);
	loginUrl.searchParams.set('return_to', returnTo);
	return c.redirect(loginUrl.toString());
});

app.get('/auth/token-callback', (c) => {
	const token = c.req.query('token');
	const incomingUrl = new URL(c.req.url);
	if (token) {
		setCookie(c, 'auth_token', token, {
			path: '/',
			secure: incomingUrl.protocol === 'https:',
			httpOnly: true,
			maxAge: 60 * 60 * 24 * 30, // 30 days matching main site
			sameSite: 'Lax'
		});
	}
	return c.redirect('/');
});

app.get('/auth/logout', async (c) => {
	const origin = getApiOrigin(c);
	const cookie = c.req.header('cookie');
	if (cookie) {
		try {
			await fetch(`${origin}/auth/logout`, {
				headers: { cookie },
				redirect: 'manual'
			});
		} catch {
			// Ignore upstream logout network errors
		}
	}
	deleteCookie(c, 'auth_token', { path: '/' });
	return c.redirect('/');
});

/**
 * Render the Mobile App Shell for all main navigation routes
 */
const APP_ROUTES = ['/', '/table', '/fixtures', '/seasons', '/profile'];

for (const route of APP_ROUTES) {
	app.get(route, (c) => {
		return c.html(<AppShell canonicalPath={c.req.path} />);
	});
}

app.notFound((c) => {
	if (c.req.path.startsWith('/api/')) {
		return c.json({ message: 'Not Found' }, 404);
	}
	return c.html(<AppShell canonicalPath="/" />);
});

export default app;
