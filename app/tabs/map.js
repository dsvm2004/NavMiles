

// MapScreen.js (fixed ordering — no UI/behavior changes)
import { Switch, TouchableWithoutFeedback } from "react-native";
import KalmanFilter from 'kalmanjs';
import Kalman2D     from '../kalman2d';
import debounce from 'lodash.debounce';
import * as Notifications from "expo-notifications";
import { useSettings } from "../providers/SettingsContext";
import MapView, { Animated as AnimatedMapView, PROVIDER_GOOGLE, Marker, Polyline } from "react-native-maps";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
  Keyboard,
  Alert,
} from "react-native";
import { distanceFromPolyline, calculateBearing } from '../utils';
import { useTripLog }     from '../providers/TripLogProvider';
import * as Location from "expo-location";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import Slider from "@react-native-community/slider";
import { useUserVehicle } from '../providers/UserVehicleContext';
import { supabase } from "../../lib/supabaseClient"; 

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

// PATCH 3: never pop system banners while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,   // ← suppress foreground banners; we speak in-app instead
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});



const screen = Dimensions.get("window");

const MAPS_PROXY_BASE = "https://mapsproxy-215500798699.us-east1.run.app";
const PREANNOUNCE_M = 400; 

// Debug flags (top-level, outside any function/component)
const DEBUG_ROAD_SNAP = false;     // ← toggle off in prod









function formatEta(mins) {
  if (typeof mins !== "number" || isNaN(mins)) return "--";
  const hr = Math.floor(mins / 60);
  const min = Math.round(mins % 60);
  return hr > 0 ? `${hr} hr${hr > 1 ? "s" : ""} ${min} min` : `${min} min`;
}

function calcRemaining(route, turnIdx, location) {
  const leg = route?.legs?.[0];
  if (!leg || !leg.steps?.length || !location) {
    return { miles: 0, minutes: 0 };
  }
  const steps = leg.steps;
  const idx = Math.min(Math.max(turnIdx ?? 0, 0), steps.length - 1);
  const cur = steps[idx];

  const stepEnd = { latitude: cur.end_location.lat, longitude: cur.end_location.lng };
  const stepDistM = cur.distance.value;
  const stepRemainM = Math.min(stepDistM, getDistance(location, stepEnd));

  let totalM = stepRemainM;
  let totalSec = (cur.duration.value * (stepRemainM / Math.max(1, stepDistM)));
  for (let i = idx + 1; i < steps.length; i++) {
    totalM += steps[i].distance.value;
    totalSec += steps[i].duration.value;
  }
  return { miles: totalM / 1609.34, minutes: Math.round(totalSec / 60) };
}

function formatNextTurnDistance(distanceInMeters) {
  if (distanceInMeters < 0) return '';
  const feet = distanceInMeters * 3.28084;
  if (feet < 528) {
    return `${Math.round(feet)} ft`;
  }
  const miles = distanceInMeters / 1609.34;
  if (miles < 1) {
    return `${miles.toFixed(2)} mi`;
  }
  return `${miles.toFixed(1)} mi`;
}

function buildSpokenInstruction(distM, bareText, turnNumber) {
  if (turnNumber === 0) return bareText;
  if (distM < 10) return bareText;
  const spokenDist = formatNextTurnDistance(distM);
  return `In ${spokenDist}, ${bareText}`;
}




export async function sendTurnNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
    channelId: 'nav-alerts', // ← add this
  });
}

async function snapToRoad({ latitude, longitude }) {
  try {
    const res = await fetch(`${MAPS_PROXY_BASE}/nearestroad?points=${latitude},${longitude}`);
    const data = await res.json();
    const pt = data?.snappedPoints?.[0]?.location;
    return pt ? { latitude: pt.latitude, longitude: pt.longitude } : { latitude, longitude };
  } catch { return { latitude, longitude }; }
}

function decodePolyline(encoded) {
  let poly = [];
  let index = 0, len = encoded.length, lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlat = result & 1 ? ~(result >> 1) : result >> 1; lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlng = result & 1 ? ~(result >> 1) : result >> 1; lng += dlng;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}

function getSmartZoom({ mph, navMode, distanceToTurn }) {
  if (!navMode) {
    if (mph < 10) return 18;
    if (mph < 30) return 17;
    if (mph < 55) return 16;
    return 15;
  }
  if (distanceToTurn !== undefined && distanceToTurn < 200) return 18;
  if (mph < 15) return 17.5;
  if (mph < 30) return 17;
  if (mph < 55) return 16;
  return 15;
}

function getDistance(c1, c2) {
  if (!c1 || !c2) return 999999;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(c2.latitude - c1.latitude);
  const dLon = toRad(c2.longitude - c1.longitude);
  const lat1 = toRad(c1.latitude);
  const lat2 = toRad(c2.latitude);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapScreen() {
  const mapRef = useRef(null);

// limits
const MAX_ROUTE_POINTS = 500;   // drawing
const MAX_FIT_COORDS   = 80;    // for fitToCoordinates payloads

const MAX_ROUTE_POINTS_NEAR = 500;
const MAX_ROUTE_POINTS_FAR  = 1200;  // more detail for long routes

const DEBUG_SHOW_SNAP = true;   // green, snapped segments
const DEBUG_SHOW_RAW  = false;  // 🔴 set to false to hide the straight-line overlay
const DEBUG_RAW_SEG_LIMIT = 400;
const DEBUG_CLIP_TO_BOUNDS = false;

const lastDirectionsRef = useRef(null);


 // Treat routes beyond this distance as "far" to keep responses small
  const FAR_ROUTE_MILES = 80; // was your pain point; bump to 50/100 if you like
const AUTO_START_ON_FAR_TRIPS = false;
  // Keep only the minimal step fields we actually use for nav UI and remaining calc
  const pruneLegs = (legs) => {
    if (!Array.isArray(legs)) return [];
    return legs.map((leg) => ({
      steps: (leg.steps || []).map((s) => ({
        html_instructions: s.html_instructions || "",
        end_location: s.end_location,          // { lat, lng }
        distance: s.distance,                  // { value, text }
        duration: s.duration,                  // { value, text }
      })),
    }));
  };

// helpers (scoped to component so they can use mapRef)
const isValidCoord = (p) =>
  p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

const sanitizePoints = (arr) => (arr || []).filter(isValidCoord);

const segInBounds = (seg, b) => {
    if (!b) return true;
    const [a, c] = seg; // segment is [point1, point2]
    const minLat = Math.min(a.latitude,  c.latitude);
    const maxLat = Math.max(a.latitude,  c.latitude);
    const minLng = Math.min(a.longitude, c.longitude);
    const maxLng = Math.max(a.longitude, c.longitude);
    return !(
      maxLat < b.southWest.latitude  ||
      minLat > b.northEast.latitude  ||
      maxLng < b.southWest.longitude ||
      minLng > b.northEast.longitude
    );
  };

const downsample = (arr, max) => {
  const clean = sanitizePoints(arr);
  if (clean.length <= max) return clean;
  const step = Math.ceil(clean.length / max);
  return clean.filter((_, i) => i % step === 0);
};

const safeFitToCoordinates = (coords, options) => {
  const pts = downsample(coords, MAX_FIT_COORDS);
  if (!mapRef.current || pts.length < 2) return;
  try {
    mapRef.current.fitToCoordinates(pts, options);
  } catch (e) {
    console.warn("fitToCoordinates failed:", e?.message || e);
  }
};


  const { user, currentVehicle } = useUserVehicle();
  const { isCalibrating, finishCalibration, userMPG } = useTripLog();

  // ===== State & refs declared before any effects =====
  const [hazards, setHazards] = useState([]);
  const hazardsRef = useRef([]);
  
  const [pauseAutoFollow, setPauseAutoFollow] = useState(false);

  // Low Fuel Modal state
  const [lowFuelModal, setLowFuelModal] = useState({ open: false, level: null, secs: 60 });
  const lowFuelTimerRef = useRef(null);

  const ACTIVE_ROUTE_COLOR   = "#3578e5";
const INACTIVE_ROUTE_COLOR = "rgba(53,120,229,0.25)"; // dimmed
const INACTIVE_ROUTE_COLOR_DARK = "rgba(139,186,255,0.25)"; // dimmed for dark map
const ACTIVE_WIDTH   = 6;
const INACTIVE_WIDTH = 4;


  // Vehicle & fuel basics
  const TANK_SIZE = currentVehicle?.tank_size ?? 15;
  const EPA_MPG   = currentVehicle?.mpg       ?? 25;

  const [avgMPG, setAvgMPG] = useState(EPA_MPG);
  const [location, setLocation] = useState(null);

  // Search & trip
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchBarActive, setSearchBarActive] = useState(false);
  const [tripActive, setTripActive] = useState(false);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripRoute, setTripRoute] = useState([]);
  const tripWatchRef = useRef(null);
  const lastTripLoc = useRef(null);
  const tripStartTime = useRef(null);

  // Routing
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [routeModal, setRouteModal] = useState(false);
  const [activeRouteIdx, setActiveRouteIdx] = useState(0);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const offRouteCountRef = useRef(0);

  const lastZoomRef = useRef(null);




  // Fuel state & gas
  const [fuelGallons, setFuelGallons] = useState(TANK_SIZE);
  const [gasCooldownModal, setGasCooldownModal] = useState(false);
  const [gasStations, setGasStations] = useState([]);
  const [gasModal, setGasModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelSlider, setFuelSlider] = useState(1);
  const [inputGallons, setInputGallons] = useState('');
  const [inputOdometer, setInputOdometer] = useState('');
  const [lastOdometer, setLastOdometer] = useState(null);
  const [fullFill, setFullFill] = useState(false);
  const [isMPGEstimated, setIsMPGEstimated] = useState(true);

  // Waypoints & stops
  const [waypoints, setWaypoints] = useState([]);
  const [addingStop, setAddingStop] = useState(false);
  const [pendingStop, setPendingStop] = useState(null);
  const [showStopPrompt, setShowStopPrompt] = useState(false);
  const waypointsRef = useRef(waypoints);

  // Navigation
  const [navMode, setNavMode] = useState(false);
  const [turnIdx, setTurnIdx] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const navIntervalRef = useRef(null);
  const lastSpokenInstruction = useRef('');

  // --- PATCH 1: app state + voice/notification guards ---
const appStateRef = useRef(AppState.currentState);
useEffect(() => {
  const sub = AppState.addEventListener('change', s => { appStateRef.current = s; });
  return () => sub.remove();
}, []);

// Per-step spoken/notification flags + distance memory
const stepSpokenRef = useRef({});
const lastDistRef = useRef(null);     // last distance-to-turn
const passJitterRef = useRef(0);      // counts consecutive "getting farther" ticks

// Simple cooldown for notifications
const lastNotifRef = useRef({ step: -1, key: '', at: 0 });
function notifyOnce(stepIdx, key, title, body) {
  const now = Date.now();
  const last = lastNotifRef.current;
  if (last.step === stepIdx && last.key === key && (now - last.at) < 45000) return; // 45s cooldown
  Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, priority: Notifications.AndroidNotificationPriority.MAX },
    trigger: null,
    channelId: "nav-alerts",
  });
  lastNotifRef.current = { step: stepIdx, key, at: now };
}

