// app/screens/CalibrationInfoScreen.js
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function CalibrationInfoScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* ── Header ───────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#003B6F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Understanding MPG Calibration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── How it works ─────────────────────────────── */}
        <Text style={styles.sectionTitle}>How it Works</Text>
        <Text style={styles.paragraph}>
          NavMiles learns your <Text style={{ fontWeight: "600" }}>real-world MPG</Text> by comparing two numbers:
        </Text>
        <Text style={styles.bullet}>• Miles you drove (from the odometer & trip logs)</Text>
        <Text style={styles.bullet}>• Gallons you burned (taken from your next <Text style={{ fontWeight: "600" }}>full-tank</Text> fill-up)</Text>
        <Text style={styles.paragraph}>
          The ratio of those two numbers is your true fuel efficiency.  Each new calibration makes fuel-range
          estimates and low-fuel alerts more accurate.
        </Text>

        {/* ── Why a FULL tank is required ───────────────── */}
        <Text style={styles.sectionTitle}>Why does it have to be a full fill-up?</Text>
        <Text style={styles.paragraph}>
          Gauges can hide more than a gallon of fuel, especially near “E”.  If we only log a partial top-off,
          we can’t tell how many gallons were actually consumed since the last reading.
        </Text>
        <Text style={styles.paragraph}>
          Filling to the click of the pump gives us an exact, pump-measured gallon figure – no guessing, no
          gauge error.  That’s the secret to an accurate MPG calculation.
        </Text>

        {/* ── Quick reference steps ─────────────────────── */}
        <Text style={styles.sectionTitle}>Calibration in Four Quick Steps</Text>
        <Text style={styles.bullet}>1. Start calibration when your tank is low.</Text>
        <Text style={styles.bullet}>2. Drive normally until your next fuel stop.</Text>
        <Text style={styles.bullet}>3. Fill the tank completely.</Text>
        <Text style={styles.bullet}>4. In NavMiles tap <Text style={{ fontWeight: "600" }}>Add&nbsp;Fuel</Text>, enter gallons and odometer.</Text>
        <Text style={styles.paragraph}>
          Done!  NavMiles updates your MPG instantly and uses it for future “Miles in Tank” and low-fuel alerts.
        </Text>

        {/* ── Best practices ────────────────────────────── */}
        <Text style={styles.sectionTitle}>Tips for Ongoing Accuracy</Text>
        <Text style={styles.bullet}>• Always enter <Text style={{ fontWeight: "600" }}>gallons</Text> – not dollars.</Text>
        <Text style={styles.bullet}>• Log the fill-up right at the pump.</Text>
        <Text style={styles.bullet}>• Avoid multiple tiny top-offs between full tanks.</Text>
        <Text style={styles.bullet}>• Use trip tracking whenever you drive.</Text>

        {/* ── Disclaimer ───────────────────────────────── */}
        <Text style={styles.sectionTitle}>A Quick Reality Check</Text>
        <Text style={styles.paragraph}>
          Even with perfect data, MPG can drift with speed, terrain, payload, tire pressure, temperature, and
          driving style.  NavMiles gives you a solid estimate that improves over time as you log more miles and
          fills – but it won’t always match the dash readout bolt-for-bolt.
        </Text>

        {/* ── Got it button ────────────────────────────── */}
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Got it!</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── styles (unchanged) ───────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  backBtn: { paddingRight: 6, paddingVertical: 4 },
  headerTitle: { fontSize: 23, fontWeight: "bold", marginLeft: 12, color: "#003B6F" },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "600", marginTop: 20, color: "#003B6F" },
  paragraph: { fontSize: 15, color: "#333", marginTop: 8, lineHeight: 22 },
  bullet: { fontSize: 15, color: "#333", marginTop: 6, marginLeft: 10 },
  button: {
    marginTop: 30, marginBottom: 40, backgroundColor: "#003B6F",
    paddingVertical: 14, borderRadius: 10, alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
});
