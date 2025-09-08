// Import auth service
importScripts('auth.js');

// Background service worker for FreeAgent Time Tracker
class BackgroundTimeTracker {
    constructor() {
        this.timers = {};
        this.activeTimers = new Set();
        this.clients = {};
        this.freeagentTokens = null;
        this.lastIdleCheck = Date.now();
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.setupAlarms();
        this.setupIdleDetection();
        console.log('Background Time Tracker initialized');
    }

    async loadData() {
        try {
            const result = await chrome.storage.local.get([
                'timers', 'activeTimers', 'clients', 'freeagentTokens'
            ]);
            
            this.timers = result.timers || {
                1: { startTime: null, elapsed: 0, todayTotal: 0 },
                2: { startTime: null, elapsed: 0, todayTotal: 0 },
                3: { startTime: null, elapsed: 0, todayTotal: 0 }
            };
            
            this.activeTimers = new Set(result.activeTimers || []);
            this.clients = result.clients || {};
            this.freeagentTokens = result.freeagentTokens || null;
            
            // Resume active timers on startup
            this.resumeActiveTimers();
            
        } catch (error) {
            console.error('Error loading background data:', error);
        }
    }

    async saveData() {
        try {
            await chrome.storage.local.set({
                timers: this.timers,
                activeTimers: Array.from(this.activeTimers),
                clients: this.clients,
                freeagentTokens: this.freeagentTokens
            });
        } catch (error) {
            console.error('Error saving background data:', error);
        }
    }

