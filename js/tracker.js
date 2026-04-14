import { supabase, getCurrentUser, getIP } from './supabase.js'

export async function trackManualView(manualId, manualTitle, metadata = {}) {
  const user = await getCurrentUser()
  if (!user) return
  
  const ip = await getIP()
  
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.user_metadata?.full_name,
      user_phone: user.phone || user.user_metadata?.phone,
      action_type: 'view',
      manual_id: manualId,
      manual_title: manualTitle,
      ip_address: ip,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      session_id: getSessionId()
    })
  
  if (error) {
    console.error('Error tracking view:', error)
  } else {
    // Increment user's view count
    await supabase.rpc('increment_user_stat', {
      user_uuid: user.id,
      stat_name: 'view_count'
    })
  }
}

export async function trackDownload(manualId, manualTitle, details) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Authentication required")
  
  const ip = await getIP()
  const sessionId = getSessionId()
  
  // 1. Create activity log
  const { data: log, error: logError } = await supabase
    .from('activity_logs')
    .insert({
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.user_metadata?.full_name,
      user_phone: user.phone || user.user_metadata?.phone,
      action_type: 'download',
      manual_id: manualId,
      manual_title: manualTitle,
      ip_address: ip,
      user_agent: navigator.userAgent,
      project_site: details.site,
      download_reason: details.reason,
      notes: details.notes,
      timestamp: new Date().toISOString(),
      session_id: sessionId
    })
    .select()
  
  if (logError) throw logError
  
  // 2. Create download record
  await supabase
    .from('downloads')
    .insert({
      user_id: user.id,
      manual_id: manualId,
      download_reason: details.reason,
      project_site: details.site,
      device_info: navigator.userAgent,
      ip_address: ip,
      created_at: new Date().toISOString()
    })
  
  // 3. Increment counts
  await supabase.rpc('increment_user_stat', {
    user_uuid: user.id,
    stat_name: 'download_count'
  })
  
  await supabase
    .from('manuals')
    .update({ download_count: supabase.sql`download_count + 1` })
    .eq('id', manualId)
  
  return log?.[0]?.id || 'unknown'
}

function getSessionId() {
  let sid = sessionStorage.getItem('sessionId')
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    sessionStorage.setItem('sessionId', sid)
  }
  return sid
}
