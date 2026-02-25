#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

async function main(): Promise<void> {
  switch (command) {
    case 'onboard':
    case 'setup': {
      const { onboard } = await import('./commands/onboard.js');
      await onboard();
      break;
    }

    case 'auth': {
      switch (subcommand) {
        case 'login': {
          const { authLogin } = await import('./commands/auth.js');
          await authLogin(args[2]);
          break;
        }
        case 'status': {
          const { authStatus } = await import('./commands/auth.js');
          await authStatus();
          break;
        }
        case 'logout': {
          const { authLogout } = await import('./commands/auth.js');
          await authLogout(args[2]);
          break;
        }
        default:
          console.log('Usage: vibeclaw-ai auth <login|status|logout> [codex|claude|gemini]');
      }
      break;
    }

    case 'chat': {
      const { chat } = await import('./commands/chat.js');
      await chat();
      break;
    }

    case 'proxy': {
      switch (subcommand) {
        case 'start': {
          const { proxyStart } = await import('./commands/proxy.js');
          await proxyStart();
          break;
        }
        case 'stop': {
          const { proxyStop } = await import('./commands/proxy.js');
          await proxyStop();
          break;
        }
        case 'status':
        default: {
          const { proxyStatus } = await import('./commands/proxy.js');
          await proxyStatus();
          break;
        }
      }
      break;
    }

    case 'budget': {
      switch (subcommand) {
        case 'set': {
          const { budgetSet } = await import('./commands/budget.js');
          await budgetSet(args.slice(2));
          break;
        }
        case 'status':
        default: {
          const { budgetStatus } = await import('./commands/budget.js');
          await budgetStatus();
          break;
        }
      }
      break;
    }

    case 'skill': {
      switch (subcommand) {
        case 'install':
        case 'add': {
          const { skillInstall } = await import('./commands/skill.js');
          await skillInstall(args[2]);
          break;
        }
        case 'remove':
        case 'rm': {
          const { skillRemove } = await import('./commands/skill.js');
          await skillRemove(args[2]);
          break;
        }
        case 'scan': {
          const { skillScan } = await import('./commands/skill.js');
          await skillScan();
          break;
        }
        case 'search': {
          const { skillSearch } = await import('./commands/skill.js');
          await skillSearch(args.slice(2).join(' '));
          break;
        }
        case 'list':
        default: {
          const { skillList } = await import('./commands/skill.js');
          await skillList();
          break;
        }
      }
      break;
    }

    case 'daemon': {
      switch (subcommand) {
        case 'install': {
          const { daemonInstall } = await import('./commands/daemon.js');
          await daemonInstall();
          break;
        }
        case 'start': {
          const { daemonStart } = await import('./commands/daemon.js');
          await daemonStart();
          break;
        }
        case 'stop': {
          const { daemonStop } = await import('./commands/daemon.js');
          await daemonStop();
          break;
        }
        case 'logs': {
          const { daemonLogs } = await import('./commands/daemon.js');
          await daemonLogs();
          break;
        }
        case 'uninstall': {
          const { daemonUninstall } = await import('./commands/daemon.js');
          await daemonUninstall();
          break;
        }
        case 'run': {
          // Internal: called by LaunchAgent
          const { daemonRun } = await import('./commands/daemon.js');
          await daemonRun(args.slice(2));
          break;
        }
        case 'status':
        default: {
          const { daemonStatus } = await import('./commands/daemon.js');
          await daemonStatus();
          break;
        }
      }
      break;
    }

    case 'telegram': {
      const { startTelegramBot } = await import('@vibeclaw-ai/telegram');
      await startTelegramBot();
      break;
    }

    case 'version':
    case '--version':
    case '-v': {
      console.log('vibeclaw-ai 0.1.0');
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default: {
      printHelp();
      break;
    }
  }
}

function printHelp(): void {
  console.log(`
  \x1b[1m\x1b[35mVibeClaw AI\x1b[0m - Token-saving, security-first AI agent

  \x1b[1mUSAGE\x1b[0m
    vibeclaw-ai <command> [options]

  \x1b[1mCOMMANDS\x1b[0m
    onboard          Interactive setup wizard
    chat             Start chatting with VibeClaw AI
    auth login       Authenticate with ChatGPT
    auth status      Check authentication status
    auth logout      Clear stored tokens
    proxy start      Start the API proxy
    proxy stop       Stop the API proxy
    proxy status     Check proxy status
    budget           Show token usage & budget status
    budget set       Set budget limits
    skill list       List installed skills
    skill install    Install a skill (local or ClawHub)
    skill remove     Remove a skill
    skill scan       Security scan all skills
    skill search     Search ClawHub registry
    daemon install   Install background daemon
    daemon start     Start daemon
    daemon stop      Stop daemon
    daemon status    Daemon status
    daemon logs      View daemon logs
    daemon uninstall Remove daemon
    telegram         Launch Telegram bot
    version          Show version
    help             Show this help

  \x1b[1mEXAMPLES\x1b[0m
    $ vibeclaw-ai onboard       # First-time setup
    $ vibeclaw-ai chat          # Start chatting
    $ vibeclaw-ai proxy start   # Start proxy for Claude Code

  \x1b[2mhttps://github.com/vibeclaw-ai/vibeclaw-ai\x1b[0m
`);
}

main().catch((e) => {
  console.error('\x1b[31mError:\x1b[0m', (e as Error).message);
  process.exit(1);
});
