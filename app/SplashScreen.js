// app/(screens)/SplashScreen.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  Text,
  Alert,
} from "react-native";
import LottieView from "lottie-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { supabase } from "../lib/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

// IMAGES/ASSETS
import bg from "../assets/images/app_gradient_bg.png";
import gauge from "../assets/images/navmiles_logo.png";
import needle from "../assets/images/needle.png";
import navmilesText from "../assets/images/navmiles_text.png";
import tagline from "../assets/images/smart_fuel_tagline.png";
import fireworks from "../assets/images/fireworks.json";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const router = useRouter();
  const needleAnim = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const [showFireworks, setShowFireworks] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const needleRotate = needleAnim.interpolate({
    inputRange: [0, 25],
    outputRange: ["-150deg", "-15deg"],
  });

  // Show fireworks and text animation, then show consent if needed
  useEffect(() => {
    needleAnim.setValue(0);
    Animated.timing(needleAnim, {
      toValue: 37,
      duration: 2000,
      useNativeDriver: true,
    }).start();

    const fireworksTimeout = setTimeout(() => {
      setShowFireworks(true);
      Animated.timing(textFade, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();

      setTimeout(async () => {
        setShowFireworks(false);
        checkConsent();
      }, 1800);
    }, 1200);

    return () => clearTimeout(fireworksTimeout);
    // eslint-disable-next-line
  }, []);

  // Ensure consent modal appears again if user navigates back to splash
  useFocusEffect(
    React.useCallback(() => {
      checkConsent();
    }, [])
  );

  // Check consent from AsyncStorage
  const checkConsent = async () => {
    const agreed = await AsyncStorage.getItem("agreedToTerms");
    if (agreed === "yes") {
      setShowConsent(false);
      setSessionChecked(true);
    } else {
      setShowConsent(true);
    }
  };

  // After consent, check login and route accordingly
  useEffect(() => {
    if (!sessionChecked) return;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // Biometric logic for signed-in users
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Authenticate to unlock NavMiles",
          });
          if (result.success) {
            router.replace("/tabs/map");
          } else {
            router.replace("/auth/login");
          }
        } else {
          router.replace("/tabs/map");
        }
      } else {
        // Go to plan selection instead of login
        router.replace("/home");
      }
    })();
    // eslint-disable-next-line
  }, [sessionChecked]);

  // When user agrees, save consent and trigger session check
  const handleAgree = async () => {
    await AsyncStorage.setItem("agreedToTerms", "yes");
    setShowConsent(false);
    setSessionChecked(true);
  };

  const handleDecline = () => {
    Alert.alert(
      "Consent Required",
      "You must agree to continue using NavMiles.",
      [{ text: "OK", style: "cancel" }]
    );
  };

  // Handle privacy/TOS taps: close modal, open screen, modal returns on focus
  const handleOpenPolicy = (route) => {
    setShowConsent(false);
    setTimeout(() => {
      router.push(route);
    }, 200);
  };

  return (
    <View style={styles.container}>
      <Image source={bg} style={styles.bg} resizeMode="cover" />
      <Image source={gauge} style={styles.gauge} resizeMode="contain" />
      <Animated.Image
        source={needle}
        style={[styles.needle, { transform: [{ rotate: needleRotate }] }]}
        resizeMode="contain"
      />
      <Animated.Image
        source={navmilesText}
        style={[styles.navmilesText, { opacity: textFade }]}
        resizeMode="contain"
      />
      <Animated.Image
        source={tagline}
        style={[styles.tagline, { opacity: textFade }]}
        resizeMode="contain"
      />
      {showFireworks && (
        <LottieView
          source={fireworks}
          autoPlay
          loop={false}
          style={styles.fireworks}
        />
      )}

      {/* Consent Modal */}
      <Modal visible={showConsent} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Terms & Privacy Agreement</Text>
            <Text style={styles.modalText}>
              Before using NavMiles, you must agree to our Terms of Service and
              Privacy Policy.
            </Text>
            <View style={styles.modalLinks}>
              <TouchableOpacity onPress={() => handleOpenPolicy("/PrivacyScreen")}>
                <Text style={styles.link}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOpenPolicy("/TermsOfService")}>
                <Text style={styles.link}>Terms of Service</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.agreeBtn} onPress={handleAgree}>
              <Text style={styles.agreeBtnText}>I Agree</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Footer */}
      <Text style={styles.footer}>powered by Mcuztoms LLC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#011524",
    alignItems: "center",
    justifyContent: "center",
  },
  bg: {
    position: "absolute",
    width: width,
    height: height,
  },
  gauge: {
    width: width * 0.9,
    height: width * 0.9,
    marginTop: height * 0.15,
    alignSelf: "center",
    zIndex: 3,
  },
  needle: {
    position: "absolute",
    width: width * 0.9,
    height: width * 1.0,
    left: width * 0.05,
    top: height * 0.35,
    zIndex: 4,
  },
  navmilesText: {
    position: "absolute",
    width: width * 0.9,
    height: 400,
    top: height * 0.02,
    alignSelf: "center",
    zIndex: 10,
  },
  tagline: {
    position: "absolute",
    width: width * 0.7,
    height: 300,
    bottom: height * 0.03,
    alignSelf: "center",
    zIndex: 10,
  },
  fireworks: {
    position: "absolute",
    width: width * 1.7,
    height: height * 1.7,
    top: -height * 0.4,
    left: -width * 0.35,
    zIndex: 100,
    pointerEvents: "none",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: 320,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    color: "#222",
    textAlign: "center",
    marginBottom: 18,
  },
  modalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
    gap: 18,
  },
  link: {
    color: "#1976d2",
    fontWeight: "bold",
    fontSize: 15,
    textDecorationLine: "underline",
  },
  agreeBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 45,
    marginTop: 16,
    marginBottom: 8,
  },
  agreeBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  declineBtn: {
    marginTop: 3,
    padding: 10,
  },
  declineBtnText: {
    color: "#888",
    fontSize: 16,
  },
  footer: {
    position: "absolute",
    bottom: 12,
    fontSize: 12,
    color: "#cde5fa",
  },
});
