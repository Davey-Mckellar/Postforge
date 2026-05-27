import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Best ChatGPT Alternative in 2026 — bbGPT",
  description:
    "Looking for a ChatGPT alternative? bbGPT gives you GPT-4o, Gemini 2.5 Flash, and Claude in one app — with a single credit balance, image generation, and a 7-day free trial.",
  openGraph: {
    title: "Best ChatGPT Alternative in 2026 — bbGPT",
    description:
      "One app. GPT-4o, Gemini 2.5, and Claude. No subscription lock-in. Try free for 7 days.",
    url: "https://www.bbgpt.ai/chatgpt-alternative",
    siteName: "bbGPT",
    type: "website",
  },
  alternates: {
    canonical: "https://www.bbgpt.ai/chatgpt-alternative",
  },
};

const features = [
  {
    icon: "🤖",
    title: "Multiple AI models, one interface",
    body: "Switch between GPT-4o, Gemini 2.5 Flash, and Claude without logging into three different apps. Your conversation history, files, and credits all live in one place.",
  },
  {
    icon: "🖼️",
    title: "Image generation built in",
    body: "Generate images with Gemini's image model directly inside your chat. No separate Midjourney subscription, no prompt juggling across tabs.",
  },
  {
    icon: "💳",
    title: "Pay-as-you-go credits — no monthly lock-in",
    body: "Start with a 7-day free trial. After that, buy credits in bundles starting at $1.99. Use what you need. Never pay for a month you barely touched.",
  },
  {
    icon: "⚡",
    title: "Automatic model fallback",
    body: "If your primary model is slow or unavailable, bbGPT routes to the next best option automatically. Your workflow never stalls.",
  },
  {
    icon: "📎",
    title: "File and image attachments",
    body: "Upload PDFs, images, and documents. bbGPT passes them to whichever model handles them best — GPT-4o for documents, Gemini for images.",
  },
  {
    icon: "🔒",
    title: "No data training on your conversations",
    body: "Your chats are not used to train AI models. What you type stays between you and the model.",
  },
];

const comparison = [
  { feature: "GPT-4o access", bbgpt: true, chatgpt: true },
  { feature: "Gemini 2.5 Flash", bbgpt: true, chatgpt: false },
  { feature: "Claude access", bbgpt: true, chatgpt: false },
  { feature: "Image generation", bbgpt: true, chatgpt: true },
  { feature: "Pay-as-you-go pricing", bbgpt: true, chatgpt: false },
  { feature: "7-day free trial", bbgpt: true, chatgpt: false },
  { feature: "File attachments", bbgpt: true, chatgpt: true },
  { feature: "Multi-model switching", bbgpt: true, chatgpt: false },
];

export default function ChatGPTAlternativePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-cyan-800 bg-cyan-900/20 text-cyan-400 text-sm font-medium">
          ChatGPT Alternative
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-tight">
          The ChatGPT Alternative That Gives You{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
            Every AI Model
          </span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          ChatGPT is one model. bbGPT is GPT-4o, Gemini 2.5 Flash, and Claude — all in one
          app, with one credit balance and no subscription lock-in.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=chatgpt-alternative"
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
        <p className="mt-4 text-sm text-zinc-600">No credit card required to start.</p>
      </section>

      {/* Comparison table */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">
          bbGPT vs ChatGPT — Side by Side
        </h2>
        <div className="rounded-2xl border border-zinc-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Feature</th>
                <th className="text-center py-4 px-6 text-cyan-400 font-semibold">bbGPT</th>
                <th className="text-center py-4 px-6 text-zinc-500 font-medium">ChatGPT Plus</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why Developers and Creators Switch to bbGPT
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
              q: "Is bbGPT really a ChatGPT alternative?",
              a: "Yes — and it goes further. bbGPT includes GPT-4o (the same model powering ChatGPT Plus), plus Gemini 2.5 Flash and Claude. You get more models for a comparable or lower cost, without separate subscriptions for each.",
            },
            {
              q: "Do I need a separate OpenAI account?",
              a: "No. bbGPT handles all API access on your behalf. You sign up once, get credits, and start chatting.",
            },
            {
              q: "How does the credit system work?",
              a: "Each message costs a small number of credits depending on the model and response length. Starter plans include credits monthly. You can also top up with one-time credit bundles starting at $1.99.",
            },
            {
              q: "What happens after my 7-day trial?",
              a: "You can subscribe to a paid plan or purchase credits à la carte. There's no automatic charge at the end of your trial.",
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
        <div className="rounded-2xl border border-cyan-900/50 bg-gradient-to-br from-cyan-950/30 to-violet-950/30 p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to try the best ChatGPT alternative?</h2>
          <p className="text-zinc-400 mb-8">
            7 days free. No credit card. GPT-4o, Gemini 2.5, and Claude waiting for you.
          </p>
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=chatgpt-alternative-cta"
            className="inline-block px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Start Free Trial → bbgpt.ai
          </Link>
        </div>
      </section>
    </main>
  );
}
