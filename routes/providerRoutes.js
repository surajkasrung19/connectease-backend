// server/routes/providerRoutes.js
const express = require("express");
const User = require("../models/user");
const auth = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");
const router = express.Router();

// Get providers by service
router.get("/", async (req, res) => {
  try {
    const { serviceId } = req.query;

    if (!serviceId) {
      return res.status(400).json({ error: "serviceId is required" });
    }

   
    const providers = await User.find({
      role: "provider",
      service: serviceId,
      isActive: true, // ← ADDED: suspended providers no longer bookable
    }).select(
      "name email phone service price experience rating reviews availability",
    );

    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: "server error" });
  }
});

// Get logged-in provider profile
router.get("/me", auth, async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res
        .status(403)
        .json({ message: "Access denied. Not a provider." });
    }
    const provider = await User.findById(req.user._id).select("-password");
    res.json({ user: provider });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch provider profile", err });
  }
});

// Update provider profile
router.patch("/update", auth, async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ message: "Access denied." });
    }

    const { name, phone, experience, price, availability, address } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, experience, price, availability, address },
      { new: true, runValidators: true },
    ).select("-password");

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update provider profile", err });
  }
});

// Change provider password
router.patch("/change-password", auth, async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ message: "Access denied." });
    }

    const { oldPassword, newPassword } = req.body;
    const provider = await User.findById(req.user._id);

    const match = await bcrypt.compare(oldPassword, provider.password);
    if (!match) {
      return res.status(400).json({ message: "Incorrect old password" });
    }

    provider.password = await bcrypt.hash(newPassword, 10);
    await provider.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to change password", err });
  }
});

module.exports = router;
