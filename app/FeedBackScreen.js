// app/tabs/FeedbackScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function FeedbackScreen() {
  const [feedback, setFeedback] = useState("");
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const handleGoBack = () => router.back();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const removeImage = () => setImage(null);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      Alert.alert("Missing Feedback", "Please enter your feedback.");
      return;
    }

    setSubmitting(true);
    let imageUrl = null;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      Alert.alert("Not logged in", "Please sign in to send feedback.");
      setSubmitting(false);
      return;
    }

    if (image) {
  setUploading(true);
  try {
    const ext      = image.split(".").pop();
    const fileName = `feedback/${user.id}-${Date.now()}.${ext}`;

    // ← replace all your FileSystem + atob + Uint8Array + new Blob code with this:
    const response = await fetch(image);
    const blob     = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from("feedback-images")
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert:      true,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("feedback-images")
      .getPublicUrl(fileName);
    imageUrl = urlData?.publicUrl;
  } catch (err) {
    Alert.alert("Image Upload Error", err.message);
    setUploading(false);
    setSubmitting(false);
    return;
  }
  setUploading(false);
}


    const { error } = await supabase.from("feedback").insert([
      {
        user_id: user?.id,
        email: user?.email,
        feedback,
        image_url: imageUrl,
        created_at: new Date().toISOString(),
      },
    ]);

    setSubmitting(false);

    if (error) {
      Alert.alert("Error", error.message || "Failed to send feedback.");
      return;
    }

    setFeedback("");
    setImage(null);
    Keyboard.dismiss();
    setShowModal(true);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={27} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>Send Feedback</Text>
        <Text style={styles.subtitle}>
          Found a bug or have a suggestion? Tell us below. (Screenshots welcome!)
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Type your feedback here..."
          placeholderTextColor="#7ea1ca"
          multiline
          value={feedback}
          onChangeText={setFeedback}
          editable={!submitting && !uploading}
        />

        {image && (
          <View>
            <Image source={{ uri: image }} style={styles.image} />
            <TouchableOpacity style={styles.removeImgBtn} onPress={removeImage}>
              <Text style={styles.removeImgBtnText}>Remove Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.imageBtn}
          onPress={pickImage}
          disabled={uploading || submitting}
        >
          <Text style={styles.imageBtnText}>
            {image ? "Change Photo" : "Upload Screenshot (Optional)"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || uploading) && { backgroundColor: "#7ea1ca" }]}
          onPress={handleSubmit}
          disabled={submitting || uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {submitting ? "Sending..." : "Submit Feedback"}
            </Text>
          )}
        </TouchableOpacity>

        {/* ✅ Success Modal */}
        <Modal visible={showModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>✅ Feedback Sent</Text>
              <Text style={styles.modalText}>Thanks for helping us improve NavMiles!</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowModal(false);
                  router.back();
                }}
              >
                <Text style={styles.modalCloseBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#011524", padding: 28, paddingTop: Platform.OS === "android" ? 56 : 76 },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 32 : 75,
    left: 12,
    zIndex: 100,
    backgroundColor: "#1976d2",
    borderRadius: 20,
    padding: 7,
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#1976d2", marginBottom: 7, textAlign: "center", marginTop: 8 },
  subtitle: { color: "#b2cff2", marginBottom: 14, fontSize: 16, textAlign: "center" },
  input: {
    backgroundColor: "#132337",
    color: "#fff",
    borderRadius: 12,
    padding: 15,
    minHeight: 110,
    textAlignVertical: "top",
    fontSize: 16,
    marginBottom: 10,
  },
  imageBtn: {
    backgroundColor: "#e39b0d",
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    marginBottom: 15,
  },
  imageBtnText: { color: "#011524", fontWeight: "bold", fontSize: 16 },
  submitBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  submitBtnText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
  image: {
    width: "100%",
    height: 170,
    borderRadius: 9,
    marginVertical: 10,
    resizeMode: "contain",
  },
  removeImgBtn: {
    alignSelf: "flex-end",
    marginBottom: 8,
    backgroundColor: "#7ea1ca",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  removeImgBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
    width: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  modalText: { fontSize: 16, marginBottom: 20, textAlign: "center" },
  modalCloseBtn: {
    backgroundColor: "#1976d2",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  modalCloseBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
