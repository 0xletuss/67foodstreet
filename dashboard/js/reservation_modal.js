// Reservation Modal Script
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

// Open Reservation Modal
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

    // Initialize reservation data
    reservationData.productId = currentProduct.productId;
    reservationData.productName = currentProduct.productName;
    reservationData.unitPrice = parseFloat(currentProduct.unitPrice);
    reservationData.quantity = parseInt(document.getElementById('quantity').value);
    
    // Set modal available stock
    document.getElementById('modalAvailableStock').textContent = stock;
    document.getElementById('reservationQuantity').value = reservationData.quantity;
    document.getElementById('reservationQuantity').max = stock;

    // Set minimum date to today
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    document.getElementById('reservationDate').min = today.toISOString().slice(0, 16);

    // Reset to step 1
    currentStep = 1;
    showStep(1);

    // Show modal
    const modal = document.getElementById('reservationModal');
    modal.classList.add('active');
    modal.style.display = 'flex';
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
        // Prepare API payload
        const payload = {
            productId: reservationData.productId,
            reservationDate: reservationData.reservationDate,
            numberOfPeople: reservationData.numberOfPeople,
            quantity: reservationData.quantity,
            specialRequests: reservationData.specialRequests || null,
            deliveryMethod: reservationData.deliveryMethod,
            deliveryAddress: reservationData.deliveryAddress || null,
            paymentMethod: reservationData.paymentMethod
        };
        
        // Call API to create reservation
        const response = await fetch(`${API_BASE_URL}/reservations/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create reservation');
        }
        
        const result = await response.json();
        
        // Success
        showToast('Reservation confirmed successfully!', 'success');
        closeReservationModal();
        
        // Optionally redirect to reservations page
        setTimeout(() => {
            window.location.href = 'customer_dashboard.html?tab=reservations';
        }, 1500);
        
    } catch (error) {
        console.error('Error creating reservation:', error);
        showToast('Error: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
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