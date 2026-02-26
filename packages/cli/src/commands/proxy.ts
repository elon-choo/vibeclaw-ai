import { ui, spinner } from '../ui.js';

export async function proxyStart(): Promise<void> {
  const { ProxyManager } = await import('@vibepity/proxy');
  const manager = new ProxyManager();

  const s = spinner('Starting proxy...');
  try {
    const status = await manager.start();
    s.stop(true, `Proxy running on 127.0.0.1:${status.port} (PID: ${status.pid})`);
    ui.info('Set ANTHROPIC_BASE_URL=http://127.0.0.1:8317 to use with Claude Code');
  } catch (e) {
    s.stop(false, 'Failed to start proxy');
    ui.error((e as Error).message);
    process.exit(1);
  }
}

export async function proxyStop(): Promise<void> {
  const { ProxyManager } = await import('@vibepity/proxy');
  const manager = new ProxyManager();

  await manager.stop();
  ui.success('Proxy stopped');
}

export async function proxyStatus(): Promise<void> {
  const { ProxyManager } = await import('@vibepity/proxy');
  const manager = new ProxyManager();

  const status = await manager.status();
  if (status.running) {
    ui.success(`Running on port ${status.port} (PID: ${status.pid})`);
    if (status.uptime) {
      const mins = Math.round(status.uptime / 60000);
      ui.dim(`Uptime: ${mins}min`);
    }
    const healthy = await manager.healthCheck();
    ui.dim(`Health: ${healthy ? 'OK' : 'UNHEALTHY'}`);
  } else {
    ui.warn('Proxy is not running. Start with: vibepity proxy start');
  }
}
