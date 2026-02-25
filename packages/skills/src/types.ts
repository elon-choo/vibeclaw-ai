/** Parsed SKILL.md manifest */
export interface SkillManifest {
  /** Skill name (directory name) */
  name: string;
  /** Human-readable title from markdown H1 */
  title: string;
  /** Description */
  description: string;
  /** Trigger phrases that activate this skill */
  triggers: string[];
  /** Required permissions */
  permissions: SkillPermission[];
  /** Source: local, clawhub, or custom registry */
  source: 'local' | 'clawhub' | 'registry';
  /** Skill version */
  version?: string;
  /** Author */
  author?: string;
  /** Raw SKILL.md content */
  rawContent: string;
  /** Security scan result */
  security?: SecurityScanResult;
}

/** Permission levels for skills */
export type SkillPermission =
  | 'read-fs'       // Read files
  | 'write-fs'      // Write/create files
  | 'execute'       // Run shell commands
  | 'network'       // Make HTTP requests
  | 'env-vars'      // Access environment variables
  | 'clipboard'     // Access clipboard
  | 'notifications' // Send notifications
  | 'none';         // No special permissions

/** Security scan result */
export interface SecurityScanResult {
  /** Overall risk score (0-100, lower is safer) */
  riskScore: number;
  /** Risk level */
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  /** Specific findings */
  findings: SecurityFinding[];
  /** Scan timestamp */
  scannedAt: string;
  /** SHA-256 hash of SKILL.md content at scan time */
  contentHash: string;
}

/** Individual security finding */
export interface SecurityFinding {
  /** Severity */
  severity: 'info' | 'warning' | 'danger' | 'critical';
  /** Finding type */
  type: string;
  /** Human-readable description */
  message: string;
  /** Line number in SKILL.md (if applicable) */
  line?: number;
}

/** ClawHub registry entry */
export interface ClawHubSkill {
  name: string;
  description: string;
  author: string;
  downloads: number;
  stars: number;
  url: string;
  version: string;
  tags: string[];
}

/** Skill installation result */
export interface SkillInstallResult {
  success: boolean;
  name: string;
  path: string;
  security: SecurityScanResult;
  /** Whether user approval was required */
  approvalRequired: boolean;
}
