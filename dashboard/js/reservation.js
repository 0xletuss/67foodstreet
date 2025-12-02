const API_BASE_URL = 'https://six7backend.onrender.com/api';

// Load all reservations for seller
async function loadReservations(status = '') {
    const container = document.getElementById('reservationsGrid');
    
    // Show loading state
    if (container) {
        container.innerHTML = '<div class="order-flashcard" style="grid-column: 1 / -1;"><div style="text-align: center; color: #999;"><div class="spinner-border spinner-border-sm" role="status"></div> Loading reservations...</div></div>';
    }
    
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        // Use the correct seller endpoint for all reservations
        let endpoint = status ? `/orders/reservations/all?status=${status}` : '/orders/reservations/all';
        
        let response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Handle 403 or other permission errors
        if (response.status === 403 || response.status === 401) {
            if (container) {
                container.innerHTML = `
                    <div class="order-flashcard" style="grid-column: 1 / -1;">
                        <div style="text-align: center; color: #999; padding: 30px;">
                            <i class="bi bi-calendar-x" style="font-size: 3rem; opacity: 0.3; margin-bottom: 15px;"></i>
                            <p style="margin: 15px 0; font-size: 1.1rem;">Reservation Management Not Available</p>
                            <small style="color: #666;">The seller reservation endpoint is not yet implemented on the backend.<br>Please contact your administrator to enable this feature.</small>
                        </div>
                    </div>`;
            }
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.msg || errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Reservations Response:', data);
        
        const reservations = data.reservations || [];
        displayReservations(reservations);
    } catch (error) {
        console.error('Error loading reservations:', error);
        if (container) {
            container.innerHTML = `
                <div class="order-flashcard" style="grid-column: 1 / -1;">
                    <div style="text-align: center; color: #e74c3c; padding: 20px;">
                        <i class="bi bi-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p style="margin: 10px 0;">Error loading reservations</p>
                        <small style="color: #999;">${error.message}</small>
                    </div>
                </div>`;
        }
        
        if (typeof notify === 'function') {
            notify('Error loading reservations: ' + error.message, 'error');
        }
    }
}

