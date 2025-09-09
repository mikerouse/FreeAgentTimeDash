// App initialization
class App {
    constructor() {
        this.timeTracker = null;
        this.isElectron = typeof window !== 'undefined' && window.electronAPI;
        
        console.log('🚀 FreeAgent Time Tracker v1.0.0 starting...');
    }

    async initialize() {
        try {
            console.log('📱 Initializing app...');
            
            // Set version immediately to remove "Loading..."
            document.getElementById('app-version').textContent = 'v1.0.0';
            
            // Check for Electron APIs
            if (this.isElectron) {
                console.log('✅ Electron APIs detected');
                
                // Try to get real version from main process
                try {
                    const version = await window.electronAPI.getVersion();
                    document.getElementById('app-version').textContent = `v${version}`;
                } catch (error) {
                    console.warn('Could not get version from main process:', error);
                    // Keep default v1.0.0
                }
                
                // Setup keyboard shortcuts
                this.setupKeyboardShortcuts();
            } else {
                console.log('🌐 Running in browser mode');
                document.getElementById('app-version').textContent = 'v1.0.0 (Web)';
            }

            // Initialize time tracker
            console.log('🕐 Initializing TimeTracker...');
            this.timeTracker = new TimeTracker();
            
            // Make app globally available
            window.app = this;
            
            console.log('✅ App initialized successfully');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
        }
    }

    setupKeyboardShortcuts() {
        if (!window.electronAPI) return;

        // Timer toggle shortcuts
        window.electronAPI.onToggleTimer((event, timerId) => {
            console.log(`Keyboard shortcut - toggle timer ${timerId}`);
            if (this.timeTracker) {
                this.timeTracker.toggleTimer(timerId);
            }
        });

        // Settings shortcut
        window.electronAPI.onShowSettings(() => {
            console.log('Keyboard shortcut - show settings');
            if (this.timeTracker) {
                this.timeTracker.showSettingsPanel();
            }
        });

        // Stop all timers shortcut
        window.electronAPI.onStopAllTimers(() => {
            console.log('Keyboard shortcut - stop all timers');
            if (this.timeTracker) {
                this.timeTracker.stopAllTimers();
            }
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM loaded, starting app...');
    
    const app = new App();
    await app.initialize();
    
    console.log('🎉 App ready!');
});