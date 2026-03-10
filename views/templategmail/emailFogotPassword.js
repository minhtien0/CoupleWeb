exports.getForgotPasswordEmailHTML = (resetLink, displayName, newPassword) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Arial', sans-serif;
                background: linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 50%, #FFD6E0 100%);
                padding: 20px;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 10px 40px rgba(255, 105, 180, 0.3);
            }
            .header {
                background: linear-gradient(135deg, #FF69B4, #FFB6C1);
                padding: 40px 20px;
                text-align: center;
            }
            .header h1 {
                color: white;
                font-size: 30px;
                margin-top: 10px;
            }
            .lock {
                font-size: 48px;
            }
            .content {
                padding: 40px 30px;
                text-align: center;
            }
            .content h2 {
                color: #FF69B4;
                margin-bottom: 20px;
                font-size: 24px;
            }
            .content p {
                color: #666;
                line-height: 1.6;
                margin-bottom: 20px;
                font-size: 16px;
            }
            .password-box {
                background: #FFF0F5;
                padding: 20px;
                border-radius: 15px;
                margin: 20px 0;
                font-size: 22px;
                font-weight: bold;
                color: #FF1493;
                letter-spacing: 2px;
                border: 2px dashed #FF69B4;
            }
            .reset-button {
                display: inline-block;
                background: linear-gradient(135deg, #FF69B4, #FFB6C1);
                color: white;
                text-decoration: none;
                padding: 15px 50px;
                border-radius: 50px;
                font-size: 18px;
                font-weight: bold;
                box-shadow: 0 5px 20px rgba(255, 105, 180, 0.4);
                margin-top: 20px;
            }
            .warning {
                margin-top: 30px;
                padding: 15px;
                background: #FFF0F5;
                border-left: 4px solid #FF69B4;
                border-radius: 5px;
                font-size: 14px;
                color: #FF1493;
            }
            .footer {
                background: #FFF0F5;
                padding: 20px;
                text-align: center;
                color: #999;
                font-size: 14px;
            }
            .divider {
                height: 2px;
                background: linear-gradient(90deg, transparent, #FFB6C1, transparent);
                margin: 30px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="lock">🔐</div>
                <h1>Couple Vibe</h1>
            </div>
            
            <div class="content">
                <h2>Xin chào ${displayName}! 💗</h2>
                <p>
                    Chúng tôi đã tạo mật khẩu mới cho tài khoản của bạn.
                </p>

                <div class="password-box">
                    ${newPassword}
                </div>

                <p>
                    Vui lòng nhấn nút bên dưới để xác nhận thay đổi mật khẩu.
                </p>
                
                <a href="${resetLink}" class="reset-button">
                    💕 Xác Nhận Đổi Mật Khẩu 💕
                </a>

                <div class="divider"></div>

                <div class="warning">
                    ⏰ Link này chỉ có hiệu lực trong <strong>5 phút</strong>.
                    <br>Vì lý do bảo mật, hãy đổi lại mật khẩu sau khi đăng nhập.
                </div>

                <p style="margin-top: 25px; font-size: 14px; color: #999;">
                    Nếu nút không hoạt động, hãy copy link sau:
                    <br>
                    <span style="color: #FF69B4; word-break: break-all;">
                        ${resetLink}
                    </span>
                </p>
            </div>

            <div class="footer">
                💕 Couple Vibe - Where Love Connects 💕
                <br><br>
                Email này được gửi tự động, vui lòng không trả lời.
            </div>
        </div>
    </body>
    </html>
    `;
};