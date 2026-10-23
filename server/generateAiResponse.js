const getAiErrorResponse = require("./aiErrorResponse");

const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

async function generateAiResponse(
  ai,
  primaryModel,
  contents,
  { timeoutMs = 30_000, wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay)), log = console.log } = {}
) {
  let model = primaryModel;
  let fallbackUsed = false;
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          ...(model.startsWith("gemini-3")
            ? { thinkingConfig: { thinkingLevel: "low" } }
            : {}),
          httpOptions: {
            timeout: timeoutMs,
            retryOptions: { attempts: 1 },
          },
        },
      });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || error?.code);
      const timedOut = getAiErrorResponse(error).status === 504;

      if (timedOut && !fallbackUsed && model !== FALLBACK_MODEL) {
        model = FALLBACK_MODEL;
        fallbackUsed = true;
        log("Gemini request exceeded its deadline; retrying with Flash-Lite.");
        continue;
      }

      if (timedOut && fallbackUsed) throw error;

      if (!RETRYABLE_STATUSES.has(status)) throw error;

      if (attempt < 2) {
        const delay = 1000 * 2 ** attempt;
        log(`Gemini temporarily unavailable. Retrying in ${delay / 1000} seconds...`);
        await wait(delay);
      }
    }
  }

  throw lastError || new Error("Gemini did not return a response.");
}

module.exports = generateAiResponse;
