// arduino-connection.js - Modificado para usar API con MySQL
document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM para actualizar con los datos del sensor
    const temperatureElement = document.getElementById('temperature');
    const humidityElement = document.getElementById('humidity');
    const arduinoStatusElement = document.getElementById('arduino-status');
    const dhtStatusElement = document.getElementById('dht-status');
    const serverStatusElement = document.getElementById('server-status');
    const lastReadingTimeElement = document.getElementById('last-reading-time');
    
    // Asegurarse de que estas variables estén en el ámbito global para que app.js pueda acceder a ellas
    if (typeof window.currentTemp === 'undefined') {
        window.currentTemp = 22;
    }
    
    if (typeof window.currentHumidity === 'undefined') {
        window.currentHumidity = 60;
    }
    
    // URL base para la API
    const apiBaseUrl = '/api'; // Ahora es relativo para trabajar en el mismo dominio
    
    // Función para obtener los datos del sensor
    async function fetchSensorData() {
        try {
            const response = await fetch(`${apiBaseUrl}/sensor-data`);
            
            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Datos recibidos del sensor:', data);
            
            // Actualizar variables globales
            window.currentTemp = data.temperature;
            window.currentHumidity = data.humidity;
            
            // Actualizar la interfaz
            updateSensorDisplay(data);
            
            // También actualizar el estado de los alimentos basado en la nueva temperatura
            if (window.updateFoodStatus && typeof window.updateFoodStatus === 'function') {
                window.updateFoodStatus();
            }
            
            // Obtener estado del sistema
            fetchSystemStatus();
            
            // Registrar la actividad sin mostrar toast
            if (window.logActivity && typeof window.logActivity === 'function') {
                window.logActivity(`Temperatura actual: ${data.temperature}°C, Humedad: ${data.humidity}%`, 'info');
            }
            
            console.log('Datos actualizados:', { temp: window.currentTemp, humidity: window.currentHumidity });
        } catch (error) {
            console.error('Error al obtener datos del sensor:', error);
            // Mostrar error en interfaz
            updateConnectionStatus('Error de conexión', false);
            
            // En este caso sí mostramos toast porque es un error
            if (window.showToast && typeof window.showToast === 'function') {
                window.showToast('Error al conectar con el sensor', 'error');
            }
        }
    }
    
    // Función para obtener el estado del sistema
    async function fetchSystemStatus() {
        try {
            const response = await fetch(`${apiBaseUrl}/status`);
            
            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Estado del sistema:', data);
            
            // Actualizar elementos de la interfaz para el estado del sistema
            if (arduinoStatusElement) {
                arduinoStatusElement.textContent = data.simulationMode ? 'Simulación activa' : data.connection;
                arduinoStatusElement.className = data.simulationMode ? 'simulation' : 
                    (data.connection === 'Conectado' ? 'connected' : 'error');
            }
            
            if (dhtStatusElement) {
                dhtStatusElement.textContent = data.simulationMode ? 'Simulado' : 'Operativo';
            }
            
            if (serverStatusElement) {
                serverStatusElement.textContent = 'En línea';
                serverStatusElement.className = 'connected';
            }
            
            // Actualizar última lectura de tiempo
            if (lastReadingTimeElement && data.lastReading) {
                const lastTime = new Date(data.lastReading.timestamp);
                const now = new Date();
                const diffMs = now - lastTime;
                const diffMins = Math.floor(diffMs / 60000);
                
                lastReadingTimeElement.textContent = diffMins <= 0 ? 
                    'Hace menos de 1 min' : `Hace ${diffMins} min`;
            }
            
        } catch (error) {
            console.error('Error al obtener estado del sistema:', error);
            updateConnectionStatus('Error de conexión', false);
        }
    }
    
    // Función para actualizar la interfaz
    function updateSensorDisplay(data) {
        if (temperatureElement) {
            temperatureElement.textContent = `${data.temperature} °C`;
        }
        
        if (humidityElement) {
            humidityElement.textContent = `${data.humidity} %`;
        }
    }
    
    // Función para actualizar el estado de conexión
    function updateConnectionStatus(status, isConnected) {
        if (arduinoStatusElement) {
            arduinoStatusElement.textContent = status;
            arduinoStatusElement.className = isConnected ? 'connected' : 'error';
        }
        
        if (dhtStatusElement) {
            dhtStatusElement.textContent = isConnected ? 'Operativo' : 'Sin conexión';
            dhtStatusElement.className = isConnected ? 'connected' : 'error';
        }
        
        if (serverStatusElement) {
            serverStatusElement.textContent = isConnected ? 'En línea' : 'Sin respuesta';
            serverStatusElement.className = isConnected ? 'connected' : 'error';
        }
    }
    
    // Función para iniciar la comunicación con la API
    function initConnection() {
        // Obtener datos inmediatamente al cargar la página
        fetchSensorData();
        
        // Luego configurar un intervalo para obtener datos periódicamente
        setInterval(fetchSensorData, 5000); // Actualizar cada 5 segundos
    }
    
    // Modificar el código existente para el botón de historial
    document.getElementById('view-history').addEventListener('click', function() {
        fetchTemperatureHistory();
    });
    
    // Función para obtener historial de temperatura
    async function fetchTemperatureHistory() {
        try {
            const response = await fetch(`${apiBaseUrl}/temperature/history?limit=24`);
            
            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Historial de temperatura:', data);
            
            // Mostrar historial en una ventana modal
            showTemperatureHistoryModal(data);
            
        } catch (error) {
            console.error('Error al obtener historial de temperatura:', error);
            window.showToast('Error al obtener historial de temperatura', 'error');
        }
    }
    
    // Función para mostrar historial en una ventana modal
    function showTemperatureHistoryModal(historyData) {
        // Crear elemento modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // Formatear datos
        let tableRows = '';
        historyData.forEach(reading => {
            const date = new Date(reading.timestamp);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            const source = reading.source === 'simulation' ? '(Simulado)' : '';
            
            tableRows += `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${reading.temperature} °C</td>
                    <td>${reading.humidity} %</td>
                    <td>${source}</td>
                </tr>
            `;
        });
        
        // HTML del modal
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Historial de Temperatura</h3>
                    <button class="close-button">&times;</button>
                </div>
                <div class="modal-body">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Temperatura</th>
                                <th>Humedad</th>
                                <th>Origen</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Agregar al DOM
        document.body.appendChild(modal);
        
        // Mostrar modal
        setTimeout(() => {
            modal.style.display = 'flex';
        }, 10);
        
        // Cerrar modal al hacer clic en el botón de cierre
        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        });
        
        // Cerrar modal al hacer clic fuera del contenido
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 300);
            }
        });
    }
    
    // Iniciar la conexión
    initConnection();
});