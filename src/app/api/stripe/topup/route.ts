import { NextResponse, type NextRequest } from "next/server";
import { assertAuthorized } from "@/lib/session-server";
import { isGateEnabled } from "@/lib/server-config";
import { requestAppOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe-client";
import { isStripeConfigured, stripeCheckoutPaymentMethodTypes } from "@/lib/stripe-config";
import { readServerBilling } from "@/lib/server-billing";
import { getOptionalSessionEmail } from "@/lib/session-server";
import type Stripe from "stripe";
import { z } from "zod";
import { TOPUP_BUNDLES } from "@/lib/topup-bundles";
export type { TopupBundleId } from "@/lib/topup-bundles";

export const runtime = "nodejs";

const bodySchema = z.object({
  bundleId: z.enum(["topup_sm", "topup_md", "topup_lg", "topup_xl"]),
});

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured (STRIPE_SECRET_KEY)." }, { status: 503 });
  }
  if (!isGateEnabled()) {
    return NextResponse.json(
      { error: "Credit top-up requires a signed-in server session." },
      { status: 400 },
    );
  }

  const denied = await assertAuthorized(req);
  if (denied) return denied;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body. Provide a valid bundleId." }, { status: 400 });
  }

  const bundle = TOPUP_BUNDLES.find((b) => b.id === body.bundleId);
  if (!bundle) {
    return NextResponse.json({ error: "Unknown bundle." }, { status: 400 });
  }

  const origin = requestAppOrigin(req);
  const billingRecord = await readServerBilling(req);
  const sessionEmail = await getOptionalSessionEmail(req);
  const paymentMethodTypes = stripeCheckoutPaymentMethodTypes();

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(billingRecord.customerId
      ? { customer: billingRecord.customerId }
      : sessionEmail
        ? { customer_email: sessionEmail }
        : {}),
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: bundle.amountCents,
          product_data: {
            name: `bbGPT — ${bundle.label}`,
            description: `One-time credit top-up: adds ${bundle.credits.toLocaleString()} credits to your account immediately after payment.`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      metadata: {
        type: "credit_topup",
        bundleId: bundle.id,
        credits: String(bundle.credits),
      },
    },
    metadata: {
      type: "credit_topup",
      bundleId: bundle.id,
      credits: String(bundle.credits),
    },
    success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&topup=1`,
    cancel_url: `${origin}/?checkout=canceled`,
    allow_promotion_codes: true,
    payment_method_types: paymentMethodTypes as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
    custom_text: {
      submit: {
        message: "Credits are added to your account immediately after payment completes.",
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
