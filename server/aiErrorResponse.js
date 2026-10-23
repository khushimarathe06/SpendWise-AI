function getAiErrorResponse(error) {
  const errorMessage = String(error?.message || "").toLowerCase();
  const timedOut =
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    errorMessage.includes("operation was aborted") ||
    errorMessage.includes("request was aborted") ||
    errorMessage.includes("deadline_exceeded") ||
    errorMessage.includes("deadline expired");

  if (timedOut) {
    return {
      status: 504,
      message: "The AI request took too long. Please try again in a moment.",
    };
  }

  const providerStatus = Number(
    error?.status || error?.code || error?.cause?.status
  );

  if (providerStatus === 429) {
    return {
      status: 429,
      message:
        "The AI service is receiving too many requests. Please wait briefly and try again.",
    };
  }

  if ([500, 502, 503, 504].includes(providerStatus)) {
    return {
      status: 503,
      message:
        "The AI service is temporarily busy. Your question is still here; please try again in a moment.",
    };
  }

  return {
    status: 500,
    message: "I couldn't get a response right now. Please try again in a moment.",
  };
}

module.exports = getAiErrorResponse;
