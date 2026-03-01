const db = require('../config/db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const transporter = require('../config/email');
const { getVerificationEmailHTML } = require('../views/emailTemplate');
const { userSockets, io } = require("../app");

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

        if (couple.length === 0) {
            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công, chưa có couple!",
                redirect: "/matching",
                user: {
                    id: user[0].id,
                    name: user[0].name,
                    email: user[0].email,
                    code: user[0].code
                },
            });
        } else {
            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công!",
                redirect: "/home",
                user: {
                    id: user[0].id,
                    name: user[0].name,
                    email: user[0].email,
                    code: user[0].code
                },
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
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin!"
            });
        }

        // 2. Kiểm tra email hợp lệ
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Email không hợp lệ!"
            });
        }

        // 3. Kiểm tra mật khẩu
        const passwordRegex = /^(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu phải từ 6 ký tự và chứa ít nhất 1 ký tự đặc biệt!"
            });
        }

        // 4. Kiểm tra ngày sinh
        const birthDate = new Date(birthday);
        const today = new Date();
        if (isNaN(birthDate.getTime()) || birthDate >= today) {
            return res.status(400).json({
                success: false,
                message: "Ngày sinh không hợp lệ!"
            });
        }

        // 5. Kiểm tra email đang chờ xác nhận (trong pending_verifications)
        const [pendingCheck] = await db.query(
            'SELECT * FROM pending_verifications WHERE email = ? AND expires_at > NOW()', [email]
        );

        if (pendingCheck.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email này đang chờ xác nhận. Vui lòng kiểm tra hộp thư hoặc đợi hết thời gian để đăng ký lại!"
            });
        }

        // 6. Kiểm tra email đã tồn tại trong users (đã xác thực)
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email đã tồn tại!"
            });
        }

        // 7. Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 8. Tạo code unique
        let code;
        let exists = true;
        while (exists) {
            const random = Math.floor(1000 + Math.random() * 9000);
            code = `LOVE${random}`;
            const [rows] = await db.query('SELECT id FROM users WHERE code = ?', [code]);
            exists = rows.length > 0;
        }

        // 9. Tạo slug
        const baseName = displayName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "");

        let slug = `@${baseName}`;
        let counter = 0;
        let isDuplicate = true;

        while (isDuplicate) {
            const checkSlug = counter === 0 ? slug : `@${baseName}${counter}`;
            const [rows] = await db.query("SELECT id FROM users WHERE slug = ?", [checkSlug]);

            if (rows.length === 0) {
                slug = checkSlug;
                isDuplicate = false;
            } else {
                counter++;
            }
        }

        // 10. Tạo token ngẫu nhiên (giống Laravel Str::random(40))
        const token = crypto.randomBytes(20).toString('hex'); // 40 ký tự hex

        // 11. Chuẩn bị dữ liệu user
        const userData = {
            displayName,
            birthday,
            gender,
            email,
            hashedPassword,
            code,
            slug
        };

        // 12. Lưu vào pending_verifications (hết hạn sau 60 giây)
        const expiresAt = new Date(Date.now() + 60000); // 60 seconds

        // Xóa pending cũ của email này (nếu có)
        await db.query('DELETE FROM pending_verifications WHERE email = ?', [email]);

        // Insert mới
        await db.query(
            'INSERT INTO pending_verifications (email, token, user_data, expires_at) VALUES (?, ?, ?, ?)', [email, token, JSON.stringify(userData), expiresAt]
        );

        console.log('✅ Token đã tạo:', token);
        console.log('✅ Đã lưu vào pending_verifications cho email:', email);

        // 13. Tạo link xác nhận
        const verificationLink = `${process.env.APP_URL || 'https://mycouple.site'}/auth/verify-email/${token}`;

        // 14. Gửi email
        const mailOptions = {
            from: {
                name: '💕 Couple Vibe',
                address: process.env.GMAIL_USER
            },
            to: email,
            subject: '💗 Xác nhận đăng ký tài khoản - Couple Vibe',
            html: getVerificationEmailHTML(verificationLink, displayName)
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            success: true,
            message: "Vui lòng kiểm tra email để xác nhận đăng ký. Link xác nhận có hiệu lực trong 60 giây!"
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: "Đã xảy ra lỗi khi đăng ký!"
        });
    }
};

