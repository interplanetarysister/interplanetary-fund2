import React, { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

// The PWA runs the live website. Native downloads are shown only when a
// published, verified APK matches the current web release marker.
export default function InstallIFundApp() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [apk, setApk] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const onInstall = (event) => {
      event.preventDefault();
      if (mounted) setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    Promise.all([
      fetch("/ifund-release.json", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/ifund-android-release.json", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([web, android]) => {
      if (!mounted || !web || !android) return;
      const verified = android.status === "published" &&
        web.release_id === android.release_id &&
        /^[0-9a-f]{64}$/i.test(android.apk_sha256 || "") &&
        /^[0-9a-f]{40}$/i.test(android.source_commit || "");
      let url = null;
      try {
        const candidate = new URL(android.apk_url, window.location.origin);
        if (candidate.protocol === "https:" && !candidate.username && !candidate.password &&
            (candidate.origin === window.location.origin ||
             candidate.hostname === "github.com")) url = candidate.href;
      } catch { /* No published APK available. */ }
      if (verified && url) setApk({ url, release: android.release_id });
    }).catch(() => { /* Website installation option remains available. */ });

    return () => {
      mounted = false;
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setMessage("To install the live web app, open your browser menu and select Install app or Add to Home screen.");
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch {
      setMessage("Use your browser menu to install the live web app.");
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2" aria-label="Install Interplanetary Fund">
      <button type="button" onClick={install}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/50 bg-cyan-400/15 px-5 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/25">
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        Install IFund web app
      </button>
      <p className="max-w-sm text-center text-xs text-slate-300">
        Uses the current website. No separate app download needed.
      </p>
      {apk ? (
        <a href={apk.url} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-200 underline underline-offset-4">
          <Download className="h-4 w-4" aria-hidden="true" />
          Download verified Android APK
        </a>
      ) : (
        <p className="text-center text-xs text-slate-400">
          Native Android download will appear here after its release is verified.
        </p>
      )}
      {message && <p role="status" className="max-w-sm text-center text-sm text-slate-200">{message}</p>}
    </div>
  );
}
