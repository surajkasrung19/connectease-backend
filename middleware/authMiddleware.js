//server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No Token Provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Fetch user from DB so we also get `service`
    const user = await User.findById(decoded.id || decoded._id).select(
      "-password",
    );

    req.user = user; // Attach user to request object
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or Expired Token", error: err });
  }
};

module.exports = authMiddleware;
