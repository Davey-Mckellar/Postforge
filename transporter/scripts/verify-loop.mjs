#!/usr/bin/env node
/**
 * Phase 1 end-to-end verification.
 *
 * Drives the marketplace loop through the running dev server:
 *   1. Register sender A and transporter B via /api/auth/register.
 *   2. Sign in each via Auth.js's credentials callback (CSRF-aware).
 *   3. As A: create a shipment.
 *   4. As B: create a capacity offer, bid on A's shipment.
 *   5. As A: bid on B's capacity offer, accept B's bid on the shipment.
 *   6. Verify DB state (accepted bid, siblings rejected, shipment awarded,
 *      award row with paymentStatus=not_implemented).
 *   7. Confirm forbidden accept from a third user, and confirm withdrawing
 *      an already-accepted bid errors.
 *
 * Run:  BASE=http://localhost:3100 node scripts/verify-loop.mjs
 */
import pg from "pg";
const { Client } = pg;
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const BASE = process.env.BASE ?? "http://localhost:3100";

function makeJar() {
  const jar = new Map();
  return {
    // Parse a Set-Cookie header (as returned by Response.headers.getSetCookie or getAll)
    ingest(setCookieValues) {
      for (const raw of setCookieValues) {
        const [pair] = raw.split(";");
        const eq = pair.indexOf("=");
        if (eq < 0) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (value === "" || value === "deleted") jar.delete(name);
        else jar.set(name, value);
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function req(jar, method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined) headers["content-type"] = "application/json";
  const cookie = jar.header();
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  jar.ingest(setCookie);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, headers: res.headers, data, text };
}

async function reqForm(jar, path, form, extraHeaders = {}) {
  const headers = {
    ...extraHeaders,
    "content-type": "application/x-www-form-urlencoded",
  };
  const cookie = jar.header();
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, {
    method: "POST",
    headers,
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  jar.ingest(setCookie);
  return { status: res.status, headers: res.headers, location: res.headers.get("location") };
}

async function signIn(jar, email, password) {
  const csrfRes = await req(jar, "GET", "/api/auth/csrf");
  if (csrfRes.status !== 200) throw new Error("csrf fetch failed");
  const csrfToken = csrfRes.data.csrfToken;
  const cb = await reqForm(jar, "/api/auth/callback/credentials", {
    csrfToken,
    email,
    password,
    callbackUrl: BASE + "/",
    json: "true",
  });
  if (cb.status !== 200 && cb.status !== 302) {
    throw new Error(`signIn failed for ${email}: HTTP ${cb.status}`);
  }
  // Confirm we have a session
  const s = await req(jar, "GET", "/api/auth/session");
  if (!s.data?.user?.id) {
    throw new Error(`no session after signIn for ${email}`);
  }
  return s.data.user;
}

async function register(email, password, name, role) {
  const jar = makeJar();
  const r = await req(jar, "POST", "/api/auth/register", { email, password, name, role });
  if (r.status !== 201 && r.status !== 409) {
    throw new Error(`register ${email} failed: ${r.status} ${JSON.stringify(r.data)}`);
  }
  return jar;
}

function eq(label, got, want) {
  const ok = got === want;
  console.log(`  ${ok ? "OK " : "FAIL"} ${label}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  if (!ok) throw new Error(`assertion failed: ${label}`);
}

function assert(label, cond, extra = "") {
  console.log(`  ${cond ? "OK " : "FAIL"} ${label}${extra ? " " + extra : ""}`);
  if (!cond) throw new Error(`assertion failed: ${label}`);
}

async function main() {
  const now = Date.now();
  const senderEmail = `sender+${now}@example.com`;
  const transporterEmail = `transporter+${now}@example.com`;
  const thirdEmail = `third+${now}@example.com`;
  const password = "correcthorsebatterystaple";

  console.log("[1] Register sender A, transporter B, third user C");
  const senderJar = await register(senderEmail, password, "Sender A", "sender");
  const transporterJar = await register(transporterEmail, password, "Transporter B", "transporter");
  const thirdJar = await register(thirdEmail, password, "Third C", "both");

  console.log("[2] Sign in all three");
  const senderUser = await signIn(senderJar, senderEmail, password);
  const transporterUser = await signIn(transporterJar, transporterEmail, password);
  await signIn(thirdJar, thirdEmail, password);

  console.log("[3] As A: create shipment");
  const s1 = await req(senderJar, "POST", "/api/shipments", {
    origin: "Toronto, ON",
    destination: "Montreal, QC",
    cargoDescription: "20 pallets of maple syrup",
    weightKg: "5000",
    declaredValue: "8000",
    targetPrice: "1500",
  });
  eq("shipment created", s1.status, 201);
  const shipmentId = s1.data.shipment.id;

  console.log("[4] As B: create capacity offer");
  const c1 = await req(transporterJar, "POST", "/api/capacity", {
    origin: "Montreal, QC",
    destination: "Toronto, ON",
    capacityKg: "10000",
    askingPrice: "1200",
  });
  eq("capacity created", c1.status, 201);
  const capacityId = c1.data.capacity.id;

  console.log("[5] As B: bid on A's shipment");
  const b1 = await req(transporterJar, "POST", `/api/shipments/${shipmentId}/bids`, {
    amount: "1400",
    message: "Can pick up Monday.",
  });
  eq("first bid on shipment", b1.status, 201);
  const bidBonShipment = b1.data.bid.id;

  console.log("[6] As A: bid on B's capacity");
  const b2 = await req(senderJar, "POST", `/api/capacity/${capacityId}/bids`, {
    amount: "1100",
    message: "Take it now.",
  });
  eq("bid on capacity", b2.status, 201);

  console.log("[7] Extra sibling bid on the shipment (from C) so we can prove sibling rejection");
  const b3 = await req(thirdJar, "POST", `/api/shipments/${shipmentId}/bids`, {
    amount: "1600",
  });
  eq("sibling bid on shipment", b3.status, 201);
  const bidCsibling = b3.data.bid.id;

  console.log("[8] As C: try to accept B's bid on A's shipment → should be 403");
  const badAccept = await req(thirdJar, "POST", `/api/bids/${bidBonShipment}/accept`, {});
  eq("non-counterparty accept refused", badAccept.status, 403);

  console.log("[9] As A: accept B's bid");
  const acceptRes = await req(senderJar, "POST", `/api/bids/${bidBonShipment}/accept`, {});
  eq("accept succeeded", acceptRes.status, 201);
  const award = acceptRes.data.award;
  assert("award.paymentStatus is not_implemented", award.paymentStatus === "not_implemented");
  assert("award.agreedPrice matches accepted bid amount", award.agreedPrice === "1400");
  assert("award senderId is the shipment sender", award.senderId === senderUser.id);
  assert("award transporterId is the bidder", award.transporterId === transporterUser.id);

  console.log("[10] Withdraw already-accepted bid → should be 409");
  const wd = await req(transporterJar, "POST", `/api/bids/${bidBonShipment}/withdraw`, {});
  eq("cannot withdraw an accepted bid", wd.status, 409);

  console.log("[11] DB check — inspect final state directly");
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    const s = await pg.query("SELECT status FROM shipments WHERE id=$1", [shipmentId]);
    eq("shipment.status=awarded", s.rows[0].status, "awarded");

    const accepted = await pg.query("SELECT status FROM bids WHERE id=$1", [bidBonShipment]);
    eq("accepted bid.status=accepted", accepted.rows[0].status, "accepted");

    const sibling = await pg.query("SELECT status FROM bids WHERE id=$1", [bidCsibling]);
    eq("sibling bid.status=rejected", sibling.rows[0].status, "rejected");

    const aw = await pg.query(
      "SELECT payment_status, agreed_price FROM awards WHERE bid_id=$1",
      [bidBonShipment],
    );
    eq("award row exists", aw.rows.length, 1);
    eq("award.payment_status=not_implemented", aw.rows[0].payment_status, "not_implemented");
    eq("award.agreed_price=1400", aw.rows[0].agreed_price, "1400");
  } finally {
    await pg.end();
  }

  console.log("\nPHASE 1 CORE LOOP: PASS");
}

main().catch((err) => {
  console.error("\nPHASE 1 CORE LOOP: FAIL");
  console.error(err);
  process.exit(1);
});
