// FreeAgent OAuth Authentication Service using Chrome Identity API
class FreeAgentAuth {
	constructor() {
		// OAuth configuration - only CLIENT_ID is needed for Chrome Identity API
		this.CLIENT_ID = 't7BdB9vrNrTG9rcxQXMy7Q'; // Replace with your actual client ID
		this.AUTH_BASE_URL = 'https://api.freeagent.com/v2/approve_app';
		this.TOKEN_URL = 'https://api.freeagent.com/v2/token_endpoint';
		this.REDIRECT_URL = this.getRedirectURL();
		this.tokens = null;
	}

	getRedirectURL() {
		// Chrome generates a redirect URL for the extension
		return chrome.identity.getRedirectURL();
	}

	/**
	 * Initiates the OAuth flow using Chrome Identity API
	 * @returns {Promise<Object>} The tokens object with access_token and refresh_token
	 */
	async authenticate() {
		try {
			// Step 1: Get authorization code
			const authCode = await this.getAuthorizationCode();
			
			// Step 2: Exchange code for tokens
			const tokens = await this.exchangeCodeForTokens(authCode);
			
			// Step 3: Store tokens securely
			await this.storeTokens(tokens);
			
			// Step 4: Mark as connected
			await chrome.storage.local.set({ freeagentConnected: true });
			
			return tokens;
		} catch (error) {
			console.error('Authentication failed:', error);
			throw error;
		}
	}

	/**
	 * Gets authorization code using Chrome Identity API
	 */
	async getAuthorizationCode() {
		return new Promise((resolve, reject) => {
			const authURL = `${this.AUTH_BASE_URL}?` + new URLSearchParams({
				client_id: this.CLIENT_ID,
				response_type: 'code',
				redirect_uri: this.REDIRECT_URL,
				scope: 'read write' // Adjust scopes as needed
			});

			chrome.identity.launchWebAuthFlow(
				{
					url: authURL,
					interactive: true
				},
				(redirectUrl) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
						return;
					}

					// Extract authorization code from redirect URL
					const url = new URL(redirectUrl);
					const code = url.searchParams.get('code');
					const error = url.searchParams.get('error');

					if (error) {
						reject(new Error(`Authorization failed: ${error}`));
					} else if (code) {
						resolve(code);
					} else {
						reject(new Error('No authorization code received'));
					}
				}
			);
		});
	}

	/**
	 * Exchanges authorization code for access and refresh tokens
	 * Uses a proxy server to securely handle the client_secret
	 */
	async exchangeCodeForTokens(code) {
		// Use proxy server for secure token exchange
		// The proxy URL can be configured based on environment
		const PROXY_URL = this.getProxyUrl();
		
		try {
			const response = await fetch(`${PROXY_URL}/api/freeagent/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					code: code,
					redirect_uri: this.REDIRECT_URL
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Token exchange failed: ${errorData.error || 'Unknown error'}`);
			}

			return await response.json();
		} catch (error) {
			console.error('Token exchange error:', error);
			throw error;
		}
	}
	
	/**
	 * Gets the proxy server URL
	 * Can be configured for local development or production
	 */
	getProxyUrl() {
		// For local development testing (optional)
		// Uncomment the line below if you want to test with local proxy
		// return 'http://localhost:3000';
		
		// Production Render.com URL
		return 'https://freeagenttimedash.onrender.com';
	}


	/**
	 * Stores tokens securely in Chrome storage
	 */
	async storeTokens(tokens) {
		this.tokens = {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expires_at: Date.now() + (tokens.expires_in * 1000)
		};

		await chrome.storage.local.set({
			freeagentTokens: this.tokens
		});
	}

	/**
	 * Gets stored tokens
	 */
	async getTokens() {
		if (this.tokens && this.tokens.expires_at > Date.now()) {
			return this.tokens;
		}

		const result = await chrome.storage.local.get('freeagentTokens');
		this.tokens = result.freeagentTokens;

		if (this.tokens && this.tokens.expires_at <= Date.now()) {
			// Token expired, refresh it
			await this.refreshToken();
		}

		return this.tokens;
	}

	/**
	 * Refreshes the access token using the refresh token
	 */
	async refreshToken() {
		if (!this.tokens || !this.tokens.refresh_token) {
			throw new Error('No refresh token available');
		}

		const PROXY_URL = this.getProxyUrl();
		
		try {
			const response = await fetch(`${PROXY_URL}/api/freeagent/refresh`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					refresh_token: this.tokens.refresh_token
				})
			});

			if (!response.ok) {
				// Refresh failed, need to re-authenticate
				await chrome.storage.local.remove(['freeagentTokens', 'freeagentConnected']);
				throw new Error('Token refresh failed, please re-authenticate');
			}

			const newTokens = await response.json();
			await this.storeTokens(newTokens);
			return this.tokens;
		} catch (error) {
			console.error('Token refresh error:', error);
			await chrome.storage.local.remove(['freeagentTokens', 'freeagentConnected']);
			throw new Error('Token refresh failed, please re-authenticate');
		}
	}

	/**
	 * Makes an authenticated API request to FreeAgent
	 */
	async apiRequest(endpoint, options = {}) {
		const tokens = await this.getTokens();
		
		if (!tokens) {
			throw new Error('Not authenticated');
		}

		const response = await fetch(`https://api.freeagent.com/v2${endpoint}`, {
			...options,
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`,
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				...options.headers
			}
		});

		if (response.status === 401) {
			// Token might be expired, try refreshing
			await this.refreshToken();
			// Retry the request
			return this.apiRequest(endpoint, options);
		}

		return response;
	}

	/**
	 * Logs out and clears stored tokens
	 */
	async logout() {
		this.tokens = null;
		await chrome.storage.local.remove(['freeagentTokens', 'freeagentConnected']);
	}
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
	module.exports = FreeAgentAuth;
}