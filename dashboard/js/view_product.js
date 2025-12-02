const API_BASE_URL = 'https://six7backend.onrender.com/api';
let currentProduct = null;
let cart = { items: [], subtotal: 0, totalItems: 0 };
let authToken = null;

// Reservation Modal Variables
let currentStep = 1;
let reservationData = {
    productId: null,
    productName: '',
    unitPrice: 0,
    quantity: 1,
    reservationDate: '',
    numberOfPeople: 1,
    deliveryMethod: 'pickup',
    deliveryAddress: '',
    paymentMethod: 'cash',
    specialRequests: '',
    totalAmount: 0
};

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
    
    // Debug: Check if modal elements exist
    console.log('Modal element exists:', !!document.getElementById('reservationModal'));
    console.log('Reserve button exists:', !!document.getElementById('reserveBtn'));
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
            throw new Error(data.detail || data.error || 'API request failed');
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
    document.title = `${product.productName} - 67StreetFood`;
    
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
        document.getElementById('addToCartBtn').innerHTML = '<i class="fas fa-times"></i> Out of Stock';
        document.getElementById('reserveBtn').disabled = true;
        document.getElementById('reserveBtn').innerHTML = '<i class="fas fa-times"></i> Unavailable';
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

// ==================== RESERVATION MODAL FUNCTIONS ====================

// Open Reservation Modal
function openReservationModal() {
    console.log('Opening reservation modal...'); // Debug log
    
    if (!currentProduct) {
        showToast('Product not loaded', 'danger');
        return;
    }

    const stock = currentProduct.stock || 0;
    if (stock <= 0) {
        showToast('This product is out of stock', 'warning');
        return;
    }

    // Get modal element
    const modal = document.getElementById('reservationModal');
    if (!modal) {
        console.error('Modal element not found!');
        showToast('Modal not found', 'danger');
        return;
    }

    // Initialize reservation data
    reservationData.productId = currentProduct.productId;
    reservationData.productName = currentProduct.productName;
    reservationData.unitPrice = parseFloat(currentProduct.unitPrice);
    reservationData.quantity = parseInt(document.getElementById('quantity').value);
    
    // Set modal available stock
    const modalStock = document.getElementById('modalAvailableStock');
    const resQty = document.getElementById('reservationQuantity');
    
    if (modalStock) modalStock.textContent = stock;
    if (resQty) {
        resQty.value = reservationData.quantity;
        resQty.max = stock;
    }

    // Set minimum date to today
    const dateInput = document.getElementById('reservationDate');
    if (dateInput) {
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        dateInput.min = today.toISOString().slice(0, 16);
    }

    // Reset to step 1
    currentStep = 1;
    showStep(1);

    // Show modal with display flex and active class
    modal.style.display = 'flex';
    // Force reflow
    modal.offsetHeight;
    modal.classList.add('active');
    
    console.log('Modal should be visible now'); // Debug log
}

// Close Reservation Modal
function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    modal.classList.remove('active');
    
    setTimeout(() => {
        modal.style.display = 'none';
        resetModal();
    }, 300);
}

// Reset Modal
function resetModal() {
    currentStep = 1;
    showStep(1);
    
    // Reset form fields
    document.getElementById('reservationDate').value = '';
    document.getElementById('numberOfPeople').value = 1;
    document.getElementById('reservationQuantity').value = 1;
    document.getElementById('specialRequests').value = '';
    document.getElementById('deliveryAddress').value = '';
    
    // Reset radio buttons
    document.getElementById('pickupOption').checked = false;
    document.getElementById('deliveryOption').checked = false;
    document.getElementById('cashOption').checked = true;
    
    // Hide delivery address section
    document.getElementById('deliveryAddressSection').style.display = 'none';
    document.getElementById('pickupLocationSection').style.display = 'none';
}

// Show Step
function showStep(step) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`step${i}`).style.display = 'none';
    }
    
    // Show current step
    document.getElementById(`step${step}`).style.display = 'block';
    
    // Update progress
    updateProgress(step);
}

// Update Progress Steps
function updateProgress(step) {
    const steps = document.querySelectorAll('.step');
    
    steps.forEach((stepEl, index) => {
        const stepNum = index + 1;
        
        stepEl.classList.remove('active', 'completed');
        
        if (stepNum < step) {
            stepEl.classList.add('completed');
        } else if (stepNum === step) {
            stepEl.classList.add('active');
        }
    });
}

// Next Step
function nextStep(step) {
    // Validate current step
    if (!validateStep(currentStep)) {
        return;
    }
    
    // Collect data from current step
    collectStepData(currentStep);
    
    // Update confirmation if going to step 4
    if (step === 4) {
        updateConfirmation();
    }
    
    // Move to next step
    currentStep = step;
    showStep(step);
}

// Previous Step
function prevStep(step) {
    currentStep = step;
    showStep(step);
}

