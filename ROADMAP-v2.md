# Vibepity Roadmap v2.0 - IDE 기반 피봇

> 2026-02-26 | VS Code Web 기반으로 피봇

---

## 핵심 방향

**"npx vibepity → 브라우저에서 VS Code가 열리는 무료 AI IDE"**

비개발자도 바이브코딩할 수 있는 웹 IDE. ChatGPT 구독으로 $0 추가 비용.

---

## OpenClaw 대비 차별점

| OpenClaw 문제 | Vibepity 해결 |
|--------------|--------------|
| CLI 전용 (터미널 공포) | **브라우저 VS Code** (친숙한 UI) |
| Docker 필수 (설치 30분) | **npx 한 줄** (설치 30초) |
| TUI 불투명 (멈춤 구분 불가) | **VS Code 사이드바** (실시간 스트리밍) |
| 보안 무방비 | **스킬 보안 스캔** |
| 설정 파일 수동 편집 | **GUI 설정 패널** |

---

## 아키텍처 (v3)

```
npx vibepity
    ↓
code-server (VS Code Web) → http://localhost:8080
    ├── 파일 탐색기 (프로젝트 파일)
    ├── 에디터 (코드 편집 / 마크다운 편집)
    ├── Vibepity 사이드바 (VS Code Extension)
    │   ├── AI 채팅 (Codex/Claude/Gemini)
    │   ├── 모드 전환 (코딩/비서/창작/검색)
    │   ├── 프로바이더 선택
    │   ├── OAuth 로그인 버튼
    │   └── 스킬 관리
    ├── 터미널 (숨김 가능)
    └── 미리보기 패널 (웹앱 실시간 프리뷰)

    + Telegram 연동 (모바일 접근)
    + API Proxy (127.0.0.1:8317)
```

---

## 구현 단계

### Phase 1: code-server 통합 (1주)
- [ ] code-server 자동 다운로드 + 실행
- [ ] `npx vibepity` → code-server 시작 → 브라우저 자동 오픈
- [ ] 프로젝트 디렉토리 자동 설정 (~/.vibepity/workspace/)
- [ ] 기본 VS Code 설정 (테마, 폰트, 한글)

### Phase 2: VS Code Extension (1주)
- [ ] Vibepity 사이드바 패널 (Webview)
  - AI 채팅 UI (현재 packages/web/src/pages/Chat.tsx 재사용)
  - 프로바이더 선택 드롭다운
  - OAuth 로그인 버튼
  - 모드 표시 (코딩/비서/창작/검색)
- [ ] 에디터 통합
  - 선택한 코드 → AI에게 설명/수정 요청
  - AI 응답에서 코드 블록 → 에디터에 삽입
  - 인라인 코드 제안 (ghost text)
- [ ] 명령 팔레트 통합
  - `Vibepity: Chat` → 사이드바 열기
  - `Vibepity: Login` → OAuth 시작
  - `Vibepity: Switch Model` → 모델 변경

### Phase 3: 원클릭 경험 (3일)
- [ ] `npx vibepity` 실행 시:
  1. Node.js 버전 체크
  2. code-server 자동 설치 (없으면)
  3. Vibepity Extension 자동 설치
  4. OAuth 로그인 (첫 실행 시)
  5. 브라우저 자동 오픈 → VS Code 준비 완료
- [ ] 설치 전체 소요: **30초 이하**

### Phase 4: 비서 모드 강화 (1주)
- [ ] 파일 기반 비서 (문서 작성, 메일 초안, 번역)
- [ ] 워크스페이스 자동 구성 (바이브코딩 프로젝트 vs 비서 모드)
- [ ] 마크다운 프리뷰 패널

---

## 경쟁 포지셔닝

```
가격 ↑ (비쌈)
│
│  Cursor ($20/월)     Bolt.new ($30/월)
│  Windsurf ($15/월)   Lovable ($25/월)
│
│─────────────────────────────────────────→ 접근성 (쉬움)
│
│  Claude Code         OpenClaw
│  (터미널)            (Docker+CLI)
│
│  ★ Vibepity ($0) ←── 여기
│  (브라우저 VS Code + AI + 무료)
│
가격 ↓ (무료)
```

**Vibepity = 무료 Cursor + 비서 기능 + 웹 접근**

---

## 기술 스택

| 컴포넌트 | 기술 |
|----------|------|
| 웹 IDE | code-server (VS Code Web) |
| 사이드바 | VS Code Extension API (Webview) |
| 프론트엔드 | React 19 + TypeScript |
| 백엔드 | Express API (기존 packages/web/server) |
| AI 프로바이더 | Codex OAuth($0) + Claude API + Gemini API |
| 설치 | npx (Node.js만 필요) |
| 빌드 | pnpm + Turborepo + tsup |

---

*Vibepity Roadmap v2.0 | 2026-02-26*