const ONE_MI_M       = 1609;   // 1 mile, meters
const FOUR_HUND_FT_M = 122;    // 400 ft ≈ 121.92 m
const NOW_FT_M       = 24;

function plainText(html){ return html.replace(/<(?:.|\n)*?>/gm, '').replace(/&[^;]+;/g, ''); }



  const [currentNavInstruction, setCurrentNavInstruction] = useState('');
  const [distanceToNextTurn, setDistanceToNextTurn] = useState('');
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingDuration, setRemainingDuration] = useState(0);
  const [showNavModal, setShowNavModal] = useState(false);
  const [totalMilesRemaining, setTotalMilesRemaining] = useState(0);
  const [eta, setEta] = useState(0);

  // put this with your other refs, BEFORE any useEffect that uses it
const lastDrainLoc = useRef(null);

  // UI & telemetry
  const [isDark, setIsDark] = useState(false);
  const [mph, setMph] = useState(0);
  const [saving, setSaving] = useState(false);

  const manualOverrideTimerRef = useRef(null);


  // Hazard confirm helpers
  const [hazardToConfirm, setHazardToConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [hazardsPrompted, setHazardsPrompted] = useState({});
  const hazardMinDistRef = useRef({});
  const hazardsPromptedRef = useRef({});
  const lastAlertedRef = useRef({ 100: false, 50: false });

  const [mapBounds, setMapBounds] = useState(null);

  // keep latest values without triggering re-creations
const ctxRef = useRef({ location: null, mapBounds: null });
useEffect(() => {
  ctxRef.current.location = location;
  ctxRef.current.mapBounds = mapBounds;
}, [location, mapBounds]);


  const { tripPref, lowFuelAlerts, soundAlerts /* , vibrateAlerts */ } = useSettings();


  const [justStoppedNavigation, setJustStoppedNavigation] = useState(false);
  const [lastFindGas, setLastFindGas] = useState(0);
  const [secondsLeft,  setSecondsLeft] = useState(0);

  // Filters
  const kfPos     = useRef(new Kalman2D(0.5, 8));
  const kfSpeed   = useRef(new KalmanFilter());
  const kfHeading = useRef(new KalmanFilter());

  const lastCamHeadingRef = useRef(null);
  const lastPosRef = useRef(null);
  const courseRef = useRef(null);

  // Mirror refs
  const avgMPGRef = useRef(avgMPG);
  const navModeRef = useRef(navMode);
  const routesRef = useRef(routes);
  const activeRouteIdxRef = useRef(activeRouteIdx);
  const turnIdxRef = useRef(turnIdx);
  const destinationRef = useRef(destination);
  const voiceOnRef = useRef(voiceOn);
  const lastRerouteAtRef = useRef(0);

  useEffect(() => { avgMPGRef.current = avgMPG; }, [avgMPG]);
  useEffect(() => { navModeRef.current = navMode; }, [navMode]);
  useEffect(() => { routesRef.current = routes; }, [routes]);
  useEffect(() => { activeRouteIdxRef.current = activeRouteIdx; }, [activeRouteIdx]);
  useEffect(() => { turnIdxRef.current = turnIdx; }, [turnIdx]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);

  // Derived fuel/range (declared before effects that read it)
  const gallonsClamped = Math.max(0, Math.min(fuelGallons, TANK_SIZE));
  const mpgClamped     = Math.max(3, Math.min(avgMPG, EPA_MPG * 2));
  const milesInTank    = Math.round(gallonsClamped * mpgClamped);
  const prevMilesInTank = useRef(milesInTank);

  const vehicleId = currentVehicle?.id ?? "default";
  const gasPinsTimer = useRef(null);
  

  function normalizeDeg(d) { return ((d % 360) + 360) % 360; }
  function stepHeading(prev, next, maxStep = 20) {
    if (prev == null) return normalizeDeg(next);
    prev = normalizeDeg(prev); next = normalizeDeg(next);
    let delta = ((next - prev + 540) % 360) - 180; // -180..180
    const step = Math.max(Math.min(delta, maxStep), -maxStep);
    return normalizeDeg(prev + step);
  }
  function chooseHeading(speed_mps, gpsHeading, course) {
    const mph = speed_mps * 2.23694;
    const gh = Number.isFinite(gpsHeading) ? normalizeDeg(gpsHeading) : null;
    const ch = Number.isFinite(course) ? normalizeDeg(course) : null;
    if (mph < 8) { return lastCamHeadingRef.current ?? ch ?? gh ?? 0; }
    return ch ?? gh ?? lastCamHeadingRef.current ?? 0;
  }

  // ===== Effects =====
  useEffect(() => () => { if (lowFuelTimerRef.current) clearInterval(lowFuelTimerRef.current); }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('nav-alerts', {
        name: 'Navigation Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }, []);


useEffect(() => {
  return () => {
    if (manualOverrideTimerRef.current) {
      clearTimeout(manualOverrideTimerRef.current);
    }
  };
}, []);


const navHydratedRef = useRef(false);

  // LOAD once, but don't override if user already turned nav on
useEffect(() => {
  (async () => {
    try {
      const stored = await AsyncStorage.getItem('navMode');
      navHydratedRef.current = true;
      if (stored === null) return;
      setNavMode(prev => (prev ? prev : JSON.parse(stored)));
    } catch (e) {
      console.error('Failed to load navMode from AsyncStorage', e);
    }
  })();
}, []);

  useEffect(() => {
    if (!navMode || !routes.length || !location) return;
    const leg = routes[activeRouteIdx]?.legs?.[0];
    const step = leg?.steps?.[turnIdx];
    if (!step) return;
    const text = step.html_instructions.replace(/<(?:.|\n)*?>/gm, '').replace(/&[^;]+;/g, '');
    setCurrentNavInstruction(text);
    const stepEnd = { latitude: step.end_location.lat, longitude: step.end_location.lng };
    const d = getDistance(location, stepEnd);
    setDistanceToNextTurn(formatNextTurnDistance(d));
  }, [turnIdx, routes, activeRouteIdx, location, navMode]);

// SAVE only after hydration
useEffect(() => {
  if (!navHydratedRef.current) return;
  AsyncStorage.setItem('navMode', JSON.stringify(navMode)).catch(() => {});
}, [navMode]);

  useEffect(() => {
    (async () => {
      const alerted = await AsyncStorage.getItem("notifAlerted");
      if (alerted === "true") return;
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "undetermined") {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert("Permission Needed", "Please allow notifications to get navigation alerts.");
        }
        await AsyncStorage.setItem("notifAlerted", "true");
      } else if (status === "denied") {
        Alert.alert("Permission Needed", "Please allow notifications to get navigation alerts.");
        await AsyncStorage.setItem("notifAlerted", "true");
      }
    })();
  }, []);

  useEffect(() => { hazardsRef.current = hazards }, [hazards]);

  useEffect(() => {
    async function catchUp() {
      const lastCalTs = await AsyncStorage.getItem("lastCalTs") || tripStartTime.current;
      const { data: trips } = await supabase.from("triplogs").select("distance, end").gt("end", lastCalTs);
      const miles = (trips ?? []).reduce((sum, t) => sum + parseFloat(t.distance ?? 0), 0);
      setFuelGallons(fg => Math.max(0, fg - miles / avgMPG));
      await AsyncStorage.setItem("lastCalTs", new Date().toISOString());
    }
    catchUp();
  }, []);

  useEffect(() => {
    (async () => {
      const savedGallons = parseFloat(await AsyncStorage.getItem(`fuelGallons_${vehicleId}`));
      if (!isNaN(savedGallons) && savedGallons >= 0) setFuelGallons(savedGallons);
      else setFuelGallons(TANK_SIZE);
    })();
  }, [TANK_SIZE, vehicleId]);

  useEffect(() => {
    const cooldownSecs = 5 * 60; let timer;
    const update = () => { const elapsed = Math.floor((Date.now() - lastFindGas) / 1000); const rem = cooldownSecs - elapsed; setSecondsLeft(rem > 0 ? rem : 0); };
    if (Date.now() - lastFindGas < cooldownSecs * 1000) { update(); timer = setInterval(update, 1000); } else { setSecondsLeft(0); }
    return () => clearInterval(timer);
  }, [lastFindGas]);

  useEffect(() => { AsyncStorage.setItem(`fuelGallons_${vehicleId}`, fuelGallons.toString()); }, [fuelGallons, vehicleId]);

  useEffect(() => {
    if (typeof milesInTank !== 'number') return;
    if (lowFuelAlerts && prevMilesInTank.current > 100 && milesInTank <= 100 && !lastAlertedRef.current[100]) {
  lastAlertedRef.current[100] = true;
  setTimeout(() => { lastAlertedRef.current[100] = false }, 15 * 60 * 1000);
  openLowFuelModal(100);
}
if (lowFuelAlerts && prevMilesInTank.current > 50 && milesInTank <= 50 && !lastAlertedRef.current[50]) {
  lastAlertedRef.current[50] = true;
  setTimeout(() => { lastAlertedRef.current[50] = false }, 15 * 60 * 1000);
  openLowFuelModal(50);
}

    if (milesInTank > 100) { lastAlertedRef.current[100] = false; lastAlertedRef.current[50] = false; }
    prevMilesInTank.current = milesInTank;
  }, [milesInTank]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("hazards").select("*");
      if (!error) setHazards(data);
    })();

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission Denied", "Location access is needed for this app's features."); return; }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();

    const hazardChannel = supabase
      .channel('hazards-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hazards' }, (payload) => {
        const newHazard = payload.new; setHazards(hs => [...hs, newHazard]); handleExternalHazard(newHazard); scheduleHazardRemoval(newHazard);
      })
      .subscribe();

    return () => { supabase.removeChannel(hazardChannel); };
  }, [user, currentVehicle]);

  useEffect(() => {
    let watch;
    (async () => {
      watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 3, timeInterval: 1500 },
        (loc) => {
          const raw = loc.coords;
          const { lat, lon } = kfPos.current.step(raw.latitude, raw.longitude, Date.now());
          const smSpeed = kfSpeed.current.filter(isFinite(raw.speed) ? raw.speed : 0);
          const mphNow = Math.round((isFinite(smSpeed) ? smSpeed : 0) * 2.23694);
          setMph(mphNow);

          if (lastPosRef.current) { courseRef.current = calculateBearing(lastPosRef.current, { latitude: lat, longitude: lon }); }
          lastPosRef.current = { latitude: lat, longitude: lon };
          const rawHeading = Number.isFinite(raw.heading) ? normalizeDeg(raw.heading) : null;
          const smHeading = rawHeading == null ? null : kfHeading.current.filter(rawHeading);

          setLocation({ latitude : lat, longitude: lon, altitude : raw.altitude, accuracy : raw.accuracy, speed : smSpeed, heading  : smHeading });

          if (lastDrainLoc.current) {
            const miles = getDistance(lastDrainLoc.current, { latitude: lat, longitude: lon }) / 1609.34;
            if (miles > 0.01) { setFuelGallons(fg => Math.max(0, fg - (miles / avgMPGRef.current))); lastDrainLoc.current = { latitude: lat, longitude: lon }; }
          } else { lastDrainLoc.current = { latitude: lat, longitude: lon }; }

          if (navModeRef.current && routesRef.current.length) {
            const activeRoute = routesRef.current[activeRouteIdxRef.current];
            const { miles, minutes } = calcRemaining(activeRoute, turnIdxRef.current, { latitude: lat, longitude: lon });
            setRemainingDistance(miles); setRemainingDuration(minutes);
          }

          const off = distanceFromPolyline({ latitude: lat, longitude: lon }, (routesRef.current[0]?.points || []));
          const speedMph = (isFinite(raw.speed) ? raw.speed : 0) * 2.23694;
          const threshold = speedMph > 35 ? 120 : 70;
          if (off > threshold) { offRouteCountRef.current += 1; } else { offRouteCountRef.current = 0; }
          if (offRouteCountRef.current >= 2 && destinationRef.current && throttleOk) {
  lastRerouteAtRef.current = Date.now();
  setTurnIdx(0);                 // ✅ restart turn step index
  lastDistRef.current = null;    // ✅ clear last distance
  stepSpokenRef.current = {};    // ✅ optional: reset spoken turn instructions
  fetchDirections(destinationRef.current, waypointsRef.current || [], { silent: true });
}

        }
      );
    })();
    return () => { if (watch) watch.remove(); };
  }, []);

