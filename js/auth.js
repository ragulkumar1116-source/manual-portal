import { supabase, getCurrentUser } from './supabase.js'

// ==========================================
// REGISTER USER (No Email Confirmation Required)
// ==========================================
export async function registerUser(email, password, userDetails) {
  try {
    console.log('Starting registration...', { email })

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Skip email confirmation - user can login immediately
        emailRedirectTo: window.location.origin + '/dashboard.html',
        data: {
          full_name: userDetails.fullName,
          phone: userDetails.phone,
          employee_id: userDetails.employeeId,
          department: userDetails.department
        }
      }
    })
    
    if (authError) {
      console.error('Auth error:', authError)
      
      // Handle "Email signups are disabled"
      if (authError.message?.includes('Email signups are disabled') || 
          authError.message?.includes('signups are disabled')) {
        return { 
          success: false, 
          error: 'Email registration is currently disabled in the backend. Please contact your administrator to enable Email provider in Supabase Dashboard (Authentication > Providers > Email).',
          code: 'SIGNUPS_DISABLED'
        }
      }
      
      // Handle rate limit
      if (authError.status === 429 || authError.message?.includes('rate limit')) {
        return { 
          success: false, 
          error: 'Too many attempts. Please wait 1 hour or use a different email address.'
        }
      }
      
      // Handle existing user
      if (authError.message?.includes('already registered')) {
        return {
          success: false,
          error: 'This email is already registered. Please login instead.',
          code: 'USER_EXISTS'
        }
      }
      
      throw authError
    }
    
    if (!authData.user) {
      throw new Error('User creation failed')
    }

    console.log('User created:', authData.user.id)
    
    // IMPORTANT: If email confirmation is ON in dashboard, user will have:
    // authData.user.email_confirmed_at = null
    
    // If email confirmation is OFF, user can login immediately
    
    return { 
      success: true, 
      user: authData.user,
      emailConfirmed: !!authData.user.email_confirmed_at,
      message: authData.user.email_confirmed_at 
        ? 'Registration successful! You can login now.'
        : 'Registration successful! Please check your email to verify, or contact admin to disable email confirmation.'
    }
    
  } catch (error) {
    console.error('Registration error:', error)
    return { 
      success: false, 
      error: error.message || 'Registration failed. Please check Supabase Dashboard settings.'
    }
  }
}

// ==========================================
// LOGIN USER (Works Even If Email Not Confirmed - Optional)
// ==========================================
export async function loginUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      // If error says "Email not confirmed", we can try to auto-confirm (admin only)
      // But for now, just show helpful message
      if (error.message?.includes('Email not confirmed')) {
        return {
          success: false,
          error: 'Please verify your email first. Check your inbox or ask admin to disable email confirmation in Supabase settings.',
          needsVerification: true
        }
      }
      
      if (error.message?.includes('Invalid login')) {
        return { success: false, error: 'Invalid email or password.' }
      }
      
      throw error
    }
    
    // Update last login
    await supabase.from('profiles').update({ 
      last_login: new Date().toISOString() 
    }).eq('id', data.user.id).single()
    
    return { success: true, user: data.user }
    
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ==========================================
// AUTO-LOGIN AFTER REGISTER (If Confirmation Disabled)
// ==========================================
export async function registerAndLogin(email, password, userDetails) {
  const registerResult = await registerUser(email, password, userDetails)
  
  if (!registerResult.success) return registerResult
  
  // If email is already confirmed (confirmation disabled in dashboard), auto-login
  if (registerResult.emailConfirmed || registerResult.user.email_confirmed_at) {
    return await loginUser(email, password)
  }
  
  return registerResult
}

// ==========================================
// OTHER FUNCTIONS (Logout, Check Auth, etc.)
// ==========================================
export async function logout() {
  try {
    await supabase.auth.signOut()
    window.location.href = 'index.html'
  } catch (error) {
    console.error('Logout error:', error)
    window.location.href = 'index.html'
  }
}

export async function checkAuth() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      if (!window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html'
      }
      return null
    }
    return user
  } catch (error) {
    console.error('Auth check error:', error)
    return null
  }
}

export async function resendVerification(email) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    })
    
    if (error) {
      if (error.message?.includes('disabled')) {
        return {
          success: false,
          error: 'Email service is disabled. Contact administrator.'
        }
      }
      throw error
    }
    
    return { success: true, message: 'Email sent! Check spam folder.' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
