# bbGPT Trial → Paid Email Conversion Sequence
Generated: 2026-05-07
Sender: Davey McKellar <davey@bbgpt.ai>
From name: Davey from bbGPT
Trial length: 7 days
Send via: Resend (RESEND_API_KEY)

---

## EMAIL 1 — Day 1 (Welcome / Orientation)
**Subject:** You're in — here's how to get the most out of bbGPT
**Send:** Immediately on signup

---

Hey [first_name],

Welcome to bbGPT. Your 7-day trial starts now — no credit card needed, no hidden catches.

Here's how to get the most out of it fast:

**Pick the right model for each task.**
- GPT-4o — general reasoning, code, writing
- Gemini 2.5 Flash — images, long documents, fast answers
- Claude Sonnet — careful analysis, long-form thinking, nuanced writing

Switch models mid-conversation from the dropdown. They share your context.

**Try Deep Research.**
Open a new chat, select the Deep Research skill, and ask something you'd normally Google for 20 minutes. Watch it decompose the question, search multiple sources, and hand you a report.

**Set up your personal context.**
Go to Settings → Tell bbGPT about yourself. The more it knows about you, the more useful every reply becomes.

You've got 7 days. I built this because I was paying $60+/month for three separate AI subscriptions. My goal with bbGPT: give you all three models for a fraction of that cost.

If anything's confusing or broken, reply to this email. I read every one.

— Davey
Founder, bbGPT

---

## EMAIL 2 — Day 3 (Power Tips)
**Subject:** 3 things most bbGPT users don't discover until week 2
**Send:** Day 3 of trial

---

Hey [first_name],

You're 3 days in. A few things that make bbGPT dramatically more useful:

**1. Switch models when you hit a wall.**
If GPT-4o gives you a mediocre answer, paste the same prompt into Claude. Different models have genuinely different strengths. Claude Sonnet is particularly good at long documents and nuanced analysis — if you're working through something complex, try it.

**2. Attach files directly.**
Upload a PDF, image, or document and bbGPT routes it to the right model automatically. Drop a contract and ask Claude to flag anything unusual. Drop an image and ask Gemini to describe or analyze it.

**3. Use the companion context.**
Settings → Tell bbGPT about yourself. Once you've filled this in, every reply is calibrated to your situation — your industry, your tone, your goals. It's the difference between a generic AI response and one that sounds like it was written for you.

Quick question: what are you using bbGPT for most right now? Hitting reply takes 10 seconds and helps me build the right features.

— Davey

---

## EMAIL 3 — Day 5 (Social Proof / Value)
**Subject:** What people are building with bbGPT
**Send:** Day 5 of trial

---

Hey [first_name],

Two days left on your trial. Wanted to share what other users are doing with bbGPT that you might not have tried yet:

**"I replaced Perplexity."**
The Deep Research skill searches multiple sources and synthesises a report. Users who were paying $20/month for Perplexity are running research sessions on bbGPT for pennies in credits.

**"I stopped switching tabs."**
The whole point of bbGPT: GPT-4o for code, Gemini for images, Claude for analysis — one tab, one credit balance. If you're still opening three browser tabs for AI, try keeping just bbGPT open for a day.

**"The personal context changes everything."**
Once you tell bbGPT who you are — your role, your goals, how you like to communicate — replies feel like they're written for you specifically, not for a generic user.

bbGPT credits start at $1.99. If you've used it even once this week, a small credit bundle will last you weeks.

→ [bbgpt.ai/#pricing](https://www.bbgpt.ai/#pricing?utm_source=email&utm_medium=drip&utm_campaign=trial-d5)

— Davey

---

## EMAIL 4 — Day 6 (Urgency / Objection Handling)
**Subject:** Your trial ends tomorrow — quick note
**Send:** Day 6 of trial (24h before expiry)

---

Hey [first_name],

Your trial ends tomorrow. I want to make sure you're not losing access to something useful because of friction, so let me answer the questions I get most:

**"Is it worth paying for after the trial?"**
Depends on how often you use AI. If it's daily: yes, by a wide margin. Our Starter plan works out to less than a single ChatGPT Plus subscription and you get three models. If it's occasional: the pay-as-you-go credits ($1.99 minimum) are probably better — buy when you need them.

**"What if I only use one model?"**
That's fine. Even if you only ever use Claude Sonnet, you're still paying less than Claude.ai Pro. And if you ever want GPT-4o or Gemini, they're already there.

**"What if I run out of credits mid-month?"**
Top up instantly from Settings → Credits. No waiting, no plan change required.

→ Pick a plan: [bbgpt.ai/#pricing](https://www.bbgpt.ai/#pricing?utm_source=email&utm_medium=drip&utm_campaign=trial-d6)

If you're on the fence, reply and tell me why. I'll give you an honest answer — including telling you if bbGPT isn't the right fit.

— Davey

---

## EMAIL 5 — Day 7 (Last Chance)
**Subject:** Your bbGPT trial ends today
**Send:** Day 7 of trial (morning of expiry day)

---

Hey [first_name],

Your 7-day trial ends today.

If bbGPT was useful — even occasionally — the Starter plan keeps everything running for less than a single model subscription elsewhere.

If you're not ready to subscribe, the pay-as-you-go credits option is $1.99 to start. No monthly commitment. Buy credits when you need them, let the balance sit when you don't.

→ [Continue with bbGPT](https://www.bbgpt.ai/#pricing?utm_source=email&utm_medium=drip&utm_campaign=trial-d7)

If today's not the right time, no pressure. You can come back and top up credits any time — your account stays open.

One last thing: I'm a solo founder who built this because AI subscriptions had gotten ridiculous. If you have 60 seconds, reply with one sentence on what you liked or what you'd change. It genuinely helps.

— Davey
Founder, bbGPT | mckellardavey@gmail.com

---

## IMPLEMENTATION NOTES

### Trigger logic (Resend + webhook)
- Email 1: POST /api/webhooks/resend → trigger on user.created
- Email 2: Schedule +3 days from trial_start
- Email 3: Schedule +5 days from trial_start
- Email 4: Schedule +6 days from trial_start
- Email 5: Schedule +7 days from trial_start (morning, 9am user local time)
- Cancel sequence: trigger on subscription.created or credits.purchased

### Personalization tokens
- [first_name] — from user.name (fallback: "there")
- All links include UTM params for GA tracking

### Unsubscribe
- Include one-click unsubscribe in footer per CAN-SPAM
- Resend handles this automatically with LIST_UNSUBSCRIBE header

### Subject line A/B tests to run (week 2)
- Email 1: "You're in" vs "Your bbGPT trial has started"
- Email 4: "Your trial ends tomorrow" vs "One more day — quick question"
- Email 5: "Your bbGPT trial ends today" vs "Last chance (honest note from the founder)"
