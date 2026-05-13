# bbGPT — Shared Project Memory
# Read by: Claude (via CLAUDE.md), Cursor (via .cursorrules), Human (Davey)
# Updated: 2026-05-08
# Purpose: Eliminate context re-loading. Both AIs read this first.

---

## ✅ BUILD STATUS: GREEN + CLAUDE LIVE (as of 2026-05-08 ~5:30 PM)

All TypeScript errors resolved. OpenRouter key added to Vercel (env only; not in repo). Claude Haiku/Sonnet/Opus now live on bbgpt.ai.
Check deployment: https://vercel.com/cant-lose-gaming/postforge

---

## WHAT THIS IS
bbGPT (bbgpt.ai) — a multi-model AI chat SaaS built by Davey McKellar.
Single interface for GPT-4o, Gemini 2.5 Flash, and Claude.
Pay-as-you-go credits starting at $1.99. 7-day free trial, no card required.
Personal context system — AI learns who you are across sessions.

**Live at:** https://www.bbgpt.ai
**Instagram:** @bbgptofficial
**Reddit:** Personal account (mkellerdavey / No_Tie6163)
**Email:** mckellardavey@gmail.com

---

## TECH STACK
- Framework: Next.js 16.2.2 App Router (Turbopack)
- Primary LLM: Z.AI / GLM (z-ai-web-dev-sdk)
- Fallback LLM: OpenAI
- Image + attachments: Gemini server routes
- Billing: Stripe (pay-as-you-go credits + subscriptions)
- Email: Resend
- Database: Postgres via Drizzle ORM (Neon)
- Hosting: Vercel (production)
- Repo: C:\Users\mckel\postforge

---

## WHAT'S BEEN BUILT & DEPLOYED (COMPLETED)

### Engineering — Groq Free-Tier Fallback (added 2026-05-08 by Claude/Cowork) ✅ DEPLOYED
- [x] src/lib/groq-api.ts — NEW: Groq integration (Llama 3.3 70B free tier)
  - streamGroqChat() — streaming path, OpenAI-compatible
  - groqChatCompletionJson() — non-streaming for billing/agent planner
  - GROQ_API_KEY already set in Vercel env (key: gsk_0XOd...)
- [x] src/lib/llm-resolve.ts — "groq" provider added to LlmResolved union type
- [x] src/app/api/chat/route.ts — Groq streaming branch added
- [x] src/app/api/chat/agent/route.ts — Groq planner branch added
- [x] src/lib/billing-llm.ts — All 5 providers handled (openai/anthropic/openrouter/groq/zai)
- [x] src/app/api/community/debate/route.ts — zai provider guard fixed
- [x] src/lib/anthropic-api.ts — type cast fix pushed (commit 23be8dc, 2026-05-08)
- Provider fallback chain: Z.AI → OpenAI → Anthropic → OpenRouter → Groq

### Engineering — Multi-Model Hub (added 2026-05-07 by Claude/Cowork)
- [x] src/lib/anthropic-api.ts — Full Claude streaming via raw HTTP (no SDK needed)
  - Claude Haiku / Sonnet / Opus support
  - Converts Anthropic SSE → OpenAI-compatible SSE (client needs ZERO changes)
  - Extended thinking support for Sonnet + Opus
  - Non-streaming path for agent loop planner steps
