const mongoose = require("mongoose");

const savingsGoalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    target: {
      type: Number,
      required: true,
      min: 0.01,
    },

    saved: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Each savings goal belongs to one user.
savingsGoalSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("SavingsGoal", savingsGoalSchema);