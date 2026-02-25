import { writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PID_FILE = join(homedir(), '.vibeclaw-ai', 'daemon.pid');

/**
 * Daemon runner - the actual process that runs when the daemon starts.
 * Manages proxy and telegram bot lifecycle.
 */
export async function runDaemon(options: {
  proxy: boolean;
  telegram: boolean;
}): Promise<void> {
  // Write PID file
  await mkdir(join(homedir(), '.vibeclaw-ai'), { recursive: true });
  await writeFile(PID_FILE, String(process.pid), 'utf-8');

  const timestamp = () => new Date().toISOString();
  console.log(`[${timestamp()}] VibeClaw AI daemon started (PID: ${process.pid})`);

  // Start proxy
  if (options.proxy) {
    console.log(`[${timestamp()}] Starting proxy...`);
    try {
      const { ProxyManager } = await import('@vibeclaw-ai/proxy');
      const proxy = new ProxyManager();
      const status = await proxy.start();
      console.log(`[${timestamp()}] Proxy running on port ${status.port}`);
    } catch (e) {
      console.error(`[${timestamp()}] Proxy failed:`, (e as Error).message);
    }
  }

  // Start telegram bot
  if (options.telegram) {
    console.log(`[${timestamp()}] Starting Telegram bot...`);
    try {
      const { loadConfig } = await import('@vibeclaw-ai/auth');
      const config = await loadConfig();
      if (config.telegramBotToken) {
        // Dynamic import to avoid loading grammy when not needed
        const telegramModule = await import('@vibeclaw-ai/telegram');
        telegramModule.startTelegramBot(config.telegramBotToken).catch((e: Error) => {
          console.error(`[${timestamp()}] Telegram bot error:`, e.message);
        });
        console.log(`[${timestamp()}] Telegram bot started`);
      } else {
        console.log(`[${timestamp()}] Telegram bot skipped (no token configured)`);
      }
    } catch (e) {
      console.error(`[${timestamp()}] Telegram failed:`, (e as Error).message);
    }
  }

  // Token refresh loop - check every 30 minutes
  const refreshInterval = setInterval(async () => {
    try {
      const { getValidToken } = await import('@vibeclaw-ai/auth');
      const token = await getValidToken();
      if (token) {
        const remaining = Math.round((token.expires_at - Date.now()) / 60000);
        console.log(`[${timestamp()}] Token OK (${remaining}min remaining)`);
      } else {
        console.log(`[${timestamp()}] Token expired - requires re-authentication`);
      }
    } catch (e) {
      console.error(`[${timestamp()}] Token refresh error:`, (e as Error).message);
    }
  }, 30 * 60 * 1000);

  // Heartbeat log every 5 minutes
  const heartbeatInterval = setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[${timestamp()}] Heartbeat | RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
  }, 5 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log(`[${timestamp()}] Shutting down...`);
    clearInterval(refreshInterval);
    clearInterval(heartbeatInterval);

    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(PID_FILE);
    } catch {
      // PID file may not exist
    }

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Keep process alive
  console.log(`[${timestamp()}] Daemon ready. Services: ${[options.proxy && 'proxy', options.telegram && 'telegram'].filter(Boolean).join(', ') || 'none'}`);
}
