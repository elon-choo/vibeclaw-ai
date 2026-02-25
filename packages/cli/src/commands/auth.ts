import { ui, spinner } from '../ui.js';
import type { AuthProvider } from '@vibeclaw-ai/auth';

const VALID_PROVIDERS: AuthProvider[] = ['codex', 'claude', 'gemini'];
const PROVIDER_LABELS: Record<AuthProvider, string> = {
  codex: 'ChatGPT (Codex)',
  claude: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
};

function parseProvider(arg?: string): AuthProvider {
  if (!arg) return 'codex';
  const lower = arg.toLowerCase().replace('--provider=', '').replace('--', '');
  if (VALID_PROVIDERS.includes(lower as AuthProvider)) return lower as AuthProvider;
  if (lower === 'gpt' || lower === 'openai' || lower === 'chatgpt') return 'codex';
  if (lower === 'anthropic') return 'claude';
  if (lower === 'google') return 'gemini';
  return 'codex';
}

export async function authLogin(providerArg?: string): Promise<void> {
  const provider = parseProvider(providerArg);
  ui.info(`Opening browser for ${PROVIDER_LABELS[provider]} OAuth login...`);
  const s = spinner('Waiting for authentication...');

  try {
    const { authenticateOAuth } = await import('@vibeclaw-ai/auth');
    const tokens = await authenticateOAuth(provider);
    s.stop(true, `${PROVIDER_LABELS[provider]} authenticated!`);
    const remaining = Math.max(0, Math.round((tokens.expires_at - Date.now()) / 60000));
    ui.success(`Token valid for ${remaining} minutes`);
  } catch (e) {
    s.stop(false, 'Authentication failed');
    ui.error((e as Error).message);
    process.exit(1);
  }
}

export async function authStatus(): Promise<void> {
  const { getAllAuthStatus, PROVIDER_CONFIGS } = await import('@vibeclaw-ai/auth');
  const statuses = await getAllAuthStatus();

  ui.header('  Authentication Status\n');

  for (const [provider, status] of Object.entries(statuses)) {
    const config = PROVIDER_CONFIGS[provider as AuthProvider];
    if (status.authenticated) {
      ui.success(`${config.label}: Authenticated (${status.remainingMinutes}min remaining)`);
    } else {
      ui.dim(`${config.label}: Not authenticated`);
    }
  }

  console.log('');
  ui.info('Login: vibeclaw-ai auth login [codex|claude|gemini]');
}

export async function authLogout(providerArg?: string): Promise<void> {
  const provider = parseProvider(providerArg);
  const { clearProviderToken } = await import('@vibeclaw-ai/auth');
  await clearProviderToken(provider);
  ui.success(`${PROVIDER_LABELS[provider]} tokens cleared.`);
}
