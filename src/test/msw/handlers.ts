import { http, type HttpHandler } from 'msw';

import { apiUrl } from './base-url';
import { envelope, pagedEnvelope } from './responses';

/**
 * A `Response` body is a single-use stream. Handlers must therefore build a
 * fresh one per request — a react-query refetch against a shared instance fails
 * with "Body has already been consumed". Every helper here takes a factory (or
 * a plain value it wraps in one) so the eager form is not expressible.
 */
type ResponseFactory = () => Response | Promise<Response>;

/** `GET <api>/<path>` answering with a `{ success: true, value }` envelope. */
export const getJson = <T>(path: string, value: T): HttpHandler => http.get(apiUrl(path), () => envelope(value));

/** `GET <api>/<path>` answering with a raw paged list envelope. */
export const getPaged = <T>(path: string, values: T[]): HttpHandler =>
    http.get(apiUrl(path), () => pagedEnvelope(values));

export const postJson = <T>(path: string, value: T): HttpHandler => http.post(apiUrl(path), () => envelope(value));

export const putJson = <T>(path: string, value: T): HttpHandler => http.put(apiUrl(path), () => envelope(value));

export const deleteJson = <T>(path: string, value: T): HttpHandler => http.delete(apiUrl(path), () => envelope(value));

/**
 * Any method, arbitrary response — for error paths and one-off shapes.
 * `build` runs per request, so the response is always fresh.
 */
export const respond = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    build: ResponseFactory,
): HttpHandler => http[method](apiUrl(path), () => build());

/**
 * Registered on the server by default. Deliberately tiny: tests declare the
 * endpoints they care about via `server.use(...)`, and anything unhandled fails
 * loudly rather than silently resolving.
 */
export const defaultHandlers: HttpHandler[] = [];
