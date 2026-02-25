import { Bot } from 'grammy';
import { loadConfig } from '@vibeclaw-ai/auth';
import { CodexProvider, ClaudeProvider, GeminiProvider, type Provider, type Message } from '@vibeclaw-ai/providers';

interface Session {
  history: Message[];
  model?: string;
  providerName: string;
  lastActivity: number;
}

const MAX_HISTORY = 10;
const sessions = new Map<number, Session>();

function getSession(chatId: number): Session {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { history: [], providerName: 'codex', lastActivity: Date.now() });
  }
  const session = sessions.get(chatId)!;
  session.lastActivity = Date.now();
  return session;
}

function createProvider(name: string): Provider {
  switch (name) {
    case 'claude': return new ClaudeProvider();
    case 'gemini': return new GeminiProvider();
    case 'codex':
    default: return new CodexProvider();
  }
}

export async function startTelegramBot(botToken?: string): Promise<void> {
  const config = await loadConfig();
  const token = botToken ?? config.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error(
      'Telegram Bot Token not found. Set via:\n' +
      '  1. TELEGRAM_BOT_TOKEN env var\n' +
      '  2. ~/.vibeclaw-ai/config.json\n' +
      '  3. Pass to startTelegramBot(token)\n\n' +
      'Get a token from @BotFather: https://t.me/BotFather'
    );
  }

  const bot = new Bot(token);

  // /start
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'VibeClaw AI에 오신 것을 환영합니다! 🤖\n\n' +
      '멀티 AI 프로바이더 지원:\n' +
      '• ChatGPT (Codex) - $0 구독 기반\n' +
      '• Claude (Anthropic)\n' +
      '• Gemini (Google)\n\n' +
      '명령어:\n' +
      '/model - AI 모델 전환\n' +
      '/status - 인증 상태 확인\n' +
      '/clear - 대화 초기화\n' +
      '/help - 도움말',
    );
  });

  // /model - 프로바이더 전환
  bot.command('model', async (ctx) => {
    const arg = ctx.message?.text?.split(' ')[1]?.toLowerCase();
    const session = getSession(ctx.chat.id);

    if (!arg) {
      await ctx.reply(
        `현재 모델: ${session.providerName}\n\n` +
        '사용 가능한 모델:\n' +
        '/model codex - ChatGPT (Codex) [$0]\n' +
        '/model claude - Claude (Anthropic)\n' +
        '/model gemini - Gemini (Google)',
      );
      return;
    }

    const validProviders = ['codex', 'claude', 'gemini', 'gpt', 'chatgpt'];
    const mapped = arg === 'gpt' || arg === 'chatgpt' ? 'codex' : arg;

    if (!['codex', 'claude', 'gemini'].includes(mapped)) {
      await ctx.reply(`알 수 없는 모델: ${arg}\n사용 가능: codex, claude, gemini`);
      return;
    }

    session.providerName = mapped;
    session.history = []; // 프로바이더 변경 시 히스토리 초기화
    await ctx.reply(`✅ 모델 전환: ${mapped}\n대화 히스토리가 초기화되었습니다.`);
  });

  // /clear
  bot.command('clear', async (ctx) => {
    const session = getSession(ctx.chat.id);
    session.history = [];
    await ctx.reply('대화 히스토리가 초기화되었습니다.');
  });

  // /status
  bot.command('status', async (ctx) => {
    const { getAllAuthStatus } = await import('@vibeclaw-ai/auth');
    const statuses = await getAllAuthStatus();
    const session = getSession(ctx.chat.id);

    const lines = [
      `현재 모델: ${session.providerName}\n`,
      '인증 상태:',
    ];

    for (const [name, status] of Object.entries(statuses)) {
      const icon = status.authenticated ? '✅' : '❌';
      const label = name === 'codex' ? 'ChatGPT' : name === 'claude' ? 'Claude' : 'Gemini';
      const detail = status.authenticated ? `${status.remainingMinutes}분 남음` : '미인증';
      lines.push(`${icon} ${label}: ${detail}`);
    }

    lines.push('\n로그인: 터미널에서 vibeclaw-ai auth login [codex|claude|gemini]');
    await ctx.reply(lines.join('\n'));
  });

  // /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'VibeClaw AI 명령어:\n\n' +
      '/model [codex|claude|gemini] - AI 모델 전환\n' +
      '/status - 인증 상태\n' +
      '/clear - 대화 초기화\n' +
      '/help - 이 도움말\n\n' +
      'PC에서 로그인:\n' +
      'vibeclaw-ai auth login codex\n' +
      'vibeclaw-ai auth login claude\n' +
      'vibeclaw-ai auth login gemini',
    );
  });

  // Message handler
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const userMessage = ctx.message.text;
    const session = getSession(chatId);

    await ctx.replyWithChatAction('typing');

    try {
      session.history.push({ role: 'user', content: userMessage });

      if (session.history.length > MAX_HISTORY * 2) {
        session.history = session.history.slice(-MAX_HISTORY * 2);
      }

      const provider = createProvider(session.providerName);

      // Keep typing indicator alive
      const typingInterval = setInterval(() => {
        ctx.replyWithChatAction('typing').catch(() => {});
      }, 4000);

      let result;
      try {
        result = await provider.complete({
          messages: session.history,
          model: session.model ?? config.model,
        });
      } finally {
        clearInterval(typingInterval);
      }

      const responseText = result.text || '(응답을 생성하지 못했습니다)';
      session.history.push({ role: 'assistant', content: responseText });

      // Telegram 4096 char limit
      if (responseText.length > 4000) {
        const chunks = responseText.match(/[\s\S]{1,4000}/g) ?? [];
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(responseText);
      }

      const providerTag = session.providerName.toUpperCase();
      console.log(`[${chatId}/${providerTag}] ${userMessage.substring(0, 40)}... → ${responseText.length} chars`);
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`[${chatId}] Error:`, msg);
      await ctx.reply(`오류 발생: ${msg.substring(0, 200)}`);
    }
  });

  bot.catch((err) => {
    console.error('[Bot Error]', err.message);
  });

  console.log('[VibeClaw AI] Starting Telegram bot (multi-provider)...');

  await bot.start({
    onStart: (botInfo) => {
      console.log(`[VibeClaw AI] Running as @${botInfo.username}`);
      console.log(`[VibeClaw AI] https://t.me/${botInfo.username}`);
      console.log(`[VibeClaw AI] Providers: codex, claude, gemini`);
    },
  });
}

// Direct execution
const isDirectRun = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  startTelegramBot().catch(console.error);
}
