// ============================================
// SECURE WEBHOOK CONFIGURATION
// ============================================

// Webhook configuration - credentials never stored in source code
// User is prompted on first use and can optionally save to localStorage
// Webhook configuration - credentials never stored in source code
// User is prompted on first use or can configure in Settings
const DEFAULT_WEBHOOK_URL = 'http://localhost:5678/webhook/9b948cf7-c369-49ac-a33a-86dad6645177/chat';

const WEBHOOK_BASE_CONFIG = {
    // URL is now dynamic via getWebhookUrl()
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000
};

function getWebhookUrl() {
    return localStorage.getItem('webhook_url') || DEFAULT_WEBHOOK_URL;
}

// In-memory storage for current session credentials (cleared on page reload unless saved)
let sessionCredentials = null;

// Check if credentials are configured
function hasCredentials() {
    return !!sessionCredentials || !!localStorage.getItem('webhook_credentials');
}

// Get stored credentials from localStorage (with basic obfuscation)
function getStoredCredentials() {
    const encrypted = localStorage.getItem('webhook_credentials');
    if (!encrypted) return null;
    try {
        const decoded = atob(encrypted);
        return JSON.parse(decoded);
    } catch (e) {
        console.error('Failed to decode stored credentials');
        clearStoredCredentials();
        return null;
    }
}

// Store credentials in localStorage (with basic obfuscation)
function storeCredentials(username, password) {
    const credentials = JSON.stringify({ username, password });
    const encoded = btoa(credentials);
    localStorage.setItem('webhook_credentials', encoded);
}

// Clear stored credentials from localStorage
function clearStoredCredentials() {
    localStorage.removeItem('webhook_credentials');
}

// Clear all credentials (memory and storage)
function clearAllCredentials() {
    sessionCredentials = null;
    clearStoredCredentials();
}

// Prompt user for credentials via modal
function promptForCredentials() {
    return new Promise((resolve) => {
        const storedCreds = getStoredCredentials();

        modalTitle.textContent = 'Webhook Authentication Required';
        modalBody.innerHTML = `
            <p style="margin-bottom: 16px;">Enter your webhook credentials to continue:</p>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500;">Username / Email:</label>
                <input type="text" id="credUsername" value="${storedCreds?.username || ''}" 
                    style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);"
                    placeholder="Enter your username">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500;">Password:</label>
                <input type="password" id="credPassword" value="${storedCreds?.password || ''}"
                    style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);"
                    placeholder="Enter your password">
            </div>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="rememberCreds" checked>
                <span>Remember credentials for this browser</span>
            </label>
        `;
        modalConfirm.textContent = 'Connect';
        modalCancel.textContent = 'Cancel';
        modalOverlay.classList.add('active');

        // Focus on username field
        setTimeout(() => document.getElementById('credUsername')?.focus(), 100);

        const handleConfirm = () => {
            const username = document.getElementById('credUsername').value.trim();
            const password = document.getElementById('credPassword').value;
            const remember = document.getElementById('rememberCreds').checked;

            if (username && password) {
                // Store in session
                sessionCredentials = { username, password };

                // Optionally store in localStorage
                if (remember) {
                    storeCredentials(username, password);
                } else {
                    clearStoredCredentials();
                }

                modalOverlay.classList.remove('active');
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                resolve({ username, password });
            } else {
                showToast('Please enter both username and password', 'error');
            }
        };

        const handleCancel = () => {
            modalOverlay.classList.remove('active');
            modalConfirm.removeEventListener('click', handleConfirm);
            modalCancel.removeEventListener('click', handleCancel);
            resolve(null);
        };

        modalConfirm.addEventListener('click', handleConfirm);
        modalCancel.addEventListener('click', handleCancel);
    });
}

// Get or prompt for credentials
async function getCredentials() {
    // First check session
    if (sessionCredentials) {
        return sessionCredentials;
    }

    // Then check localStorage
    const stored = getStoredCredentials();
    if (stored) {
        sessionCredentials = stored;
        return stored;
    }

    // Prompt user
    return await promptForCredentials();
}

// Create Basic Auth header
async function createBasicAuthHeader() {
    const credentials = await getCredentials();

    if (!credentials) {
        throw new Error('Authentication required');
    }

    const authString = credentials.username + ':' + credentials.password;
    return 'Basic ' + btoa(authString);
}

let currentConversationId = null;
let sessionId = generateId('session');
let isProcessing = false;
let activeDropdown = null;

// Conversation logs storage
let conversationLogs = [];

// Load persisted logs from localStorage
function loadConversationLogs() {
    try {
        const saved = localStorage.getItem('conversation_logs');
        if (saved) {
            conversationLogs = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load conversation logs:', e);
        conversationLogs = [];
    }
}

// Save logs to localStorage
function saveConversationLogs() {
    try {
        // Keep only last 500 entries to prevent storage bloat
        if (conversationLogs.length > 500) {
            conversationLogs = conversationLogs.slice(-500);
        }
        localStorage.setItem('conversation_logs', JSON.stringify(conversationLogs));
    } catch (e) {
        console.error('Failed to save conversation logs:', e);
    }
}

// Add a log entry
function addLogEntry(entry) {
    const logEntry = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        sessionId: sessionId,
        conversationId: currentConversationId,
        ...entry
    };
    conversationLogs.push(logEntry);
    saveConversationLogs();
    updateLogsPanel();
    return logEntry;
}

