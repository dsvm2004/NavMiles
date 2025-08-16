import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabaseClient";
import { MaterialIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { useSettings } from "../providers/SettingsContext";
 import {
   KeyboardAvoidingView,
   TouchableWithoutFeedback,
   Keyboard,
   ScrollView,
   
 } from "react-native";
import { Picker } from '@react-native-picker/picker';


const IRS_MILE_RATE = 0.67;

// Helper: Always parse as UTC
function toISOZ(dt) {
  if (!dt) return null;
  if (dt instanceof Date) return dt.toISOString();
  if (typeof dt === "string") {
    // Already has Z
    if (dt.endsWith("Z")) return dt;
    // Already in ISO format (2025-07-02T01:56:47.814)
    if (dt.length === 23 && dt[10] === "T") return dt + "Z";
    // If it's a date-only string (2025-07-02)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) return dt + "T00:00:00Z";
    // Else try to parse
    return new Date(dt).toISOString();
  }
  return null;
}

function formatDate(dt) {
  if (!dt) return "--";
  return new Date(toISOZ(dt)).toLocaleDateString();
}
function formatTime(dt) {
  if (!dt) return "--";
  return new Date(toISOZ(dt)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(dt) {
  if (!dt) return "--";
  return new Date(toISOZ(dt)).toLocaleString();
}
function formatDuration(start, end) {
  if (!start || !end) return "--";
  const seconds = Math.max(0, (new Date(toISOZ(end)) - new Date(toISOZ(start))) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h > 0 ? h + "h " : ""}${m}m ${s}s`;
}


export default function TripLogScreen() {
  const router = useRouter();
  const { currentTheme, units, tripPref, plan } = useSettings();
  
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [user, setUser] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const [editingTrip, setEditingTrip] = useState(null);
const [editNotes, setEditNotes] = useState("");
const [editTag, setEditTag] = useState("Personal");

const [editTripType, setEditTripType] = useState("personal");

const openEditModal = (trip) => {
  setEditingTrip(trip);
  setEditNotes(trip.notes || "");
  setEditTag(trip.tag || "Personal");
  
  setEditTripType(trip.trip_type || "personal"); // NEW
};

const handleSaveEdit = async () => {
  const { error } = await supabase
    .from("triplogs")
    .update({
      notes: editNotes,
      
     
      trip_type: editTripType
    })
    .eq("id", editingTrip.id);

  if (error) {
    alert("Error saving trip edits: " + error.message);
  } else {
    await fetchTrips(); // Re-fetch list
    setEditingTrip(null); // Close modal
  }
};

const [searchQuery, setSearchQuery] = useState("");

const filteredLogs = trips.filter((log) => {
  const query = searchQuery.toLowerCase().trim();
  if (!query) return true;

  const dateMatch = new Date(log.start).toLocaleDateString().toLowerCase().includes(query);
  const noteMatch = (log.notes || "").toLowerCase().includes(query);
  
  const typeMatch = (log.trip_type || "").toLowerCase().includes(query);


  return dateMatch || noteMatch  || typeMatch;
});



  // Date filters
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  // Modal/datepicker state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Summary
  const [filteredMiles, setFilteredMiles] = useState(0);

  // Fetch trips from Supabase
  async function fetchTrips() {
    setLoading(true);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert("Auth error", userError?.message || "No user found");
      setLoading(false);
      setTrips([]);
      return;
    }
    setUser(user);

    let query = supabase
  .from("triplogs")
  .select("*")
  .eq("user_id", user.id)
  .order("start", { ascending: false });

if (plan === "personal") {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 15); // Last 15 days
  query = query.gte("start", cutoff.toISOString().split("T")[0]);
}

    if (filterOpen) {
      const startIso = dateStart.toISOString().split("T")[0];
      const endIso = dateEnd.toISOString().split("T")[0];
      query = query.gte("start", startIso).lte("start", endIso);
    }

    const { data: tripData, error } = await query;

    if (error) {
      Alert.alert("Error", "Could not fetch trips: " + error.message);
      setTrips([]);
      setLoading(false);
      return;
    }

    // Fix date parsing for all trip objects
    let cleaned = (tripData || []).map(t => ({
      ...t,
      miles: typeof t.miles === "string" ? parseFloat(t.miles) : t.miles,
      start: t.start ? toISOZ(t.start) : null,
      end: t.end ? toISOZ(t.end) : null,
      date: t.date ? toISOZ(t.date) : null,
    }));

    setTrips(cleaned);
    setFilteredMiles(cleaned.reduce((sum, t) => sum + (t.miles || 0), 0));
    setVisibleCount(10); // Reset pagination on new data
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [dateStart, dateEnd, units])
  );

  // Date filter presets
  const handlePreset = (preset) => {
    const now = new Date();
    let start, end;
    if (preset === "ytd") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date();
    } else if (preset === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    } else if (preset === "week") {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      end = new Date();
    }
    setDateStart(start);
    setDateEnd(end);
    setFilterOpen(false);
  };

const handleExportCSV = async () => {
  if (!trips.length) {
    Alert.alert("Nothing to export", "No trips in selected date range.");
    return;
  }

  const generatedAt = new Date().toLocaleString();

  let csv = "# Generated by NavMiles – Smart Fuel & Mileage Tracker\n";
  csv += "Date,Start Time,End Time,Miles,Trip Duration,Trip Type\n";

  for (let t of trips) {
    csv += [
      formatDate(t.start),
      formatTime(t.start),
      formatTime(t.end),
      t.miles != null ? t.miles.toFixed(1) : "--",
      formatDuration(t.start, t.end),
      (t.trip_type || "").toUpperCase()
    ].join(",") + "\n";
  }

  csv += `# Generated by NavMiles on ${generatedAt}\n`;

  const filename = FileSystem.documentDirectory + `NavMiles_triplogs_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(filename, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(filename, {
    mimeType: "text/csv",
    dialogTitle: "Share Trip Log CSV",
  });
};


  // Export Handlers
  const handleExportPDF = async () => {
  if (!trips.length) {
    Alert.alert("Nothing to export", "No trips in selected date range.");
    return;
  }

  const generatedAt = new Date().toLocaleString();

  const html = `
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: ${currentTheme.text}; background: ${currentTheme.bg}; }
        h2 {
          color: ${currentTheme.primary};
          display: flex; justify-content: space-between; align-items: center;
          margin: 0 0 8px 0;
        }
        .brand { font-size: 12px; color: ${currentTheme.accent}; font-weight: bold; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid ${currentTheme.accent}; padding: 8px; text-align: center; font-size: 12px; }
        th { background: ${currentTheme.primary}; color: #fff; }
        .meta { margin-top: 6px; font-size: 12px; color: ${currentTheme.text}; }
        footer { margin-top: 14px; font-size: 10px; color: ${currentTheme.muted}; text-align: right; }
        /* Watermark */
        body::after {
          content: "NavMiles";
          position: fixed;
          top: 40%;
          left: 15%;
          font-size: 64px;
          color: rgba(0,0,0,0.05);
          transform: rotate(-28deg);
          pointer-events: none;
          white-space: nowrap;
        }
      </style>
    </head>
    <body>
      <h2>
        NavMiles Trip Logs
        <span class="brand">NavMiles</span>
        <!-- Swap the span above for a logo image if you have one:
        <img src="https://YOUR-CDN/navmiles-logo.png" alt="NavMiles" style="height:22px;" />
        -->
      </h2>

      <div class="meta"><strong>Date Range:</strong> ${formatDate(dateStart)} – ${formatDate(dateEnd)}</div>
      <div class="meta"><strong>Total ${units === "km" ? "KM" : "Miles"}:</strong> ${filteredMiles.toFixed(1)}</div>
      <div class="meta"><strong>IRS Deduction:</strong> $${(filteredMiles * IRS_MILE_RATE).toFixed(2)}</div>

      <table>
        <tr>
          <th>Date</th>
          <th>Start</th>
          <th>End</th>
          <th>${units === "km" ? "KM" : "Miles"}</th>
          <th>Type</th>
          <th>Duration</th>
        </tr>
        ${trips.map(t => `
          <tr>
            <td>${formatDate(t.start)}</td>
            <td>${formatTime(t.start)}</td>
            <td>${formatTime(t.end)}</td>
            <td>${t.miles != null ? t.miles.toFixed(1) : "--"}</td>
            <td>${(t.trip_type || "").toUpperCase()}</td>
            <td>${formatDuration(t.start, t.end)}</td>
          </tr>
        `).join("")}
      </table>

      <footer>Generated by NavMiles • ${generatedAt}</footer>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share PDF Trip Log",
  });
};


const handleExportEmail = async () => {
  if (!trips.length) {
    Alert.alert("Nothing to export", "No trips in selected date range.");
    return;
  }

  const generatedAt = new Date().toLocaleString();

  let csv = "# Generated by NavMiles – Smart Fuel & Mileage Tracker\n";
  csv += "Date,Start Time,End Time,Miles,Trip Duration,Trip Type\n";

  for (let t of trips) {
    csv += [
      formatDate(t.start),
      formatTime(t.start),
      formatTime(t.end),
      t.miles != null ? t.miles.toFixed(1) : "--",
      formatDuration(t.start, t.end),
      (t.trip_type || "").toUpperCase()
    ].join(",") + "\n";
  }

  csv += `# Generated by NavMiles on ${generatedAt}\n`;

  const filename = FileSystem.documentDirectory + `NavMiles_triplogs_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(filename, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(filename, {
    mimeType: "text/csv",
    dialogTitle: "Share Trip Log CSV via Email",
  });
};



  // Pagination
  const loadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  // Trip card UI
  const renderTrip = ({ item }) => (
    <View style={[styles.tripCard, { backgroundColor: currentTheme.card }]}>
      <View style={styles.tripHeader}>
        <Text style={[styles.tripDate, { color: currentTheme.primary }]}>
          {formatDateTime(item.start)}
        </Text>
        <Text style={[styles.tripMiles, { color: currentTheme.accent }]}>
  {item.miles != null ? item.miles.toFixed(1) : "--"} {units === "km" ? "km" : "mi"}
</Text>

      </View>
      <Text style={[styles.tripTimes, { color: currentTheme.text }]}>
        Start: {formatDateTime(item.start)}{"\n"}
        End: {formatDateTime(item.end)}
      </Text>
      <Text style={[styles.tripDuration, { color: currentTheme.muted }]}>
        Duration: {formatDuration(item.start, item.end)}
      </Text>
      
      {item.trip_type && (
        <Text style={{ color: currentTheme.muted, fontSize: 14, fontStyle: "italic" }}>
          {item.trip_type === "personal"
            ? "Personal"
            : item.trip_type === "business"
            ? "Business"
            : item.trip_type}
        </Text>
      )}
      <View style={{ marginTop: 10 }}>
      

     



      <Text style={{ fontWeight: 'bold', color: '#fff' }}>Notes:</Text>

      <Text style={{ color: '#fff' }}>
     {item.notes || "No notes added."}
    </Text>

 


      <TouchableOpacity
        style={{ marginTop: 6, backgroundColor: "#007bff", padding: 6, borderRadius: 6 }}
        onPress={() => openEditModal(item)}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Edit Entry</Text>
      </TouchableOpacity>
    </View>

   
  </View>
);
    

    
  

  return (
    <View style={[styles.outer, { backgroundColor: currentTheme.bg }]}>
      <View style={styles.headerBox}>
        <Text style={[styles.title, { color: currentTheme.primary }]}>Trip Log & Mileage Deduction</Text>
        <TouchableOpacity onPress={() => setFilterOpen(true)} style={[styles.filterBtn, { backgroundColor: currentTheme.card }]}>
          <MaterialIcons name="filter-alt" size={20} color={currentTheme.accent} />
          <Text style={[styles.filterBtnText, { color: currentTheme.accent }]}>Filter</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.summaryBox, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.summaryLabel, { color: currentTheme.text }]}>IRS Est. Deduction:</Text>
        <Text style={[styles.summaryValue, { color: currentTheme.accent }]}>${(filteredMiles * IRS_MILE_RATE).toFixed(2)}</Text>
        <Text style={[styles.summaryYTD, { color: currentTheme.text }]}>
  Total {units === "km" ? "KM" : "Miles"} in Range: <Text style={{ color: currentTheme.accent }}>{filteredMiles.toFixed(1)}</Text>
</Text>

{plan === "personal" && (
  <View style={{ backgroundColor: "#f5dada", padding: 12, margin: 12, borderRadius: 8 }}>
    <Text style={{ color: "#b33", fontWeight: "bold", textAlign: "center" }}>
      Upgrade to Business for unlimited trip history, IRS reports, and export!
    </Text>
  </View>
)}

      </View>
      <View style={{ flex: 1, minHeight: 330 }}>
  <TextInput
    placeholder="Search logs…"
    value={searchQuery}
    onChangeText={setSearchQuery}
    style={{
      marginHorizontal: 14,
      marginBottom: 10,
      padding: 10,
      
      backgroundColor: currentTheme.card,
      borderRadius: 8,
      borderColor: "#ccc",
      borderWidth: 1,
      fontSize: 16,
      color: currentTheme.text,
    }}
  />

  <FlatList
    data={filteredLogs.slice(0, visibleCount)} // <- ✅ filtered data now

          renderItem={renderTrip}
          keyExtractor={item => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <Text style={[styles.emptyMsg, { color: currentTheme.text }]}>No trips yet in this date range.</Text>
          )}
        />
        {visibleCount < trips.length && (
          <TouchableOpacity
            style={[styles.loadMoreBtn, { backgroundColor: currentTheme.primary }]}
            onPress={loadMore}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>Load More</Text>
          </TouchableOpacity>
        )}
      </View>
  <View style={styles.exportRow}>
  {/* CSV Export */}
  <TouchableOpacity
    style={[
      styles.exportBtn,
      { backgroundColor: currentTheme.primary, opacity: 1 }
    ]}
    onPress={handleExportCSV}
  >
    <MaterialIcons name="file-download" size={22} color="#fff" />
    <Text style={styles.exportBtnText}>CSV</Text>
  </TouchableOpacity>

  {/* PDF Export */}
  <TouchableOpacity
    style={[
      styles.exportBtn,
      { backgroundColor: currentTheme.primary, opacity: 1 }
    ]}
    onPress={handleExportPDF}
  >
    <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
    <Text style={styles.exportBtnText}>PDF</Text>
  </TouchableOpacity>

  {/* Email Export */}
  <TouchableOpacity
    style={[
      styles.exportBtn,
      { backgroundColor: currentTheme.primary, opacity: 1 }
    ]}
    onPress={handleExportEmail}
  >
    <MaterialIcons name="email" size={22} color="#fff" />
    <Text style={styles.exportBtnText}>Email</Text>
  </TouchableOpacity>
</View>

      <Modal visible={filterOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.modalTitle, { color: currentTheme.primary }]}>Filter by Date</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity style={[styles.presetBtn, { backgroundColor: currentTheme.bg }]} onPress={() => handlePreset("ytd")}>
                <Text style={[styles.presetText, { color: currentTheme.accent }]}>YTD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.presetBtn, { backgroundColor: currentTheme.bg }]} onPress={() => handlePreset("month")}>
                <Text style={[styles.presetText, { color: currentTheme.accent }]}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.presetBtn, { backgroundColor: currentTheme.bg }]} onPress={() => handlePreset("week")}>
                <Text style={[styles.presetText, { color: currentTheme.accent }]}>This Week</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.datePickers}>
              <Pressable onPress={() => setShowStartPicker(true)}>
                <Text style={[styles.dateLabel, { color: currentTheme.text, borderBottomColor: currentTheme.primary }]}>Start: {formatDate(dateStart)}</Text>
              </Pressable>
              <Pressable onPress={() => setShowEndPicker(true)}>
                <Text style={[styles.dateLabel, { color: currentTheme.text, borderBottomColor: currentTheme.primary }]}>End: {formatDate(dateEnd)}</Text>
              </Pressable>
            </View>
            {showStartPicker && (
              <DateTimePicker
                value={dateStart}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(e, d) => {
                  setShowStartPicker(false);
                  if (d) setDateStart(d);
                }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={dateEnd}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(e, d) => {
                  setShowEndPicker(false);
                  if (d) setDateEnd(d);
                }}
              />
            )}
            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: currentTheme.primary }]}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={styles.closeModalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {loading && (
        <View style={styles.loadingCover}>
          <ActivityIndicator size="large" color={currentTheme.primary} />
        </View>
      )}
     {editingTrip && (

  <Modal
    animationType="slide"
    transparent
    visible
    onRequestClose={() => setEditingTrip(null)}
  >
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 10} // tweak as needed
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 10,
            padding: 20,
            // you can add a little margin top if you want it pulled down a bit
            marginTop: Platform.OS === 'ios' ? 30 : 10,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Edit Trip</Text>

          <Text style={{ marginTop: 12 }}>Notes:</Text>
          <TextInput
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder="Add notes here..."
            multiline
            style={{
              borderColor: '#ccc',
              borderWidth: 1,
              padding: 10,
              borderRadius: 8,
              marginTop: 4,
              minHeight: 80,       // give it some vertical room
              textAlignVertical: 'top',
            }}
          />

          <Text style={{ marginTop: 12 }}>Trip Type:</Text>
<TextInput
  value={editTripType}
  onChangeText={setEditTripType}
  placeholder="e.g. personal, business, other…"
  style={{
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  }}
  autoCapitalize="none"
/>


          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 24,
            }}
          >
            <TouchableOpacity onPress={() => setEditingTrip(null)}>
              <Text style={{ color: '#888' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveEdit}>
              <Text style={{ color: '#007bff', fontWeight: 'bold' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>
)}


    </View>
    
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, paddingTop: Platform.OS === "android" ? 44 : 60 },
  headerBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 22, paddingTop: 24, marginBottom: 8,
  },
  title: {
    fontSize: 22, fontWeight: "bold", letterSpacing: 1, flex: 1,
  },
  filterBtn: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 8, padding: 8, marginLeft: 9,
  },
  filterBtnText: { marginLeft: 4, fontWeight: "bold" },
  summaryBox: {
    borderRadius: 14, padding: 16, margin: 14, alignItems: "center", elevation: 2,
  },
  summaryLabel: { fontSize: 15, fontWeight: "bold" },
  summaryValue: { fontWeight: "bold", fontSize: 27, marginTop: 3, marginBottom: 5 },
  summaryYTD: { fontSize: 15, marginBottom: 4 },
  listContainer: { paddingBottom: 120 },
  tripCard: {
    borderRadius: 13, padding: 18,
    marginHorizontal: 14, marginBottom: 10, elevation: 1,
  },
  tripHeader: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 6,
  },
  tripDate: { fontWeight: "bold", fontSize: 15 },
  tripMiles: { fontWeight: "bold", fontSize: 17 },
  tripTimes: { fontSize: 15, marginBottom: 2 },
  tripDuration: { fontSize: 14, fontStyle: "italic" },
  emptyMsg: {
    textAlign: "center", fontSize: 16, marginTop: 44,
    paddingHorizontal: 14,
  },
  loadMoreBtn: {
    alignSelf: "center",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 25,
    marginBottom: 18,
    marginTop: 0,
  },
  exportRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginHorizontal: 18,
    marginVertical: 22,
  },
  exportBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", borderRadius: 10,
    paddingVertical: 15, paddingHorizontal: 18,
    minWidth: 95,
  },
  exportBtnText: {
    color: "#fff", fontWeight: "bold", fontSize: 17, marginLeft: 9, letterSpacing: 1,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',   // pull children toward top
    paddingTop: Platform.OS === 'ios' ? 100 : 120,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 23,
    width: '87%',
    alignSelf: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 18 },
  presetRow: { flexDirection: "row", justifyContent: "space-around", width: "100%", marginBottom: 16 },
  presetBtn: {
    borderRadius: 9, paddingVertical: 8, paddingHorizontal: 15,
    marginHorizontal: 4,
  },
  presetText: { fontWeight: "bold", fontSize: 15 },
  datePickers: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  dateLabel: {
    fontWeight: "bold", fontSize: 15, marginHorizontal: 9, marginBottom: 13,
    borderBottomWidth: 1, paddingBottom: 3,
  },
  closeModalBtn: {
    marginTop: 16, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 38,
  },
  closeModalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  loadingCover: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "#011524cc", justifyContent: "center", alignItems: "center", zIndex: 100,

      },

       modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    margin: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },

   modalWrapper: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 80,          // <–– pushes the white sheet down
  },
  modalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    // you can also set a minHeight if you like
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    backgroundColor: '#fafafa',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 4,
    backgroundColor: '#fff',
  },
  picker: {
    height: 44,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelText: {
    color: '#888',
    fontSize: 16,
  },
  saveText: {
    color: '#007aff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  notesInput: {
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    backgroundColor: "#fafafa",
  },
  pickerWrapper: {
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fafafa",
  },
  picker: {
    height: 44,
    width: "100%",
    color: "#000",      // text color
    backgroundColor: "#fff",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelText: {
    color: "#888",
    fontSize: 16,
  },
  saveText: {
    color: "#007bff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
