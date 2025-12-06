const exampleModel = require('../models/Model');
const db = require('../config/db');
const coupleService = require('../services/couple.service');
const { userSockets, io } = require("../app");

exports.Index = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;

        const [listDateToday] = await db.query(
            `SELECT * FROM date WHERE couple_id = ? AND DATE(time) = CURDATE() ORDER BY time DESC`, [coupleId]
        );

        const [listDateTomorrow] = await db.query(
            `SELECT * FROM date WHERE couple_id = ? AND DATE(time) > CURDATE() AND status = 1 ORDER BY time DESC`, [coupleId]
        );

        const [listDatePassed] = await db.query(
            `SELECT * FROM date WHERE couple_id = ? AND DATE(time) < CURDATE() ORDER BY time DESC`, [coupleId]
        );

        const [listDate] = await db.query(
            `SELECT * FROM date WHERE couple_id = ? AND DATE(time) > CURDATE() ORDER BY time DESC`, [coupleId]
        );

        const [listDateComfirm] = await db.query(
            `SELECT * FROM date WHERE couple_id = ? AND status = 1 ORDER BY time DESC`, [coupleId]
        );
        res.render('date/index', { listDate, listDateToday, listDateTomorrow, listDatePassed, dates: listDateComfirm });

    } catch (error) {
        console.error(error);
        res.status(500).send("Đã xảy ra lỗi!");
    }
};

//Thêm mới
exports.Create = async(req, res) => {
    try {
        const { title, day, time, location, type, note } = req.body;
        if (!title || !day || !time || !location || !type) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin!"
            });
        }

        const coupleId = req.session.couple.id;
        const userCode = req.session.user.code;
        const coupleInfo = await coupleService.getCoupleInfo(userCode);
        const user1 = coupleInfo.user1_id;
        const user2 = coupleInfo.user2_id;
        const currentUser = req.session.user.id;
        const partnerId = currentUser === user1 ? user2 : user1;

        const datetime = `${day} ${time}:00`;

        await db.query(
            `INSERT INTO date (title, time, location, type, note, couple_id)
             VALUES (?, ?, ?, ?, ?, ?)`, [title, datetime, location, type, note || "", coupleId]
        );

        // Send realtime to partner
        if (global._io && partnerId) {
            global._io.to(userSockets[partnerId]).emit("new_date", {
                title,
                datetime,
                location,
                type
            });
        }

        return res.status(200).json({
            success: true,
            message: "Tạo buổi hẹn thành công!"
        });

    } catch (error) {
        console.error("❌ Lỗi tạo buổi hẹn:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server!"
        });
    }
};


//Chi tiết
exports.getOne = async(req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM date WHERE id = ?", [req.params.id]);
        res.json({ success: true, date: rows[0] });
    } catch (e) {
        res.status(500).json({ success: false });
    }
}

//Chỉnh sửa
exports.update = async(req, res) => {
    try {
        const { id, title, day, time, location, type, notes } = req.body;

        const fullTime = `${day} ${time}:00`;

        await db.query(
            "UPDATE date SET title=?, time=?, location=?, type=?, note=? WHERE id=?", [title, fullTime, location, type, notes, id]
        );

        res.json({ success: true, message: "Cập nhật thành công!" });
    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false });
    }
};

//Cập nhật trạng thái
exports.updateStatus = async(req, res) => {
    try {
        const { id, status } = req.body;

        // 0 = chờ xác nhận (mặc định)
        // 1 = đã xác nhận
        // 2 = đã hủy

        await db.query(`UPDATE date SET status = ? WHERE id = ?`, [status, id]);

        res.json({ success: true, message: "Cập nhật trạng thái thành công!" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Lỗi server!" });
    }
};