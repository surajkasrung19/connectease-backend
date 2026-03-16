//server/routes/feedbackRoutes.js
const express = require("express");
const User = require("../models/user");
const Feedback = require("../models/feedback");
const Appointment = require("../models/appointment");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

//submit feedback (customer)
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["customer"]),
  async (req, res) => {
    try {
      const { appointmentId, rating, comment } = req.body;

      const appointment = await Appointment.findById(appointmentId);

      if (!appointment)
        return res.status(404).json({ message: "Appointment Not found" });

      if (
        appointment.paymentStatus !== "paid" ||
        appointment.status !== "completed"
      ) {
        return res
          .status(400)
          .json({
            message: "Feedback is only allowed after payment is completed.",
          });
      }

      const existingFeedback = await Feedback.findOne({
        appointment: appointmentId,
      });
      if (existingFeedback) {
        return res
          .status(400)
          .json({ message: "Feedback already submitted for this appointment" });
      }

      //Save feedback
      const feedback = await Feedback.create({
        appointment: appointmentId,
        customer: appointment.customer,
        provider: appointment.provider,
        service: appointment.service,
        rating,
        comment,
      });

      //Recalculate provider rating
      const stats = await Feedback.aggregate([
        { $match: { provider: appointment.provider } },
        {
          $group: {
            _id: "$provider",
            avgRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]);

      //Update provider document
      if (stats.length > 0) {
        await User.findByIdAndUpdate(appointment.provider, {
          rating: Number(stats[0].avgRating.toFixed(1)),
          reviews: stats[0].totalReviews,
        });
      }

      res.json({ message: "Feedback submitted successfully", feedback });
    } catch (err) {
      res.status(500).json({ message: "Error in submitting feedback", err });
    }
  },
);

//Get Latest feedbacks for homepage
router.get("/latest", async (req, res) => {
  try {
    const feedbacks = await Feedback.find({
      comment: { $exists: true, $ne: "" },
      rating: { $gte: 4 },
    })
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .limit(6);

    //extra safety : remove whitespace-only comments that slipped throught
    const withRealComments = feedbacks.filter(
      (f) => f.comment && f.comment.trim().length > 0,
    );

    res.json(withRealComments);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error in fecthing latest feedbacks", err });
  }
});

module.exports = router;
