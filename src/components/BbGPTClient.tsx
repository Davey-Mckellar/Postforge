"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
  clearCompanionIntake,
  detectAndSaveVoiceCalibration,
  generateMemoryPrompt,
  loadMemory,
  saveMemory,
  saveMood,
  setCompanionIntakeFromQuestionnaire,
  updateMemoryFromConversation,
  type AgentMemory,
} from "@/lib/agent-memory";
import { INTRO_SEVEN_QUESTIONS } from "@/lib/companion-onboarding";
import {
  clearIntroIntake,
  isIntroIntakeComplete,
  saveIntroIntake,
} from "@/lib/onboarding-intake-storage";
import { startHeartbeat } from "@/lib/heartbeat";
import { addReminder, parseReminderFromMessage } from "@/lib/reminders";
import {
  extractSseTextDelta,
  extractSseThinkingDelta,
  parseSseAgentMeta,
} from "@/lib/stream-parse";
import type { Skill } from "@/lib/skill-model";
import { lsKey } from "@/lib/storage";
import { skillSystemPrompt, suggestSkillForMessage } from "@/lib/skills";
import { getClientMaxFileBytes } from "@/lib/attachment-config";
import { DEFAULT_ATTACHMENT_BYTES, nearestPresetBytes } from "@/lib/attachment-presets";
import { filesToChatAttachments } from "@/lib/file-attachments";
import { speakAssistantMessage } from "@/lib/speech-synthesis";
import type { ChatAttachment, ChatMessage, Conversation, ModelTier } from "@/lib/types";
import {
  adjustBalance,
  creditMonthKey,
  hydrateCredits,
  loadCreditsState,
  saveCreditsState,
  setPlan,
  type CreditsStateV1,
} from "@/lib/credits-store";
import { fetchChatWithRetry, formatChatError } from "@/lib/fetch-chat";
import { planRank, type PowerTemplate } from "@/lib/instant-templates";
import { inferMood } from "@/lib/mood-engine";
import type { BillingAlertPayload, UsageHint } from "@/lib/billing-usage-hints";
import { APP_VERSION } from "@/lib/app-version";
import { markCapsuleOpened, nextDueTimeCapsule, type TimeCapsule } from "@/lib/time-capsule";
import {
  applyUiPreferences,
  footerShellClass,
  headerShellClass,
  loadUiPreferences,
  mainChatShellClass,
  subBannerClass,
  appRootBgClass,
  type UiPreferences,
} from "@/lib/ui-preferences";
import { PLANS, planAllowsModel, type PlanBillingCadence, type PlanId, type PlanDefinition } from "@/lib/plans";
import { schrodingerPair } from "@/lib/schrodinger-pair";
import { uiDiag } from "@/lib/ui-diagnostics";
import {
  describeCost,
  estimateSendCredits,
  planPermitsSend,
  type SendMode,
} from "@/lib/usage-cost";
import { ProactiveToast } from "./ProactiveToast";
import { ChatArea } from "./ChatArea";
import { ChatInput } from "./ChatInput";
import { CostPreview } from "./CostPreview";
import { SmartActions } from "./SmartActions";
import { CommunityPanel } from "./CommunityPanel";
import { QuantumControls, type QuantumFlags } from "./QuantumControls";
import { SearchOverlay } from "./SearchOverlay";
import { Sidebar } from "./Sidebar";
import { SkillsPanel } from "./SkillsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { SubscriptionModal, type StripeBillingInfo } from "./SubscriptionModal";
import { TimeCapsuleReveal } from "./TimeCapsuleReveal";
import { OnboardingIntakeModal } from "./OnboardingIntakeModal";

const CONV_KEY = lsKey("conversations");
const ACTIVE_KEY = lsKey("active_conversation_id");

function pickModelForPlan(preferred: ModelTier, plan: PlanDefinition): ModelTier {
  if (planAllowsModel(plan, preferred)) return preferred;
  const order: ModelTier[] = ["glm-4", "glm-4-long", "glm-4-plus", "glm-4-air", "glm-4-flash"];
  for (const m of order) {
    if (planAllowsModel(plan, m)) return m;
  }
  return plan.allowedModels[0]!;
}

