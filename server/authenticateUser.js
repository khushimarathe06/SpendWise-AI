const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("./User");
const { readSessionCookie } = require("./sessionCookie");

async function authenticateUser(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;
    const cookieToken = readSessionCookie(req);
    // Prefer the browser-managed cookie when both are present, so a stale
    // legacy token cannot override an otherwise valid cookie session.
    const token = cookieToken || bearerToken;
    if (!token) {
      return res.status(401).json({ message: "Please log in to continue." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!mongoose.isValidObjectId(decoded.userId)) {
      return res.status(401).json({ message: "Invalid login token." });
    }

    const user = await User.findById(decoded.userId);
    if (!user || (decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({
        message: "Your session has ended. Please log in again.",
      });
    }

    req.user = user;
    req.userId = user._id.toString();
    req.authToken = token;
    req.authMethod = cookieToken ? "cookie" : "bearer";
    return next();
  } catch {
    return res.status(401).json({
      message: "Your login session is invalid or expired. Please log in again.",
    });
  }
}

module.exports = authenticateUser;
