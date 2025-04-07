// API para FreshTrack con soporte para base de datos y Arduino
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar módulos de base de datos y controladores
const { initializeDatabase } = require('./database/db-connection');
const arduinoController = require('./controllers/arduino-controller');
const InventoryModel = require('./models/inventory-model');
const FoodTypeModel = require('./models/food-type-model');
const TemperatureModel = require('./models/temperature-model');
const SystemModel = require('./models/system-model');
const InventoryController = require('./controllers/inventory-controller');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos y Arduino antes de iniciar el servidor
async function initializeApp() {
    try {
        // Inicializar la base de datos
        await initializeDatabase();
        console.log('Base de datos inicializada correctamente');
        
        // Inicializar controlador de Arduino
        await arduinoController.initialize();
        
        // Iniciar el servidor
        app.listen(port, () => {
            console.log(`Servidor escuchando en http://localhost:${port}`);
            console.log('FreshTrack está listo para su uso');
        });
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        process.exit(1);
    }
}

// RUTAS API

// Ruta para obtener datos del sensor
app.get('/api/sensor-data', async (req, res) => {
    try {
        const sensorData = arduinoController.getSensorData();
        res.json(sensorData);
    } catch (error) {
        console.error('Error al obtener datos del sensor:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener estado del sistema
app.get('/api/status', async (req, res) => {
    try {
        const settings = await SystemModel.getAllSettings();
        const latestTemp = await TemperatureModel.getLatestReading();
        
        res.json({
            status: 'online',
            serialPort: settings.serial_port,
            connection: arduinoController.connectionStatus,
            simulationMode: arduinoController.simulationMode,
            uptime: process.uptime(),
            lastReading: latestTemp ? {
                temperature: latestTemp.temperature,
                humidity: latestTemp.humidity,
                timestamp: latestTemp.timestamp,
                source: latestTemp.source
            } : null
        });
    } catch (error) {
        console.error('Error al obtener estado del sistema:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener todos los tipos de alimentos
app.get('/api/food-types', async (req, res) => {
    try {
        const types = await FoodTypeModel.getAllTypes();
        res.json(types);
    } catch (error) {
        console.error('Error al obtener tipos de alimentos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener inventario completo
app.get('/api/inventory', async (req, res) => {
    try {
        const inventory = await InventoryModel.getAllItems();
        res.json(inventory);
    } catch (error) {
        console.error('Error al obtener inventario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener historial de temperatura
app.get('/api/temperature/history', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const history = await TemperatureModel.getHistory(limit);
        res.json(history);
    } catch (error) {
        console.error('Error al obtener historial de temperatura:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para registrar un nuevo producto
app.post('/api/inventory', async (req, res) => {
    try {
        const newProduct = await InventoryController.registerProduct(req.body);
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error al registrar producto:', error);
        res.status(500).json({ error: 'Error al registrar producto', message: error.message });
    }
});

// Ruta para buscar productos
app.get('/api/inventory/search', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        const results = await InventoryModel.searchItems(searchTerm);
        res.json(results);
    } catch (error) {
        console.error('Error al buscar productos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para actualizar todos los productos según temperatura actual
app.post('/api/inventory/update-status', async (req, res) => {
    try {
        const updateCount = await InventoryController.updateAllProductsStatus();
        res.json({ 
            success: true, 
            message: `Se actualizaron ${updateCount} productos según la temperatura actual`,
            updatedCount: updateCount
        });
    } catch (error) {
        console.error('Error al actualizar estado de productos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para cambiar puerto serial
app.post('/api/settings/serial-port', async (req, res) => {
    try {
        const { port } = req.body;
        if (!port) {
            return res.status(400).json({ error: 'Se requiere el puerto serial' });
        }
        
        const success = await arduinoController.changeSerialPort(port);
        
        if (success) {
            res.json({ success: true, message: `Puerto cambiado a ${port}` });
        } else {
            res.status(500).json({ 
                success: false, 
                message: `No se pudo conectar al puerto ${port}. Modo simulación activado.` 
            });
        }
    } catch (error) {
        console.error('Error al cambiar puerto serial:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para cambiar modo simulación
app.post('/api/settings/simulation-mode', async (req, res) => {
    try {
        const { enabled } = req.body;
        
        if (enabled === undefined) {
            return res.status(400).json({ error: 'Se requiere el estado de simulación' });
        }
        
        await arduinoController.toggleSimulationMode(enabled);
        
        res.json({ 
            success: true, 
            message: `Modo simulación ${enabled ? 'activado' : 'desactivado'}`
        });
    } catch (error) {
        console.error('Error al cambiar modo simulación:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Manejador de 404
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar la aplicación
initializeApp();