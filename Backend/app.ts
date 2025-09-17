// app.ts
import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import trainingRoutes from './src/routes/Training.routes.js';
const app = express();

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trainings', trainingRoutes);

export default app;