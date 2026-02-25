import { ui, confirm, spinner } from '../ui.js';

export async function skillList(): Promise<void> {
  const { SkillManager } = await import('@vibeclaw-ai/skills');
  const manager = new SkillManager();

  const skills = await manager.list();

  if (skills.length === 0) {
    ui.info('No skills installed.');
    ui.dim('Install from ClawHub: vibeclaw-ai skill install <name>');
    ui.dim('Add local skill:     vibeclaw-ai skill add ./my-skill/');
    return;
  }

  ui.header(`  Installed Skills (${skills.length})\n`);

  for (const skill of skills) {
    const secBadge = skill.security
      ? ` [${skill.security.level.toUpperCase()} risk:${skill.security.riskScore}]`
      : '';
    const triggers = skill.triggers.length > 0 ? ` (triggers: ${skill.triggers.join(', ')})` : '';

    console.log(`  ${skill.name} - ${skill.title}${secBadge}${triggers}`);
    if (skill.description !== skill.title) {
      ui.dim(`    ${skill.description}`);
    }
  }
}

export async function skillInstall(nameOrPath: string): Promise<void> {
  const { SkillManager } = await import('@vibeclaw-ai/skills');
  const manager = new SkillManager();

  const s = spinner(`Installing skill "${nameOrPath}"...`);

  try {
    // Check if it's a local path
    const { existsSync } = await import('node:fs');
    let result;

    if (existsSync(nameOrPath)) {
      result = await manager.installLocal(nameOrPath);
    } else {
      result = await manager.installFromClawHub(nameOrPath);
    }

    s.stop(result.success, result.success ? `Installed: ${result.name}` : `Blocked: ${result.name}`);

    // Show security report
    if (result.security) {
      const sec = result.security;
      const levelColors: Record<string, string> = {
        safe: '\x1b[32m',
        low: '\x1b[32m',
        medium: '\x1b[33m',
        high: '\x1b[33m',
        critical: '\x1b[31m',
      };
      const color = levelColors[sec.level] ?? '';
      console.log(`  Security: ${color}${sec.level.toUpperCase()}\x1b[0m (score: ${sec.riskScore}/100)`);

      if (sec.findings.length > 0) {
        for (const f of sec.findings.slice(0, 5)) {
          const icon = f.severity === 'critical' ? '!!' : f.severity === 'danger' ? '!' : '-';
          ui.dim(`    [${icon}] ${f.message}${f.line ? ` (line ${f.line})` : ''}`);
        }
        if (sec.findings.length > 5) {
          ui.dim(`    ... and ${sec.findings.length - 5} more findings`);
        }
      }
    }

    if (result.approvalRequired && !result.success) {
      ui.warn('Skill quarantined due to security concerns.');
      ui.dim(`  Review: ${result.path}/SECURITY-REPORT.json`);
      const approve = await confirm('Install anyway (at your own risk)?', false);
      if (approve) {
        // Force install from quarantine
        const { cp, rm } = await import('node:fs/promises');
        const { join } = await import('node:path');
        const { homedir } = await import('node:os');
        const dest = join(homedir(), '.vibeclaw-ai', 'workspace', 'skills', result.name);
        await cp(result.path, dest, { recursive: true });
        await rm(join(dest, 'SECURITY-REPORT.json'), { force: true });
        ui.success(`Force-installed: ${result.name}`);
      }
    }
  } catch (e) {
    s.stop(false, 'Installation failed');
    ui.error((e as Error).message);
  }
}

export async function skillRemove(name: string): Promise<void> {
  const { SkillManager } = await import('@vibeclaw-ai/skills');
  const manager = new SkillManager();

  const removed = await manager.remove(name);
  if (removed) {
    ui.success(`Removed: ${name}`);
  } else {
    ui.error(`Skill not found: ${name}`);
  }
}

export async function skillScan(): Promise<void> {
  const { SkillManager } = await import('@vibeclaw-ai/skills');
  const manager = new SkillManager();

  const s = spinner('Scanning all installed skills...');
  const results = await manager.rescanAll();
  s.stop(true, `Scanned ${results.size} skills`);

  for (const [name, result] of results) {
    const icon = result.level === 'safe' || result.level === 'low' ? '\x1b[32m✓\x1b[0m' :
      result.level === 'medium' ? '\x1b[33m⚠\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${icon} ${name}: ${result.level} (${result.riskScore}/100, ${result.findings.length} findings)`);
  }
}

export async function skillSearch(query: string): Promise<void> {
  const { SkillManager } = await import('@vibeclaw-ai/skills');
  const manager = new SkillManager();

  const s = spinner(`Searching ClawHub for "${query}"...`);
  const results = await manager.searchClawHub(query);
  s.stop(true, `Found ${results.length} skills`);

  if (results.length === 0) {
    ui.info('No skills found. Try a different query.');
    return;
  }

  for (const r of results) {
    console.log(`  ${r.name} (v${r.version}) - ${r.description}`);
    ui.dim(`    by ${r.author} | ${r.downloads} downloads | ${r.stars} stars`);
  }

  ui.info('\nInstall with: vibeclaw-ai skill install <name>');
}
