import { ui, prompt, confirm, spinner } from '../ui.js';

/**
 * `vibeclaw-ai onboard` - Interactive setup wizard.
 *
 * Steps:
 * 1. Check Node.js version
 * 2. Initialize workspace (AGENTS.md, SOUL.md, MEMORY.md, ...)
 * 3. ChatGPT OAuth login
 * 4. Optional: Telegram bot setup
 * 5. Initialize proxy config
 * 6. Show success summary
 */
export async function onboard(): Promise<void> {
  ui.banner();
  ui.header('Welcome to VibeClaw AI Setup');
  ui.dim('This wizard will set up everything you need.\n');

  const TOTAL_STEPS = 5;

  // ─── Step 1: Check environment ───────────────────────────────
  ui.step(1, TOTAL_STEPS, 'Checking environment...');

  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);

  if (major < 22) {
    ui.error(`Node.js ${nodeVersion} detected. VibeClaw AI requires Node.js >= 22.`);
    ui.info('Install: https://nodejs.org/ or use nvm: nvm install 22');
    process.exit(1);
  }

  ui.success(`Node.js ${nodeVersion}`);
  ui.success(`Platform: ${process.platform} ${process.arch}`);

  // ─── Step 2: Initialize workspace ────────────────────────────
  ui.step(2, TOTAL_STEPS, 'Setting up workspace...');

  const { initWorkspace, isInitialized, loadVibeClawConfig, saveVibeClawConfig } =
    await import('@vibeclaw-ai/workspace');

  if (isInitialized()) {
    ui.warn('Workspace already exists. Keeping existing files.');
  }

  const { created, skipped } = await initWorkspace();

  if (created.length > 0) {
    ui.success(`Created: ${created.join(', ')}`);
  }
  if (skipped.length > 0) {
    ui.dim(`Skipped (already exist): ${skipped.join(', ')}`);
  }

  // Ask for agent name
  const config = await loadVibeClawConfig();
  const agentName = await prompt('Agent name', config.agentName ?? 'VibeClaw AI');
  if (agentName !== config.agentName) {
    await saveVibeClawConfig({ agentName });
  }

  // ─── Step 3: ChatGPT OAuth ──────────────────────────────────
  ui.step(3, TOTAL_STEPS, 'Authenticating with ChatGPT...');

  const { getValidToken, authenticateOAuth } = await import('@vibeclaw-ai/auth');
  const existingToken = await getValidToken();

  if (existingToken) {
    const remaining = Math.max(0, Math.round((existingToken.expires_at - Date.now()) / 60000));
    ui.success(`Already authenticated (${remaining}min remaining)`);
  } else {
    const doAuth = await confirm('Open browser for ChatGPT login?');
    if (doAuth) {
      ui.info('Opening browser... Complete the login in the browser window.');
      const s = spinner('Waiting for authentication...');
      try {
        const tokens = await authenticateOAuth();
        s.stop(true, 'Authentication successful!');
        const remaining = Math.max(0, Math.round((tokens.expires_at - Date.now()) / 60000));
        ui.dim(`Token valid for ${remaining} minutes`);
      } catch (e) {
        s.stop(false, 'Authentication failed');
        ui.error((e as Error).message);
        ui.info('You can retry later with: vibeclaw-ai auth login');
      }
    } else {
      ui.warn('Skipped. Run `vibeclaw-ai auth login` later.');
    }
  }

  // ─── Step 4: Telegram bot (optional) ─────────────────────────
  ui.step(4, TOTAL_STEPS, 'Telegram bot setup (optional)...');

  const setupTelegram = await confirm('Set up Telegram bot?', false);
  if (setupTelegram) {
    ui.info('Get a bot token from @BotFather: https://t.me/BotFather');
    const botToken = await prompt('Bot token');
    if (botToken) {
      const { saveConfig } = await import('@vibeclaw-ai/auth');
      await saveConfig({ telegramBotToken: botToken });
      await saveVibeClawConfig({ telegramBotToken: botToken });
      ui.success('Telegram bot token saved');
    } else {
      ui.warn('No token provided. Skipped.');
    }
  } else {
    ui.dim('Skipped. Run `vibeclaw-ai telegram setup` later.');
  }

  // ─── Step 5: Proxy config ───────────────────────────────────
  ui.step(5, TOTAL_STEPS, 'Configuring proxy...');

  const { saveProxyConfig, DEFAULT_CONFIG } = await import('@vibeclaw-ai/proxy');
  await saveProxyConfig(DEFAULT_CONFIG);
  ui.success(`Proxy config saved (port: ${DEFAULT_CONFIG.port})`);

  // ─── Summary ────────────────────────────────────────────────
  ui.divider();
  ui.header(`  ${agentName} is ready!\n`);

  ui.summary([
    { label: 'Workspace', value: '~/.vibeclaw-ai/workspace/' },
    { label: 'Config', value: '~/.vibeclaw-ai/vibeclaw-ai.json' },
    { label: 'Proxy', value: `127.0.0.1:${DEFAULT_CONFIG.port}` },
    { label: 'Auth', value: existingToken || !!(await getValidToken()) ? 'Authenticated' : 'Not set' },
    { label: 'Telegram', value: setupTelegram ? 'Configured' : 'Not set' },
  ]);

  console.log('');
  ui.header('  Next steps:');
  ui.info('vibeclaw-ai chat        - Start chatting');
  ui.info('vibeclaw-ai proxy start - Start the API proxy');
  ui.info('vibeclaw-ai telegram    - Launch Telegram bot');
  ui.dim('Edit ~/.vibeclaw-ai/workspace/AGENTS.md to customize behavior');
  console.log('');
}
