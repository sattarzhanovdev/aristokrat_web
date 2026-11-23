import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
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
    // Приложение рисуется под статус-баром (edge-to-edge, обязательно с Android 16).
    // Отступы берутся из --safe-area-inset-* (Android) / env(safe-area-inset-*) (iOS),
    // цвет значков следует теме устройства.
    await SystemBars.setStyle({ style: SystemBarsStyle.Default });
  } catch {}
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}
}
