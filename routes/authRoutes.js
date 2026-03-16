// server/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      serviceId,
      experience,
      price,
      availability,
    } = req.body;

    if (!["customer", "provider"].includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid role. Choose customer or provider." });
    }
    if (role === "provider" && !serviceId) {
      return res
        .status(400)
        .json({ message: "Providers must select a service" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
      service: role === "provider" ? serviceId : null,
    });

    if (role === "provider") {
      newUser.service = serviceId;
      newUser.experience = experience;
      newUser.price = price;
      
      newUser.availability = availability || "Available Today";
    }

    await newUser.save();

    await sendEmail({
      to: email,
      subject: "Welcome to ConnectEase!",
      html: `
        <h2>Welcome to ConnectEase, ${name}!</h2>
        <p>You have successfully registered on ConnectEase.</p>
        <p>You'll receive updates about bookings, services, and progress right here.</p>
        <br/>
        <p>Thanks for choosing us 💙</p>
        <b>- Team ConnectEase</b>
      `,
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error signing up", error: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    
    if (!user.isActive) {
      return res.status(401).json({
        message:
          "Your account has been suspended. Please contact support at supportconnectease@gmail.com",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err });
  }
});

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(200)
        .json({ message: "If this email exists, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000;
    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: email,
      subject: "ConnectEase — Reset Your Password",
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1f2937;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;background:#2563eb;width:48px;height:48px;border-radius:12px;line-height:48px;text-align:center;color:#fff;font-size:22px;font-weight:900;">C</div>
            <h2 style="font-size:22px;font-weight:800;color:#2563eb;margin:12px 0 4px;">ConnectEase</h2>
          </div>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p style="color:#4b5563;line-height:1.6;">We received a request to reset your ConnectEase password. This link is valid for <strong>1 hour</strong>.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${resetURL}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">
              Reset My Password
            </a>
          </div>
          <p style="font-size:12px;color:#2563eb;word-break:break-all;background:#eff6ff;padding:10px 14px;border-radius:8px;">${resetURL}</p>
          <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin-top:16px;">
            <p style="font-size:13px;color:#854d0e;margin:0;">⚠️ If you did not request this, please ignore this email.</p>
          </div>
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
          <p style="font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} ConnectEase · supportconnectease@gmail.com</p>
        </div>
      `,
    });

    res
      .status(200)
      .json({ message: "If this email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// RESET PASSWORD
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({
          message:
            "Reset link is invalid or has expired. Please request a new one.",
        });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "ConnectEase — Password Changed Successfully",
      html: `<p>Hi ${user.name}, your ConnectEase password has been changed successfully.</p>`,
    });

    res.status(200).json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

module.exports = router;
