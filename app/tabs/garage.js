// app/tabs/Garage.js
import { useUserVehicle } from "../providers/UserVehicleContext";
import { useSettings } from "../providers/SettingsContext";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  SafeAreaView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabaseClient";
import { MaterialIcons } from "@expo/vector-icons";
import { useTripLog } from "../providers/TripLogProvider";
import { differenceInDays } from "date-fns";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

export default function Garage() {
  const { refreshVehicle } = useUserVehicle();
  const { currentTheme } = useSettings();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [user, setUser] = useState(null);
  
  const [primaryVehicleId, setPrimaryVehicleId] = useState(null);
  const [planSlots, setPlanSlots] = useState(1);
   const {
   userMPG,
   recalibrationHistory,
   lastOdometer,
   isCalibrating,
   startCalibration
  } = useTripLog();
  // Prepare sparkline data from MPG history
const mpgHistoryData = recalibrationHistory.map(entry => Number(entry.calculatedMPG.toFixed(1)));
// Show (Estimated) if there is no calibration history or not enough trips to trust the value
const isMPGEstimated = recalibrationHistory.length < 2;



  let efficiencyNote = "";
let mpgDiff = null;
let showRecalibrate = false;
let recalibratedDaysAgo = null;
let recalibratedTripsUsed = null;

if (recalibrationHistory.length > 0) {
  const latest = recalibrationHistory[0]; // most recent is first
  const daysAgo = differenceInDays(new Date(), new Date(latest.date));
  recalibratedDaysAgo = daysAgo;
  recalibratedTripsUsed = latest.tripsUsed;
}


if (vehicles.length > 0 && userMPG && vehicles[0].mpg) {
  const epa = Number(vehicles[0].mpg);
  mpgDiff = (((userMPG - epa) / epa) * 100).toFixed(1);
  const diffAbs = Math.abs(mpgDiff);

  if (diffAbs >= 15) {
    showRecalibrate = true;
  }

  if (mpgDiff > 15) efficiencyNote = "🚀 Excellent Efficiency!";
  else if (mpgDiff > 5) efficiencyNote = "✅ Above Average";
  else if (mpgDiff > -5) efficiencyNote = "🟡 Normal Range";
  else if (mpgDiff > -15) efficiencyNote = "🔻 Below Average";
  else efficiencyNote = "⚠️ Poor Efficiency";
}


  // Fetch user/vehicles on mount or after updates
  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // Get slots for this user
    const { data: userRows } = await supabase
      .from("users")
      .select("max_vehicle_slots")
      .eq("id", user.id)
      .single();
    const slots = userRows?.max_vehicle_slots || 1;
    setPlanSlots(slots);

    // Get active vehicles only
    const { data: vData } = await supabase
      .from("UserVehicles")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at");

    // Place primary vehicle at the top
    let sorted = vData ? [...vData] : [];
    const primary = sorted.find(v => v.is_primary);
    if (primary) {
      sorted = [primary, ...sorted.filter(v => v.id !== primary.id)];
      setPrimaryVehicleId(primary.id);
    } else if (sorted.length > 0) {
      setPrimaryVehicleId(sorted[0].id);
    }
    setVehicles(sorted);
    setLoading(false);
  };

  useEffect(() => {fetchData();}, []);

  // Handler: Set Primary Vehicle
  const handleSetPrimary = async (vehicleId) => {
    setLoading(true);
    try {
      // Set all user's vehicles is_primary=false
      const { error: clearError } = await supabase
        .from("UserVehicles")
        .update({ is_primary: false })
        .eq("user_id", user.id);
      if (clearError) throw clearError;
      // Set the new primary
      const { error: setError } = await supabase
        .from("UserVehicles")
        .update({ is_primary: true })
        .eq("id", vehicleId);
      if (setError) throw setError;
      setPrimaryVehicleId(vehicleId);
      await refreshVehicle();
    } catch (e) {
      Alert.alert("Error", e.message || "Could not set as primary.");
      setLoading(false);
    }
  };

  // --- Add/Upgrade/Remove stubs ---
  const showComingSoon = () =>
    Alert.alert("Coming Soon", "This feature will be available in a future update.");

  const handlePurchaseSlot = showComingSoon;
  const handleDowngrade = showComingSoon;
  const handleDeleteVehicle = async (vehicleId) => {
  Alert.alert(
    "Delete Vehicle",
    "Are you sure you want to delete this vehicle? This action cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          await supabase
            .from("UserVehicles")
            .delete()
            .eq("id", vehicleId);
          await fetchData();
          setLoading(false);
        },
      },
    ]
  );
};


  // Handler: Add vehicle (enforce slot limit)
 // const handleAddVehicle = () => {
  //  if (vehicles.length >= planSlots) {
    //  Alert.alert(
      //  "Upgrade Required",
      //  `You can only add up to ${planSlots} vehicles with your current plan. Upgrade to add more slots.`,
      //  [{ text: "OK" }]
     // );
   //   return;
  //  }
  //  router.push("/VehicleSelectScreen");
  //};

