// app.js - Versión modificada para trabajar con la API
let foodInventory = [];
let currentTemp = 22.0; // Temperatura por defecto
let currentHumidity = 65; // Humedad por defecto

// Variable para almacenar el historial de actividades
let activityHistory = [];
const MAX_ACTIVITIES = 50; // Número máximo de actividades a guardar

// Añadir esta variable al inicio del archivo (después de las otras variables globales)
let currentFilteredInventory = [];

// Al cargar el documento
document.addEventListener('DOMContentLoaded', function() {
    // Cargar actividades desde localStorage
    loadActivitiesFromLocalStorage();
    
    // Cargar tema preferido
    loadPreferredTheme();
    
    // Inicializar la aplicación
    initializeApp();
    
    // Configurar listeners de eventos
    setupEventListeners();
    
    // Cargar datos del servidor
    loadInventoryFromServer();
});

// Inicialización de la aplicación
function initializeApp() {
    // Establecer fecha de entrada al día actual
    document.getElementById('entry-date').valueAsDate = new Date();
    
    // Cargar los tipos de alimentos desde el servidor
    loadFoodTypes();
    
    // Si estamos en la página de index
    if (document.querySelector('.system-info-grid')) {
        // Agregar botón de historial de alertas de temperatura
        const systemInfoHeader = document.querySelector('.system-info-section .card h2');
        if (systemInfoHeader) {
            const historyButton = document.createElement('button');
            historyButton.className = 'btn-secondary';
            historyButton.style.float = 'right';
            historyButton.style.fontSize = '0.8rem';
            historyButton.innerHTML = '<i class="fas fa-history"></i> Historial de Alertas';
            historyButton.onclick = showTemperatureAlertHistory;
            systemInfoHeader.appendChild(historyButton);
        }
    }
    
    // Solicitar permiso para notificaciones si no se ha solicitado antes
    if ("Notification" in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        // Mostrar un mensaje explicativo antes de solicitar permisos
        showToast('¿Deseas recibir notificaciones sobre productos próximos a vencer?', 'info', false);
        
        // Esperar un momento antes de solicitar permiso
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showToast('¡Notificaciones activadas!', 'success', false);
                }
            });
        }, 3000);
    }
}

