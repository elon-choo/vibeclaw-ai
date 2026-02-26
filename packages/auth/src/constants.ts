/** Supported auth providers */
export type AuthProvider = 'codex' | 'claude' | 'gemini';

/** Provider-specific OAuth configuration */
export interface OAuthProviderConfig {
  name: AuthProvider;
  label: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  callbackPort: number;
  redirectUri: string;
  scopes: string;
  audience?: string;
  prompt?: string;
  /** Extra params for auth URL */
  extraAuthParams?: Record<string, string>;
  /** Extra params for token exchange */
  extraTokenParams?: Record<string, string>;
  /** Whether to use PKCE */
  usePKCE: boolean;
}

/**
 * OpenAI Codex OAuth - uses ChatGPT subscription ($0)
 * Calls chatgpt.com/backend-api/codex/responses
 */
export const CODEX_OAUTH: OAuthProviderConfig = {
  name: 'codex',
  label: 'ChatGPT (Codex)',
  clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
  authEndpoint: 'https://auth.openai.com/oauth/authorize',
  tokenEndpoint: 'https://auth.openai.com/oauth/token',
  callbackPort: 1455,
  redirectUri: 'http://localhost:1455/auth/callback',
  scopes: 'openid profile email offline_access',
  audience: 'https://api.openai.com/v1',
  prompt: 'login',
  usePKCE: true,
};

/**
 * Claude OAuth - uses console.anthropic.com
 * Reference: Claude Code uses this flow for claude-cli auth
 */
export const CLAUDE_OAUTH: OAuthProviderConfig = {
  name: 'claude',
  label: 'Claude (Anthropic)',
  clientId: '9d1c250a-e61b-44b0-b7e0-5f6803de7610',
  authEndpoint: 'https://auth.anthropic.com/oauth/authorize',
  tokenEndpoint: 'https://auth.anthropic.com/oauth/token',
  callbackPort: 1456,
  redirectUri: 'http://localhost:1456/auth/callback',
  scopes: 'openid profile email offline_access',
  audience: 'https://api.anthropic.com',
  usePKCE: true,
};

/**
 * Gemini OAuth - uses Google OAuth2 for Gemini API access
 * Reference: Gemini CLI uses Google's OAuth flow
 */
export const GEMINI_OAUTH: OAuthProviderConfig = {
  name: 'gemini',
  label: 'Gemini (Google)',
  clientId: '936475272427.apps.googleusercontent.com',
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  callbackPort: 1457,
  redirectUri: 'http://localhost:1457/auth/callback',
  scopes: 'openid profile email https://www.googleapis.com/auth/generative-language',
  extraAuthParams: { access_type: 'offline', prompt: 'consent' },
  usePKCE: true,
};

/** All provider configs indexed by name */
export const PROVIDER_CONFIGS: Record<AuthProvider, OAuthProviderConfig> = {
  codex: CODEX_OAUTH,
  claude: CLAUDE_OAUTH,
  gemini: GEMINI_OAUTH,
};

/** Legacy compat */
export const OAUTH_CONFIG = CODEX_OAUTH;

export const AUTH_DIR_NAME = '.vibepity';
export const AUTH_FILE_NAME = 'auth.json';
export const CONFIG_FILE_NAME = 'config.json';
