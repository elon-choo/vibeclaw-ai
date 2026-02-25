import { ui, confirm } from '../ui.js';

export async function daemonInstall(): Promise<void> {
  const { install, load } = await import('@vibeclaw-ai/daemon');

  ui.info('Installing LaunchAgent...');
  const plistPath = await install();
  ui.success(`Plist created: ${plistPath}`);

  const startNow = await confirm('Start daemon now?');
  if (startNow) {
    load();
    ui.success('Daemon started');
  }
}

export async function daemonStart(): Promise<void> {
  const { install, load, isRunning } = await import('@vibeclaw-ai/daemon');

  if (isRunning()) {
    ui.warn('Daemon is already running');
    return;
  }

  // Ensure plist exists
  await install();
  load();
  ui.success('Daemon started');
}

export async function daemonStop(): Promise<void> {
  const { unload, isRunning } = await import('@vibeclaw-ai/daemon');

  if (!isRunning()) {
    ui.warn('Daemon is not running');
    return;
  }

  unload();
  ui.success('Daemon stopped');
}

export async function daemonStatus(): Promise<void> {
  const { getStatus } = await import('@vibeclaw-ai/daemon');
  const status = await getStatus();

  if (!status.installed) {
    ui.warn('Daemon not installed. Run: vibeclaw-ai daemon install');
    return;
  }

  ui.summary([
    { label: 'Installed', value: status.installed ? 'Yes' : 'No' },
    { label: 'Running', value: status.running ? `Yes (PID: ${status.pid})` : 'No' },
    { label: 'Logs', value: status.logPath },
  ]);
}

export async function daemonLogs(): Promise<void> {
  const { readLogs } = await import('@vibeclaw-ai/daemon');
  const logs = await readLogs(30);
  console.log(logs);
}

export async function daemonUninstall(): Promise<void> {
  const doIt = await confirm('Remove daemon LaunchAgent?', false);
  if (!doIt) return;

  const { uninstall } = await import('@vibeclaw-ai/daemon');
  await uninstall();
  ui.success('Daemon uninstalled');
}

export async function daemonRun(args: string[]): Promise<void> {
  // This is called by the LaunchAgent, not by users directly
  const { runDaemon } = await import('@vibeclaw-ai/daemon');
  await runDaemon({
    proxy: args.includes('--proxy'),
    telegram: args.includes('--telegram'),
  });
}
