import type ZAI from "z-ai-web-dev-sdk";
import { createZai } from "@/lib/zai";
import { getOpenAIApiKey } from "@/lib/openai-api";
import { getAnthropicApiKey, isClaudeTier } from "@/lib/anthropic-api";
import { getOpenRouterApiKey } from "@/lib/openrouter-api";
import { getGroqApiKey } from "@/lib/groq-api";
import { getCerebrasApiKey } from "@/lib/cerebras-api";
import { getMetaLlamaApiKey } from "@/lib/meta-llama-api";
import type { ModelTier } from "@/lib/types";

export type LlmResolved =
  | { provider: "zai"; zai: InstanceType<typeof ZAI> }
  | { provider: "openai"; apiKey: string }
  | { provider: "anthropic"; apiKey: string }
  | { provider: "openrouter"; apiKey: string }
  | { provider: "openrouter-free"; apiKey: string }
  | { provider: "meta-llama"; apiKey: string }
  | { provider: "cerebras"; apiKey: string }
  | { provider: "groq"; apiKey: string }
  | { provider: "none"; message: string };

/**
 * Resolve the LLM provider for a given model tier.
 *
 * Routing priority for Claude tiers:
 *  1. ANTHROPIC_API_KEY   -> direct Anthropic API (best quality + caching)
 *  2. OPENROUTER_API_KEY  -> OpenRouter paid Claude models
 *  3. META_LLAMA_API_KEY  -> Meta Llama 4 Maverick/Scout (waitlist — free when active)
 *  4. CEREBRAS_API_KEY    -> Cerebras Llama (1M tokens/day free)
 *  5. OPENROUTER_API_KEY  -> OpenRouter free Llama 4 (:free tier)
 *  6. GROQ_API_KEY        -> Groq Llama 3.3 70B (500K tokens/day free)
 *  7. Nothing set         -> 503
 *
 * Routing priority for GLM tiers:
 *  1. Z_AI_API_KEY        -> Z.AI / GLM (primary)
 *  2. OPENAI_API_KEY      -> OpenAI fallback
 *  3. ANTHROPIC_API_KEY   -> Claude Sonnet universal fallback
 *  4. OPENROUTER_API_KEY  -> OpenRouter paid fallback
 *  5. META_LLAMA_API_KEY  -> Meta Llama 4 free fallback
 *  6. CEREBRAS_API_KEY    -> Cerebras free fallback
 *  7. OPENROUTER_API_KEY  -> OpenRouter free Llama 4
 *  8. GROQ_API_KEY        -> Groq free fallback
 *  9. Nothing             -> 503
 */
export function resolveLlm(model?: ModelTier): LlmResolved {
  // -- Claude tiers ---------------------------------------------------------
  if (model && isClaudeTier(model)) {
    const anthropicKey = getAnthropicApiKey();
    if (anthropicKey) return { provider: "anthropic", apiKey: anthropicKey };

    const routerKey = getOpenRouterApiKey();
    if (routerKey) return { provider: "openrouter", apiKey: routerKey };

    const metaKey = getMetaLlamaApiKey();
    if (metaKey) return { provider: "meta-llama", apiKey: metaKey };

    const cerebrasKey = getCerebrasApiKey();
    if (cerebrasKey) return { provider: "cerebras", apiKey: cerebrasKey };

    // Second OpenRouter check: free Llama 4 tier (no balance needed)
    if (routerKey) return { provider: "openrouter-free", apiKey: routerKey };

    const groqKey = getGroqApiKey();
    if (groqKey) return { provider: "groq", apiKey: groqKey };

    return {
      provider: "none",
      message:
        "Claude model selected but no API key is configured. " +
        "Add ANTHROPIC_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY, or GROQ_API_KEY.",
    };
  }

  // -- GLM / Z.AI path ------------------------------------------------------
  try {
    return { provider: "zai", zai: createZai() };
  } catch {
    const openai = getOpenAIApiKey();
    if (openai) return { provider: "openai", apiKey: openai };

    const anthropic = getAnthropicApiKey();
    if (anthropic) return { provider: "anthropic", apiKey: anthropic };

    const router = getOpenRouterApiKey();
    if (router) return { provider: "openrouter", apiKey: router };

    const metaKey = getMetaLlamaApiKey();
    if (metaKey) return { provider: "meta-llama", apiKey: metaKey };

    const cerebrasKey = getCerebrasApiKey();
    if (cerebrasKey) return { provider: "cerebras", apiKey: cerebrasKey };

    const routerFree = getOpenRouterApiKey();
    if (routerFree) return { provider: "openrouter-free", apiKey: routerFree };

    const groq = getGroqApiKey();
    if (groq) return { provider: "groq", apiKey: groq };

    return {
      provider: "none",
      message:
        "No LLM configured. Set Z_AI_API_KEY for GLM, OPENAI_API_KEY for OpenAI, " +
        "ANTHROPIC_API_KEY for Claude, OPENROUTER_API_KEY, CEREBRAS_API_KEY, " +
        "META_LLAMA_API_KEY, or GROQ_API_KEY (free).",
    };
  }
}
