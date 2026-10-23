
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./User");
const { setSessionCookie, clearSessionCookie } = require("./sessionCookie");
const createRateLimiter = require("./rateLimit");

const router = express.Router();
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
});

// CREATE ACCOUNT
router.post("/signup", authRateLimit, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (
      trimmedName.length < 2 ||
      trimmedName.length > 60 ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Enter a name of 2–60 characters, a valid email, and a password of 8–128 characters.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        tokenVersion: user.tokenVersion ?? 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    setSessionCookie(res, token);

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Signup error:", error.message);

    return res.status(500).json({
      message: "Unable to create account right now.",
    });
  }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ message: "You have been logged out." });
});

// LOG IN
router.post("/login", authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      email.trim().length > 254 ||
      !password ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Enter your email and password.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        tokenVersion: user.tokenVersion ?? 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    setSessionCookie(res, token);

    return res.json({
      message: "Login successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Unable to log in right now.",
    });
  }
});

module.exports = router;
