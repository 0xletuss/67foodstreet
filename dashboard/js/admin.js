// admin.js - Admin Dashboard Logic
const API_BASE = 'https://six7backend.onrender.com/api/admin';

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const toastBody = toast.querySelector('.toast-body');
  toastBody.textContent = message;
  toast.classList.toggle('bg-danger', isError);
  toast.classList.toggle('bg-success', !isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Check auth & load dashboard
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.authAPI.isLoggedIn() || localStorage.getItem('user_type') !== 'admin') {
    window.location.href = '../auth/login.html';
    return;
  }

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.authAPI.logout();
  });

  await loadDashboardStats();
});

// Navigation handling
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const sectionId = link.dataset.section;
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    
    // Update active section
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    // Close mobile menu
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menuOverlay');
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    
    // Load data based on section
    switch(sectionId) {
      case 'customers':
        await loadCustomers();
        break;
      case 'sellers':
        await loadSellers();
        break;
      case 'pending-sellers':
        await loadPendingSellers();
        break;
      case 'products':
        await loadProducts();
        break;
      case 'orders':
        await loadOrders();
        break;
      case 'dashboard':
        await loadDashboardStats();
        break;
    }
  });
});

// Dashboard Stats
async function loadDashboardStats() {
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    const data = await res.json();

    const stats = [
      { label: 'Total Customers', value: data.users.total_customers, icon: 'fas fa-users' },
      { label: 'Active Customers', value: data.users.active_customers, icon: 'fas fa-user-check' },
      { label: 'Total Sellers', value: data.users.total_sellers, icon: 'fas fa-store' },
      { label: 'Verified Sellers', value: data.users.verified_sellers, icon: 'fas fa-badge-check' },
      { label: 'Total Orders', value: data.orders.total, icon: 'fas fa-shopping-cart' },
      { label: 'Pending Orders', value: data.orders.pending, icon: 'fas fa-hourglass-half' },
      { label: 'Revenue (30d)', value: `₱${data.revenue.last_30_days.toLocaleString()}`, icon: 'fas fa-money-bill' },
      { label: 'Available Products', value: data.products.available, icon: 'fas fa-box' },
    ];

    const container = document.getElementById('statsContainer');
    container.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-icon">
          <i class="${s.icon}"></i>
        </div>
        <div class="stat-info">
          <h3>${s.value}</h3>
          <p>${s.label}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, true);
  }
}

// Load Customers
async function loadCustomers() {
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/customers`);
    const { customers } = await res.json();
    const tbody = document.querySelector('#customersTable tbody');
    tbody.innerHTML = customers.map(c => `
      <tr>
        <td>${c.customerId}</td>
        <td>${c.customerName}</td>
        <td>${c.email}</td>
        <td>${c.phoneNumber || '-'}</td>
        <td><span class="badge bg-${c.isActive ? 'success' : 'secondary'}">${c.isActive ? 'Active' : 'Inactive'}</span></td>
        <td class="table-actions">
          <button class="btn btn-sm btn-warning" onclick="toggleCustomer(${c.customerId}, ${!c.isActive})">
            ${c.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast(err.message, true); }
}

window.toggleCustomer = async (id, activate) => {
  if (!confirm(`Are you sure you want to ${activate ? 'activate' : 'deactivate'} this customer?`)) return;
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/customers/${id}/toggle-active`, { method: 'PUT' });
    const data = await res.json();
    showToast(data.message || 'Success');
    loadCustomers();
  } catch (err) { showToast(err.message, true); }
};

// Load Sellers
async function loadSellers() {
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/sellers`);
    const { sellers } = await res.json();
    const tbody = document.querySelector('#sellersTable tbody');
    tbody.innerHTML = sellers.map(s => `
      <tr>
        <td>${s.sellerId}</td>
        <td>${s.storeName}</td>
        <td>${s.username}</td>
        <td>${s.email}</td>
        <td><span class="badge ${s.isVerified ? 'badge-verified' : 'badge-unverified'}">${s.isVerified ? 'Yes' : 'No'}</span></td>
        <td><span class="badge bg-${s.isActive ? 'success' : 'secondary'}">${s.isActive ? 'Active' : 'Inactive'}</span></td>
        <td class="table-actions">
          <button class="btn btn-sm btn-warning" onclick="toggleSeller(${s.sellerId}, ${!s.isActive})">
            ${s.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast(err.message, true); }
}

window.toggleSeller = async (id, activate) => {
  if (!confirm(`Are you sure you want to ${activate ? 'activate' : 'deactivate'} this seller?`)) return;
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/sellers/${id}/toggle-active`, { method: 'PUT' });
    const data = await res.json();
    showToast(data.message || 'Success');
    loadSellers();
  } catch (err) { showToast(err.message, true); }
};

