const { getPool } = require('../database/db-connection');

class FoodTypeModel {
    // Obtener todos los tipos de alimentos
    static async getAllTypes() {
        try {
            const pool = getPool();
            const [rows] = await pool.query('SELECT * FROM food_types');
            return rows;
        } catch (error) {
            console.error('Error al obtener tipos de alimentos:', error);
            throw error;
        }
    }
    
    // Obtener un tipo de alimento por su código
    static async getTypeByCode(typeCode) {
        try {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT * FROM food_types WHERE type_code = ?', 
                [typeCode]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error(`Error al obtener tipo de alimento ${typeCode}:`, error);
            throw error;
        }
    }
    
    // Calcular fecha de vencimiento basada en el tipo de alimento y temperatura
    static async calculateExpirationDate(foodTypeCode, manufacturingDate, entryDate, temperature) {
        try {
            const pool = getPool();
            
            // Obtener configuración
            const [thresholds] = await pool.query(`
                SELECT 
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'temperature_threshold_high') as temp_high,
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'temperature_threshold_medium') as temp_medium
            `);
            
            const tempHigh = parseFloat(thresholds[0].temp_high);
            const tempMedium = parseFloat(thresholds[0].temp_medium);
            
            // Obtener días base para el tipo de alimento
            const [foodType] = await pool.query(
                'SELECT base_expiration_days FROM food_types WHERE type_code = ?',
                [foodTypeCode]
            );
            
            if (foodType.length === 0) {
                throw new Error(`Tipo de alimento no encontrado: ${foodTypeCode}`);
            }
            
            const baseDays = foodType[0].base_expiration_days;
            
            // Calcular factor de temperatura
            let tempFactor = 1; // Factor normal
            
            if (temperature > tempHigh) {
                tempFactor = 0.5; // Reduce 50% de vida útil
            } else if (temperature > tempMedium) {
                tempFactor = 0.7; // Reduce 30% de vida útil
            }
            
            const adjustedDays = Math.floor(baseDays * tempFactor);
            
            // Calcular fecha de vencimiento
            const entryDateTime = new Date(entryDate);
            const expirationDateTime = new Date(entryDateTime);
            expirationDateTime.setDate(entryDateTime.getDate() + adjustedDays);
            
            return expirationDateTime.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        } catch (error) {
            console.error('Error al calcular fecha de vencimiento:', error);
            throw error;
        }
    }
}

module.exports = FoodTypeModel;