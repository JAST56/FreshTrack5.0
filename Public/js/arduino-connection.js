// arduino-connection.js - Modificado para mejorar la gestión de errores de conexión

// Variables globales para los datos del sensor
window.currentTemp = 0;
window.currentHumidity = 0;
const apiBaseUrl = '/api'; // Ruta relativa a la API

// Variables para almacenar datos para el gráfico
let temperatureHistory = [];
const MAX_CHART_POINTS = 12; // 2 horas con lecturas cada 10 minutos

document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM para actualizar con los datos del sensor
    const temperatureElement = document.getElementById('temperature');
    const humidityElement = document.getElementById('humidity');
    const arduinoStatusElement = document.getElementById('arduino-status');
    const dhtStatusElement = document.getElementById('dht-status');
    const serverStatusElement = document.getElementById('server-status');
    const lastReadingTimeElement = document.getElementById('last-reading-time');
    
    // Inicializar la conexión
    initConnection();
    
    // Inicializar el gráfico de temperatura
    initTemperatureChart();
    
    // Botón para ver historial
    document.getElementById('view-history').addEventListener('click', function() {
        fetchTemperatureHistory();
    });
    
    // Función para obtener historial de temperatura
    async function fetchTemperatureHistory() {
        try {
            const response = await fetch(`/api/temperature/history?limit=24`);
            
            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || data.length === 0) {
                if (window.showToast) {
                    window.showToast('No hay datos de temperatura disponibles', 'warning');
                }
                return;
            }
            
            // Mostrar historial en una ventana modal
            showTemperatureHistoryModal(data);
            
        } catch (error) {
            console.error('Error al obtener historial de temperatura:', error);
            if (window.showToast) {
                window.showToast('Error al obtener historial de temperatura', 'error');
            }
        }
    }
    
    // Función para mostrar historial en una ventana modal
    function showTemperatureHistoryModal(historyData) {
        // Crear elemento modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'temperature-history-modal';
    
        // Formatear datos
        let tableRows = '';
        historyData.forEach(reading => {
            const date = new Date(reading.timestamp);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            const source = reading.source === 'simulation' ? '(Simulado)' : '';
            
            // Determinar clase para temperatura y humedad
            const tempClass = reading.temperature > 8 ? 'text-danger' : 
                              reading.temperature > 5 ? 'text-warning' : '';
    
            tableRows += `
                <tr>
                    <td>${formattedDate}</td>
                    <td class="${tempClass}">${reading.temperature} °C</td>
                    <td>${reading.humidity} %</td>
                    <td>${source}</td>
                </tr>
            `;
        });
    
        // HTML del modal con estilos mejorados
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Historial de Temperatura</h3>
                    <button class="close-button">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="report-table-container">
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
                    <div style="margin-top: 15px; text-align: right;">
                        <button id="export-to-excel" class="btn-primary">
                            <i class="fas fa-file-excel"></i> Exportar a Excel
                        </button>
                    </div>
                </div>
            </div>
        `;
    
        // Agregar al DOM
        document.body.appendChild(modal);
    
        // Mostrar modal
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    
        // Cerrar modal al hacer clic en el botón de cierre
        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        });
    
        // Añadir funcionalidad al botón de exportación
        document.getElementById('export-to-excel').addEventListener('click', () => {
            exportToExcel(historyData);
        });
    }
});

// Función para inicializar la conexión
function initConnection() {
    console.log('Inicializando conexión con Arduino...');
    
    // Obtener datos iniciales y luego programar obtención periódica
    fetchSensorData()
        .then(() => {
            console.log('Datos iniciales obtenidos correctamente');
            
            // Programar actualización periódica (cada 10 segundos)
            setInterval(fetchSensorData, 10000);
        })
        .catch(error => {
            console.error('Error al obtener datos iniciales:', error);
            
            // Incluso en caso de error, intentar periódicamente
            setInterval(fetchSensorData, 10000);
        });
    
    // Obtener estado del sistema y conexión
    fetchSystemStatus()
        .then(() => console.log('Estado del sistema obtenido correctamente'))
        .catch(error => console.error('Error al obtener estado del sistema:', error));
    
    // Inicializar el gráfico de temperatura
    initTemperatureChart();
}

// Función para obtener datos del sensor
async function fetchSensorData() {
    try {
        // Añadir un pequeño retraso antes del primer intento de conexión
        if (!window.initialConnectionAttempted) {
            await new Promise(resolve => setTimeout(resolve, 500));
            window.initialConnectionAttempted = true;
        }
        
        const response = await fetch(`/api/sensor-data`);
        
        if (!response.ok) {
            throw new Error(`Error en la API: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Datos recibidos del sensor:', data);
        
        // Actualizar variables globales
        window.currentTemp = data.temperature;
        window.currentHumidity = data.humidity;
        
        // Actualizar la interfaz con ambos métodos
        updateSensorDisplay(data);
        forceUpdateDisplays(); // Añadir esta línea
        
        // Actualizar el gráfico de temperatura
        updateTemperatureChart(data.temperature);
        
        // Verificar si la temperatura es crítica o de advertencia
        checkTemperatureAlert(data.temperature);
        
        // Si hubo un error previo, mostrar que la conexión se restableció
        if (window.hadConnectionError) {
            window.hadConnectionError = false;
            if (window.showToast) {
                window.showToast('Conexión con el sensor restablecida', 'success');
            }
        }
        
        // También actualizar el estado de los alimentos basado en la nueva temperatura
        if (window.updateFoodStatus && typeof window.updateFoodStatus === 'function') {
            window.updateFoodStatus();
        }
        
        // Obtener estado del sistema
        fetchSystemStatus();
        
        // Solo registrar actividad si obtenemos datos válidos
        if (data && data.temperature !== undefined) {
            if (window.logActivity && typeof window.logActivity === 'function') {
                window.logActivity(`Temperatura actual: ${data.temperature}°C, Humedad: ${data.humidity}%`, 'info');
            }
        }
        
        console.log('Datos actualizados:', { temp: window.currentTemp, humidity: window.currentHumidity });
    } catch (error) {
        console.error('Error al obtener datos del sensor:', error);
        
        // Registrar que tuvimos un error de conexión
        window.hadConnectionError = true;
        
        // No mostrar inmediatamente un error en la primera carga de página
        // Solo actualizar visualmente el estado
        updateConnectionStatus('Error de conexión', false);
        
        // Solo mostrar toast de error si no es el primer intento de carga de página
        // o si ya hemos intentado varias veces
        if (window.initialDataFetchAttempted || window.connectionRetries > 1) {
            if (window.showToast && typeof window.showToast === 'function') {
                window.showToast('Error al conectar con el sensor. Reintentando...', 'error');
            }
        }
        
        window.initialDataFetchAttempted = true;
    }
}

