import { readWorkspaceFile, listSkills } from '@vibeclaw-ai/workspace';
import type { WorkspaceFile } from '@vibeclaw-ai/workspace';
import type { Message } from '@vibeclaw-ai/providers';

/** Context slot with priority and token cost */
interface ContextSlot {
  name: string;
  content: string;
  priority: number;
  estimatedTokens: number;
}

/**
 * Context Autopilot - automatically optimizes the context window.
 *
 * OpenClaw requires users to manually configure which files go into context.
 * VibeClaw AI analyzes the conversation and selects relevant workspace files,
 * skills, and memory within the token budget.
 *
 * Strategy:
 * 1. Classify user intent (coding, general, search, etc.)
 * 2. Score workspace files by relevance to current topic
 * 3. Pack context within budget, highest priority first
 * 4. Summarize old history to preserve important context
 */
export class ContextAutopilot {
  private maxContextTokens: number;

  constructor(maxContextTokens = 8000) {
    this.maxContextTokens = maxContextTokens;
  }

  /**
   * Build an optimized system prompt based on the conversation.
   */
  async buildContext(
    history: Message[],
    extraPrompt?: string,
  ): Promise<string> {
    const slots: ContextSlot[] = [];

    // Always include AGENTS.md (core rules) at highest priority
    const agentsContent = await safeRead('AGENTS.md');
    if (agentsContent) {
      slots.push({
        name: 'AGENTS.md',
        content: agentsContent,
        priority: 100,
        estimatedTokens: estimateTokens(agentsContent),
      });
    }

    // Analyze recent messages to determine what context is needed
    const recentText = history.slice(-6).map(m => m.content).join(' ');
    const topics = extractTopics(recentText);
    const intent = classifyIntent(recentText);

    // SOUL.md - personality (medium priority, always useful)
    const soulContent = await safeRead('SOUL.md');
    if (soulContent) {
      slots.push({
        name: 'SOUL.md',
        content: soulContent,
        priority: 70,
        estimatedTokens: estimateTokens(soulContent),
      });
    }

    // MEMORY.md - higher priority if conversation references past context
    const memoryContent = await safeRead('MEMORY.md');
    if (memoryContent) {
      const memoryRelevance = topics.some(t =>
        memoryContent.toLowerCase().includes(t.toLowerCase())
      ) ? 80 : 40;
      slots.push({
        name: 'MEMORY.md',
        content: memoryContent,
        priority: memoryRelevance,
        estimatedTokens: estimateTokens(memoryContent),
      });
    }

    // USER.md - user preferences (relevant for personalization)
    const userContent = await safeRead('USER.md');
    if (userContent && userContent.length > 200) {
      slots.push({
        name: 'USER.md',
        content: userContent,
        priority: 50,
        estimatedTokens: estimateTokens(userContent),
      });
    }

    // TOOLS.md - only if user seems to be asking about capabilities
    const toolsContent = await safeRead('TOOLS.md');
    if (toolsContent) {
      const toolsRelevant = /\b(skill|tool|install|capability|can you|how to)\b/i.test(recentText);
      if (toolsRelevant) {
        slots.push({
          name: 'TOOLS.md',
          content: toolsContent,
          priority: 60,
          estimatedTokens: estimateTokens(toolsContent),
        });
      }
    }

    // Intent-based context boost
    if (intent === 'coding') {
      // Add coding-specific context hint
      slots.push({
        name: 'coding-mode',
        content: 'You are in coding mode. Focus on code quality, follow project conventions, and provide working implementations.',
        priority: 90,
        estimatedTokens: 30,
      });
    }

    // Extra prompt from caller
    if (extraPrompt) {
      slots.push({
        name: 'extra',
        content: extraPrompt,
        priority: 95,
        estimatedTokens: estimateTokens(extraPrompt),
      });
    }

    // Pack within budget
    return this.packContext(slots);
  }

