import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Best Claude Alternative in 2026 — bbGPT",
  description:
    "Looking for a Claude alternative? bbGPT gives you Claude, GPT-4o, and Gemini 2.5 Flash in one app — with a single credit balance, deep research, and a 7-day free trial.",
  openGraph: {
    title: "Best Claude Alternative in 2026 — bbGPT",
    description:
      "One app. Claude, GPT-4o, and Gemini 2.5. No subscription lock-in. Try free for 7 days.",
    url: "https://www.bbgpt.ai/claude-alternative",
    siteName: "bbGPT",
    type: "website",
  },
  alternates: {
    canonical: "https://www.bbgpt.ai/claude-alternative",
  },
};

const features = [
  {
    icon: "🧠",
    title: "Claude — plus two more top models",
    body: "bbGPT includes Claude (Haiku, Sonnet, and Opus) alongside GPT-4o and Gemini 2.5 Flash. Pick the right model for each task instead of being locked into one.",
  },
  {
    icon: "🔬",
    title: "Deep Research built in",
    body: "bbGPT's Deep Research skill decomposes your question, searches multiple sources, and synthesises a structured report — in one click. No separate Perplexity subscription.",
  },
  {
    icon: "💳",
    title: "Pay-as-you-go — no $20/mo commitment",
    body: "Claude.ai Pro costs $20/month. bbGPT credits start at $1.99. Buy what you need. Never pay for a month you barely touched.",
  },
  {
    icon: "🖼️",
    title: "Image generation Claude can't do",
    body: "Generate images with Gemini's image model directly in your chat. Claude doesn't generate images — bbGPT does.",
  },
  {
    icon: "🧬",
    title: "Personal context that carries across sessions",
    body: "bbGPT learns who you are — your goals, tone, and working style — and applies that context to every reply. It's not just what you type; it's who you are.",
  },
  {
    icon: "📎",
    title: "Files, PDFs, and image attachments",
    body: "Upload documents and images. bbGPT routes them to the model best suited to handle them — Claude for long-form reasoning, Gemini for visual content.",
  },
];

const comparison = [
  { feature: "Claude access", bbgpt: true, claude: true },
  { feature: "GPT-4o access", bbgpt: true, claude: false },
  { feature: "Gemini 2.5 Flash", bbgpt: true, claude: false },
  { feature: "Image generation", bbgpt: true, claude: false },
  { feature: "Deep Research tool", bbgpt: true, claude: false },
  { feature: "Pay-as-you-go pricing", bbgpt: true, claude: false },
  { feature: "7-day free trial", bbgpt: true, claude: false },
  { feature: "Personal context memory", bbgpt: true, claude: false },
  { feature: "Multi-model switching", bbgpt: true, claude: false },
];

export default function ClaudeAlternativePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-violet-800 bg-violet-900/20 text-violet-400 text-sm font-medium">
          Claude Alternative
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          The Claude Alternative That Gives You{" "}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-500 bg-clip-text text-transparent">
            Every AI Model
          </span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Claude is one model. bbGPT gives you Claude <em>plus</em> GPT-4o and Gemini 2.5 Flash
          — all in one app, with one credit balance, deep research, and image generation built in.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=claude-alternative"
            className="px-8 py-4 rounded-full bg-gradient-to-r from-violet-500 to-cyan-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
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

      {/* Comparison table */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">
          bbGPT vs Claude.ai — Side by Side
        </h2>
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Feature</th>
                <th className="text-center py-4 px-6 text-violet-400 font-semibold">bbGPT</th>
                <th className="text-center py-4 px-6 text-zinc-500 font-medium">Claude.ai Pro</th>
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
                      <span className="text-violet-400 text-xl">✓</span>
                    ) : (
                      <span className="text-zinc-700 text-xl">✗</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.claude ? (
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
          Claude.ai Pro: $20/mo. bbGPT credits from $1.99.
        </p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why People Switch from Claude to bbGPT
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

      {/* Use case callout */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-violet-900/40 bg-violet-950/20 p-8 text-center">
          <div className="text-4xl mb-4">💡</div>
          <h2 className="text-2xl font-bold mb-3">
            Already love Claude? Keep using it — inside bbGPT.
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            bbGPT doesn&apos;t replace Claude — it includes it. You still get Claude Haiku, Sonnet, and
            Opus. But now you can switch to GPT-4o for code, Gemini for images, and Claude for
            long-form reasoning — all in one tab, without juggling subscriptions.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {[
            {
              q: "Does bbGPT actually include Claude?",
              a: "Yes. bbGPT includes Claude Haiku, Claude Sonnet, and Claude Opus. You can select any of them from the model dropdown. Haiku is included on all plans; Sonnet and Opus are available on higher tiers.",
            },
            {
              q: "How does the pricing compare to Claude.ai Pro?",
              a: "Claude.ai Pro costs $20/month. bbGPT's credit bundles start at $1.99, and subscriptions start lower than that. If you use AI occasionally, pay-as-you-go credits will cost you far less.",
            },
            {
              q: "What makes bbGPT's personal context different from Claude's memory?",
              a: "Claude's memory stores facts you tell it. bbGPT's companion system builds a structured understanding of your goals, working style, tone preferences, and long-term vision — and applies that to every reply automatically, without you having to remind it each session.",
            },
            {
              q: "Can I use Claude for long documents in bbGPT?",
              a: "Yes. Claude Sonnet and Opus have large context windows. Upload PDFs or paste long text and Claude will handle them natively through bbGPT's attachment system.",
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
        <div className="rounded-2xl border border-violet-900/50 bg-gradient-to-br from-violet-950/30 to-cyan-950/30 p-12">
          <h2 className="text-3xl font-bold mb-4">
            One app. Claude, GPT-4o, and Gemini. From $1.99.
          </h2>
          <p className="text-zinc-400 mb-8">
            7 days free. No credit card. Switch models mid-conversation.
          </p>
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=claude-alternative-cta"
            className="inline-block px-10 py-4 rounded-full bg-gradient-to-r from-violet-500 to-cyan-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Start Free Trial → bbgpt.ai
          </Link>
        </div>
      </section>
    </main>
  );
}