- [x] src/lib/types.ts — ModelTier extended: claude-haiku | claude-sonnet | claude-opus
- [x] src/lib/model-tier.ts — Claude tiers registered in TIERS array
- [x] src/lib/llm-resolve.ts — Claude provider path; Claude tiers auto-route to Anthropic → OpenRouter fallback
- [x] src/app/api/chat/route.ts — Anthropic + OpenRouter streaming branches added
- [x] src/app/api/chat/agent/route.ts — Agent loop wired to Claude + OpenRouter for planning steps
- [x] src/lib/agent-loop.ts — anthropicApiKey + openrouterApiKey params in planner loop
- [x] src/lib/kolmogorov-router.ts — Claude family routing (Haiku/Sonnet/Opus smart tier)
- [x] src/lib/openai-api.ts — Claude tiers added to safety fallback map
- [x] src/lib/openrouter-api.ts — NEW: OpenRouter integration (Claude via OpenAI-compat API)
  - streamOpenRouterChat() — streaming path, zero client changes needed
  - openRouterChatCompletionJson() — non-streaming for agent planner
  - Model map: claude-haiku/sonnet/opus → anthropic/* OpenRouter IDs
  - Fallback order: ANTHROPIC_API_KEY first → OPENROUTER_API_KEY if Anthropic has no credits
- [x] Deployed 2026-05-07 — Status: Ready Latest (55s), www.bbgpt.ai live

### Engineering — Skills & Research (added 2026-05-07)
- [x] src/lib/built-in-skills.ts — 8 new skills added:
  - Instagram Caption Writer (Social)
  - Hashtag Strategy (Social)
  - 30-Day Content Calendar (Social)
  - Viral Hook Generator (Social)
  - Social Media Audit (Social)
  - Competitor Analysis (Social)
  - Weekly Review (Productivity)
  - Deep Research (Research)
- [x] src/lib/tools/deep-research.ts — Multi-step research tool (decomposes → searches → synthesises)
- [x] src/lib/tools/index.ts — deepResearchTool registered in ALL_TOOLS

### Engineering — Companion Intelligence (added 2026-05-07, completed 2026-05-07)
- [x] src/lib/companion-onboarding.ts — buildCompanionSystemPrompt(), deriveToneDirective(), CompanionIntake
- [x] src/lib/agent-memory.ts — structuredIntake in AgentMemory, setJourneyIntake(), generateMemoryPrompt uses buildCompanionSystemPrompt
- [x] src/components/BbGPTClient.tsx — companion intake fully wired:
  - onIntroIntakeComplete calls setCompanionIntakeFromQuestionnaire (stores flat + structured)
  - generateMemoryPrompt(loadMemory()) at sendMessage builds rich system prompt automatically
  - journeyGateOpen state + onJourneyComplete + openJourneyQuestionnaire handlers
  - JourneyIntakeModal rendered when journeyGateOpen=true
- [x] src/components/JourneyIntakeModal.tsx — NEW: 7-question journey (mountaintop) questionnaire
  - Optional flow opened from Settings (non-blocking unlike intro)
  - Saves via setJourneyIntake() into structuredIntake.journey in local memory
  - Adds vision context (mountaintop, ideal day, flow activities, etc.) to every reply
- [x] src/components/SettingsPanel.tsx — added onOpenJourneyQuestionnaire prop + button
- [x] src/components/QuantumControls.tsx — Claude models now visible in model dropdown:
  - GLM_MODELS and CLAUDE_MODELS split into optgroups (GLM / Claude Anthropic)
  - Labels: "Claude Haiku", "Claude Sonnet", "Claude Opus" (not raw tier strings)
  - Disabled with "↑ upgrade" suffix when not on plan
  - Thinking tooltip is Claude-aware

### Engineering — Previous
- [x] PWA meta tags in layout.tsx
- [x] Mobile responsive fixes (globals.css, ChatInput, SubscriptionModal, SettingsPanel, Sidebar, etc.)
- [x] BbGPTClient.tsx duplicate useEffect fixed
- [x] ProactiveToast safe-area-inset padding
- [x] Enterprise plan tier added to plans.ts
- [x] Credit top-up API route: /api/stripe/topup
- [x] Top-up UI added to SubscriptionModal
- [x] proxy.ts migration (Next.js 16 middleware convention)
- [x] cleanup-proxy.mjs prebuild script (deletes middleware.ts before each build)
- [x] DATABASE_URL pinned in .env.local (Vercel env pull masks it)

### SEO Landing Pages (live on bbgpt.ai)
- [x] /chatgpt-alternative — targets "ChatGPT alternative 2026"
- [x] /gemini-alternative — targets "Gemini alternative"
- [x] /ai-chat-credits — targets pay-as-you-go AI searchers
- [x] /claude-alternative — targets "Claude alternative" (built 2026-05-07, deploy pending)
- [x] /perplexity-alternative — targets "Perplexity alternative" (built 2026-05-07, deploy pending)
All pages have: metadata, canonical URLs, OG tags, UTM-tracked CTAs

### Growth Assets (saved to postforge/growth/)
- [x] ProductHunt listing (250-word description + maker comment) — NOT YET SUBMITTED
- [x] 2x Reddit posts written (r/SideProject, r/artificial)
- [x] 6-tweet Twitter/X thread written
- [x] 30-day Instagram content calendar
- [x] Instagram bio optimization copy
- [x] UTM tracking parameters for all channels
- [x] 5-email trial → paid conversion sequence (growth/email-sequence.md, 2026-05-07)

### Instagram
- [x] @bbgptofficial account active
- [x] Day 1 post live: "ALL YOUR AI. ONE PLACE." graphic
- [x] Story created with music (mobile)
- [ ] Bio not yet updated to recommended version

### Reddit
- [x] r/SideProject post live (personal account)
- [x] IP blocked on reddit.com/prefs/apps (CAPTCHA loop) — clears in 24-48h
- [ ] 9 remaining Reddit posts pending karma building
- [ ] Reddit API credentials pending (create at reddit.com/prefs/apps tomorrow)

### Automation Tools
- [x] Desktop/reddit-karma-bot/reddit_assistant.py — monitors 9 subreddits, drafts comments, human-approves
- [x] Desktop/reddit-karma-bot/bbgpt_growth_system.py — multi-platform scheduler (Reddit/Twitter/Buffer)
- [x] Desktop/social-media-manager/ — **NEW: Full web dashboard** (built 2026-05-08)
  - Flask web app → open at http://localhost:5000
  - Instagram 30-day calendar pre-loaded, mark posts done, track progress
  - Twitter thread (6 tweets) with one-click copy
  - Reddit post queue (5 subreddits) with copy + status tracking
  - ProductHunt listing with launch checklist
  - AI content generator (Groq-powered, free, key already set)
  - Credential manager for Reddit/Twitter/Buffer
  - Launch: double-click Desktop/social-media-manager/start.bat

---

## CREDENTIALS NEEDED (NOT YET OBTAINED)
These are the only blockers to full automation:

| Platform | Status | Where to Get |
|----------|--------|--------------|
| Reddit API | ✅ Dev account created | reddit.com/prefs/apps → create app → get client_id + secret |
| Anthropic API Credits | ⚠️ $0 balance | console.anthropic.com/billing → add credits for production use |
| OpenRouter API Key | ✅ DONE (2026-05-08) | Key created, saved to .env.local + Vercel, redeployed — Claude models live |
| Twitter API | ❌ Not obtained | developer.twitter.com |
| Buffer API | ❌ Not obtained | buffer.com/developers |

**⚡ Fastest path to enable Claude on bbgpt.ai (free, 5 min):**
1. Go to https://openrouter.ai/keys
2. Create free account → generate key
3. In Vercel: Settings → Environment Variables → add OPENROUTER_API_KEY
4. Redeploy → Claude Haiku/Sonnet/Opus available immediately, no Anthropic billing needed

Once obtained: paste into Desktop/social-media-manager/credentials page AND Desktop/reddit-karma-bot/bbgpt_growth_system.py CREDENTIALS block.

---

## CURRENT OBJECTIVES (NEXT SESSIONS)

### Priority 0 — Deploy the Multi-Model Hub ✅ FULLY DEPLOYED
- [x] Add ANTHROPIC_API_KEY to .env.local and Vercel environment variables (2026-05-07)
- [x] Build OpenRouter fallback — Claude works even with $0 Anthropic balance (2026-05-07)
  - OPENROUTER_API_KEY placeholder added to .env.local
  - Get key at openrouter.ai/keys → add to Vercel env vars → Claude works immediately
- [x] All 4 files wired: openrouter-api.ts, llm-resolve.ts, chat/route.ts, agent/route.ts
- [x] Deployed via Vercel redeploy — Status: Ready Latest (55s), www.bbgpt.ai live
- [x] ~~Wire companion intake as memoryPrompt~~ — DONE
- [x] ~~Wire model dropdown to show Claude~~ — DONE
- [x] ~~Journey questionnaire storage~~ — DONE
- NOTE: To enable Claude NOW (free): go to openrouter.ai → create account → get API key → add OPENROUTER_API_KEY to Vercel → redeploy

### Priority 1 — Immediate (Today)
- [ ] Post Twitter/X thread (get developer.twitter.com API key OR post manually)
- [ ] Post Reddit posts to: r/IMadeThis, r/alphaandbetausers (low karma gate)
- [ ] Update @bbgptofficial Instagram bio to recommended version

### Priority 2 — Now Unblocked
- [x] Reddit developer account created (email confirmed 2026-05-07 for No_Tie6163)
- [ ] Go to reddit.com/prefs/apps → create script app → paste client_id + secret into bbgpt_growth_system.py
- [ ] Run reddit_assistant.py for first time
- [ ] Submit ProductHunt listing (copy in growth/launch-assets.md)

### Priority 3 — This Week
- [ ] Set up ManyChat on Instagram (comment "AI" → auto-DM trial link)
- [ ] Set up Buffer.com for Instagram scheduling (30-day calendar)
- [ ] Post remaining 8 Reddit posts as karma builds

### Priority 4 — Next Week
- [x] Email sequence for trial → paid conversion (growth/email-sequence.md — needs Resend wiring)
- [ ] Analyze trial signup source data (UTM tracking)
- [x] Build /claude-alternative SEO page (built + deployed 2026-05-07)
- [x] Build /perplexity-alternative SEO page (built + deployed 2026-05-07)

---

## KEY DECISIONS MADE
- Pay-as-you-go credits (not flat subscription) — still being validated
- proxy.ts is canonical middleware file (middleware.ts deleted by prebuild)
- UTM tracking on all links (GA or Vercel Analytics via NEXT_PUBLIC_GA_ID)
- Personal Reddit account (not brand account) — more karma, more trust
- Reddit 90/10 rule: 90% value, 10% product mention

---

## DEPLOY COMMAND
```
cd C:\Users\mckel\postforge
npm run build && npm run deploy:prod
```
Or double-click: C:\Users\mckel\postforge\bbgpt-build-deploy.bat

---

## IMPORTANT FILE LOCATIONS
- Project root: C:\Users\mckel\postforge
- Growth assets: C:\Users\mckel\postforge\growth\launch-assets.md
- Reddit bot: C:\Users\mckel\Desktop\reddit-karma-bot\
- PC optimizer: C:\Users\mckel\Desktop\optimize-pc\
- Env file: C:\Users\mckel\postforge\.env.local
- This file: C:\Users\mckel\postforge\PROJECT_STATE.md

---

## DAVEY'S WORKING STYLE NOTES
- Prefers Claude to take over and execute, not guide
- Voice-to-text input — interpret loosely, don't correct
- Wants automation, not back-and-forth
- Big picture thinker — connect dots between tasks
- Goal: bbGPT generating revenue, growing audience, running on autopilot