// Función para obtener el estado del sistema
async function fetchSystemStatus() {
    try {
        const response = await fetch(`/api/status`);
        
        if (!response.ok) {
            throw new Error(`Error en la API: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Actualizar elementos de la interfaz para el estado del sistema
        updateConnectionStatus(data.connection, !data.simulationMode);
        
        // Actualizar última lectura de tiempo
        if (data.lastReading) {
            updateLastReadingTime(data.lastReading.timestamp);
        }
        
    } catch (error) {
        console.error('Error al obtener estado del sistema:', error);
        updateConnectionStatus('Error', false);
    }
}

// Función para actualizar la visualización de datos del sensor
function updateSensorDisplay(data) {
    console.log('Actualizando display con datos:', data);
    
    // Actualizar temperatura en la interfaz
    const tempElement = document.getElementById('temperature');
    if (tempElement && data.temperature !== undefined) {
        const temp = parseFloat(data.temperature);
        tempElement.textContent = `${temp.toFixed(1)}°C`;
        console.log('Elemento temperatura actualizado:', tempElement.textContent);
        
        // Verificar si la temperatura requiere alerta
        checkTemperatureAlert(temp);
        
        // Actualizar gráfico de temperatura
        updateTemperatureChart(temp);
    } else {
        console.warn('No se encontró el elemento de temperatura o no hay datos');
    }
    
    // Actualizar humedad en la interfaz
    const humidityElement = document.getElementById('humidity');
    if (humidityElement && data.humidity !== undefined) {
        humidityElement.textContent = `${parseFloat(data.humidity).toFixed(1)}%`;
        console.log('Elemento humedad actualizado:', humidityElement.textContent);
    } else {
        console.warn('No se encontró el elemento de humedad o no hay datos');
    }
    
    // También actualizar variables globales
    window.currentTemp = parseFloat(data.temperature);
    window.currentHumidity = parseFloat(data.humidity);
}

// Función para actualizar el estado de conexión
function updateConnectionStatus(status, isHardware) {
    const statusElement = document.getElementById('arduino-status');
    const dhtStatusElement = document.getElementById('dht-status');
    const serverStatusElement = document.getElementById('server-status');
    
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = status === 'Conectado' ? 'connected' : 
                                  status === 'Simulación' ? 'simulation' : 'error';
    }
    
    if (dhtStatusElement) {
        dhtStatusElement.textContent = isHardware ? 'Operativo' : 'Simulado';
        dhtStatusElement.className = 'connected';
    }
    
    if (serverStatusElement) {
        serverStatusElement.textContent = 'En línea';
        serverStatusElement.className = 'connected';
    }
}

// Función para actualizar el tiempo de la última lectura
function updateLastReadingTime(timestamp) {
    const lastReadingTimeElement = document.getElementById('last-reading-time');
    
    if (lastReadingTimeElement && timestamp) {
        const lastTime = new Date(timestamp);
        const now = new Date();
        const diffMs = now - lastTime;
        const diffMins = Math.floor(diffMs / 60000);
        
        lastReadingTimeElement.textContent = diffMins <= 0 ? 
            'Hace menos de 1 min' : `Hace ${diffMins} min`;
    }
}

// Exponer funciones para uso externo
window.fetchSensorData = fetchSensorData;
window.updateConnectionStatus = updateConnectionStatus;

// Función para actualizar forzadamente todos los displays de temperatura y humedad
function forceUpdateDisplays() {
    // Si tenemos datos válidos, actualizar todos los displays
    if (window.currentTemp !== undefined && window.currentHumidity !== undefined) {
        console.log('Forzando actualización de displays con:', window.currentTemp, window.currentHumidity);
        
        // Actualizar displays de temperatura
        const tempElements = [
            document.getElementById('temperature'),
            document.getElementById('current-temp'),
            document.getElementById('temp-value')
        ];
        
        tempElements.forEach(el => {
            if (el) {
                el.textContent = `${parseFloat(window.currentTemp).toFixed(1)}°C`;
            }
        });
        
        // Actualizar displays de humedad
        const humidityElements = [
            document.getElementById('humidity'),
            document.getElementById('current-humidity'),
            document.getElementById('hum-value')
        ];
        
        humidityElements.forEach(el => {
            if (el) {
                el.textContent = `${parseFloat(window.currentHumidity).toFixed(1)}%`;
            }
        });
    }
}

// Programar actualización forzada cada 5 segundos
setInterval(forceUpdateDisplays, 5000);

// Exponer la función para uso externo
window.forceUpdateDisplays = forceUpdateDisplays;

// Función para exportar historial a Excel
function exportToExcel(historyData) {
    // Verificar si la librería XLSX está disponible
    if (typeof XLSX === 'undefined') {
        console.error('Librería XLSX no cargada');
        window.showToast('Error: Librería de exportación no disponible', 'error');
        return;
    }
    
    try {
        // Formatear los datos para Excel
        const formattedData = historyData.map(reading => ({
            'Fecha y Hora': new Date(reading.timestamp).toLocaleString(),
            'Temperatura (°C)': reading.temperature,
            'Humedad (%)': reading.humidity,
            'Origen': reading.source === 'simulation' ? 'Simulado' : 'Sensor'
        }));

        // Crear una hoja de trabajo
        const worksheet = XLSX.utils.json_to_sheet(formattedData);

        // Crear un libro de trabajo
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Temperatura');

        // Exportar a archivo Excel
        XLSX.writeFile(workbook, 'Historial_Temperatura.xlsx');
        
        window.showToast('Archivo Excel generado correctamente', 'success');
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        window.showToast('Error al generar archivo Excel', 'error');
    }
}

// Función para verificar temperatura crítica
function checkTemperatureAlert(temperature) {
    // Define los umbrales de temperatura (actualizados)
    const warningTemp = 25; // Temperatura de advertencia (antes era 6°C)
    const criticalTemp = 28; // Temperatura crítica (antes era 8°C)
    
    if (temperature >= criticalTemp) {
        // Alerta crítica
        showToast(`¡ALERTA CRÍTICA! Temperatura muy alta: ${temperature}°C`, 'error');
        logTemperatureAlert(temperature, 'Temperatura crítica detectada');
        return true;
    } else if (temperature >= warningTemp) {
        // Advertencia
        showToast(`Advertencia: Temperatura elevada: ${temperature}°C`, 'warning');
        logTemperatureAlert(temperature, 'Temperatura elevada detectada');
        return true;
    }
    return false;
}

// Función para inicializar el gráfico de temperatura
function initTemperatureChart() {
    // Verificar si ya existe un gráfico y destruirlo
    if (window.tempChart) {
        window.tempChart.destroy();
    }
    
    const ctx = document.getElementById('temperature-chart');
    if (!ctx) return;
    
    // Crear gráfico vacío con colores más elegantes
    window.tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperatura (°C)',
                data: [],
                borderColor: 'rgba(52, 152, 219, 1)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Evolución de temperatura (últimas 2 horas)',
                    color: '#2c3e50',
                    font: {
                        size: 16,
                        weight: '500'
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(44, 62, 80, 0.9)',
                    titleColor: '#ecf0f1',
                    bodyColor: '#ecf0f1',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 6
                }
            },
            scales: {
                y: {
                    suggestedMin: 18,  // Cambiado de 0 a 18
                    suggestedMax: 30,  // Cambiado de 10 a 30
                    title: {
                        display: true,
                        text: 'Temperatura (°C)',
                        color: '#2c3e50'
                    },
                    ticks: {
                        color: '#2c3e50'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hora',
                        color: '#2c3e50'
                    },
                    ticks: {
                        color: '#2c3e50'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

// Función para añadir datos al gráfico
function updateTemperatureChart(temperature) {
    if (!window.tempChart) return;
    
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Agregar nuevo punto
    temperatureHistory.push({
        time: timeLabel,
        value: temperature,
        timestamp: now
    });
    
    // Limitar los puntos al máximo
    if (temperatureHistory.length > MAX_CHART_POINTS) {
        temperatureHistory.shift();
    }
    
    // Actualizar datos del gráfico
    window.tempChart.data.labels = temperatureHistory.map(point => point.time);
    window.tempChart.data.datasets[0].data = temperatureHistory.map(point => point.value);
    
    // Refrescar el gráfico
    window.tempChart.update();
}