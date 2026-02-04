// app.ts
import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import * as trainingRoutes from './src/routes/Training.routes.js';
const app = express();

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use(
  '/api/trainings',
  (trainingRoutes as any).default ?? (trainingRoutes as any).router ?? (trainingRoutes as any)
);

export default app;