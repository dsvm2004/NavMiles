// app/(screens)/home.js

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import gauge from "../assets/images/navmiles_logo.png";
import needle from "../assets/images/needle.png";

export const options = { headerShown: false };

const GAUGE_SIZE = 250;
const NEEDLE_WIDTH = 400;
const NEEDLE_HEIGHT = 275;
const NEEDLE_Y_OFFSET = 30;

export default function Home() {
  const router = useRouter();
  return (
    <ScrollView style={{ backgroundColor: "#011524", flex: 1 }}>
      <View style={styles.container}>
        {/* Logo cluster */}
        <View style={styles.gaugeCluster}>
          <Image source={gauge} style={styles.gaugeImage} resizeMode="contain" />
          {/* NEEDLE */}
          <Image
            source={needle}
            style={[
              styles.needleImage,
              {
                width: NEEDLE_WIDTH,
                height: NEEDLE_HEIGHT,
                left: GAUGE_SIZE / 2 - NEEDLE_WIDTH / 2,
                top: GAUGE_SIZE / 2 - NEEDLE_HEIGHT / 2 + NEEDLE_Y_OFFSET,
              },
            ]}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Welcome to NavMiles</Text>
        <Text style={styles.tagline}>Smart Fuel & Mileage Tracker</Text>
        <View style={styles.featuresBox}>
          <Text style={styles.feature}>⛽ Proactive fuel alerts & nearest gas stations</Text>
          <Text style={styles.feature}>🛣️ Track trips and mileage for business/taxes</Text>
          <Text style={styles.feature}>💸 Effortless fuel cost tracking</Text>
        </View>
        <Text style={styles.choose}>Choose Your Plan:</Text>

        {/* PERSONAL PLAN */}
        <View style={styles.planCard}>
          <Text style={styles.planName}>Personal Plan</Text>
          <Text style={styles.planDesc}>
            For individual drivers:
            {"\n"}• Track fuel-ups & MPG
            {"\n"}• Find nearby stations
            {"\n"}• Trip log & export (CSV/PDF)
            {"\n"}• 1 vehicle slot
            {"\n"}• Standard support
          </Text>
          <View style={styles.priceRow}>
            <TouchableOpacity
              style={styles.priceOptionBtn}
              onPress={() => router.replace("/auth/signup?plan=personal&period=monthly")}
            >
              <Text style={styles.priceLabel}>Monthly</Text>
              <Text style={styles.planPrice}>$5.99/mo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priceOptionBtn, { backgroundColor: "#e39b0d" }]}
              onPress={() => router.replace("/auth/signup?plan=personal&period=annual")}
            >
              <Text style={[styles.priceLabel, { color: "#fff7e0" }]}>Annual</Text>
              <Text style={[styles.planPrice, { color: "#fff7e0" }]}>$59.99/yr</Text>
              <Text style={styles.annualNote}>2 months free!</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BUSINESS PLAN */}
        <View style={styles.planCard}>
          <Text style={styles.planName}>Business Plan</Text>
          <Text style={styles.planDesc}>
            For fleets & power users:
            {"\n"}• Everything in Personal, plus:
            {"\n"}• 3 vehicle slots
            {"\n"}• Advanced trip & fuel reporting
            {"\n"}• Priority support
            {"\n"}• Early access to new features
            {"\n"}• (Multi-driver support coming soon!)
          </Text>
          <View style={styles.priceRow}>
            <TouchableOpacity
              style={styles.priceOptionBtn}
              onPress={() => router.replace("/auth/signup?plan=business&period=monthly")}
            >
              <Text style={styles.priceLabel}>Monthly</Text>
              <Text style={styles.planPrice}>$9.99/mo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priceOptionBtn, { backgroundColor: "#e39b0d" }]}
              onPress={() => router.replace("/auth/signup?plan=business&period=annual")}
            >
              <Text style={[styles.priceLabel, { color: "#fff7e0" }]}>Annual</Text>
              <Text style={[styles.planPrice, { color: "#fff7e0" }]}>$99.99/yr</Text>
              <Text style={styles.annualNote}>2 months free!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", backgroundColor: "#011524",
    paddingHorizontal: 14, paddingTop: Platform.OS === "android" ? 18 : 38, paddingBottom: 22,
  },
  gaugeCluster: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 2,
    marginTop: -10,
    alignSelf: "center",
  },
  gaugeImage: {
    width: "100%",
    height: "100%",
  },
  needleImage: {
    position: "absolute",
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 2,
    color: "#fff",
    marginTop: 3,
  },
  tagline: {
    fontSize: 19,
    color: "#e39b0d",
    fontWeight: "600",
    marginBottom: 18,
    textAlign: "center",
  },
  featuresBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 30,
    width: "100%",
    alignItems: "flex-start",
  },
  feature: {
    color: "#cde5fa",
    fontSize: 16,
    marginBottom: 8,
  },
  choose: {
    fontSize: 20,
    marginBottom: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  // --- New plan cards and pricing styles ---
  planCard: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 2 },
  },
  planName: { fontSize: 19, color: "#fff", fontWeight: "bold", marginBottom: 7 },
  planDesc: { color: "#cde5fa", fontSize: 15, marginBottom: 8, textAlign: "left", width: "100%" },
  priceRow: { flexDirection: "row", justifyContent: "center", width: "100%", gap: 8, marginTop: 2 },
  priceOptionBtn: {
    flex: 1,
    backgroundColor: "#1976d2",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginHorizontal: 2,
    minWidth: 105,
  },
  priceLabel: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 3 },
  planPrice: { fontSize: 17, fontWeight: "bold", color: "#cde5fa" },
  annualNote: { fontSize: 12, color: "#f4d49e", marginTop: 1, fontWeight: "bold" },
});

