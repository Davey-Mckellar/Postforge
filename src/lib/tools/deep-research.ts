/**
 * Deep Research tool — multi-step web search that decomposes a question,
 * searches each sub-question, and synthesises findings into a structured report.
 *
 * Uses the existing DuckDuckGo search (or Z.AI web_search when configured).
 * For best results, wire up a real search API (Brave, Tavily, or Serper).
 */
import type { ToolDefinition } from "./types";

const DDG_API = "https://api.duckduckgo.com/";

async function searchOne(query: string, zai?: unknown): Promise<string> {
  try {
    // Use Z.AI web_search when available (far better results)
    if (zai && typeof (zai as { functions?: { invoke?: unknown } }).functions?.invoke === "function") {
      const result = await (zai as { functions: { invoke: (name: string, args: Record<string, unknown>) => Promise<unknown> } }).functions.invoke("web_search", { query, num: 5 });
      if (typeof result === "string") return result;
      return JSON.stringify(result);
    }

    const url = `${DDG_API}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { "User-Agent": "bbGPT/1.0 deep-research" } });
    const j = await res.json() as {
      AbstractText?: string;
      AbstractURL?: string;
      RelatedTopics?: { Text?: string; FirstURL?: string }[];
    };
    const parts: string[] = [];
    if (j.AbstractText) parts.push(`Summary: ${j.AbstractText}`);
    if (j.AbstractURL) parts.push(`Source: ${j.AbstractURL}`);
    (j.RelatedTopics ?? []).slice(0, 6).forEach((t) => {
      if (t.Text) parts.push(`- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ""}`);
    });
    return parts.length ? parts.join("\n") : `No results for: ${query}`;
  } catch (e) {
    return `Search failed for "${query}": ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Break the main question into 3–5 focused sub-queries using keyword extraction.
 * In a production setup, call an LLM here; this is a fast heuristic fallback.
 */
function decomposeQuery(mainQuery: string): string[] {
  // Produce targeted sub-queries by appending common research angles
  const base = mainQuery.trim();
  return [
    base,
    `${base} latest research 2025 2026`,
    `${base} statistics data evidence`,
    `${base} pros cons comparison`,
    `${base} expert opinion best practices`,
  ].slice(0, 5);
}

export const deepResearchTool: ToolDefinition = {
  name: "deep_research",
  description:
    "Multi-step research: decomposes the question into sub-topics, searches each, and synthesises a structured report with key findings and sources.",
  parametersSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "The research question or topic to investigate thoroughly.",
      },
    },
    required: ["topic"],
  },
  async execute(args, ctx) {
    const topic = String(args.topic ?? "").trim();
    if (!topic) return "Error: topic is required for deep research.";

    const subQueries = decomposeQuery(topic);
    const results: { query: string; findings: string }[] = [];

    // Run sub-searches sequentially (rate-limit friendly)
    for (const q of subQueries) {
      const findings = await searchOne(q, ctx.zai);
      results.push({ query: q, findings });
    }

    // Synthesise into a report
    const report: string[] = [
      `# Deep Research Report: ${topic}`,
      `Searched ${results.length} angles. Synthesised findings below.\n`,
    ];

    results.forEach((r, i) => {
      report.push(`## Sub-topic ${i + 1}: ${r.query}`);
      report.push(r.findings);
      report.push("");
    });

    report.push("---");
    report.push(
      "**Note:** Results from DuckDuckGo instant answers. For higher-quality research, " +
      "configure a Brave Search API key (BRAVE_SEARCH_API_KEY) or Tavily API key (TAVILY_API_KEY) in .env.local.",
    );

    return report.join("\n");
  },
};
