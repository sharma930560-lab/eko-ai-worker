/**
 * Eko Micro-Entrepreneur Worker — Auth Module
 *
 * Handles:
 *   - Google Sign-In (via Google Identity Services)
 *   - Demo Mode
 *   - Session management (in-memory + sessionStorage)
 *   - Onboarding state routing
 *   - Logout
 */

// ── Config ────────────────────────────────────────────────────────────────────
// Replace with your actual Google Client ID.
// This is the PUBLIC client id (safe in frontend). NEVER put the client secret here.
const GOOGLE_CLIENT_ID = '258255119262-hl7e15h4ohciliroc29gcpbfa6i1sf2l.apps.googleusercontent.com';
window.EKO_API_BASE = 'http://localhost:8000';

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;   // { id, email, name, picture, business_name, ... }
let isDemoMode = false;

const DEMO_USER = {
  id: 'demo',
  name: 'Demo User',
  email: 'demo@eko.local',
  picture: null,
  business_name: 'Sample Kirana Store',
  business_type: 'Retail',
  language_preference: 'en',
  location_city: 'Mumbai',
  onboarding_completed: true,
  isDemo: true,
};

// ── Session Helpers ───────────────────────────────────────────────────────────
function saveSession(user) {
  // We store minimal profile in sessionStorage (not a token — token is never persisted)
  try {
    sessionStorage.setItem('eko_user', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      business_name: user.business_name,
      business_type: user.business_type,
      language_preference: user.language_preference,
      location_city: user.location_city,
      onboarding_completed: user.onboarding_completed,
      isDemo: user.isDemo || false,
    }));
  } catch (_) { /* ignore storage errors */ }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem('eko_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem('eko_user');
  currentUser = null;
  isDemoMode = false;
}

// ── Error Display ─────────────────────────────────────────────────────────────
function showAuthError(message) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}

