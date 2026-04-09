const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { validateUUID } = require("./validator");

exports.validateWorkoutExerciseId = async (req, res, next) => {
    try {
        const workoutExerciseId = req?.params?.workoutExerciseId || req?.body?.workoutExerciseId || req?.query?.workoutExerciseId;
        if (!validateUUID(workoutExerciseId)) {
            return throwNotFoundError("El ID del workout exercise no es válido.");
        }
        
      const { rows } = await pool.query(
            `
            SELECT 
                we.id, 
                e.type AS exercise_type, 
                w.finished_at
            FROM workout_exercises AS we
            INNER JOIN exercises AS e 
                ON we.exercise_id = e.id
            INNER JOIN workouts AS w
                ON w.id = we.workout_id
            WHERE we.id = $1
            `,
            [workoutExerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("El workout exercise no existe.");
        }

        req.workout = {
            finishedAt: rows[0].finished_at
        }

        req.exercise = {
            id: rows[0].id,
            type: rows[0].exercise_type
        }

        next();
    } catch (error) {
        next(error);
    }
};