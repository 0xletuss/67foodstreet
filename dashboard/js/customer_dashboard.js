const API_BASE_URL = 'https://six7backend.onrender.com/api';
let authToken = null;
let currentCustomer = null;
let allProducts = [];
let cart = { items: [], subtotal: 0, totalItems: 0 };

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    authToken = localStorage.getItem('access_token');
    
    if (!authToken) {
        window.location.href = '../auth/login.html';
        return;
    }
    
    const userType = localStorage.getItem('user_type');
    if (userType !== 'customer') {
        alert('Access denied. Customers only.');
        window.location.href = '../auth/login.html';
        return;
    }
    
    loadCustomerProfile();
    loadProducts();
    loadCart(); // Load from backend
});

// API Helper Function
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return null;
            }
            const data = await response.json();
            throw new Error(data.detail || 'API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error: ' + error.message, 'danger');
        return null;
    }
}

// Load Customer Profile
async function loadCustomerProfile() {
    const data = await apiCall('/customer/profile');
    if (data && data.profile) {
        currentCustomer = data.profile;
        document.getElementById('customerName').textContent = `Welcome, ${currentCustomer.customerName}!`;
        
        document.getElementById('profileCustomerName').value = currentCustomer.customerName || '';
        document.getElementById('phoneNumber').value = currentCustomer.phoneNumber || '';
        document.getElementById('profileEmail').value = currentCustomer.email || '';
        document.getElementById('address').value = currentCustomer.address || '';
    }
}

// Load Products
async function loadProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = `
        <div class="col-12">
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading products...</p>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_BASE_URL}/products/`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data && data.products) {
            allProducts = data.products;
            displayProducts(allProducts);
            populateCategories();
        } else {
            throw new Error('No products data received');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    <h5><i class="fas fa-exclamation-triangle me-2"></i>Error Loading Products</h5>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="loadProducts()">
                        <i class="fas fa-redo me-1"></i>Retry
                    </button>
                </div>
            </div>
        `;
    }
}

// Display Products
function displayProducts(products) {
    const container = document.getElementById('productsContainer');
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛍️</div>
                <h4>No products available</h4>
                <p class="empty-state-text">Check back later for new items</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="product-card" onclick="viewProduct(${product.productId})" style="cursor: pointer;">
            <div class="product-image" style="position: relative;">
                <img src="${product.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                     alt="${product.productName}"
                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 1rem 1rem 0 0;">
                <span class="product-badge ${product.isAvailable ? 'badge-available' : 'badge-unavailable'}" style="position: absolute; top: 0.75rem; right: 0.75rem;">
                    ${product.isAvailable ? '✓ Available' : '✕ Unavailable'}
                </span>
            </div>
            <div class="product-info">
                <div class="product-name" title="${product.productName}">
                    ${product.productName}
                </div>
                <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.75rem; line-height: 1.4;" title="${product.description}">
                    ${product.description || 'Fresh and delicious'}
                </p>
                <div class="product-price">
                    ₱${parseFloat(product.unitPrice).toFixed(2)}
                </div>
                <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem; font-size: 0.875rem; color: #6b7280;">
                    <span>📦 Stock: <strong>${product.stock || 0}</strong></span>
                </div>
                ${product.category ? `<div style="display: inline-block; padding: 0.375rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: #fed7aa; color: #b45309; margin-bottom: 1rem;">${product.category}</div>` : ''}
                ${product.sellerName ? `<p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.75rem;"><i class="fas fa-store" style="color: #f97316; margin-right: 0.5rem;"></i>${product.sellerName}</p>` : ''}
                <button class="btn btn-primary" style="width: 100%;"
                        onclick="event.stopPropagation(); addToCart(${product.productId})"
                        ${!product.isAvailable || product.stock <= 0 ? 'disabled' : ''}>
                    <i class="fas fa-cart-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    `).join('');
}

// Populate Categories for Filter
function populateCategories() {
    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const select = document.getElementById('categoryFilter');
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

// Apply Filters
function applyFilters() {
    let filtered = [...allProducts];
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.productName.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    const category = document.getElementById('categoryFilter').value;
    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }
    
    const sort = document.getElementById('sortFilter').value;
    if (sort === 'name') {
        filtered.sort((a, b) => a.productName.localeCompare(b.productName));
    } else if (sort === 'price-low') {
        filtered.sort((a, b) => parseFloat(a.unitPrice) - parseFloat(b.unitPrice));
    } else if (sort === 'price-high') {
        filtered.sort((a, b) => parseFloat(b.unitPrice) - parseFloat(a.unitPrice));
    }
    
    displayProducts(filtered);
}

// Cart Functions - Now using Backend API
async function loadCart() {
    const data = await apiCall('/cart-items/my-cart');
    if (data) {
        cart = data;
        updateCartBadge();
    }
}

