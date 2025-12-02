// Configuration
const API_BASE_URL = 'https://six7backend.onrender.com/api/seller';
let revenueChart = null;
let uploadedImageUrl = null;

// Debug function to check auth state
function debugAuthState() {
    console.log('=== AUTH DEBUG ===');
    console.log('Token:', localStorage.getItem('access_token') ? 'EXISTS' : 'MISSING');
    console.log('User Type:', localStorage.getItem('user_type'));
    console.log('User:', localStorage.getItem('user'));
    console.log('================');
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
    debugAuthState();
    
    // Check if user is logged in and is a seller
    const token = localStorage.getItem('access_token');
    const userType = localStorage.getItem('user_type');
    
    if (!token) {
        console.error('No token found, redirecting to login');
        window.location.href = '../auth/login.html';
        return;
    }
    
    if (userType !== 'seller') {
        console.error('User is not a seller:', userType);
        alert('Access denied. This dashboard is for sellers only.');
        window.location.href = '../auth/login.html';
        return;
    }

    // Load seller name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.storeName) {
        document.getElementById('sellerName').textContent = user.storeName;
    }

    initializeDashboard();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-menu a[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            navigateToSection(section);
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Product form
    document.getElementById('saveProductBtn').addEventListener('click', saveProduct);

    // Image upload
    document.getElementById('productImageFile').addEventListener('change', handleImageSelect);
    document.getElementById('uploadImageBtn').addEventListener('click', uploadImage);

    // Stock update
    document.getElementById('updateStockBtn').addEventListener('click', updateStock);

    // Order status filter
    document.getElementById('orderStatusFilter').addEventListener('change', function() {
        loadOrders(this.value);
    });

    // Revenue period filter
    document.getElementById('revenuePeriod').addEventListener('change', function() {
        loadRevenue(this.value);
    });

    // Product modal reset
    const productModal = document.getElementById('productModal');
    productModal.addEventListener('hidden.bs.modal', resetProductForm);
}

// Handle Image Selection
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
        // Validate file type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showNotification('Invalid file type. Please select an image (PNG, JPG, GIF, WEBP)', 'error');
            event.target.value = '';
            return;
        }
        
        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            showNotification('File too large. Maximum size is 10MB', 'error');
            event.target.value = '';
            return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreviewContainer').style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        // Show upload button
        document.getElementById('uploadImageBtn').style.display = 'inline-block';
    }
}

// Upload Image to Cloudinary
async function uploadImage() {
    const fileInput = document.getElementById('productImageFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select an image first', 'error');
        return;
    }
    
    try {
        // Show loading state
        const uploadBtn = document.getElementById('uploadImageBtn');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading...';
        uploadBtn.disabled = true;
        
        // Create form data
        const formData = new FormData();
        formData.append('image', file);
        
        // Upload to backend
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/upload-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }
        
        const data = await response.json();
        uploadedImageUrl = data.imageUrl;
        
        // Update hidden input with URL
        document.getElementById('productImage').value = uploadedImageUrl;
        
        // Show success
        showNotification('Image uploaded successfully!', 'success');
        
        // Hide upload button, show success indicator
        uploadBtn.style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'inline-block';
        
    } catch (error) {
        console.error('Error uploading image:', error);
        showNotification('Error uploading image: ' + error.message, 'error');
        
        // Reset button
        const uploadBtn = document.getElementById('uploadImageBtn');
        uploadBtn.innerHTML = '<i class="bi bi-cloud-upload"></i> Upload';
        uploadBtn.disabled = false;
    }
}

