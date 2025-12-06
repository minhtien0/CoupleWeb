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

        // Insert memory
        const [result] = await db.query(
            `INSERT INTO memories (title, content, type,user_name ,date_time, couple_id)
             VALUES (?, ?, ?, ?, ?, ?)`, [title, content, type, userName, date_time, coupleId]
        );

        const memoryId = result.insertId;

        // Nếu có file upload → lưu vào image_memories
        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                const fileType = file.mimetype.startsWith("video") ? "video" : "image";

                await db.query(
                    `INSERT INTO image_memories (memory_id, file_path, file_type)
                     VALUES (?, ?, ?)`, [memoryId, file.filename, fileType]
                );
            }
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

        // Insert memory
        await db.query(
            `INSERT INTO memories (title, content, type,user_name, date_time, couple_id)
             VALUES (?, ?, ?, ?, ?,?)`, [title, content, 'diary', userName, date_time, coupleId]
        );

        res.json({
            success: true,
            message: "Đã tạo nhật kí!"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};