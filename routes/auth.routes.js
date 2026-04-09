const router = require('express').Router();
const authController = require("../controllers/auth.controller");
const { validateRegister } = require('../validators/auth.validator');
const { validateLogin } = require('../validators/auth.validator');

router.post('/register', 
    validateRegister,
    authController.register
);

// Login
router.post('/login', 
    validateLogin, 
    authController.login
);

// logout
router.post("/logout", 
    // authController.authenticateToken,
    authController.logout
)

router.post("/refresh", 
    authController.refreshToken
)

router.get("/me", 
    authController.authenticateToken,
    authController.me
)

module.exports = router