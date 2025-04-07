# FreshTrack - Sistema de Gestión de Inventario de Alimentos

<img src="img/FreshTrackLogo.png" alt="FreshTrack Logo" width="200">

FreshTrack es un sistema integral de gestión de inventario de alimentos perecederos que combina hardware (Arduino con sensores) y software (aplicación web) para optimizar el control de caducidad de alimentos basado en condiciones ambientales en tiempo real.

## Características Principales

- **Monitoreo en tiempo real**: Seguimiento de temperatura y humedad mediante sensores DHT11 conectados a Arduino
- **Gestión de inventario**: Registro y seguimiento de alimentos con fechas de caducidad dinámicas
- **Escaneo QR**: Registro rápido de productos mediante códigos QR
- **Alertas de vencimiento**: Notificaciones automáticas para productos próximos a caducar
- **Cálculo inteligente de caducidad**: Algoritmo que ajusta las fechas de vencimiento según la temperatura de almacenamiento

## Estructura del Proyecto

```
fresh-track/
│
├── web/
│   ├── index.html             # Interfaz de usuario principal
│   ├── css/
│   │   └── style.css          # Estilos CSS
│   ├── js/
│   │   ├── app.js             # Lógica principal de la aplicación
│   │   ├── scanner.js         # Funcionalidad del escáner QR
│   │   └── arduino-connection.js # Comunicación con Arduino
│   └── img/
│       └── FreshTrackLogo.png # Logo del sistema
│
├── server/
│   └── server.js              # Servidor Node.js que se comunica con Arduino
│
└── arduino/
    └── fresh_track/           # Sketch de Arduino
        └── fresh_track.ino    # Código para el Arduino
```

## Requisitos

### Hardware
- Arduino (UNO, Nano, Mega, etc.)
- Sensor DHT11 para temperatura y humedad
- Cables y protoboard
- Opcional: Pantalla LCD con módulo I2C para visualización directa

### Software
- Node.js y npm
- Arduino IDE
- Navegador web moderno (Chrome, Firefox, Edge, etc.)

## Instalación y Configuración

### 1. Configuración de Arduino
1. Conecta el sensor DHT11 al pin 5 del Arduino
2. Si tienes una pantalla LCD, conéctala mediante I2C
3. Descarga e instala las bibliotecas necesarias:
   - DHT New
   - LiquidCrystal I2C (si usas pantalla LCD)
4. Carga el sketch `fresh_track.ino` a tu Arduino

### 2. Servidor Node.js
1. Instala las dependencias del proyecto:
   ```bash
   npm install
   ```
   
2. Configura el puerto serial en `server.js`:
   ```javascript
   const SERIAL_PORT = 'COM7'; // Cambia al puerto correcto de tu sistema
   // Windows: 'COM1', 'COM2', etc.
   // Linux/Mac: '/dev/ttyUSB0', '/dev/ttyACM0', etc.
   ```

3. Inicia el servidor:
   ```bash
   node server.js
   ```
   
   El servidor se ejecutará en `http://localhost:3000`

### 3. Aplicación Web
1. Abre el archivo `index.html` en un navegador moderno
2. Alternativamente, puedes usar un servidor web local como Live Server en VSCode

## Uso del Sistema

### Monitoreo de Temperatura y Humedad
- Los datos de temperatura y humedad se muestran en la parte superior de la interfaz
- Los valores se actualizan automáticamente cada 10 segundos

### Gestión de Inventario
- La tabla principal muestra todos los productos registrados
- Los productos se ordenan automáticamente según su proximidad a la fecha de caducidad
- Códigos de colores: Verde (buen estado), Amarillo (próximo a vencer), Rojo (vencido)

### Registro de Productos
**Método 1: Registro Manual**
1. Completa el formulario en la sección "Registro de Nuevo Producto"
2. Selecciona el tipo de alimento
3. Ingresa la cantidad
4. Selecciona la fecha de fabricación
5. Haz clic en "Registrar Producto"

**Método 2: Escáner QR**
1. Haz clic en "Iniciar Escáner"
2. Apunta la cámara al código QR del producto
3. El sistema procesará automáticamente la información
4. El formato del QR debe ser: `{"type":"pollo","manufacturingDate":"2025-03-09"}`

### Sistema de Alertas
- Las alertas de vencimiento se muestran en la campana de notificaciones
- El número en rojo indica la cantidad de productos próximos a vencer o vencidos
- Haz clic en la campana para ver el detalle de las alertas

## Personalización

### Ajustar Parámetros de Caducidad
Modifica los días de vencimiento para cada tipo de alimento en `app.js`:

```javascript
const expirationConfig = {
    pollo: 7,     // 7 días a temperatura ideal
    carne: 14,    // 14 días a temperatura ideal
    pescado: 3,   // 3 días a temperatura ideal
    lacteos: 14,  // 14 días a temperatura ideal
    frutas: 7,    // 7 días a temperatura ideal
    verduras: 5   // 5 días a temperatura ideal
};
```

### Ajustar el Algoritmo de Caducidad
Modifica la función `calculateExpirationDate()` en `app.js` para cambiar cómo la temperatura afecta a la caducidad:

```javascript
function calculateExpirationDate(foodType, manufacturingDate, entryDate, temperature) {
    // Personaliza los factores de temperatura según tus necesidades
    let tempFactor = 1;
    if (temperature > 5) {
        tempFactor = 0.7; // Reduce un 30% la vida útil
    } else if (temperature > 8) {
        tempFactor = 0.5; // Reduce un 50% la vida útil
    }
    
    // Resto del código...
}
```

## Solución de Problemas

### Comunicación con Arduino
- **Problema**: No se reciben datos del sensor
  - Verifica que el Arduino esté correctamente conectado
  - Comprueba que el puerto serial en `server.js` coincida con el de tu Arduino
  - Asegúrate de que el servidor Node.js esté en ejecución
  - Revisa el monitor serial del Arduino IDE para verificar que esté enviando datos correctamente

### Escáner QR
- **Problema**: El escáner no funciona
  - Asegúrate de que tu navegador tiene permisos para acceder a la cámara
  - Verifica que estés usando un navegador compatible con WebRTC (Chrome, Firefox, Edge)
  - Asegúrate de que tu dispositivo tiene cámara y está funcionando
  - Prueba en modo HTTPS o localhost, ya que algunos navegadores restringen el acceso a la cámara en conexiones no seguras

### Visualización de Datos
- **Problema**: Datos incorrectos o no actualizados
  - Revisa la consola del navegador para ver posibles errores
  - Verifica que la URL de la API en `arduino-connection.js` sea correcta
  - Comprueba que el servidor esté devolviendo datos válidos accediendo directamente a `http://localhost:3000/api/sensor-data`

## Tecnologías Utilizadas

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js, Express
- **Bibliotecas JS**: JSQr para lectura de códigos QR
- **Hardware**: Arduino, Sensor DHT11
- **Comunicación**: SerialPort para Node.js

## Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Haz fork del repositorio
2. Crea una nueva rama para tu funcionalidad
3. Envía un pull request para su revisión

## Licencia

Este proyecto está licenciado bajo la Licencia ISC.

## Contacto

Para más información o soporte, por favor abre un issue en el repositorio: https://github.com/JAST56/FreshTrack/issues






Implementación del Hardware para FreshTrack

si tienes tu sistema FreshTrack funcionando con la base de datos MySQL y en modo simulación. Ahora vamos a preparar todo para que puedas conectar el hardware real a tu PC y el sistema lo reconozca automáticamente.

## Componentes de hardware necesarios

Para la implementación completa necesitarás:

1. Arduino (UNO, Nano, Mega o similar)
2. Sensor DHT11 o DHT22 para medir temperatura y humedad
3. Cables de conexión
4. Cable USB para conectar Arduino a tu PC

## Código para Arduino

Primero, necesitas cargar este código en tu Arduino utilizando el Arduino IDE:

```cpp
/*
 * FreshTrack - Sistema de monitoreo de temperatura y humedad
 * 
 * Este sketch lee la temperatura y humedad de un sensor DHT11/DHT22
 * y envía los datos por el puerto serie en formato JSON para
 * ser capturados por la aplicación FreshTrack.
 */

#include <DHT.h>

// Configuración del sensor DHT
#define DHTPIN 5       // Pin digital donde está conectado el sensor DHT
#define DHTTYPE DHT11  // Tipo de sensor: DHT11 o DHT22

// Inicializar el sensor DHT
DHT dht(DHTPIN, DHTTYPE);

// Variables para almacenar los valores de temperatura y humedad
float temperature;
float humidity;

// Intervalo de lectura (5 segundos)
const unsigned long readInterval = 5000;
unsigned long lastReadTime = 0;

void setup() {
  // Iniciar comunicación serial
  Serial.begin(9600);
  
  // Iniciar el sensor DHT
  dht.begin();
  
  // Mensaje de inicialización
  Serial.println("FreshTrack - Sistema de monitoreo iniciado");
  Serial.println("Esperando lecturas del sensor...");
}

void loop() {
  // Verificar si es tiempo de leer los sensores
  unsigned long currentMillis = millis();
  
  if (currentMillis - lastReadTime >= readInterval) {
    lastReadTime = currentMillis;
    
    // Leer valores del sensor
    humidity = dht.readHumidity();
    temperature = dht.readTemperature();
    
    // Verificar si la lectura fue exitosa
    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("{\"error\":\"Error al leer el sensor DHT\"}");
      return;
    }
    
    // Enviar datos en formato JSON
    Serial.print("{\"temperature\":");
    Serial.print(temperature);
    Serial.print(",\"humidity\":");
    Serial.print(humidity);
    Serial.println("}");
  }
}
```

