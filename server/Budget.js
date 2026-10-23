const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    monthlyBudget: {
      type: Number,
      min: 0,
      default: undefined,
    },

    categoryLimits: {
      type: Map,
      of: Number,
      default: undefined,
      validate: {
        validator: function (limits) {
          if (!limits) return true;

          return Array.from(limits.values()).every(
            (amount) =>
              typeof amount === "number" &&
              Number.isFinite(amount) &&
              amount >= 0
          );
        },
        message: "Category limits must be non-negative numbers.",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Budget", budgetSchema);