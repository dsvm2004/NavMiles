import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabaseClient";
import * as Linking from "expo-linking";
import { useUserVehicle } from "./providers/UserVehicleContext";
import Ionicons from "react-native-vector-icons/Ionicons";

// --- Suggestion List UI Helper ---
function SuggestionList({ data, onSelect, visible }) {
  if (!visible || !data.length) return null;
  return (
    <View style={styles.suggestionBox}>
      {data.map((item) => (
        <TouchableOpacity
          key={item}
          style={styles.suggestionItem}
          onPress={() => onSelect(item)}
        >
          <Text style={styles.suggestionText}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

<TouchableOpacity
  onPress={() => router.back()}
  style={{
    position: "absolute",
    top: Platform.OS === "ios" ? 20 : 10,
    left: 10,
    zIndex: 10,
    padding: 8,
  }}
>
  <Ionicons name="arrow-back" size={28} color="#fff" />
</TouchableOpacity>


const displayValue = (dropdown, manual) =>
  dropdown && dropdown !== "N/A (enter manually)" ? dropdown
  : (manual && manual.trim() ? manual : "N/A");

// Confirm Modal (unchanged)
function ConfirmModal({ visible, values, onConfirm, onCancel, missingFields }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBg}>
        <View style={styles.confirmBox}>
          <ScrollView
            contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
            style={{ maxHeight: 420, width: '100%' }}
            bounces={true}
          >
            <Text style={styles.confirmTitle}>Confirm Vehicle Selection</Text>
            <Text style={styles.confirmDesc}>
              Please review your vehicle details below. Once confirmed, these will be locked to your account for security.
            </Text>
            <View style={{ marginVertical: 10 }}>
              {Object.entries(values).map(([key, value]) => (
                <Text key={key} style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace("_", " ")}:{" "}
                  </Text>
                  <Text style={styles.confirmValue}>
                    {value && typeof value === "object"
                      ? displayValue(value.dropdown, value.manual)
                      : value || "N/A"}
                  </Text>
                </Text>
              ))}
            </View>
            {missingFields.length > 0 && (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  <Text style={{ fontWeight: "bold" }}>Notice:</Text> Features like "Miles left in tank" will be disabled until you provide your vehicle's MPG and tank size.
                </Text>
              </View>
            )}
            <Text style={{ color: "#e39b0d", textAlign: "center", marginVertical: 6, fontWeight: "bold" }}>
              Once you continue, your vehicle will be locked and cannot be changed unless you purchase an additional slot or contact support.
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 18, width: "100%" }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#1976d2" }]}
                onPress={onConfirm}
              >
                <Text style={styles.modalBtnText}>Confirm & Lock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#bbb" }]}
                onPress={onCancel}
              >
                <Text style={[styles.modalBtnText, { color: "#333" }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


export default function VehicleSelectScreen() {
  const router = useRouter();
  const { refreshVehicle } = useUserVehicle();

  // ---- States for each field ----
  const [year, setYear] = useState("");
  const [yearExists, setYearExists] = useState(false);

  // --- Make/Model/Trim Autocomplete State ---
  const [make, setMake] = useState("");
  const [makeSuggestions, setMakeSuggestions] = useState([]);
  const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);

  const [model, setModel] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);

  const [trim, setTrim] = useState("");
  const [trimSuggestions, setTrimSuggestions] = useState([]);
  const [showTrimSuggestions, setShowTrimSuggestions] = useState(false);

  // --- Fuel type, mpg, tank size ---
  const [fuelType, setFuelType] = useState("");
  const [manualFuelType, setManualFuelType] = useState("");
  const [mpg, setMpg] = useState("");
  const [manualMpg, setManualMpg] = useState("");
  const [tankSize, setTankSize] = useState("");
  const [manualTankSize, setManualTankSize] = useState("");

  // Other state
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMissingMpg, setShowMissingMpg] = useState(false);
  const [modalField, setModalField] = useState(""); // Only used for Fuel Type

  // --- Effects: Check if year exists ---
  useEffect(() => {
    if (!year || year.length !== 4) {
      setYearExists(false);
      setMake(""); setModel(""); setTrim("");
      setMpg(""); setTankSize(""); setFuelType(""); setManualFuelType("");
      return;
    }
    (async () => {
      setLoading(true);
      const { data: yearData } = await supabase
        .from("vehicles")
        .select("year")
        .eq("year", Number(year))
        .limit(1);
      setYearExists(Array.isArray(yearData) && yearData.length > 0);
      setLoading(false);
    })();
  }, [year]);

  // --- Make Suggestions ---
  useEffect(() => {
    if (!yearExists || !year || make.length < 2) {
      setMakeSuggestions([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("make")
        .eq("year", Number(year))
        .ilike("make", `%${make}%`);
      const makes = Array.from(new Set((data || []).map(r => r.make))).filter(Boolean);
      setMakeSuggestions(makes);
    })();
  }, [make, year, yearExists]);

  // --- Model Suggestions ---
  useEffect(() => {
    if (!yearExists || !year || !make || model.length < 2) {
      setModelSuggestions([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("model")
        .eq("year", Number(year))
        .ilike("make", `%${make}%`)
        .ilike("model", `%${model}%`);
      const models = Array.from(new Set((data || []).map(r => r.model))).filter(Boolean);
      setModelSuggestions(models);
    })();
  }, [model, make, year, yearExists]);

  // --- Trim Suggestions ---
  useEffect(() => {
    if (!yearExists || !year || !make || !model || trim.length < 1) {
      setTrimSuggestions([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("trim")
        .eq("year", Number(year))
        .ilike("make", `%${make}%`)
        .ilike("model", `%${model}%`)
        .ilike("trim", `%${trim}%`);
      const trims = Array.from(new Set((data || []).map(r => r.trim))).filter(Boolean);
      setTrimSuggestions(trims);
    })();
  }, [trim, model, make, year, yearExists]);

  // --- Fetch MPG/Tank Size if available ---
  useEffect(() => {
    if (!yearExists || !year || !make || !model || !trim || !fuelType) {
      setMpg(""); setTankSize(""); return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vehicles")
        .select("mpg, tankSize")
        .eq("year", Number(year))
        .eq("make", make)
        .eq("model", model)
        .eq("trim", trim)
        .eq("fuelType", fuelType)
        .limit(1);
      if (data && data[0]) {
        setMpg(data[0].mpg ? String(data[0].mpg) : "");
        setTankSize(data[0].tankSize ? String(data[0].tankSize) : "");
      } else {
        setMpg(""); setTankSize("");
      }
      setLoading(false);
    })();
  }, [year, make, model, trim, fuelType, yearExists]);

  // --- Modal Logic for Fuel Type (unchanged) ---
  const showModal = (field) => !loading && setModalField(field);
  const closeModal = () => setModalField("");
  const getOptions = (field) => {
    switch (field) {
      case "fuelType":
        return ["Gasoline", "Diesel", "Hybrid", "Electric"];
      default:
        return [];
    }
  };

  // --- MPG/Tank Size Auto-Find Buttons (Google search) ---
  const handleAutoFindMpg = () => {
    const parts = [year, make, model, trim].filter(Boolean);
    parts.push("combined mpg");
    const query = parts.join(" ");
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  };
  const handleAutoFindTankSize = () => {
    const parts = [year, make, model, trim].filter(Boolean);
    parts.push("fuel tank size");
    const query = parts.join(" ");
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  };

  // --- Save/Confirm flow ---
  const canContinue =
    year &&
    make &&
    model &&
    trim &&
    (fuelType || manualFuelType) &&
    ((mpg || manualMpg) && (tankSize || manualTankSize));
  const missingFields = [];
  if (!(mpg || manualMpg)) missingFields.push("mpg");
  if (!(tankSize || manualTankSize)) missingFields.push("tank_size");

  const handleContinue = () => {
    if (!(mpg || manualMpg) || !(tankSize || manualTankSize)) {
      setShowMissingMpg(true);
    } else {
      setShowConfirm(true);
    }
  };
  console.log()
const handleSetPrimary = async () => {
  setSaving(true);

  // 1) Make sure we still have a logged-in user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    setSaving(false);
    Alert.alert("Error", "You must be logged in to save your vehicle. Please log in again.");
    return;
  }
  const uid = userData.user.id;

  // 2) Insert the new vehicle record
  const newVehicle = {
    user_id:    uid,
    year:       Number(year),
    make,
    model,
    trim,
    fuel_type:  fuelType || manualFuelType,
    mpg:        Number(mpg || manualMpg),
    tank_size:  Number(tankSize || manualTankSize),
    // do NOT set is_primary here
    // Supabase will default it to false
  };

  const { data: inserted, error: insertError } = await supabase
    .from("UserVehicles")
    .insert([newVehicle])
    .select("id");        // get back the new row’s id

  if (insertError || !inserted?.length) {
    setSaving(false);
    Alert.alert("Error", insertError?.message || "Could not save vehicle");
    return;
  }

  const newId = inserted[0].id;

  // 3) Now call your RPC to flip the flags in one go
  const { error: rpcError } = await supabase.rpc("set_primary_user_vehicle", {
    p_user_id:    uid,
    p_vehicle_id: newId,
  });

  setSaving(false);

  if (rpcError) {
    Alert.alert("Error", rpcError.message || "Could not set primary vehicle");
    return;
  }

  // 4) Refresh context and navigate on success
  await refreshVehicle();
  setShowConfirm(false);
  router.replace("/tabs/garage");
};


console.log()

  // --- UI ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#011524" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <ScrollView
  style={{ flex: 1 }}
  contentContainerStyle={styles.scrollContainer}
  keyboardShouldPersistTaps="handled"
>
  {/* Back Button */}
  <TouchableOpacity
    onPress={() => router.back()}
    style={{
      position: "absolute",
      top: Platform.OS === "ios" ? 20 : 10,
      left: 10,
      zIndex: 10,
      padding: 8,
    }}
  >
    <Ionicons name="arrow-back" size={28} color="#fff" />
  </TouchableOpacity>
  
  <Text style={[styles.title, { marginTop: 28 }]}>Select Your Vehicle</Text>

          {/* YEAR */}
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.manualInput}
            placeholder="Enter Year (e.g. 2016)"
            placeholderTextColor="#93a5ba"
            keyboardType="numeric"
            value={year}
            onChangeText={(text) => {
              setYear(text.replace(/[^0-9]/g, '').slice(0, 4));
              setMake(""); setModel(""); setTrim(""); setMpg(""); setTankSize(""); setFuelType(""); setManualFuelType("");
            }}
            maxLength={4}
            onBlur={() => Keyboard.dismiss()}
          />
          {year.length === 4 && !loading && (
            <Text style={{
              color: yearExists ? "#38e085" : "#e39b0d",
              marginBottom: 6,
              fontWeight: "bold"
            }}>
              {yearExists
                ? "Year found in database. Start typing to search."
                : "Year not found—please enter all info manually."}
            </Text>
          )}

          {/* --- MAKE: Typeahead --- */}
          <Text style={styles.label}>Make</Text>
          <View style={{ width: "100%", position: "relative" }}>
            <TextInput
              style={styles.manualInput}
              placeholder="Type Make"
              placeholderTextColor="#93a5ba"
              value={make}
              onChangeText={(text) => {
                setMake(text);
                setShowMakeSuggestions(true);
                setModel(""); setTrim(""); setMpg(""); setTankSize("");
              }}
              autoCapitalize="words"
              onFocus={() => setShowMakeSuggestions(true)}
              onBlur={() => setTimeout(() => setShowMakeSuggestions(false), 150)}
            />
            <SuggestionList
              data={makeSuggestions}
              onSelect={item => {
                setMake(item);
                setShowMakeSuggestions(false);
                setModel(""); setTrim(""); setMpg(""); setTankSize("");
              }}
              visible={showMakeSuggestions && make.length > 1}
            />
          </View>

          {/* --- MODEL: Typeahead --- */}
          <Text style={styles.label}>Model</Text>
          <View style={{ width: "100%", position: "relative" }}>
            <TextInput
              style={styles.manualInput}
              placeholder="Type Model"
              placeholderTextColor="#93a5ba"
              value={model}
              onChangeText={(text) => {
                setModel(text);
                setShowModelSuggestions(true);
                setTrim(""); setMpg(""); setTankSize("");
              }}
              autoCapitalize="words"
              onFocus={() => setShowModelSuggestions(true)}
              onBlur={() => setTimeout(() => setShowModelSuggestions(false), 150)}
              editable={!!make}
            />
            <SuggestionList
              data={modelSuggestions}
              onSelect={item => {
                setModel(item);
                setShowModelSuggestions(false);
                setTrim(""); setMpg(""); setTankSize("");
              }}
              visible={showModelSuggestions && model.length > 1}
            />
          </View>

          {/* --- TRIM: Typeahead --- */}
          <Text style={styles.label}>Trim</Text>
          <View style={{ width: "100%", position: "relative" }}>
            <TextInput
              style={styles.manualInput}
              placeholder="Type Trim"
              placeholderTextColor="#93a5ba"
              value={trim}
              onChangeText={(text) => {
                setTrim(text);
                setShowTrimSuggestions(true);
                setMpg(""); setTankSize("");
              }}
              autoCapitalize="words"
              onFocus={() => setShowTrimSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTrimSuggestions(false), 150)}
              editable={!!model}
            />
            <SuggestionList
              data={trimSuggestions}
              onSelect={item => {
                setTrim(item);
                setShowTrimSuggestions(false);
                setMpg(""); setTankSize("");
              }}
              visible={showTrimSuggestions && trim.length > 0}
            />
          </View>

          {/* FUEL TYPE (unchanged, still modal) */}
          <Text style={styles.label}>Fuel Type</Text>
          <TouchableOpacity
            style={styles.inputBox}
            onPress={() => showModal("fuelType")}
          >
            <Text style={fuelType ? styles.inputText : styles.inputPlaceholder}>
              {fuelType || "Choose Fuel Type"}
            </Text>
          </TouchableOpacity>

          {/* MPG (manual input + Auto-Find) */}
          <Text style={styles.label}>MPG (Combined)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
            <TextInput
              style={[styles.manualInput, { flex: 1 }]}
              placeholder="Enter MPG"
              placeholderTextColor="#93a5ba"
              keyboardType="numeric"
              value={manualMpg}
              onChangeText={setManualMpg}
            />
            <TouchableOpacity
              style={styles.autoFindBtn}
              onPress={handleAutoFindMpg}
            >
              <Text style={{ color: "#1976d2", fontWeight: "bold", marginLeft: 8 }}>Auto-Find</Text>
            </TouchableOpacity>
          </View>

          {/* Tank Size (manual input + Auto-Find) */}
          <Text style={styles.label}>Tank Size (gallons)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
            <TextInput
              style={[styles.manualInput, { flex: 1 }]}
              placeholder="Enter Tank Size"
              placeholderTextColor="#93a5ba"
              keyboardType="numeric"
              value={manualTankSize}
              onChangeText={setManualTankSize}
            />
            <TouchableOpacity
              style={styles.autoFindBtn}
              onPress={handleAutoFindTankSize}
            >
              <Text style={{ color: "#1976d2", fontWeight: "bold", marginLeft: 8 }}>Auto-Find</Text>
            </TouchableOpacity>
          </View>

          {/* TIP if manually entering info */}
          {(manualMpg || manualTankSize) && (
            <Text style={{ color: "#e39b0d", marginTop: 6, marginBottom: 14, textAlign: "center", fontSize: 15 }}>
              Thanks for helping improve our vehicle database! We’ll use these entries to help others.
            </Text>
          )}

          {/* Continue */}
          <TouchableOpacity
            style={[
              styles.continueBtn,
              { opacity: canContinue && !saving ? 1 : 0.5 },
            ]}
            disabled={!canContinue || saving}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>
              {saving ? "Saving..." : "Continue"}
            </Text>
          </TouchableOpacity>

          {loading && (
            <ActivityIndicator
              style={{ marginTop: 28 }}
              size="large"
              color="#1976d2"
            />
          )}

          {/* Fuel Type Modal */}
          <Modal
            visible={!!modalField}
            transparent
            animationType="fade"
            onRequestClose={closeModal}
          >
            <View style={styles.modalBg}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Select Fuel Type</Text>
                {getOptions("fuelType").map((ft) => (
                  <TouchableOpacity
                    key={ft}
                    style={styles.modalItem}
                    onPress={() => {
                      setFuelType(ft);
                      closeModal();
                    }}
                  >
                    <Text style={styles.modalItemText}>{ft}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={closeModal}>
                  <Text style={[styles.modalItemText, { color: "#1976d2", marginTop: 16 }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Confirm Modal */}
          <ConfirmModal
            visible={showConfirm}
            values={{
              year,
              make,
              model,
              trim,
              fuelType,
              mpg: { dropdown: mpg, manual: manualMpg },
              tank_size: { dropdown: tankSize, manual: manualTankSize },
            }}
            missingFields={missingFields}
            onConfirm={handleSetPrimary}
            onCancel={() => setShowConfirm(false)}
          />

          {/* Missing MPG/Size Modal */}
          <Modal
            visible={showMissingMpg}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMissingMpg(false)}
          >
            <View style={styles.modalBg}>
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>Missing MPG or Tank Size</Text>
                <Text style={styles.warnText}>
                  MPG and Tank Size are required for "Miles left in tank." You can enter these now or skip and enable this feature later in your Garage settings.
                </Text>
                <View style={{ flexDirection: "row", marginTop: 18 }}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: "#1976d2", marginRight: 6 }]}
                    onPress={() => { setShowMissingMpg(false); setShowConfirm(true); }}
                  >
                    <Text style={styles.modalBtnText}>Continue Anyway</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: "#bbb" }]}
                    onPress={() => setShowMissingMpg(false)}
                  >
                    <Text style={[styles.modalBtnText, { color: "#333" }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  scrollContainer: {
    padding: 22,
    alignItems: "center",
    backgroundColor: "#011524",
    minHeight: "100%",
    paddingBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 24,
    marginTop: 20,
    alignSelf: "center",
    letterSpacing: 0.5,
  },
  label: {
    color: "#cde5fa",
    fontSize: 16,
    alignSelf: "flex-start",
    marginTop: 10,
    marginBottom: 2,
    fontWeight: "600",
  },
  manualInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#1976d2",
    borderRadius: 10,
    backgroundColor: "#02203a",
    marginBottom: 12,
    padding: 14,
    color: "#fff",
    fontSize: 18,
  },
  inputBox: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#1976d2",
    borderRadius: 10,
    backgroundColor: "#072545",
    marginBottom: 10,
    padding: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  inputText: {
    color: "#fff",
    fontSize: 18,
  },
  inputPlaceholder: {
    color: "#93a5ba",
    fontSize: 18,
  },
  continueBtn: {
    backgroundColor: "#1976d2",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    width: "100%",
    marginTop: 18,
    marginBottom: 30,
  },
  autoFindBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 6,
    backgroundColor: "#e8f0fe",
    borderRadius: 7,
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  suggestionBox: {
    position: "absolute",
    zIndex: 10,
    width: "100%",
    backgroundColor: "#fff",
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#1976d2",
    borderRadius: 8,
    top: 58,
    left: 0,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  suggestionText: {
    color: "#021422",
    fontSize: 17,
  },
  // Modal styling
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
    minWidth: 270,
    maxWidth: 330,
    alignItems: "center",
    maxHeight: 300,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    width: "100%",
    alignItems: "center",
  },
  modalItemText: {
    fontSize: 17,
    color: "#021422",
  },
  // Confirm Modal
  confirmBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 26,
    width: 330,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    alignItems: "center",
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmDesc: {
    fontSize: 16,
    color: "#333",
    marginBottom: 6,
    textAlign: "center",
  },
  confirmRow: {
    fontSize: 16,
    color: "#333",
    marginTop: 2,
    marginBottom: 2,
  },
  confirmLabel: {
    fontWeight: "600",
    color: "#155494",
  },
  confirmValue: {
    color: "#021422",
    fontWeight: "bold",
  },
  warnBox: {
    backgroundColor: "#ffe7b8",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  warnText: {
    color: "#aa7a1c",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "600",
  },
  modalBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 5,
    minWidth: 115,
  },
  modalBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