// Cargar tipos de alimentos desde el servidor
async function loadFoodTypes() {
    try {
        const response = await fetch('/api/food-types');
        
        if (!response.ok) {
            throw new Error(`Error en la API: ${response.status}`);
        }
        
        const foodTypes = await response.json();
        const foodTypeSelect = document.getElementById('food-type');
        
        // Limpiar opciones actuales excepto la primera ("Seleccione...")
        while (foodTypeSelect.options.length > 1) {
            foodTypeSelect.remove(1);
        }
        
        // Agregar opciones desde la base de datos
        foodTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.type_code;
            option.textContent = type.name;
            foodTypeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar tipos de alimentos:', error);
        showToast('Error al cargar tipos de alimentos', 'error');
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Formulario de nuevo producto
    document.getElementById('new-product-form').addEventListener('submit', handleNewProductSubmit);
    
    // Control de la campana de notificaciones
    document.querySelector('.bell-icon').addEventListener('click', toggleNotificationPanel);
    
    // Control del panel de actividades
    document.querySelector('.activity-icon').addEventListener('click', toggleActivityPanel);
    
    // Control del modo oscuro
    document.querySelector('.dark-mode-toggle').addEventListener('click', toggleDarkMode);
    
    // Cerrar paneles al hacer clic fuera
    document.addEventListener('click', handleOutsideClick);
    
    // Búsqueda de productos
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('search-button').addEventListener('click', handleSearch);
    
    // Eventos para predicción de caducidad
    const foodTypeSelect = document.getElementById('food-type');
    const manufacturingDateInput = document.getElementById('manufacturing-date');
    
    if (foodTypeSelect && manufacturingDateInput) {
        foodTypeSelect.addEventListener('change', predictExpiration);
        manufacturingDateInput.addEventListener('change', predictExpiration);
    }
}

// Cargar inventario desde el servidor
async function loadInventoryFromServer() {
    try {
        const response = await fetch('/api/inventory');
        
        if (!response.ok) {
            throw new Error(`Error en la API: ${response.status}`);
        }
        
        foodInventory = await response.json();
        
        // Actualizar la interfaz
        updateUI();
    } catch (error) {
        console.error('Error al cargar inventario:', error);
        showToast('Error al cargar datos del inventario', 'error');
    }
}

// Manejador del formulario de nuevo producto
async function handleNewProductSubmit(event) {
    event.preventDefault();
    
    // Recopilar datos del formulario
    const foodType = document.getElementById('food-type').value;
    const productName = document.getElementById('product-name').value;
    const quantity = document.getElementById('quantity').value;
    const quantityUnit = document.getElementById('quantity-unit').value;
    const batchNumber = document.getElementById('batch-number').value;
    const manufacturingDate = document.getElementById('manufacturing-date').value;
    const entryDate = document.getElementById('entry-date').value;
    const storageLocation = document.getElementById('storage-location').value.toUpperCase();
    
    // Validar entrada para ubicación (Formato A001-Z999)
    const locationRegex = /^[A-Z][0-9]{3}$/;
    if (!locationRegex.test(storageLocation)) {
        showToast('La ubicación debe tener el formato de una letra seguida de 3 números (ej: A001)', 'error');
        return;
    }
    
    // Crear objeto con los datos del producto
    const productData = {
        type: foodType,
        name: productName,
        quantity: quantity,
        quantityUnit: quantityUnit,
        batchNumber: batchNumber,
        manufacturingDate: manufacturingDate,
        entryDate: entryDate,
        storageLocation: storageLocation
    };
    
    try {
        // Enviar datos al servidor
        const response = await fetch('/api/inventory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al registrar producto');
        }
        
        const newProduct = await response.json();
        
        // Agregar al inventario local
        foodInventory.push(newProduct);
        
        // Actualizar UI
        updateUI();
        
        // Mostrar mensaje de éxito
        showToast(`Producto "${productName}" registrado correctamente con código ${newProduct.code}`, 'success');
        
        // Resetear formulario
        event.target.reset();
        document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
    } catch (error) {
        console.error('Error al registrar producto:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Función para actualizar la interfaz de usuario
function updateUI() {
    updateInventoryTable();
    updateNotifications();
    updateSensorData();
    
    // Update dashboard if the function exists
    if (window.updateDashboardStats) {
        window.updateDashboardStats(foodInventory);
    }
}

// Función para actualizar la tabla de inventario
function updateInventoryTable() {
    const tableBody = document.querySelector('#food-inventory tbody');
    const emptyMessage = document.getElementById('empty-inventory-message');
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    if (foodInventory.length === 0) {
        // Mostrar mensaje de inventario vacío
        emptyMessage.style.display = 'block';
        return;
    }
    
    // Ocultar mensaje de inventario vacío
    emptyMessage.style.display = 'none';
    
    // Ordenar por proximidad a vencimiento
    const sortedInventory = [...foodInventory].sort((a, b) => {
        const dateA = new Date(a.expiration_date || a.expirationDate);
        const dateB = new Date(b.expiration_date || b.expirationDate);
        return dateA - dateB;
    });
    
    // Generar filas de la tabla
    sortedInventory.forEach(item => {
        const row = document.createElement('tr');
        
        // Update this part to make rows clickable
        row.classList.add('clickable-row');
        row.dataset.itemId = item.id;
        row.addEventListener('click', function() {
            showItemDetails(this.dataset.itemId);
        });
        
        const statusText = (item.status === 'ok') ? 'Buen estado' : 
                          (item.status === 'warning') ? 'Próximo a vencer' : 'Vencido/Crítico';
        
        // Manejar nombres de propiedades en diferentes formatos (camelCase o snake_case)
        const code = item.code;
        const name = item.name;
        const batchNumber = item.batch_number || item.batchNumber;
        const quantity = item.quantity;
        const storageLocation = item.storage_location || item.storageLocation;
        const manufacturingDate = item.manufacturing_date || item.manufacturingDate;
        const entryDate = item.entry_date || item.entryDate;
        const expirationDate = item.expiration_date || item.expirationDate;
        
        row.innerHTML = `
            <td><strong>${code}</strong></td>
            <td>${name}</td>
            <td>${batchNumber}</td>
            <td>${quantity}</td>
            <td>${storageLocation}</td>
            <td>${formatDate(manufacturingDate)}</td>
            <td>${formatDate(entryDate)}</td>
            <td>${formatDate(expirationDate)}</td>
            <td>
                <div class="status-text">
                    <span class="status-dot status-${item.status}"></span>
                    ${statusText}
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Función para formatear fechas
function formatDate(dateString) {
    if (!dateString) return '';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-ES', options);
}

// Función para actualizar notificaciones
function updateNotifications() {
    const notificationCount = document.querySelector('.notification-count');
    const notificationList = document.querySelector('#notification-list');
    
    // Filtrar alimentos vencidos o próximos a vencer
    const alertsWarning = foodInventory.filter(item => item.status === 'warning');
    const alertsDanger = foodInventory.filter(item => item.status === 'danger');
    const alerts = [...alertsWarning, ...alertsDanger];
    
    // Actualizar contador de notificaciones
    notificationCount.textContent = alerts.length;
    
    // Comprobar si hay notificaciones nuevas comparando con el estado anterior
    const previousAlertCount = parseInt(localStorage.getItem('freshtrack_previous_alert_count') || '0');
    
    // Si hay más alertas que antes, enviar notificación
    if (alerts.length > previousAlertCount) {
        // Enviar notificación si hay nuevas alertas
        if (alerts.length > 0) {
            const newAlerts = alerts.length - previousAlertCount;
            const message = newAlerts === 1 
                ? 'Hay 1 nuevo producto próximo a vencer'
                : `Hay ${newAlerts} nuevos productos próximos a vencer`;
            
            sendBrowserNotification('FreshTrack - Alertas de Vencimiento', message);
        }
    }
    
    // Actualizar conteo para la próxima comparación
    localStorage.setItem('freshtrack_previous_alert_count', alerts.length.toString());
    
    // Limpiar lista de notificaciones
    notificationList.innerHTML = '';
    
    // Agregar notificaciones a la lista
    if (alerts.length === 0) {
        notificationList.innerHTML = '<div class="notification-item">No hay alertas de vencimiento.</div>';
    } else {
        // Primero alertas de peligro (vencidos)
        alertsDanger.forEach(item => {
            addNotificationItem(item, notificationList, true);
        });
        
        // Luego alertas de advertencia (próximos a vencer)
        alertsWarning.forEach(item => {
            addNotificationItem(item, notificationList, false);
        });
    }
    
    // Si hay alertas vencidas, actualizar el ícono con clase parpadeante
    const bellIcon = document.querySelector('.bell-icon i');
    if (alertsDanger.length > 0 && bellIcon) {
        bellIcon.classList.add('pulse-animation');
    } else if (bellIcon) {
        bellIcon.classList.remove('pulse-animation');
    }
}

// Función para añadir un item de notificación
function addNotificationItem(item, notificationList, isDanger) {
    const alertItem = document.createElement('div');
    alertItem.classList.add('notification-item');
    alertItem.classList.add(isDanger ? 'urgent' : 'warning');
    
    // Manejar propiedades en diferentes formatos
    const expirationDate = item.expiration_date || item.expirationDate;
    const code = item.code;
    const name = item.name;
    const batchNumber = item.batch_number || item.batchNumber;
    const storageLocation = item.storage_location || item.storageLocation;
    
    const daysToExpiration = calculateDaysToExpiration(expirationDate);
    const statusMessage = daysToExpiration < 0 
        ? `Vencido hace ${Math.abs(daysToExpiration)} días` 
        : `Vence en ${daysToExpiration} días`;
    
    alertItem.innerHTML = `
        <div class="notification-item-title">${name} (${code})</div>
        <p>Lote: ${batchNumber}</p>
        <p>Ubicación: ${storageLocation}</p>
        <div class="notification-item-meta">
            <span>${statusMessage}</span>
            <span>${formatDate(expirationDate)}</span>
        </div>
        <button class="view-item-btn" data-id="${item.id}">
            <i class="fas fa-eye"></i> Ver detalles
        </button>
    `;
    
    notificationList.appendChild(alertItem);
    
    // Añadir event listener al botón de ver
    const viewBtn = alertItem.querySelector('.view-item-btn');
    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar propagación del evento
        showItemDetails(item.id);
        
        // Cerrar panel de notificaciones al hacer clic
        const notificationPanel = document.querySelector('.notification-panel');
        if (notificationPanel) {
            notificationPanel.classList.remove('active');
        }
    });
}

// Función para calcular días hasta vencimiento
function calculateDaysToExpiration(expirationDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiration = new Date(expirationDate);
    expiration.setHours(0, 0, 0, 0);
    
    const diffTime = expiration - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Función para actualizar datos de sensores
function updateSensorData() {
    document.getElementById('temperature').textContent = `${currentTemp} °C`;
    document.getElementById('humidity').textContent = `${currentHumidity} %`;
}

// Actualizar estado de alimentos basado en la temperatura actual
async function updateFoodStatus() {
    try {
        // Llamar a la API para actualizar estado
        const response = await fetch('/api/inventory/update-status', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Error al actualizar estado de productos');
        }
        
        const result = await response.json();
        
        // Si se actualizaron productos, recargar inventario
        if (result.updatedCount > 0) {
            await loadInventoryFromServer();
            
            // Solo registrar como actividad sin mostrar toast
            logActivity('Fechas de vencimiento actualizadas según la temperatura actual', 'info');
        }
    } catch (error) {
        console.error('Error al actualizar estado de productos:', error);
        showToast('Error al actualizar fechas de vencimiento', 'error');
    }
}

// Función para manejar la búsqueda
async function handleSearch(event) {
    const searchTerm = document.getElementById('search-input').value;
    
    if (!searchTerm.trim()) {
        // Si el término de búsqueda está vacío, mostrar todo el inventario
        await loadInventoryFromServer();
        return;
    }
    
    try {
        // Buscar usando la API
        const response = await fetch(`/api/inventory/search?q=${encodeURIComponent(searchTerm)}`);
        
        if (!response.ok) {
            throw new Error('Error al realizar la búsqueda');
        }
        
        // Actualizar el inventario local con los resultados filtrados
        foodInventory = await response.json();
        
        // Actualizar la interfaz
        updateInventoryTable();
        
        // Mostrar mensaje si no hay resultados
        if (foodInventory.length === 0) {
            const emptyMessage = document.getElementById('empty-inventory-message');
            emptyMessage.style.display = 'block';
            emptyMessage.textContent = `No se encontraron productos que coincidan con "${searchTerm}"`;
        }
    } catch (error) {
        console.error('Error al realizar búsqueda:', error);
        showToast('Error al buscar productos', 'error');
    }
}

// Función para mostrar notificaciones toast
function showToast(message, type = 'info', logAsActivity = true) {
    // Crear el toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                           type === 'error' ? 'fa-exclamation-circle' : 
                           type === 'warning' ? 'fa-exclamation-triangle' :
                           'fa-info-circle'}"></i>
            <div class="toast-message">${message}</div>
        </div>
        <i class="fas fa-times toast-close"></i>
    `;
    
    const toastContainer = document.getElementById('toast-container');
    toastContainer.appendChild(toast);
    
    // Mostrar el toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Configurar el cierre automático
    const timeout = setTimeout(() => {
        removeToast(toast);
    }, 5000);
    
    // Permitir cerrar manualmente - CORREGIDO
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        clearTimeout(timeout); // Importante: cancelar el timeout
        removeToast(toast);
    });
    
    // Registrar como actividad del sistema si se solicita
    if (logAsActivity) {
        logActivity(message, type);
    }
}

// Función para quitar un toast específico
function removeToast(toast) {
    // Primero añadimos la clase para la animación de salida
    toast.classList.remove('show');
    toast.classList.add('hidden');
    
    // Después de que termine la animación, eliminamos el elemento del DOM
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300); // Este tiempo debe coincidir con la duración de la animación
}

// Función para registrar una actividad
function logActivity(message, type = 'info') {
    // Crear objeto de actividad
    const activity = {
        message: message,
        type: type,
        timestamp: new Date()
    };
    
    // Agregar al inicio del arreglo
    activityHistory.unshift(activity);
    
    // Limitar el número de actividades almacenadas
    if (activityHistory.length > MAX_ACTIVITIES) {
        activityHistory.pop();
    }
    
    // Guardar en localStorage para persistencia
    saveActivitiesToLocalStorage();
    
    // Actualizar la interfaz si el panel está visible
    updateActivityPanel();
}

// Función para guardar actividades en localStorage
function saveActivitiesToLocalStorage() {
    localStorage.setItem('freshtrack_activities', JSON.stringify(activityHistory));
}

// Función para cargar actividades desde localStorage
function loadActivitiesFromLocalStorage() {
    const saved = localStorage.getItem('freshtrack_activities');
    if (saved) {
        try {
            // Convertir fechas de string a objetos Date
            const parsed = JSON.parse(saved);
            activityHistory = parsed.map(activity => ({
                ...activity,
                timestamp: new Date(activity.timestamp)
            }));
        } catch (e) {
            console.error('Error al cargar actividades desde localStorage:', e);
            activityHistory = [];
        }
    }
}

// Función para actualizar el panel de actividades
function updateActivityPanel() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    if (activityHistory.length === 0) {
        activityList.innerHTML = '<div class="activity-item">No hay actividades registradas.</div>';
        return;
    }
    
    // Crear elementos para cada actividad
    activityHistory.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = `activity-item ${activity.type}`;
        
        // Formatear la hora
        const now = new Date();
        const activityTime = activity.timestamp;
        let timeDisplay;
        
        // Si es hoy, mostrar solo la hora
        if (now.toDateString() === activityTime.toDateString()) {
            timeDisplay = `Hoy ${activityTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            timeDisplay = `${activityTime.toLocaleString([], {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })}`;
        }
        
        activityItem.innerHTML = `
            <i class="fas ${activity.type === 'success' ? 'fa-check-circle' : 
                            activity.type === 'error' ? 'fa-exclamation-circle' : 
                            activity.type === 'warning' ? 'fa-exclamation-triangle' :
                            'fa-info-circle'}"></i>
            <div class="activity-message">
                ${activity.message}
                <div class="activity-time">${timeDisplay}</div>
            </div>
        `;
        
        activityList.appendChild(activityItem);
    });
    
    // Agregar botón para limpiar historial
    const clearSection = document.createElement('div');
    clearSection.className = 'clear-activities';
    clearSection.innerHTML = `<button id="clear-activities-btn">Limpiar historial</button>`;
    activityList.after(clearSection);
    
    // Añadir event listener al botón
    document.getElementById('clear-activities-btn').addEventListener('click', clearActivityHistory);
}

// Función para limpiar el historial de actividades
function clearActivityHistory() {
    activityHistory = [];
    saveActivitiesToLocalStorage();
    updateActivityPanel();
    showToast('Historial de actividades limpiado', 'info', false);
}

// Función para mostrar/ocultar el panel de actividades
function toggleActivityPanel() {
    const panel = document.querySelector('.activity-panel');
    panel.classList.toggle('active');
    
    // Si se está mostrando, actualizar contenido
    if (panel.classList.contains('active')) {
        updateActivityPanel();
    }
}

// Función para mostrar/ocultar panel de notificaciones
function toggleNotificationPanel() {
    const panel = document.querySelector('.notification-panel');
    panel.classList.toggle('active');
}

// Función para manejar clics fuera del panel de notificaciones
function handleOutsideClick(event) {
    const notificationPanel = document.querySelector('.notification-panel');
    const bellIcon = document.querySelector('.bell-icon');
    const activityPanel = document.querySelector('.activity-panel');
    const activityIcon = document.querySelector('.activity-icon');
    
    // Si el panel de notificaciones está activo y se hizo clic fuera de él y no en la campana
    if (notificationPanel && notificationPanel.classList.contains('active') && 
        !notificationPanel.contains(event.target) && 
        !bellIcon.contains(event.target)) {
        notificationPanel.classList.remove('active');
    }
    
    // Si el panel de actividades está activo y se hizo clic fuera de él y no en su icono
    if (activityPanel && activityPanel.classList.contains('active') && 
        !activityPanel.contains(event.target) && 
        !activityIcon.contains(event.target)) {
        activityPanel.classList.remove('active');
    }
}

// Exponer función de actualización de estado para arduino-connection.js
window.updateFoodStatus = updateFoodStatus;
window.showToast = showToast;
window.toggleNotificationPanel = toggleNotificationPanel;
window.toggleActivityPanel = toggleActivityPanel;
window.logActivity = logActivity;

// Function to show item details in a modal
function showItemDetails(itemId) {
    const item = foodInventory.find(item => item.id == itemId);
    if (!item) return;
    
    const modal = document.getElementById('item-details-modal');
    // Verificar que el modal existe
    if (!modal) {
        console.error('Error: No se encontró el elemento modal');
        return;
    }
    
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');
    
    // Set title
    modalTitle.textContent = `${item.name} (${item.code})`;
    
    // Get formatted dates
    const manufacturingDate = formatDate(item.manufacturing_date || item.manufacturingDate);
    const entryDate = formatDate(item.entry_date || item.entryDate);
    const expirationDate = formatDate(item.expiration_date || item.expirationDate);
    
    // Calculate days until expiration
    const daysToExpiration = calculateDaysToExpiration(item.expiration_date || item.expirationDate);
    
    // Get status text
    const statusText = (item.status === 'ok') ? 'Buen estado' : 
                       (item.status === 'warning') ? 'Próximo a vencer' : 'Vencido/Crítico';
    
    // Get status class for styling
    const statusClass = item.status;
    
    // Format time remaining text
    let timeRemainingText = '';
    if (daysToExpiration < 0) {
        timeRemainingText = `Vencido hace ${Math.abs(daysToExpiration)} días`;
    } else if (daysToExpiration === 0) {
        timeRemainingText = 'Vence hoy';
    } else {
        timeRemainingText = `${daysToExpiration} días restantes`;
    }
    
    // Obtener datos de temperatura almacenados
    const storedTemps = JSON.parse(localStorage.getItem('temperature_data') || '[]');
    const avgTemp = storedTemps.length > 0 
        ? (storedTemps.reduce((sum, entry) => sum + entry.temperature, 0) / storedTemps.length).toFixed(1) 
        : 'N/A';
    
    const lastTemp = storedTemps.length > 0 
        ? storedTemps[storedTemps.length - 1].temperature 
        : 'N/A';

    // Calcular porcentaje de vida útil consumido
    const manufactureDate = new Date(item.manufacturing_date || item.manufacturingDate);
    const expirationDateObj = new Date(item.expiration_date || item.expirationDate);
    const today = new Date();
    
    const totalLifespan = expirationDateObj - manufactureDate;
    const consumedLifespan = today - manufactureDate;
    
    let lifePercentage = Math.round((consumedLifespan / totalLifespan) * 100);
    lifePercentage = Math.max(0, Math.min(100, lifePercentage)); // Asegurar rango 0-100
    
    let lifeColor = '#2ecc71';  // verde
    if (lifePercentage > 90) lifeColor = '#e74c3c';  // rojo
    else if (lifePercentage > 75) lifeColor = '#f39c12';  // amarillo
    
    // Build detail HTML with improved styling
    modalBody.innerHTML = `
        <div class="product-details">
            <div class="product-status-banner ${statusClass}">
                <div class="status-icon">
                    <i class="${item.status === 'ok' ? 'fas fa-check-circle' : item.status === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-times-circle'}"></i>
                </div>
                <div class="status-text">
                    ${statusText}
                </div>
                <div class="expiration-countdown">
                    <span>${timeRemainingText}</span>
                </div>
            </div>
            
            <div class="details-grid">
                <div class="detail-column">
                    <div class="detail-item">
                        <span class="detail-label">Código</span>
                        <div class="detail-value">${item.code}</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Tipo de Alimento</span>
                        <div class="detail-value">${item.type_name || item.type || 'No especificado'}</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Lote</span>
                        <div class="detail-value">${item.batch_number || item.batchNumber}</div>
                    </div>
                </div>
                
                <div class="detail-column">
                    <div class="detail-item">
                        <span class="detail-label">Cantidad</span>
                        <div class="detail-value">${item.quantity} ${item.quantity_unit || item.quantityUnit}</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Ubicación</span>
                        <div class="detail-value location-tag">${item.storage_location || item.storageLocation}</div>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Condiciones de Almacenamiento</span>
                        <div class="detail-value temperature-info">
                            <i class="fas fa-thermometer-half" title="Temperatura promedio"></i> ${avgTemp}°C (Prom.)
                            <span class="separator">|</span>
                            <i class="fas fa-temperature-high" title="Última temperatura"></i> ${lastTemp}°C (Actual)
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Ciclo de vida del producto -->
            <div class="lifecycle-section">
                <h4><i class="fas fa-hourglass-half"></i> Ciclo de Vida del Producto</h4>
                
                <div class="lifecycle-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${lifePercentage}%; background-color: ${lifeColor};"></div>
                    </div>
                    <div class="progress-labels">
                        <span>${lifePercentage}% consumido</span>
                        <span>${100-lifePercentage}% restante</span>
                    </div>
                </div>
            </div>
            
            <div class="dates-section">
                <h4><i class="far fa-calendar-alt"></i> Fechas Importantes</h4>
                
                <div class="date-timeline">
                    <div class="timeline-item">
                        <div class="timeline-point past"></div>
                        <div class="timeline-content">
                            <div class="timeline-date">${manufacturingDate}</div>
                            <div class="timeline-label">Fabricación</div>
                        </div>
                    </div>
                    
                    <div class="timeline-item">
                        <div class="timeline-point past"></div>
                        <div class="timeline-content">
                            <div class="timeline-date">${entryDate}</div>
                            <div class="timeline-label">Entrada</div>
                        </div>
                    </div>
                    
                    <div class="timeline-item">
                        <div class="timeline-point ${daysToExpiration < 0 ? 'expired' : daysToExpiration <= 3 ? 'warning' : 'future'}"></div>
                        <div class="timeline-content">
                            <div class="timeline-date ${daysToExpiration < 0 ? 'text-danger' : daysToExpiration <= 3 ? 'text-warning' : ''}">${expirationDate}</div>
                            <div class="timeline-label">Vencimiento</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Acciones del producto -->
            <div class="product-actions">
                <button class="btn-primary btn-print-label">
                    <i class="fas fa-print"></i> Imprimir Etiqueta
                </button>
                <button class="btn-secondary btn-export-qr">
                    <i class="fas fa-qrcode"></i> Generar QR
                </button>
            </div>
        </div>
    `;
    
    // Show the modal
    modal.classList.add('show');
    
    // Add event listener to close button
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', function() {
        modal.classList.remove('show');
    });
    
    // Add event listener to close when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Añadir funcionalidad a los botones
    const printBtn = modal.querySelector('.btn-print-label');
    if (printBtn) {
        printBtn.addEventListener('click', function() {
            showToast('Generando etiqueta para impresión...', 'info');
            // Implementación simulada
            setTimeout(() => {
                showToast('Etiqueta enviada a la impresora', 'success');
            }, 1500);
        });
    }
    
    const qrBtn = modal.querySelector('.btn-export-qr');
    if (qrBtn) {
        qrBtn.addEventListener('click', function() {
            showToast('Generando código QR del producto...', 'info');
            // Implementación simulada
            setTimeout(() => {
                showToast('Código QR generado y descargado', 'success');
            }, 1500);
        });
    }
}

// Agregar esta función al final del archivo

// Función para exportar inventario a Excel
function exportInventoryToExcel() {
    try {
        // Verificar si la librería está disponible
        if (typeof XLSX === 'undefined') {
            showToast('Error: Librería de exportación no disponible', 'error');
            return;
        }

        // Verificar si hay datos para exportar
        if (!foodInventory || foodInventory.length === 0) {
            showToast('No hay datos de inventario para exportar', 'warning');
            return;
        }

        // Formatear los datos para Excel
        const formattedData = foodInventory.map(item => {
            // Manejar propiedades en diferentes formatos (camelCase o snake_case)
            const code = item.code;
            const name = item.name;
            const batchNumber = item.batch_number || item.batchNumber;
            const quantity = item.quantity;
            const quantityUnit = item.quantity_unit || item.quantityUnit;
            const storageLocation = item.storage_location || item.storageLocation;
            const manufacturingDate = formatDate(item.manufacturing_date || item.manufacturingDate);
            const entryDate = formatDate(item.entry_date || item.entryDate);
            const expirationDate = formatDate(item.expiration_date || item.expirationDate);
            
            // Determinar estado legible
            const statusText = (item.status === 'ok') ? 'Buen estado' : 
                              (item.status === 'warning') ? 'Próximo a vencer' : 'Vencido/Crítico';
            
            // Calcular días hasta expiración
            const daysToExpire = calculateDaysToExpiration(item.expiration_date || item.expirationDate);
            
            return {
                'Código': code,
                'Producto': name,
                'Lote': batchNumber,
                'Cantidad': `${quantity} ${quantityUnit}`,
                'Ubicación': storageLocation,
                'Fecha Fabricación': manufacturingDate,
                'Fecha Entrada': entryDate,
                'Fecha Vencimiento': expirationDate,
                'Estado': statusText,
                'Días para vencer': daysToExpire,
                'Tipo': item.type_name || item.typeName
            };
        });

        // Crear una hoja de trabajo
        const worksheet = XLSX.utils.json_to_sheet(formattedData);

        // Crear un libro de trabajo
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario FreshTrack');

        // Exportar a archivo Excel
        XLSX.writeFile(workbook, 'Inventario_FreshTrack.xlsx');
        
        // Registrar actividad
        logActivity('Se ha exportado el inventario a Excel', 'success');
        showToast('Archivo Excel generado correctamente', 'success', false);
    } catch (error) {
        console.error('Error al exportar inventario:', error);
        showToast('Error al generar archivo Excel', 'error');
    }
}

// Exponer función para usarla desde el botón en HTML
window.exportInventoryToExcel = exportInventoryToExcel;

// Agregar esta función para manejar el reporte de inventario

// Función para mostrar el reporte de inventario
function showInventoryReport() {
    // Verificar que tengamos datos de inventario
    if (!foodInventory || foodInventory.length === 0) {
        showToast('No hay datos de inventario para generar un reporte', 'warning');
        return;
    }
    
    // Referencia al modal
    const modal = document.getElementById('inventory-report-modal');
    if (!modal) {
        console.error('Modal de reporte no encontrado');
        return;
    }
    
    // Cargar tipos de alimentos para el filtro
    loadFoodTypesForReport();
    
    // Resetear los filtros
    document.getElementById('report-type').value = 'all';
    document.getElementById('report-status').value = 'all';
    document.getElementById('report-location').value = '';
    
    // Mostrar estadísticas iniciales
    updateReportStatistics(foodInventory);
    
    // Cargar tabla con todos los productos
    updateReportTable(foodInventory);
    
    // Inicializar datos filtrados con todos los datos
    window.currentFilteredInventory = [...foodInventory];
    
    // Mostrar el modal
    modal.classList.add('show');
    
    // Configurar event listeners
    setupReportEventListeners();
}

// Cargar tipos de alimentos en el selector de reporte
function loadFoodTypesForReport() {
    const typeSelect = document.getElementById('report-type');
    if (!typeSelect) return;
    
    // Limpiar opciones excepto "Todos"
    while (typeSelect.options.length > 1) {
        typeSelect.remove(1);
    }
    
    // Obtener tipos únicos del inventario actual
    const uniqueTypes = [...new Set(foodInventory.map(item => item.type_name || item.typeName))];
    
    // Agregar cada tipo como una opción
    uniqueTypes.forEach(type => {
        if (type) {
            const option = document.createElement('option');
            option.value = type.toLowerCase();
            option.textContent = type;
            typeSelect.appendChild(option);
        }
    });
}

// Actualizar estadísticas del reporte
function updateReportStatistics(items) {
    // Actualizar contadores
    document.getElementById('report-total').textContent = items.length;
    document.getElementById('report-ok').textContent = items.filter(item => item.status === 'ok').length;
    document.getElementById('report-warning').textContent = items.filter(item => item.status === 'warning').length;
    document.getElementById('report-danger').textContent = items.filter(item => item.status === 'danger').length;
}

// Mejorar la visualización de la tabla de reportes

// Actualizar tabla del reporte
function updateReportTable(items) {
    const tableBody = document.querySelector('#report-table tbody');
    if (!tableBody) return;
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    // Ordenar por proximidad a vencimiento
    const sortedItems = [...items].sort((a, b) => {
        const dateA = new Date(a.expiration_date || a.expirationDate);
        const dateB = new Date(b.expiration_date || b.expirationDate);
        return dateA - dateB;
    });
    
    // Generar filas
    sortedItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Extraer datos normalizando propiedades
        const code = item.code;
        const name = item.name;
        const type = item.type_name || item.typeName || '';
        const batchNumber = item.batch_number || item.batchNumber;
        const quantity = `${item.quantity} ${item.quantity_unit || item.quantityUnit}`;
        const storageLocation = item.storage_location || item.storageLocation;
        const expirationDate = formatDate(item.expiration_date || item.expirationDate);
        const daysToExpire = calculateDaysToExpiration(item.expiration_date || item.expirationDate);
        
        // Determinar texto del estado
        const statusText = (item.status === 'ok') ? 'Buen estado' : 
                         (item.status === 'warning') ? 'Próximo a vencer' : 'Vencido/Crítico';
        
        // Crear fila con los nuevos estilos
        row.innerHTML = `
            <td>${code}</td>
            <td>${name}</td>
            <td>${type}</td>
            <td>${batchNumber}</td>
            <td>${quantity}</td>
            <td>${storageLocation}</td>
            <td>${expirationDate}</td>
            <td class="${daysToExpire < 0 ? 'text-danger' : daysToExpire <= 3 ? 'text-warning' : ''}">${daysToExpire}</td>
            <td>
                <span class="status-dot status-${item.status}"></span>
                <span class="${item.status === 'danger' ? 'text-danger' : item.status === 'warning' ? 'text-warning' : ''}">${statusText}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Configurar event listeners para el reporte
// Asegurar que esta función inicialice correctamente
function setupReportEventListeners() {
    // Cerrar modal
    document.querySelectorAll('#inventory-report-modal .close-button, #report-close').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('inventory-report-modal').classList.remove('show');
            // Limpiar la referencia de inventario filtrado al cerrar
            window.currentFilteredInventory = null;
        });
    });
    
    // Filtros
    document.getElementById('report-type').addEventListener('change', applyReportFilters);
    document.getElementById('report-status').addEventListener('change', applyReportFilters);
    document.getElementById('report-location').addEventListener('input', applyReportFilters);
    
    // Exportar a Excel - inicializar con todos los datos
    window.currentFilteredInventory = [...foodInventory];
    
    // Agregar evento
    document.getElementById('report-export-excel').addEventListener('click', exportReportToExcel);
}