// Update logs panel
function updateLogsPanel() {
    const logsContent = document.getElementById('logsContent');
    if (!logsContent) return;

    const recentLogs = conversationLogs.slice(-50).reverse();

    if (recentLogs.length === 0) {
        logsContent.innerHTML = `
            <div class="logs-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <p>No logs yet. Start a conversation to see API logs.</p>
            </div>
        `;
        return;
    }

    logsContent.innerHTML = recentLogs.map(log => `
        <div class="log-entry ${log.type || 'info'}">
            <div class="log-header">
                <span class="log-type ${log.type || 'request'}">${log.type || 'REQUEST'}</span>
                <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="log-body">
                ${log.userMessage ? `<div class="log-message"><strong>User:</strong> ${truncateText(log.userMessage, 100)}</div>` : ''}
                ${log.assistantMessage ? `<div class="log-message"><strong>Assistant:</strong> ${truncateText(log.assistantMessage, 100)}</div>` : ''}
                ${log.model ? `<div class="log-model">Model: ${log.model}</div>` : ''}
                ${log.error ? `<div class="log-error">Error: ${log.error}</div>` : ''}
                ${log.duration ? `<div class="log-duration">Duration: ${log.duration}ms</div>` : ''}
            </div>
        </div>
    `).join('');
}

// Truncate text for log display
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Toggle logs panel
function toggleLogsPanel() {
    const logsPanel = document.getElementById('logsPanel');
    if (logsPanel) {
        logsPanel.classList.toggle('open');
    }
}

// Clear all logs
function clearLogs() {
    conversationLogs = [];
    localStorage.removeItem('conversation_logs');
    updateLogsPanel();
    showToast('Logs cleared', 'success');
}

