import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function AboutScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.replace("/tabs/settings")}
        activeOpacity={0.8}
      >
        <MaterialIcons name="arrow-back" size={28} color="#1976d2" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>About NavMiles</Text>
        <Text style={styles.body}>
          NavMiles helps you track business/personal miles, find gas, and maximize deductions.{"\n\n"}
          For questions/support: support@navmiles.com
        </Text>
        <Text style={styles.version}>App Version: 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#011524",
    padding: 0,
    paddingTop: Platform.OS === "android" ? 48 : 60, // Leave space for back btn
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 42 : 68,
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
  content: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 36, // Extra space for back btn
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 18,
    marginTop: 10,
    alignSelf: "center",
  },
  body: { color: "#cde5fa", fontSize: 17, marginBottom: 28, textAlign: "center" },
  version: { color: "#e39b0d", fontSize: 16, fontWeight: "bold", textAlign: "center" }
});
