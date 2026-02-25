import type { AuthProvider } from './constants.js';

export interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_at: number;
  token_type: string;
  scope?: string;
  obtained_at: string;
  /** Which provider this token belongs to */
  provider?: AuthProvider;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface AuthConfig {
  telegramBotToken?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  model?: string;
  /** Default provider for chat */
  defaultProvider?: AuthProvider;
}

/** Multi-provider token store */
export interface MultiProviderTokens {
  codex?: StoredTokens;
  claude?: StoredTokens;
  gemini?: StoredTokens;
}
