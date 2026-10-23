const assert = require("node:assert/strict");
const { test } = require("node:test");
const generateAiResponse = require("../generateAiResponse");

test("deadline errors retry once with the faster Flash-Lite model", async () => {
  const models = [];
  const calls = [];
  const ai = {
    models: {
      async generateContent(options) {
        models.push(options.model);
        calls.push(options);
        if (models.length === 1) {
          throw Object.assign(
            new Error(
              '{"error":{"code":504,"message":"Deadline expired before operation could complete.","status":"DEADLINE_EXCEEDED"}}'
            ),
            { status: 504 }
          );
        }
        return { text: "A concise test response" };
      },
    },
  };

  const result = await generateAiResponse(ai, "gemini-3.8-flash", "hello", {
    log: () => {},
  });

  assert.equal(result.text, "A concise test response");
  assert.deepEqual(models, ["gemini-3.8-flash", "gemini-3.5-flash-lite"]);
  assert.deepEqual(calls[0].config.thinkingConfig, { thinkingLevel: "low" });
  assert.equal(calls[0].config.httpOptions.timeout, 30_000);
});

test("a deadline from fallback is returned instead of looping", async () => {
  const models = [];
  const ai = {
    models: {
      async generateContent({ model }) {
        models.push(model);
        throw Object.assign(new Error("Deadline expired"), { status: 504 });
      },
    },
  };

  await assert.rejects(
    generateAiResponse(ai, "gemini-3.8-flash", "hello", { log: () => {} }),
    /Deadline expired/
  );
  assert.deepEqual(models, ["gemini-3.8-flash", "gemini-3.5-flash-lite"]);
});

test("temporary provider failures retry with the configured wait", async () => {
  let calls = 0;
  const waits = [];
  const ai = {
    models: {
      async generateContent() {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("busy"), { status: 503 });
        return { text: "recovered" };
      },
    },
  };

  const result = await generateAiResponse(ai, "gemini-2.5-flash", "hello", {
    wait: async (delay) => waits.push(delay),
    log: () => {},
  });

  assert.equal(result.text, "recovered");
  assert.deepEqual(waits, [1000]);
});