exports.verifyEmail = async(req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { 
                            font-family: Arial; 
                            text-align: center; 
                            padding: 50px;
                            background: linear-gradient(135deg, #FFB6C1, #FFC0CB);
                        }
                        .error { 
                            background: white; 
                            padding: 40px; 
                            border-radius: 20px;
                            max-width: 500px;
                            margin: 0 auto;
                            box-shadow: 0 10px 40px rgba(255, 105, 180, 0.3);
                        }
                        h1 { color: #FF1493; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>❌ Lỗi</h1>
                        <p>Token xác nhận không hợp lệ!</p>
                    </div>
                </body>
                </html>
            `);
        }

        const [rows] = await db.query(
            'SELECT * FROM pending_verifications WHERE token = ? AND expires_at > NOW()', [token]
        );


        if (rows.length === 0) {
            const [expiredRows] = await db.query(
                'SELECT * FROM pending_verifications WHERE token = ?', [token]
            );

            if (expiredRows.length > 0) {
                await db.query('DELETE FROM pending_verifications WHERE token = ?', [token]);

                return res.status(400).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { 
                                font-family: Arial; 
                                text-align: center; 
                                padding: 50px;
                                background: linear-gradient(135deg, #FFB6C1, #FFC0CB);
                            }
                            .error { 
                                background: white; 
                                padding: 40px; 
                                border-radius: 20px;
                                max-width: 500px;
                                margin: 0 auto;
                                box-shadow: 0 10px 40px rgba(255, 105, 180, 0.3);
                            }
                            h1 { color: #FF1493; }
                        </style>
                    </head>
                    <body>
                        <div class="error">
                            <h1>⏰ Hết hạn</h1>
                            <p>Link xác nhận đã hết hạn (quá 60 giây)!</p>
                            <p>Vui lòng đăng ký lại.</p>
                        </div>
                    </body>
                    </html>
                `);
            }

            // Token không tồn tại hoặc đã được sử dụng
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { 
                            font-family: Arial; 
                            text-align: center; 
                            padding: 50px;
                            background: linear-gradient(135deg, #FFB6C1, #FFC0CB);
                        }
                        .error { 
                            background: white; 
                            padding: 40px; 
                            border-radius: 20px;
                            max-width: 500px;
                            margin: 0 auto;
                            box-shadow: 0 10px 40px rgba(255, 105, 180, 0.3);
                        }
                        h1 { color: #FF1493; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>❌ Lỗi</h1>
                        <p>Link xác nhận không hợp lệ hoặc đã được sử dụng!</p>
                    </div>
                </body>
                </html>
            `);
        }

        // Lấy dữ liệu user
        const userData = JSON.parse(rows[0].user_data);

        console.log('✅ Dữ liệu user:', userData.email);

        // Tạo user trong database
        await db.query(
            'INSERT INTO users (name, age, gender, email, password, code, slug) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                userData.displayName,
                userData.birthday,
                userData.gender,
                userData.email,
                userData.hashedPassword,
                userData.code,
                userData.slug
            ]
        );

        console.log('✅ Đã tạo user thành công:', userData.email);

        // Xóa khỏi pending_verifications
        await db.query('DELETE FROM pending_verifications WHERE token = ?', [token]);

        console.log('✅ Đã xóa khỏi pending_verifications');

        // Trả về trang thành công
        return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        font-family: Arial; 
                        text-align: center; 
                        padding: 50px;
                        background: linear-gradient(135deg, #FFB6C1, #FFC0CB);
                    }
                    .success { 
                        background: white; 
                        padding: 40px; 
                        border-radius: 20px;
                        max-width: 500px;
                        margin: 0 auto;
                        box-shadow: 0 10px 40px rgba(255, 105, 180, 0.3);
                    }
                    h1 { color: #FF69B4; }
                    .heart { font-size: 60px; animation: heartbeat 1.5s infinite; }
                    @keyframes heartbeat {
                        0%, 100% { transform: scale(1); }
                        25% { transform: scale(1.1); }
                    }
                </style>
                <script>
                    // Tự động đóng tab sau 3 giây
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                </script>
            </head>
            <body>
                <div class="success">
                    <div class="heart">💕</div>
                    <h1>Xác nhận thành công!</h1>
                    <p>Tài khoản của bạn đã được kích hoạt.</p>
                    <p>Tab này sẽ tự động đóng sau 3 giây...</p>
                    <p style="font-size: 12px; color: #999;">Quay lại trang đăng ký để tiếp tục</p>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        font-family: Arial; 
                        text-align: center; 
                        padding: 50px;
                        background: linear-gradient(135deg, #FFB6C1, #FFC0CB);
                    }
                    .error { 
                        background: white; 
                        padding: 40px; 
                        border-radius: 20px;
                        max-width: 500px;
                        margin: 0 auto;
                        box-shadow: 0 10px 40px rgba(255, 105, 180, 0.3);
                    }
                    h1 { color: #FF1493; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>❌ Lỗi hệ thống</h1>
                    <p>Đã xảy ra lỗi khi xác nhận tài khoản!</p>
                </div>
            </body>
            </html>
        `);
    }
};

