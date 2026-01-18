const exampleModel = require('../models/Model');
const db = require("../config/db");
const coupleService = require('../services/couple.service');
exports.Index = async(req, res) => {
    const userCode = req.session.user.code;
    const coupleInfo = await coupleService.getCoupleInfo(userCode);
    const [rows] = await db.query(`
        SELECT 
            m.id,
            m.title,
            m.date_time AS date,
            m.type,
            m.content,
            m.user_name,
            COALESCE(GROUP_CONCAT(im.file_path SEPARATOR ','), '') AS photos
        FROM memories m
        LEFT JOIN image_memories im ON im.memory_id = m.id
        GROUP BY m.id
        ORDER BY m.date_time DESC
    `);

    const albumsData = rows
        .filter(r => r.type === 'album')
        .map(r => ({
            id: r.id,
            title: r.title,
            date: r.date,
            photos: r.photos ? r.photos.split(',') : []
        }));

    const albumsDiary = rows
        .filter(r => r.type === 'diary')
        .map(r => ({
            id: r.id,
            title: r.title,
            when: r.date,
            author: r.user_name,
            content: r.content

        }));

    const albumsTimeline = rows
        .filter(r => r.type === 'timeline')
        .map(r => ({
            id: r.id,
            title: r.title,
            date: r.date,
            author: r.user_name,
            note: r.content

        }));
    res.render("memories/index", { albumsData, albumsDiary, albumsTimeline, coupleInfo });
};

exports.createMemory = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;
        const userName = req.session.user.name;
        const { type, title, content, date_time } = req.body;

        const [result] = await db.query(
            `INSERT INTO memories (title, content, type,user_name ,date_time, couple_id)
             VALUES (?, ?, ?, ?, ?, ?)`, [title, content, type, userName, date_time, coupleId]
        );

        const memoryId = result.insertId;

        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                const fileType = file.mimetype.startsWith("video") ? "video" : "image";

                await db.query(
                    `INSERT INTO image_memories (memory_id, file_path, file_type)
                     VALUES (?, ?, ?)`, [memoryId, file.filename, fileType]
                );
            }
        }

        const userCode = req.session.user.code;
        const coupleInfo = await coupleService.getCoupleInfo(userCode);
        const user1 = coupleInfo.user1_id;
        const user2 = coupleInfo.user2_id;
        const currentUser = req.session.user.id;
        const partnerId = currentUser === user1 ? user2 : user1;
        const now = new Date();
        const day = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);
        const datetime = `${day} ${time}:00`;
        const notifTitle = "Người Ấy vừa tạo kỉ niệm mới 💕";
        const notifContent = `${userName} đã tạo kỉ niệm "${title}" vào ${day} lúc ${time}`;
        const notifLink = "/memories";

        const [notifResult] = await db.query(
            `INSERT INTO notifications (user_id, sender_id, type, title, content, link, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`, [partnerId, currentUser, 'new_memories', notifTitle, notifContent, notifLink]
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
                type: 'new_memories',
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
            message: "Đã tạo kỷ niệm!",
            memory_id: memoryId
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

exports.createDiary = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;
        const userName = req.session.user.name;
        const { title, content, date_time } = req.body;

        await db.query(
            `INSERT INTO memories (title, content, type,user_name, date_time, couple_id)
             VALUES (?, ?, ?, ?, ?,?)`, [title, content, 'diary', userName, date_time, coupleId]
        );

        const userCode = req.session.user.code;
        const coupleInfo = await coupleService.getCoupleInfo(userCode);
        const user1 = coupleInfo.user1_id;
        const user2 = coupleInfo.user2_id;
        const currentUser = req.session.user.id;
        const partnerId = currentUser === user1 ? user2 : user1;
        const now = new Date();
        const day = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);
        const datetime = `${day} ${time}:00`;
        const notifTitle = "Người Ấy vừa viết nhật kí mới vào xem nhé 💕";
        const notifContent = `${userName} đã tạo nhật kí "${title}" vào ${day} lúc ${time}`;
        const notifLink = "/memories";

        const [notifResult] = await db.query(
            `INSERT INTO notifications (user_id, sender_id, type, title, content, link, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`, [partnerId, currentUser, 'new_diary', notifTitle, notifContent, notifLink]
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
                type: 'new_diary',
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
            message: "Đã tạo nhật kí!"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};