function updateCartBadge() {
    document.getElementById('cartCount').textContent = cart.totalItems || 0;
}

async function addToCart(productId) {
    const data = await apiCall('/cart-items/', 'POST', {
        productId: productId,
        quantity: 1
    });
    
    if (data) {
        showToast('Item added to cart', 'success');
        await loadCart(); // Reload cart from backend
        
        if (document.getElementById('cart').classList.contains('active')) {
            displayCart();
        }
    }
}

async function removeFromCart(cartItemId) {
    const data = await apiCall(`/cart-items/${cartItemId}`, 'DELETE');
    
    if (data !== null) { // DELETE returns null on success
        showToast('Item removed from cart', 'info');
        await loadCart();
        displayCart();
    }
}

async function updateCartQuantity(cartItemId, newQuantity) {
    if (newQuantity <= 0) {
        await removeFromCart(cartItemId);
        return;
    }
    
    const data = await apiCall(`/cart-items/${cartItemId}`, 'PUT', {
        quantity: newQuantity
    });
    
    if (data) {
        await loadCart();
        displayCart();
    }
}

function displayCart() {
    const container = document.getElementById('cartContainer');
    
    if (!cart.items || cart.items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛒</div>
                <h4>Your cart is empty</h4>
                <p class="empty-state-text">Add some products to get started</p>
                <button class="btn btn-primary" onclick="showSection('products')" style="margin-top: 1rem;">
                    Browse Products
                </button>
            </div>
        `;
        return;
    }
    
    const deliveryFee = 50;
    const tax = cart.subtotal * 0.12;
    const total = cart.subtotal + deliveryFee + tax;
    
    container.innerHTML = `
        <div class="cart-container">
            <div class="cart-items">
                ${cart.items.map(item => `
                    <div class="cart-item">
                        <div class="cart-item-image">
                            <img src="${item.imageUrl || 'https://via.placeholder.com/100'}" 
                                 alt="${item.productName}"
                                 style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.5rem;">
                        </div>
                        <div class="cart-item-details">
                            <div class="cart-item-name">${item.productName}</div>
                            <div class="cart-item-price">₱${parseFloat(item.unitPrice).toFixed(2)}</div>
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                                <button class="btn" style="padding: 0.375rem 0.75rem; background: #f0f0f0; border: none; border-radius: 0.375rem; cursor: pointer; color: #374151; font-weight: 600;" 
                                        onclick="updateCartQuantity(${item.cartItemId}, ${item.quantity - 1})">
                                    <i class="fas fa-minus" style="font-size: 0.75rem;"></i>
                                </button>
                                <input type="text" value="${item.quantity}" readonly 
                                       style="width: 40px; text-align: center; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.375rem; font-weight: 600;">
                                <button class="btn" style="padding: 0.375rem 0.75rem; background: #f0f0f0; border: none; border-radius: 0.375rem; cursor: pointer; color: #374151; font-weight: 600;" 
                                        onclick="updateCartQuantity(${item.cartItemId}, ${item.quantity + 1})">
                                    <i class="fas fa-plus" style="font-size: 0.75rem;"></i>
                                </button>
                            </div>
                            <small style="color: #6b7280; margin-top: 0.5rem; display: block;">Max: ${item.stock}</small>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1rem;">
                            <div style="font-weight: 700; color: #f97316; font-size: 1.125rem;">
                                ₱${(item.unitPrice * item.quantity).toFixed(2)}
                            </div>
                            <button class="btn btn-primary" style="padding: 0.375rem 0.75rem; background: #ef4444; color: white; border: none; border-radius: 0.375rem; cursor: pointer;"
                                    onclick="removeFromCart(${item.cartItemId})">
                                <i class="fas fa-trash" style="font-size: 0.75rem;"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="cart-summary">
                <h3 style="font-weight: 700; color: #111827; margin-bottom: 1.5rem; font-size: 1.25rem;">Order Summary</h3>
                
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>₱${cart.subtotal.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Delivery:</span>
                    <span>₱${deliveryFee.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Tax:</span>
                    <span>₱${tax.toFixed(2)}</span>
                </div>
                
                <div class="summary-total">
                    ₱${total.toFixed(2)}
                </div>
                
                <button class="btn btn-primary" style="width: 100%; padding: 0.75rem 1.5rem; font-size: 1rem;" onclick="checkout()">
                    <i class="fas fa-check"></i> Checkout
                </button>
                <button class="btn btn-outline" style="width: 100%; margin-top: 0.75rem; padding: 0.75rem 1.5rem; font-size: 1rem;" onclick="showSection('products')">
                    Continue Shopping
                </button>
            </div>
        </div>
    `;
}

async function checkout() {
    if (!cart.items || cart.items.length === 0) {
        showToast('Your cart is empty', 'warning');
        return;
    }
    
    // Create order with items from cart
    const orderData = {
        items: cart.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
        }))
    };
    
    const data = await apiCall('/orders/', 'POST', orderData);
    
    if (data && data.order) {
        // Clear cart after successful order
        await apiCall('/cart-items/my-cart/clear', 'DELETE');
        await loadCart();
        
        showToast('Order placed successfully!', 'success');
        showSection('orders');
        loadOrders();
    }
}

