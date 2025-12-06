const db = require('../config/db');

// Lấy thông tin cặp đôi + dữ liệu love language
async function getLoveLanguages(coupleId, coupleInfo, sessionUserCode) {
    const [rows] = await db.query(
        "SELECT * FROM love_languages WHERE couple_id = ?", [coupleId]
    );

    const user1 = rows.find(r => r.user_code === coupleInfo.user1_code);
    const user2 = rows.find(r => r.user_code === coupleInfo.user2_code);

    const hasDoneTest = rows.some(r => r.user_code === sessionUserCode);

    return { user1, user2, hasDoneTest };
}

// Tính trung bình 4 nhóm Love Language cho biểu đồ %
function calculateLoveAvg(user1, user2) {
    return {
        quality_time: ((user1.quality_time + user2.quality_time) / 2) * 33.33,
        acts_of_service: ((user1.acts_of_service + user2.acts_of_service) / 2) * 33.33,
        words_of_affirmation: ((user1.words_of_affirmation + user2.words_of_affirmation) / 2) * 33.33,
        physical_touch: ((user1.physical_touch + user2.physical_touch) / 2) * 33.33
    };
}

// Tính độ hợp nhau
function calculateCompatibility(user1, user2) {
    const diff =
        Math.abs(user1.quality_time - user2.quality_time) +
        Math.abs(user1.acts_of_service - user2.acts_of_service) +
        Math.abs(user1.words_of_affirmation - user2.words_of_affirmation) +
        Math.abs(user1.physical_touch - user2.physical_touch);

    return Math.round(100 - (diff / 12) * 100);
}

// Format ngày YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
}

// Lấy danh sách goals + tính % + ngày còn lại
async function getGoals(coupleId) {
    const [goals] = await db.query(
        `SELECT * FROM goal WHERE couple_id = ? ORDER BY created_at DESC`, [coupleId]
    );

    goals.forEach(goal => {
        goal.percent = Math.floor((goal.current_value / goal.target_value) * 100);
        goal.days_remaining = goal.end_date ?
            Math.ceil((new Date(goal.end_date) - new Date()) / (1000 * 60 * 60 * 24)) :
            null;
        goal.start = formatDate(goal.start_date);
        goal.end = formatDate(goal.end_date);
    });

    return goals;
}

async function getMilestones(coupleId) {
    const [rows] = await db.query(
        `SELECT *, 
                    DATEDIFF(CURDATE(), event_date) AS days_passed
             FROM milestones
             WHERE couple_id = ?
             ORDER BY event_date DESC`, [coupleId]
    );
    return rows;
}

module.exports = {
    getLoveLanguages,
    calculateLoveAvg,
    calculateCompatibility,
    getGoals,
    getMilestones,
};