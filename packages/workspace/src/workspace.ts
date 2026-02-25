import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { WorkspaceFile, WorkspaceLayout, MemoryEntry, VibeClawConfig } from './types.js';
import { TEMPLATES, DEFAULT_VIBECLAW_CONFIG } from './templates.js';

const VIBECLAW_DIR = join(homedir(), '.vibeclaw-ai');
const WORKSPACE_DIR = join(VIBECLAW_DIR, 'workspace');
const CONFIG_FILE = join(VIBECLAW_DIR, 'vibeclaw-ai.json');
const SKILLS_DIR = join(WORKSPACE_DIR, 'skills');
const MEMORY_DIR = join(WORKSPACE_DIR, 'memory');

const WORKSPACE_FILES: WorkspaceFile[] = [
  'AGENTS.md',
  'SOUL.md',
  'MEMORY.md',
  'IDENTITY.md',
  'USER.md',
  'TOOLS.md',
];

/**
 * Get the workspace layout (paths only, no I/O).
 */
export function getLayout(customRoot?: string): WorkspaceLayout {
  const root = customRoot ?? WORKSPACE_DIR;
  const files = {} as Record<WorkspaceFile, string>;
  for (const f of WORKSPACE_FILES) {
    files[f] = join(root, f);
  }
  return {
    root,
    files,
    skillsDir: join(root, 'skills'),
    memoryDir: join(root, 'memory'),
  };
}

/**
 * Initialize workspace with template files.
 * Skips files that already exist (never overwrites).
 */
export async function initWorkspace(customRoot?: string): Promise<{
  created: string[];
  skipped: string[];
}> {
  const layout = getLayout(customRoot);
  const created: string[] = [];
  const skipped: string[] = [];

  // Create directories
  await mkdir(layout.root, { recursive: true });
  await mkdir(layout.skillsDir, { recursive: true });
  await mkdir(layout.memoryDir, { recursive: true });

  // Create template files (skip existing)
  for (const file of WORKSPACE_FILES) {
    const filePath = layout.files[file];
    if (existsSync(filePath)) {
      skipped.push(file);
    } else {
      await writeFile(filePath, TEMPLATES[file], 'utf-8');
      created.push(file);
    }
  }

  // Create vibeclaw-ai.json if not exists
  if (!existsSync(CONFIG_FILE)) {
    await mkdir(VIBECLAW_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_VIBECLAW_CONFIG, null, 2), 'utf-8');
    created.push('vibeclaw-ai.json');
  } else {
    skipped.push('vibeclaw-ai.json');
  }

  return { created, skipped };
}

/**
 * Check if workspace is initialized.
 */
export function isInitialized(customRoot?: string): boolean {
  const layout = getLayout(customRoot);
  return existsSync(layout.root) && existsSync(layout.files['AGENTS.md']);
}

/**
 * Read a workspace file.
 */
export async function readWorkspaceFile(file: WorkspaceFile, customRoot?: string): Promise<string> {
  const layout = getLayout(customRoot);
  return readFile(layout.files[file], 'utf-8');
}

/**
 * Write to a workspace file.
 */
export async function writeWorkspaceFile(
  file: WorkspaceFile,
  content: string,
  customRoot?: string,
): Promise<void> {
  const layout = getLayout(customRoot);
  await writeFile(layout.files[file], content, 'utf-8');
}

/**
 * Append to MEMORY.md (long-term memory).
 */
export async function appendMemory(entry: MemoryEntry, customRoot?: string): Promise<void> {
  const layout = getLayout(customRoot);
  const memoryFile = layout.files['MEMORY.md'];

  const existing = existsSync(memoryFile) ? await readFile(memoryFile, 'utf-8') : TEMPLATES['MEMORY.md'];

  const entryLine = `\n- **[${entry.timestamp}]** (${entry.type}): ${entry.content}`;
  const updated = existing.trimEnd() + entryLine + '\n';

  await writeFile(memoryFile, updated, 'utf-8');
}

/**
 * Write a daily memory log file.
 */
export async function writeDailyLog(
  entries: MemoryEntry[],
  customRoot?: string,
): Promise<string> {
  const layout = getLayout(customRoot);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = join(layout.memoryDir, `${today}.jsonl`);

  const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';

  // Append mode
  const existing = existsSync(logFile) ? await readFile(logFile, 'utf-8') : '';
  await writeFile(logFile, existing + lines, 'utf-8');

  return logFile;
}

/**
 * List installed skills.
 */
export async function listSkills(customRoot?: string): Promise<string[]> {
  const layout = getLayout(customRoot);
  if (!existsSync(layout.skillsDir)) return [];

  const entries = await readdir(layout.skillsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

/**
 * Load vibeclaw-ai.json config.
 */
export async function loadVibeClawConfig(): Promise<VibeClawConfig> {
  try {
    if (!existsSync(CONFIG_FILE)) return { ...DEFAULT_VIBECLAW_CONFIG };
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_VIBECLAW_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_VIBECLAW_CONFIG };
  }
}

/**
 * Save vibeclaw-ai.json config (merges with existing).
 */
export async function saveVibeClawConfig(updates: Partial<VibeClawConfig>): Promise<VibeClawConfig> {
  await mkdir(VIBECLAW_DIR, { recursive: true });
  const existing = await loadVibeClawConfig();
  const merged = { ...existing, ...updates };
  await writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

/**
 * Build context string from workspace files for LLM system prompt.
 * Reads AGENTS.md + SOUL.md + MEMORY.md + USER.md.
 */
export async function buildSystemContext(customRoot?: string): Promise<string> {
  const parts: string[] = [];

  for (const file of ['AGENTS.md', 'SOUL.md', 'MEMORY.md', 'USER.md'] as WorkspaceFile[]) {
    try {
      const content = await readWorkspaceFile(file, customRoot);
      if (content.trim()) {
        parts.push(`<!-- ${file} -->\n${content.trim()}`);
      }
    } catch {
      // File might not exist
    }
  }

  return parts.join('\n\n---\n\n');
}
