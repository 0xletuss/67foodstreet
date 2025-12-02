const API_BASE_URL = 'https://six7backend.onrender.com/api';
let currentProduct = null;
let cart = { items: [], subtotal: 0, totalItems: 0 };
let authToken = null;

// Get product ID from URL
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    authToken = localStorage.getItem('access_token');
    
    // Load cart from backend API
    await loadCart();
    
    // Load customer name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.customerName) {
        document.getElementById('customerName').textContent = `Hi, ${user.customerName}!`;
    }
    
    if (!productId) {
        showToast('No product selected', 'warning');
        setTimeout(() => window.location.href = 'customer_dashboard.html', 2000);
        return;
    }
    
    await loadProduct();
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

// Load Cart from Backend
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

// Load Product Details
async function loadProduct() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error('Product not found');
        }
        
        const data = await response.json();
        currentProduct = data.product;
        
        displayProduct(currentProduct);
        await loadRelatedProducts(currentProduct.category, currentProduct.sellerId);
        
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error loading product: ' + error.message, 'danger');
        setTimeout(() => window.location.href = 'customer_dashboard.html', 2000);
    } finally {
        showLoading(false);
    }
}

// Display Product Details
function displayProduct(product) {
    // Update breadcrumb
    document.getElementById('breadcrumbProduct').textContent = product.productName;
    
    // Product name and title
    document.getElementById('productName').textContent = product.productName;
    document.title = `${product.productName} - E-Commerce`;
    
    // Price
    document.getElementById('productPrice').textContent = `₱${parseFloat(product.unitPrice).toFixed(2)}`;
    
    // Category
    document.getElementById('productCategory').textContent = product.category || 'Uncategorized';
    
    // Stock status
    const stockElement = document.getElementById('productStock');
    const stock = product.stock || 0;
    
    if (stock > 20) {
        stockElement.innerHTML = '<span class="stock-badge stock-in">In Stock (' + stock + ')</span>';
    } else if (stock > 0) {
        stockElement.innerHTML = '<span class="stock-badge stock-low">Low Stock (' + stock + ')</span>';
    } else {
        stockElement.innerHTML = '<span class="stock-badge stock-out">Out of Stock</span>';
    }
    
    document.getElementById('availableStock').textContent = stock;
    document.getElementById('quantity').max = stock;
    
    // Seller
    document.getElementById('productSeller').textContent = product.sellerName || 'Unknown Seller';
    document.getElementById('sellerName').textContent = product.sellerName || 'Unknown Seller';
    
    // Seller avatar (first letter)
    const sellerInitial = (product.sellerName || 'S').charAt(0).toUpperCase();
    document.getElementById('sellerAvatar').textContent = sellerInitial;
    
    // Description
    document.getElementById('productDescription').textContent = product.description || 'No description available for this product.';
    
    // Product image
    const imageUrl = product.imageUrl || 'https://via.placeholder.com/450?text=No+Image';
    document.getElementById('mainProductImage').src = imageUrl;
    document.getElementById('mainProductImage').alt = product.productName;
    
    // Disable buttons if out of stock
    if (stock <= 0) {
        document.getElementById('addToCartBtn').disabled = true;
        document.getElementById('addToCartBtn').innerHTML = '<i class="fas fa-times me-2"></i>Out of Stock';
        document.getElementById('reserveBtn').disabled = true;
        document.getElementById('reserveBtn').innerHTML = '<i class="fas fa-times me-2"></i>Unavailable';
    }
}

// Load Related Products
async function loadRelatedProducts(category, sellerId) {
    const container = document.getElementById('relatedProductsContainer');
    
    try {
        // Load products from same category or same seller
        const response = await fetch(`${API_BASE_URL}/products/?category=${category || ''}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load related products');
        }
        
        const data = await response.json();
        let relatedProducts = data.products || [];
        
        // Filter out current product and limit to 4
        relatedProducts = relatedProducts
            .filter(p => p.productId !== currentProduct.productId)
            .slice(0, 4);
        
        if (relatedProducts.length === 0) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <p style="color: #6b7280;">No related products found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = relatedProducts.map(product => `
            <div class="related-card" onclick="viewProduct(${product.productId})">
                <div class="related-image">
                    <img src="${product.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                         alt="${product.productName}">
                </div>
                <div class="related-info">
                    <div class="related-name">${product.productName}</div>
                    <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.75rem;">
                        ${product.category || 'Uncategorized'}
                    </div>
                    <div class="related-price">₱${parseFloat(product.unitPrice).toFixed(2)}</div>
                    <div style="font-size: 0.875rem; color: ${product.stock > 0 ? '#166534' : '#991b1b'};">
                        ${product.stock > 0 ? '✓ In Stock' : '✕ Out of Stock'}
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading related products:', error);
        container.innerHTML = `
            <div class="loading-spinner">
                <p style="color: #6b7280;">Unable to load related products</p>
            </div>
        `;
    }
}

// View another product
function viewProduct(productId) {
    window.location.href = `view_product.html?id=${productId}`;
}

// Quantity Controls
function increaseQuantity() {
    const input = document.getElementById('quantity');
    const max = parseInt(input.max);
    const current = parseInt(input.value);
    
    if (current < max) {
        input.value = current + 1;
    } else {
        showToast('Maximum available quantity reached', 'warning');
    }
}

function decreaseQuantity() {
    const input = document.getElementById('quantity');
    const current = parseInt(input.value);
    
    if (current > 1) {
        input.value = current - 1;
    }
}

// Add to Cart
async function addToCart() {
    if (!currentProduct) {
        showToast('Product not loaded', 'danger');
        return;
    }
    
    const quantity = parseInt(document.getElementById('quantity').value);
    const availableStock = currentProduct.stock || 0;
    
    if (quantity > availableStock) {
        showToast('Not enough stock available', 'warning');
        return;
    }
    
    // Call backend API to add to cart
    const data = await apiCall('/cart-items/', 'POST', {
        productId: currentProduct.productId,
        quantity: quantity
    });
    
    if (data) {
        showToast(`${quantity} item(s) added to cart`, 'success');
        await loadCart(); // Reload cart from backend
        
        // Reset quantity to 1
        document.getElementById('quantity').value = 1;
    }
}

// Reserve Product (Add to cart and redirect to order page)
async function reserveProduct() {
    if (!currentProduct) {
        showToast('Product not loaded', 'danger');
        return;
    }
    
    const quantity = parseInt(document.getElementById('quantity').value);
    const availableStock = currentProduct.stock || 0;
    
    if (quantity > availableStock) {
        showToast('Not enough stock available', 'warning');
        return;
    }
    
    // Add product to cart via backend API
    const data = await apiCall('/cart-items/', 'POST', {
        productId: currentProduct.productId,
        quantity: quantity
    });
    
    if (data) {
        showToast('Item reserved! Redirecting to checkout...', 'success');
        await loadCart();
        
        // Redirect to order page after a short delay
        setTimeout(() => {
            window.location.href = 'order.html';
        }, 500);
    }
}

// View Seller Products
function viewSellerProducts() {
    if (currentProduct && currentProduct.sellerId) {
        window.location.href = `customer_dashboard.html?seller=${currentProduct.sellerId}`;
    }
}

// Logout
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_type');
    // Remove old localStorage cart (if it exists)
    localStorage.removeItem('cart');
    window.location.href = '../auth/login.html';
}

// Loading Overlay
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// Toast Notification
function showToast(message, type = 'info') {
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
    
    const toast = document.createElement('div');
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

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);