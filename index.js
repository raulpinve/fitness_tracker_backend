const express = require('express');
const app = express();
const cors = require("cors");
const path = require('path');
require("dotenv").config({ quiet: true });
const cookieParser = require("cookie-parser");
const { initDB } = require('./initDB');

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));


app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
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

// --- Rutas Públicas (Auth) ---
app.use("/api/auth", authRoutes);

// --- Middleware de Protección ---
// Todas las rutas que se definan DESPUÉS de esto requerirán token
app.use(authenticateToken);

// --- Rutas Protegidas bajo el prefijo /api ---
app.use("/api/exercises", exercisesRoutes);
app.use("/api/routines", routinesRoutes);
app.use("/api/routine-exercises", routineExercisesRoutes);
app.use("/api/workouts", workoutsRoutes);
app.use("/api/workouts-exercises", workoutsExercises);
app.use("/api/workout-sets", workoutSetsRoutes);
app.use("/api/cardio-logs", cardioLogsRoutes);
app.use("/api/users", userRoutes);

app.use(handleErrorResponse);

(async () => {
  await initDB();
})();

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

module.exports = app; 