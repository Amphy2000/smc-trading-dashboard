import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://crvmktuwdamkavssrysv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm1rdHV3ZGFta2F2c3NyeXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NDU0MTUsImV4cCI6MjEwNjAyMTQxNX0.yAWaQENxqy_rFIDzqQ3IoRiGcos_vVikxAY0qSqtd68';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
