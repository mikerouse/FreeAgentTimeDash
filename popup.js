// Popup functionality for FreeAgent Time Tracker
class TimeTracker {
    constructor() {
        this.timers = {};
        this.clients = {};
        this.activeTimers = new Set();
        this.freeagentAPI = null; // Initialize later to avoid errors
        this.pendingTimeslip = null; // For task selection modal
        this.init().catch(error => {
            console.error('TimeTracker initialization failed:', error);
        });
    }

    async init() {
        console.log('TimeTracker initializing...');
        await this.loadData();
        console.log('Data loaded:', { clients: this.clients, freeagentConnected: this.freeagentConnected });
        this.setupEventListeners();
        this.updateDisplay();
        this.startUpdateLoop();
        await this.checkSetupStatus();
        console.log('TimeTracker initialized');
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
                1: { 
                    name: 'Client 1', 
                    color: '#FF5722',
                    project: null,
                    configured: false
                },
                2: { 
                    name: 'Client 2', 
                    color: '#2196F3',
                    project: null,
                    configured: false
                },
                3: { 
                    name: 'Client 3', 
                    color: '#4CAF50',
                    project: null,
                    configured: false
                }
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
        document.getElementById('config-btn')?.addEventListener('click', () => this.showConfigModal());

        // Configuration modal events
        document.getElementById('close-config')?.addEventListener('click', () => this.closeConfigModal());
        document.getElementById('cancel-config')?.addEventListener('click', () => this.closeConfigModal());
        document.getElementById('save-config')?.addEventListener('click', () => this.saveConfiguration());

        // Task modal events
        document.getElementById('close-task')?.addEventListener('click', () => this.closeTaskModal());
        document.getElementById('cancel-task')?.addEventListener('click', () => this.closeTaskModal());
        document.getElementById('create-timeslip')?.addEventListener('click', () => this.createTimeslip());

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
            setupSkipped: localStorage.getItem('setupSkipped')
        });
        
        const setupContainer = document.getElementById('setup-container');
        const mainContainer = document.getElementById('main-container');
        
        if (!this.freeagentConnected && !localStorage.getItem('setupSkipped')) {
            console.log('Showing setup container');
            setupContainer.classList.remove('hidden');
            mainContainer.style.display = 'none';
        } else {
            console.log('Showing main container');
            setupContainer.classList.add('hidden');
            mainContainer.style.display = 'block';
        }

        // Update sync status
        this.updateSyncStatus();
        
        // Ensure modals are hidden on startup
        const configModal = document.getElementById('config-modal');
        const taskModal = document.getElementById('task-modal');
        
        if (configModal) {
            configModal.classList.add('hidden');
            console.log('Config modal hidden');
        }
        if (taskModal) {
            taskModal.classList.add('hidden');
            console.log('Task modal hidden');
        }
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
        
        for (let i = 1; i <= 3; i++) {
            const timer = this.timers[i];
            const tile = document.querySelector(`.timer-tile[data-timer="${i}"]`);
            const display = document.getElementById(`timer-${i}-display`);
            const btn = document.getElementById(`timer-${i}-btn`);
            const nameEl = document.getElementById(`client-${i}-name`);
            
            // Update client name - show project info if configured
            const client = this.clients[i];
            if (client.configured && client.project) {
                nameEl.innerHTML = `<strong>${client.name}</strong><br><small>${client.project.name}</small>`;
            } else {
                nameEl.textContent = client.name;
            }
            
            // Update tile border color
            tile.style.borderLeftColor = client.color;
            
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

    // Configuration Modal Methods
    async showConfigModal() {
        if (!this.freeagentConnected) {
            this.showNotification('Please connect to FreeAgent first', 'error');
            return;
        }

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

        document.getElementById('config-modal').classList.remove('hidden');
        await this.loadProjectsForConfiguration();
    }

    closeConfigModal() {
        document.getElementById('config-modal').classList.add('hidden');
    }

    async loadProjectsForConfiguration() {
        const loadingEl = document.getElementById('loading-projects');
        const errorEl = document.getElementById('config-error');
        const configsEl = document.getElementById('timer-configs');

        try {
            loadingEl.classList.remove('hidden');
            errorEl.classList.add('hidden');
            configsEl.classList.add('hidden');

            // Initialize API if needed
            if (!this.freeagentAPI.isReady()) {
                await this.freeagentAPI.init();
            }

            const projects = await this.freeagentAPI.getProjects();
            
            // Populate project dropdowns
            for (let timerId = 1; timerId <= 3; timerId++) {
                const select = document.getElementById(`project-select-${timerId}`);
                const colorInput = document.getElementById(`color-select-${timerId}`);
                
                // Clear existing options
                select.innerHTML = '<option value="">Select Project...</option>';
                
                // Add projects grouped by client
                for (const [clientName, clientProjects] of Object.entries(projects)) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = clientName;
                    
                    clientProjects.forEach(project => {
                        const option = document.createElement('option');
                        option.value = project.url;
                        option.textContent = project.name;
                        option.dataset.clientName = project.contact_name;
                        option.dataset.projectName = project.name;
                        optgroup.appendChild(option);
                    });
                    
                    select.appendChild(optgroup);
                }

                // Set current values
                const client = this.clients[timerId];
                if (client.project) {
                    select.value = client.project.url;
                }
                colorInput.value = client.color;
            }

            loadingEl.classList.add('hidden');
            configsEl.classList.remove('hidden');

        } catch (error) {
            console.error('Error loading projects:', error);
            loadingEl.classList.add('hidden');
            errorEl.textContent = 'Failed to load projects: ' + error.message;
            errorEl.classList.remove('hidden');
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
            // Update client configurations
            for (let timerId = 1; timerId <= 3; timerId++) {
                const projectSelect = document.getElementById(`project-select-${timerId}`);
                const colorInput = document.getElementById(`color-select-${timerId}`);
                const client = this.clients[timerId];
                
                if (projectSelect.value) {
                    const selectedOption = projectSelect.selectedOptions[0];
                    client.project = {
                        url: projectSelect.value,
                        name: selectedOption.dataset.projectName,
                        contact_name: selectedOption.dataset.clientName
                    };
                    client.name = selectedOption.dataset.clientName;
                    client.configured = true;
                } else {
                    client.project = null;
                    client.name = `Client ${timerId}`;
                    client.configured = false;
                }
                
                client.color = colorInput.value;
            }

            await this.saveData();
            this.updateDisplay();
            this.closeConfigModal();
            this.showNotification('Configuration saved successfully!');

        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showNotification('Failed to save configuration: ' + error.message, 'error');
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

        // Show modal
        document.getElementById('task-project-name').textContent = `${client.name} - ${client.project.name}`;
        document.getElementById('task-time-logged').textContent = this.formatTimeDecimal(this.pendingTimeslip.hours);
        document.getElementById('task-modal').classList.remove('hidden');
        
        await this.loadTasksForSelection();
    }

    async loadTasksForSelection() {
        const taskSelect = document.getElementById('task-select');
        const errorEl = document.getElementById('task-error');
        
        try {
            taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
            errorEl.classList.add('hidden');

            const tasks = await this.freeagentAPI.getTasksForProject(this.pendingTimeslip.projectUrl);
            
            taskSelect.innerHTML = '<option value="">Select Task...</option>';
            
            if (tasks.length === 0) {
                // No tasks found - offer to create default
                const option = document.createElement('option');
                option.value = 'CREATE_DEFAULT';
                option.textContent = 'Create "General Work" task';
                taskSelect.appendChild(option);
            } else {
                tasks.forEach(task => {
                    const option = document.createElement('option');
                    option.value = task.url;
                    option.textContent = task.name;
                    if (task.is_billable) {
                        option.textContent += ` (Billable)`;
                    }
                    taskSelect.appendChild(option);
                });
            }

        } catch (error) {
            console.error('Error loading tasks:', error);
            errorEl.textContent = 'Failed to load tasks: ' + error.message;
            errorEl.classList.remove('hidden');
        }
    }

    closeTaskModal() {
        document.getElementById('task-modal').classList.add('hidden');
        this.pendingTimeslip = null;
    }

    async createTimeslip() {
        const taskSelect = document.getElementById('task-select');
        const commentInput = document.getElementById('task-comment');
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

            // Create the timeslip
            const comment = commentInput.value || `Timer ${this.pendingTimeslip.timerId}: ${this.pendingTimeslip.clientName}`;
            
            await this.freeagentAPI.createTimeslip(
                this.pendingTimeslip.projectUrl,
                taskUrl,
                this.pendingTimeslip.hours,
                comment
            );

            // Reset the timer's elapsed time since it's now logged
            this.timers[this.pendingTimeslip.timerId].elapsed = 0;
            await this.saveData();
            this.updateDisplay();

            this.closeTaskModal();
            this.showNotification(`✅ Timeslip created: ${this.formatTimeDecimal(this.pendingTimeslip.hours)} hours`);

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
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
    new TimeTracker();
});