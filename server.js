// Modificar la parte superior del archivo para importar getPool
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar módulos de base de datos y controladores
const { initializeDatabase, getPool } = require('./database/db-connection');
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

// Verifica que coincida con el nombre real de la carpeta (Public con P mayúscula)
app.use(express.static(path.join(__dirname, 'Public')));

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
        // Obtener datos del sensor
        const sensorData = await arduinoController.getLatestData();
        
        // Añadir timestamp para evitar cacheo
        sensorData.timestamp = new Date().getTime();
        
        // Log detallado
        console.log('Enviando datos del sensor al cliente:', 
            JSON.stringify(sensorData, null, 2));
        
        res.json(sensorData);
    } catch (error) {
        console.error('Error al obtener datos del sensor:', error);
        res.status(500).json({ 
            error: 'Error al obtener datos del sensor',
            message: error.message,
            timestamp: new Date().getTime()
        });
    }
});

// Ruta para depurar datos del sensor
app.get('/api/debug/sensor', async (req, res) => {
    try {
        // Obtener los datos actuales del sensor
        const sensorData = await arduinoController.getLatestData();
        
        // Obtener la última lectura registrada en la base de datos
        const latestReading = await TemperatureModel.getLatestReading();
        
        // Devolver información detallada
        res.json({
            controller_data: {
                temperature: sensorData.temperature,
                humidity: sensorData.humidity,
                simulationMode: sensorData.simulationMode,
                status: sensorData.status
            },
            latest_database_reading: latestReading,
            html_elements: {
                temperature_element_selector: '#temperature',
                humidity_element_selector: '#humidity'
            },
            debug_info: {
                timestamp: new Date().toISOString(),
                server_uptime: process.uptime()
            }
        });
    } catch (error) {
        console.error('Error en ruta de depuración del sensor:', error);
        res.status(500).json({ error: error.message });
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

// Ruta para depurar conexión
app.get('/api/debug/connection', async (req, res) => {
    try {
        const { SerialPort } = require('serialport');
        const ports = await SerialPort.list();
        
        // Obtener estado actual y configuración
        const serialPortPath = await SystemModel.getSetting('serial_port');
        const simulationMode = await SystemModel.isSimulationModeEnabled();
        
        // Obtener datos del arduino controller
        const arduinoData = await arduinoController.getLatestData();
        
        res.json({
            puertos_disponibles: ports,
            configuracion: {
                puerto_actual: serialPortPath,
                modo_simulacion: simulationMode
            },
            estado_arduino: {
                temperatura: arduinoData.temperature,
                humedad: arduinoData.humidity,
                estado_conexion: arduinoData.status,
                modo_simulacion: arduinoData.simulationMode
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error en ruta de depuración:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Ruta para depurar la conexión con Arduino
app.get('/api/debug/arduino', async (req, res) => {
    try {
        // Listar puertos seriales disponibles
        const { SerialPort } = require('serialport');
        const availablePorts = await SerialPort.list();
        
        // Obtener el puerto configurado
        const configuredPort = await SystemModel.getSetting('serial_port');
        
        // Obtener el estado de simulación
        const simulationMode = await SystemModel.isSimulationModeEnabled();
        
        // Obtener la última lectura
        const latestReading = await TemperatureModel.getLatestReading();
        
        // Obtener estado del controlador Arduino
        const arduinoStatus = {
            connectionStatus: arduinoController.connectionStatus,
            simulationMode: arduinoController.simulationMode,
            lastTemperature: arduinoController.lastTemperature,
            lastHumidity: arduinoController.lastHumidity,
            hasSerialPort: arduinoController.serialPort !== null,
            serialPortOpen: arduinoController.serialPort ? arduinoController.serialPort.isOpen : false
        };
        
        res.json({
            controller_status: arduinoStatus,
            system_settings: {
                configured_port: configuredPort,
                simulation_mode_enabled: simulationMode
            },
            available_ports: availablePorts,
            latest_reading: latestReading,
            server_info: {
                uptime: process.uptime(),
                node_version: process.version,
                platform: process.platform
            }
        });
    } catch (error) {
        console.error('Error en ruta de depuración de Arduino:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Corregir la ruta de temperatura promedio
app.get('/api/temperature/average', async (req, res) => {
    try {
        const pool = getPool();
        const [result] = await pool.query(`
            SELECT AVG(temperature) as average 
            FROM temperature_logs 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        `);
        
        const average = result[0].average || 0;
        
        res.json({ average });
    } catch (error) {
        console.error('Error al obtener temperatura promedio:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para predecir fecha de caducidad
app.post('/api/predict-expiration', async (req, res) => {
    try {
        const { type, manufacturingDate, entryDate } = req.body;
        
        // Obtener temperatura actual
        const latestTemp = await TemperatureModel.getLatestReading();
        const currentTemp = latestTemp ? latestTemp.temperature : 22;
        
        // Calcular fecha de vencimiento
        const expirationDate = await FoodTypeModel.calculateExpirationDate(
            type,
            manufacturingDate,
            entryDate || new Date().toISOString().split('T')[0],
            currentTemp
        );
        
        res.json({ 
            expirationDate,
            temperature: currentTemp
        });
    } catch (error) {
        console.error('Error al predecir fecha de caducidad:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Rutas de páginas principales al final
// Ruta raíz - muestra la página principal del sistema (index)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// Ruta explícita para login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'login.html'));
});

// Ruta adicional para index (por compatibilidad)
app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// Redirigir solicitudes directas a archivos HTML
app.get('*.html', (req, res) => {
    const page = req.path.substring(1);
    if (page === 'login.html') {
        res.redirect('/login');
    } else if (page === 'index.html') {
        res.redirect('/index');
    } else {
        res.status(404).send('Página no encontrada');
    }
});

// Manejador de 404 para último recurso
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar la aplicación
initializeApp();