// Navigate to Section
function navigateToSection(section) {
    // Update active menu
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Hide all sections
    document.querySelectorAll('.section-content').forEach(sec => {
        sec.style.display = 'none';
    });

    // Show selected section
    document.getElementById(`${section}Section`).style.display = 'block';

    // Load section data
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'products':
            loadProducts();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'inventory':
            loadInventory();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Initialize Dashboard
async function initializeDashboard() {
    await loadDashboard();
}

// Load Dashboard Data
async function loadDashboard() {
    try {
        await Promise.all([
            loadProducts(),
            loadOrders(),
            loadRevenue('month')
        ]);

        const orders = await apiCall('/orders?limit=5');
        displayRecentOrders(orders.orders || []);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error loading dashboard data: ' + error.message, 'error');
    }
}

// Load Products
async function loadProducts() {
    try {
        const response = await apiCall('/products');
        const products = response.products || [];
        
        document.getElementById('totalProducts').textContent = products.length;
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Error loading products: ' + error.message, 'error');
    }
}

// Display Products
function displayProducts(products) {
    const tbody = document.getElementById('productsTable');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>
                ${product.imageUrl ? 
                    `<img src="${product.imageUrl}" class="product-image-preview" alt="${product.productName}">` : 
                    '<i class="bi bi-image" style="font-size: 2rem;"></i>'}
            </td>
            <td>${product.productName}</td>
            <td>${product.category || 'N/A'}</td>
            <td>₱${parseFloat(product.unitPrice).toFixed(2)}</td>
            <td>${product.inventory ? product.inventory.quantityInStock : 0}</td>
            <td>
                <span class="badge ${product.isAvailable ? 'bg-success' : 'bg-danger'}">
                    ${product.isAvailable ? 'Available' : 'Unavailable'}
                </span>
            </td>
            <td class="table-actions">
                <button class="btn btn-sm btn-primary" onclick="editProduct(${product.productId})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.productId})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load Orders
async function loadOrders(status = '') {
    try {
        const url = status ? `/orders?status=${status}` : '/orders';
        const response = await apiCall(url);
        const orders = response.orders || [];
        
        document.getElementById('totalOrders').textContent = orders.length;
        const pendingCount = orders.filter(o => o.status === 'Pending').length;
        document.getElementById('pendingOrders').textContent = pendingCount;
        
        displayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders: ' + error.message, 'error');
    }
}

// Display Orders
function displayOrders(orders) {
    const tbody = document.getElementById('ordersTable');
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.orderId}</td>
            <td>${order.customerName || 'Unknown'}</td>
            <td>${new Date(order.orderDate).toLocaleDateString()}</td>
            <td>${order.type}</td>
            <td>₱${parseFloat(order.totalAmount).toFixed(2)}</td>
            <td>
                <span class="badge badge-status ${getStatusBadgeClass(order.status)}">
                    ${order.status}
                </span>
            </td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="viewOrderDetails(${order.orderId})">
                    <i class="bi bi-eye"></i>
                </button>
                <select class="form-select form-select-sm" onchange="updateOrderStatus(${order.orderId}, this.value)" style="width: auto; display: inline-block;">
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

// Display Recent Orders
function displayRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersTable');
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No recent orders</td></tr>';
        return;
    }

    tbody.innerHTML = orders.slice(0, 5).map(order => `
        <tr>
            <td>#${order.orderId}</td>
            <td>${order.customerName || 'Unknown'}</td>
            <td>${new Date(order.orderDate).toLocaleDateString()}</td>
            <td>₱${parseFloat(order.totalAmount).toFixed(2)}</td>
            <td>
                <span class="badge badge-status ${getStatusBadgeClass(order.status)}">
                    ${order.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewOrderDetails(${order.orderId})">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load Inventory
async function loadInventory() {
    try {
        const response = await apiCall('/products');
        const products = response.products || [];
        displayInventory(products);
    } catch (error) {
        console.error('Error loading inventory:', error);
        showNotification('Error loading inventory: ' + error.message, 'error');
    }
}

// Display Inventory
function displayInventory(products) {
    const tbody = document.getElementById('inventoryTable');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No inventory records found</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => {
        const inventory = product.inventory || {};
        const needsReorder = inventory.quantityInStock <= (inventory.reorderLevel || 10);
        
        return `
            <tr>
                <td>${product.productName}</td>
                <td>${inventory.quantityInStock || 0}</td>
                <td>${inventory.reorderLevel || 10}</td>
                <td>${inventory.lastRestocked ? new Date(inventory.lastRestocked).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <span class="badge ${needsReorder ? 'bg-warning' : 'bg-success'}">
                        ${needsReorder ? 'Low Stock' : 'In Stock'}
                    </span>
                </td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-primary" onclick="openStockModal(${product.productId}, '${product.productName}', ${inventory.quantityInStock || 0})">
                        <i class="bi bi-plus-circle"></i> Update Stock
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load Analytics
async function loadAnalytics() {
    try {
        await Promise.all([
            loadRevenue('month'),
            loadTopProducts()
        ]);
    } catch (error) {
        console.error('Error loading analytics:', error);
        showNotification('Error loading analytics: ' + error.message, 'error');
    }
}

// Load Revenue
async function loadRevenue(period = 'month') {
    try {
        const response = await apiCall(`/revenue?period=${period}`);
        
        if (period === 'month') {
            document.getElementById('monthlyRevenue').textContent = 
                `₱${parseFloat(response.total_revenue || 0).toFixed(2)}`;
        }
        
        updateRevenueChart(response.revenue_by_day || []);
    } catch (error) {
        console.error('Error loading revenue:', error);
        showNotification('Error loading revenue data: ' + error.message, 'error');
    }
}

// Update Revenue Chart
function updateRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    
    if (revenueChart) {
        revenueChart.destroy();
    }

    revenueChart = new Chart(ctx, {
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
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₱' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// Load Top Products
async function loadTopProducts() {
    try {
        const response = await apiCall('/analytics');
        const topProducts = response.top_products || [];
        displayTopProducts(topProducts);
    } catch (error) {
        console.error('Error loading top products:', error);
        showNotification('Error loading top products: ' + error.message, 'error');
    }
}

// Display Top Products
function displayTopProducts(products) {
    const tbody = document.getElementById('topProductsTable');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No sales data available</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.name}</td>
            <td>${product.total_sold}</td>
            <td>₱${parseFloat(product.total_revenue).toFixed(2)}</td>
        </tr>
    `).join('');
}

// Edit Product
async function editProduct(productId) {
    try {
        const response = await apiCall('/products');
        const product = response.products.find(p => p.productId === productId);
        
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }

        // Fill form
        document.getElementById('productId').value = product.productId;
        document.getElementById('productName').value = product.productName;
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('productPrice').value = product.unitPrice;
        document.getElementById('productImage').value = product.imageUrl || '';
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productAvailable').checked = product.isAvailable;
        
        // Show current image if exists
        if (product.imageUrl) {
            document.getElementById('imagePreview').src = product.imageUrl;
            document.getElementById('imagePreviewContainer').style.display = 'block';
            uploadedImageUrl = product.imageUrl;
        }
        
        document.getElementById('productModalTitle').textContent = 'Edit Product';
        
        const modal = new bootstrap.Modal(document.getElementById('productModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading product:', error);
        showNotification('Error loading product details: ' + error.message, 'error');
    }
}

// Save Product
async function saveProduct() {
    try {
        const productId = document.getElementById('productId').value;
        
        const productName = document.getElementById('productName').value.trim();
        const unitPrice = document.getElementById('productPrice').value;
        
        if (!productName) {
            showNotification('Product name is required', 'error');
            return;
        }
        
        if (!unitPrice || parseFloat(unitPrice) <= 0) {
            showNotification('Valid price is required', 'error');
            return;
        }
        
        const data = {
            productName: productName,
            description: document.getElementById('productDescription').value.trim() || null,
            unitPrice: parseFloat(unitPrice),
            isAvailable: document.getElementById('productAvailable').checked ? 1 : 0,
            category: document.getElementById('productCategory').value.trim() || null,
            imageUrl: uploadedImageUrl || document.getElementById('productImage').value.trim() || null
        };

        console.log('Saving product with data:', data);

        let response;
        if (productId) {
            response = await apiCall(`/products/${productId}`, 'PUT', data);
        } else {
            response = await apiCall('/products', 'POST', data);
        }

        showNotification(response.message || 'Product saved successfully', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
        modal.hide();
        
        await loadProducts();
    } catch (error) {
        console.error('Error saving product:', error);
        showNotification('Error saving product: ' + error.message, 'error');
    }
}

// Delete Product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        const response = await apiCall(`/products/${productId}`, 'DELETE');
        showNotification(response.message || 'Product deleted successfully', 'success');
        await loadProducts();
    } catch (error) {
        console.error('Error deleting product:', error);
        showNotification('Error deleting product: ' + error.message, 'error');
    }
}

// Open Stock Modal
function openStockModal(productId, productName, currentStock) {
    document.getElementById('stockProductId').value = productId;
    document.getElementById('stockProductName').value = productName;
    document.getElementById('currentStock').value = currentStock;
    document.getElementById('quantityChange').value = '';
    document.getElementById('stockNotes').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('stockModal'));
    modal.show();
}

// Update Stock
async function updateStock() {
    try {
        const productId = document.getElementById('stockProductId').value;
        const data = {
            quantity_change: parseInt(document.getElementById('quantityChange').value),
            reason: document.getElementById('stockReason').value,
            notes: document.getElementById('stockNotes').value
        };

        const response = await apiCall(`/inventory/${productId}`, 'POST', data);
        showNotification(response.message || 'Stock updated successfully', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('stockModal'));
        modal.hide();
        
        await loadInventory();
    } catch (error) {
        console.error('Error updating stock:', error);
        showNotification('Error updating stock: ' + error.message, 'error');
    }
}

// Update Order Status
async function updateOrderStatus(orderId, newStatus) {
    if (!newStatus) return;

    try {
        const response = await apiCall(`/orders/${orderId}/status`, 'PUT', { status: newStatus });
        showNotification(response.message || 'Order status updated successfully', 'success');
        await loadOrders();
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Error updating order status: ' + error.message, 'error');
    }
}

// View Order Details
async function viewOrderDetails(orderId) {
    try {
        const response = await apiCall('/orders');
        const order = response.orders.find(o => o.orderId === orderId);
        
        if (!order) {
            showNotification('Order not found', 'error');
            return;
        }

        const content = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Order Information</h6>
                    <p><strong>Order ID:</strong> #${order.orderId}</p>
                    <p><strong>Customer:</strong> ${order.customerName || 'Unknown'}</p>
                    <p><strong>Date:</strong> ${new Date(order.orderDate).toLocaleString()}</p>
                    <p><strong>Type:</strong> ${order.type}</p>
                    <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span></p>
                </div>
                <div class="col-md-6">
                    <h6>Delivery Information</h6>
                    <p><strong>Address:</strong> ${order.deliveryAddress || 'N/A'}</p>
                    <p><strong>Notes:</strong> ${order.notes || 'None'}</p>
                </div>
                <div class="col-md-12 mt-3">
                    <h6>Order Items</h6>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items ? order.items.map(item => `
                                <tr>
                                    <td>${item.productName}</td>
                                    <td>${item.quantity}</td>
                                    <td>₱${parseFloat(item.unitPrice).toFixed(2)}</td>
                                    <td>₱${parseFloat(item.subtotal).toFixed(2)}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="4">No items</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colspan="3">Total</th>
                                <th>₱${parseFloat(order.totalAmount).toFixed(2)}</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('orderDetailsContent').innerHTML = content;
        const modal = new bootstrap.Modal(document.getElementById('orderModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading order details:', error);
        showNotification('Error loading order details: ' + error.message, 'error');
    }
}

// Reset Product Form
function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productImageFile').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('uploadImageBtn').style.display = 'none';
    document.getElementById('uploadSuccess').style.display = 'none';
    uploadedImageUrl = null;
    document.getElementById('productModalTitle').textContent = 'Add Product';
}

// Logout
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_type');
    window.location.href = '../auth/login.html';
}

// Helper Functions
function getStatusBadgeClass(status) {
    const statusClasses = {
        'Pending': 'bg-warning',
        'Confirmed': 'bg-info',
        'Delivered': 'bg-success',
        'Cancelled': 'bg-danger',
        'pending': 'bg-warning',
        'confirmed': 'bg-info',
        'preparing': 'bg-primary',
        'ready': 'bg-info',
        'completed': 'bg-success',
        'cancelled': 'bg-danger'
    };
    return statusClasses[status] || 'bg-secondary';
}

// API Call Helper
async function apiCall(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.error('No authentication token found');
        showNotification('Session expired. Please login again.', 'error');
        setTimeout(() => logout(), 2000);
        throw new Error('No authentication token');
    }

    console.log('API Call:', {
        endpoint: `${API_BASE_URL}${endpoint}`,
        method: method,
        hasData: !!data
    });

    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        console.log('API Response:', {
            status: response.status,
            ok: response.ok
        });
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: response.statusText };
            }
            
            if (response.status === 401 || response.status === 422) {
                showNotification('Your session has expired. Please login again.', 'error');
                setTimeout(() => logout(), 2000);
                throw new Error('Authentication failed');
            }
            
            const errorMessage = errorData.msg || errorData.error || errorData.message || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
        }
        
        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('API Call Failed:', error);
        throw error;
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(container);
    }

    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Make functions globally accessible
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.openStockModal = openStockModal;
window.updateOrderStatus = updateOrderStatus;
window.viewOrderDetails = viewOrderDetails;