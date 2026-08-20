import { CONFIG } from '../config.js';
import { AuthService } from './auth.js';
import { LocalBackend } from './localBackend.js';

/**
 * The single HTTP boundary.
 *
 * Guest requests never leave the browser: they are dispatched to LocalBackend, which implements
 * the same routes against localStorage. Every caller above this layer is written once and works
 * in both modes, which is why the page modules contain no `isGuest()` branching at all.
 */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** True for the statuses a caller might reasonably retry or re-authenticate through. */
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  get isQuotaError() {
    return this.status === 429;
  }
}

async function request(method, endpoint, body) {
  if (AuthService.isGuest()) {
    // Resolved locally; the network is never touched.
    return LocalBackend.handle(method, endpoint, body ?? null);
  }

  const token = await AuthService.getToken();

  if (!token) {
    throw new ApiError('You are not signed in.', 401, null);
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';

  let response;

  try {
    response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    // fetch only rejects for transport failures — DNS, CORS, offline. Naming that distinctly
    // stops "server is down" being reported as a generic error the user cannot act on.
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, cause);
  }

  // 204 and other empty bodies are legitimate; parsing them as JSON would throw.
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ??
      (response.status === 401
        ? 'Your session expired. Please sign in again.'
        : `Request failed (${response.status}).`);

    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export const Api = {
  get: (endpoint) => request('GET', endpoint),
  post: (endpoint, body) => request('POST', endpoint, body ?? {}),
  put: (endpoint, body) => request('PUT', endpoint, body ?? {}),
  delete: (endpoint) => request('DELETE', endpoint),
};

/** Unwraps the `{ success, data }` envelope, raising the server's message on failure. */
export function unwrap(response) {
  if (response && typeof response === 'object' && 'success' in response) {
    if (!response.success) throw new ApiError(response.message ?? 'Request failed.', 400, response);
    return response.data;
  }

  return response;
}
