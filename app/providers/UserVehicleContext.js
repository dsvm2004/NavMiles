// app/providers/UserVehicleContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Alert } from "react-native";
import { supabase } from "../../lib/supabaseClient";

// 1. Export the context (so you can import it in any file)
export const UserVehicleContext = createContext();

export function UserVehicleProvider({ children }) {
  const [currentVehicle, setCurrentVehicle] = useState(null); // { id, mpg, tank_size, ... }
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // 1. On mount, get logged-in user and fetch their primary vehicle
  useEffect(() => {
    async function fetchUserAndVehicle() {
      setLoading(true);
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        setUser(u);
        if (u) {
          const { data, error } = await supabase
            .from('UserVehicles')
            .select('*')
            .eq('user_id', u.id)
            .eq('is_primary', true)
            .maybeSingle();
          if (error) throw error;
          setCurrentVehicle(data);
        }
      } catch (e) {
        Alert.alert("Vehicle Error", e.message);
        setCurrentVehicle(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUserAndVehicle();
  }, []);

  // 2. Method to manually refresh vehicle data
  const refreshVehicle = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('UserVehicles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle();
      if (error) throw error;
      setCurrentVehicle(data);
    } catch (e) {
      Alert.alert("Vehicle Error", e.message);
      setCurrentVehicle(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 3. Method to set a new primary vehicle
  const setPrimaryVehicle = useCallback(async (vehicleId) => {
    if (!user || !vehicleId) return;
    setLoading(true);
    try {
      // 1. Set all user's vehicles to is_primary: false
      await supabase
        .from('UserVehicles')
        .update({ is_primary: false })
        .eq('user_id', user.id);

      // 2. Set the selected vehicle to is_primary: true
      await supabase
        .from('UserVehicles')
        .update({ is_primary: true })
        .eq('id', vehicleId);

      // 3. Fetch the new vehicle and update context
      await refreshVehicle();
    } catch (e) {
      Alert.alert("Vehicle Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [user, refreshVehicle]);

  return (
    <UserVehicleContext.Provider value={{
      currentVehicle,
      loading,
      refreshVehicle,
      setPrimaryVehicle,
      // Optional: make mpg/tankSize easy to access
      mpg: currentVehicle?.mpg ?? 25,
      tankSize: currentVehicle?.tank_size ?? 12,
      selectedVehicleId: currentVehicle?.id ?? null,
      vehicleLoading: loading,
    }}>
      {children}
    </UserVehicleContext.Provider>
  );
}

// Custom hook to use in any screen/component
export function useUserVehicle() {
  return useContext(UserVehicleContext);
}
export default UserVehicleProvider;