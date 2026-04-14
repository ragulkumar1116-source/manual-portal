import { supabase } from './supabase.js'

export async function getManuals(filters = {}) {
  let query = supabase
    .from('manuals')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
  
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  
  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`)
  }
  
  const { data, error } = await query.limit(50)
  if (error) {
    console.error('Error fetching manuals:', error)
    return { manuals: [] }
  }
  return { manuals: data || [] }
}

export async function getManual(id) {
  const { data, error } = await supabase
    .from('manuals')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Error fetching manual:', error)
    return null
  }
  
  // Increment view count
  await supabase.rpc('increment_manual_view', { manual_uuid: id })
  
  return data
}

export async function getRecentActivity(userId, limitCount = 10) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limitCount)
  
  if (error) {
    console.error('Error fetching activity:', error)
    return []
  }
  return data || []
}

export async function getUserStats(userId) {
  // Get user profile stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('download_count, view_count')
    .eq('id', userId)
    .single()
  
  // Get total manuals count
  const { count } = await supabase
    .from('manuals')
    .select('*', { count: 'exact', head: true })
  
  return {
    downloads: profile?.download_count || 0,
    views: profile?.view_count || 0,
    totalManuals: count || 0
  }
}

export async function getActivityLogs(filters = {}) {
  let query = supabase
    .from('activity_logs')
    .select('*, profiles(full_name, phone)')
    .order('timestamp', { ascending: false })
    .limit(100)
  
  if (filters.userId) {
    query = query.eq('user_id', filters.userId)
  }
  
  if (filters.action) {
    query = query.eq('action_type', filters.action)
  }
  
  const { data, error } = await query
  if (error) {
    console.error('Error fetching logs:', error)
    return []
  }
  return data || []
}

export async function getDownloadUrl(manualId) {
  const { data: manual } = await supabase
    .from('manuals')
    .select('file_path')
    .eq('id', manualId)
    .single()
  
  if (!manual?.file_path) return null
  
  const { data, error } = await supabase
    .storage
    .from('manuals')
    .createSignedUrl(manual.file_path, 3600) // 1 hour
  
  if (error) {
    console.error('Error getting download URL:', error)
    return null
  }
  
  return data.signedUrl
}
