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
	 * Note: This typically requires client_secret, which shouldn't be in the extension.
	 * You have three options:
	 * 1. Use a backend proxy server to handle this exchange
	 * 2. Configure FreeAgent app as a "public" client (if supported)
	 * 3. Use PKCE flow (if FreeAgent supports it)
	 */
	async exchangeCodeForTokens(code) {
		// IMPORTANT: This is where you need to make a decision based on FreeAgent's OAuth support
		
		// Option A: If FreeAgent supports public clients (no client_secret required)
		const params = new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: this.CLIENT_ID,
			code: code,
			redirect_uri: this.REDIRECT_URL
		});

		// Option B: If you have a backend proxy server
		// return this.exchangeCodeViaProxy(code);

		// Option C: If FreeAgent requires client_secret (NOT SECURE for extension)
		// You would need to implement a backend service for this

		const response = await fetch(this.TOKEN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Token exchange failed: ${errorText}`);
		}

		return await response.json();
	}

	/**
	 * Alternative: Exchange code via your backend proxy
	 */
	async exchangeCodeViaProxy(code) {
		// This would call YOUR backend server, not FreeAgent directly
		const response = await fetch('https://your-backend.com/api/freeagent/token', {
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
			throw new Error('Token exchange via proxy failed');
		}

		return await response.json();
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

		// Again, this typically requires client_secret
		// You might need to use your backend proxy for this
		const params = new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: this.CLIENT_ID,
			refresh_token: this.tokens.refresh_token
		});

		const response = await fetch(this.TOKEN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params
		});

		if (!response.ok) {
			// Refresh failed, need to re-authenticate
			await chrome.storage.local.remove(['freeagentTokens', 'freeagentConnected']);
			throw new Error('Token refresh failed, please re-authenticate');
		}

		const newTokens = await response.json();
		await this.storeTokens(newTokens);
		return this.tokens;
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