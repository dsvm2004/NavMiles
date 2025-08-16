// /providers/TripLogProvider.js
import React, { createContext, useState, useContext, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AsyncStorage from '@react-native-async-storage/async-storage';
const TripLogContext = createContext();

export function TripLogProvider({ children }) {
  const [logs, setLogs] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [tripStart, setTripStart] = useState(null);
  const [lastTripForEditing, setLastTripForEditing] = useState(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calStartOdo,  setCalStartOdo ] = useState(null);
  const [userMPG, setUserMPG] = useState(NaN);      // ← start unknown

  const [lastOdometer,  setLastOdometer ] = useState(null);
 
  const [lastFuelEntry, setLastFuelEntry] = useState(null);
  const [recalibrationHistory, setRecalibrationHistory] = useState([]);

useEffect(() => {
   (async () => {
      const saved = await AsyncStorage.getItem('userMPG');


      const num = parseFloat(saved);
    if (!Number.isNaN(num)) {
      setUserMPG(num);        // num is now a real Number, not a string
    }
  })();
}, [])


   // 1️⃣ Fetch past calibrations on mount
  useEffect(() => {
    (async () => {
      const {
        data: { user },
        error: authErr
      } = await supabase.auth.getUser();
      if (authErr || !user) return;

      const { data, error } = await supabase
        .from("recalibration_history")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (!error) setRecalibrationHistory(data);
    })();
  }, []);
  // existing logFuelEntry, startTracking, stopTracking…

 // Kick off a new calibration run
 function startCalibration(currentOdometer) {
   setCalStartOdo(currentOdometer);
   setIsCalibrating(true);
   setLastOdometer(currentOdometer);
 }

 // Finish calibration when user logs next fill
 async function finishCalibration(endOdometer, gallons) {
   const miles = endOdometer - calStartOdo;
   if (miles <= 0 || gallons <= 0) {
     alert("Invalid calibration readings");
     return;
   }
   const newAvg = miles / gallons;
   // 1) locally update
   setUserMPG(newAvg);
   await AsyncStorage.setItem('userMPG', String(newAvg));

   // 2) persist to your own recalibration table
  const {
  data: { user },
  error: authErr
} = await supabase.auth.getUser();
if (authErr || !user) {
  alert("You must be logged in to calibrate.");
  return;
}

 await supabase
    .from("recalibration_history")
    .insert([{
      user_id:        user.id,
      date:           new Date().toISOString(),
      start_odometer: calStartOdo,      // <-- correct variable here
      end_odometer:   endOdometer,
      gallons,
      calculated_mpg: newAvg,
      tripsUsed: logs.length
      
    }]);

   // 3) reset calibration state
   setIsCalibrating(false);
   setCalStartOdo(null);
   setLastOdometer(endOdometer);
 }


  const logFuelEntry = (entry) => {
    if (!entry || !entry.gallons || !entry.timestamp) return;

    if (lastFuelEntry) {
      const prevTime = new Date(lastFuelEntry.timestamp).getTime();
      const newTime = new Date(entry.timestamp).getTime();

      const filteredTrips = logs.filter(t => {
        const tripTime = new Date(t.start).getTime();
        return tripTime > prevTime && tripTime <= newTime;
      });

      const milesSinceLastFuel = filteredTrips.reduce((sum, trip) => sum + trip.miles, 0);

      if (milesSinceLastFuel > 0 && entry.gallons > 0) {
        const newMPG = milesSinceLastFuel / entry.gallons;
        console.log("🔧 Calculated new MPG:", newMPG.toFixed(2));
        setUserMPG(newMPG);
        AsyncStorage.setItem('userMPG', String(newMPG));

        // Save recalibration history
        setRecalibrationHistory(prev => [
          {
            date: new Date(entry.timestamp).toISOString(),
            miles: Number(milesSinceLastFuel.toFixed(2)),
            gallons: Number(entry.gallons),
            calculatedMPG: newMPG,
            tripsUsed: filteredTrips.length,
          },
          ...prev,
        ]);
      }
    }

    setLastFuelEntry(entry);
    if (entry.odometer_reading) setLastOdometer(entry.odometer_reading);
  };

  const startTracking = (startCoords) => {
    setIsTracking(true);
    setTripStart({ coords: startCoords, time: Date.now() });
  };

 const stopTracking = async (endCoords) => {
  setIsTracking(false);
  const endTime = Date.now();

  if (!tripStart) return;

  const miles = haversineMiles(tripStart.coords, endCoords);
  const startISO = new Date(tripStart.time).toISOString();
  const endISO = new Date(endTime).toISOString();

  const { data: { user } } = await supabase.auth.getUser();

  // 1. Insert with placeholders for notes, tags, rating
  const { data, error } = await supabase.from("triplogs").insert([{
    user_id: user.id,
    date: startISO,
    start: startISO,
    end: endISO,
    miles: Number(miles.toFixed(2)),
    notes: "",     // 👈 Placeholder
    tags: [],      // 👈 Placeholder (array)
    rating: null   // 👈 Placeholder
  }]).select("*"); // 👈 Return the inserted row

  if (!error && data?.[0]) {
    const newEntry = data[0];
    setLogs(prev => [newEntry, ...prev]);

    // 2. Save it so the modal can access/update it
    setLastTripForEditing(newEntry);  // 👈 You'll add this next
    setShowTripModal(true);           // 👈 Trigger modal popup
  } else {
    alert("Save Error: " + error.message);
  }

  setTripStart(null);
};


  return (
    <TripLogContext.Provider value={{
  logs,
  isTracking,
  startTracking,
  stopTracking,
  userMPG,
  logFuelEntry,
    // calibration API:
     isCalibrating,
     startCalibration,
     finishCalibration,
  recalibrationHistory,
  lastOdometer,
  lastTripForEditing,    
  setLastTripForEditing, 
  showTripModal,         
  setShowTripModal      

    }}>
      {children}
    </TripLogContext.Provider>
  );
}

export function useTripLog() {
  return useContext(TripLogContext);
}

function haversineMiles(a, b) {
  const R = 3959;
  const toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad;
  const dLon = (b.longitude - a.longitude) * toRad;
  const lat1 = a.latitude * toRad;
  const lat2 = b.latitude * toRad;
  const d = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(1 - d));
}

export default TripLogProvider;