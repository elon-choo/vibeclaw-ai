import type { SkillManifest, SkillPermission } from './types.js';

/**
 * Parse a SKILL.md file into a SkillManifest.
 * Compatible with OpenClaw SKILL.md format.
 *
 * Expected format:
 * ```markdown
 * # Skill Title
 * Description text here
 *
 * Trigger: "phrase1", "phrase2"
 * Permissions: read-fs, network
 * Version: 1.0.0
 * Author: username
 *
 * ## Instructions
 * ...
 * ```
 */
export function parseSkillMd(content: string, name: string, source: 'local' | 'clawhub' | 'registry' = 'local'): SkillManifest {
  const lines = content.split('\n');

  // Extract title from first H1
  let title = name;
  const h1Match = lines.find(l => /^#\s+/.test(l));
  if (h1Match) {
    title = h1Match.replace(/^#\s+/, '').trim();
  }

  // Extract description (lines between H1 and first metadata/section)
  let description = '';
  let inDescription = false;
  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      inDescription = true;
      continue;
    }
    if (inDescription) {
      if (/^(Trigger|Permission|Version|Author|##)/.test(line)) break;
      if (line.trim()) description += (description ? ' ' : '') + line.trim();
    }
  }

  // Extract triggers
  const triggers = extractField(content, 'Trigger');

  // Extract permissions
  const permissionField = extractFieldRaw(content, 'Permission') ?? extractFieldRaw(content, 'Permissions');
  const permissions = parsePermissions(permissionField);

  // Extract version
  const version = extractFieldRaw(content, 'Version') ?? undefined;

  // Extract author
  const author = extractFieldRaw(content, 'Author') ?? undefined;

  return {
    name,
    title,
    description: description || title,
    triggers,
    permissions,
    source,
    version,
    author,
    rawContent: content,
  };
}

function extractField(content: string, fieldName: string): string[] {
  const regex = new RegExp(`^${fieldName}s?:\\s*(.+)$`, 'mi');
  const match = content.match(regex);
  if (!match) return [];

  return match[1]
    .split(/[,;]/)
    .map(s => s.replace(/["']/g, '').trim())
    .filter(Boolean);
}

function extractFieldRaw(content: string, fieldName: string): string | null {
  const regex = new RegExp(`^${fieldName}s?:\\s*(.+)$`, 'mi');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

const VALID_PERMISSIONS: Set<string> = new Set([
  'read-fs', 'write-fs', 'execute', 'network',
  'env-vars', 'clipboard', 'notifications', 'none',
]);

function parsePermissions(raw: string | null): SkillPermission[] {
  if (!raw) return ['none'];

  return raw
    .split(/[,;]/)
    .map(s => s.trim().toLowerCase())
    .filter((s): s is SkillPermission => VALID_PERMISSIONS.has(s));
}
