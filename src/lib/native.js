import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/** Тактильный отклик: нативный в приложении, vibrate в браузере. */
export const haptic = {
  tap() {
    if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else navigator.vibrate?.(8);
  },
  success() {
    if (isNative)
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else navigator.vibrate?.([10, 40, 10]);
  },
  error() {
    if (isNative)
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else navigator.vibrate?.([30, 50, 30]);
  },
};

/** Настройка статус-бара и сплэша при старте нативного приложения. */
export async function initNative() {
  if (!isNative) return;
  document.documentElement.classList.add("native", `platform-${platform}`);
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (platform === "android") {
      // На Android WebView не всегда отдаёт safe-area, поэтому статус-бар не накладываем
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: dark ? "#0b0d12" : "#f3f4f7" });
    }
  } catch {}
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}
}
