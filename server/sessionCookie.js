const SESSION_COOKIE = "spendwise_session";
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

function clearSessionCookie(res) {
  const clearOptions = sessionCookieOptions();
  delete clearOptions.maxAge;
  res.clearCookie(SESSION_COOKIE, clearOptions);
}

function readSessionCookie(req) {
  const cookieHeader = req.headers.cookie || "";
  const sessionPart = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  return sessionPart ? decodeURIComponent(sessionPart.slice(SESSION_COOKIE.length + 1)) : null;
}

module.exports = {
  SESSION_COOKIE,
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
};
