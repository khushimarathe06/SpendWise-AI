const configuredApiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const API_BASE = configuredApiBase.replace(/\/+$/, "");
