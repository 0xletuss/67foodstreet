// seller_chat.js - Seller Dashboard Chat System

const CHAT_API_BASE_URL = 'https://six7backend.onrender.com/api';
let currentChatRoom = null;
let currentCustomerId = null;
let currentCustomerName = null;
let sellerChatPollingInterval = null;
let sellerUnreadPollingInterval = null;

// Initialize seller chat system
function initializeSellerChat() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.log('Seller Chat: Not logged in');
        return;
    }

    // Start polling for unread messages
    startSellerUnreadPolling();
    console.log('Seller chat system initialized');
}

// Load chat rooms for seller
async function loadSellerChatRooms() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const chatList = document.getElementById('sellerChatList');
    if (!chatList) return;

    chatList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #999;">
            <i class="bi bi-arrow-clockwise spin"></i> Loading chats...
        </div>
    `;

    try {
        const response = await fetch(`${CHAT_API_BASE_URL}/chat/rooms`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        displaySellerChatRooms(data.chat_rooms || []);
    } catch (error) {
        console.error('Error loading seller chat rooms:', error);
        chatList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #999;">
                <i class="bi bi-exclamation-circle"></i>
                <p>Unable to load chats</p>
                <button onclick="loadSellerChatRooms()" class="btn btn-sm btn-primary mt-2">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
    }
}

// Display chat rooms
function displaySellerChatRooms(rooms) {
    const chatList = document.getElementById('sellerChatList');
    
    if (rooms.length === 0) {
        chatList.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #999;">
                <i class="bi bi-chat-dots" style="font-size: 3rem; opacity: 0.3;"></i>
                <p style="margin-top: 15px;">No conversations yet</p>
                <small>Customers will appear here when they message you</small>
            </div>
        `;
        return;
    }

    const roomsHTML = rooms.map(room => `
        <div class="seller-chat-item ${room.unread_count > 0 ? 'unread' : ''}" 
             onclick="openSellerChatRoom(${room.id}, ${room.other_user.id}, '${escapeHtml(room.other_user.name)}')">
            <div class="chat-avatar">${room.other_user.avatar}</div>
            <div class="chat-info">
                <div class="chat-name">${escapeHtml(room.other_user.name)}</div>
                <div class="chat-last-message">${escapeHtml(room.last_message || 'No messages yet')}</div>
            </div>
            <div class="chat-meta">
                ${room.unread_count > 0 ? `<span class="unread-badge">${room.unread_count}</span>` : ''}
            </div>
        </div>
    `).join('');

    chatList.innerHTML = roomsHTML;
}

// Open specific chat room
async function openSellerChatRoom(roomId, customerId, customerName) {
    currentChatRoom = roomId;
    currentCustomerId = customerId;
    currentCustomerName = customerName;

    // Update UI
    const chatSidebar = document.getElementById('sellerChatList').parentElement;
    const chatMain = document.getElementById('sellerChatMessages');
    
    // Hide sidebar and show messages on mobile
    if (window.innerWidth <= 768) {
        chatSidebar.style.display = 'none';
        chatMain.classList.add('active');
    }
    
    chatMain.style.display = 'flex';
    document.getElementById('sellerChatCustomerName').textContent = customerName;
    document.getElementById('sellerChatBackBtn').style.display = 'inline-block';

    // Load messages
    await loadSellerMessages(roomId);

    // Setup event listeners
    setupSellerChatInput();

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('sellerChatInput');
        if (input) input.focus();
    }, 100);

    // Start polling
    startSellerChatPolling(roomId);
}

