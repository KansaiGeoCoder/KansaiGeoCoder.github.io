/* Simple Signup Logic */

/* ===== Supabase config ===== */
const SUPABASE_URL = "https://qdykenvvtqnzdgtzcmhe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeWtlbnZ2dHFuemRndHpjbWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDg0MDEsImV4cCI6MjA3NzM4NDQwMX0.zN6Mpfnxr5_ufc6dMDO89LZBXSFYa4ex4vbiu1Q813U";

/* ===== Load Supabase ===== */
async function loadSupabaseClient() {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return mod.createClient;
  } catch (e) {
    throw new Error("Could not load Supabase");
  }
}

/* ===== Global state ===== */
let sbClient = null;
let selectedAccountType = null;

/* ===== DOM Elements ===== */
const accountTypeSelector = document.getElementById('accountTypeSelector');
const signupForm = document.getElementById('signupForm');
const formTitle = document.getElementById('formTitle');
const shopOwnerFields = document.getElementById('shopOwnerFields');
const associationFields = document.getElementById('associationFields');
const btnBack = document.getElementById('btnBack');
const btnSubmit = document.getElementById('btnSubmit');
const submitText = document.getElementById('submitText');
const formMessage = document.getElementById('formMessage');

/* ===== Account Type Selection ===== */
document.querySelectorAll('.account-type-card').forEach(card => {
  card.addEventListener('click', () => {
    selectedAccountType = card.dataset.type;
    showForm();
  });
});

function showForm() {
  accountTypeSelector.style.display = 'none';
  signupForm.style.display = 'block';
  
  // Reset fields
  shopOwnerFields.style.display = 'none';
  associationFields.style.display = 'none';
  
  // Configure form based on type
  const config = {
    visitor: {
      title: 'Create Visitor Account',
      submitText: 'Create Account'
    },
    shop_owner: {
      title: 'Register as Shop Owner',
      submitText: 'Submit for Approval'
    },
    association: {
      title: 'Register as Association',
      submitText: 'Submit for Approval'
    }
  };
  
  formTitle.textContent = config[selectedAccountType].title;
  submitText.textContent = config[selectedAccountType].submitText;
  
  // Show type-specific fields
  if (selectedAccountType === 'shop_owner') {
    shopOwnerFields.style.display = 'block';
    document.getElementById('shopName').required = true;
    document.getElementById('shopShotengai').required = true;
  } else if (selectedAccountType === 'association') {
    associationFields.style.display = 'block';
    document.getElementById('associationName').required = true;
    document.getElementById('shotengaiManaged').required = true;
  }
}

/* ===== Back Button ===== */
btnBack.addEventListener('click', () => {
  signupForm.style.display = 'none';
  accountTypeSelector.style.display = 'grid';
  signupForm.reset();
  formMessage.classList.remove('show', 'error', 'success');
});

/* ===== Form Submission ===== */
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get values
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const displayName = document.getElementById('displayName').value.trim();
  const agreeTerms = document.getElementById('agreeTerms').checked;
  
  // Validate
  if (!email || !password || !displayName || !agreeTerms) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }
  
  if (password.length < 8) {
    showMessage('Password must be at least 8 characters', 'error');
    return;
  }
  
  // Validate type-specific fields
  if (selectedAccountType === 'shop_owner') {
    const shopName = document.getElementById('shopName').value.trim();
    const shopShotengai = document.getElementById('shopShotengai').value.trim();
    if (!shopName || !shopShotengai) {
      showMessage('Please fill in shop information', 'error');
      return;
    }
  } else if (selectedAccountType === 'association') {
    const associationName = document.getElementById('associationName').value.trim();
    const shotengaiManaged = document.getElementById('shotengaiManaged').value.trim();
    if (!associationName || !shotengaiManaged) {
      showMessage('Please fill in association information', 'error');
      return;
    }
  }
  
  // Disable submit
  btnSubmit.disabled = true;
  submitText.textContent = 'Creating account...';
  
  try {
    await handleSignup(email, password, displayName);
  } catch (error) {
    console.error('Signup error:', error);
    showMessage(error.message || 'An error occurred', 'error');
    btnSubmit.disabled = false;
    submitText.textContent = submitText.dataset.original || 'Create Account';
  }
});

/* ===== Signup Handler ===== */
async function handleSignup(email, password, displayName) {
  console.log('🚀 Starting signup for:', selectedAccountType);
  
  // Sign up with Supabase Auth
  const { data: authData, error: authError } = await sbClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });
  
  if (authError) throw authError;
  
  console.log('✅ Auth signup successful');
  
  // Determine role and verification status
  let role = 'visitor';
  let verificationStatus = 'verified'; // Visitors auto-verified
  
  if (selectedAccountType === 'shop_owner') {
    role = 'shop_owner';
    verificationStatus = 'pending';
  } else if (selectedAccountType === 'association') {
    role = 'association';
    verificationStatus = 'pending';
  }
  
  // Create profile
  const profileData = {
    id: authData.user.id,
    email: email,
    display_name: displayName,
    role: role,
    verification_status: verificationStatus,
    created_at: new Date().toISOString()
  };
  
  // Add type-specific data
  if (selectedAccountType === 'shop_owner') {
    profileData.shop_name = document.getElementById('shopName').value.trim();
    profileData.shotengai_name = document.getElementById('shopShotengai').value.trim();
  } else if (selectedAccountType === 'association') {
    profileData.association_name = document.getElementById('associationName').value.trim();
    profileData.shotengai_managed = document.getElementById('shotengaiManaged').value.trim();
  }
  
  console.log('📝 Creating profile...');
  
  const { error: profileError } = await sbClient
    .from('profiles')
    .insert(profileData);
  
  if (profileError) {
    console.error('Profile error:', profileError);
    throw new Error('Failed to create profile');
  }
  
  console.log('✅ Profile created');
  
  // Show success modal
  showSuccessModal();
}

/* ===== Success Modal ===== */
function showSuccessModal() {
  const modal = document.getElementById('successModal');
  const icon = document.getElementById('modalIcon');
  const title = document.getElementById('modalTitle');
  const message = document.getElementById('modalMessage');
  
  if (selectedAccountType === 'visitor') {
    icon.textContent = '✅';
    title.textContent = 'Account Created!';
    message.textContent = 'Please check your email to verify your account, then you can start exploring.';
  } else {
    icon.textContent = '⏳';
    title.textContent = 'Submitted for Approval';
    message.textContent = 'Your account has been created and is pending approval. We\'ll email you once approved.';
  }
  
  modal.style.display = 'flex';
}

/* ===== Helper Functions ===== */
function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = 'form-message show ' + type;
  setTimeout(() => formMessage.classList.remove('show'), 5000);
}

/* ===== Initialize ===== */
(async function init() {
  try {
    console.log('🚀 Initializing...');
    
    const createClient = await loadSupabaseClient();
    sbClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
    
    console.log('✅ Ready');
    
  } catch (error) {
    console.error('❌ Init failed:', error);
    alert('Failed to initialize. Please refresh the page.');
  }
})();