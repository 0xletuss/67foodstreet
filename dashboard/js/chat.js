// chat.js - Fixed Input Issue

const CHAT_API_BASE_URL = 'https://six7backend.onrender.com/api';
let currentChatRoom = null;
let currentSellerId = null;
let currentSellerName = null;
let chatPollingInterval = null;
let unreadPollingInterval = null;
let isInitialized = false;

// Initialize chat system
function initializeChat() {
    if (isInitialized) return;
    
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.log('Chat: User not logged in, skipping initialization');
        return;
    }

    try {
        createChatUI();
        loadChatRooms();
        startUnreadPolling();
        // REMOVED: setupChatEventListeners() - will be called when chat opens
        
        isInitialized = true;
        console.log('Chat system initialized successfully');
    } catch (error) {
        console.error('Error initializing chat:', error);
    }
}

// Create chat UI elements
function createChatUI() {
    if (document.getElementById('chatIconBtn')) {
        console.log('Chat UI already exists');
        return;
    }

    const chatHTML = `
        <!-- Chat Icon Button -->
        <div id="chatIconBtn" class="chat-icon-btn" onclick="toggleChatBox()">
            <i class="fas fa-comments"></i>
            <span class="chat-unread-badge" id="chatUnreadBadge" style="display: none;">0</span>
        </div>

        <!-- Chat Box -->
        <div id="chatBox" class="chat-box" style="display: none;">
            <!-- Chat Header -->
            <div class="chat-header">
                <div class="chat-header-left">
                    <button class="chat-back-btn" id="chatBackBtn" onclick="backToChatList()" style="display: none;">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <h3 id="chatTitle">Messages</h3>
                </div>
                <button class="chat-close-btn" onclick="toggleChatBox()">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- Connection Status -->
            <div id="chatConnectionStatus" class="chat-connection-status" style="display: none;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Connection issue. Retrying...</span>
            </div>

            <!-- Chat Rooms List -->
            <div id="chatRoomsList" class="chat-rooms-list">
                <div class="chat-loading">
                    <div class="spinner-small"></div>
                    <p>Loading chats...</p>
                </div>
            </div>

            <!-- Chat Messages View -->
            <div id="chatMessagesView" class="chat-messages-view" style="display: none;">
                <div class="chat-messages-container" id="chatMessagesContainer">
                    <!-- Messages will be loaded here -->
                </div>

                <!-- Message Input -->
                <div class="chat-input-container">
                    <textarea 
                        id="chatMessageInput" 
                        class="chat-input" 
                        placeholder="Type a message..."
                        rows="1"
                        maxlength="1000"
                    ></textarea>
                    <button class="chat-send-btn" onclick="sendMessage()" id="chatSendBtn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatHTML);
}

function showConnectionStatus(show) {
    const status = document.getElementById('chatConnectionStatus');
    if (status) {
        status.style.display = show ? 'flex' : 'none';
    }
}

function toggleChatBox() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) {
        console.error('Chat box element not found');
        return;
    }
    
    const isVisible = chatBox.style.display !== 'none';
    
    if (isVisible) {
        chatBox.style.display = 'none';
        stopChatPolling();
    } else {
        chatBox.style.display = 'block';
        loadChatRooms();
    }
}

async function loadChatRooms(retryCount = 0) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.log('No auth token found');
        return;
    }

    const chatRoomsList = document.getElementById('chatRoomsList');
    if (!chatRoomsList) return;

    if (retryCount === 0) {
        chatRoomsList.innerHTML = `
            <div class="chat-loading">
                <div class="spinner-small"></div>
                <p>Loading chats...</p>
            </div>
        `;
    }

    try {
        const response = await fetch(`${CHAT_API_BASE_URL}/chat/rooms`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        displayChatRooms(data.chat_rooms || []);
        showConnectionStatus(false);
    } catch (error) {
        console.error('Error loading chat rooms:', error);
        showConnectionStatus(true);
        
        if (retryCount < 2) {
            console.log(`Retrying... (${retryCount + 1}/3)`);
            setTimeout(() => loadChatRooms(retryCount + 1), 2000);
        } else {
            chatRoomsList.innerHTML = `
                <div class="chat-empty">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Unable to load chats</p>
                    <small>Please check your connection and try again</small>
                    <button onclick="loadChatRooms()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

function displayChatRooms(rooms) {
    const chatRoomsList = document.getElementById('chatRoomsList');
    
    if (rooms.length === 0) {
        chatRoomsList.innerHTML = `
            <div class="chat-empty">
                <i class="fas fa-comments"></i>
                <p>No conversations yet</p>
                <small>Start chatting with sellers from product pages</small>
            </div>
        `;
        return;
    }

    const roomsHTML = rooms.map(room => `
        <div class="chat-room-item ${room.unread_count > 0 ? 'unread' : ''}" 
             onclick="openChatRoom(${room.id}, ${room.other_user.id}, '${escapeHtml(room.other_user.name)}')">
            <div class="chat-room-avatar">${room.other_user.avatar}</div>
            <div class="chat-room-info">
                <div class="chat-room-header">
                    <span class="chat-room-name">${escapeHtml(room.other_user.name)}</span>
                    <span class="chat-room-time">${formatChatTime(room.last_message_time)}</span>
                </div>
                <div class="chat-room-last-message">
                    ${escapeHtml(room.last_message || 'No messages yet')}
                </div>
            </div>
            ${room.unread_count > 0 ? `<span class="chat-room-unread">${room.unread_count}</span>` : ''}
        </div>
    `).join('');

    chatRoomsList.innerHTML = roomsHTML;
}

// FIXED: Open specific chat room with input setup
async function openChatRoom(roomId, sellerId, sellerName) {
    currentChatRoom = roomId;
    currentSellerId = sellerId;
    currentSellerName = sellerName;

    // Update UI
    document.getElementById('chatRoomsList').style.display = 'none';
    document.getElementById('chatMessagesView').style.display = 'flex';
    document.getElementById('chatBackBtn').style.display = 'block';
    document.getElementById('chatTitle').textContent = sellerName;

    // Load messages
    await loadMessages(roomId);

    // CRITICAL FIX: Setup event listeners AFTER the view is visible
    setupChatEventListeners();

    // Focus the input
    setTimeout(() => {
        const input = document.getElementById('chatMessageInput');
        if (input) {
            input.focus();
            console.log('Input focused and ready');
        }
    }, 100);

    // Start polling for new messages
    startChatPolling(roomId);
}

async function startChatWithSeller(sellerId, sellerName) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        if (typeof showToast === 'function') {
            showToast('Please login to chat', 'warning');
        } else {
            alert('Please login to chat');
        }
        return;
    }

    try {
        showConnectionStatus(true);
        
        const response = await fetch(`${CHAT_API_BASE_URL}/chat/room/${sellerId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to create chat room: ${response.status}`);
        }

        const data = await response.json();
        const room = data.chat_room;

        showConnectionStatus(false);

        document.getElementById('chatBox').style.display = 'block';
        await openChatRoom(room.id, sellerId, sellerName);
    } catch (error) {
        console.error('Error starting chat:', error);
        showConnectionStatus(false);
        
        if (typeof showToast === 'function') {
            showToast('Failed to start chat. Please try again.', 'error');
        } else {
            alert('Failed to start chat. Please try again.');
        }
    }
}

