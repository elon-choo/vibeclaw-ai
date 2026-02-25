# Show HN: VibeClaw AI - Open-source AI agent using your ChatGPT subscription ($0 API cost)

**URL**: https://github.com/vibeclaw-ai/vibeclaw-ai

I built VibeClaw AI, an open-source AI agent that uses your existing ChatGPT Plus subscription instead of API keys. $0 additional cost.

## Why?

OpenClaw hit 196K stars by making AI agents extensible with SKILL.md files. But it has two big problems:

1. **Cost explosions** - No budget controls. Users regularly get surprised by $100+ API bills.
2. **Security** - ~20% of skills on ClawHub contain malicious patterns (credential theft, command injection, crypto mining).

## What VibeClaw AI does differently

- **Token Budget Manager**: Set daily/monthly limits. Get warned at 80%. Auto-blocked at 100%.
- **Secure Skill Sandbox**: Every skill is scanned for 12 threat patterns before installation. Critical risks are quarantined.
- **Context Autopilot**: No manual context configuration. Analyzes conversation → selects relevant files → packs within token budget.
- **Hybrid Agent Mode**: Auto-detects if you need coding help, general assistance, or creative writing. Switches system prompt and model accordingly.
- **ClawHub Compatible**: Use OpenClaw's 3,286 skills, but with a security layer.

## How it works

Uses ChatGPT's Codex backend via OAuth (same as the official Codex CLI). Your $20/mo ChatGPT Plus subscription covers everything.

```bash
npx vibeclaw-ai onboard   # 5-step setup wizard
vibeclaw-ai chat           # Start chatting
vibeclaw-ai proxy start    # API proxy for other tools
vibeclaw-ai daemon install # 24/7 background mode
```

Works via CLI and Telegram. macOS daemon for always-on operation.

## Tech

- TypeScript monorepo (10 packages, pnpm + Turborepo)
- OAuth PKCE for ChatGPT authentication
- Built-in API proxy with model-prefix routing
- LaunchAgent daemon for macOS
- MIT licensed

Feedback welcome. Particularly interested in what security patterns we should add to the skill scanner.

---

**r/LocalLLaMA version:**

Title: **VibeClaw AI: Open-source AI agent that uses your ChatGPT subscription instead of API keys - OpenClaw alternative with security built in**

Body: [Same as above, slightly more casual tone]