// Modificar la función que aplica los filtros para incluir mejor manejo de errores
function applyReportFilters() {
    try {
        const typeFilter = document.getElementById('report-type').value;
        const statusFilter = document.getElementById('report-status').value;
        const locationFilter = document.getElementById('report-location').value.trim().toLowerCase();
        
        console.log('Aplicando filtros:', { tipo: typeFilter, estado: statusFilter, ubicacion: locationFilter });
        
        // Filtrar inventario
        let filteredInventory = [...foodInventory];
        
        // Filtrar por tipo
        if (typeFilter !== 'all') {
            filteredInventory = filteredInventory.filter(item => {
                const itemType = (item.type_name || item.typeName || '').toLowerCase();
                return itemType === typeFilter;
            });
        }
        
        // Filtrar por estado
        if (statusFilter !== 'all') {
            filteredInventory = filteredInventory.filter(item => item.status === statusFilter);
        }
        
        // Filtrar por ubicación
        if (locationFilter) {
            filteredInventory = filteredInventory.filter(item => {
                const location = (item.storage_location || item.storageLocation || '').toLowerCase();
                return location.includes(locationFilter);
            });
        }
        
        console.log(`Filtrado completado: ${filteredInventory.length} de ${foodInventory.length} elementos coinciden`);
        
        // Actualizar vista
        updateReportStatistics(filteredInventory);
        updateReportTable(filteredInventory);
        
        // Guardar los datos filtrados para usarlos en la exportación
        window.currentFilteredInventory = filteredInventory;
        
    } catch (error) {
        console.error('Error al aplicar filtros:', error);
        showToast('Error al aplicar filtros: ' + error.message, 'error');
    }
}

