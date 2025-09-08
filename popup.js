// Popup functionality for FreeAgent Time Tracker
class TimeTracker {
    constructor() {
        this.timers = {};
        this.clients = {};
        this.activeTimers = new Set();
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.updateDisplay();
        this.startUpdateLoop();
        await this.checkSetupStatus();
    }

    async loadData() {
        try {
            const result = await chrome.storage.local.get([
                'timers', 'clients', 'activeTimers', 'freeagentConnected'
            ]);
            
            this.timers = result.timers || {
                1: { startTime: null, elapsed: 0, todayTotal: 0 },
                2: { startTime: null, elapsed: 0, todayTotal: 0 },
                3: { startTime: null, elapsed: 0, todayTotal: 0 }
            };
            
            this.clients = result.clients || {
                1: { name: 'Client 1', color: '#FF5722' },
                2: { name: 'Client 2', color: '#2196F3' },
                3: { name: 'Client 3', color: '#4CAF50' }
            };
            
            this.activeTimers = new Set(result.activeTimers || []);
            this.freeagentConnected = result.freeagentConnected || false;
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async saveData() {
        try {
            await chrome.storage.local.set({
                timers: this.timers,
                clients: this.clients,
                activeTimers: Array.from(this.activeTimers),
                freeagentConnected: this.freeagentConnected
            });
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    setupEventListeners() {
        // Timer buttons
        for (let i = 1; i <= 3; i++) {
            const btn = document.getElementById(`timer-${i}-btn`);
            btn.addEventListener('click', () => this.toggleTimer(i));
        }

        // Setup buttons
        document.getElementById('connect-btn')?.addEventListener('click', () => this.connectFreeAgent());
        document.getElementById('skip-setup')?.addEventListener('click', () => this.skipSetup());
        document.getElementById('setup-btn')?.addEventListener('click', () => this.showSetup());

        // Listen for background script messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'timerUpdate') {
                this.updateDisplay();
            }
        });
    }

    async checkSetupStatus() {
        const setupContainer = document.getElementById('setup-container');
        const mainContainer = document.getElementById('main-container');
        
        if (!this.freeagentConnected && !localStorage.getItem('setupSkipped')) {
            setupContainer.classList.remove('hidden');
            mainContainer.style.display = 'none';
        } else {
            setupContainer.classList.add('hidden');
            mainContainer.style.display = 'block';
        }

        // Update sync status
        this.updateSyncStatus();
    }

    async toggleTimer(timerId) {
        const timer = this.timers[timerId];
        
        if (this.activeTimers.has(timerId)) {
            // Stop timer
            this.stopTimer(timerId);
        } else {
            // Start timer
            this.startTimer(timerId);
        }
        
        await this.saveData();
        this.updateDisplay();
        
        // Notify background script with error handling
        try {
            chrome.runtime.sendMessage({
                type: 'timerToggled',
                timerId: timerId,
                active: this.activeTimers.has(timerId),
                timers: this.timers,
                activeTimers: Array.from(this.activeTimers)
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Background script not responding:', chrome.runtime.lastError);
                }
            });
        } catch (error) {
            console.log('Could not send message to background:', error);
        }
    }

    startTimer(timerId) {
        const now = Date.now();
        this.timers[timerId].startTime = now;
        this.activeTimers.add(timerId);
        
        console.log(`Started timer ${timerId} at ${new Date(now).toLocaleTimeString()}`);
    }

    stopTimer(timerId) {
        const timer = this.timers[timerId];
        if (timer.startTime) {
            const elapsed = Date.now() - timer.startTime;
            timer.elapsed += elapsed;
            timer.todayTotal += elapsed;
            timer.startTime = null;
        }
        this.activeTimers.delete(timerId);
        
        console.log(`Stopped timer ${timerId}, total elapsed: ${this.formatTime(timer.elapsed)}`);
    }

    updateDisplay() {
        const now = Date.now();
        
        for (let i = 1; i <= 3; i++) {
            const timer = this.timers[i];
            const tile = document.querySelector(`.timer-tile[data-timer="${i}"]`);
            const display = document.getElementById(`timer-${i}-display`);
            const btn = document.getElementById(`timer-${i}-btn`);
            const nameEl = document.getElementById(`client-${i}-name`);
            
            // Update client name
            nameEl.textContent = this.clients[i].name;
            
            // Calculate current time
            let currentTime = timer.elapsed;
            if (timer.startTime && this.activeTimers.has(i)) {
                currentTime += (now - timer.startTime);
            }
            
            // Update display
            display.textContent = this.formatTime(currentTime);
            
            // Update button and tile state
            if (this.activeTimers.has(i)) {
                btn.textContent = 'Stop';
                btn.classList.add('stop');
                tile.classList.add('active');
            } else {
                btn.textContent = 'Start';
                btn.classList.remove('stop');
                tile.classList.remove('active');
            }
        }
        
        // Update total time
        this.updateTotalTime();
        this.updateBadge();
    }

