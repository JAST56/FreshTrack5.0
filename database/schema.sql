-- FreshTrack Database Schema

CREATE DATABASE IF NOT EXISTS freshtrack;
USE freshtrack;

-- Tabla de tipos de alimentos
CREATE TABLE IF NOT EXISTS food_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    base_expiration_days INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de artículos del inventario
CREATE TABLE IF NOT EXISTS inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    food_type_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    quantity_unit VARCHAR(20) NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    manufacturing_date DATE NOT NULL,
    entry_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    storage_location VARCHAR(10) NOT NULL,
    status ENUM('ok', 'warning', 'danger') NOT NULL DEFAULT 'ok',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (food_type_id) REFERENCES food_types(id)
);

-- Tabla de registros de temperatura
CREATE TABLE IF NOT EXISTS temperature_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    temperature DECIMAL(5,2) NOT NULL,
    humidity DECIMAL(5,2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'sensor' -- 'sensor' o 'simulation'
);

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_item_id INT,
    message VARCHAR(255) NOT NULL,
    type ENUM('warning', 'danger', 'info', 'success') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
);

-- Tabla para la configuración del sistema
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(50) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserción de tipos de alimentos predeterminados
INSERT INTO food_types (type_code, name, base_expiration_days) VALUES
    ('pollo', 'Pechuga de Pollo', 4),
    ('carne', 'Carne de Res', 5),
    ('pescado', 'Pescado', 2),
    ('lacteos', 'Productos Lácteos', 14),
    ('frutas', 'Frutas', 7),
    ('verduras', 'Verduras', 5),
    ('embutidos', 'Embutidos', 7),
    ('quesos', 'Quesos', 21),
    ('panaderia', 'Productos de Panadería', 5),
    ('congelados', 'Alimentos Congelados', 90);

-- Configuración del sistema
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
    ('serial_port', 'COM7', 'Puerto serial para conectar con Arduino'),
    ('temperature_threshold_high', '8', 'Umbral alto de temperatura (°C)'),
    ('temperature_threshold_medium', '5', 'Umbral medio de temperatura (°C)'),
    ('warning_days', '10', 'Días para alertar de productos próximos a vencer'),
    ('simulation_mode', 'true', 'Activar modo simulación cuando no hay hardware');