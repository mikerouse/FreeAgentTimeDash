// OAuth Server for Desktop App - Handles FreeAgent authentication flow
const express = require('express');
const { BrowserWindow } = require('electron');
const path = require('path');

class OAuthServer {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.server = null;
        this.authWindow = null;
        this.port = 8080;
        this.app = express();
        this.setupRoutes();
    }

    setupRoutes() {
        // OAuth callback route
        this.app.get('/oauth/callback', (req, res) => {
            const code = req.query.code;
            const error = req.query.error;

            if (error) {
                res.send(`
                    <html>
                        <head><title>FreeAgent Authentication</title></head>
                        <body>
                            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                                <h2 style="color: #dc3545;">Authentication Failed</h2>
                                <p>Error: ${error}</p>
                                <p><a href="#" onclick="window.close()">Close this window</a></p>
                            </div>
                        </body>
                    </html>
                `);
                
                // Send error to main window
                this.mainWindow.webContents.send('oauth-error', error);
            } else if (code) {
                res.send(`
                    <html>
                        <head><title>FreeAgent Authentication</title></head>
                        <body>
                            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                                <h2 style="color: #28a745;">Authentication Successful!</h2>
                                <p>You can now close this window and return to FreeAgent Time Tracker.</p>
                                <script>
                                    setTimeout(() => window.close(), 2000);
                                </script>
                            </div>
                        </body>
                    </html>
                `);
                
                // Send code to main window
                this.mainWindow.webContents.send('oauth-code', code);
            }

            // Close auth window
            if (this.authWindow && !this.authWindow.isDestroyed()) {
                this.authWindow.close();
            }

            // Stop server after handling callback
            setTimeout(() => this.stop(), 3000);
        });

        // Health check route
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Serve static files for any additional auth pages
        this.app.use(express.static(path.join(__dirname, '../renderer/oauth')));
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, (err) => {
                if (err) {
                    console.error('OAuth server start error:', err);
                    reject(err);
                } else {
                    console.log(`OAuth server running on port ${this.port}`);
                    resolve();
                }
            });
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('OAuth server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async authenticate(clientId, authUrl) {
        try {
            // Start OAuth server
            await this.start();

            // Create auth window
            this.authWindow = new BrowserWindow({
                width: 500,
                height: 700,
                modal: true,
                parent: this.mainWindow,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                },
                title: 'FreeAgent Authentication'
            });

            // Load FreeAgent OAuth URL
            this.authWindow.loadURL(authUrl);

            // Handle window closed before completion
            this.authWindow.on('closed', () => {
                console.log('Auth window closed');
                this.authWindow = null;
                this.stop();
            });

            // Return promise that resolves when we get the auth code
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Authentication timeout'));
                    if (this.authWindow && !this.authWindow.isDestroyed()) {
                        this.authWindow.close();
                    }
                    this.stop();
                }, 300000); // 5 minute timeout

                // Listen for OAuth responses
                const handleCode = (event, code) => {
                    clearTimeout(timeout);
                    this.mainWindow.removeListener('oauth-code', handleCode);
                    this.mainWindow.removeListener('oauth-error', handleError);
                    resolve(code);
                };

                const handleError = (event, error) => {
                    clearTimeout(timeout);
                    this.mainWindow.removeListener('oauth-code', handleCode);
                    this.mainWindow.removeListener('oauth-error', handleError);
                    reject(new Error(`OAuth error: ${error}`));
                };

                this.mainWindow.on('oauth-code', handleCode);
                this.mainWindow.on('oauth-error', handleError);
            });

        } catch (error) {
            console.error('OAuth authentication error:', error);
            this.stop();
            throw error;
        }
    }

    getRedirectUri() {
        return `http://localhost:${this.port}/oauth/callback`;
    }
}

module.exports = OAuthServer;