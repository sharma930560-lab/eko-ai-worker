/**
 * Eko — Inventory Management Screen
 * Complete CRUD for store stock, low-stock threshold alerts, and instant updates.
 */

let inventoryItems = [];
let editingInventoryId = null;

function renderInventoryScreen() {
    return `
    <div class="screen-container">
        <!-- Top Action Bar -->
        <div class="screen-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <div>
                <h2 style="font-size:1.25rem; font-weight:800; color:var(--text-main); margin:0;">Stock & Inventory</h2>
                <p style="font-size:0.85rem; color:var(--text-muted); margin:4px 0 0;">Manage store products, live stock counts, and reorder levels.</p>
            </div>
            <button class="btn-primary" onclick="openAddInventoryModal()">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Add Product</span>
            </button>
        </div>

        <!-- Low Stock Alert Banner -->
        <div id="inventory-alert-banner" class="hidden" style="margin-bottom:16px; padding:12px 16px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:10px; color:#DC2626; font-size:0.88rem; font-weight:600;">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span id="inventory-alert-text">Low stock items need reordering</span>
            </div>
            <button class="btn-ghost" style="padding:4px 10px; font-size:0.8rem; color:#DC2626;" onclick="filterLowStock()">Show Low Stock</button>
        </div>

        <!-- Inventory List -->
        <div id="inventory-list" class="item-list">
            <div class="loading-state"><div class="spinner"></div></div>
        </div>
    </div>

    <!-- Add/Edit Inventory Modal -->
    <div id="inventory-modal" class="modal-overlay hidden">
        <div class="modal-card" style="max-width:440px;">
            <div class="modal-header">
                <h2 id="inv-modal-title">Add Product to Inventory</h2>
                <button class="modal-close" onclick="closeModal('inventory-modal')">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group" style="margin-bottom:14px;">
                    <label class="form-label">Product / Item Name *</label>
                    <input type="text" id="inv-name" class="form-input" placeholder="e.g. Aashirvaad Atta 10kg, Mustard Oil 1L">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                    <div class="form-group">
                        <label class="form-label">Current Quantity</label>
                        <input type="number" id="inv-qty" class="form-input" placeholder="0" step="any">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Unit (kg, L, packets)</label>
                        <input type="text" id="inv-unit" class="form-input" placeholder="packets">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                    <div class="form-group">
                        <label class="form-label">Low Stock Alert Level</label>
                        <input type="number" id="inv-threshold" class="form-input" placeholder="5" step="any">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sale Price (₹)</label>
                        <input type="number" id="inv-price" class="form-input" placeholder="₹" step="any">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="closeModal('inventory-modal')">Cancel</button>
                <button class="btn-primary" onclick="saveInventoryItem()">Save Product</button>
            </div>
        </div>
    </div>
    `;
}

async function loadInventory() {
    const listEl = document.getElementById('inventory-list');
    if (!listEl) return;

    try {
        if (isDemoMode) {
            inventoryItems = [
                { id: 'i1', name: 'Aashirvaad Shudh Chakki Atta', quantity: 12, unit: 'bags (10kg)', low_stock_threshold: 5, price: 380 },
                { id: 'i2', name: 'Fortune Mustard Oil 1L', quantity: 3, unit: 'pouches', low_stock_threshold: 10, price: 140 },
                { id: 'i3', name: 'Tata Salt Vacuum Evaporated', quantity: 24, unit: 'packets', low_stock_threshold: 8, price: 28 },
                { id: 'i4', name: 'Madhur Pure Sugar', quantity: 2, unit: 'sacks (50kg)', low_stock_threshold: 4, price: 2150 },
            ];
        } else {
            inventoryItems = await api.getInventory();
        }

        renderInventoryList(inventoryItems);
        updateInventoryAlertBanner(inventoryItems);
    } catch (e) {
        listEl.innerHTML = `<div class="empty-state"><p>Could not load inventory items.</p></div>`;
    }
}

