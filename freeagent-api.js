// FreeAgent API Service for Time Tracker
class FreeAgentAPI {
	constructor() {
		this.auth = new FreeAgentAuth();
		this.currentUser = null;
		this.projectsCache = null;
		this.contactsCache = null;
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
	 * Get all contacts (clients)
	 * Following FreeAgent API best practices from docs/contacts.md
	 */
	async getContacts(forceRefresh = false) {
		if (this.contactsCache && !forceRefresh) {
			return this.contactsCache;
		}

		try {
			// Use optimal API parameters as per documentation:
			// - view=clients: Show clients (contacts who can have projects) - more specific than 'active'
			// - sort=name: Sort by concatenation of organisation_name, last_name and first_name (default)
			const response = await this.auth.apiRequest('/contacts?view=clients&sort=name');
			if (!response.ok) {
				throw new Error(`Failed to load contacts: ${response.status}`);
			}

			const data = await response.json();
			const contacts = data.contacts || [];

			// Create a map of contact URL to contact data for easy lookup
			const contactsMap = {};
			contacts.forEach(contact => {
				// Follow FreeAgent naming convention as per docs:
				// organisation_name takes priority, fallback to first_name + last_name
				let displayName;
				if (contact.organisation_name) {
					displayName = contact.organisation_name;
				} else if (contact.first_name || contact.last_name) {
					displayName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
				} else {
					displayName = 'Unnamed Contact';
				}

				contactsMap[contact.url] = {
					url: contact.url,
					name: displayName,
					organisation_name: contact.organisation_name,
					first_name: contact.first_name,
					last_name: contact.last_name,
					email: contact.email,
					active_projects_count: contact.active_projects_count || 0,
					status: contact.status,
					created_at: contact.created_at,
					updated_at: contact.updated_at
				};
			});

			this.contactsCache = contactsMap;
			console.log(`Loaded ${contacts.length} client contacts for project selection`);
			return contactsMap;
		} catch (error) {
			console.error('Error loading contacts:', error);
			throw error;
		}
	}

	/**
	 * Get contacts who have active projects only
	 * More efficient for time tracking - only shows clients with billable work
	 */
	async getContactsWithActiveProjects(forceRefresh = false) {
		try {
			// Use the specialized view=active_projects filter as per docs
			const response = await this.auth.apiRequest('/contacts?view=active_projects&sort=name');
			if (!response.ok) {
				throw new Error(`Failed to load contacts with active projects: ${response.status}`);
			}

			const data = await response.json();
			const contacts = data.contacts || [];

			// Create a map similar to getContacts but filtered to only active project clients
			const contactsMap = {};
			contacts.forEach(contact => {
				let displayName;
				if (contact.organisation_name) {
					displayName = contact.organisation_name;
				} else if (contact.first_name || contact.last_name) {
					displayName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
				} else {
					displayName = 'Unnamed Contact';
				}

				contactsMap[contact.url] = {
					url: contact.url,
					name: displayName,
					organisation_name: contact.organisation_name,
					first_name: contact.first_name,
					last_name: contact.last_name,
					email: contact.email,
					active_projects_count: contact.active_projects_count || 0,
					status: contact.status
				};
			});

			console.log(`Loaded ${contacts.length} contacts with active projects`);
			return contactsMap;
		} catch (error) {
			console.error('Error loading contacts with active projects:', error);
			throw error;
		}
	}

	/**
	 * Get all active projects grouped by client
	 * Following FreeAgent API best practices from docs/projects.md
	 */
	async getProjects(forceRefresh = false) {
		if (this.projectsCache && !forceRefresh) {
			return this.projectsCache;
		}

		try {
			// Load contacts first to ensure we have client names
			const contacts = await this.getContacts(forceRefresh);

			// Use optimal API parameters as per documentation:
			// - view=active: Only show active projects for time tracking
			// - sort=contact: Group by contact for better organization
			const response = await this.auth.apiRequest('/projects?view=active&sort=contact');
			if (!response.ok) {
				throw new Error(`Failed to load projects: ${response.status}`);
			}

			const data = await response.json();
			const projects = data.projects || [];

			// Group projects by client using the contacts data
			const groupedProjects = {};
			projects.forEach(project => {
				// Look up the contact information from our contacts cache
				const contact = contacts[project.contact];
				const clientName = contact ? contact.name : 'Unknown Client';
				
				if (!groupedProjects[clientName]) {
					groupedProjects[clientName] = [];
				}
				
				// Store essential fields for timeslip creation as per docs
				groupedProjects[clientName].push({
					url: project.url,                    // Required for creating timeslips
					name: project.name,                  // Display name
					contact: project.contact,            // Contact URI
					contact_name: clientName,            // Resolved client name
					currency: project.currency,          // For billing calculations
					billing_rate: project.normal_billing_rate, // Default rate
					billing_period: project.billing_period,
					status: project.status,              // Visual indicators
					budget: project.budget,              // Project budget info
					budget_units: project.budget_units,  // Hours/Days/Monetary
					hours_per_day: project.hours_per_day, // Working hours per day
					starts_on: project.starts_on,       // Project timeline
					ends_on: project.ends_on
				});
			});

			// Sort projects within each client group by name
			Object.keys(groupedProjects).forEach(clientName => {
				groupedProjects[clientName].sort((a, b) => a.name.localeCompare(b.name));
			});

			this.projectsCache = groupedProjects;
			console.log(`Loaded ${projects.length} active projects grouped by ${Object.keys(groupedProjects).length} clients`);
			return groupedProjects;
		} catch (error) {
			console.error('Error loading projects:', error);
			throw error;
		}
	}

	/**
	 * Get projects for a specific contact/client
	 */
	async getProjectsForContact(contactUrl, forceRefresh = false) {
		try {
			const response = await this.auth.apiRequest(`/projects?view=active&contact=${encodeURIComponent(contactUrl)}&sort=name`);
			if (!response.ok) {
				throw new Error(`Failed to load projects for contact: ${response.status}`);
			}

			const data = await response.json();
			const projects = (data.projects || []).map(project => ({
				url: project.url,
				name: project.name,
				contact: project.contact,
				currency: project.currency,
				billing_rate: project.normal_billing_rate,
				billing_period: project.billing_period,
				status: project.status,
				budget: project.budget,
				budget_units: project.budget_units
			}));

			return projects;
		} catch (error) {
			console.error('Error loading projects for contact:', error);
			throw error;
		}
	}

	/**
	 * Get tasks for a specific project
	 * Following FreeAgent API best practices from docs/tasks.md
	 */
	async getTasksForProject(projectUrl, forceRefresh = false) {
		if (this.tasksCache.has(projectUrl) && !forceRefresh) {
			return this.tasksCache.get(projectUrl);
		}

		try {
			// Use optimal API parameters as per documentation:
			// - view=active: Only show active tasks for time tracking
			// - project filter: Tasks for specific project
			const response = await this.auth.apiRequest(`/tasks?project=${encodeURIComponent(projectUrl)}&view=active&sort=name`);
			if (!response.ok) {
				throw new Error(`Failed to load tasks: ${response.status}`);
			}

			const data = await response.json();
			const tasks = (data.tasks || []).map(task => ({
				url: task.url,                    // Required for creating timeslips
				name: task.name,                  // Task display name
				project: task.project,            // Project association
				is_billable: task.is_billable,    // Billing flag
				billing_rate: task.billing_rate,  // Task-specific rate
				billing_period: task.billing_period, // hour/day
				currency: task.currency,          // Task currency
				status: task.status               // Active/Completed/Hidden
			}));

			// If no tasks exist, we could create a default one as per docs recommendation
			// But we'll let the UI handle this decision
			if (tasks.length === 0) {
				console.log(`No active tasks found for project ${projectUrl}. Consider creating a default task.`);
			}

			this.tasksCache.set(projectUrl, tasks);
			console.log(`Loaded ${tasks.length} active tasks for project`);
			return tasks;
		} catch (error) {
			console.error('Error loading tasks:', error);
			throw error;
		}
	}

	/**
	 * Create a timeslip
	 * Following FreeAgent API best practices from docs/timeslips.md
	 */
	async createTimeslip(projectUrl, taskUrl, hours, comment = '', workDate = null, roundingMinutes = 30) {
		if (!this.currentUser) {
			throw new Error('Current user not loaded. Call init() first.');
		}

		// Apply time rounding (default 30 minutes)
		const roundedHours = this.roundTime(hours, roundingMinutes);

		// Pre-validate data using validation method
		const validation = this.validateTimeslipData(projectUrl, taskUrl, roundedHours, workDate);
		if (!validation.isValid) {
			throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
		}

		// Convert to proper decimal precision for API
		const finalHours = Math.round(roundedHours * 100) / 100; // Round to 2 decimal places
		
		// Use provided date or default to today - allows backdating
		const targetDate = workDate || new Date().toISOString().split('T')[0];
		
		const timeslipData = {
			timeslip: {
				task: taskUrl,                                          // Required: URI of the task
				user: this.currentUser.url,                            // Required: URI of the user
				project: projectUrl,                                    // Required: URI of the project
				dated_on: targetDate,                                   // Required: Work date in YYYY-MM-DD
				hours: finalHours,                                      // Required: Decimal hours (rounded)
				comment: comment || `Auto-tracked time entry`          // Optional: Description of work
			}
		};

		try {
			console.log('Creating timeslip:', timeslipData);
			
			const response = await this.auth.apiRequest('/timeslips', {
				method: 'POST',
				body: JSON.stringify(timeslipData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Timeslip creation failed:', errorData);
				
				// Enhanced error handling as per docs
				if (response.status === 422) {
					throw new Error(`Validation error: ${JSON.stringify(errorData.errors || errorData)}`);
				} else if (response.status === 403) {
					throw new Error('Permission denied: You may not have access to this project or task');
				} else {
					throw new Error(`API error (${response.status}): ${JSON.stringify(errorData)}`);
				}
			}

			const result = await response.json();
			console.log('Timeslip created successfully:', {
				id: result.timeslip?.url,
				hours: result.timeslip?.hours,
				project: result.timeslip?.project,
				task: result.timeslip?.task,
				dated_on: result.timeslip?.dated_on
			});
			
			return result.timeslip;
		} catch (error) {
			console.error('Error creating timeslip:', error);
			throw error;
		}
	}

	/**
	 * Create multiple timeslips in batch
	 * More efficient for multiple timer submissions
	 * Following FreeAgent API best practices from docs/timeslips.md
	 */
	async createTimeslipsBatch(timeslipRequests) {
		if (!this.currentUser) {
			throw new Error('Current user not loaded. Call init() first.');
		}

		if (!Array.isArray(timeslipRequests) || timeslipRequests.length === 0) {
			throw new Error('Timeslip requests array is required and must not be empty');
		}

		const results = [];
		const errors = [];

		// Process each timeslip sequentially to avoid API rate limits
		for (let i = 0; i < timeslipRequests.length; i++) {
			const request = timeslipRequests[i];
			try {
				const result = await this.createTimeslip(
					request.projectUrl,
					request.taskUrl,
					request.hours,
					request.comment,
					request.workDate
				);
				results.push({ success: true, result, index: i });
			} catch (error) {
				console.error(`Batch timeslip ${i} failed:`, error);
				errors.push({ success: false, error: error.message, index: i });
			}

			// Add small delay between requests to respect API limits
			if (i < timeslipRequests.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		console.log(`Batch timeslip creation completed: ${results.length} successful, ${errors.length} failed`);
		
		return {
			successful: results,
			failed: errors,
			totalCount: timeslipRequests.length,
			successCount: results.length,
			failureCount: errors.length
		};
	}

	/**
	 * Validate timeslip data before submission
	 * Following FreeAgent API validation requirements from docs/timeslips.md
	 */
	validateTimeslipData(projectUrl, taskUrl, hours, workDate = null) {
		const errors = [];

		// Required field validation
		if (!projectUrl) {
			errors.push('Project URL is required');
		}
		if (!taskUrl) {
			errors.push('Task URL is required');
		}
		if (hours === null || hours === undefined) {
			errors.push('Hours is required');
		}

		// Data format validation
		if (typeof hours !== 'number' || hours <= 0) {
			errors.push('Hours must be a positive number');
		}
		if (hours > 24) {
			errors.push('Hours cannot exceed 24 in a single day');
		}

		// Date validation
		if (workDate) {
			const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
			if (!dateRegex.test(workDate)) {
				errors.push('Work date must be in YYYY-MM-DD format');
			} else {
				const date = new Date(workDate);
				const today = new Date();
				const maxPastDays = 365; // Allow up to 1 year backdating
				
				if (date > today) {
					errors.push('Work date cannot be in the future');
				}
				if ((today - date) / (1000 * 60 * 60 * 24) > maxPastDays) {
					errors.push('Work date cannot be more than 1 year in the past');
				}
			}
		}

		// URL format validation (basic check)
		const urlRegex = /^https:\/\/api\.freeagent\.com\/v2\//;
		if (projectUrl && !urlRegex.test(projectUrl)) {
			errors.push('Project URL must be a valid FreeAgent API URL');
		}
		if (taskUrl && !urlRegex.test(taskUrl)) {
			errors.push('Task URL must be a valid FreeAgent API URL');
		}

		return {
			isValid: errors.length === 0,
			errors: errors
		};
	}

	/**
	 * Create a default task for a project if none exist
	 * Following FreeAgent API best practices from docs/tasks.md
	 */
	async createDefaultTask(projectUrl, taskName = 'General Work') {
		try {
			const taskData = {
				task: {
					name: taskName,
					is_billable: true,      // Default to billable as per docs recommendation
					status: 'Active'        // Set to active for immediate use
				}
			};

			console.log(`Creating default task "${taskName}" for project`);
			
			const response = await this.auth.apiRequest(`/tasks?project=${encodeURIComponent(projectUrl)}`, {
				method: 'POST',
				body: JSON.stringify(taskData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Default task creation failed:', errorData);
				throw new Error(`Failed to create task: ${JSON.stringify(errorData.errors || errorData)}`);
			}

			const result = await response.json();
			console.log('Default task created successfully:', result.task);
			
			// Clear cache for this project to include the new task
			this.tasksCache.delete(projectUrl);
			
			return result.task;
		} catch (error) {
			console.error('Error creating default task:', error);
			throw error;
		}
	}

	/**
	 * Get tasks for a project, creating a default task if none exist
	 * As recommended in docs/tasks.md for seamless time tracking
	 */
	async getTasksForProjectWithDefault(projectUrl, forceRefresh = false) {
		try {
			let tasks = await this.getTasksForProject(projectUrl, forceRefresh);
			
			// If no tasks exist, create a default "General Work" task
			if (tasks.length === 0) {
				console.log('No tasks found for project, creating default task...');
				const defaultTask = await this.createDefaultTask(projectUrl, 'General Work');
				tasks = [defaultTask];
			}
			
			return tasks;
		} catch (error) {
			console.error('Error getting tasks with default:', error);
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
	 * Clear all caches - useful when data might be stale
	 * As recommended in docs for performance considerations
	 */
	clearCaches() {
		console.log('Clearing FreeAgent API caches');
		this.projectsCache = null;
		this.contactsCache = null;
		this.tasksCache.clear();
	}

	/**
	 * Get fresh project data (bypasses cache)
	 */
	async refreshProjects() {
		return await this.getProjects(true);
	}

	/**
	 * Get fresh task data for a project (bypasses cache)
	 */
	/**
	 * Get fresh task data for a project (bypasses cache)
	 */
	async refreshTasksForProject(projectUrl) {
		return await this.getTasksForProject(projectUrl, true);
	}

	/**
	 * Get timeslips with filtering options
	 * Following FreeAgent API best practices from docs/timeslips.md
	 */
	async getTimeslips(options = {}) {
		try {
			const params = new URLSearchParams();
			
			// Apply filters as per documentation
			if (options.view) {
				params.append('view', options.view); // 'all', 'unbilled'
			}
			if (options.user) {
				params.append('user', options.user);
			}
			if (options.project) {
				params.append('project', options.project);
			}
			if (options.task) {
				params.append('task', options.task);
			}
			if (options.from_date) {
				params.append('from_date', options.from_date);
			}
			if (options.to_date) {
				params.append('to_date', options.to_date);
			}
			if (options.sort) {
				params.append('sort', options.sort); // 'dated_on', 'created_at', 'updated_at'
			}

			const queryString = params.toString();
			const endpoint = queryString ? `/timeslips?${queryString}` : '/timeslips';
			
			const response = await this.auth.apiRequest(endpoint);
			if (!response.ok) {
				throw new Error(`Failed to load timeslips: ${response.status}`);
			}

			const data = await response.json();
			return data.timeslips || [];
		} catch (error) {
			console.error('Error loading timeslips:', error);
			throw error;
		}
	}

	/**
	 * Get unbilled timeslips for the current user
	 * Useful for generating invoices and tracking billable time
	 */
	async getUnbilledTimeslips() {
		if (!this.currentUser) {
			throw new Error('Current user not loaded. Call init() first.');
		}

		return await this.getTimeslips({
			view: 'unbilled',
			user: this.currentUser.url,
			sort: 'dated_on'
		});
	}

	/**
	 * Get recent timeslips for the current user
	 * Default to last 30 days of activity
	 */
	async getRecentTimeslips(days = 30) {
		if (!this.currentUser) {
			throw new Error('Current user not loaded. Call init() first.');
		}

		const fromDate = new Date();
		fromDate.setDate(fromDate.getDate() - days);
		const fromDateStr = fromDate.toISOString().split('T')[0];

		return await this.getTimeslips({
			user: this.currentUser.url,
			from_date: fromDateStr,
			sort: '-dated_on' // Most recent first
		});
	}

	/**
	 * Round time to specified intervals
	 * Default to 30-minute rounding for professional time tracking
	 */
	roundTime(hours, roundingMinutes = 30) {
		if (roundingMinutes <= 0) return hours;
		
		const roundingHours = roundingMinutes / 60;
		return Math.round(hours / roundingHours) * roundingHours;
	}

	/**
	 * Round time up to specified intervals (never round down)
	 * Useful for billing - always round in client's favor
	 */
	roundTimeUp(hours, roundingMinutes = 30) {
		if (roundingMinutes <= 0) return hours;
		
		const roundingHours = roundingMinutes / 60;
		return Math.ceil(hours / roundingHours) * roundingHours;
	}

	/**
	 * Format time rounding options for UI display
	 */
	getTimeRoundingOptions() {
		return [
			{ value: 0, label: 'No rounding (exact time)', description: 'Track precise time to the minute' },
			{ value: 15, label: '15 minutes', description: 'Round to quarter hours (0.25h intervals)' },
			{ value: 30, label: '30 minutes', description: 'Round to half hours (0.5h intervals)' },
			{ value: 60, label: '1 hour', description: 'Round to full hours (1h intervals)' }
		];
	}
}

// Make available globally
window.FreeAgentAPI = FreeAgentAPI;