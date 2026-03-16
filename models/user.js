// server/models/user.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String },

    role: {
      type: String,
      enum: ["customer", "provider", "admin"],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    //only for providers
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },

    experience: {
      type: String,
      default: null,
    },

    price: {
      type: Number,
      default: null,
    },

    rating: {
      type: Number,
      default: 4.5,
    },

    reviews: {
      type: Number,
      default: 0,
    },

    availability: {
      type: String,
      default: "Available Today",
    },

    address: { type: String, default: "" },

    //password Reset field
    resetPasswordToken: { type: String, default: undefined },
    resetPasswordExpiry: { type: Date, default: undefined },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
