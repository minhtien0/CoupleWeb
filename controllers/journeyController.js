const exampleModel = require('../models/Model');
const coupleService = require('../services/couple.service');
const journeyService = require("../services/journey.service");
const db = require('../config/db');
exports.Index = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;
        const userCode = req.session.user.code;

        // Lấy thông tin cơ bản
        const coupleInfo = await coupleService.getCoupleInfo(userCode);

        // Lấy dữ liệu Love Languages của cả 2
        const { user1, user2, hasDoneTest } =
        await journeyService.getLoveLanguages(coupleId, coupleInfo, userCode);

        // Nếu 1 trong 2 người chưa làm test → render sớm
        if (!user1 || !user2) {
            return res.render("journey/index", {
                compatibility: null,
                user1: user1 || null,
                user2: user2 || null,
            });
        }

        // Tính dữ liệu biểu đồ
        const loveAvg = journeyService.calculateLoveAvg(user1, user2);
        const compatibility = journeyService.calculateCompatibility(user1, user2);

        // Goals
        const goals = await journeyService.getGoals(coupleId);

        //Milestone 
        const milestones = await journeyService.getMilestones(coupleId);
        res.render("journey/index", {
            compatibility,
            coupleInfo,
            hasDoneTest,
            loveAvg,
            goals,
            user1,
            user2,
            milestones,
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi server");
    }
};


exports.saveLoveLanguage = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;
        const userCode = req.session.user.code;

        const {
            quality_time,
            acts_of_service,
            words_of_affirmation,
            physical_touch
        } = req.body;

        await db.query(
            `INSERT INTO love_languages (couple_id, user_code, quality_time, acts_of_service, words_of_affirmation, physical_touch)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                quality_time = VALUES(quality_time),
                acts_of_service = VALUES(acts_of_service),
                words_of_affirmation = VALUES(words_of_affirmation),
                physical_touch = VALUES(physical_touch)`, [
                coupleId,
                userCode,
                quality_time,
                acts_of_service,
                words_of_affirmation,
                physical_touch
            ]
        );

        res.json({ message: "Đã lưu bài test thành công!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi server" });
    }
};

exports.updateLoveLanguage = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;
        const userCode = req.session.user.code;

        const {
            quality_time,
            acts_of_service,
            words_of_affirmation,
            physical_touch
        } = req.body;

        await db.query(
            `UPDATE love_languages
             SET quality_time = ?, acts_of_service = ?, words_of_affirmation = ?, physical_touch = ?
             WHERE couple_id = ? AND user_code = ?`, [
                quality_time,
                acts_of_service,
                words_of_affirmation,
                physical_touch,
                coupleId,
                userCode
            ]
        );

        res.json({ message: "Đã cập nhật kết quả thành công!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi server" });
    }
};

exports.createGoal = async(req, res) => {
    try {
        const coupleId = req.session.couple.id;
        const { title, description, icon, target_value, start_date, end_date } = req.body;

        if (!title || !target_value) {
            return res
                .status(400)
                .json({ error: "Vui lòng nhập tên mục tiêu và giá trị mục tiêu" });
        }

        await db.query(
            `INSERT INTO goal 
            (couple_id, title, description, icon, target_value, start_date, end_date, current_value, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Đang Thực Hiện', NOW())`, [coupleId, title, description, icon, target_value, start_date, end_date]
        );

        return res.json({
            message: "Tạo mục tiêu thành công!"
        });

    } catch (error) {
        console.error("Create Goal Error:", error);
        return res.status(500).json({ error: "Lỗi server!" });
    }
};

exports.getGoalDetail = async(req, res) => {
    const goalId = req.params.id;

    const [
        [goal]
    ] = await db.query(
        `SELECT *, 
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date
        FROM goal WHERE id = ?`, [goalId]
    );

    const [logs] = await db.query(
        `SELECT *, DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') as time 
         FROM goal_logs WHERE goal_id = ? ORDER BY created_at DESC`, [goalId]
    );

    res.json({
        success: true,
        goal,
        logs
    });
}

exports.checkinGoal = async(req, res) => {
    const { goal_id, note } = req.body;
    const image = req.file ? req.file.filename : null;
    const [
        [exists]
    ] = await db.query(
        `SELECT id FROM goal_logs 
         WHERE goal_id = ? 
         AND DATE(created_at) = CURDATE() 
         LIMIT 1`, [goal_id]
    );

    if (exists) {
        return res.json({
            success: false,
            message: "Hôm nay bạn đã điểm danh rồi!"
        });
    }
    // 1. Update goals.current_value
    await db.query(
        `UPDATE goal SET current_value = current_value + 1 WHERE id = ?`, [goal_id]
    );

    // 2. Insert log
    await db.query(
        `INSERT INTO goal_logs (goal_id, value, note, image) VALUES (?, 1, ?, ?)`, [goal_id, note || "", image]
    );
    res.json({ success: true });
};

exports.createMilestone = async(req, res) => {
    try {
        const { title, description, location, event_date } = req.body;

        if (!title || !event_date) {
            return res.json({ success: false, message: "Thiếu thông tin!" });
        }

        const coupleId = req.session.couple.id;

        await db.query(
            `INSERT INTO milestones (couple_id, title, description, location, event_date)
             VALUES (?, ?, ?, ?, ?)`, [coupleId, title, description, location, event_date]
        );

        return res.json({ success: true });

    } catch (error) {
        console.error(error);
        return res.json({ success: false, message: "Server error" });
    }
};