// Load messages for a chat room
async function loadSellerMessages(roomId, silent = false) {
    const token = localStorage.getItem('access_token');
    const container = document.getElementById('sellerChatMessagesContainer');

    if (!silent) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="bi bi-arrow-clockwise spin"></i>
            </div>
        `;
    }

    try {
        const response = await fetch(`${CHAT_API_BASE_URL}/chat/room/${roomId}/messages`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load messages: ${response.status}`);
        }

        const data = await response.json();
        displaySellerMessages(data.messages || []);
        scrollSellerChatToBottom();
    } catch (error) {
        console.error('Error loading messages:', error);
        if (!silent) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #999;">
                    <i class="bi bi-exclamation-circle"></i>
                    <p>Failed to load messages</p>
                </div>
            `;
        }
    }
}

// Display messages
function displaySellerMessages(messages) {
    const container = document.getElementById('sellerChatMessagesContainer');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const currentSellerId = user.sellerId;

    if (messages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #999;">
                <i class="bi bi-chat-dots" style="font-size: 2rem;"></i>
                <p style="margin-top: 10px;">No messages yet</p>
            </div>
        `;
        return;
    }

    const messagesHTML = messages.map(msg => {
        const isSender = msg.sender_type === 'seller' && msg.sender_id === currentSellerId;
        return `
            <div class="chat-message ${isSender ? 'sent' : 'received'}">
                <div class="message-bubble">
                    <p>${escapeHtml(msg.message)}</p>
                    <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = messagesHTML;
}

// Send message
async function sendSellerMessage() {
    const input = document.getElementById('sellerChatInput');
    const message = input.value.trim();

    if (!message || !currentChatRoom) return;

    const token = localStorage.getItem('access_token');
    const sendBtn = document.getElementById('sellerChatSendBtn');

    sendBtn.disabled = true;

    try {
        const response = await fetch(`${CHAT_API_BASE_URL}/chat/room/${currentChatRoom}/message`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                message_type: 'text'
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.status}`);
        }

        input.value = '';
        input.style.height = 'auto';
        await loadSellerMessages(currentChatRoom, true);
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// Back to chat list
function backToSellerChatList() {
    const chatSidebar = document.getElementById('sellerChatList').parentElement;
    const chatMain = document.getElementById('sellerChatMessages');
    
    // Show sidebar and hide messages on mobile
    if (window.innerWidth <= 768) {
        chatSidebar.style.display = 'flex';
        chatMain.classList.remove('active');
    }
    
    chatSidebar.style.display = 'block';
    chatMain.style.display = 'none';
    document.getElementById('sellerChatBackBtn').style.display = 'none';

    currentChatRoom = null;
    currentCustomerId = null;
    currentCustomerName = null;

    stopSellerChatPolling();
    loadSellerChatRooms();
}

// Setup input event listeners
function setupSellerChatInput() {
    const input = document.getElementById('sellerChatInput');
    if (!input) return;

    // Remove existing listeners
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    const freshInput = document.getElementById('sellerChatInput');

    // Auto-resize
    freshInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Send on Enter
    freshInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendSellerMessage();
        }
    });
}

// Start polling for new messages
function startSellerChatPolling(roomId) {
    stopSellerChatPolling();
    
    sellerChatPollingInterval = setInterval(() => {
        if (currentChatRoom === roomId) {
            loadSellerMessages(roomId, true);
        }
    }, 5000);
}

// Stop polling
function stopSellerChatPolling() {
    if (sellerChatPollingInterval) {
        clearInterval(sellerChatPollingInterval);
        sellerChatPollingInterval = null;
    }
}

// Start polling for unread count
function startSellerUnreadPolling() {
    updateSellerUnreadCount();
    
    sellerUnreadPollingInterval = setInterval(() => {
        updateSellerUnreadCount();
    }, 15000);
}

// Update unread count
async function updateSellerUnreadCount() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const response = await fetch(`${CHAT_API_BASE_URL}/chat/unread-count`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return;

        const data = await response.json();
        const count = data.unread_count || 0;

        const badge = document.getElementById('sellerChatUnreadBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.debug('Error updating unread count:', error);
    }
}

// Scroll to bottom
function scrollSellerChatToBottom() {
    const container = document.getElementById('sellerChatMessagesContainer');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

// Helper functions
function formatChatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show/hide chats section
function showChatsSection() {
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById('chatsSection').style.display = 'block';
    
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector('[data-section="chats"]').classList.add('active');
    
    loadSellerChatRooms();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopSellerChatPolling();
    if (sellerUnreadPollingInterval) {
        clearInterval(sellerUnreadPollingInterval);
    }
});

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSellerChat);
} else {
    initializeSellerChat();
}

// Export functions
window.openSellerChatRoom = openSellerChatRoom;
window.backToSellerChatList = backToSellerChatList;
window.sendSellerMessage = sendSellerMessage;
window.showChatsSection = showChatsSection;