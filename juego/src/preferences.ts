/** Merge known preference fields, including partial older key/touch layouts. */
export function mergePreferences<T>(fallback: T, value: unknown): T {
  if (Array.isArray(fallback)) {
    return (Array.isArray(value) && value.every((x) => typeof x === "string") ? [...value] : [...fallback]) as T;
  }
  if (fallback !== null && typeof fallback === "object") {
    const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const merged: Record<string, unknown> = {};
    for (const [key, original] of Object.entries(fallback)) merged[key] = mergePreferences(original, record[key]);
    return merged as T;
  }
  if (typeof value !== typeof fallback) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return value as T;
}

const LANGUAGES = ["es", "en", "he", "ja", "zh", "ar", "fr", "ru"] as const;
export function preferredLanguage(saved: unknown, browserLanguage: string): typeof LANGUAGES[number] {
  if (typeof saved === "string" && LANGUAGES.some((lang) => lang === saved)) return saved as typeof LANGUAGES[number];
  const short = browserLanguage.slice(0, 2).toLowerCase();
  return LANGUAGES.find((lang) => lang === short) ?? "en";
}