// API kiểm tra xác thực
exports.checkVerification = async(req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ verified: false });
        }

        // Kiểm tra trong database
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

        if (users.length > 0) {
            console.log('✅ Email đã được xác thực:', email);
            return res.json({ verified: true });
        }

        return res.json({ verified: false });

    } catch (error) {
        console.error('Check verification error:', error);
        res.status(500).json({ verified: false });
    }
};

// API gửi lại email xác nhận
exports.resendVerification = async(req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email không hợp lệ!"
            });
        }

        // Kiểm tra email đã tồn tại trong users chưa
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email này đã được xác nhận!"
            });
        }

        // Lấy thông tin pending user từ database
        const [pendingRows] = await db.query(
            'SELECT * FROM pending_verifications WHERE email = ?', [email]
        );

        if (pendingRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Không tìm thấy thông tin đăng ký. Vui lòng đăng ký lại!"
            });
        }

        const userData = JSON.parse(pendingRows[0].user_data);

        // Tạo token mới
        const newToken = crypto.randomBytes(20).toString('hex');
        const expiresAt = new Date(Date.now() + 60000); // 60 seconds

        // Cập nhật token và thời gian hết hạn
        await db.query(
            'UPDATE pending_verifications SET token = ?, expires_at = ? WHERE email = ?', [newToken, expiresAt, email]
        );

        // Gửi email
        const verificationLink = `${process.env.APP_URL || 'https://mycouple.site'}/auth/verify-email/${newToken}`;

        const mailOptions = {
            from: {
                name: '💕 Couple Vibe',
                address: process.env.GMAIL_USER
            },
            to: email,
            subject: '💗 Xác nhận đăng ký tài khoản - Couple Vibe',
            html: getVerificationEmailHTML(verificationLink, userData.displayName)
        };

        await transporter.sendMail(mailOptions);

        return res.json({
            success: true,
            message: "Email xác nhận đã được gửi lại!"
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: "Có lỗi xảy ra!"
        });
    }
};


//Đăng Xuất 
exports.Logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: "Lỗi khi đăng xuất!" });
        }
        res.json({ success: true });
    });
};

//Trang cá nhân
exports.Profile = async(req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.redirect('/');
        }
        const userId = req.session.user.id;
        const [user] = await db.query(
            `SELECT  u.name, u.email, u.age, u.gender, u.code,u.avatar,u.height,u.mbti,u.zodiac,u.address,u.about
            FROM users u 
            WHERE u.id = ?`, [userId]
        );
        const [checkCouple] = await db.query(`SELECT * FROM couples WHERE user1_code = ? OR user2_code = ? AND status = 1 LIMIT 1`, [userId, userId]);


        const [listEdu] = await db.query(
            'SELECT * FROM educations WHERE user_id = ? ', [userId]
        );

        const [listSkill] = await db.query(
            'SELECT * FROM skill WHERE user_id = ? ', [userId]
        );

        const [listHobby] = await db.query(
            'SELECT * FROM hobby WHERE user_id = ? ', [userId]
        );

        const [listInterest] = await db.query(
            'SELECT * FROM interest WHERE user_id = ? ', [userId]
        );

        res.render('us/profile', {
            infoUser: user[0],
            listEdu,
            listSkill,
            listHobby,
            listInterest,
            checkCouple
        });
    } catch (error) {
        console.error(error);
    }
};

exports.updateProfile = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { name, age, gender } = req.body;

        if (!name || !age || gender === undefined) {
            return res.json({
                success: false,
                message: 'Thiếu dữ liệu'
            });
        }
        const birthDate = new Date(age);
        if (isNaN(birthDate)) {
            return res.json({
                success: false,
                message: 'Ngày sinh không hợp lệ'
            });
        }

        await db.query(
            'UPDATE users SET name = ?, age = ?, gender = ? WHERE id = ?', [name, age, gender, userId]
        );
        req.session.user.name = name;
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};
exports.updateBasicInfo = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { age, height, zodiac, mbti, address } = req.body;

        await db.query(
            `UPDATE users 
             SET age = ?, height = ?, zodiac = ?, mbti = ?, address = ?
             WHERE id = ?`, [
                age || null,
                height || null,
                zodiac || null,
                mbti || null,
                address || null,
                userId
            ]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};

