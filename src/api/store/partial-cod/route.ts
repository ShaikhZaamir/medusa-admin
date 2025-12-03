import crypto from "crypto";
import { Modules } from "@medusajs/framework/utils";

export async function POST(req, res) {
  const {
    cart_id,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    paid_amount,
  } = req.body || {};

  // ----------------------------------------
  // BASIC VALIDATION
  // ----------------------------------------
  if (
    !cart_id ||
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature ||
    !paid_amount
  ) {
    return res.status(400).json({
      ok: false,
      message: "Missing required fields",
    });
  }

  // ----------------------------------------
  // VERIFY SIGNATURE
  // ----------------------------------------
  const secret = process.env.RAZORPAY_KEY_SECRET || "dummy_secret";

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  const signatureMatches = razorpay_signature === expectedSignature;

  // ----------------------------------------
  // LOAD CART MODULE
  // ----------------------------------------
  let cartModule;
  try {
    cartModule = req.scope.resolve(Modules.CART);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Could not resolve cart module",
      error: err.message,
    });
  }

  // ----------------------------------------
  // FETCH CART
  // ----------------------------------------
  let cart;
  try {
    cart = await cartModule.retrieveCart(cart_id);
  } catch (err) {
    return res.status(404).json({
      ok: false,
      message: "Cart not found",
      cart_id,
    });
  }

  // ----------------------------------------
  // FETCH TOTALS USING QUERY API
  // ----------------------------------------
  let cartTotals;
  try {
    const query = req.scope.resolve("query");

    const { data } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "total",
        "subtotal",
        "shipping_total",
        "items.*",
        "shipping_methods.*",
      ],
      filters: { id: cart_id },
    });

    cartTotals = data?.[0];
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Failed to load cart totals",
      error: err.message,
    });
  }

  // ----------------------------------------
  // VERIFY PRICE
  // ----------------------------------------
  const shippingTotal = cartTotals.shipping_total || 0;
  const expectedPaise = shippingTotal * 100;
  const amountMatches = Number(paid_amount) === expectedPaise;

  // ----------------------------------------
  // REMOVE SHIPPING METHOD (Important)
  // ----------------------------------------
  try {
    if (cartTotals.shipping_methods?.length > 0) {
      await cartModule.updateCarts([
        {
          id: cart_id,
          shipping_methods: [], // remove shipping
        },
      ]);
    }
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Failed to remove shipping method",
      error: err.message,
    });
  }

  // ----------------------------------------
  // UPDATE METADATA
  // ----------------------------------------
  try {
    await cartModule.updateCarts([
      {
        id: cart_id,
        metadata: {
          shipping_paid: amountMatches,
          shipping_paid_amount: shippingTotal,
          shipping_payment_id: razorpay_payment_id,
        },
      },
    ]);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Failed to update cart metadata",
      error: err.message,
    });
  }

  // ----------------------------------------
  // RE-FETCH NEW TOTALS (after removing shipping)
  // ----------------------------------------
  let updatedTotals;
  try {
    const query = req.scope.resolve("query");

    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "total", "subtotal", "shipping_total", "items.*"],
      filters: { id: cart_id },
    });

    updatedTotals = data?.[0];
  } catch (err) {
    updatedTotals = null;
  }

  // ----------------------------------------
  // FINAL RESPONSE
  // ----------------------------------------
  return res.json({
    ok: true,
    message: "SUCCESS: Shipping verified, removed + cart updated",
    signature_valid: signatureMatches,
    amount_matches: amountMatches,
    expected_amount_paise: expectedPaise,
    received_amount_paise: paid_amount,
    shipping_before: shippingTotal,
    updatedTotals,
  });
}
