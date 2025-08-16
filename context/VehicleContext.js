import React, { createContext, useContext, useState } from "react";

const VehicleContext = createContext(null);

export const VehicleProvider = ({ children }) => {
  const [vehicle, setVehicle] = useState(null);
  return (
    <VehicleContext.Provider value={{ vehicle, setVehicle }}>
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicle = () => useContext(VehicleContext);