// Export logs as human-readable text
function exportLogs() {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const exportDate = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    let output = '';
    output += '════════════════════════════════════════════════════════════════\n';
    output += '                    CHAT CONVERSATION LOGS                     \n';
    output += '════════════════════════════════════════════════════════════════\n';
    output += `  Exported: ${exportDate}\n`;
    output += `  Total Entries: ${conversationLogs.length}\n`;
    output += '════════════════════════════════════════════════════════════════\n\n';

    conversationLogs.forEach((log, index) => {
        const logDate = new Date(log.timestamp);
        const time = `${pad(logDate.getMonth() + 1)}/${pad(logDate.getDate())}/${logDate.getFullYear()} ${pad(logDate.getHours())}:${pad(logDate.getMinutes())}:${pad(logDate.getSeconds())}`;
        const status = (log.type || 'info').toUpperCase();

        output += `────────────────────────────────────────────────────────────────\n`;
        output += `  #${index + 1}  |  ${status}  |  ${time}\n`;
        output += `────────────────────────────────────────────────────────────────\n`;

        if (log.sessionId) {
            output += `  Session:        ${log.sessionId}\n`;
        }
        if (log.conversationId) {
            output += `  Conversation:   ${log.conversationId}\n`;
        }
        if (log.model) {
            output += `  Model:          ${log.model}\n`;
        }
        if (log.duration) {
            output += `  Duration:       ${log.duration}ms\n`;
        }
        if (log.attempt) {
            output += `  Attempt:        ${log.attempt}\n`;
        }

        if (log.userMessage) {
            output += `\n  [USER]\n`;
            output += `  ${log.userMessage.split('\n').join('\n  ')}\n`;
        }

        if (log.assistantMessage) {
            output += `\n  [ASSISTANT]\n`;
            output += `  ${log.assistantMessage.split('\n').join('\n  ')}\n`;
        }

        if (log.error) {
            output += `\n  [ERROR]\n`;
            output += `  ${log.error}\n`;
        }

        output += '\n';
    });

    output += '════════════════════════════════════════════════════════════════\n';
    output += '                        END OF LOGS                            \n';
    output += '════════════════════════════════════════════════════════════════\n';

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChatLogs_${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${now.getFullYear()}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Logs exported', 'success');
}

// Initialize logs on page load
loadConversationLogs();

// Close dropdown when clicking outside
const closeActiveDropdown = (e) => {
    if (activeDropdown && !e.target.closest('.conversation-actions')) {
        activeDropdown.classList.remove('active');
        setTimeout(() => {
            if (activeDropdown) activeDropdown.remove();
            activeDropdown = null;
        }, 150);
    }
};

document.addEventListener('click', closeActiveDropdown);
document.addEventListener('touchstart', closeActiveDropdown, { passive: true });

function toggleDropdown(e, menu) {
    e.stopPropagation();

    // If clicking the same dropdown, close it
    if (activeDropdown === menu) {
        menu.classList.remove('active');
        setTimeout(() => {
            menu.remove();
            activeDropdown = null;
        }, 150);
        return;
    }

    // Close any other open dropdown
    if (activeDropdown) {
        activeDropdown.remove();
    }

    document.body.appendChild(menu);
    activeDropdown = menu;

    const rect = e.currentTarget.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    // Position dropdown
    let top = rect.bottom + 5;
    let left = rect.right - menuRect.width;

    // Check if it goes off screen (Mobile optimization)
    if (left < 10) left = 10;
    if (left + menuRect.width > window.innerWidth - 10) {
        left = window.innerWidth - menuRect.width - 10;
    }

    if (top + menuRect.height > window.innerHeight - 10) {
        top = rect.top - menuRect.height - 5;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    // Trigger animation
    requestAnimationFrame(() => {
        menu.classList.add('active');
    });
}

const sidebar = document.getElementById('sidebar');
const sidebarContent = document.getElementById('sidebarContent');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarToggle = document.getElementById('sidebarToggle');
const appMain = document.getElementById('appMain');
const newChatBtn = document.getElementById('newChatBtn');
const deleteAllChatsBtn = document.getElementById('deleteAllChatsBtn');
const deleteCurrentChatBtn = document.getElementById('deleteCurrentChatBtn');
const chatFeed = document.getElementById('chatFeed');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const settingsBtn = document.getElementById('settingsBtn');
const themeToggle = document.getElementById('themeToggle');
const globalMenuBtn = document.getElementById('globalMenuBtn');
const scrollToBottomBtn = document.getElementById('scrollToBottom');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const settingsModalOverlay = document.getElementById('settingsModalOverlay');
const settingsSave = document.getElementById('settingsSave');
const settingsCancel = document.getElementById('settingsCancel');
const configUsername = document.getElementById('configUsername');
const configPassword = document.getElementById('configPassword');
const toastContainer = document.getElementById('toastContainer');
const logsToggleBtn = document.getElementById('logsToggleBtn');
const logsPanel = document.getElementById('logsPanel');
const logsContent = document.getElementById('logsContent');

function generateId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function initializeApp() {
    initTheme();
    populateSidebar();
    startNewChat();
    messageInput.focus();

    // Initialize sidebar state based on screen size
    initializeSidebarState();

    // Add resize listener for responsive sidebar
    window.addEventListener('resize', handleResize);

    // Add touch event handling for mobile
    initializeTouchHandling();
}

function initializeSidebarState() {
    const isMobile = window.innerWidth <= 768;
    const savedState = localStorage.getItem('sidebarOpen');

    if (isMobile) {
        // On mobile, sidebar starts collapsed
        sidebar.classList.add('collapsed');
        appMain.classList.add('sidebar-closed');
        sidebarBackdrop.classList.remove('active');
    } else {
        // On desktop, respect saved state or default to open
        const sidebarOpen = savedState !== 'false';
        if (!sidebarOpen) {
            sidebar.classList.add('collapsed');
            appMain.classList.add('sidebar-closed');
        } else {
            sidebar.classList.remove('collapsed');
            appMain.classList.remove('sidebar-closed');
        }
    }
}

function handleResize() {
    const isMobile = window.innerWidth <= 768;
    const wasMobile = sidebar.dataset.wasMobile === 'true';

    if (isMobile !== wasMobile) {
        // Transition between mobile and desktop
        initializeSidebarState();
    }

    sidebar.dataset.wasMobile = isMobile;
}

function initializeTouchHandling() {
    // Add swipe gesture for sidebar on mobile
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 100;
        const diff = touchEndX - touchStartX;
        const isMobile = window.innerWidth <= 768;

        if (!isMobile) return;

        // Swipe right from left edge opens sidebar
        if (diff > swipeThreshold && touchStartX < 50) {
            if (sidebar.classList.contains('collapsed')) {
                toggleSidebar();
            }
        }

        // Swipe left closes sidebar
        if (diff < -swipeThreshold && !sidebar.classList.contains('collapsed')) {
            closeSidebar();
        }
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const sunSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>`;
    const moonSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`;
    themeToggle.innerHTML = theme === 'dark' ? sunSVG : moonSVG;
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// UNIFIED SIDEBAR TOGGLE FOR ALL SCREENS
function toggleSidebar() {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    appMain.classList.toggle('sidebar-closed');
    sidebarBackdrop.classList.toggle('active', !isCollapsed);
    localStorage.setItem('sidebarOpen', !isCollapsed);
}

function closeSidebar() {
    sidebar.classList.add('collapsed');
    appMain.classList.add('sidebar-closed');
    sidebarBackdrop.classList.remove('active');
    localStorage.setItem('sidebarOpen', 'false');
}

function checkScrollPosition() {
    const threshold = 200;
    const distanceFromBottom = chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight;

    if (distanceFromBottom > threshold) {
        scrollToBottomBtn.classList.add('visible');
    } else {
        scrollToBottomBtn.classList.remove('visible');
    }
}
function scrollToBottomSmooth() {
    chatFeed.scrollTo({
        top: chatFeed.scrollHeight,
        behavior: 'smooth'
    });
}

// Optimized scroll to bottom with requestAnimationFrame
function scrollToBottom() {
    requestAnimationFrame(() => {
        chatFeed.scrollTop = chatFeed.scrollHeight;
    });
}

function formatDateTime(date = new Date()) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    return `${month}/${day}/${year}, ${time}`;
}

// ENHANCED: Support for bold, italic, tables, headings, and more markdown-like formatting
function formatMessageContent(text) {
    if (!text) return '';

    // Convert escaped newlines and HTML entities for newlines to actual newlines
    let processed = text.replace(/\\n/g, '\n')
        .replace(/&#10;/g, '\n')
        .replace(/&#xa;/g, '\n')
        .replace(/\r\n/g, '\n');

    // Escape HTML first
    let html = processed.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Support ***bold+italic***
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Support **bold**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Support *italic* or _italic_
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Support `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Support ```code blocks``` with copy button
    html = html.replace(/```(\w+)?([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'text';
        const uniqueId = 'code-' + Math.random().toString(36).substr(2, 9);
        // Escape code content for safe insertion
        const escapedCode = code.trim().replace(/</g, '<').replace(/>/g, '>');

        return `
            <div class="code-block-wrapper">
                <div class="code-block-header">
                    <span class="code-language">${language}</span>
                    <button class="btn-copy-code" onclick="copyCode(this, '${uniqueId}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857c0 1.124-.895 2.036-2 2.036H12c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z"/>
                        </svg>
                        <span>Copy</span>
                    </button>
                </div>
                <pre><code id="${uniqueId}" class="language-${language}">${escapedCode}</code></pre>
            </div>
        `;
    });

    // Support headings (# H1, ## H2, etc.)
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Support tables (| Header 1 | Header 2 |)
    html = parseMarkdownTables(html);

    // Support horizontal rules (---, ***, ___)
    html = html.replace(/^(---|\*\*|___)$/gm, '<hr>');

    // Support blockquotes (> text)
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Support [link text](url)
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Enhanced list parsing - group consecutive list items
    html = html.replace(/(?:^|\n)((?:(?:[\-\*]|\d+\.)\s+.*(?:\n|$))+)/gm, (match) => {
        const lines = match.trim().split('\n');
        let listHTML = '';
        let listType = null;
        let isOrdered = false;
        
        lines.forEach(line => {
            const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
            const unorderedMatch = line.match(/^[\-\*]\s+(.+)$/);
            
            if (orderedMatch) {
                if (listType !== 'ol') {
                    if (listHTML) listHTML += '</li>';
                    listHTML += '<ol>';
                    listType = 'ol';
                }
                listHTML += `<li>${orderedMatch[2]}</li>`;
            } else if (unorderedMatch) {
                if (listType !== 'ul') {
                    if (listHTML) listHTML += '</li>';
                    listHTML += '<ul>';
                    listType = 'ul';
                }
                listHTML += `<li>${unorderedMatch[1]}</li>`;
            }
        });
        
        if (listHTML) {
            if (listType === 'ol') {
                listHTML += '</ol>';
            } else if (listType === 'ul') {
                listHTML += '</ul>';
            }
            return '\n' + listHTML + '\n';
        }
        return match;
    });

    // Preserve paragraphs (double line breaks)
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(para => {
        para = para.trim();
        if (!para) return '';
        // Don't wrap certain block elements
        if (para.match(/^<(h[1-6]|pre|table|blockquote|hr|[ou]l)/)) return para;
        // Single line breaks become <br>
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
}

// Simple reliable table parsing
function parseMarkdownTables(html) {
    const lines = html.split('\n');
    let result = '';
    let inTable = false;
    let tableHTML = '';
    let headerProcessed = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if line looks like a table row (starts and ends with |, or contains multiple |)
        const pipeCount = (line.match(/\|/g) || []).length;
        const isTableRow = pipeCount >= 2;

        // Check if it's a separator row (contains only |, -, :, and spaces)
        const isSeparator = /^\|?[\s\-:|]+\|?$/.test(line) && line.includes('-');

        if (isTableRow && !isSeparator) {
            if (!inTable) {
                inTable = true;
                tableHTML = '<div class="table-scroll-wrapper"><table><thead><tr>';
                headerProcessed = false;
            }

            const cells = line.split('|').filter(cell => cell.trim() !== '');

            if (!headerProcessed) {
                // This is the header row
                cells.forEach(cell => {
                    tableHTML += `<th>${cell.trim()}</th>`;
                });
                tableHTML += '</tr></thead><tbody>';
                headerProcessed = true;
            } else {
                // This is a data row
                tableHTML += '<tr>';
                cells.forEach(cell => {
                    const trimmed = cell.trim();
                    const isNumeric = /^[\d,.$€£¥%]+$/.test(trimmed);
                    const className = isNumeric ? ' class="numeric"' : '';
                    tableHTML += `<td${className}>${trimmed}</td>`;
                });
                tableHTML += '</tr>';
            }
        } else if (isSeparator && inTable) {
            // Skip separator row, it's part of markdown table syntax
            continue;
        } else {
            // Not a table row
            if (inTable) {
                // Close the table
                tableHTML += '</tbody></table></div>';
                result += tableHTML;
                inTable = false;
                tableHTML = '';
                headerProcessed = false;
            }
            result += line + '\n';
        }
    }

    // Close any remaining open table
    if (inTable) {
        tableHTML += '</tbody></table></div>';
        result += tableHTML;
    }

    return result;
}

// Helper to add actions (Copy, Regenerate, Edit, Excel)
function addMessageActions(messageDiv, text, type) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';

    // Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.title = 'Copy message';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857c0 1.124-.895 2.036-2 2.036H12c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z"/></svg>`;
    copyBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            showToast('Message copied', 'success');
        });
    };
    actionsDiv.appendChild(copyBtn);

    if (type === 'assistant') {
        // Regenerate Button
        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-btn';
        regenBtn.title = 'Regenerate response';
        regenBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>`;
        regenBtn.onclick = (e) => {
            e.stopPropagation();
            // Find previous user message
            let prev = messageDiv.previousElementSibling;
            while (prev && !prev.classList.contains('message-user')) {
                prev = prev.previousElementSibling;
            }
            if (prev) {
                const prevText = prev.dataset.originalContent;
                messageInput.value = prevText;
                sendMessage();
            }
        };
        actionsDiv.appendChild(regenBtn);

        // Check for tables and add Export Excel button if present
        if (text.includes('|') || text.includes('<table>')) {
            setTimeout(() => {
                const table = messageDiv.querySelector('table');
                if (table) {
                    const excelBtn = document.createElement('button');
                    excelBtn.className = 'action-btn excel-export-btn';
                    excelBtn.title = 'Download as Excel';
                    excelBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> <span>Excel</span>`;
                    excelBtn.onclick = (e) => {
                        e.stopPropagation();
                        exportTableToExcel(table);
                    };
                    actionsDiv.appendChild(excelBtn);
                }
            }, 150);
        }
    } else {
        // Edit Button (User only)
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn';
        editBtn.title = 'Edit message';
        editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        editBtn.onclick = (e) => {
            e.stopPropagation();
            messageInput.value = text;
            messageInput.focus();
        };
        actionsDiv.appendChild(editBtn);
    }

    messageDiv.appendChild(actionsDiv);
}

