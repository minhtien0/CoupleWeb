const express = require('express');
const router = express.Router();

const exampleController = require('../controllers/controller');
const dateController = require('../controllers/dateController');
const homeController = require('../controllers/homeController');
const journeyController = require('../controllers/journeyController');
const memoriesController = require('../controllers/memoriesController');
const usController = require('../controllers/usController');
//middleware
const auth = require('../middleware/auth');
const couple = require('../middleware/couple');
const uploadGoals = require("../middleware/upload")("goals");
const uploadMemories = require("../middleware/upload")("memories");
// ===================== AUTH & LOGIN =====================
router.get('/', exampleController.Login);
router.post('/login', exampleController.postLogin);
router.post('/register', exampleController.postRegister);
router.post('/logout', exampleController.Logout);

// ===================== CÁC ROUTE CẦN LOGIN =====================
router.use(['/invite', '/matching'], auth);
router.post('/invite-connect', exampleController.inviteConnect);
router.get('/matching', exampleController.getMatching);
router.post('/match/send-invite', exampleController.sendInvite);
router.post('/couple/reject/:couples_id', exampleController.rejectInvite);
router.post('/couple/cancel/:id', exampleController.cancelInvite);
router.post('/favorite/add', exampleController.addFavorite);




// ===================== CÁC ROUTE CẦN COUPLE =====================
// Chạy middleware couple cho các trang này
router.use(['/home', '/date', '/journey', '/memories', '/us'], couple);
// Trang Home
router.get('/home', homeController.Index);
router.post('/home/checkin', homeController.checkin);
// ===================== CÁC TRANG CỦA COUPLE =====================
router.get('/date', dateController.Index);
router.post('/date/create', dateController.Create);
router.get('/date/get/:id', dateController.getOne);
router.post('/date/update', dateController.update);
router.post('/date/status', dateController.updateStatus);


router.get('/journey', journeyController.Index);
router.post('/journey/love-language/save', journeyController.saveLoveLanguage);
router.post("/journey/love-language/update", journeyController.updateLoveLanguage);
router.post('/journey/goals/create', journeyController.createGoal);
router.get('/journey/goals/:id', journeyController.getGoalDetail);
router.post('/journey/goals/checkin', uploadGoals.single('image'), journeyController.checkinGoal);
router.post('/journey/milestone/create', journeyController.createMilestone);


router.get('/memories', memoriesController.Index);
router.post('/memories/create', uploadMemories.array("media", 4), memoriesController.createMemory);
router.post('/memories/create/diary', memoriesController.createDiary);


router.get('/us', usController.Index);
router.post('/us/cost/create', usController.createCost);
router.get('/profile', usController.Profile);
// ===================== KHÁC =====================

module.exports = router;