//server/routes/userRoutes.js
const express = require("express");
const User = require("../models/user");
const auth = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");

const router = express.Router();

// Get profile
router.get("/me", auth, async (req, res) => {
  try {
    res.json(req.user); //already fetched in auth middleware
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user profile", err });
  }
});

//patch update profile
router.patch("/update", auth, async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, address },
      { new: true, runValidators: true },
    ).select("-password");

    res.json({ message: "Profile updated successfully", user: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile", err });
  }
});

// change password
router.patch("/change-password", auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    //check old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect old password" });
    }

    // update password
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to change password", err });
  }
});

module.exports = router;
