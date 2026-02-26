import { spawn, type ChildProcess } from 'node:child_process';
import { loadProxyConfig, savePid, loadPid, clearPid } from './config.js';
import type { ProxyConfig, ProxyStatus } from './types.js';

/**
 * CLIProxyAPI wrapper - manages the proxy process lifecycle.
 *
 * CLIProxyAPI routes model-prefixed requests to different backends:
 *   gpt-*    → Codex OAuth (chatgpt.com/backend-api, $0)
 *   claude-* → Claude OAuth (api.anthropic.com)
 *   gemini-* → Gemini OAuth (generativelanguage.googleapis.com)
 */
export class ProxyManager {
  private process: ChildProcess | null = null;
  private config: ProxyConfig | null = null;
  private startedAt: number | null = null;

  /**
   * Start the proxy. Uses CLIProxyAPI if installed,
   * otherwise falls back to the built-in lightweight proxy.
   */
  async start(): Promise<ProxyStatus> {
    // Check if already running
    const status = await this.status();
    if (status.running) return status;

    this.config = await loadProxyConfig();

    // Try CLIProxyAPI first (system-installed)
    const cliProxyPath = await this.findCliProxy();
    if (cliProxyPath) {
      return this.startCliProxy(cliProxyPath);
    }

    // Fall back to built-in proxy
    return this.startBuiltinProxy();
  }

