import { randomUUID } from "crypto";
import type { ErrorCorrectionLogEntry, ModelTier, ToolCall } from "./types";
import { getToolByName, toolsPromptBlock } from "./tools";
import type { ToolContext } from "./tools/types";
import { executeToolWithRetry, tryRepairJson } from "./quantum-error-correction";
import type ZAI from "z-ai-web-dev-sdk";
import { mapTierToOpenAIModel, openaiChatCompletionJson } from "./openai-api";
import { claudeChatCompletionJson, isClaudeTier } from "./anthropic-api";
import { openRouterChatCompletionJson } from "./openrouter-api";
import { groqChatCompletionJson } from "./groq-api";
import { cerebrasChatCompletionJson } from "./cerebras-api";
import { metaLlamaChatCompletionJson } from "./meta-llama-api";
import { routeWithKolmogorovDetailed } from "./kolmogorov-router";

type Zai = InstanceType<typeof ZAI>;

type AgentJson = {
  thought?: string;
  finish?: boolean;
  finalAnswer?: string;
  toolCalls?: { name?: string; arguments?: Record<string, unknown> }[];
};

const MAX_STEPS = 5;

function extractAssistantText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const o = data as { choices?: Array<{ message?: { content?: string } }> };
  return o.choices?.[0]?.message?.content ?? "";
}

function parseAgentJson(raw: string): AgentJson | null {
  const repaired = tryRepairJson(raw);
  const text = repaired ?? raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as AgentJson;
  } catch {
    return null;
  }
}

function synthesizeFinalFromThought(parsed: AgentJson): string {
  const t = parsed.thought?.trim();
  if (t) return t;
  return "I could not produce a structured agent plan. Please rephrase your request.";
}

