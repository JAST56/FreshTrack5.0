// Reescribir config.js completamente para asegurar que funcione correctamente

document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const serialPortInput = document.getElementById('serial-port');
    const updatePortButton = document.getElementById('update-port');
    const currentPortSpan = document.getElementById('current-port');
    const hardwareModeRadio = document.getElementById('hardware-mode');
    const simulationModeRadio = document.getElementById('simulation-mode');
    const testConnectionButton = document.getElementById('test-connection');
    
    // Asegurarse de que estos elementos existan antes de continuar
    if (!serialPortInput || !updatePortButton || !currentPortSpan || 
        !hardwareModeRadio || !simulationModeRadio || !testConnectionButton) {
        console.error('No se encontraron los elementos de configuración en el DOM');
        return;
    }
    
    // Cargar configuración actual
    loadSystemSettings();
    
    // Event listeners
    updatePortButton.addEventListener('click', updateSerialPort);
    hardwareModeRadio.addEventListener('change', updateOperationMode);
    simulationModeRadio.addEventListener('change', updateOperationMode);
    testConnectionButton.addEventListener('click', testConnection);
    
    // Función para cargar la configuración actual
    async function loadSystemSettings() {
        try {
            const response = await fetch('/api/status');
            
            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Actualizar interfaz con la configuración actual
            currentPortSpan.textContent = data.serialPort || 'No configurado';
            serialPortInput.placeholder = `Actual: ${data.serialPort || 'No configurado'}`;
            
            // Marcar el modo correcto
            if (data.simulationMode) {
                simulationModeRadio.checked = true;
            } else {
                hardwareModeRadio.checked = true;
            }
            
            // Registrar actividad
            if (window.logActivity && typeof window.logActivity === 'function') {
                window.logActivity(`Configuración cargada. Puerto: ${data.serialPort}, Modo: ${data.simulationMode ? 'Simulación' : 'Hardware'}`, 'info');
            }
        } catch (error) {
            console.error('Error al cargar configuración:', error);
            if (window.showToast && typeof window.showToast === 'function') {
                window.showToast('Error al cargar configuración del sistema', 'error');
            }
        }
    }
    
    // Función para actualizar el puerto serial
    async function updateSerialPort() {
        const newPort = serialPortInput.value.trim();
        
        if (!newPort) {
            if (window.showToast) window.showToast('Por favor ingrese un puerto válido', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/settings/serial-port', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ port: newPort })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (window.showToast) window.showToast(`Puerto actualizado a ${newPort}`, 'success');
                currentPortSpan.textContent = newPort;
                serialPortInput.value = '';
                serialPortInput.placeholder = `Actual: ${newPort}`;
                
                // Si estamos en modo hardware, forzar un cambio a modo hardware para reiniciar la conexión
                if (hardwareModeRadio.checked) {
                    await fetch('/api/settings/simulation-mode', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ enabled: false })
                    });
                }
                
                // Recargar la configuración
                await loadSystemSettings();
                
                // Forzar actualización de datos del sensor
                if (window.fetchSensorData) {
                    setTimeout(window.fetchSensorData, 1000);
                }
            } else {
                if (window.showToast) window.showToast(data.message || 'Error al actualizar puerto', 'error');
            }
        } catch (error) {
            console.error('Error al actualizar puerto:', error);
            if (window.showToast) window.showToast('Error al actualizar puerto serial', 'error');
        }
    }
    
    // Función para actualizar el modo de operación
    async function updateOperationMode() {
        const simulationEnabled = simulationModeRadio.checked;
        
        try {
            const response = await fetch('/api/settings/simulation-mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled: simulationEnabled })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (window.showToast) window.showToast(`Modo ${simulationEnabled ? 'simulación' : 'hardware'} activado`, 'success');
                
                // Recargar la configuración
                await loadSystemSettings();
                
                // Forzar actualización de datos del sensor
                if (window.fetchSensorData) {
                    setTimeout(window.fetchSensorData, 1000);
                }
            } else {
                if (window.showToast) window.showToast(data.message || 'Error al cambiar modo de operación', 'error');
            }
        } catch (error) {
            console.error('Error al cambiar modo de operación:', error);
            if (window.showToast) window.showToast('Error al cambiar modo de operación', 'error');
        }
    }
    
    // Función para probar la conexión
    async function testConnection() {
        try {
            // Obtener datos actuales
            const response = await fetch('/api/sensor-data');
            
            if (!response.ok) {
                throw new Error(`Error en la API: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Mostrar mensaje según el modo
            if (data.simulationMode) {
                if (window.showToast) window.showToast(`Modo simulación activo. Temperatura actual: ${data.temperature}°C, Humedad: ${data.humidity}%`, 'info');
            } else {
                if (window.showToast) window.showToast(`Conexión exitosa con el hardware. Temperatura: ${data.temperature}°C, Humedad: ${data.humidity}%`, 'success');
            }
        } catch (error) {
            console.error('Error al probar conexión:', error);
            if (window.showToast) window.showToast('Error al probar la conexión con el hardware', 'error');
        }
    }
});