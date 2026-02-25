import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BUNDLE_ID = 'com.vibeclaw-ai.daemon';
const PLIST_DIR = join(homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = join(PLIST_DIR, `${BUNDLE_ID}.plist`);
const LOG_DIR = join(homedir(), '.vibeclaw-ai', 'logs');
const PID_FILE = join(homedir(), '.vibeclaw-ai', 'daemon.pid');

export interface DaemonConfig {
  /** Path to the vibeclaw-ai CLI binary */
  cliBinary: string;
  /** Start proxy on daemon launch */
  startProxy: boolean;
  /** Start telegram bot on daemon launch */
  startTelegram: boolean;
  /** Keep alive (restart on crash) */
  keepAlive: boolean;
  /** Run at load (start on login) */
  runAtLoad: boolean;
}

const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  cliBinary: 'vibeclaw-ai',
  startProxy: true,
  startTelegram: false,
  keepAlive: true,
  runAtLoad: true,
};

/**
 * Generate the LaunchAgent plist XML.
 */
function buildPlist(config: DaemonConfig): string {
  // Find node path
  let nodePath: string;
  try {
    nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
  } catch {
    nodePath = '/usr/local/bin/node';
  }

  // Find vibeclaw-ai CLI path
  let cliBinary = config.cliBinary;
  if (cliBinary === 'vibeclaw-ai') {
    try {
      cliBinary = execSync('which vibeclaw-ai', { encoding: 'utf-8' }).trim();
    } catch {
      // Use npx fallback
      cliBinary = join(homedir(), '.vibeclaw-ai', 'node_modules', '.bin', 'vibeclaw-ai');
    }
  }

  const args: string[] = ['daemon', 'run'];
  if (config.startProxy) args.push('--proxy');
  if (config.startTelegram) args.push('--telegram');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${BUNDLE_ID}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${cliBinary}</string>
${args.map(a => `        <string>${a}</string>`).join('\n')}
    </array>

    <key>RunAtLoad</key>
    <${config.runAtLoad}/>

    <key>KeepAlive</key>
    <${config.keepAlive}/>

    <key>StandardOutPath</key>
    <string>${join(LOG_DIR, 'daemon-stdout.log')}</string>

    <key>StandardErrorPath</key>
    <string>${join(LOG_DIR, 'daemon-stderr.log')}</string>

    <key>WorkingDirectory</key>
    <string>${homedir()}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${homedir()}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${join(homedir(), '.nvm/versions/node')}</string>
    </dict>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>`;
}

/**
 * Install the LaunchAgent plist.
 */
export async function install(config?: Partial<DaemonConfig>): Promise<string> {
  const fullConfig = { ...DEFAULT_DAEMON_CONFIG, ...config };

  await mkdir(PLIST_DIR, { recursive: true });
  await mkdir(LOG_DIR, { recursive: true });

  const plist = buildPlist(fullConfig);
  await writeFile(PLIST_PATH, plist, 'utf-8');

  return PLIST_PATH;
}

/**
 * Uninstall the LaunchAgent plist.
 */
export async function uninstall(): Promise<void> {
  // Unload first
  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { encoding: 'utf-8' });
  } catch {
    // May not be loaded
  }

  if (existsSync(PLIST_PATH)) {
    await unlink(PLIST_PATH);
  }
}

/**
 * Load (start) the daemon via launchctl.
 */
export function load(): void {
  execSync(`launchctl load "${PLIST_PATH}"`, { encoding: 'utf-8' });
}

/**
 * Unload (stop) the daemon via launchctl.
 */
export function unload(): void {
  execSync(`launchctl unload "${PLIST_PATH}"`, { encoding: 'utf-8' });
}

/**
 * Check if the daemon is currently loaded/running.
 */
export function isRunning(): boolean {
  try {
    const output = execSync(`launchctl list | grep ${BUNDLE_ID}`, {
      encoding: 'utf-8',
    });
    return output.includes(BUNDLE_ID);
  } catch {
    return false;
  }
}

/**
 * Get daemon status.
 */
export async function getStatus(): Promise<{
  installed: boolean;
  running: boolean;
  pid: number | null;
  logPath: string;
}> {
  const installed = existsSync(PLIST_PATH);
  const running = installed ? isRunning() : false;

  let pid: number | null = null;
  if (running) {
    try {
      const output = execSync(`launchctl list | grep ${BUNDLE_ID}`, { encoding: 'utf-8' });
      const match = output.match(/^(\d+)/);
      if (match) pid = parseInt(match[1], 10);
    } catch {
      // PID not available
    }
  }

  return {
    installed,
    running,
    pid,
    logPath: join(LOG_DIR, 'daemon-stdout.log'),
  };
}

/**
 * Read recent daemon logs.
 */
export async function readLogs(lines = 50): Promise<string> {
  const logFile = join(LOG_DIR, 'daemon-stdout.log');
  if (!existsSync(logFile)) return '(no logs)';

  try {
    const content = await readFile(logFile, 'utf-8');
    const allLines = content.trim().split('\n');
    return allLines.slice(-lines).join('\n');
  } catch {
    return '(failed to read logs)';
  }
}
