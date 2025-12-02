const API = 'https://six7backend.onrender.com/api/seller';
let chart = null, imgUrl = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token'), type = localStorage.getItem('user_type');
    if (!token || type !== 'seller') return alert(type !== 'seller' ? 'Access denied. Sellers only.' : ''), window.location.href = '../auth/login.html';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.storeName) document.getElementById('sellerName').textContent = user.storeName;
    initDashboard();
    setupListeners();
});

function setupListeners() {
    document.querySelectorAll('.sidebar-menu a[data-section]').forEach(l => l.addEventListener('click', e => (e.preventDefault(), nav(l.getAttribute('data-section')))));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('saveProductBtn').addEventListener('click', saveProduct);
    document.getElementById('productImageFile').addEventListener('change', handleImg);
    document.getElementById('updateStockBtn').addEventListener('click', updateStock);
    document.getElementById('orderStatusFilter').addEventListener('change', e => loadOrders(e.target.value));
    document.getElementById('reservationStatusFilter').addEventListener('change', e => loadReservations(e.target.value));
    document.getElementById('revenuePeriod').addEventListener('change', e => loadRevenue(e.target.value));
    document.getElementById('productModal').addEventListener('hidden.bs.modal', resetForm);
}

function handleImg(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!['image/png','image/jpeg','image/jpg','image/gif','image/webp'].includes(f.type)) return notify('Invalid file type', 'error'), e.target.value = '';
    if (f.size > 10485760) return notify('File too large. Max 10MB', 'error'), e.target.value = '';
    const r = new FileReader();
    r.onload = e => (document.getElementById('imagePreview').src = e.target.result, document.getElementById('imagePreviewContainer').style.display = 'block');
    r.readAsDataURL(f);
}

async function uploadImg() {
    const f = document.getElementById('productImageFile').files[0];
    if (!f) return null;
    try {
        const fd = new FormData();
        fd.append('image', f);
        const res = await fetch(`${API}/upload-image`, {method: 'POST', headers: {'Authorization': `Bearer ${localStorage.getItem('access_token')}`}, body: fd});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        return data.imageUrl;
    } catch (err) { throw err; }
}

function nav(s) {
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-section="${s}"]`).classList.add('active');
    document.querySelectorAll('.section-content').forEach(c => c.style.display = 'none');
    document.getElementById(`${s}Section`).style.display = 'block';
    const actions = {dashboard: loadDashboard, products: loadProducts, orders: loadOrders, reservations: loadReservations, inventory: loadInv, analytics: loadAnalytics};
    actions[s]?.();
    closeSidebar();
}

async function initDashboard() { await loadDashboard(); }

async function loadDashboard() {
    try {
        await Promise.all([loadProducts(), loadOrders(), loadRevenue('month')]);
        const o = await api('/orders?limit=5');
        displayRecent(o.orders || []);
    } catch (e) { notify('Error loading dashboard: ' + e.message, 'error'); }
}

async function loadProducts() {
    try {
        const res = await api('/products'), prods = res.products || [];
        document.getElementById('totalProducts').textContent = prods.length;
        displayProds(prods);
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

function displayProds(prods) {
    const tb = document.getElementById('productsTable');
    if (!prods.length) return tb.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';
    tb.innerHTML = prods.map(p => `<tr><td>${p.imageUrl ? `<img src="${p.imageUrl}" class="product-image-preview" alt="${p.productName}">` : '<i class="bi bi-image" style="font-size: 2rem;"></i>'}</td><td>${p.productName}</td><td>${p.category||'N/A'}</td><td>₱${parseFloat(p.unitPrice).toFixed(2)}</td><td>${p.inventory?.quantityInStock||0}</td><td><span class="badge ${p.isAvailable?'bg-success':'bg-danger'}">${p.isAvailable?'Available':'Unavailable'}</span></td><td class="table-actions"><button class="btn btn-sm btn-primary" onclick="editProduct(${p.productId})"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.productId})"><i class="bi bi-trash"></i></button></td></tr>`).join('');
}

