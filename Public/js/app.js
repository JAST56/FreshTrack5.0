// app.js - Versión modificada para trabajar con la API
let foodInventory = [];
let currentTemp = 22.0; // Temperatura por defecto
let currentHumidity = 65; // Humedad por defecto

// Variable para almacenar el historial de actividades
let activityHistory = [];
const MAX_ACTIVITIES = 50; // Número máximo de actividades a guardar

// Al cargar el documento
document.addEventListener('DOMContentLoaded', function() {
    // Cargar actividades desde localStorage
    loadActivitiesFromLocalStorage();
    
    // Inicializar la aplicación
    initializeApp();
    
    // Configurar listeners de eventos
    setupEventListeners();
    
    // Cargar datos del servidor
    loadInventoryFromServer();
});

// Inicialización de la aplicación
function initializeApp() {
    // Configurar fecha actual por defecto en el formulario
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entry-date').value = today;
    
    // Cargar tipos de alimentos desde el servidor
    loadFoodTypes();
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
    
    // Cerrar paneles al hacer clic fuera
    document.addEventListener('click', handleOutsideClick);
    
    // Búsqueda de productos
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('search-button').addEventListener('click', handleSearch);
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
    const alerts = foodInventory.filter(item => item.status === 'warning' || item.status === 'danger');
    
    // Actualizar contador de notificaciones
    notificationCount.textContent = alerts.length;
    
    // Limpiar lista de notificaciones
    notificationList.innerHTML = '';
    
    // Agregar notificaciones a la lista
    if (alerts.length === 0) {
        notificationList.innerHTML = '<div class="notification-item">No hay alertas de vencimiento.</div>';
    } else {
        alerts.forEach(item => {
            const alertItem = document.createElement('div');
            alertItem.classList.add('notification-item');
            alertItem.classList.add(item.status === 'danger' ? 'urgent' : 'warning');
            
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
            `;
            
            notificationList.appendChild(alertItem);
        });
    }
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
    
    // Permitir cerrar manualmente
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        clearTimeout(timeout);
        removeToast(toast);
    });
    
    // Registrar como actividad del sistema si se solicita
    if (logAsActivity) {
        logActivity(message, type);
    }
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