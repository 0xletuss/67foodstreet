// auth.js - Authentication Handler
// Configuration
const API_BASE_URL = 'http://localhost:5000/api/auth'; // Change this to your backend URL

// Utility function to show messages
function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = isError ? 'error-message' : 'success-message';
        element.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Store token and user info in localStorage
function saveAuthData(token, user, userType) {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('user_type', userType);
}

// Get stored token
function getToken() {
    return localStorage.getItem('access_token');
}

// Get stored user info
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Check if user is logged in
function isLoggedIn() {
    return !!getToken();
}

// Logout function
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_type');
    window.location.href = 'login.html';
}

// Redirect based on user type
function redirectToDashboard(userType) {
    switch(userType) {
        case 'customer':
            window.location.href = '/customer/dashboard.html';
            break;
        case 'seller':
            window.location.href = '/seller/dashboard.html';
            break;
        case 'admin':
            window.location.href = '/admin/dashboard.html';
            break;
        default:
            window.location.href = '/index.html';
    }
}

// ==================== CUSTOMER REGISTRATION ====================
async function registerCustomer(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/customer/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Save auth data
        saveAuthData(data.access_token, data.customer, 'customer');
        
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Handle customer registration form
function handleCustomerRegisterForm() {
    const form = document.getElementById('customerRegisterForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';

        const formData = {
            customerName: document.getElementById('customerName').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            phoneNumber: document.getElementById('phoneNumber').value || null,
            address: document.getElementById('address').value || null
        };

        // Validate password confirmation
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (formData.password !== confirmPassword) {
            showMessage('message', 'Passwords do not match!', true);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
            return;
        }

        const result = await registerCustomer(formData);

        if (result.success) {
            showMessage('message', 'Registration successful! Redirecting...');
            setTimeout(() => redirectToDashboard('customer'), 2000);
        } else {
            showMessage('message', result.error, true);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });
}

// ==================== SELLER REGISTRATION ====================
async function registerSeller(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/seller/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Save auth data
        saveAuthData(data.access_token, data.seller, 'seller');
        
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Handle seller registration form
function handleSellerRegisterForm() {
    const form = document.getElementById('sellerRegisterForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';

        const formData = {
            username: document.getElementById('username').value,
            storeName: document.getElementById('storeName').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            phoneNumber: document.getElementById('phoneNumber').value || null,
            address: document.getElementById('address').value || null
        };

        // Validate password confirmation
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (formData.password !== confirmPassword) {
            showMessage('message', 'Passwords do not match!', true);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
            return;
        }

        const result = await registerSeller(formData);

        if (result.success) {
            showMessage('message', 'Registration successful! Your account is pending admin verification.');
            setTimeout(() => window.location.href = 'login.html', 3000);
        } else {
            showMessage('message', result.error, true);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });
}

// ==================== LOGIN ====================
async function login(loginData, userType) {
    try {
        const endpoint = userType === 'admin' ? 'admin/login' : 
                        userType === 'seller' ? 'seller/login' : 'customer/login';
        
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Save auth data
        const userData = data.customer || data.seller || data.admin;
        saveAuthData(data.access_token, userData, userType);
        
        return { success: true, data, userType };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Handle login form
function handleLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        const userType = document.getElementById('userType').value;
        
        let loginData;
        if (userType === 'customer') {
            loginData = {
                email: document.getElementById('loginIdentifier').value,
                password: document.getElementById('password').value
            };
        } else {
            loginData = {
                username: document.getElementById('loginIdentifier').value,
                password: document.getElementById('password').value
            };
        }

        const result = await login(loginData, userType);

        if (result.success) {
            showMessage('message', 'Login successful! Redirecting...');
            setTimeout(() => redirectToDashboard(result.userType), 1500);
        } else {
            showMessage('message', result.error, true);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });

    // Update label based on user type
    const userTypeSelect = document.getElementById('userType');
    if (userTypeSelect) {
        userTypeSelect.addEventListener('change', function() {
            const label = document.querySelector('label[for="loginIdentifier"]');
            const input = document.getElementById('loginIdentifier');
            
            if (this.value === 'customer') {
                label.textContent = 'Email';
                input.type = 'email';
                input.placeholder = 'Enter your email';
            } else {
                label.textContent = 'Username';
                input.type = 'text';
                input.placeholder = 'Enter your username';
            }
        });
    }
}

// ==================== API CALLS WITH AUTH ====================
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    
    if (!token) {
        throw new Error('No authentication token found');
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    // If unauthorized, logout and redirect to login
    if (response.status === 401) {
        logout();
        throw new Error('Session expired. Please login again.');
    }

    return response;
}

// Get user profile
async function getProfile() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/profile`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch profile');
        }
        
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Update user profile
async function updateProfile(profileData) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update profile');
        }
        
        // Update stored user data
        localStorage.setItem('user', JSON.stringify(data.user));
        
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on and initialize appropriate handlers
    if (document.getElementById('customerRegisterForm')) {
        handleCustomerRegisterForm();
    }
    
    if (document.getElementById('sellerRegisterForm')) {
        handleSellerRegisterForm();
    }
    
    if (document.getElementById('loginForm')) {
        handleLoginForm();
    }

    // If user is already logged in and on login/register pages, redirect
    if (isLoggedIn() && (window.location.pathname.includes('login') || 
                         window.location.pathname.includes('register'))) {
        const userType = localStorage.getItem('user_type');
        redirectToDashboard(userType);
    }
});

// Export functions for use in other scripts
window.authAPI = {
    registerCustomer,
    registerSeller,
    login,
    logout,
    getToken,
    getUser,
    isLoggedIn,
    getProfile,
    updateProfile,
    fetchWithAuth,
    redirectToDashboard
};