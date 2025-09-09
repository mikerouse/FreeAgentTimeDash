// Desktop Time Tracker - Main application logic
class TimeTracker {
    constructor() {
        this.timers = {};
        this.activeTimers = new Set();
        this.freeagentAPI = null;
        this.settings = {};
        this.drafts = [];
        this.intervalId = null;
        this.isElectron = typeof window !== 'undefined' && window.electronAPI;
        
        this.init().catch(console.error);
    }

    async init() {
        console.log('TimeTracker initializing...');
        
        try {
            // Load settings
            await this.loadSettings();
            
            // Load timer data
            await this.loadData();
            
            // Initialize FreeAgent API
            this.freeagentAPI = new FreeAgentAPI();
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Setup Electron IPC listeners
            this.setupElectronListeners();
            
            // Start update interval
            this.startUpdateInterval();
            
            // Initialize display
            this.updateDisplay();
            this.updateSyncStatus();
            
            console.log('TimeTracker initialized successfully');
        } catch (error) {
            console.error('TimeTracker initialization failed:', error);
        }
    }

    async loadSettings() {
        const defaultSettings = {
            defaultRounding: 30,
            roundingMethod: 'round',
            notifyTimerStart: true,
            notifyTimerStop: true,
            autoSaveDrafts: true,
            maxDrafts: 10
        };

        this.settings = await window.storageAdapter.get('settings', defaultSettings);
        console.log('Settings loaded:', this.settings);
    }

    async saveSettings() {
        await window.storageAdapter.set('settings', this.settings);
        console.log('Settings saved');
    }

    async loadData() {
        const defaultData = {
            timers: {
                1: { name: 'Client 1', color: '#FF5722', project: null, contact: null, startTime: null, elapsed: 0 },
                2: { name: 'Client 2', color: '#2196F3', project: null, contact: null, startTime: null, elapsed: 0 },
                3: { name: 'Client 3', color: '#4CAF50', project: null, contact: null, startTime: null, elapsed: 0 }
            },
            drafts: []
        };

        const data = await window.storageAdapter.get('timeTrackingData', defaultData);
        this.timers = data.timers;
        this.drafts = data.drafts || [];
        
        // Restore active timers
        Object.keys(this.timers).forEach(timerId => {
            if (this.timers[timerId].startTime) {
                this.activeTimers.add(parseInt(timerId));
            }
        });

        console.log('Data loaded:', { timers: this.timers, activeDrafts: this.drafts.length });
    }

    async saveData() {
        const data = {
            timers: this.timers,
            drafts: this.drafts
        };
        await window.storageAdapter.set('timeTrackingData', data);
    }