// Professional Excel export with styled formatting
function exportTableToExcel(table) {
    try {
        if (typeof XLSX === 'undefined') {
            throw new Error('Excel library not loaded');
        }

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `QueryResults_${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${now.getFullYear()}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.xlsx`;

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        const range = XLSX.utils.decode_range(ws['!ref']);

        // Style definitions
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { fgColor: { rgb: "2F5496" } },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const cellBorder = {
            top: { style: "thin", color: { rgb: "D0D0D0" } },
            bottom: { style: "thin", color: { rgb: "D0D0D0" } },
            left: { style: "thin", color: { rgb: "D0D0D0" } },
            right: { style: "thin", color: { rgb: "D0D0D0" } }
        };

        const colWidths = [];

        // Process all columns
        for (let C = range.s.c; C <= range.e.c; ++C) {
            let maxWidth = 12;
            const headerAddr = XLSX.utils.encode_cell({ r: 0, c: C });

            // Style header row
            if (ws[headerAddr]) {
                ws[headerAddr].s = headerStyle;
                const headerLen = ws[headerAddr].v ? ws[headerAddr].v.toString().length : 0;
                maxWidth = Math.max(maxWidth, headerLen);
            }

            // Style data rows
            for (let R = 1; R <= range.e.r; ++R) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[addr];
                if (!cell) continue;

                const val = cell.v ? cell.v.toString() : '';
                maxWidth = Math.max(maxWidth, val.length);

                // Check if value is numeric for right-alignment and number formatting
                const isNumeric = !isNaN(parseFloat(val)) && isFinite(val);
                const evenRow = R % 2 === 0;

                cell.s = {
                    font: { name: "Arial", sz: 11 },
                    alignment: {
                        horizontal: isNumeric ? 'right' : 'center',
                        vertical: 'center'
                    },
                    fill: { fgColor: { rgb: evenRow ? "F2F7FC" : "FFFFFF" } },
                    border: cellBorder
                };

                // Format numbers with commas and decimals
                if (isNumeric) {
                    const numVal = parseFloat(val);
                    cell.v = numVal;
                    cell.t = 'n';
                    // If it looks like a price (has decimals or > 1), use price format
                    if (val.includes('.') || numVal > 100) {
                        cell.z = '#,##0.00';
                    } else {
                        cell.z = '#,##0';
                    }
                }
            }

            colWidths.push({ wch: Math.min(maxWidth + 4, 40) });
        }

        ws['!cols'] = colWidths;

        // Set row height for header
        ws['!rows'] = [{ hpt: 28 }];

        // Auto-filter on all columns
        ws['!autofilter'] = { ref: ws['!ref'] };

        XLSX.utils.book_append_sheet(wb, ws, "Query Results");
        XLSX.writeFile(wb, filename);

        showToast('Excel downloaded successfully', 'success');
    } catch (err) {
        console.error('Excel export failed:', err);
        showToast('Failed to export Excel: ' + err.message, 'error');
    }
}

