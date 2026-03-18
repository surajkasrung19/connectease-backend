// server/utils/sendEmail.js
const https = require("https");

const sendEmail = async ({ to, subject, html }) => {
  const data = JSON.stringify({
    sender: {
      name: "ConnectEase",
      email: process.env.EMAIL_USER,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`Brevo API error: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
};

module.exports = sendEmail;
