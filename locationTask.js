// locationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Add this import

const LOCATION_TASK = "background-location-task";

// Register the task
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => { // Make the task async
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      // Retrieve navMode from AsyncStorage
      let navMode = false;
      try {
        const storedNavMode = await AsyncStorage.getItem('navMode');
        if (storedNavMode !== null) {
          navMode = JSON.parse(storedNavMode);
        }
      } catch (e) {
        console.error('Failed to read navMode from AsyncStorage in background task', e);
      }

      // Only send notification if navigation mode is active
      if (navMode) { // Add this condition!
        // You can add your logic for next turn detection here!
        Notifications.scheduleNotificationAsync({
          content: {
            title: "NavMiles Update",
            body: "You have a turn or navigation update!",
            sound: true,
          },
          trigger: null, // Immediately
        });
      }
    }
  }
});

export { LOCATION_TASK };