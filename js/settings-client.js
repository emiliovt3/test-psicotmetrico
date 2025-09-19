/**
 * Settings Client - Frontend helper for Supabase settings management
 * Provides easy-to-use methods for configuration CRUD operations
 */

class SettingsClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.settingsEndpoint = '/netlify/functions/settings-manager';
    this.migrateEndpoint = '/netlify/functions/migrate-settings';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // =============================================
  // PUBLIC API METHODS
  // =============================================

  /**
   * Get configurations by section
   * @param {string} seccion - Configuration section (empresa, evaluacion, etc.)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Configuration object
   */
  async getSection(seccion, options = {}) {
    const params = new URLSearchParams({
      seccion,
      formato: 'grouped',
      ...options
    });

    const cacheKey = `section_${seccion}_${params.toString()}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${this.settingsEndpoint}?${params}`);
      const result = await this.handleResponse(response);

      // Cache the result
      this.cache.set(cacheKey, {
        data: result.data[seccion] || {},
        timestamp: Date.now()
      });

      return result.data[seccion] || {};
    } catch (error) {
      console.error(`❌ Error getting section ${seccion}:`, error);
      throw error;
    }
  }

  /**
   * Get specific configuration value
   * @param {string} seccion - Configuration section
   * @param {string} clave - Configuration key
   * @returns {Promise<any>} Configuration value
   */
  async getValue(seccion, clave) {
    const params = new URLSearchParams({ seccion, clave });

    try {
      const response = await fetch(`${this.baseUrl}${this.settingsEndpoint}?${params}`);
      const result = await this.handleResponse(response);

      return result.data[0]?.valor || null;
    } catch (error) {
      console.error(`❌ Error getting value ${seccion}.${clave}:`, error);
      throw error;
    }
  }

  /**
   * Get all configurations in flat format
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Flattened configuration object
   */
  async getAllFlat(options = {}) {
    const params = new URLSearchParams({
      formato: 'flat',
      ...options
    });

    const cacheKey = `all_flat_${params.toString()}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${this.settingsEndpoint}?${params}`);
      const result = await this.handleResponse(response);

      // Cache the result
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now()
      });

      return result.data;
    } catch (error) {
      console.error('❌ Error getting all configurations:', error);
      throw error;
    }
  }

  /**
   * Update single configuration value
   * @param {string} seccion - Configuration section
   * @param {string} clave - Configuration key
   * @param {any} valor - New value
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Update result
   */
  async setValue(seccion, clave, valor, options = {}) {
    const configuracion = {
      seccion,
      clave,
      valor,
      ...options
    };

    return this.updateConfigurations([configuracion], options.usuario);
  }

  /**
   * Update multiple configurations
   * @param {Array} configuraciones - Array of configuration objects
   * @param {string} usuario - User making the change
   * @param {string} razonCambio - Reason for change
   * @returns {Promise<Object>} Update result
   */
  async updateConfigurations(configuraciones, usuario, razonCambio = 'Actualización vía interfaz') {
    try {
      const response = await fetch(`${this.baseUrl}${this.settingsEndpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configuraciones,
          usuario,
          razon_cambio: razonCambio
        })
      });

      const result = await this.handleResponse(response);

      // Clear cache after successful update
      this.clearCache();

      return result;
    } catch (error) {
      console.error('❌ Error updating configurations:', error);
      throw error;
    }
  }

  /**
   * Create new configurations
   * @param {Array} configuraciones - Array of configuration objects
   * @param {string} usuario - User creating the configurations
   * @returns {Promise<Object>} Creation result
   */
  async createConfigurations(configuraciones, usuario) {
    try {
      const response = await fetch(`${this.baseUrl}${this.settingsEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configuraciones,
          usuario
        })
      });

      const result = await this.handleResponse(response);

      // Clear cache after successful creation
      this.clearCache();

      return result;
    } catch (error) {
      console.error('❌ Error creating configurations:', error);
      throw error;
    }
  }

  /**
   * Delete configuration
   * @param {string} seccion - Configuration section
   * @param {string} clave - Configuration key
   * @returns {Promise<Object>} Delete result
   */
  async deleteConfiguration(seccion, clave) {
    const params = new URLSearchParams({ seccion, clave });

    try {
      const response = await fetch(`${this.baseUrl}${this.settingsEndpoint}?${params}`, {
        method: 'DELETE'
      });

      const result = await this.handleResponse(response);

      // Clear cache after successful deletion
      this.clearCache();

      return result;
    } catch (error) {
      console.error(`❌ Error deleting configuration ${seccion}.${clave}:`, error);
      throw error;
    }
  }

  // =============================================
  // MIGRATION METHODS
  // =============================================

  /**
   * Migrate from LocalStorage to Supabase
   * @param {Object} localStorageData - Data from LocalStorage
   * @param {string} usuario - User performing migration
   * @param {boolean} forzarSobreescritura - Force overwrite existing data
   * @returns {Promise<Object>} Migration result
   */
  async migrateFromLocalStorage(localStorageData, usuario, forzarSobreescritura = false) {
    try {
      const response = await fetch(`${this.baseUrl}${this.migrateEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          localStorageData,
          usuario,
          forzar_sobreescritura: forzarSobreescritura
        })
      });

      const result = await this.handleResponse(response);

      // Clear cache after migration
      this.clearCache();

      return result;
    } catch (error) {
      console.error('❌ Error migrating from LocalStorage:', error);
      throw error;
    }
  }

  /**
   * Check if migration is needed
   * @returns {Promise<Object>} Migration check result
   */
  async checkMigrationNeeded() {
    // Check if LocalStorage has configuration data
    const localConfig = this.getLocalStorageConfig();

    if (!localConfig || Object.keys(localConfig).length === 0) {
      return { needed: false, reason: 'No LocalStorage data found' };
    }

    // Check if Supabase already has data
    try {
      const supabaseConfig = await this.getAllFlat();
      const hasSupabaseData = Object.keys(supabaseConfig).length > 0;

      return {
        needed: !hasSupabaseData,
        reason: hasSupabaseData
          ? 'Supabase already has configuration data'
          : 'LocalStorage data found, Supabase empty',
        localData: localConfig,
        supabaseDataExists: hasSupabaseData
      };
    } catch (error) {
      return {
        needed: true,
        reason: 'Error checking Supabase data, migration recommended',
        localData: localConfig,
        error: error.message
      };
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Get configuration from LocalStorage
   * @returns {Object|null} LocalStorage configuration data
   */
  getLocalStorageConfig() {
    try {
      const stored = localStorage.getItem('psicometrico_config');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ Error reading LocalStorage config:', error);
      return null;
    }
  }

  /**
   * Clear settings cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Export current configurations as JSON
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Configuration export
   */
  async exportConfigurations(options = {}) {
    try {
      const configurations = await this.getAllFlat({
        incluir_sensibles: options.includeSensitive || false
      });

      return {
        export_date: new Date().toISOString(),
        version: '1.0',
        source: 'supabase',
        configurations
      };
    } catch (error) {
      console.error('❌ Error exporting configurations:', error);
      throw error;
    }
  }

  /**
   * Handle API response and errors
   * @private
   */
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.message || errorData.error || 'Request failed');
    }

    return response.json();
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Create a singleton instance for global use
 */
const settingsClient = new SettingsClient();

/**
 * Utility function to get company settings
 */
async function getCompanySettings() {
  return settingsClient.getSection('empresa');
}

/**
 * Utility function to get evaluation settings
 */
async function getEvaluationSettings() {
  return settingsClient.getSection('evaluacion');
}

/**
 * Utility function to get job positions
 */
async function getJobPositions() {
  return settingsClient.getSection('puestos');
}

/**
 * Utility function to update company branding
 */
async function updateCompanyBranding(nombre, logoUrl, colorPrimario, usuario) {
  const configuraciones = [
    { seccion: 'empresa', clave: 'nombre', valor: nombre },
    { seccion: 'empresa', clave: 'logo_url', valor: logoUrl },
    { seccion: 'empresa', clave: 'color_primario', valor: colorPrimario }
  ];

  return settingsClient.updateConfigurations(configuraciones, usuario, 'Actualización de branding');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SettingsClient,
    settingsClient,
    getCompanySettings,
    getEvaluationSettings,
    getJobPositions,
    updateCompanyBranding
  };
}