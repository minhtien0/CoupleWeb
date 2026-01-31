const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
require('./cron/cleanExpiredPending'); // Thêm dòng này
// Layout Ejs
const expressLayouts = require('express-ejs-layouts');
//Realtime
const http = require("http").createServer(app);
const io = require("socket.io")(http);
let userSockets = {}; // Khi user connect
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("registerUser", (userId) => {

        if (userSockets[userId] && userSockets[userId] !== socket.id) {
            const oldSocketId = userSockets[userId];
            io.to(oldSocketId).emit("force_logout");

            const oldSocket = io.sockets.sockets.get(oldSocketId);
            if (oldSocket) {
                oldSocket.disconnect(true);
            }
        }

        userSockets[userId] = socket.id;
        socket.userId = userId;

        socket.join(`user_${userId}`);
    });

    socket.on("disconnect", () => {
        if (socket.userId) {
            delete userSockets[socket.userId];
        }
    });
});
// Cho controller dùng io
global._io = io;
module.exports = { userSockets, io };

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true })); // Parse form data (x-www-form-urlencoded)
app.use(express.json()); // Parse JSON (nếu dùng fetch/AJAX)
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key', // Thay bằng chuỗi bí mật an toàn (nên dùng env)
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Đặt true nếu dùng HTTPS
}));
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// Routes
const exampleRoutes = require('./routes/routes');
app.use('/', exampleRoutes);


// Start server
http.listen(port, () => {
    console.log(`Server running on port ${port}`);
});