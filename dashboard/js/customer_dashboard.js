const API_BASE_URL = 'https://six7backend.onrender.com/api';
let authToken = null;
let currentCustomer = null;
let allProducts = [];
let cart = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    authToken = localStorage.getItem('access_token'); // Changed from 'authToken' to match auth.js
    
    if (!authToken) {
        window.location.href = '../auth/login.html';
        return;
    }
    
    // Check if user is a customer
    const userType = localStorage.getItem('user_type');
    if (userType !== 'customer') {
        alert('Access denied. Customers only.');
        window.location.href = '../auth/login.html';
        return;
    }
    
    loadCart();
    loadCustomerProfile();
    loadProducts();
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
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return null;
            }
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
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
        document.getElementById('customerNameNav').textContent = `Welcome, ${currentCustomer.customerName}!`;
        
        // Populate profile form
        document.getElementById('customerName').value = currentCustomer.customerName || '';
        document.getElementById('phoneNumber').value = currentCustomer.phoneNumber || '';
        document.getElementById('email').value = currentCustomer.email || '';
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
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Products loaded:', data);
        
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
            <div class="col-12">
                <div class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <h4>No products available</h4>
                    <p class="text-muted">Check back later for new items</p>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="col-md-3 col-sm-6">
            <div class="card product-card">
                <div class="position-relative">
                    <img src="${product.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                         class="product-image" 
                         alt="${product.productName}">
                    <span class="product-badge ${product.isAvailable ? 'badge-available' : 'badge-unavailable'}">
                        ${product.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                </div>
                <div class="card-body">
                    <h6 class="card-title text-truncate" title="${product.productName}">
                        ${product.productName}
                    </h6>
                    <p class="card-text text-muted small text-truncate" title="${product.description}">
                        ${product.description || 'No description'}
                    </p>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="text-primary mb-0">₱${parseFloat(product.unitPrice).toFixed(2)}</h5>
                        <small class="text-muted">Stock: ${product.stock || 0}</small>
                    </div>
                    ${product.category ? `<span class="badge bg-secondary mb-2">${product.category}</span>` : ''}
                    ${product.sellerName ? `<p class="small text-muted mb-2"><i class="fas fa-store me-1"></i>${product.sellerName}</p>` : ''}
                    <button class="btn btn-primary w-100" 
                            onclick="addToCart(${product.productId})"
                            ${!product.isAvailable || product.stock <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus me-1"></i>Add to Cart
                    </button>
                </div>
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
    
    // Search filter
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.productName.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    // Category filter
    const category = document.getElementById('categoryFilter').value;
    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }
    
    // Sort
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

// Cart Functions
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartBadge();
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
}

function addToCart(productId) {
    const product = allProducts.find(p => p.productId === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
        if (existingItem.quantity < product.stock) {
            existingItem.quantity++;
            showToast('Item quantity updated in cart', 'success');
        } else {
            showToast('Cannot add more - insufficient stock', 'warning');
            return;
        }
    } else {
        cart.push({
            productId: product.productId,
            productName: product.productName,
            unitPrice: product.unitPrice,
            quantity: 1,
            imageUrl: product.imageUrl,
            maxStock: product.stock
        });
        showToast('Item added to cart', 'success');
    }
    
    saveCart();
    if (document.getElementById('cart').classList.contains('active')) {
        displayCart();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    saveCart();
    displayCart();
    showToast('Item removed from cart', 'info');
}

function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.productId === productId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    if (newQuantity > item.maxStock) {
        showToast('Cannot exceed available stock', 'warning');
        return;
    }
    
    item.quantity = newQuantity;
    saveCart();
    displayCart();
}

function displayCart() {
    const container = document.getElementById('cartContainer');
    
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <h4>Your cart is empty</h4>
                <p class="text-muted">Add some products to get started</p>
                <button class="btn btn-primary" onclick="showSection('products')">
                    Browse Products
                </button>
            </div>
        `;
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    
    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                ${cart.map(item => `
                    <div class="row align-items-center mb-3 pb-3 border-bottom">
                        <div class="col-md-2">
                            <img src="${item.imageUrl || 'https://via.placeholder.com/100'}" 
                                 class="img-fluid rounded" alt="${item.productName}">
                        </div>
                        <div class="col-md-4">
                            <h6>${item.productName}</h6>
                            <p class="text-muted mb-0">₱${parseFloat(item.unitPrice).toFixed(2)}</p>
                        </div>
                        <div class="col-md-3">
                            <div class="input-group input-group-sm">
                                <button class="btn btn-outline-secondary" 
                                        onclick="updateCartQuantity(${item.productId}, -1)">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="text" class="form-control text-center" 
                                       value="${item.quantity}" readonly>
                                <button class="btn btn-outline-secondary" 
                                        onclick="updateCartQuantity(${item.productId}, 1)">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                            <small class="text-muted">Max: ${item.maxStock}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <h6 class="text-primary">₱${(item.unitPrice * item.quantity).toFixed(2)}</h6>
                        </div>
                        <div class="col-md-1 text-end">
                            <button class="btn btn-sm btn-danger" 
                                    onclick="removeFromCart(${item.productId})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
                
                <div class="row mt-4">
                    <div class="col-md-8"></div>
                    <div class="col-md-4">
                        <h5 class="d-flex justify-content-between">
                            <span>Subtotal:</span>
                            <span class="text-primary">₱${subtotal.toFixed(2)}</span>
                        </h5>
                        <button class="btn btn-primary w-100 mt-3" onclick="checkout()">
                            <i class="fas fa-check me-1"></i>Proceed to Checkout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function checkout() {
    if (cart.length === 0) {
        showToast('Your cart is empty', 'warning');
        return;
    }
    
    // Create order
    const orderData = {
        items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
        }))
    };
    
    const data = await apiCall('/orders', 'POST', orderData);
    
    if (data && data.order) {
        cart = [];
        saveCart();
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
                <i class="fas fa-box"></i>
                <h4>No orders found</h4>
                <p class="text-muted">You haven't placed any orders yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = orders.map(order => `
        <div class="card order-card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-2">
                        <h6 class="mb-1">Order #${order.orderId}</h6>
                        <small class="text-muted">${new Date(order.orderDate).toLocaleDateString()}</small>
                    </div>
                    <div class="col-md-3">
                        <p class="mb-0"><strong>Total:</strong> ₱${parseFloat(order.totalAmount).toFixed(2)}</p>
                        <small class="text-muted">${order.items?.length || 0} item(s)</small>
                    </div>
                    <div class="col-md-3">
                        <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
                    </div>
                    <div class="col-md-4 text-end">
                        <button class="btn btn-sm btn-outline-primary me-2" 
                                onclick="viewOrderDetails(${order.orderId})">
                            <i class="fas fa-eye me-1"></i>View Details
                        </button>
                        ${order.status === 'Pending' || order.status === 'Confirmed' ? 
                            `<button class="btn btn-sm btn-outline-danger" 
                                     onclick="cancelOrder(${order.orderId})">
                                <i class="fas fa-times me-1"></i>Cancel
                            </button>` : ''}
                    </div>
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
document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const profileData = {
        customerName: document.getElementById('customerName').value,
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
    // Update sidebar
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.closest('.nav-link')?.classList.add('active');
    
    // Update content
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    // Load section-specific data
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

// Logout
function logout() {
    localStorage.removeItem('access_token'); // Changed to match auth.js
    localStorage.removeItem('user');
    localStorage.removeItem('user_type');
    localStorage.removeItem('cart');
    window.location.href = '../auth/login.html';
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.innerHTML = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}