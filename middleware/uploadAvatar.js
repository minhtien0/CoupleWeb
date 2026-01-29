const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/avatars');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `avatar_${req.session.user.id}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);

    if (ext && mime) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ cho phép file ảnh (jpg, png, webp)'));
    }
};

const uploadAvatar = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter
});

module.exports = uploadAvatar;