import React from "react";
import { SafeAreaView, View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#011524" }}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <MaterialIcons name="arrow-back" size={28} color="#1976d2" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updateDate}>Last Updated: June 2025</Text>

        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.body}>
          NavMiles (“we,” “us,” or “our”) is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, share, and safeguard your information when you use the NavMiles mobile application (“App”).
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>A. Information You Provide:</Text>{"\n"}
          • Account Information (name, email, password, vehicle info){"\n"}
          • Payment Information (if/when you purchase subscriptions; processed securely by third-party providers){"\n"}
          • Communications (feedback, support requests)
          {"\n\n"}
          <Text style={styles.bold}>B. Information Collected Automatically:</Text>{"\n"}
          • Usage Data (app features used, session length){"\n"}
          • Device Information (type, operating system, unique identifiers){"\n"}
          • Location Data (with your explicit permission—for features such as mileage tracking and fuel finder)
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.body}>
          We use your information to:
          {"\n"}• Provide and improve the NavMiles App and its features
          {"\n"}• Process subscriptions and payments (handled by trusted payment partners)
          {"\n"}• Communicate with you (including updates, security alerts, customer support)
          {"\n"}• Customize your experience and provide relevant suggestions (e.g., fuel stations, route optimization)
          {"\n"}• Ensure security and prevent unauthorized use
          {"\n"}• Comply with applicable laws and regulations
        </Text>

        <Text style={styles.sectionTitle}>4. How We Share Your Information</Text>
        <Text style={styles.body}>
          We do not sell your personal information. We may share your information:
          {"\n"}• With trusted service providers who help us operate the app (e.g., analytics, payment processors, cloud hosting)
          {"\n"}• If required by law, court order, or government request
          {"\n"}• To protect our rights, users, property, or safety
          {"\n"}• With your consent or at your direction
        </Text>

        <Text style={styles.sectionTitle}>5. Data Security</Text>
        <Text style={styles.body}>
          We take reasonable administrative, technical, and physical safeguards to protect your data. However, no system can be 100% secure; please keep your password confidential and contact us immediately if you suspect unauthorized use.
        </Text>

        <Text style={styles.sectionTitle}>6. Your Rights and Choices</Text>
        <Text style={styles.body}>
          Depending on your location, you may have rights under data protection laws, including:
          {"\n"}• The right to access, correct, or delete your information
          {"\n"}• The right to restrict or object to certain data processing
          {"\n"}• The right to withdraw consent at any time
          {"\n"}To exercise your rights, email us at <Text style={styles.link}>support@navmiles.com</Text>.
        </Text>

        <Text style={styles.sectionTitle}>7. Children’s Privacy</Text>
        <Text style={styles.body}>
          NavMiles is not intended for children under 16. We do not knowingly collect data from children under 16.
        </Text>

        <Text style={styles.sectionTitle}>8. Third-Party Services</Text>
        <Text style={styles.body}>
          Our App may contain links or integrations with third-party services (such as payment processors, map providers, analytics). These services are governed by their own privacy policies.
        </Text>

        <Text style={styles.sectionTitle}>9. International Data Transfers</Text>
        <Text style={styles.body}>
          If you use NavMiles outside the United States, your information may be transferred and processed in the United States or other countries with different data protection laws.
        </Text>

        <Text style={styles.sectionTitle}>10. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this Privacy Policy from time to time. The updated version will be posted in the App with a new “Last Updated” date.
        </Text>

        <Text style={styles.sectionTitle}>11. Contact Us</Text>
        <Text style={styles.body}>
          If you have any questions, concerns, or requests about this Privacy Policy or your information, please contact us at:{"\n"}
          <Text style={styles.link}>support@navmiles.com</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ...styles as before

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#011524",
    padding: 24,
    paddingTop: Platform.OS === "android" ? 44 : 60,
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 25 : 60,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 100,
    backgroundColor: "transparent",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backText: {
    color: "#1976d2",
    fontSize: 18,
    marginLeft: 4,
    fontWeight: "bold",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 12,
    letterSpacing: 1,
  },
  updateDate: {
    color: "#8ea2be",
    marginBottom: 20,
    fontSize: 15,
    fontStyle: "italic",
  },
  sectionTitle: {
    color: "#e39b0d",
    fontWeight: "bold",
    fontSize: 19,
    marginTop: 18,
    marginBottom: 6,
  },
  body: {
    color: "#cde5fa",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 2,
  },
  bold: {
    fontWeight: "bold",
    color: "#b6d8fd",
  },
  link: {
    color: "#46cfff",
    textDecorationLine: "underline",
  },
});