const getSmartZoomInNav = () => {
  if (!routes?.length || !location || turnIdx === null || turnIdx >= routes.length - 1)
    return 16;

  const currentStep = routes[turnIdx];
  const nextStep = routes[turnIdx + 1];
  const distanceToNextTurn = distanceFromPolyline(location, [nextStep.start_location]);

  if (distanceToNextTurn < 100) return 18;
  if (
    currentStep?.instruction?.toLowerCase()?.includes("ramp") ||
    currentStep?.instruction?.toLowerCase()?.includes("highway")
  ) return 14;

  return 16;
};



  useEffect(() => {
    if (!location || !mapRef.current || navMode || pauseAutoFollow) return;
    const smartZoom = getSmartZoom({ mph, navMode: false });
    const acc = location.accuracy ?? 999;
    const targetHeading = acc > 50 ? (lastCamHeadingRef.current ?? 0) : chooseHeading(location.speed ?? 0, location.heading, courseRef.current);
    const smoothHeading = stepHeading(lastCamHeadingRef.current, targetHeading, 20);
    lastCamHeadingRef.current = smoothHeading;

    mapRef.current.animateCamera({
  center: {
    latitude: location.latitude,
    longitude: location.longitude,
  },
  zoom: getSmartZoom({ mph, navMode: false }), // ✅ new dynamic zoom
  pitch: 60,
  heading: smoothHeading,
}, { duration: 500 });

  }, [location, mph, navMode, pauseAutoFollow]);

  useEffect(() => {
    if (!location || !hazards.length) return;
    hazards.forEach(hazard => {
      const dist = getDistance(location, hazard);
      const prevMin = hazardMinDistRef.current[hazard.id] ?? Infinity;
      if (dist < prevMin) { hazardMinDistRef.current[hazard.id] = dist; }
      if (hazardsPromptedRef.current[hazard.id]) return;
      if (prevMin < 50 && dist > 80) { setHazardToConfirm(hazard); hazardsPromptedRef.current[hazard.id] = true; }
    });
  }, [location, hazards]);

  useEffect(() => {
  if (!location || !mapRef.current || !routes.length || pauseAutoFollow || !navMode) return;

  const route = routes[0];
  let nextPoint = route.points?.[turnIdx + 1];

  if (!nextPoint) {
    const step = route.legs?.[0]?.steps?.[turnIdx];
    if (step?.end_location) {
      nextPoint = {
        latitude: step.end_location.lat,
        longitude: step.end_location.lng,
      };
    }
  }

  if (!nextPoint) return;

  const distanceToTurn = getDistance(location, nextPoint);

  // ✅ Use smart zoom based on distance
  const targetZoom = getSmartZoom({
    mph,
    navMode: true,
    distanceToTurn,
  });

  const acc = location.accuracy ?? 999;
  const targetHeading =
    acc > 50
      ? lastCamHeadingRef.current ?? 0
      : chooseHeading(location.speed ?? 0, location.heading, courseRef.current);
  const smoothHeading = stepHeading(lastCamHeadingRef.current, targetHeading, 20);
  lastCamHeadingRef.current = smoothHeading;

  // ✅ Avoid redundant camera updates
  if (lastZoomRef.current !== targetZoom) {
    lastZoomRef.current = targetZoom;

    mapRef.current.animateCamera(
      {
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        zoom: targetZoom,
        pitch: 60,
        heading: smoothHeading,
      },
      { duration: 500 }
    );
  }
}, [location, mph, routes, turnIdx, pauseAutoFollow, navMode]);


useEffect(() => {
  const fetchFuelHistoryAndCalculateMPG = async () => {
    try {
      // Guard: don’t query until we have both IDs
      if (!user?.id || !currentVehicle?.id) {
        setAvgMPG(EPA_MPG);
        setIsMPGEstimated(true);
        return;
      }

      const { data, error } = await supabase
        .from('fuel_log')
        .select('gallons, timestamp, odometer_reading, full_fill, user_id, vehicle_id')
        .eq('user_id', user.id)
        .eq('vehicle_id', currentVehicle.id)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error("Error fetching fuel log:", error);
        setAvgMPG(EPA_MPG);
        setIsMPGEstimated(true);
        return;
      }

      if (data && data.length > 0) {
        const fulls = data
          .map((entry, idx) => ({ ...entry, idx }))
          .filter(entry => entry.full_fill && entry.odometer_reading !== null);

        if (fulls.length < 2) {
          setAvgMPG(EPA_MPG);
          setIsMPGEstimated(true);
          return;
        }

        const last = fulls[fulls.length - 1];
        const prev = fulls[fulls.length - 2];

        let gallons = 0;
        for (let i = prev.idx + 1; i <= last.idx; i++) {
          gallons += data[i].gallons;
        }

        const miles = last.odometer_reading - prev.odometer_reading;
        if (gallons > 0 && miles > 0) {
          setAvgMPG(miles / gallons);
          setIsMPGEstimated(false);
        } else {
          setAvgMPG(EPA_MPG);
          setIsMPGEstimated(true);
        }

        const partialsSinceLastFull = data.slice(last.idx + 1).filter(e => !e.full_fill).length;
        if (partialsSinceLastFull >= 3) {
          Alert.alert(
            "Full Fill-Up Needed",
            "For best MPG accuracy, please fill your tank completely next time."
          );
        }
      } else {
        setAvgMPG(EPA_MPG);
        setIsMPGEstimated(true);
      }
    } catch (e) {
      console.error("Exception during MPG calculation:", e);
      setAvgMPG(EPA_MPG);
      setIsMPGEstimated(true);
    }
  };

  fetchFuelHistoryAndCalculateMPG();
  // keep deps the same as before (don’t add user/vehicle or it will re-run constantly)
}, [fuelGallons]);


  useEffect(() => {
    if (!navMode || !location || !routes.length) {
      if (!navMode && justStoppedNavigation) {
        setCurrentNavInstruction(''); setDistanceToNextTurn(''); setRemainingDistance(0); setRemainingDuration(0); setJustStoppedNavigation(false);
      }
      return;
    }

    if (turnIdx === 0) {
      const activeRoute = routes[activeRouteIdx];
      if (activeRoute?.legs?.[0]?.steps?.length > 0) {
        const step = activeRoute.legs[0].steps[0];
        const cleanInstruction = step.html_instructions.replace(/<(?:.|\n)*?>/gm, '').replace(/&[^;]+;/g, '');
        setCurrentNavInstruction(cleanInstruction);
        if (location) {
          const stepEndLocation = { latitude: step.end_location.lat, longitude: step.end_location.lng };
          const distanceToTurn = getDistance(location, stepEndLocation);
          setDistanceToNextTurn(formatNextTurnDistance(distanceToTurn));
        } else { setDistanceToNextTurn(''); }
        const { miles, minutes } = calcRemaining(activeRoute, turnIdx, location);
        setRemainingDistance(miles); setRemainingDuration(minutes);
      }
    }

    setShowNavModal(true);
    if (navIntervalRef.current) { clearInterval(navIntervalRef.current); }

  navIntervalRef.current = setInterval(() => {
  const activeRoute = routes[activeRouteIdx];
  if (!activeRoute?.legs?.length) return;

  const steps = activeRoute.legs[0].steps || [];
  if (!steps.length) return;

  // Reset if turnIdx is out-of-range (e.g., after a re-route)
  if (turnIdx >= steps.length) { setTurnIdx(0); lastDistRef.current = null; return; }

  const currentStep = steps[turnIdx];
  const stepEnd = { latitude: currentStep.end_location.lat, longitude: currentStep.end_location.lng };
  const d = getDistance(location, stepEnd); // meters

  const text = plainText(currentStep.html_instructions);
  const { miles, minutes } = calcRemaining(activeRoute, turnIdx, location);

  setRemainingDistance(miles);
  setRemainingDuration(minutes);
  setCurrentNavInstruction(text);
  setDistanceToNextTurn(formatNextTurnDistance(d));

  // ---------- Voice + notification phases (edge-triggered) ----------
  const prevD = lastDistRef.current;
  if (prevD != null) {
    // 1 mile callout
 // inside your navInterval setInterval loop:

// 1 mile callout
if (prevD > ONE_MI_M && d <= ONE_MI_M && !stepSpokenRef.current[turnIdx]?.mi1) {
  const line = buildSpokenInstruction(d, text, turnIdx);  // ← use d
  if (voiceOn && soundAlerts) { try { Speech.stop(); } catch {} Speech.speak(line, { language: "en-US" }); }
  if (appStateRef.current !== "active") notifyOnce(turnIdx, "mi1", "Next Turn", line);
  stepSpokenRef.current[turnIdx] = { ...(stepSpokenRef.current[turnIdx]||{}), mi1: true };
}

// 400 feet callout
if (prevD > FOUR_HUND_FT_M && d <= FOUR_HUND_FT_M && !stepSpokenRef.current[turnIdx]?.ft400) {
  const line = buildSpokenInstruction(d, text, turnIdx);  // ← use d, formats to “xxx ft”
  if (voiceOn && soundAlerts) { try { Speech.stop(); } catch {} Speech.speak(line, { language: "en-US" }); }
  if (appStateRef.current !== "active") notifyOnce(turnIdx, "ft400", "Next Turn", line);
  stepSpokenRef.current[turnIdx] = { ...(stepSpokenRef.current[turnIdx]||{}), ft400: true };
}

// "Now" callout (~80 ft)
if (prevD > NOW_FT_M && d <= NOW_FT_M && !stepSpokenRef.current[turnIdx]?.now) {
  const line = buildSpokenInstruction(0, text, turnIdx);  // bare text
  if (voiceOn && soundAlerts) { try { Speech.stop(); } catch {} Speech.speak(line, { language: "en-US" }); }
  if (appStateRef.current !== "active") notifyOnce(turnIdx, "now", "Next Turn", line);
  stepSpokenRef.current[turnIdx] = { ...(stepSpokenRef.current[turnIdx]||{}), now: true };
}

  }

  // ---------- Step advance logic (robust) ----------
  const NEAR_TURN = 40;      // meters (less strict than 25)
  const PASS_WINDOW = 60;    // if we were within 60m and distance starts increasing, consider it passed

  // detect "we've started moving away from the turn" near the junction
  if (prevD != null && prevD < PASS_WINDOW && d > prevD) {
    passJitterRef.current = Math.min(passJitterRef.current + 1, 3);
  } else {
    passJitterRef.current = 0;
  }

  const reached = d < NEAR_TURN || passJitterRef.current >= 2;

  if (reached) {
    if (turnIdx < steps.length - 1) {
      const nextIdx = turnIdx + 1;
      setTurnIdx(nextIdx);
      lastDistRef.current = null;           // reset distance memory for the new step
      stepSpokenRef.current[nextIdx] = {};  // reset spoken flags for the new step
    } else {
      // Destination reached
      try { Speech.stop(); } catch {}
      Alert.alert("Destination Reached!", "You have arrived at your destination.");
      setNavMode(false);
      setDestination(null);
      setRoutes([]);
      setTurnIdx(0);
      lastSpokenInstruction.current = null;
      lastDistRef.current = null;
      stepSpokenRef.current = { };
      setCurrentNavInstruction("");
      setDistanceToNextTurn("");
      setShowNavModal(false);
      if (navIntervalRef.current) { clearInterval(navIntervalRef.current); navIntervalRef.current = null; }
      Notifications.cancelAllScheduledNotificationsAsync();
    }
    return;
  }

  lastDistRef.current = d;
}, 1500);



    return () => { if (navIntervalRef.current) { clearInterval(navIntervalRef.current); navIntervalRef.current = null; } };
  }, [navMode, turnIdx, location, routes, activeRouteIdx, voiceOn]);

  // ===== Handlers & helpers (definitions below are okay; effects run later) =====
  const fitMapToGasStations = useCallback(() => {
    if (!mapRef.current || !location || gasStations.length === 0) return;
    const coords = [...gasStations.map(g => g.location), location];
    safeFitToCoordinates(coords, { edgePadding: { top: 120, bottom: 320, left: 60, right: 60 }, animated: true });
  }, [mapRef, location, gasStations]);



 // keep latest values without triggering re-creations
