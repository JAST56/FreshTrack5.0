const InventoryModel = require('../models/inventory-model');
const FoodTypeModel = require('../models/food-type-model');
const SystemModel = require('../models/system-model');
const TemperatureModel = require('../models/temperature-model');

class InventoryController {
    // Procesar la entrada de un nuevo producto
    static async registerProduct(productData) {
        try {
            // Obtener temperatura actual
            const latestTemp = await TemperatureModel.getLatestReading();
            const currentTemp = latestTemp ? latestTemp.temperature : 22;
            
            // Generar código único
            const code = await InventoryModel.generateUniqueCode();
            
            // Calcular fecha de vencimiento
            const expirationDate = await FoodTypeModel.calculateExpirationDate(
                productData.type,
                productData.manufacturingDate,
                productData.entryDate,
                currentTemp
            );
            
            // Determinar estado inicial
            const status = await this.determineStatus(expirationDate);
            
            // Crear objeto de producto completo
            const newProduct = {
                ...productData,
                code,
                expirationDate,
                status,
                quantityValue: parseFloat(productData.quantity)
            };
            
            // Guardar en la base de datos
            return await InventoryModel.createItem(newProduct);
        } catch (error) {
            console.error('Error al registrar producto:', error);
            throw error;
        }
    }
    
    // Actualizar el estado de todos los productos basado en temperatura actual
    static async updateAllProductsStatus() {
        try {
            // Obtener temperatura actual
            const latestTemp = await TemperatureModel.getLatestReading();
            const currentTemp = latestTemp ? latestTemp.temperature : 22;
            
            // Obtener todos los productos
            const inventory = await InventoryModel.getAllItems();
            
            let updateCount = 0;
            
            // Actualizar cada producto
            for (const item of inventory) {
                // Recalcular fecha de vencimiento
                const newExpirationDate = await FoodTypeModel.calculateExpirationDate(
                    item.type_code,
                    item.manufacturing_date,
                    item.entry_date,
                    currentTemp
                );
                
                // Si la fecha cambia, actualizar el estado
                if (newExpirationDate !== item.expiration_date) {
                    const newStatus = await this.determineStatus(newExpirationDate);
                    
                    // Actualizar en la base de datos
                    await InventoryModel.updateItemStatus(item.id, newStatus, newExpirationDate);
                    updateCount++;
                }
            }
            
            return updateCount;
        } catch (error) {
            console.error('Error al actualizar estado de productos:', error);
            throw error;
        }
    }
    
    // Determinar el estado de un producto según su fecha de vencimiento
    static async determineStatus(expirationDate) {
        try {
            const warningDaysSetting = await SystemModel.getSetting('warning_days');
            const warningDays = parseInt(warningDaysSetting) || 10;
            
            const today = new Date();
            const expiration = new Date(expirationDate);
            const diffTime = expiration - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                return 'danger'; // Vencido
            } else if (diffDays <= warningDays) {
                return 'warning'; // Próximo a vencer
            } else {
                return 'ok'; // En buen estado
            }
        } catch (error) {
            console.error('Error al determinar estado del producto:', error);
            return 'warning'; // Por defecto, warning en caso de error
        }
    }
    
    // Calcular días hasta vencimiento
    static calculateDaysToExpiration(expirationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const expiration = new Date(expirationDate);
        expiration.setHours(0, 0, 0, 0);
        
        const diffTime = expiration - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

module.exports = InventoryController;