exports.getVerificationEmailHTML = (verificationLink, displayName) => {
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
                font-size: 32px;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            }
            .heart {
                font-size: 50px;
                animation: heartbeat 1.5s infinite;
            }
            @keyframes heartbeat {
                0%, 100% { transform: scale(1); }
                25% { transform: scale(1.1); }
                50% { transform: scale(1); }
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
                margin-bottom: 30px;
                font-size: 16px;
            }
            .verify-button {
                display: inline-block;
                background: linear-gradient(135deg, #FF69B4, #FFB6C1);
                color: white;
                text-decoration: none;
                padding: 15px 50px;
                border-radius: 50px;
                font-size: 18px;
                font-weight: bold;
                box-shadow: 0 5px 20px rgba(255, 105, 180, 0.4);
                transition: transform 0.3s ease;
            }
            .verify-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 7px 25px rgba(255, 105, 180, 0.5);
            }
            .warning {
                margin-top: 30px;
                padding: 15px;
                background: #FFF0F5;
                border-left: 4px solid #FF69B4;
                border-radius: 5px;
            }
            .warning p {
                color: #FF1493;
                margin: 0;
                font-size: 14px;
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
                <div class="heart">💕</div>
                <h1>Welcome to Couple Vibe!</h1>
            </div>
            
            <div class="content">
                <h2>Xin chào ${displayName}! 💗</h2>
                <p>
                    Cảm ơn bạn đã đăng ký tài khoản tại <strong>Couple Vibe</strong>!
                    <br>Chỉ còn một bước nữa thôi!
                </p>
                
                <a href="${verificationLink}" class="verify-button">
                    ✨ Xác Nhận Tài Khoản ✨
                </a>
                
                <div class="divider"></div>
                
                <div class="warning">
                    <p>
                        ⏰ <strong>Lưu ý quan trọng:</strong> Link xác nhận này chỉ có hiệu lực trong <strong>60 giây</strong>!
                        <br>Vui lòng nhấn vào nút xác nhận ngay để hoàn tất đăng ký.
                    </p>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #999;">
                    Nếu bạn không thể nhấn vào nút, hãy copy link sau vào trình duyệt:
                    <br>
                    <span style="color: #FF69B4; word-break: break-all;">${verificationLink}</span>
                </p>
            </div>
            
            <div class="footer">
                <p>💕 Couple Vibe - Where Love Connects 💕</p>
                <p style="margin-top: 10px;">Email này được gửi tự động, vui lòng không trả lời.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};