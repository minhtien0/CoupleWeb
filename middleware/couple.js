const db = require('../config/db');

module.exports = async(req, res, next) => {
    try {
        console.log('🧩 [Couple Middleware] Đang kiểm tra path:', req.path);

        // Các đường dẫn công khai không cần kiểm tra couple
        const publicPaths = ['/home', '/date', '/journey', '/memories', '/us'];

        // Cho phép các path khớp bắt đầu (vd: /us/profile, /journey/detail/1)
        if (publicPaths.some(p => req.path.startsWith(p))) {
            console.log('➡️ Bỏ qua kiểm tra couple cho path:', req.path);
            return next();
        }

        // Kiểm tra session user
        if (!req.session.user) {
            console.log('Chặn truy cập: chưa login, path =', req.path);
            return res.redirect('/'); // chuyển hướng
        }

        const userCode = req.session.user.code;
        console.log('👤 Kiểm tra couple cho userCode:', userCode);

        // Kiểm tra trong bảng couples
        const [rows] = await db.query(
            `SELECT * FROM couples WHERE status = 1 AND (user1_code = ? OR user2_code = ?) LIMIT 1`, [userCode, userCode]
        );

        if (rows.length === 0) {
            console.log('🚫 Không có couple hợp lệ cho user:', userCode);
            return res.status(403).json({ success: false, message: 'Bạn chưa có couple hợp lệ!' });
        }

        // Lưu couple vào request để các controller sau có thể dùng
        req.couple = rows[0];
        console.log('💖 Couple hợp lệ:', req.couple.id);

        next();
    } catch (err) {
        console.error('❌ Lỗi middleware couple:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
};