// keep latest values ...
// Session token for better ranking/billing (new per user search session)
const sessionTokenRef = useRef(null);
function ensureSessionToken() {
  if (!sessionTokenRef.current) sessionTokenRef.current = Math.random().toString(36).slice(2);
}
function resetSessionToken() { sessionTokenRef.current = null; }

// Debounced autocomplete fetch (wider bias, address-first)
const debouncedFetch = React.useMemo(() =>
  debounce(async (input) => {
    try {
      ensureSessionToken();

      const ctx = ctxRef.current;
      const loc = ctx.location;
      const b   = ctx.mapBounds;

      // Prefer rectangle bias if we have bounds; else a generous circle (50km)
      let bias = "";
      if (b && b.northEast && b.southWest) {
        const ne = b.northEast, sw = b.southWest;
        bias = `&locationbias=rectangle:${sw.latitude},${sw.longitude}|${ne.latitude},${ne.longitude}`;
      } else if (loc) {
        bias = `&locationbias=circle:50000@${loc.latitude},${loc.longitude}`; // 50km
      }

      // Ask specifically for addresses and geocodes; no strictbounds here
      const url = `${MAPS_PROXY_BASE}/autocomplete?` +
        `input=${encodeURIComponent(input)}` +
        `&components=country:us` +
        `&types=geocode|address` +
        `&sessiontoken=${sessionTokenRef.current}` +
        bias;

      const res = await fetch(url);
      const json = await res.json();
      setSearchResults(json.predictions || []);
    } catch (e) {
      setSearchResults([]);
    }
    setSearching(false);
  }, 250)
, []);


useEffect(() => () => debouncedFetch.cancel(), [debouncedFetch]);

// ✅ throttle boundary reads so zooming doesn't spam the map
const updateBounds = React.useMemo(() =>
  debounce(async () => {
    if (!mapRef.current) return;
    try { const b = await mapRef.current.getMapBoundaries(); setMapBounds(b); } catch {}
  }, 200)
, []);

 



  useEffect(() => { return () => debouncedFetch.cancel(); }, [debouncedFetch]);

 const searchPlaces = useCallback((text) => {
  const t = (text || "").trim();
  setSearchQuery(t);
  if (t.length < 3) { setSearchResults([]); return; }  // allow “104 N…”
  setSearching(true);
  debouncedFetch(t);
}, [debouncedFetch]);


  const handlePlaceSelect = async (place) => {
  Keyboard.dismiss();
  setSearching(true);
  ensureSessionToken(); // reuse the same session

  const url = `${MAPS_PROXY_BASE}/details?place_id=${place.place_id}&sessiontoken=${sessionTokenRef.current}`;
  const res = await fetch(url);
  const data = await res.json();

  // end the session after the pick (Google’s recommended flow)
  resetSessionToken();

  if (!data.result || !data.result.geometry || !data.result.geometry.location) {
    setSearching(false);
    return;
  }

  const coords = {
    latitude:  data.result.geometry.location.lat,
    longitude: data.result.geometry.location.lng
  };

  if (navMode) {
    setPendingStop({ coords, description: place.description });
    setShowStopPrompt(true);
    setSearching(false);
    return;
  }

  setDestination({ ...coords, title: place.description });
  setWaypoints([]);
  fetchDirections(coords, []);

  setTimeout(() => {
    setSearchBarActive(false);
    setSearchResults([]);
    setSearchQuery('');
    setSearching(false);
  }, 100);
};


 function handleExternalHazard(hazard) {
  if (!location || !mapRef.current) return;
  mapRef.current.animateCamera({ /* ... */ });

  setPauseAutoFollow(true);
  const checkInterval = setInterval(() => {
    if (!ctxRef.current.location) return;
    const dist = getDistance(ctxRef.current.location, hazard);
    if (dist < 1600 && dist >= 800) mapRef.current.animateCamera({ center: ctxRef.current.location, zoom: 12 }, { duration: 900 });
    if (dist < 800 && dist >= 250)  mapRef.current.animateCamera({ center: ctxRef.current.location, zoom: 14 }, { duration: 900 });
    if (dist < 250) { clearInterval(checkInterval); setPauseAutoFollow(false); }
  }, 1000);

  // hard stop after 60s just in case
  setTimeout(() => { try { clearInterval(checkInterval); } catch {} }, 60_000);
}

  function scheduleHazardRemoval(hazard) {
    const created = new Date(hazard.created_at).getTime();
    const now = Date.now();
    const msUntilRemove = Math.max(0, created + 3600000 - now);
    setTimeout(() => { setHazards(hs => hs.filter(hz => hz.id !== hazard.id)); }, msUntilRemove);
  }

  function chunkPolyline(points, chunkDistMeters = 32000) {
    if (points.length < 3) return [];
    let last = points[0]; const waypoints = []; let accumDist = 0;
    for (let i = 1; i < points.length; i++) {
      const dist = getDistance(last, points[i]); accumDist += dist;
      if (accumDist > chunkDistMeters) { waypoints.push(points[i]); last = points[i]; accumDist = 0; }
    }
    return waypoints;
  }

// Fit all current routes (uses safeFitToCoordinates)
const fitAllRoutes = useCallback(() => {
  if (!mapRef.current || !routes?.length) return;
  const coords = routes.flatMap(r => r.points || []);
  if (coords.length < 2) return;
  safeFitToCoordinates(coords, {
    edgePadding: { top: 120, bottom: 340, left: 60, right: 60 },
    animated: true,
  });
}, [routes]);

const fitAllRoutesFrom = (list) => {
  if (!mapRef.current || !list?.length) return;
  const coords = list.flatMap(r => r.points || []);
  if (coords.length < 2) return;
  safeFitToCoordinates(coords, {
    edgePadding: { top: 120, bottom: 340, left: 60, right: 60 },
    animated: true,
  });
};

const fitActiveRoute = (idx = 0) => {
  const r = (routesRef.current || [])[idx];
  if (!mapRef.current || !r?.points?.length) return;
  safeFitToCoordinates(r.points, {
    edgePadding: { top: 120, bottom: 340, left: 60, right: 60 },
    animated: true,
  });
};

// --- NEW: resample + anchor helpers (place above fetchDirections) ---
const EPSILON_M = 10; // ~10m step keeps curves smooth







// ── Quick preview (no snap): fast path for instant UI ───────────────────────────
const buildRouteQuick = (r, i) => buildRoute(r, i, { snap: false });

// ── Windowed snap: snap only the first N meters ahead, then we can extend later ─


   // In map.js, replace your entire fetchDirections function with this one:

