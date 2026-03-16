// server/routes/appointmentRoutes.js
const express = require("express");
const Appointment = require("../models/appointment");
const Service = require("../models/service");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const User = require("../models/user");
const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// PLATFORM FEE  —  3% of service price, minimum ₹10
// ─────────────────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = 3;
const PLATFORM_FEE_MIN = 10;

function calculatePlatformFee(servicePrice) {
  const raw = Math.round((servicePrice * PLATFORM_FEE_PERCENT) / 100);
  return Math.max(raw, PLATFORM_FEE_MIN);
}

// ─── Book an appointment (Customer) ──────────────────────────────
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["customer"]),
  async (req, res) => {
    try {
      const { serviceId, providerId, address, details, scheduledTime } =
        req.body;

      const provider = await User.findById(providerId);
      if (!provider || provider.role !== "provider")
        return res.status(404).json({ message: "Provider not found" });
      if (!provider.isActive)
        return res
          .status(400)
          .json({ message: "This provider is no longer available" });

      const servicePrice = provider.price;
      const platformFee = calculatePlatformFee(servicePrice);
      const totalAmount = servicePrice + platformFee;
      const providerEarnings = servicePrice;

      const newAppointment = await Appointment.create({
        customer: req.user.id,
        provider: providerId,
        service: serviceId,
        address,
        details,
        scheduledTime,
        servicePrice,
        platformFee,
        totalAmount,
        providerEarnings,
      });

      res
        .status(201)
        .json({
          message: "Appointment booked successfully",
          appointment: newAppointment,
        });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error booking appointment", error: error.message });
    }
  },
);

// ─── Get appointments for logged-in customer ─────────────────────
router.get(
  "/my",
  authMiddleware,
  roleMiddleware(["customer"]),
  async (req, res) => {
    try {
      const appointments = await Appointment.find({ customer: req.user.id })
        .populate("service", "name charges")
        .populate("provider", "name phone")
        .sort({ createdAt: -1 });
      res.json(appointments);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching appointments", error: error.message });
    }
  },
);

// ─── Cancel appointment (customer only) ──────────────────────────
router.patch(
  "/cancel/:id",
  authMiddleware,
  roleMiddleware(["customer"]),
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);
      if (!appointment)
        return res.status(404).json({ message: "Appointment not found" });
      if (appointment.status !== "pending")
        return res
          .status(400)
          .json({ message: "Only pending appointments can be cancelled" });
      if (appointment.customer.toString() !== req.user.id)
        return res.status(403).json({ message: "Not authorized" });

      appointment.status = "cancelled";
      await appointment.save();
      res.json({ message: "Appointment cancelled successfully", appointment });
    } catch (err) {
      res.status(500).json({ message: "server error", error: err });
    }
  },
);

// ─── Reschedule appointment (customer only + ownership check) ────
router.patch(
  "/reschedule/:id",
  authMiddleware,
  roleMiddleware(["customer"]),
  async (req, res) => {
    try {
      const { newTime } = req.body;
      if (!newTime)
        return res.status(400).json({ message: "New time is required" });

      const appointment = await Appointment.findById(req.params.id);
      if (!appointment)
        return res.status(404).json({ message: "Appointment not found" });
      if (appointment.customer.toString() !== req.user.id)
        return res
          .status(403)
          .json({ message: "Not authorized to reschedule this appointment" });
      if (
        !(appointment.status === "pending" || appointment.status === "accepted")
      )
        return res
          .status(400)
          .json({ message: "This appointment cannot be rescheduled" });

      appointment.scheduledTime = newTime;
      appointment.status = "pending";
      await appointment.save();
      res.json({
        message: "Appointment rescheduled successfully",
        appointment,
      });
    } catch (err) {
      res.status(500).json({ message: "server error", err });
    }
  },
);

// ─── Admin: Get all appointments ─────────────────────────────────
router.get(
  "/all",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const appointments = await Appointment.find()
        .populate("customer", "name email")
        .populate("service", "name charges");
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);

