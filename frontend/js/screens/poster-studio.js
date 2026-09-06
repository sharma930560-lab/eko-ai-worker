/**
 * Eko Partner Operations — Banner & Poster Studio (v1.4.0)
 * Mobile-first marketing editor:
 * 15 templates, live offer calculation, protected Made by Eko branding,
 * hero live canvas, mobile editor panels, tap-to-edit, preview, undo/redo, PNG export & share.
 */

// ── State ─────────────────────────────────────────────────────────────────────
let _posterList = [];
let _activePosterId = null;
let _activePosterData = {
    title: 'Untitled Poster',
    template_type: 'special_offer',
    width: 800, height: 800,
    layers: [],
    offer: { originalPrice: 0, discountPercent: 0, discountAmount: 0, finalPrice: 0 }
};
let _selectedLayerIndex = -1;
let _activeEditorTab = 'content'; // 'content' | 'offer' | 'style' | 'brand' | 'layers' | 'ai'
let _posterUndoStack = [];
let _posterRedoStack = [];
let _isDraggingLayer = false;
let _dragStartPos = { x: 0, y: 0 };
let _layerInitialPos = { x: 0, y: 0 };
let _posterViewMode = 'edit';
let _templateFilter = 'all';
let _templateSearch = '';
let _aiGenerating = false;

// ── Offer Calculation (exact decimal arithmetic) ───────────────────────────────
function calcOffer(originalPrice, discountPercent) {
    const op = parseFloat(originalPrice) || 0;
    const dp = Math.max(0, Math.min(100, parseFloat(discountPercent) || 0));
    const discountAmount = Math.round((op * dp / 100) * 100) / 100;
    const finalPrice = Math.round((op - discountAmount) * 100) / 100;
    return { originalPrice: op, discountPercent: dp, discountAmount, finalPrice };
}

