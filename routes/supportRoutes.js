// server/routes/supportRoutes.js
const express = require("express");
const sendEmail = require("../utils/sendEmail");
const router = express.Router();

// POST /support/contact
// Receives form data and emails the support team
router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ message: "Name, email, and message are required." });
    }

    // ── Email TO the support team ──
    await sendEmail({
      to: process.env.SUPPORT_EMAIL || "supportconnectease@gmail.com",
      subject: `[ConnectEase Support] ${subject || "New Contact Request"} — from ${name}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1f2937;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
            <div style="width:40px;height:40px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;line-height:40px;text-align:center;">C</div>
            <div>
              <div style="font-size:18px;font-weight:800;color:#2563eb;">ConnectEase</div>
              <div style="font-size:11px;color:#9ca3af;">New Support Request</div>
            </div>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#1e40af;">New message from a user</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:10px 0;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:100px;">Name</td>
              <td style="padding:10px 0;font-size:14px;font-weight:600;color:#1f2937;">${name}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:10px 0;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Email</td>
              <td style="padding:10px 0;font-size:14px;color:#2563eb;"><a href="mailto:${email}" style="color:#2563eb;">${email}</a></td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:10px 0;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Subject</td>
              <td style="padding:10px 0;font-size:14px;color:#1f2937;">${subject || "Not specified"}</td>
            </tr>
          </table>

          <div style="margin-bottom:8px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Message</div>
          <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:10px;padding:16px 20px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${message}</div>

          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #f3f4f6;">
            <p style="font-size:12px;color:#9ca3af;margin:0;">
              Reply directly to <a href="mailto:${email}" style="color:#2563eb;">${email}</a> to respond to this user.
            </p>
            <p style="font-size:11px;color:#d1d5db;margin:6px 0 0;">
              © ${new Date().getFullYear()} ConnectEase Support System
            </p>
          </div>
        </div>
      `,
    });

    // ── Auto-reply TO the user ──
    await sendEmail({
      to: email,
      subject: "We received your message — ConnectEase Support",
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#1f2937;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;background:#2563eb;width:48px;height:48px;border-radius:12px;line-height:48px;text-align:center;color:#fff;font-size:22px;font-weight:900;">C</div>
            <h2 style="font-size:20px;font-weight:800;color:#1f2937;margin:12px 0 4px;">We got your message!</h2>
            <p style="color:#6b7280;font-size:13px;margin:0;">ConnectEase Support Team</p>
          </div>

          <p style="font-size:15px;margin-bottom:8px;">Hi <strong>${name}</strong>,</p>
          <p style="font-size:14px;color:#4b5563;line-height:1.7;margin-bottom:20px;">
            Thank you for reaching out. We've received your message and our support team will get back to you within <strong>24 hours</strong> on working days.
          </p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
            <p style="font-size:13px;color:#15803d;margin:0;">
              ✓ Your message has been received successfully.
            </p>
          </div>

          <div style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <p style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Your message</p>
            <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;white-space:pre-wrap;">${message}</p>
          </div>

          <p style="font-size:13px;color:#6b7280;line-height:1.6;">
            In the meantime, you can check our FAQ section on the support page — your question may already be answered there.
          </p>

          <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
            © ${new Date().getFullYear()} ConnectEase · supportconnectease@gmail.com
          </p>
        </div>
      `,
    });

    res.status(200).json({ message: "Message sent successfully." });
  } catch (err) {
    console.error("Support email error:", err);
    res
      .status(500)
      .json({ message: "Failed to send message. Please try again." });
  }
});

module.exports = router;
