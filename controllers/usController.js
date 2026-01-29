const exampleModel = require('../models/Model');
const coupleService = require('../services/couple.service');
const db = require('../config/db');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');

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

        await db.query(
            `INSERT INTO cost (title, money,user_id, type, date_time,note, couple_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [title, money, user_id, type, date_time, note, coupleId]
        );

        const userCode = req.session.user.code;
        const userName = req.session.user.name;
        const coupleInfo = await coupleService.getCoupleInfo(userCode);
        const user1 = coupleInfo.user1_id;
        const user2 = coupleInfo.user2_id;
        const currentUser = req.session.user.id;
        const partnerId = currentUser === user1 ? user2 : user1;
        const now = new Date();
        const day = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);
        const datetime = `${day} ${time}:00`;
        const notifTitle = "Người Ấy vừa thêm chi phí mới 💕";
        const notifContent = `${userName} đã thêm chi phí "${title}" vào ${day} lúc ${time}`;
        const notifLink = "/us";

        const [notifResult] = await db.query(
            `INSERT INTO notifications (user_id, sender_id, type, title, content, link, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`, [partnerId, currentUser, 'new_cost', notifTitle, notifContent, notifLink]
        );
        const newNotifId = notifResult.insertId;

        if (global._io && partnerId) {
            const [rows] = await db.query(
                `SELECT COUNT(*) AS unread 
                 FROM notifications 
                 WHERE user_id = ? AND is_read = 0`, [partnerId]
            );
            const unreadCount = rows[0].unread;
            const notificationPayload = {
                id: newNotifId,
                title: notifTitle,
                message: title,
                datetime: datetime,
                location: 'Việt Nam',
                type: 'new_cost',
                content: notifContent,
                link: notifLink,
                read: false,
                created_at: new Date().toISOString()
            };

            global._io.to(`user_${partnerId}`).emit("new_notification", {
                notification: notificationPayload,
                unreadCount: unreadCount
            });

        }

        res.json({
            success: true,
            message: "Đã thêm chi phí mới thành công!"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

exports.exportExpensesExcel = async(req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const coupleId = req.session.couple.id;
        if (!coupleId) {
            return res.status(400).send('Không tìm thấy thông tin couple');
        }

        // 1. Lấy thông tin 2 người trong couple
        const [
            [couple]
        ] = await conn.query(
            `SELECT user1_code, user2_code FROM couples WHERE id = ?`, [coupleId]
        );

        const [users] = await conn.query(
            `SELECT id, name FROM users WHERE code IN (?, ?)`, [couple.user1_code, couple.user2_code]
        );


        if (users.length !== 2) {
            return res.status(404).send('Không tìm thấy đủ 2 thành viên trong couple');
        }

        const user1 = users[0];
        const user2 = users[1];

        // 2. Lấy tất cả chi phí của couple, sắp xếp mới nhất trước
        const [costs] = await conn.query(
            `SELECT title, money, user_id, type, date_time, note 
             FROM cost 
             WHERE couple_id = ? 
             ORDER BY date_time DESC`, [coupleId]
        );

        // 3. Tính tổng tháng hiện tại (tháng của ngày hiện tại)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // 01-12

        const [thisMonthRows] = await conn.query(
            `SELECT money, user_id 
             FROM cost 
             WHERE couple_id = ? 
               AND DATE_FORMAT(date_time, '%Y-%m') = ?`, [coupleId, `${year}-${month}`]
        );

        const totalThisMonth = thisMonthRows.reduce((sum, row) => sum + row.money, 0);

        const totalUser1 = thisMonthRows
            .filter(row => row.user_id === user1.id)
            .reduce((sum, row) => sum + row.money, 0);

        const totalUser2 = thisMonthRows
            .filter(row => row.user_id === user2.id)
            .reduce((sum, row) => sum + row.money, 0);

        const difference = totalUser1 - totalUser2;

        // ================== Tạo file Excel (giữ nguyên thiết kế đẹp Couple App) ==================
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Couple App 💕';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Thống kê chi phí');

        // Màu sắc Couple App
        const rose = 'EC4899'; // pink-500
        const purple = 'A78BFA'; // purple-400
        const emerald = '10B981'; // emerald-500
        const indigo = '6366F1';

        // Tiêu đề lớn
        worksheet.mergeCells('A1:G1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = '💕 Thống kê chia sẻ chi phí - Couple App 💕';
        titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rose } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 45;

        // Tổng chi tháng này
        worksheet.mergeCells('A3:D3');
        worksheet.getCell('A3').value = 'Tổng chi tiêu tháng này';
        worksheet.getCell('A3').font = { size: 14, bold: true };

        worksheet.mergeCells('E3:G3');
        worksheet.getCell('E3').value = `${totalThisMonth.toLocaleString('vi-VN')} ₫`;
        worksheet.getCell('E3').font = { size: 18, bold: true, color: { argb: 'FF' + emerald } };
        worksheet.getCell('E3').alignment = { horizontal: 'center' };

        // Ai trả bao nhiêu
        worksheet.getCell('A5').value = `${user1.name} đã trả`;
        worksheet.getCell('B5').value = `${totalUser1.toLocaleString('vi-VN')} ₫`;
        worksheet.getCell('B5').font = { bold: true, color: { argb: 'FF' + rose } };

        worksheet.getCell('E5').value = `${user2.name} đã trả`;
        worksheet.getCell('F5').value = `${totalUser2.toLocaleString('vi-VN')} ₫`;
        worksheet.getCell('F5').font = { bold: true, color: { argb: 'FF' + purple } };

        // Chênh lệch
        worksheet.mergeCells('A7:G7');
        const whoMore = difference > 0 ? user1.name : user2.name;
        const diffAbs = Math.abs(difference).toLocaleString('vi-VN');
        worksheet.getCell('A7').value = `Chênh lệch: ${diffAbs} ₫ (${whoMore} trả nhiều hơn) 💸`;
        worksheet.getCell('A7').font = { size: 14, bold: true, color: { argb: 'FF' + indigo } };
        worksheet.getCell('A7').alignment = { horizontal: 'center' };

        // Dòng trống
        worksheet.addRow([]);
        worksheet.addRow([]);

        // Header bảng chi tiết
        const headerRow = worksheet.addRow(['Ngày', 'Tiêu đề', 'Số tiền (₫)', 'Người trả', 'Loại', 'Ghi chú']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + purple } };
        headerRow.eachCell(cell => cell.alignment = { horizontal: 'center' });

        worksheet.columns = [
            { width: 15 }, { width: 30 }, { width: 20 }, { width: 15 }, { width: 18 }, { width: 40 }
        ];

        // Thêm dữ liệu chi tiết
        costs.forEach(item => {
            const date = new Date(item.date_time);
            const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

            const payer = item.user_id === user1.id ? user1.name : user2.name;

            const typeEmoji = {
                "Ăn uống": '🍽️',
                "Giải trí": '🎬',
                "Di chuyển": '🚗',
                "Mua sắm": '🛍️',
                "Du lịch": '✈️'
            }[item.type] || '💳';

            worksheet.addRow([
                formattedDate,
                item.title,
                item.money,
                payer,
                typeEmoji + ' ' + item.type,
                item.note || ''
            ]);
        });

        // Format tiền tệ
        worksheet.getColumn(3).numFmt = '#,##0 "₫"';

        // Dòng xen kẽ màu nhẹ
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 11 && rowNumber % 2 === 0) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            }
        });

        // Header download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Couple_App_Chi_Phi_${now.toISOString().slice(0,10)}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Lỗi export Excel:', error);
        res.status(500).send('Có lỗi khi xuất file Excel');
    } finally {
        if (conn) conn.release(); // Nếu dùng pool có getConnection()
    }
};

exports.Statistics = async(req, res) => {
    res.render('us/statistics');
};