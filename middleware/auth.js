module.exports = (req, res, next) => {
    const publicPaths = ['/', '/login', '/register', '/logout'];

    // Nên dùng req.path hoặc req.originalUrl tùy nhu cầu
    if (publicPaths.includes(req.path)) {
        return next();
    }

    if (!req.session.user) {
        console.log('Chặn truy cập: chưa login, path =', req.path);
        return res.redirect('/'); // chuyển hướng
    }

    console.log('Session user:', req.session.user);
    next();
};