import { getValidToken, authenticateOAuth, loadConfig } from '@vibeclaw-ai/auth';
import type { Provider, CompletionOptions, CompletionResult } from './types.js';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Gemini Provider - uses Google Gemini API via OAuth or API key.
 * Supports Google OAuth login (same as Gemini CLI) or direct API key.
 */
export class GeminiProvider implements Provider {
  name = 'gemini';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const model = options.model ?? DEFAULT_MODEL;

    // Build request
    const contents = options.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 4096,
      },
    };

    if (options.systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    // Determine auth method
    let url: string;
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'vibeclaw-ai/0.1.0',
    };

    if (this.apiKey) {
      url = `${GEMINI_API}/${model}:generateContent?key=${this.apiKey}`;
    } else {
      // Try API key from config
      const config = await loadConfig();
      if (config.geminiApiKey) {
        url = `${GEMINI_API}/${model}:generateContent?key=${config.geminiApiKey}`;
      } else {
        // Try OAuth token
        const tokens = await getValidToken('gemini') ?? await authenticateOAuth('gemini');
        url = `${GEMINI_API}/${model}:generateContent`;
        headers['Authorization'] = `Bearer ${tokens.access_token}`;
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${text.substring(0, 300)}`);
    }

    const result = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const text = result.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      .join('') ?? '';

    return {
      text,
      usage: {
        inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
