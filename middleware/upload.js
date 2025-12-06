const multer = require("multer");
const path = require("path");
const fs = require("fs");

function createUploader(folder) {
    // Tạo thư mục nếu chưa có
    const uploadPath = path.join("public/uploads", folder);
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + "-" + file.originalname);
        }
    });

    return multer({ storage });
}

module.exports = createUploader;