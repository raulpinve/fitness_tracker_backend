const express = require('express');
const app = express();
const cors = require("cors");
const path = require('path');
require("dotenv").config({ quiet: true });
const cookieParser = require("cookie-parser");
const { initDB } = require('./initDB');

app.use(cors({
  origin: "http://localhost:5173", 
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json()); 
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); 

const handleErrorResponse = require('./errors/handleErrorResponse');
const { authenticateToken } = require('./controllers/auth.controller');

const authRoutes = require("./routes/auth.routes");
const exercisesRoutes = require("./routes/exercises.routes");
const routinesRoutes = require("./routes/routines.routes");
const routineExercisesRoutes = require("./routes/routineExercises.routes");
const workoutsRoutes = require("./routes/workouts.routes");
const workoutsExercises = require("./routes/workoutExercise.routes")
const workoutSetsRoutes = require("./routes/workoutSets.routes");
const cardioLogsRoutes = require("./routes/cardioLog.routes");
const userRoutes = require("./routes/users.routes")

// Public routes
app.use("/auth", authRoutes);

// Protected routes
app.use(authenticateToken);
app.use("/exercises", exercisesRoutes);
app.use("/routines", routinesRoutes);
app.use("/routine-exercises", routineExercisesRoutes);
app.use("/workouts", workoutsRoutes);
app.use("/workouts-exercises", workoutsExercises);
app.use("/workout-sets", workoutSetsRoutes);
app.use("/cardio-logs", cardioLogsRoutes)
app.use("/users", userRoutes);

app.use(handleErrorResponse);

(async () => {
  await initDB();
})();

const port = 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

module.exports = app; 