async function editProduct(id) {
    try {
        const res = await api('/products'), p = res.products.find(x => x.productId === id);
        if (!p) return notify('Product not found', 'error');
        document.getElementById('productId').value = p.productId;
        document.getElementById('productName').value = p.productName;
        document.getElementById('productCategory').value = p.category || '';
        document.getElementById('productPrice').value = p.unitPrice;
        document.getElementById('productImage').value = p.imageUrl || '';
        document.getElementById('productDescription').value = p.description || '';
        document.getElementById('productAvailable').checked = p.isAvailable;
        if (p.imageUrl) imgUrl = p.imageUrl, document.getElementById('imagePreview').src = p.imageUrl, document.getElementById('imagePreviewContainer').style.display = 'block';
        document.getElementById('productModalTitle').textContent = 'Edit Product';
        new bootstrap.Modal(document.getElementById('productModal')).show();
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

async function saveProduct() {
    const id = document.getElementById('productId').value, name = document.getElementById('productName').value.trim(), price = document.getElementById('productPrice').value;
    if (!name) return notify('Product name required', 'error');
    if (!price || parseFloat(price) <= 0) return notify('Valid price required', 'error');
    const btn = document.getElementById('saveProductBtn'), orig = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    btn.disabled = true;
    try {
        let finalUrl = null, f = document.getElementById('productImageFile').files[0];
        if (f) notify('Uploading image...', 'info'), finalUrl = await uploadImg();
        else if (imgUrl) finalUrl = imgUrl;
        else if (document.getElementById('productImage').value.trim()) finalUrl = document.getElementById('productImage').value.trim();
        const data = {productName: name, description: document.getElementById('productDescription').value.trim() || null, unitPrice: parseFloat(price), isAvailable: document.getElementById('productAvailable').checked ? 1 : 0, category: document.getElementById('productCategory').value.trim() || null, imageUrl: finalUrl};
        const res = await api(id ? `/products/${id}` : '/products', id ? 'PUT' : 'POST', data);
        notify(res.message || 'Product saved', 'success');
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        imgUrl = null;
        await loadProducts();
    } catch (e) { notify('Error: ' + e.message, 'error'); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
        const res = await api(`/products/${id}`, 'DELETE');
        notify(res.message || 'Product deleted', 'success');
        await loadProducts();
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

async function loadOrders(st = '') {
    try {
        const res = await api(st ? `/orders?status=${st}` : '/orders'), ords = res.orders || [];
        document.getElementById('totalOrders').textContent = ords.length;
        document.getElementById('pendingOrders').textContent = ords.filter(o => o.status === 'Pending').length;
        displayOrds(ords);
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

function displayOrds(ords) {
    const c = document.getElementById('ordersTable');
    if (!ords.length) return c.innerHTML = '<div class="order-flashcard" style="grid-column: 1 / -1;"><div style="text-align: center; color: #999;">No orders found</div></div>';
    c.innerHTML = ords.map(o => `<div class="order-flashcard"><div class="order-flashcard-header"><span class="order-id">#${o.orderId}</span><span class="order-status-badge ${badge(o.status)}">${o.status}</span></div><div class="order-flashcard-body"><div class="order-meta-item"><span class="label">Customer</span><span class="value">${o.customerName||'Unknown'}</span></div><div class="order-meta-item"><span class="label">Date</span><span class="value">${o.orderDate?new Date(o.orderDate).toLocaleDateString():''}</span></div><div class="order-meta-item"><span class="label">Type</span><span class="value">${o.type||'N/A'}</span></div><div class="order-amount">₱${parseFloat(o.totalAmount).toFixed(2)}</div></div><div class="order-flashcard-footer"><button class="btn btn-sm btn-info" onclick="viewOrderDetails(${o.orderId})"><i class="bi bi-eye"></i> View</button><select class="form-select form-select-sm" onchange="updateOrderStatus(${o.orderId}, this.value)"><option value="">Change Status</option><option value="Pending">Pending</option><option value="Confirmed">Confirmed</option><option value="Delivered">Delivered</option><option value="Cancelled">Cancelled</option></select></div></div>`).join('');
}

function displayRecent(ords) {
    const c = document.getElementById('recentOrdersTable');
    if (!ords.length) return c.innerHTML = '<div class="order-flashcard" style="grid-column: 1 / -1;"><div style="text-align: center; color: #999;">No recent orders</div></div>';
    c.innerHTML = ords.slice(0,5).map(o => `<div class="order-flashcard"><div class="order-flashcard-header"><span class="order-id">#${o.orderId}</span><span class="order-status-badge ${badge(o.status)}">${o.status}</span></div><div class="order-flashcard-body"><div class="order-meta-item"><span class="label">Customer</span><span class="value">${o.customerName||'Unknown'}</span></div><div class="order-meta-item"><span class="label">Date</span><span class="value">${o.orderDate?new Date(o.orderDate).toLocaleDateString():''}</span></div><div class="order-amount">₱${parseFloat(o.totalAmount).toFixed(2)}</div></div><div class="order-flashcard-footer"><button class="btn btn-sm btn-info" style="width: 100%;" onclick="viewOrderDetails(${o.orderId})"><i class="bi bi-eye"></i> View Details</button></div></div>`).join('');
}

async function updateOrderStatus(id, st) {
    if (!st) return;
    try {
        const res = await api(`/orders/${id}/status`, 'PUT', {status: st});
        notify(res.message || 'Status updated', 'success');
        await loadOrders();
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

async function viewOrderDetails(id) {
    try {
        const res = await api('/orders'), o = res.orders.find(x => x.orderId === id);
        if (!o) return notify('Order not found', 'error');
        document.getElementById('orderDetailsContent').innerHTML = `<div class="row"><div class="col-md-6"><h6>Order Information</h6><p><strong>Order ID:</strong> #${o.orderId}</p><p><strong>Customer:</strong> ${o.customerName||'Unknown'}</p><p><strong>Date:</strong> ${new Date(o.orderDate).toLocaleString()}</p><p><strong>Type:</strong> ${o.type}</p><p><strong>Status:</strong> <span class="badge ${badge(o.status)}">${o.status}</span></p></div><div class="col-md-6"><h6>Delivery Information</h6><p><strong>Address:</strong> ${o.deliveryAddress||'N/A'}</p><p><strong>Notes:</strong> ${o.notes||'None'}</p></div><div class="col-md-12 mt-3"><h6>Order Items</h6><table class="table table-sm"><thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead><tbody>${o.items?o.items.map(i=>`<tr><td>${i.productName}</td><td>${i.quantity}</td><td>₱${parseFloat(i.unitPrice).toFixed(2)}</td><td>₱${parseFloat(i.subtotal).toFixed(2)}</td></tr>`).join(''):'<tr><td colspan="4">No items</td></tr>'}</tbody><tfoot><tr><th colspan="3">Total</th><th>₱${parseFloat(o.totalAmount).toFixed(2)}</th></tr></tfoot></table></div></div>`;
        new bootstrap.Modal(document.getElementById('orderModal')).show();
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

async function loadInv() {
    const tb = document.getElementById('inventoryTable');
    tb.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner-border spinner-border-sm" role="status"></div> Loading inventory...</td></tr>';
    
    try {
        const res = await api('/products');
        console.log('Inventory API Response:', res);
        
        if (!res || !res.products) {
            throw new Error('Invalid response from server');
        }
        
        displayInv(res.products);
    } catch (e) {
        console.error('Inventory Load Error:', e);
        tb.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading inventory: ${e.message}</td></tr>`;
        notify('Error loading inventory: ' + e.message, 'error');
    }
}

function displayInv(prods) {
    const tb = document.getElementById('inventoryTable');
    
    if (!prods || prods.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="text-center">No inventory records found</td></tr>';
        return;
    }
    
    tb.innerHTML = prods.map(p => {
        const inv = p.inventory || {};
        const stock = inv.quantityInStock !== undefined ? inv.quantityInStock : 0;
        const reorder = inv.reorderLevel !== undefined ? inv.reorderLevel : 10;
        const low = stock <= reorder;
        const lastRestock = inv.lastRestocked ? new Date(inv.lastRestocked).toLocaleDateString() : 'Never';
        
        return `<tr>
            <td>${p.productName || 'Unnamed Product'}</td>
            <td>${stock}</td>
            <td>${reorder}</td>
            <td>${lastRestock}</td>
            <td><span class="badge ${low ? 'bg-warning' : 'bg-success'}">${low ? 'Low Stock' : 'In Stock'}</span></td>
            <td class="table-actions">
                <button class="btn btn-sm btn-primary" onclick="openStockModal(${p.productId}, '${(p.productName || '').replace(/'/g, "\\'")}', ${stock})">
                    <i class="bi bi-plus-circle"></i> Update Stock
                </button>
            </td>
        </tr>`;
    }).join('');
}

function openStockModal(id, name, stock) {
    document.getElementById('stockProductId').value = id;
    document.getElementById('stockProductName').value = name;
    document.getElementById('currentStock').value = stock;
    document.getElementById('quantityChange').value = '';
    document.getElementById('stockNotes').value = '';
    new bootstrap.Modal(document.getElementById('stockModal')).show();
}

async function updateStock() {
    const btn = document.getElementById('updateStockBtn');
    const origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';
    btn.disabled = true;
    
    try {
        const id = document.getElementById('stockProductId').value;
        const change = parseInt(document.getElementById('quantityChange').value);
        
        if (isNaN(change) || change === 0) {
            throw new Error('Please enter a valid quantity change');
        }
        
        const data = {
            quantity_change: change,
            reason: document.getElementById('stockReason').value,
            notes: document.getElementById('stockNotes').value.trim() || null
        };
        
        console.log('Updating stock:', data);
        const res = await api(`/inventory/${id}`, 'POST', data);
        
        notify(res.message || 'Stock updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('stockModal')).hide();
        await loadInv();
    } catch (e) {
        console.error('Stock Update Error:', e);
        notify('Error updating stock: ' + e.message, 'error');
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

async function loadAnalytics() {
    try { await Promise.all([loadRevenue('month'), loadTop()]); }
    catch (e) { notify('Error: ' + e.message, 'error'); }
}

async function loadRevenue(per = 'month') {
    try {
        const res = await api(`/revenue?period=${per}`);
        if (per === 'month') document.getElementById('monthlyRevenue').textContent = `₱${parseFloat(res.total_revenue||0).toFixed(2)}`;
        updateChart(res.revenue_by_day || []);
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

function updateChart(data) {
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('revenueChart'), {type: 'line', data: {labels: data.map(d => new Date(d.date).toLocaleDateString()), datasets: [{label: 'Revenue', data: data.map(d => d.revenue), borderColor: 'rgb(52, 152, 219)', backgroundColor: 'rgba(52, 152, 219, 0.1)', tension: 0.4, fill: true}]}, options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {display: true, position: 'top'}}, scales: {y: {beginAtZero: true, ticks: {callback: v => '₱' + v.toFixed(2)}}}}});
}

async function loadTop() {
    try {
        const res = await api('/analytics'), tb = document.getElementById('topProductsTable'), prods = res.top_products || [];
        if (!prods.length) return tb.innerHTML = '<tr><td colspan="3" class="text-center">No sales data</td></tr>';
        tb.innerHTML = prods.map(p => `<tr><td>${p.name}</td><td>${p.total_sold}</td><td>₱${parseFloat(p.total_revenue).toFixed(2)}</td></tr>`).join('');
    } catch (e) { notify('Error: ' + e.message, 'error'); }
}

function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productImageFile').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
    imgUrl = null;
    document.getElementById('productImage').value = '';
    document.getElementById('productModalTitle').textContent = 'Add Product';
}

function logout() {
    ['access_token', 'user', 'user_type'].forEach(k => localStorage.removeItem(k));
    window.location.href = '../auth/login.html';
}

function badge(st) {
    const c = {Pending: 'bg-warning', Confirmed: 'bg-info', Delivered: 'bg-success', Cancelled: 'bg-danger', pending: 'bg-warning', confirmed: 'bg-info', preparing: 'bg-primary', ready: 'bg-info', completed: 'bg-success', cancelled: 'bg-danger'};
    return c[st] || 'bg-secondary';
}

async function api(ep, method = 'GET', data = null) {
    const token = localStorage.getItem('access_token');
    if (!token) return notify('Session expired. Please login again.', 'error'), setTimeout(logout, 2000), Promise.reject(new Error('No token'));
    const opt = {method, headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}};
    if (data && method !== 'GET') opt.body = JSON.stringify(data);
    try {
        const res = await fetch(`${API}${ep}`, opt);
        if (!res.ok) {
            let err;
            try { err = await res.json(); } catch { err = {message: res.statusText}; }
            if (res.status === 401 || res.status === 422) return notify('Session expired. Please login again.', 'error'), setTimeout(logout, 2000), Promise.reject(new Error('Auth failed'));
            throw new Error(err.msg || err.error || err.message || `HTTP error! status: ${res.status}`);
        }
        return await res.json();
    } catch (e) { throw e; }
}

function notify(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast align-items-center text-white bg-${type==='error'?'danger':type==='success'?'success':'info'} border-0`;
    t.setAttribute('role', 'alert');
    t.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    let c = document.querySelector('.toast-container');
    if (!c) c = document.createElement('div'), c.className = 'toast-container position-fixed top-0 end-0 p-3', document.body.appendChild(c);
    c.appendChild(t);
    const bt = new bootstrap.Toast(t);
    bt.show();
    t.addEventListener('hidden.bs.toast', () => t.remove());
}

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.openStockModal = openStockModal;
window.updateOrderStatus = updateOrderStatus;
window.viewOrderDetails = viewOrderDetails;

function toggleSidebar() {
    const s = document.querySelector('.sidebar'), o = document.getElementById('menuOverlay');
    s.classList.toggle('active');
    o.classList.toggle('active');
}

function closeSidebar() {
    const s = document.querySelector('.sidebar'), o = document.getElementById('menuOverlay');
    s.classList.remove('active');
    o.classList.remove('active');
}

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;