function loadConvos(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

export default function BbGPTClient() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<ModelTier>("glm-4-flash");
  const [thinking, setThinking] = useState(false);
  const [schrodinger, setSchrodinger] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [quantum, setQuantum] = useState<QuantumFlags>({
    kolmogorov: false,
    holographic: false,
    dna: false,
    adiabatic: 0.5,
  });
  const [communityOpen, setCommunityOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [routingReason, setRoutingReason] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [skillHint, setSkillHint] = useState<Skill | null>(null);
  /** Composer text -- drives skills, mood, and templates */
  const [chatDraft, setChatDraft] = useState("");
  /** Optional image-only prompt when the main composer is empty (ChatGPT-style image flow). */
  const [imagePromptExtra, setImagePromptExtra] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [readAloud, setReadAloud] = useState(false);
  const readAloudRef = useRef(false);
  const [attachmentLimitBytes, setAttachmentLimitBytes] = useState(DEFAULT_ATTACHMENT_BYTES);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  /** Aborts in-flight chat SSE when starting a new send or clicking Stop. */
  const streamAbortRef = useRef<AbortController | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; body: string; draft: string; open: boolean }>>([]);
  const [introGateOpen, setIntroGateOpen] = useState(false);
  /** Mirrors local questionnaire + memory; drives Welcome copy and Settings redo. */
  const [introIntakeDone, setIntroIntakeDone] = useState(false);
  const [credits, setCredits] = useState<CreditsStateV1 | null>(null);
  /** Server wallet + login gate (when BBGPT_APP_PASSWORD is set). */
  const [serverCredits, setServerCredits] = useState(false);
  /** Stripe linkage from GET /api/credits (when gate on, or env-only flags when gate off). */
  const [stripeBilling, setStripeBilling] = useState<StripeBillingInfo | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [billingAlert, setBillingAlert] = useState<BillingAlertPayload | null>(null);
  const [usageHints, setUsageHints] = useState<UsageHint[]>([]);
  const [billingAlertLocalDismiss, setBillingAlertLocalDismiss] = useState(false);
  const [uiPrefs, setUiPrefs] = useState<UiPreferences | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeCapsuleReveal, setTimeCapsuleReveal] = useState<TimeCapsule | null>(null);
  /** Below `md`: slide-over for chat list (sidebar). */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /** Left-edge swipe from the chat pane opens the drawer on narrow viewports. */
  const mobileEdgeSwipeRef = useRef<{ x: number; y: number } | null>(null);
  const notifEnabledRef = useRef(false);

  useEffect(() => {
    const p = loadUiPreferences();
    applyUiPreferences(p);
    setUiPrefs(p);
  }, []);

  useEffect(() => {
    // Check localStorage first for instant render, then reconcile with server.
    const localDone = isIntroIntakeComplete();
    setIntroGateOpen(!localDone);
    setIntroIntakeDone(localDone);

    void (async () => {
      try {
        const res = await fetch("/api/profile/journey", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          source?: string;
          complete?: boolean;
          answers?: string[];
          completedAt?: number;
        };
        if (data.source !== "server" || !data.complete || !Array.isArray(data.answers)) return;
        // Server has answers -- sync to localStorage and mark complete regardless of local state.
        saveIntroIntake(data.answers);
        setCompanionIntakeFromQuestionnaire(INTRO_SEVEN_QUESTIONS, data.answers);
        setIntroGateOpen(false);
        setIntroIntakeDone(true);
      } catch {
        // Non-fatal: local state is already set above.
      }
    })();
  }, []);

  useEffect(() => {
    notifEnabledRef.current = Boolean(uiPrefs?.notificationsEnabled);
  }, [uiPrefs?.notificationsEnabled]);

  useEffect(() => {
    function tick() {
      setTimeCapsuleReveal((cur) => {
        if (cur) return cur;
        return nextDueTimeCapsule();
      });
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setBillingAlertLocalDismiss(false);
  }, [billingAlert?.at]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const narrow = () => window.matchMedia("(max-width: 767px)").matches;
    if (mobileNavOpen && narrow()) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    document.body.style.overflow = "";
    return undefined;
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setMobileNavOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const showBillingBanner = useMemo(() => {
    if (!billingAlert || billingAlertLocalDismiss) return false;
    if (typeof sessionStorage !== "undefined") {
      if (
        sessionStorage.getItem(`bbgpt_dismiss_billing_${billingAlert.at}`) === "1" ||
        sessionStorage.getItem(`babygpt_dismiss_billing_${billingAlert.at}`) === "1"
      )
        return false;
    }
    return true;
  }, [billingAlert, billingAlertLocalDismiss]);

  const dismissBillingAlert = useCallback(() => {
    if (!billingAlert) return;
    sessionStorage.setItem(`bbgpt_dismiss_billing_${billingAlert.at}`, "1");
    setBillingAlertLocalDismiss(true);
  }, [billingAlert]);

  useEffect(() => {
    setConversations(loadConvos());
    setActiveId(localStorage.getItem(ACTIVE_KEY));
  }, []);

  useEffect(() => {
    try {
      if (
        localStorage.getItem("bbgpt_read_aloud") === "1" ||
        localStorage.getItem("babygpt_read_aloud") === "1"
      )
        setReadAloud(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    readAloudRef.current = readAloud;
  }, [readAloud]);

  useEffect(() => {
    setAttachmentLimitBytes(nearestPresetBytes(getClientMaxFileBytes()));
  }, []);

  const setAttachmentLimitPersist = useCallback((bytes: number) => {
    try {
      localStorage.setItem("bbgpt_max_file_bytes_override", String(bytes));
    } catch {
      /* ignore */
    }
    setAttachmentLimitBytes(nearestPresetBytes(bytes));
  }, []);

  const setReadAloudPersist = useCallback((v: boolean) => {
    setReadAloud(v);
    try {
      localStorage.setItem("bbgpt_read_aloud", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const res = await fetch("/api/credits", { credentials: "include" });
        const data = (await res.json()) as {
          source?: string;
          planId?: PlanId;
          balance?: number;
          accrualMonth?: string;
          welcomeApplied?: boolean;
          billingAlert?: BillingAlertPayload | null;
          usageHints?: UsageHint[];
          stripe?: {
            configured?: boolean;
            customerId?: string | null;
            subscriptionStatus?: string | null;
          };
        };
        if (cancelled) return;
        if (data.stripe && typeof data.stripe.configured === "boolean") {
          setStripeBilling({
            configured: data.stripe.configured,
            customerId: data.stripe.customerId ?? null,
            subscriptionStatus: data.stripe.subscriptionStatus ?? null,
          });
        }
        if (data.billingAlert?.kind === "payment_failed") {
          setBillingAlert(data.billingAlert);
        } else {
          setBillingAlert(null);
        }
        if (Array.isArray(data.usageHints)) {
          setUsageHints(data.usageHints);
        } else {
          setUsageHints([]);
        }
        if (data.source === "server" && typeof data.balance === "number" && data.planId) {
          setServerCredits(true);
          setCredits({
            version: 1,
            planId: data.planId,
            balance: data.balance,
            accrualMonth: data.accrualMonth ?? creditMonthKey(),
            welcomeApplied: Boolean(data.welcomeApplied),
          });
          return;
        }
      } catch {
        /* local fallback */
      }
      if (cancelled) return;
      setBillingAlert(null);
      setUsageHints([]);
      const raw = loadCreditsState();
      const h = hydrateCredits(raw, PLANS[raw.planId].monthlyCredits);
      saveCreditsState(h);
      setCredits(h);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!subscriptionOpen) return;
    let cancelled = false;
    async function refreshBilling() {
      try {
        const res = await fetch("/api/credits", { credentials: "include", cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          source?: string;
          planId?: PlanId;
          balance?: number;
          accrualMonth?: string;
          welcomeApplied?: boolean;
          billingAlert?: BillingAlertPayload | null;
          usageHints?: UsageHint[];
          stripe?: {
            configured?: boolean;
            customerId?: string | null;
            subscriptionStatus?: string | null;
          };
        };
        if (cancelled) return;
        if (data.stripe && typeof data.stripe.configured === "boolean") {
          setStripeBilling({
            configured: data.stripe.configured,
            customerId: data.stripe.customerId ?? null,
            subscriptionStatus: data.stripe.subscriptionStatus ?? null,
          });
        }
        if (Array.isArray(data.usageHints)) {
          setUsageHints(data.usageHints);
        }
        if (data.source === "server" && typeof data.balance === "number" && data.planId) {
          setServerCredits(true);
          setCredits({
            version: 1,
            planId: data.planId,
            balance: data.balance,
            accrualMonth: data.accrualMonth ?? creditMonthKey(),
            welcomeApplied: Boolean(data.welcomeApplied),
          });
        }
      } catch {
        /* ignore */
      }
    }
    void refreshBilling();
    return () => {
      cancelled = true;
    };
  }, [subscriptionOpen]);

  const openStripeCheckout = useCallback(
    async (planId: Exclude<PlanId, "free">, billing: PlanBillingCadence = "monthly") => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, billing }),
    });
    const data = (await res.json()) as { error?: string; url?: string };
    if (!res.ok) {
      setBanner(data.error ?? "Checkout could not start.");
      setSubscriptionOpen(false);
      return;
    }
    if (!data.url) {
      setBanner("Checkout did not return a redirect URL. Check Stripe keys and server logs.");
      setSubscriptionOpen(false);
      return;
    }
    window.location.href = data.url;
  }, []);

  const openStripePortal = useCallback(async () => {
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      credentials: "include",
    });
    const data = (await res.json()) as { error?: string; url?: string };
    if (!res.ok) {
      setBanner(data.error ?? "Could not open the billing portal.");
      return;
    }
    if (!data.url) {
      setBanner("Portal did not return a URL. Ensure you have an active Stripe customer (subscribe once first).");
      return;
    }
    window.location.href = data.url;
  }, []);

  const scrollToQuantumBar = useCallback(() => {
    document.getElementById("bbgpt-quantum-bar")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const activePlanId = credits?.planId;
  useEffect(() => {
    if (!activePlanId) return;
    const p = PLANS[activePlanId];
    setModel((cur) => (planAllowsModel(p, cur) ? cur : p.allowedModels[0]));
    setAgentMode((a) => (p.features.agent ? a : false));
    setSchrodinger((s) => (p.features.schrodinger ? s : false));
    setQuantum((q) => ({
      kolmogorov: p.features.kolmogorov ? q.kolmogorov : false,
      holographic: p.features.holographic ? q.holographic : false,
      dna: p.features.dna ? q.dna : false,
      adiabatic: p.features.dna ? q.adiabatic : 0.5,
    }));
  }, [activePlanId]);

  useEffect(() => {
    try {
      localStorage.setItem(CONV_KEY, JSON.stringify(conversations));
    } catch {
      // ignore quota
    }
  }, [conversations]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (introGateOpen) return;
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [introGateOpen]);

  /** Keep search closed while connection intake is blocking (avoids hidden overlay under the modal). */
  useEffect(() => {
    if (introGateOpen) setSearchOpen(false);
  }, [introGateOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  const convRef = useRef(conversations);
  const activeRef = useRef(activeId);
  useEffect(() => {
    convRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const stop = startHeartbeat({
      getLastUserMessage: () => {
        const c = convRef.current.find((x) => x.id === activeRef.current);
        const last = [...(c?.messages ?? [])].reverse().find((m) => m.role === "user");
        return last?.content ?? null;
      },
      onSuggest: (s) => {
        setToasts((prev) => {
          const base = s.id.startsWith("retro-") ? prev.filter((x) => !x.id.startsWith("retro-")) : prev;
          return [...base, { ...s, open: true }];
        });
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          notifEnabledRef.current &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(s.title, { body: s.body.slice(0, 240) });
          } catch {
            /* ignore */
          }
        }
      },
    });
    return stop;
  }, []);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const lastUserBubble = useMemo(() => {
    const msgs = active?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === "user") return msgs[i]!.content;
    }
    return "";
  }, [active?.messages]);

  const lastAssistantText = useMemo(() => {
    const msgs = active?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === "assistant" && msgs[i]!.content.trim()) return msgs[i]!.content;
    }
    return "";
  }, [active?.messages]);

  const mood = useMemo(
    () => {
      const m = inferMood(`${chatDraft}\n${lastUserBubble}`);
      saveMood(m.id as AgentMemory["moodId"]);
      return m;
    },
    [chatDraft, lastUserBubble],
  );

  const applyPowerTemplate = useCallback(
    (t: PowerTemplate) => {
      if (!credits) {
        setBanner("Loading credits…");
        return;
      }
      const plan = PLANS[credits.planId];
      if (planRank(plan.id) < planRank(t.minPlan)) {
        setBanner(`That template needs ${t.minPlan}+ -- open Plans to upgrade.`);
        setSubscriptionOpen(true);
        return;
      }
      const a = t.apply;
      setModel(pickModelForPlan(a.model, plan));
      setThinking(a.thinking && plan.features.thinking);
      setAgentMode(a.agentMode && plan.features.agent);
      setSchrodinger(a.schrodinger && plan.features.schrodinger);
      setQuantum(() => ({
        kolmogorov: plan.features.kolmogorov ? a.quantum.kolmogorov : false,
        holographic: plan.features.holographic ? a.quantum.holographic : false,
        dna: plan.features.dna ? a.quantum.dna : false,
        adiabatic: a.quantum.adiabatic,
      }));
      setChatDraft(a.draft);
      setBanner(null);
    },
    [credits],
  );

  const upsertConversation = useCallback((next: Conversation) => {
    setConversations((prev) => {
      const i = prev.findIndex((c) => c.id === next.id);
      if (i === -1) return [next, ...prev];
      const copy = [...prev];
      copy[i] = next;
      return copy.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const newChat = useCallback(() => {
    const id = uuidv4();
    const conv: Conversation = {
      id,
      title: "New chat",
      updatedAt: Date.now(),
      messages: [],
    };
    upsertConversation(conv);
    setActiveId(id);
  }, [upsertConversation]);

  const onDelete = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  useEffect(() => {
    setSkillHint(suggestSkillForMessage(chatDraft));
  }, [chatDraft]);

  const sendMessage = useCallback(
    async (text: string, options?: { regenerate?: boolean }) => {
      const regenerate = options?.regenerate === true;
      const trimmed = text.trim();
      if (!regenerate && !trimmed && pendingFiles.length === 0) return;

      if (!isIntroIntakeComplete()) {
        setBanner("Finish the connection questionnaire to start chatting.");
        return;
      }

      if (!credits) {
        setBanner("Loading credits… try again in a moment.");
        return;
      }

      const planDef = PLANS[credits.planId];
      const useSchrodinger = schrodinger && !agentMode;
      const mode: SendMode = agentMode ? "agent" : useSchrodinger ? "schrodinger" : "chat";
      const schPair = schrodingerPair(model, planDef.allowedModels);
      /** Multimodal attachments always use `/api/chat/gemini` (billed as chat, thinking off) -- match labels + credit math. */
      const attachmentMultimodal = !regenerate && pendingFiles.length > 0;
      if (attachmentMultimodal && (agentMode || useSchrodinger)) {
        setBanner("File attachments use Gemini -- turn off Agent and Two models for this chat.");
        return;
      }
      const costMode: SendMode = attachmentMultimodal ? "chat" : mode;
      const costThinking = attachmentMultimodal ? false : thinking;
      const costInput = {
        model,
        thinking: costThinking,
        mode: costMode,
        quantum: {
          kolmogorov: quantum.kolmogorov,
          holographic: quantum.holographic,
          dna: quantum.dna,
        },
        secondaryModel: costMode === "schrodinger" ? schPair.modelB : undefined,
      };
      if (!planPermitsSend(planDef, costInput)) {
        uiDiag("send.planGate", "fail", {
          planId: planDef.id,
          model,
          mode: costMode,
          quantum: costInput.quantum,
          secondaryModel: costInput.secondaryModel,
        });
        setBanner(
          `Not included on ${planDef.label}: adjust model, modes, or quantum toggles -- or open Plans to upgrade.`,
        );
        return;
      }
      uiDiag("send.planGate", "ok", {
        planId: planDef.id,
        model,
        mode: costMode,
        quantum: costInput.quantum,
        secondaryModel: costInput.secondaryModel,
      });
      const costCore = { model, thinking: costThinking, mode: costMode };
      const cost = estimateSendCredits(costCore);
      if (credits.balance < cost) {
        uiDiag("send.credits", "fail", { need: cost, balance: credits.balance });
        setBanner(
          `Need ${cost} credits for this send (${describeCost(costCore, cost)}). Balance: ${credits.balance}. Open Plans.`,
        );
        return;
      }

      let loadedAttachments: ChatAttachment[] | undefined;
      if (!regenerate && pendingFiles.length > 0) {
        const conv = await filesToChatAttachments(pendingFiles, { modelTier: model });
        if (!conv.ok) {
          setBanner(conv.error);
          return;
        }
        loadedAttachments = conv.attachments;
        setPendingFiles([]);
      }

      if (!regenerate && trimmed) {
        detectAndSaveVoiceCalibration(trimmed);
      }

      let reminderForBanner: ReturnType<typeof parseReminderFromMessage> = null;
      if (!regenerate) {
        reminderForBanner = parseReminderFromMessage(trimmed);
        if (reminderForBanner) {
          addReminder({
            id: uuidv4(),
            text: reminderForBanner.reminderText,
            triggerAt: reminderForBanner.at,
            createdAt: Date.now(),
          });
          setBanner(`Reminder set for ${new Date(reminderForBanner.at).toLocaleString()}`);
        }
      }

      streamAbortRef.current?.abort();
      const ac = new AbortController();
      streamAbortRef.current = ac;

      setBusy(true);
      if (regenerate) {
        setBanner(null);
      } else if (!reminderForBanner) {
        setBanner(null);
      }
      setRoutingReason(null);

      let convId: string;
      let withUser: Conversation;
      let assistantId: string;

      if (regenerate) {
        if (!activeId) {
          setBanner("Open a chat to regenerate the last reply.");
          setBusy(false);
          streamAbortRef.current = null;
          return;
        }
        const prev = conversations.find((c) => c.id === activeId);
        if (!prev?.messages.length) {
          setBusy(false);
          streamAbortRef.current = null;
          return;
        }
        const last = prev.messages[prev.messages.length - 1];
        if (last.role !== "assistant") {
          setBanner("Regenerate replaces the last assistant message -- send a message first.");
          setBusy(false);
          streamAbortRef.current = null;
          return;
        }
        convId = activeId;
        const trimmedMsgs = prev.messages.slice(0, -1);
        withUser = {
          ...prev,
          messages: trimmedMsgs,
          updatedAt: Date.now(),
        };
        upsertConversation(withUser);
        setActiveId(convId);
        const mem = updateMemoryFromConversation(withUser);
        saveMemory(mem);
        assistantId = uuidv4();
        const assistantShell: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          toolCalls: [],
          errorCorrectionLog: [],
        };
        upsertConversation({
          ...withUser,
          updatedAt: Date.now(),
          messages: [...withUser.messages, assistantShell],
        });
      } else {
        convId = activeId ?? uuidv4();
        const prev = conversations.find((c) => c.id === convId);
        const userMsg: ChatMessage = {
          id: uuidv4(),
          role: "user",
          content: trimmed || (loadedAttachments?.length ? "📎 Attached files" : ""),
          createdAt: Date.now(),
          attachments: loadedAttachments,
        };

        const base: Conversation =
          prev ??
          ({
            id: convId,
            title: trimmed.slice(0, 72) || "New chat",
            updatedAt: Date.now(),
            messages: [],
          } satisfies Conversation);

        withUser = {
          ...base,
          title: base.title === "New chat" ? trimmed.slice(0, 72) : base.title,
          updatedAt: Date.now(),
          messages: [...base.messages, userMsg],
        };

        upsertConversation(withUser);
        setActiveId(convId);

        const mem = updateMemoryFromConversation(withUser);
        saveMemory(mem);

        assistantId = uuidv4();
        const assistantShell: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          toolCalls: [],
          errorCorrectionLog: [],
        };

        upsertConversation({
          ...withUser,
          updatedAt: Date.now(),
          messages: [...withUser.messages, assistantShell],
        });
      }

      const memoryPrompt = generateMemoryPrompt(loadMemory());
      const skillPrompt = skillSystemPrompt(activeSkill);

      const payloadMessages = withUser.messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));

      const useGemini = withUser.messages.some(
        (m) => m.role === "user" && (m.attachments?.length ?? 0) > 0,
      );

      const endpoint = useGemini
        ? "/api/chat/gemini"
        : useSchrodinger
          ? "/api/chat/schrodinger"
          : agentMode
            ? "/api/chat/agent"
            : "/api/chat";

      const body = useGemini
        ? JSON.stringify({
            messages: payloadMessages,
            model,
            memoryPrompt,
            skillPrompt: skillPrompt || undefined,
          })
        : useSchrodinger
          ? JSON.stringify({
              messages: payloadMessages,
              modelA: schPair.modelA,
              modelB: schPair.modelB,
            })
          : JSON.stringify({
              messages: payloadMessages,
              model,
              thinking: thinking ? "on" : "off",
              memoryPrompt,
              skillPrompt: skillPrompt || undefined,
              quantum: {
                kolmogorov: quantum.kolmogorov,
                holographic: quantum.holographic,
                dna: quantum.dna,
                adiabatic: quantum.adiabatic,
              },
            });

      let res: Response;
      try {
        res = await fetchChatWithRetry(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: ac.signal,
        });
      } catch (e) {
        setBusy(false);
        setStreamingAssistantId(null);
        streamAbortRef.current = null;
        if (e instanceof DOMException && e.name === "AbortError") {
          uiDiag("send.fetch", "skip", { reason: "abort" });
          setBanner("Generation stopped.");
          return;
        }
        uiDiag("send.fetch", "fail", { error: String(e) });
        setBanner("Network error -- check your connection and try again.");
        return;
      }

      const rr =
        res.headers.get("X-bbGPT-Routing-Reason") ?? res.headers.get("X-BabyGPT-Routing-Reason");
      if (rr) setRoutingReason(decodeURIComponent(rr));

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        uiDiag("send.http", "fail", { endpoint, status: res.status, error: err.error });
        setBanner(formatChatError(res.status, err.error));
        setBusy(false);
        streamAbortRef.current = null;
        return;
      }
      uiDiag("send.http", "ok", { endpoint, status: res.status });

      const reader = res.body?.getReader();
      if (!reader) {
        setBanner("No response stream");
        setBusy(false);
        streamAbortRef.current = null;
        return;
      }

      setStreamingAssistantId(assistantId);

      const dec = new TextDecoder();
      let buffer = "";
      let acc = "";
      let thinkingAcc = "";
      let streamCompleted = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith("data:")) continue;
            const payload = trimmedLine.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const j = JSON.parse(payload) as { schrodinger?: boolean; winner?: string };
              if (j.schrodinger && j.winner) {
                setBanner(`Two models · winning stream: ${j.winner}`);
              }
            } catch {
              // ignore
            }

            const meta = parseSseAgentMeta(trimmedLine);
            if (meta) {
              setConversations((prev) => {
                const c = prev.find((x) => x.id === convId);
                if (!c) return prev;
                const msgs = c.messages.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: meta.toolCalls,
                        errorCorrectionLog: meta.errorCorrectionLog,
                      }
                    : m,
                );
                return prev
                  .map((x) => (x.id === convId ? { ...x, messages: msgs, updatedAt: Date.now() } : x))
                  .sort((a, b) => b.updatedAt - a.updatedAt);
              });
              continue;
            }

            acc += extractSseTextDelta(trimmedLine);
            thinkingAcc += extractSseThinkingDelta(trimmedLine);
          }

          setConversations((prev) => {
            const c = prev.find((x) => x.id === convId);
            if (!c) return prev;
            const msgs = c.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: acc,
                    thinking: thinkingAcc.trim() || undefined,
                  }
                : m,
            );
            return prev
              .map((x) => (x.id === convId ? { ...x, messages: msgs, updatedAt: Date.now() } : x))
              .sort((a, b) => b.updatedAt - a.updatedAt);
          });
        }

        buffer += dec.decode();
        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith("data:")) continue;
            const meta = parseSseAgentMeta(trimmedLine);
            if (meta) {
              setConversations((prev) => {
                const c = prev.find((x) => x.id === convId);
                if (!c) return prev;
                const msgs = c.messages.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: meta.toolCalls,
                        errorCorrectionLog: meta.errorCorrectionLog,
                      }
                    : m,
                );
                return prev
                  .map((x) => (x.id === convId ? { ...x, messages: msgs, updatedAt: Date.now() } : x))
                  .sort((a, b) => b.updatedAt - a.updatedAt);
              });
              continue;
            }
            acc += extractSseTextDelta(trimmedLine);
            thinkingAcc += extractSseThinkingDelta(trimmedLine);
          }
          setConversations((prev) => {
            const c = prev.find((x) => x.id === convId);
            if (!c) return prev;
            const msgs = c.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: acc,
                    thinking: thinkingAcc.trim() || undefined,
                  }
                : m,
            );
            return prev
              .map((x) => (x.id === convId ? { ...x, messages: msgs, updatedAt: Date.now() } : x))
              .sort((a, b) => b.updatedAt - a.updatedAt);
          });
        }

        if (!serverCredits) {
          setCredits((prev) => {
            if (!prev) return prev;
            const next = adjustBalance(prev, -cost);
            saveCreditsState(next);
            return next;
          });
        } else {
          void (async () => {
            const r = await fetch("/api/credits", { credentials: "include" });
            if (!r.ok) return;
            const d = (await r.json()) as {
              source?: string;
              planId?: PlanId;
              balance?: number;
              accrualMonth?: string;
              welcomeApplied?: boolean;
            };
            if (d.source !== "server" || typeof d.balance !== "number" || !d.planId) return;
            setCredits({
              version: 1,
              planId: d.planId,
              balance: d.balance,
              accrualMonth: d.accrualMonth ?? creditMonthKey(),
              welcomeApplied: Boolean(d.welcomeApplied),
            });
          })();
        }

        streamCompleted = true;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setBanner("Generation stopped.");
        } else {
          setBanner("Stream interrupted -- try again.");
        }
      } finally {
        if (streamCompleted && readAloudRef.current && acc.trim()) {
          speakAssistantMessage(assistantId, acc);
        }
        setBusy(false);
        setStreamingAssistantId(null);
        streamAbortRef.current = null;
      }
    },
    [
      activeId,
      activeSkill,
      agentMode,
      conversations,
      credits,
      model,
      pendingFiles,
      quantum,
      schrodinger,
      serverCredits,
      thinking,
      upsertConversation,
    ],
  );

  const runGenerateImage = useCallback(async () => {
    const prompt = chatDraft.trim() || imagePromptExtra.trim();
    if (!isIntroIntakeComplete()) {
      setBanner("Finish the connection questionnaire first.");
      return;
    }
    if (introGateOpen) return;
    if (!credits) {
      setBanner("Loading credits… try again in a moment.");
      return;
    }
    if (!prompt) {
      setBanner("Describe the image in the message box or in the image prompt field next to Create image.");
      return;
    }

    const planDef = PLANS[credits.planId];
    const mode: SendMode = "chat";
    const costInput = {
      model,
      thinking: false,
      mode,
      quantum: {
        kolmogorov: quantum.kolmogorov,
        holographic: quantum.holographic,
        dna: quantum.dna,
      },
    };
    if (!planPermitsSend(planDef, costInput)) {
      setBanner(`Not included on ${planDef.label} -- open Plans.`);
      return;
    }
    const costCore = { model, thinking: false, mode };
    const cost = estimateSendCredits(costCore);
    if (credits.balance < cost) {
      setBanner(`Need ${cost} credits. Balance: ${credits.balance}.`);
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/gemini/image", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });
      const raw = await res.text();
      let data: { error?: string; imageBase64?: string; mimeType?: string } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setBanner(
            res.ok
              ? "Image response was not valid JSON -- check server logs."
              : `Image generation failed (${res.status}).`,
          );
          return;
        }
      }
      if (!res.ok) {
        setBanner(data.error ?? "Image generation failed.");
        return;
      }
      if (!data.imageBase64 || !data.mimeType) {
        setBanner("No image returned.");
        return;
      }

      const convId = activeId ?? uuidv4();
      const prev = conversations.find((c) => c.id === convId);
      const md = `![Generated](data:${data.mimeType};base64,${data.imageBase64})`;
      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content: `Create image: ${prompt}`,
        createdAt: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `Here's your image.\n\n${md}`,
        createdAt: Date.now(),
        toolCalls: [],
        errorCorrectionLog: [],
      };
      const next: Conversation = {
        id: convId,
        title: prev?.title === "New chat" || !prev ? `Image: ${prompt.slice(0, 40)}` : prev.title,
        updatedAt: Date.now(),
        messages: [...(prev?.messages ?? []), userMsg, assistantMsg],
      };
      upsertConversation(next);
      setActiveId(convId);
      setChatDraft("");
      setImagePromptExtra("");

      if (!serverCredits) {
        setCredits((prev) => {
          if (!prev) return prev;
          const nextCredits = adjustBalance(prev, -cost);
          saveCreditsState(nextCredits);
          return nextCredits;
        });
      } else {
        void (async () => {
          const r = await fetch("/api/credits", { credentials: "include" });
          if (!r.ok) return;
          const d = (await r.json()) as {
            source?: string;
            planId?: PlanId;
            balance?: number;
            accrualMonth?: string;
            welcomeApplied?: boolean;
          };
          if (d.source !== "server" || typeof d.balance !== "number" || !d.planId) return;
          setCredits({
            version: 1,
            planId: d.planId,
            balance: d.balance,
            accrualMonth: d.accrualMonth ?? creditMonthKey(),
            welcomeApplied: Boolean(d.welcomeApplied),
          });
        })();
      }
    } catch {
      setBanner("Image request failed.");
    } finally {
      setBusy(false);
    }
  }, [
    activeId,
    chatDraft,
    imagePromptExtra,
    conversations,
    credits,
    introGateOpen,
    model,
    quantum,
    serverCredits,
    upsertConversation,
  ]);

  const onIntroIntakeComplete = useCallback((answers: string[]) => {
    saveIntroIntake(answers);
    setCompanionIntakeFromQuestionnaire(INTRO_SEVEN_QUESTIONS, answers);
    setIntroGateOpen(false);
    setIntroIntakeDone(true);
    // Persist to server so answers survive browser clears and device switches.
    void fetch("/api/profile/journey", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }).catch(() => { /* non-fatal: localStorage already saved */ });
  }, []);

  const redoConnectionQuestionnaire = useCallback(() => {
    clearIntroIntake();
    clearCompanionIntake();
    setIntroIntakeDone(false);
    setIntroGateOpen(true);
    setSettingsOpen(false);
  }, []);

  const regenerateLastResponse = useCallback(() => {
    void sendMessage("", { regenerate: true });
  }, [sendMessage]);

  const onChatShellTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (typeof window === "undefined") return;
      if (!window.matchMedia("(max-width: 767px)").matches || mobileNavOpen) return;
      const t = e.touches[0];
      if (!t || t.clientX > 28) return;
      mobileEdgeSwipeRef.current = { x: t.clientX, y: t.clientY };
    },
    [mobileNavOpen],
  );

  const onChatShellTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = mobileEdgeSwipeRef.current;
      mobileEdgeSwipeRef.current = null;
      if (!start || typeof window === "undefined") return;
      if (!window.matchMedia("(max-width: 767px)").matches || mobileNavOpen) return;
      const t = e.changedTouches[0];
      if (!t) return;
      if (t.clientX - start.x > 56 && Math.abs(t.clientY - start.y) < 88) {
        setMobileNavOpen(true);
      }
    },
    [mobileNavOpen],
  );

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  const canRegenerateLast = useMemo(() => {
    if (!active?.messages.length || busy) return false;
    return active.messages[active.messages.length - 1]!.role === "assistant";
  }, [active?.messages, busy]);

  const runSmartAction = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  const useSchrodingerPreview = schrodinger && !agentMode;
  const previewMode: SendMode =
    pendingFiles.length > 0 ? "chat" : agentMode ? "agent" : useSchrodingerPreview ? "schrodinger" : "chat";
  const previewThinking = pendingFiles.length > 0 ? false : thinking;
  const appearance = uiPrefs?.appearance ?? "dark";

  return (
    <div className={`bbgpt-app-root flex h-[100dvh] w-full flex-col ${appRootBgClass(appearance)}`}>
      {introGateOpen ? (
        <OnboardingIntakeModal appearance={appearance} onComplete={onIntroIntakeComplete} />
      ) : null}
      {showBillingBanner && billingAlert ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/45 bg-amber-950/35 px-4 py-2">
          <p className="min-w-0 text-xs text-amber-100/95">{billingAlert.message}</p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openStripePortal()}
              className="min-h-11 rounded-full bg-amber-500/20 px-4 py-2 text-[11px] font-semibold text-amber-50 ring-1 ring-amber-500/40 hover:bg-amber-500/30 sm:min-h-10"
            >
              Manage billing
            </button>
            <button
              type="button"
              onClick={dismissBillingAlert}
              className="min-h-11 rounded-full px-4 py-2 text-[11px] text-amber-200/90 ring-1 ring-amber-800/80 hover:bg-amber-950/50 sm:min-h-10"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <header className={headerShellClass(appearance)}>
        <div className="flex w-full min-w-0 items-center justify-between gap-2 md:contents">
          <div className="min-w-0 flex-1 md:max-w-[min(100%,24rem)]">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`truncate text-sm font-semibold ${appearance === "light" ? "text-zinc-900" : "text-zinc-100"}`}
              >
                bbGPT
              </div>
              <span
                className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ring-1 sm:inline-flex ${mood.accentClass}`}
                title="Inferred from your draft and last message"
              >
                <span aria-hidden>{mood.emoji}</span>
                {mood.label}
              </span>
              <span
                className={`hidden max-w-[min(420px,50vw)] cursor-help truncate rounded-full px-2 py-0.5 text-[10px] ring-1 sm:inline-flex ${
                  appearance === "light"
                    ? "bg-zinc-200 text-zinc-700 ring-zinc-300"
                    : "bg-zinc-900 text-zinc-500 ring-zinc-800"
                }`}
                title={
                  routingReason ??
                  `Every chat response includes a routing note: either Kolmogorov's pick or "router off -- using selected model."`
                }
              >
                {routingReason ? routingReason : "Model routing (see after send)"}
              </span>
            </div>
            {/* Subtitle hidden on mobile -- keyboard shortcut copy irrelevant on touch */}
            <div
              className={`mt-0.5 hidden truncate text-[11px] sm:block ${appearance === "light" ? "text-zinc-600" : "text-zinc-600"}`}
            >
              Plans gate models · credits per send · memory · Cmd/Ctrl+K search
            </div>
          </div>
          {/* Mobile right cluster: credits + compose (new chat) + hamburger */}
          <div className="flex shrink-0 items-center gap-1.5 md:hidden">
            <span
              className={`rounded-full px-2.5 py-1.5 font-mono text-[10px] ring-1 ${
                appearance === "light"
                  ? "bg-cyan-100/90 text-cyan-900 ring-cyan-300"
                  : "bg-zinc-900/80 text-cyan-200 ring-zinc-800"
              }`}
              title={
                serverCredits
                  ? "Credits stored on the server (enforced when app password is enabled)."
                  : "Local credit balance in this browser."
              }
            >
              {credits ? `${credits.balance} cr` : "…"}
            </span>
            {/* Compose / New Chat -- one tap, always visible on mobile */}
            <button
              type="button"
              aria-label="New chat"
              onClick={() => { newChat(); setMobileNavOpen(false); }}
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-xl ring-1 ${
                appearance === "light"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-300 hover:bg-emerald-100"
                  : "bg-emerald-900/30 text-emerald-400 ring-emerald-800/60 hover:bg-emerald-900/50"
              }`}
              title="New chat"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            {/* Hamburger -- opens chat history drawer */}
            <button
              type="button"
              aria-expanded={mobileNavOpen}
              aria-controls="bbgpt-mobile-sidebar"
              aria-label={mobileNavOpen ? "Close conversations menu" : "Open conversations menu"}
              onClick={() => setMobileNavOpen((o) => !o)}
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-xl ring-1 ${
                appearance === "light"
                  ? "bg-white text-zinc-900 ring-zinc-300 hover:bg-zinc-100"
                  : "bg-zinc-900 text-zinc-100 ring-zinc-800 hover:bg-zinc-800"
              }`}
            >
              <span className="sr-only">Chats menu</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                {mobileNavOpen ? (
                  <>
                    <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12" />
                    <path strokeWidth="2" strokeLinecap="round" d="M18 6L6 18" />
                  </>
                ) : (
                  <path strokeWidth="2" strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className="-mx-1 w-full min-w-0 overflow-x-auto overscroll-x-contain px-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] md:mx-0 md:max-w-none md:flex-1">
          <QuantumControls
            id="bbgpt-quantum-bar"
            plan={credits ? PLANS[credits.planId] : PLANS.free}
            model={model}
            onModel={setModel}
            thinking={thinking}
            onThinking={setThinking}
            schrodinger={schrodinger}
            onSchrodinger={setSchrodinger}
            agentMode={agentMode}
            onAgentMode={setAgentMode}
            quantum={quantum}
            onQuantum={setQuantum}
            onRequestUpgrade={() => setSubscriptionOpen(true)}
          />
        </div>

        <div className="hidden w-full min-w-0 flex-wrap items-center justify-end gap-2 md:flex md:w-auto">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="bbgpt-header-btn min-h-11 rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-800 hover:bg-zinc-800 sm:min-h-10"
            title="Font size, theme, notifications, time capsule"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setSubscriptionOpen(true)}
            className="bbgpt-header-btn min-h-11 rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-800 hover:bg-zinc-800 sm:min-h-10"
            title="Subscription tiers, model access, and credit balance"
          >
            Plans
          </button>
          <span
            className={`hidden rounded-full px-2 py-1 font-mono text-[10px] ring-1 md:inline ${
              appearance === "light"
                ? "bg-cyan-100/90 text-cyan-900 ring-cyan-300"
                : "bg-zinc-900/80 text-cyan-200 ring-zinc-800"
            }`}
            title={
              serverCredits
                ? "Credits stored on the server (enforced when app password is enabled)."
                : "Local credit balance in this browser. Enable BBGPT_APP_PASSWORD for server wallet."
            }
          >
            {credits ? `${credits.balance} cr` : "…"}
          </span>
          {serverCredits ? (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                router.push("/login");
                router.refresh();
              }}
              className="bbgpt-header-btn min-h-11 rounded-full bg-zinc-900 px-3 py-2 text-xs text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 sm:min-h-10"
            >
              Sign out
            </button>
          ) : null}
          {activeSkill ? (
            <span className="hidden max-w-[160px] truncate rounded-full bg-cyan-950/40 px-2 py-1 text-[10px] text-cyan-200 ring-1 ring-cyan-900 md:inline">
              Skill: {activeSkill.name}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setSkillsOpen(true)}
            className="bbgpt-header-btn min-h-11 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-800 hover:bg-zinc-800 sm:min-h-10"
          >
            Skills
          </button>
          <button
            type="button"
            onClick={() => setCommunityOpen(true)}
            className="bbgpt-header-btn min-h-11 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-800 hover:bg-zinc-800 sm:min-h-10"
          >
            Community
          </button>
          <a
            href="https://www.instagram.com/bbgptofficial"
            target="_blank"
            rel="noopener noreferrer"
            className="bbgpt-header-btn inline-flex min-h-11 items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600/80 to-orange-500/80 px-4 py-2 text-xs font-semibold text-white ring-1 ring-fuchsia-500/40 hover:from-fuchsia-500/90 hover:to-orange-400/90 sm:min-h-10"
            aria-label="Follow bbGPT on Instagram"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Social
          </a>
        </div>
      </header>

      {banner || busy || canRegenerateLast ? (
        <div className={subBannerClass(appearance)}>
          <div className="min-w-0 text-xs text-zinc-300">
            {banner ?? (busy ? <span className="text-zinc-400">Generating…</span> : null)}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {busy ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="min-h-11 rounded-full bg-zinc-800 px-4 py-2 text-[11px] font-semibold text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700 sm:min-h-10"
              >
                Stop
              </button>
            ) : null}
            {canRegenerateLast ? (
              <button
                type="button"
                onClick={regenerateLastResponse}
                className="min-h-11 rounded-full bg-zinc-800 px-4 py-2 text-[11px] font-semibold text-cyan-200 ring-1 ring-zinc-700 hover:bg-zinc-700 sm:min-h-10"
              >
                Regenerate
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {mobileNavOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] motion-safe:transition-opacity motion-safe:duration-200 md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
        <div
          id="bbgpt-mobile-sidebar"
          className={`fixed inset-y-0 left-0 z-50 flex h-full w-[min(18rem,88vw)] max-w-[100vw] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out md:static md:z-auto md:h-full md:w-52 md:max-w-none md:translate-x-0 md:border-r md:border-zinc-800 md:pb-0 md:shadow-none ${
            mobileNavOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none md:pointer-events-auto md:translate-x-0"
          }`}
        >
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onNew={newChat}
            onSelect={setActiveId}
            onDelete={onDelete}
            appearance={appearance}
            className="h-full w-full min-w-0 border-r-0 sm:w-full"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </div>
        <div
          className={`touch-pan-y ${mainChatShellClass(appearance, mood.shellClass)}`}
          onTouchStart={onChatShellTouchStart}
          onTouchEnd={onChatShellTouchEnd}
        >
          {!introGateOpen && credits === null ? (
            <div
              className="shrink-0 space-y-2 border-b border-zinc-800/50 px-4 py-3"
              role="status"
              aria-label="Loading wallet"
            >
              <div className="h-3.5 max-w-[10rem] animate-pulse rounded-md bg-zinc-800/45" />
              <div className="h-3 max-w-[7rem] animate-pulse rounded-md bg-zinc-800/35" />
            </div>
          ) : null}
          <ChatArea
            messages={active?.messages ?? []}
            empty={!active || active.messages.length === 0}
            onOpenPlans={() => setSubscriptionOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            onJumpToQuantum={scrollToQuantumBar}
            busy={busy}
            streamingAssistantId={streamingAssistantId}
            plan={credits ? PLANS[credits.planId] : PLANS.free}
            onPickTemplate={applyPowerTemplate}
            introIntakeComplete={introIntakeDone}
            onInsertComposerText={(text, how) => {
              if (how === "prefixFirst") {
                setChatDraft((d) => {
                  const cur = d.trim();
                  return cur ? `${text}${cur}` : text;
                });
              } else {
                setChatDraft(text);
              }
            }}
          />
          {active && active.messages.length > 0 && lastAssistantText && !busy ? (
            <SmartActions
              assistantText={lastAssistantText}
              lastUserText={lastUserBubble}
              onAction={runSmartAction}
              disabled={busy || !credits || introGateOpen}
            />
          ) : null}
          <ChatInput
            disabled={busy || !credits || introGateOpen}
            value={chatDraft}
            onValueChange={setChatDraft}
            onSend={sendMessage}
            skillSuggestion={skillHint}
            onUseSkill={() => {
              if (skillHint) setActiveSkill(skillHint);
            }}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            onGenerateImage={runGenerateImage}
            imagePromptExtra={imagePromptExtra}
            onImagePromptExtraChange={setImagePromptExtra}
            geminiEnabled
            readAloud={readAloud}
            onReadAloudChange={setReadAloudPersist}
            attachmentLimitBytes={attachmentLimitBytes}
            onAttachmentLimitChange={setAttachmentLimitPersist}
          >
            {credits ? (
              <div className="hidden sm:block">
                <CostPreview
                  balance={credits.balance}
                  model={model}
                  thinking={previewThinking}
                  mode={previewMode}
                  contextHint={
                    pendingFiles.length > 0
                      ? "Pending files: priced as one Gemini multimodal send (chat credits, Thinking off)."
                      : undefined
                  }
                />
              </div>
            ) : null}
          </ChatInput>
        </div>
      </div>

      <SearchOverlay
        key={searchOpen ? "open" : "closed"}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        conversations={conversations}
        onPick={(id) => setActiveId(id)}
      />
      <CommunityPanel
        open={communityOpen}
        onClose={() => setCommunityOpen(false)}
        creditsBalance={credits?.balance ?? 0}
        serverCredits={serverCredits}
        onAfterServerDebate={async () => {
          const r = await fetch("/api/credits", { credentials: "include" });
          if (!r.ok) return;
          const d = (await r.json()) as {
            source?: string;
            planId?: PlanId;
            balance?: number;
            accrualMonth?: string;
            welcomeApplied?: boolean;
            billingAlert?: BillingAlertPayload | null;
            usageHints?: UsageHint[];
            stripe?: {
              configured?: boolean;
              customerId?: string | null;
              subscriptionStatus?: string | null;
            };
          };
          if (d.source !== "server" || typeof d.balance !== "number" || !d.planId) return;
          if (d.stripe && typeof d.stripe.configured === "boolean") {
            setStripeBilling({
              configured: d.stripe.configured,
              customerId: d.stripe.customerId ?? null,
              subscriptionStatus: d.stripe.subscriptionStatus ?? null,
            });
          }
          if (d.billingAlert?.kind === "payment_failed") {
            setBillingAlert(d.billingAlert);
          } else {
            setBillingAlert(null);
          }
          if (Array.isArray(d.usageHints)) {
            setUsageHints(d.usageHints);
          }
          setCredits({
            version: 1,
            planId: d.planId,
            balance: d.balance,
            accrualMonth: d.accrualMonth ?? creditMonthKey(),
            welcomeApplied: Boolean(d.welcomeApplied),
          });
        }}
        onSpendCredits={(amount) => {
          let ok = false;
          flushSync(() => {
            setCredits((prev) => {
              if (!prev || prev.balance < amount) return prev;
              ok = true;
              const next = adjustBalance(prev, -amount);
              saveCreditsState(next);
              return next;
            });
          });
          return ok;
        }}
      />
      <SkillsPanel
        open={skillsOpen}
        onClose={() => setSkillsOpen(false)}
        onActivateSkill={(s) => setActiveSkill(s)}
      />
      <SubscriptionModal
        open={subscriptionOpen}
        onClose={() => setSubscriptionOpen(false)}
        currentPlanId={credits?.planId ?? "free"}
        balance={credits?.balance ?? 0}
        serverCredits={serverCredits}
        stripeBilling={stripeBilling}
        usageHints={usageHints}
        onCheckout={openStripeCheckout}
        onManageBilling={openStripePortal}
        onSelectPlan={async (id: PlanId) => {
          if (!credits) {
            setSubscriptionOpen(false);
            return;
          }
          if (serverCredits) {
            const res = await fetch("/api/credits", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ planId: id }),
            });
            const data = (await res.json()) as {
              source?: string;
              planId?: PlanId;
              balance?: number;
              accrualMonth?: string;
              welcomeApplied?: boolean;
              error?: string;
            };
            if (!res.ok) {
              setBanner(data.error ?? "Could not update plan on server.");
              setSubscriptionOpen(false);
              return;
            }
            if (data.source === "server" && data.planId) {
              setCredits({
                version: 1,
                planId: data.planId,
                balance: data.balance ?? 0,
                accrualMonth: data.accrualMonth ?? creditMonthKey(),
                welcomeApplied: Boolean(data.welcomeApplied),
              });
            }
            setSubscriptionOpen(false);
            return;
          }
          setCredits((prev) => {
            if (!prev) return prev;
            const next = setPlan(prev, id);
            saveCreditsState(next);
            return next;
          });
          setSubscriptionOpen(false);
        }}
      />
      <ProactiveToast
        items={toasts}
        onDismiss={(id) => setToasts((t) => t.map((x) => (x.id === id ? { ...x, open: false } : x)))}
        onAsk={(draft) => void sendMessage(draft)}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPreferencesSaved={(p) => {
          applyUiPreferences(p);
          setUiPrefs(p);
        }}
        introIntakeComplete={introIntakeDone}
        onRedoConnectionQuestionnaire={redoConnectionQuestionnaire}
      />
      {timeCapsuleReveal ? (
        <TimeCapsuleReveal
          capsule={timeCapsuleReveal}
          onDismiss={() => {
            markCapsuleOpened(timeCapsuleReveal.id);
            setTimeCapsuleReveal(null);
            const next = nextDueTimeCapsule();
            if (next) setTimeCapsuleReveal(next);
          }}
        />
      ) : null}
      <footer className={`hidden sm:block ${footerShellClass(appearance)} text-[9px] leading-tight sm:text-[10px]`}>
        <span className="text-zinc-500">v{APP_VERSION}</span>
        {" · "}
        bbGPT is not affiliated with or endorsed by OpenAI. &quot;ChatGPT&quot; is a trademark of OpenAI.
      </footer>
    </div>
  );
}
