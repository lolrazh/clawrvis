# Clawrvis - Project Plan

> An always-on, voice-first AI assistant powered by OpenClaw, built with Electrobun, running local speech models.

**Author:** lolrazh
**Date:** 2026-02-18
**Status:** Planning

---

## Table of Contents

1. [Vision](#vision)
2. [Core Philosophy](#core-philosophy)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Technology Research](#technology-research)
6. [Milestones](#milestones)
7. [Open Questions](#open-questions)

---

## Vision

Clawrvis is a personal, always-on AI assistant - a "Jarvis" that lives in your system tray and is always ready to talk. It acts as a **gateway to OpenClaw**, not a fork. OpenClaw handles the heavy lifting (agent runtime, multi-channel messaging, skills, memory), while Clawrvis provides the local desktop presence with voice interaction.

The assistant is accessible everywhere:
- **Desktop:** Electrobun tray app with voice (the primary interface we're building)
- **WhatsApp / Telegram / Discord / etc.:** Handled natively by OpenClaw's channel bridges
- **Voice:** Local STT (Moonshine) and TTS, so speech never leaves the machine

This is a personal tool first. No multi-user concerns, no onboarding flows, no hand-holding. If you can't set up a VPS, this isn't for you.

---

## Core Philosophy

- **Gateway, not a fork.** We don't maintain our own OpenClaw. We ride upstream. We extend via Skills, not source modifications.
- **Voice-first.** The primary interaction is speaking and listening. Text is a fallback.
- **Local speech.** STT and TTS run on the local machine. Audio never hits a cloud API. Privacy by architecture.
- **Always-on.** System tray app, global hotkey, near-zero idle resource usage. It's there when you need it.
- **Open source.** Less complicated. Community can use it, contribute, plug in their own OpenClaw instance.

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Desktop App** | [Electrobun](https://github.com/blackboardsh/electrobun) | 14MB bundle, <50ms startup, 15-30MB RAM. TypeScript-only DX. System tray support. Ideal for an always-on background app. |
| **AI Agent** | [OpenClaw](https://github.com/openclaw/openclaw) (remote, on VPS) | 200k+ star open-source agent with multi-channel support, skill system, memory, autonomous tool use. Already handles WhatsApp/Telegram/etc. |
| **STT (Speech-to-Text)** | [Moonshine Streaming](https://github.com/moonshine-ai/moonshine) (local) | 50ms latency on Apple Silicon, runs in-browser via ONNX/WASM/WebGPU. Streams partial transcripts in real-time. 26MB model (Tiny). |
| **TTS (Text-to-Speech)** | macOS native (initial), Piper/Kokoro (later) | macOS AVSpeechSynthesizer is zero-setup and instant. Upgrade path to higher-quality local models exists. |
| **Connection** | HTTPS + Bearer token to OpenClaw REST API | OpenClaw Gateway exposes REST on port 18789. Exposed via Tailscale Serve, Cloudflare Tunnel, or nginx reverse proxy. |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  YOUR MAC (local)                    │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │         Electrobun App ("Clawrvis")           │  │
│  │                                               │  │
│  │  ┌─────────────┐    ┌──────────────────────┐  │  │
│  │  │ Bun Main    │    │ WebView (WebKit)     │  │  │
│  │  │ Process     │    │                      │  │  │
│  │  │             │    │ - Chat UI            │  │  │
│  │  │ - Tray icon │    │ - Moonshine JS SDK   │  │  │
│  │  │ - Global    │    │   (STT in WASM/      │  │  │
│  │  │   hotkey    │    │    WebGPU)           │  │  │
│  │  │ - TTS       │    │ - Mic capture via    │  │  │
│  │  │   (macOS    │    │   Web Audio API      │  │  │
│  │  │    native)  │    │ - Audio visualizer   │  │  │
│  │  │ - OpenClaw  │    │                      │  │  │
│  │  │   API client│    │                      │  │  │
│  │  └──────┬──────┘    └──────────┬───────────┘  │  │
│  │         │   Typed RPC (IPC)    │              │  │
│  │         └──────────────────────┘              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ HTTPS (Tailscale / Cloudflare Tunnel / nginx)
                       │ POST /chat  { Bearer token }
                       │
┌──────────────────────▼──────────────────────────────┐
│                   YOUR VPS (remote)                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │            OpenClaw Gateway (:18789)           │  │
│  │                                               │  │
│  │  - Agent Runtime (LLM loop)                   │  │
│  │  - Session / Memory persistence               │  │
│  │  - WhatsApp bridge (linked device)            │  │
│  │  - Telegram bot                               │  │
│  │  - Discord bot                                │  │
│  │  - Skill execution (Docker sandbox)           │  │
│  │  - SOUL.md / IDENTITY.md / MEMORY.md          │  │
│  │                                               │  │
│  │  LLM Provider: Claude / GPT / Gemini / etc.   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Data Flow (Voice Interaction)

```
1. User presses global hotkey (or push-to-talk)
2. Mic activates → Web Audio API captures audio stream
3. Moonshine JS processes audio in webview (WASM/WebGPU)
   → Streams partial transcripts to UI in real-time
4. On speech end (VAD), final transcript sent via IPC to Bun main process
5. Bun main process POSTs to OpenClaw REST API on VPS:
   POST https://<vps>/chat
   Authorization: Bearer <token>
   { "message": "<transcribed text>", "session": "<session_id>" }
6. OpenClaw processes (agent loop, tool calls, etc.) → returns response text
7. Bun main process receives response → sends to macOS TTS
8. macOS speaks the response
9. Response text also displayed in webview chat UI
```

### Data Flow (Text Interaction)

```
1. User types in chat UI or uses global hotkey + typing
2. Text sent via IPC to Bun main process
3. Same POST to OpenClaw REST API
4. Response displayed in chat UI (and optionally spoken via TTS)
```

---

## Technology Research

### OpenClaw

- **What:** Open-source autonomous AI agent / personal assistant (200k+ GitHub stars)
- **Created by:** Peter Steinberger (now at OpenAI; project maintained via dedicated open-source foundation)
- **Architecture:** Hub-and-spoke. Persistent Gateway daemon (WebSocket/RPC, port 18789) + Agent Runtime
- **Tech stack:** TypeScript / Node.js
- **Multi-channel:** WhatsApp (linked device QR), Telegram, Slack, Discord, Signal, iMessage, Teams, Matrix, and more - all run simultaneously
- **Key capabilities:**
  - Autonomous tool use (shell, file I/O, browser automation)
  - Self-extending skills (agent writes its own code to learn new tasks)
  - Long-term semantic memory
  - Proactive automation (scheduled jobs, triggers)
  - Docker sandboxing for tool execution
  - Skill marketplace (community-contributed)
- **Extension model:** Skills (natural-language contracts in SKILL.md files), Plugins (TypeScript), Webhooks
- **REST API:** `POST /chat` on port 18789, bearer token auth. This is our integration point.
- **Hosting:** Runs on any Linux VPS, Mac, Docker, Cloudflare Workers. Single-user by design.
- **Exposure options:** Tailscale Serve (private), Tailscale Funnel (public), or your own reverse proxy
- **Config:** JSON (`~/.openclaw/openclaw.json`) + markdown personality files (SOUL.md, IDENTITY.md, USER.md, MEMORY.md)
- **Security note:** The project has drawn attention from security researchers. An infostealer targeting OpenClaw configs has been reported. The `prompt-security/clawsec` project provides hardening. Keep your bearer token secure.
- **Links:**
  - Repo: https://github.com/openclaw/openclaw
  - Docs: https://docs.openclaw.ai/start/getting-started
  - Site: https://openclaw.ai/

### Electrobun

- **What:** Open-source desktop app framework. "Rust-less Tauri" - Electron-like DX but 10x lighter.
- **Created by:** Blackboard Technologies
- **Architecture:** Bun runtime (main process) + system webviews (WebKit/Edge/WebKitGTK) + Zig native bindings + C++/ObjC++ platform layer
- **Performance vs Electron:**
  - Bundle: 14MB vs 150MB+ (10x smaller)
  - Startup: <50ms vs 2-5s (40-100x faster)
  - RAM: 15-30MB vs 100-200MB (5-7x less)
  - Updates: as small as 14KB via bsdiff differential patching
- **DX:** Pure TypeScript. No Rust, no C++ from developer perspective. Works with React, Vue, Svelte, SolidJS, etc.
- **Key features:**
  - System tray (Tray API with menus, click events)
  - Global keyboard shortcuts
  - Typed RPC between main and webview (process isolation)
  - Out-of-process iframes (`<electrobun-webview>`)
  - Built-in bundling, code signing, notarization, auto-updates
  - Cross-platform builds
- **Platform support:** macOS 14+ (ARM64 & Intel), Windows 11+, Ubuntu 22.04+
- **Maturity:** v1 released, ~4,250 GitHub stars, 9 contributors. Young but actively maintained (pushed today). MIT licensed.
- **Concerns:**
  - Small community (vs Electron's 115k stars)
  - WebView inconsistencies across platforms
  - Limited production battle-testing outside Blackboard's own product
  - Lifecycle management APIs for always-on apps may have gaps (need to validate)
- **Links:**
  - Repo: https://github.com/blackboardsh/electrobun
  - Docs: https://blackboard.sh/electrobun/docs/
  - v1 blog: https://blackboard.sh/blog/electrobun-v1/

### Moonshine Streaming (STT)

- **What:** Open-source, on-device ASR model and SDK for real-time voice applications
- **Created by:** Useful Sensors / Moonshine AI (Pete Warden, ex-Google TensorFlow)
- **Architecture:** Ergodic encoder (position-free sliding-window Transformer) + causal decoder. O(Tw) linear complexity. Constant TTFT regardless of utterance length.
- **Models:**
  - Tiny: 34M params, 26MB, 50ms latency on M3
  - Small: 123M params, 148ms latency
  - Medium: 245M params, 258ms latency
- **vs Whisper:** Moonshine Medium outperforms Whisper Large v3 on accuracy (6.65% vs 7.44% WER) while using 6x fewer params and running 43x faster
- **Runs on CPU.** No GPU required. ~8-29% CPU during transcription. Designed for edge/on-device.
- **Languages:** English (MIT), Spanish, Mandarin, Japanese, Korean, Vietnamese, Ukrainian, Arabic
- **JavaScript SDK:** `@moonshine-ai/moonshine-js` on npm
  - Runs in browser (Web Audio API + ONNX Runtime Web + WebGPU with WASM fallback)
  - TypeScript, full type definitions
  - MicrophoneTranscriber class with VAD (voice activity detection)
  - Events: `onTranscriptionUpdated` (partial), `onTranscriptionCommitted` (final)
  - **This runs in Electrobun's webview** since it IS a browser context (WebKit on macOS)
- **Python SDK:** `moonshine-voice` on PyPI (alternative if we need a sidecar)
- **Audio format:** 16kHz mono PCM float32 (resampled automatically)
- **Links:**
  - Repo: https://github.com/moonshine-ai/moonshine
  - JS SDK: https://github.com/moonshine-ai/moonshine-js
  - npm: https://www.npmjs.com/package/@moonshine-ai/moonshine-js
  - Docs: https://dev.moonshine.ai/
  - v2 paper: https://arxiv.org/html/2602.12241

### TTS (Text-to-Speech) - To Be Decided

Starting with macOS native TTS. Upgrade path:

| Option | Quality | Latency | How |
|---|---|---|---|
| **macOS AVSpeechSynthesizer** | Decent (Siri voices) | Instant | Built-in. Call from Bun main process via shell (`say` command) or native API. |
| **Piper TTS** | Good | Very fast | ONNX-based, runs on CPU. Multiple voice models available. |
| **Kokoro TTS** | Excellent | ~200ms | Newer model, high quality. Gaining traction in open-source community. |

---

## Milestones

### Milestone 1: Prove the Pipe

> Goal: Electrobun app sends a text message to OpenClaw on VPS and displays the response.

- [ ] Initialize Electrobun project
- [ ] Create minimal webview with a text input and response display
- [ ] Bun main process: HTTP client that POSTs to OpenClaw REST API
- [ ] Typed RPC between webview (text input) and main process (API call)
- [ ] Confirm round-trip works: type message → OpenClaw responds → display response
- [ ] Handle auth (bearer token from config/env)

**Success criteria:** You type "hello" in the app, OpenClaw responds, response appears in the app.

**No voice, no tray, no fancy UI.** Just the pipe.

---

### Milestone 2: Add Moonshine STT

> Goal: Speak into mic, see transcription, send to OpenClaw, see response.

- [ ] Install `@moonshine-ai/moonshine-js` in webview
- [ ] Load Moonshine Tiny model (26MB, downloads on first run)
- [ ] Implement MicrophoneTranscriber with VAD
- [ ] Display partial transcripts in real-time as user speaks
- [ ] On speech end, send final transcript to OpenClaw via existing pipe
- [ ] Display OpenClaw response as text

**Success criteria:** Press a button, speak, see your words appear in real-time, then see the AI response.

---

### Milestone 3: Add TTS

> Goal: OpenClaw's text response is spoken aloud. Full voice loop.

- [ ] Bun main process: invoke macOS `say` command (or AVSpeechSynthesizer via native API) with response text
- [ ] Choose a good Siri voice (e.g., Samantha, or one of the newer neural voices)
- [ ] Handle interruption (if user starts speaking while TTS is playing, stop TTS)
- [ ] Optional: stream TTS (start speaking before full response arrives, if OpenClaw supports streaming)

**Success criteria:** Speak a question, hear the answer spoken back. Full voice-in, voice-out loop.

---

### Milestone 4: Always-On Tray App

> Goal: Clawrvis lives in the system tray, activates via global hotkey, persists across sessions.

- [ ] System tray icon using Electrobun Tray API
- [ ] Tray menu: Open chat, Settings, Quit
- [ ] Global hotkey (e.g., Cmd+Shift+Space) to activate/show chat window
- [ ] App stays running when window is closed (tray-only mode)
- [ ] Push-to-talk: hold hotkey to speak, release to send
- [ ] Auto-launch at login (launchd plist or Login Items)
- [ ] Persist session ID across app restarts

**Success criteria:** Reboot Mac, app auto-starts in tray, press hotkey, speak, get voice response. Close window, app stays in tray.

---

### Milestone 5: Polish and Personality

> Goal: Make it feel like Jarvis, not a prototype.

- [ ] Chat UI polish (conversation history, markdown rendering, code blocks)
- [ ] Audio visualizer (waveform or orb animation while listening/speaking)
- [ ] Custom SOUL.md for Jarvis personality on OpenClaw
- [ ] Evaluate and potentially switch to Piper or Kokoro for TTS quality
- [ ] Evaluate Moonshine Small (123M) vs Tiny for accuracy tradeoff
- [ ] Notification support (OpenClaw proactive messages → native macOS notification)
- [ ] Error handling and reconnection logic for VPS connection drops
- [ ] Settings UI (VPS URL, auth token, voice selection, hotkey config)

---

### Future Ideas (Not Planned Yet)

- Wake word detection ("Hey Jarvis") instead of push-to-talk
- Screen context awareness (send screenshot to OpenClaw for visual understanding)
- Clipboard integration (auto-summarize copied text)
- Calendar/email integration via OpenClaw skills
- Mobile companion (OpenClaw already bridges to WhatsApp/Telegram, so this is "free")
- Multi-monitor awareness (show on active screen)
- Upgrade to Kokoro/Piper TTS for higher quality voice
- Conversation branching / multiple sessions

---

## Open Questions

1. **Electrobun lifecycle hooks:** Does Electrobun support preventing app quit when all windows close? Need to validate before Milestone 4.
2. **WebKit + Moonshine JS:** Does ONNX Runtime Web work reliably in macOS WebKit (not just Chrome)? WebGPU support in WebKit is still evolving - WASM fallback should work but need to test performance.
3. **OpenClaw streaming:** Does the REST API support streaming responses (SSE or chunked transfer)? If so, we can stream TTS instead of waiting for full response.
4. **Moonshine model download:** Where to store the 26MB model file? Electrobun app data directory? Need to handle first-run download gracefully.
5. **TTS quality:** Is macOS native TTS good enough long-term, or should we plan for Piper/Kokoro earlier?
6. **Session management:** How does OpenClaw handle session continuity? Do we need to manage session IDs, or does it handle that per-channel?
7. **Auth security:** Bearer token stored where? macOS Keychain via Electrobun, or a config file?

---

## Quick Reference

```bash
# OpenClaw API (on your VPS)
POST https://<your-vps>/chat
Authorization: Bearer <your-token>
Content-Type: application/json
{ "message": "hello jarvis" }

# Moonshine JS (in webview)
npm install @moonshine-ai/moonshine-js

# Electrobun
npm install electrobun

# macOS TTS (from Bun main process)
say -v Samantha "Hello, I am Jarvis"
```
