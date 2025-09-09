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
                console.log('Timer button clicked:', e.target);
                // Extract timer ID from button ID (e.g., "timer-1-btn" -> 1)
                const buttonId = e.target.id || e.target.closest('button').id;
                const timerId = parseInt(buttonId.match(/timer-(\d+)-btn/)[1]);
                console.log('Extracted timer ID:', timerId);
                this.toggleTimer(timerId);
            });
        });

        // Config buttons
        document.querySelectorAll('[id^="config-timer-"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Config button clicked:', e.target);
                // Extract timer ID from button ID (e.g., "config-timer-1" -> 1)
                const buttonId = e.target.id || e.target.closest('button').id;
                const timerId = parseInt(buttonId.match(/config-timer-(\d+)/)[1]);
                console.log('Extracted config timer ID:', timerId);
                this.showConfigPanel(timerId);
            });
        });

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                console.log('Settings button clicked');
                this.showSettingsPanel();
            });
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
        
        // Create config panel if it doesn't exist
        let configPanel = document.getElementById('config-panel');
        if (!configPanel) {
            configPanel = document.createElement('div');
            configPanel.id = 'config-panel';
            configPanel.className = 'config-panel';
            configPanel.innerHTML = `
                <div class="config-panel-header">
                    <h3 id="config-panel-title">Configure Timer ${timerId}</h3>
                    <button id="close-config-panel" class="close-panel-btn">&times;</button>
                </div>
                <div class="config-panel-body">
                    <div class="config-row">
                        <label>Timer Name:</label>
                        <input type="text" id="timer-name-input" class="timer-name-input" placeholder="Enter timer name">
                    </div>
                    <div class="config-row">
                        <label>Color:</label>
                        <input type="color" id="color-select-current" value="#FF5722">
                    </div>
                    <div class="config-actions">
                        <button id="save-config" class="config-button save">Save</button>
                        <button id="cancel-config" class="config-button cancel">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(configPanel);
            
            // Add event listeners
            document.getElementById('close-config-panel').addEventListener('click', () => this.hideConfigPanel());
            document.getElementById('save-config').addEventListener('click', () => this.saveTimerConfig(timerId));
            document.getElementById('cancel-config').addEventListener('click', () => this.hideConfigPanel());
        }
        
        // Update panel for current timer
        document.getElementById('config-panel-title').textContent = `Configure Timer ${timerId}`;
        document.getElementById('timer-name-input').value = this.timers[timerId].name;
        document.getElementById('color-select-current').value = this.timers[timerId].color;
        
        // Show panel
        configPanel.classList.add('show');
    }

    hideConfigPanel() {
        const configPanel = document.getElementById('config-panel');
        if (configPanel) {
            configPanel.classList.remove('show');
        }
    }

    async saveTimerConfig(timerId) {
        try {
            const name = document.getElementById('timer-name-input').value;
            const color = document.getElementById('color-select-current').value;
            
            if (name.trim()) {
                this.timers[timerId].name = name.trim();
                this.timers[timerId].color = color;
                
                // Update UI
                document.getElementById(`timer-${timerId}-name`).textContent = name.trim();
                
                // Save data
                await this.saveData();
                
                console.log(`Timer ${timerId} configuration saved:`, { name: name.trim(), color });
                
                // Show success notification
                if (this.isElectron) {
                    window.electronAPI.showNotification('Configuration Saved', `Timer "${name.trim()}" updated successfully`);
                }
            }
            
            this.hideConfigPanel();
            
        } catch (error) {
            console.error('Save timer config error:', error);
        }
    }

    showSettingsPanel() {
        console.log('Show settings panel');
        
        // Create settings panel if it doesn't exist
        let settingsPanel = document.getElementById('settings-panel');
        if (!settingsPanel) {
            settingsPanel = document.createElement('div');
            settingsPanel.id = 'settings-panel';
            settingsPanel.className = 'config-panel';
            settingsPanel.innerHTML = `
                <div class="config-panel-header">
                    <h3>⚙️ Time Tracking Settings</h3>
                    <button id="close-settings" class="close-panel-btn">&times;</button>
                </div>
                <div class="config-panel-body">
                    <div class="config-row">
                        <label>Default Time Rounding:</label>
                        <select id="default-rounding" class="rounding-select">
                            <option value="0">No rounding (exact time)</option>
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="60">1 hour</option>
                        </select>
                    </div>
                    
                    <div class="config-row">
                        <label>Rounding Method:</label>
                        <select id="rounding-method" class="rounding-select">
                            <option value="round">Round to nearest</option>
                            <option value="up">Always round up</option>
                        </select>
                    </div>
                    
                    <div class="config-row">
                        <label>Notifications:</label>
                        <input type="checkbox" id="notify-timer-start"> Timer start notifications
                    </div>
                    
                    <div class="config-row">
                        <label></label>
                        <input type="checkbox" id="notify-timer-stop"> Timer stop notifications  
                    </div>
                    
                    <div class="config-row">
                        <label>FreeAgent Status:</label>
                        <span id="freeagent-status-text">Not connected</span>
                        <button id="connect-freeagent" class="config-button save" style="margin-left: 10px;">Connect FreeAgent</button>
                    </div>
                    
                    <div class="config-actions">
                        <button id="save-settings" class="config-button save">Save Settings</button>
                        <button id="cancel-settings" class="config-button cancel">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(settingsPanel);
            
            // Add event listeners
            document.getElementById('close-settings').addEventListener('click', () => this.hideSettingsPanel());
            document.getElementById('save-settings').addEventListener('click', () => this.saveSettingsConfig());
            document.getElementById('cancel-settings').addEventListener('click', () => this.hideSettingsPanel());
            document.getElementById('connect-freeagent').addEventListener('click', () => this.connectFreeAgent());
        }
        
        // Update panel with current settings
        document.getElementById('default-rounding').value = this.settings.defaultRounding || 30;
        document.getElementById('rounding-method').value = this.settings.roundingMethod || 'round';
        document.getElementById('notify-timer-start').checked = this.settings.notifyTimerStart !== false;
        document.getElementById('notify-timer-stop').checked = this.settings.notifyTimerStop !== false;
        
        // Update FreeAgent status
        const statusText = document.getElementById('freeagent-status-text');
        const connectBtn = document.getElementById('connect-freeagent');
        if (this.freeagentAPI && this.freeagentAPI.isConnected()) {
            statusText.textContent = '✅ Connected to FreeAgent';
            statusText.style.color = '#4CAF50';
            connectBtn.textContent = 'Disconnect';
        } else {
            statusText.textContent = '❌ Not connected to FreeAgent';
            statusText.style.color = '#f44336';
            connectBtn.textContent = 'Connect FreeAgent';
        }
        
        // Show panel
        settingsPanel.classList.add('show');
    }

    hideSettingsPanel() {
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
            settingsPanel.classList.remove('show');
        }
    }

    async saveSettingsConfig() {
        try {
            this.settings.defaultRounding = parseInt(document.getElementById('default-rounding').value);
            this.settings.roundingMethod = document.getElementById('rounding-method').value;
            this.settings.notifyTimerStart = document.getElementById('notify-timer-start').checked;
            this.settings.notifyTimerStop = document.getElementById('notify-timer-stop').checked;
            
            await this.saveSettings();
            
            console.log('Settings saved:', this.settings);
            
            // Show success notification
            if (this.isElectron) {
                window.electronAPI.showNotification('Settings Saved', 'Your preferences have been updated');
            }
            
            this.hideSettingsPanel();
            
        } catch (error) {
            console.error('Save settings error:', error);
        }
    }

    async connectFreeAgent() {
        try {
            console.log('Connecting to FreeAgent...');
            
            if (this.freeagentAPI && this.freeagentAPI.isConnected()) {
                // Disconnect
                this.freeagentAPI.disconnect();
                console.log('Disconnected from FreeAgent');
                
                if (this.isElectron) {
                    window.electronAPI.showNotification('FreeAgent Disconnected', 'You have been disconnected from FreeAgent');
                }
            } else {
                // Connect
                const success = await this.freeagentAPI.authenticate();
                
                if (success) {
                    console.log('✅ Connected to FreeAgent successfully');
                    
                    if (this.isElectron) {
                        window.electronAPI.showNotification('FreeAgent Connected', 'Successfully connected to FreeAgent');
                    }
                } else {
                    console.log('❌ Failed to connect to FreeAgent');
                    
                    if (this.isElectron) {
                        window.electronAPI.showNotification('Connection Failed', 'Could not connect to FreeAgent. Check your credentials.');
                    }
                }
            }
            
            // Update status display
            this.updateSyncStatus();
            
            // Update settings panel if open
            const settingsPanel = document.getElementById('settings-panel');
            if (settingsPanel && settingsPanel.classList.contains('show')) {
                this.showSettingsPanel(); // Refresh the panel
            }
            
        } catch (error) {
            console.error('FreeAgent connection error:', error);
            
            if (this.isElectron) {
                window.electronAPI.showNotification('Connection Error', error.message);
            }
        }
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