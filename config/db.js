require('dotenv').config();
const mysql = require('mysql2/promise'); // Giữ nguyên: hỗ trợ Promise/async/await

// Sử dụng createPool thay vì createConnection để tự động quản lý kết nối
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // Số kết nối tối đa trong pool
    queueLimit: 0 // Không giới hạn queue
});

// Kiểm tra kết nối (tùy chọn, sử dụng getConnection để test)
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Đã kết nối MySQL thành công qua pool!');
        connection.release(); // Giải phóng kết nối về pool
    } catch (err) {
        console.error('❌ Kết nối database thất bại:', err.stack);
    }
}

// Gọi testConnection khi module được load (tùy chọn, để kiểm tra ngay)
testConnection();

module.exports = pool; // Export pool để sử dụng query trực tiếp