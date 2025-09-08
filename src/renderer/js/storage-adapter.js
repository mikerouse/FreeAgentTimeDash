// Storage Adapter - Replaces Chrome extension storage with Electron storage

class StorageAdapter {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.storage;
    
    if (!this.isElectron) {
      console.warn('Electron storage not available, falling back to localStorage');
    }
  }

  // Get data from storage
  async get(key, defaultValue = null) {
    try {
      if (this.isElectron) {
        return window.storage.get(key, defaultValue);
      } else {
        // Fallback to localStorage for development
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
        return window.storage.set(key, value);
      } else {
        // Fallback to localStorage for development
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
        return window.storage.delete(key);
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
        return window.storage.clear();
      } else {
        localStorage.clear();
        return true;
      }
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  // Get multiple keys at once
  async getMultiple(keys, defaultValues = {}) {
    try {
      const result = {};
      for (const key of keys) {
        result[key] = await this.get(key, defaultValues[key] || null);
      }
      return result;
    } catch (error) {
      console.error('Storage getMultiple error:', error);
      return defaultValues;
    }
  }

  // Set multiple keys at once
  async setMultiple(data) {
    try {
      const results = {};
      for (const [key, value] of Object.entries(data)) {
        results[key] = await this.set(key, value);
      }
      return results;
    } catch (error) {
      console.error('Storage setMultiple error:', error);
      return false;
    }
  }

  // Check if key exists
  async has(key) {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch (error) {
      console.error('Storage has error:', error);
      return false;
    }
  }

  // Get all keys
  async getAllKeys() {
    try {
      if (this.isElectron) {
        // This would need to be implemented in the preload script
        // For now, we'll track keys manually
        const keysData = await this.get('_storage_keys', []);
        return keysData;
      } else {
        return Object.keys(localStorage);
      }
    } catch (error) {
      console.error('Storage getAllKeys error:', error);
      return [];
    }
  }

  // Helper method to track keys (for Electron)
  async _trackKey(key) {
    if (this.isElectron) {
      try {
        const keys = await this.get('_storage_keys', []);
        if (!keys.includes(key)) {
          keys.push(key);
          await this.set('_storage_keys', keys);
        }
      } catch (error) {
        console.error('Error tracking key:', error);
      }
    }
  }

  // Enhanced set that tracks keys
  async setTracked(key, value) {
    const result = await this.set(key, value);
    if (result) {
      await this._trackKey(key);
    }
    return result;
  }
}

// Create global storage instance
window.storageAdapter = new StorageAdapter();

// Backward compatibility with Chrome extension storage API
if (!window.chrome) {
  window.chrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          if (typeof keys === 'string') {
            window.storageAdapter.get(keys).then(value => {
              callback({ [keys]: value });
            });
          } else if (Array.isArray(keys)) {
            const defaults = {};
            window.storageAdapter.getMultiple(keys, defaults).then(callback);
          } else if (typeof keys === 'object') {
            const keyArray = Object.keys(keys);
            window.storageAdapter.getMultiple(keyArray, keys).then(callback);
          }
        },
        
        set: (data, callback) => {
          window.storageAdapter.setMultiple(data).then(() => {
            if (callback) callback();
          });
        },
        
        remove: (keys, callback) => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          Promise.all(keyArray.map(key => window.storageAdapter.delete(key)))
            .then(() => {
              if (callback) callback();
            });
        },
        
        clear: (callback) => {
          window.storageAdapter.clear().then(() => {
            if (callback) callback();
          });
        }
      }
    }
  };
}