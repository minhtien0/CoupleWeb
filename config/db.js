require('dotenv').config();
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Đã kết nối MySQL thành công qua pool!');
        connection.release();
    } catch (err) {
        console.error('❌ Kết nối database thất bại:', err.stack);
    }
}
testConnection();
module.exports = pool;