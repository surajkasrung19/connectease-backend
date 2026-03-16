// server/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Appointment = require("../models/appointment");
const Service = require("../models/service");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// ─── Get all users with pagination + search ───────────────────────
router.get(
  "/users",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const searchTerm = req.query.search?.trim();
      let filter = {};
      if (searchTerm) {
        const regex = new RegExp(searchTerm, "i");
        filter = {
          $or: [
            { name: regex },
            { email: regex },
            { phone: regex },
            { role: regex },
          ],
        };
      }

      const [users, totalUsers] = await Promise.all([
        User.find(filter)
          .select("-password")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments(filter),
      ]);

      res.json({
        users,
        pagination: {
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit) || 1,
          currentPage: page,
          searchTerm: searchTerm || "",
        },
      });
    } catch (err) {
      console.error("Admin fetch users error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ─── Dashboard stats ──────────────────────────────────────────────
router.get(
  "/dashboard-stats",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });
      const totalServices = await Service.countDocuments({
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      });
      const totalBookings = await Appointment.countDocuments({
        status: "completed",
      });
      const revenueAgg = await Appointment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
      ]);
      const totalRevenue =
        revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
      res.json({ totalUsers, totalServices, totalBookings, totalRevenue });
    } catch (err) {
      console.error("Admin dashboard stats error:", err);
      res.status(500).json({ message: "server error" });
    }
  },
);

// ─── Get all services ─────────────────────────────────────────────
router.get(
  "/services",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const services = await Service.find().sort({ createdAt: -1 });
      res.json(services);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.post(
  "/services",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const { name, description, charges } = req.body;
      const existing = await Service.findOne({ name });
      if (existing)
        return res.status(400).json({ message: "Service already exists" });
      const service = await Service.create({ name, description, charges });
      res.status(201).json(service);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.put(
  "/services/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const updated = await Service.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.delete(
  "/services/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      await Service.findByIdAndUpdate(req.params.id, { isActive: false });
      res.json({ message: "Service deactivated" });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.patch(
  "/services/:id/activate",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const service = await Service.findByIdAndUpdate(
        req.params.id,
        { isActive: true },
        { new: true },
      );
      res.json(service);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.patch(
  "/users/:id/suspend",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
      );
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "server error" });
    }
  },
);

router.patch(
  "/users/:id/activate",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: true },
        { new: true },
      );
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "server error" });
    }
  },
);

router.get(
  "/bookings",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const { status } = req.query;
      const filter = {};
      if (status) filter.status = status;
      const bookings = await Appointment.find(filter)
        .populate("customer", "-password")
        .populate("provider", "-password")
        .populate("service", "name charges")
        .sort({ createdAt: -1 });
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  },
);

router.patch(
  "/bookings/:id/status",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = ["cancelled", "completed"];
      if (!allowed.includes(status))
        return res.status(400).json({ message: "Invalid admin action" });
      const booking = await Appointment.findById(req.params.id);
      if (!booking)
        return res.status(404).json({ message: "Booking not found" });
      booking.status = status;
      if (status === "completed") booking.completedAt = new Date();
      await booking.save();
      res.json({ message: "Booking updated", booking });
    } catch (err) {
      res.status(500).json({ message: "failed to update booking" });
    }
  },
);

