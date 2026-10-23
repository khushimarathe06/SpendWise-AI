const assert = require("node:assert/strict");
const { test } = require("node:test");
const getAiErrorResponse = require("../aiErrorResponse");

test("Gemini rate limits ask the user to wait and retry", () => {
  const response = getAiErrorResponse({ status: 429 });

  assert.equal(response.status, 429);
  assert.match(response.message, /wait briefly and try again/i);
});

test("Gemini temporary outages preserve retry guidance", () => {
  const response = getAiErrorResponse({ status: 503 });

  assert.equal(response.status, 503);
  assert.match(response.message, /question is still here/i);
});

test("AI timeouts keep their dedicated timeout response", () => {
  const response = getAiErrorResponse({ name: "TimeoutError" });

  assert.equal(response.status, 504);
  assert.match(response.message, /took too long/i);
});

test("Gemini SDK abort messages are treated as timeouts", () => {
  const response = getAiErrorResponse({ message: "This operation was aborted" });

  assert.equal(response.status, 504);
  assert.match(response.message, /took too long/i);
});

test("unexpected AI errors stay generic and do not expose provider details", () => {
  const response = getAiErrorResponse({
    status: 401,
    message: "Sensitive provider response",
  });

  assert.equal(response.status, 500);
  assert.doesNotMatch(response.message, /Sensitive provider response/i);
});
