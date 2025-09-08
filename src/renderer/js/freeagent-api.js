// FreeAgent API for Desktop App - Enhanced for Electron
class FreeAgentAPI {
    constructor() {
        this.baseURL = 'https://api.freeagent.com/v2';
        this.clientId = 'YOUR_DESKTOP_CLIENT_ID'; // Desktop app client ID
        this.redirectUri = 'http://localhost:8080/oauth/callback'; // Local OAuth server
        this.accessToken = null;
        this.userData = null;
        this.projects = {};
        this.contacts = {};
        this.tasks = {};
        this.isDesktop = typeof window !== 'undefined' && window.electronAPI;
        this.init();
    }

    async init() {
        console.log('FreeAgent API initializing for desktop...');
        try {
            // Load stored access token
            const token = await window.storageAdapter.get('freeagent_access_token');
            if (token) {
                this.accessToken = token;
                await this.loadCurrentUser();
            }
        } catch (error) {
            console.error('FreeAgent API init error:', error);
        }
    }

    // Desktop OAuth flow using local server
    async authenticate() {
        try {
            if (this.isDesktop && window.electronAPI) {
                // Get redirect URI from main process
                this.redirectUri = await window.electronAPI.getOAuthRedirectUri();
                
                // Show notification about OAuth process
                window.electronAPI.showNotification(
                    'FreeAgent Authentication',
                    'Opening browser for FreeAgent login...'
                );
            }

            // Create OAuth URL
            const authUrl = `https://api.freeagent.com/v2/approve_app` +
                `?client_id=${this.clientId}` +
                `&response_type=code` +
                `&redirect_uri=${encodeURIComponent(this.redirectUri)}`;

            if (this.isDesktop && window.electronAPI) {
                // Use Electron OAuth flow
                const result = await window.electronAPI.startOAuthFlow(this.clientId, authUrl);
                
                if (result.success) {
                    await this.exchangeCodeForToken(result.code);
                    return true;
                } else {
                    throw new Error(result.error || 'OAuth flow failed');
                }
            } else {
                // Fallback for development
                const authCode = prompt(`Please visit this URL to authorize:\n\n${authUrl}\n\nThen paste the authorization code here:`);
                
                if (authCode) {
                    await this.exchangeCodeForToken(authCode);
                    return true;
                }
                
                return false;
            }
            
        } catch (error) {
            console.error('Authentication error:', error);
            
            if (this.isDesktop) {
                window.electronAPI.showNotification(
                    'Authentication Error',
                    error.message
                );
            }
            
            throw error;
        }
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(code) {
        try {
            const response = await fetch('https://api.freeagent.com/v2/token_endpoint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: 'YOUR_CLIENT_SECRET', // In production, this should be secured
                    code: code,
                    grant_type: 'authorization_code',
                    redirect_uri: this.redirectUri
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.access_token;
                
                // Store token securely
                await window.storageAdapter.set('freeagent_access_token', this.accessToken);
                
                // Load user data
                await this.loadCurrentUser();
                
                if (this.isDesktop) {
                    window.electronAPI.showNotification(
                        'FreeAgent Connected',
                        'Successfully connected to FreeAgent!'
                    );
                }
                
                return true;
            } else {
                throw new Error('Token exchange failed');
            }
        } catch (error) {
            console.error('Token exchange error:', error);
            throw error;
        }
    }

    // Make authenticated API request
    async makeRequest(endpoint, method = 'GET', data = null) {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'FreeAgent Time Tracker Desktop v1.0'
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (response.status === 401) {
                // Token expired, clear it
                this.accessToken = null;
                await window.storageAdapter.delete('freeagent_access_token');
                throw new Error('Authentication expired');
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request error (${method} ${endpoint}):`, error);
            throw error;
        }
    }

    // Load current user data
    async loadCurrentUser() {
        try {
            const response = await this.makeRequest('/users/me');
            this.userData = response.user;
            console.log('Current user loaded:', this.userData);
            return this.userData;
        } catch (error) {
            console.error('Load current user error:', error);
            throw error;
        }
    }

    // Get contacts (clients)
    async getContacts() {
        try {
            const cachedContacts = await window.storageAdapter.get('freeagent_contacts');
            const lastFetch = await window.storageAdapter.get('contacts_last_fetch', 0);
            const now = Date.now();

            // Use cache if less than 1 hour old
            if (cachedContacts && (now - lastFetch) < 3600000) {
                this.contacts = cachedContacts;
                return this.contacts;
            }

            console.log('Fetching contacts from API...');
            const response = await this.makeRequest('/contacts?view=active&sort=name');
            
            const contactsMap = {};
            response.contacts.forEach(contact => {
                const displayName = contact.organisation_name || 
                                 `${contact.first_name} ${contact.last_name}`.trim() || 
                                 'Unnamed Contact';
                
                contactsMap[contact.url] = {
                    ...contact,
                    displayName
                };
            });

            this.contacts = contactsMap;
            
            // Cache contacts
            await window.storageAdapter.set('freeagent_contacts', this.contacts);
            await window.storageAdapter.set('contacts_last_fetch', now);
            
            console.log(`Loaded ${Object.keys(this.contacts).length} contacts`);
            return this.contacts;
        } catch (error) {
            console.error('Get contacts error:', error);
            throw error;
        }
    }

    // Get projects, optionally filtered by contact
    async getProjects(contactUrl = null) {
        try {
            let endpoint = '/projects?view=active&sort=name';
            if (contactUrl) {
                endpoint += `&contact=${encodeURIComponent(contactUrl)}`;
            }

            const cacheKey = contactUrl ? `projects_${contactUrl}` : 'all_projects';
            const cachedProjects = await window.storageAdapter.get(cacheKey);
            const lastFetch = await window.storageAdapter.get(`${cacheKey}_last_fetch`, 0);
            const now = Date.now();

            // Use cache if less than 1 hour old
            if (cachedProjects && (now - lastFetch) < 3600000) {
                return cachedProjects;
            }

            console.log('Fetching projects from API...', contactUrl ? `for contact ${contactUrl}` : 'all projects');
            const response = await this.makeRequest(endpoint);
            
            const projectsMap = {};
            response.projects.forEach(project => {
                projectsMap[project.url] = project;
            });

            // Cache projects
            await window.storageAdapter.set(cacheKey, projectsMap);
            await window.storageAdapter.set(`${cacheKey}_last_fetch`, now);
            
            console.log(`Loaded ${Object.keys(projectsMap).length} projects`);
            return projectsMap;
        } catch (error) {
            console.error('Get projects error:', error);
            throw error;
        }
    }

    // Get tasks for a project
    async getTasks(projectUrl) {
        try {
            const cacheKey = `tasks_${projectUrl}`;
            const cachedTasks = await window.storageAdapter.get(cacheKey);
            const lastFetch = await window.storageAdapter.get(`${cacheKey}_last_fetch`, 0);
            const now = Date.now();

            // Use cache if less than 30 minutes old
            if (cachedTasks && (now - lastFetch) < 1800000) {
                return cachedTasks;
            }

            console.log('Fetching tasks from API for project:', projectUrl);
            const response = await this.makeRequest(`/tasks?project=${encodeURIComponent(projectUrl)}`);
            
            let tasks = response.tasks || [];
            
            // If no tasks exist, create a default one
            if (tasks.length === 0) {
                console.log('No tasks found, creating default task...');
                const defaultTask = await this.createDefaultTask(projectUrl);
                if (defaultTask) {
                    tasks = [defaultTask];
                }
            }

            // Cache tasks
            await window.storageAdapter.set(cacheKey, tasks);
            await window.storageAdapter.set(`${cacheKey}_last_fetch`, now);
            
            console.log(`Loaded ${tasks.length} tasks for project`);
            return tasks;
        } catch (error) {
            console.error('Get tasks error:', error);
            throw error;
        }
    }

    // Create default task if none exist
    async createDefaultTask(projectUrl) {
        try {
            const taskData = {
                task: {
                    project: projectUrl,
                    name: 'General Work',
                    is_billable: true,
                    status: 'Active'
                }
            };

            const response = await this.makeRequest('/tasks', 'POST', taskData);
            console.log('Created default task:', response.task);
            return response.task;
        } catch (error) {
            console.error('Create default task error:', error);
            return null;
        }
    }

    // Time rounding methods
    roundTime(hours, roundingMinutes = 30, method = 'round') {
        if (roundingMinutes === 0) {
            return hours;
        }

        const intervalHours = roundingMinutes / 60;
        
        if (method === 'up') {
            return Math.ceil(hours / intervalHours) * intervalHours;
        } else {
            return Math.round(hours / intervalHours) * intervalHours;
        }
    }

    // Create timeslip
    async createTimeslip(projectUrl, taskUrl, hours, comment = '', workDate = null, roundingMinutes = 30, roundingMethod = 'round') {
        try {
            // Validate inputs
            if (!projectUrl || !taskUrl) {
                throw new Error('Project and task are required');
            }

            if (!hours || hours <= 0) {
                throw new Error('Hours must be positive');
            }

            if (hours > 24) {
                throw new Error('Cannot log more than 24 hours per day');
            }

            // Apply time rounding
            const roundedHours = this.roundTime(hours, roundingMinutes, roundingMethod);
            
            // Set work date
            const targetDate = workDate || new Date().toISOString().split('T')[0];

            // Get user URL
            if (!this.userData) {
                await this.loadCurrentUser();
            }

            const timeslipData = {
                timeslip: {
                    task: taskUrl,
                    user: this.userData.url,
                    project: projectUrl,
                    dated_on: targetDate,
                    hours: roundedHours,
                    comment: comment || 'Time tracked via FreeAgent Time Tracker'
                }
            };

            console.log('Creating timeslip:', timeslipData);
            const response = await this.makeRequest('/timeslips', 'POST', timeslipData);
            
            if (this.isDesktop) {
                window.electronAPI.showNotification(
                    'Timeslip Created',
                    `${roundedHours}h logged successfully`
                );
            }
            
            console.log('Timeslip created:', response.timeslip);
            return response.timeslip;
        } catch (error) {
            console.error('Create timeslip error:', error);
            
            if (this.isDesktop) {
                window.electronAPI.showNotification(
                    'Timeslip Error',
                    `Failed to create timeslip: ${error.message}`
                );
            }
            
            throw error;
        }
    }

    // Get timeslips with filtering
    async getTimeslips(options = {}) {
        try {
            const params = new URLSearchParams();
            
            if (options.from_date) params.append('from_date', options.from_date);
            if (options.to_date) params.append('to_date', options.to_date);
            if (options.project) params.append('project', options.project);
            if (options.user) params.append('user', options.user);
            if (options.view) params.append('view', options.view);

            const endpoint = `/timeslips${params.toString() ? '?' + params.toString() : ''}`;
            console.log('Fetching timeslips:', endpoint);
            
            const response = await this.makeRequest(endpoint);
            return response.timeslips || [];
        } catch (error) {
            console.error('Get timeslips error:', error);
            throw error;
        }
    }

    // Get unbilled timeslips
    async getUnbilledTimeslips() {
        return this.getTimeslips({ view: 'unbilled' });
    }

    // Check if connected
    isConnected() {
        return !!this.accessToken && !!this.userData;
    }

    // Get connection status
    getConnectionStatus() {
        if (this.isConnected()) {
            return {
                connected: true,
                user: this.userData,
                message: `Connected as ${this.userData.first_name} ${this.userData.last_name}`
            };
        } else {
            return {
                connected: false,
                user: null,
                message: 'Not connected to FreeAgent'
            };
        }
    }

    // Disconnect
    async disconnect() {
        this.accessToken = null;
        this.userData = null;
        this.projects = {};
        this.contacts = {};
        this.tasks = {};
        
        // Clear stored data
        await window.storageAdapter.delete('freeagent_access_token');
        await window.storageAdapter.delete('freeagent_contacts');
        
        if (this.isDesktop) {
            window.electronAPI.showNotification(
                'FreeAgent Disconnected',
                'Successfully disconnected from FreeAgent'
            );
        }
    }

    // Clear cache
    async clearCache() {
        const keys = await window.storageAdapter.getAllKeys();
        const cacheKeys = keys.filter(key => 
            key.startsWith('freeagent_') || 
            key.includes('_last_fetch') ||
            key.includes('projects_') ||
            key.includes('tasks_')
        );
        
        for (const key of cacheKeys) {
            await window.storageAdapter.delete(key);
        }
        
        console.log('FreeAgent cache cleared');
    }
}