    setupEventListeners() {
        // Listen for extension installation/startup
        chrome.runtime.onInstalled.addListener(() => {
            // Enable side panel on all websites
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        });
        
        // Action click handler - open side panel
        chrome.action.onClicked.addListener((tab) => {
            chrome.sidePanel.open({ tabId: tab.id });
        });

        // Listen for keyboard commands
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            // Return true to indicate we'll send a response asynchronously
            return true;
        });

        // Listen for keyboard shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });

        // Listen for extension startup
        chrome.runtime.onStartup.addListener(() => {
            console.log('Extension started, resuming timers...');
            this.resumeActiveTimers();
        });

        // Listen for extension installation
        chrome.runtime.onInstalled.addListener(() => {
            console.log('Extension installed/updated');
            this.createContextMenus();
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'timerToggled':
                    this.timers = message.timers;
                    this.activeTimers = new Set(message.activeTimers);
                    await this.saveData();
                    this.updateBadge();
                    sendResponse({ success: true });
                    break;
                    
                case 'updateBadge':
                    this.setBadge(message.count);
                    sendResponse({ success: true });
                    break;
                    
                case 'syncToFreeAgent':
                    await this.syncToFreeAgent(message.timerId, message.timeEntry);
                    sendResponse({ success: true });
                    break;
                    
                case 'getBackgroundState':
                    sendResponse({
                        timers: this.timers,
                        activeTimers: Array.from(this.activeTimers)
                    });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async handleCommand(command) {
        console.log('Command received:', command);
        
        switch (command) {
            case 'toggle-timer-1':
                await this.toggleTimer(1);
                break;
            case 'toggle-timer-2':
                await this.toggleTimer(2);
                break;
            case 'toggle-timer-3':
                await this.toggleTimer(3);
                break;
        }
    }

    async toggleTimer(timerId) {
        const timer = this.timers[timerId];
        
        if (this.activeTimers.has(timerId)) {
            // Stop timer
            if (timer.startTime) {
                const elapsed = Date.now() - timer.startTime;
                timer.elapsed += elapsed;
                timer.todayTotal += elapsed;
                timer.startTime = null;
            }
            this.activeTimers.delete(timerId);
            
            this.showNotification(`Timer ${timerId} stopped`, `Logged ${this.formatTime(timer.elapsed)} for ${this.clients[timerId]?.name || `Client ${timerId}`}`);
            
        } else {
            // Start timer
            timer.startTime = Date.now();
            this.activeTimers.add(timerId);
            
            this.showNotification(`Timer ${timerId} started`, `Now tracking time for ${this.clients[timerId]?.name || `Client ${timerId}`}`);
        }
        
        await this.saveData();
        this.updateBadge();
        
        // Notify popup if open
        chrome.runtime.sendMessage({ type: 'timerUpdate' }, (response) => {
            // If popup is not open, chrome.runtime.lastError will be set
            if (chrome.runtime.lastError) {
                // Popup not open, this is expected and can be ignored
            }
        });
    }

    resumeActiveTimers() {
        // Called on extension startup to resume any timers that were running
        for (const timerId of this.activeTimers) {
            const timer = this.timers[timerId];
            if (!timer.startTime) {
                // Timer was active but doesn't have a start time, probably due to restart
                timer.startTime = Date.now();
                console.log(`Resumed timer ${timerId}`);
            }
        }
        this.updateBadge();
    }

    updateBadge() {
        this.setBadge(this.activeTimers.size);
    }

    setBadge(count) {
        if (count > 0) {
            chrome.action.setBadgeText({ text: count.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    }

    setupAlarms() {
        // Create alarms for notifications
        chrome.alarms.create('nudgeReminder', { 
            delayInMinutes: 30, 
            periodInMinutes: 30 
        });
        
        chrome.alarms.create('dailySync', { 
            delayInMinutes: 60, 
            periodInMinutes: 60 
        });

        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });
    }

    async handleAlarm(alarm) {
        switch (alarm.name) {
            case 'nudgeReminder':
                await this.checkForNudgeReminder();
                break;
            case 'dailySync':
                await this.performDailySync();
                break;
        }
    }

    async checkForNudgeReminder() {
        const now = new Date();
        const hour = now.getHours();
        
        // Only nudge during work hours (9-6)
        if (hour < 9 || hour > 18) return;
        
        // Don't nudge if any timer is running
        if (this.activeTimers.size > 0) return;
        
        // Check if user has been idle for too long
        const idleState = await chrome.idle.queryState(300); // 5 minutes
        if (idleState === 'idle' || idleState === 'locked') return;
        
        this.showNotification(
            '⏰ Time Tracking Reminder',
            'Looks like you might be working. Start a timer?',
            true
        );
    }

    async performDailySync() {
        if (!this.freeagentTokens) return;
        
        // Sync any pending time entries to FreeAgent
        console.log('Performing daily sync to FreeAgent...');
        
        for (let timerId = 1; timerId <= 3; timerId++) {
            const timer = this.timers[timerId];
            if (timer.todayTotal > 0) {
                await this.syncToFreeAgent(timerId, {
                    hours: timer.todayTotal / (1000 * 60 * 60),
                    date: new Date().toISOString().split('T')[0]
                });
            }
        }
    }

    setupIdleDetection() {
        // Check for idle state every minute
        setInterval(async () => {
            const idleState = await chrome.idle.queryState(300); // 5 minutes idle threshold
            
            if (idleState === 'idle' && this.activeTimers.size > 0) {
                this.showNotification(
                    '😴 Idle Detection',
                    'You seem idle. Should I pause your timers?',
                    true
                );
            }
        }, 60000); // Check every minute
    }

    showNotification(title, message, requireInteraction = false) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: title,
            message: message,
            requireInteraction: requireInteraction,
            buttons: requireInteraction ? [
                { title: 'Yes' },
                { title: 'No' }
            ] : undefined
        });
    }

    createContextMenus() {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'openTracker',
                title: 'Open Time Tracker',
                contexts: ['action']
            });
            
            for (let i = 1; i <= 3; i++) {
                chrome.contextMenus.create({
                    id: `toggle-timer-${i}`,
                    title: `Toggle Timer ${i}`,
                    contexts: ['action']
                });
            }
        });

        chrome.contextMenus.onClicked.addListener((info) => {
            if (info.menuItemId.startsWith('toggle-timer-')) {
                const timerId = parseInt(info.menuItemId.split('-')[2]);
                this.toggleTimer(timerId);
            }
        });
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // FreeAgent API integration
    async syncToFreeAgent(timerId, timeEntry) {
        try {
            // Import and use the auth service
            const auth = new FreeAgentAuth();
            
            // Check if we're authenticated
            const tokens = await auth.getTokens();
            if (!tokens) {
                console.log('Not authenticated with FreeAgent');
                return;
            }

            // Make authenticated API request
            const response = await auth.apiRequest('/timeslips', {
                method: 'POST',
                body: JSON.stringify({
                    timeslip: {
                        dated_on: timeEntry.date,
                        hours: timeEntry.hours,
                        comment: `Auto-tracked time via Timer ${timerId}`,
                        // You'll need to map these to actual FreeAgent project/user IDs
                        project: this.clients[timerId]?.freeagentProjectId,
                        user: this.clients[timerId]?.freeagentUserId
                    }
                })
            });

            if (response.ok) {
                console.log(`Successfully synced timer ${timerId} to FreeAgent`);
                this.showNotification('✅ Sync Complete', `Timer ${timerId} synced to FreeAgent`);
            } else {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
        } catch (error) {
            console.error('FreeAgent sync error:', error);
            this.showNotification('❌ Sync Failed', `Failed to sync Timer ${timerId} to FreeAgent`);
        }
    }
}

// Initialize background tracker
const backgroundTracker = new BackgroundTimeTracker();