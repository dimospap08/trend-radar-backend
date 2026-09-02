const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { requireUser } = require("../services/auth");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO,
  investor: process.env.STRIPE_PRICE_INVESTOR,
};

router.post("/checkout", requireUser, async (req, res) => {
  const { tier } = req.body;
  const user_id = req.user.id;
  const email = req.user.email;
  const priceId = PRICE_IDS[tier];
  if (!priceId) return res.status(400).json({ error: "unknown tier" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/#pricing`,
    metadata: { user_id, tier },
  });

  res.json({ url: session.url });
});

router.post("/webhook", async (req, res) => {
  const { pool } = req.app.locals;
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { user_id, tier } = session.metadata;
        const existing = await pool.query("SELECT id FROM subscriptions WHERE stripe_sub_id = $1 ORDER BY created_at DESC LIMIT 1", [session.subscription]);
        if (existing.rowCount) {
          await pool.query("UPDATE subscriptions SET status = 'active', tier = $1, stripe_customer_id = $2 WHERE id = $3", [tier, session.customer, existing.rows[0].id]);
        } else {
          await pool.query(
            `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_sub_id, tier, status)
             VALUES ($1, $2, $3, $4, 'active')`,
            [user_id, session.customer, session.subscription, tier]
          );
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await pool.query(
          `UPDATE subscriptions SET status = 'canceled' WHERE stripe_sub_id = $1`,
          [sub.id]
        );
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        await pool.query(
          `UPDATE subscriptions SET status = $1, current_period_end = to_timestamp($2)
           WHERE stripe_sub_id = $3`,
          [sub.status, sub.current_period_end, sub.id]
        );
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await pool.query(
          `UPDATE subscriptions SET status = 'past_due' WHERE stripe_sub_id = $1`,
          [invoice.subscription]
        );
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook processing failed for ${event.type}:`, err.message);
    return res.status(200).json({ received: true, processingError: err.message });
  }

  res.json({ received: true });
});

module.exports = router;