  /**
   * Stop the proxy process.
   */
  async stop(): Promise<void> {
    const pid = await loadPid();

    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    } else if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Process may already be gone
      }
    }

    this.startedAt = null;
    await clearPid();
  }

  /**
   * Check proxy health by hitting the health endpoint.
   */
  async healthCheck(): Promise<boolean> {
    const config = this.config ?? await loadProxyConfig();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`http://127.0.0.1:${config.port}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get proxy status.
   */
  async status(): Promise<ProxyStatus> {
    const config = this.config ?? await loadProxyConfig();
    const pid = this.process?.pid ?? await loadPid();
    const running = pid ? await this.isProcessAlive(pid) : false;

    if (!running && pid) {
      await clearPid();
    }

    return {
      running,
      pid: running ? pid ?? undefined : undefined,
      port: running ? config.port : undefined,
      uptime: running && this.startedAt ? Date.now() - this.startedAt : undefined,
    };
  }

  /**
   * Get the base URL for API clients to use.
   */
  getBaseUrl(): string {
    const port = this.config?.port ?? 8317;
    return `http://127.0.0.1:${port}`;
  }

  private async findCliProxy(): Promise<string | null> {
    // Check common installation paths
    const { execSync } = await import('node:child_process');
    try {
      const result = execSync('which cli-proxy-api 2>/dev/null || which CLIProxyAPI 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      return result || null;
    } catch {
      return null;
    }
  }

  private async startCliProxy(binaryPath: string): Promise<ProxyStatus> {
    const config = this.config!;

    this.process = spawn(binaryPath, ['--port', String(config.port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    if (this.process.pid) {
      await savePid(this.process.pid);
    }

    this.startedAt = Date.now();

    // Detach so it survives parent exit
    this.process.unref();

    // Wait for proxy to be ready
    await this.waitForReady(config.port);

    return this.status();
  }

  private async startBuiltinProxy(): Promise<ProxyStatus> {
    // Built-in lightweight proxy using Node.js http
    // This is a minimal pass-through that adds OAuth tokens to requests
    const config = this.config!;
    const { createServer } = await import('node:http');
    const { getValidToken } = await import('@vibepity/auth');

    const server = createServer(async (req, res) => {
      // Health endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '0.1.0-builtin' }));
        return;
      }

      // Route based on model in request body
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = Buffer.concat(chunks).toString();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(body);
        } catch {
          // Not JSON, pass through
        }

        const model = (parsed.model as string) ?? '';
        const route = config.routes.find(r => {
          const regex = new RegExp('^' + r.pattern.replace(/\*/g, '.*') + '$');
          return regex.test(model);
        });

        if (!route) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `No route for model: ${model}` }));
          return;
        }

        // Build upstream request headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'vibepity-proxy/0.1.0',
        };

        if (route.backend.auth === 'codex-oauth') {
          const tokens = await getValidToken();
          if (!tokens) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not authenticated. Run: vibepity onboard' }));
            return;
          }
          headers['Authorization'] = `Bearer ${tokens.access_token}`;

          // Codex requires stream: true
          parsed.stream = true;
          if (!parsed.instructions && parsed.messages) {
            // Convert Chat Completions format to Codex format
            const messages = parsed.messages as Array<{ role: string; content: string }>;
            const systemMsg = messages.find(m => m.role === 'system');
            if (systemMsg) {
              parsed.instructions = systemMsg.content;
              parsed.input = messages.filter(m => m.role !== 'system');
            } else {
              parsed.input = messages;
            }
            delete parsed.messages;
          }
          parsed.store = false;
          parsed.reasoning = parsed.reasoning ?? { summary: 'auto' };
        } else if (route.backend.auth === 'claude-oauth') {
          const claudeTokens = await getValidToken('claude');
          if (!claudeTokens) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Claude not authenticated. Run: vibepity auth login claude' }));
            return;
          }
          // Claude Messages API format
          headers['x-api-key'] = claudeTokens.access_token;
          headers['anthropic-version'] = '2024-01-01';
          // Convert Chat Completions format to Claude Messages format
          if (parsed.messages) {
            const messages = parsed.messages as Array<{ role: string; content: string }>;
            const systemMsg = messages.find(m => m.role === 'system');
            if (systemMsg) {
              parsed.system = systemMsg.content;
            }
            parsed.messages = messages.filter(m => m.role !== 'system').map(m => ({
              role: m.role === 'system' ? 'user' : m.role,
              content: m.content,
            }));
            parsed.max_tokens = parsed.max_tokens ?? 4096;
          }

        } else if (route.backend.auth === 'gemini-oauth') {
          const geminiTokens = await getValidToken('gemini');
          if (!geminiTokens) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Gemini not authenticated. Run: vibepity auth login gemini' }));
            return;
          }
          headers['Authorization'] = `Bearer ${geminiTokens.access_token}`;
          // Convert Chat Completions format to Gemini format
          if (parsed.messages) {
            const messages = parsed.messages as Array<{ role: string; content: string }>;
            const systemMsg = messages.find(m => m.role === 'system');
            parsed.contents = messages.filter(m => m.role !== 'system').map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            }));
            if (systemMsg) {
              parsed.systemInstruction = { parts: [{ text: systemMsg.content }] };
            }
            parsed.generationConfig = { maxOutputTokens: parsed.max_tokens ?? 4096 };
            delete parsed.messages;
            delete parsed.model;
            delete parsed.max_tokens;
          }
          // Gemini URL includes model name
          const geminiModel = model || 'gemini-2.5-flash';
          const geminiUrl = `${route.backend.url}/${geminiModel}:generateContent`;
          // Override upstream URL for this request
          (route as { _overrideUrl?: string })._overrideUrl = geminiUrl;

        } else if (route.backend.auth === 'api-key') {
          const apiKey = route.backend.apiKeyEnv
            ? process.env[route.backend.apiKeyEnv]
            : undefined;
          if (!apiKey) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `API key not set: ${route.backend.apiKeyEnv}` }));
            return;
          }
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // Forward to upstream
        const upstreamUrl = (route as { _overrideUrl?: string })._overrideUrl ?? route.backend.url;
        delete (route as { _overrideUrl?: string })._overrideUrl;
        const upstreamRes = await fetch(upstreamUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(parsed),
        });

        // Stream response back
        res.writeHead(upstreamRes.status, {
          'Content-Type': upstreamRes.headers.get('content-type') ?? 'application/json',
        });

        if (upstreamRes.body) {
          const reader = upstreamRes.body.getReader();
          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          };
          await pump();
        } else {
          const text = await upstreamRes.text();
          res.end(text);
        }
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
    });

    return new Promise((resolve) => {
      server.listen(config.port, '127.0.0.1', async () => {
        this.startedAt = Date.now();
        const pid = process.pid;
        await savePid(pid);

        console.log(`[Vibepity Proxy] Listening on 127.0.0.1:${config.port} (built-in)`);
        resolve({
          running: true,
          pid,
          port: config.port,
          version: '0.1.0-builtin',
        });
      });
    });
  }

  private async waitForReady(port: number, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 1000);
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: controller.signal,
        });
        clearTimeout(t);
        if (res.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Proxy did not become ready within ${timeoutMs / 1000}s`);
  }

  private async isProcessAlive(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