## Conexiones del hardware

Conecta el sensor DHT11 a tu Arduino de la siguiente manera:

1. **VCC del DHT11** → **5V del Arduino**
2. **GND del DHT11** → **GND del Arduino**
3. **DATA del DHT11** → **Pin Digital 5 del Arduino** (según el código)

Si usas un DHT22 en lugar de un DHT11, solamente necesitas cambiar `#define DHTTYPE DHT11` a `#define DHTTYPE DHT22` en el código.

## Configuración en tu sistema FreshTrack

Una vez que hayas conectado el Arduino a tu PC mediante USB, necesitas identificar el puerto COM al que está conectado:

1. Abre el Administrador de dispositivos de Windows
2. Busca la sección "Puertos (COM y LPT)"
3. Identifica tu Arduino (aparecerá como "Arduino UNO" o similar, seguido del número de puerto COM, por ejemplo: "Arduino UNO (COM3)")

Ahora, debes desactivar el modo simulación y configurar el puerto correcto en FreshTrack:

### Opción 1: Configurar desde phpMyAdmin

1. Abre phpMyAdmin (http://localhost/phpmyadmin)
2. Selecciona la base de datos "freshtrack"
3. Navega a la tabla "system_settings"
4. Modifica estos valores:
   - Cambia `simulation_mode` a `false`
   - Actualiza `serial_port` con el puerto COM correcto (por ejemplo: `COM3`)

### Opción 2: Agregar una interfaz de configuración

Para facilitar la gestión del puerto y el modo simulación, puedes agregar un panel de configuración al sistema. Aquí te muestro cómo implementarlo:

1. **Agregar una sección de configuración en index.html**:

```html
<!-- Añadir esta sección al final, antes del cierre de main -->
<section class="config-section">
    <div class="card">
        <h2>Configuración del Sistema</h2>
        <p class="subtitle">Ajustes para la conexión con el hardware</p>
        
        <div class="form-group">
            <label for="serial-port">Puerto Serial Arduino:</label>
            <div class="port-selector">
                <input type="text" id="serial-port" placeholder="Ejemplo: COM3">
                <button id="update-port" class="btn-primary">Actualizar Puerto</button>
            </div>
            <small>Puerto actual: <span id="current-port">Cargando...</span></small>
        </div>
        
        <div class="form-group">
            <label>Modo de Operación:</label>
            <div class="toggle-container">
                <div class="toggle-option">
                    <input type="radio" id="hardware-mode" name="operation-mode">
                    <label for="hardware-mode">Hardware Real</label>
                </div>
                <div class="toggle-option">
                    <input type="radio" id="simulation-mode" name="operation-mode">
                    <label for="simulation-mode">Simulación</label>
                </div>
            </div>
        </div>
        
        <div class="form-actions">
            <button id="test-connection" class="btn-secondary">
                <i class="fas fa-sync"></i> Probar Conexión
            </button>
        </div>
    </div>
</section>
```

2. **Agregar estilos CSS para la sección de configuración**:

```css
/* Añadir al archivo style.css */
.config-section {
    margin-top: 30px;
}

.port-selector {
    display: flex;
    gap: 10px;
    margin-bottom: 5px;
}

.port-selector input {
    flex: 1;
}

.toggle-container {
    display: flex;
    gap: 20px;
    margin-top: 10px;
}

.toggle-option {
    display: flex;
    align-items: center;
    gap: 5px;
}

.toggle-option input[type="radio"] {
    width: auto;
}

.toggle-option label {
    margin-bottom: 0;
}
```

3. **Agregar JavaScript para la funcionalidad de configuración**:

Crea un nuevo archivo `js/config.js` con el siguiente contenido:

```js
// Funcionalidad para la configuración del hardware
document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const serialPortInput = document.getElementById('serial-port');
    const updatePortButton = document.getElementById('update-port');
    const currentPortSpan = document.getElementById('current-port');
    const hardwareModeRadio = document.getElementById('hardware-mode');
    const simulationModeRadio = document.getElementById('simulation-mode');
    const testConnectionButton = document.getElementById('test-connection');
    
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
            currentPortSpan.textContent = data.serialPort;
            serialPortInput.placeholder = `Actual: ${data.serialPort}`;
            
            // Marcar el modo correcto
            if (data.simulationMode) {
                simulationModeRadio.checked = true;
            } else {
                hardwareModeRadio.checked = true;
            }
            
            // Registrar actividad
            window.logActivity(`Configuración cargada. Puerto: ${data.serialPort}, Modo: ${data.simulationMode ? 'Simulación' : 'Hardware'}`, 'info');
            
        } catch (error) {
            console.error('Error al cargar configuración:', error);
            window.showToast('Error al cargar configuración del sistema', 'error');
        }
    }
    
    // Función para actualizar el puerto serial
    async function updateSerialPort() {
        const newPort = serialPortInput.value.trim();
        
        if (!newPort) {
            window.showToast('Por favor ingrese un puerto válido', 'warning');
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
                window.showToast(`Puerto actualizado a ${newPort}`, 'success');
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
            } else {
                window.showToast(data.message || 'Error al actualizar puerto', 'error');
            }
        } catch (error) {
            console.error('Error al actualizar puerto:', error);
            window.showToast('Error al actualizar puerto serial', 'error');
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
                window.showToast(`Modo ${simulationEnabled ? 'simulación' : 'hardware'} activado`, 'success');
                
                // Recargar la configuración
                await loadSystemSettings();
            } else {
                window.showToast(data.message || 'Error al cambiar modo de operación', 'error');
            }
        } catch (error) {
            console.error('Error al cambiar modo de operación:', error);
            window.showToast('Error al cambiar modo de operación', 'error');
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
                window.showToast(`Modo simulación activo. Temperatura actual: ${data.temperature}°C, Humedad: ${data.humidity}%`, 'info');
            } else {
                window.showToast(`Conexión exitosa con el hardware. Temperatura: ${data.temperature}°C, Humedad: ${data.humidity}%`, 'success');
            }
            
        } catch (error) {
            console.error('Error al probar conexión:', error);
            window.showToast('Error al probar la conexión con el hardware', 'error');
        }
    }
});
```

4. **Incluir el nuevo archivo JS en index.html**:

```html
<!-- Añadir antes del cierre de body -->
<script src="js/config.js"></script>
```

## Verificación de la conexión

Una vez que hayas implementado estos cambios y conectado el Arduino, podrás gestionar la conexión fácilmente desde la interfaz:

1. Ingresa el puerto COM correcto en la sección de configuración
2. Haz clic en "Actualizar Puerto"
3. Selecciona "Hardware Real" como modo de operación
4. Haz clic en "Probar Conexión" para verificar la comunicación

Si todo funciona correctamente, deberías ver un mensaje de éxito con los datos de temperatura y humedad reales del sensor.

## Solución de problemas comunes

### El sistema no detecta el Arduino

1. **Verifica el puerto COM**: Asegúrate de usar el puerto correcto.
2. **Reinicia el Arduino**: A veces simplemente desconectar y volver a conectar soluciona el problema.
3. **Verifica los controladores**: Asegúrate de tener instalados los controladores correctos para tu Arduino.

### El sensor no envía datos

1. **Revisa las conexiones**: Asegúrate que el sensor esté correctamente conectado al pin 5 (o al pin que hayas configurado).
2. **Prueba el código en Arduino IDE**: Abre el monitor serial en Arduino IDE para verificar que los datos se estén enviando correctamente.
3. **Reemplaza el sensor**: Si todos los demás pasos fallan, es posible que tengas un sensor defectuoso.

### El sistema sigue en modo simulación

1. **Verifica la tabla system_settings**: Asegúrate que `simulation_mode` esté configurado como `false`.
2. **Reinicia el servidor**: A veces es necesario reiniciar el servidor Node.js para que los cambios surtan efecto.

## Consideraciones adicionales

- El sistema está diseñado para cambiar automáticamente al modo simulación si hay algún problema con la conexión del hardware, lo que garantiza que siempre tengas datos disponibles.
- Si conectas o desconectas el Arduino mientras el sistema está en ejecución, puede que necesites reiniciar el servidor.
- Para mayor precisión en las mediciones, considera utilizar un sensor DHT22 en lugar del DHT11, ya que ofrece mejor resolución y precisión.

Con estos cambios, tu sistema FreshTrack estará listo para funcionar con hardware real, manteniendo siempre la capacidad de volver al modo simulación cuando sea necesario.