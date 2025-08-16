import React from "react";
import { SafeAreaView, View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function TOSScreen() {
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
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updateDate}>Last updated: June 2025</Text>
        
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.body}>
          By using the NavMiles app ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you may not use the Service.
        </Text>
        
        <Text style={styles.sectionTitle}>2. Account Registration & Security</Text>
        <Text style={styles.body}>
          You are responsible for maintaining the confidentiality of your account and password. You agree to notify us immediately of any unauthorized use of your account.
        </Text>
        
        <Text style={styles.sectionTitle}>3. Subscriptions, Billing, and Refund Policy</Text>
        <Text style={styles.body}>
          NavMiles may offer subscription plans with recurring billing. By subscribing, you authorize us to charge your chosen payment method on a recurring basis. 
        </Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>Refund Policy:</Text> All fees and charges are non-refundable except as required by law. If you believe you were charged in error, please contact us at <Text style={styles.link}>support@navmiles.com</Text> within 7 days of the transaction. The maximum refund available for any claim will not exceed the amount paid for your most recent subscription period.
        </Text>
        <Text style={styles.body}>
          Subscriptions can be canceled at any time. Cancellations take effect at the end of your current billing period; no pro-rated refunds will be issued.
        </Text>

        <Text style={styles.sectionTitle}>4. User Content & Conduct</Text>
        <Text style={styles.body}>
          You are responsible for all content you submit to the Service and agree not to use NavMiles for any unlawful or harmful activity.
        </Text>

        <Text style={styles.sectionTitle}>5. Limitation of Liability</Text>
        <Text style={styles.body}>
          To the fullest extent permitted by law, NavMiles, its owners, and affiliates shall not be liable for any indirect, incidental, or consequential damages, including loss of data or profits, or for any damages arising from the use of, or inability to use, the Service. Our total liability for any claims arising out of or relating to your use of the Service will not exceed the amount paid by you, if any, for accessing the Service during the twelve (12) months preceding the claim, or the cost of your most recent subscription period, whichever is less.
        </Text>
        <Text style={styles.body}>
          NavMiles is provided “as is” without warranty of any kind. We do not guarantee the accuracy of any information or navigation data.
        </Text>

        <Text style={styles.sectionTitle}>6. No Vehicle or Safety Liability</Text>
        <Text style={styles.body}>
          NavMiles is intended for informational and convenience purposes only. We are not responsible for damages to your vehicle, property, or personal injury that may arise from using the Service.
        </Text>

        <Text style={styles.sectionTitle}>7. Privacy</Text>
        <Text style={styles.body}>
          Please review our Privacy Policy to learn how we handle your data.
        </Text>

        <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
        <Text style={styles.body}>
          We reserve the right to update these Terms at any time. Your continued use of NavMiles after any changes constitutes acceptance of those changes.
        </Text>

        <Text style={styles.sectionTitle}>9. Contact Us</Text>
        <Text style={styles.body}>
          For questions, support, or to request a refund, contact us at <Text style={styles.link}>support@navmiles.com</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 60,  // match privacy screen
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
  container: {
    flex: 1,
    backgroundColor: "#011524",
    padding: 24,
    paddingTop: Platform.OS === "android" ? 44 : 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 1,
  },
  updateDate: {
    color: "#8ea2be",
    marginBottom: 20,
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#e39b0d",
    marginTop: 18,
    marginBottom: 7,
  },
  body: {
    fontSize: 16,
    color: "#cde5fa",
    marginBottom: 9,
    lineHeight: 22,
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