const handleAddVehicle = () => {
  router.push("/VehicleSelectScreen");
};


  // Handler: Switch vehicle (for single slot, goes to add; for multi-slot, pick another as primary)
  const handleSwitchVehicle = () => {
    if (planSlots === 1) handleAddVehicle();
    else showComingSoon();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    );
  }

  // --- UI ---
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.bg }]}>
      <ScrollView style={{ flex: 1, backgroundColor: currentTheme.bg }}>
        <View style={[styles.container, { backgroundColor: currentTheme.bg }]}>
          {/* Greeting */}
          <Text style={[styles.hello, { color: currentTheme.text }]}>
            Hello,{" "}
            <Text style={[styles.userName, { color: currentTheme.accent }]}>
              {user?.user_metadata?.name || "Driver"}
            </Text>
          </Text>
          <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>
            Garage
          </Text>

          {/* Vehicles */}
          {vehicles.length === 0 && (
            <View style={[styles.noVehicles, { backgroundColor: currentTheme.card }]}>
              <Text style={[styles.noVehiclesText, { color: currentTheme.text }]}>
                No vehicles added yet. Add your primary vehicle to begin.
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: currentTheme.primary }]}
                onPress={handleAddVehicle}
              >
                <MaterialIcons name="add" size={22} color="#fff" />
                <Text style={[styles.addBtnText, { color: "#fff" }]}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          )}

 {vehicles.map(vehicle => (
  <View
    key={vehicle.id}
    style={[
      styles.vehicleCard,
      { backgroundColor: currentTheme.card },
      vehicle.id === primaryVehicleId && { borderColor: currentTheme.primary, borderWidth: 2 }
    ]}
  >
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <MaterialIcons
        name="directions-car"
        size={32}
        color={vehicle.id === primaryVehicleId ? currentTheme.primary : currentTheme.muted}
        style={{ marginRight: 10 }}
      />
      <View>
        <Text style={[styles.vehicleMain, { color: currentTheme.text }]}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        <Text style={[styles.vehicleSub, { color: currentTheme.muted }]}>
          {vehicle.trim ? `${vehicle.trim}, ` : ""}
          {vehicle.fuel_type}
        </Text>
        {vehicle.id === primaryVehicleId && (
          <Text style={[styles.primaryText, { color: currentTheme.primary }]}>PRIMARY</Text>
        )}
      </View>
    </View>

    {/* Always show EPA MPG for all vehicles */}
    <View style={styles.mpgRow}>
      <Text style={[styles.mpgLabel, { color: currentTheme.muted }]}>EPA MPG: </Text>
      <Text style={[styles.mpgValue, { color: currentTheme.text }]}>
        {vehicle.mpg ? `${vehicle.mpg}` : "--"}
      </Text>
    </View>

    {/* Only show the rest for the PRIMARY vehicle */}
    {vehicle.id === primaryVehicleId && (
      <View style={styles.mpgContainer}>
        {mpgHistoryData.length > 1 && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 6 }}>
              MPG History
            </Text>
            <LineChart
              data={{
                labels: mpgHistoryData.map((_, i) => `${mpgHistoryData.length - i}`),
                datasets: [{ data: mpgHistoryData }],
              }}
              width={Dimensions.get("window").width - 60}
              height={160}
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              withShadow={false}
              chartConfig={{
                backgroundGradientFrom: "#fff",
                backgroundGradientTo: "#fff",
                color: () => "#2E8B57",
                strokeWidth: 2,
              }}
              bezier
              style={{
                borderRadius: 10,
                marginVertical: 6,
              }}
            />
          </View>
        )}

        <Text style={styles.mpgTitle}>Your Estimated MPG:</Text>
        <Text style={[styles.mpgValue, { color: currentTheme.accent, fontWeight: "bold" }]}>
  {Number.isFinite(userMPG) ? userMPG.toFixed(1) : "--"} MPG
  {isMPGEstimated && <Text style={{color:'#FFA726', fontSize:12}}> (Estimated)</Text>}
</Text>

        {mpgDiff && (
          <Text style={styles.mpgNote}>
            {mpgDiff > 0 ? "+" : ""}
            {mpgDiff}% vs EPA estimate
          </Text>
        )}
        <Text style={styles.mpgNote}>(based on recent trips)</Text>
        {efficiencyNote !== "" && (
          <Text style={styles.mpgNote}>{efficiencyNote}</Text>
        )}
        <View style={styles.recalibRow}>
          <TouchableOpacity
            style={[
              styles.recalibrateBtn,
              { backgroundColor: currentTheme.warning || "#FFA726" }
            ]}
          onPress={() => {
  if (isCalibrating) {
    // Already running → just remind the driver what’s next
    Alert.alert(
      "Calibration in progress",
      "Your next full fill-up will complete the calibration."
    );
    return;
  }

  // Confirm they really are about to refuel
  Alert.alert(
    "Start MPG calibration?",
    "Calibration needs a FULL tank at your very next fuel stop so we can measure gallons burned accurately.\n\nWill you be filling up soon?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, start",
        style: "default",
        onPress: () => {
          startCalibration(lastOdometer);      // ← same call as before
          Alert.alert(
            "Calibration started",
            "Great! Drive until you refuel, then log the gallons from the pump. " +
            "We’ll calculate your real-world MPG automatically."
          );
        }
      }
    ]
  );
}}

          >
            <Text style={styles.recalibText}>
              {isCalibrating ? "Finish Calibration" : "Recalibrate MPG"}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.learnMoreBtn, { backgroundColor: currentTheme.card, marginTop: 1 }]}
          onPress={() => router.push("/calibrationinfo")}
        >
          <Text style={[styles.learnMoreText, { color: currentTheme.primary }]}>
            Learn More
          </Text>
        </TouchableOpacity>
        {recalibratedDaysAgo !== null && recalibratedTripsUsed !== null && (
          <Text style={[styles.mpgNote, { fontStyle: "italic" }]}>
            Recalibrated {recalibratedDaysAgo} day{recalibratedDaysAgo !== 1 ? "s" : ""} ago from {recalibratedTripsUsed} trip{recalibratedTripsUsed !== 1 ? "s" : ""}
          </Text>
        )}
      </View>
    )}

    {/* Set Primary & Remove Vehicle buttons (leave unchanged) */}
    {vehicle.id !== primaryVehicleId && planSlots > 1 && (
      <TouchableOpacity
        style={[styles.setPrimaryBtn, { backgroundColor: currentTheme.primary }]}
        onPress={() => handleSetPrimary(vehicle.id)}
      >
        <Text style={[styles.setPrimaryBtnText, { color: "#fff" }]}>Set as Primary</Text>
      </TouchableOpacity>
    )}
    {vehicle.id !== primaryVehicleId && (
      <TouchableOpacity
        style={[styles.removeBtn, { backgroundColor: currentTheme.danger }]}
        onPress={() => handleDeleteVehicle(vehicle.id)}
      >
        <MaterialIcons name="delete" size={20} color="#fff" />
        <Text style={[styles.removeBtnText, { color: "#fff" }]}>
          Delete Vehicle
        </Text>
      </TouchableOpacity>
    )}
  </View>
))}


        

          {/* Switch/Add Vehicle */}
        <View style={styles.vehicleActions}>
  <TouchableOpacity
    style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
    onPress={handleAddVehicle}
  >
    <MaterialIcons name="add-circle-outline" size={22} color="#fff" />
    <Text style={[styles.actionBtnText, { color: "#fff" }]}>Add Vehicle</Text>
  </TouchableOpacity>