const fetchDirections = async (destCoords, stops = [], { silent = false } = {}) => {
  if (!location) return;

  const snappedOrigin = await snapToRoad(location);
  const snappedDest   = await snapToRoad(destCoords);

  const originStr = `${snappedOrigin.latitude},${snappedOrigin.longitude}`;
  const destStr   = `${snappedDest.latitude},${snappedDest.longitude}`;
  const waypointsParam = (stops && stops.length)
    ? `&waypoints=${stops.map(p => `${p.latitude},${p.longitude}`).join("|")}`
    : "";
  const avoidParam = avoidTolls ? "&avoid=tolls" : "";
  const alternativesParam = "&alternatives=true";

  const url =
    `${MAPS_PROXY_BASE}/directions` +
    `?origin=${originStr}` +
    `&destination=${destStr}` +
    waypointsParam +
    avoidParam +
    `&mode=driving` +
    alternativesParam;

  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Google Directions API result:", JSON.stringify(data.routes?.[0]?.summary, null, 2));


    if (!data.routes?.length) {
      if (!silent) {
          Alert.alert("No Routes Found", "Could not find a route to the selected destination.");
      }
      return;
    }

    // --- Start of Simplified Route Processing ---
    const mapped = data.routes.map((route, idx) => {
      // 1. Get all detailed points from each step's polyline
      let fullDetailedPoints = [];
      route.legs?.forEach(leg =>
        leg.steps?.forEach(step =>
          step.polyline?.points &&
            fullDetailedPoints.push(...decodePolyline(step.polyline.points))
        )
      );

      // 2. Fallback to the overview polyline if step data is sparse
      if (fullDetailedPoints.length < 2 && route.overview_polyline?.points) {
        fullDetailedPoints = decodePolyline(route.overview_polyline.points);
      }
      
      return {
        summary:  route.summary || `Route ${idx+1}`,
        distance: (route.legs[0].distance.value / 1609.34).toFixed(1),
        duration: Math.round(route.legs[0].duration.value / 60),
        points:   fullDetailedPoints, // The single, continuous, correctly-snapped polyline
        legs:     pruneLegs(route.legs || []), // Use your existing pruneLegs helper
      };
    });
    // --- End of Simplified Route Processing ---

    if (silent) {
        setRoutes([mapped[0]]);
        setActiveRouteIdx(0);
        return;
    }
      
    setRoutes(mapped);
    setActiveRouteIdx(0);
    setRouteModal(true);
    setPauseAutoFollow(true);
    
    // Fit map to the new routes
    setTimeout(() => {
        fitAllRoutesFrom(mapped);
    }, 300);

  } catch (e) {
    console.error("Error fetching directions:", e);
    if (!silent) {
      Alert.alert("Error", "Failed to fetch directions. Please try again.");
      setRoutes([]);
    }
 
  }
};

  const destinationPoint = (start, distanceM, bearingDeg) => {
    const R = 6371e3; const δ = distanceM / R; const θ = (bearingDeg * Math.PI) / 180; const φ1 = (start.latitude * Math.PI) / 180; const λ1 = (start.longitude * Math.PI) / 180;
    const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1); const sinδ = Math.sin(δ), cosδ = Math.cos(δ);
    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ); const φ2 = Math.asin(sinφ2);
    const y = Math.sin(θ) * sinδ * cosφ1; const x = cosδ - sinφ1 * sinφ2; const λ2 = λ1 + Math.atan2(y, x);
    return { latitude: (φ2 * 180) / Math.PI, longitude: (λ2 * 180) / Math.PI };
  };

  function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; const dLat = ((lat2 - lat1) * Math.PI) / 180; const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
  }

  const reportHazard = async (type) => {
    setPauseAutoFollow(true);
    if (!location) return Alert.alert("Location unavailable");
    const { data, error: authErr } = await supabase.auth.getUser();
    if (authErr || !data?.user) { setPauseAutoFollow(false); return Alert.alert("Error", "Login required to report"); }
    const { data: hazardsData } = await supabase.from("hazards").select("*").eq("type", type).gt("expires_at", new Date().toISOString());
    const NEARBY_METERS = 50; let existingHazard = null;
    if (hazardsData && hazardsData.length) {
      existingHazard = hazardsData.find(h => getDistanceMeters(h.latitude, h.longitude, location.latitude, location.longitude) < NEARBY_METERS);
    }
    if (existingHazard) {
      const { error: upErr } = await supabase.from("hazards").update({
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        confirmations_yes: (existingHazard.confirmations_yes || 1) + 1,
        confirmations_no: 0,
      }).eq("id", existingHazard.id);
      if (!upErr) {
        Alert.alert("Thanks!", "Hazard refreshed and upvoted.");
        setHazards(hs => hs.map(h => h.id === existingHazard.id ? { ...h, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), confirmations_yes: (existingHazard.confirmations_yes || 1) + 1, confirmations_no: 0 } : h));
      }
      setTimeout(() => setPauseAutoFollow(false), 1000); return;
    }
    const { data: inserted, error: insertErr } = await supabase.from("hazards").insert([{ user_id: data.user.id, type, latitude: location.latitude, longitude: location.longitude, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), confirmations_yes: 1, confirmations_no: 0 }]).select().single();
    if (!insertErr) { setHazards(h => [...h, inserted]); Alert.alert("Reported!", "Hazard added to map."); }
    else { Alert.alert("Error", insertErr.message); }
    setTimeout(() => setPauseAutoFollow(false), 1000);
  };

  const handleGallonsInputChange = (val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) { setFuelSlider(Math.min(Math.max(num / TANK_SIZE, 0), 1)); }
    setInputGallons(val);
  };

  const handleFindGas = async (mode = "around") => {
    if (!location) return;
    try {
      let searchCenter = { latitude: location.latitude, longitude: location.longitude };
      let radiusM = 8000;
      if (mode === "ahead") {
        const aheadDistM = 40234; const h = Number(location.heading);
        const bearing = Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0;
        searchCenter = destinationPoint(location, aheadDistM, bearing); radiusM = 8000;
      } else if (mode === "around") { radiusM = 40234; }
      const url = `${MAPS_PROXY_BASE}/nearbysearch?location=${searchCenter.latitude},${searchCenter.longitude}&radius=${Math.min(radiusM, 50000)}&type=gas_station`;
      const res = await fetch(url); const text = await res.text(); if (!text) throw new Error("Empty response");
      const data = JSON.parse(text);
      if (data.results?.length) {
        const gasResults = data.results.map((s) => ({ id: s.place_id, name: s.name, address: s.vicinity, location: { latitude: s.geometry.location.lat, longitude: s.geometry.location.lng }, distance: getDistance(location, { latitude: s.geometry.location.lat, longitude: s.geometry.location.lng }) })).sort((a, b) => a.distance - b.distance);
        setGasStations(gasResults); setGasModal(true); setPauseAutoFollow(true); setTimeout(() => fitMapToGasStations(), 0);
      } else { Alert.alert("No Gas Stations Found", "Could not find any gas stations for this area."); setGasStations([]); }
    } catch (error) {
      console.error("Error finding gas stations:", error); setGasStations([]); Alert.alert("Error", "Failed to find gas stations. Please try again.");
    }
  };

  const handleClearGasPins = () => { setGasStations([]); setGasModal(false); setPauseAutoFollow(false); };

  const removeAllStops = () => {
    setWaypoints([]);
    const active = routes[activeRouteIdx]; if (!active) return;
    setRoutes([active]); setNavMode(true); setShowNavModal(true); setRouteModal(false);
    if (mapRef.current) {
      safeFitToCoordinates(active.points, { edgePadding: { top:120, bottom:220, left:60, right:60 }, animated: true });
    }
  };

  const handleAddFuel = async () => {
  setSaving(true);

  // NEW: treat Full Fill as first-class flow
  if (fullFill) {
    const odom = inputOdometer ? Number(inputOdometer) : null;
    if (!odom) {
      Alert.alert("Odometer Required", "Please enter your odometer when saving a full fill so we can update MPG.");
      setSaving(false);
      return;
    }

    // use typed gallons if present, else auto-calc to fill tank
    let addedGallons = parseFloat(inputGallons);
    if (isNaN(addedGallons) || addedGallons <= 0) {
      addedGallons = Math.max(0, TANK_SIZE - fuelGallons);
    }
    let newLevel = Math.min(TANK_SIZE, fuelGallons + addedGallons);

    const { data: { user: currentUser }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !currentUser) { Alert.alert("Error", "You must be logged in to add fuel."); setSaving(false); return; }
    const vehicleId = currentVehicle?.id;
    if (!vehicleId) { Alert.alert("Error", "Please select a primary vehicle first."); setSaving(false); return; }

    const { error: insertErr } = await supabase.from("fuel_log").insert([{
      user_id: currentUser.id,
      vehicle_id: vehicleId,
      gallons: Number(addedGallons.toFixed(2)),
      timestamp: new Date().toISOString(),
      odometer_reading: odom,
      full_fill: true,
    }]);

    setSaving(false);
    if (insertErr) { Alert.alert("Error", `Failed to save fuel data: ${insertErr.message}`); return; }

    // snap gauge to full
    setFuelGallons(TANK_SIZE);
    setFuelSlider(1); 
    setFullFill(false);
    setLastOdometer(odom);
    setShowFuelModal(false);
    setInputGallons("");
    setInputOdometer("");
    Alert.alert("Fuel Added", `Gauge updated: ${TANK_SIZE.toFixed(2)} gallons (Full).`);
    return;
  }

  // existing partial/calibration paths unchanged below
  const desiredGallons = Number((fuelSlider * TANK_SIZE).toFixed(2));
  const deltaGallons = desiredGallons - fuelGallons;
  const odom = inputOdometer ? Number(inputOdometer) : null;

  if (deltaGallons < 0) {
    if (!odom) { Alert.alert("Enter Odometer Required", "To lower your tank gauge, please enter your odometer reading for calibration."); setSaving(false); return; }
    if (lastOdometer && odom <= lastOdometer) { Alert.alert("Invalid Odometer", `Odometer must be greater than your last recorded value: ${lastOdometer}.`); setSaving(false); return; }
    setFuelGallons(desiredGallons);
    setLastOdometer(odom);
    setShowFuelModal(false);
    setInputGallons("");
    setInputOdometer("");
    await AsyncStorage.setItem("lastCalTs", new Date().toISOString());
    Alert.alert("Gauge Calibrated", `Tank level set to ${desiredGallons.toFixed(2)} gal.`);
    setSaving(false);
    return;
  }

  if (deltaGallons > 0) {
    let addedGallons = parseFloat(inputGallons);
    if (isNaN(addedGallons) || addedGallons <= 0) { Alert.alert("Error", "Gallons added must be a positive number."); setSaving(false); return; }
    let newLevel = Math.min(TANK_SIZE, fuelGallons + addedGallons);
    const autoFull = newLevel >= TANK_SIZE - 0.2;
    const isFull = autoFull; // fullFill handled above

    const { data: { user: currentUser }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !currentUser) { Alert.alert("Error", "You must be logged in to add fuel."); setSaving(false); return; }
    const vehicleId = currentVehicle?.id;
    if (!vehicleId) { Alert.alert("Error", "Please select a primary vehicle first."); setSaving(false); return; }

    const { error: insertErr } = await supabase.from("fuel_log").insert([{
      user_id: currentUser.id,
      vehicle_id: vehicleId,
      gallons: Number(addedGallons.toFixed(2)),
      timestamp: new Date().toISOString(),
      odometer_reading: odom,
      full_fill: isFull,
    }]);

    setSaving(false);
    if (insertErr) { Alert.alert("Error", `Failed to save fuel data: ${insertErr.message}`); return; }

    setFuelGallons(newLevel);
    setLastOdometer(odom);
    setShowFuelModal(false);
    setInputGallons("");
    setInputOdometer("");
    Alert.alert("Fuel Added", `Gauge updated: ${newLevel.toFixed(2)} gallons.`);
    return;
  }

  Alert.alert("No Change", "Your gauge shows the same level as before.");
  setSaving(false);
};

  const startTrip = async () => {
    if (!location) return Alert.alert("Waiting for GPS…");
    tripStartTime.current = new Date().toISOString(); lastTripLoc.current = location; setTripRoute([location]); setTripDistance(0); setTripActive(true);
    tripWatchRef.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Highest, distanceInterval: 1 }, ({ coords }) => {
      const seg = getDistance(lastTripLoc.current, coords) / 1609.34; setTripDistance(d => d + seg); lastTripLoc.current = coords; setTripRoute(rt => [...rt, coords]);
    });
  };

  const stopTrip = async () => {
    if (tripWatchRef.current) { tripWatchRef.current.remove(); tripWatchRef.current = null; }
    setTripActive(false);
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data?.user) { Alert.alert("Error", "You must be logged in to save a trip."); return; }
    const currentUser = data.user;
    try {
      const now = new Date(); const isoNow  = now.toISOString(); const isoDate = isoNow.split("T")[0];
      const { error } = await supabase.from("triplogs").insert([{ user_id:  currentUser.id, date: isoDate, start: tripStartTime.current, end: isoNow, miles: Number(tripDistance.toFixed(2)), distance: Number(tripDistance.toFixed(2)), trip_type: tripPref || "personal", }]);
      if (error) throw error; Alert.alert("Trip saved!", `${tripDistance.toFixed(2)} mi`);
    } catch (e) { console.error("Trip save failed:", e); Alert.alert("Error saving trip", e.message || JSON.stringify(e)); }
  };

  function closeLowFuelModal() {
    setPauseAutoFollow(false);
    setLowFuelModal({ open: false, level: null, secs: 60 });
    if (lowFuelTimerRef.current) { clearInterval(lowFuelTimerRef.current); lowFuelTimerRef.current = null; }
  }
  function openLowFuelModal(level) {
    setPauseAutoFollow(true);
    setLowFuelModal({ open: true, level, secs: 60 });
    if (lowFuelTimerRef.current) clearInterval(lowFuelTimerRef.current);
    lowFuelTimerRef.current = setInterval(() => {
      setLowFuelModal(prev => {
        const next = Math.max(0, prev.secs - 1);
        if (next === 0) { clearInterval(lowFuelTimerRef.current); lowFuelTimerRef.current = null; return { open: false, level: null, secs: 60 }; }
        return { ...prev, secs: next };
      });
    }, 1000);
  }

  // ===== Render =====
  if (!location)
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" />
          <Text>Loading map…</Text>
        </View>
      </TouchableWithoutFeedback>
    );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, backgroundColor: isDark ? "#20232a" : "#fff" }}>
        {/* =========== MAP ============ */}
       

