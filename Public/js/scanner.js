// scanner.js
document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('qr-video');
    const startButton = document.getElementById('start-scanner');
    const stopButton = document.getElementById('stop-scanner');
    const resultElement = document.getElementById('result-content');
    const videoContainer = document.querySelector('.video-container');
    
    let scanning = false;
    let videoStream = null;
    
    // Crear el contenedor placeholder
    const placeholderContainer = document.createElement('div');
    placeholderContainer.className = 'scanner-placeholder';
    placeholderContainer.innerHTML = `
        <div class="placeholder-content">
            <i class="fas fa-qrcode"></i>
            <p>Presione "Iniciar Escáner" para activar la cámara y escanear un código QR</p>
        </div>
    `;
    
    // Insertar el placeholder antes del contenedor de video
    videoContainer.parentNode.insertBefore(placeholderContainer, videoContainer);
    
    // Ocultar inicialmente el contenedor de video
    videoContainer.style.display = 'none';
    
    // Iniciar el escáner
    startButton.addEventListener('click', function() {
        // Ocultar placeholder y mostrar video
        placeholderContainer.style.display = 'none';
        videoContainer.style.display = 'block';
        startScanner();
    });
    
    // Detener el escáner
    stopButton.addEventListener('click', function() {
        // Al detener, volver a mostrar placeholder y ocultar video
        stopScanner();
        videoContainer.style.display = 'none';
        placeholderContainer.style.display = 'block';
    });
    
    async function startScanner() {
        try {
            // Solicitar acceso a la cámara
            videoStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            
            // Mostrar la transmisión de video
            video.srcObject = videoStream;
            video.setAttribute('playsinline', true);
            video.play();
            
            scanning = true;
            startButton.disabled = true;
            stopButton.disabled = false;
            
            // Mostrar mensaje
            showToastFromScanner('Escáner QR activado. Apunte hacia un código QR.', 'info');
            
            // Iniciar detección de QR
            detectQRCode();
            
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            resultElement.innerHTML = `
                <div class="scan-error">
                    <p><i class="fas fa-exclamation-triangle"></i> Error: No se pudo acceder a la cámara.</p>
                    <p>${error.message}</p>
                </div>
            `;
            showToastFromScanner('No se pudo acceder a la cámara. Verifique los permisos.', 'error');
            
            // Mostrar placeholder nuevamente si hay error
            videoContainer.style.display = 'none';
            placeholderContainer.style.display = 'block';
        }
    }
    
    function stopScanner() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => {
                track.stop();
            });
            video.srcObject = null;
        }
        
        scanning = false;
        startButton.disabled = false;
        stopButton.disabled = true;
        
        // Mostrar mensaje
        showToastFromScanner('Escáner QR detenido.', 'info');
    }
    
    async function detectQRCode() {
        // Cargar la biblioteca jsQR si aún no está cargada
        if (!window.jsQR) {
            try {
                showToastFromScanner('Cargando biblioteca de escaneo QR...', 'info');
                
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
                document.head.appendChild(script);
                
                // Esperar a que la biblioteca se cargue
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('No se pudo cargar la biblioteca jsQR'));
                    
                    // Timeout para evitar esperar indefinidamente
                    setTimeout(() => reject(new Error('Tiempo de espera agotado al cargar jsQR')), 10000);
                });
                
                showToastFromScanner('Biblioteca QR cargada correctamente', 'success');
            } catch (error) {
                console.error('Error al cargar jsQR:', error);
                resultElement.innerHTML = `
                    <div class="scan-error">
                        <p>Error al cargar la biblioteca de escaneo QR: ${error.message}</p>
                    </div>
                `;
                showToastFromScanner('Error al cargar la biblioteca de escaneo QR', 'error');
                return;
            }
        }
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Configurar el intervalo de escaneo
        const scanInterval = setInterval(() => {
            if (!scanning) {
                clearInterval(scanInterval);
                return;
            }
            
            // Asegurarse de que el video esté listo
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.height = video.videoHeight;
                canvas.width = video.videoWidth;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Obtener datos de imagen
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                
                // Procesar con jsQR
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });
                
                // Si se detecta un código QR
                if (code) {
                    console.log('QR detectado:', code.data);
                    
                    // Reproducir sonido de éxito (opcional)
                    // playBeepSound();
                    
                    // Mostrar el resultado
                    processQRData(code.data);
                    
                    // Opcional: detener el escáner después de una detección exitosa
                    clearInterval(scanInterval);
                    stopScanner();
                    
                    // Mostrar placeholder después de escanear
                    videoContainer.style.display = 'none';
                    placeholderContainer.style.display = 'block';
                    
                    // Mostrar notificación
                    showToastFromScanner('Código QR detectado correctamente', 'success');
                }
            }
        }, 100); // Escanear cada 100ms
    }
    
    function processQRData(qrData) {
        try {
            // Intentar parsear los datos del QR como JSON
            // Formato esperado: {"type":"pollo","name":"Pechuga de Pollo","manufacturingDate":"2025-03-09","batchNumber":"LOT123"}
            const productData = JSON.parse(qrData);
            
            // Validar datos mínimos
            if (!productData.type || !productData.manufacturingDate || !productData.batchNumber) {
                throw new Error('Datos de producto incompletos en el código QR');
            }
            
            // Construir interfaz de resultado
            resultElement.innerHTML = `
                <div class="scan-success">
                    <h4><i class="fas fa-check-circle"></i> Producto escaneado correctamente</h4>
                    <p><strong>Tipo de Alimento:</strong> ${productData.type || 'No especificado'}</p>
                    <p><strong>Nombre:</strong> ${productData.name || foodTypeNames[productData.type] || 'No especificado'}</p>
                    <p><strong>Fecha de Fabricación:</strong> ${formatDate(productData.manufacturingDate) || 'No especificada'}</p>
                    <p><strong>Lote:</strong> ${productData.batchNumber || 'No especificado'}</p>
                    <button id="register-scanned" class="btn-primary">
                        <i class="fas fa-save"></i> Registrar Producto
                    </button>
                </div>
            `;
            
            // Añadir evento para registrar el producto escaneado
            document.getElementById('register-scanned').addEventListener('click', function() {
                registerScannedProduct(productData);
            });
        } catch (error) {
            resultElement.innerHTML = `
                <div class="scan-error">
                    <h4><i class="fas fa-exclamation-triangle"></i> Error al procesar el código QR</h4>
                    <p>El formato del código QR no es válido.</p>
                    <p><strong>Datos recibidos:</strong> ${qrData}</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                </div>
            `;
            showToastFromScanner('Formato de QR no válido. Se esperaba JSON con datos de producto.', 'error');
        }
    }
    
    function registerScannedProduct(productData) {
        // Auto-rellenar el formulario con los datos escaneados
        const productNameInput = document.getElementById('product-name');
        const foodTypeSelect = document.getElementById('food-type');
        const manufacturingDateInput = document.getElementById('manufacturing-date');
        const batchNumberInput = document.getElementById('batch-number');
        
        if (productNameInput && foodTypeSelect && manufacturingDateInput && batchNumberInput) {
            // Establecer nombre del producto (usando el nombre explícito o el derivado del tipo)
            productNameInput.value = productData.name || foodTypeNames[productData.type] || '';
            
            // Establecer tipo de alimento
            foodTypeSelect.value = productData.type || '';
            
            // Establecer fecha de fabricación
            manufacturingDateInput.value = productData.manufacturingDate || '';
            
            // Establecer número de lote
            batchNumberInput.value = productData.batchNumber || '';
            
            // Si hay cantidad y unidad, también establecerlas
            if (productData.quantity) {
                const quantityInput = document.getElementById('quantity');
                if (quantityInput) {
                    quantityInput.value = productData.quantity;
                }
            }
            
            if (productData.quantityUnit) {
                const quantityUnitSelect = document.getElementById('quantity-unit');
                if (quantityUnitSelect) {
                    quantityUnitSelect.value = productData.quantityUnit;
                }
            }
            
            // Si hay ubicación de almacenamiento, establecerla
            if (productData.storageLocation) {
                const storageLocationInput = document.getElementById('storage-location');
                if (storageLocationInput) {
                    storageLocationInput.value = productData.storageLocation;
                }
            }
            
            // Desplazarse al formulario
            document.getElementById('new-product-form').scrollIntoView({ behavior: 'smooth' });
            
            // Mensaje de éxito
            showToastFromScanner('Datos del producto cargados en el formulario', 'success');
        } else {
            showToastFromScanner('Error al cargar datos en el formulario', 'error');
        }
        
        // Mostrar mensaje de éxito
        resultElement.innerHTML += '<p class="success-message">¡Producto cargado en el formulario!</p>';
    }
    
    // Función para formatear fechas
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('es-ES', options);
        } catch (error) {
            console.error('Error al formatear fecha:', error);
            return dateString;
        }
    }
    
    // Función auxiliar para mostrar toasts desde este módulo
    function showToastFromScanner(message, type) {
        if (window.showToast && typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            // Fallback si showToast no está disponible
            console.log(`Toast: ${message} (${type})`);
        }
    }
    
    // Hacer accesible la función de formatDate desde window para que sea accesible
    window.formatDateFromScanner = formatDate;
});