// Pending Sellers
async function loadPendingSellers() {
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/sellers/pending`);
    const { sellers } = await res.json();
    const tbody = document.querySelector('#pendingSellersTable tbody');
    tbody.innerHTML = sellers.map(s => `
      <tr>
        <td>${s.sellerId}</td>
        <td>${s.storeName}</td>
        <td>${s.username}</td>
        <td>${s.email}</td>
        <td>
          <button class="btn btn-success btn-sm me-2" onclick="verifySeller(${s.sellerId}, true)">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="verifySeller(${s.sellerId}, false)">Reject</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast(err.message, true); }
}

window.verifySeller = async (id, approve) => {
  if (!confirm(`Are you sure you want to ${approve ? 'approve' : 'reject'} this seller?`)) return;
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/sellers/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ is_verified: approve })
    });
    const data = await res.json();
    showToast(data.message || 'Success');
    loadPendingSellers();
    loadSellers();
  } catch (err) { showToast(err.message, true); }
};

// Products
async function loadProducts() {
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/products`);
    const { products } = await res.json();
    const tbody = document.querySelector('#productsTable tbody');
    tbody.innerHTML = products.map(p => `
      <tr>
        <td>${p.productId}</td>
        <td>${p.productName}</td>
        <td>${p.seller?.storeName || 'N/A'}</td>
        <td>₱${p.price}</td>
        <td>${p.stockQuantity}</td>
        <td><span class="badge bg-${p.isAvailable ? 'success' : 'secondary'}">${p.isAvailable ? 'Yes' : 'No'}</span></td>
        <td>
          <button class="btn btn-sm btn-${p.isAvailable ? 'warning' : 'success'}" 
                  onclick="toggleProduct(${p.productId}, ${!p.isAvailable})">
            ${p.isAvailable ? 'Disable' : 'Enable'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast(err.message, true); }
}

window.toggleProduct = async (id, enable) => {
  if (!confirm(`Are you sure you want to ${enable ? 'enable' : 'disable'} this product?`)) return;
  try {
    const res = await window.authAPI.fetchWithAuth(`${API_BASE}/products/${id}/toggle-availability`, { method: 'PUT' });
    const data = await res.json();
    showToast(data.message || 'Success');
    loadProducts();
  } catch (err) { showToast(err.message, true); }
};

// Orders
document.getElementById('orderStatusFilter')?.addEventListener('change', () => loadOrders());

async function loadOrders() {
  const status = document.getElementById('orderStatusFilter').value;
  try {
    const url = status ? `${API_BASE}/orders?status=${status}` : `${API_BASE}/orders`;
    const res = await window.authAPI.fetchWithAuth(url);
    const { orders } = await res.json();
    const tbody = document.querySelector('#ordersTable tbody');
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>#${o.orderId}</td>
        <td>${o.customer?.customerName || 'N/A'}</td>
        <td>₱${o.totalAmount}</td>
        <td><span class="badge bg-info">${o.status}</span></td>
        <td>${new Date(o.orderDate).toLocaleDateString()}</td>
        <td><a href="order-details.html?id=${o.orderId}" class="btn btn-sm btn-primary">View</a></td>
      </tr>
    `).join('');
  } catch (err) { showToast(err.message, true); }
}