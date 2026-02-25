<div align="center">

# VibeClaw AI

### Your Free AI Assistant, Running on Your PC

ChatGPT Plus 구독만 있으면 무료로 쓰는 AI 비서.
PC 앱 + 웹 대시보드 + 텔레그램, 어디서든 내 AI.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows)](https://github.com/elon-choo/vibeclaw-ai/releases)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple)](https://github.com/elon-choo/vibeclaw-ai/releases)
[![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?logo=telegram)](https://t.me/vibeclaw_bot)

[English](#english) | [한국어](#한국어)

</div>

---

<a name="한국어"></a>

## 이게 뭔가요?

**VibeClaw AI**는 내 PC에서 돌아가는 무료 AI 비서입니다.

- ChatGPT Plus 구독($20/월)으로 **추가 비용 $0**
- **Windows / macOS / Linux** 모두 지원
- **데스크톱 앱** (Electron) - 클릭만으로 설치
- **웹 대시보드** - 브라우저에서 관리
- **텔레그램 봇** - 폰에서도 AI 사용
- 코딩도, 일반 질문도, 글쓰기도 다 됨

## 설치 (1분)

### 방법 1: 데스크톱 앱 (추천)
> Windows / macOS 앱 다운로드 → 더블 클릭 → ChatGPT 로그인 → 끝

[Windows 다운로드](#) | [macOS 다운로드](#)

### 방법 2: 터미널 (개발자)
```bash
npx vibeclaw-ai onboard
```

### 방법 3: 텔레그램
1. PC에서 `vibeclaw-ai` 설치 + ChatGPT 로그인
2. 텔레그램에서 @vibeclaw_bot 검색 → 시작
3. 끝! 폰에서 AI 사용 가능

## 뭘 할 수 있나요?

| 기능 | 설명 |
|------|------|
| 💬 **AI 채팅** | ChatGPT와 동일한 대화 (무제한) |
| 💻 **코딩 도움** | 코드 작성, 버그 수정, 리뷰 |
| 📝 **글쓰기** | 블로그, 이메일, 보고서, 번역 |
| 🔍 **질문 답변** | 무엇이든 물어보기 |
| 🤖 **자동 모드 전환** | 코딩/비서/창작 모드 자동 감지 |
| 💰 **비용 관리** | 토큰 사용량 추적, 일/월 한도 설정 |
| 🔒 **보안 스킬** | 스킬 설치 전 자동 보안 검사 |
| 📱 **텔레그램** | 폰에서도 AI 비서 사용 |

## 왜 VibeClaw AI?

OpenClaw(19만 스타)의 보안 강화 대안입니다.

| | OpenClaw | VibeClaw AI |
|---|---------|-------------|
| 비용 | 요금 폭탄 위험 | 토큰 예산 관리 |
| 보안 | 악성 스킬 20% | 설치 전 보안 스캔 |
| 프로바이더 | 단일 | ChatGPT + Claude + Gemini |
| 접근성 | CLI만 (개발자용) | **앱 + 웹 + 텔레그램** |
| OS | macOS/Linux | **Windows 포함** |

## 지원 AI 모델

| 모델 | 인증 | 비용 |
|------|------|------|
| **ChatGPT (Codex)** | OAuth 로그인 | **$0** (구독 포함) |
| **Claude** | OAuth 로그인 | ⚠️ 제3자 제한 |
| **Gemini** | OAuth 로그인 | ⚠️ 계정 위험 |

> Claude/Gemini OAuth는 각 회사 정책에 따라 계정 제한 위험이 있습니다.
> 경고를 확인한 후 본인 책임 하에 사용하세요. API Key 방식도 지원합니다.

## 아키텍처

```
사용자
  ├── 데스크톱 앱 (Electron)     ← Windows / macOS
  ├── 웹 대시보드 (localhost)    ← 브라우저
  ├── CLI (터미널)               ← 개발자
  └── 텔레그램 봇               ← 모바일

           ↓

VibeClaw AI Core
  ├── Hybrid Mode (코딩/비서/창작/검색 자동 전환)
  ├── Context Autopilot (자동 컨텍스트 최적화)
  ├── Token Budget Manager (비용 관리)
  └── Skill Sandbox (보안 검사)

           ↓

API Proxy (127.0.0.1:8317)
  ├── gpt-*     → ChatGPT Codex ($0)
  ├── claude-*  → Claude API
  └── gemini-*  → Gemini API
```

---

<a name="english"></a>

## What is this?

**VibeClaw AI** is a free AI assistant that runs on your PC.

- Uses your ChatGPT Plus subscription ($20/mo) — **$0 extra cost**
- **Windows + macOS + Linux**
- **Desktop app** (Electron) — one-click install
- **Web dashboard** — manage from your browser
- **Telegram bot** — AI on your phone
- Coding, questions, writing — it does everything

## Install (1 minute)

### Option 1: Desktop App (Recommended)
> Download → Double click → Login to ChatGPT → Done

[Download for Windows](#) | [Download for macOS](#)

### Option 2: Terminal (Developers)
```bash
npx vibeclaw-ai onboard
```

## CLI Commands

```
vibeclaw-ai onboard         # Setup wizard
vibeclaw-ai chat            # Chat with AI
vibeclaw-ai auth login      # Login (codex/claude/gemini)
vibeclaw-ai auth status     # Check all auth status
vibeclaw-ai proxy start     # Start API proxy
vibeclaw-ai budget          # View token usage
vibeclaw-ai skill install   # Install skill (with security scan)
vibeclaw-ai skill scan      # Scan all skills
vibeclaw-ai daemon install  # Background daemon
vibeclaw-ai telegram        # Telegram bot
```

## Development

```bash
git clone https://github.com/elon-choo/vibeclaw-ai.git
cd vibeclaw-ai
pnpm install
pnpm run build
```

## License

MIT — free for personal and commercial use.

---

<div align="center">

**Built in public** | **100% Open Source** | **Zero Cost AI**

</div>
