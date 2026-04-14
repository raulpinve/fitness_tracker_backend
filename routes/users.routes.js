const router = require("express").Router();
const usersControllers = require("../controllers/users.controller");

router.get(
    "/stats",
    usersControllers.getUserStats
);

router.put("/", 
    usersControllers.updateProfile
)

module.exports = router;
