// Supabase Client - Replace with your credentials
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm'

const SUPABASE_URL = 'https://jslokkvxxplqpwltbtmp.supabase.co'  // TODO: Replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbG9ra3Z4eHBscXB3bHRidG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTc1MjAsImV4cCI6MjA5MTczMzUyMH0.wubbQ3pxKUjDztkKlQmyqy7enOCrDZkTjvT74chinbk'  // TODO: Replace your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Helper: Get current user with profile
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  // Get extended profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
    
  return { ...user, ...profile, user_metadata: user.user_metadata }
}

// Helper: Get IP address
export async function getIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json()
    return data.ip
  } catch {
    return 'unknown'
  }
}
