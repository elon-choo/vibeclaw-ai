import type { Provider, CompletionOptions, CompletionResult, Message } from '@vibeclaw-ai/providers';
import { CodexProvider, OpenAIProvider } from '@vibeclaw-ai/providers';
import { BudgetTracker } from '@vibeclaw-ai/budget';
import { SkillManager } from '@vibeclaw-ai/skills';
import { loadVibeClawConfig } from '@vibeclaw-ai/workspace';
import { getValidToken, authenticateOAuth, loadConfig } from '@vibeclaw-ai/auth';
import { ContextAutopilot } from './context-autopilot.js';
import { HybridMode, type AgentMode } from './hybrid-mode.js';

export interface AgentOptions {
  /** Override default provider */
  provider?: Provider;
  /** Override model */
  model?: string;
  /** Disable budget tracking */
  noBudget?: boolean;
  /** Custom system prompt (appended to workspace context) */
  systemPrompt?: string;
  /** Max context window tokens for autopilot */
  maxContextTokens?: number;
}

export interface ChatResult {
  text: string;
  model: string;
  mode: AgentMode;
  usage?: { inputTokens: number; outputTokens: number };
  matchedSkills?: string[];
  budgetWarnings?: string[];
}

/**
 * VibeClaw AI Agent v2 - core agent loop with Context Autopilot & Hybrid Mode.
 *
 * Flow:
 * 1. Hybrid Mode detection (coding/assistant/search/creative)
 * 2. Budget pre-check
 * 3. Skill matching
 * 4. Context Autopilot (workspace files + history compression)
 * 5. LLM call (with provider fallback)
 * 6. Budget recording
 */
export class Agent {
  private provider: Provider;
  private fallbackProvider: Provider | null = null;
  private budget: BudgetTracker;
  private skills: SkillManager;
  private autopilot: ContextAutopilot;
  private hybridMode: HybridMode;
  private history: Message[] = [];
  private model: string;
  private noBudget: boolean;
  private extraSystemPrompt: string;

  constructor(options: AgentOptions = {}) {
    this.provider = options.provider ?? new CodexProvider();
    this.budget = new BudgetTracker();
    this.skills = new SkillManager();
    this.autopilot = new ContextAutopilot(options.maxContextTokens ?? 8000);
    this.hybridMode = new HybridMode();
    this.model = options.model ?? 'gpt-5.1-codex-mini';
    this.noBudget = options.noBudget ?? false;
    this.extraSystemPrompt = options.systemPrompt ?? '';
  }

  /**
   * Initialize the agent.
   */
  async init(): Promise<void> {
    const config = await loadVibeClawConfig();
    this.model = config.defaultModel ?? this.model;

    if (!this.noBudget) {
      await this.budget.init();
    }

    // Ensure authenticated for Codex provider
    if (this.provider.name === 'codex') {
      const tokens = await getValidToken();
      if (!tokens) {
        await authenticateOAuth();
      }
    }

    // Set up fallback provider
    if (this.provider.name === 'codex') {
      const authConfig = await loadConfig();
      if (authConfig.openaiApiKey) {
        this.fallbackProvider = new OpenAIProvider(authConfig.openaiApiKey);
      }
    }
  }

  /**
   * Send a message and get a response.
   */
  async chat(userMessage: string): Promise<ChatResult> {
    // 1. Detect mode
    const mode = this.hybridMode.detect(userMessage, this.history);
    const modeConfig = this.hybridMode.getConfig();

    // Handle explicit mode switch commands
    if (userMessage.trim().startsWith('/') && ['coding', 'assistant', 'search', 'creative'].includes(mode)) {
      const isSwitch = /^\/(code|coding|assistant|chat|creative|write|search|find)$/i.test(userMessage.trim());
      if (isSwitch) {
        return {
          text: `Switched to ${modeConfig.label} mode.`,
          model: this.model,
          mode,
        };
      }
    }

    // 2. Budget pre-check
    if (!this.noBudget) {
      const blockReason = this.budget.checkBefore(this.model, 1000, 2000);
      if (blockReason) {
        return {
          text: `[Budget blocked] ${blockReason}\nAdjust limits: vibeclaw-ai budget set --daily-tokens <amount>`,
          model: this.model,
          mode,
          budgetWarnings: [blockReason],
        };
      }
    }

    // 3. Skill matching
    const matchedSkills = await this.skills.findMatchingSkills(userMessage);
    const skillContext = matchedSkills.length > 0
      ? matchedSkills.map(s => `## Skill: ${s.title}\n${s.rawContent}`).join('\n\n---\n\n')
      : '';

    // 4. Context Autopilot - build optimized system prompt
    const autoContext = await this.autopilot.buildContext(
      this.history,
      [this.extraSystemPrompt, skillContext].filter(Boolean).join('\n\n') || undefined,
    );

    // Prepend mode prefix
    const systemPrompt = `${this.hybridMode.buildModePrefix()}\n\n---\n\n${autoContext}`;

    // 5. Compress history if too long
    const compressedHistory = this.autopilot.compressHistory(this.history, 12);

    // Add current message
    this.history.push({ role: 'user', content: userMessage });
    const messagesForLlm = [...compressedHistory.filter(m => m.role !== 'user' || m.content !== userMessage), { role: 'user' as const, content: userMessage }];

    // Select model based on mode
    const effectiveModel = modeConfig.preferredModel ?? this.model;

    // 6. Call LLM
    let result: CompletionResult;
    try {
      result = await this.provider.complete({
        model: effectiveModel,
        systemPrompt,
        messages: messagesForLlm,
        maxTokens: modeConfig.maxTokensHint,
      });
    } catch (e) {
      if (this.fallbackProvider) {
        result = await this.fallbackProvider.complete({
          model: 'gpt-4o-mini',
          systemPrompt,
          messages: messagesForLlm,
        });
      } else {
        throw e;
      }
    }

    const responseText = result.text || '(no response)';
    this.history.push({ role: 'assistant', content: responseText });

    // Keep history bounded
    if (this.history.length > 40) {
      this.history = this.history.slice(-40);
    }

    // 7. Record budget
    let budgetWarnings: string[] = [];
    if (!this.noBudget && result.usage) {
      await this.budget.record(effectiveModel, result.usage.inputTokens, result.usage.outputTokens);
      const status = await this.budget.getStatus();
      budgetWarnings = status.warnings;
    }

    return {
      text: responseText,
      model: effectiveModel,
      mode,
      usage: result.usage,
      matchedSkills: matchedSkills.map(s => s.name),
      budgetWarnings,
    };
  }

  /** Get budget status */
  async getBudgetStatus() {
    await this.budget.init();
    return this.budget.getStatus();
  }

  /** Get installed skills */
  async getSkills() {
    return this.skills.list();
  }

  /** Get current agent mode */
  getMode(): AgentMode {
    return this.hybridMode.getCurrentMode();
  }

  /** Force a specific mode */
  setMode(mode: AgentMode | null): void {
    this.hybridMode.setMode(mode);
  }

  /** Clear conversation history */
  clearHistory(): void {
    this.history = [];
  }

  /** Get conversation history */
  getHistory(): Message[] {
    return [...this.history];
  }
}
