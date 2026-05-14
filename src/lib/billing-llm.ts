import { resolveLlm } from "@/lib/llm-resolve";
import { openaiChatCompletionJson, pickChatTextFromCompletion } from "@/lib/openai-api";
import { claudeChatCompletionJson } from "@/lib/anthropic-api";
import { openRouterChatCompletionJson } from "@/lib/openrouter-api";
import { groqChatCompletionJson } from "@/lib/groq-api";
import { cerebrasChatCompletionJson } from "@/lib/cerebras-api";
import { metaLlamaChatCompletionJson } from "@/lib/meta-llama-api";

export async function completeBillingText(opts: {
  system: string;
  user: string;
}): Promise<{ text: string } | { error: string }> {
  const llm = resolveLlm();
  if (llm.provider === "none") {
    return { error: llm.message };
  }

  const messages = [
    { role: "system" as const, content: opts.system },
    { role: "user" as const, content: opts.user },
  ];

  try {
    if (llm.provider === "openai") {
      const data = await openaiChatCompletionJson({
        apiKey: llm.apiKey,
        model: "gpt-4o-mini",
        messages,
      });
      return { text: pickChatTextFromCompletion(data).trim() };
    }

    if (llm.provider === "anthropic") {
      const text = await claudeChatCompletionJson({
        apiKey: llm.apiKey,
        model: "claude-haiku",
        messages,
      });
      return { text: text.trim() };
    }

    if (llm.provider === "openrouter") {
      const text = await openRouterChatCompletionJson({
        apiKey: llm.apiKey,
        model: "claude-haiku",
        messages,
      });
      return { text: text.trim() };
    }

    if (llm.provider === "groq") {
      const text = await groqChatCompletionJson({
        apiKey: llm.apiKey,
        model: "claude-haiku",
        messages,
      });
      return { text: text.trim() };
    }

    if (llm.provider === "cerebras") {
      const text = await cerebrasChatCompletionJson({
        apiKey: llm.apiKey,
        model: "claude-haiku",
        messages,
      });
      return { text: text.trim() };
    }

    if (llm.provider === "meta-llama") {
      const text = await metaLlamaChatCompletionJson({
        apiKey: llm.apiKey,
        model: "claude-haiku",
        messages,
      });
      return { text: text.trim() };
    }

    if (llm.provider === "openrouter-free") {
      const text = await openRouterChatCompletionJson({
        apiKey: llm.apiKey,
        model: "claude-haiku",
        messages,
      });
      return { text: text.trim() };
    }

    // Z.AI / GLM
    if (llm.provider !== "zai") return { error: "Unsupported provider" };
    const zai = llm.zai;
    const raw = await zai.chat.completions.create({
      model: "glm-4-flash",
      messages,
      stream: false,
      thinking: { type: "disabled" },
    });
    return { text: pickChatTextFromCompletion(raw as unknown).trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LLM request failed";
    return { error: msg };
  }
}
