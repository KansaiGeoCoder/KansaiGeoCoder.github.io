/* =========================
   Shotengai Atlas - Association Dashboard
   ========================= */

/* ===== Supabase config ===== */
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

/* ===== Supabase loader ===== */
async function loadSupabaseClient() {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return mod.createClient;
  } catch (e1) {
    try {
      const mod = await import("https://unpkg.com/@supabase/supabase-js@2.45.1/+esm");
      return mod.createClient;
    } catch (e2) {
      throw new Error("Could not load supabase-js from any CDN.");
    }
  }
}

/* ===== Global state ===== */
let sbClient = null;
let currentUser = null;
let currentProfile = null;

/* ===== Dashboard Navigation ===== */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.dashboard-section');
  const dashboardTitle = document.getElementById('dashboardTitle');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all nav items
      navItems.forEach(nav => nav.classList.remove('active'));
      
      // Add active class to clicked item
      item.classList.add('active');
      
      // Get section name
      const sectionName = item.dataset.section;
      
      // Hide all sections
      sections.forEach(section => section.classList.remove('active'));
      
      // Show target section
      const targetSection = document.getElementById(`section-${sectionName}`);
      if (targetSection) {
        targetSection.classList.add('active');
        
        // Update dashboard title
        const titles = {
          'overview': 'Dashboard Overview',
          'shotengai': 'Shotengai Information',
          'events': 'Events Management',
          'shops': 'Shops Directory',
          'forum': 'Community Forum',
          'analytics': 'Analytics & Reports'
        };
        dashboardTitle.textContent = titles[sectionName] || 'Dashboard';
      }
    });
  });
}

/* ===== Authentication Check ===== */
async function checkAuth() {
  try {
    // Check if user is authenticated
    const { data: { user }, error } = await sbClient.auth.getUser();
    
    if (error || !user) {
      console.log('❌ Not authenticated, redirecting to map...');
      window.location.href = 'map-mapbox.html';
      return false;
    }
    
    currentUser = user;
    console.log('✅ User authenticated:', user.email);
    
    // Fetch user profile to check role
    const { data: profile, error: profileError } = await sbClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      
      // If profile doesn't exist, user might not have the right role
      // For now, allow access but show warning
      console.warn('⚠️ No profile found - user might need to be assigned a role');
      
      // Update UI with basic info
      updateUserUI(user.email, 'No Role Assigned');
      return true;
    }
    
    currentProfile = profile;
    console.log('✅ Profile loaded:', profile);
    
    // Check if user has association role
    if (profile.role !== 'association' && profile.role !== 'admin') {
      console.log('❌ User does not have association role:', profile.role);
      alert('Access denied. You need association privileges to access this dashboard.');
      window.location.href = 'map-mapbox.html';
      return false;
    }
    
    // Update last login
    await sbClient.rpc('update_last_login');
    
    // Update UI with user info
    updateUserUI(profile.display_name || user.email, profile.role);
    
    // Load dashboard data
    await loadDashboardData(profile);
    
    return true;
    
  } catch (error) {
    console.error('❌ Auth check failed:', error);
    alert('Authentication error: ' + error.message);
    window.location.href = 'map-mapbox.html';
    return false;
  }
}

/* ===== Update User UI ===== */
function updateUserUI(displayName, role) {
  const userNameEl = document.getElementById('userName');
  const userAvatar = document.querySelector('.user-avatar');
  const userRoleEl = document.querySelector('.user-role');
  
  if (userNameEl) {
    userNameEl.textContent = displayName;
  }
  
  if (userAvatar) {
    // Set avatar to first letter of name
    const initial = displayName.charAt(0).toUpperCase();
    userAvatar.textContent = initial;
  }
  
  if (userRoleEl) {
    const roleNames = {
      'association': 'Association Admin',
      'admin': 'System Admin',
      'shop_owner': 'Shop Owner',
      'member': 'Member',
      'visitor': 'Visitor'
    };
    userRoleEl.textContent = roleNames[role] || 'User';
  }
}

/* ===== Load Dashboard Data ===== */
async function loadDashboardData(profile) {
  try {
    console.log('📊 Loading dashboard data...');
    
    // If user has an association_id, load their Shotengai data
    if (profile.association_id) {
      const { data: shotengai, error } = await sbClient
        .from('shotengai')
        .select('*')
        .eq('id', profile.association_id)
        .single();
      
      if (error) {
        console.error('Error loading Shotengai data:', error);
      } else {
        console.log('✅ Shotengai data loaded:', shotengai);
        // TODO: Update dashboard with Shotengai-specific data
      }
    }
    
    // TODO: Load other dashboard data (events, shops, etc.)
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

/* ===== Logout ===== */
async function logout() {
  try {
    const { error } = await sbClient.auth.signOut();
    if (error) throw error;
    
    console.log('✅ Logged out successfully');
    window.location.href = 'map-mapbox.html';
  } catch (error) {
    console.error('❌ Logout error:', error);
    alert('Error signing out: ' + error.message);
  }
}

/* ===== Back to Map ===== */
function backToMap() {
  window.location.href = 'map-mapbox.html';
}

/* ===== Initialize Dashboard ===== */
(async function init() {
  try {
    console.log('🚀 Initializing dashboard...');
    
    // Load Supabase client
    const createClient = await loadSupabaseClient();
    sbClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
    console.log('✅ Supabase client initialized');
    
    // Check authentication
    const isAuthorized = await checkAuth();
    
    if (!isAuthorized) {
      return; // Will redirect
    }
    
    // Initialize navigation
    initNavigation();
    
    // Setup event listeners
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', logout);
    }
    
    const btnBackToMap = document.getElementById('btnBackToMap');
    if (btnBackToMap) {
      btnBackToMap.addEventListener('click', backToMap);
    }
    
    console.log('✅ Dashboard initialized successfully');
    
  } catch (error) {
    console.error('❌ Dashboard initialization failed:', error);
    alert('Failed to initialize dashboard: ' + error.message);
  }
})();