// ─── Revenue Analytics ────────────────────────────────────────────
// Returns everything the frontend needs to render charts and analysis:
//   • KPI summary cards (total, platform, provider, bookings)
//   • Month-over-month growth rate
//   • Monthly series for 12 months (3 lines: total, platform, provider)
//   • Service breakdown (which service earns most)
//   • Top 5 providers by earnings
//   • Booking funnel (total vs completed vs paid)
//   • Raw transaction table (most recent 100)
// ─────────────────────────────────────────────────────────────────
router.get(
  "/revenue",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      // ── 1. All completed & paid appointments ─────────────────────
      const allBookings = await Appointment.find({
        status: "completed",
        paymentStatus: "paid",
      })
        .populate("service", "name")
        .populate("customer", "name")
        .populate("provider", "name")
        .sort({ paidAt: -1 });

      // ── 2. KPI totals ─────────────────────────────────────────────
      let totalRevenue = 0;
      let platformRevenue = 0;
      let providerRevenue = 0;

      allBookings.forEach((b) => {
        totalRevenue += b.totalAmount || 0;
        platformRevenue += b.platformFee || 0;
        providerRevenue += b.providerEarnings || 0;
      });

      const totalBookings = allBookings.length;

      // ── 3. Monthly series — last 12 months ────────────────────────
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
          y: d.getFullYear(),
          mo: d.getMonth(),
          total: 0,
          platform: 0,
          provider: 0,
          bookings: 0,
        });
      }

      allBookings.forEach((b) => {
        const d = new Date(b.paidAt || b.completedAt);
        const bucket = months.find(
          (m) => m.y === d.getFullYear() && m.mo === d.getMonth(),
        );
        if (!bucket) return;
        bucket.total += b.totalAmount || 0;
        bucket.platform += b.platformFee || 0;
        bucket.provider += b.providerEarnings || 0;
        bucket.bookings += 1;
      });

      const monthlySeries = months.map((m) => ({
        month: m.label,
        total: m.total,
        platform: m.platform,
        provider: m.provider,
        bookings: m.bookings,
      }));

      // ── 4. Month-over-month growth (current vs previous month) ───
      const curMonth = months[months.length - 1];
      const prevMonth = months[months.length - 2];
      const momGrowth =
        prevMonth.platform > 0
          ? (
              ((curMonth.platform - prevMonth.platform) / prevMonth.platform) *
              100
            ).toFixed(1)
          : curMonth.platform > 0
            ? 100
            : 0;

      // ── 5. Service revenue breakdown ─────────────────────────────
      const serviceMap = {};
      allBookings.forEach((b) => {
        const name = b.service?.name || "Unknown";
        if (!serviceMap[name])
          serviceMap[name] = { revenue: 0, platform: 0, bookings: 0 };
        serviceMap[name].revenue += b.totalAmount || 0;
        serviceMap[name].platform += b.platformFee || 0;
        serviceMap[name].bookings += 1;
      });
      const serviceBreakdown = Object.entries(serviceMap)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.platform - a.platform)
        .slice(0, 8);

      // ── 6. Top 5 providers by earnings ───────────────────────────
      const providerMap = {};
      allBookings.forEach((b) => {
        const id = b.provider?._id?.toString() || "unknown";
        const name = b.provider?.name || "Unknown";
        if (!providerMap[id]) providerMap[id] = { name, earnings: 0, jobs: 0 };
        providerMap[id].earnings += b.providerEarnings || 0;
        providerMap[id].jobs += 1;
      });
      const topProviders = Object.values(providerMap)
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 5);

      // ── 7. Booking funnel ─────────────────────────────────────────
      const [allCreated, allCompleted] = await Promise.all([
        Appointment.countDocuments({}),
        Appointment.countDocuments({ status: "completed" }),
      ]);
      const bookingFunnel = {
        created: allCreated,
        completed: allCompleted,
        paid: totalBookings,
      };

      // ── 8. Raw transaction table (last 100) ───────────────────────
      const revenueData = allBookings.slice(0, 100).map((b) => ({
        id: b._id,
        date: b.paidAt || b.completedAt,
        customer: b.customer?.name,
        provider: b.provider?.name,
        service: b.service?.name,
        totalAmount: b.totalAmount || 0,
        platformFee: b.platformFee || 0,
        providerEarnings: b.providerEarnings || 0,
      }));

      res.json({
        // KPIs
        totalRevenue,
        platformRevenue,
        providerRevenue,
        totalBookings,
        momGrowth: Number(momGrowth),

        // Charts
        monthlySeries,
        serviceBreakdown,
        topProviders,
        bookingFunnel,

        // Table
        revenueData,
      });
    } catch (err) {
      console.error("Revenue report error:", err);
      res.status(500).json({ message: "failed to fetch revenue" });
    }
  },
);

module.exports = router;