// ─── Provider: Get pending appointments ──────────────────────────
router.get(
  "/pending",
  authMiddleware,
  roleMiddleware(["provider"]),
  async (req, res) => {
    try {
      const appointments = await Appointment.find({
        provider: req.user.id,
        status: "pending",
      })
        .populate("customer", "name email phone")
        .populate("service", "name charges");
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);

// ─── Provider: Get all assigned jobs ─────────────────────────────
router.get(
  "/provider-jobs",
  authMiddleware,
  roleMiddleware(["provider"]),
  async (req, res) => {
    try {
      const appointments = await Appointment.find({ provider: req.user.id })
        .populate("customer", "name phone")
        .populate("service", "name charges")
        .sort({ createdAt: -1 });
      res.json(appointments);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

// ─── Provider / Admin: Update appointment status ─────────────────
router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware(["provider", "admin"]),
  async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = [
        "pending",
        "accepted",
        "rejected",
        "completed",
        "cancelled",
      ];
      if (!validStatuses.includes(status))
        return res.status(400).json({ message: "Invalid status value" });

      const appointment = await Appointment.findById(req.params.id).populate(
        "service",
      );
      if (!appointment)
        return res.status(404).json({ message: "Appointment not found" });

      if (
        req.user.role === "provider" &&
        appointment.provider.toString() !== req.user.id
      )
        return res
          .status(403)
          .json({ message: "Not authorized to update this appointment" });

      appointment.status = status;
      if (status === "completed") appointment.completedAt = new Date();

      await appointment.save();
      res.json({ message: "Appointment status updated", appointment });
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error updating appointment status",
          error: error.message,
        });
    }
  },
);

// ─── Provider: Appointment history ───────────────────────────────
router.get(
  "/history",
  authMiddleware,
  roleMiddleware(["provider"]),
  async (req, res) => {
    try {
      if (!req.user.service)
        return res
          .status(400)
          .json({ message: "Provider has no service assigned" });

      const appointments = await Appointment.find({
        service: req.user.service,
        status: { $in: ["accepted", "completed"] },
      })
        .populate("customer", "name email")
        .populate("service", "name charges");
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
);


router.get(
  "/provider-earnings",
  authMiddleware,
  roleMiddleware(["provider"]),
  async (req, res) => {
    try {
      const providerId = req.user._id;

      // ── Parse & clamp the months param ──────────────────────────
      // Minimum 1 month, maximum 24 months (2 years), default 6
      const rawMonths = parseInt(req.query.months) || 6;
      const chartMonths = Math.min(Math.max(rawMonths, 1), 24);

      // ── Fetch ALL paid jobs for this provider ────────────────────
      // We fetch ALL jobs (not just in the chart window) so that the
      // all-time stats cards always show the complete picture.
      const paidJobs = await Appointment.find({
        provider: providerId,
        paymentStatus: "paid",
      })
        .populate("customer", "name phone")
        .populate("service", "name")
        .sort({ paidAt: -1 });

      // ── All-time totals (not affected by chart range) ─────────────
      const totalEarnings = paidJobs.reduce(
        (s, j) => s + (j.providerEarnings || 0),
        0,
      );

      const now = new Date();
      const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const todayEarnings = paidJobs
        .filter((j) => j.paidAt && isSameDay(new Date(j.paidAt), now))
        .reduce((s, j) => s + (j.providerEarnings || 0), 0);

      const monthEarnings = paidJobs
        .filter((j) => {
          if (!j.paidAt) return false;
          const d = new Date(j.paidAt);
          return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth()
          );
        })
        .reduce((s, j) => s + (j.providerEarnings || 0), 0);

      // ── Build monthly buckets for the chart window ────────────────
      // Creates one bucket per month going back `chartMonths` months from now.
      // e.g. chartMonths=3 → [Jan, Feb, Mar] (current month is last)
      const months = [];
      for (let i = chartMonths - 1; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: m.toLocaleString("en-US", { month: "short", year: "numeric" }),
          value: 0,
          y: m.getFullYear(),
          mo: m.getMonth(),
        });
      }

      // Fill buckets with jobs that fall inside the chart window
      paidJobs.forEach((j) => {
        if (!j.paidAt) return;
        const d = new Date(j.paidAt);
        const bucket = months.find(
          (x) => x.y === d.getFullYear() && x.mo === d.getMonth(),
        );
        if (bucket) bucket.value += j.providerEarnings || 0;
      });

      // ── Earnings WITHIN the selected chart window (for "range" stat) ─
      const rangeEarnings = months.reduce((s, m) => s + m.value, 0);

      res.json({
        // All-time stats (always full history)
        totalEarnings,
        todayEarnings,
        monthEarnings,
        completedCount: paidJobs.length,

        // Chart range info
        chartMonths, // echoes back what was requested
        rangeEarnings, // total earned within the selected window

        // Chart data — one entry per month in the selected window
        monthlySeries: months.map((m) => ({
          month: m.month,
          earnings: m.value,
        })),

        // Recent jobs table (most recent 50)
        jobs: paidJobs.slice(0, 50),
      });
    } catch (err) {
      console.error("Earnings error", err);
      res.status(500).json({ message: "server Error", error: err.message });
    }
  },
);

// ─── Get single appointment by ID ────────────────────────────────
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("service", "name")
      .populate("provider", "name")
      .populate("customer", "name");
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