    setupEventListeners() {
        // Timer buttons
        document.querySelectorAll('[id^="timer-"][id$="-btn"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timerId = parseInt(e.target.dataset.timer);
                this.toggleTimer(timerId);
            });
        });

        // Config buttons
        document.querySelectorAll('[id^="config-timer-"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timerId = parseInt(e.target.dataset.timer);
                this.showConfigPanel(timerId);
            });
        });

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettingsPanel());
        }
    }

    setupElectronListeners() {
        if (!this.isElectron) return;

        // Listen for main process commands
        window.electronAPI.onToggleTimer((event, timerId) => {
            this.toggleTimer(timerId);
        });

        window.electronAPI.onShowSettings(() => {
            this.showSettingsPanel();
        });

        window.electronAPI.onStopAllTimers(() => {
            this.stopAllTimers();
        });
    }

    startUpdateInterval() {
        this.intervalId = setInterval(() => {
            this.updateDisplay();
            this.updateTrayTooltip();
        }, 1000);
    }

    toggleTimer(timerId) {
        const timer = this.timers[timerId];
        if (!timer) return;

        if (this.activeTimers.has(timerId)) {
            this.stopTimer(timerId);
        } else {
            this.startTimer(timerId);
        }
    }

    startTimer(timerId) {
        const timer = this.timers[timerId];
        if (!timer) return;

        // Stop any other running timers first
        this.activeTimers.forEach(activeId => {
            if (activeId !== timerId) {
                this.stopTimer(activeId, false);
            }
        });

        // Start this timer
        timer.startTime = Date.now();
        this.activeTimers.add(timerId);

        // Update UI
        this.updateTimerButton(timerId, true);
        this.updateTimerCard(timerId, true);

        // Show notification
        if (this.settings.notifyTimerStart && this.isElectron) {
            window.electronAPI.timerStarted(timer.name);
        }

        // Save data
        this.saveData();

        console.log('Timer ' + timerId + ' (' + timer.name + ') started');
    }

    stopTimer(timerId, showTimeslipPanel = true) {
        const timer = this.timers[timerId];
        if (!timer || !this.activeTimers.has(timerId)) return;

        // Calculate elapsed time
        const now = Date.now();
        const sessionTime = now - timer.startTime;
        timer.elapsed += sessionTime;
        timer.startTime = null;
        
        this.activeTimers.delete(timerId);

        // Update UI
        this.updateTimerButton(timerId, false);
        this.updateTimerCard(timerId, false);

        // Calculate total time for display
        const totalSeconds = Math.floor(timer.elapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const timeString = hours.toString().padStart(2, '0') + ':' + 
                          minutes.toString().padStart(2, '0') + ':' + 
                          seconds.toString().padStart(2, '0');

        // Show notification
        if (this.settings.notifyTimerStop && this.isElectron) {
            window.electronAPI.timerStopped(timer.name, timeString);
        }

        // Reset timer elapsed for next session
        timer.elapsed = 0;

        // Save data
        this.saveData();

        console.log('Timer ' + timerId + ' (' + timer.name + ') stopped - ' + timeString);
    }

    stopAllTimers() {
        this.activeTimers.forEach(timerId => {
            this.stopTimer(timerId, false);
        });
    }

    updateDisplay() {
        // Update timer displays
        Object.keys(this.timers).forEach(timerId => {
            this.updateTimerDisplay(parseInt(timerId));
        });

        // Update total time
        this.updateTotalTime();
    }

    updateTimerDisplay(timerId) {
        const timer = this.timers[timerId];
        const displayElement = document.getElementById('timer-' + timerId + '-display');
        const nameElement = document.getElementById('timer-' + timerId + '-name');
        
        if (!timer || !displayElement) return;

        // Calculate current elapsed time
        let totalElapsed = timer.elapsed;
        if (this.activeTimers.has(timerId) && timer.startTime) {
            totalElapsed += Date.now() - timer.startTime;
        }

        // Format time
        const totalSeconds = Math.floor(totalElapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        displayElement.textContent = hours.toString().padStart(2, '0') + ':' +
                                   minutes.toString().padStart(2, '0') + ':' +
                                   seconds.toString().padStart(2, '0');

        // Update timer name
        if (nameElement) {
            nameElement.textContent = timer.name;
        }

        // Update project display
        const projectElement = document.getElementById('timer-' + timerId + '-project');
        if (projectElement) {
            projectElement.textContent = timer.project ? 'Project assigned' : 'No project assigned';
        }
    }

    updateTimerButton(timerId, isActive) {
        const button = document.getElementById('timer-' + timerId + '-btn');
        if (!button) return;

        const iconElement = button.querySelector('.btn-icon');
        const textElement = button.querySelector('.btn-text');

        if (isActive) {
            button.classList.add('stop');
            if (iconElement) iconElement.textContent = '⏹️';
            if (textElement) textElement.textContent = 'Stop';
        } else {
            button.classList.remove('stop');
            if (iconElement) iconElement.textContent = '▶️';
            if (textElement) textElement.textContent = 'Start';
        }
    }

    updateTimerCard(timerId, isActive) {
        const card = document.querySelector('[data-timer="' + timerId + '"]');
        if (!card) return;

        const statusElement = document.getElementById('timer-' + timerId + '-status');

        if (isActive) {
            card.classList.add('active');
            if (statusElement) statusElement.textContent = 'Running';
        } else {
            card.classList.remove('active');
            if (statusElement) statusElement.textContent = 'Ready';
        }
    }

    updateTotalTime() {
        const totalElement = document.getElementById('total-time');
        if (!totalElement) return;

        let totalElapsed = 0;
        Object.keys(this.timers).forEach(timerId => {
            const timer = this.timers[timerId];
            totalElapsed += timer.elapsed;
            if (this.activeTimers.has(parseInt(timerId)) && timer.startTime) {
                totalElapsed += Date.now() - timer.startTime;
            }
        });

        const totalHours = Math.floor(totalElapsed / 3600000);
        const totalMinutes = Math.floor((totalElapsed % 3600000) / 60000);

        totalElement.textContent = totalHours + 'h ' + totalMinutes + 'm';
    }

    updateTrayTooltip() {
        if (!this.isElectron) return;

        const activeTimerCount = this.activeTimers.size;
        if (activeTimerCount > 0) {
            const activeNames = Array.from(this.activeTimers).map(id => this.timers[id].name);
            window.electronAPI.updateTrayTooltip('Time Tracker - Running: ' + activeNames.join(', '));
        } else {
            window.electronAPI.updateTrayTooltip('FreeAgent Time Tracker - No active timers');
        }
    }

    updateSyncStatus() {
        const statusElement = document.getElementById('sync-status');
        if (!statusElement) return;

        const iconElement = statusElement.querySelector('.status-icon');
        const textElement = statusElement.querySelector('.status-text');

        if (this.freeagentAPI && this.freeagentAPI.isConnected()) {
            statusElement.classList.add('connected');
            statusElement.classList.remove('error');
            if (iconElement) iconElement.textContent = '🟢';
            if (textElement) textElement.textContent = 'Connected to FreeAgent';
        } else {
            statusElement.classList.remove('connected');
            statusElement.classList.add('error');
            if (iconElement) iconElement.textContent = '⚪';
            if (textElement) textElement.textContent = 'Not connected';
        }
    }

    showConfigPanel(timerId) {
        console.log('Show config panel for timer', timerId);
        // Implementation will be added in next phase
    }

    showSettingsPanel() {
        console.log('Show settings panel');
        // Implementation will be added in next phase
    }

    // Cleanup
    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        if (this.isElectron) {
            window.electronAPI.removeAllListeners('toggle-timer');
            window.electronAPI.removeAllListeners('show-settings');
            window.electronAPI.removeAllListeners('stop-all-timers');
        }
    }
}