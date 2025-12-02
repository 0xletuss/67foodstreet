const API_BASE_URL = 'https://six7backend.onrender.com/api';
let cart = { items: [], subtotal: 0, totalItems: 0 };
let authToken = null;
const DELIVERY_FEE = 50; // Fixed delivery fee

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    authToken = localStorage.getItem('access_token');
    
    if (!authToken) {
        showToast('Please login to place an order', 'warning');
        setTimeout(() => window.location.href = '../auth/login.html', 2000);
        return;
    }
    
    loadCart();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Order type change
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const addressGroup = document.getElementById('addressGroup');
            const deliveryAddress = document.getElementById('deliveryAddress');
            
            if (this.value === 'Delivery') {
                addressGroup.classList.add('show');
                deliveryAddress.required = true;
            } else {
                addressGroup.classList.remove('show');
                deliveryAddress.required = false;
            }
            
            updateSummary();
        });
    });
}

// Load Cart from Backend API
async function loadCart() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/cart-items/my-cart`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                showToast('Session expired. Please login again.', 'warning');
                setTimeout(() => window.location.href = '../auth/login.html', 2000);
                return;
            }
            throw new Error('Failed to load cart');
        }
        
        const data = await response.json();
        cart = data;
        
        console.log('Loaded cart from backend:', cart);
        console.log('Cart items structure:', cart.items);
        
        if (!cart.items || cart.items.length === 0) {
            showEmptyCart();
            return;
        }
        
        displayCartItems();
        updateSummary();
        
    } catch (error) {
        console.error('Error loading cart:', error);
        showToast('Failed to load cart: ' + error.message, 'danger');
        showEmptyCart();
    } finally {
        showLoading(false);
    }
}

// Show Empty Cart
function showEmptyCart() {
    const container = document.querySelector('.main-content');
    container.innerHTML = `
        <div class="empty-cart" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
            <i class="fas fa-shopping-cart" style="font-size: 4rem; color: #d1d5db; margin-bottom: 1rem;"></i>
            <p style="font-size: 1.25rem; color: #6b7280; margin-bottom: 1.5rem;">Your cart is empty</p>
            <button class="back-btn" onclick="goBack()" style="padding: 0.75rem 1.5rem; background: #f97316; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">
                <i class="fas fa-shopping-bag" style="margin-right: 0.5rem;"></i>
                Continue Shopping
            </button>
        </div>
    `;
}

// Display Cart Items
function displayCartItems() {
    const container = document.getElementById('cartItems');
    
    if (!cart.items || cart.items.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center;">No items in cart</p>';
        return;
    }
    
    container.innerHTML = cart.items.map(item => `
        <div class="cart-item" style="display: flex; gap: 1rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 0.75rem;">
            <img src="${item.imageUrl || 'https://via.placeholder.com/80?text=No+Image'}" 
                 alt="${item.productName}"
                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 0.5rem;">
            <div class="cart-item-details" style="flex: 1;">
                <div class="cart-item-name" style="font-weight: 600; color: #111827; margin-bottom: 0.25rem;">${item.productName}</div>
                <div class="cart-item-price" style="color: #f97316; font-weight: 600; margin-bottom: 0.25rem;">₱${parseFloat(item.unitPrice).toFixed(2)}</div>
                <div class="cart-item-quantity" style="color: #6b7280; font-size: 0.875rem;">Quantity: ${item.quantity}</div>
                <div style="color: #374151; font-weight: 600; margin-top: 0.5rem;">Subtotal: ₱${(item.unitPrice * item.quantity).toFixed(2)}</div>
            </div>
        </div>
    `).join('');
}

// Update Summary
function updateSummary() {
    // Use backend subtotal
    const subtotal = cart.subtotal || 0;
    
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    const deliveryFee = orderType === 'Delivery' ? DELIVERY_FEE : 0;
    const total = subtotal + deliveryFee;
    
    document.getElementById('subtotal').textContent = `₱${subtotal.toFixed(2)}`;
    document.getElementById('deliveryFee').textContent = `₱${deliveryFee.toFixed(2)}`;
    document.getElementById('total').textContent = `₱${total.toFixed(2)}`;
}

// Place Order - FIXED VERSION WITH ORDER ID URL PARAMETER
async function placeOrder() {
    if (!cart.items || cart.items.length === 0) {
        showToast('Your cart is empty', 'warning');
        return;
    }
    
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    // Validation
    if (orderType === 'Delivery' && !deliveryAddress) {
        showToast('Please enter delivery address', 'warning');
        document.getElementById('deliveryAddress').focus();
        return;
    }
    
    console.log('=== ORDER PLACEMENT DEBUG ===');
    console.log('Cart object:', cart);
    console.log('Cart items:', cart.items);
    
    // Prepare order items with comprehensive error handling
    try {
        const items = cart.items.map((item, index) => {
            console.log(`Processing item ${index}:`, item);
            console.log(`Item type:`, typeof item);
            console.log(`Item keys:`, Object.keys(item));
            
            // Handle different possible property names (camelCase and snake_case)
            const productId = item.productId || item.product_id || item.id;
            const quantity = item.quantity || 1;
            const unitPrice = item.unitPrice || item.unit_price || item.price;
            
            if (!productId) {
                console.error('Missing productId in item:', item);
                throw new Error(`Item ${index} is missing product ID`);
            }
            
            const processedItem = {
                productId: parseInt(productId),
                quantity: parseInt(quantity),
                unitPrice: parseFloat(unitPrice)
            };
            
            console.log(`Processed item ${index}:`, processedItem);
            return processedItem;
        });
        
        console.log('All processed items:', items);
        
        const orderData = {
            type: orderType,
            items: items,
            notes: notes || undefined,
            deliveryAddress: orderType === 'Delivery' ? deliveryAddress : undefined
        };
        
        console.log('Final order data:', JSON.stringify(orderData, null, 2));
        
        showLoading(true);
        
        // Step 1: Create Order
        console.log('Sending order to backend...');
        const orderResponse = await fetch(`${API_BASE_URL}/orders/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(orderData)
        });
        
        const orderResult = await orderResponse.json();
        console.log('Order response:', orderResult);
        console.log('Order response status:', orderResponse.status);
        
        if (!orderResponse.ok) {
            console.error('Order creation failed:', orderResult);
            throw new Error(orderResult.error || orderResult.detail || 'Failed to create order');
        }
        
        const orderId = orderResult.order.orderId;
        console.log('Order created successfully with ID:', orderId);
        
        // Step 2: Create Payment
        console.log('Creating payment...');
        
        // Map payment method to database ENUM values
        // Database accepts: 'Credit Card', 'Cash', 'E-Wallet', 'Bank Transfer'
        const paymentMethodMap = {
            'Cash on Delivery': 'Cash',
            'Credit Card': 'Credit Card',
            'Debit Card': 'Credit Card',
            'GCash': 'E-Wallet',
            'PayMaya': 'E-Wallet',
            'Bank Transfer': 'Bank Transfer'
        };
        
        const mappedPaymentMethod = paymentMethodMap[paymentMethod] || 'Cash';
        
        const paymentResponse = await fetch(`${API_BASE_URL}/orders/${orderId}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                paymentMethod: mappedPaymentMethod
            })
        });
        
        const paymentResult = await paymentResponse.json();
        console.log('Payment response:', paymentResult);
        
        if (!paymentResponse.ok) {
            console.error('Payment failed:', paymentResult);
            throw new Error(paymentResult.error || paymentResult.detail || 'Payment failed');
        }
        
        console.log('Payment successful');
        
        // Success! Clear backend cart
        console.log('Clearing cart...');
        await fetch(`${API_BASE_URL}/cart-items/my-cart/clear`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Also clear localStorage cart (if exists)
        localStorage.removeItem('cart');
        
        // Store order ID for confirmation page (backup method)
        localStorage.setItem('lastOrderId', orderId);
        
        showToast('Order placed successfully!', 'success');
        
        // ✅ FIX: Redirect to success page WITH orderId parameter
        setTimeout(() => {
            window.location.href = `../order/success.html?orderId=${orderId}`;
        }, 1500);
        
    } catch (error) {
        console.error('=== ORDER PLACEMENT ERROR ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        showToast(error.message || 'Failed to place order. Please try again.', 'danger');
    } finally {
        showLoading(false);
    }
}

// Go Back
function goBack() {
    window.location.href = '../dashboard/customer_dashboard.html';
}

// Loading Overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
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
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
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