exports.updateAbout = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { content } = req.body;
        if (!content) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập nội dung'
            });
        }
        await db.query(
            'UPDATE users SET about = ? WHERE id = ?', [content, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};
//Đổi mật khẩu
exports.changePassword = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin'
            });
        }

        if (newPassword.length < 6) {
            return res.json({
                success: false,
                message: 'Mật khẩu mới phải ít nhất 6 ký tự'
            });
        }

        const [rows] = await db.query(
            'SELECT password FROM users WHERE id = ? LIMIT 1', [userId]
        );

        if (!rows.length) {
            return res.json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        const hashedPassword = rows[0].password;

        const isMatch = await bcrypt.compare(oldPassword, hashedPassword);
        if (!isMatch) {
            return res.json({
                success: false,
                message: 'Mật khẩu hiện tại không đúng'
            });
        }

        const isSame = await bcrypt.compare(newPassword, hashedPassword);
        if (isSame) {
            return res.json({
                success: false,
                message: 'Mật khẩu mới không được trùng mật khẩu cũ'
            });
        }

        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, userId]
        );

        res.json({ success: true, message: 'Đổi mật khẩu thành công' });

    } catch (err) {
        console.error('changePassword error:', err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};

//Đổi đại diện 
exports.updateAvatar = async(req, res) => {
    try {
        const userId = req.session.user.id;
        if (!req.file) {
            return res.status(400).send('Vui lòng chọn ảnh');
        }
        const newAvatarPath = `/uploads/avatars/${req.file.filename}`;
        const [rows] = await db.query(
            'SELECT avatar FROM users WHERE id = ?', [userId]
        );
        if (!rows.length) {
            return res.status(404).send('User không tồn tại');
        }
        const oldAvatar = rows[0].avatar;
        await db.query(
            'UPDATE users SET avatar = ? WHERE id = ?', [newAvatarPath, userId]
        );
        if (oldAvatar) {
            const oldPath = path.join(__dirname, '../public', oldAvatar);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        req.session.user.avatar = newAvatarPath;
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi upload avatar');
    }
};

//Chỉnh sửa học vấn
exports.getEduPartial = async(req, res) => {
    const userId = req.session.user.id;

    const [listEdu] = await db.query(
        'SELECT school, major, year FROM educations WHERE user_id = ?', [userId]
    );

    res.render('partials/education', { listEdu });
};
exports.addEducation = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { school, major, year } = req.body;

        if (!school && !major && !year) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập ít nhất 1 thông tin!'
            });
        }

        await db.query(
            `INSERT INTO educations (user_id, school, major, year)
             VALUES (?, ?, ?, ?)`, [
                userId,
                school || null,
                major || null,
                year || null
            ]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};
//Chỉnh sửa tài năng
exports.getSkillPartial = async(req, res) => {
    const userId = req.session.user.id;

    const [listSkill] = await db.query(`SELECT name, icon, user_id FROM skill WHERE user_id = ?`, [userId]);

    res.render('partials/skill', { listSkill });
};

exports.addSkill = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { name, icon } = req.body;

        if (!name && !icon) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập ít nhất 1 thông tin!'
            });
        }

        if (!name) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập tên kĩ năng!'
            });
        }
        if (!icon) {
            return res.json({
                success: false,
                message: 'Vui lòng chọn 1 icon phù hợp!'
            });
        }
        await db.query(
            `INSERT INTO skill (user_id, name, icon)
                     VALUES (?, ?, ?)`, [
                userId,
                name || null,
                icon || null,
            ]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};
//Chỉnh sửa mục tiêu ước mơ
exports.getHobbyPartial = async(req, res) => {
    const userId = req.session.user.id;

    const [listHobby] = await db.query(`SELECT title, content,icon, user_id FROM hobby WHERE user_id = ?`, [userId]);

    res.render('partials/hobby', { listHobby });
};

