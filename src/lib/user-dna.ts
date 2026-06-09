import type { ChatMessage } from "./types";

export function extractStyleDNA(messages: ChatMessage[]): string {
  const userMsgs = messages.filter((m) => m.role === "user");
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  if (assistantMsgs.length < 2) return "";

  const avgUserLen =
    userMsgs.reduce((s, m) => s + m.content.length, 0) / (userMsgs.length || 1);
  const avgAssistantLen =
    assistantMsgs.reduce((s, m) => s + m.content.length, 0) / (assistantMsgs.length || 1);

  const usesBullets = assistantMsgs.some((m) => /^\s*[-*]/m.test(m.content));
  const usesCode = assistantMsgs.some((m) => m.content.includes("```"));
  const usesNumbered = assistantMsgs.some((m) => /^\s*\d+\./m.test(m.content));
  const casual = userMsgs.some((m) =>
    /\b(lol|haha|yo|tbh|ngl|bruh|omg|lmk|imo|fwiw)\b/i.test(m.content),
  );
  const usesEmoji = userMsgs.some((m) => /\p{Emoji}/u.test(m.content));
  const asksQuestions = assistantMsgs.filter((m) => m.content.includes("?")).length;
  const wantsShort = avgUserLen < 80 && avgAssistantLen > 600;
  const wantsLong = avgUserLen > 300 && avgAssistantLen > 800;

  const signals: string[] = [];

  if (wantsShort)
    signals.push("Keep replies under 200 words -- user sends short messages and does not want lengthy responses");
  else if (wantsLong)
    signals.push("User sends detailed messages and expects thorough, in-depth responses");

  if (usesBullets && usesNumbered)
    signals.push("Use structured formatting: numbered steps for processes, bullet points for lists");
  else if (usesBullets)
    signals.push("Use bullet points for multi-part answers");
  else if (usesNumbered)
    signals.push("Use numbered steps for sequential information");
  else
    signals.push("Use flowing prose over lists unless the content is inherently sequential");

  if (usesCode)
    signals.push("Include code examples and concrete implementations -- user engages with them");

  if (casual || usesEmoji)
    signals.push("Casual, warm tone is appropriate -- contractions and light humour are fine");
  else
    signals.push("Professional, precise tone -- avoid filler and casual language");

  if (asksQuestions > assistantMsgs.length * 0.4)
    signals.push("Avoid follow-up questions at the end of every reply -- user finds them excessive");

  return signals.length
    ? `Calibrated response style (inferred from this conversation):\n${signals.map((s) => `- ${s}`).join("\n")}`
    : "";
}
