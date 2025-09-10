// app.ts
import express from 'express';
import authRoutes from './src/routes/auth.routes.js';

const app = express();

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

export default app;