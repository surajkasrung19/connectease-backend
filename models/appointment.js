//server/models/appointment.js
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    address: { type: String, required: true },
    details: { type: String, default: "" },

    servicePrice: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    providerEarnings: { type: Number, required: true },

    scheduledTime: { type: Date, required: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "completed", "cancelled", "rejected"],
      default: "pending",
    },

    completedAt: { type: Date, default: null },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
    },

    paymentId: {
      type: String,
    },
    paymentMethod: {
      type: String, //UPI, Card, NetBanking
    },

    paymentOrderId: {
      type: String,
    },

    paidAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Appointment", appointmentSchema);
