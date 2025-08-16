// app/tabs/SettingsScreen.js


import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSettings } from "../providers/SettingsContext";
import { supabase } from "../../lib/supabaseClient"; // Make sure this is imported!
import { Linking } from 'react-native';

export default function Settings() {
  const router = useRouter();
  const appVersion = "1.0.0";
  const [userId, setUserId] = useState(null);
;
  const {
    loading,               // boolean
    lowFuelAlerts, setLowFuelAlerts,
    vibrateAlerts, setVibrateAlerts,
    soundAlerts, setSoundAlerts,
    notificationsEnabled, setNotificationsEnabled,
    tripPref, setTripPref,
    units, setUnits,
    theme, setTheme,
    plan, setPlan, 
    currentTheme
  } = useSettings();

  // Fetch settings from Supabase
  useEffect(() => {
    const fetchSettings = async () => {
      if (typeof setLowFuelAlerts !== "function") return; // Defensive: avoid undefined
      if (typeof setLoading === "function") setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user.id);

      let { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setLowFuelAlerts(data.low_fuel_alerts);
        setVibrateAlerts(data.vibrate_alerts);
        setSoundAlerts(data.sound_alerts);
        setTripPref(data.trip_pref);
        setUnits(data.units);
        setTheme(data.theme);
        setNotificationsEnabled(data.notifications_enabled);
        setPlan(data.plan); 
      }
      if (typeof setLoading === "function") setLoading(false);
    };

    fetchSettings();
  }, []);

  // Save settings to Supabase (when anything changes)
  useEffect(() => {
    if (!userId || loading) return;
    const saveSettings = async () => {
      const updates = {
        user_id: userId,
        low_fuel_alerts: lowFuelAlerts,
        vibrate_alerts: vibrateAlerts,
        sound_alerts: soundAlerts,
        trip_pref: tripPref,
        units: units,
        theme: theme,
        notifications_enabled: notificationsEnabled,
        plan: plan,
      };
      await supabase
        .from("user_settings")
        .upsert(updates, { onConflict: "user_id" });
    };
    saveSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowFuelAlerts, vibrateAlerts, soundAlerts, tripPref, units, theme, notificationsEnabled]);

  // Change password
  const handleChangePassword = async () => {
    Alert.alert("Change Password", "Check your email for a password reset link.");
    const { error } = await supabase.auth.resetPasswordForEmail(
      (await supabase.auth.getUser()).data.user.email
    );
    if (error) Alert.alert("Error", error.message);
  };

  // Delete account
  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure? This will permanently remove your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("user_settings").delete().eq("user_id", userId);
            await supabase.auth.signOut();
            Alert.alert("Account Deleted", "Your account and settings have been deleted.");
            router.replace("/auth/login");
          },
        },
      ]
    );
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  // --- Custom handler for KM / Liters ---
  const handleSetUnits = (unit) => {
    if (unit === "km") {
      Alert.alert("Coming Soon!", "KM / Liters support is coming soon. Stay tuned!");
      return;
    }
    setUnits(unit);
  };

  if (loading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: currentTheme.bg,
        alignItems: "center",
        justifyContent: "center"
      }}>
        <ActivityIndicator color={currentTheme.primary} size="large" />
        <Text style={{ color: currentTheme.text, marginTop: 12 }}>Loading Settings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.bg }}>
      <ScrollView
        style={[styles.container, { backgroundColor: currentTheme.bg }]}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
{/* === PLAN BADGE & UPGRADE BUTTON AT TOP === */}
<View style={{ alignItems: 'center', marginBottom: 28, marginTop: 12 }}>
  <Text style={{
    backgroundColor: plan === "business" ? "#0c6" : "#ccc",
    color: "#222",
    fontWeight: "bold",
    borderRadius: 9,
    paddingHorizontal: 20,
    paddingVertical: 7,
    fontSize: 19,
    letterSpacing: 1,
    overflow: "hidden",
    marginBottom: plan === "personal" ? 12 : 0,
  }}>
    {plan === "business" ? "Business Plan" : "Personal Plan"}
  </Text>
  {plan === "personal" && (
    <TouchableOpacity
      onPress={() => router.push("/tabs/UpgradeScreen")}
      style={{
        marginTop: 2,
        backgroundColor: "#1976d2",
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 34,
        shadowColor: "#e39b0d22",
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 17 }}>
        Upgrade
      </Text>
    </TouchableOpacity>
  )}
