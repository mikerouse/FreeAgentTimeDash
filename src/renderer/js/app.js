// App Initialization - Desktop Time Tracker
class App {
    constructor() {
        this.timeTracker = null;
        this.isElectron = typeof window !== 'undefined' && window.electronAPI;
        
        this.init();
    }

    async init() {
        console.log('FreeAgent Time Tracker Desktop v1.0.0 starting...');
        
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.start());
            } else {
                await this.start();
            }
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showFatalError(error);
        }
    }

    async start() {
        try {
            // Show loading state
            this.showLoadingState();

            // Initialize storage adapter
            if (!window.storageAdapter) {
                throw new Error('Storage adapter not available');
            }

            // Check if this is first run
            const isFirstRun = !(await window.storageAdapter.has('timeTrackingData'));
            
            if (isFirstRun) {
                console.log('First run detected, showing welcome');
                await this.showWelcome();
            }

            // Check that required classes are available
            if (typeof TimeTracker === 'undefined') {
                throw new Error('TimeTracker class not loaded. Check script loading order.');
            }

            if (typeof FreeAgentAPI === 'undefined') {
                throw new Error('FreeAgentAPI class not loaded. Check script loading order.');
            }

            // Initialize time tracker
            this.timeTracker = new TimeTracker();

            // Setup global error handling
            this.setupErrorHandling();

            // Setup app-level event listeners
            this.setupAppEventListeners();

            // Show version info if in development
            if (this.isElectron) {
                const version = await window.electronAPI.getVersion();
                console.log(`Running version: ${version}`);
            }

            // Hide loading state
            this.hideLoadingState();

            console.log('App started successfully');
            
        } catch (error) {
            console.error('App start failed:', error);
            this.showFatalError(error);
        }
    }

    async showWelcome() {
        // For first run, we could show a welcome dialog
        // For now, just log it
        console.log('Welcome to FreeAgent Time Tracker!');
        
        // Set some default preferences
        const defaultSettings = {
            defaultRounding: 30,
            roundingMethod: 'round',
            notifyTimerStart: true,
            notifyTimerStop: true,
            autoSaveDrafts: true,
            maxDrafts: 10
        };
        
        await window.storageAdapter.set('settings', defaultSettings);
        
        // Show a welcome notification
        if (this.isElectron) {
            window.electronAPI.showNotification(
                'Welcome to FreeAgent Time Tracker',
                'Your professional time tracking app is ready to use!'
            );
        }
    }

    showLoadingState() {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>Starting FreeAgent Time Tracker...</p>
            </div>
        `;
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const loadingContent = loadingOverlay.querySelector('.loading-content');
        if (loadingContent) {
            loadingContent.style.cssText = `
                text-align: center;
                color: #333;
            `;
        }

        // Add CSS for spinner
        const style = document.createElement('style');
        style.textContent = `
            .loading-spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #2196F3;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(loadingOverlay);
    }

    hideLoadingState() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error, 'Global Error');
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'Promise Rejection');
        });
    }

    setupAppEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt+1, Alt+2, Alt+3 for timer shortcuts (if not handled by global shortcuts)
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                const key = e.key;
                if (key >= '1' && key <= '3') {
                    e.preventDefault();
                    const timerId = parseInt(key);
                    if (this.timeTracker) {
                        this.timeTracker.toggleTimer(timerId);
                    }
                }
            }

            // Escape to close panels
            if (e.key === 'Escape') {
                this.closeAllPanels();
            }

            // Ctrl+S / Cmd+S to save (if in a form)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                const activeForm = document.querySelector('form:focus-within');
                if (activeForm) {
                    e.preventDefault();
                    const submitButton = activeForm.querySelector('button[type="submit"]');
                    if (submitButton) {
                        submitButton.click();
                    }
                }
            }
        });

        // Window focus/blur handling
        window.addEventListener('focus', () => {
            // App regained focus - could refresh data or check for updates
            if (this.timeTracker) {
                this.timeTracker.updateSyncStatus();
            }
        });

        window.addEventListener('blur', () => {
            // App lost focus - could save state
            if (this.timeTracker) {
                this.timeTracker.saveData();
            }
        });

        // Before unload - save data
        window.addEventListener('beforeunload', () => {
            if (this.timeTracker) {
                this.timeTracker.saveData();
                this.timeTracker.destroy();
            }
        });
    }

    closeAllPanels() {
        const panels = document.querySelectorAll('.slide-panel.show');
        panels.forEach(panel => {
            panel.classList.remove('show');
        });
    }

    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);

        // Show user-friendly error message
        const errorMessage = this.getErrorMessage(error);
        
        if (this.isElectron) {
            window.electronAPI.showNotification(
                'Error',
                errorMessage
            );
        } else {
            // Fallback for non-Electron environments
            alert(`Error: ${errorMessage}`);
        }

        // Could also log to external service here
        this.logError(error, context);
    }

    getErrorMessage(error) {
        if (typeof error === 'string') {
            return error;
        }

        if (error.message) {
            // Make error messages more user-friendly
            if (error.message.includes('fetch')) {
                return 'Network connection error. Please check your internet connection.';
            }
            if (error.message.includes('Not authenticated')) {
                return 'Please reconnect to FreeAgent.';
            }
            if (error.message.includes('Storage')) {
                return 'Error saving data. Please try again.';
            }
            
            return error.message;
        }

        return 'An unexpected error occurred.';
    }

    logError(error, context) {
        // Log error with timestamp and context
        const errorLog = {
            timestamp: new Date().toISOString(),
            context: context,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.log('Error logged:', errorLog);

        // In a production app, you might send this to an error tracking service
        // like Sentry, Bugsnag, etc.
    }

    showFatalError(error) {
        console.error('Fatal error:', error);

        // Remove loading overlay
        this.hideLoadingState();

        // Show fatal error UI
        document.body.innerHTML = `
            <div class="fatal-error">
                <div class="error-content">
                    <h1>⚠️ Application Error</h1>
                    <p>FreeAgent Time Tracker encountered a fatal error and cannot continue.</p>
                    <details>
                        <summary>Error Details</summary>
                        <pre>${error.stack || error.message || error}</pre>
                    </details>
                    <div class="error-actions">
                        <button onclick="window.location.reload()" class="btn btn-primary">
                            Restart Application
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add basic styling for error page
        const style = document.createElement('style');
        style.textContent = `
            .fatal-error {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
                background: #f8f9fa;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .error-content {
                background: white;
                border-radius: 8px;
                padding: 32px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 600px;
                text-align: center;
            }
            .error-content h1 {
                color: #dc3545;
                margin-bottom: 16px;
            }
            .error-content p {
                color: #6c757d;
                margin-bottom: 24px;
            }
            .error-content details {
                text-align: left;
                margin: 24px 0;
                padding: 16px;
                background: #f8f9fa;
                border-radius: 4px;
            }
            .error-content pre {
                white-space: pre-wrap;
                word-break: break-word;
                font-size: 12px;
                color: #495057;
            }
            .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .btn-primary {
                background: #2196F3;
                color: white;
            }
            .btn-primary:hover {
                background: #1976D2;
            }
        `;
        document.head.appendChild(style);
    }

    // Public methods for external access
    getTimeTracker() {
        return this.timeTracker;
    }

    restart() {
        window.location.reload();
    }
}

// Initialize app when script loads
const app = new App();

// Make app available globally for debugging
window.app = app;