export async function runReactAgentLoop(opts: {
  /** Z.AI SDK instance (GLM). Omit when using OpenAI-only path. */
  zai?: Zai;
  /** When set, planner steps use OpenAI Chat Completions (JSON steps). */
  openaiApiKey?: string;
  /** When set, planner steps use Anthropic Claude (JSON steps). */
  anthropicApiKey?: string;
  /** When set, planner steps use OpenRouter Claude (JSON steps — fallback). */
  openrouterApiKey?: string;
  /** When set, planner steps use Groq free tier (JSON steps — zero-cost fallback). */
  groqApiKey?: string;
  /** When set, planner steps use Cerebras (Llama — 1M tokens/day free). */
  cerebrasApiKey?: string;
  /** When set, planner steps use Meta Llama 4 API (waitlist — free when active). */
  metaLlamaApiKey?: string;
  /** When set, planner steps use OpenRouter free Llama 4 (:free tier). */
  openrouterFreeApiKey?: string;
  /** User/assistant messages only (no leading system — added here) */
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  preferredModel: ModelTier;
  kolmogorov: boolean;
  thinking: boolean;
  extraSystem?: string;
}): Promise<{
  toolCalls: ToolCall[];
  errorCorrectionLog: ErrorCorrectionLogEntry[];
  finalText: string;
  routingReason: string;
  plannerModel: ModelTier;
}> {
  if (!opts.zai && !opts.openaiApiKey && !opts.anthropicApiKey && !opts.openrouterApiKey && !opts.openrouterFreeApiKey && !opts.metaLlamaApiKey && !opts.cerebrasApiKey && !opts.groqApiKey) {
    throw new Error("runReactAgentLoop: provide at least one of: zai, openaiApiKey, anthropicApiKey, openrouterApiKey, cerebrasApiKey, metaLlamaApiKey, or groqApiKey");
  }

  const errorCorrectionLog: ErrorCorrectionLogEntry[] = [];
  const pushLog = (e: ErrorCorrectionLogEntry) => errorCorrectionLog.push(e);

  const uiMessages = opts.messages.filter((m) => m.role !== "system");

  const { model: plannerModel, reason: routingReason } = routeWithKolmogorovDetailed(
    opts.preferredModel,
    uiMessages as { role: "user" | "assistant"; content: string }[],
    opts.kolmogorov,
  );

  const system = [
    "You are bbGPT in AGENT mode (ReAct).",
    "You must reply with ONE JSON object ONLY (no markdown fences). Schema:",
    `{"thought":"string","finish":boolean,"finalAnswer":"string (when finish)","toolCalls":[{"name":"tool_id","arguments":{}}]}`,
    "If finish is true, put the user-facing answer in finalAnswer.",
    "If you need tools, set finish=false and include toolCalls (can be multiple).",
    "Available tools:\n" + toolsPromptBlock(),
    opts.extraSystem ? "\nContext:\n" + opts.extraSystem : "",
  ].join("\n");

  const dialog: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...uiMessages,
  ];

  const toolCalls: ToolCall[] = [];
  const ctx: ToolContext = { zai: opts.zai };

  let lastFinal: string | null = null;

  for (let step = 0; step < MAX_STEPS; step++) {
    const thinkingMode =
      opts.thinking ? ({ type: "enabled" as const } satisfies { type: "enabled" }) : { type: "disabled" as const };

    let text: string;
    if (opts.anthropicApiKey && isClaudeTier(plannerModel)) {
      // Claude path via Anthropic — returns plain text directly
      text = await claudeChatCompletionJson({
        apiKey: opts.anthropicApiKey,
        model: plannerModel,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
      });
    } else if (opts.openrouterApiKey && isClaudeTier(plannerModel)) {
      // Claude path via OpenRouter — same result, no credit balance required
      text = await openRouterChatCompletionJson({
        apiKey: opts.openrouterApiKey,
        model: plannerModel,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
      });
    } else if (opts.metaLlamaApiKey) {
      text = await metaLlamaChatCompletionJson({
        apiKey: opts.metaLlamaApiKey,
        model: plannerModel,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
      });
    } else if (opts.cerebrasApiKey) {
      text = await cerebrasChatCompletionJson({
        apiKey: opts.cerebrasApiKey,
        model: plannerModel,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
      });
    } else if (opts.openrouterFreeApiKey) {
      text = await openRouterChatCompletionJson({
        apiKey: opts.openrouterFreeApiKey,
        model: plannerModel,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
      });
    } else if (opts.groqApiKey) {
      // Groq free tier — Llama 3.3 70B, zero cost, no card required
      text = await groqChatCompletionJson({
        apiKey: opts.groqApiKey,
        model: plannerModel,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
      });
    } else if (opts.zai) {
      const res = await opts.zai.chat.completions.create({
        model: plannerModel,
        messages: dialog,
        stream: false,
        thinking: thinkingMode,
      });
      text = extractAssistantText(res);
    } else {
      const omodel = mapTierToOpenAIModel(plannerModel);
      const res = await openaiChatCompletionJson({
        apiKey: opts.openaiApiKey!,
        model: omodel,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
      });
      text = extractAssistantText(res);
    }
    dialog.push({ role: "assistant", content: text });

    const parsed = parseAgentJson(text);
    if (!parsed) {
      pushLog({
        at: Date.now(),
        kind: "parse_fix",
        detail: "Model output was not valid JSON — asking for a repair.",
      });
      dialog.push({
        role: "user",
        content:
          "Your last message was not valid JSON. Reply again with ONLY one JSON object following the schema.",
      });
      continue;
    }

    if (parsed.finish && typeof parsed.finalAnswer === "string" && parsed.finalAnswer.trim()) {
      lastFinal = parsed.finalAnswer.trim();
      break;
    }

    const calls = parsed.toolCalls ?? [];
    if (!calls.length) {
      lastFinal = synthesizeFinalFromThought(parsed);
      break;
    }

    for (const c of calls) {
      const name = String(c.name ?? "");
      const args = (c.arguments ?? {}) as Record<string, unknown>;
      const tool = getToolByName(name);
      if (!tool) {
        const msg = `Observation (${name}): unknown tool`;
        dialog.push({ role: "user", content: msg });
        toolCalls.push({
          id: randomUUID(),
          name,
          arguments: args,
          result: msg,
        });
        continue;
      }

      const result = await executeToolWithRetry(() => tool.execute(args, ctx), { log: pushLog });
      toolCalls.push({
        id: randomUUID(),
        name,
        arguments: args,
        result,
      });
      dialog.push({
        role: "user",
        content: `Observation (${name}):\n${result}`,
      });
    }
  }

  if (!lastFinal) {
    lastFinal =
      "Agent stopped after the maximum number of reasoning steps. Try narrowing the task or enabling Thinking.";
  }

  return {
    toolCalls,
    errorCorrectionLog,
    finalText: lastFinal,
    routingReason,
    plannerModel,
  };
}
