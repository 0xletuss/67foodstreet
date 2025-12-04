const API_BASE_URL = 'https://six7backend.onrender.com/api';
let currentProduct = null;
let cart = { items: [], subtotal: 0, totalItems: 0 };
let authToken = null;
let currentStep = 1;
let reservationData = {
    productId: null, productName: '', unitPrice: 0, quantity: 1,
    reservationDate: '', numberOfPeople: 1, deliveryMethod: 'pickup',
    deliveryAddress: '', paymentMethod: 'cash', specialRequests: '', totalAmount: 0
};

// Chat integration variables
let currentProductSellerId = null;
let currentProductSellerName = null;

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    authToken = localStorage.getItem('access_token');
    await loadCart();
    
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

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    if (body) options.body = JSON.stringify(body);
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return null;
            }
            const data = await response.json();
            throw new Error(data.detail || data.error || 'API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error: ' + error.message, 'danger');
        return null;
    }
}

// Load Cart
async function loadCart() {
    const data = await apiCall('/cart-items/my-cart');
    if (data) {
        cart = data;
        document.getElementById('cartCount').textContent = cart.totalItems || 0;
    }
}

// Load Product
async function loadProduct() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Product not found');
        
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

// Display Product
function displayProduct(product) {
    document.getElementById('breadcrumbProduct').textContent = product.productName;
    document.getElementById('productName').textContent = product.productName;
    document.title = `${product.productName} - 67StreetFood`;
    document.getElementById('productPrice').textContent = `₱${parseFloat(product.unitPrice).toFixed(2)}`;
    document.getElementById('productCategory').textContent = product.category || 'Uncategorized';
    
    const stock = product.stock || 0;
    const stockElement = document.getElementById('productStock');
    const stockClass = stock > 20 ? 'stock-in' : stock > 0 ? 'stock-low' : 'stock-out';
    const stockText = stock > 20 ? `In Stock (${stock})` : stock > 0 ? `Low Stock (${stock})` : 'Out of Stock';
    stockElement.innerHTML = `<span class="stock-badge ${stockClass}">${stockText}</span>`;
    
    document.getElementById('availableStock').textContent = stock;
    document.getElementById('quantity').max = stock;
    
    // Store seller info for chat functionality
    currentProductSellerId = product.sellerId;
    currentProductSellerName = product.sellerName || product.storeName || 'Unknown Seller';
    
    document.getElementById('productSeller').textContent = currentProductSellerName;
    document.getElementById('sellerName').textContent = currentProductSellerName;
    document.getElementById('sellerAvatar').textContent = currentProductSellerName.charAt(0).toUpperCase();
    document.getElementById('productDescription').textContent = product.description || 'No description available for this product.';
    
    const imageUrl = product.imageUrl || 'https://via.placeholder.com/450?text=No+Image';
    document.getElementById('mainProductImage').src = imageUrl;
    document.getElementById('mainProductImage').alt = product.productName;
    
    if (stock <= 0) {
        document.getElementById('addToCartBtn').disabled = true;
        document.getElementById('addToCartBtn').innerHTML = '<i class="fas fa-times"></i> Out of Stock';
        document.getElementById('reserveBtn').disabled = true;
        document.getElementById('reserveBtn').innerHTML = '<i class="fas fa-times"></i> Unavailable';
    }
}