  /**
   * Compress old conversation history to save tokens.
   * Keeps recent messages intact, summarizes older ones.
   */
  compressHistory(history: Message[], keepRecent = 10): Message[] {
    if (history.length <= keepRecent) return history;

    const old = history.slice(0, -keepRecent);
    const recent = history.slice(-keepRecent);

    // Create a summary of old messages
    const topics = new Set<string>();
    for (const msg of old) {
      const words = msg.content.split(/\s+/).slice(0, 20);
      for (const w of words) {
        if (w.length > 4) topics.add(w.toLowerCase());
      }
    }

    const summary: Message = {
      role: 'system',
      content: `[Earlier conversation summary: ${old.length} messages about ${[...topics].slice(0, 10).join(', ')}]`,
    };

    return [summary, ...recent];
  }

  /**
   * Pack context slots into the token budget, highest priority first.
   */
  private packContext(slots: ContextSlot[]): string {
    // Sort by priority descending
    const sorted = [...slots].sort((a, b) => b.priority - a.priority);

    let totalTokens = 0;
    const included: string[] = [];

    for (const slot of sorted) {
      if (totalTokens + slot.estimatedTokens > this.maxContextTokens) {
        // Try to fit a truncated version
        const remaining = this.maxContextTokens - totalTokens;
        if (remaining > 100) {
          const truncated = truncateToTokens(slot.content, remaining);
          included.push(`<!-- ${slot.name} (truncated) -->\n${truncated}`);
          totalTokens += remaining;
        }
        continue;
      }

      included.push(`<!-- ${slot.name} -->\n${slot.content}`);
      totalTokens += slot.estimatedTokens;
    }

    return included.join('\n\n---\n\n');
  }
}

// ─── Helpers ──────────────────────────────────────────────

async function safeRead(file: WorkspaceFile): Promise<string | null> {
  try {
    const content = await readWorkspaceFile(file);
    return content.trim() || null;
  } catch {
    return null;
  }
}

/** Rough token estimation (~4 chars per token for English, ~2 for CJK) */
function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u3000-\u9fff\uac00-\ud7af]/g) ?? []).length;
  const otherChars = text.length - cjkChars;
  return Math.ceil(otherChars / 4 + cjkChars / 2);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const targetChars = maxTokens * 3; // conservative
  if (text.length <= targetChars) return text;
  return text.substring(0, targetChars) + '\n...[truncated]';
}

/** Extract key topics from text */
function extractTopics(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Frequency count
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  // Top topics by frequency
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

/** Classify user intent from recent messages */
export function classifyIntent(text: string): 'coding' | 'assistant' | 'search' | 'creative' {
  const lower = text.toLowerCase();

  const codingSignals = [
    /\b(code|function|class|bug|error|fix|implement|refactor|test|deploy|build|compile|npm|git)\b/,
    /\b(typescript|javascript|python|react|node|api|endpoint|database|sql|css|html)\b/,
    /```[\s\S]*```/,
    /\b(const|let|var|import|export|async|await|return)\b/,
  ];

  const searchSignals = [
    /\b(search|find|look up|what is|who is|when did|where is|how to)\b/,
    /\b(latest|news|current|recent|update)\b/,
  ];

  const creativeSignals = [
    /\b(write|story|poem|creative|imagine|design|brainstorm|idea)\b/,
    /\b(blog|article|content|copy|headline|slogan)\b/,
  ];

  const codingScore = codingSignals.reduce((s, r) => s + (r.test(lower) ? 1 : 0), 0);
  const searchScore = searchSignals.reduce((s, r) => s + (r.test(lower) ? 1 : 0), 0);
  const creativeScore = creativeSignals.reduce((s, r) => s + (r.test(lower) ? 1 : 0), 0);

  const max = Math.max(codingScore, searchScore, creativeScore);
  if (max === 0) return 'assistant';
  if (codingScore === max) return 'coding';
  if (creativeScore === max) return 'creative';
  if (searchScore === max) return 'search';
  return 'assistant';
}
