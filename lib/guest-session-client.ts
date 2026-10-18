let sessionPromise: Promise<void> | undefined;

export function ensureGuestSession(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/guest-session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Guest session could not be created.");
    }).catch((error) => { sessionPromise = undefined; throw error; });
  }
  return sessionPromise;
}
