const db = require('../config/db');
const bcrypt = require('bcrypt');
exports.Index = async(req, res) => {
    const coupleId = req.session.couple.id;
    const [infoCoupleResult] = await db.query(
        `
        SELECT 
            c.*, 
            c.started_at AS started_at_couple,
            u1.name AS user1_name, u1.code AS user1_code, 
            u2.name AS user2_name, u2.code AS user2_code
        FROM couples c
        JOIN users u1 ON u1.code = c.user1_code
        JOIN users u2 ON u2.code = c.user2_code
        WHERE (c.user1_code = ? OR c.user2_code = ?) 
            AND c.status = 1
        LIMIT 1
  `, [req.session.user.code, req.session.user.code]
    );

    const [listDateTomorrow] = await db.query(
        `SELECT * FROM date WHERE couple_id = ? AND DATE(time) > CURDATE() AND status = 1 ORDER BY time DESC LIMIT 3`, [coupleId]
    );
    const infoCouple = infoCoupleResult[0] || null;
    res.render('index', { infoCouple, listDateTomorrow });
};


exports.checkin = async(req, res) => {
    const coupleId = req.session.couple.id;
    const userId = req.session.user.id;

    function getTodayVN() {
        const now = new Date();
        now.setHours(now.getHours() + 7);
        return now.toISOString().slice(0, 10);
    }

    function toYMDVN(date) {
        const d = new Date(date);
        d.setHours(d.getHours() + 7); // chuyển sang UTC+7
        return d.toISOString().slice(0, 10);
    }

    const today = getTodayVN();

    try {
        const [coupleRows] = await db.query(
            "SELECT current_streak, max_streak, last_checkin_date FROM couples WHERE id = ?", [coupleId]
        );

        if (coupleRows.length === 0) {
            return res.status(404).json({ error: "Couple not found" });
        }

        const couple = coupleRows[0];

        const lastDate = couple.last_checkin_date ?
            toYMDVN(couple.last_checkin_date) :
            null;


        if (lastDate === today) {
            return res.status(400).json({ error: "Hôm nay đã check-in rồi!" });
        }
        console.log("⚠️ Last and today: ", lastDate, today);
        let newStreak = 1;

        if (lastDate) {
            const diffDays = (new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
                newStreak = couple.current_streak + 1;
            }
        }

        const newMaxStreak = Math.max(newStreak, couple.max_streak);

        await db.query(
            "INSERT INTO checkins (couple_id, checkin_date, checkin_by, created_at) VALUES (?, ?, ?, NOW())", [coupleId, today, userId]
        );

        await db.query(
            "UPDATE couples SET current_streak = ?, max_streak = ?, last_checkin_date = ? WHERE id = ?", [newStreak, newMaxStreak, today, coupleId]
        );

        res.json({
            message: "Check-in thành công!",
            current_streak: newStreak,
            max_streak: newMaxStreak
        });

    } catch (error) {
        console.error("Checkin error:", error);
        res.status(500).json({ error: "Server error" });
    }
};