// OAuth Server for Desktop App - Handles FreeAgent authentication flow
const express = require('express');
const { BrowserWindow } = require('electron');
const path = require('path');
const crypto = require('crypto');
const FREEAGENT_CONFIG = require('./freeagent-config');

class FreeAgentOAuthServer {
    constructor() {
        this.server = null;
        this.app = express();
        this.port = 8080;
        this.authWindow = null;
        this.pendingAuth = null;
        
        this.setupRoutes();
    }

    setupRoutes() {
        // OAuth callback handler
        this.app.get('/oauth/callback', async (req, res) => {
            try {
                const { code, error } = req.query;
                
                if (error) {
                    console.error('OAuth error:', error);
                    res.send(`
                        <html>
                            <body style="font-family: Arial; text-align: center; padding: 50px;">
                                <h2 style="color: #f44336;">❌ Authorization Failed</h2>
                                <p>Error: ${error}</p>
                                <p>You can close this window.</p>
                                <script>setTimeout(() => window.close(), 3000);</script>
                            </body>
                        </html>
                    `);
                    
                    if (this.pendingAuth) {
                        this.pendingAuth.reject(new Error('Authorization failed: ' + error));
                        this.pendingAuth = null;
                    }
                    return;
                }

                if (!code) {
                    throw new Error('No authorization code received');
                }

                console.log('✅ Received OAuth code, exchanging for tokens...');

                // Exchange code for access token
                const tokenData = await this.exchangeCodeForToken(code);
                
                res.send(`
                    <html>
                        <body style="font-family: Arial; text-align: center; padding: 50px;">
                            <h2 style="color: #4CAF50;">✅ Authorization Successful!</h2>
                            <p>You have successfully connected to FreeAgent.</p>
                            <p>You can now close this window and return to the Time Tracker.</p>
                            <script>setTimeout(() => window.close(), 2000);</script>
                        </body>
                    </html>
                `);

                console.log('✅ FreeAgent OAuth completed successfully');

                // Resolve the pending authentication promise
                if (this.pendingAuth) {
                    this.pendingAuth.resolve(tokenData);
                    this.pendingAuth = null;
                }

                // Close auth window
                if (this.authWindow && !this.authWindow.isDestroyed()) {
                    this.authWindow.close();
                }

            } catch (error) {
                console.error('OAuth callback error:', error);
                
                res.send(`
                    <html>
                        <body style="font-family: Arial; text-align: center; padding: 50px;">
                            <h2 style="color: #f44336;">❌ Connection Failed</h2>
                            <p>Error: ${error.message}</p>
                            <p>You can close this window.</p>
                            <script>setTimeout(() => window.close(), 3000);</script>
                        </body>
                    </html>
                `);

                if (this.pendingAuth) {
                    this.pendingAuth.reject(error);
                    this.pendingAuth = null;
                }
            }
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'OAuth server running', timestamp: new Date().toISOString() });
        });
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, 'localhost', () => {
                console.log(`✅ FreeAgent OAuth server running on http://localhost:${this.port}`);
                resolve();
            });

            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.log(`Port ${this.port} in use, trying ${this.port + 1}...`);
                    this.port++;
                    this.server.listen(this.port, 'localhost', resolve);
                } else {
                    reject(error);
                }
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('OAuth server stopped');
        }
    }

    async authenticate() {
        try {
            // Generate state parameter for security
            const state = crypto.randomBytes(32).toString('hex');
            
            // Build authorization URL
            const authUrl = new URL(FREEAGENT_CONFIG.authUrl);
            authUrl.searchParams.append('client_id', FREEAGENT_CONFIG.clientId);
            authUrl.searchParams.append('response_type', 'code');
            authUrl.searchParams.append('redirect_uri', FREEAGENT_CONFIG.redirectUri);
            authUrl.searchParams.append('state', state);

            console.log('🔐 Opening FreeAgent authorization window...');

            // Create and show auth window
            this.authWindow = new BrowserWindow({
                width: 500,
                height: 700,
                show: true,
                modal: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            // Load the authorization URL
            await this.authWindow.loadURL(authUrl.toString());

            // Return promise that resolves when OAuth completes
            return new Promise((resolve, reject) => {
                this.pendingAuth = { resolve, reject };

                // Handle window closed before completion
                this.authWindow.on('closed', () => {
                    if (this.pendingAuth) {
                        this.pendingAuth.reject(new Error('Authorization window was closed'));
                        this.pendingAuth = null;
                    }
                });

                // Timeout after 5 minutes
                setTimeout(() => {
                    if (this.pendingAuth) {
                        this.pendingAuth.reject(new Error('Authorization timeout'));
                        this.pendingAuth = null;
                    }
                    if (this.authWindow && !this.authWindow.isDestroyed()) {
                        this.authWindow.close();
                    }
                }, 300000);
            });

        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    async exchangeCodeForToken(code) {
        try {
            const response = await fetch(FREEAGENT_CONFIG.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: FREEAGENT_CONFIG.clientId,
                    client_secret: FREEAGENT_CONFIG.clientSecret,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: FREEAGENT_CONFIG.redirectUri
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
            }

            const tokenData = await response.json();
            console.log('✅ Token exchange successful');

            return {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in,
                token_type: tokenData.token_type
            };

        } catch (error) {
            console.error('Token exchange error:', error);
            throw new Error('Failed to exchange authorization code for access token: ' + error.message);
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            const response = await fetch(FREEAGENT_CONFIG.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: FREEAGENT_CONFIG.clientId,
                    client_secret: FREEAGENT_CONFIG.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }

            const tokenData = await response.json();
            console.log('✅ Token refresh successful');

            return {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || refreshToken,
                expires_in: tokenData.expires_in,
                token_type: tokenData.token_type
            };

        } catch (error) {
            console.error('Token refresh error:', error);
            throw error;
        }
    }
}

module.exports = FreeAgentOAuthServer;