function fmtINR(val) {
    const n = parseFloat(val) || 0;
    return '\u20b9' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── Made by Eko branding layer (always protected) ──────────────────────────────
function ekoBrandingLayer() {
    return {
        type: 'branding', text: 'Made by Eko',
        color: 'rgba(255,255,255,0.72)', fontSize: 13, bold: false,
        align: 'center', x: 400, y: 778, _protected: true
    };
}

const POSTER_TEMPLATES = [
    // === OFFERS ===
    {
        id: 'special_offer', name: 'Special Offer', category: 'offers',
        accent: '#f97316', description: 'Bold orange offer card',
        preview: { bg: '#fff7ed', badge: '#f97316', headline: '20% OFF', sub: 'Special Offer', price: '\u20b9999', cta: 'Grab Now' },
        layers: [
            { type: 'background', color: '#fff7ed', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#f97316', x: 0, y: 0, w: 800, h: 220, radius: 0 },
            { type: 'badge', text: '\u2b50  LIMITED TIME OFFER  \u2b50', color: 'rgba(0,0,0,0.2)', textColor: '#ffffff', x: 120, y: 24, w: 560, h: 36, fontSize: 14 },
            { type: 'text', text: '20% OFF', color: '#ffffff', fontSize: 80, bold: true, align: 'center', x: 400, y: 170, id: 'headline' },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 60, y: 240, w: 680, h: 370, radius: 20 },
            { type: 'text', text: 'Special Offer', color: '#f97316', fontSize: 28, bold: true, align: 'center', x: 400, y: 300, id: 'sub' },
            { type: 'text', text: '\u20b91,299', color: '#94a3b8', fontSize: 22, bold: false, align: 'center', x: 400, y: 370, id: 'orig_price', strikethrough: true },
            { type: 'text', text: '\u20b91,039', color: '#1e293b', fontSize: 56, bold: true, align: 'center', x: 400, y: 455, id: 'final_price' },
            { type: 'text', text: 'You save \u20b9260 today!', color: '#16a34a', fontSize: 18, bold: false, align: 'center', x: 400, y: 495, id: 'save_text' },
            { type: 'shape', shape: 'rect', color: '#f97316', x: 180, y: 530, w: 440, h: 52, radius: 26 },
            { type: 'text', text: 'Grab Now', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 563, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#64748b', fontSize: 14, bold: false, align: 'center', x: 400, y: 628, id: 'outlet_name' },
            { type: 'text', text: 'Sandbox Flow \u00b7 Demo Simulation', color: '#94a3b8', fontSize: 11, bold: false, align: 'center', x: 400, y: 655 },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'cashback_offer', name: 'Cashback Offer', category: 'offers',
        accent: '#10b981', description: 'Green cashback promotion',
        preview: { bg: '#ecfdf5', badge: '#10b981', headline: 'CASHBACK', sub: '\u20b950 on \u20b9500', price: '', cta: 'Claim Now' },
        layers: [
            { type: 'background', color: '#ecfdf5', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#10b981', x: 0, y: 0, w: 800, h: 185, radius: 0 },
            { type: 'badge', text: '\ud83d\udcb0  CASHBACK OFFER  \ud83d\udcb0', color: 'rgba(0,0,0,0.15)', textColor: '#ffffff', x: 140, y: 22, w: 520, h: 34, fontSize: 14 },
            { type: 'text', text: 'CASHBACK', color: '#ffffff', fontSize: 64, bold: true, align: 'center', x: 400, y: 143, id: 'headline' },
            { type: 'text', text: '\u20b950 on \u20b9500+', color: '#065f46', fontSize: 38, bold: true, align: 'center', x: 400, y: 255, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 80, y: 285, w: 640, h: 275, radius: 18 },
            { type: 'text', text: '\u2713 On every Money Transfer above \u20b9500', color: '#064e3b', fontSize: 18, align: 'left', x: 110, y: 335 },
            { type: 'text', text: '\u2713 Valid on AePS & Recharge too', color: '#064e3b', fontSize: 18, align: 'left', x: 110, y: 380 },
            { type: 'text', text: '\u2713 Instant credit \u2014 no waiting', color: '#064e3b', fontSize: 18, align: 'left', x: 110, y: 425 },
            { type: 'text', text: '\u2713 Limited period \u2014 hurry!', color: '#064e3b', fontSize: 18, align: 'left', x: 110, y: 470 },
            { type: 'shape', shape: 'rect', color: '#10b981', x: 160, y: 592, w: 480, h: 52, radius: 26 },
            { type: 'text', text: 'Claim Now', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 625, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#374151', fontSize: 14, align: 'center', x: 400, y: 682, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'discount_offer', name: 'Discount Offer', category: 'offers',
        accent: '#ef4444', description: 'Bold red discount burst',
        preview: { bg: '#1e293b', badge: '#ef4444', headline: 'BIG DISCOUNT', sub: 'Up to 30% OFF', price: '', cta: 'Shop Now' },
        layers: [
            { type: 'background', color: '#1e293b', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#ef4444', x: 0, y: 0, w: 800, h: 160, radius: 0 },
            { type: 'badge', text: '\ud83d\udd25  HOT DEAL  \ud83d\udd25', color: 'rgba(0,0,0,0.2)', textColor: '#ffffff', x: 220, y: 18, w: 360, h: 34, fontSize: 14 },
            { type: 'text', text: 'BIG DISCOUNT', color: '#ffffff', fontSize: 54, bold: true, align: 'center', x: 400, y: 128, id: 'headline' },
            { type: 'text', text: 'Up to 30% OFF', color: '#fbbf24', fontSize: 36, bold: true, align: 'center', x: 400, y: 228, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#334155', x: 60, y: 262, w: 680, h: 320, radius: 18 },
            { type: 'text', text: '\u20b91,299', color: '#94a3b8', fontSize: 26, bold: false, align: 'center', x: 400, y: 338, id: 'orig_price', strikethrough: true },
            { type: 'text', text: '\u20b9909', color: '#f1f5f9', fontSize: 64, bold: true, align: 'center', x: 400, y: 428, id: 'final_price' },
            { type: 'text', text: 'You save \u20b9390!', color: '#4ade80', fontSize: 20, bold: false, align: 'center', x: 400, y: 476, id: 'save_text' },
            { type: 'shape', shape: 'rect', color: '#ef4444', x: 180, y: 622, w: 440, h: 52, radius: 26 },
            { type: 'text', text: 'Shop Now', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 655, id: 'cta' },
            { type: 'text', text: 'Sandbox Flow \u00b7 Demo Simulation', color: '#64748b', fontSize: 11, align: 'center', x: 400, y: 716 },
            { type: 'text', text: 'Paras General Store', color: '#94a3b8', fontSize: 13, align: 'center', x: 400, y: 740, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'limited_time', name: 'Limited Time Offer', category: 'offers',
        accent: '#7c3aed', description: 'Urgent purple countdown feel',
        preview: { bg: '#4c1d95', badge: '#7c3aed', headline: 'HURRY!', sub: 'Offer ends soon', price: '', cta: 'Avail Now' },
        layers: [
            { type: 'background', color: '#4c1d95', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#6d28d9', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: '\u23f0  LIMITED TIME  \u23f0', color: '#fbbf24', textColor: '#1e293b', x: 180, y: 70, w: 440, h: 36, fontSize: 14 },
            { type: 'text', text: 'HURRY!', color: '#fbbf24', fontSize: 72, bold: true, align: 'center', x: 400, y: 178, id: 'headline' },
            { type: 'text', text: 'Offer ends soon', color: '#e9d5ff', fontSize: 28, bold: true, align: 'center', x: 400, y: 248, id: 'sub' },
            { type: 'shape', shape: 'rect', color: 'rgba(0,0,0,0.3)', x: 100, y: 278, w: 600, h: 260, radius: 16 },
            { type: 'text', text: '\u20b91,499', color: '#a78bfa', fontSize: 24, bold: false, align: 'center', x: 400, y: 338, id: 'orig_price', strikethrough: true },
            { type: 'text', text: '\u20b91,049', color: '#f9fafb', fontSize: 62, bold: true, align: 'center', x: 400, y: 428, id: 'final_price' },
            { type: 'text', text: 'Saving \u20b9450 \u2014 Today Only!', color: '#86efac', fontSize: 20, bold: false, align: 'center', x: 400, y: 478, id: 'save_text' },
            { type: 'shape', shape: 'rect', color: '#fbbf24', x: 160, y: 573, w: 480, h: 52, radius: 26 },
            { type: 'text', text: 'Avail Now', color: '#1e293b', fontSize: 22, bold: true, align: 'center', x: 400, y: 606, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#c4b5fd', fontSize: 14, align: 'center', x: 400, y: 680, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    // === DMT ===
    {
        id: 'dmt', name: 'Money Transfer (DMT)', category: 'dmt',
        accent: '#2563eb', description: '24x7 IMPS transfer banner',
        preview: { bg: '#1e3a8a', badge: '#2563eb', headline: 'IMPS', sub: 'Send Money Fast', price: '', cta: 'Transfer Now' },
        layers: [
            { type: 'background', color: '#1e3a8a', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: 'EKO AUTHORIZED BANKING POINT', color: '#2563eb', textColor: '#ffffff', x: 80, y: 70, w: 640, h: 40, fontSize: 16 },
            { type: 'text', text: '\u0926\u0947\u0936 \u092d\u0930 \u092e\u0947\u0902 \u0915\u093f\u0938\u0940 \u092d\u0940 \u092c\u0948\u0902\u0915 \u092e\u0947\u0902 \u0924\u0941\u0930\u0902\u0924 \u092a\u0948\u0938\u093e \u092d\u0947\u091c\u0947\u0902', color: '#1e293b', fontSize: 28, bold: true, align: 'center', x: 400, y: 158, id: 'headline' },
            { type: 'text', text: '24x7 IMPS \u0938\u0941\u092a\u0930\u092b\u093c\u093e\u0938\u094d\u091f \u092e\u0928\u0940 \u091f\u094d\u0930\u093e\u0902\u0938\u092b\u093c\u0930 \u0938\u0947\u0935\u093e', color: '#2563eb', fontSize: 20, bold: true, align: 'center', x: 400, y: 208, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#f8fafc', x: 80, y: 252, w: 640, h: 272, radius: 16, border: '#e2e8f0' },
            { type: 'text', text: '\u2713 5 \u0938\u0947\u0915\u0902\u0921 \u092e\u0947\u0902 \u092a\u0948\u0938\u093e \u0938\u0940\u0927\u0947 \u0916\u093e\u0924\u0947 \u092e\u0947\u0902', color: '#334155', fontSize: 18, align: 'left', x: 115, y: 302 },
            { type: 'text', text: '\u2713 \u0938\u092d\u0940 \u0938\u0930\u0915\u093e\u0930\u0940 \u0935 \u092a\u094d\u0930\u093e\u0907\u0935\u0947\u091f \u092c\u0948\u0902\u0915\u094b\u0902 \u092e\u0947\u0902', color: '#334155', fontSize: 18, align: 'left', x: 115, y: 352 },
            { type: 'text', text: '\u2713 SMS \u0926\u094d\u0935\u093e\u0930\u093e \u0924\u0941\u0930\u0902\u0924 \u092a\u0941\u0937\u094d\u091f\u093f \u0935 \u092a\u0915\u094d\u0915\u0940 \u0930\u0938\u0940\u0926', color: '#334155', fontSize: 18, align: 'left', x: 115, y: 402 },
            { type: 'text', text: '\u2713 100% \u0938\u0941\u0930\u0915\u094d\u0937\u093f\u0924 \u2014 RBI \u092a\u094d\u0930\u092e\u093e\u0923\u093f\u0924', color: '#334155', fontSize: 18, align: 'left', x: 115, y: 452 },
            { type: 'shape', shape: 'rect', color: '#16a34a', x: 80, y: 552, w: 640, h: 70, radius: 12 },
            { type: 'text', text: '\u0906\u091c \u0939\u0940 \u0905\u092a\u0928\u0947 \u0928\u095c\u0926\u0940\u0915\u0940 \u0915\u0947\u0902\u0926\u094d\u0930 \u092a\u0930 \u092a\u0927\u093e\u0930\u0947\u0902', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 597, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point \u00b7 Eko Partner', color: '#64748b', fontSize: 14, align: 'center', x: 400, y: 678, id: 'outlet_name' },
            { type: 'text', text: 'Sandbox Flow \u00b7 Demo Simulation', color: '#94a3b8', fontSize: 11, align: 'center', x: 400, y: 698 },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'fast_transfer', name: 'Fast Money Transfer', category: 'dmt',
        accent: '#0ea5e9', description: 'Modern fintech gradient style',
        preview: { bg: '#0c4a6e', badge: '#0ea5e9', headline: 'FAST TRANSFER', sub: 'Send in Seconds', price: '', cta: 'Send Now' },
        layers: [
            { type: 'background', color: '#0c4a6e', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#0369a1', x: 0, y: 0, w: 800, h: 278, radius: 0 },
            { type: 'text', text: '\u26a1 FAST TRANSFER', color: '#ffffff', fontSize: 52, bold: true, align: 'center', x: 400, y: 108, id: 'headline' },
            { type: 'text', text: 'Send Money Anywhere in Seconds', color: '#bae6fd', fontSize: 22, bold: false, align: 'center', x: 400, y: 163, id: 'sub' },
            { type: 'shape', shape: 'rect', color: 'rgba(0,0,0,0.25)', x: 30, y: 198, w: 340, h: 130, radius: 16 },
            { type: 'shape', shape: 'rect', color: 'rgba(0,0,0,0.25)', x: 430, y: 198, w: 340, h: 130, radius: 16 },
            { type: 'text', text: '1 Lakh+', color: '#38bdf8', fontSize: 34, bold: true, align: 'center', x: 200, y: 268 },
            { type: 'text', text: 'Customers Served', color: '#e0f2fe', fontSize: 14, align: 'center', x: 200, y: 308 },
            { type: 'text', text: '5 Sec', color: '#38bdf8', fontSize: 34, bold: true, align: 'center', x: 600, y: 268 },
            { type: 'text', text: 'Transfer Time', color: '#e0f2fe', fontSize: 14, align: 'center', x: 600, y: 308 },
            { type: 'shape', shape: 'rect', color: '#0f172a', x: 40, y: 358, w: 720, h: 272, radius: 18 },
            { type: 'text', text: '\u2713 IMPS / NEFT / RTGS \u2014 All Banks', color: '#bfdbfe', fontSize: 18, align: 'left', x: 75, y: 408 },
            { type: 'text', text: '\u2713 Instant transaction confirmation SMS', color: '#bfdbfe', fontSize: 18, align: 'left', x: 75, y: 453 },
            { type: 'text', text: '\u2713 Zero network downtime guarantee', color: '#bfdbfe', fontSize: 18, align: 'left', x: 75, y: 498 },
            { type: 'text', text: '\u2713 Open 365 days \u2014 Sundays too!', color: '#bfdbfe', fontSize: 18, align: 'left', x: 75, y: 543 },
            { type: 'shape', shape: 'rect', color: '#0ea5e9', x: 180, y: 658, w: 440, h: 52, radius: 26 },
            { type: 'text', text: 'Send Now', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 691, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#64748b', fontSize: 13, align: 'center', x: 400, y: 742, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    // === AePS ===
    {
        id: 'aeps', name: 'Aadhaar Banking (AePS)', category: 'aeps',
        accent: '#059669', description: 'Biometric ATM poster',
        preview: { bg: '#064e3b', badge: '#059669', headline: 'AADHAAR ATM', sub: 'Cash Withdrawal', price: '', cta: 'Visit Us' },
        layers: [
            { type: 'background', color: '#064e3b', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: 'AADHAAR MICRO-ATM & DIGITAL CSP', color: '#059669', textColor: '#ffffff', x: 80, y: 70, w: 640, h: 40, fontSize: 16 },
            { type: 'text', text: '\u0906\u0927\u093e\u0930 \u0938\u0947 \u0930\u0941\u092a\u092f\u093e \u0928\u093f\u0915\u093e\u0932\u0947\u0902', color: '#064e3b', fontSize: 36, bold: true, align: 'center', x: 400, y: 163, id: 'headline' },
            { type: 'text', text: '\u092c\u093f\u0928\u093e ATM \u0915\u093e\u0930\u094d\u0921 \u2014 \u0938\u093f\u0930\u094d\u092b \u0905\u0902\u0917\u0942\u0920\u0947 \u0915\u0947 \u0928\u093f\u0936\u093e\u0928 \u0938\u0947', color: '#059669', fontSize: 20, bold: true, align: 'center', x: 400, y: 213, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#f0fdf4', x: 80, y: 253, w: 640, h: 272, radius: 16, border: '#bbf7d0' },
            { type: 'text', text: '\u2713 \u0915\u093f\u0938\u0940 \u092d\u0940 \u092c\u0948\u0902\u0915 \u0938\u0947 \u0924\u0941\u0930\u0902\u0924 \u0915\u0948\u0936 \u0928\u093f\u0915\u093e\u0938\u0940', color: '#166534', fontSize: 18, align: 'left', x: 115, y: 303 },
            { type: 'text', text: '\u2713 \u092b\u094d\u0930\u0940 \u092c\u0948\u0932\u0947\u0902\u0938 \u0907\u0928\u094d\u0915\u094d\u0935\u093e\u092f\u0930\u0940 \u0935 \u092e\u093f\u0928\u0940 \u0938\u094d\u091f\u0947\u091f\u092e\u0947\u0902\u091f', color: '#166534', fontSize: 18, align: 'left', x: 115, y: 353 },
            { type: 'text', text: '\u2713 \u092a\u0947\u0902\u0936\u0928, \u091b\u093e\u0924\u094d\u0930\u0935\u0943\u0924\u094d\u0924\u093f \u0935 \u0938\u0930\u0915\u093e\u0930\u0940 \u0905\u0928\u0941\u0926\u093e\u0928', color: '#166534', fontSize: 18, align: 'left', x: 115, y: 403 },
            { type: 'text', text: '\u2713 \u092c\u093f\u0928\u093e \u0921\u0947\u092c\u093f\u091f \u0915\u093e\u0930\u094d\u0921 \u2014 100% \u0938\u0941\u0930\u0915\u094d\u0937\u093f\u0924', color: '#166534', fontSize: 18, align: 'left', x: 115, y: 453 },
            { type: 'shape', shape: 'rect', color: '#059669', x: 80, y: 553, w: 640, h: 70, radius: 12 },
            { type: 'text', text: '\u0938\u0930\u094d\u0935\u093f\u0938 \u091a\u093e\u0930\u094d\u091c: \u20b90 \u00b7 \u0924\u0941\u0930\u0902\u0924 \u0930\u0938\u0940\u0926 \u0909\u092a\u0932\u092c\u094d\u0927', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 598, id: 'cta' },
            { type: 'text', text: 'Sharma Telecom & Digital Seva \u00b7 Eko Authorized AePS', color: '#64748b', fontSize: 14, align: 'center', x: 400, y: 678, id: 'outlet_name' },
            { type: 'text', text: 'Sandbox Flow \u00b7 Demo Simulation', color: '#94a3b8', fontSize: 11, align: 'center', x: 400, y: 698 },
            ekoBrandingLayer()
        ]
    },
    // === RECHARGE & BBPS ===
    {
        id: 'recharge', name: 'Mobile Recharge', category: 'recharge',
        accent: '#7c3aed', description: 'All-operator recharge hub',
        preview: { bg: '#4c1d95', badge: '#7c3aed', headline: 'RECHARGE', sub: 'Jio \u00b7 Airtel \u00b7 Vi', price: '', cta: 'Recharge Now' },
        layers: [
            { type: 'background', color: '#4c1d95', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: 'ALL-IN-ONE DIGITAL RECHARGE HUB', color: '#7c3aed', textColor: '#ffffff', x: 80, y: 70, w: 640, h: 40, fontSize: 16 },
            { type: 'text', text: '\u0938\u092d\u0940 \u0938\u093f\u092e \u0935 DTH \u0915\u093e \u0938\u0941\u092a\u0930\u092b\u093c\u093e\u0938\u094d\u091f \u0930\u093f\u091a\u093e\u0930\u094d\u091c', color: '#4c1d95', fontSize: 30, bold: true, align: 'center', x: 400, y: 163, id: 'headline' },
            { type: 'text', text: 'Jio \u00b7 Airtel \u00b7 Vi \u00b7 BSNL \u00b7 Tata Play', color: '#7c3aed', fontSize: 22, bold: true, align: 'center', x: 400, y: 213, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#f5f3ff', x: 80, y: 253, w: 640, h: 272, radius: 16, border: '#ddd6fe' },
            { type: 'text', text: '\u2713 5G \u0905\u0928\u0932\u093f\u092e\u093f\u091f\u0947\u0921 \u0921\u0947\u091f\u093e \u090f\u0935\u0902 \u0915\u0949\u0932\u093f\u0902\u0917 \u092a\u0948\u0915\u094d\u0938', color: '#5b21b6', fontSize: 18, align: 'left', x: 115, y: 303 },
            { type: 'text', text: '\u2713 OTT \u092c\u0902\u0921\u0932 \u092a\u0948\u0915\u094d\u0938 (Disney+, Prime)', color: '#5b21b6', fontSize: 18, align: 'left', x: 115, y: 353 },
            { type: 'text', text: '\u2713 DTH \u0930\u093f\u091a\u093e\u0930\u094d\u091c \u092a\u0930 \u0935\u093f\u0936\u0947\u0937 \u092e\u0902\u0925\u0932\u0940 \u091b\u0942\u091f', color: '#5b21b6', fontSize: 18, align: 'left', x: 115, y: 403 },
            { type: 'text', text: '\u2713 \u092c\u0947\u0938\u094d\u091f \u0911\u092b\u093c\u0930 \u091a\u0947\u0915 \u0915\u0930\u0947\u0902 \u0914\u0930 \u092c\u091a\u0924 \u0915\u0930\u0947\u0902', color: '#5b21b6', fontSize: 18, align: 'left', x: 115, y: 453 },
            { type: 'shape', shape: 'rect', color: '#7c3aed', x: 80, y: 553, w: 640, h: 70, radius: 12 },
            { type: 'text', text: '\u0924\u0941\u0930\u0902\u0924 \u0930\u093f\u091a\u093e\u0930\u094d\u091c \u00b7 \u091c\u093c\u0940\u0930\u094b \u092b\u0947\u0932\u093f\u092f\u0930 \u0917\u093e\u0930\u0902\u091f\u0940', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 598, id: 'cta' },
            { type: 'text', text: 'Gupta Daily Mart & CSP \u00b7 Digital Services', color: '#64748b', fontSize: 14, align: 'center', x: 400, y: 678, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'bill_payment', name: 'Bill Payment (BBPS)', category: 'recharge',
        accent: '#d97706', description: 'Electricity & utility bills',
        preview: { bg: '#78350f', badge: '#d97706', headline: 'BILL PAY', sub: 'All Utilities', price: '', cta: 'Pay Now' },
        layers: [
            { type: 'background', color: '#78350f', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: 'BHARAT BILL PAYMENT SYSTEM (BBPS)', color: '#d97706', textColor: '#ffffff', x: 80, y: 70, w: 640, h: 40, fontSize: 16 },
            { type: 'text', text: '\u0938\u092d\u0940 \u092c\u093f\u091c\u0932\u0940, \u092a\u093e\u0928\u0940 \u0935 \u0917\u0948\u0938 \u092c\u093f\u0932 \u092f\u0939\u093e\u0901 \u092d\u0930\u0947\u0902', color: '#78350f', fontSize: 30, bold: true, align: 'center', x: 400, y: 163, id: 'headline' },
            { type: 'text', text: '\u0905\u0927\u093f\u0915\u0943\u0924 \u0921\u093f\u091c\u093f\u091f\u0932 \u0915\u093e\u0909\u0902\u091f\u0930 \u00b7 \u0924\u0941\u0930\u0902\u0924 \u092a\u0915\u094d\u0915\u0940 \u0930\u0938\u0940\u0926', color: '#d97706', fontSize: 19, bold: true, align: 'center', x: 400, y: 213, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#fffbeb', x: 80, y: 253, w: 640, h: 272, radius: 16, border: '#fde68a' },
            { type: 'text', text: '\u2713 \u092c\u093f\u091c\u0932\u0940 \u092c\u093f\u0932 (BSES, Tata Power, UPPCL)', color: '#92400e', fontSize: 18, align: 'left', x: 115, y: 303 },
            { type: 'text', text: '\u2713 \u092a\u093e\u0928\u0940 \u0935 \u0938\u0940\u0935\u0930 \u092c\u093f\u0932 \u092d\u0941\u0917\u0924\u093e\u0928', color: '#92400e', fontSize: 18, align: 'left', x: 115, y: 353 },
            { type: 'text', text: '\u2713 \u092a\u093e\u0907\u092a\u094d\u0921 \u0917\u0948\u0938 \u0935 LPG \u0938\u093f\u0932\u0947\u0902\u0921\u0930 \u092c\u0941\u0915\u093f\u0902\u0917', color: '#92400e', fontSize: 18, align: 'left', x: 115, y: 403 },
            { type: 'text', text: '\u2713 \u092c\u094d\u0930\u0949\u0921\u092c\u0948\u0902\u0921, \u0932\u0948\u0902\u0921\u0932\u093e\u0907\u0928 \u0935 \u092a\u094b\u0938\u094d\u091f\u092a\u0947\u0921', color: '#92400e', fontSize: 18, align: 'left', x: 115, y: 453 },
            { type: 'shape', shape: 'rect', color: '#d97706', x: 80, y: 553, w: 640, h: 70, radius: 12 },
            { type: 'text', text: '\u0905\u0902\u0924\u093f\u092e \u0924\u093f\u0925\u093f \u0938\u0947 \u092a\u0939\u0932\u0947 \u2014 \u092c\u093f\u0928\u093e \u0932\u093e\u0907\u0928 \u0915\u0947', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 598, id: 'cta' },
            { type: 'text', text: 'Verma Communication \u00b7 Eko BBPS Collection Center', color: '#64748b', fontSize: 14, align: 'center', x: 400, y: 678, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    // === FESTIVAL ===
    {
        id: 'diwali', name: 'Diwali Festival', category: 'festival',
        accent: '#f59e0b', description: 'Festive gold & rose Diwali',
        preview: { bg: '#831843', badge: '#f59e0b', headline: '\ud83e\ude94 DIWALI', sub: 'Shubh Deepawali', price: '', cta: 'Celebrate!' },
        layers: [
            { type: 'background', color: '#831843', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#fff1f2', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: '\ud83e\ude94  DIWALI SPECIAL GREETINGS & OFFERS  \ud83e\ude94', color: '#be123c', textColor: '#ffffff', x: 60, y: 70, w: 680, h: 40, fontSize: 14 },
            { type: 'text', text: '\u0936\u0941\u092d \u0926\u0940\u092a\u093e\u0935\u0932\u0940!', color: '#881337', fontSize: 52, bold: true, align: 'center', x: 400, y: 173, id: 'headline' },
            { type: 'text', text: '\u0906\u092a\u0915\u094b \u0914\u0930 \u0906\u092a\u0915\u0947 \u092a\u0930\u093f\u0935\u093e\u0930 \u0915\u094b \u0926\u0940\u092a\u093e\u0935\u0932\u0940 \u0915\u0940 \u0939\u093e\u0930\u094d\u0926\u093f\u0915 \u0936\u0941\u092d\u0915\u093e\u092e\u0928\u093e\u090f\u0902', color: '#be123c', fontSize: 17, bold: false, align: 'center', x: 400, y: 228, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 80, y: 253, w: 640, h: 272, radius: 16, border: '#fecdd3' },
            { type: 'text', text: '\u2605 \u0918\u0930 \u092c\u0948\u0920\u0947 \u0926\u0947\u0936 \u092d\u0930 \u092e\u0947\u0902 \u092e\u0928\u0940 \u091f\u094d\u0930\u093e\u0902\u0938\u092b\u093c\u0930', color: '#9f1239', fontSize: 19, align: 'left', x: 115, y: 313 },
            { type: 'text', text: '\u2605 \u0906\u0927\u093e\u0930 \u0938\u0947 \u0924\u0941\u0930\u0902\u0924 \u0928\u0915\u0926 \u0928\u093f\u0915\u093e\u0938\u0940 (AePS)', color: '#9f1239', fontSize: 19, align: 'left', x: 115, y: 368 },
            { type: 'text', text: '\u2605 \u0926\u0940\u092a\u093e\u0935\u0932\u0940 \u092a\u0930 24 \u0918\u0902\u091f\u0947 \u0928\u093f\u0930\u094d\u092c\u093e\u0927 \u0938\u0947\u0935\u093e', color: '#9f1239', fontSize: 19, align: 'left', x: 115, y: 423 },
            { type: 'text', text: '\u2605 \u0938\u092d\u0940 \u092c\u093f\u0932 \u0924\u0941\u0930\u0902\u0924 \u2014 \u0915\u094b\u0908 \u0932\u093e\u0907\u0928 \u0928\u0939\u0940\u0902!', color: '#9f1239', fontSize: 19, align: 'left', x: 115, y: 478 },
            { type: 'shape', shape: 'rect', color: '#be123c', x: 80, y: 553, w: 640, h: 70, radius: 12 },
            { type: 'text', text: '\u0924\u094d\u092f\u094b\u0939\u093e\u0930 \u0915\u0940 \u0916\u0941\u0936\u093f\u092f\u093e\u0902 \u092c\u093e\u0902\u091f\u0947\u0902 \u2014 \u0938\u0947\u0935\u093e \u091c\u093e\u0930\u0940 \u0939\u0948!', color: '#ffffff', fontSize: 20, bold: true, align: 'center', x: 400, y: 598, id: 'cta' },
            { type: 'text', text: 'Eko Partner Network \u00b7 \u0906\u092a\u0915\u093e \u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0935\u093f\u0924\u094d\u0924\u0940\u092f \u0938\u093e\u0925\u0940', color: '#64748b', fontSize: 13, align: 'center', x: 400, y: 678, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'new_year', name: 'New Year Greeting', category: 'festival',
        accent: '#fbbf24', description: 'Golden New Year wishes',
        preview: { bg: '#0f172a', badge: '#fbbf24', headline: 'NEW YEAR', sub: 'Happy New Year 2026', price: '', cta: 'Celebrate!' },
        layers: [
            { type: 'background', color: '#0f172a', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#1e293b', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: '\ud83c\udf8a  HAPPY NEW YEAR  \ud83c\udf8a', color: '#fbbf24', textColor: '#0f172a', x: 160, y: 70, w: 480, h: 40, fontSize: 16 },
            { type: 'text', text: '\ud83c\udf8a \u0928\u092f\u093e \u0938\u093e\u0932 \u092e\u0941\u092c\u093e\u0930\u0915!', color: '#fbbf24', fontSize: 48, bold: true, align: 'center', x: 400, y: 183, id: 'headline' },
            { type: 'text', text: 'Happy New Year 2026', color: '#e2e8f0', fontSize: 28, bold: true, align: 'center', x: 400, y: 253, id: 'sub' },
            { type: 'shape', shape: 'rect', color: 'rgba(251,191,36,0.08)', x: 80, y: 283, w: 640, h: 242, radius: 16, border: '#fbbf24' },
            { type: 'text', text: '\u0928\u090f \u0938\u093e\u0932 \u092e\u0947\u0902 \u0906\u092a\u0915\u0940 \u0939\u0930 \u091c\u0930\u0942\u0930\u0924 \u0915\u093e \u0938\u093e\u0925\u0940', color: '#fbbf24', fontSize: 20, bold: true, align: 'center', x: 400, y: 338 },
            { type: 'text', text: '\u2726 \u092e\u0928\u0940 \u091f\u094d\u0930\u093e\u0902\u0938\u092b\u093c\u0930  \u2726 \u0906\u0927\u093e\u0930 ATM', color: '#cbd5e1', fontSize: 18, align: 'center', x: 400, y: 383 },
            { type: 'text', text: '\u2726 \u092c\u093f\u0932 \u092a\u0947\u092e\u0947\u0902\u091f  \u2726 \u092e\u094b\u092c\u093e\u0907\u0932 \u0930\u093f\u091a\u093e\u0930\u094d\u091c', color: '#cbd5e1', fontSize: 18, align: 'center', x: 400, y: 428 },
            { type: 'text', text: '\u2726 24x7 \u00b7 365 \u0926\u093f\u0928 \u00b7 \u092d\u0930\u094b\u0938\u0947\u092e\u0902\u0926 \u0938\u0947\u0935\u093e', color: '#cbd5e1', fontSize: 18, align: 'center', x: 400, y: 473 },
            { type: 'shape', shape: 'rect', color: '#fbbf24', x: 160, y: 558, w: 480, h: 52, radius: 26 },
            { type: 'text', text: '\u0928\u090f \u0938\u093e\u0932 \u092e\u0947\u0902 \u0928\u0908 \u0936\u0941\u0930\u0941\u0906\u0924 \u0915\u0930\u0947\u0902!', color: '#0f172a', fontSize: 20, bold: true, align: 'center', x: 400, y: 591, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#64748b', fontSize: 13, align: 'center', x: 400, y: 658, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    // === PARTNER PROMOTION ===
    {
        id: 'announcement', name: 'Partner Announcement', category: 'promotion',
        accent: '#0284c7', description: 'New service / opening notice',
        preview: { bg: '#0f172a', badge: '#0284c7', headline: 'NEW SERVICE', sub: 'Now Available Here', price: '', cta: 'Contact Us' },
        layers: [
            { type: 'background', color: '#0f172a', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 40, y: 40, w: 720, h: 720, radius: 24 },
            { type: 'badge', text: 'IMPORTANT CUSTOMER NOTICE', color: '#0284c7', textColor: '#ffffff', x: 80, y: 70, w: 640, h: 40, fontSize: 16 },
            { type: 'text', text: '\u0928\u092f\u093e \u0921\u093f\u091c\u093f\u091f\u0932 \u092c\u0948\u0902\u0915\u093f\u0902\u0917 \u0915\u093e\u0909\u0902\u091f\u0930 \u0916\u0941\u0932\u093e', color: '#0f172a', fontSize: 32, bold: true, align: 'center', x: 400, y: 163, id: 'headline' },
            { type: 'text', text: '\u0938\u092d\u0940 \u0938\u0930\u0915\u093e\u0930\u0940 \u0935 \u092c\u0948\u0902\u0915\u093f\u0902\u0917 \u0938\u0947\u0935\u093e\u090f\u0902 \u0905\u092c \u092f\u0939\u093e\u0901!', color: '#0284c7', fontSize: 20, bold: true, align: 'center', x: 400, y: 213, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#f0f9ff', x: 80, y: 253, w: 640, h: 272, radius: 16, border: '#bae6fd' },
            { type: 'text', text: '\u2022 \u0938\u092e\u092f: \u0938\u0941\u092c\u0939 8:00 \u0938\u0947 \u0930\u093e\u0924 9:00 \u092c\u091c\u0947 \u0924\u0915', color: '#0369a1', fontSize: 17, align: 'left', x: 115, y: 303 },
            { type: 'text', text: '\u2022 \u092e\u0928\u0940 \u091f\u094d\u0930\u093e\u0902\u0938\u092b\u093c\u0930, \u0906\u0927\u093e\u0930 ATM, \u092a\u0948\u0928 \u0915\u093e\u0930\u094d\u0921', color: '#0369a1', fontSize: 17, align: 'left', x: 115, y: 348 },
            { type: 'text', text: '\u2022 \u092c\u093f\u0932 \u092d\u0941\u0917\u0924\u093e\u0928 \u2014 \u0924\u094d\u0935\u0930\u093f\u0924 \u0938\u0947\u0935\u093e \u0935 \u0930\u0938\u0940\u0926', color: '#0369a1', fontSize: 17, align: 'left', x: 115, y: 393 },
            { type: 'text', text: '\u2022 \u0935\u0930\u093f\u0937\u094d\u0920 \u0928\u093e\u0917\u0930\u093f\u0915\u094b\u0902 \u0915\u0947 \u0932\u093f\u090f \u0935\u093f\u0936\u0947\u0937 \u0938\u0939\u093e\u092f\u0924\u093e', color: '#0369a1', fontSize: 17, align: 'left', x: 115, y: 438 },
            { type: 'text', text: '\u2022 \u0930\u0935\u093f\u0935\u093e\u0930 \u092d\u0940 \u0916\u0941\u0932\u093e \u2014 \u0915\u094b\u0908 \u0905\u0924\u093f\u0930\u093f\u0915\u094d\u0924 \u0936\u0941\u0932\u094d\u0915 \u0928\u0939\u0940\u0902', color: '#0369a1', fontSize: 17, align: 'left', x: 115, y: 483 },
            { type: 'shape', shape: 'rect', color: '#0284c7', x: 80, y: 553, w: 640, h: 70, radius: 12 },
            { type: 'text', text: '\u0906\u091c \u0939\u0940 \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902 \u00b7 \u0906\u092a\u0915\u093e \u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0915\u0947\u0902\u0926\u094d\u0930', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 598, id: 'cta' },
            { type: 'text', text: 'Metro Digital Seva & Banking Point \u00b7 Eko Certified', color: '#64748b', fontSize: 14, align: 'center', x: 400, y: 678, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    // === CUSTOMER ENGAGEMENT ===
    {
        id: 'visit_store', name: 'Visit Our Store', category: 'engagement',
        accent: '#0891b2', description: 'Store promotion card',
        preview: { bg: '#164e63', badge: '#0891b2', headline: 'VISIT US', sub: 'All Services Here', price: '', cta: 'Come In Today' },
        layers: [
            { type: 'background', color: '#164e63', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#0e7490', x: 0, y: 0, w: 800, h: 200, radius: 0 },
            { type: 'text', text: '\ud83c\udfea VISIT OUR STORE', color: '#ffffff', fontSize: 48, bold: true, align: 'center', x: 400, y: 113, id: 'headline' },
            { type: 'text', text: 'All Financial Services Under One Roof', color: '#a5f3fc', fontSize: 22, bold: false, align: 'center', x: 400, y: 163, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#f0fdff', x: 50, y: 218, w: 700, h: 360, radius: 20 },
            { type: 'text', text: 'Our Services:', color: '#0e7490', fontSize: 20, bold: true, align: 'left', x: 90, y: 270 },
            { type: 'text', text: '\ud83d\udcb8 Send Money (IMPS / NEFT)', color: '#0f172a', fontSize: 18, align: 'left', x: 90, y: 313 },
            { type: 'text', text: '\ud83c\udfe6 Aadhaar ATM \u2014 Instant Cash', color: '#0f172a', fontSize: 18, align: 'left', x: 90, y: 356 },
            { type: 'text', text: '\ud83d\udcf1 Mobile & DTH Recharge', color: '#0f172a', fontSize: 18, align: 'left', x: 90, y: 399 },
            { type: 'text', text: '\ud83e\uddfe Electricity & Utility Bill Pay', color: '#0f172a', fontSize: 18, align: 'left', x: 90, y: 442 },
            { type: 'text', text: '\ud83d\udd57 Open Mon\u2013Sun  8 AM \u2013 9 PM', color: '#0369a1', fontSize: 16, bold: true, align: 'left', x: 90, y: 485 },
            { type: 'text', text: '\ud83d\udcde Call: 9876-543-210', color: '#0369a1', fontSize: 16, bold: false, align: 'left', x: 90, y: 528 },
            { type: 'shape', shape: 'rect', color: '#0891b2', x: 170, y: 613, w: 460, h: 52, radius: 26 },
            { type: 'text', text: 'Come In Today', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 646, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#a5f3fc', fontSize: 13, align: 'center', x: 400, y: 708, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'thank_you', name: 'Thank You Card', category: 'engagement',
        accent: '#ec4899', description: 'Customer gratitude card',
        preview: { bg: '#fdf2f8', badge: '#ec4899', headline: 'THANK YOU!', sub: '1 Lakh Customers', price: '', cta: 'Stay With Us' },
        layers: [
            { type: 'background', color: '#fdf2f8', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#ec4899', x: 0, y: 0, w: 800, h: 190, radius: 0 },
            { type: 'badge', text: '\ud83c\udf89  MILESTONE ACHIEVEMENT  \ud83c\udf89', color: 'rgba(0,0,0,0.15)', textColor: '#ffffff', x: 120, y: 22, w: 560, h: 34, fontSize: 14 },
            { type: 'text', text: 'THANK YOU!', color: '#ffffff', fontSize: 64, bold: true, align: 'center', x: 400, y: 146, id: 'headline' },
            { type: 'text', text: '1,00,000 \u0938\u0947 \u0905\u0927\u093f\u0915 \u0917\u094d\u0930\u093e\u0939\u0915\u094b\u0902 \u0915\u093e \u0935\u093f\u0936\u094d\u0935\u093e\u0938', color: '#be185d', fontSize: 24, bold: true, align: 'center', x: 400, y: 248, id: 'sub' },
            { type: 'shape', shape: 'rect', color: '#ffffff', x: 60, y: 278, w: 680, h: 262, radius: 18, border: '#fbcfe8' },
            { type: 'text', text: '\u0906\u092a\u0915\u0947 \u092d\u0930\u094b\u0938\u0947 \u0914\u0930 \u0938\u093e\u0925 \u0915\u0947 \u0932\u093f\u090f \u0927\u0928\u094d\u092f\u0935\u093e\u0926!', color: '#831843', fontSize: 22, bold: true, align: 'center', x: 400, y: 343 },
            { type: 'text', text: '\u0939\u092e \u0906\u092a\u0915\u0940 \u0938\u0947\u0935\u093e \u092e\u0947\u0902 \u0938\u0926\u0948\u0935 \u0924\u0924\u094d\u092a\u0930 \u0939\u0948\u0902\u0964', color: '#9f1239', fontSize: 18, align: 'center', x: 400, y: 393 },
            { type: 'text', text: '\u0906\u0917\u0947 \u092d\u0940 \u0910\u0938\u0947 \u0939\u0940 \u0935\u093f\u0936\u094d\u0935\u093e\u0938 \u092c\u0928\u093e\u090f \u0930\u0916\u0947\u0902\u0964', color: '#9f1239', fontSize: 18, align: 'center', x: 400, y: 438 },
            { type: 'text', text: '\u2764\ufe0f  \u0906\u092a\u0915\u0940 \u0938\u0947\u0935\u093e \u092e\u0947\u0902 \u2014 Eko Partner', color: '#be185d', fontSize: 16, bold: true, align: 'center', x: 400, y: 493 },
            { type: 'shape', shape: 'rect', color: '#ec4899', x: 170, y: 568, w: 460, h: 52, radius: 26 },
            { type: 'text', text: 'Stay With Us Always', color: '#ffffff', fontSize: 22, bold: true, align: 'center', x: 400, y: 601, id: 'cta' },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#9ca3af', fontSize: 13, align: 'center', x: 400, y: 678, id: 'outlet_name' },
            ekoBrandingLayer()
        ]
    },
    {
        id: 'minimal_promo', name: 'Minimal Store Promo', category: 'promotion',
        accent: '#1e293b', description: 'Clean minimal professional style',
        preview: { bg: '#f8fafc', badge: '#1e293b', headline: 'EKO PARTNER', sub: 'Financial Services', price: '', cta: 'Visit Us' },
        layers: [
            { type: 'background', color: '#f8fafc', x: 0, y: 0, w: 800, h: 800 },
            { type: 'shape', shape: 'rect', color: '#1e293b', x: 0, y: 0, w: 8, h: 800, radius: 0 },
            { type: 'shape', shape: 'rect', color: '#1e293b', x: 0, y: 0, w: 800, h: 120, radius: 0 },
            { type: 'text', text: 'EKO PARTNER', color: '#ffffff', fontSize: 42, bold: true, align: 'left', x: 50, y: 73, id: 'headline' },
            { type: 'badge', text: 'AUTHORIZED FINANCIAL SERVICES', color: '#f97316', textColor: '#ffffff', x: 50, y: 143, w: 480, h: 32, fontSize: 13 },
            { type: 'text', text: 'Your Complete Digital Banking Point', color: '#1e293b', fontSize: 28, bold: true, align: 'left', x: 50, y: 238, id: 'sub' },
            { type: 'text', text: 'Trusted by 1,00,000+ customers across India', color: '#475569', fontSize: 16, align: 'left', x: 50, y: 278 },
            { type: 'shape', shape: 'rect', color: '#e2e8f0', x: 50, y: 303, w: 700, h: 1, radius: 0 },
            { type: 'text', text: '\u2192  Instant Money Transfer (IMPS / NEFT)', color: '#334155', fontSize: 18, align: 'left', x: 50, y: 348 },
            { type: 'text', text: '\u2192  Aadhaar ATM \u2014 No Card Needed', color: '#334155', fontSize: 18, align: 'left', x: 50, y: 393 },
            { type: 'text', text: '\u2192  Mobile & DTH Recharge', color: '#334155', fontSize: 18, align: 'left', x: 50, y: 438 },
            { type: 'text', text: '\u2192  Bill Payment (Electricity, Gas, Water)', color: '#334155', fontSize: 18, align: 'left', x: 50, y: 483 },
            { type: 'text', text: '\u2192  PAN Card \u00b7 Insurance \u00b7 Govt Services', color: '#334155', fontSize: 18, align: 'left', x: 50, y: 528 },
            { type: 'shape', shape: 'rect', color: '#e2e8f0', x: 50, y: 558, w: 700, h: 1, radius: 0 },
            { type: 'text', text: 'Paras General Store & Banking Point', color: '#0f172a', fontSize: 16, bold: true, align: 'left', x: 50, y: 598, id: 'outlet_name' },
            { type: 'text', text: 'Open Mon\u2013Sun  |  8 AM \u2013 9 PM', color: '#64748b', fontSize: 14, align: 'left', x: 50, y: 628 },
            { type: 'shape', shape: 'rect', color: '#f97316', x: 50, y: 658, w: 300, h: 48, radius: 24 },
            { type: 'text', text: 'Visit Us Today', color: '#ffffff', fontSize: 20, bold: true, align: 'center', x: 200, y: 688, id: 'cta' },
            { type: 'text', text: 'Sandbox Flow \u00b7 Demo Simulation', color: '#94a3b8', fontSize: 10, align: 'right', x: 748, y: 700 },
            ekoBrandingLayer()
        ]
    }
];

// ── Category definitions ───────────────────────────────────────────────────────

// ── Category definitions ───────────────────────────────────────────────────────

// ── Category definitions ───────────────────────────────────────────────────────
const CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'offers', label: 'Offers' },
    { id: 'dmt', label: 'DMT' },
    { id: 'aeps', label: 'AePS' },
    { id: 'recharge', label: 'Recharge' },
    { id: 'festival', label: 'Festival' },
    { id: 'promotion', label: 'Promotion' },
    { id: 'engagement', label: 'Engagement' }
];

function getFilteredTemplates() {
    return POSTER_TEMPLATES.filter(t => {
        const matchCat = _templateFilter === 'all' || t.category === _templateFilter;
        const q = _templateSearch.toLowerCase();
        const matchSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
        return matchCat && matchSearch;
    });
}

// ── Template Picker Modal ──────────────────────────────────────────────────────
function renderTemplatePicker() {
    const filtered = getFilteredTemplates();
    return `
    <div id="template-picker-modal" class="modal-overlay hidden" onclick="if(event.target===this)closeModal('template-picker-modal')">
        <div class="modal-card" style="max-width:880px; max-height:90vh; overflow:hidden; display:flex; flex-direction:column; border-radius:16px;">
            <div class="modal-header" style="flex-shrink:0; padding:16px 20px;">
                <div>
                    <h2 style="font-size:1.15rem; font-weight:700; margin:0;">Choose a Template</h2>
                    <p class="text-xs text-muted" style="margin:2px 0 0 0;">Start with a ready-made Eko design or create your own.</p>
                </div>
                <button class="modal-close" onclick="closeModal('template-picker-modal')">${renderIcon('x', 18)}</button>
            </div>
            <div style="flex-shrink:0; padding:12px 20px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:10px;">
                <div style="position:relative;">
                    <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);">${renderIcon('search', 15)}</span>
                    <input id="tmpl-search" class="form-input" style="padding-left:36px; font-size:13px; border-radius:20px;" placeholder="Search 15 templates..."
                        value="${escapeHtml(_templateSearch)}" oninput="_templateSearch=this.value; refreshTemplateGrid()">
                </div>
                <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none;">
                    ${CATEGORIES.map(c => `
                        <button onclick="_templateFilter='${c.id}'; refreshTemplateGrid()"
                            data-cat="${c.id}"
                            class="pe-tab-btn pe-filter-pill ${_templateFilter===c.id ? 'active' : ''}"
                            style="padding:4px 12px; font-size:11px;">${c.label}</button>
                    `).join('')}
                </div>
            </div>
            <div id="template-grid" style="overflow-y:auto; padding:16px 20px; flex:1;">
                ${renderTemplateGrid(filtered)}
            </div>
        </div>
    </div>`;
}

function renderTemplateGrid(templates) {
    if (!templates.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted);">${renderIcon('search',24)}<br><br>No templates match.</div>`;
    return `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(215px,1fr)); gap:14px;">
        ${templates.map(t => renderTemplateCard(t)).join('')}
    </div>`;
}

function renderTemplateCard(t) {
    const p = t.preview;
    const catBadge = CATEGORIES.find(c => c.id === t.category)?.label || t.category;
    return `
    <div class="card" style="padding:0; overflow:hidden; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; transition:transform 0.15s ease, box-shadow 0.15s ease; cursor:pointer;"
         onclick="loadPresetTemplate('${t.id}')">
        <div style="background:${p.bg}; height:140px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; position:relative; overflow:hidden;">
            ${p.badge ? `<span style="background:${p.badge}; color:#ffffff; font-size:9px; font-weight:700; padding:2px 7px; border-radius:10px; margin-bottom:4px;">${escapeHtml(p.badgeText||'OFFER')}</span>` : ''}
            <div style="font-weight:800; font-size:18px; color:#1e293b; text-align:center; line-height:1.1; margin-bottom:2px;">${escapeHtml(p.headline)}</div>
            ${p.sub ? `<div style="font-size:10px; color:#475569; text-align:center;">${escapeHtml(p.sub)}</div>` : ''}
            ${p.price ? `<div style="font-size:14px; font-weight:700; color:#059669; margin-top:2px;">${escapeHtml(p.price)}</div>` : ''}
            ${p.cta ? `<span style="background:${t.accent||'#2563eb'}; color:#fff; font-size:9px; font-weight:700; padding:3px 10px; border-radius:12px; margin-top:5px;">${escapeHtml(p.cta)}</span>` : ''}
            <span style="position:absolute; bottom:4px; right:8px; font-size:8px; color:rgba(0,0,0,0.35);">Made by Eko</span>
        </div>
        <div style="padding:10px 12px; flex:1; display:flex; flex-direction:column; justify-content:space-between; background:var(--surface);">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                    <span style="font-weight:700; font-size:12px; color:var(--text-main);">${escapeHtml(t.name)}</span>
                    <span class="badge badge-neutral" style="font-size:10px; padding:1px 6px;">${catBadge}</span>
                </div>
                <p class="text-xs text-muted" style="margin:0; font-size:11px;">${escapeHtml(t.description)}</p>
            </div>
            <button class="btn-primary" style="width:100%; margin-top:8px; font-size:11px; padding:5px 0; background:${t.accent||'var(--primary)'}; border-color:${t.accent||'var(--primary)'};"
                onclick="event.stopPropagation(); loadPresetTemplate('${t.id}')">
                Use Template
            </button>
        </div>
    </div>`;
}

function refreshTemplateGrid() {
    const g = document.getElementById('template-grid');
    if (g) g.innerHTML = renderTemplateGrid(getFilteredTemplates());
}

// ── Saved Posters Modal ────────────────────────────────────────────────────────
function renderSavedPostersModal() {
    return `
    <div id="saved-posters-modal" class="modal-overlay hidden" onclick="if(event.target===this)closeModal('saved-posters-modal')">
        <div class="modal-card" style="max-width:540px; max-height:85vh; overflow:hidden; display:flex; flex-direction:column; border-radius:16px;">
            <div class="modal-header" style="flex-shrink:0; padding:14px 18px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:var(--primary);">${renderIcon('folder-open', 18)}</span>
                    <h2 style="font-size:1.1rem; font-weight:700; margin:0;">Saved Poster Designs</h2>
                </div>
                <button class="modal-close" onclick="closeModal('saved-posters-modal')">${renderIcon('x', 18)}</button>
            </div>
            <div id="ps-saved-designs-modal-list" style="overflow-y:auto; padding:14px 18px; flex:1; display:flex; flex-direction:column; gap:8px;">
                <div class="loading-state"><div class="spinner"></div></div>
            </div>
        </div>
    </div>`;
}

function openSavedPostersModal() {
    const slot = document.getElementById('saved-posters-slot');
    if (slot) slot.innerHTML = renderSavedPostersModal();
    const m = document.getElementById('saved-posters-modal');
    if (m) m.classList.remove('hidden');
    loadSavedPostersList();
}

// ── Main Screen Render (Mobile-First Hero Canvas Editor) ────────────────────────
function renderPosterStudioScreen() {
    return `
    <div class="poster-editor-container">
        <!-- TOP TOOLBAR -->
        <div class="pe-header" style="display:flex; justify-content:space-between; align-items:center; padding:4px 0 10px 0;">
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn-secondary" style="padding:6px 12px; font-size:12px; font-weight:700; display:flex; align-items:center; gap:5px; border-radius:20px; background:var(--surface); border:1px solid var(--border);" onclick="openTemplatePickerModal()">
                    ${renderIcon('layout-template', 14)} <span>Choose Template</span>
                </button>
                <div id="ps-save-status" style="font-size:11px; color:#059669; font-weight:600; display:flex; align-items:center; gap:3px;">
                    <span>&#9679;</span> <span>Saved</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <button class="btn-ghost" style="padding:6px 8px; border-radius:8px;" onclick="undoPosterState()" title="Undo">
                    ${renderIcon('undo-2', 16)}
                </button>
                <button class="btn-ghost" style="padding:6px 8px; border-radius:8px;" onclick="redoPosterState()" title="Redo">
                    ${renderIcon('redo-2', 16)}
                </button>
                <button class="btn-ghost" style="padding:6px 8px; border-radius:8px;" onclick="openSavedPostersModal()" title="Saved Designs">
                    ${renderIcon('folder-open', 16)}
                </button>
            </div>
        </div>

        <!-- HERO: LIVE POSTER CANVAS -->
        <div class="pe-canvas-hero">
            <div id="ps-canvas-wrap" class="pe-canvas-box">
                <canvas id="poster-canvas" width="800" height="800"
                    style="width:100%; max-width:360px; aspect-ratio:1/1; height:auto; border-radius:10px; display:block; cursor:pointer; touch-action:none;"></canvas>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:6px; display:flex; align-items:center; gap:4px;">
                ${renderIcon('touchpad', 12)} <span>Tap any element on poster to edit</span>
            </div>
        </div>

        <!-- MOBILE EDITOR TABS (Segmented Control) -->
        <div class="pe-tabs">
            <button id="pe-tab-content" class="pe-tab-btn ${_activeEditorTab==='content'?'active':''}" onclick="switchEditorTab('content')">
                ${renderIcon('type', 13)} Content
            </button>
            <button id="pe-tab-offer" class="pe-tab-btn ${_activeEditorTab==='offer'?'active':''}" onclick="switchEditorTab('offer')">
                ${renderIcon('tag', 13)} Offer
            </button>
            <button id="pe-tab-style" class="pe-tab-btn ${_activeEditorTab==='style'?'active':''}" onclick="switchEditorTab('style')">
                ${renderIcon('sliders-horizontal', 13)} Style
            </button>
            <button id="pe-tab-brand" class="pe-tab-btn ${_activeEditorTab==='brand'?'active':''}" onclick="switchEditorTab('brand')">
                ${renderIcon('store', 13)} Brand
            </button>
            <button id="pe-tab-layers" class="pe-tab-btn ${_activeEditorTab==='layers'?'active':''}" onclick="switchEditorTab('layers')">
                ${renderIcon('layers', 13)} Layers
            </button>
            <button id="pe-tab-ai" class="pe-tab-btn ai-tab ${_activeEditorTab==='ai'?'active':''}" onclick="switchEditorTab('ai')">
                ${renderIcon('sparkles', 13)} AI Copy
            </button>
        </div>

        <!-- ACTIVE EDITOR PANEL (Only active tab is rendered) -->
        <div id="pe-panel-container" class="card" style="padding:14px; margin-bottom:14px; border-radius:14px; border:1px solid var(--border); background:var(--surface);">
            <!-- Panel content injected by renderActiveTabPanel() -->
        </div>

        <!-- BOTTOM ACTION BAR -->
        <div class="pe-actions-bar">
            <button class="btn-secondary pe-action-btn" onclick="togglePosterPreview()">
                ${renderIcon('eye', 16)} <span>Preview</span>
            </button>
            <button class="btn-secondary pe-action-btn" onclick="saveActivePoster()">
                ${renderIcon('save', 16)} <span>Save</span>
            </button>
            <button class="btn-primary pe-action-btn" style="background:#f97316; border-color:#f97316; color:#ffffff;" onclick="exportPosterPNG('download')">
                ${renderIcon('download', 16)} <span>Export PNG</span>
            </button>
            <button class="btn-secondary pe-action-btn" style="border-color:#25d366; color:#128c7e;" onclick="exportPosterPNG('share')">
                ${renderIcon('share-2', 16)} <span>Share</span>
            </button>
        </div>
    </div>

    <!-- MODAL SLOTS -->
    <div id="template-picker-slot"></div>
    <div id="saved-posters-slot"></div>

    <!-- FULLSCREEN PREVIEW OVERLAY -->
    <div id="ps-preview-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.95); z-index:9999; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:16px;">
        <div style="background:#0f172a; padding:8px; border-radius:16px; box-shadow:0 12px 36px rgba(0,0,0,0.5); max-width:92vw;">
            <canvas id="ps-preview-canvas" width="800" height="800" style="max-width:min(440px, 86vw); max-height:65vh; aspect-ratio:1/1; border-radius:10px; display:block;"></canvas>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
            <button class="btn-secondary" style="background:rgba(255,255,255,0.15); color:#ffffff; border-color:rgba(255,255,255,0.3); padding:8px 16px; font-size:13px;" onclick="togglePosterPreview()">
                ${renderIcon('arrow-left', 15)} Back to Edit
            </button>
            <button class="btn-primary" style="background:#f97316; border-color:#f97316; padding:8px 16px; font-size:13px;" onclick="exportPosterPNG('download')">
                ${renderIcon('download', 15)} Export PNG
            </button>
            <button class="btn-secondary" style="background:#25d366; border-color:#25d366; color:#ffffff; padding:8px 16px; font-size:13px;" onclick="exportPosterPNG('share')">
                ${renderIcon('share-2', 15)} Share
            </button>
        </div>
    </div>
    `;
}

// ── Tab Switching ──────────────────────────────────────────────────────────────
function switchEditorTab(tabName) {
    _activeEditorTab = tabName;
    ['content', 'offer', 'style', 'brand', 'layers', 'ai'].forEach(t => {
        const btn = document.getElementById('pe-tab-' + t);
        if (btn) {
            if (t === tabName) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
    renderActiveTabPanel();
}

// ── Render Active Tab Panel ────────────────────────────────────────────────────
function renderActiveTabPanel() {
    const container = document.getElementById('pe-panel-container');
    if (!container) return;

    if (_activeEditorTab === 'content') {
        const layers = _activePosterData.layers || [];
        const find = id => layers.find(l => l.id === id) || {};
        const hl = find('headline').text || '';
        const sub = find('sub').text || '';
        const cta = find('cta').text || '';

        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="font-size:0.87rem; font-weight:700; margin:0; display:flex; align-items:center; gap:6px;">
                ${renderIcon('type', 14)} <span>Content &amp; Text</span>
            </h3>
            <span class="text-xs text-muted">Live update</span>
        </div>
        <div class="form-group mb-2">
            <label class="form-label text-xs">Main Headline</label>
            <input id="ps-q-headline" class="form-input text-xs" placeholder="e.g. 20% OFF or Instant DMT"
                value="${escapeHtml(hl)}" oninput="updateLayerById('headline','text',this.value)">
        </div>
        <div class="form-group mb-2">
            <label class="form-label text-xs">Sub-heading / Offer Detail</label>
            <input id="ps-q-sub" class="form-input text-xs" placeholder="e.g. Special Offer or Fast Money Transfer"
                value="${escapeHtml(sub)}" oninput="updateLayerById('sub','text',this.value)">
        </div>
        <div class="form-group mb-0">
            <label class="form-label text-xs">Call to Action (CTA Button)</label>
            <input id="ps-q-cta" class="form-input text-xs" placeholder="e.g. Grab Now or Visit Us"
                value="${escapeHtml(cta)}" oninput="updateLayerById('cta','text',this.value)">
        </div>`;
    }
    else if (_activeEditorTab === 'offer') {
        const offer = _activePosterData.offer || {};
        const opVal = offer.originalPrice || '';
        const dpVal = offer.discountPercent || '';

        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="font-size:0.87rem; font-weight:700; margin:0; display:flex; align-items:center; gap:6px;">
                ${renderIcon('tag', 14)} <span>Offer &amp; Pricing Calculator</span>
            </h3>
            <span class="badge badge-primary" style="font-size:10px;">Exact Arithmetic</span>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
                <label class="form-label text-xs">Original Price (&#8377;)</label>
                <input type="number" id="ps-orig-price" class="form-input text-xs" placeholder="1299" min="0" step="any"
                    value="${opVal}" oninput="onOfferInputChange()">
            </div>
            <div>
                <label class="form-label text-xs">Discount (%)</label>
                <input type="number" id="ps-discount-pct" class="form-input text-xs" placeholder="23" min="0" max="100" step="any"
                    value="${dpVal}" oninput="onOfferInputChange()">
            </div>
        </div>
        <div id="ps-offer-result" style="background:var(--bg); border-radius:10px; padding:10px 12px; font-size:12px; line-height:1.8; border:1px solid var(--border);">
            <!-- offer result injected here -->
        </div>
        <div id="ps-offer-error" style="color:#dc2626; font-size:11px; margin-top:4px; display:none;"></div>`;
        renderOfferResult(offer);
    }
    else if (_activeEditorTab === 'style') {
        renderLayerProperties(container);
    }
    else if (_activeEditorTab === 'brand') {
        const layers = _activePosterData.layers || [];
        const outlet = layers.find(l => l.id === 'outlet_name')?.text || '';

        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="font-size:0.87rem; font-weight:700; margin:0; display:flex; align-items:center; gap:6px;">
                ${renderIcon('store', 14)} <span>Brand &amp; Outlet</span>
            </h3>
        </div>
        <div class="form-group mb-3">
            <label class="form-label text-xs">Outlet / Merchant Store Name</label>
            <input id="ps-outlet-name" class="form-input text-xs" placeholder="e.g. Paras General Store & Banking Point"
                value="${escapeHtml(outlet)}" oninput="updateLayerById('outlet_name','text',this.value)">
        </div>
        <div style="background:var(--bg); border-radius:10px; padding:10px 12px; border:1px solid var(--border); display:flex; align-items:center; gap:8px;">
            <span style="color:#7c3aed; font-size:16px;">\ud83d\udd12</span>
            <div style="font-size:11px; color:var(--text-muted); line-height:1.4;">
                <strong style="color:var(--text-main);">Official Eko Branding:</strong>
                "Made by Eko" is permanently embedded on all posters as protected partner verification.
            </div>
        </div>`;
    }
    else if (_activeEditorTab === 'layers') {
        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:6px;">
                <h3 style="font-size:0.87rem; font-weight:700; margin:0; display:flex; align-items:center; gap:5px;">
                    ${renderIcon('layers', 14)} <span>Layers</span>
                </h3>
                <span class="badge badge-neutral" id="ps-layers-count" style="font-size:10px;">0</span>
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn-ghost" style="padding:3px 8px; font-size:11px;" onclick="addTextLayer()">${renderIcon('plus', 11)} Text</button>
                <button class="btn-ghost" style="padding:3px 8px; font-size:11px;" onclick="addShapeLayer()">${renderIcon('plus', 11)} Box</button>
            </div>
        </div>
        <div id="ps-layers-list" style="display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto;">
            <!-- list injected by renderLayersList() -->
        </div>`;
        renderLayersList();
    }
    else if (_activeEditorTab === 'ai') {
        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="font-size:0.87rem; font-weight:700; margin:0; display:flex; align-items:center; gap:6px; color:#7c3aed;">
                ${renderIcon('sparkles', 14)} <span>AI Poster Copy</span>
            </h3>
            <span class="badge badge-neutral" style="font-size:10px;">Auto-generate</span>
        </div>
        <div class="form-group mb-2">
            <label class="form-label text-xs">What are you promoting?</label>
            <input id="ps-ai-prompt" class="form-input text-xs" value="24x7 IMPS Money Transfer" placeholder="e.g. Festival Cash Discount">
        </div>
        <div class="form-group mb-2">
            <label class="form-label text-xs">Key Benefit / Outlet</label>
            <input id="ps-ai-partner" class="form-input text-xs" value="Paras General Store & Banking Point" placeholder="Outlet Name">
        </div>
        <button id="ps-ai-btn" class="btn-primary" style="width:100%; font-size:12px; background:#7c3aed; border-color:#7c3aed; padding:8px 0; border-radius:8px;" onclick="generateAiPosterCopy()">
            ${renderIcon('wand-2', 13)} <span>Generate Copy</span>
        </button>
        <div id="ps-ai-preview" style="margin-top:10px; display:none;"></div>`;
    }
}

// ── Init ───────────────────────────────────────────────────────────────────────
async function loadPosterStudio() {
    initPosterCanvasEvents();
    loadPresetTemplate('special_offer', false);
    loadSavedPostersList();
}

function openTemplatePickerModal() {
    _templateFilter = 'all'; _templateSearch = '';
    const slot = document.getElementById('template-picker-slot');
    if (slot) slot.innerHTML = renderTemplatePicker();
    const m = document.getElementById('template-picker-modal');
    if (m) m.classList.remove('hidden');
}

function loadPresetTemplate(id, pushHist = true) {
    const tmpl = POSTER_TEMPLATES.find(t => t.id === id);
    if (!tmpl) return;
    _activePosterData = {
        title: tmpl.name, template_type: id,
        width: 800, height: 800,
        layers: JSON.parse(JSON.stringify(tmpl.layers)),
        offer: { originalPrice: 0, discountPercent: 0, discountAmount: 0, finalPrice: 0 }
    };
    _selectedLayerIndex = -1; _activePosterId = null;
    if (pushHist) {
        pushPosterHistory();
    } else {
        _posterUndoStack = [];
        _posterRedoStack = [];
    }
    closeModal('template-picker-modal');
    drawPosterCanvas();
    renderActiveTabPanel();
    markSaveStatus('saved');
}

// ── Quick Edit sync ────────────────────────────────────────────────────────────
function updateLayerById(layerId, prop, val) {
    pushPosterHistory();
    (_activePosterData.layers || []).forEach(l => {
        if (l.id === layerId) {
            l[prop] = val;
            drawPosterCanvas();
        }
    });
    markSaveStatus('unsaved');
}

function syncQuickEditInputs() {
    const layers = _activePosterData.layers || [];
    const find = id => layers.find(l => l.id === id);
    const sv = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const h = find('headline'); if (h) sv('ps-q-headline', h.text);
    const s = find('sub'); if (s) sv('ps-q-sub', s.text);
    const c = find('cta'); if (c) sv('ps-q-cta', c.text);
    const o = find('outlet_name'); if (o) sv('ps-outlet-name', o.text);
    const offer = _activePosterData.offer || {};
    sv('ps-orig-price', offer.originalPrice || '');
    sv('ps-discount-pct', offer.discountPercent || '');
    renderOfferResult(offer);
}

// ── Offer Pricing ──────────────────────────────────────────────────────────────
function onOfferInputChange() {
    const op = parseFloat(document.getElementById('ps-orig-price')?.value) || 0;
    const dp = parseFloat(document.getElementById('ps-discount-pct')?.value) || 0;
    const errEl = document.getElementById('ps-offer-error');
    if (dp < 0 || dp > 100) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Discount must be 0%–100%.'; }
        return;
    }
    if (op < 0) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Price cannot be negative.'; }
        return;
    }
    if (errEl) errEl.style.display = 'none';
    pushPosterHistory();
    const result = calcOffer(op, dp);
    _activePosterData.offer = result;
    renderOfferResult(result);
    const layers = _activePosterData.layers || [];
    layers.forEach(l => {
        if (l.id === 'orig_price' && op > 0) l.text = fmtINR(op);
        if (l.id === 'final_price' && result.finalPrice >= 0) l.text = fmtINR(result.finalPrice);
        if (l.id === 'save_text' && result.discountAmount > 0) l.text = 'You save ' + fmtINR(result.discountAmount) + '!';
        if (l.id === 'headline' && dp > 0) {
            l.text = Math.round(dp) + '% OFF';
            const el = document.getElementById('ps-q-headline');
            if (el) el.value = l.text;
        }
    });
    drawPosterCanvas();
    markSaveStatus('unsaved');
}

function renderOfferResult(result) {
    const el = document.getElementById('ps-offer-result');
    if (!el) return;
    const has = result && (result.originalPrice > 0 || result.discountPercent > 0);
    if (!has) {
        el.innerHTML = '<div style="display:flex;justify-content:space-between;"><span class="text-muted">Discount Amount</span><span>—</span></div><div style="display:flex;justify-content:space-between;font-weight:700;"><span class="text-muted">Final Price</span><span style="color:#059669;">—</span></div>';
        return;
    }
    el.innerHTML = `
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Original Price</span><span>${fmtINR(result.originalPrice)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Discount (${result.discountPercent}%)</span><span style="color:#dc2626;font-weight:600;">−${fmtINR(result.discountAmount)}</span></div>
        <div style="border-top:1px solid var(--border);margin:4px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;"><span>Final Price</span><span style="color:#059669;">${fmtINR(result.finalPrice)}</span></div>`;
}

// ── Canvas Events ──────────────────────────────────────────────────────
function initPosterCanvasEvents() {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;

    const getXY = (canvas, cx, cy) => {
        const r = canvas.getBoundingClientRect();
        return { mx: (cx - r.left) * canvas.width / r.width, my: (cy - r.top) * canvas.height / r.height };
    };
    const hitTest = (mx, my) => {
        const layers = _activePosterData.layers || [];
        for (let i = layers.length - 1; i >= 0; i--) {
            const l = layers[i];
            if (l.type === 'background' || l._protected) continue;
            if (l.w && l.h) {
                if (mx >= l.x && mx <= l.x + l.w && my >= l.y && my <= l.y + l.h) return i;
            } else if (l.type === 'text') {
                const ew = l.text.length * (l.fontSize * 0.55);
                const lx = l.align === 'center' ? l.x - ew / 2 : (l.align === 'right' ? l.x - ew : l.x);
                if (mx >= lx && mx <= lx + ew && my >= l.y - l.fontSize && my <= l.y + 10) return i;
            }
        }
        return -1;
    };

    const handleTap = (cx, cy) => {
        const { mx, my } = getXY(canvas, cx, cy);
        const h = hitTest(mx, my);
        if (h !== -1) {
            selectLayer(h);
            const l = _activePosterData.layers[h];
            if (l.id === 'headline' || l.id === 'sub' || l.id === 'cta') {
                switchEditorTab('content');
            } else if (l.id === 'orig_price' || l.id === 'final_price' || l.id === 'save_text') {
                switchEditorTab('offer');
            } else if (l.id === 'outlet_name') {
                switchEditorTab('brand');
            } else {
                switchEditorTab('style');
            }
            _isDraggingLayer = true;
            _dragStartPos = { x: mx, y: my };
            _layerInitialPos = { x: l.x, y: l.y };
        } else {
            selectLayer(-1);
        }
    };

    canvas.onmousedown = e => { handleTap(e.clientX, e.clientY); };
    canvas.ontouchstart = e => {
        const t = e.touches[0];
        handleTap(t.clientX, t.clientY);
    };

    const move = (mx, my) => {
        if (!_isDraggingLayer || _selectedLayerIndex === -1) return;
        const l = _activePosterData.layers[_selectedLayerIndex];
        l.x = Math.round(_layerInitialPos.x + mx - _dragStartPos.x);
        l.y = Math.round(_layerInitialPos.y + my - _dragStartPos.y);
        drawPosterCanvas();
    };
    window.onmousemove = e => {
        const c2 = document.getElementById('poster-canvas');
        if (c2) { const { mx, my } = getXY(c2, e.clientX, e.clientY); move(mx, my); }
    };
    window.addEventListener('touchmove', e => {
        if (!_isDraggingLayer) return;
        if (e.cancelable) e.preventDefault();
        const c2 = document.getElementById('poster-canvas');
        if (!c2) return;
        const t = e.touches[0];
        const { mx, my } = getXY(c2, t.clientX, t.clientY);
        move(mx, my);
    }, { passive: false });

    const up = () => {
        if (_isDraggingLayer) {
            _isDraggingLayer = false;
            pushPosterHistory();
            if (_activeEditorTab === 'style') renderActiveTabPanel();
        }
    };
    window.onmouseup = up;
    window.addEventListener('touchend', up);
}

// ── Canvas Draw ────────────────────────────────────────────────────────────────
function drawPosterCanvas(targetCanvas) {
    const canvas = targetCanvas || document.getElementById('poster-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    (_activePosterData.layers || []).forEach((l, idx) => {
        ctx.save();
        if (l.type === 'background') {
            ctx.fillStyle = l.color || '#f8fafc';
            ctx.fillRect(0, 0, 800, 800);
        } else if (l.type === 'shape') {
            ctx.fillStyle = l.color || '#ffffff';
            if (l.radius) { drawRoundedRect(ctx, l.x, l.y, l.w, l.h, l.radius); ctx.fill(); }
            else ctx.fillRect(l.x, l.y, l.w, l.h);
            if (l.border) {
                ctx.strokeStyle = l.border; ctx.lineWidth = 1.5;
                if (l.radius) { drawRoundedRect(ctx, l.x, l.y, l.w, l.h, l.radius); ctx.stroke(); }
                else ctx.strokeRect(l.x, l.y, l.w, l.h);
            }
        } else if (l.type === 'badge') {
            ctx.fillStyle = l.color || '#2563eb';
            drawRoundedRect(ctx, l.x, l.y, l.w, l.h, 8); ctx.fill();
            ctx.fillStyle = l.textColor || '#ffffff';
            ctx.font = `bold ${l.fontSize||14}px system-ui,sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(l.text, l.x + l.w/2, l.y + l.h/2);
        } else if (l.type === 'text') {
            ctx.fillStyle = l.color || '#1e293b';
            ctx.font = `${l.bold ? 'bold ' : ''}${l.fontSize||20}px system-ui,-apple-system,Roboto,sans-serif`;
            ctx.textAlign = l.align || 'left'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(l.text, l.x, l.y);
            if (l.strikethrough) {
                const tw = ctx.measureText(l.text).width;
                const lx = l.align === 'center' ? l.x - tw/2 : (l.align === 'right' ? l.x - tw : l.x);
                ctx.strokeStyle = l.color || '#1e293b'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(lx, l.y - l.fontSize*0.35); ctx.lineTo(lx + tw, l.y - l.fontSize*0.35); ctx.stroke();
            }
        } else if (l.type === 'branding') {
            ctx.fillStyle = l.color || 'rgba(255,255,255,0.72)';
            ctx.font = `${l.fontSize||12}px system-ui,sans-serif`;
            ctx.textAlign = l.align || 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(l.text || 'Made by Eko', l.x, l.y);
        }

        // Selected layer bounding box
        if (idx === _selectedLayerIndex && l.type !== 'background' && !l._protected && canvas.id === 'poster-canvas') {
            ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
            if (l.w && l.h) {
                ctx.strokeRect(l.x - 4, l.y - 4, l.w + 8, l.h + 8);
            } else if (l.type === 'text') {
                const tw = l.text.length * (l.fontSize * 0.55);
                const lx = l.align === 'center' ? l.x - tw/2 : (l.align === 'right' ? l.x - tw : l.x);
                ctx.strokeRect(lx - 6, l.y - l.fontSize - 4, tw + 12, l.fontSize + 14);
            }
        }
        ctx.restore();
    });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── Layer Operations ───────────────────────────────────────────────────────────
function selectLayer(idx) {
    _selectedLayerIndex = idx;
    drawPosterCanvas();
    if (_activeEditorTab === 'layers') renderLayersList();
    if (_activeEditorTab === 'style') renderActiveTabPanel();
}

function renderLayersList() {
    const el = document.getElementById('ps-layers-list');
    const cnt = document.getElementById('ps-layers-count');
    if (!el) return;
    const layers = _activePosterData.layers || [];
    if (cnt) cnt.textContent = layers.length;
    el.innerHTML = [...layers].reverse().map((l, ri) => {
        const idx = layers.length - 1 - ri;
        const sel = idx === _selectedLayerIndex;
        const prot = l._protected;
        let title = l.type.toUpperCase();
        if (l.text) title = l.text.length > 20 ? l.text.slice(0, 20) + '…' : l.text;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:8px;cursor:${prot?'default':'pointer'};background:${sel?'rgba(37,99,235,0.08)':'var(--bg)'};border:1px solid ${sel?'#2563eb':'var(--border)'};font-size:12px;gap:4px;"
            onclick="${prot?'':'selectLayer('+idx+')'}">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-weight:${sel?700:500};color:${sel?'#2563eb':'var(--text-main)'};">
                ${prot?'🔒 ':''}${escapeHtml(title)}
            </div>
            ${prot ? '<span style="font-size:10px;color:var(--text-muted);">Locked</span>' : `<div style="display:flex;gap:3px;flex-shrink:0;">
                ${idx>1?`<button class="btn-ghost" style="padding:2px 5px;font-size:11px;" onclick="event.stopPropagation();moveLayerUp(${idx})">▲</button>`:''}
                ${idx<layers.length-1?`<button class="btn-ghost" style="padding:2px 5px;font-size:11px;" onclick="event.stopPropagation();moveLayerDown(${idx})">▼</button>`:''}
                <button class="btn-ghost" style="padding:2px 5px;font-size:11px;color:#dc2626;" onclick="event.stopPropagation();deleteLayer(${idx})">✕</button>
            </div>`}
        </div>`;
    }).join('');
}

function renderLayerProperties(container) {
    const l = _activePosterData.layers?.[_selectedLayerIndex];
    if (!l) {
        const layers = _activePosterData.layers || [];
        const quickItems = layers.filter(x => !x._protected && x.type === 'text');
        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="font-size:0.87rem; font-weight:700; margin:0; display:flex; align-items:center; gap:6px;">
                ${renderIcon('sliders-horizontal', 14)} <span>Style &amp; Formatting</span>
            </h3>
        </div>
        <p class="text-xs text-muted mb-2">Select an element to customize its appearance:</p>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${quickItems.map(item => {
                const idx = layers.indexOf(item);
                return `<button class="btn-secondary" style="padding:5px 10px; font-size:11px; border-radius:14px;"
                    onclick="selectLayer(${idx}); switchEditorTab('style');">
                    ${escapeHtml(item.text ? (item.text.length > 15 ? item.text.slice(0, 15) + '…' : item.text) : item.type)}
                </button>`;
            }).join('')}
        </div>`;
        return;
    }

    if (l.type === 'text' || l.type === 'branding') {
        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="font-size:0.87rem; font-weight:700; margin:0;">Editing: ${escapeHtml(l.text ? (l.text.length > 18 ? l.text.slice(0, 18) + '…' : l.text) : 'Text')}</h3>
            <button class="btn-ghost" style="font-size:11px; padding:2px 6px;" onclick="selectLayer(-1); renderActiveTabPanel();">Deselect</button>
        </div>
        <div class="form-group mb-2">
            <label class="form-label text-xs">Text</label>
            <input class="form-input text-xs" value="${escapeHtml(l.text)}" oninput="updateActiveLayerProp('text',this.value)">
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
                <label class="form-label text-xs">Font Size (${l.fontSize||20}px)</label>
                <input type="range" min="10" max="100" value="${l.fontSize||20}" style="width:100%;"
                    oninput="updateActiveLayerProp('fontSize',parseInt(this.value)); this.previousElementSibling.textContent='Font Size ('+this.value+'px)';">
            </div>
            <div>
                <label class="form-label text-xs">Color</label>
                <input type="color" class="form-input text-xs" style="height:32px;padding:2px;" value="${l.color||'#000000'}" oninput="updateActiveLayerProp('color',this.value)">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
                <label class="form-label text-xs">Alignment</label>
                <select class="form-input text-xs" onchange="updateActiveLayerProp('align',this.value)">
                    <option value="left" ${l.align==='left'?'selected':''}>Left</option>
                    <option value="center" ${l.align==='center'?'selected':''}>Center</option>
                    <option value="right" ${l.align==='right'?'selected':''}>Right</option>
                </select>
            </div>
            <div>
                <label class="form-label text-xs">Bold</label>
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;height:32px;cursor:pointer;">
                    <input type="checkbox" ${l.bold?'checked':''} onchange="updateActiveLayerProp('bold',this.checked)"> Bold Text
                </label>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div><label class="form-label text-xs">X Position</label><input type="number" class="form-input text-xs" value="${l.x||0}" onchange="updateActiveLayerProp('x',parseInt(this.value))"></div>
            <div><label class="form-label text-xs">Y Position</label><input type="number" class="form-input text-xs" value="${l.y||0}" onchange="updateActiveLayerProp('y',parseInt(this.value))"></div>
        </div>`;
    } else {
        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="font-size:0.87rem; font-weight:700; margin:0;">Editing Shape</h3>
            <button class="btn-ghost" style="font-size:11px; padding:2px 6px;" onclick="selectLayer(-1); renderActiveTabPanel();">Deselect</button>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
                <label class="form-label text-xs">Fill Color</label>
                <input type="color" class="form-input text-xs" style="height:32px;padding:2px;" value="${l.color||'#ffffff'}" oninput="updateActiveLayerProp('color',this.value)">
            </div>
            <div>
                <label class="form-label text-xs">Border Color</label>
                <input type="color" class="form-input text-xs" style="height:32px;padding:2px;" value="${l.border||'#ffffff'}" oninput="updateActiveLayerProp('border',this.value)">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div><label class="form-label text-xs">Width</label><input type="number" class="form-input text-xs" value="${l.w||800}" onchange="updateActiveLayerProp('w',parseInt(this.value))"></div>
            <div><label class="form-label text-xs">Height</label><input type="number" class="form-input text-xs" value="${l.h||50}" onchange="updateActiveLayerProp('h',parseInt(this.value))"></div>
        </div>`;
    }
}

function updateActiveLayerProp(prop, val) {
    if (_selectedLayerIndex === -1) return;
    _activePosterData.layers[_selectedLayerIndex][prop] = val;
    drawPosterCanvas();
    markSaveStatus('unsaved');
}

// ── Undo/Redo ──────────────────────────────────────────────────────────────────
function pushPosterHistory() {
    const json = JSON.stringify(_activePosterData);
    if (_posterUndoStack.length > 0 && _posterUndoStack[_posterUndoStack.length - 1] === json) return;
    _posterUndoStack.push(json);
    if (_posterUndoStack.length > 30) _posterUndoStack.shift();
    _posterRedoStack = [];
    markSaveStatus('unsaved');
}

function undoPosterState() {
    if (_posterUndoStack.length === 0) return;
    _posterRedoStack.push(JSON.stringify(_activePosterData));
    _activePosterData = JSON.parse(_posterUndoStack.pop());
    drawPosterCanvas();
    renderActiveTabPanel();
    syncQuickEditInputs();
}

function redoPosterState() {
    if (_posterRedoStack.length === 0) return;
    _posterUndoStack.push(JSON.stringify(_activePosterData));
    _activePosterData = JSON.parse(_posterRedoStack.pop());
    drawPosterCanvas();
    renderActiveTabPanel();
    syncQuickEditInputs();
}

// ── Add/Delete/Move Layers ─────────────────────────────────────────────────────
function addTextLayer() {
    pushPosterHistory();
    const bIdx = _activePosterData.layers.length - 1;
    _activePosterData.layers.splice(bIdx, 0, { type: 'text', text: 'New Text', color: '#1e293b', fontSize: 28, bold: true, align: 'center', x: 400, y: 360 });
    selectLayer(bIdx);
    switchEditorTab('style');
}

function addShapeLayer() {
    pushPosterHistory();
    const bIdx = _activePosterData.layers.length - 1;
    _activePosterData.layers.splice(bIdx, 0, { type: 'shape', shape: 'rect', color: '#f1f5f9', x: 100, y: 300, w: 600, h: 120, radius: 12, border: '#e2e8f0' });
    selectLayer(bIdx);
    switchEditorTab('style');
}

function deleteLayer(idx) {
    const l = _activePosterData.layers[idx];
    if (!l || l._protected) return;
    pushPosterHistory();
    _activePosterData.layers.splice(idx, 1);
    selectLayer(-1);
    renderActiveTabPanel();
}

function moveLayerUp(idx) {
    const layers = _activePosterData.layers;
    if (idx >= layers.length - 2) return;
    pushPosterHistory();
    [layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]];
    selectLayer(idx + 1);
    renderActiveTabPanel();
}

function moveLayerDown(idx) {
    if (idx <= 1) return;
    pushPosterHistory();
    const l = _activePosterData.layers;
    [l[idx], l[idx - 1]] = [l[idx - 1], l[idx]];
    selectLayer(idx - 1);
    renderActiveTabPanel();
}

// ── Save Status ────────────────────────────────────────────────────────────────
function markSaveStatus(s) {
    const el = document.getElementById('ps-save-status');
    if (!el) return;
    if (s === 'saved') {
        el.innerHTML = '<span style="color:#059669;">●</span> <span>Saved</span>';
        el.style.color = '#059669';
    } else if (s === 'saving') {
        el.innerHTML = '<span style="color:#d97706;">●</span> <span>Saving…</span>';
        el.style.color = '#d97706';
    } else {
        el.innerHTML = '<span style="color:#dc2626;">●</span> <span>Unsaved changes</span>';
        el.style.color = '#dc2626';
    }
}

// ── Preview Mode ───────────────────────────────────────────────────────────────
function togglePosterPreview() {
    const overlay = document.getElementById('ps-preview-overlay');
    if (!overlay) return;
    if (_posterViewMode === 'edit') {
        _posterViewMode = 'preview';
        overlay.style.display = 'flex';
        const pc = document.getElementById('ps-preview-canvas');
        if (pc) {
            const prev = _selectedLayerIndex;
            _selectedLayerIndex = -1;
            drawPosterCanvas(pc);
            _selectedLayerIndex = prev;
        }
    } else {
        _posterViewMode = 'edit';
        overlay.style.display = 'none';
    }
}

// ── AI Copy ────────────────────────────────────────────────────────────────────
async function generateAiPosterCopy() {
    if (_aiGenerating) return;
    const partnerName = document.getElementById('ps-ai-partner')?.value || 'Paras General Store & Banking Point';
    const prompt = document.getElementById('ps-ai-prompt')?.value || 'Financial Services';
    const btn = document.getElementById('ps-ai-btn');
    const preEl = document.getElementById('ps-ai-preview');
    _aiGenerating = true;
    if (btn) btn.innerHTML = '<span>Generating…</span>';
    try {
        const res = await api.generatePosterCopy({ prompt, partner_name: partnerName, template_type: _activePosterData.template_type });
        const hl = res.headline || '';
        const tl = res.tagline || '';
        if (preEl) {
            preEl.style.display = 'block';
            preEl.innerHTML = `
            <div style="background:var(--bg); border-radius:10px; padding:12px; border:1px solid var(--border); font-size:12px;">
                <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:var(--text-main);">${escapeHtml(hl)}</div>
                <div class="text-muted" style="margin-bottom:8px;">${escapeHtml(tl)}</div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-primary" style="flex:1; font-size:11px; padding:6px; background:#7c3aed; border-color:#7c3aed;" onclick="applyAiCopy(this)">Apply to Poster</button>
                    <button class="btn-secondary" style="flex:1; font-size:11px; padding:6px;" onclick="generateAiPosterCopy()">Regenerate</button>
                </div>
            </div>`;
            preEl._hl = hl; preEl._tl = tl; preEl._pn = partnerName;
        }
    } catch (err) {
        showToast('AI copy unavailable.', 'error');
    } finally {
        _aiGenerating = false;
        if (btn) btn.innerHTML = `${renderIcon('wand-2', 13)} <span>Generate Copy</span>`;
    }
}

function applyAiCopy(btnEl) {
    const preEl = document.getElementById('ps-ai-preview');
    if (!preEl) return;
    pushPosterHistory();
    const hl = preEl._hl || '';
    const tl = preEl._tl || '';
    const pn = preEl._pn || '';
    (_activePosterData.layers || []).forEach(l => {
        if (l.id === 'headline') l.text = hl;
        if (l.id === 'sub') l.text = tl;
        if (l.id === 'outlet_name' && pn) l.text = pn + ' · Eko Authorized';
    });
    drawPosterCanvas();
    renderActiveTabPanel();
    syncQuickEditInputs();
    showToast('AI copy applied!', 'success');
    preEl.style.display = 'none';
}

// ── Save/Reopen ────────────────────────────────────────────────────────────────
async function saveActivePoster() {
    markSaveStatus('saving');
    const canvas = document.getElementById('poster-canvas');
    const prev = _selectedLayerIndex;
    _selectedLayerIndex = -1;
    drawPosterCanvas();
    const previewData = canvas ? canvas.toDataURL('image/png', 0.7) : null;
    _selectedLayerIndex = prev;
    drawPosterCanvas();

    const payload = {
        title: _activePosterData.title,
        template_type: _activePosterData.template_type,
        layers_json: JSON.stringify(_activePosterData.layers),
        offer_json: JSON.stringify(_activePosterData.offer || {}),
        width: 800, height: 800,
        preview_data: previewData
    };

    try {
        if (_activePosterId && !_activePosterId.startsWith('local_')) {
            await api.updatePoster(_activePosterId, payload);
            showToast('Design updated!', 'success');
        } else {
            const r = await api.createPoster(payload);
            _activePosterId = r.id;
            showToast('Poster saved!', 'success');
        }
    } catch (err) {
        if (!_activePosterId) _activePosterId = 'local_' + Date.now();
        showToast('Saved to device!', 'info');
    }

    try {
        const localList = JSON.parse(localStorage.getItem('eko_saved_posters_v1') || '[]');
        const localItem = {
            id: _activePosterId,
            title: payload.title,
            template_type: payload.template_type,
            layers_json: payload.layers_json,
            offer_json: payload.offer_json,
            created_at: new Date().toISOString()
        };
        const existingIdx = localList.findIndex(x => x.id === localItem.id);
        if (existingIdx >= 0) localList[existingIdx] = localItem;
        else localList.unshift(localItem);
        localStorage.setItem('eko_saved_posters_v1', JSON.stringify(localList));
    } catch {}

    markSaveStatus('saved');
    await loadSavedPostersList();
}

async function loadSavedPostersList() {
    const modalList = document.getElementById('ps-saved-designs-modal-list');
    try {
        _posterList = await api.getPosters() || [];
    } catch {
        _posterList = [];
    }
    try {
        const localList = JSON.parse(localStorage.getItem('eko_saved_posters_v1') || '[]');
        localList.forEach(item => {
            if (!_posterList.some(p => p.id === item.id)) _posterList.unshift(item);
        });
    } catch {}

    if (!_posterList.length) {
        if (modalList) modalList.innerHTML = '<p class="text-xs text-muted py-3 text-center">No saved designs yet.</p>';
        return;
    }
    const html = _posterList.map(p => `
    <div style="padding:10px 12px; border-radius:10px; border:1px solid ${p.id===_activePosterId?'#7c3aed':'var(--border)'}; cursor:pointer; background:var(--bg); display:flex; justify-content:space-between; align-items:center;"
         onclick="reopenSavedPoster('${p.id}'); closeModal('saved-posters-modal');">
        <div>
            <div style="font-size:13px; font-weight:700; color:var(--text-main);">${escapeHtml(p.title)}</div>
            <div class="text-xs text-muted" style="margin-top:2px;">
                ${(p.template_type||'custom').toUpperCase()} &middot; ${formatDate(p.created_at)}
            </div>
        </div>
        <button class="btn-ghost" style="padding:4px 8px; font-size:11px; color:#7c3aed;">Open</button>
    </div>`).join('');
    if (modalList) modalList.innerHTML = html;
}

function reopenSavedPoster(pid) {
    const p = _posterList.find(i => i.id === pid);
    if (!p) return;
    try {
        const layers = JSON.parse(p.layers_json);
        if (!layers.some(l => l.type === 'branding')) layers.push(ekoBrandingLayer());
        _activePosterId = p.id;
        _activePosterData = {
            title: p.title,
            template_type: p.template_type,
            width: p.width || 800,
            height: p.height || 800,
            layers,
            offer: p.offer_json ? JSON.parse(p.offer_json) : {}
        };
        _selectedLayerIndex = -1;
        pushPosterHistory();
        drawPosterCanvas();
        renderActiveTabPanel();
        syncQuickEditInputs();
        markSaveStatus('saved');
        showToast(`Loaded "${p.title}"`, 'info');
    } catch {
        showToast('Failed to load design.', 'error');
    }
}

// ── PNG Export ─────────────────────────────────────────────────────────────────
function exportPosterPNG(mode = 'download') {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;
    const prev = _selectedLayerIndex;
    _selectedLayerIndex = -1;
    drawPosterCanvas();
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    _selectedLayerIndex = prev;
    drawPosterCanvas();

    if (mode === 'download') {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `eko-poster-${_activePosterData.template_type}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('PNG exported!', 'success');
    } else {
        if (typeof AndroidBridge !== 'undefined' && AndroidBridge.shareImage) {
            AndroidBridge.shareImage(dataUrl, _activePosterData.title);
            showToast('Opening Android Share Sheet…', 'success');
        } else if (navigator.share && canvas.toBlob) {
            canvas.toBlob(b => {
                const f = new File([b], 'eko-poster.png', { type: 'image/png' });
                navigator.share({ title: _activePosterData.title, text: 'Eko Partner Poster', files: [f] })
                    .catch(() => exportPosterPNG('download'));
            });
        } else {
            exportPosterPNG('download');
            showToast('Sharing unavailable — PNG downloaded.', 'info');
        }
    }
}

// ── Window Exports ─────────────────────────────────────────────────────────────
window.renderPosterStudioScreen = renderPosterStudioScreen;
window.loadPosterStudio = loadPosterStudio;
window.loadPresetTemplate = loadPresetTemplate;
window.openTemplatePickerModal = openTemplatePickerModal;
window.openSavedPostersModal = openSavedPostersModal;
window.refreshTemplateGrid = refreshTemplateGrid;
window.drawPosterCanvas = drawPosterCanvas;
window.selectLayer = selectLayer;
window.updateActiveLayerProp = updateActiveLayerProp;
window.updateLayerById = updateLayerById;
window.undoPosterState = undoPosterState;
window.redoPosterState = redoPosterState;
window.addTextLayer = addTextLayer;
window.addShapeLayer = addShapeLayer;
window.deleteLayer = deleteLayer;
window.moveLayerUp = moveLayerUp;
window.moveLayerDown = moveLayerDown;
window.generateAiPosterCopy = generateAiPosterCopy;
window.applyAiCopy = applyAiCopy;
window.saveActivePoster = saveActivePoster;
window.reopenSavedPoster = reopenSavedPoster;
window.exportPosterPNG = exportPosterPNG;
window.togglePosterPreview = togglePosterPreview;
window.onOfferInputChange = onOfferInputChange;
window.calcOffer = calcOffer;
window.ekoBrandingLayer = ekoBrandingLayer;
window.switchEditorTab = switchEditorTab;
window.renderActiveTabPanel = renderActiveTabPanel;
window.POSTER_TEMPLATES = POSTER_TEMPLATES;
window.PosterStudio = {
    TEMPLATES: POSTER_TEMPLATES,
    calcOffer,
    loadPresetTemplate,
    saveActivePoster,
    reopenSavedPoster,
    undoPosterState,
    redoPosterState,
    togglePosterPreview,
    exportPosterPNG,
    switchEditorTab
};

