const { getPool } = require('../database/db-connection');

class InventoryModel {
    // Obtener todos los items del inventario
    static async getAllItems() {
        try {
            const pool = getPool();
            const [rows] = await pool.query(`
                SELECT i.*, f.type_code, f.name as type_name
                FROM inventory_items i
                JOIN food_types f ON i.food_type_id = f.id
                ORDER BY i.expiration_date ASC
            `);
            return rows;
        } catch (error) {
            console.error('Error al obtener items del inventario:', error);
            throw error;
        }
    }
    
    // Obtener items por estado (warning, danger)
    static async getItemsByStatus(status) {
        try {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT * FROM inventory_items WHERE status = ? ORDER BY expiration_date ASC',
                [status]
            );
            return rows;
        } catch (error) {
            console.error(`Error al obtener items con estado ${status}:`, error);
            throw error;
        }
    }
    
    // Búsqueda de items
    static async searchItems(searchTerm) {
        try {
            const pool = getPool();
            const searchPattern = `%${searchTerm}%`;
            const [rows] = await pool.query(`
                SELECT i.*, f.type_code, f.name as type_name
                FROM inventory_items i
                JOIN food_types f ON i.food_type_id = f.id
                WHERE i.name LIKE ? 
                OR i.code LIKE ? 
                OR i.batch_number LIKE ? 
                OR i.storage_location LIKE ?
                ORDER BY i.expiration_date ASC
            `, [searchPattern, searchPattern, searchPattern, searchPattern]);
            return rows;
        } catch (error) {
            console.error('Error al buscar items:', error);
            throw error;
        }
    }
    
    // Crear un nuevo item
    static async createItem(itemData) {
        try {
            const pool = getPool();
            
            // Obtener el ID del tipo de alimento
            const [foodType] = await pool.query(
                'SELECT id FROM food_types WHERE type_code = ?',
                [itemData.type]
            );
            
            if (foodType.length === 0) {
                throw new Error(`Tipo de alimento no encontrado: ${itemData.type}`);
            }
            
            const foodTypeId = foodType[0].id;
            
            // Insertar el nuevo item
            const [result] = await pool.query(
                `INSERT INTO inventory_items 
                (code, food_type_id, name, quantity, quantity_unit, batch_number, 
                manufacturing_date, entry_date, expiration_date, storage_location, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    itemData.code,
                    foodTypeId,
                    itemData.name,
                    itemData.quantityValue,
                    itemData.quantityUnit,
                    itemData.batchNumber,
                    itemData.manufacturingDate,
                    itemData.entryDate,
                    itemData.expirationDate,
                    itemData.storageLocation,
                    itemData.status
                ]
            );
            
            return {
                id: result.insertId,
                ...itemData
            };
        } catch (error) {
            console.error('Error al crear item de inventario:', error);
            throw error;
        }
    }
    
    // Actualizar el estado de un item
    static async updateItemStatus(id, status, expirationDate) {
        try {
            const pool = getPool();
            await pool.query(
                'UPDATE inventory_items SET status = ?, expiration_date = ?, updated_at = NOW() WHERE id = ?',
                [status, expirationDate, id]
            );
            return true;
        } catch (error) {
            console.error('Error al actualizar estado del item:', error);
            throw error;
        }
    }
    
    // Generar código único para productos
    static async generateUniqueCode() {
        try {
            const pool = getPool();
            const now = new Date();
            const year = now.getFullYear().toString().substr(-2);
            const month = String(now.getMonth() + 1).padStart(2, '0');
            
            // Obtener el último código utilizado para el mes actual
            const monthPrefix = `FT-${year}${month}-`;
            const [rows] = await pool.query(
                'SELECT code FROM inventory_items WHERE code LIKE ? ORDER BY code DESC LIMIT 1',
                [`${monthPrefix}%`]
            );
            
            let maxNumber = 0;
            if (rows.length > 0) {
                const numberPart = parseInt(rows[0].code.split('-')[2]);
                if (!isNaN(numberPart) && numberPart > maxNumber) {
                    maxNumber = numberPart;
                }
            }
            
            // Generar el siguiente número
            const nextNumber = String(maxNumber + 1).padStart(4, '0');
            return `FT-${year}${month}-${nextNumber}`;
        } catch (error) {
            console.error('Error al generar código único:', error);
            throw error;
        }
    }
}

module.exports = InventoryModel;