// Reemplazo completo para la función exportReportToExcel
function exportReportToExcel() {
    try {
        // Verificar si la librería está disponible
        if (typeof XLSX === 'undefined') {
            showToast('Error: Librería de exportación no disponible', 'error');
            return;
        }
        
        // Usar los datos filtrados actuales o todos los datos si no hay filtros aplicados
        const reportData = window.currentFilteredInventory || foodInventory;
        
        // Verificar que haya datos para exportar
        if (!reportData || reportData.length === 0) {
            showToast('No hay datos para exportar con los filtros actuales', 'warning');
            return;
        }
        
        // Formatear datos para Excel
        const formattedData = reportData.map(item => {
            // Extraer todas las propiedades necesarias
            const code = item.code;
            const name = item.name;
            const type = item.type_name || item.typeName || '';
            const batchNumber = item.batch_number || item.batchNumber;
            const quantity = item.quantity;
            const unit = item.quantity_unit || item.quantityUnit;
            const storageLocation = item.storage_location || item.storageLocation;
            const manufacturingDate = formatDate(item.manufacturing_date || item.manufacturingDate);
            const entryDate = formatDate(item.entry_date || item.entryDate);
            const expirationDate = formatDate(item.expiration_date || item.expirationDate);
            const daysToExpire = calculateDaysToExpiration(item.expiration_date || item.expirationDate);
            
            const statusText = (item.status === 'ok') ? 'Buen estado' : 
                             (item.status === 'warning') ? 'Próximo a vencer' : 'Vencido/Crítico';
            
            return {
                'Código': code,
                'Producto': name,
                'Tipo': type,
                'Lote': batchNumber,
                'Cantidad': quantity,
                'Unidad': unit,
                'Ubicación': storageLocation,
                'Fecha Fabricación': manufacturingDate,
                'Fecha Entrada': entryDate,
                'Fecha Vencimiento': expirationDate,
                'Días para vencer': daysToExpire,
                'Estado': statusText
            };
        });
        
        // Crear hoja de trabajo
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        
        // Crear libro de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Obtener información de filtros para el nombre
        const filterInfo = [];
        const typeFilter = document.getElementById('report-type').value;
        const statusFilter = document.getElementById('report-status').value;
        const locationFilter = document.getElementById('report-location').value.trim().toLowerCase();
        
        if (typeFilter !== 'all') {
            const typeSelectElement = document.getElementById('report-type');
            const selectedText = typeSelectElement.options[typeSelectElement.selectedIndex].text;
            // Sanitizar el texto para eliminar caracteres inválidos
            const safeText = sanitizeSheetName(`Tipo=${selectedText}`);
            filterInfo.push(safeText);
        }
        if (statusFilter !== 'all') {
            const statusSelectElement = document.getElementById('report-status');
            const selectedText = statusSelectElement.options[statusSelectElement.selectedIndex].text;
            // Sanitizar el texto para eliminar caracteres inválidos
            const safeText = sanitizeSheetName(`Estado=${selectedText}`);
            filterInfo.push(safeText);
        }
        if (locationFilter) {
            // Sanitizar el texto para eliminar caracteres inválidos
            const safeText = sanitizeSheetName(`Ubicación=${locationFilter}`);
            filterInfo.push(safeText);
        }
        
        // Nombre del archivo con fecha
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        
        // Nombre de la hoja (limitado a 31 caracteres para Excel)
        let sheetName = 'Reporte Inventario';
        if (filterInfo.length > 0) {
            // Sanitizar el nombre de la hoja y limitar longitud
            sheetName = sanitizeSheetName(`Reporte ${filterInfo[0]}`).substring(0, 31);
        }
        
        // Añadir hoja al libro
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        
        // Nombre del archivo
        let fileName = `Reporte_Inventario_${dateStr}`;
        if (filterInfo.length > 0) {
            fileName += '_Filtrado';
        }
        fileName += '.xlsx';
        
        // Exportar
        XLSX.writeFile(workbook, fileName);
        
        // Registrar actividad
        if (window.logActivity) {
            const filterText = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';
            window.logActivity(`Se ha exportado un reporte de inventario con ${formattedData.length} productos${filterText}`, 'success');
        }
        
        // Notificar al usuario
        showToast(`Reporte con ${formattedData.length} productos exportado correctamente`, 'success');
        
    } catch (error) {
        console.error('Error al exportar reporte:', error);
        showToast('Error al generar archivo Excel: ' + error.message, 'error');
    }
}