// Load Orders
async function loadOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    const endpoint = status ? `/customer/orders?status=${status}` : '/customer/orders';
    
    const data = await apiCall(endpoint);
    if (data && data.orders) {
        displayOrders(data.orders);
    }
}

function displayOrders(orders) {
    const container = document.getElementById('ordersContainer');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h4>No orders found</h4>
                <p class="empty-state-text">You haven't placed any orders yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <div class="order-id">Order #${order.orderId}</div>
                    <div class="order-date">${new Date(order.orderDate).toLocaleDateString()}</div>
                </div>
                <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
            </div>
            
            <div class="order-items">
                ${order.items?.length || 0} item(s) • Total: <strong>₱${parseFloat(order.totalAmount).toFixed(2)}</strong>
            </div>
            
            <div class="order-footer">
                <div class="order-total">
                    ₱${parseFloat(order.totalAmount).toFixed(2)}
                </div>
                <div style="display: flex; gap: 0.75rem;">
                    <button class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem;"
                            onclick="viewOrderDetails(${order.orderId})">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    ${order.status === 'Pending' || order.status === 'Confirmed' ? 
                        `<button class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.875rem; color: #ef4444; border: 2px solid #ef4444;" 
                                 onclick="cancelOrder(${order.orderId})">
                            <i class="fas fa-times"></i> Cancel
                        </button>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

async function viewOrderDetails(orderId) {
    const data = await apiCall(`/customer/orders/${orderId}`);
    if (data && data.order) {
        const order = data.order;
        const modalContent = document.getElementById('orderDetailsContent');
        
        modalContent.innerHTML = `
            <div class="mb-3">
                <h6>Order #${order.orderId}</h6>
                <p class="text-muted mb-2">Placed on: ${new Date(order.orderDate).toLocaleString()}</p>
                <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
            </div>
            
            <h6 class="mb-3">Order Items:</h6>
            ${order.items.map(item => `
                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                    <div>
                        <strong>${item.productName || 'Product #' + item.productId}</strong>
                        <br>
                        <small class="text-muted">Quantity: ${item.quantity} × ₱${parseFloat(item.unitPrice).toFixed(2)}</small>
                    </div>
                    <strong>₱${(item.quantity * item.unitPrice).toFixed(2)}</strong>
                </div>
            `).join('')}
            
            <div class="mt-3 pt-3 border-top">
                <h5 class="d-flex justify-content-between">
                    <span>Total Amount:</span>
                    <span class="text-primary">₱${parseFloat(order.totalAmount).toFixed(2)}</span>
                </h5>
            </div>
        `;
        
        const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
        modal.show();
    }
}

async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    const data = await apiCall(`/customer/orders/${orderId}/cancel`, 'PUT');
    if (data) {
        showToast('Order cancelled successfully', 'success');
        loadOrders();
    }
}

// Update Profile
document.getElementById('profileForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const profileData = {
        customerName: document.getElementById('profileCustomerName').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        address: document.getElementById('address').value
    };
    
    const newPassword = document.getElementById('newPassword').value;
    if (newPassword) {
        profileData.password = newPassword;
    }
    
    const data = await apiCall('/customer/profile', 'PUT', profileData);
    if (data) {
        showToast('Profile updated successfully', 'success');
        document.getElementById('newPassword').value = '';
        loadCustomerProfile();
    }
});

// Navigation
function showSection(sectionId) {
    closeSidebar();

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
    });
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    if (sectionId === 'orders') {
        loadOrders();
    } else if (sectionId === 'cart') {
        displayCart();
    } else if (sectionId === 'products') {
        if (allProducts.length === 0) {
            loadProducts();
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menuOverlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menuOverlay');
    
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

function viewProduct(productId) {
    window.location.href = `view_product.html?id=${productId}`;
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_type');
    window.location.href = '../auth/login.html';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = {
        'success': '#dcfce7',
        'error': '#fee2e2',
        'warning': '#fef3c7',
        'info': '#dbeafe',
        'danger': '#fee2e2'
    }[type] || '#dbeafe';
    
    const textColor = {
        'success': '#166534',
        'error': '#991b1b',
        'warning': '#92400e',
        'info': '#1e40af',
        'danger': '#991b1b'
    }[type] || '#1e40af';
    
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: ${bgColor};
        color: ${textColor};
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);