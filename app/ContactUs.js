// app/screens/ContactUsScreen.js

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSettings } from "./providers/SettingsContext";
import { supabase } from "../lib/supabaseClient"; // Adjust if needed

const CATEGORIES = [
  { label: "General", value: "General", emoji: "📝" },
  { label: "Account", value: "Account", emoji: "👤" },
  { label: "Feature", value: "Feature", emoji: "💡" },
  { label: "Other", value: "Other", emoji: "❓" },
];

export default function ContactUsScreen() {
  const navigation = useNavigation();
  const { currentTheme } = useSettings();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("General");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Submit to Supabase ---
  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert("Please enter your message.");
      return;
    }
    setLoading(true);

    const { error } = await supabase
      .from("contact_requests")
      .insert([
        {
          name,
          email,
          category,
          message,
        },
      ]);
    setLoading(false);

    if (error) {
      Alert.alert("Error", "Could not send message. Please try again later.");
      return;
    }
    Alert.alert("Message Sent!", "Thanks for contacting us. We’ll get back to you soon!");
    setName("");
    setEmail("");
    setCategory("General");
    setMessage("");
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: currentTheme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={28} color={currentTheme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.primary }]}>Contact Us</Text>
        </View>

        {/* Contact Form */}
        <Text style={[styles.label, { color: currentTheme.text }]}>Name</Text>
        <TextInput
          style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.muted }]}
          placeholder="Your name"
          placeholderTextColor={currentTheme.muted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: currentTheme.text }]}>Email</Text>
        <TextInput
          style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.muted }]}
          placeholder="your@email.com"
          placeholderTextColor={currentTheme.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: currentTheme.text }]}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.categoryBtn,
                {
                  borderColor: currentTheme.primary,
                  backgroundColor: category === cat.value ? currentTheme.primary : "#fff",
                },
                category === cat.value && { elevation: 2 },
              ]}
              onPress={() => setCategory(cat.value)}
              activeOpacity={0.87}
            >
              <Text
                style={[
                  styles.categoryBtnText,
                  { color: category === cat.value ? "#fff" : currentTheme.primary },
                ]}
              >
                {cat.emoji} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: currentTheme.text }]}>Message</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            { color: currentTheme.text, borderColor: currentTheme.muted },
          ]}
          placeholder="Type your message here..."
          placeholderTextColor={currentTheme.muted}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
        />

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: loading ? currentTheme.muted : currentTheme.primary },
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Send</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const numColumns = 2; // 2 per row (change to 4 if you want a single row on big screens)
const gridSpacing = 10;
const categoryBtnWidth =
  (Dimensions.get("window").width - 48 - gridSpacing * (numColumns - 1)) / numColumns;

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 38,
    backgroundColor: "transparent",
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingTop: 36,
    paddingBottom: 14,
    marginBottom: 10,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 14,
  },
  label: {
    marginTop: 14,
    fontWeight: "600",
    fontSize: 15,
    marginBottom: 3,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#FFF",
    marginBottom: 7,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 13,
    marginTop: 8,
  },
  categoryBtn: {
    width: categoryBtnWidth,
    paddingVertical: 16,
    borderRadius: 999,
    borderWidth: 1.8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: gridSpacing,
  },
  categoryBtnText: {
    fontWeight: "bold",
    fontSize: 17,
    letterSpacing: 0.2,
  },
  textArea: {
    height: 97,
    textAlignVertical: "top",
  },
  button: {
    marginTop: 24,
    borderRadius: 9,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
  },
});
