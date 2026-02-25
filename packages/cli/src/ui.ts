import { createInterface } from 'node:readline';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

export const ui = {
  banner() {
    console.log('');
    console.log(`${BOLD}${MAGENTA}  ╦  ╦╦╔╗ ╔═╗╔═╗╦╔╦╗╦ ╦${RESET}`);
    console.log(`${BOLD}${MAGENTA}  ╚╗╔╝║╠╩╗║╣ ╠═╝║ ║ ╚╦╝${RESET}`);
    console.log(`${BOLD}${MAGENTA}   ╚╝ ╩╚═╝╚═╝╩  ╩ ╩  ╩ ${RESET}`);
    console.log(`${DIM}  Token-saving, security-first AI agent${RESET}`);
    console.log('');
  },

  step(num: number, total: number, msg: string) {
    console.log(`${DIM}[${num}/${total}]${RESET} ${msg}`);
  },

  success(msg: string) {
    console.log(`${GREEN}  ✓${RESET} ${msg}`);
  },

  warn(msg: string) {
    console.log(`${YELLOW}  ⚠${RESET} ${msg}`);
  },

  error(msg: string) {
    console.log(`${RED}  ✗${RESET} ${msg}`);
  },

  info(msg: string) {
    console.log(`${CYAN}  ℹ${RESET} ${msg}`);
  },

  header(msg: string) {
    console.log(`\n${BOLD}${msg}${RESET}`);
  },

  dim(msg: string) {
    console.log(`${DIM}  ${msg}${RESET}`);
  },

  divider() {
    console.log(`${DIM}  ${'─'.repeat(48)}${RESET}`);
  },

  summary(items: Array<{ label: string; value: string }>) {
    const maxLabel = Math.max(...items.map(i => i.label.length));
    for (const { label, value } of items) {
      console.log(`  ${DIM}${label.padEnd(maxLabel)}${RESET}  ${value}`);
    }
  },
};

/**
 * Prompt the user for input.
 */
export function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : '';

  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Yes/No prompt.
 */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await prompt(`${question} [${hint}]`);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

/**
 * Spinner for async operations.
 */
export function spinner(msg: string): { stop: (success?: boolean, finalMsg?: string) => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  const interval = setInterval(() => {
    process.stdout.write(`\r  ${CYAN}${frames[i++ % frames.length]}${RESET} ${msg}`);
  }, 80);

  return {
    stop(success = true, finalMsg?: string) {
      clearInterval(interval);
      const icon = success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      process.stdout.write(`\r  ${icon} ${finalMsg ?? msg}\n`);
    },
  };
}
