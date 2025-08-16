// @ts-nocheck

// app/auth/forgot-password.js
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from "expo-router";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (!email) {
      Alert.alert("Missing Email", "Please enter your email address.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert("Reset Error", error.message || "Could not send reset email.");
      return;
    }
    Alert.alert("Check your email", "A password reset link has been sent.");
    router.replace("/auth/login");
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.logo}>NavMiles</Text>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.desc}>Enter your email and we’ll send you a password reset link.</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8ea2be"
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <TouchableOpacity
          style={[
            styles.button,
            (!email || loading) && styles.buttonDisabled
          ]}
          onPress={handleReset}
          disabled={loading || !email}
        >
          <Text style={styles.buttonText}>{loading ? "Sending..." : "Send Reset Email"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ marginTop: 18 }}
          onPress={() => router.replace("/auth/login")}
        >
          <Text style={styles.loginText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#011524",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  logo: {
    fontSize: 52,
    color: "#1976d2",
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 14,
    textAlign: "center",
  },
  title: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  desc: {
    fontSize: 16,
    color: "#cde5fa",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#223046",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#1b3959",
    color: "#fff",
    fontSize: 17,
    padding: 13,
    marginBottom: 2,
    marginTop: 1,
    width: "100%",
  },
  button: {
    width: "100%",
    backgroundColor: "#1976d2",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 18,
  },
  buttonDisabled: {
    backgroundColor: "#6e91c5",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  loginText: {
    color: "#e39b0d",
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
});