// MODIFIED: Use helper function for actions
function addMessage(text, type = 'user', timestamp = null) {
    const welcomeScreen = chatFeed.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    // Store original raw text as data attribute for proper saving/loading
    messageDiv.dataset.originalContent = text;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (type === 'assistant') {
        contentDiv.innerHTML = formatMessageContent(text);
    } else {
        contentDiv.textContent = text;
    }

    bubbleDiv.appendChild(contentDiv);
    messageDiv.appendChild(bubbleDiv);

    // Add actions using helper
    addMessageActions(messageDiv, text, type);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = timestamp || formatDateTime();
    messageDiv.appendChild(timeDiv);

    // CLICK HANDLER: Toggle timestamp visibility
    messageDiv.addEventListener('click', function (e) {
        // Ignore if clicking actions
        if (e.target.closest('.action-btn') || e.target.closest('.btn-copy-code')) return;
        this.classList.toggle('show-time');
    });

    chatFeed.appendChild(messageDiv);
    saveCurrentConversation();
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message message-assistant';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatFeed.appendChild(typingDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function showToast(message, type = 'error', duration = 5000) {
    const icons = {
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
        </svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <path d="M22 4L12 14.01l-3-3"/>
        </svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type]}<span>${message}</span>`;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}


let currentAbortController = null;

async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || isProcessing) {
        return;
    }

    isProcessing = true;
    messageInput.disabled = true;

    // Toggle Buttons
    sendButton.style.display = 'none';
    const stopButton = document.getElementById('stopButton');
    stopButton.style.display = 'flex';

    // Setup Stop Handler
    stopButton.onclick = () => {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
            showToast('Generation stopped', 'error');
            resetInputState();
        }
    };

    addMessage(message, 'user');
    messageInput.value = '';
    showTypingIndicator();

    // Get or prompt for credentials
    let authHeader;
    try {
        authHeader = await createBasicAuthHeader();
    } catch (authError) {
        removeTypingIndicator();
        showToast('Authentication required to send messages', 'error');
        resetInputState();
        messageInput.focus();
        return;
    }

    let lastError = null;
    const requestStartTime = Date.now();

    // NOTE: This frontend assumes the n8n webhook handles the RAG logic.
    // To strictly enforce "no code generation" or "internet search", 
    // please configure your LLM's system prompt in the n8n workflow.
    // Example: "You are a RAG assistant. Answer only from the provided context. Do not generate code."

    for (let attempt = 0; attempt <= WEBHOOK_BASE_CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
            currentAbortController = new AbortController();
            const timeoutId = setTimeout(() => currentAbortController.abort(), WEBHOOK_BASE_CONFIG.TIMEOUT);

            const response = await fetch(getWebhookUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                },
                body: JSON.stringify({
                    action: 'sendMessage',
                    sessionId: sessionId,
                    chatInput: message,
                    conversationId: currentConversationId,
                    timestamp: new Date().toISOString()
                }),
                signal: currentAbortController.signal
            });

            clearTimeout(timeoutId);

            removeTypingIndicator();

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 401) {
                    clearAllCredentials();
                    throw new Error('Authentication failed. Your credentials have been cleared. Please try again.');
                }
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const requestDuration = Date.now() - requestStartTime;

            let assistantMessage;
            if (data.output) {
                assistantMessage = data.output;
            } else if (data.message) {
                assistantMessage = data.message;
            } else if (data.response) {
                assistantMessage = data.response;
            } else if (typeof data === 'string') {
                assistantMessage = data;
            } else {
                assistantMessage = 'I received your message but could not generate a response.';
            }

            if (typeof assistantMessage === 'string') {
                assistantMessage = assistantMessage.trim();
            }

            // Extract token usage from response
            // n8n should return this from Anthropic's API response
            const usage = data.usage || null;
            const model = data.model || null;

            // Update token stats if available
            if (usage) {
                updateTokenStats(usage);
            }

            // Log the API interaction
            addLogEntry({
                type: 'success',
                userMessage: message,
                assistantMessage: assistantMessage,
                model: model,
                duration: requestDuration,
                attempt: attempt + 1
            });

            // Display message
            await simulateStreaming(assistantMessage);
            break;

        } catch (error) {
            lastError = error;
            const requestDuration = Date.now() - requestStartTime;

            if (error.name === 'AbortError') {
                addLogEntry({
                    type: 'cancelled',
                    userMessage: message,
                    error: 'Request cancelled by user',
                    duration: requestDuration
                });
                removeTypingIndicator();
                resetInputState();
                return; // Stop explicitly
            }

            if (attempt < WEBHOOK_BASE_CONFIG.RETRY_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, WEBHOOK_BASE_CONFIG.RETRY_DELAY * (attempt + 1)));
                continue;
            }

            // Log the error
            addLogEntry({
                type: 'error',
                userMessage: message,
                error: error.message,
                duration: requestDuration,
                attempt: attempt + 1
            });

            removeTypingIndicator();

            let errorMessage = 'Failed to send message. ';
            if (error.message.includes('Authentication failed')) {
                errorMessage = '🔐 ' + error.message;
            } else if (!navigator.onLine) {
                errorMessage += 'No internet connection.';
            } else {
                errorMessage += error.message;
            }

            showToast(errorMessage, 'error');
        }
    }

    resetInputState();
    messageInput.focus();
}

function resetInputState() {
    isProcessing = false;
    messageInput.disabled = false;
    document.getElementById('sendButton').style.display = 'flex';
    document.getElementById('stopButton').style.display = 'none';
    currentAbortController = null;

    // Re-focus input
    setTimeout(() => messageInput.focus(), 100);
}

// Simulate typewriter effect - FASTER SPEED & ACTIONS
function simulateStreaming(text) {
    return new Promise(resolve => {
        const welcomeScreen = chatFeed.querySelector('.welcome-screen');
        if (welcomeScreen) welcomeScreen.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-assistant';
        messageDiv.dataset.originalContent = text;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        bubbleDiv.appendChild(contentDiv);
        messageDiv.appendChild(bubbleDiv);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatDateTime();
        messageDiv.appendChild(timeDiv);

        chatFeed.appendChild(messageDiv);
        scrollToBottom();

        // Define finishStreaming FIRST before any code that might call it
        function finishStreaming() {
            contentDiv.innerHTML = formatMessageContent(text);
            addMessageActions(messageDiv, text, 'assistant');
            saveCurrentConversation();
            resolve();
        }

        // OPTIMIZATION: If text is very long, skip streaming to prevent browser freeze
        const SKIP_STREAMING_THRESHOLD = 2000;
        if (text.length > SKIP_STREAMING_THRESHOLD) {
            console.log('Large response detected, skipping streaming for performance');
            finishStreaming();
            return;
        }

        const words = text.split(/(\s+)/);
        let currentText = '';
        let i = 0;
        let lastUpdate = 0;

        // SPEED UP: Process multiple words per tick
        const CHUNK_SIZE = 5;

        function typeWord() {
            try {
                if (i < words.length && isProcessing) {
                    for (let k = 0; k < CHUNK_SIZE && i < words.length; k++) {
                        currentText += words[i];
                        i++;
                    }

                    // Performance: Only update the DOM every 20ms or so during heavy streaming
                    const now = Date.now();
                    if (now - lastUpdate > 20 || i >= words.length) {
                        contentDiv.innerHTML = formatMessageContent(currentText);
                        scrollToBottom();
                        lastUpdate = now;
                    }

                    setTimeout(() => {
                        requestAnimationFrame(typeWord);
                    }, 10);
                } else {
                    finishStreaming();
                }
            } catch (err) {
                console.error('Streaming error:', err);
                finishStreaming();
            }
        }

        typeWord();
    });
}


function saveCurrentConversation() {
    const messages = [];
    const messageElements = chatFeed.querySelectorAll('.message');

    messageElements.forEach(msgEl => {
        const type = msgEl.classList.contains('message-user') ? 'user' : 'assistant';
        // Use original content stored in data attribute instead of DOM text to preserve formatting
        const content = msgEl.dataset.originalContent || '';
        const timestamp = msgEl.querySelector('.message-time')?.textContent || formatDateTime();

        if (content && !msgEl.querySelector('.typing-indicator')) {
            messages.push({ type, content, timestamp });
        }
    });

    if (messages.length === 0 || !currentConversationId) return;

    const conversations = getAllConversations();
    let conversation = conversations.find(c => c.id === currentConversationId);

    if (!conversation) {
        conversation = {
            id: currentConversationId,
            title: generateConversationTitle(messages),
            messages: messages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pinned: false,
            hidden: false
        };
        conversations.push(conversation);
    } else {
        conversation.messages = messages;
        conversation.updatedAt = new Date().toISOString();
        conversation.title = generateConversationTitle(messages);
    }

    localStorage.setItem('conversations', JSON.stringify(conversations));

    // Performance: Only update sidebar if we're not in the middle of a heavy operation
    // or use requestIdleCallback
    if (window.requestIdleCallback) {
        requestIdleCallback(() => populateSidebar());
    } else {
        setTimeout(populateSidebar, 100);
    }
}

function toTitleCase(str) {
    const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in', 'is', 'with'];
    return str.split(' ').map((word, index) => {
        const lowerWord = word.toLowerCase();
        if (index > 0 && minorWords.includes(lowerWord)) {
            return lowerWord;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

function generateConversationTitle(messages) {
    const firstUserMessage = messages.find(m => m.type === 'user');
    if (!firstUserMessage) return 'New Conversation';

    let title = firstUserMessage.content.trim();
    title = toTitleCase(title);
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
}

function getAllConversations() {
    const saved = localStorage.getItem('conversations');
    if (!saved) return [];

    try {
        return JSON.parse(saved);
    } catch (e) {
        console.error('Error parsing conversations:', e);
        return [];
    }
}

function loadConversation(conversationId) {
    const conversations = getAllConversations();
    const conversation = conversations.find(c => c.id === conversationId);

    if (!conversation) return;

    // Clear current chat
    chatFeed.innerHTML = '';

    // Set current conversation
    currentConversationId = conversationId;

    // Load messages
    conversation.messages.forEach(msg => {
        addMessage(msg.content, msg.type, msg.timestamp);
    });

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

function startNewChat() {
    // Safety: Reset session if it got corrupted
    if (!currentConversationId || typeof currentConversationId !== 'string') {
        currentConversationId = generateId('conv');
    }

    chatFeed.innerHTML = `
        <div class="welcome-screen">
            <div class="welcome-icon">💬</div>
            <h2>Welcome to Chat</h2>
            <p>Start a new conversation by typing a message below.</p>
        </div>
    `;
    currentConversationId = generateId('conv');
    sessionId = generateId('session');

    // Auto-minimize sidebar on mobile
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

function deleteConversation(conversationId) {
    let conversations = getAllConversations();
    conversations = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem('conversations', JSON.stringify(conversations));

    if (currentConversationId === conversationId) {
        startNewChat();
    }

    populateSidebar();
}

function togglePinConversation(conversationId) {
    const conversations = getAllConversations();
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
        conv.pinned = !conv.pinned;
        localStorage.setItem('conversations', JSON.stringify(conversations));
        populateSidebar();
    }
}

function toggleArchiveConversation(conversationId) {
    const conversations = getAllConversations();
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
        conv.archived = !conv.archived;
        localStorage.setItem('conversations', JSON.stringify(conversations));
        populateSidebar();
    }
}

function updateConversationTitle(conversationId, newTitle) {
    const conversations = getAllConversations();
    const conv = conversations.find(c => c.id === conversationId);
    if (conv && newTitle.trim()) {
        conv.title = toTitleCase(newTitle.trim());
        localStorage.setItem('conversations', JSON.stringify(conversations));
        populateSidebar();
    }
}

function deleteAllConversations() {
    localStorage.removeItem('conversations');
    populateSidebar();
    startNewChat();
}

function populateSidebar() {
    const conversations = getAllConversations();

    // Sort: pinned first, then by updatedAt
    conversations.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    sidebarContent.innerHTML = '';

    function createConversationItem(conv) {
        const item = document.createElement('div');
        item.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''} ${conv.pinned ? 'pinned' : ''} ${conv.archived ? 'archived' : ''}`;
        item.dataset.id = conv.id;

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'conversation-item-content';

        const title = document.createElement('div');
        title.className = 'conversation-title';
        title.textContent = conv.title;

        contentWrapper.appendChild(title);

        const time = document.createElement('div');
        time.className = 'conversation-time';
        time.textContent = formatDateTime(conv.updatedAt);
        contentWrapper.appendChild(time);

        // Actions container
        const actions = document.createElement('div');
        actions.className = 'conversation-actions';

        // 3-dot menu button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'conversation-menu-btn';
        menuBtn.title = 'More options';
        menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;

        menuBtn.onclick = (e) => {
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown-menu';

            const closeDropdown = () => {
                dropdown.classList.remove('active');
                setTimeout(() => {
                    if (dropdown.parentNode) dropdown.remove();
                    if (activeDropdown === dropdown) activeDropdown = null;
                }, 150);
            };

            // Pin/Unpin option
            const pinOpt = document.createElement('button');
            pinOpt.className = 'dropdown-item';
            pinOpt.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2M7 11v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8M12 6v5"/></svg>
                <span>${conv.pinned ? 'Unpin chat' : 'Pin chat'}</span>
            `;
            pinOpt.onclick = () => {
                togglePinConversation(conv.id);
                closeDropdown();
            };

            // Edit option
            const editOpt = document.createElement('button');
            editOpt.className = 'dropdown-item';
            editOpt.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>Edit Title</span>
            `;
            editOpt.onclick = () => {
                closeDropdown();
                // Timeout to allow dropdown to close before prompt blocks
                setTimeout(() => {
                    const newTitle = prompt('Enter new title:', conv.title);
                    if (newTitle !== null && newTitle.trim()) {
                        updateConversationTitle(conv.id, newTitle.trim());
                    }
                }, 100);
            };

            // Archive option
            const archiveOpt = document.createElement('button');
            archiveOpt.className = 'dropdown-item';
            archiveOpt.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
                <span>${conv.archived ? 'Unarchive chat' : 'Archive chat'}</span>
            `;
            archiveOpt.onclick = () => {
                toggleArchiveConversation(conv.id);
                closeDropdown();
            };

            // Delete option
            const deleteOpt = document.createElement('button');
            deleteOpt.className = 'dropdown-item delete-item';
            deleteOpt.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                <span>Delete Chat</span>
            `;
            deleteOpt.onclick = () => {
                closeDropdown();
                setTimeout(() => {
                    modalTitle.textContent = 'Delete Conversation';
                    modalBody.textContent = 'Are you sure you want to delete this conversation? This action cannot be undone.';
                    modalConfirm.textContent = 'Delete';
                    modalOverlay.classList.add('active');

                    modalConfirm.onclick = () => {
                        deleteConversation(conv.id);
                        modalOverlay.classList.remove('active');
                    };
                }, 100);
            };

            dropdown.appendChild(pinOpt);
            dropdown.appendChild(editOpt);
            dropdown.appendChild(archiveOpt);
            dropdown.appendChild(deleteOpt);

            toggleDropdown(e, dropdown);
        };

        actions.appendChild(menuBtn);

        item.appendChild(contentWrapper);
        item.appendChild(actions);

        // Click to load conversation
        item.onclick = (e) => {
            if (!e.target.closest('.conversation-actions') && !e.target.closest('.dropdown-menu')) {
                loadConversation(conv.id);
            }
        };

        return item;
    }

    const fragment = document.createDocumentFragment();

    // Show visible (non-archived) chats
    const visibleChats = conversations.filter(c => !c.archived);

    if (visibleChats.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'sidebar-empty';
        emptyState.innerHTML = '<p>No active conversations</p>';
        fragment.appendChild(emptyState);
    } else {
        visibleChats.forEach(conv => {
            fragment.appendChild(createConversationItem(conv));
        });
    }

    // Archived section
    const archivedChats = conversations.filter(c => c.archived);
    if (archivedChats.length > 0) {
        const archHeader = document.createElement('div');
        archHeader.className = 'sidebar-section-header';
        archHeader.innerHTML = `<span>Archived (${archivedChats.length})</span>`;
        fragment.appendChild(archHeader);

        archivedChats.forEach(conv => {
            fragment.appendChild(createConversationItem(conv));
        });
    }

    sidebarContent.appendChild(fragment);
}

