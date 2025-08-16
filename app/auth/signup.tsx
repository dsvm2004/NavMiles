// @ts-nocheck

// app/auth/signup.js
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { supabase } from "../../lib/supabaseClient";

export default function SignupScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  // FORM STATES
  const [plan, setPlan] = useState(params.plan || "personal");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Verification flow
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  // focus management
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  // Update plan if changed in params
  useEffect(() => {
    if (params.plan) setPlan(params.plan);
  }, [params.plan]);

  // VALIDATION
  const isFormValid = name && email && password && confirm && password === confirm;

  const handleSignup = async () => {
    if (!isFormValid) {
      Alert.alert("Error", "Please fill all fields and make sure passwords match.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, plan } },
    });
    setLoading(false);

    const existsText =
      error?.message?.toLowerCase().includes("already registered") ||
      error?.message?.toLowerCase().includes("user already") ||
      error?.message?.toLowerCase().includes("duplicate") ||
      (error?.message?.toLowerCase().includes("email") && error?.message?.toLowerCase().includes("exists"));

    if (error) {
      if (existsText) {
        Alert.alert(
          "Account Exists",
          "An account with this email already exists. Please log in instead.",
          [
            { text: "Go to Login", onPress: () => router.push("/auth/login") },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }
      Alert.alert("Sign up error", error.message || "Could not create account");
      return;
    }

    // Success! Show verification prompt and save credentials for later login
    setPendingEmail(email);
    setPendingPassword(password);
    setAwaitingVerification(true);
  };

  const handleContinueAfterVerification = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: pendingEmail,
      password: pendingPassword,
    });
    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message || "Please try again.");
      return;
    }

    if (data?.user && data.user.email_confirmed_at) {
      router.replace("/VehicleSelectScreen"); // or your main screen
    } else {
      Alert.alert(
        "Not Verified Yet",
        "Your email is not verified yet. Please check your inbox and confirm, then tap Continue."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>NavMiles</Text>
        <Text style={styles.planBadge}>{plan === "business" ? "Business Plan" : "Personal Plan"}</Text>
        <Text style={styles.title}>Create your account</Text>

        {/* Always-visible login link at top */}
        <TouchableOpacity style={styles.topLoginLink} onPress={() => router.push("/auth/login")}>
          <Text style={styles.topLoginText}>
            Already have an account? <Text style={{ color: "#e39b0d", fontWeight: "700" }}>Log in</Text>
          </Text>
        </TouchableOpacity>

        {awaitingVerification ? (
          <>
            <Text style={{ color: "#fff", fontSize: 18, marginBottom: 18, marginTop: 10, textAlign: "center" }}>
              A verification email has been sent to {pendingEmail}.
              {"\n"}Please verify your email, then tap below to continue.
            </Text>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleContinueAfterVerification}
              disabled={loading}
            >
              <Text style={styles.signupButtonText}>
                {loading ? "Checking..." : "I've Verified My Email – Continue"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginLink} onPress={() => router.push("/auth/login")}>
              <Text style={styles.loginText}>
                Already verified? <Text style={{ color: "#e39b0d" }}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.card}>
            {/* Name */}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              ref={nameRef}
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#8ea2be"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#8ea2be"
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#8ea2be"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              ref={confirmRef}
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor="#8ea2be"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signupButton, !isFormValid || loading ? styles.signupButtonDisabled : null]}
              onPress={handleSignup}
              disabled={!isFormValid || loading}
            >
              <Text style={styles.signupButtonText}>{loading ? "Signing up..." : "Sign Up"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom login link (still shown when not awaiting verification) */}
        {!awaitingVerification && (
          <TouchableOpacity style={styles.loginLink} onPress={() => router.push("/auth/login")}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={{ color: "#e39b0d" }}>Log in</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* Extra bottom padding so last field/button isn't hidden by keyboard */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// == THEME STYLES (kept intact; only minimal layout additions) ==
const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#011524",
  },
  container: {
    // changed from centered to top-aligned to avoid off-screen buttons/links
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 32,
    alignItems: "center",
  },
  logo: {
    fontSize: 75,
    color: "#1976d2",
    fontWeight: "bold",
    letterSpacing: 2,
    marginTop: 32,
    marginBottom: 10,
  },
  planBadge: {
    fontSize: 16,
    color: "#e39b0d",
    backgroundColor: "#ffeeba11",
    fontWeight: "bold",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 4,
    marginBottom: 6,
    alignSelf: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8, // slightly tighter to bring content up
    textAlign: "center",
  },
  // new: top login prompt that’s always visible
  topLoginLink: {
    marginTop: 6,
    marginBottom: 12,
    alignItems: "center",
  },
  topLoginText: {
    color: "#cde5fa",
    fontSize: 15,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#132337",
    borderRadius: 22,
    padding: 22,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 14,
  },
  label: {
    color: "#cde5fa",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 3,
    marginTop: 13,
    letterSpacing: 0.5,
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
  },
  signupButton: {
    marginTop: 20,
    backgroundColor: "#1976d2",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#e39b0d22",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  signupButtonDisabled: {
    backgroundColor: "#6e91c5",
  },
  signupButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  loginLink: {
    marginTop: 10,
    alignItems: "center",
  },
  loginText: {
    color: "#cde5fa",
    fontSize: 16,
    marginTop: 6,
    textAlign: "center",
  },
});
