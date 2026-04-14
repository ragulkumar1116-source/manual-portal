import { supabase, getCurrentUser, getIP } from './supabase.js'

// ==========================================
// TRACK MANUAL VIEW
// ==========================================
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
    // Increment user view count using RPC
    await supabase.rpc('increment_user_stat', {
      user_uuid: user.id,
      stat_name: 'view_count'
    })
    
    // Increment manual view count (fetch + update)
    const { data: manual } = await supabase
      .from('manuals')
      .select('view_count')
      .eq('id', manualId)
      .single()
    
    if (manual) {
      await supabase
        .from('manuals')
        .update({ view_count: (manual.view_count || 0) + 1 })
        .eq('id', manualId)
    }
  }
}

// ==========================================
// TRACK DOWNLOAD (Fixed)
// ==========================================
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
  
  // 3. Increment user download count using RPC
  await supabase.rpc('increment_user_stat', {
    user_uuid: user.id,
    stat_name: 'download_count'
  })
  
  // 4. Increment manual download count (fetch + update)
  const { data: manual } = await supabase
    .from('manuals')
    .select('download_count')
    .eq('id', manualId)
    .single()
  
  if (manual) {
    await supabase
      .from('manuals')
      .update({ download_count: (manual.download_count || 0) + 1 })
      .eq('id', manualId)
  }
  
  return log?.[0]?.id || 'unknown'
}

// ==========================================
// GET DOWNLOAD URL (For download-center.html)
// ==========================================
export async function getManualDownloadUrl(manualId) {
  const { data: manual, error } = await supabase
    .from('manuals')
    .select('file_path')
    .eq('id', manualId)
    .single()
  
  if (error || !manual?.file_path) {
    throw new Error('Manual not found or no file attached')
  }
  
  // Create signed URL (valid for 1 hour)
  const { data: signedData, error: signError } = await supabase
    .storage
    .from('manuals')
    .createSignedUrl(manual.file_path, 3600)
  
  if (signError) throw signError
  
  return signedData.signedUrl
}

function getSessionId() {
  let sid = sessionStorage.getItem('sessionId')
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    sessionStorage.setItem('sessionId', sid)
  }
  return sid
}
