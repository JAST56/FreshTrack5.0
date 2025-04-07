const { getPool } = require('../database/db-connection');

class SystemModel {
    // Obtener todas las configuraciones
    static async getAllSettings() {
        try {
            const pool = getPool();
            const [rows] = await pool.query('SELECT * FROM system_settings');
            
            // Convertir a objeto clave-valor
            const settings = {};
            for (const row of rows) {
                settings[row.setting_key] = row.setting_value;
            }
            
            return settings;
        } catch (error) {
            console.error('Error al obtener configuraciones del sistema:', error);
            throw error;
        }
    }
    
    // Obtener una configuración específica
    static async getSetting(key) {
        try {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                [key]
            );
            
            return rows.length > 0 ? rows[0].setting_value : null;
        } catch (error) {
            console.error(`Error al obtener configuración ${key}:`, error);
            throw error;
        }
    }
    
    // Actualizar una configuración
    static async updateSetting(key, value) {
        try {
            const pool = getPool();
            await pool.query(
                'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
                [value, key]
            );
            return true;
        } catch (error) {
            console.error(`Error al actualizar configuración ${key}:`, error);
            throw error;
        }
    }
    
    // Comprobar si el modo simulación está activado
    static async isSimulationModeEnabled() {
        try {
            const simulationMode = await this.getSetting('simulation_mode');
            return simulationMode === 'true';
        } catch (error) {
            console.error('Error al comprobar modo simulación:', error);
            // Por defecto, devolver true (activado) en caso de error
            return true;
        }
    }
}

module.exports = SystemModel;