<AnimatedMapView
  ref={mapRef}
  provider={PROVIDER_GOOGLE}
  style={{ flex: 1 }}
  showsUserLocation
  showsBuildings={true}
  pitchEnabled
  rotateEnabled
  customMapStyle={isDark ? darkMapStyle : []}
  initialCamera={{
    center: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    zoom: 14,
    pitch: 60,
    heading: 0,
  }}
  onMapReady={updateBounds}
  onRegionChangeComplete={() => {
    updateBounds(); // Keep your original bounds update

    // Pause auto-follow for 30 seconds when user moves map
    setPauseAutoFollow(true);

    if (manualOverrideTimerRef.current) {
      clearTimeout(manualOverrideTimerRef.current);
    }

    manualOverrideTimerRef.current = setTimeout(() => {
      setPauseAutoFollow(false);
    }, 30 * 1000); // 30 seconds
  }}
>
  {/* Destination Marker */}
  {destination && (<Marker coordinate={destination} title="Destination" />)}

  {/* Routes - THIS IS THE NEW, SIMPLIFIED LOGIC */}
 {routes.map((r, idx) => {
  const isActive = idx === activeRouteIdx;
  if (!r.points || r.points.length === 0) return null;

  const dimColor = isDark ? INACTIVE_ROUTE_COLOR_DARK : INACTIVE_ROUTE_COLOR;

  return (
    <React.Fragment key={`route-wrap-${idx}`}>
      {/* Optional halo so the active route really stands out */}
      {isActive && (
        <Polyline
          key={`route-halo-${idx}`}
          coordinates={r.points}
          strokeWidth={ACTIVE_WIDTH + 3}
          strokeColor="rgba(255,255,255,0.95)"
          zIndex={3}
          geodesic
        />
      )}

      {/* Main route line */}
      <Polyline
        key={`route-main-${idx}`}
        coordinates={r.points}
        strokeWidth={isActive ? ACTIVE_WIDTH : INACTIVE_WIDTH}
        strokeColor={isActive ? ACTIVE_ROUTE_COLOR : dimColor}
        zIndex={isActive ? 4 : 2}
        geodesic
        tappable={!routeModal}
        onPress={() => !routeModal && setActiveRouteIdx(idx)}
      />
    </React.Fragment>
  );
})}


  {/* Hazard Markers */}
  {hazards.map(h => (
    <Marker
      key={h.id}
      coordinate={{ latitude: h.latitude, longitude: h.longitude }}
      title={h.type === "police" ? "Police Spotted" : "Accident Reported"}
      onPress={() => setHazardToConfirm(h)}
    >
      {h.type === "police" ? (
        <Ionicons name="shield-half-outline" size={32} color="#000" />
      ) : (
        <Feather name="alert-triangle" size={32} color="#f1c40f" />
      )}
    </Marker>
  ))}

  {/* Gas Station Markers */}
  {gasStations.map((g) => (
    <Marker
      key={g.id}
      coordinate={g.location}
      title={g.name}
      description={g.address}
      pinColor="#16c657"
      onPress={async () => {
        if (addingStop) return; setAddingStop(true);
        try {
          if (destinationRef.current) {
            const newStops = [...waypointsRef.current, g.location]; setWaypoints(newStops);
            await fetchDirections(destinationRef.current, newStops, { silent: false });
          } else { setDestination(g.location); setWaypoints([]); await fetchDirections(g.location, []); }
          setGasModal(false);
        } catch (e) { console.error(e); Alert.alert("Error", "Failed to update route."); }
        finally { setAddingStop(false); }
      }}
    />
  ))}
</AnimatedMapView>
{DEBUG_ROAD_SNAP && routes[activeRouteIdx]?.debug && (
  <View style={{
    position:'absolute',
    top: 10, left: 10,
    backgroundColor:'rgba(0,0,0,0.6)',
    paddingHorizontal:8, paddingVertical:4,
    borderRadius:8, zIndex: 10000
  }}>
    <Text style={{color:'#fff', fontSize:12}}>
      rawSegs: {routes[activeRouteIdx].debug.rawSegs.length} | snappedSegs: {routes[activeRouteIdx].debug.snappedSegs.length}
    </Text>
  </View>
)}

        {/* ==== FUEL / GAS / SEARCH BAR ==== */}
        <View style={styles.topBarRow}>
          <View style={styles.topLeftCol}>
            <View
              style={[
                styles.dataBlock,
                milesInTank <= 50 ? { backgroundColor: "#e74c3c" } : milesInTank <= 100 ? { backgroundColor: "#FFD600" } : null,
              ]}
            >
              <Text style={styles.dataBlockNum}>{milesInTank}</Text>
              <Text style={styles.dataBlockLabel}>Miles in Tank</Text>
            </View>
            <View style={styles.dataBlock}>
              <Text style={styles.dataBlockNum}>{mph}</Text>
              <Text style={styles.dataBlockLabel}>MPH</Text>
            </View>
            <View style={styles.dataBlock}>
              <Text style={styles.dataBlockNum}>{avgMPG.toFixed(1)}</Text>
              <Text style={styles.dataBlockLabel}>AVG MPG</Text>
            </View>
          </View>

          <View style={styles.topMidCol}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a place"
              placeholderTextColor="#000"
              value={searchQuery}
              onChangeText={searchPlaces}
              autoFocus={false}
              onSubmitEditing={Keyboard.dismiss}
              onFocus={() => setSearchBarActive(true)}
              returnKeyType="search"
            />
            {searchBarActive && searchResults.length > 0 && (
              <View style={styles.resultsBox}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.place_id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.resultItem} onPress={() => handlePlaceSelect(item)}>
                      <Text numberOfLines={2}>{item.description}</Text>
                    </TouchableOpacity>
                  )}
                  keyboardShouldPersistTaps="always"
                />
              </View>
            )}
          </View>

          <View style={styles.topRightCol}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setInputGallons(""); setFuelSlider(fuelGallons / TANK_SIZE); setInputOdometer(''); setShowFuelModal(true);
              }}
            >
              <Text style={styles.actionBtnText}>Add Fuel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, secondsLeft > 0 && styles.findGasCooldownBtn]}
              onPress={() => {
                if (secondsLeft > 0) { setGasCooldownModal(true); }
                else { setLastFindGas(Date.now()); handleFindGas().finally(() => { setTimeout(() => fitMapToGasStations(), 0); }); }
              }}
              disabled={secondsLeft > 0}
            >
              <Text style={styles.actionBtnText}>Find Gas</Text>
              {secondsLeft > 0 && (
                <Text style={styles.cooldownText}>
                  {String(Math.floor(secondsLeft/60)).padStart(2,'0')}: {String(secondsLeft%60).padStart(2,'0')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation Modal */}
        {navMode && showNavModal && (
          <View style={styles.navModalContainer}>
            <View style={styles.navModal}>
              <Text style={styles.navInstructionText}>{currentNavInstruction}</Text>
              <Text style={styles.navInstructionDistance}>{distanceToNextTurn}</Text>

              <View style={[styles.navInfoRow, { justifyContent: 'space-around' }]}>
                <View style={styles.navInfoBlock}>
                  <Text style={styles.navInfoValue}>{remainingDistance.toFixed(1)}</Text>
                  <Text style={styles.navInfoLabel}>Miles Left</Text>
                </View>

                {waypoints.length > 0 && (
                  <TouchableOpacity style={[styles.cancelNavButton, { backgroundColor: '#555' }]} onPress={removeAllStops}>
                    <Text style={styles.cancelNavButtonText}>Remove Stop</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.cancelNavButton}
                  onPress={() => {
                   Alert.alert("Stop Navigation", "Are you sure?", [
  { text: "No", style: "cancel" },
  { text: "Yes", onPress: async () => {
      try { Speech.stop(); } catch {}
      setJustStoppedNavigation(true); setNavMode(false); setDestination(null); setRoutes([]); setTurnIdx(0);
      lastSpokenInstruction.current = null; setCurrentNavInstruction(''); setDistanceToNextTurn(''); setShowNavModal(false);
      if (mapRef.current && location) { mapRef.current.animateCamera({ center: location, zoom: 14 }); }
      if (navIntervalRef.current) { clearInterval(navIntervalRef.current); navIntervalRef.current = null; }
      await Notifications.cancelAllScheduledNotificationsAsync();
    } }
]);

                  }}
                >
                  <Text style={styles.cancelNavButtonText}>Cancel</Text>
                </TouchableOpacity>

                <View style={styles.navInfoBlock}>
                  <Text style={styles.navInfoValue}>{formatEta(remainingDuration)}</Text>
                  <Text style={styles.navInfoLabel}>ETA</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Recenter Button */}
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() => { setPauseAutoFollow(false); if (mapRef.current && location) { mapRef.current.animateCamera({ center: location, zoom: 16 }); } }}
        >
          <Ionicons name="locate" size={26} color="#fff" />
        </TouchableOpacity>

        {/* CLEAR GAS PINS BUTTON */}
        {gasStations.length > 0 && (
          <TouchableOpacity style={styles.clearGasBtn} onPress={handleClearGasPins}>
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Clear Gas Pins</Text>
          </TouchableOpacity>
        )}

        {lowFuelModal.open && (
          <View style={styles.modalBackdrop}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 18, width: "90%", alignItems: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "bold", color: lowFuelModal.level === 50 ? "#e74c3c" : "#FFD600" }}>
                {lowFuelModal.level === 50 ? "Critical Fuel Level" : "Low Fuel"}
              </Text>
              <Text style={{ marginTop: 8, fontSize: 15, textAlign: "center", color: "#333" }}>
                {lowFuelModal.level === 50
                  ? "Only ~50 miles remain in your tank. We recommend stopping for fuel soon."
                  : "Approximately 100 miles remain in your tank. Consider planning a fuel stop ahead."}
              </Text>
              <Text style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Auto-closing in {lowFuelModal.secs}s</Text>
              <View style={{ flexDirection: "row", marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.fuelAddBtn, { marginRight: 10 }]}
                  onPress={() => {
                    setLastFindGas(Date.now()); closeLowFuelModal();
                    if (lowFuelModal.level === 100) { handleFindGas("ahead"); } else { handleFindGas("around"); }
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Show Gas Stations</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fuelCancelBtn} onPress={closeLowFuelModal}>
                  <Text style={{ color: "#3578e5", fontWeight: "bold" }}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ==== FUEL MODAL ==== */}
        {showFuelModal && (
          <View style={styles.modalBackdrop}>
            <View style={styles.fuelModal}>
              <Text style={styles.modalTitle}>Add Fuel</Text>
              <Text style={styles.modalSub}>Enter gallons or use the slider to update your fuel level.</Text>

              <View style={styles.fuelInputContainer}>
                <TextInput
                  style={styles.gallonsInput}
                  keyboardType="numeric"
                  value={inputGallons}
                  onChangeText={handleGallonsInputChange}
                  placeholder="Gallons"
                  maxLength={5}
                />
                <Text style={styles.gallonsLabel}>Gallons (max {TANK_SIZE})</Text>
              </View>

              <Text style={{ fontSize: 16, color: '#888', marginTop: 2, marginBottom: 5 }}>Tank Level Before Fill: {fuelGallons.toFixed(2)} gal</Text>

              <Text style={{ textAlign: "center", marginVertical: 8 }}>
                {`${Math.round(fuelSlider * 100)}% full — ${Number((fuelSlider * TANK_SIZE).toFixed(2))} gallons (~${Math.round(fuelSlider * TANK_SIZE * avgMPG)} miles)`}
              </Text>

              {inputGallons !== "" && !isNaN(parseFloat(inputGallons)) && (
                <Text style={{ fontSize: 16, color: '#3578e5', marginBottom: 5 }}>
                  Tank Level After Fill: {(Math.min(fuelGallons + parseFloat(inputGallons), TANK_SIZE)).toFixed(2)} gal
                </Text>
              )}

              <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 14 }}>
                <Text>E</Text><Text>¼</Text><Text>½</Text><Text>¾</Text><Text>F</Text>
              </View>

              <Slider
                value={fuelSlider}
                onValueChange={normalized => {
                  const desired = normalized * TANK_SIZE;
                  if (desired < fuelGallons && !inputOdometer) {
                    return Alert.alert("Enter Odometer Required", "To lower your gauge you must supply an odometer reading .");
                  }
                  setFuelSlider(normalized);
                }}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                style={{ width: "100%", marginTop: 8 }}
                minimumTrackTintColor="#3578e5"
                maximumTrackTintColor="#b3d0f8"
                thumbTintColor="#3578e5"
              />

              <Text style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 3 }}>
                {"To lower your tank, enter your odometer for calibration.\nGallons input is only required if you're adding fuel."}
              </Text>

              <View style={styles.fuelInputContainer}>
                <TextInput
                  style={styles.gallonsInput}
                  keyboardType="numeric"
                  value={inputOdometer}
                  onChangeText={setInputOdometer}
                />
                <Text style={styles.gallonsLabel}>Odometer (Optional)</Text>
              </View>
              <Text style={styles.odometerHint}>Enter odometer for more accurate MPG tracking.</Text>

              <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 10 }}>
                <Switch
  value={fullFill}
  onValueChange={(v) => {
    setFullFill(v);
    if (v) {
      // snap UI to full & prefill gallons with the diff-to-full
      setFuelSlider(1);
      setInputGallons((Math.max(0, TANK_SIZE - fuelGallons)).toFixed(2));
    }
  }}
