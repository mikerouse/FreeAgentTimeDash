// FreeAgent API Client
class FreeAgentAPI {
    constructor() {
        this.baseUrl = 'https://api.freeagent.com/v2';
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.isDesktop = typeof window !== 'undefined' && window.electronAPI;
        
        this.loadSavedTokens();
    }

    async loadSavedTokens() {
        try {
            this.accessToken = await window.storageAdapter.get('freeagent_access_token');
            this.refreshToken = await window.storageAdapter.get('freeagent_refresh_token');
            this.tokenExpiry = await window.storageAdapter.get('freeagent_token_expiry');
            
            if (this.accessToken && this.tokenExpiry) {
                const now = Date.now();
                const expiry = new Date(this.tokenExpiry).getTime();
                
                if (now < expiry - 300000) {
                    const isValid = await this.testConnection();
                    if (isValid) {
                        console.log('✅ FreeAgent auto-connected');
                        return;
                    }
                }
                
                if (this.refreshToken) {
                    await this.refreshAccessToken();
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading saved tokens:', error);
            this.clearTokens();
        }
    }

    async saveTokens(tokenData) {
        this.accessToken = tokenData.access_token;
        this.refreshToken = tokenData.refresh_token;
        this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
        
        await window.storageAdapter.set('freeagent_access_token', this.accessToken);
        await window.storageAdapter.set('freeagent_refresh_token', this.refreshToken);
        await window.storageAdapter.set('freeagent_token_expiry', this.tokenExpiry);
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        
        window.storageAdapter.delete('freeagent_access_token');
        window.storageAdapter.delete('freeagent_refresh_token');
        window.storageAdapter.delete('freeagent_token_expiry');
    }

    isConnected() {
        return !!this.accessToken;
    }

    disconnect() {
        this.clearTokens();
    }

    async authenticate() {
        try {
            if (!this.isDesktop) {
                throw new Error('OAuth authentication only available in desktop app');
            }

            const tokenData = await window.electronAPI.freeagentAuthenticate();
            
            if (tokenData && tokenData.access_token) {
                await this.saveTokens(tokenData);
                return true;
            }
            
            throw new Error('No access token received');
        } catch (error) {
            console.error('Authentication error:', error);
            return false;
        }
    }

    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const tokenData = await window.electronAPI.freeagentRefreshToken(this.refreshToken);
            
            if (tokenData && tokenData.access_token) {
                await this.saveTokens(tokenData);
                return true;
            }
            
            throw new Error('Token refresh failed');
        } catch (error) {
            console.error('Token refresh error:', error);
            this.clearTokens();
            throw error;
        }
    }

    async testConnection() {
        if (!this.accessToken) return false;
        
        try {
            const response = await fetch(this.baseUrl + '/user', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + this.accessToken,
                    'Accept': 'application/json'
                }
            });
            
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        if (!this.accessToken) {
            throw new Error('Not authenticated with FreeAgent');
        }

        if (this.tokenExpiry) {
            const now = Date.now();
            const expiry = new Date(this.tokenExpiry).getTime();
            
            if (now >= expiry - 300000) {
                await this.refreshAccessToken();
            }
        }

        const url = endpoint.startsWith('http') ? endpoint : this.baseUrl + endpoint;
        const options = {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + this.accessToken,
                'Accept': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    options.headers['Authorization'] = 'Bearer ' + this.accessToken;
                    const retryResponse = await fetch(url, options);
                    
                    if (!retryResponse.ok) {
                        throw new Error(`FreeAgent API error: ${retryResponse.status}`);
                    }
                    
                    return await retryResponse.json();
                }
                
                throw new Error(`FreeAgent API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('FreeAgent API request error:', error);
            throw error;
        }
    }

    async getContacts() {
        const response = await this.makeRequest('/contacts');
        const contacts = {};
        
        if (response.contacts) {
            response.contacts.forEach(contact => {
                contacts[contact.url] = {
                    displayName: contact.organisation_name || `${contact.first_name} ${contact.last_name}`,
                    organisation_name: contact.organisation_name,
                    first_name: contact.first_name,
                    last_name: contact.last_name
                };
            });
        }
        
        return contacts;
    }

    async getProjects(contactUrl = null) {
        let url = '/projects';
        if (contactUrl) {
            url += '?contact=' + encodeURIComponent(contactUrl);
        }
        
        const response = await this.makeRequest(url);
        const projects = {};
        
        if (response.projects) {
            response.projects.forEach(project => {
                projects[project.url] = {
                    name: project.name,
                    currency: project.currency,
                    budget: project.budget
                };
            });
        }
        
        return projects;
    }

    async getTasks(projectUrl) {
        const response = await this.makeRequest('/tasks?project=' + encodeURIComponent(projectUrl));
        
        if (response.tasks && response.tasks.length > 0) {
            return response.tasks.map(task => ({
                url: task.url,
                name: task.name,
                is_billable: task.is_billable
            }));
        } else {
            return [await this.createDefaultTask(projectUrl)];
        }
    }

    async createDefaultTask(projectUrl) {
        const taskData = {
            task: {
                project: projectUrl,
                name: 'General',
                is_billable: true
            }
        };
        
        const response = await this.makeRequest('/tasks', 'POST', taskData);
        
        return {
            url: response.task.url,
            name: response.task.name,
            is_billable: response.task.is_billable
        };
    }

    roundTime(hours, roundingMinutes = 30, method = 'round') {
        if (roundingMinutes === 0) return hours;
        
        const roundingHours = roundingMinutes / 60;
        
        if (method === 'up') {
            return Math.ceil(hours / roundingHours) * roundingHours;
        } else {
            return Math.round(hours / roundingHours) * roundingHours;
        }
    }

    async createTimeslip(projectUrl, taskUrl, hours, comment = '', workDate = null, roundingMinutes = 30, roundingMethod = 'round') {
        const roundedHours = this.roundTime(hours, roundingMinutes, roundingMethod);
        
        const timeslipData = {
            timeslip: {
                project: projectUrl,
                task: taskUrl,
                hours: roundedHours,
                comment: comment,
                dated_on: workDate || new Date().toISOString().split('T')[0]
            }
        };
        
        const response = await this.makeRequest('/timeslips', 'POST', timeslipData);
        return response.timeslip;
    }
}