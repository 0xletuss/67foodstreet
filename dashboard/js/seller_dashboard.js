const API_BASE_URL = 'https://six7backend.onrender.com/api/seller';
let revenueChart = null, uploadedImageUrl = null;

// Auth & Init
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    const userType = localStorage.getItem('user_type');
    
    if (!token || userType !== 'seller') {
        alert(userType !== 'seller' ? 'Access denied. Sellers only.' : '');
        return window.location.href = '../auth/login.html';
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.storeName) document.getElementById('sellerName').textContent = user.storeName;

    initializeDashboard();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    document.querySelectorAll('.sidebar-menu a[data-section]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navigateToSection(link.getAttribute('data-section'));
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('saveProductBtn').addEventListener('click', saveProduct);
    document.getElementById('productImageFile').addEventListener('change', handleImageSelect);
    document.getElementById('updateStockBtn').addEventListener('click', updateStock);
    document.getElementById('orderStatusFilter').addEventListener('change', e => loadOrders(e.target.value));
    document.getElementById('revenuePeriod').addEventListener('change', e => loadRevenue(e.target.value));
    document.getElementById('productModal').addEventListener('hidden.bs.modal', resetProductForm);
}

// Image Upload
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showNotification('Invalid file type. Use PNG, JPG, GIF, or WEBP', 'error');
        return e.target.value = '';
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showNotification('File too large. Max 10MB', 'error');
        return e.target.value = '';
    }
    
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreviewContainer').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function uploadImageToCloudinary() {
    const file = document.getElementById('productImageFile').files[0];
    if (!file) return null;
    
    try {
        const formData = new FormData();
        formData.append('image', file);
        
        console.log('Uploading image to Cloudinary...');
        
        const response = await fetch(`${API_BASE_URL}/upload-image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }
        
        console.log('✓ Image uploaded successfully:', data.imageUrl);
        return data.imageUrl;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

// Navigation
function navigateToSection(section) {
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.getElementById(`${section}Section`).style.display = 'block';

    const actions = { dashboard: loadDashboard, products: loadProducts, orders: loadOrders, inventory: loadInventory, analytics: loadAnalytics };
    actions[section]?.();
}

// Dashboard
async function initializeDashboard() { await loadDashboard(); }

async function loadDashboard() {
    try {
        await Promise.all([loadProducts(), loadOrders(), loadRevenue('month')]);
        const orders = await apiCall('/orders?limit=5');
        displayRecentOrders(orders.orders || []);
    } catch (error) {
        showNotification('Error loading dashboard: ' + error.message, 'error');
    }
}

// Products
async function loadProducts() {
    try {
        const response = await apiCall('/products');
        const products = response.products || [];
        document.getElementById('totalProducts').textContent = products.length;
        displayProducts(products);
    } catch (error) {
        showNotification('Error loading products: ' + error.message, 'error');
    }
}

function displayProducts(products) {
    const tbody = document.getElementById('productsTable');
    if (!products.length) return tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';

    tbody.innerHTML = products.map(p => `
        <tr>
            <td>${p.imageUrl ? `<img src="${p.imageUrl}" class="product-image-preview" alt="${p.productName}">` : '<i class="bi bi-image" style="font-size: 2rem;"></i>'}</td>
            <td>${p.productName}</td>
            <td>${p.category || 'N/A'}</td>
            <td>₱${parseFloat(p.unitPrice).toFixed(2)}</td>
            <td>${p.inventory?.quantityInStock || 0}</td>
            <td><span class="badge ${p.isAvailable ? 'bg-success' : 'bg-danger'}">${p.isAvailable ? 'Available' : 'Unavailable'}</span></td>
            <td class="table-actions">
                <button class="btn btn-sm btn-primary" onclick="editProduct(${p.productId})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.productId})"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function editProduct(productId) {
    try {
        const response = await apiCall('/products');
        const p = response.products.find(prod => prod.productId === productId);
        if (!p) return showNotification('Product not found', 'error');

        document.getElementById('productId').value = p.productId;
        document.getElementById('productName').value = p.productName;
        document.getElementById('productCategory').value = p.category || '';
        document.getElementById('productPrice').value = p.unitPrice;
        document.getElementById('productImage').value = p.imageUrl || '';
        document.getElementById('productDescription').value = p.description || '';
        document.getElementById('productAvailable').checked = p.isAvailable;
        
        // Set uploadedImageUrl when editing
        if (p.imageUrl) {
            uploadedImageUrl = p.imageUrl;
            document.getElementById('imagePreview').src = p.imageUrl;
            document.getElementById('imagePreviewContainer').style.display = 'block';
        }
        
        document.getElementById('productModalTitle').textContent = 'Edit Product';
        new bootstrap.Modal(document.getElementById('productModal')).show();
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function saveProduct() {
    const productId = document.getElementById('productId').value;
    const productName = document.getElementById('productName').value.trim();
    const unitPrice = document.getElementById('productPrice').value;
    
    if (!productName) return showNotification('Product name required', 'error');
    if (!unitPrice || parseFloat(unitPrice) <= 0) return showNotification('Valid price required', 'error');
    
    // Show loading state
    const saveBtn = document.getElementById('saveProductBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    saveBtn.disabled = true;
    
    try {
        let finalImageUrl = null;
        
        // Check if there's a new image file to upload
        const file = document.getElementById('productImageFile').files[0];
        
        if (file) {
            // Upload new image
            showNotification('Uploading image...', 'info');
            finalImageUrl = await uploadImageToCloudinary();
            console.log('New image uploaded:', finalImageUrl);
        } else if (uploadedImageUrl) {
            // Use existing uploaded URL (for edits)
            finalImageUrl = uploadedImageUrl;
            console.log('Using existing image:', finalImageUrl);
        } else if (document.getElementById('productImage').value.trim()) {
            // Use manual URL input
            finalImageUrl = document.getElementById('productImage').value.trim();
            console.log('Using manual URL:', finalImageUrl);
        }
        
        console.log('Final imageUrl to save:', finalImageUrl);
        
        const data = {
            productName,
            description: document.getElementById('productDescription').value.trim() || null,
            unitPrice: parseFloat(unitPrice),
            isAvailable: document.getElementById('productAvailable').checked ? 1 : 0,
            category: document.getElementById('productCategory').value.trim() || null,
            imageUrl: finalImageUrl
        };
        
        console.log('Product data being sent:', data);

        const response = await apiCall(
            productId ? `/products/${productId}` : '/products', 
            productId ? 'PUT' : 'POST', 
            data
        );
        
        console.log('Save response:', response);
        
        showNotification(response.message || 'Product saved successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        
        // Reset uploadedImageUrl after successful save
        uploadedImageUrl = null;
        
        await loadProducts();
    } catch (error) {
        console.error('Save error:', error);
        showNotification('Error: ' + error.message, 'error');
    } finally {
        // Restore button state
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteProduct(productId) {
    if (!confirm('Delete this product?')) return;
    try {
        const response = await apiCall(`/products/${productId}`, 'DELETE');
        showNotification(response.message || 'Product deleted', 'success');
        await loadProducts();
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// Orders
async function loadOrders(status = '') {
    try {
        const response = await apiCall(status ? `/orders?status=${status}` : '/orders');
        const orders = response.orders || [];
        document.getElementById('totalOrders').textContent = orders.length;
        document.getElementById('pendingOrders').textContent = orders.filter(o => o.status === 'Pending').length;
        displayOrders(orders);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function displayOrders(orders) {
    const tbody = document.getElementById('ordersTable');
    if (!orders.length) return tbody.innerHTML = '<tr><td colspan="7" class="text-center">No orders found</td></tr>';

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td>#${o.orderId}</td>
            <td>${o.customerName || 'Unknown'}</td>
            <td>${new Date(o.orderDate).toLocaleDateString()}</td>
            <td>${o.type}</td>
            <td>₱${parseFloat(o.totalAmount).toFixed(2)}</td>
            <td><span class="badge badge-status ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="viewOrderDetails(${o.orderId})"><i class="bi bi-eye"></i></button>
                <select class="form-select form-select-sm" onchange="updateOrderStatus(${o.orderId}, this.value)" style="width: auto; display: inline-block;">
                    <option value="">Change Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
            </td>
        </tr>
    `).join('');
}

function displayRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersTable');
    if (!orders.length) return tbody.innerHTML = '<tr><td colspan="6" class="text-center">No recent orders</td></tr>';

    tbody.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
            <td>#${o.orderId}</td>
            <td>${o.customerName || 'Unknown'}</td>
            <td>${new Date(o.orderDate).toLocaleDateString()}</td>
            <td>₱${parseFloat(o.totalAmount).toFixed(2)}</td>
            <td><span class="badge badge-status ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
            <td><button class="btn btn-sm btn-info" onclick="viewOrderDetails(${o.orderId})"><i class="bi bi-eye"></i></button></td>
        </tr>
    `).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    if (!newStatus) return;
    try {
        const response = await apiCall(`/orders/${orderId}/status`, 'PUT', { status: newStatus });
        showNotification(response.message || 'Status updated', 'success');
        await loadOrders();
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function viewOrderDetails(orderId) {
    try {
        const response = await apiCall('/orders');
        const o = response.orders.find(ord => ord.orderId === orderId);
        if (!o) return showNotification('Order not found', 'error');

        document.getElementById('orderDetailsContent').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Order Information</h6>
                    <p><strong>Order ID:</strong> #${o.orderId}</p>
                    <p><strong>Customer:</strong> ${o.customerName || 'Unknown'}</p>
                    <p><strong>Date:</strong> ${new Date(o.orderDate).toLocaleString()}</p>
                    <p><strong>Type:</strong> ${o.type}</p>
                    <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(o.status)}">${o.status}</span></p>
                </div>
                <div class="col-md-6">
                    <h6>Delivery Information</h6>
                    <p><strong>Address:</strong> ${o.deliveryAddress || 'N/A'}</p>
                    <p><strong>Notes:</strong> ${o.notes || 'None'}</p>
                </div>
                <div class="col-md-12 mt-3">
                    <h6>Order Items</h6>
                    <table class="table table-sm">
                        <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
                        <tbody>${o.items ? o.items.map(i => `<tr><td>${i.productName}</td><td>${i.quantity}</td><td>₱${parseFloat(i.unitPrice).toFixed(2)}</td><td>₱${parseFloat(i.subtotal).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="4">No items</td></tr>'}</tbody>
                        <tfoot><tr><th colspan="3">Total</th><th>₱${parseFloat(o.totalAmount).toFixed(2)}</th></tr></tfoot>
                    </table>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('orderModal')).show();
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// Inventory
async function loadInventory() {
    try {
        const response = await apiCall('/products');
        displayInventory(response.products || []);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function displayInventory(products) {
    const tbody = document.getElementById('inventoryTable');
    if (!products.length) return tbody.innerHTML = '<tr><td colspan="6" class="text-center">No inventory records</td></tr>';

    tbody.innerHTML = products.map(p => {
        const inv = p.inventory || {};
        const needsReorder = inv.quantityInStock <= (inv.reorderLevel || 10);
        return `
            <tr>
                <td>${p.productName}</td>
                <td>${inv.quantityInStock || 0}</td>
                <td>${inv.reorderLevel || 10}</td>
                <td>${inv.lastRestocked ? new Date(inv.lastRestocked).toLocaleDateString() : 'N/A'}</td>
                <td><span class="badge ${needsReorder ? 'bg-warning' : 'bg-success'}">${needsReorder ? 'Low Stock' : 'In Stock'}</span></td>
                <td class="table-actions"><button class="btn btn-sm btn-primary" onclick="openStockModal(${p.productId}, '${p.productName}', ${inv.quantityInStock || 0})"><i class="bi bi-plus-circle"></i> Update Stock</button></td>
            </tr>
        `;
    }).join('');
}

function openStockModal(productId, productName, currentStock) {
    document.getElementById('stockProductId').value = productId;
    document.getElementById('stockProductName').value = productName;
    document.getElementById('currentStock').value = currentStock;
    document.getElementById('quantityChange').value = '';
    document.getElementById('stockNotes').value = '';
    new bootstrap.Modal(document.getElementById('stockModal')).show();
}

async function updateStock() {
    try {
        const productId = document.getElementById('stockProductId').value;
        const data = {
            quantity_change: parseInt(document.getElementById('quantityChange').value),
            reason: document.getElementById('stockReason').value,
            notes: document.getElementById('stockNotes').value
        };
        const response = await apiCall(`/inventory/${productId}`, 'POST', data);
        showNotification(response.message || 'Stock updated', 'success');
        bootstrap.Modal.getInstance(document.getElementById('stockModal')).hide();
        await loadInventory();
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// Analytics
async function loadAnalytics() {
    try {
        await Promise.all([loadRevenue('month'), loadTopProducts()]);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function loadRevenue(period = 'month') {
    try {
        const response = await apiCall(`/revenue?period=${period}`);
        if (period === 'month') {
            document.getElementById('monthlyRevenue').textContent = `₱${parseFloat(response.total_revenue || 0).toFixed(2)}`;
        }
        updateRevenueChart(response.revenue_by_day || []);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function updateRevenueChart(data) {
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(document.getElementById('revenueChart'), {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.date).toLocaleDateString()),
            datasets: [{
                label: 'Revenue',
                data: data.map(d => d.revenue),
                borderColor: 'rgb(52, 152, 219)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => '₱' + v.toFixed(2) } } }
        }
    });
}

async function loadTopProducts() {
    try {
        const response = await apiCall('/analytics');
        const tbody = document.getElementById('topProductsTable');
        const products = response.top_products || [];
        if (!products.length) return tbody.innerHTML = '<tr><td colspan="3" class="text-center">No sales data</td></tr>';
        tbody.innerHTML = products.map(p => `<tr><td>${p.name}</td><td>${p.total_sold}</td><td>₱${parseFloat(p.total_revenue).toFixed(2)}</td></tr>`).join('');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// Helpers
function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productImageFile').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
    uploadedImageUrl = null;
    document.getElementById('productImage').value = '';
    document.getElementById('productModalTitle').textContent = 'Add Product';
}

function logout() {
    ['access_token', 'user', 'user_type'].forEach(k => localStorage.removeItem(k));
    window.location.href = '../auth/login.html';
}

function getStatusBadgeClass(status) {
    const classes = {
        'Pending': 'bg-warning', 'Confirmed': 'bg-info', 'Delivered': 'bg-success', 'Cancelled': 'bg-danger',
        'pending': 'bg-warning', 'confirmed': 'bg-info', 'preparing': 'bg-primary', 'ready': 'bg-info', 
        'completed': 'bg-success', 'cancelled': 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

async function apiCall(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        setTimeout(logout, 2000);
        throw new Error('No authentication token');
    }

    const options = {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    };
    if (data && method !== 'GET') options.body = JSON.stringify(data);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch { errorData = { message: response.statusText }; }
            if (response.status === 401 || response.status === 422) {
                showNotification('Session expired. Please login again.', 'error');
                setTimeout(logout, 2000);
                throw new Error('Authentication failed');
            }
            throw new Error(errorData.msg || errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        throw error;
    }
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;

    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(container);
    }

    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// Global exports
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.openStockModal = openStockModal;
window.updateOrderStatus = updateOrderStatus;
window.viewOrderDetails = viewOrderDetails;