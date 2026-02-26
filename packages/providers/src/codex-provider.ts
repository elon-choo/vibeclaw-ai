import { getValidToken, authenticateOAuth } from '@vibepity/auth';
import type { Provider, CompletionOptions, CompletionResult } from './types.js';

const CODEX_BACKEND = 'https://chatgpt.com/backend-api/codex/responses';
const DEFAULT_MODEL = 'gpt-5.1-codex-mini';

/**
 * Codex Backend Provider - uses ChatGPT subscription via OAuth.
 * Calls chatgpt.com/backend-api/codex/responses (stream: true required).
 */
export class CodexProvider implements Provider {
  name = 'codex';

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const tokens = await getValidToken() ?? await authenticateOAuth();

    const requestBody = {
      model: options.model ?? DEFAULT_MODEL,
      instructions: options.systemPrompt ?? 'You are Vibepity, a helpful AI assistant. Be concise and helpful. Respond in the same language as the user.',
      input: options.messages,
      store: false,
      stream: true,
      reasoning: { summary: 'auto' },
    };

    const res = await fetch(CODEX_BACKEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.access_token}`,
        'User-Agent': 'vibepity/0.1.0',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        throw new Error('Rate limited. Please wait and try again.');
      }
      throw new Error(`Codex backend error (${res.status}): ${text.substring(0, 300)}`);
    }

    return this.processStream(res);
  }

  private async processStream(res: Response): Promise<CompletionResult> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);

          if (parsed.type === 'response.output_text.delta') {
            fullText += parsed.delta ?? '';
          }

          if (parsed.type === 'response.completed') {
            const usage = parsed.response?.usage;
            if (usage) {
              inputTokens = usage.input_tokens ?? 0;
              outputTokens = usage.output_tokens ?? 0;
            }
          }

          // Chat Completions format fallback
          if (parsed.choices?.[0]?.delta?.content) {
            fullText += parsed.choices[0].delta.content;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    return {
      text: fullText,
      usage: { inputTokens, outputTokens },
    };
  }
}