// Event listeners
newChatBtn.addEventListener('click', startNewChat);

deleteAllChatsBtn.addEventListener('click', () => {
    modalTitle.textContent = 'Delete All Conversations';
    modalBody.textContent = 'Are you sure you want to delete all conversations? This action cannot be undone.';
    modalConfirm.textContent = 'Delete All';
    modalOverlay.classList.add('active');

    modalConfirm.onclick = () => {
        deleteAllConversations();
        modalOverlay.classList.remove('active');
    };
});

deleteCurrentChatBtn.addEventListener('click', () => {
    if (!currentConversationId) return;

    modalTitle.textContent = 'Delete Conversation';
    modalBody.textContent = 'Are you sure you want to delete this conversation?';
    modalConfirm.textContent = 'Delete';
    modalOverlay.classList.add('active');

    modalConfirm.onclick = () => {
        deleteConversation(currentConversationId);
        modalOverlay.classList.remove('active');
    };
});

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

themeToggle.addEventListener('click', toggleTheme);

settingsBtn.addEventListener('click', () => {
    configWebhookUrl.value = getWebhookUrl();
    const creds = getStoredCredentials();
    if (creds) {
        configUsername.value = creds.username;
        configPassword.value = creds.password;
    }
    settingsModalOverlay.classList.add('active');
});