/>

                <Text style={{ marginLeft: 10 }}>Full Fill-Up (Tanked to Full)</Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 8 }}>
                <TouchableOpacity style={styles.fuelCancelBtn} onPress={() => { setInputGallons(""); setFuelSlider(fuelGallons / TANK_SIZE); setInputOdometer(''); setShowFuelModal(false); }}>
                  <Text style={{ color: "#3578e5" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.learnMoreBtn} onPress={() => Alert.alert("Why update fuel?", "To calibrate your tank to match your car's fuel gauge, just enter your odometer and set the slider to match your real tank level. This will re-calibrate your app and make MPG tracking accurate. You only need to enter gallons if you're actually adding fuel. Updating your fuel level keeps your miles in tank accurate, helps track real MPG, and will auto-alert you for gas! Partial fills are OK. For best accuracy, update after each fill-up.") }>
                  <Text style={{ color: "#3578e5" }}>Learn More</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fuelAddBtn} onPress={handleAddFuel}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Add Fuel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ==== GAS STATION LIST (Bottom Sheet) ==== */}
        {gasModal && (
          <View style={styles.gasSheetContainer} pointerEvents="box-none">
            <View style={styles.gasSheet} pointerEvents="auto">
              <Text style={styles.modalTitle}>Nearby Gas Stations</Text>
              <FlatList
                data={gasStations}
                keyExtractor={(item) => item.id || item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gasStationItem}
                    onPress={async () => {
                      if (addingStop) return; setAddingStop(true);
                      try {
                        if (destinationRef.current) {
                          const newStops = [...waypointsRef.current, item.location]; setWaypoints(newStops);
                          await fetchDirections(destinationRef.current, newStops, { silent: false });
                        } else { setDestination(item.location); setWaypoints([]); await fetchDirections(item.location, []); }
                        setGasModal(false);
                      } catch (e) { console.error(e); Alert.alert("Error", "Failed to update route."); }
                      finally { setAddingStop(false); }
                    }}
                  >
                    <Text style={styles.gasStationTitle}>{item.name}</Text>
                    <Text style={styles.gasStationAddr}>{item.address}</Text>
                    <Text style={styles.gasStationDist}>{(item.distance / 1609.34).toFixed(1)} miles away</Text>
                  </TouchableOpacity>
                )}
                style={{ width: "100%" }}
              />
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setGasModal(false); setPauseAutoFollow(false); }}>
                <Text style={{ color: "#3578e5" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 8 }]} onPress={fitMapToGasStations}>
                <Text style={{ color: "#3578e5" }}>Fit to Pins</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== ROUTE MODAL ===== */}
        {routeModal && routes.length > 0 && (
          <View style={styles.routeModalContainer}>
            <View style={styles.routeModal}>
              <Text style={styles.routeModalTitle}>Select a Route</Text>
              <FlatList
                data={routes}
                keyExtractor={(_, idx) => "route" + idx}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
  style={[styles.routeOption, activeRouteIdx === index && styles.routeOptionActive]}
  onPress={() => {
    setActiveRouteIdx(index);
    setTimeout(() => fitActiveRoute(index), 0);
  }}
>
                    <Text style={styles.routeOptionTitle}>{item.summary}</Text>
                    <Text style={styles.routeOptionText}>{parseFloat(item.distance).toFixed(1)} miles, {formatEta(item.duration)}</Text>
                  </TouchableOpacity>
                )}
                style={{ marginBottom: 8, maxHeight: screen.height * 0.35, width: "100%" }}
                contentContainerStyle={{ paddingHorizontal: 10 }}
              />
              <View style={styles.routeModalBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRouteModal(false); setRoutes([]); setDestination(null); setPauseAutoFollow(false); }}>
                  <Text style={{ color: "#3578e5" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.startNavBtn}
                 onPress={() => {
  const i = activeRouteIdx;
  const chosenRoute = routes[i];  // use the decoded route as-is

  setRoutes([chosenRoute]);
  setRouteModal(false);
  setNavMode(true);
  setTurnIdx(0);
  lastSpokenInstruction.current = null;
  setShowNavModal(true);
  setPauseAutoFollow(false);

  const activeRoute = chosenRoute;
  if (activeRoute?.legs?.[0]?.steps?.length > 0) {
    const step = activeRoute.legs[0].steps[0];
    const cleanInstruction = step.html_instructions.replace(/<(?:.|\n)*?>/gm, "").replace(/&[^;]+;/g, "");
    setCurrentNavInstruction(cleanInstruction);

    if (location && step?.end_location) {
      const stepEndLocation = { latitude: step.end_location.lat, longitude: step.end_location.lng };
      const distanceToTurn = getDistance(location, stepEndLocation);
      setDistanceToNextTurn(formatNextTurnDistance(distanceToTurn));
    } else {
      setDistanceToNextTurn("");
    }

    const { miles, minutes } = calcRemaining(activeRoute, 0, location);
    setRemainingDistance(miles);
    setRemainingDuration(minutes);
  }

  if (mapRef.current && location) {
    mapRef.current.animateCamera({ center: location, zoom: 14 });
  }
}}

                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Start Navigation</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ===== BOTTOM BAR ===== */}
        <View style={styles.bottomBar}>
          {tripActive ? (
            <TouchableOpacity style={styles.bottomBarBtn} onPress={stopTrip}>
              <Text style={{ color: "#e74c3c", fontWeight: "bold", marginTop: 10 }}>Stop Trip</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.bottomBarBtn} onPress={startTrip}>
              <Text style={{ color: "#3578e5", fontWeight: "bold", marginTop: 10 }}>Start Trip</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomBarBtn}>
            <Text style={{ marginTop: -6 }}></Text>
            <Text>{tripActive ? `${tripDistance.toFixed(2)} mi` : ""}</Text>
          </View>

          <TouchableOpacity style={styles.bottomBarBtn} onPress={() => reportHazard("police")}>
            <Ionicons name="shield-half-outline" size={22} color="#3578e5" />
            <Text>Police</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomBarBtn} onPress={() => reportHazard("accident")}>
            <Ionicons name="warning-outline" size={22} color="#3578e5" />
            <Text>Accident</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomBarBtn} onPress={() => setIsDark(v => !v)}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color="#3578e5" />
            <Text>{isDark ? "Light" : "Dark"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomBarBtn} onPress={() => setVoiceOn(v => !v)}>
            <Ionicons name={voiceOn ? "volume-high-outline" : "volume-mute-outline"} size={22} color="#3578e5" />
            <Text>{voiceOn ? "Voice" : "Silent"}</Text>
          </TouchableOpacity>
        </View>

        {gasCooldownModal && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,20,30,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 30, alignItems: 'center', elevation: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#3578e5', marginBottom: 12 }}>Please Wait</Text>
              <Text style={{ fontSize: 17, marginBottom: 10 }}>You can search for gas stations again in:</Text>
              <Text style={{ fontSize: 38, fontWeight: 'bold', color: '#e74c3c', marginBottom: 14 }}>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </Text>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#3578e5', borderRadius: 12 }} onPress={() => setGasCooldownModal(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showStopPrompt && pendingStop && (
          <View style={styles.modalBackdrop}>
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", width: "96%" }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>Already Navigating</Text>
              <Text style={{ fontSize: 15, textAlign: "center" }}>Would you like to add "{pendingStop.description}" as a stop on your current route, or cancel navigation and start a new route?</Text>
              <View style={{ flexDirection: "row", marginTop: 20 }}>
                <TouchableOpacity style={[styles.fuelAddBtn, { marginRight: 10 }]} onPress={async () => {
                  if (addingStop) return; setAddingStop(true);
                  try {
                    const newStops = [...waypointsRef.current, pendingStop.coords]; setWaypoints(newStops);
                    await fetchDirections(destinationRef.current, newStops, { silent: false });
                    setShowStopPrompt(false); setPendingStop(null); setSearchBarActive(false); setSearchResults([]); setSearchQuery(""); setSearching(false); Keyboard.dismiss();
                  } catch (e) { console.error(e); Alert.alert("Error", "Failed to add stop."); }
                  finally { setAddingStop(false); }
                }}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Add as Stop</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.fuelCancelBtn, { marginRight: 10 }]} onPress={() => { setShowStopPrompt(false); setPendingStop(null); }}>
                  <Text style={{ color: "#3578e5" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.fuelAddBtn, { backgroundColor: "#e74c3c" }]} onPress={() => {
                  setDestination({ ...pendingStop.coords, title: pendingStop.description }); setWaypoints([]); fetchDirections(pendingStop.coords, []);
                  setNavMode(false); setShowStopPrompt(false); setPendingStop(null); setSearchBarActive(false); setSearchResults([]); setSearchQuery(''); setSearching(false); Keyboard.dismiss();
                }}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Replace Route</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {hazardToConfirm && (
          <View style={styles.modalBackdrop}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20, alignItems: "center", width: "86%" }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>
                {hazardToConfirm.type === "police" ? "Police Still There?" : "Accident Still Here?"}
              </Text>
              <Text style={{ fontSize: 15, textAlign: "center", marginBottom: 12 }}></Text>
              <View style={{ flexDirection: "row", marginTop: -20 }}>
                <TouchableOpacity
                  style={[styles.fuelAddBtn, { marginRight: 14 }]}
                  onPress={async () => {
                    setConfirming(true);
                    const { error } = await supabase.from("hazards").update({ confirmations_yes: (hazardToConfirm.confirmations_yes || 1) + 1, confirmations_no: 0, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), }).eq("id", hazardToConfirm.id);
                    if (!error) {
                      setHazards(hz => hz.map(h => h.id === hazardToConfirm.id ? { ...h, confirmations_yes: (h.confirmations_yes || 1) + 1, confirmations_no: 0, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() } : h));
                    }
                    setHazardToConfirm(null); setConfirming(false);
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fuelAddBtn, { backgroundColor: "#e74c3c" }]}
                  onPress={async () => {
                    setConfirming(true);
                    const newNo = (hazardToConfirm.confirmations_no || 0) + 1;
                    if (newNo >= 2) { await supabase.from("hazards").delete().eq("id", hazardToConfirm.id); setHazards(hz => hz.filter(h => h.id !== hazardToConfirm.id)); }
                    else { await supabase.from("hazards").update({ confirmations_no: newNo }).eq("id", hazardToConfirm.id); setHazards(hz => hz.map(h => h.id === hazardToConfirm.id ? { ...h, confirmations_no: newNo } : h)); }
                    setHazardToConfirm(null); setConfirming(false);
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>No</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 18 }]} onPress={() => setHazardToConfirm(null)} disabled={confirming}>
                <Text style={{ color: "#3578e5", fontWeight: "bold" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
    </TouchableWithoutFeedback>
  );
}

