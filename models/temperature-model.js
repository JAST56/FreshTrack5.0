const { getPool } = require('../database/db-connection');

class TemperatureModel {
    // Registrar nueva lectura de temperatura
    static async logTemperature(temperature, humidity, source = 'sensor') {
        try {
            const pool = getPool();
            const [result] = await pool.query(
                'INSERT INTO temperature_logs (temperature, humidity, source) VALUES (?, ?, ?)',
                [temperature, humidity, source]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error al registrar temperatura:', error);
            throw error;
        }
    }
    
    // Obtener la última lectura de temperatura
    static async getLatestReading() {
        try {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT * FROM temperature_logs ORDER BY timestamp DESC LIMIT 1'
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error al obtener última lectura de temperatura:', error);
            throw error;
        }
    }
    
    // Obtener historial de lecturas (últimas N lecturas)
    static async getHistory(limit = 50) {
        try {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT * FROM temperature_logs ORDER BY timestamp DESC LIMIT ?',
                [limit]
            );
            return rows;
        } catch (error) {
            console.error('Error al obtener historial de temperatura:', error);
            throw error;
        }
    }
    
    // Calcular promedio de temperatura en un período
    static async getAverageTemperature(hours = 24) {
        try {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT AVG(temperature) as avg_temp, AVG(humidity) as avg_humidity FROM temperature_logs WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? HOUR)',
                [hours]
            );
            return {
                temperature: rows[0].avg_temp || 0,
                humidity: rows[0].avg_humidity || 0
            };
        } catch (error) {
            console.error('Error al calcular promedio de temperatura:', error);
            throw error;
        }
    }
}

module.exports = TemperatureModel;