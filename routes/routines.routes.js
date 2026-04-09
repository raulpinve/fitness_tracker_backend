const router = require("express").Router();
const routinesController = require("../controllers/routines.controller");

const {
    validateRoutineId,
    validateCreateRoutine,
    validateUpdateRoutine,
    validateGetAllRoutines
} = require("../validators/routines.validator");

router.post(
    "/:routineId/clone",
    validateRoutineId,
    routinesController.cloneRoutine
);

router.post(
    "/",
    validateCreateRoutine,
    routinesController.createRoutine
);

router.get(
    "/:routineId",
    validateRoutineId,
    routinesController.getRoutine
);

router.get(
    "/",
    validateGetAllRoutines,
    routinesController.getAllRoutines
);


router.patch(
    "/:routineId",
    validateRoutineId,
    validateUpdateRoutine,
    routinesController.updateRoutine
);

router.delete(
    "/:routineId",
    validateRoutineId,
    routinesController.deleteRoutine
);

module.exports = router;