// Validate Step
function validateStep(step) {
    if (step === 1) {
        const date = document.getElementById('reservationDate').value;
        const people = document.getElementById('numberOfPeople').value;
        const quantity = document.getElementById('reservationQuantity').value;
        
        if (!date) {
            showToast('Please select a reservation date', 'warning');
            return false;
        }
        
        const selectedDate = new Date(date);
        const now = new Date();
        
        if (selectedDate < now) {
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
        
        const maxStock = parseInt(document.getElementById('reservationQuantity').max);
        if (quantity > maxStock) {
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
        
        if (deliveryMethod.value === 'delivery') {
            const address = document.getElementById('deliveryAddress').value.trim();
            if (!address) {
                showToast('Please enter delivery address', 'warning');
                return false;
            }
        }
    }
    
    if (step === 3) {
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        
        if (!paymentMethod) {
            showToast('Please select a payment method', 'warning');
            return false;
        }
    }
    
    return true;
}

// Collect Step Data
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
        
        if (reservationData.deliveryMethod === 'delivery') {
            reservationData.deliveryAddress = document.getElementById('deliveryAddress').value.trim();
        } else {
            reservationData.deliveryAddress = '';
        }
    }
    
    if (step === 3) {
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        reservationData.paymentMethod = paymentMethod ? paymentMethod.value : 'cash';
    }
}

// Modal Quantity Controls
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
    
    if (current > 1) {
        input.value = current - 1;
    }
}

// Select Delivery Method
function selectDeliveryMethod(method) {
    if (method === 'pickup') {
        document.getElementById('pickupOption').checked = true;
        document.getElementById('deliveryAddressSection').style.display = 'none';
        document.getElementById('pickupLocationSection').style.display = 'flex';
        
        // Set pickup location (you can customize this)
        document.getElementById('pickupLocation').textContent = 
            currentProduct.sellerName + ' Store - Main Branch, City Center';
    } else {
        document.getElementById('deliveryOption').checked = true;
        document.getElementById('deliveryAddressSection').style.display = 'block';
        document.getElementById('pickupLocationSection').style.display = 'none';
    }
}

// Select Payment Method
function selectPaymentMethod(method) {
    document.getElementById('cashOption').checked = (method === 'cash');
    document.getElementById('gcashOption').checked = (method === 'gcash');
    document.getElementById('cardOption').checked = (method === 'card');
}

// Update Confirmation
function updateConfirmation() {
    // Product details
    document.getElementById('confirmProductName').textContent = reservationData.productName;
    document.getElementById('confirmQuantity').textContent = reservationData.quantity;
    document.getElementById('confirmUnitPrice').textContent = `₱${reservationData.unitPrice.toFixed(2)}`;
    
    // Reservation info
    const date = new Date(reservationData.reservationDate);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('confirmDate').textContent = formattedDate;
    document.getElementById('confirmPeople').textContent = reservationData.numberOfPeople;
    
    // Delivery details
    const deliveryMethodText = reservationData.deliveryMethod === 'pickup' ? 'Pick Up' : 'Delivery';
    document.getElementById('confirmDeliveryMethod').textContent = deliveryMethodText;
    
    if (reservationData.deliveryMethod === 'delivery') {
        document.getElementById('confirmAddressItem').style.display = 'flex';
        document.getElementById('confirmAddress').textContent = reservationData.deliveryAddress;
    } else {
        document.getElementById('confirmAddressItem').style.display = 'none';
    }
    
    // Payment method
    const paymentMethodMap = {
        'cash': 'Cash on Delivery/Pickup',
        'gcash': 'GCash',
        'card': 'Credit/Debit Card'
    };
    document.getElementById('confirmPaymentMethod').textContent = 
        paymentMethodMap[reservationData.paymentMethod] || 'Cash';
    
    // Total amount
    document.getElementById('confirmTotal').textContent = `₱${reservationData.totalAmount.toFixed(2)}`;
}

// Submit Reservation
async function submitReservation() {
    // Show loading
    showLoading(true);
    
    try {
        // Collect final step data
        collectStepData(3);
        
        // Prepare order payload
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
        
        console.log('Submitting order:', orderPayload);
        
        // Create order first
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
        console.log('Order created:', orderResult);
        
        const orderId = orderResult.order.orderId;
        
        // Now create the reservation record
        const reservationPayload = {
            reservationDate: reservationData.reservationDate,
            numberOfPeople: reservationData.numberOfPeople,
            specialRequests: reservationData.specialRequests || null
        };
        
        console.log('Creating reservation record:', reservationPayload);
        
        const reservationResponse = await fetch(`${API_BASE_URL}/orders/reservations/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(reservationPayload)
        });
        
        if (!reservationResponse.ok) {
            const errorData = await reservationResponse.json();
            console.warn('Reservation record creation failed:', errorData);
            // Don't throw error, order was created successfully
        } else {
            const reservationResult = await reservationResponse.json();
            console.log('Reservation record created:', reservationResult);
        }
        
        // Create payment if not cash
        if (reservationData.paymentMethod !== 'cash') {
            const paymentPayload = {
                paymentMethod: reservationData.paymentMethod
            };
            
            const paymentResponse = await fetch(`${API_BASE_URL}/orders/${orderId}/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(paymentPayload)
            });
            
            if (!paymentResponse.ok) {
                console.warn('Payment creation failed');
            } else {
                const paymentResult = await paymentResponse.json();
                console.log('Payment created:', paymentResult);
            }
        }
        
        // Success
        showToast('Reservation confirmed successfully!', 'success');
        closeReservationModal();
        
        // Redirect to orders page
        setTimeout(() => {
            window.location.href = 'customer_dashboard.html?tab=orders';
        }, 1500);
        
    } catch (error) {
        console.error('Error creating reservation:', error);
        showToast('Error: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

// ==================== END RESERVATION MODAL FUNCTIONS ====================

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
        z-index: 10000;
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

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('reservationModal');
    if (event.target === modal) {
        closeReservationModal();
    }
}

// Handle ESC key to close modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('reservationModal');
        if (modal.classList.contains('active')) {
            closeReservationModal();
        }
    }
});

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