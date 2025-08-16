// app/providers/SettingsContext.js
//----------------------------------
//  Central place for reading AND
//  changing user-settings (theme,
//  alerts, units, …) across the app.
//----------------------------------

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Appearance } from "react-native";                      // 🔸 system dark / light
import { supabase } from "../../lib/supabaseClient";            // 🔸 Supabase helper
import { lightColors, darkColors } from "../theme/colors";      // 🔸 palettes (step 1)

//--------------------------------------------------
// 1) Empty “shape” so TypeScript / IntelliSense
//    knows what lives inside the context.
//--------------------------------------------------
const SettingsContext = createContext({
  loading: true,

  /* read-only values */
  lowFuelAlerts: true,
  vibrateAlerts: true,
  soundAlerts: true,
  notificationsEnabled: true,
  tripPref: "ask",
  units: "miles",
  theme: "system",
  currentTheme: lightColors,  
  setPlan: () => {},   // <-- added

  /* setters (auto-save) */
  setLowFuelAlerts: () => {},
  setVibrateAlerts: () => {},
  setSoundAlerts: () => {},
  setNotificationsEnabled: () => {},
  setTripPref: () => {},
  setUnits: () => {},
  setTheme: () => {},
});

//--------------------------------------------------
// 2) Provider  ➜  wraps the whole <Tabs/>
//--------------------------------------------------
export function SettingsProvider({ children }) {
  // Local copy of every setting
  const [settings, setSettings] = useState({
    low_fuel_alerts: true,
    vibrate_alerts: true,
    sound_alerts: true,
    notifications_enabled: true,
    trip_pref: "ask",
    units: "miles",
    theme: "system",
    plan: "personal"
  });
  const [loading, setLoading] = useState(true);

  // ---------- Load once (app start) ----------
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setLoading(false);

      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) setSettings((prev) => ({ ...prev, ...data }));
      setLoading(false);
    })();
  }, []);

  // ---------- Helper to change + save ----------
  const updateSetting = useCallback((key, value) => {
    // 1. update locally so the UI reacts instantly
    setSettings((prev) => ({ ...prev, [key]: value }));

    // 2. persist in background
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, [key]: value }, { onConflict: "user_id" });
    })();
  }, []);

  // ---------- Derive the actual color palette ----------
  const systemPref = Appearance.getColorScheme() === "dark" ? darkColors : lightColors;
  const currentTheme =
    settings.theme === "dark"
      ? darkColors
      : settings.theme === "light"
        ? lightColors
        : systemPref;

  // ---------- Expose everything to the app ----------
  return (
    <SettingsContext.Provider
      value={{
        loading,

        // current values (read-only)
        lowFuelAlerts:        settings.low_fuel_alerts,
        vibrateAlerts:        settings.vibrate_alerts,
        soundAlerts:          settings.sound_alerts,
        notificationsEnabled: settings.notifications_enabled,
        tripPref:             settings.trip_pref,
        units:                settings.units,
        theme:                settings.theme,
        plan:                 settings.plan,
        currentTheme,                           // <-- NEW!

        // setters that auto-save
        setLowFuelAlerts:        (v) => updateSetting("low_fuel_alerts",       v),
        setVibrateAlerts:        (v) => updateSetting("vibrate_alerts",        v),
        setSoundAlerts:          (v) => updateSetting("sound_alerts",          v),
        setNotificationsEnabled: (v) => updateSetting("notifications_enabled", v),
        setTripPref:             (v) => updateSetting("trip_pref",             v),
        setUnits:                (v) => updateSetting("units",                 v),
        setTheme:                (v) => updateSetting("theme",                 v),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

//--------------------------------------------------
// 3) Tiny helper so any screen can do:
//
//      const { theme, setTheme } = useSettings();
//--------------------------------------------------
export function useSettings() {
  return useContext(SettingsContext);
}

// Default export keeps React-Native bundler happy
export default SettingsProvider;
