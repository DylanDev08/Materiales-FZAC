(() => {
  const retryKey = "fzac-static-asset-retry";
  let recoveryScheduled = false;

  window.addEventListener("error", (event) => {
    const target = event.target;
    const source = target instanceof HTMLScriptElement
      ? target.src
      : target instanceof HTMLLinkElement && target.rel === "stylesheet"
        ? target.href
        : "";

    if (recoveryScheduled || !source.includes("/_next/static/")) return;
    recoveryScheduled = true;

    let retries = 0;
    try { retries = Number(window.sessionStorage.getItem(retryKey) || "0"); } catch {}
    if (retries >= 2) return;
    try { window.sessionStorage.setItem(retryKey, String(retries + 1)); } catch {}

    window.setTimeout(() => window.location.reload(), 250 * (retries + 1));
  }, true);

  window.addEventListener("load", () => {
    if (recoveryScheduled) return;
    try { window.sessionStorage.removeItem(retryKey); } catch {}
  }, { once: true });
})();
