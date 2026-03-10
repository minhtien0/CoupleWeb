const cron = require('node-cron');
const db = require('../config/db');

// Chạy mỗi phút để xóa các pending đã hết hạn
cron.schedule('0 0 * * *', async () => {
    try {
        const [result] = await db.query(
            'DELETE FROM password_resets WHERE expires_at < NOW()'
        );
        
        if (result.affectedRows > 0) {
            console.log(`🧹 Đã xóa ${result.affectedRows} password resets hết hạn`);
        }
    } catch (error) {
        console.error('Lỗi khi xóa pending hết hạn:', error);
    }
});