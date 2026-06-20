import { useState, useEffect } from "react";

/**
 * Hook that captures the browser's beforeinstallprompt event
 * so we can show a custom "Install App" button at the right time.
 */
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled]     = useState(false);

  useEffect(() => {
    // Already installed (standalone mode)?
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();          // stop auto-prompt
      setInstallPrompt(e);         // save it for later
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  return { canInstall: !!installPrompt && !isInstalled, isInstalled, triggerInstall };
}
