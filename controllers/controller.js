const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.getHome = (req, res) => {
    res.render('index'); // Render view
};

exports.Login = (req, res) => {
    res.render('login'); // Render view 
};

//Đăng nhập
exports.postLogin = async(req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Kiểm tra không bỏ trống
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ email và mật khẩu!" });
        }

        // 2. Kiểm tra email hợp lệ
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Email không hợp lệ!" });
        }

        // 3. Kiểm tra tài khoản tồn tại
        const [user] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (user.length === 0) {
            return res.status(400).json({ success: false, message: "Email không tồn tại!" });
        }

        // 4. So sánh password hash
        const match = await bcrypt.compare(password, user[0].password);
        if (!match) {
            return res.status(400).json({ success: false, message: "Mật khẩu không đúng!" });
        }

        const userId = user[0].code;

        // 5. Kiểm tra couple
        const [couple] = await db.query(
            'SELECT * FROM couples WHERE (user1_code = ? OR user2_code = ?) AND status = 1 LIMIT 1', [userId, userId]
        );
        // Lưu thông tin user vào session
        req.session.user = {
            id: user[0].id,
            name: user[0].name,
            email: user[0].email,
            code: user[0].code
        };

        if (couple.length > 0) {
            req.session.couple = {
                id: couple[0].id,
                user1_code: couple[0].user1_code,
                user2_code: couple[0].user2_code,
                status: couple[0].status
            };
            console.log("💖 Session couple đã tạo:", req.session.couple);
        } else {
            req.session.couple = null;
            console.log("⚠️ User chưa có couple.");
        }

        // Đăng nhập thành công - Có thể lưu session hoặc trả token (ở đây trả JSON đơn giản)
        // 7. Quyết định redirect
        if (couple.length === 0) {
            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công, chưa có couple!",
                redirect: "/matching",
                user: {
                    id: user[0].id,
                    name: user[0].name,
                    email: user[0].email
                }
            });
        } else {
            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công!",
                redirect: "/home",
                user: {
                    id: user[0].id,
                    name: user[0].name,
                    email: user[0].email
                }
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Đã xảy ra lỗi khi đăng nhập!" });
    }
};

//Đăng kí
exports.postRegister = async(req, res) => {
    try {
        const { displayName, birthday, gender, email, password } = req.body;

        // 1. Kiểm tra không bỏ trống
        if (!displayName || !birthday || !gender || !email || !password) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
        }

        // 2. Kiểm tra email hợp lệ
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Email không hợp lệ!" });
        }

        // 3. Kiểm tra mật khẩu: >=6 ký tự, có ít nhất 1 ký tự đặc biệt
        const passwordRegex = /^(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu phải từ 6 ký tự và chứa ít nhất 1 ký tự đặc biệt!"
            });
        }

        // 4. Kiểm tra ngày sinh < ngày hiện tại
        const birthDate = new Date(birthday);
        const today = new Date();
        if (isNaN(birthDate.getTime()) || birthDate >= today) {
            return res.status(400).json({ success: false, message: "Ngày sinh không hợp lệ!" });
        }

        // 5. Kiểm tra email đã tồn tại chưa
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: "Email đã tồn tại!" });
        }

        // 6. Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        let code;
        let exists = true;

        while (exists) {
            const random = Math.floor(1000 + Math.random() * 9000); // số ngẫu nhiên từ 1000-9999
            code = `LOVE${random}`;

            const [rows] = await db.query('SELECT id FROM users WHERE code = ?', [code]);
            exists = rows.length > 0;
        }
        // 7. Thêm user vào DB
        await db.query(
            'INSERT INTO users (name, age, gender, email, password,code) VALUES (?, ?, ?, ?, ?, ?)', [displayName, birthday, gender, email, hashedPassword, code]
        );

        return res.status(201).json({ success: true, message: "Đăng ký thành công!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Đã xảy ra lỗi khi đăng ký!" });
    }
};

//Đăng Xuất 
exports.Logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: "Lỗi khi đăng xuất!" });
        }
        res.redirect('/'); // Quay lại trang chính sau khi logout
    });
};

