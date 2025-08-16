// app/_layout.js
import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SettingsProvider, useSettings } from '../providers/SettingsContext';
import { UserVehicleProvider }   from '../providers/UserVehicleContext';
import { TripLogProvider }       from '../providers/TripLogProvider';

function ThemedWrapper({ children }) {
  const { currentTheme } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.bg }}>
      {children}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <SettingsProvider>
      <UserVehicleProvider>
        <TripLogProvider>
          <InnerTabs />
        </TripLogProvider>
      </UserVehicleProvider>
    </SettingsProvider>
  );
}

function InnerTabs() {
  const { currentTheme } = useSettings();

  return (
    <ThemedWrapper>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor:   currentTheme.primary,
          tabBarInactiveTintColor: currentTheme.muted,
          tabBarStyle: {
            backgroundColor: currentTheme.card,
            borderTopColor:  currentTheme.accent + '22',
            height: 60,
            paddingBottom: 6,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            marginTop: -2,
          },
          tabBarIcon: ({ color, size }) => {
            let name;
            switch (route.name) {
              case 'index':   name = 'home-outline';  break;
              case 'map':     name = 'map-outline';   break;
              case 'triplog': name = 'time-outline';  break;
              case 'garage':name = 'car-sport-outline'; break;
              case 'settings':name = 'settings-outline'; break;
              case 'UpgradeScreen':name = 'star-outline'; break;
              default:        name = 'ellipse-outline';
            }
            return <Ionicons name={name} size={size} color={color} />;
          },
        })}
      >
          <Tabs.Screen name="map"     options={{ title: 'Map' }} />
        <Tabs.Screen name="triplog" options={{ title: 'Logs'  }} />
        <Tabs.Screen name="garage" options={{ title: 'Garage'  }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings'  }} />
        <Tabs.Screen name="UpgradeScreen" options={{ title: 'Upgrade'  }} />
        
      </Tabs>
    </ThemedWrapper>
  );
}
