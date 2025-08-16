// firebaseConfig.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCth3Xv171TXuK5Q-jzi--O-HyzR4r9NM",
  authDomain: "navfuel-aeb33.firebaseapp.com",
  projectId: "navfuel-aeb33",
  storageBucket: "navfuel-aeb33.appspot.com",
  messagingSenderId: "535145669388",
  appId: "1:535145669388:web:acc657f46d25f8ad961f29",
  measurementId: "G-1R4S8YJTWN"
};

// Ensure app is initialized once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Ensure Auth is initialized with AsyncStorage
let auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export { app, auth };
