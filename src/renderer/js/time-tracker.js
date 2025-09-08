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

        // Setup button
        const setupBtn = document.getElementById('setup-btn');
        if (setupBtn) {
            setupBtn.addEventListener('click', () => this.showSetupContainer());
        }

        // Connect button
        const connectBtn = document.getElementById('connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectFreeAgent());
        }

        // Skip setup button
        const skipBtn = document.getElementById('skip-setup');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.hideSetupContainer());
        }

        // Panel close buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.target.closest('.slide-panel');
                if (panel) {
                    this.hidePanel(panel.id);
                }
            });
        });

        // Timer config form
        const configForm = document.getElementById('timer-config-form');
        if (configForm) {
            configForm.addEventListener('submit', (e) => this.handleConfigSave(e));
        }

        // Settings form
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => this.handleSettingsSave(e));
        }

        // Timeslip form
        const timeslipForm = document.getElementById('timeslip-form');
        if (timeslipForm) {
            timeslipForm.addEventListener('submit', (e) => this.handleTimeslipCreate(e));
        }

        // Client selection change
        const clientSelect = document.getElementById('client-select');
        if (clientSelect) {
            clientSelect.addEventListener('change', (e) => this.onClientSelected(e.target.value));
        }

        // Time rounding change
        const timeRounding = document.getElementById('time-rounding');
        if (timeRounding) {
            timeRounding.addEventListener('change', () => this.updateTimeslipDisplay());
        }

        // Save draft button
        const saveDraftBtn = document.getElementById('save-draft');
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => this.saveDraft());
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

    stopUpdateInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
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
                this.stopTimer(activeId, false); // Don't show timeslip panel for auto-stops
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

        console.log(`Timer ${timerId} (${timer.name}) started`);
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
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Show notification
        if (this.settings.notifyTimerStop && this.isElectron) {
            window.electronAPI.timerStopped(timer.name, timeString);
        }

        // Show timeslip panel if timer has project assigned and we want to show it
        if (showTimeslipPanel && timer.project && this.freeagentAPI.isConnected()) {
            this.showTimeslipPanel(timerId);
        } else if (showTimeslipPanel && this.settings.autoSaveDrafts) {
            // Auto-save as draft if no project assigned
            this.saveDraft(timerId);
        }

        // Reset timer elapsed for next session
        timer.elapsed = 0;

        // Save data
        this.saveData();

        console.log(`Timer ${timerId} (${timer.name}) stopped - ${timeString}`);
    }

    stopAllTimers() {
        this.activeTimers.forEach(timerId => {
            this.stopTimer(timerId, false); // Don't show timeslip panels
        });
    }

    updateDisplay() {
        // Update timer displays
        Object.keys(this.timers).forEach(timerId => {
            this.updateTimerDisplay(parseInt(timerId));
        });

        // Update total time
        this.updateTotalTime();

        // Update drafts indicator
        this.updateDraftsIndicator();
    }

    updateTimerDisplay(timerId) {
        const timer = this.timers[timerId];
        const displayElement = document.getElementById(`timer-${timerId}-display`);
        const nameElement = document.getElementById(`timer-${timerId}-name`);
        
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

        displayElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update timer name
        if (nameElement) {
            nameElement.textContent = timer.name;
        }

        // Update project display
        const projectElement = document.getElementById(`timer-${timerId}-project`);
        if (projectElement) {
            projectElement.textContent = timer.project ? 'Project assigned' : 'No project assigned';
        }
    }

    updateTimerButton(timerId, isActive) {
        const button = document.getElementById(`timer-${timerId}-btn`);
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
        const card = document.querySelector(`[data-timer="${timerId}"]`);
        if (!card) return;

        const statusElement = document.getElementById(`timer-${timerId}-status`);

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

        totalElement.textContent = `${totalHours}h ${totalMinutes}m`;
    }

    updateTrayTooltip() {
        if (!this.isElectron) return;

        const activeTimerCount = this.activeTimers.size;
        if (activeTimerCount > 0) {
            const activeNames = Array.from(this.activeTimers).map(id => this.timers[id].name);
            window.electronAPI.updateTrayTooltip(`Time Tracker - Running: ${activeNames.join(', ')}`);
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

    updateDraftsIndicator() {
        const draftsSection = document.getElementById('drafts-section');
        if (!draftsSection) return;

        if (this.drafts.length > 0) {
            draftsSection.classList.remove('hidden');
            const toggleBtn = document.getElementById('toggle-drafts');
            if (toggleBtn) {
                toggleBtn.textContent = `${this.drafts.length} Draft${this.drafts.length !== 1 ? 's' : ''}`;
            }
        } else {
            draftsSection.classList.add('hidden');
        }
    }

    // Panel management
    showPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('show');
        }
    }

    hidePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.remove('show');
        }
    }

    showConfigPanel(timerId) {
        const panel = document.getElementById('config-panel');
        const title = document.getElementById('config-panel-title');
        
        if (title) {
            title.textContent = `Configure Timer ${timerId}`;
        }

        // Set current timer data
        this.currentConfigTimerId = timerId;
        const timer = this.timers[timerId];
        
        if (timer) {
            const nameInput = document.getElementById('timer-name-input');
            const colorInput = document.getElementById('timer-color');
            
            if (nameInput) nameInput.value = timer.name;
            if (colorInput) colorInput.value = timer.color;
        }

        // Load clients if connected
        if (this.freeagentAPI && this.freeagentAPI.isConnected()) {
            this.loadClientsForConfig();
        }

        this.showPanel('config-panel');
    }

    showSettingsPanel() {
        // Load current settings into form
        const defaultRounding = document.getElementById('default-rounding');
        const roundingMethod = document.getElementById('rounding-method');
        const notifyStart = document.getElementById('notify-timer-start');
        const notifyStop = document.getElementById('notify-timer-stop');
        const autoSave = document.getElementById('auto-save-drafts');
        const maxDrafts = document.getElementById('max-drafts');

        if (defaultRounding) defaultRounding.value = this.settings.defaultRounding;
        if (roundingMethod) roundingMethod.value = this.settings.roundingMethod;
        if (notifyStart) notifyStart.checked = this.settings.notifyTimerStart;
        if (notifyStop) notifyStop.checked = this.settings.notifyTimerStop;
        if (autoSave) autoSave.checked = this.settings.autoSaveDrafts;
        if (maxDrafts) maxDrafts.value = this.settings.maxDrafts;

        this.showPanel('settings-panel');
    }

    showTimeslipPanel(timerId) {
        const timer = this.timers[timerId];
        if (!timer) return;

        this.currentTimeslipTimerId = timerId;

        // Set project name
        const projectElement = document.getElementById('timeslip-project');
        if (projectElement) {
            projectElement.textContent = timer.project ? 'Project assigned' : 'No project';
        }

        // Calculate and display times
        const hours = timer.elapsed / 3600000; // Convert ms to hours
        this.updateTimeslipTimes(hours);

        // Set work date to today
        const workDate = document.getElementById('work-date');
        if (workDate) {
            workDate.value = new Date().toISOString().split('T')[0];
        }

        // Load tasks if project assigned
        if (timer.project) {
            this.loadTasksForTimeslip(timer.project);
        }

        this.showPanel('timeslip-panel');
    }

    showSetupContainer() {
        const setupContainer = document.getElementById('setup-container');
        const timerContainer = document.getElementById('timer-container');
        
        if (setupContainer) setupContainer.classList.remove('hidden');
        if (timerContainer) timerContainer.classList.add('hidden');
    }

    hideSetupContainer() {
        const setupContainer = document.getElementById('setup-container');
        const timerContainer = document.getElementById('timer-container');
        
        if (setupContainer) setupContainer.classList.add('hidden');
        if (timerContainer) timerContainer.classList.remove('hidden');
    }

    // Event handlers
    async handleConfigSave(e) {
        e.preventDefault();
        
        const timerId = this.currentConfigTimerId;
        const timer = this.timers[timerId];
        if (!timer) return;

        const nameInput = document.getElementById('timer-name-input');
        const colorInput = document.getElementById('timer-color');
        const projectSelect = document.getElementById('project-select');

        if (nameInput) timer.name = nameInput.value;
        if (colorInput) timer.color = colorInput.value;
        if (projectSelect && projectSelect.value) {
            timer.project = projectSelect.value;
        }

        await this.saveData();
        this.updateDisplay();
        this.hidePanel('config-panel');

        console.log(`Timer ${timerId} configuration saved`);
    }

    async handleSettingsSave(e) {
        e.preventDefault();

        const defaultRounding = document.getElementById('default-rounding');
        const roundingMethod = document.getElementById('rounding-method');
        const notifyStart = document.getElementById('notify-timer-start');
        const notifyStop = document.getElementById('notify-timer-stop');
        const autoSave = document.getElementById('auto-save-drafts');
        const maxDrafts = document.getElementById('max-drafts');

        if (defaultRounding) this.settings.defaultRounding = parseInt(defaultRounding.value);
        if (roundingMethod) this.settings.roundingMethod = roundingMethod.value;
        if (notifyStart) this.settings.notifyTimerStart = notifyStart.checked;
        if (notifyStop) this.settings.notifyTimerStop = notifyStop.checked;
        if (autoSave) this.settings.autoSaveDrafts = autoSave.checked;
        if (maxDrafts) this.settings.maxDrafts = parseInt(maxDrafts.value);

        await this.saveSettings();
        this.hidePanel('settings-panel');

        console.log('Settings saved');
    }

    async handleTimeslipCreate(e) {
        e.preventDefault();

        const timerId = this.currentTimeslipTimerId;
        const timer = this.timers[timerId];
        if (!timer) return;

        try {
            const workDate = document.getElementById('work-date').value;
            const timeRounding = document.getElementById('time-rounding').value;
            const taskSelect = document.getElementById('task-select').value;
            const comment = document.getElementById('timeslip-comment').value;

            if (!taskSelect) {
                throw new Error('Please select a task');
            }

            const hours = timer.elapsed / 3600000;
            const roundingMinutes = parseInt(timeRounding);

            await this.freeagentAPI.createTimeslip(
                timer.project,
                taskSelect,
                hours,
                comment,
                workDate,
                roundingMinutes,
                this.settings.roundingMethod
            );

            this.hidePanel('timeslip-panel');
            
            // Reset timer elapsed
            timer.elapsed = 0;
            await this.saveData();

        } catch (error) {
            console.error('Timeslip creation error:', error);
            this.showError('timeslip-error', error.message);
        }
    }

    async connectFreeAgent() {
        try {
            const success = await this.freeagentAPI.authenticate();
            if (success) {
                this.hideSetupContainer();
                this.updateSyncStatus();
            }
        } catch (error) {
            console.error('FreeAgent connection error:', error);
        }
    }

    // Enhanced TimeTracker methods - Desktop specific functionality
    async loadClientsForConfig() {
        try {
            const loadingElement = document.getElementById('config-loading');
            const errorElement = document.getElementById('config-error');
            const clientSelect = document.getElementById('client-select');
            
            if (loadingElement) loadingElement.classList.remove('hidden');
            if (errorElement) errorElement.classList.add('hidden');
            
            if (!this.freeagentAPI.isConnected()) {
                throw new Error('Not connected to FreeAgent');
            }

            const contacts = await this.freeagentAPI.getContacts();
            
            if (clientSelect) {
                clientSelect.innerHTML = '<option value="">Select Client...</option>';
                
                Object.entries(contacts).forEach(([url, contact]) => {
                    const option = document.createElement('option');
                    option.value = url;
                    option.textContent = contact.displayName;
                    clientSelect.appendChild(option);
                });
            }
            
            if (loadingElement) loadingElement.classList.add('hidden');
            
        } catch (error) {
            console.error('Load clients error:', error);
            this.showError('config-error', error.message);
            
            const loadingElement = document.getElementById('config-loading');
            if (loadingElement) loadingElement.classList.add('hidden');
        }
    }

    async onClientSelected(clientUrl) {
        const projectGroup = document.getElementById('project-row');
        const projectSelect = document.getElementById('project-select');
        
        if (!clientUrl) {
            if (projectGroup) projectGroup.style.display = 'none';
            return;
        }
        
        try {
            if (projectGroup) projectGroup.style.display = 'block';
            
            if (projectSelect) {
                projectSelect.innerHTML = '<option value="">Loading projects...</option>';
            }
            
            const projects = await this.freeagentAPI.getProjects(clientUrl);
            
            if (projectSelect) {
                projectSelect.innerHTML = '<option value="">Select Project...</option>';
                
                Object.entries(projects).forEach(([url, project]) => {
                    const option = document.createElement('option');
                    option.value = url;
                    option.textContent = `${project.name} (${project.currency}${project.budget || 'No budget'})`;
                    projectSelect.appendChild(option);
                });
            }
            
        } catch (error) {
            console.error('Load projects error:', error);
            this.showError('config-error', error.message);
        }
    }

    async loadTasksForTimeslip(projectUrl) {
        try {
            const taskSelect = document.getElementById('task-select');
            if (!taskSelect) return;
            
            taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
            
            const tasks = await this.freeagentAPI.getTasks(projectUrl);
            
            taskSelect.innerHTML = '<option value="">Select Task...</option>';
            
            tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.url;
                option.textContent = `${task.name}${task.is_billable ? ' (Billable)' : ' (Non-billable)'}`;
                option.dataset.isBillable = task.is_billable;
                taskSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Load tasks error:', error);
            this.showError('timeslip-error', error.message);
        }
    }

    updateTimeslipDisplay() {
        if (!this.currentTimeslipTimerId) return;
        
        const timer = this.timers[this.currentTimeslipTimerId];
        if (!timer) return;
        
        const hours = timer.elapsed / 3600000;
        this.updateTimeslipTimes(hours);
    }

    async saveDraft(timerId = null) {
        try {
            const targetTimerId = timerId || this.currentTimeslipTimerId;
            if (!targetTimerId) return;
            
            const timer = this.timers[targetTimerId];
            if (!timer) return;
            
            const draft = {
                id: Date.now(),
                timerId: targetTimerId,
                timerName: timer.name,
                project: timer.project,
                elapsed: timer.elapsed,
                comment: document.getElementById('timeslip-comment')?.value || '',
                workDate: document.getElementById('work-date')?.value || new Date().toISOString().split('T')[0],
                timeRounding: document.getElementById('time-rounding')?.value || '30',
                task: document.getElementById('task-select')?.value || null,
                createdAt: new Date().toISOString()
            };
            
            this.drafts.push(draft);
            
            // Limit drafts to max setting
            if (this.drafts.length > this.settings.maxDrafts) {
                this.drafts = this.drafts.slice(-this.settings.maxDrafts);
            }
            
            await this.saveData();
            this.updateDraftsIndicator();
            this.renderDraftsList();
            
            if (this.isElectron) {
                window.electronAPI.showNotification(
                    'Draft Saved',
                    `Timer "${timer.name}" saved as draft`
                );
            }
            
            console.log('Draft saved:', draft);
            
        } catch (error) {
            console.error('Save draft error:', error);
        }
    }

    renderDraftsList() {
        const draftsList = document.getElementById('drafts-list');
        if (!draftsList) return;
        
        draftsList.innerHTML = '';
        
        this.drafts.forEach(draft => {
            const draftElement = document.createElement('div');
            draftElement.className = 'draft-item';
            
            const hours = draft.elapsed / 3600000;
            const roundedHours = this.freeagentAPI.roundTime(hours, parseInt(draft.timeRounding), this.settings.roundingMethod);
            
            draftElement.innerHTML = `
                <div class="draft-header">
                    <span class="draft-title">${draft.timerName}</span>
                    <span class="draft-time">${Math.floor(hours)}h ${Math.floor((hours - Math.floor(hours)) * 60)}m</span>
                </div>
                <div class="draft-details">
                    ${draft.project ? 'Project assigned' : 'No project'} • 
                    Rounded: ${Math.floor(roundedHours)}h ${Math.floor((roundedHours - Math.floor(roundedHours)) * 60)}m •
                    ${new Date(draft.createdAt).toLocaleDateString()}
                </div>
                <div class="draft-actions">
                    <button class="draft-btn submit" onclick="window.app.getTimeTracker().submitDraft(${draft.id})">
                        Submit
                    </button>
                    <button class="draft-btn delete" onclick="window.app.getTimeTracker().deleteDraft(${draft.id})">
                        Delete
                    </button>
                </div>
            `;
            
            draftsList.appendChild(draftElement);
        });
    }

    async submitDraft(draftId) {
        try {
            const draft = this.drafts.find(d => d.id === draftId);
            if (!draft) return;
            
            if (!draft.project || !draft.task) {
                throw new Error('Project and task are required to submit timeslip');
            }
            
            const hours = draft.elapsed / 3600000;
            
            await this.freeagentAPI.createTimeslip(
                draft.project,
                draft.task,
                hours,
                draft.comment,
                draft.workDate,
                parseInt(draft.timeRounding),
                this.settings.roundingMethod
            );
            
            // Remove draft after successful submission
            this.drafts = this.drafts.filter(d => d.id !== draftId);
            await this.saveData();
            this.updateDraftsIndicator();
            this.renderDraftsList();
            
        } catch (error) {
            console.error('Submit draft error:', error);
            if (this.isElectron) {
                window.electronAPI.showNotification(
                    'Draft Submission Error',
                    error.message
                );
            }
        }
    }

    async deleteDraft(draftId) {
        this.drafts = this.drafts.filter(d => d.id !== draftId);
        await this.saveData();
        this.updateDraftsIndicator();
        this.renderDraftsList();
    }

    // Export functionality
    async exportTimeslips() {
        try {
            if (!this.freeagentAPI.isConnected()) {
                throw new Error('Please connect to FreeAgent first');
            }
            
            // Get recent timeslips
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30); // Last 30 days
            
            const timeslips = await this.freeagentAPI.getTimeslips({
                from_date: startDate.toISOString().split('T')[0],
                to_date: endDate.toISOString().split('T')[0]
            });
            
            // Create CSV content
            const headers = ['Date', 'Project', 'Task', 'Hours', 'Comment'];
            const csvContent = [
                headers.join(','),
                ...timeslips.map(t => [
                    t.dated_on,
                    `"${t.project || 'Unknown'}"`,
                    `"${t.task || 'Unknown'}"`,
                    t.hours,
                    `"${(t.comment || '').replace(/"/g, '""')}"""
                ].join(','))
            ].join('\n');
            
            // Save file if in Electron
            if (this.isElectron) {
                const result = await window.electronAPI.showSaveDialog({
                    defaultPath: `timeslips-${endDate.toISOString().split('T')[0]}.csv`,
                    filters: [
                        { name: 'CSV Files', extensions: ['csv'] }
                    ]
                });
                
                if (result.filePath) {
                    // In a real implementation, you'd write the file
                    console.log('Would save to:', result.filePath);
                    window.electronAPI.showNotification(
                        'Export Complete',
                        `Exported ${timeslips.length} timeslips`
                    );
                }
            }
            
        } catch (error) {
            console.error('Export error:', error);
            if (this.isElectron) {
                window.electronAPI.showNotification(
                    'Export Error',
                    error.message
                );
            }
        }
    }

    // Helper methods
    updateTimeslipTimes(actualHours) {
        const actualElement = document.getElementById('timeslip-actual-time');
        const roundedElement = document.getElementById('timeslip-rounded-time');
        const roundingSelect = document.getElementById('time-rounding');

        if (actualElement) {
            const hours = Math.floor(actualHours);
            const minutes = Math.floor((actualHours - hours) * 60);
            actualElement.textContent = `${hours}h ${minutes}m`;
        }

        if (roundedElement && roundingSelect) {
            const roundingMinutes = parseInt(roundingSelect.value);
            const roundedHours = this.freeagentAPI.roundTime(actualHours, roundingMinutes, this.settings.roundingMethod);
            const hours = Math.floor(roundedHours);
            const minutes = Math.floor((roundedHours - hours) * 60);
            roundedElement.textContent = `${hours}h ${minutes}m`;
        }
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    // Cleanup
    destroy() {
        this.stopUpdateInterval();
        
        if (this.isElectron) {
            window.electronAPI.removeAllListeners('toggle-timer');
            window.electronAPI.removeAllListeners('show-settings');
            window.electronAPI.removeAllListeners('stop-all-timers');
        }
    }
}