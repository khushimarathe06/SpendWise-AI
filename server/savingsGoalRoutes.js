const express = require("express");
const mongoose = require("mongoose");
const SavingsGoal = require("./SavingsGoal");
const authenticateUser = require("./authenticateUser");

const router = express.Router();

// Validate goal name and target.
function validateGoal(req, res, next) {
  const { name, target } = req.body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100
  ) {
    return res.status(400).json({
      message: "Enter a goal name between 1 and 100 characters.",
    });
  }

  if (
    typeof target !== "number" ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return res.status(400).json({
      message: "Target amount must be greater than zero.",
    });
  }

  next();
}

// GET: Retrieve only the logged-in user's goals.
router.get("/", authenticateUser, async (req, res) => {
  try {
    const goals = await SavingsGoal.find({
      user: req.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      goals.map(({ _id, __v, ...goal }) => ({
        ...goal,
        id: _id.toString(),
      }))
    );
  } catch (error) {
    console.error("Fetch savings goals failed:", error.message);

    res.status(500).json({
      message: "Could not fetch your savings goals.",
    });
  }
});

// POST: Create a new savings goal.
router.post("/", authenticateUser, validateGoal, async (req, res) => {
  try {
    const goal = await SavingsGoal.create({
      user: req.userId,
      name: req.body.name.trim(),
      target: req.body.target,
      saved: 0,
    });

    res.status(201).json({
      message: "Savings goal created successfully.",
      goal: {
        id: goal._id.toString(),
        name: goal.name,
        target: goal.target,
        saved: goal.saved,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
      },
    });
  } catch (error) {
    console.error("Create savings goal failed:", error.message);

    res.status(500).json({
      message: "Could not create your savings goal.",
    });
  }
});

// PUT: Update a goal's name and target.
router.put("/:id", authenticateUser, validateGoal, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid savings goal ID.",
      });
    }

    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!goal) {
      return res.status(404).json({
        message: "Savings goal not found.",
      });
    }

    goal.name = req.body.name.trim();
    goal.target = req.body.target;

    // Do not allow a new target below the amount already saved.
    if (goal.target < goal.saved) {
      return res.status(400).json({
        message: "Target cannot be less than the amount already saved.",
      });
    }

    await goal.save();

    res.json({
      message: "Savings goal updated successfully.",
      goal: {
        id: goal._id.toString(),
        name: goal.name,
        target: goal.target,
        saved: goal.saved,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update savings goal failed:", error.message);

    res.status(500).json({
      message: "Could not update your savings goal.",
    });
  }
});

// PATCH: Add savings to a goal.
router.patch("/:id/savings", authenticateUser, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid savings goal ID.",
      });
    }

    const { amount } = req.body;

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        message: "Savings amount must be greater than zero.",
      });
    }

    // Update only a goal owned by this user.
    const goal = await SavingsGoal.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.userId,
        $expr: {
          $lt: ["$saved", "$target"],
        },
      },
      [
        {
          $set: {
            saved: {
              $min: [
                "$target",
                { $add: ["$saved", amount] },
              ],
            },
          },
        },
      ],
      {
        new: true,
        updatePipeline: true,
      }
    );

    if (!goal) {
      return res.status(404).json({
        message: "Savings goal not found or its target has already been reached.",
      });
    }

    res.json({
      message: "Savings added successfully.",
      goal: {
        id: goal._id.toString(),
        name: goal.name,
        target: goal.target,
        saved: goal.saved,
      },
    });
  } catch (error) {
    console.error("Add savings failed:", error.message);

    res.status(500).json({
      message: "Could not add savings to your goal.",
    });
  }
});

// DELETE: Delete only a goal owned by this user.
router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid savings goal ID.",
      });
    }

    const deleted = await SavingsGoal.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Savings goal not found.",
      });
    }

    res.json({
      message: "Savings goal deleted successfully.",
    });
  } catch (error) {
    console.error("Delete savings goal failed:", error.message);

    res.status(500).json({
      message: "Could not delete your savings goal.",
    });
  }
});

module.exports = router;