</View>


      
        </View>



      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // backgroundColor: "#011524", // <- No dynamic values here!
    paddingTop: Platform.OS === "android" ? 44 : 60,
  },
  container: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    // backgroundColor: "#011524", // use inline override instead!
    minHeight: "100%",
  },
  hello: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 7,
    marginTop: 10,
    textAlign: "center",
    alignSelf: "center",
  },
  userName: {
    fontWeight: "bold",
    fontSize: 25,
  },
  sectionTitle: {
    fontSize: 29,
    fontWeight: "bold",
    marginBottom: 18,
    marginTop: 6,
    textAlign: "center",
    alignSelf: "center",
  },
mpgContainer: {
  marginTop: 12,
  backgroundColor: "#f0f0f0",
  padding: 12,
  borderRadius: 12,
  alignItems: "center"
},
mpgTitle: {
  fontSize: 16,
  fontWeight: "600",
  color: "#333"
},
mpgValue: {
  fontSize: 24,
  fontWeight: "bold",
  color: "#2E8B57",
  marginTop: 4
},
mpgNote: {
  fontSize: 12,
  color: "#666",
  marginTop: 2
},


  vehicleCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 16,
    width: "100%",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  vehicleMain: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  vehicleSub: {
    fontSize: 16,
    fontWeight: "500",
  },
  primaryText: {
    marginTop: 2,
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 2,
  },
  mpgRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 2,
  },
  mpgLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginRight: 4,
    marginLeft: 10,
  },
 
  setPrimaryBtn: {
    borderRadius: 10,
    marginTop: 13,
    paddingVertical: 10,
    alignItems: "center",
    width: 150,
    alignSelf: "flex-end",
  },

  recalibrateBtn: {
  marginTop: 8,
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 10,
  alignItems: "center",
  alignSelf: "center",
},

  setPrimaryBtnText: {
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  removeBtn: {
    marginTop: 8,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 13,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
  },
  removeBtnText: {
    fontWeight: "bold",
    fontSize: 15,
    marginLeft: 6,
  },
  slotInfo: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 13,
    marginBottom: 8,
    alignSelf: "center",
    textAlign: "center",
  },
   recalibRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
 
  recalibText: {
    color: '#fff', fontWeight: 'bold'
  },
  learnMoreBtn: {
    padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 14,
  },
  learnMoreText: {
    fontWeight: '600'
  },
  purchaseBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 18,
    alignItems: "center",
    width: "100%",
  },
  purchaseBtnText: {
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  downgradeBtn: {
    borderRadius: 10,
    marginTop: 13,
    paddingVertical: 10,
    alignItems: "center",
    width: "100%",
  },
  downgradeBtnText: {
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  vehicleActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 15,
    width: "100%",
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 4,
    width: 145,
    justifyContent: "center",
  },
  actionBtnText: {
    fontWeight: "bold",
    marginLeft: 7,
    fontSize: 16,
  },
  noVehicles: {
    borderRadius: 15,
    padding: 26,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
  },
  noVehiclesText: {
    fontSize: 17,
    marginBottom: 14,
    textAlign: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  addBtnText: {
    fontWeight: "bold",
    marginLeft: 9,
    fontSize: 17,
  },
  contactBtn: {
    marginTop: 24,
    alignItems: "center",
    flexDirection: "row",
    alignSelf: "center",
  },
  contactBtnText: {
    fontWeight: "bold",
    fontSize: 17,
    marginLeft: 8,
    letterSpacing: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
