export function shouldUseSecureCookies() {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const appUrl = process.env.APP_URL?.trim();

  if (!appUrl) {
    return true;
  }

  try {
    return new URL(appUrl).protocol === "https:";
  } catch {
    return true;
  }
}
