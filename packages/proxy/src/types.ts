export interface ProxyConfig {
  /** Proxy listen port (default: 8317) */
  port: number;
  /** Codex OAuth callback port (default: 1455) */
  oauthPort: number;
  /** Model routing rules */
  routes: ProxyRoute[];
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ProxyRoute {
  /** Model prefix pattern (e.g., "gpt-*", "claude-*") */
  pattern: string;
  /** Target backend */
  backend: ProxyBackend;
}

export interface ProxyBackend {
  /** Display name */
  name: string;
  /** Backend base URL */
  url: string;
  /** Auth method */
  auth: 'codex-oauth' | 'api-key' | 'claude-oauth' | 'gemini-oauth';
  /** API key env var name (for api-key auth) */
  apiKeyEnv?: string;
}

export interface ProxyStatus {
  running: boolean;
  pid?: number;
  port?: number;
  uptime?: number;
  version?: string;
}

export const DEFAULT_CONFIG: ProxyConfig = {
  port: 8317,
  oauthPort: 1455,
  routes: [
    {
      pattern: 'gpt-*',
      backend: {
        name: 'codex',
        url: 'https://chatgpt.com/backend-api/codex/responses',
        auth: 'codex-oauth',
      },
    },
    {
      pattern: 'openai/*',
      backend: {
        name: 'openai-api',
        url: 'https://api.openai.com/v1',
        auth: 'api-key',
        apiKeyEnv: 'OPENAI_API_KEY',
      },
    },
    {
      pattern: 'claude-*',
      backend: {
        name: 'claude',
        url: 'https://api.anthropic.com/v1/messages',
        auth: 'claude-oauth',
      },
    },
    {
      pattern: 'gemini-*',
      backend: {
        name: 'gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/models',
        auth: 'gemini-oauth',
      },
    },
  ],
  logLevel: 'info',
};
