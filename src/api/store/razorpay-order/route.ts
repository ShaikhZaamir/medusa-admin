import Razorpay from "razorpay"

export async function POST(req, res) {
  try {
    const { amount, currency = "INR", cart_id } = req.body || {}

    if (!amount || !cart_id) {
      return res.status(400).json({
        ok: false,
        message: "amount and cart_id are required",
      })
    }

    // Initialize Razorpay instance
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    // Create an order on Razorpay
    const order = await razorpay.orders.create({
      amount: Number(amount), // in paise
      currency,
      receipt: cart_id,
      notes: {
        cart_id,
        purpose: "Shipping Payment (Partial COD)",
      },
    })

    return res.json({
      ok: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      message: "Failed to create Razorpay order",
      error: err.message,
    })
  }
}
