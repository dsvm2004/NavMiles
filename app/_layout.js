// app/_layout.js
import React, { useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { Platform, AppState, View, Button } from "react-native";
import Purchases from "react-native-purchases";
import { SettingsProvider } from "../app/providers/SettingsContext";
import { UserVehicleProvider } from "../app/providers/UserVehicleContext";
import { TripLogProvider } from "../app/providers/TripLogProvider";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { LOCATION_TASK } from "../locationTask";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { supabase } from "../lib/supabaseClient";

// 🔹 Make expo-device optional to avoid bundling errors if not installed
let Device = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Device = require("expo-device");
} catch (_) {
  // leave null
}

// ✅ Initialize Sentry (paste your real DSN from Sentry)
Sentry.init({
  dsn: "https://69279e71b5d8e36b33c87daef623cd87@o4509851788967936.ingest.us.sentry.io/4509851802927104",
  enableInExpoDevelopment: true,
  debug: __DEV__,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.0,
});

export default Sentry.wrap(function RootLayout() {
  const reminderId = useRef(null);
  const [userSet, setUserSet] = useState(false);

  // Attach user & device context to Sentry as early as possible
  useEffect(() => {
    (async () => {
      try {
        // — user (Supabase)
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user) {
          const u = data.user;
          Sentry.setUser({
            id: u.id,
            email: u.email || undefined,
          });
        } else {
          // anonymous (still useful to group devices)
          Sentry.setUser({ id: "anonymous" });
        }

        // — app info
        const appVersion =
          Constants?.expoConfig?.version ||
          Constants?.manifest?.version ||
          "unknown";

        Sentry.setContext("app", {
          name:
            Constants?.expoConfig?.name ||
            Constants?.manifest?.name ||
            "NavMiles",
          version: appVersion,
          buildNumber:
            Constants?.expoConfig?.ios?.buildNumber ||
            Constants?.expoConfig?.android?.versionCode ||
            "unknown",
          releaseChannel: Constants?.expoConfig?.releaseChannel || "dev",
        });

        // — device info (if expo-device available)
        if (Device) {
          Sentry.setContext("device", {
            manufacturer: Device.manufacturer ?? "unknown",
            brand: Device.brand ?? "unknown",
            model: Device.modelName ?? "unknown",
            osName: Device.osName ?? Platform.OS,
            osVersion: Device.osVersion ?? "unknown",
            deviceType: String(Device.deviceType ?? "unknown"),
            isPhysicalDevice: String(Device.isDevice ?? "unknown"),
          });
        } else {
          Sentry.setContext("device", {
            platform: Platform.OS,
          });
        }

        setUserSet(true);
      } catch (e) {
        // don’t crash if Sentry context-setting fails
        console.log("Sentry context init error:", e?.message || e);
      }
    })();
  }, []);

  // RevenueCat (guard during dev)
  useEffect(() => {
    try {
      if (
        Purchases &&
        typeof Purchases.configure === "function" &&
        typeof Purchases.getCustomerInfo === "function"
      ) {
        Purchases.configure({
          apiKey: Platform.select({
            ios: "appl_JiUsWQRyNraQSTVYPnWAlgIrIpK",
            android: "goog_ODDOXcbpQuRRPxVIkCcasSHNRpu",
          }),
        });
        // Purchases.setLogLevel("DEBUG");
      } else {
        console.log("RevenueCat not available in this build; skipping configure()");
      }
    } catch (e) {
      console.log("RevenueCat configure failed (ignored in dev):", e?.message || e);
    }
  }, []);

  // Location + notifications
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
      } catch (e) {
        console.log("Location/notification init failed (dev build):", e?.message || e);
      }
    })();
  }, []);

  // “We miss you!” reminder
  useEffect(() => {
    const LAST_FOREGROUND_TIMESTAMP_KEY = "lastForegroundTimestamp";
    const REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000;

    async function checkAndScheduleReminder() {
      const now = Date.now();
      let lastForegroundTimestamp = await AsyncStorage.getItem(LAST_FOREGROUND_TIMESTAMP_KEY);

      if (lastForegroundTimestamp) {
        const last = parseInt(lastForegroundTimestamp, 10);
        const diff = now - last;

        if (diff >= REMINDER_INTERVAL_MS) {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          const existingReminder = scheduled.find(
            (n) => n.content.title === "We miss you!" && n.content.body?.includes("NavMiles stats")
          );
          if (existingReminder) {
            await Notifications.cancelScheduledNotificationAsync(existingReminder.identifier);
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
      if (state === "active") {
        checkAndScheduleReminder();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Sentry.TouchEventBoundary>
      <SettingsProvider>
        <UserVehicleProvider>
          <TripLogProvider>
            <View style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false }} />

              {/* ✅ Dev-only Sentry test button (includes user/device extras) */}
              {__DEV__ && (
                <View style={{ padding: 10 }}>
                  <Button
                    title={userSet ? "Send Sentry Test Event" : "Preparing Sentry..."}
                    disabled={!userSet}
                    onPress={() => {
                      Sentry.captureException(new Error("First error"), {
                        extra: {
                          reason: "manual_test_button",
                          ts: new Date().toISOString(),
                          platform: Platform.OS,
                          appVersion:
                            Constants?.expoConfig?.version ||
                            Constants?.manifest?.version ||
                            "unknown",
                        },
                        tags: {
                          env: __DEV__ ? "development" : "production",
                          area: "root_layout",
                        },
                      });
                    }}
                  />
                </View>
              )}
            </View>
          </TripLogProvider>
        </UserVehicleProvider>
      </SettingsProvider>
    </Sentry.TouchEventBoundary>
  );
});