async function loadMessages(roomId, silent = false) {
    const token = localStorage.getItem('access_token');
    const container = document.getElementById('chatMessagesContainer');

    if (!silent) {
        container.innerHTML = `
            <div class="chat-loading">
                <div class="spinner-small"></div>
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
        displayMessages(data.messages || []);
        scrollToBottom();
        showConnectionStatus(false);
    } catch (error) {
        console.error('Error loading messages:', error);
        
        if (!silent) {
            showConnectionStatus(true);
            container.innerHTML = `
                <div class="chat-empty">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load messages</p>
                    <button onclick="loadMessages(${roomId})" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

function displayMessages(messages) {
    const container = document.getElementById('chatMessagesContainer');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = user.customerId || user.sellerId;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="chat-empty">
                <i class="fas fa-comments"></i>
                <p>No messages yet</p>
                <small>Start the conversation!</small>
            </div>
        `;
        return;
    }

    const messagesHTML = messages.map(msg => {
        const isSender = msg.sender_id === currentUserId;
        return `
            <div class="chat-message ${isSender ? 'sent' : 'received'}">
                <div class="message-content">
                    <p>${escapeHtml(msg.message)}</p>
                    <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = messagesHTML;
}

async function sendMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();

    if (!message || !currentChatRoom) return;

    const token = localStorage.getItem('access_token');
    const sendBtn = document.getElementById('chatSendBtn');

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
        await loadMessages(currentChatRoom, true);
        showConnectionStatus(false);
    } catch (error) {
        console.error('Error sending message:', error);
        showConnectionStatus(true);
        
        if (typeof showToast === 'function') {
            showToast('Failed to send message', 'error');
        } else {
            alert('Failed to send message');
        }
    } finally {
        sendBtn.disabled = false;
        input.focus(); // Refocus after sending
    }
}

function backToChatList() {
    document.getElementById('chatRoomsList').style.display = 'block';
    document.getElementById('chatMessagesView').style.display = 'none';
    document.getElementById('chatBackBtn').style.display = 'none';
    document.getElementById('chatTitle').textContent = 'Messages';

    currentChatRoom = null;
    currentSellerId = null;
    currentSellerName = null;

    stopChatPolling();
    loadChatRooms();
}

function startChatPolling(roomId) {
    stopChatPolling();
    
    chatPollingInterval = setInterval(() => {
        if (currentChatRoom === roomId) {
            loadMessages(roomId, true);
        }
    }, 5000);
}

function stopChatPolling() {
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
}

function startUnreadPolling() {
    updateUnreadCount();
    
    unreadPollingInterval = setInterval(() => {
        updateUnreadCount();
    }, 15000);
}

async function updateUnreadCount() {
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

        const badge = document.getElementById('chatUnreadBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.debug('Error updating unread count:', error);
    }
}

// IMPROVED: Setup event listeners with better error handling
function setupChatEventListeners() {
    const input = document.getElementById('chatMessageInput');
    if (!input) {
        console.error('Chat input not found!');
        return;
    }

    // Remove any existing listeners by cloning the node
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Get the fresh input reference
    const freshInput = document.getElementById('chatMessageInput');

    // Auto-resize textarea
    freshInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Send message on Enter (Shift+Enter for new line)
    freshInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    console.log('✅ Chat input listeners attached successfully');
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
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

function scrollToBottom() {
    const container = document.getElementById('chatMessagesContainer');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopChatPolling();
    if (unreadPollingInterval) {
        clearInterval(unreadPollingInterval);
    }
});

// Initialize chat when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChat);
} else {
    initializeChat();
}

// Export functions for global use
window.startChatWithSeller = startChatWithSeller;
window.toggleChatBox = toggleChatBox;
window.openChatRoom = openChatRoom;
window.backToChatList = backToChatList;
window.sendMessage = sendMessage;