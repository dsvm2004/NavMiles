// supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://weqzucvyfjydhgvahuag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcXp1Y3Z5Zmp5ZGhndmFodWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwODk3NjksImV4cCI6MjA2NzY2NTc2OX0.t0nGmoVviaJD6Lbku2XFPshhayjK8zpLRPQtFRMeVUQ';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
