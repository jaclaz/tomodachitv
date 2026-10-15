export function detectRegion(): string {
  if (typeof navigator === "undefined") return "US";
  const parts = (navigator.language || "en-US").split("-");
  const code = (parts[1] || parts[0] || "US").toUpperCase();
  return code.length === 2 ? code : "US";
}
