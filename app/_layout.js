// app/_layout.js
import React, { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { Platform, AppState } from "react-native";
import Purchases from "react-native-purchases";
import { SettingsProvider } from "../app/providers/SettingsContext";
import { UserVehicleProvider } from "../app/providers/UserVehicleContext";
import { TripLogProvider } from "../app/providers/TripLogProvider";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { LOCATION_TASK } from "../locationTask";
import AsyncStorage from "@react-native-async-storage/async-storage";

// --- SENTRY (uses env DSN so you don't hardcode it) ---
import * as Sentry from "sentry-expo";
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "", // set in .env / EAS
  enableInExpoDevelopment: true,
  debug: __DEV__,
  tracesSampleRate: 1.0, // optional performance tracing
});

// Optional: capture unhandled rejections in JS
if (typeof PromiseRejectionEvent === "undefined") {
  // RN doesn't have PromiseRejectionEvent; Sentry still hooks globals,
  // this just avoids TS noise if you add typings later.
}

// --- Optional device info logging (safe if you decide to remove it later) ---
let Device = null as any;
try {
  // Keep this dynamic so it won’t break web bundling
  // Note: sentry-expo already depends on expo-device; ensure it's installed.
  // @ts-ignore
  Device = require("expo-device");
} catch {
  // leave null
}

export default function RootLayout() {
  const reminderId = useRef<string | null>(null);

  // --- RevenueCat: guard so dev builds without native module don't explode ---
  useEffect(() => {
    try {
      const hasRC =
        Purchases &&
        typeof Purchases.configure === "function" &&
        typeof Purchases.getCustomerInfo === "function";
      if (hasRC) {
        Purchases.configure({
          apiKey: Platform.select({
            ios: "appl_JiUsWQRyNraQSTVYPnWAlgIrIpK",
            android: "goog_ODDOXcbpQuRRPxVIkCcasSHNRpu",
          }),
        });
        // Purchases.setLogLevel("DEBUG");
      } else {
        console.log("RevenueCat not available; skipping configure().");
      }
    } catch (e: any) {
      console.log("RevenueCat configure failed (ignored in dev):", e?.message || e);
    }
  }, []);

  // --- Device info (only if expo-device is present) ---
  useEffect(() => {
    if (Device) {
      console.log("Device:", {
        manufacturer: Device.manufacturer,
        model: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        isDevice: Device.isDevice,
      });
    }
  }, []);

  // --- Location + notifications bootstrap (same logic, wrapped in try/catch) ---
  useEffect(() => {
    (async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
        await Location.requestBackgroundPermissionsAsync();

        const alreadyPrompted = await AsyncStorage.getItem("notifPrompted");
        const { status } = await Notifications.getPermissionsAsync();

        if (status !== "granted" && !alreadyPrompted) {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          if (newStatus === "granted") {
            await AsyncStorage.setItem("notifPrompted", "true");
          }
        }

        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
        if (!isRunning) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK, {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 2000,
            distanceInterval: 10,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: "NavMiles Navigation",
              notificationBody: "Turn-by-turn navigation is active.",
              notificationColor: "#3578e5",
            },
          });
        }
      } catch (e: any) {
        console.log("Location/notification init failed:", e?.message || e);
        // Don't throw — this is non-fatal for app boot.
      }
    })();
  }, []);

  // --- “We miss you!” reminder ---
  useEffect(() => {
    const LAST_FOREGROUND_TIMESTAMP_KEY = "lastForegroundTimestamp";
    const REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48h

    async function checkAndScheduleReminder() {
      const now = Date.now();
      let last = await AsyncStorage.getItem(LAST_FOREGROUND_TIMESTAMP_KEY);

      if (last) {
        const diff = now - parseInt(last, 10);
        if (diff >= REMINDER_INTERVAL_MS) {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          const existing = scheduled.find(
            (n) =>
              n.content?.title === "We miss you!" &&
              (n.content?.body || "").includes("NavMiles stats")
          );
          if (existing) {
            await Notifications.cancelScheduledNotificationAsync(existing.identifier);
          }
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "We miss you!",
              body: "Come back and check your NavMiles stats 🚗",
              sound: "default",
            },
            trigger: null,
          });
        }
      }

      await AsyncStorage.setItem(LAST_FOREGROUND_TIMESTAMP_KEY, String(now));
    }

    checkAndScheduleReminder();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkAndScheduleReminder();
    });
    return () => sub.remove();
  }, []);

  return (
    <SettingsProvider>
      <UserVehicleProvider>
        <TripLogProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </TripLogProvider>
      </UserVehicleProvider>
    </SettingsProvider>
  );
}