// ── Google Sign-In Callback ───────────────────────────────────────────────────
async function handleCredentialResponse(response) {
  clearAuthError();
  showLoginLoading(true);

  if (!response || !response.credential) {
    showAuthError('Sign-in cancelled. You can try again whenever you\'re ready.');
    showLoginLoading(false);
    return;
  }

  if (!navigator.onLine) {
    showAuthError('You\'re offline. Sign-in requires an internet connection.');
    showLoginLoading(false);
    return;
  }

  try {
    const res = await fetch(`${window.EKO_API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Authentication failed.');
    }

    const user = await res.json();
    currentUser = user;
    isDemoMode = false;
    saveSession(user);
    onAuthSuccess(user);

  } catch (err) {
    console.error('Auth error:', err.message);
    if (!navigator.onLine) {
      showAuthError('You\'re offline. Sign-in requires an internet connection.');
    } else {
      showAuthError('We couldn\'t sign you in. Please try again.');
    }
    showLoginLoading(false);
  }
}

// ── Demo Mode ─────────────────────────────────────────────────────────────────
function enterDemoMode() {
  clearAuthError();
  currentUser = DEMO_USER;
  isDemoMode = true;
  saveSession(DEMO_USER);
  onAuthSuccess(DEMO_USER);
}

// ── Post-Auth Routing ─────────────────────────────────────────────────────────
function onAuthSuccess(user) {
  hideLoginScreen();

  if (user.isDemo || user.onboarding_completed) {
    // Returning user or demo → go straight to home
    enterApp(user);
  } else {
    // New user → show onboarding
    showOnboarding(user);
  }
}

// ── Login Screen UI ───────────────────────────────────────────────────────────
function showLoginLoading(state) {
  const btn = document.getElementById('google-signin-btn');
  const demoBtn = document.getElementById('demo-btn');
  if (btn) btn.style.opacity = state ? '0.6' : '1';
  if (demoBtn) demoBtn.disabled = state;
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('onboarding-screen').style.display = 'none';

  // Initialize Google Identity Services button
  if (window.google && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      cancel_on_tap_outside: false,
    });
    window.google.accounts.id.renderButton(
      document.getElementById('google-btn-container'),
      {
        theme: 'outline',
        size: 'large',
        width: 280,
        logo_alignment: 'left',
        text: 'continue_with',
      }
    );
  } else if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    // Show placeholder button when client ID not configured
    const container = document.getElementById('google-btn-container');
    if (container) {
      container.innerHTML = `
        <button class="google-btn-placeholder" onclick="showAuthError('Add your Google Client ID to frontend/js/auth.js to enable Google Sign-In.')">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>`;
    }
  }
}

function hideLoginScreen() {
  document.getElementById('login-screen').style.display = 'none';
}

// ── Onboarding ────────────────────────────────────────────────────────────────
let onboardingUser = null;

function showOnboarding(user) {
  onboardingUser = user;
  document.getElementById('onboarding-screen').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
  renderOnboardingStep(0);
}

const onboardingSteps = [
  {
    id: 'welcome',
    render: (user) => `
      <div class="onboarding-step">
        <div class="ob-avatar">${user.picture ? `<img src="${user.picture}" alt="${user.name}">` : '👋'}</div>
        <h2>Welcome, ${user.name.split(' ')[0]}!</h2>
        <p>Let's set up your business workspace. It only takes a minute.</p>
        <button class="ob-btn primary" onclick="nextOnboardingStep()">Get Started →</button>
      </div>`,
  },
  {
    id: 'business_name',
    render: () => `
      <div class="onboarding-step">
        <div class="ob-icon">🏪</div>
        <h2>What's your business name?</h2>
        <p>This helps Eko personalize suggestions for you.</p>
        <input type="text" id="ob-business-name" class="ob-input" placeholder="e.g. Sharma General Store" maxlength="80">
        <button class="ob-btn primary" onclick="nextOnboardingStep()">Continue →</button>
        <button class="ob-btn ghost" onclick="nextOnboardingStep()">Skip for now</button>
      </div>`,
  },
  {
    id: 'business_type',
    render: () => `
      <div class="onboarding-step">
        <div class="ob-icon">📦</div>
        <h2>What kind of business do you run?</h2>
        <div class="ob-type-grid">
          ${['Retail / Kirana','Food / Tiffin','Services','Tailoring','Electronics','Other'].map(t => `
            <button class="ob-type-btn" onclick="selectBusinessType(this, '${t}')">${t}</button>
          `).join('')}
        </div>
        <button class="ob-btn primary" onclick="nextOnboardingStep()">Continue →</button>
        <button class="ob-btn ghost" onclick="nextOnboardingStep()">Skip for now</button>
      </div>`,
  },
  {
    id: 'language',
    render: () => `
      <div class="onboarding-step">
        <div class="ob-icon">🌐</div>
        <h2>Which language do you prefer?</h2>
        <div class="ob-lang-grid">
          <button class="ob-lang-btn" onclick="selectLang(this,'en')">🇬🇧 English</button>
          <button class="ob-lang-btn" onclick="selectLang(this,'hi')">🇮🇳 हिंदी</button>
          <button class="ob-lang-btn" onclick="selectLang(this,'hinglish')">🤝 Hinglish</button>
        </div>
        <button class="ob-btn primary" onclick="nextOnboardingStep()">Continue →</button>
      </div>`,
  },
  {
    id: 'location',
    render: () => `
      <div class="onboarding-step">
        <div class="ob-icon">📍</div>
        <h2>Where is your business?</h2>
        <p>Eko can use this for local suggestions. This is optional and stored only as a city name.</p>
        <input type="text" id="ob-location-city" class="ob-input" placeholder="e.g. Jaipur, Rajasthan" maxlength="80">
        <button class="ob-btn primary" onclick="nextOnboardingStep()">Save Location →</button>
        <button class="ob-btn ghost" onclick="nextOnboardingStep()">Skip</button>
      </div>`,
  },
];

let currentOnboardingStep = 0;
let onboardingData = {};
let selectedBusinessType = null;
let selectedLang = null;

function renderOnboardingStep(index) {
  currentOnboardingStep = index;
  const total = onboardingSteps.length;
  const step = onboardingSteps[index];
  const progress = Math.round(((index) / total) * 100);

  document.getElementById('onboarding-content').innerHTML = `
    <div class="ob-progress-bar"><div style="width:${progress}%"></div></div>
    ${step.render(onboardingUser)}
  `;
}

function selectBusinessType(btn, type) {
  document.querySelectorAll('.ob-type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedBusinessType = type;
}

function selectLang(btn, lang) {
  document.querySelectorAll('.ob-lang-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedLang = lang;
}

function nextOnboardingStep() {
  const step = onboardingSteps[currentOnboardingStep];

  // Collect data from current step
  if (step.id === 'business_name') {
    const val = document.getElementById('ob-business-name')?.value.trim();
    if (val) onboardingData.business_name = val;
  }
  if (step.id === 'business_type' && selectedBusinessType) {
    onboardingData.business_type = selectedBusinessType;
  }
  if (step.id === 'language' && selectedLang) {
    onboardingData.language_preference = selectedLang;
  }
  if (step.id === 'location') {
    const val = document.getElementById('ob-location-city')?.value.trim();
    if (val) onboardingData.location_city = val;
  }

  if (currentOnboardingStep < onboardingSteps.length - 1) {
    renderOnboardingStep(currentOnboardingStep + 1);
  } else {
    finishOnboarding();
  }
}

async function finishOnboarding() {
  onboardingData.onboarding_completed = true;

  // Save to backend if real user
  if (!isDemoMode && onboardingUser) {
    try {
      await fetch(`${window.EKO_API_BASE}/api/users/${onboardingUser.id}/onboarding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardingData),
      });
    } catch (e) {
      console.warn('Could not save onboarding data:', e);
    }
  }

  const updatedUser = { ...onboardingUser, ...onboardingData };
  currentUser = updatedUser;
  saveSession(updatedUser);
  document.getElementById('onboarding-screen').style.display = 'none';
  enterApp(updatedUser);
}

