const exampleModel = require('../models/Model');
const coupleService = require('../services/couple.service');
const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.Index = async(req, res) => {
    const userCode = req.session.user.code;
    const coupleInfo = await coupleService.getCoupleInfo(userCode);
    const coupleId = req.session.couple.id;
    const [getCost] = await db.query(
        'SELECT * FROM cost WHERE couple_id = ? ORDER BY date_time ASC', [coupleId]
    );
    // Tổng trong tháng
    let totalThisMonth = 0;
    // Tổng từng người
    let totalUser1 = 0;
    let totalUser2 = 0;
    getCost.forEach(item => {
        const money = Number(item.money) || 0;
        totalThisMonth += money;

        if (item.user_id === coupleInfo.user1_id) {
            totalUser1 += money;
        }

        if (item.user_id === coupleInfo.user2_id) {
            totalUser2 += money;
        }
    });

    // Tính chênh lệch
    const difference = Math.abs(totalUser1 - totalUser2);

    const [countImage] = await db.query(
        'SELECT COUNT(*) AS totalImage FROM memories WHERE couple_id = ? AND type = ?', [coupleId, 'album']
    );
    const totalAlbum = countImage[0].totalImage;

    const [countDate] = await db.query(
        'SELECT COUNT(*) AS totalDate FROM date WHERE couple_id = ? AND status = 1', [coupleId]
    );
    const totalDate = countDate[0].totalDate;


    res.render('us/index', {
        coupleInfo,
        getCost,
        totalThisMonth,
        totalUser1,
        totalUser2,
        difference,
        totalAlbum,
        totalDate
    });
};
exports.createCost = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;
        const { type, title, money, date_time, user_id, note } = req.body;
        if (!title || !type || !money || !date_time) {
            return res.json({ success: false, message: "Thiếu thông tin!" });
        }
        // Insert memory
        await db.query(
            `INSERT INTO cost (title, money,user_id, type, date_time,note, couple_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [title, money, user_id, type, date_time, note, coupleId]
        );

        res.json({
            success: true,
            message: "Đã thêm chi phí mới thành công!"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

exports.Profile = (req, res) => {
    res.render('us/profile'); // Render file views/date/index.ejs
};