// server/routes/paymentRoutes.js
const express = require("express");
const razorpay = require("../config/razorpay");
const Appointment = require("../models/appointment");
const authMiddleware = require("../middleware/authMiddleware");
const crypto = require("crypto");
const router = express.Router();

// Create Razorpay order
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    if (appointment.paymentStatus === "paid")
      return res.status(400).json({ message: "Already paid" });

    const options = {
      amount: appointment.totalAmount * 100, // paise
      currency: "INR",
      receipt: `receipt_${appointment._id}`,
    };

    const order = await razorpay.orders.create(options);
    appointment.paymentOrderId = order.id;
    await appointment.save();

    res.json({ orderId: order.id, amount: options.amount, currency: "INR" });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Payment order failed: Server error" });
  }
});

// Verify payment signature
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      appointmentId,
    } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    
    if (appointment.paymentOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Order ID mismatch" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid Signature" });
    }

    appointment.paymentStatus = "paid";
    appointment.paidAt = new Date();
    appointment.paymentId = razorpay_payment_id;
    appointment.paymentMethod = "Razorpay";
    await appointment.save();

    
    res.json({ message: "Payment verified successfully" });
  } catch (err) {
    console.error("Payment verification error:", err);
    res
      .status(500)
      .json({ message: "Payment verification failed: Server error" });
  }
});

// Payment history for customer
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const payments = await Appointment.find({
      customer: req.user.id,
      paymentStatus: { $ne: "pending" },
    })
      .populate("service", "name")
      .populate("provider", "name")
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payments" });
  }
});

module.exports = router;
