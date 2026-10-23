const express = require("express");
const mongoose = require("mongoose");
const Transaction = require("./Transaction");
const authenticateUser = require("./authenticateUser");

const router = express.Router();

function isValidTransactionDate(value) {
  if (typeof value !== "string") return false;
  const date = value.trim();
  if (!date || date.length > 50) return false;
  if (/^(today|yesterday|just now)$/i.test(date)) return true;

  const isoDate = date.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (isoDate) {
    const [, year, month, day, suffix] = isoDate;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    const validCalendarDate =
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day);

    if (!validCalendarDate) return false;
    if (!suffix) return true;
    return /^T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(suffix) &&
      Number.isFinite(Date.parse(date));
  }

  // Older imported backups may contain a readable date string.
  return Number.isFinite(Date.parse(date));
}

// Validate transaction data.
function validateTransaction(req, res, next) {
  const { title, category, amount, type, date } = req.body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 100
  ) {
    return res.status(400).json({
      message: "Enter a valid transaction title.",
    });
  }

  if (
    typeof category !== "string" ||
    !category.trim() ||
    category.trim().length > 60
  ) {
    return res.status(400).json({
      message: "Enter a valid category.",
    });
  }

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return res.status(400).json({
      message: "Amount must be greater than zero.",
    });
  }

  if (!["income", "expense"].includes(type)) {
    return res.status(400).json({
      message: "Invalid transaction type.",
    });
  }

  if (!isValidTransactionDate(date)) {
    return res.status(400).json({
      message: "Enter a valid transaction date.",
    });
  }

  next();
}

// GET: Fetch only the logged-in user's transactions.
router.get("/", authenticateUser, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      user: req.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      transactions.map((transaction) => {
        const { _id, __v, ...safeTransaction } = transaction;

        return {
          ...safeTransaction,
          id: _id.toString(),
          legacyId: transaction.legacyId,
        };
      })
    );
  } catch (error) {
    console.error("Fetch transactions failed:", error.message);

    res.status(500).json({
      message: "Could not fetch transactions.",
    });
  }
});

// POST: Create a new transaction or safely import a legacy transaction.
// POST: Create a transaction or safely import a legacy transaction.
router.post("/", authenticateUser, validateTransaction, async (req, res) => {
  try {
    const {
      legacyId,
      title,
      description,
      category,
      amount,
      type,
      icon,
      date,
    } = req.body;

    // Validate the legacy ID when provided.
    if (
      legacyId !== undefined &&
      (typeof legacyId !== "string" ||
        !legacyId.trim() ||
        legacyId.length > 200)
    ) {
      return res.status(400).json({
        message: "Invalid legacy transaction ID.",
      });
    }

    const fields = {
      title: title.trim(),
      description:
        typeof description === "string"
          ? description.trim().slice(0, 200)
          : "",
      category: category.trim(),
      amount,
      type,
      icon: typeof icon === "string" ? icon.slice(0, 20) : "💳",
      date: date.trim(),
    };

    let transaction;
    let created = false;

    if (typeof legacyId === "string") {
      // Each legacy transaction is unique within the logged-in account.
      const filter = {
        user: req.userId,
        legacyId: legacyId.trim(),
      };

      // First check whether this transaction has already been imported.
      transaction = await Transaction.findOne(filter);

      if (!transaction) {
        try {
          transaction = await Transaction.create({
            ...fields,
            ...filter,
          });

          created = true;
        } catch (error) {
          // Another request may have imported the same transaction.
          if (error.code !== 11000) {
            throw error;
          }

          transaction = await Transaction.findOne(filter);

          if (!transaction) {
            throw error;
          }
        }
      }
    } else {
      // Ordinary new transaction; no legacy ID is needed.
      transaction = await Transaction.create({
        ...fields,
        user: req.userId,
      });

      created = true;
    }

    const {
      _id,
      __v,
      ...safeTransaction
    } = transaction.toObject();

    return res.status(created ? 201 : 200).json({
      ...safeTransaction,
      id: _id.toString(),
    });
  } catch (error) {
    console.error("Save transaction failed:", error.message);

    return res.status(500).json({
      message: "Could not save the transaction.",
    });
  }
});
// PUT: Update only a transaction owned by the logged-in user.
router.put("/:id", authenticateUser, validateTransaction, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid transaction ID.",
      });
    }

    const {
      title,
      description,
      category,
      amount,
      type,
      icon,
      date,
    } = req.body;

    const updated = await Transaction.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.userId,
      },
      {
        title: title.trim(),
        description:
          typeof description === "string"
            ? description.trim().slice(0, 200)
            : "",
        category: category.trim(),
        amount,
        type,
        icon: typeof icon === "string" ? icon.slice(0, 20) : "💳",
        date: date.trim(),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Transaction not found.",
      });
    }

    const {
      _id,
      __v,
      ...safeTransaction
    } = updated.toObject();

    res.json({
      ...safeTransaction,
      id: _id.toString(),
    });
  } catch (error) {
    console.error("Update transaction failed:", error.message);

    res.status(500).json({
      message: "Could not update the transaction.",
    });
  }
});

// DELETE: Delete only a transaction owned by the logged-in user.
router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid transaction ID.",
      });
    }

    const deleted = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Transaction not found.",
      });
    }

    res.json({
      message: "Transaction deleted successfully.",
    });
  } catch (error) {
    console.error("Delete transaction failed:", error.message);

    res.status(500).json({
      message: "Could not delete the transaction.",
    });
  }
});

module.exports = router;
