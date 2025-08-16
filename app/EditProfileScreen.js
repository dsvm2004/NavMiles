// app/EditProfileScreen.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function EditProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Edit Profile is not available in this version.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#011524", justifyContent: "center", alignItems: "center" },
  text: { color: "#fff", fontSize: 20 }
});
