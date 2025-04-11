// Analytics Dashboard Functionality

document.addEventListener('DOMContentLoaded', function() {
    // This function will be called when inventory is updated
    window.updateDashboardStats = function(inventory) {
        if (!inventory) return;
        
        // Total items
        const totalItems = inventory.length;
        document.getElementById('total-items').textContent = totalItems;
        
        // Items expiring soon (warning status)
        const expiringSoon = inventory.filter(item => item.status === 'warning').length;
        document.getElementById('expiring-soon').textContent = expiringSoon;
        
        // Expired items (danger status)
        const expired = inventory.filter(item => item.status === 'danger').length;
        document.getElementById('expired-items').textContent = expired;
        
        // Average temperature from the last day (placeholder, should fetch from sensor data)
        const avgTempElement = document.getElementById('avg-temperature');
        // Usar la temperatura actual como fallback
        avgTempElement.textContent = window.currentTemp ? `${window.currentTemp.toFixed(1)}°C` : '--°C';
        
        // Intentar obtener el promedio de temperatura más tarde (sin bloquear UI)
        setTimeout(() => fetchTemperatureAverage().then(avgTemp => {
            if (avgTemp) {
                document.getElementById('avg-temperature').textContent = `${avgTemp}°C`;
            }
        }).catch(err => console.error('Error al obtener temperatura promedio:', err)), 500);
        
        // Update chart
        const okCount = inventory.filter(item => item.status === 'ok').length;
        const warningCount = inventory.filter(item => item.status === 'warning').length;
        const dangerCount = inventory.filter(item => item.status === 'danger').length;
        createInventoryChart(okCount, warningCount, dangerCount);
    };
    
    // Fetch average temperature
    async function fetchTemperatureAverage() {
        try {
            // Obtener datos del sensor actual como fallback
            const fallbackTemp = window.currentTemp || 5.0;
            
            // Intentar obtener el promedio de temperatura de las últimas 24 horas
            const response = await fetch('/api/sensor-data');
            if (!response.ok) {
                return fallbackTemp;
            }
            
            const data = await response.json();
            return parseFloat(data.temperature).toFixed(1);
        } catch (error) {
            console.error('Error fetching temperature average:', error);
            return window.currentTemp ? window.currentTemp.toFixed(1) : '--';
        }
    }
    
    // Actualizar la paleta de colores del gráfico del panel de control
    function createInventoryChart(okCount, warningCount, dangerCount) {
        const ctx = document.getElementById('inventory-chart');
        if (!ctx) return;
        
        // Si ya existe un gráfico, destruirlo
        if (window.inventoryChart instanceof Chart) {
            window.inventoryChart.destroy();
        }
        
        window.inventoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Buen estado', 'Próximo a vencer', 'Vencido'],
                datasets: [{
                    data: [okCount, warningCount, dangerCount],
                    backgroundColor: [
                        'rgba(39, 174, 96, 0.8)',   // Verde elegante
                        'rgba(243, 156, 18, 0.8)',  // Ámbar refinado
                        'rgba(192, 57, 43, 0.8)'    // Rojo sobrio
                    ],
                    borderColor: [
                        'rgba(39, 174, 96, 1)',
                        'rgba(243, 156, 18, 1)',
                        'rgba(192, 57, 43, 1)'
                    ],
                    borderWidth: 1,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Distribución del Inventario',
                        color: '#2c3e50',
                        font: {
                            size: 16,
                            weight: '500'
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
});