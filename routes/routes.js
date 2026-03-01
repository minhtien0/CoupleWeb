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
const uploadAvatar = require('../middleware/uploadAvatar');
// ===================== AUTH & LOGIN =====================
router.get('/', exampleController.Login);
router.post('/login', exampleController.postLogin);
router.post('/register', exampleController.postRegister);
router.get('/auth/verify-email/:token', exampleController.verifyEmail);
router.get('/check-verification', exampleController.checkVerification);
router.post('/resend-verification', exampleController.resendVerification);
router.post('/logout', exampleController.Logout);

// ===================== CÁC ROUTE CẦN LOGIN =====================
router.use(['/invite', '/matching'], auth);
router.post('/invite-connect', exampleController.inviteConnect);
router.get('/matching', exampleController.getMatching);
router.post('/match/send-invite', exampleController.sendInvite);
router.get('/profile/detail/:slug-:id', exampleController.seenProfile);
router.get('/couple/unseen-count', exampleController.getUnseenCount);
router.post('/couple/mark-seen', exampleController.markSeen);
router.post('/couple/reject/:couples_id', exampleController.rejectInvite);
router.post('/couple/cancel/:id', exampleController.cancelInvite);
router.post('/favorite/add', exampleController.addFavorite);
router.get('/profile', exampleController.Profile);
router.post('/update-avatar', uploadAvatar.single('avatar'), exampleController.updateAvatar);
router.post('/profile/update', exampleController.updateProfile);
router.post('/profile/basic/update', exampleController.updateBasicInfo);
router.post('/profile/education/add', exampleController.addEducation);
router.get('/profile/education/partial', exampleController.getEduPartial);
router.post('/profile/skill/add', exampleController.addSkill);
router.get('/profile/skill/partial', exampleController.getSkillPartial);
router.post('/profile/hobby/add', exampleController.addHobby);
router.get('/profile/hobby/partial', exampleController.getHobbyPartial);
router.post('/profile/interest/add', exampleController.addInterest);
router.get('/profile/interest/partial', exampleController.getInterestPartial);
router.post('/profile/about/update', exampleController.updateAbout);
router.post('/profile/password/update', exampleController.changePassword);

// ===================== CÁC ROUTE CẦN COUPLE =====================
// Chạy middleware couple cho các trang này
router.use(['/home', '/date', '/journey', '/memories', '/us'], couple);
// Trang Home
router.get('/home', homeController.Index);
router.post('/home/checkin', homeController.checkin);
router.get('/api/notifications', homeController.getNotifications);
router.post('/api/notifications/:id/read', homeController.readNotification);

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
router.get('/us/expenses/export-excel', usController.exportExpensesExcel);
router.get('/us/statistics', usController.Statistics);
// ===================== KHÁC =====================

module.exports = router;