settingsCancel.addEventListener('click', () => {
    settingsModalOverlay.classList.remove('active');
});

settingsSave.addEventListener('click', () => {
    const url = configWebhookUrl.value.trim();
    if (url) {
        localStorage.setItem('webhook_url', url);
    }

    const username = configUsername.value.trim();
    const password = configPassword.value;

    if (username || password) {
        storeCredentials(username, password);
        sessionCredentials = { username, password };
    } else if (username === '' && password === '') {
        // If explicitly cleared, maybe we should clear credentials?
        // For now, let's assuming saving empty fields means clear auth
        clearAllCredentials();
    }

    settingsModalOverlay.classList.remove('active');
    showToast('Configuration saved', 'success');
});

sidebarToggle.addEventListener('click', toggleSidebar);

sidebarBackdrop.addEventListener('click', closeSidebar);

scrollToBottomBtn.addEventListener('click', scrollToBottomSmooth);

chatFeed.addEventListener('scroll', checkScrollPosition);

modalCancel.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

logsToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLogsPanel();
});

globalMenuBtn.onclick = (e) => {
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';

    const closeDropdown = () => {
        dropdown.classList.remove('active');
        setTimeout(() => {
            if (dropdown.parentNode) dropdown.remove();
            if (activeDropdown === dropdown) activeDropdown = null;
        }, 150);
    };

    // Theme Toggle
    const themeOpt = document.createElement('button');
    themeOpt.className = 'dropdown-item';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeOpt.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isDark ? '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>' : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'}
        </svg>
        <span>${isDark ? 'Light Mode' : 'Dark Mode'}</span>
    `;
    themeOpt.onclick = () => {
        toggleTheme();
        closeDropdown();
    };

    // Configuration Settings
    const settingsOpt = document.createElement('button');
    settingsOpt.className = 'dropdown-item';
    settingsOpt.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
        </svg>
        <span>Configure API</span>
    `;
    settingsOpt.onclick = () => {
        closeDropdown();
        settingsBtn.click();
    };

    // Separator
    const hr = document.createElement('hr');

    // Delete Current Chat
    const deleteCurrentOpt = document.createElement('button');
    deleteCurrentOpt.className = 'dropdown-item delete-item';
    deleteCurrentOpt.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
        </svg>
        <span>Delete Chat</span>
    `;
    deleteCurrentOpt.onclick = () => {
        closeDropdown();
        deleteCurrentChatBtn.click();
    };

    // Delete All Chats
    const deleteAllOpt = document.createElement('button');
    deleteAllOpt.className = 'dropdown-item delete-item';
    deleteAllOpt.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
        </svg>
        <span>Clear All History</span>
    `;
    deleteAllOpt.onclick = () => {
        closeDropdown();
        deleteAllChatsBtn.click();
    };

    dropdown.appendChild(themeOpt);
    dropdown.appendChild(settingsOpt);
    dropdown.appendChild(hr);
    dropdown.appendChild(deleteCurrentOpt);
    dropdown.appendChild(deleteAllOpt);

    toggleDropdown(e, dropdown);
};

// Global error handling to prevent silent failures
window.onerror = function (message, source, lineno, colno, error) {
    console.error('System Error:', message, 'at', source, lineno, colno);
    if (message.toLowerCase().includes('script error')) {
        // External script error, ignore or handle specifically
    } else {
        showToast('A system error occurred. Please refresh.', 'error');
    }
    return false;
};

// Initialize app
initializeApp();