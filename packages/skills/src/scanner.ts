import { createHash } from 'node:crypto';
import type { SecurityScanResult, SecurityFinding } from './types.js';

/**
 * Dangerous patterns to detect in SKILL.md files.
 * Addresses OpenClaw's ~20% malicious skill problem.
 */
const DANGER_PATTERNS: Array<{
  pattern: RegExp;
  severity: SecurityFinding['severity'];
  type: string;
  message: string;
}> = [
  // Command injection
  {
    pattern: /\$\(.*\)|`.*`|eval\s*\(|exec\s*\(/gi,
    severity: 'critical',
    type: 'command-injection',
    message: 'Potential command injection detected',
  },
  // Exfiltration
  {
    pattern: /curl\s+.*\|.*sh|wget\s+.*\|.*sh|nc\s+-/gi,
    severity: 'critical',
    type: 'remote-execution',
    message: 'Remote code execution pattern detected',
  },
  // Credential theft
  {
    pattern: /\.(env|credentials|ssh|aws|gcloud|azure)\b.*\b(cat|read|send|upload|post)\b/gi,
    severity: 'critical',
    type: 'credential-theft',
    message: 'Potential credential exfiltration detected',
  },
  // Sensitive file access
  {
    pattern: /\/etc\/passwd|\/etc\/shadow|~\/\.ssh\/|~\/\.aws\/|~\/\.gnupg\//gi,
    severity: 'danger',
    type: 'sensitive-file-access',
    message: 'Access to sensitive system files',
  },
  // Environment variable exfiltration
  {
    pattern: /process\.env|os\.environ|\$\{?\w*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)\w*\}?/gi,
    severity: 'warning',
    type: 'env-access',
    message: 'Accesses environment variables (may contain secrets)',
  },
  // Network exfiltration
  {
    pattern: /fetch\s*\(|http\.request|XMLHttpRequest|axios\.|got\(|node-fetch/gi,
    severity: 'warning',
    type: 'network-access',
    message: 'Makes network requests (data could be exfiltrated)',
  },
  // File system writes
  {
    pattern: /fs\.write|writeFile|appendFile|createWriteStream/gi,
    severity: 'info',
    type: 'fs-write',
    message: 'Writes to file system',
  },
  // Shell execution
  {
    pattern: /child_process|spawn\s*\(|execSync|shelljs|execa/gi,
    severity: 'warning',
    type: 'shell-execution',
    message: 'Executes shell commands',
  },
  // Obfuscation
  {
    pattern: /Buffer\.from\s*\(\s*['"].*['"]\s*,\s*['"]base64['"]\)|atob\s*\(|String\.fromCharCode/gi,
    severity: 'danger',
    type: 'obfuscation',
    message: 'Potential code obfuscation (base64/charcode encoding)',
  },
  // Crypto mining
  {
    pattern: /stratum\+tcp|coinhive|cryptonight|monero|xmrig/gi,
    severity: 'critical',
    type: 'crypto-mining',
    message: 'Cryptocurrency mining related content',
  },
  // Privilege escalation
  {
    pattern: /sudo\s+|chmod\s+[0-7]*7|chown\s+root/gi,
    severity: 'danger',
    type: 'privilege-escalation',
    message: 'Attempts to escalate privileges',
  },
  // Data collection
  {
    pattern: /navigator\.|screen\.|location\.href|document\.cookie/gi,
    severity: 'warning',
    type: 'data-collection',
    message: 'Browser data collection detected',
  },
];

/**
 * Scan SKILL.md content for security issues.
 * Returns a SecurityScanResult with risk score and findings.
 */
export function scanSkill(content: string): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  const lines = content.split('\n');

  for (const { pattern, severity, type, message } of DANGER_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        findings.push({ severity, type, message, line: i + 1 });
      }
    }
  }

  // Calculate risk score
  const riskScore = calculateRiskScore(findings);
  const level = riskScoreToLevel(riskScore);

  return {
    riskScore,
    level,
    findings,
    scannedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(content).digest('hex'),
  };
}

function calculateRiskScore(findings: SecurityFinding[]): number {
  const weights: Record<SecurityFinding['severity'], number> = {
    info: 2,
    warning: 10,
    danger: 25,
    critical: 50,
  };

  const raw = findings.reduce((sum, f) => sum + weights[f.severity], 0);
  return Math.min(100, raw);
}

function riskScoreToLevel(score: number): SecurityScanResult['level'] {
  if (score === 0) return 'safe';
  if (score <= 10) return 'low';
  if (score <= 30) return 'medium';
  if (score <= 60) return 'high';
  return 'critical';
}
