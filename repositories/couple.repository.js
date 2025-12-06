const db = require('../config/db');

class CoupleRepository {
    async getCoupleInfoByUserCode(userCode) {
        const [rows] = await db.query(
            `
            SELECT 
                c.*, 
                c.started_at AS started_at_couple,
                u1.name AS user1_name, u1.code AS user1_code, u1.id AS user1_id, 
                u2.name AS user2_name, u2.code AS user2_code, u2.id AS user2_id, 
                u1.gender AS user1_gender, u2.gender AS user2_gender
            FROM couples c
            JOIN users u1 ON u1.code = c.user1_code
            JOIN users u2 ON u2.code = c.user2_code
            WHERE (c.user1_code = ? OR c.user2_code = ?) 
                AND c.status = 1
            LIMIT 1
            `, [userCode, userCode]
        );

        return rows[0] ? rows[0] : null;
    }
}

module.exports = new CoupleRepository();