exports.addHobby = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { title, content, icon } = req.body;

        if (!title && !content && !icon) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập ít nhất 1 thông tin!'
            });
        }

        if (!title) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập tên mục tiêu || ước mơ!'
            });
        }
        if (!icon) {
            return res.json({
                success: false,
                message: 'Vui lòng chọn 1 icon phù hợp!'
            });
        }
        await db.query(
            `INSERT INTO hobby (user_id, title,content, icon)
                     VALUES (?, ?, ?,?)`, [
                userId,
                title || null,
                content || null,
                icon || null
            ]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
};
//Chỉnh sửa sở thích
exports.getInterestPartial = async(req, res) => {
    try {
        const userId = req.session.user.id;

        const [listInterest] = await db.query(`SELECT name, icon FROM interest WHERE user_id = ?`, [userId]);

        res.render('partials/interest', { listInterest });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });

    }
};
exports.addInterest = async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { name, icon } = req.body;

        if (!name && !icon) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập ít nhất 1 thông tin!'
            });
        }

        if (!name) {
            return res.json({
                success: false,
                message: 'Vui lòng nhập tên sở thích!'
            });
        }
        if (!icon) {
            return res.json({
                success: false,
                message: 'Vui lòng chọn icon thích hợp!'
            });
        }
        await db.query(`INSERT INTO interest (user_id, name, icon) VALUES (?, ?, ?)`, [userId, name, icon]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
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
                    SELECT u.*, c.started_at, c.id AS couples_id FROM users u JOIN couples c ON u.code = c.user1_code WHERE c.status = 0 AND c.user2_code = ? `, [user.code]
        );

        // Query cho tab "Sent" (lời mời đã gửi)
        const [invitedResult] = await db.query(
            `
                    SELECT u.*, c.started_at, c.id AS couples_id, c.status FROM users u JOIN couples c ON u.code = c.user2_code WHERE (c.status = 0 OR c.status = 2) AND c.user1_code = ?
                    `, [user.code]
        );
        //Random User Matching
        const [randomUsersResult] = await db.query(`
                    SELECT u.*
                    FROM users u
                    WHERE u.id != ?
                    AND NOT EXISTS (
                        SELECT 1 FROM couples c
                        WHERE (u.code = c.user1_code OR u.code = c.user2_code)
                        AND c.status = 1
                    )
                    ORDER BY RAND()
                    LIMIT 10 `, [user.id]);

        const [listFavoriteResult] = await db.query(`
                    SELECT u.*
                    FROM users u LEFT JOIN list_favorites f ON(u.id = f.user_favorite) WHERE f.user = ?
                    `, [user.id]);

        const [countFavTodayResult] = await db.query(`
            SELECT COUNT(*) AS totalFavToday
            FROM list_favorites
            WHERE user_favorite = ?
            AND DATE(created_at) = CURDATE()
        `, [user.id]);

        const [totalFavResult] = await db.query(`
             SELECT COUNT(*) AS totalFav
             FROM list_favorites 
             WHERE user_favorite = ?
            `, [user.id]);
        
        const [totalViewsProfileResualt] = await db.query(
                `SELECT COUNT(*) as total 
                 FROM profile_views 
                 WHERE target_id = ?`,
                [user.id]
            );
        // Correct: tobeinvitedResult is already the rows array
        const tobeinvited = tobeinvitedResult || [];
        const invited = invitedResult || [];
        const randomUsers = randomUsersResult || [];
        const listFavorite = listFavoriteResult || [];
        const countFavToday = countFavTodayResult[0]?.totalFavToday || 0;
        const totalFav = totalFavResult[0]?.totalFav || 0;
        const hasCouple = req.session.couple?.status === 1;
        const totalViewsProfile= totalViewsProfileResualt[0]?.total || 0;

        res.render('matching', {
            tobeinvited,
            invited,
            randomUsers,
            listFavorite,
            countFavToday,
            totalViewsProfile,
            totalFav,
            hasCouple
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Lỗi khi lấy dữ liệu matching!");
    }
};

//Gửi lời mời
exports.sendInvite = async(req, res) => {
    try {
        const user1 = req.session.user;
        const user1_code = user1.code;
        const { user2_id } = req.body;

        if (!user2_id) {
            return res.json({ success: false, message: "Thiếu user2_id!" });
        }

        const [rows] = await db.query(
            "SELECT code, name, avatar FROM users WHERE id = ? LIMIT 1", [user2_id]
        );

        if (!rows.length) {
            return res.json({ success: false, message: "User không tồn tại!" });
        }

        const user2 = rows[0];

        const [exist] = await db.query(`
            SELECT id FROM couples
            WHERE (user1_code = ? AND user2_code = ?)
               OR (user1_code = ? AND user2_code = ?)
            LIMIT 1
        `, [user1_code, user2.code, user2.code, user1_code]);

        if (exist.length) {
            return res.json({ success: false, message: "Đã tồn tại lời mời!" });
        }

        const [result] = await db.query(`
            INSERT INTO couples(user1_code, user2_code, status, is_seen, started_at)
            VALUES (?, ?, 0, 0, NOW())
        `, [user1_code, user2.code]);

        if (global._io && user2_id) {
            global._io.to(`user_${user2_id}`).emit("new-invite", {
                couples_id: result.insertId,
                from: {
                    code: user1_code,
                    name: user1.name,
                    avatar: user1.avatar
                },
                started_at: new Date()
            });
        }

        return res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Lỗi server!" });
    }
};

//Đếm số lượng lời mời chưa xem 
exports.getUnseenCount = async(req, res) => {
    const user_code = req.session.user.code;

    const [rows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM couples
        WHERE user2_code = ?
        AND status = 0
        AND is_seen = 0
    `, [user_code]);

    res.json({ total: rows[0].total });
};

