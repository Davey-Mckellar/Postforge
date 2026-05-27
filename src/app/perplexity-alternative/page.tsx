import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Best Perplexity Alternative in 2026 — bbGPT",
  description:
    "Looking for a Perplexity alternative? bbGPT's Deep Research tool searches multiple sources and synthesises reports — plus GPT-4o, Claude, and Gemini in one app. Try free for 7 days.",
  openGraph: {
    title: "Best Perplexity Alternative in 2026 — bbGPT",
    description:
      "Deep Research built in. GPT-4o, Claude, Gemini. No subscription lock-in. Try free for 7 days.",
    url: "https://www.bbgpt.ai/perplexity-alternative",
    siteName: "bbGPT",
    type: "website",
  },
  alternates: {
    canonical: "https://www.bbgpt.ai/perplexity-alternative",
  },
};

const features = [
  {
    icon: "🔬",
    title: "Deep Research — not just a search box",
    body: "bbGPT's Deep Research skill decomposes your question into sub-queries, searches multiple sources in parallel, then synthesises a structured, cited report. Perplexity returns search results. bbGPT returns answers.",
  },
  {
    icon: "🤖",
    title: "Three AI models, one interface",
    body: "After your research is done, keep the conversation going with GPT-4o, Claude Sonnet, or Gemini 2.5 Flash. Perplexity locks you into one model. bbGPT lets you choose.",
  },
  {
    icon: "💳",
    title: "Pay what you use — from $1.99",
    body: "Perplexity Pro costs $20/month. bbGPT credit bundles start at $1.99. Run a deep research session, pay for that session. No monthly commitment required.",
  },
  {
    icon: "🖼️",
    title: "Image generation Perplexity doesn't have",
    body: "Generate images with Gemini's image model directly in your chat. Research a topic, then create visuals for it — all in one tab.",
  },
  {
    icon: "🧬",
    title: "Personal context across sessions",
    body: "bbGPT learns your goals, industry, and working style. Every research session is informed by who you are — not just what you asked this time.",
  },
  {
    icon: "📎",
    title: "Upload documents to research against",
    body: "Attach your own PDFs and documents. bbGPT can research the web and your internal documents at the same time, then synthesise across both.",
  },
];

const comparison = [
  { feature: "Deep Research / web synthesis", bbgpt: true, perplexity: true },
  { feature: "GPT-4o access", bbgpt: true, perplexity: false },
  { feature: "Claude access", bbgpt: true, perplexity: false },
  { feature: "Gemini 2.5 Flash", bbgpt: true, perplexity: false },
  { feature: "Image generation", bbgpt: true, perplexity: false },
  { feature: "Pay-as-you-go pricing", bbgpt: true, perplexity: false },
  { feature: "7-day free trial", bbgpt: true, perplexity: false },
  { feature: "Personal context memory", bbgpt: true, perplexity: false },
  { feature: "Document attachments", bbgpt: true, perplexity: true },
];

export default function PerplexityAlternativePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-emerald-800 bg-emerald-900/20 text-emerald-400 text-sm font-medium">
          Perplexity Alternative
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-tight">
          Deep Research{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
            Plus Every AI Model
          </span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Perplexity searches the web. bbGPT researches it — decomposing your question, searching
          multiple sources, and synthesising a full report. Then keeps the conversation going with
          GPT-4o, Claude, or Gemini.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=perplexity-alternative"
            className="px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Try Free for 7 Days
          </Link>
          <Link
            href="/#pricing"
            className="px-8 py-4 rounded-full border border-zinc-700 text-zinc-300 font-semibold text-lg hover:border-zinc-500 transition-colors"
          >
            See Pricing
          </Link>
        </div>
        <p className="mt-4 text-sm text-zinc-600">No credit card required to start.</p>
      </section>

      {/* How Deep Research works */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">How bbGPT Deep Research Works</h2>
        <div className="space-y-4">
          {[
            { step: "1", title: "Decompose", body: "Your question is broken into focused sub-queries that cover different angles of the topic." },
            { step: "2", title: "Search", body: "Each sub-query is run against multiple sources in parallel — not just the top Google result." },
            { step: "3", title: "Synthesise", body: "Findings are cross-referenced and merged into a structured report with clear sections and source attribution." },
            { step: "4", title: "Continue", body: "Ask follow-up questions, switch to Claude for deeper reasoning, or generate images — all in the same tab." },
          ].map((item) => (
            <div key={item.step} className="flex gap-5 rounded-xl border border-zinc-800 bg-zinc-900/20 p-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-900/40 border border-emerald-800 flex items-center justify-center text-emerald-400 font-bold">
                {item.step}
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">
          bbGPT vs Perplexity — Side by Side
        </h2>
        <div className="rounded-2xl border border-zinc-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Feature</th>
                <th className="text-center py-4 px-6 text-emerald-400 font-semibold">bbGPT</th>
                <th className="text-center py-4 px-6 text-zinc-500 font-medium">Perplexity Pro</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-zinc-800/60 ${i % 2 === 0 ? "bg-zinc-900/20" : ""}`}
                >
                  <td className="py-4 px-6 text-zinc-300">{row.feature}</td>
                  <td className="py-4 px-6 text-center">
                    {row.bbgpt ? (
                      <span className="text-emerald-400 text-xl">✓</span>
                    ) : (
                      <span className="text-zinc-700 text-xl">✗</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.perplexity ? (
                      <span className="text-zinc-400 text-xl">✓</span>
                    ) : (
                      <span className="text-zinc-700 text-xl">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-zinc-600 text-sm mt-4">
          Perplexity Pro: $20/mo. bbGPT credits from $1.99.
        </p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything Perplexity Has — and More
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2 text-white">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {[
            {
              q: "How is bbGPT's Deep Research different from Perplexity?",
              a: "Perplexity returns a list of sources with snippets. bbGPT's Deep Research decomposes your question, searches in parallel, and synthesises a full structured report — more like a research assistant than a search engine. After the report, you can keep the conversation going with Claude, GPT-4o, or Gemini.",
            },
            {
              q: "Does bbGPT have real-time web access?",
              a: "bbGPT's Deep Research skill uses web search to gather current information. For standard chat, it uses the model's training data, the same as Perplexity's default mode.",
            },
            {
              q: "How does pricing compare to Perplexity Pro?",
              a: "Perplexity Pro is $20/month. bbGPT credit bundles start at $1.99, and you only pay for what you use. A deep research session costs a fraction of a monthly Perplexity subscription.",
            },
            {
              q: "Can I use bbGPT for ongoing research projects?",
              a: "Yes. bbGPT's personal context system remembers your goals and context across sessions. Each research session builds on what the AI already knows about your project — without you having to re-explain everything.",
            },
          ].map((item) => (
            <div key={item.q} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
              <h3 className="font-semibold text-white mb-2">{item.q}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl border border-emerald-900/50 bg-gradient-to-br from-emerald-950/30 to-cyan-950/30 p-12">
          <h2 className="text-3xl font-bold mb-4">
            Research smarter. Chat with any AI. From $1.99.
          </h2>
          <p className="text-zinc-400 mb-8">
            7 days free. No credit card. Deep Research + GPT-4o + Claude + Gemini.
          </p>
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=perplexity-alternative-cta"
            className="inline-block px-10 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Start Free Trial → bbgpt.ai
          </Link>
        </div>
      </section>
    </main>
  );
}