// Display reservations as flashcards
function displayReservations(reservations) {
    const container = document.getElementById('reservationsGrid');
    
    if (!container) {
        console.error('Reservations container not found');
        return;
    }
    
    if (!reservations || reservations.length === 0) {
        container.innerHTML = `
            <div class="order-flashcard" style="grid-column: 1 / -1;">
                <div style="text-align: center; color: #999; padding: 30px;">
                    <i class="bi bi-calendar-check" style="font-size: 3rem; opacity: 0.3; margin-bottom: 15px;"></i>
                    <p style="margin: 10px 0;">No reservations found</p>
                    <small>Customer reservations will appear here</small>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = reservations.map(r => {
        const reservationDate = r.reservationDate ? new Date(r.reservationDate).toLocaleDateString() : 'N/A';
        const reservationTime = r.reservationDate ? new Date(r.reservationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        const statusClass = getReservationStatusBadgeClass(r.status);
        const status = r.status || 'Pending';
        const isCancelled = status.toLowerCase() === 'cancelled';

        return `
        <div class="order-flashcard">
            <div class="order-flashcard-header">
                <span class="order-id">#${r.reservationId || 'N/A'}</span>
                <span class="order-status-badge ${statusClass}">${status}</span>
            </div>
            <div class="order-flashcard-body">
                <div class="order-meta-item">
                    <span class="label">Customer</span>
                    <span class="value">${r.customerName || r.customer_name || 'Unknown'}</span>
                </div>
                <div class="order-meta-item">
                    <span class="label">Date</span>
                    <span class="value">${reservationDate}</span>
                </div>
                <div class="order-meta-item">
                    <span class="label">Time</span>
                    <span class="value">${reservationTime}</span>
                </div>
                <div class="order-meta-item">
                    <span class="label">People</span>
                    <span class="value">${r.numberOfPeople || r.number_of_people || 0} person${(r.numberOfPeople || r.number_of_people) !== 1 ? 's' : ''}</span>
                </div>
                ${(r.specialRequests || r.special_requests) ? `
                <div class="order-meta-item">
                    <span class="label">Requests</span>
                    <span class="value" style="font-size: 0.85rem; color: #666;">${(r.specialRequests || r.special_requests).substring(0, 50)}${(r.specialRequests || r.special_requests).length > 50 ? '...' : ''}</span>
                </div>
                ` : ''}
            </div>
            <div class="order-flashcard-footer">
                <button class="btn btn-sm btn-info" onclick="viewReservationDetails(${r.reservationId})">
                    <i class="bi bi-eye"></i> View
                </button>
                ${!isCancelled ? `
                <select class="form-select form-select-sm" onchange="updateReservationStatus(${r.reservationId}, this.value)" style="flex: 1;">
                    <option value="">Change Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
                ` : '<span class="text-muted" style="flex: 1; text-align: center; font-size: 0.85rem;">Cancelled</span>'}
            </div>
        </div>`;
    }).join('');
}

// Get reservation status badge class
function getReservationStatusBadgeClass(status) {
    if (!status) return 'bg-secondary';
    
    const statusLower = status.toLowerCase();
    const classes = {
        'pending': 'bg-warning',
        'confirmed': 'bg-success',
        'completed': 'bg-info',
        'cancelled': 'bg-danger',
        'no-show': 'bg-secondary'
    };
    return classes[statusLower] || 'bg-secondary';
}

// Update reservation status
async function updateReservationStatus(reservationId, newStatus) {
    if (!newStatus) return;
    
    const select = event.target;
    select.disabled = true;
    
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        // Use the correct update status endpoint
        const endpoint = `/orders/reservations/${reservationId}/update-status`;
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.msg || errorData.error || errorData.message || `Failed to update status`);
        }
        
        const data = await response.json();
        
        if (typeof notify === 'function') {
            notify(data.message || 'Reservation status updated successfully', 'success');
        }
        
        // Reload reservations with current filter
        const statusFilter = document.getElementById('reservationStatusFilter');
        await loadReservations(statusFilter ? statusFilter.value : '');
    } catch (error) {
        console.error('Error updating reservation:', error);
        if (typeof notify === 'function') {
            notify('Error updating reservation: ' + error.message, 'error');
        }
        select.disabled = false;
        select.value = '';
    }
}

// View detailed reservation information
async function viewReservationDetails(reservationId) {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        // Use the correct endpoint to get single reservation
        const endpoint = `/orders/reservations/${reservationId}`;
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch reservation details');
        }
        
        const reservation = await response.json();
        
        if (!reservation) {
            throw new Error('Reservation not found');
        }

        const reservationDate = new Date(reservation.reservationDate).toLocaleDateString();
        const reservationTime = new Date(reservation.reservationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const status = reservation.status || 'Pending';
        const statusClass = getReservationStatusBadgeClass(status);

        document.getElementById('reservationDetailsContent').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="mb-3"><i class="bi bi-calendar-check"></i> Reservation Information</h6>
                    <p><strong>Reservation ID:</strong> #${reservation.reservationId}</p>
                    <p><strong>Status:</strong> <span class="badge ${statusClass}">${status}</span></p>
                    <p><strong>Date:</strong> ${reservationDate}</p>
                    <p><strong>Time:</strong> ${reservationTime}</p>
                    <p><strong>Number of People:</strong> ${reservation.numberOfPeople || reservation.number_of_people}</p>
                </div>
                <div class="col-md-6">
                    <h6 class="mb-3"><i class="bi bi-person"></i> Customer Information</h6>
                    <p><strong>Customer Name:</strong> ${reservation.customerName || reservation.customer_name || 'N/A'}</p>
                    ${reservation.customerEmail || reservation.customer_email ? `<p><strong>Email:</strong> ${reservation.customerEmail || reservation.customer_email}</p>` : ''}
                    ${reservation.customerPhone || reservation.customer_phone ? `<p><strong>Phone:</strong> ${reservation.customerPhone || reservation.customer_phone}</p>` : ''}
                </div>
                ${(reservation.specialRequests || reservation.special_requests) ? `
                <div class="col-md-12 mt-3">
                    <h6 class="mb-3"><i class="bi bi-chat-left-text"></i> Special Requests</h6>
                    <div class="alert alert-info mb-0">
                        ${reservation.specialRequests || reservation.special_requests}
                    </div>
                </div>
                ` : ''}
                ${reservation.createdAt || reservation.created_at ? `
                <div class="col-md-12 mt-3">
                    <small class="text-muted">
                        <i class="bi bi-clock"></i> Reserved on: ${new Date(reservation.createdAt || reservation.created_at).toLocaleString()}
                    </small>
                </div>
                ` : ''}
            </div>
        `;
        
        new bootstrap.Modal(document.getElementById('reservationModal')).show();
    } catch (error) {
        console.error('Error viewing reservation details:', error);
        if (typeof notify === 'function') {
            notify('Error: ' + error.message, 'error');
        }
    }
}

// Export functions to window for onclick handlers
window.loadReservations = loadReservations;
window.displayReservations = displayReservations;
window.updateReservationStatus = updateReservationStatus;
window.viewReservationDetails = viewReservationDetails;
window.getReservationStatusBadgeClass = getReservationStatusBadgeClass;

// Initialize reservations when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Reservation module loaded');
    });
} else {
    console.log('Reservation module loaded');
}