//Moi ghep noi
exports.inviteConnect = async(req, res) => {
    try {
        const { couple_code } = req.body; // Lấy mã từ client (AJAX)
        const id_current = req.session.user; // Lấy id user hiện tại
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id_current.id]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "Vui lòng đăng nhập!" });
        }
        const user = users[0];

        if (user.code === couple_code.toUpperCase()) {
            return res.status(400).json({ success: false, message: "Bạn không thể nhập mã của chính mình!" });
        }

        if (!couple_code || couple_code.length !== 8) {
            return res.status(400).json({ success: false, message: "Mã couple phải là 8 ký tự!" });
        }
        // 0. Kiểm tra mã couple có tồn tại hay không

        const [existingCodeCouples] = await db.query(
            'SELECT id FROM users WHERE code = ? LIMIT 1', [couple_code]
        );
        if (existingCodeCouples.length === 0) {
            return res.status(400).json({ success: false, message: "Mã code không tồn tại!" });
        }

        // 1. Kiểm tra mã couple đã tồn tại và status = 1
        const [existingCouples] = await db.query(
            'SELECT *  FROM couples WHERE status = 1 AND(user1_code = ? OR user2_code = ? )', [couple_code, couple_code]
        );
        if (existingCouples.length > 0) {
            return res.status(400).json({ success: false, message: "Người dùng này đã có couples!" });
        }

        // 2. Kiểm tra xem user đã có couple nào với status = 1 chưa
        const [userCouples] = await db.query(
            'SELECT *  FROM couples WHERE status = 1 AND(user1_code = ? OR user2_code = ? )', [user.code, user.code]
        );
        if (userCouples.length > 0) {
            return res.status(400).json({ success: false, message: "Bạn đã có couple, không thể tham gia thêm!" });
        }

        // 3. Kiểm tra đã gửi lời mời (status = 0) hay chưa
        const [pendingCouple] = await db.query(
            'SELECT id FROM couples WHERE status = 0 AND user1_code = ? AND user2_code = ? LIMIT 1', [user.code, couple_code.toUpperCase()]
        );
        if (pendingCouple.length > 0) {
            return res.status(400).json({ success: false, message: "Bạn đã gửi mã couple này, vui lòng chờ xác nhận!" });
        }


        // 4. Thêm couple mới với status = 0
        await db.query(
            'INSERT INTO couples (user1_code, user2_code, status) VALUES (?, ?, ?)', [user.code, couple_code.toUpperCase(), 0]
        );

        return res.status(200).json({ success: true, message: "Mã couple đã được gửi, chờ người yêu xác nhận!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Đã xảy ra lỗi khi gửi mã couple!" });
    }
};
//Lấy dữ liệu ở matching
exports.getMatching = async(req, res) => {
    try {
        const user = req.session.user;
        if (!user || !user.code) {
            console.log('Chặn truy cập: chưa login, path =', req.path);
            return res.redirect('/');
        }

        // Query cho tab "Received" (lời mời nhận được)
        const [tobeinvitedResult] = await db.query(
            `
            SELECT u.*, c.started_at, c.id AS couples_id
            FROM users u
            JOIN couples c ON u.code = c.user1_code
            WHERE c.status = 0 AND c.user2_code = ?
            `, [user.code]
        );

        // Query cho tab "Sent" (lời mời đã gửi)
        const [invitedResult] = await db.query(
            `
            SELECT u.*, c.started_at, c.id AS couples_id,c.status   
            FROM users u
            JOIN couples c ON u.code = c.user2_code
            WHERE c.status = 0 OR c.status = 2 AND c.user1_code = ?
            `, [user.code]
        );
        //Random User Matching
        const [randomUsersResult] = await db.query(`
            SELECT u.*
            FROM users u
            LEFT JOIN couples c 
                ON (u.code = c.user1_code OR u.code = c.user2_code)
            WHERE u.id != ? 
            AND (c.status IS NULL OR c.status != 1)
            ORDER BY RAND()
            LIMIT 10
        `, [user.id]);

        const [listFavoriteResult] = await db.query(`
            SELECT u.*
            FROM users u
            LEFT JOIN list_favorites f 
                ON (u.id = f.user_favorite)
            WHERE f.user = ?
        `, [user.id]);
        // Correct: tobeinvitedResult is already the rows array
        const tobeinvited = tobeinvitedResult || [];
        const invited = invitedResult || [];
        const randomUsers = randomUsersResult || [];
        const listFavorite = listFavoriteResult || [];
        res.render('matching', {
            tobeinvited,
            invited,
            randomUsers,
            listFavorite
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Lỗi khi lấy dữ liệu matching!");
    }
};

exports.sendInvite = async(req, res) => {
    try {
        const user1 = req.session.user.id; // người gửi lời mời
        const user1_code = req.session.user.code;

        const { user2_id } = req.body;
        if (!user2_id) {
            return res.json({ success: false, message: "Thiếu user2_id!" });
        }

        // Lấy user2_code từ DB
        const [rows] = await db.query(
            "SELECT code FROM users WHERE id = ? LIMIT 1", [user2_id]
        );

        if (!rows.length) {
            return res.json({ success: false, message: "User không tồn tại!" });
        }

        const user2_code = rows[0].code;

        // Kiểm tra đã tồn tại lời mời 2 chiều chưa
        const [exist] = await db.query(`
                    SELECT id FROM couples WHERE(user1_code = ? AND user2_code = ? ) OR(user1_code = ? AND user2_code = ? ) LIMIT 1 `, [user1_code, user2_code, user2_code, user1_code]);

        if (exist.length > 0) {
            return res.json({
                success: false,
                message: "Hai bạn đã có lời mời hoặc đã thành đôi!",
            });
        }

        // Tạo lời mời mới
        await db.query(`
                    INSERT INTO couples(user1_code, user2_code, status, started_at) VALUES( ? , ? , 0, NOW())
                    `, [user1_code, user2_code]);

        return res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Lỗi server!" });
    }
};

exports.addFavorite = async(req, res) => {
    try {
        const user = req.session.user.id;
        const user_favorite = req.body.user_favorite;

        if (!user_favorite) {
            return res.json({ success: false, message: "Thiếu user_favorite!" });
        }

        // Kiểm tra đã tồn tại để tránh duplicate
        const [exists] = await db.query(
            `
                    SELECT id FROM list_favorites WHERE user = ? AND user_favorite = ? LIMIT 1 `, [user, user_favorite]
        );

        if (exists.length > 0) {
            return res.json({
                success: false,
                message: "Bạn đã thích người này trước đó!"
            });
        }

        // Thêm mới
        await db.query(
            `
                    INSERT INTO list_favorites(user, user_favorite, created_at) VALUES( ? , ? , UNIX_TIMESTAMP())
                    `, [user, user_favorite]
        );

        return res.json({
            success: true,
            message: "Đã thêm vào danh sách yêu thích!"
        });

    } catch (err) {
        console.error("Lỗi addFavorite:", err);
        res.json({ success: false, message: "Lỗi server!" });
    }
};


exports.rejectInvite = async(req, res) => {
    try {
        const couples_id = req.params.couples_id;
        console.log('Id couple nhận được:', couples_id);
        // Lấy yêu cầu kết nối
        const [rows] = await db.query(
            `
                    SELECT * FROM couples WHERE id = ? LIMIT 1 `, [couples_id]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Không tìm thấy yêu cầu kết nối"
            });
        }

        const couple = rows[0];
        const userCode = req.session.user.code;
        // Kiểm tra quyền: User phải là user1 hoặc user2 của couple
        if (couple.user1_code !== userCode && couple.user2_code !== userCode) {
            return res.status(403).json({
                status: "error",
                message: "Bạn không có quyền từ chối yêu cầu kết nối này!"
            });
        }

        // Cập nhật status = 2 (từ chối)
        await db.query(
            `
                    UPDATE couples SET status = 2 WHERE id = ? `, [couples_id]
        );

        return res.json({
            status: "success",
            message: "Đã từ chối lời mời"
        });

    } catch (err) {
        console.error(err);
        res.json({ status: "error", message: "Lỗi server!" });
    }
};

exports.cancelInvite = async(req, res) => {
    try {
        const id = req.params.id;

        // Kiểm tra tồn tại
        const [rows] = await db.query(
            `
                    SELECT * FROM couples WHERE id = ? LIMIT 1 `, [id]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Lời mời không tồn tại!"
            });
        }

        const couple = rows[0];
        const userCode = req.session.user.code;
        // Kiểm tra quyền: User phải là user1 hoặc user2 của couple
        if (couple.user1_code !== userCode && couple.user2_code !== userCode) {
            return res.status(403).json({
                status: "error",
                message: "Bạn không có quyền từ chối yêu cầu kết nối này!"
            });
        }

        // Xóa lời mời
        await db.query(
            `
                    DELETE FROM couples WHERE id = ? `, [id]
        );

        return res.json({
            status: "success",
            message: "Đã hủy lời mời!"
        });

    } catch (err) {
        console.error(err);
        res.json({ status: "error", message: "Lỗi server!" });
    }
};