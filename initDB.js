const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function initDB() {
    try {
        const client = await pool.connect();
        // console.log("🎉 Base de datos inicializada correctamente");
        client.release(); // 🔥 Importante liberar conexión
    } catch (error) {
        console.error("❌ Error al inicializar la base de datos:", error);
        process.exit(1);
    }
}

module.exports = { initDB, pool };
