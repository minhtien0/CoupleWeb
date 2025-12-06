const coupleRepository = require('../repositories/couple.repository');

class CoupleService {
    async getCoupleInfo(userCode) {
        return await coupleRepository.getCoupleInfoByUserCode(userCode);
    }
}

module.exports = new CoupleService();