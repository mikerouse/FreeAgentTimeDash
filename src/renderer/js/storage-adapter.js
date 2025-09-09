// Storage Adapter for FreeAgent Time Tracker
class StorageAdapter {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.storage;
  }

  // Get data from storage
  async get(key, defaultValue = null) {
    try {
      if (this.isElectron) {
        return window.storage.get(key, defaultValue);
      } else {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
      }
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }

  // Set data in storage
  async set(key, value) {
    try {
      if (this.isElectron) {
        window.storage.set(key, value);
        return true;
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      }
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  // Delete key from storage
  async delete(key) {
    try {
      if (this.isElectron) {
        window.storage.delete(key);
        return true;
      } else {
        localStorage.removeItem(key);
        return true;
      }
    } catch (error) {
      console.error('Storage delete error:', error);
      return false;
    }
  }

  // Clear all storage
  async clear() {
    try {
      if (this.isElectron) {
        window.storage.clear();
        return true;
      } else {
        localStorage.clear();
        return true;
      }
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  // Check if key exists
  async has(key) {
    try {
      if (this.isElectron) {
        return window.storage.has(key);
      } else {
        return localStorage.getItem(key) !== null;
      }
    } catch (error) {
      console.error('Storage has error:', error);
      return false;
    }
  }
}

// Create global storage instance
window.storageAdapter = new StorageAdapter();