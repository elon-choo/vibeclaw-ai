import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { stringify, parse } from 'yaml';
import type { ProxyConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

const VIBECLAW_DIR = join(homedir(), '.vibeclaw-ai');
const PROXY_CONFIG_FILE = join(VIBECLAW_DIR, 'proxy.yaml');
const PID_FILE = join(VIBECLAW_DIR, 'proxy.pid');

export function getConfigDir(): string {
  return VIBECLAW_DIR;
}

export function getConfigPath(): string {
  return PROXY_CONFIG_FILE;
}

export function getPidPath(): string {
  return PID_FILE;
}

export async function loadProxyConfig(): Promise<ProxyConfig> {
  try {
    if (!existsSync(PROXY_CONFIG_FILE)) return { ...DEFAULT_CONFIG };
    const raw = await readFile(PROXY_CONFIG_FILE, 'utf-8');
    const parsed = parse(raw) as Partial<ProxyConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveProxyConfig(config: ProxyConfig): Promise<void> {
  await mkdir(VIBECLAW_DIR, { recursive: true });
  const yamlStr = stringify(config, { indent: 2 });
  await writeFile(PROXY_CONFIG_FILE, yamlStr, 'utf-8');
}

export async function savePid(pid: number): Promise<void> {
  await mkdir(VIBECLAW_DIR, { recursive: true });
  await writeFile(PID_FILE, String(pid), 'utf-8');
}

export async function loadPid(): Promise<number | null> {
  try {
    if (!existsSync(PID_FILE)) return null;
    const raw = await readFile(PID_FILE, 'utf-8');
    const pid = parseInt(raw.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export async function clearPid(): Promise<void> {
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(PID_FILE);
  } catch {
    // File may not exist
  }
}