    updateTotalTime() {
        const now = Date.now();
        let totalToday = 0;
        
        for (let i = 1; i <= 3; i++) {
            const timer = this.timers[i];
            totalToday += timer.todayTotal;
            
            // Add current running time
            if (timer.startTime && this.activeTimers.has(i)) {
                totalToday += (now - timer.startTime);
            }
        }
        
        const hours = Math.floor(totalToday / (1000 * 60 * 60));
        const minutes = Math.floor((totalToday % (1000 * 60 * 60)) / (1000 * 60));
        
        document.getElementById('total-time').textContent = `${hours}h ${minutes}m`;
    }

    updateBadge() {
        const activeCount = this.activeTimers.size;
        try {
            chrome.runtime.sendMessage({
                type: 'updateBadge',
                count: activeCount
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Background might not be ready, set badge directly
                    chrome.action.setBadgeText({ text: activeCount > 0 ? activeCount.toString() : '' });
                    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
                }
            });
        } catch (error) {
            // If messaging fails, update badge directly from popup
            chrome.action.setBadgeText({ text: activeCount > 0 ? activeCount.toString() : '' });
            chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
        }
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    startUpdateLoop() {
        // Update display every second
        setInterval(() => {
            if (this.activeTimers.size > 0) {
                this.updateDisplay();
            }
        }, 1000);
    }

    async connectFreeAgent() {
        try {
            // Use the new FreeAgentAuth service
            const auth = new FreeAgentAuth();
            
            // Show loading state
            const connectBtn = document.getElementById('connect-btn');
            const originalText = connectBtn.textContent;
            connectBtn.textContent = 'Connecting...';
            connectBtn.disabled = true;
            
            // Authenticate using Chrome Identity API
            const tokens = await auth.authenticate();
            
            // Success! Update UI
            this.freeagentConnected = true;
            await this.saveData();
            
            // Fetch user data and projects
            await this.fetchFreeAgentData(auth);
            
            // Update UI to show we're connected
            await this.checkSetupStatus();
            
            // Show success message
            this.showNotification('Connected to FreeAgent successfully!');
            
        } catch (error) {
            console.error('Error connecting to FreeAgent:', error);
            
            // Reset button state
            const connectBtn = document.getElementById('connect-btn');
            connectBtn.textContent = 'Connect FreeAgent';
            connectBtn.disabled = false;
            
            // Show error to user
            this.showNotification('Failed to connect: ' + error.message, 'error');
        }
    }
    
    async fetchFreeAgentData(auth) {
        try {
            // Fetch user profile
            const userResponse = await auth.apiRequest('/users/me');
            if (userResponse.ok) {
                const userData = await userResponse.json();
                console.log('User data:', userData);
            }
            
            // Fetch projects
            const projectsResponse = await auth.apiRequest('/projects?view=active');
            if (projectsResponse.ok) {
                const projectsData = await projectsResponse.json();
                await chrome.storage.local.set({
                    freeagentProjects: projectsData.projects || []
                });
                console.log('Projects:', projectsData.projects);
            }
        } catch (error) {
            console.error('Error fetching FreeAgent data:', error);
        }
    }
    
    showNotification(message, type = 'success') {
        // Simple notification display (you can enhance this)
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            background: ${type === 'error' ? '#f44336' : '#4CAF50'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    skipSetup() {
        localStorage.setItem('setupSkipped', 'true');
        document.getElementById('setup-container').classList.add('hidden');
        document.getElementById('main-container').style.display = 'block';
    }

    showSetup() {
        document.getElementById('setup-container').classList.remove('hidden');
        document.getElementById('main-container').style.display = 'none';
    }

    updateSyncStatus() {
        const statusEl = document.getElementById('sync-status');
        
        if (this.freeagentConnected) {
            statusEl.textContent = 'Connected to FreeAgent ✅';
            statusEl.className = 'sync-status connected';
        } else {
            statusEl.textContent = 'Not connected to FreeAgent';
            statusEl.className = 'sync-status';
        }
    }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
    new TimeTracker();
});