</View>

        <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Settings</Text>

        {/* Alerts Section */}
        <View style={styles.settingGroup}>
          <Text style={[styles.sectionLabel, { color: currentTheme.text }]}>Alerts</Text>
          <View style={styles.settingRow}>
            <MaterialIcons name="local-gas-station" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Low Fuel Alerts</Text>
            <Switch
              value={lowFuelAlerts}
              onValueChange={setLowFuelAlerts}
              thumbColor={lowFuelAlerts ? currentTheme.primary : "#aaa"}
              trackColor={{ false: currentTheme.text, true: currentTheme.accent + "44" }}
            />
          </View>
          <View style={styles.settingRow}>
            <MaterialIcons name="vibration" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Vibrate Alerts</Text>
            <Switch
              value={vibrateAlerts}
              onValueChange={setVibrateAlerts}
              thumbColor={vibrateAlerts ? currentTheme.primary : "#aaa"}
              trackColor={{ false: currentTheme.text, true: currentTheme.accent + "44" }}
            />
          </View>
          <View style={styles.settingRow}>
            <MaterialIcons name="volume-up" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Sound Alerts</Text>
            <Switch
              value={soundAlerts}
              onValueChange={setSoundAlerts}
              thumbColor={soundAlerts ? currentTheme.primary : "#aaa"}
              trackColor={{ false: currentTheme.text, true: currentTheme.accent + "44" }}
            />
          </View>
          <View style={styles.settingRow}>
            <MaterialIcons name="notifications" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Enable Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              thumbColor={notificationsEnabled ? currentTheme.primary : "#aaa"}
              trackColor={{ false: currentTheme.text, true: currentTheme.accent + "44" }}
            />
          </View>
        </View>

        {/* Trip Preferences */}
        <View style={styles.settingGroup}>
          <Text style={[styles.sectionLabel, { color: currentTheme.text }]}>Trip Preferences</Text>
          <View style={styles.tripPrefRow}>
            {["personal", "business", ].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.tripPrefBtn,
                  tripPref === opt && {
                    backgroundColor: currentTheme.primary,
                    borderColor: "#fff"
                  }
                ]}
                onPress={() => setTripPref(opt)}
              >
                <Text
                  style={[
                    styles.tripPrefText,
                    tripPref === opt && { color: "#fff" },
                  ]}
                >
                  {opt === "ask"
                    ? "Ask Each Time"
                    : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Appearance/Theme */}
        <View style={styles.settingGroup}>
          <Text style={[styles.sectionLabel, { color: currentTheme.text }]}>Appearance</Text>
          <View style={styles.tripPrefRow}>
            {["light", "dark", "system"].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.tripPrefBtn,
                  theme === opt && {
                    backgroundColor: currentTheme.primary,
                    borderColor: "#fff"
                  }
                ]}
                onPress={() => setTheme(opt)}
              >
                <Text
                  style={[
                    styles.tripPrefText,
                    theme === opt && { color: "#fff" },
                  ]}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        

        {/* Feedback & FAQ */}
        <View style={styles.settingGroup}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/FeedBackScreen")}
          >
            <MaterialIcons name="feedback" size={20} color={currentTheme.accent} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Send Feedback</Text>
          </TouchableOpacity>

             {/* Contact Us */}
            <TouchableOpacity
  style={styles.settingRow}
  onPress={() => router.push("/ContactUs")}
>
  <MaterialIcons name="support-agent" size={20} color={currentTheme.primary} />
  <Text style={[styles.settingText, { color: currentTheme.text }]}>
    Contact Us
  </Text>
</TouchableOpacity>


          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/FAQScreen")}
          >
            <MaterialIcons name="help-outline" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>FAQ & How NavMiles Works</Text>
          </TouchableOpacity>
        </View>

        {/* Legal / Info */}
        <View style={styles.settingGroup}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/PrivacyScreen")}
          >
            <MaterialIcons name="policy" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/TermsOfService")}
          >
            <MaterialIcons name="gavel" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/AboutScreen")}
          >
            <MaterialIcons name="info-outline" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>About</Text>
          </TouchableOpacity>
          <View style={styles.settingRow}>
            <MaterialIcons name="verified" size={20} color={currentTheme.muted} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>App Version: {appVersion}</Text>
          </View>
        </View>

{/* Manage Subscription for Business Users */}
{plan === "business" && (
  <TouchableOpacity
    style={{
      backgroundColor: "#f8d7da",
      borderRadius: 7,
      padding: 12,
      margin: 14,
      alignItems: "center",
    }}
    onPress={() => {
      if (Platform.OS === "ios") {
        Linking.openURL('https://apps.apple.com/account/subscriptions');
      } else {
        Linking.openURL('https://play.google.com/store/account/subscriptions');
      }
    }}
  >
    <Text style={{ color: "#b33", fontWeight: "bold" }}>
      Manage Subscription
    </Text>
    <Text style={{ color: "#555", marginTop: 3, fontSize: 13 }}>
      Cancel your Business plan in the App Store or Google Play.
    </Text>
  </TouchableOpacity>
)}

        {/* Danger Zone */}
        <View style={styles.settingGroup}>
          <TouchableOpacity style={styles.settingRow} onPress={handleChangePassword}>
            <MaterialIcons name="lock-reset" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.text }]}>Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
            <MaterialIcons name="delete-forever" size={20} color={currentTheme.danger} />
            <Text style={[styles.settingText, { color: currentTheme.danger }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color={currentTheme.primary} />
            <Text style={[styles.settingText, { color: currentTheme.primary }]}>
              Logout
            </Text>
          </TouchableOpacity>

             
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? 40 : 40,
  },
  sectionTitle: {
    fontSize: 60,
    fontWeight: "bold",
    marginBottom: 22,
    alignSelf: "center",
    letterSpacing: 0.7,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 7,
    marginTop: 13,
  },
  settingGroup: {
    marginBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#1b395933",
    paddingBottom: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },
  settingText: {
    fontSize: 17,
    marginLeft: 13,
  },
  tripPrefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 3,
    gap: 8,
  },
  tripPrefBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginHorizontal: 3,
    borderWidth: 1,
    backgroundColor: "#15283e",
    borderColor: "#132337",
  },
  tripPrefBtnSelected: {
    backgroundColor: "#1976d2",
    borderColor: "#fff",
  },
settingItem: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 16,
  paddingHorizontal: 20,
  borderBottomWidth: 1,
  borderBottomColor: "#eee"
},
settingText: {
  fontSize: 17,
  color: "#003B6F",
  fontWeight: "500",
},


  tripPrefText: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#b8c9e9",
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#38000022",
    borderRadius: 7,
    marginTop: 16,
  },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 16,
    backgroundColor: "#1976d222",
    borderRadius: 7,
  },
});
