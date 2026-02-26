import type { Message } from '@vibepity/providers';
import { classifyIntent } from './context-autopilot.js';

/** Agent mode determines behavior, system prompt, and model selection */
export type AgentMode = 'coding' | 'assistant' | 'search' | 'creative';

/** Mode configuration */
export interface ModeConfig {
  /** Display name */
  label: string;
  /** System prompt prefix for this mode */
  systemPromptPrefix: string;
  /** Preferred model (can be overridden) */
  preferredModel?: string;
  /** Max response tokens hint */
  maxTokensHint?: number;
}

const MODE_CONFIGS: Record<AgentMode, ModeConfig> = {
  coding: {
    label: 'Coding',
    systemPromptPrefix: [
      'You are Vibepity in CODING MODE.',
      'Focus on writing clean, working code.',
      'Follow existing project conventions.',
      'Be concise - code speaks louder than words.',
      'Always provide complete implementations, never stubs or TODOs.',
      'If a bug is reported, explain the root cause before fixing.',
    ].join('\n'),
    preferredModel: 'gpt-5.1-codex-mini',
    maxTokensHint: 4096,
  },

  assistant: {
    label: 'Assistant',
    systemPromptPrefix: [
      'You are Vibepity, a helpful AI assistant.',
      'Be concise and direct.',
      'Respond in the same language as the user.',
      'If the task is complex, break it down into steps.',
    ].join('\n'),
    maxTokensHint: 2048,
  },

  search: {
    label: 'Search',
    systemPromptPrefix: [
      'You are Vibepity in SEARCH MODE.',
      'Provide factual, well-sourced answers.',
      'If you are uncertain, say so clearly.',
      'Prefer bullet points for clarity.',
      'Include dates and sources when available.',
    ].join('\n'),
    maxTokensHint: 1024,
  },

  creative: {
    label: 'Creative',
    systemPromptPrefix: [
      'You are Vibepity in CREATIVE MODE.',
      'Be imaginative and engaging.',
      'Match the user\'s tone and style preferences.',
      'Offer multiple options when brainstorming.',
      'Structure longer content with clear sections.',
    ].join('\n'),
    maxTokensHint: 3072,
  },
};

/**
 * Hybrid Agent Mode - automatically switches between coding and assistant modes.
 *
 * OpenClaw is coding-only. Vibepity detects intent and adapts its behavior,
 * system prompt, and model selection accordingly.
 */
export class HybridMode {
  private currentMode: AgentMode = 'assistant';
  private manualOverride: AgentMode | null = null;
  private modeHistory: Array<{ mode: AgentMode; timestamp: number }> = [];

  /**
   * Detect the appropriate mode from user input.
   * Uses conversation history for better accuracy.
   */
  detect(userMessage: string, history: Message[] = []): AgentMode {
    // Manual override takes precedence
    if (this.manualOverride) return this.manualOverride;

    // Check for explicit mode switches
    const explicitMode = this.checkExplicitSwitch(userMessage);
    if (explicitMode) {
      this.switchTo(explicitMode);
      return explicitMode;
    }

    // Analyze recent context (last 4 messages + current)
    const recentText = [
      ...history.slice(-4).map(m => m.content),
      userMessage,
    ].join(' ');

    const detected = classifyIntent(recentText);

    // Sticky mode: don't switch too frequently (debounce)
    if (detected !== this.currentMode) {
      const lastSwitch = this.modeHistory[this.modeHistory.length - 1];
      const timeSinceSwitch = lastSwitch ? Date.now() - lastSwitch.timestamp : Infinity;

      // Require 2+ messages or 30s before switching
      if (timeSinceSwitch < 30_000 && this.modeHistory.length > 0) {
        return this.currentMode;
      }

      this.switchTo(detected);
    }

    return this.currentMode;
  }

  /**
   * Get the config for the current mode.
   */
  getConfig(): ModeConfig {
    return MODE_CONFIGS[this.currentMode];
  }

  /**
   * Get config for a specific mode.
   */
  getConfigFor(mode: AgentMode): ModeConfig {
    return MODE_CONFIGS[mode];
  }

  /**
   * Get current mode.
   */
  getCurrentMode(): AgentMode {
    return this.currentMode;
  }

  /**
   * Force a specific mode (manual override).
   */
  setMode(mode: AgentMode | null): void {
    this.manualOverride = mode;
    if (mode) {
      this.switchTo(mode);
    }
  }

  /**
   * Get mode switch history.
   */
  getHistory(): Array<{ mode: AgentMode; timestamp: number }> {
    return [...this.modeHistory];
  }

  /**
   * Build a mode-aware system prompt prefix.
   */
  buildModePrefix(mode?: AgentMode): string {
    const m = mode ?? this.currentMode;
    const config = MODE_CONFIGS[m];
    return `[Mode: ${config.label}]\n\n${config.systemPromptPrefix}`;
  }

  // ─── Private ────────────────────────────────────────────

  private switchTo(mode: AgentMode): void {
    if (mode !== this.currentMode) {
      this.currentMode = mode;
      this.modeHistory.push({ mode, timestamp: Date.now() });

      // Keep history bounded
      if (this.modeHistory.length > 50) {
        this.modeHistory = this.modeHistory.slice(-50);
      }
    }
  }

  /**
   * Check for explicit mode switch commands in user message.
   * e.g., "/code", "/assistant", "/creative", "/search"
   */
  private checkExplicitSwitch(message: string): AgentMode | null {
    const trimmed = message.trim().toLowerCase();

    if (trimmed === '/code' || trimmed === '/coding') return 'coding';
    if (trimmed === '/assistant' || trimmed === '/chat') return 'assistant';
    if (trimmed === '/creative' || trimmed === '/write') return 'creative';
    if (trimmed === '/search' || trimmed === '/find') return 'search';

    return null;
  }
}
