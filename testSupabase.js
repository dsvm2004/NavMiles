import { supabase } from './lib/supabaseClient.js';

async function testConnection() {
  const { data, error } = await supabase.from('test').select('*');
  if (error) {
    console.log('❌ Connection failed:', error.message);
  } else {
    console.log('✅ Connection successful! Data:', data);
  }
}

testConnection();
