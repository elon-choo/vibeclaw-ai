import { createInterface } from 'node:readline';
import { ui } from '../ui.js';
import type { Message } from '@vibeclaw-ai/providers';

export async function chat(): Promise<void> {
  const { CodexProvider } = await import('@vibeclaw-ai/providers');
  const { buildSystemContext, loadVibeClawConfig } = await import('@vibeclaw-ai/workspace');
  const { getValidToken, authenticateOAuth } = await import('@vibeclaw-ai/auth');

  // Ensure authenticated
  const tokens = await getValidToken();
  if (!tokens) {
    ui.warn('Not authenticated. Starting OAuth flow...');
    await authenticateOAuth();
  }

  const config = await loadVibeClawConfig();
  const systemContext = await buildSystemContext();
  const provider = new CodexProvider();
  const history: Message[] = [];

  ui.banner();
  ui.info(`Chatting with ${config.agentName ?? 'VibeClaw AI'} (${config.defaultModel ?? 'gpt-5.1-codex-mini'})`);
  ui.dim('Type /quit to exit, /clear to reset history\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[36m> \x1b[0m',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/quit' || input === '/exit') {
      ui.dim('Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (input === '/clear') {
      history.length = 0;
      ui.success('History cleared');
      rl.prompt();
      return;
    }

    history.push({ role: 'user', content: input });

    // Keep history manageable
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    try {
      const result = await provider.complete({
        model: config.defaultModel,
        systemPrompt: systemContext || undefined,
        messages: history,
      });

      const response = result.text || '(no response)';
      history.push({ role: 'assistant', content: response });

      console.log(`\n\x1b[33m${config.agentName ?? 'VibeClaw AI'}:\x1b[0m ${response}\n`);

      if (result.usage) {
        ui.dim(`tokens: ${result.usage.inputTokens}in / ${result.usage.outputTokens}out`);
      }
    } catch (e) {
      ui.error((e as Error).message);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
