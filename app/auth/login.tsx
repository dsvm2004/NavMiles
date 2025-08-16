// @ts-nocheck

// app/auth/login.tsx
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Switch,
  ScrollView,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { supabase } from "../../lib/supabaseClient";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false);

  // refs for focus chaining
  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  // Check biometric support + saved creds
  useEffect(() => {
    (async () => {
      const supported = await LocalAuthentication.hasHardwareAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const creds = await SecureStore.getItemAsync("navmiles_credentials");

      const canBiometric = supported && types.length > 0;
      setBiometricSupported(canBiometric);
      setBiometricAvailable(!!(canBiometric && creds));
    })();
  }, []);

  // Auto prompt biometric if creds exist
  useEffect(() => {
    (async () => {
      if (!biometricSupported) return;
      const creds = await SecureStore.getItemAsync("navmiles_credentials");
      if (!creds) return;

      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage: "Log in with Face ID / Touch ID / Biometrics",
        fallbackLabel: "Enter Password",
      });
      if (success) {
        try {
          const parsed = JSON.parse(creds) as { email: string; password: string };
          setEmail(parsed.email);
          setPassword(parsed.password);
          handleLogin(parsed.email, parsed.password, false, true);
        } catch {
          // ignore malformed storage
        }
      }
    })();
  }, [biometricSupported]);

  const handleRememberToggle = async (value: boolean) => {
    setRememberMe(value);
    if (!value) {
      await SecureStore.deleteItemAsync("navmiles_credentials");
    }
  };

  // Main login handler
  const handleLogin = async (
    inputEmail: string = email,
    inputPassword: string = password,
    save: boolean = rememberMe,
    silent: boolean = false
  ) => {
    if (!inputEmail || !inputPassword) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: inputEmail.trim(),
      password: inputPassword,
    });
    setLoading(false);

    if (error) {
      const msg = (error.message || "").toLowerCase();
      const notFound =
        msg.includes("invalid") ||
        msg.includes("no user") ||
        msg.includes("not found") ||
        msg.includes("email") ||
        msg.includes("password");

      if (notFound) {
        Alert.alert(
          "Account Not Found",
          "No account found with these credentials. Would you like to sign up?",
          [
            { text: "Go to Sign Up", onPress: () => router.push("/auth/signup") },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      Alert.alert("Login error", error.message || "Invalid login");
      return;
    }

    if (data?.user && !data.user.email_confirmed_at) {
      Alert.alert(
        "Email Not Verified",
        "Please check your email for a verification link before logging in."
      );
      return;
    }

    if (save) {
      await SecureStore.setItemAsync(
        "navmiles_credentials",
        JSON.stringify({ email: inputEmail.trim(), password: inputPassword })
      );
      setBiometricAvailable(biometricSupported); // enable FaceID button if supported
    }

    if (!silent) Alert.alert("Login Success", "Welcome back!");
    router.replace("/tabs/map");
  };

  const handleFaceId = async () => {
    const creds = await SecureStore.getItemAsync("navmiles_credentials");
    if (!creds) {
      Alert.alert(
        "No credentials saved",
        "Please log in with email and password first, then enable Remember Me."
      );
      return;
    }
    const { success } = await LocalAuthentication.authenticateAsync({
      promptMessage: "Log in with Face ID / Touch ID / Biometrics",
      fallbackLabel: "Enter Password",
    });
    if (success) {
      try {
        const parsed = JSON.parse(creds) as { email: string; password: string };
        setEmail(parsed.email);
        setPassword(parsed.password);
        handleLogin(parsed.email, parsed.password, true, true);
      } catch {
        Alert.alert("Oops", "Saved credentials are corrupted. Please log in again.");
      }
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
        <Text style={styles.title}>Log In</Text>

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
          placeholder="Enter your password"
          placeholderTextColor="#8ea2be"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={() => handleLogin()}
        />

        {/* Remember Me + Face ID */}
        <View style={styles.rememberRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Switch
              value={rememberMe}
              onValueChange={handleRememberToggle}
              thumbColor={rememberMe ? "#1976d2" : "#aaa"}
              trackColor={{ false: "#222", true: "#377be7" }}
            />
            <Text style={styles.rememberText}>Remember Me</Text>
          </View>

          {biometricSupported && biometricAvailable && (
            <TouchableOpacity onPress={handleFaceId}>
              <Text style={styles.faceIdText}>🔒 Face ID</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.loginButton, loading ? styles.loginButtonDisabled : null]}
          onPress={() => handleLogin()}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>{loading ? "Logging in..." : "Log In"}</Text>
        </TouchableOpacity>

        {/* Go to Sign Up */}
        <TouchableOpacity style={styles.signupLink} onPress={() => router.push("/auth/signup")}>
          <Text style={styles.signupText}>
            Don&apos;t have an account? <Text style={{ color: "#e39b0d" }}>Sign up</Text>
          </Text>
        </TouchableOpacity>

        {/* Forgot password */}
        <TouchableOpacity style={styles.forgotLink} onPress={() => router.push("/auth/forgot-password")}>
          <Text style={styles.forgotText}>Forgot your password?</Text>
        </TouchableOpacity>

        {/* Bottom spacer so last controls aren’t hidden */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#011524",
  },
  container: {
    // top-aligned so links/buttons don’t drift off-screen
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 32,
    alignItems: "center",
  },
  logo: {
    fontSize: 60,
    color: "#1976d2",
    fontWeight: "bold",
    letterSpacing: 2,
    marginTop: 32,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 18,
    textAlign: "center",
  },
  label: {
    color: "#cde5fa",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 3,
    marginTop: 13,
    letterSpacing: 0.5,
    alignSelf: "flex-start",
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
  rememberRow: {
    width: "100%",
    marginTop: 15,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rememberText: {
    color: "#cde5fa",
    fontSize: 15,
    marginLeft: 10,
  },
  faceIdText: {
    color: "#e39b0d",
    fontSize: 16,
    marginLeft: 16,
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: "#1976d2",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#e39b0d22",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    width: "100%",
  },
  loginButtonDisabled: {
    backgroundColor: "#6e91c5",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  signupLink: {
    marginTop: 14,
    alignItems: "center",
  },
  signupText: {
    color: "#cde5fa",
    fontSize: 16,
    textAlign: "center",
  },
  forgotLink: {
    marginTop: 18,
    alignItems: "center",
  },
  forgotText: {
    color: "#e39b0d",
    fontSize: 16,
    textAlign: "center",
  },
});
