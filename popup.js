// Popup functionality for FreeAgent Time Tracker
class TimeTracker {
    constructor() {
        this.timers = {};
        this.clients = {};
        this.activeTimers = new Set();
        this.freeagentAPI = null; // Initialize later to avoid errors
        this.pendingTimeslip = null; // For task selection modal
        this.isInitializing = true; // Prevent modals during init
        // Hide all modals and setup container immediately
        document.addEventListener('DOMContentLoaded', () => {
            this.hideAllModalsAndSetup();
        });
        this.init().catch(error => {
            console.error('TimeTracker initialization failed:', error);
        });
    }

    hideAllModalsAndSetup() {
        const setupContainer = document.getElementById('setup-container');
        const mainContainer = document.getElementById('main-container');
        const configPanel = document.getElementById('config-panel');
        
        // Hide all legacy modal elements that might still exist
        const modalElements = [
            'config-modal', 
            'task-modal'
        ];
        
        modalElements.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        });
        
        if (setupContainer) {
            setupContainer.classList.add('hidden');
            setupContainer.style.display = 'none';
        }
        if (configPanel) {
            configPanel.classList.remove('show');
            configPanel.classList.add('hidden');
        }
        // Close all panels instead of just hiding modals (safe calls)
        try {
            this.closeSettingsPanel();
        } catch (e) {
            // Panel methods might not be ready during init
            const settingsPanel = document.getElementById('settings-panel');
            if (settingsPanel) {
                settingsPanel.classList.remove('show');
                settingsPanel.classList.add('hidden');
            }
        }
        
        try {
            this.closeTimeslipPanel();
        } catch (e) {
            // Panel methods might not be ready during init
            const timeslipPanel = document.getElementById('timeslip-panel');
            if (timeslipPanel) {
                timeslipPanel.classList.remove('show');
                timeslipPanel.classList.add('hidden');
            }
        }
        
        if (mainContainer) {
            mainContainer.classList.remove('hidden');
            mainContainer.style.display = 'block';
            mainContainer.style.visibility = 'visible';
        }
        console.log('All modals and setup container hidden, main container shown');
    }

    async init() {
        console.log('TimeTracker initializing...');
        this.hideAllModalsAndSetup();
        await this.loadData();
        console.log('Data loaded:', { clients: this.clients, freeagentConnected: this.freeagentConnected });
        this.setupEventListeners();
        // Only call updateDisplay after data is fully loaded
        this.updateDisplay();
        this.startUpdateLoop();
        await this.checkSetupStatus();
        this.isInitializing = false; // Initialization complete
        this.hideAllModalsAndSetup(); // Ensure correct state after init
        await this.loadDraftsIndicator(); // Show drafts if any exist
        console.log('TimeTracker initialized');
    }

    async loadData() {
        try {
            const result = await chrome.storage.local.get([
                'timers', 'clients', 'activeTimers', 'freeagentConnected'
            ]);
            
            // Initialize timers with defensive defaults
            this.timers = result.timers || {};
            for (let i = 1; i <= 3; i++) {
                if (!this.timers[i]) {
                    this.timers[i] = { startTime: null, elapsed: 0, todayTotal: 0 };
                }
            }
            
            // Initialize clients with defensive defaults
            this.clients = result.clients || {};
            const defaultColors = ['#FF5722', '#2196F3', '#4CAF50'];
            for (let i = 1; i <= 3; i++) {
                if (!this.clients[i]) {
                    this.clients[i] = { 
                        name: `Client ${i}`, 
                        color: defaultColors[i-1],
                        project: null,
                        configured: false
                    };
                }
                // Ensure all required properties exist
                this.clients[i].name = this.clients[i].name || `Client ${i}`;
                this.clients[i].color = this.clients[i].color || defaultColors[i-1];
                this.clients[i].project = this.clients[i].project || null;
                this.clients[i].configured = this.clients[i].configured || false;
            }
            
            this.activeTimers = new Set(result.activeTimers || []);
            this.freeagentConnected = result.freeagentConnected || false;
            
        } catch (error) {
            console.error('Error loading data:', error);
            // Initialize with defaults on error
            this.initializeDefaults();
        }
    }
    
    initializeDefaults() {
        this.timers = {
            1: { startTime: null, elapsed: 0, todayTotal: 0 },
            2: { startTime: null, elapsed: 0, todayTotal: 0 },
            3: { startTime: null, elapsed: 0, todayTotal: 0 }
        };
        
        this.clients = {
            1: { name: 'Client 1', color: '#FF5722', project: null, configured: false },
            2: { name: 'Client 2', color: '#2196F3', project: null, configured: false },
            3: { name: 'Client 3', color: '#4CAF50', project: null, configured: false }
        };
        
        this.activeTimers = new Set();
        this.freeagentConnected = false;
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
        const connectBtn = document.getElementById('connect-btn');
        const skipBtn = document.getElementById('skip-setup');
        const setupBtn = document.getElementById('setup-btn');
        
        if (connectBtn) connectBtn.addEventListener('click', () => this.connectFreeAgent());
        if (skipBtn) skipBtn.addEventListener('click', () => this.skipSetup());
        if (setupBtn) {
            console.log('Setup button found, adding event listener');
            setupBtn.addEventListener('click', () => {
                console.log('Setup button clicked');
                this.showSetup();
            });
        } else {
            console.log('Setup button not found!');
        }
        
        // Individual timer config buttons
        for (let i = 1; i <= 3; i++) {
            const configBtn = document.getElementById(`config-timer-${i}`);
            if (configBtn) {
                console.log(`Config button for timer ${i} found, adding event listener`);
                configBtn.addEventListener('click', () => {
                    console.log(`Config button for timer ${i} clicked`);
                    this.showConfigModal(i);
                });
            } else {
                console.log(`Config button for timer ${i} not found!`);
            }
        }

        // Configuration panel events
        document.getElementById('close-config-panel')?.addEventListener('click', () => this.closeConfigPanel());
        document.getElementById('save-config')?.addEventListener('click', () => this.saveConfiguration());
        document.getElementById('cancel-config')?.addEventListener('click', () => this.closeConfigPanel());

        // Client selection changes
        document.getElementById('client-select-current')?.addEventListener('change', (e) => {
            this.onClientSelected(e.target.value);
        });

        // Timeslip panel events (replacing modal)
        document.getElementById('close-timeslip')?.addEventListener('click', () => this.closeTimeslipPanel());
        document.getElementById('cancel-timeslip')?.addEventListener('click', () => this.closeTimeslipPanel());
        document.getElementById('create-timeslip-panel')?.addEventListener('click', () => this.createTimeslipFromPanel());
        document.getElementById('save-draft-panel')?.addEventListener('click', () => this.saveDraftFromPanel());

        // Time rounding change event (updated IDs)
        document.getElementById('timeslip-time-rounding')?.addEventListener('change', () => this.updateTimeslipTimeRounding());

        // Work date change event (updated IDs)
        document.getElementById('timeslip-work-date')?.addEventListener('change', () => this.onTimeslipWorkDateChanged());

        // Task modal events (DEPRECATED - for compatibility)
        document.getElementById('close-task')?.addEventListener('click', () => this.closeTimeslipPanel());
        document.getElementById('cancel-task')?.addEventListener('click', () => this.closeTimeslipPanel());
        document.getElementById('create-timeslip')?.addEventListener('click', () => this.createTimeslip());
        document.getElementById('save-draft')?.addEventListener('click', () => this.saveDraft());
        document.getElementById('use-timeslip-panel')?.addEventListener('click', () => {
            this.closeTimeslipPanel();
            this.openTimeslipPanel();
        });

        // Legacy time rounding events (for modal compatibility)
        document.getElementById('time-rounding')?.addEventListener('change', () => this.updateTimeRounding());
        document.getElementById('task-work-date')?.addEventListener('change', () => this.onWorkDateChanged());

        // Drafts section events
        document.getElementById('toggle-drafts')?.addEventListener('click', () => this.toggleDrafts());

        // Settings events (using slide-down panel instead of modal)
        document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettingsPanel());
        document.getElementById('close-settings')?.addEventListener('click', () => this.closeSettingsPanel());
        document.getElementById('cancel-settings')?.addEventListener('click', () => this.closeSettingsPanel());
        document.getElementById('save-settings')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('reset-settings')?.addEventListener('click', () => this.resetSettings());

        // Project selection changes
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`project-select-${i}`)?.addEventListener('change', (e) => {
                this.onProjectSelected(i, e.target.value);
            });
        }

        // Listen for background script messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'timerUpdate') {
                this.updateDisplay();
            }
        });
    }

    async checkSetupStatus() {
        console.log('Checking setup status...', {
            freeagentConnected: this.freeagentConnected,
            setupSkipped: localStorage.getItem('setupSkipped'),
            extensionId: chrome.runtime.id
        });
        // Always show the main timer interface by default
        this.hideAllModalsAndSetup();
        // Update sync status
        this.updateSyncStatus();
    }

    async toggleTimer(timerId) {
        const timer = this.timers[timerId];
        const client = this.clients[timerId];
        
        if (this.activeTimers.has(timerId)) {
            // Stop timer - check if configured for FreeAgent
            if (client.configured && client.project) {
                await this.showTaskSelectionModal(timerId);
            } else {
                this.stopTimer(timerId);
                await this.saveData();
                this.updateDisplay();
                this.notifyBackgroundScript(timerId);
            }
        } else {
            // Start timer
            this.startTimer(timerId);
            await this.saveData();
            this.updateDisplay();
            this.notifyBackgroundScript(timerId);
        }
    }
    
    notifyBackgroundScript(timerId) {
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
        
        // Safety check - ensure clients data is loaded
        if (!this.clients || Object.keys(this.clients).length === 0) {
            console.warn('Clients data not loaded yet, skipping display update');
            return;
        }
        
        for (let i = 1; i <= 3; i++) {
            const timer = this.timers[i];
            const tile = document.querySelector(`.timer-tile[data-timer="${i}"]`);
            const display = document.getElementById(`timer-${i}-display`);
            const btn = document.getElementById(`timer-${i}-btn`);
            const nameEl = document.getElementById(`client-${i}-name`);
            
            // Safety check for individual client
            const client = this.clients[i];
            if (!client) {
                console.warn(`Client ${i} not found, skipping`);
                continue;
            }
            
            // Update client name - show project info if configured
            if (client.configured && client.project) {
                nameEl.innerHTML = `<strong>${client.name}</strong><br><small>${client.project.name}</small>`;
            } else {
                nameEl.textContent = client.name || `Client ${i}`;
            }
            
            // Update tile border color
            if (tile) {
                tile.style.borderLeftColor = client.color || '#ddd';
            }
            
            // Safety check for timer
            if (!timer) {
                console.warn(`Timer ${i} not found, skipping`);
                continue;
            }
            
            // Calculate current time
            let currentTime = timer.elapsed;
            if (timer.startTime && this.activeTimers.has(i)) {
                currentTime += (now - timer.startTime);
            }
            
            // Update display
            if (display) {
                display.textContent = this.formatTime(currentTime);
            }
            
            // Update button and tile state
            if (btn) {
                if (this.activeTimers.has(i)) {
                    btn.textContent = 'Stop';
                    btn.classList.add('stop');
                } else {
                    btn.textContent = 'Start';
                    btn.classList.remove('stop');
                }
            }
            
            if (tile) {
                if (this.activeTimers.has(i)) {
                    tile.classList.add('active');
                } else {
                    tile.classList.remove('active');
                }
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
        console.log('Skipping setup, returning to timers');
        this.hideAllModalsAndSetup();
        localStorage.setItem('setupSkipped', 'true');
    }

    showSetup() {
        // Prevent showing setup modal during initialization
        if (this.isInitializing) {
            console.log('Preventing setup modal during initialization');
            return;
        }
        
        console.log('Showing setup modal');
        const setupContainer = document.getElementById('setup-container');
        const mainContainer = document.getElementById('main-container');
        
        // Show setup container
        if (setupContainer) {
            setupContainer.classList.remove('hidden');
            setupContainer.style.display = 'block';
        }
        
        // Hide main container
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }
        
        // Hide other panels
        this.closeConfigPanel();
        this.closeTimeslipPanel();
    }

    updateSyncStatus() {
        const statusEl = document.getElementById('sync-status');
        
        if (this.freeagentConnected) {
            statusEl.textContent = 'Connected to FreeAgent ✅';
            statusEl.className = 'sync-status connected';
        } else {
            statusEl.innerHTML = `Not connected to FreeAgent<br><small>Extension ID: ${chrome.runtime.id}</small>`;
            statusEl.className = 'sync-status';
        }
    }

    // Configuration Panel Methods
    async showConfigModal(timerId = 1) {
        // Prevent showing config panel during initialization
        if (this.isInitializing) {
            console.log('Preventing config panel during initialization');
            return;
        }
        
        console.log(`Showing configuration panel for timer ${timerId}`);
        this.currentConfigTimer = timerId;
        
        // Update panel title and set current values
        document.getElementById('config-panel-title').textContent = `Configure Timer ${timerId}`;
        document.getElementById('timer-name-input').value = this.clients[timerId].name;
        document.getElementById('color-select-current').value = this.clients[timerId].color;
        
        // Show the panel
        const configPanel = document.getElementById('config-panel');
        configPanel.classList.remove('hidden');
        configPanel.classList.add('show');
        
        if (!this.freeagentConnected) {
            // Show warning but still allow configuration
            const errorEl = document.getElementById('config-error-panel');
            if (errorEl) {
                errorEl.textContent = 'Not connected to FreeAgent. Connect first to sync with projects.';
                errorEl.classList.remove('hidden');
            }
            // Hide client and project selection if not connected
            document.getElementById('client-row').style.display = 'none';
            document.getElementById('project-row').style.display = 'none';
            return;
        }

        // Show client and project selection
        document.getElementById('client-row').style.display = 'flex';
        document.getElementById('config-error-panel').classList.add('hidden');
        
        // Initialize FreeAgent API if not already done
        if (!this.freeagentAPI) {
            try {
                this.freeagentAPI = new FreeAgentAPI();
            } catch (error) {
                console.error('Failed to initialize FreeAgent API:', error);
                this.showNotification('Failed to initialize FreeAgent API', 'error');
                return;
            }
        }

        await this.loadClientsForConfiguration();
    }

    closeConfigPanel() {
        const configPanel = document.getElementById('config-panel');
        configPanel.classList.remove('show');
        configPanel.classList.add('hidden');
    }

    async loadClientsForConfiguration() {
        const loadingEl = document.getElementById('loading-projects-panel');
        const errorEl = document.getElementById('config-error-panel');

        try {
            if (loadingEl) {
                loadingEl.classList.remove('hidden');
                loadingEl.textContent = 'Loading clients...';
            }
            if (errorEl) {
                errorEl.classList.add('hidden');
            }

            // Initialize API if needed
            if (!this.freeagentAPI.isReady()) {
                await this.freeagentAPI.init();
            }

            // Use the more efficient method that only loads clients with active projects
            const contacts = await this.freeagentAPI.getContactsWithActiveProjects();
            
            // Populate client dropdown
            const clientSelect = document.getElementById('client-select-current');
            clientSelect.innerHTML = '<option value="">Select Client...</option>';
            
            // Sort contacts by name and add to dropdown
            const sortedContacts = Object.values(contacts).sort((a, b) => a.name.localeCompare(b.name));
            
            sortedContacts.forEach(contact => {
                const option = document.createElement('option');
                option.value = contact.url;
                option.textContent = contact.name;
                option.dataset.contactName = contact.name;
                option.title = `${contact.name}${contact.email ? ' - ' + contact.email : ''}`;
                
                clientSelect.appendChild(option);
            });

            // If this timer already has a project selected, find and select the client
            if (this.clients[this.currentConfigTimer].project && this.clients[this.currentConfigTimer].project.contact) {
                const clientUrl = this.clients[this.currentConfigTimer].project.contact;
                clientSelect.value = clientUrl;
                
                // Load projects for this client
                await this.onClientSelected(clientUrl);
            }

            if (loadingEl) {
                loadingEl.classList.add('hidden');
            }
            
            console.log(`Loaded ${sortedContacts.length} clients for timer configuration`);
            
        } catch (error) {
            console.error('Error loading clients:', error);
            if (loadingEl) {
                loadingEl.classList.add('hidden');
            }
            if (errorEl) {
                errorEl.textContent = `Failed to load clients: ${error.message}. Please check your FreeAgent connection.`;
                errorEl.classList.remove('hidden');
            }
        }
    }

    async onClientSelected(clientUrl) {
        const projectSelect = document.getElementById('project-select-current');
        const projectRow = document.getElementById('project-row');
        
        if (!clientUrl) {
            projectRow.style.display = 'none';
            projectSelect.innerHTML = '<option value="">Select Project...</option>';
            return;
        }

        try {
            projectRow.style.display = 'flex';
            projectSelect.innerHTML = '<option value="">Loading projects...</option>';
            
            const projects = await this.freeagentAPI.getProjectsForContact(clientUrl);
            
            projectSelect.innerHTML = '<option value="">Select Project...</option>';
            
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.url;
                
                // Enhanced display with billing info
                let displayText = project.name;
                if (project.billing_rate && parseFloat(project.billing_rate) > 0) {
                    displayText += ` (${project.currency}${project.billing_rate}/${project.billing_period || 'hour'})`;
                }
                if (project.budget && parseFloat(project.budget) > 0) {
                    displayText += ` [Budget: ${project.currency}${project.budget}]`;
                }
                
                option.textContent = displayText;
                option.dataset.projectName = project.name;
                option.dataset.contact = project.contact;
                option.title = `Project: ${project.name}\nCurrency: ${project.currency}${project.billing_rate ? '\nRate: ' + project.currency + project.billing_rate + '/' + (project.billing_period || 'hour') : ''}`;
                
                // Check if this project is currently selected for this timer
                if (this.clients[this.currentConfigTimer].project && 
                    this.clients[this.currentConfigTimer].project.url === project.url) {
                    option.selected = true;
                }
                
                projectSelect.appendChild(option);
            });
            
            console.log(`Loaded ${projects.length} projects for selected client`);
            
        } catch (error) {
            console.error('Error loading projects for client:', error);
            projectSelect.innerHTML = '<option value="">Error loading projects</option>';
        }
    }

    onProjectSelected(timerId, projectUrl) {
        const select = document.getElementById(`project-select-${timerId}`);
        const statusEl = document.getElementById(`config-status-${timerId}`);
        
        if (projectUrl) {
            const selectedOption = select.selectedOptions[0];
            const clientName = selectedOption.dataset.clientName;
            const projectName = selectedOption.dataset.projectName;
            
            statusEl.textContent = `✓ Selected: ${clientName} - ${projectName}`;
            statusEl.className = 'config-status success';
        } else {
            statusEl.textContent = '';
            statusEl.className = 'config-status';
        }
    }

    async saveConfiguration() {
        try {
            const timerId = this.currentConfigTimer;
            const timerNameInput = document.getElementById('timer-name-input');
            const clientSelect = document.getElementById('client-select-current');
            const projectSelect = document.getElementById('project-select-current');
            const colorInput = document.getElementById('color-select-current');
            
            // Update client configuration
            this.clients[timerId].name = timerNameInput.value.trim() || `Client ${timerId}`;
            this.clients[timerId].color = colorInput.value;
            
            if (projectSelect.value) {
                const selectedProjectOption = projectSelect.selectedOptions[0];
                const selectedClientOption = clientSelect.selectedOptions[0];
                
                this.clients[timerId].project = {
                    url: selectedProjectOption.value,
                    name: selectedProjectOption.dataset.projectName,
                    contact: selectedProjectOption.dataset.contact,
                    contact_name: selectedClientOption.dataset.contactName
                };
                this.clients[timerId].configured = true;
            } else {
                this.clients[timerId].project = null;
                this.clients[timerId].configured = false;
            }
            
            // Save to storage
            await this.saveData();
            
            // Update display
            this.updateDisplay();
            this.updateSyncStatus();
            
            // Close panel
            this.closeConfigPanel();
            
            this.showNotification(`Timer ${timerId} configuration saved!`, 'success');
            console.log(`Configuration saved for timer ${timerId}`);
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showNotification('Failed to save configuration', 'error');
        }
    }

    // Task Selection Modal Methods
    async showTaskSelectionModal(timerId) {
        const timer = this.timers[timerId];
        const client = this.clients[timerId];
        
        // Initialize FreeAgent API if not already done
        if (!this.freeagentAPI) {
            try {
                this.freeagentAPI = new FreeAgentAPI();
            } catch (error) {
                console.error('Failed to initialize FreeAgent API:', error);
                this.showNotification('Failed to initialize FreeAgent API', 'error');
                return;
            }
        }
        
        // Stop the timer first
        this.stopTimer(timerId);
        
        // Store pending timeslip data
        this.pendingTimeslip = {
            timerId: timerId,
            projectUrl: client.project.url,
            projectName: client.project.name,
            clientName: client.name,
            hours: timer.elapsed / (1000 * 60 * 60),
            elapsedMs: timer.elapsed
        };

        // Update UI
        await this.saveData();
        this.updateDisplay();
        this.notifyBackgroundScript(timerId);

        // Show the new slide-down timeslip panel (replaces modal)
        await this.openTimeslipPanel();
    }

    // New panel-based timeslip creation (preferred approach)
    async openTimeslipPanel() {
        if (!this.pendingTimeslip) {
            console.error('No pending timeslip data');
            return;
        }

        // Close any other open panels
        this.closeConfigPanel();
        this.closeSettingsPanel();

        const panel = document.getElementById('timeslip-panel');

        // Populate panel with timeslip data
        document.getElementById('timeslip-project-name').textContent = 
            `${this.pendingTimeslip.clientName} - ${this.pendingTimeslip.projectName}`;
        document.getElementById('timeslip-time-actual').textContent = 
            this.formatTimeDecimal(this.pendingTimeslip.hours);
        
        // Set today as default work date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('timeslip-work-date').value = today;
        
        // Load user's default rounding preference
        const result = await chrome.storage.local.get(['timeTrackingSettings']);
        const settings = result.timeTrackingSettings || this.getDefaultSettings();
        document.getElementById('timeslip-time-rounding').value = settings.defaultRounding;
        
        // Initialize time rounding display
        await this.updateTimeslipTimeRounding();
        
        // Show panel with slide-down animation
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('show'), 10);
        
        await this.loadTasksForTimeslipPanel();
    }

    closeTimeslipPanel() {
        const panel = document.getElementById('timeslip-panel');
        panel.classList.remove('show');
        setTimeout(() => panel.classList.add('hidden'), 300);
        
        // Clear pending timeslip data
        this.pendingTimeslip = null;
    }

    async updateTimeslipTimeRounding() {
        if (!this.pendingTimeslip) return;
        
        const roundingSelect = document.getElementById('timeslip-time-rounding');
        const roundingMinutes = parseInt(roundingSelect.value);
        
        // Get user's rounding method preference
        const result = await chrome.storage.local.get(['timeTrackingSettings']);
        const settings = result.timeTrackingSettings || this.getDefaultSettings();
        
        // Calculate rounded time using appropriate method
        let roundedHours;
        if (settings.roundingMethod === 'up') {
            roundedHours = this.freeagentAPI.roundTimeUp(this.pendingTimeslip.hours, roundingMinutes);
        } else {
            roundedHours = this.freeagentAPI.roundTime(this.pendingTimeslip.hours, roundingMinutes);
        }
        
        // Update display
        const roundedTimeElement = document.getElementById('timeslip-time-rounded');
        roundedTimeElement.textContent = this.formatTimeDecimal(roundedHours);
        
        // Store the rounded time for submission
        this.pendingTimeslip.roundedHours = roundedHours;
        this.pendingTimeslip.roundingMinutes = roundingMinutes;
        
        // Show time difference if significant
        const timeDiff = Math.abs(roundedHours - this.pendingTimeslip.hours);
        if (timeDiff > 0.01) {
            const diffText = roundedHours > this.pendingTimeslip.hours ? '+' : '';
            roundedTimeElement.title = `${diffText}${this.formatTimeDecimal(timeDiff)} difference from actual time`;
            roundedTimeElement.style.fontWeight = 'bold';
        } else {
            roundedTimeElement.title = 'No rounding applied';
            roundedTimeElement.style.fontWeight = 'normal';
        }
    }

    onTimeslipWorkDateChanged() {
        const dateInput = document.getElementById('timeslip-work-date');
        const selectedDate = new Date(dateInput.value);
        const today = new Date();
        
        if (selectedDate > today) {
            alert('Work date cannot be in the future.');
            dateInput.value = today.toISOString().split('T')[0];
        }
    }

    async loadTasksForTimeslipPanel() {
        const taskSelect = document.getElementById('timeslip-task-select');
        const errorEl = document.getElementById('timeslip-error');
        
        try {
            taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
            errorEl.classList.add('hidden');

            const tasks = await this.freeagentAPI.getTasksForProjectWithDefault(this.pendingTimeslip.projectUrl);
            
            taskSelect.innerHTML = '<option value="">Select Task...</option>';
            
            tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.url;
                option.textContent = task.name;
                option.title = `${task.name}${task.is_billable ? ' (Billable)' : ' (Non-billable)'}`;
                taskSelect.appendChild(option);
            });

            if (tasks.length === 0) {
                const option = document.createElement('option');
                option.value = 'CREATE_DEFAULT';
                option.textContent = 'Create Default Task';
                taskSelect.appendChild(option);
            }

            console.log(`Loaded ${tasks.length} tasks for timeslip panel`);

        } catch (error) {
            console.error('Error loading tasks for panel:', error);
            errorEl.textContent = `Failed to load tasks: ${error.message}`;
            errorEl.classList.remove('hidden');
            
            taskSelect.innerHTML = '<option value="">Error loading tasks</option>';
        }
    }

    async createTimeslipFromPanel() {
        const taskSelect = document.getElementById('timeslip-task-select');
        const commentInput = document.getElementById('timeslip-comment');
        const workDateInput = document.getElementById('timeslip-work-date');
        const roundingSelect = document.getElementById('timeslip-time-rounding');
        const errorEl = document.getElementById('timeslip-error');
        const createBtn = document.getElementById('create-timeslip-panel');
        
        if (!taskSelect.value) {
            errorEl.textContent = 'Please select a task';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            createBtn.textContent = 'Creating...';
            createBtn.disabled = true;
            errorEl.classList.add('hidden');

            let taskUrl = taskSelect.value;
            
            // Handle default task creation
            if (taskUrl === 'CREATE_DEFAULT') {
                const newTask = await this.freeagentAPI.createDefaultTask(this.pendingTimeslip.projectUrl);
                taskUrl = newTask.url;
            }

            // Get form values
            const comment = commentInput.value || `Timer ${this.pendingTimeslip.timerId}: ${this.pendingTimeslip.clientName}`;
            const workDate = workDateInput.value;
            const roundingMinutes = parseInt(roundingSelect.value);
            const hoursToSubmit = this.pendingTimeslip.roundedHours || this.pendingTimeslip.hours;
            
            // Create the timeslip with time rounding and custom date
            await this.freeagentAPI.createTimeslip(
                this.pendingTimeslip.projectUrl,
                taskUrl,
                hoursToSubmit,
                comment,
                workDate,
                roundingMinutes
            );

            // Reset the timer's elapsed time since it's now logged
            this.timers[this.pendingTimeslip.timerId].elapsed = 0;
            await this.saveData();
            this.updateDisplay();

            this.closeTimeslipPanel();
            
            // Show success notification with details
            const timeMsg = roundingMinutes > 0 ? 
                `${this.formatTimeDecimal(hoursToSubmit)} hours (rounded from ${this.formatTimeDecimal(this.pendingTimeslip.hours)})` :
                `${this.formatTimeDecimal(hoursToSubmit)} hours`;
            this.showNotification(`✅ Timeslip created: ${timeMsg}`);

        } catch (error) {
            console.error('Error creating timeslip from panel:', error);
            errorEl.textContent = 'Failed to create timeslip: ' + error.message;
            errorEl.classList.remove('hidden');
        } finally {
            createBtn.textContent = 'Create Timeslip';
            createBtn.disabled = false;
        }
    }

    async saveDraftFromPanel() {
        const taskSelect = document.getElementById('timeslip-task-select');
        const commentInput = document.getElementById('timeslip-comment');
        const workDateInput = document.getElementById('timeslip-work-date');
        const roundingSelect = document.getElementById('timeslip-time-rounding');
        
        if (!taskSelect.value) {
            alert('Please select a task before saving draft');
            return;
        }

        try {
            // Save draft to Chrome storage
            const draftData = {
                projectUrl: this.pendingTimeslip.projectUrl,
                projectName: this.pendingTimeslip.projectName,
                clientName: this.pendingTimeslip.clientName,
                taskUrl: taskSelect.value,
                taskName: taskSelect.options[taskSelect.selectedIndex].text,
                actualHours: this.pendingTimeslip.hours,
                roundedHours: this.pendingTimeslip.roundedHours || this.pendingTimeslip.hours,
                comment: commentInput.value,
                workDate: workDateInput.value,
                roundingMinutes: parseInt(roundingSelect.value),
                savedAt: new Date().toISOString(),
                timerId: this.pendingTimeslip.timerId
            };

            // Get existing drafts
            const result = await chrome.storage.local.get(['timeslipDrafts']);
            const drafts = result.timeslipDrafts || [];
            
            // Add new draft
            drafts.push(draftData);
            
            // Keep only last 10 drafts
            if (drafts.length > 10) {
                drafts.splice(0, drafts.length - 10);
            }
            
            await chrome.storage.local.set({ timeslipDrafts: drafts });
            
            // Reset the timer's elapsed time since it's saved as draft
            this.timers[this.pendingTimeslip.timerId].elapsed = 0;
            await this.saveData();
            this.updateDisplay();
            
            this.closeTimeslipPanel();
            this.showNotification(`💾 Draft saved: ${this.formatTimeDecimal(draftData.roundedHours)} hours`);
            
        } catch (error) {
            console.error('Error saving draft from panel:', error);
            alert('Failed to save draft: ' + error.message);
        }
    }

    async updateTimeRounding() {
        if (!this.pendingTimeslip) return;
        
        const roundingSelect = document.getElementById('time-rounding');
        const roundingMinutes = parseInt(roundingSelect.value);
        
        // Get user's rounding method preference
        const result = await chrome.storage.local.get(['timeTrackingSettings']);
        const settings = result.timeTrackingSettings || this.getDefaultSettings();
        
        // Calculate rounded time using appropriate method
        let roundedHours;
        if (settings.roundingMethod === 'up') {
            roundedHours = this.freeagentAPI.roundTimeUp(this.pendingTimeslip.hours, roundingMinutes);
        } else {
            roundedHours = this.freeagentAPI.roundTime(this.pendingTimeslip.hours, roundingMinutes);
        }
        
        // Update display
        const roundedTimeElement = document.getElementById('task-time-rounded');
        roundedTimeElement.textContent = this.formatTimeDecimal(roundedHours);
        
        // Store the rounded time for submission
        this.pendingTimeslip.roundedHours = roundedHours;
        this.pendingTimeslip.roundingMinutes = roundingMinutes;
        
        // Show time difference if significant
        const timeDiff = Math.abs(roundedHours - this.pendingTimeslip.hours);
        if (timeDiff > 0.01) { // Show if difference is more than ~36 seconds
            const diffText = roundedHours > this.pendingTimeslip.hours ? '+' : '';
            roundedTimeElement.title = `${diffText}${this.formatTimeDecimal(timeDiff)} difference from actual time`;
            roundedTimeElement.style.fontWeight = 'bold';
        } else {
            roundedTimeElement.title = 'No rounding applied';
            roundedTimeElement.style.fontWeight = 'normal';
        }
    }

    onWorkDateChanged() {
        // Validate the selected date
        const dateInput = document.getElementById('task-work-date');
        const selectedDate = new Date(dateInput.value);
        const today = new Date();
        
        if (selectedDate > today) {
            alert('Work date cannot be in the future.');
            dateInput.value = today.toISOString().split('T')[0];
        }
    }

    async saveDraft() {
        const taskSelect = document.getElementById('task-select');
        const commentInput = document.getElementById('task-comment');
        const workDateInput = document.getElementById('task-work-date');
        const roundingSelect = document.getElementById('time-rounding');
        
        if (!taskSelect.value) {
            alert('Please select a task before saving draft');
            return;
        }

        try {
            // Save draft to Chrome storage
            const draftData = {
                projectUrl: this.pendingTimeslip.projectUrl,
                projectName: this.pendingTimeslip.projectName,
                clientName: this.pendingTimeslip.clientName,
                taskUrl: taskSelect.value,
                taskName: taskSelect.options[taskSelect.selectedIndex].text,
                actualHours: this.pendingTimeslip.hours,
                roundedHours: this.pendingTimeslip.roundedHours || this.pendingTimeslip.hours,
                comment: commentInput.value,
                workDate: workDateInput.value,
                roundingMinutes: parseInt(roundingSelect.value),
                savedAt: new Date().toISOString(),
                timerId: this.pendingTimeslip.timerId
            };

            // Get existing drafts
            const result = await chrome.storage.local.get(['timeslipDrafts']);
            const drafts = result.timeslipDrafts || [];
            
            // Add new draft
            drafts.push(draftData);
            
            // Keep only last 10 drafts
            if (drafts.length > 10) {
                drafts.splice(0, drafts.length - 10);
            }
            
            await chrome.storage.local.set({ timeslipDrafts: drafts });
            
            // Reset the timer's elapsed time since it's saved as draft
            this.timers[this.pendingTimeslip.timerId].elapsed = 0;
            await this.saveData();
            this.updateDisplay();
            
            this.closeTimeslipPanel();
            this.showNotification(`💾 Draft saved: ${this.formatTimeDecimal(draftData.roundedHours)} hours`);
            
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Failed to save draft: ' + error.message);
        }
    }

    async loadTasksForSelection() {
        const taskSelect = document.getElementById('task-select');
        const errorEl = document.getElementById('task-error');
        
        try {
            taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
            errorEl.classList.add('hidden');

            // Use the enhanced method that creates default tasks if none exist
            // Following best practices from docs/tasks.md
            const tasks = await this.freeagentAPI.getTasksForProjectWithDefault(this.pendingTimeslip.projectUrl);
            
            taskSelect.innerHTML = '<option value="">Select Task...</option>';
            
            tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.url;
                
                // Enhanced task display with billing information
                let displayText = task.name;
                if (task.is_billable) {
                    if (task.billing_rate && parseFloat(task.billing_rate) > 0) {
                        displayText += ` (${task.currency || 'GBP'}${task.billing_rate}/${task.billing_period || 'hour'})`;
                    } else {
                        displayText += ` (Billable)`;
                    }
                } else {
                    displayText += ` (Non-billable)`;
                }
                
                option.textContent = displayText;
                option.dataset.taskName = task.name;
                option.dataset.isBillable = task.is_billable;
                option.dataset.billingRate = task.billing_rate || '';
                option.title = `Task: ${task.name}\nBillable: ${task.is_billable ? 'Yes' : 'No'}${task.billing_rate ? '\nRate: ' + (task.currency || 'GBP') + task.billing_rate + '/' + (task.billing_period || 'hour') : ''}`;
                
                taskSelect.appendChild(option);
            });

            console.log(`Loaded ${tasks.length} tasks for project selection`);

        } catch (error) {
            console.error('Error loading tasks:', error);
            errorEl.textContent = `Failed to load tasks: ${error.message}`;
            errorEl.classList.remove('hidden');
        }
    }

    async createTimeslip() {
        const taskSelect = document.getElementById('task-select');
        const commentInput = document.getElementById('task-comment');
        const workDateInput = document.getElementById('task-work-date');
        const roundingSelect = document.getElementById('time-rounding');
        const errorEl = document.getElementById('task-error');
        const createBtn = document.getElementById('create-timeslip');
        
        if (!taskSelect.value) {
            errorEl.textContent = 'Please select a task';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            createBtn.textContent = 'Creating...';
            createBtn.disabled = true;
            errorEl.classList.add('hidden');

            let taskUrl = taskSelect.value;
            
            // Handle default task creation
            if (taskUrl === 'CREATE_DEFAULT') {
                const newTask = await this.freeagentAPI.createDefaultTask(this.pendingTimeslip.projectUrl);
                taskUrl = newTask.url;
            }

            // Get form values
            const comment = commentInput.value || `Timer ${this.pendingTimeslip.timerId}: ${this.pendingTimeslip.clientName}`;
            const workDate = workDateInput.value;
            const roundingMinutes = parseInt(roundingSelect.value);
            const hoursToSubmit = this.pendingTimeslip.roundedHours || this.pendingTimeslip.hours;
            
            // Create the timeslip with time rounding and custom date
            await this.freeagentAPI.createTimeslip(
                this.pendingTimeslip.projectUrl,
                taskUrl,
                hoursToSubmit,
                comment,
                workDate,
                roundingMinutes
            );

            // Reset the timer's elapsed time since it's now logged
            this.timers[this.pendingTimeslip.timerId].elapsed = 0;
            await this.saveData();
            this.updateDisplay();

            this.closeTimeslipPanel();
            
            // Show success notification with details
            const timeMsg = roundingMinutes > 0 ? 
                `${this.formatTimeDecimal(hoursToSubmit)} hours (rounded from ${this.formatTimeDecimal(this.pendingTimeslip.hours)})` :
                `${this.formatTimeDecimal(hoursToSubmit)} hours`;
            this.showNotification(`✅ Timeslip created: ${timeMsg}`);

        } catch (error) {
            console.error('Error creating timeslip:', error);
            errorEl.textContent = 'Failed to create timeslip: ' + error.message;
            errorEl.classList.remove('hidden');
        } finally {
            createBtn.textContent = 'Create Timeslip';
            createBtn.disabled = false;
        }
    }

    formatTimeDecimal(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    async toggleDrafts() {
        const draftsSection = document.getElementById('drafts-section');
        const toggleBtn = document.getElementById('toggle-drafts');
        const draftsList = document.getElementById('drafts-list');

        if (draftsSection.classList.contains('hidden')) {
            // Show drafts
            draftsSection.classList.remove('hidden');
            toggleBtn.textContent = 'Hide';
            await this.loadAndDisplayDrafts();
        } else {
            // Hide drafts
            draftsSection.classList.add('hidden');
            toggleBtn.textContent = 'Show';
        }
    }

    async loadAndDisplayDrafts() {
        try {
            const result = await chrome.storage.local.get(['timeslipDrafts']);
            const drafts = result.timeslipDrafts || [];
            const draftsList = document.getElementById('drafts-list');

            if (drafts.length === 0) {
                draftsList.innerHTML = '<div class="draft-item">No saved drafts</div>';
                return;
            }

            // Sort drafts by save date (most recent first)
            drafts.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

            draftsList.innerHTML = drafts.map((draft, index) => {
                const savedDate = new Date(draft.savedAt);
                const formattedDate = savedDate.toLocaleDateString();
                const formattedTime = savedDate.toLocaleTimeString();

                return `
                    <div class="draft-item" data-draft-index="${index}">
                        <div class="draft-header">
                            <div class="draft-title">${draft.clientName} - ${draft.projectName}</div>
                            <div class="draft-time">${this.formatTimeDecimal(draft.roundedHours)}h</div>
                        </div>
                        <div class="draft-details">
                            <div><strong>Task:</strong> ${draft.taskName}</div>
                            <div><strong>Date:</strong> ${draft.workDate}</div>
                            <div><strong>Comment:</strong> ${draft.comment || 'No comment'}</div>
                            <div><strong>Saved:</strong> ${formattedDate} ${formattedTime}</div>
                        </div>
                        <div class="draft-actions">
                            <button class="draft-btn submit" onclick="timeTracker.submitDraft(${index})">Submit</button>
                            <button class="draft-btn delete" onclick="timeTracker.deleteDraft(${index})">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error loading drafts:', error);
            document.getElementById('drafts-list').innerHTML = '<div class="draft-item">Error loading drafts</div>';
        }
    }

    async submitDraft(draftIndex) {
        try {
            const result = await chrome.storage.local.get(['timeslipDrafts']);
            const drafts = result.timeslipDrafts || [];
            
            if (!drafts[draftIndex]) {
                throw new Error('Draft not found');
            }

            const draft = drafts[draftIndex];

            // Submit the draft as a timeslip
            await this.freeagentAPI.createTimeslip(
                draft.projectUrl,
                draft.taskUrl,
                draft.roundedHours,
                draft.comment,
                draft.workDate,
                draft.roundingMinutes
            );

            // Remove the draft from storage
            drafts.splice(draftIndex, 1);
            await chrome.storage.local.set({ timeslipDrafts: drafts });

            // Refresh the drafts display
            await this.loadAndDisplayDrafts();

            this.showNotification(`✅ Draft submitted: ${this.formatTimeDecimal(draft.roundedHours)} hours`);

        } catch (error) {
            console.error('Error submitting draft:', error);
            this.showNotification(`❌ Failed to submit draft: ${error.message}`, 'error');
        }
    }

    async deleteDraft(draftIndex) {
        try {
            const result = await chrome.storage.local.get(['timeslipDrafts']);
            const drafts = result.timeslipDrafts || [];
            
            if (!drafts[draftIndex]) {
                throw new Error('Draft not found');
            }

            // Remove the draft from storage
            drafts.splice(draftIndex, 1);
            await chrome.storage.local.set({ timeslipDrafts: drafts });

            // Refresh the drafts display
            await this.loadAndDisplayDrafts();

            this.showNotification('🗑️ Draft deleted');

        } catch (error) {
            console.error('Error deleting draft:', error);
            this.showNotification(`❌ Failed to delete draft: ${error.message}`, 'error');
        }
    }

    async loadDraftsIndicator() {
        try {
            const result = await chrome.storage.local.get(['timeslipDrafts']);
            const drafts = result.timeslipDrafts || [];
            const draftsSection = document.getElementById('drafts-section');
            const toggleBtn = document.getElementById('toggle-drafts');

            if (drafts.length > 0) {
                // Show drafts section and update button text
                draftsSection.classList.remove('hidden');
                toggleBtn.textContent = `Show (${drafts.length})`;
            } else {
                // Hide drafts section if no drafts
                draftsSection.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error loading drafts indicator:', error);
        }
    }

    async openSettingsPanel() {
        // Close any other open panels
        this.closeConfigPanel();
        
        const panel = document.getElementById('settings-panel');
        
        // Load current settings
        const result = await chrome.storage.local.get(['timeTrackingSettings']);
        const settings = result.timeTrackingSettings || this.getDefaultSettings();
        
        // Populate form
        document.getElementById('default-rounding').value = settings.defaultRounding;
        document.getElementById('rounding-method').value = settings.roundingMethod;
        document.getElementById('auto-save-drafts').checked = settings.autoSaveDrafts;
        document.getElementById('max-drafts').value = settings.maxDrafts;
        
        // Show panel with slide-down animation
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('show'), 10);
    }

    closeSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        panel.classList.remove('show');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }

    async saveSettings() {
        try {
            const settings = {
                defaultRounding: parseInt(document.getElementById('default-rounding').value),
                roundingMethod: document.getElementById('rounding-method').value,
                autoSaveDrafts: document.getElementById('auto-save-drafts').checked,
                maxDrafts: parseInt(document.getElementById('max-drafts').value)
            };

            await chrome.storage.local.set({ timeTrackingSettings: settings });
            this.closeSettingsPanel();
            this.showNotification('⚙️ Settings saved');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('❌ Failed to save settings', 'error');
        }
    }

    async resetSettings() {
        const settings = this.getDefaultSettings();
        
        // Populate form with defaults
        document.getElementById('default-rounding').value = settings.defaultRounding;
        document.getElementById('rounding-method').value = settings.roundingMethod;
        document.getElementById('auto-save-drafts').checked = settings.autoSaveDrafts;
        document.getElementById('max-drafts').value = settings.maxDrafts;
        
        this.showNotification('🔄 Settings reset to defaults');
    }

    getDefaultSettings() {
        return {
            defaultRounding: 30,      // 30-minute default rounding
            roundingMethod: 'round',  // Round to nearest
            autoSaveDrafts: true,     // Auto-save drafts
            maxDrafts: 10            // Keep max 10 drafts
        };
    }
}

// Global reference for draft button access
let timeTracker;

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
    timeTracker = new TimeTracker();
});