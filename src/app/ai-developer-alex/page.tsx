import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Developer Tools 2026 — GPT-4o, Claude & Gemini in One App | bbGPT",
  description:
    "The AI assistant built for developers. Switch between GPT-4o, Claude Sonnet, and Gemini 2.5 in one interface. Pay-as-you-go credits, no subscription lock-in. Try free for 7 days.",
  openGraph: {
    title: "AI Developer Tools 2026 — bbGPT",
    description:
      "GPT-4o, Claude, and Gemini in one dev-friendly interface. Credits, no subscriptions. Built for builders.",
    url: "https://www.bbgpt.ai/ai-developer-alex",
    siteName: "bbGPT",
    type: "website",
  },
  alternates: {
    canonical: "https://www.bbgpt.ai/ai-developer-alex",
  },
};

const features = [
  {
    icon: "⚡",
    title: "Switch models mid-conversation",
    body: "Start with Claude for architecture decisions, swap to GPT-4o for code generation, and use Gemini for image analysis — all without leaving the same chat window.",
  },
  {
    icon: "💳",
    title: "Pay per use, not per month",
    body: "No $20/month subscription for a model you use twice a week. Buy credits in bundles from $1.99 and spend them on the models you actually need, when you need them.",
  },
  {
    icon: "📎",
    title: "Upload code files and docs",
    body: "Drop in a PDF spec, a repo zip, or a screenshot of a bug. bbGPT routes your attachment to whichever model handles it best — GPT-4o for documents, Gemini for images.",
  },
  {
    icon: "🔁",
    title: "Automatic model fallback",
    body: "If your preferred model hits rate limits or is degraded, bbGPT routes to the next best option automatically. Your workflow never stalls mid-sprint.",
  },
  {
    icon: "🔒",
    title: "No training on your code",
    body: "Your prompts, code snippets, and architecture notes are never used to train AI models. What you build stays private.",
  },
  {
    icon: "🧠",
    title: "Companion memory",
    body: "bbGPT remembers your stack, preferences, and working style across sessions. No more re-explaining your tech choices every conversation.",
  },
];

const comparison = [
  { feature: "GPT-4o access", bbgpt: true, chatgpt: true, cursor: false },
  { feature: "Claude Sonnet access", bbgpt: true, chatgpt: false, cursor: true },
  { feature: "Gemini 2.5 Flash", bbgpt: true, chatgpt: false, cursor: false },
  { feature: "Pay-as-you-go pricing", bbgpt: true, chatgpt: false, cursor: false },
  { feature: "Image & file attachments", bbgpt: true, chatgpt: true, cursor: true },
  { feature: "Multi-model in one app", bbgpt: true, chatgpt: false, cursor: false },
  { feature: "No code training", bbgpt: true, chatgpt: false, cursor: false },
  { feature: "Companion memory", bbgpt: true, chatgpt: false, cursor: false },
];

export default function AiDeveloperAlexPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-violet-800 bg-violet-900/20 text-violet-400 text-sm font-medium">
          Built for Developers
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          The AI Assistant That{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
            Thinks Like a Developer
          </span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Stop juggling ChatGPT, Claude.ai, and Gemini in separate tabs. bbGPT puts GPT-4o,
          Claude Sonnet, and Gemini 2.5 Flash in one interface — with per-use credits, no
          monthly lock-in, and memory that actually works.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=ai-developer-alex"
            className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
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
        <p className="mt-4 text-sm text-zinc-600">No credit card required. Cancel anytime.</p>
      </section>

      {/* Comparison table */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">
          bbGPT vs Other AI Dev Tools
        </h2>
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Feature</th>
                <th className="text-center py-4 px-6 text-cyan-400 font-semibold">bbGPT</th>
                <th className="text-center py-4 px-6 text-zinc-500 font-medium">ChatGPT</th>
                <th className="text-center py-4 px-6 text-zinc-500 font-medium">Cursor</th>
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
                      <span className="text-cyan-400 text-xl">✓</span>
                    ) : (
                      <span className="text-zinc-700 text-xl">✗</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.chatgpt ? (
                      <span className="text-zinc-400 text-xl">✓</span>
                    ) : (
                      <span className="text-zinc-700 text-xl">✗</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.cursor ? (
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
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why Developers Choose bbGPT
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
        <h2 className="text-3xl font-bold text-center mb-10">Developer FAQ</h2>
        <div className="space-y-6">
          {[
            {
              q: "Which models are available?",
              a: "GPT-4o, Claude Sonnet, Claude Haiku, Gemini 2.5 Flash, and GLM models from Z.AI. The available models depend on your plan tier — higher tiers unlock more powerful models.",
            },
            {
              q: "How does per-use pricing work for developers?",
              a: "Each message costs credits based on the model and response length. Claude Haiku costs fewer credits than GPT-4o or Claude Sonnet. You can see the exact credit cost per model in your account. No monthly fee draining your budget when you're between projects.",
            },
            {
              q: "Can I upload code repositories or large documents?",
              a: "Yes. You can upload PDFs, images, and text files. Paste large code blocks directly into the chat — bbGPT handles long-context requests via GPT-4o and Gemini 2.5.",
            },
            {
              q: "Is there an API I can call from my own app?",
              a: "Not yet — bbGPT is currently a consumer interface. If you need programmatic API access, you can use Anthropic's Claude API or OpenAI's API directly. bbGPT is the best option when you want a polished multi-model UI without building your own.",
            },
            {
              q: "What happens to my data?",
              a: "Your conversations are stored to power your history and companion memory. They are never used to train AI models. You can delete your data at any time from your account settings.",
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
          <h2 className="text-3xl font-bold mb-4">Start building with every AI model</h2>
          <p className="text-zinc-400 mb-8">
            7 days free. No credit card. GPT-4o, Claude, and Gemini — all in one place.
          </p>
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=ai-developer-alex-cta"
            className="inline-block px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Start Free Trial → bbgpt.ai
          </Link>
        </div>
      </section>
    </main>
  );
}
