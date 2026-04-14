import { supabase } from './supabase.js'

// ==========================================
// UPLOAD MANUAL PDF
// ==========================================
export async function uploadManual(file, metadata) {
  try {
    // Validate file
    if (!file) throw new Error('No file selected')
    if (file.type !== 'application/pdf') throw new Error('File must be PDF')
    if (file.size > 50 * 1024 * 1024) throw new Error('File too large (max 50MB)')
    
    // Create path: category/filename.pdf
    const fileExt = file.name.split('.').pop()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
    const fileName = `${Date.now()}_${safeName}`
    const filePath = `${metadata.category}/${fileName}`
    
    console.log('Uploading to path:', filePath)
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('manuals') // Must match bucket name exactly
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf'
      })
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw new Error(uploadError.message || 'Upload failed')
    }
    
    console.log('Upload successful:', uploadData)
    
    // Get public/signed URL
    const { data: urlData } = supabase
      .storage
      .from('manuals')
      .getPublicUrl(filePath)
    
    // Save to database
    const { data: manualData, error: dbError } = await supabase
      .from('manuals')
      .insert({
        title: metadata.title,
        category: metadata.category,
        equipment_type: metadata.equipmentType || metadata.equipment_model,
        file_path: filePath,
        file_size: formatFileSize(file.size),
        version: metadata.version || '1.0',
        status: 'active',
        description: metadata.description || `Technical manual for ${metadata.equipmentType || 'equipment'}`
      })
      .select()
    
    if (dbError) {
      console.error('Database insert error:', dbError)
      // Don't delete file if DB fails, but warn user
      throw new Error(`File uploaded but database record failed: ${dbError.message}`)
    }
    
    return { 
      success: true, 
      path: filePath,
      manualId: manualData[0].id,
      url: urlData.publicUrl
    }
    
  } catch (error) {
    console.error('Upload error details:', error)
    throw error
  }
}

// ==========================================
// GET DOWNLOAD URL (Signed)
// ==========================================
export async function getManualDownloadUrl(filePath, expirySeconds = 3600) {
  try {
    const { data, error } = await supabase
      .storage
      .from('manuals')
      .createSignedUrl(filePath, expirySeconds)
    
    if (error) throw error
    return data.signedUrl
    
  } catch (error) {
    console.error('Error getting download URL:', error)
    throw new Error('Could not generate download link')
  }
}

// ==========================================
// DELETE MANUAL (Admin Only)
// ==========================================
export async function deleteManual(filePath, manualId) {
  try {
    // Delete from storage
    const { error: storageError } = await supabase
      .storage
      .from('manuals')
      .remove([filePath])
    
    if (storageError) throw storageError
    
    // Delete from database
    const { error: dbError } = await supabase
      .from('manuals')
      .delete()
      .eq('id', manualId)
    
    if (dbError) throw dbError
    
    return { success: true }
    
  } catch (error) {
    throw error
  }
}

// Helper
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// List all manuals in bucket (debug)
export async function listStorageFiles() {
  const { data, error } = await supabase
    .storage
    .from('manuals')
    .list()
  
  if (error) {
    console.error('List error:', error)
    return []
  }
  return data
}

