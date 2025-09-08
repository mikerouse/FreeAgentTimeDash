// FreeAgent API Service for Time Tracker
class FreeAgentAPI {
	constructor() {
		this.auth = new FreeAgentAuth();
		this.currentUser = null;
		this.projectsCache = null;
		this.tasksCache = new Map();
	}

	/**
	 * Initialize the API service
	 */
	async init() {
		try {
			await this.loadCurrentUser();
			return true;
		} catch (error) {
			console.error('FreeAgent API init failed:', error);
			return false;
		}
	}

	/**
	 * Load current user information
	 */
	async loadCurrentUser() {
		const response = await this.auth.apiRequest('/users/me');
		if (response.ok) {
			const data = await response.json();
			this.currentUser = data.user;
			console.log('Current user loaded:', this.currentUser);
		} else {
			throw new Error('Failed to load current user');
		}
	}

	/**
	 * Get all active projects grouped by client
	 */
	async getProjects(forceRefresh = false) {
		if (this.projectsCache && !forceRefresh) {
			return this.projectsCache;
		}

		try {
			const response = await this.auth.apiRequest('/projects?view=active&nested=true');
			if (!response.ok) {
				throw new Error(`Failed to load projects: ${response.status}`);
			}

			const data = await response.json();
			const projects = data.projects || [];

			// Group projects by client (contact_name)
			const groupedProjects = {};
			projects.forEach(project => {
				const clientName = project.contact_name || 'Unknown Client';
				if (!groupedProjects[clientName]) {
					groupedProjects[clientName] = [];
				}
				groupedProjects[clientName].push({
					url: project.url,
					name: project.name,
					contact_name: project.contact_name,
					currency: project.currency,
					billing_rate: project.normal_billing_rate,
					billing_period: project.billing_period
				});
			});

			this.projectsCache = groupedProjects;
			return groupedProjects;
		} catch (error) {
			console.error('Error loading projects:', error);
			throw error;
		}
	}

	/**
	 * Get tasks for a specific project
	 */
	async getTasksForProject(projectUrl, forceRefresh = false) {
		if (this.tasksCache.has(projectUrl) && !forceRefresh) {
			return this.tasksCache.get(projectUrl);
		}

		try {
			const response = await this.auth.apiRequest(`/tasks?project=${encodeURIComponent(projectUrl)}&view=active`);
			if (!response.ok) {
				throw new Error(`Failed to load tasks: ${response.status}`);
			}

			const data = await response.json();
			const tasks = (data.tasks || []).map(task => ({
				url: task.url,
				name: task.name,
				project: task.project,
				is_billable: task.is_billable,
				billing_rate: task.billing_rate,
				billing_period: task.billing_period,
				currency: task.currency
			}));

			this.tasksCache.set(projectUrl, tasks);
			return tasks;
		} catch (error) {
			console.error('Error loading tasks:', error);
			throw error;
		}
	}

	/**
	 * Create a timeslip
	 */
	async createTimeslip(projectUrl, taskUrl, hours, comment = '') {
		if (!this.currentUser) {
			throw new Error('Current user not loaded. Call init() first.');
		}

		const timeslipData = {
			timeslip: {
				task: taskUrl,
				user: this.currentUser.url,
				project: projectUrl,
				dated_on: new Date().toISOString().split('T')[0],
				hours: Math.round(hours * 100) / 100, // Round to 2 decimal places
				comment: comment
			}
		};

		try {
			const response = await this.auth.apiRequest('/timeslips', {
				method: 'POST',
				body: JSON.stringify(timeslipData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Failed to create timeslip: ${JSON.stringify(errorData)}`);
			}

			const result = await response.json();
			console.log('Timeslip created successfully:', result);
			return result.timeslip;
		} catch (error) {
			console.error('Error creating timeslip:', error);
			throw error;
		}
	}

	/**
	 * Create a default task for a project if none exist
	 */
	async createDefaultTask(projectUrl, taskName = 'General Work') {
		try {
			const taskData = {
				task: {
					name: taskName,
					is_billable: true,
					status: 'Active'
				}
			};

			const response = await this.auth.apiRequest(`/tasks?project=${encodeURIComponent(projectUrl)}`, {
				method: 'POST',
				body: JSON.stringify(taskData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Failed to create task: ${JSON.stringify(errorData)}`);
			}

			const result = await response.json();
			
			// Clear cache for this project
			this.tasksCache.delete(projectUrl);
			
			return result.task;
		} catch (error) {
			console.error('Error creating default task:', error);
			throw error;
		}
	}

	/**
	 * Get project info by URL
	 */
	async getProjectByUrl(projectUrl) {
		const projects = await this.getProjects();
		for (const client in projects) {
			const project = projects[client].find(p => p.url === projectUrl);
			if (project) return project;
		}
		return null;
	}

	/**
	 * Check if API is ready (user is authenticated and initialized)
	 */
	isReady() {
		return this.currentUser !== null;
	}

	/**
	 * Clear caches
	 */
	clearCache() {
		this.projectsCache = null;
		this.tasksCache.clear();
	}
}

// Make available globally
window.FreeAgentAPI = FreeAgentAPI;