//Đánh dấu đã xem
exports.markSeen = async(req, res) => {
    const user_code = req.session.user.code;
    await db.query(`
        UPDATE couples
        SET is_seen = 1
        WHERE user2_code = ?
        AND status = 0
    `, [user_code]);

    res.json({ success: true });
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
            SELECT id 
            FROM list_favorites 
            WHERE user = ? AND user_favorite = ? LIMIT 1 `, [user, user_favorite]
        );

        if (exists.length > 0) {
            return res.json({
                success: false,
                message: "Bạn đã thích người này trước đó!"
            });
        }

        // Thêm mới
        await db.query(
            `INSERT INTO list_favorites(user, user_favorite, created_at) VALUES( ? , ? , NOW())`, [user, user_favorite]
        );

        const [
            [countToday]
        ] = await db.query(`
            SELECT COUNT(*) as total
            FROM list_favorites
            WHERE user_favorite = ?
            AND DATE(created_at) = CURDATE()
        `, [user_favorite]);

        const [
            [totalFav]
        ] = await db.query(`
            SELECT COUNT(*) as total
            FROM list_favorites
            WHERE user_favorite = ?
        `, [user_favorite]);

        if (global._io) {
            global._io.to(`user_${user_favorite}`).emit("new-favorite", {
                from: {
                    id: user.id,
                    name: user.name,
                    avatar: user.avatar
                },
                countToday: countToday.total,
                totalFav: totalFav.total
            });
        }

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

exports.seenProfile = async(req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.redirect('/');
        }
        const viewerId = req.session.user.id; 
        const targetId = parseInt(req.params.id);
        // Không tự xem mình
        if (viewerId !== targetId) {
            await db.query(
                `INSERT IGNORE INTO profile_views 
                 (viewer_id, target_id, created_at) 
                 VALUES (?, ?, NOW())`,
                [viewerId, targetId]
            );
        }

        const [user] = await db.query(
            `SELECT  u.name, u.email, u.age, u.gender, u.code,u.avatar,u.height,u.mbti,u.zodiac,u.address,u.about
            FROM users u 
            WHERE u.id = ?`, [targetId]
        );
        const users = user[0];
        const [checkCouple] = await db.query(`SELECT * FROM couples WHERE user1_code = ? OR user2_code = ? AND status = 1 LIMIT 1`, [targetId, targetId]);


        const [listEdu] = await db.query(
            'SELECT * FROM educations WHERE user_id = ? ', [targetId]
        );

        const [listSkill] = await db.query(
            'SELECT * FROM skill WHERE user_id = ? ', [targetId]
        );

        const [listHobby] = await db.query(
            'SELECT * FROM hobby WHERE user_id = ? ', [targetId]
        );

        const [listInterest] = await db.query(
            'SELECT * FROM interest WHERE user_id = ? ', [targetId]
        );

        const [totalViewsResult] = await db.query(
                `SELECT COUNT(*) as total 
                 FROM profile_views 
                 WHERE target_id = ?`,
                [targetId]
            );
        const totalViews = totalViewsResult[0].total;
        if (global._io) {
            global._io.to(`user_${targetId}`).emit("profile-viewed", {
                from: {
                    id: users.id,
                    name: users.name,
                    avatar: users.avatar
                },
                totalViews: totalViews
            });
        }

        res.render('us/viewprofile', {
            infoUser: user[0],
            listEdu,
            listSkill,
            listHobby,
            listInterest,
            checkCouple
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};