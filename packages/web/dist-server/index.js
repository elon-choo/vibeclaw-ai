// server/index.ts
import express from "express";
import cors from "cors";
import { authenticateOAuth, getAllAuthStatus } from "@vibeclaw-ai/auth";
import { BudgetTracker } from "@vibeclaw-ai/budget";
import { SkillManager } from "@vibeclaw-ai/skills";
import { Agent } from "@vibeclaw-ai/core";
import { loadVibeClawConfig, saveVibeClawConfig, initWorkspace, isInitialized } from "@vibeclaw-ai/workspace";
var app = express();
var PORT = 3177;
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3177"] }));
app.use(express.json());
var agent = null;
async function getAgent() {
  if (!agent) {
    agent = new Agent();
    await agent.init();
  }
  return agent;
}
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0" });
});
app.post("/api/chat", async (req, res) => {
  try {
    const { message, provider } = req.body;
    if (!message) {
      res.status(400).json({ error: "message required" });
      return;
    }
    const a = await getAgent();
    const result = await a.chat(message);
    res.json({
      text: result.text,
      model: result.model,
      mode: result.mode,
      usage: result.usage,
      matchedSkills: result.matchedSkills,
      budgetWarnings: result.budgetWarnings
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/chat/clear", async (_req, res) => {
  if (agent) agent.clearHistory();
  res.json({ ok: true });
});
app.get("/api/auth/status", async (_req, res) => {
  try {
    const statuses = await getAllAuthStatus();
    res.json(statuses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/auth/login/:provider", async (req, res) => {
  try {
    const provider = req.params.provider;
    if (!["codex", "claude", "gemini"].includes(provider)) {
      res.status(400).json({ error: "Invalid provider. Use: codex, claude, gemini" });
      return;
    }
    res.json({ status: "oauth_started", provider, message: "Check your browser for login" });
    authenticateOAuth(provider).catch((e) => {
      console.error(`[Auth] ${provider} OAuth failed:`, e.message);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/budget", async (_req, res) => {
  try {
    const tracker = new BudgetTracker();
    const status = await tracker.getStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/budget/set", async (req, res) => {
  try {
    const tracker = new BudgetTracker();
    const limits = await tracker.setLimits(req.body);
    res.json(limits);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/skills", async (_req, res) => {
  try {
    const manager = new SkillManager();
    const skills = await manager.list();
    res.json(skills);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/skills/install", async (req, res) => {
  try {
    const { name } = req.body;
    const manager = new SkillManager();
    const result = await manager.installFromClawHub(name);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/skills/scan", async (_req, res) => {
  try {
    const manager = new SkillManager();
    const results = await manager.rescanAll();
    const entries = [...results.entries()].map(([name, scan]) => ({ name, ...scan }));
    res.json(entries);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete("/api/skills/:name", async (req, res) => {
  try {
    const manager = new SkillManager();
    const removed = await manager.remove(req.params.name);
    res.json({ removed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/config", async (_req, res) => {
  try {
    const config = await loadVibeClawConfig();
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/config", async (req, res) => {
  try {
    const updated = await saveVibeClawConfig(req.body);
    agent = null;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/workspace/status", async (_req, res) => {
  try {
    res.json({ initialized: isInitialized() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/workspace/init", async (_req, res) => {
  try {
    const result = await initWorkspace();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.listen(PORT, () => {
  console.log(`[VibeClaw AI] API server running on http://localhost:${PORT}`);
  console.log(`[VibeClaw AI] Dashboard: http://localhost:5173`);
});
