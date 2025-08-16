import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<"personal" | "business" | null>(null);
  const [loading, setLoading] = useState(true);

  // Check onboarding on mount
  useEffect(() => {
    AsyncStorage.getItem("onboardingCompleted").then(val => {
      if (val === "true") {
        // Already did onboarding, go straight to login
        router.replace("/auth/login");
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleContinue = async () => {
    if (selectedPlan) {
      // Save onboarding completion flag
      await AsyncStorage.setItem("onboardingCompleted", "true");
      // Optionally, save the plan for later (optional)
      await AsyncStorage.setItem("selectedPlan", selectedPlan);
      // Go to sign up and pass the plan as param
      router.push({ pathname: "/auth/signup", params: { plan: selectedPlan } });
    }
  };

  if (loading) return null; // Or a loading spinner

  return (
    <View style={styles.container}>
      {/* ...your plan selection UI... */}
      <Text style={styles.title}>NavFuel</Text>
      {/* (rest of your UI stays the same) */}
      {/* ... */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          !selectedPlan && styles.continueDisabled,
        ]}
        onPress={handleContinue}
        disabled={!selectedPlan}
      >
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

// (styles stay the same)


const styles = StyleSheet.create({
  // ... same as you had before ...
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 26 },
  title: { fontSize: 38, fontWeight: "bold", color: "#073c72", marginBottom: 18 },
  description: { fontSize: 16, textAlign: "center", marginBottom: 30, color: "#222" },
  planOptions: { width: "100%", marginBottom: 32 },
  planButton: {
    backgroundColor: "#f6f8fa",
    padding: 18,
    marginBottom: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedPlan: {
    borderColor: "#1976d2",
    backgroundColor: "#eaf2fb",
  },
  planTitle: { fontSize: 20, fontWeight: "bold" },
  planPrice: { fontSize: 17, color: "#1976d2", marginTop: 2 },
  planDesc: { fontSize: 14, color: "#444", marginTop: 3 },
  continueButton: {
    width: "100%",
    padding: 18,
    backgroundColor: "#1976d2",
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  continueDisabled: {
    backgroundColor: "#b0b8c1",
  },
  continueText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
