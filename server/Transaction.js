
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
legacyId: {
  type: String,
  default: undefined,
},

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },

    icon: {
      type: String,
      default: "💳",
    },

    date: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
transactionSchema.index(
  { user: 1, legacyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      legacyId: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
