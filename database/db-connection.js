const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Kjpg0880',  // Cambiar según tu configuración de mysql
    database: 'freshtrack'
};

// Pool de conexiones para mejor rendimiento
let pool;

async function initializeDatabase() {
    try {
        // Crear pool de conexiones
        pool = mysql.createPool(dbConfig);

        // Verificar conexión
        const connection = await pool.getConnection();
        console.log('Conexión a la base de datos establecida correctamente.');
        
        // Verificar si la base de datos está inicializada
        const [tables] = await connection.query('SHOW TABLES');
        
        // Si no hay tablas, inicializar la base de datos
        if (tables.length === 0) {
            console.log('Inicializando la base de datos...');
            
            // Leer archivo SQL con el esquema
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Dividir en comandos individuales y ejecutar
            const commands = schema.split(';').filter(cmd => cmd.trim());
            
            for (const command of commands) {
                if (command.trim()) {
                    await connection.query(command + ';');
                }
            }
            
            console.log('Base de datos inicializada correctamente.');
        }
        
        // Liberar conexión
        connection.release();
        
        return pool;
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        throw error;
    }
}

// Función para obtener el pool de conexiones
function getPool() {
    if (!pool) {
        throw new Error('La base de datos no ha sido inicializada. Llama a initializeDatabase() primero.');
    }
    return pool;
}

module.exports = {
    initializeDatabase,
    getPool
};