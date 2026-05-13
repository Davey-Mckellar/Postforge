import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pay-As-You-Go AI Chat Credits — bbGPT",
  description:
    "No monthly AI subscription? No problem. bbGPT lets you buy AI chat credits on demand — starting at $1.99. Access GPT-4o, Gemini 2.5, and Claude. 7-day free trial included.",
  openGraph: {
    title: "Pay-As-You-Go AI Chat Credits — bbGPT",
    description:
      "Buy AI credits on demand. Use GPT-4o, Gemini 2.5, and Claude. No subscription required.",
    url: "https://www.bbgpt.ai/ai-chat-credits",
    siteName: "bbGPT",
    type: "website",
  },
  alternates: {
    canonical: "https://www.bbgpt.ai/ai-chat-credits",
  },
};

const bundles = [
  { label: "2,000 credits", price: "$1.99", best: false, perCredit: "$0.001" },
  { label: "8,000 credits", price: "$5.99", best: false, perCredit: "$0.00075" },
  { label: "25,000 credits", price: "$14.99", best: false, perCredit: "$0.0006" },
  { label: "75,000 credits", price: "$39.99", best: true, perCredit: "$0.00053" },
];

const howItWorks = [
  {
    step: "1",
    title: "Start your 7-day free trial",
    body: "Sign up with your email. No credit card required. You get a starter credit balance to explore all three AI models.",
  },
  {
    step: "2",
    title: "Use credits to chat",
    body: "Each message you send costs a small number of credits based on the model and response length. GPT-4o, Gemini 2.5, and Claude all draw from the same balance.",
  },
  {
    step: "3",
    title: "Top up when you need more",
    body: "Buy credits in bundles starting at $1.99. No subscription. No auto-renewal. Just credits that never expire.",
  },
];

export default function AiChatCreditsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-emerald-800 bg-emerald-900/20 text-emerald-400 text-sm font-medium">
          Pay-As-You-Go AI
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
          AI Chat Credits.{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
            Buy What You Need.
          </span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Tired of paying $20/month for an AI you use twice a week? bbGPT sells credits on
          demand — starting at $1.99. Use GPT-4o, Gemini 2.5, and Claude from one balance.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=ai-chat-credits"
            className="px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Try Free for 7 Days
          </Link>
          <Link
            href="/#pricing"
            className="px-8 py-4 rounded-full border border-zinc-700 text-zinc-300 font-semibold text-lg hover:border-zinc-500 transition-colors"
          >
            View Credit Bundles
          </Link>
        </div>
        <p className="mt-4 text-sm text-zinc-600">No credit card required to start.</p>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">How Credits Work</h2>
        <div className="space-y-6">
          {howItWorks.map((step) => (
            <div key={step.step} className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {step.step}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Credit bundles */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-4">Credit Top-Up Bundles</h2>
        <p className="text-zinc-400 text-center mb-12">
          One-time purchases. No subscription. Credits never expire.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bundles.map((b) => (
            <div
              key={b.label}
              className={`rounded-2xl border p-6 text-center transition-colors ${
                b.best
                  ? "border-emerald-500 bg-emerald-900/20"
                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
              }`}
            >
              {b.best && (
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                  Best Value
                </div>
              )}
              <div className="text-2xl font-bold text-white mb-1">{b.price}</div>
              <div className="text-zinc-300 font-medium mb-2">{b.label}</div>
              <div className="text-xs text-zinc-600">{b.perCredit} / credit</div>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-zinc-600 mt-6">
          Subscription plans also available with monthly credits included — starting at a low monthly rate.
        </p>
      </section>

      {/* Why credits beat subscriptions */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">
          Why Credits Beat Monthly Subscriptions
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: "💸",
              title: "No wasted spend",
              body: "Monthly AI subscriptions charge you whether you use them or not. Credits only get consumed when you actually send a message.",
            },
            {
              icon: "🔄",
              title: "No auto-renewal surprises",
              body: "Top-up bundles are one-time purchases. You decide when to buy more. No forgotten subscriptions charging your card.",
            },
            {
              icon: "⚖️",
              title: "One balance, three models",
              body: "Your credits work across GPT-4o, Gemini 2.5, and Claude. No need to manage separate API keys or account limits for each.",
            },
            {
              icon: "📈",
              title: "More credits as you scale",
              body: "Heavier user? Subscribe for better monthly rates. Casual user? Top up as needed. bbGPT scales to your actual usage.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold mb-2 text-white">{item.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-10">Credit FAQs</h2>
        <div className="space-y-6">
          {[
            {
              q: "Do credits expire?",
              a: "No. Credit top-up bundles do not expire. Subscription plan credits refresh monthly but unused credits from top-ups carry over indefinitely.",
            },
            {
              q: "How many credits does a typical message use?",
              a: "A short GPT-4o message uses roughly 10–30 credits. Longer responses, image generation, or file uploads use more. The interface shows your credit balance in real time.",
            },
            {
              q: "Can I use credits with all three AI models?",
              a: "Yes. GPT-4o, Gemini 2.5 Flash, and Claude all draw from the same credit pool. Switch between models freely without separate billing.",
            },
            {
              q: "What if I run out of credits mid-conversation?",
              a: "You'll be prompted to top up. Your conversation history is preserved so you can continue exactly where you left off once you add more credits.",
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
          <h2 className="text-3xl font-bold mb-4">Start free. Buy credits only when you need them.</h2>
          <p className="text-zinc-400 mb-8">
            7-day free trial. GPT-4o, Gemini 2.5, and Claude. No subscription required.
          </p>
          <Link
            href="/?utm_source=seo&utm_medium=landing&utm_campaign=ai-chat-credits-cta"
            className="inline-block px-10 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Start Free Trial → bbgpt.ai
          </Link>
        </div>
      </section>
    </main>
  );
}