// Load Related Products
async function loadRelatedProducts(category, sellerId) {
    const container = document.getElementById('relatedProductsContainer');
    
    try {
        const response = await fetch(`${API_BASE_URL}/products/?category=${category || ''}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to load related products');
        
        const data = await response.json();
        let relatedProducts = (data.products || [])
            .filter(p => p.productId !== currentProduct.productId)
            .slice(0, 4);
        
        if (relatedProducts.length === 0) {
            container.innerHTML = '<div class="loading-spinner"><p style="color: #6b7280;">No related products found</p></div>';
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
        container.innerHTML = '<div class="loading-spinner"><p style="color: #6b7280;">Unable to load related products</p></div>';
    }
}

function viewProduct(productId) {
    window.location.href = `view_product.html?id=${productId}`;
}

// CHAT FUNCTIONALITY
function chatWithSeller() {
    // Check if user is logged in
    if (!authToken) {
        showToast('Please login to chat with seller', 'warning');
        setTimeout(() => window.location.href = '../auth/login.html', 1500);
        return;
    }
    
    // Check if seller info is available
    if (!currentProductSellerId || !currentProductSellerName) {
        showToast('Seller information not available', 'error');
        return;
    }
    
    // Start chat with seller (function from chat.js)
    if (typeof startChatWithSeller === 'function') {
        startChatWithSeller(currentProductSellerId, currentProductSellerName);
    } else {
        console.error('Chat functionality not loaded');
        showToast('Chat feature is not available', 'error');
    }
}

// Make chatWithSeller globally accessible
window.chatWithSeller = chatWithSeller;

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
    if (current > 1) input.value = current - 1;
}

// Add to Cart
async function addToCart() {
    if (!currentProduct) {
        showToast('Product not loaded', 'danger');
        return;
    }
    
    const quantity = parseInt(document.getElementById('quantity').value);
    
    if (quantity > (currentProduct.stock || 0)) {
        showToast('Not enough stock available', 'warning');
        return;
    }
    
    const data = await apiCall('/cart-items/', 'POST', {
        productId: currentProduct.productId,
        quantity: quantity
    });
    
    if (data) {
        showToast(`${quantity} item(s) added to cart`, 'success');
        await loadCart();
        document.getElementById('quantity').value = 1;
    }
}

// Reservation Modal
function openReservationModal() {
    if (!currentProduct) {
        showToast('Product not loaded', 'danger');
        return;
    }

    const stock = currentProduct.stock || 0;
    if (stock <= 0) {
        showToast('This product is out of stock', 'warning');
        return;
    }

    const modal = document.getElementById('reservationModal');
    if (!modal) {
        console.error('Modal element not found!');
        showToast('Modal not found', 'danger');
        return;
    }

    reservationData = {
        ...reservationData,
        productId: currentProduct.productId,
        productName: currentProduct.productName,
        unitPrice: parseFloat(currentProduct.unitPrice),
        quantity: parseInt(document.getElementById('quantity').value)
    };
    
    const modalStock = document.getElementById('modalAvailableStock');
    const resQty = document.getElementById('reservationQuantity');
    
    if (modalStock) modalStock.textContent = stock;
    if (resQty) {
        resQty.value = reservationData.quantity;
        resQty.max = stock;
    }

    const dateInput = document.getElementById('reservationDate');
    if (dateInput) {
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        dateInput.min = today.toISOString().slice(0, 16);
    }

    currentStep = 1;
    showStep(1);
    modal.style.display = 'flex';
    modal.offsetHeight;
    modal.classList.add('active');
}

function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        resetModal();
    }, 300);
}

function resetModal() {
    currentStep = 1;
    showStep(1);
    
    ['reservationDate', 'specialRequests', 'deliveryAddress'].forEach(id => {
        document.getElementById(id).value = '';
    });
    
    document.getElementById('numberOfPeople').value = 1;
    document.getElementById('reservationQuantity').value = 1;
    document.getElementById('pickupOption').checked = false;
    document.getElementById('deliveryOption').checked = false;
    document.getElementById('cashOption').checked = true;
    document.getElementById('deliveryAddressSection').style.display = 'none';
    document.getElementById('pickupLocationSection').style.display = 'none';
}

function showStep(step) {
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`step${i}`).style.display = i === step ? 'block' : 'none';
    }
    updateProgress(step);
}

function updateProgress(step) {
    document.querySelectorAll('.step').forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');
        if (stepNum < step) stepEl.classList.add('completed');
        else if (stepNum === step) stepEl.classList.add('active');
    });
}

function nextStep(step) {
    if (!validateStep(currentStep)) return;
    collectStepData(currentStep);
    if (step === 4) updateConfirmation();
    currentStep = step;
    showStep(step);
}

function prevStep(step) {
    currentStep = step;
    showStep(step);
}

function validateStep(step) {
    if (step === 1) {
        const date = document.getElementById('reservationDate').value;
        const people = document.getElementById('numberOfPeople').value;
        const quantity = document.getElementById('reservationQuantity').value;
        
        if (!date) {
            showToast('Please select a reservation date', 'warning');
            return false;
        }
        
        if (new Date(date) < new Date()) {
            showToast('Reservation date must be in the future', 'warning');
            return false;
        }
        
        if (!people || people < 1) {
            showToast('Please enter number of people', 'warning');
            return false;
        }
        
        if (!quantity || quantity < 1) {
            showToast('Please select quantity', 'warning');
            return false;
        }
        
        if (quantity > parseInt(document.getElementById('reservationQuantity').max)) {
            showToast('Quantity exceeds available stock', 'warning');
            return false;
        }
    }
    
    if (step === 2) {
        const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked');
        
        if (!deliveryMethod) {
            showToast('Please select a delivery method', 'warning');
            return false;
        }
        
        if (deliveryMethod.value === 'delivery' && !document.getElementById('deliveryAddress').value.trim()) {
            showToast('Please enter delivery address', 'warning');
            return false;
        }
    }
    
    if (step === 3) {
        if (!document.querySelector('input[name="paymentMethod"]:checked')) {
            showToast('Please select a payment method', 'warning');
            return false;
        }
    }
    
    return true;
}

function collectStepData(step) {
    if (step === 1) {
        reservationData.reservationDate = document.getElementById('reservationDate').value;
        reservationData.numberOfPeople = parseInt(document.getElementById('numberOfPeople').value);
        reservationData.quantity = parseInt(document.getElementById('reservationQuantity').value);
        reservationData.specialRequests = document.getElementById('specialRequests').value.trim();
        reservationData.totalAmount = reservationData.quantity * reservationData.unitPrice;
    }
    
    if (step === 2) {
        const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked');
        reservationData.deliveryMethod = deliveryMethod ? deliveryMethod.value : 'pickup';
        reservationData.deliveryAddress = reservationData.deliveryMethod === 'delivery' 
            ? document.getElementById('deliveryAddress').value.trim() : '';
    }
    
    if (step === 3) {
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        reservationData.paymentMethod = paymentMethod ? paymentMethod.value : 'cash';
    }
}

function increaseModalQuantity() {
    const input = document.getElementById('reservationQuantity');
    const max = parseInt(input.max);
    const current = parseInt(input.value);
    
    if (current < max) {
        input.value = current + 1;
    } else {
        showToast('Maximum available quantity reached', 'warning');
    }
}

function decreaseModalQuantity() {
    const input = document.getElementById('reservationQuantity');
    const current = parseInt(input.value);
    if (current > 1) input.value = current - 1;
}

function selectDeliveryMethod(method) {
    if (method === 'pickup') {
        document.getElementById('pickupOption').checked = true;
        document.getElementById('deliveryAddressSection').style.display = 'none';
        document.getElementById('pickupLocationSection').style.display = 'flex';
        document.getElementById('pickupLocation').textContent = 
            currentProductSellerName + ' Store - Main Branch, City Center';
    } else {
        document.getElementById('deliveryOption').checked = true;
        document.getElementById('deliveryAddressSection').style.display = 'block';
        document.getElementById('pickupLocationSection').style.display = 'none';
    }
}

function selectPaymentMethod(method) {
    ['cash', 'gcash', 'card'].forEach(m => {
        document.getElementById(`${m}Option`).checked = (m === method);
    });
}

function updateConfirmation() {
    document.getElementById('confirmProductName').textContent = reservationData.productName;
    document.getElementById('confirmQuantity').textContent = reservationData.quantity;
    document.getElementById('confirmUnitPrice').textContent = `₱${reservationData.unitPrice.toFixed(2)}`;
    
    const date = new Date(reservationData.reservationDate);
    document.getElementById('confirmDate').textContent = date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('confirmPeople').textContent = reservationData.numberOfPeople;
    
    const deliveryMethodText = reservationData.deliveryMethod === 'pickup' ? 'Pick Up' : 'Delivery';
    document.getElementById('confirmDeliveryMethod').textContent = deliveryMethodText;
    
    const addressItem = document.getElementById('confirmAddressItem');
    if (reservationData.deliveryMethod === 'delivery') {
        addressItem.style.display = 'flex';
        document.getElementById('confirmAddress').textContent = reservationData.deliveryAddress;
    } else {
        addressItem.style.display = 'none';
    }
    
    const paymentMethodMap = {
        'cash': 'Cash on Delivery/Pickup',
        'gcash': 'GCash',
        'card': 'Credit/Debit Card'
    };
    document.getElementById('confirmPaymentMethod').textContent = 
        paymentMethodMap[reservationData.paymentMethod] || 'Cash';
    
    document.getElementById('confirmTotal').textContent = `₱${reservationData.totalAmount.toFixed(2)}`;
}

async function submitReservation() {
    showLoading(true);
    
    try {
        collectStepData(3);
        
        const orderPayload = {
            items: [{
                productId: reservationData.productId,
                quantity: reservationData.quantity,
                unitPrice: reservationData.unitPrice
            }],
            type: reservationData.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery',
            deliveryAddress: reservationData.deliveryAddress || null,
            notes: reservationData.specialRequests || null
        };
        
        const orderResponse = await fetch(`${API_BASE_URL}/orders/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(orderPayload)
        });
        
        if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            throw new Error(errorData.error || 'Failed to create order');
        }
        
        const orderResult = await orderResponse.json();
        const orderId = orderResult.order.orderId;
        
        const reservationPayload = {
            reservationDate: reservationData.reservationDate,
            numberOfPeople: reservationData.numberOfPeople,
            specialRequests: reservationData.specialRequests || null
        };
        
        const reservationResponse = await fetch(`${API_BASE_URL}/orders/reservations/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(reservationPayload)
        });
        
        if (!reservationResponse.ok) {
            console.warn('Reservation record creation failed');
        }
        
        if (reservationData.paymentMethod !== 'cash') {
            await fetch(`${API_BASE_URL}/orders/${orderId}/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ paymentMethod: reservationData.paymentMethod })
            });
        }
        
        showToast('Reservation confirmed successfully!', 'success');
        closeReservationModal();
        setTimeout(() => window.location.href = 'customer_dashboard.html?tab=orders', 1500);
        
    } catch (error) {
        console.error('Error creating reservation:', error);
        showToast('Error: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

function viewSellerProducts() {
    if (currentProduct?.sellerId) {
        window.location.href = `customer_dashboard.html?seller=${currentProduct.sellerId}`;
    }
}

function logout() {
    ['access_token', 'user', 'user_type', 'cart'].forEach(item => localStorage.removeItem(item));
    window.location.href = '../auth/login.html';
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const colors = {
        success: { bg: '#dcfce7', text: '#166534' },
        error: { bg: '#fee2e2', text: '#991b1b' },
        warning: { bg: '#fef3c7', text: '#92400e' },
        info: { bg: '#dbeafe', text: '#1e40af' },
        danger: { bg: '#fee2e2', text: '#991b1b' }
    };
    
    const color = colors[type] || colors.info;
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed; top: 1rem; right: 1rem;
        background: ${color.bg}; color: ${color.text};
        padding: 1rem 1.5rem; border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000; font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Event Listeners
window.onclick = (event) => {
    const modal = document.getElementById('reservationModal');
    if (event.target === modal) closeReservationModal();
};

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const modal = document.getElementById('reservationModal');
        if (modal?.classList.contains('active')) closeReservationModal();
    }
});

// Animation Styles
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