import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AUTH_DIR_NAME, AUTH_FILE_NAME, CONFIG_FILE_NAME, type AuthProvider } from './constants.js';
import type { StoredTokens, AuthConfig, MultiProviderTokens } from './types.js';

const AUTH_DIR = join(homedir(), AUTH_DIR_NAME);
const AUTH_FILE = join(AUTH_DIR, AUTH_FILE_NAME);
const MULTI_AUTH_FILE = join(AUTH_DIR, 'providers.json');
const CONFIG_FILE = join(AUTH_DIR, CONFIG_FILE_NAME);

export function getAuthDir(): string {
  return AUTH_DIR;
}

export function getAuthFile(): string {
  return AUTH_FILE;
}

// ─── Legacy single-provider (backward compat) ────────────

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const data = await readFile(AUTH_FILE, 'utf-8');
    return JSON.parse(data) as StoredTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export async function clearTokens(): Promise<void> {
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(AUTH_FILE);
  } catch {
    // File may not exist
  }
}

// ─── Multi-provider token store ──────────────────────────

export async function loadProviderTokens(): Promise<MultiProviderTokens> {
  try {
    if (!existsSync(MULTI_AUTH_FILE)) {
      // Migrate from legacy single-provider file
      const legacy = await loadTokens();
      if (legacy) {
        return { codex: { ...legacy, provider: 'codex' } };
      }
      return {};
    }
    const data = await readFile(MULTI_AUTH_FILE, 'utf-8');
    return JSON.parse(data) as MultiProviderTokens;
  } catch {
    return {};
  }
}

export async function saveProviderTokens(provider: AuthProvider, tokens: StoredTokens): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
  const existing = await loadProviderTokens();
  existing[provider] = { ...tokens, provider };
  await writeFile(MULTI_AUTH_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });

  // Also save as legacy for backward compat (codex provider)
  if (provider === 'codex') {
    await saveTokens(tokens);
  }
}

export async function loadProviderToken(provider: AuthProvider): Promise<StoredTokens | null> {
  const all = await loadProviderTokens();
  return all[provider] ?? null;
}

export async function clearProviderToken(provider: AuthProvider): Promise<void> {
  const existing = await loadProviderTokens();
  delete existing[provider];
  await mkdir(AUTH_DIR, { recursive: true });
  await writeFile(MULTI_AUTH_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });

  if (provider === 'codex') {
    await clearTokens();
  }
}

// ─── Config ──────────────────────────────────────────────

export async function loadConfig(): Promise<AuthConfig> {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    const data = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as AuthConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(updates: Partial<AuthConfig>): Promise<AuthConfig> {
  await mkdir(AUTH_DIR, { recursive: true });
  const existing = await loadConfig();
  const merged = { ...existing, ...updates };
  await writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}