// Función auxiliar para sanitizar nombres de hojas de Excel
function sanitizeSheetName(text) {
    // Excel prohíbe estos caracteres en nombres de hojas: : \ / ? * [ ]
    return text.replace(/[:\/\\?*\[\]]/g, '-');
}

// Exponer función para poder llamarla desde HTML
window.showInventoryReport = showInventoryReport;

// Función para mostrar historial de alertas de temperatura
function showTemperatureAlertHistory() {
    // Verificar si hay datos almacenados
    const savedAlerts = localStorage.getItem('freshtrack_temp_alerts');
    if (!savedAlerts) {
        showToast('No hay historial de alertas de temperatura disponible', 'info');
        return;
    }

    const alerts = JSON.parse(savedAlerts);
    
    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Historial de Alertas de Temperatura</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <div class="report-table-container">
                    <table class="history-table temperature-alert-history">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Temperatura</th>
                                <th>Descripción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alerts.map(alert => {
                                const tempClass = alert.temperature >= 8 ? 'temp-critical' : 'temp-warning';
                                return `
                                    <tr>
                                        <td>${new Date(alert.timestamp).toLocaleString()}</td>
                                        <td class="${tempClass}">${alert.temperature}°C</td>
                                        <td>${alert.message}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button id="clear-temp-alerts" class="btn-secondary">Limpiar historial</button>
                    <button class="modal-close-btn btn-primary">Cerrar</button>
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
    
    // Manejar cierre
    const closeButtons = modal.querySelectorAll('.close-button, .modal-close-btn');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        });
    });
    
    // Limpiar historial
    document.getElementById('clear-temp-alerts').addEventListener('click', () => {
        localStorage.removeItem('freshtrack_temp_alerts');
        modal.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
        showToast('Historial de alertas de temperatura eliminado', 'success');
    });
}

// Función para registrar alerta de temperatura
function logTemperatureAlert(temperature, message) {
    // Crear objeto de alerta
    const alert = {
        temperature,
        message,
        timestamp: new Date()
    };
    
    // Obtener alertas existentes o crear array vacío
    const savedAlerts = localStorage.getItem('freshtrack_temp_alerts');
    const alerts = savedAlerts ? JSON.parse(savedAlerts) : [];
    
    // Añadir nueva alerta al principio
    alerts.unshift(alert);
    
    // Limitar a 50 alertas
    if (alerts.length > 50) alerts.pop();
    
    // Guardar en localStorage
    localStorage.setItem('freshtrack_temp_alerts', JSON.stringify(alerts));
    
    // Registrar como actividad
    logActivity(`Alerta de temperatura: ${temperature}°C - ${message}`, 'warning');
}

// Exponer función para uso externo
window.showTemperatureAlertHistory = showTemperatureAlertHistory;

// Función para generar notificaciones nativas del navegador
function sendBrowserNotification(title, message) {
    // Verificar soporte para notificaciones
    if (!("Notification" in window)) {
        console.log("Este navegador no soporta notificaciones de escritorio");
        return;
    }
    
    // Verificar permiso
    if (Notification.permission === "granted") {
        // Crear notificación
        const notification = new Notification(title, {
            body: message,
            icon: '/img/FreshTrackLogo.png'
        });
        
        // Cerrar automáticamente después de 5 segundos
        setTimeout(() => notification.close(), 5000);
    }
    // Solicitar permiso si no está otorgado
    else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                sendBrowserNotification(title, message);
            }
        });
    }
}

// Función para calcular y mostrar la predicción de caducidad
async function predictExpiration() {
    const foodTypeSelect = document.getElementById('food-type');
    const manufacturingDateInput = document.getElementById('manufacturing-date');
    const predictionElement = document.getElementById('expiration-prediction');
    
    // Verificar que los valores necesarios estén presentes
    if (!foodTypeSelect.value || !manufacturingDateInput.value) {
        if (predictionElement) {
            predictionElement.textContent = 'Completa el tipo de alimento y fecha de fabricación para ver predicción';
            predictionElement.className = 'prediction-message';
        }
        return;
    }
    
    try {
        // Hacer petición al servidor para calcular fecha estimada
        const response = await fetch('/api/predict-expiration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: foodTypeSelect.value,
                manufacturingDate: manufacturingDateInput.value,
                entryDate: document.getElementById('entry-date').value
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al calcular fecha de caducidad');
        }
        
        const data = await response.json();
        
        // Mostrar predicción
        if (predictionElement) {
            const expirationDate = new Date(data.expirationDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const diffTime = expirationDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                predictionElement.textContent = `¡Atención! Este producto ya estaría vencido (${formatDate(data.expirationDate)})`;
                predictionElement.className = 'prediction-message danger';
            } else if (diffDays <= 3) {
                predictionElement.textContent = `¡Atención! Este producto vencerá muy pronto: ${formatDate(data.expirationDate)} (${diffDays} días)`;
                predictionElement.className = 'prediction-message warning';
            } else {
                predictionElement.textContent = `Fecha estimada de vencimiento: ${formatDate(data.expirationDate)} (${diffDays} días)`;
                predictionElement.className = 'prediction-message ok';
            }
        }
    } catch (error) {
        console.error('Error al predecir fecha de caducidad:', error);
        if (predictionElement) {
            predictionElement.textContent = 'No se pudo calcular la fecha de caducidad';
            predictionElement.className = 'prediction-message error';
        }
    }
}

// Función para manejar el cambio de tema
function toggleDarkMode() {
    const body = document.body;
    
    // Toggle de la clase dark-mode
    body.classList.toggle('dark-mode');
    
    // Guardar preferencia en localStorage
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('freshtrack_dark_mode', isDarkMode ? 'true' : 'false');
    
    // Actualizar icono
    const darkModeIcon = document.querySelector('.dark-mode-toggle i');
    const darkModeText = document.querySelector('.dark-mode-toggle .toggle-text');
    
    if (isDarkMode) {
        darkModeIcon.className = 'fas fa-sun';
        darkModeText.textContent = 'Modo Claro';
        logActivity('Modo oscuro activado', 'info');
    } else {
        darkModeIcon.className = 'fas fa-moon';
        darkModeText.textContent = 'Modo Oscuro';
        logActivity('Modo claro activado', 'info');
    }
}

// Función para cargar el tema preferido
function loadPreferredTheme() {
    const isDarkMode = localStorage.getItem('freshtrack_dark_mode') === 'true';
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        
        // Actualizar icono
        const darkModeIcon = document.querySelector('.dark-mode-toggle i');
        const darkModeText = document.querySelector('.dark-mode-toggle .toggle-text');
        
        if (darkModeIcon && darkModeText) {
            darkModeIcon.className = 'fas fa-sun';
            darkModeText.textContent = 'Modo Claro';
        }
    }
}

// Gestión de temas
document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('theme-toggle');
    const themePanel = document.getElementById('theme-panel');
    const closeThemePanel = document.getElementById('close-theme-panel');
    const themeOptions = document.querySelectorAll('.theme-option');
    
    // Cargar tema guardado
    const savedTheme = localStorage.getItem('freshtrack-theme') || 'default';
    applyTheme(savedTheme);
    
    // Marcar el tema activo
    themeOptions.forEach(option => {
        if (option.dataset.theme === savedTheme) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Mostrar/ocultar panel
    themeToggle.addEventListener('click', () => {
        themePanel.classList.toggle('active');
    });
    
    // Cerrar panel
    closeThemePanel.addEventListener('click', () => {
        themePanel.classList.remove('active');
    });
    
    // Cambiar tema
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            
            // Actualizar clases activas
            themeOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            // Aplicar tema
            applyTheme(theme);
            
            // Guardar preferencia
            localStorage.setItem('freshtrack-theme', theme);
            
            // Notificar al usuario
            showToast(`Tema "${theme}" aplicado correctamente`, 'success', false);
        });
    });
    
    // Cerrar al hacer clic fuera
    document.addEventListener('click', (event) => {
        if (!themeToggle.contains(event.target) && 
            !themePanel.contains(event.target) && 
            themePanel.classList.contains('active')) {
            themePanel.classList.remove('active');
        }
    });
    
    // Función para aplicar tema
    function applyTheme(theme) {
        // Eliminar clases de tema anteriores
        document.body.classList.remove('theme-blue', 'theme-purple', 'theme-green');
        
        // Aplicar nuevo tema si no es el predeterminado
        if (theme !== 'default') {
            document.body.classList.add(`theme-${theme}`);
        }
    }
});