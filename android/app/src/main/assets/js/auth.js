/**
 * Eko Micro-Entrepreneur Worker — Auth Module
 *
 * Handles:
 *   - Google Sign-In (via Google Identity Services)
 *   - Demo Mode
 *   - Session management (in-memory + localStorage)
 *   - Onboarding state routing
 *   - Logout
 */

// ── Config ────────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '258255119262-hl7e15h4ohciliroc29gcpbfa6i1sf2l.apps.googleusercontent.com';

// Production API URL — no localhost, no emulator, no mixed content in Release
// Automatically detects Release (HTTPS onrender.com) vs Debug (10.0.2.2:8000) vs Browser (localhost:8000)
function getEkoApiBase() {
  try {
    const override = localStorage.getItem('eko_api_base_override');
    if (override) return override;
  } catch (e) {}

  if (typeof AndroidBridge !== 'undefined') {
    if (typeof AndroidBridge.isDebug === 'function' && AndroidBridge.isDebug()) {
      return 'http://10.0.2.2:8000';
    }
    if (typeof AndroidBridge.getProductionApiBase === 'function') {
      return AndroidBridge.getProductionApiBase();
    }
  }

  if (window.location.hostname === 'appassets.androidplatform.net') {
    return 'https://eko-field-worker-api.onrender.com';
  }

  return 'http://localhost:8000';
}

try {
  Object.defineProperty(window, 'EKO_API_BASE', {
    get: function() {
      return getEkoApiBase();
    },
    configurable: true
  });
} catch (e) {
  window.EKO_API_BASE = getEkoApiBase();
}

function isAndroidApk() {
  const isBridge = typeof AndroidBridge !== 'undefined';
  const isAppAssets = window.location.hostname === 'appassets.androidplatform.net';
  const isAndroidUA = /Android/i.test(navigator.userAgent);
  return isBridge || isAppAssets || isAndroidUA;
}

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
  // localStorage persists across app restarts, device reboots, and WebView recreations.
  // We store the user profile (no tokens — Google ID token is never persisted).
  try {
    localStorage.setItem('eko_user', JSON.stringify({
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
      saved_at: Date.now(),
    }));
  } catch (_) { /* ignore storage errors */ }
}

function loadSession() {
  try {
    const raw = localStorage.getItem('eko_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Expire cached session after 30 days
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
    if (user.saved_at && Date.now() - user.saved_at > MAX_AGE) {
      localStorage.removeItem('eko_user');
      return null;
    }
    return user;
  } catch (_) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem('eko_user');
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
  console.log('Auth: [WEBVIEW AUTH CALLBACK] handleCredentialResponse called');
  clearAuthError();
  showLoginLoading(true);

  let idToken = null;
  if (typeof response === 'string') {
    // This is from native Android bridge
    idToken = response;
    console.log('Auth: [WEBVIEW AUTH CALLBACK] Token source: Native Android bridge. Token length:', idToken.length);
  } else if (response && response.credential) {
    // This is from GSI web button
    idToken = response.credential;
    console.log('Auth: [WEBVIEW AUTH CALLBACK] Token source: Web GSI button. Token length:', idToken.length);
  }

  if (!idToken) {
    console.warn('Auth: [WEBVIEW AUTH CALLBACK] No ID token extracted from response');
    showAuthError('Sign-in cancelled. You can try again whenever you\'re ready.');
    showLoginLoading(false);
    return;
  }

  // NOTE: navigator.onLine is unreliable in Android WebView (always reports false in some builds).
  // We skip the offline check and let the fetch fail naturally with a network error if truly offline.
  console.log('Auth: [WEBVIEW AUTH CALLBACK] navigator.onLine =', navigator.onLine, '(skipping offline guard — unreliable in WebView)');

  const apiBase = window.EKO_API_BASE || 'http://10.0.2.2:8000';
  const authUrl = `${apiBase}/api/auth/google`;
  console.log('Auth: [POST /api/auth/google] Sending request to:', authUrl);

  try {
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: idToken }),
    });

    console.log('Auth: [POST /api/auth/google] Response status:', res.status, res.statusText);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const detail = errBody.detail || `HTTP ${res.status}`;
      console.error('Auth: [AUTH FAILURE] Backend rejected token:', detail);
      throw new Error(detail);
    }

    const user = await res.json();
    console.log('Auth: [AUTH SUCCESS] Signed in as:', user.email, '| onboarding_completed:', user.onboarding_completed);
    currentUser = user;
    isDemoMode = false;
    saveSession(user);
    onAuthSuccess(user);

  } catch (err) {
    console.error('Auth: [AUTH FAILURE] Fetch error:', err.message);
    showAuthError('We couldn\'t sign you in. Check your connection and try again.');
    showLoginLoading(false);
  }
}