// ── Enter App ─────────────────────────────────────────────────────────────────
function enterApp(user) {
  // Apply saved language preference
  if (user.language_preference) {
    appLanguage = user.language_preference;
    ['lang-select-sidebar','lang-select-desktop','lang-select-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = user.language_preference;
    });
  }

  document.getElementById('app-container').classList.remove('hidden');
  document.getElementById('app-container').style.display = 'flex';

  // Render sidebar user info
  const sidebarUser = document.getElementById('sidebar-user');
  if (sidebarUser) {
    const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    const subText = isDemoMode ? 'Demo Mode' : (user.business_name || user.business_type || 'My Business');
    sidebarUser.innerHTML = user.picture
      ? `<img src="${user.picture}" class="user-avatar" style="object-fit:cover;" alt="${user.name}">
         <div class="user-info">
           <div class="user-name">${user.name.split(' ')[0]}</div>
           <div class="user-badge">${subText}</div>
         </div>`
      : `<div class="user-avatar">${initials}</div>
         <div class="user-info">
           <div class="user-name">${user.name.split(' ')[0]}</div>
           <div class="user-badge">${subText}</div>
         </div>`;
  }

  // Show / hide demo banner
  const demoBanner = document.getElementById('demo-banner');
  if (demoBanner) {
    if (isDemoMode) {
      demoBanner.classList.remove('hidden');
      demoBanner.style.display = 'flex';
    } else {
      demoBanner.classList.add('hidden');
      demoBanner.style.display = 'none';
    }
  }

  // Navigate to home screen
  navigateTo('home');
}

// ── Logout ─────────────────────────────────────────────────────────────────────
function signOut() {
  if (window.google) window.google.accounts.id.disableAutoSelect();
  clearSession();
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('app-container').style.display = 'none';
  showLoginScreen();
}
// alias
const logout = signOut;

// ── Handle Google button click (fallback when no GIS auto-render) ─────────────
function handleGoogleSignIn() {
  if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    showAuthError('Google Sign-In is not configured yet. Add your Client ID to frontend/js/auth.js, or click "Try Demo" to explore.');
    return;
  }
  // GIS handles the popup — the callback is handleCredentialResponse
}

// ── Init ───────────────────────────────────────────────────────────────────────
function initAuth() {
  const savedUser = loadSession();
  if (savedUser) {
    currentUser = savedUser;
    isDemoMode = savedUser.isDemo || false;
    enterApp(savedUser);
    return;
  }
  showLoginScreen();
}
