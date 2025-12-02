const API_BASE_URL = 'https://six7backend.onrender.com/api';
let currentProduct = null;
let cart = [];
let authToken = null;

// Get product ID from URL
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    authToken = localStorage.getItem('access_token');
    
    // Load cart from localStorage
    loadCart();
    
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
        document.getElementById('buyNowBtn').disabled = true;
        document.getElementById('buyNowBtn').innerHTML = '<i class="fas fa-times me-2"></i>Unavailable';
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

// Add to Cart
function addToCart() {
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
    
    const existingItem = cart.find(item => item.productId === currentProduct.productId);
    
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        
        if (newQuantity > availableStock) {
            showToast('Cannot add more - insufficient stock', 'warning');
            return;
        }
        
        existingItem.quantity = newQuantity;
        showToast(`Updated quantity to ${newQuantity}`, 'success');
    } else {
        cart.push({
            productId: currentProduct.productId,
            productName: currentProduct.productName,
            unitPrice: currentProduct.unitPrice,
            quantity: quantity,
            imageUrl: currentProduct.imageUrl,
            maxStock: availableStock
        });
        showToast(`${quantity} item(s) added to cart`, 'success');
    }
    
    saveCart();
    
    // Reset quantity to 1
    document.getElementById('quantity').value = 1;
}

// Buy Now
function buyNow() {
    addToCart();
    
    // Redirect to cart after a short delay
    setTimeout(() => {
        window.location.href = 'customer_dashboard.html#cart';
    }, 500);
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