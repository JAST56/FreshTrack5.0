const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const SystemModel = require('../models/system-model');
const TemperatureModel = require('../models/temperature-model');

class ArduinoController {
    constructor() {
        this.serialPort = null;
        this.parser = null;
        this.connectionStatus = 'Desconectado';
        this.lastTemperature = 22.0;
        this.lastHumidity = 60.0;
        this.simulationMode = true;
        this.simulationInterval = null;
    }
    
    // Inicializar la conexión con Arduino
    async initialize() {
        try {
            // Comprobar si el modo simulación está activado
            this.simulationMode = await SystemModel.isSimulationModeEnabled();
            
            if (this.simulationMode) {
                console.log('Modo simulación activado. No se intentará conectar al Arduino.');
                this.connectionStatus = 'Simulación';
                this.startSimulation();
                return true;
            }
            
            // Obtener el puerto configurado
            const serialPortPath = await SystemModel.getSetting('serial_port') || 'COM7';
            
            // Intentar conectar al puerto serial
            try {
                this.serialPort = new SerialPort({ 
                    path: serialPortPath, 
                    baudRate: 9600 
                });
                
                this.connectionStatus = 'Conectado';
                console.log(`Conectado al puerto serie ${serialPortPath}`);
                
                // Configurar el parser
                this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
                
                // Manejar los datos recibidos
                this.parser.on('data', this.handleData.bind(this));
                
                // Manejar errores
                this.serialPort.on('error', (err) => {
                    console.error('Error en el puerto serie:', err.message);
                    this.connectionStatus = `Error: ${err.message}`;
                    
                    // Si hay error de conexión, activar modo simulación
                    if (!this.simulationMode) {
                        console.log('Activando modo simulación debido a error en puerto serial');
                        this.simulationMode = true;
                        this.startSimulation();
                    }
                });
                
                return true;
            } catch (error) {
                console.error(`Error al conectar con el puerto ${serialPortPath}:`, error.message);
                this.connectionStatus = `Error: ${error.message}`;
                
                // Activar modo simulación
                this.simulationMode = true;
                this.startSimulation();
                
                return false;
            }
        } catch (error) {
            console.error('Error al inicializar controlador Arduino:', error);
            this.simulationMode = true;
            this.startSimulation();
            return false;
        }
    }
    
    // Manejar los datos recibidos del Arduino
    async handleData(data) {
        try {
            // Intentar parsear los datos como JSON
            const sensorData = JSON.parse(data.trim());
            
            if (sensorData.temperature !== undefined) {
                this.lastTemperature = sensorData.temperature;
            }
            
            if (sensorData.humidity !== undefined) {
                this.lastHumidity = sensorData.humidity;
            }
            
            // Guardar en la base de datos
            await TemperatureModel.logTemperature(
                this.lastTemperature, 
                this.lastHumidity, 
                'sensor'
            );
            
            console.log('Datos recibidos:', { 
                temperature: this.lastTemperature, 
                humidity: this.lastHumidity 
            });
        } catch (error) {
            // Si los datos no son JSON válido, intentar parsear como texto
            console.log('Datos sin formato recibidos:', data.trim());
            
            // Intentar extraer temperatura y humedad de un formato como "Temp: 30.0 C, Hum: 54.0%"
            const tempMatch = data.match(/Temp\s*:\s*(\d+(\.\d+)?)/i);
            const humMatch = data.match(/Hum\s*:\s*(\d+(\.\d+)?)/i);
            
            if (tempMatch) {
                this.lastTemperature = parseFloat(tempMatch[1]);
                console.log('Temperatura extraída:', this.lastTemperature);
            }
            
            if (humMatch) {
                this.lastHumidity = parseFloat(humMatch[1]);
                console.log('Humedad extraída:', this.lastHumidity);
            }
            
            if (tempMatch || humMatch) {
                // Guardar en la base de datos
                await TemperatureModel.logTemperature(
                    this.lastTemperature, 
                    this.lastHumidity, 
                    'sensor'
                );
            }
        }
    }
    
    // Iniciar simulación cuando no hay Arduino conectado
    startSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        
        console.log('Iniciando simulación de temperatura y humedad');
        
        // Generar lecturas aleatorias cada 10 segundos
        this.simulationInterval = setInterval(async () => {
            // Temperatura entre 2 y 12 grados (refrigerador)
            this.lastTemperature = +(Math.random() * 10 + 2).toFixed(1);
            // Humedad entre 45 y 75%
            this.lastHumidity = +(Math.random() * 30 + 45).toFixed(1);
            
            // Guardar en la base de datos
            await TemperatureModel.logTemperature(
                this.lastTemperature, 
                this.lastHumidity, 
                'simulation'
            );
            
            console.log('Datos simulados:', { 
                temperature: this.lastTemperature, 
                humidity: this.lastHumidity 
            });
        }, 10000);
    }
    
    // Detener simulación
    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }
    
    // Obtener datos actuales del sensor
    getSensorData() {
        return {
            temperature: this.lastTemperature,
            humidity: this.lastHumidity,
            status: this.connectionStatus,
            simulationMode: this.simulationMode
        };
    }
    
    // Cambiar al puerto serial especificado
    async changeSerialPort(newPort) {
        // Detener conexión actual
        if (this.serialPort) {
            this.serialPort.close();
            this.serialPort = null;
        }
        
        // Actualizar configuración en la base de datos
        await SystemModel.updateSetting('serial_port', newPort);
        
        // Desactivar simulación
        this.simulationMode = false;
        await SystemModel.updateSetting('simulation_mode', 'false');
        this.stopSimulation();
        
        // Reiniciar conexión
        return this.initialize();
    }
    
    // Cambiar modo simulación
    async toggleSimulationMode(enabled) {
        this.simulationMode = enabled;
        await SystemModel.updateSetting('simulation_mode', enabled ? 'true' : 'false');
        
        if (enabled) {
            // Cerrar puerto serial si existe
            if (this.serialPort) {
                this.serialPort.close();
                this.serialPort = null;
            }
            this.startSimulation();
        } else {
            // Detener simulación
            this.stopSimulation();
            // Intentar reconectar
            return this.initialize();
        }
        
        return true;
    }
}

// Singleton para usar la misma instancia en toda la aplicación
const arduinoController = new ArduinoController();

module.exports = arduinoController;