/**
 * Global function for Native Android Bridge to call via evaluateJavascript.
 * Must be defined on window so it is accessible from Kotlin's evaluateJavascript().
 */
window.handleNativeGoogleResponse = function(idToken) {
  console.log('Auth: [PASSING TOKEN TO WEBVIEW] handleNativeGoogleResponse called. Token length:', idToken ? idToken.length : 0);
  if (!idToken) {
    console.error('Auth: [PASSING TOKEN TO WEBVIEW] Received null/empty token!');
    showAuthError('Sign-in failed: no token received.');
    return;
  }
  handleCredentialResponse(idToken);
};

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
  // Defensive: kill any GSI residuals in APK
  if (isAndroidApk()) {
    window.google = null;
    console.log('Auth: showLoginScreen called in APK. window.google disabled.');
  } else {
    console.log('Auth: showLoginScreen called in Browser. window.google exists?', !!window.google);
  }

  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');
  const obScreen = document.getElementById('onboarding-screen');

  if (loginScreen) {
    loginScreen.classList.remove('hidden');
    loginScreen.style.display = 'flex';
  }
  if (appContainer) {
    appContainer.classList.add('hidden');
    appContainer.style.display = 'none';
  }
  if (obScreen) {
    obScreen.classList.add('hidden');
    obScreen.style.display = 'none';
  }

  // If running in Android APK, we use the Native Credential Manager via Bridge.
  // We DO NOT initialize Google Identity Services (GSI) Web library because it fails in WebView.
  if (isAndroidApk()) {
    console.log('Auth: Android environment detected. Using native sign-in bridge.');
    // Explicitly inject/ensure the button is our manual one
    const gsiContainer = document.getElementById('google-btn-container');
    if (gsiContainer) {
       gsiContainer.innerHTML = `
        <button class="google-btn" id="native-google-signin-btn" onclick="handleGoogleSignIn()">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
        </button>`;
    }
    return;
  }

  console.log('Auth: Web environment detected. Initializing GSI.');

  // Initialize Google Identity Services button (Web only)
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
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) {
    loginScreen.classList.add('hidden');
    loginScreen.style.display = 'none';
  }
}

// ── Onboarding ────────────────────────────────────────────────────────────────
let onboardingUser = null;

function showOnboarding(user) {
  onboardingUser = user;
  const obScreen = document.getElementById('onboarding-screen');
  const appContainer = document.getElementById('app-container');
  const loginScreen = document.getElementById('login-screen');

  if (loginScreen) {
    loginScreen.classList.add('hidden');
    loginScreen.style.display = 'none';
  }
  if (obScreen) {
    obScreen.classList.remove('hidden');
    obScreen.style.display = 'flex';
  }
  if (appContainer) {
    appContainer.classList.add('hidden');
    appContainer.style.display = 'none';
  }
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
  const obScreen = document.getElementById('onboarding-screen');
  if (obScreen) {
    obScreen.classList.add('hidden');
    obScreen.style.display = 'none';
  }
  enterApp(updatedUser);
}

// ── Enter App ─────────────────────────────────────────────────────────────────
function enterApp(user) {
  // Notify AndroidBridge about current user and base URL if running in APK
  if (typeof AndroidBridge !== 'undefined') {
    AndroidBridge.setConfig(window.EKO_API_BASE, user.id);
  }

  // Apply saved language preference
  if (user.language_preference) {
    appLanguage = user.language_preference;
    ['lang-select-sidebar','lang-select-desktop','lang-select-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = user.language_preference;
    });
  }

  const loginScreen = document.getElementById('login-screen');
  const obScreen = document.getElementById('onboarding-screen');
  const appContainer = document.getElementById('app-container');

  if (loginScreen) {
    loginScreen.classList.add('hidden');
    loginScreen.style.display = 'none';
  }
  if (obScreen) {
    obScreen.classList.add('hidden');
    obScreen.style.display = 'none';
  }
  if (appContainer) {
    appContainer.classList.remove('hidden');
    appContainer.style.display = 'flex';
  }

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
  if (typeof AndroidBridge !== 'undefined') AndroidBridge.googleSignOut();
  clearSession();
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('app-container').style.display = 'none';
  showLoginScreen();
}
// alias
const logout = signOut;

// ── Handle Google button click (fallback when no GIS auto-render) ─────────────
function handleGoogleSignIn() {
  console.log('Auth: handleGoogleSignIn clicked. Origin:', window.location.origin);

  if (isAndroidApk()) {
    if (typeof AndroidBridge !== 'undefined') {
      console.log('Auth: Triggering Native Google Sign-In via Bridge');
      AndroidBridge.googleSignIn();
    } else {
      console.error('Auth: Android environment detected but Bridge is MISSING!');
      showAuthError('Internal Error: Native bridge not found.');
    }
    return;
  }

  console.log('Auth: Proceeding with Web Google Sign-In');
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
