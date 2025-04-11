const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const SystemModel = require('../models/system-model');
const TemperatureModel = require('../models/temperature-model');

class ArduinoController {
    constructor() {
        this.serialPort = null;
        this.parser = null;
        this.simulationMode = true;
        this.connectionStatus = 'Desconectado';
        this.lastTemperature = 5.0;
        this.lastHumidity = 60.0;
        this.simulationInterval = null;
        this.reconnectTimer = null;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;
    }

    async initialize() {
        try {
            this.initializationAttempts++;
            console.log(`Intento de inicialización ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
            
            // Comprobar si el modo simulación está activado
            this.simulationMode = await SystemModel.isSimulationModeEnabled();
            
            if (this.simulationMode) {
                console.log('Modo simulación activado. No se intentará conectar al Arduino.');
                this.connectionStatus = 'Simulación';
                this.startSimulation();
                return true;
            }

            // Obtener puertos seriales disponibles
            const ports = await SerialPort.list();
            console.log('Puertos seriales disponibles:', ports.map(p => p.path));
            
            // Obtener el puerto configurado
            const serialPortPath = await SystemModel.getSetting('serial_port') || 'COM3';
            console.log(`Intentando conectar al puerto ${serialPortPath}...`);

            // Cerrar puerto anterior si existe
            if (this.serialPort && this.serialPort.isOpen) {
                console.log('Cerrando puerto serial anterior...');
                await new Promise(resolve => {
                    this.serialPort.close(resolve);
                });
            }
            
            // Intentar abrir el puerto con manejo de errores mejorado
            try {
                this.serialPort = new SerialPort({ 
                    path: serialPortPath, 
                    baudRate: 9600,
                    autoOpen: false
                });
                
                // Usar promesa para manejar la apertura del puerto
                await new Promise((resolve, reject) => {
                    this.serialPort.open(err => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                    
                    // Establecer un tiempo límite para la apertura
                    setTimeout(() => {
                        reject(new Error('Tiempo de espera agotado al abrir el puerto'));
                    }, 5000);
                });
                
                this.connectionStatus = 'Conectado';
                console.log(`Conectado al puerto serie ${serialPortPath}`);
                
                // Configurar el parser
                this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
                
                // Manejar los datos recibidos
                this.parser.on('data', this.handleData.bind(this));
                
                // Configurar manejo de errores en el puerto serial
                this.serialPort.on('error', (err) => {
                    console.error(`Error en puerto serial: ${err.message}`);
                    this.handleSerialError(err);
                });
                
                // Configurar reconexión automática si se pierde la conexión
                this.serialPort.on('close', () => {
                    console.log('Conexión serial cerrada. Intentando reconectar...');
                    this.connectionStatus = 'Reconectando';
                    
                    // Limpiar timer anterior si existe
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                    }
                    
                    // Intentar reconectar después de 5 segundos
                    this.reconnectTimer = setTimeout(async () => {
                        console.log('Intentando reconexión...');
                        this.initializationAttempts = 0; // Resetear contador para reconexión
                        await this.initialize();
                    }, 5000);
                });
                
                // Iniciar con una lectura simulada para tener datos inmediatos
                this.lastTemperature = 5.0;
                this.lastHumidity = 60.0;
                await TemperatureModel.logTemperature(
                    this.lastTemperature,
                    this.lastHumidity,
                    'initial'
                );
                
                // Resetear contador de intentos cuando hay éxito
                this.initializationAttempts = 0;
                
                return true;
                
            } catch (serialError) {
                console.error(`Error al abrir puerto ${serialPortPath}:`, serialError.message);
                throw serialError; // Propagar el error al manejador principal
            }
        } catch (error) {
            console.error(`Error al inicializar controlador Arduino:`, error.message);
            this.connectionStatus = `Error: ${error.message}`;
            
            // Si hemos intentado varias veces sin éxito, activar modo simulación
            if (this.initializationAttempts >= this.maxInitializationAttempts) {
                console.log(`Máximo de intentos alcanzado (${this.maxInitializationAttempts}). Activando modo simulación.`);
                this.simulationMode = true;
                await SystemModel.updateSetting('simulation_mode', 'true');
                this.startSimulation();
                return true; // Retornar true porque la simulación está activa
            } else {
                console.log(`Intento ${this.initializationAttempts} falló. Reintentando en 5 segundos...`);
                
                // Programar reintento
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                }
                
                this.reconnectTimer = setTimeout(async () => {
                    await this.initialize();
                }, 5000);
                
                // Para el primer intento, activamos simulación temporalmente
                if (this.initializationAttempts === 1) {
                    console.log('Activando modo simulación temporal mientras se resuelve la conexión hardware');
                    this.startSimulation();
                }
                
                return false;
            }
        }
    }

    handleSerialError(error) {
        console.error('Error en puerto serial:', error.message);
        this.connectionStatus = `Error: ${error.message}`;
        
        // Si el error es fatal, intentar inicializar de nuevo
        if (error.disconnected || error.message.includes('Access denied') || error.message.includes('cannot open')) {
            console.log('Error fatal en puerto serial. Reiniciando conexión...');
            
            // Limpiar timer anterior si existe
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            
            // Intentar reconectar después de 5 segundos
            this.reconnectTimer = setTimeout(async () => {
                this.initializationAttempts = 0; // Resetear contador para reconexión desde error
                await this.initialize();
            }, 5000);
        }
    }

    handleData(data) {
        try {
            console.log('Datos recibidos del Arduino:', data);
            
            // Intentar parsear el JSON
            const jsonData = JSON.parse(data.trim());
            
            // Verificar si hay error en la lectura
            if (jsonData.error) {
                console.error('Error reportado por Arduino:', jsonData.error);
                return;
            }
            
            // Verificar que los datos sean válidos
            if (jsonData.temperature !== undefined && jsonData.humidity !== undefined) {
                const temp = parseFloat(jsonData.temperature);
                const humidity = parseFloat(jsonData.humidity);
                
                // Verificar que los valores estén en rangos razonables
                if (!isNaN(temp) && !isNaN(humidity) && 
                    temp >= -40 && temp <= 80 && 
                    humidity >= 0 && humidity <= 100) {
                    
                    // Actualizar valores
                    this.lastTemperature = temp;
                    this.lastHumidity = humidity;
                    
                    // Registrar en la base de datos
                    TemperatureModel.logTemperature(
                        this.lastTemperature,
                        this.lastHumidity,
                        'arduino'
                    );
                    
                    console.log(`Temperatura: ${this.lastTemperature}°C, Humedad: ${this.lastHumidity}%`);
                } else {
                    console.error('Valores de temperatura o humedad fuera de rango:', jsonData);
                }
            }
        } catch (error) {
            console.error('Error al procesar datos del Arduino:', error.message);
            console.error('Datos recibidos:', data);
        }
    }

    startSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        
        console.log('Iniciando simulación de datos del sensor...');
        
        // Establecer valores iniciales para la simulación
        this.lastTemperature = 22.0; // Un valor inicial de habitación (antes era 5.0°C)
        this.lastHumidity = 60.0;
        
        // Registrar lectura inicial en la base de datos
        TemperatureModel.logTemperature(
            this.lastTemperature,
            this.lastHumidity,
            'simulation'
        );
        
        // Simular lecturas del sensor cada 10 segundos
        this.simulationInterval = setInterval(() => {
            // Simular pequeñas variaciones en la temperatura (entre -0.2 y +0.2)
            const tempVariation = (Math.random() * 0.4) - 0.2;
            this.lastTemperature += tempVariation;
            
            // Mantener la temperatura en un rango realista para ambiente (20-26°C)
            if (this.lastTemperature < 20) this.lastTemperature = 20;
            if (this.lastTemperature > 26) this.lastTemperature = 26;
            
            // Simular pequeñas variaciones en la humedad (entre -1 y +1)
            const humVariation = (Math.random() * 2) - 1;
            this.lastHumidity += humVariation;
            
            // Mantener la humedad en un rango realista (40-60%)
            if (this.lastHumidity < 40) this.lastHumidity = 40;
            if (this.lastHumidity > 60) this.lastHumidity = 60;
            
            // Redondear a una decimal
            this.lastTemperature = Math.round(this.lastTemperature * 10) / 10;
            this.lastHumidity = Math.round(this.lastHumidity * 10) / 10;
            
            // Registrar en la base de datos
            TemperatureModel.logTemperature(
                this.lastTemperature,
                this.lastHumidity,
                'simulation'
            );
            
            console.log(`[SIMULACIÓN] Temperatura: ${this.lastTemperature}°C, Humedad: ${this.lastHumidity}%`);
        }, 10000);
    }

    async getLatestData() {
        // Devolver datos actuales
        return {
            temperature: this.lastTemperature,
            humidity: this.lastHumidity,
            simulationMode: this.simulationMode,
            status: this.connectionStatus
        };
    }

    async toggleSimulationMode(enabled) {
        try {
            // Actualizar el modo de simulación
            return await this.setSimulationMode(enabled);
        } catch (error) {
            console.error('Error al cambiar modo simulación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async setSimulationMode(enabled) {
        try {
            this.simulationMode = enabled;
            
            // Actualizar en la base de datos
            await SystemModel.updateSetting('simulation_mode', enabled ? 'true' : 'false');
            
            if (enabled) {
                // Si estamos activando la simulación, cerrar el puerto serial si está abierto
                if (this.serialPort && this.serialPort.isOpen) {
                    await new Promise(resolve => {
                        this.serialPort.close(resolve);
                    });
                    this.serialPort = null;
                    this.parser = null;
                }
                
                // Iniciar simulación
                this.connectionStatus = 'Simulación';
                this.startSimulation();
            } else {
                // Si estamos desactivando la simulación, detener la simulación
                if (this.simulationInterval) {
                    clearInterval(this.simulationInterval);
                    this.simulationInterval = null;
                }
                
                // Intentar conectar al hardware
                this.initializationAttempts = 0; // Resetear contador de intentos
                await this.initialize();
            }
            
            return {
                success: true,
                mode: enabled ? 'simulation' : 'hardware',
                status: this.connectionStatus
            };
        } catch (error) {
            console.error('Error al cambiar modo de simulación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async changeSerialPort(port) {
        try {
            // Actualizar puerto en la base de datos
            await SystemModel.updateSetting('serial_port', port);
            
            // Si no estamos en modo simulación, reiniciar la conexión
            if (!this.simulationMode) {
                this.initializationAttempts = 0; // Resetear contador de intentos
                await this.initialize();
            }
            
            return {
                success: true,
                port: port,
                status: this.connectionStatus
            };
        } catch (error) {
            console.error('Error al actualizar puerto serial:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new ArduinoController();