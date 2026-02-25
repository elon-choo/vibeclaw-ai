/** Workspace file identifiers */
export type WorkspaceFile =
  | 'AGENTS.md'
  | 'SOUL.md'
  | 'MEMORY.md'
  | 'IDENTITY.md'
  | 'USER.md'
  | 'TOOLS.md';

/** Workspace directory structure */
export interface WorkspaceLayout {
  root: string;
  files: Record<WorkspaceFile, string>;
  skillsDir: string;
  memoryDir: string;
}

/** Memory entry for daily logs */
export interface MemoryEntry {
  timestamp: string;
  type: 'conversation' | 'task' | 'insight' | 'preference';
  content: string;
  metadata?: Record<string, unknown>;
}

/** VibeClaw AI main config (~/.vibeclaw-ai/vibeclaw-ai.json) */
export interface VibeClawConfig {
  /** Agent display name */
  agentName?: string;
  /** Default model */
  defaultModel?: string;
  /** Workspace path override */
  workspacePath?: string;
  /** Telegram bot token */
  telegramBotToken?: string;
  /** Max concurrent lane tasks */
  maxConcurrent?: number;
  /** Proxy config */
  proxy?: {
    port?: number;
    autoStart?: boolean;
  };
  /** Feature flags */
  features?: {
    tokenBudget?: boolean;
    skillSandbox?: boolean;
    contextAutopilot?: boolean;
    hybridMode?: boolean;
  };
}
