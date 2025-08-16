// App.js
import "expo-router/entry";
import { supabase } from "./lib/supabaseClient";


const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // Check if a user is logged in (on app load & on any change)
  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecking(false);
    });
    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => { listener?.subscription.unsubscribe(); };
  }, []);

  if (checking) return null; // Show splash/loading here if you want

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          // Main app screens
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="TripLog" component={TripLogScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          // If not logged in, only show Login
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
