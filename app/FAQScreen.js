// app/FAQScreen.js

import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function FAQScreen() {
  const router = useRouter();

  return (
    <View style={styles.outer}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <MaterialIcons name="arrow-back" size={28} color="#1976d2" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>FAQ & How NavMiles Works</Text>
        <Text style={styles.desc}>
          Welcome to NavMiles! Here are answers to some common questions and a guide on how to get the most from your app experience.
        </Text>

        {/* What is NavMiles */}
        <Text style={styles.question}>What is NavMiles?</Text>
        <Text style={styles.answer}>
          NavMiles is a smart mileage and fuel tracking app that helps you log business and personal trips, track your fuel usage, find nearby gas stations, and estimate your potential tax deduction based on IRS mileage rates—all with a simple, user-friendly experience.
        </Text>

        {/* How do I track a trip? */}
        <Text style={styles.question}>How do I track a trip?</Text>
        <Text style={styles.answer}>
          On the Map page, tap "Start Tracking" before you begin your drive. The app will use your device's GPS to record your trip distance and duration. When you arrive, tap "Stop Tracking." Your trip will be automatically saved and visible in the Trip Log tab.
        </Text>

        {/* How is my mileage deduction calculated? */}
        <Text style={styles.question}>How is my IRS mileage deduction calculated?</Text>
        <Text style={styles.answer}>
          NavMiles applies the latest IRS standard mileage rate to your logged business miles, giving you an up-to-date estimate of your possible tax deduction. You can filter trips by date, export logs, and view your year-to-date totals.
        </Text>

        {/* How does fuel tracking work? */}
        <Text style={styles.question}>How does fuel tracking work?</Text>
        <Text style={styles.answer}>
          NavMiles lets you enter your vehicle's details—including EPA-rated MPG and tank size—so you can track fuel consumption, estimate remaining miles, and receive low-fuel alerts. Over time, the app will calculate your real-world average MPG for even more accurate tracking.
        </Text>

        {/* Can I manage multiple vehicles? */}
        <Text style={styles.question}>Can I manage multiple vehicles?</Text>
        <Text style={styles.answer}>
          Yes! Depending on your plan, you can add more vehicles in your Garage. Set one vehicle as primary for quick tracking. More slots and upgrade options are coming soon.
        </Text>

{/* ...other FAQ entries... */}
<Text style={styles.tipsTitle}>Tips for Maximizing Your Mileage Deduction</Text>
<View style={styles.tipBox}>
  <Text style={styles.tip}>
    • Always use "Start Tracking" before every business drive.
  </Text>
  <Text style={styles.tip}>
    • Add notes to your trips for better tax records (coming soon).
  </Text>
  <Text style={styles.tip}>
    • Export your trip log regularly to keep a backup.
  </Text>
  <Text style={styles.tip}>
    • Check the IRS standard mileage rate each tax season.
  </Text>
</View>

        {/* Is my data private and secure? */}
        <Text style={styles.question}>Is my data private and secure?</Text>
        <Text style={styles.answer}>
          Absolutely. NavMiles never sells your information or tracks your location outside of active trips. Your data is securely stored and only accessible to you. See our Privacy Policy for details.
        </Text>

        {/* How do I export my trip logs? */}
        <Text style={styles.question}>How do I export my trip logs?</Text>
        <Text style={styles.answer}>
          Go to the Trip Log page, use the date filters as needed, then tap "Export." You can export your trips as a CSV or PDF for tax purposes or email sharing.
        </Text>

        {/* Who do I contact for support? */}
        <Text style={styles.question}>Who do I contact for help or feedback?</Text>
        <Text style={styles.answer}>
          Use the "Contact Us" button in Settings or Garage to reach support. We're here to help!
        </Text>

        {/* App version/footer */}
        <Text style={styles.footer}>NavMiles © {new Date().getFullYear()} — All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#011524" },
  container: { padding: 24, paddingTop: 32, alignItems: "flex-start" },
  backBtn: { position: "absolute", top: 75, left: 16, zIndex: 100 },
  title: {
    fontSize: 30,
    color: "#1976d2",
    fontWeight: "bold",
    marginBottom: 6,
    alignSelf: "center",
    textAlign: "center",
    width: "100%",
    letterSpacing: 0.5,
    marginTop: 60,
  },
  desc: {
    fontSize: 16,
    color: "#cde5fa",
    marginBottom: 16,
    textAlign: "center",
    alignSelf: "center",
    width: "100%",
    lineHeight: 22,
  },
  question: {
    color: "#e39b0d",
    fontWeight: "bold",
    fontSize: 17,
    marginTop: 20,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  answer: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 21,
  },

  tipsTitle: {
  color: "#1976d2",
  fontWeight: "bold",
  fontSize: 18,
  marginTop: 26,
  marginBottom: 7,
  letterSpacing: 0.2,
},
tipBox: {
  backgroundColor: "#143157",
  borderRadius: 9,
  padding: 13,
  marginBottom: 24,
  width: "100%",
},
tip: {
  color: "#e9b339",
  fontSize: 15,
  marginBottom: 5,
  lineHeight: 19,
},

  footer: {
    color: "#7fa5d6",
    fontSize: 13,
    marginTop: 32,
    alignSelf: "center",
    textAlign: "center",
    width: "100%",
    letterSpacing: 0.2,
  },
});
