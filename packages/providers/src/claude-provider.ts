import { getValidToken, authenticateOAuth, loadConfig } from '@vibeclaw-ai/auth';
import type { Provider, CompletionOptions, CompletionResult } from './types.js';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Claude Provider - uses Anthropic API via OAuth or API key.
 * Supports Claude OAuth login (same as Claude Code) or direct API key.
 */
export class ClaudeProvider implements Provider {
  name = 'claude';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    // Try OAuth token first, then API key
    let authHeader: string;

    if (this.apiKey) {
      authHeader = this.apiKey;
    } else {
      const tokens = await getValidToken('claude');
      if (tokens) {
        authHeader = tokens.access_token;
      } else {
        // Try API key from config
        const config = await loadConfig();
        if (config.anthropicApiKey) {
          authHeader = config.anthropicApiKey;
        } else {
          // Trigger OAuth flow
          const newTokens = await authenticateOAuth('claude');
          authHeader = newTokens.access_token;
        }
      }
    }

    const messages = options.messages.map(m => ({
      role: m.role === 'system' ? 'user' as const : m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authHeader,
        'anthropic-version': '2024-01-01',
        'User-Agent': 'vibeclaw-ai/0.1.0',
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: options.maxTokens ?? 4096,
        system: options.systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      // If x-api-key fails, try Bearer token (OAuth)
      if (res.status === 401 && !this.apiKey) {
        return this.completeWithBearer(authHeader, options);
      }
      const text = await res.text();
      throw new Error(`Claude API error (${res.status}): ${text.substring(0, 300)}`);
    }

    const result = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = result.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text)
      .join('') ?? '';

    return {
      text,
      usage: {
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      },
    };
  }

  private async completeWithBearer(
    token: string,
    options: CompletionOptions,
  ): Promise<CompletionResult> {
    const messages = options.messages.map(m => ({
      role: m.role === 'system' ? 'user' as const : m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'anthropic-version': '2024-01-01',
        'User-Agent': 'vibeclaw-ai/0.1.0',
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: options.maxTokens ?? 4096,
        system: options.systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude API error (${res.status}): ${text.substring(0, 300)}`);
    }

    const result = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = result.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text)
      .join('') ?? '';

    return {
      text,
      usage: {
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      },
    };
  }
}
