import { ui, prompt, confirm, spinner } from '../ui.js';

/**
 * `vibepity onboard` - Interactive setup wizard.
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
  ui.header('Welcome to Vibepity Setup');
  ui.dim('This wizard will set up everything you need.\n');

  const TOTAL_STEPS = 5;

  // ─── Step 1: Check environment ───────────────────────────────
  ui.step(1, TOTAL_STEPS, 'Checking environment...');

  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);

  if (major < 22) {
    ui.error(`Node.js ${nodeVersion} detected. Vibepity requires Node.js >= 22.`);
    ui.info('Install: https://nodejs.org/ or use nvm: nvm install 22');
    process.exit(1);
  }

  ui.success(`Node.js ${nodeVersion}`);
  ui.success(`Platform: ${process.platform} ${process.arch}`);

  // ─── Step 2: Initialize workspace ────────────────────────────
  ui.step(2, TOTAL_STEPS, 'Setting up workspace...');

  const { initWorkspace, isInitialized, loadVibepityConfig, saveVibepityConfig } =
    await import('@vibepity/workspace');

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
  const config = await loadVibepityConfig();
  const agentName = await prompt('Agent name', config.agentName ?? 'Vibepity');
  if (agentName !== config.agentName) {
    await saveVibepityConfig({ agentName });
  }

  // ─── Step 3: ChatGPT OAuth ──────────────────────────────────
  ui.step(3, TOTAL_STEPS, 'Authenticating with ChatGPT...');

  const { getValidToken, authenticateOAuth } = await import('@vibepity/auth');
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
        ui.info('You can retry later with: vibepity auth login');
      }
    } else {
      ui.warn('Skipped. Run `vibepity auth login` later.');
    }
  }

  // ─── Step 4: Telegram bot (optional) ─────────────────────────
  ui.step(4, TOTAL_STEPS, 'Telegram bot setup (optional)...');

  const setupTelegram = await confirm('Set up Telegram bot?', false);
  if (setupTelegram) {
    ui.info('Get a bot token from @BotFather: https://t.me/BotFather');
    const botToken = await prompt('Bot token');
    if (botToken) {
      const { saveConfig } = await import('@vibepity/auth');
      await saveConfig({ telegramBotToken: botToken });
      await saveVibepityConfig({ telegramBotToken: botToken });
      ui.success('Telegram bot token saved');
    } else {
      ui.warn('No token provided. Skipped.');
    }
  } else {
    ui.dim('Skipped. Run `vibepity telegram setup` later.');
  }

  // ─── Step 5: Proxy config ───────────────────────────────────
  ui.step(5, TOTAL_STEPS, 'Configuring proxy...');

  const { saveProxyConfig, DEFAULT_CONFIG } = await import('@vibepity/proxy');
  await saveProxyConfig(DEFAULT_CONFIG);
  ui.success(`Proxy config saved (port: ${DEFAULT_CONFIG.port})`);

  // ─── Summary ────────────────────────────────────────────────
  ui.divider();
  ui.header(`  ${agentName} is ready!\n`);

  ui.summary([
    { label: 'Workspace', value: '~/.vibepity/workspace/' },
    { label: 'Config', value: '~/.vibepity/vibepity.json' },
    { label: 'Proxy', value: `127.0.0.1:${DEFAULT_CONFIG.port}` },
    { label: 'Auth', value: existingToken || !!(await getValidToken()) ? 'Authenticated' : 'Not set' },
    { label: 'Telegram', value: setupTelegram ? 'Configured' : 'Not set' },
  ]);

  console.log('');
  ui.header('  Next steps:');
  ui.info('vibepity chat        - Start chatting');
  ui.info('vibepity proxy start - Start the API proxy');
  ui.info('vibepity telegram    - Launch Telegram bot');
  ui.dim('Edit ~/.vibepity/workspace/AGENTS.md to customize behavior');
  console.log('');
}