// --- Map Styles and Stylesheet ---
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#22262b" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#c7c9ce" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#22262b" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#373b41" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#bbbbbb" }] },
  { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [{ "color": "#23272e" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#181b20" }] },
  { "featureType": "road", "elementType": "all", "stylers": [{ "visibility": "on" }] },
  { "featureType": "all", "elementType": "labels", "stylers": [{ "visibility": "on" }] }
];

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  topBarRow: { position: "absolute", top: Platform.OS === 'ios' ? 70 : 40, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", zIndex: 10, paddingHorizontal: 7, width: "100%" },
  topLeftCol: { flexDirection: "column", alignItems: "flex-start", marginLeft: 3, gap: 5, flex: 0.28 },
  dataBlock: { width: 98, height: 37, borderRadius: 13, backgroundColor: "#3578e5", marginBottom: 7, alignItems: "center", justifyContent: "center", paddingVertical: 1, paddingHorizontal: 2 },
  dataBlockNum: { color: "#fff", fontWeight: "bold", fontSize: 18, lineHeight: 20 },
  dataBlockLabel: { color: "#fff", fontSize: 10, marginTop: -1, fontWeight: "400" },
  topMidCol: { flex: 0.36, alignItems: "center", justifyContent: "center", marginHorizontal: 8, minWidth: 140, maxWidth: 220 },
  searchInput: { fontSize: 19, backgroundColor: "#fff", borderRadius: 13, padding: 8, width: "90%", borderWidth: 1, borderColor: "#e6e6e6", textAlign: "center", marginBottom: 3, shadowColor: "#222", shadowOpacity: 0.11, shadowRadius: 10, elevation: 5, color: "#000" },
  resultsBox: { marginTop: 8, maxHeight: 190, backgroundColor: "#fff", borderRadius: 8, elevation: 3, shadowColor: "#111", shadowOpacity: 0.15, shadowRadius: 7, width: "100%" },
  resultItem: { padding: 12, borderBottomWidth: 0.5, borderColor: "#eee" },
  findGasCooldownBtn: { backgroundColor: "#999" },
  cooldownText: { color: "#fff", fontSize: 12, marginTop: 2, textAlign: "center" },
  topRightCol: { flexDirection: "column", alignItems: "flex-end", justifyContent: "center", marginRight: 1, gap: 7, flex: 0.28 },
  actionBtn: { width: 98, height: 37, borderRadius: 13, backgroundColor: "#3578e5", alignItems: "center", justifyContent: "center", marginBottom: 7 },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  removeStopBtn: { backgroundColor: "#444", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  removeStopBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  navModalContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 80 : 70, left: 0, right: 0, alignItems: 'center', zIndex: 15 },
  navModal: { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 18, padding: 15, width: '90%', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, alignItems: 'center' },
  navInfoRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 10, alignItems: 'center' },
  navInfoBlock: { alignItems: 'center', flex: 1 },
  navInfoValue: { fontSize: 18, fontWeight: 'bold', color: '#3578e5' },
  navInfoLabel: { fontSize: 12, color: '#555' },
  cancelNavButton: { backgroundColor: '#e74c3c', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 12, marginHorizontal: 10 },
  cancelNavButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  navInstructionText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#333', marginBottom: 5 },
  navInstructionDistance: { fontSize: 16, color: '#555', marginBottom: 5 },
  recenterBtn: { position: "absolute", right: 21, top: 175, backgroundColor: "#3578e5", borderRadius: 50, width: 46, height: 46, justifyContent: "center", alignItems: "center", elevation: 10, shadowColor: "#111", shadowOpacity: 0.14, shadowRadius: 9, zIndex: 9999 },
  clearGasBtn: { position: "absolute", right: 10, top: 225, backgroundColor: "#e74c3c", borderRadius: 14, paddingVertical: 9, paddingHorizontal: 15, zIndex: 12, elevation: 7 },
  modalBackdrop: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(20,22,31,0.32)", alignItems: "center", justifyContent: "center", zIndex: 22 },
  fuelModal: { backgroundColor: "#fff", borderRadius: 22, width: screen.width * 0.93, padding: 18, alignItems: "center", elevation: 8 },
  modalTitle: { fontWeight: "bold", fontSize: 22, color: "#3578e5", alignSelf: "center", marginBottom: 6 },
  modalSub: { color: "#223", textAlign: "center", fontSize: 15, marginBottom: 6 },
  fuelInputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  gallonsInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, width: 100, textAlign: 'center', fontSize: 16, marginRight: 10 },
  avoidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8, paddingHorizontal: 12 },
  avoidLabel: { fontSize: 16, fontWeight: '500' },
  gallonsLabel: { fontSize: 16, color: '#444' },
  odometerHint: { fontSize: 12, color: '#666', marginTop: -5, marginBottom: 10, textAlign: 'center' },
  fuelAddBtn: { backgroundColor: "#3578e5", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 14, marginLeft: 6 },
  fuelCancelBtn: { backgroundColor: "#eef2f7", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 14 },
  learnMoreBtn: { backgroundColor: "#eef2f7", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 14, marginHorizontal: 6 },
  gasSheetContainer: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 60 },
  gasSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, width: "100%", padding: 18, maxHeight: screen.height * 0.5, alignSelf: "center", elevation: 10, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10 },
  gasStationItem: { padding: 12, borderBottomWidth: 0.5, borderColor: "#eee" },
  gasStationTitle: { fontWeight: "bold", fontSize: 16, color: "#3578e5" },
  gasStationAddr: { color: "#444", fontSize: 15, marginBottom: 2 },
  gasStationDist: { color: "#222", fontSize: 13, marginBottom: 2 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 18, marginTop: 12, borderRadius: 14, backgroundColor: "#eef2f7" },
  routeModalContainer: { position: "absolute", left: 0, right: 0, bottom: 40, zIndex: 20, pointerEvents: "box-none", alignItems: "center" },
  routeModal: { backgroundColor: "#fff", borderRadius: 24, width: screen.width * 0.9, padding: 15, elevation: 6, alignItems: "center", marginBottom: 10, maxHeight: screen.height * 0.5 },
  routeModalTitle: { fontWeight: "bold", fontSize: 20, marginBottom: 12, color: "#3578e5", alignSelf: "center" },
  routeOption: { backgroundColor: "#f3f4fa", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginVertical: 4, width: "100%" },
  routeOptionActive: { backgroundColor: "#3578e522", borderWidth: 2, borderColor: "#3578e5" },
  routeOptionTitle: { fontWeight: "bold", fontSize: 14, textAlign: "center" },
  routeOptionText: { fontSize: 12, textAlign: "center" },
  routeModalBtnRow: { flexDirection: "row", marginTop: 16, justifyContent: "space-around", width: "100%" },
  startNavBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 14, marginTop: 12, width: 200, alignItems: "center", backgroundColor: "#3578e5" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, elevation: 12, shadowColor: "#111", shadowOpacity: 0.12, shadowRadius: 8, zIndex: 50 },
  bottomBarBtn: { alignItems: "center", flex: 1 },
});