function renderInventoryList(items) {
    const listEl = document.getElementById('inventory-list');
    if (!listEl) return;

    if (!items || items.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3>No inventory items yet</h3>
                <p>Add products to track live stock levels and receive automatic low-stock reorder warnings.</p>
                <button class="btn-primary" style="margin-top:12px;" onclick="openAddInventoryModal()">+ Add Your First Product</button>
            </div>`;
        return;
    }

    listEl.innerHTML = items.map(item => {
        const isLow = (item.quantity || 0) <= (item.low_stock_threshold || 0);
        return `
        <div class="card-item" style="padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-main);">${escapeHtml(item.name)}</span>
                    ${isLow ? '<span class="badge badge-danger" style="font-size:0.7rem; font-weight:700;">LOW STOCK</span>' : ''}
                </div>
                <div style="display:flex; gap:14px; margin-top:4px; font-size:0.82rem; color:var(--text-muted);">
                    <span>Stock: <strong style="color:var(--text-main); font-weight:700;">${item.quantity}</strong> ${escapeHtml(item.unit || 'units')}</span>
                    ${item.price ? `<span>Price: <strong>₹${item.price}</strong></span>` : ''}
                    <span>Alert at: ≤ ${item.low_stock_threshold}</span>
                </div>
            </div>

            <!-- Quick Adjust Quantity Buttons -->
            <div style="display:flex; align-items:center; gap:6px;">
                <button class="btn-secondary" style="padding:4px 10px; font-weight:800; font-size:0.9rem;" onclick="adjustStock('${item.id}', -1)" title="Decrease quantity">-1</button>
                <button class="btn-secondary" style="padding:4px 10px; font-weight:800; font-size:0.9rem;" onclick="adjustStock('${item.id}', 1)" title="Increase quantity">+1</button>
                <button class="btn-ghost" style="padding:6px 8px; color:var(--text-muted);" onclick="openEditInventoryModal('${item.id}')">✏️</button>
                <button class="btn-ghost" style="padding:6px 8px; color:var(--danger);" onclick="deleteInventoryItem('${item.id}')">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function updateInventoryAlertBanner(items) {
    const banner = document.getElementById('inventory-alert-banner');
    const textEl = document.getElementById('inventory-alert-text');
    if (!banner || !textEl) return;

    const lowStock = items.filter(i => (i.quantity || 0) <= (i.low_stock_threshold || 0));
    if (lowStock.length > 0) {
        textEl.textContent = `${lowStock.length} items are at or below reorder level (${lowStock.map(i => i.name).slice(0, 2).join(', ')}${lowStock.length > 2 ? '...' : ''})`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function filterLowStock() {
    const lowStock = inventoryItems.filter(i => (i.quantity || 0) <= (i.low_stock_threshold || 0));
    renderInventoryList(lowStock);
}

function openAddInventoryModal() {
    editingInventoryId = null;
    document.getElementById('inv-modal-title').textContent = 'Add Product to Inventory';
    document.getElementById('inv-name').value = '';
    document.getElementById('inv-qty').value = '';
    document.getElementById('inv-unit').value = 'packets';
    document.getElementById('inv-threshold').value = '5';
    document.getElementById('inv-price').value = '';
    document.getElementById('inventory-modal').classList.remove('hidden');
}

function openEditInventoryModal(id) {
    const item = inventoryItems.find(i => i.id === id);
    if (!item) return;

    editingInventoryId = id;
    document.getElementById('inv-modal-title').textContent = 'Edit Product';
    document.getElementById('inv-name').value = item.name || '';
    document.getElementById('inv-qty').value = item.quantity || '';
    document.getElementById('inv-unit').value = item.unit || 'packets';
    document.getElementById('inv-threshold').value = item.low_stock_threshold || '5';
    document.getElementById('inv-price').value = item.price || '';
    document.getElementById('inventory-modal').classList.remove('hidden');
}

async function saveInventoryItem() {
    const name = document.getElementById('inv-name').value.trim();
    if (!name) {
        showToast('Please enter a product name', 'error');
        return;
    }

    const payload = {
        name,
        quantity: parseFloat(document.getElementById('inv-qty').value) || 0.0,
        unit: document.getElementById('inv-unit').value.trim() || 'units',
        low_stock_threshold: parseFloat(document.getElementById('inv-threshold').value) || 5.0,
        price: parseFloat(document.getElementById('inv-price').value) || null
    };

    try {
        if (editingInventoryId) {
            if (isDemoMode) {
                const idx = inventoryItems.findIndex(i => i.id === editingInventoryId);
                if (idx !== -1) inventoryItems[idx] = { ...inventoryItems[idx], ...payload };
            } else {
                await api.updateInventoryItem(editingInventoryId, payload);
            }
            showToast('Product updated successfully! 📦');
        } else {
            if (isDemoMode) {
                inventoryItems.unshift({ id: 'i' + Date.now(), ...payload });
            } else {
                await api.createInventoryItem(payload);
            }
            showToast('Product added to inventory! 📦');
        }

        closeModal('inventory-modal');
        await loadInventory();
    } catch (e) {
        showToast('Could not save inventory product', 'error');
    }
}

async function adjustStock(id, delta) {
    const item = inventoryItems.find(i => i.id === id);
    if (!item) return;

    const newQty = Math.max(0, (item.quantity || 0) + delta);
    try {
        if (isDemoMode) {
            item.quantity = newQty;
        } else {
            await api.updateInventoryItem(id, { quantity: newQty });
        }
        await loadInventory();
    } catch (e) {
        showToast('Could not update quantity', 'error');
    }
}

async function deleteInventoryItem(id) {
    if (!confirm('Are you sure you want to remove this item from inventory?')) return;

    try {
        if (isDemoMode) {
            inventoryItems = inventoryItems.filter(i => i.id !== id);
        } else {
            await api.deleteInventoryItem(id);
        }
        showToast('Product deleted from inventory');
        await loadInventory();
    } catch (e) {
        showToast('Could not delete product', 'error');
    }
}
