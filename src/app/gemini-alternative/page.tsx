import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Best Gemini Alternative in 2026 — bbGPT",
  description:
    "Looking for a Gemini alternative? bbGPT gives you Gemini 2.5 Flash plus GPT-4o and Claude — all in one app with image generation, file uploads, and a 7-day free trial.",
  openGraph: {
    title: "Best Gemini Alternative in 2026 — bbGPT",
    description:
      "One app. Gemini 2.5, GPT-4o, and Claude. No subscription lock-in. Try free for 7 days.",
    url: "https://www.bbgpt.ai/gemini-alternative",
    siteName: "bbGPT",
    type: "website",
  },
  alternates: {
    canonical: "https://www.bbgpt.ai/gemini-alternative",
  },
};

const comparison = [
  { feature: "Gemini 2.5 Flash", bbgpt: true, gemini: true },
  { feature: "GPT-4o access", bbgpt: true, gemini: false },
  { feature: "Claude access", bbgpt: true, gemini: false },
  { feature: "Image generation", bbgpt: true, gemini: true },
  { feature: "Pay-as-you-go pricing", bbgpt: true, gemini: false },
  { feature: "7-day free trial", bbgpt: true, gemini: false },
  { feature: "Multi-model fallback", bbgpt: true, gemini: false },
  { feature: "Credit top-ups (no subscription)", bbgpt: true, gemini: false },
];

const useCases = [
  {
    icon: "✍️",
    title: "Writing & Content",
    body: "Use Gemini 2.5 for long-form drafts, then switch to GPT-4o for editing and tone refinement — all without leaving bbGPT.",
  },
  {
    icon: "🖼️",
    title: "Image Generation",
    body: "bbGPT routes image prompts to Gemini's image model automatically. Describe what you want, get it back in seconds.",
  },
  {
    icon: "💻",
    title: "Code Review",
    body: "Paste your code and get feedback from Claude (known for careful reasoning) or GPT-4o (great for debugging). Your choice, one interface.",
  },
  {
    icon: "📊",
    title: "Data Analysis",
    body: "Upload spreadsheets or CSVs and ask questions. Gemini's long context window handles large files with ease.",
  },
  {
    icon: "🔬",
    title: "Research",
    body: "Cross-reference answers across multiple models. If Gemini and GPT-4o agree, you can be more confident in the result.",
  },
  {
    icon: "🌍",
    title: "Translation & Localization",
    body: "Gemini performs exceptionally on multilingual tasks. bbGPT makes it easy to apply that without a separate Google account.",
  },
];

export default function GeminiAlternativePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-violet-800 bg-violet-900/20 text-violet-400 text-sm font-medium">
          Gemini Alternative
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          A Gemini Alternative With{" "}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-500 bg-clip-text text-transparent">
            Every Other AI Too
          </span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          bbGPT includes Gemini 2.5 Flash — and adds GPT-4o and Claude. One login, one credit
          balance, three of the world's best AI models at your fingertips.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=gemini-alternative"
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
        <h2 className="text-3xl font-bold text-center mb-10">bbGPT vs Google Gemini</h2>
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Feature</th>
                <th className="text-center py-4 px-6 text-violet-400 font-semibold">bbGPT</th>
                <th className="text-center py-4 px-6 text-zinc-500 font-medium">Google Gemini</th>
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
                    {row.gemini ? (
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

      {/* Use cases */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">What You Can Do With bbGPT</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="text-3xl mb-4">{u.icon}</div>
              <h3 className="text-lg font-semibold mb-2 text-white">{u.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{u.body}</p>
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
              q: "Does bbGPT use the real Gemini 2.5 Flash model?",
              a: "Yes. bbGPT routes requests to Gemini 2.5 Flash via Google's official API. You get the same model quality as Google's own interface.",
            },
            {
              q: "Why would I use bbGPT instead of Google Gemini directly?",
              a: "bbGPT adds GPT-4o and Claude on top of Gemini — so you can switch models mid-task, compare answers, and use whichever model performs best for a given job, all without managing multiple accounts or subscriptions.",
            },
            {
              q: "Can I use Gemini for image generation in bbGPT?",
              a: "Yes. bbGPT routes image generation prompts to Gemini's image model. You can generate images in the same chat where you write text prompts.",
            },
            {
              q: "How much does it cost?",
              a: "bbGPT offers a 7-day free trial. After that, plans start at a low monthly rate with credits included. You can also buy one-time credit top-ups starting at $1.99 if you prefer not to subscribe.",
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
          <h2 className="text-3xl font-bold mb-4">Get Gemini — and every other AI — in one place.</h2>
          <p className="text-zinc-400 mb-8">
            7 days free. No credit card. Gemini 2.5, GPT-4o, and Claude ready to go.
          </p>
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=gemini-alternative-cta"
            className="inline-block px-10 py-4 rounded-full bg-gradient-to-r from-violet-500 to-cyan-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Start Free Trial → bbgpt.ai
          </Link>
        </div>
      </section>
    </main>
  );
}
