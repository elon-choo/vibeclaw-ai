import { randomBytes, createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import open from 'open';
import {
  PROVIDER_CONFIGS,
  type AuthProvider,
  type OAuthProviderConfig,
} from './constants.js';
import { loadProviderToken, saveProviderTokens, loadTokens, saveTokens } from './store.js';
import type { StoredTokens, OAuthTokenResponse } from './types.js';

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function buildAuthUrl(config: OAuthProviderConfig, challenge: string, state: string): string {
  const params: Record<string, string> = {
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    state,
  };

  if (config.usePKCE) {
    params.code_challenge = challenge;
    params.code_challenge_method = 'S256';
  }

  if (config.audience) {
    params.audience = config.audience;
  }

  if (config.prompt) {
    params.prompt = config.prompt;
  }

  // Extra auth params (e.g., Google's access_type=offline)
  if (config.extraAuthParams) {
    Object.assign(params, config.extraAuthParams);
  }

  return `${config.authEndpoint}?${new URLSearchParams(params).toString()}`;
}

async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  code: string,
  verifier: string,
): Promise<OAuthTokenResponse> {
  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
  };

  if (config.usePKCE) {
    body.code_verifier = verifier;
  }

  if (config.extraTokenParams) {
    Object.assign(body, config.extraTokenParams);
  }

  const res = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${config.label}] Token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<OAuthTokenResponse>;
}

async function refreshAccessToken(
  config: OAuthProviderConfig,
  refreshToken: string,
): Promise<StoredTokens> {
  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  };

  const res = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${config.label}] Token refresh failed (${res.status}): ${text}`);
  }

  const tokenResponse = (await res.json()) as OAuthTokenResponse;
  return toStoredTokens(tokenResponse, config.name);
}

function toStoredTokens(response: OAuthTokenResponse, provider: AuthProvider): StoredTokens {
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    id_token: response.id_token,
    expires_at: Date.now() + (response.expires_in ?? 3600) * 1000,
    token_type: response.token_type,
    scope: response.scope,
    obtained_at: new Date().toISOString(),
    provider,
  };
}

/**
 * Get a valid access token for a specific provider.
 * Refreshes automatically if expiring within 5 minutes.
 */
export async function getValidToken(provider: AuthProvider = 'codex'): Promise<StoredTokens | null> {
  const tokens = await loadProviderToken(provider);

  // Fallback to legacy store for codex
  const effective = tokens ?? (provider === 'codex' ? await loadTokens() : null);
  if (!effective) return null;

  const fiveMinutes = 5 * 60 * 1000;
  if (effective.expires_at && Date.now() > effective.expires_at - fiveMinutes) {
    if (!effective.refresh_token) return null;
    const config = PROVIDER_CONFIGS[provider];
    try {
      const refreshed = await refreshAccessToken(config, effective.refresh_token);
      await saveProviderTokens(provider, refreshed);
      return refreshed;
    } catch {
      return null;
    }
  }

  return effective;
}

/**
 * Run OAuth PKCE browser flow for any provider.
 * Opens the system browser for login.
 */
export async function authenticateOAuth(
  provider: AuthProvider = 'codex',
  timeoutMs = 10 * 60 * 1000,
): Promise<StoredTokens> {
  // Check for existing valid token first
  const existing = await getValidToken(provider);
  if (existing) return existing;

  const config = PROVIDER_CONFIGS[provider];
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString('hex');

  return new Promise<StoredTokens>((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url!, `http://localhost:${config.callbackPort}`);

      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Authentication Failed</h1><p>${error}</p></body></html>`);
          server.close();
          reject(new Error(`[${config.label}] OAuth error: ${error}`));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>State Mismatch</h1></body></html>');
          server.close();
          reject(new Error('State mismatch'));
          return;
        }

        try {
          const tokenResponse = await exchangeCodeForTokens(config, code!, verifier);
          const stored = toStoredTokens(tokenResponse, provider);
          await saveProviderTokens(provider, stored);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#fff"><div style="text-align:center"><h1 style="font-size:3em">VibeClaw AI</h1><p style="color:#4ade80;font-size:1.5em">${config.label} authenticated!</p><p>You can close this window.</p></div></body></html>`);
          server.close();
          resolve(stored);
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Error</h1><p>${(e as Error).message}</p></body></html>`);
          server.close();
          reject(e);
        }
      }
    });

    server.listen(config.callbackPort, async () => {
      const authUrl = buildAuthUrl(config, challenge, state);
      console.log(`[VibeClaw AI] Opening ${config.label} login...`);
      console.log(`[VibeClaw AI] If browser doesn't open, visit: ${authUrl}`);
      try {
        await open(authUrl);
      } catch {
        // Browser may not open in headless env
      }
    });

    setTimeout(() => {
      server.close();
      reject(new Error(`[${config.label}] Authentication timed out (${timeoutMs / 60000} minutes)`));
    }, timeoutMs);
  });
}

/**
 * Get auth status for all providers.
 */
export async function getAllAuthStatus(): Promise<Record<AuthProvider, {
  authenticated: boolean;
  remainingMinutes: number;
}>> {
  const providers: AuthProvider[] = ['codex', 'claude', 'gemini'];
  const result = {} as Record<AuthProvider, { authenticated: boolean; remainingMinutes: number }>;

  for (const p of providers) {
    const tokens = await getValidToken(p);
    result[p] = {
      authenticated: !!tokens,
      remainingMinutes: tokens ? Math.max(0, Math.round((tokens.expires_at - Date.now()) / 60000)) : 0,
    };
  }

  return result;
}
