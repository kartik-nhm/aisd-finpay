import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { api } from './routes/api.js';
import { devToken } from './middleware/auth.js';

export const app = express();
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
app.use(helmet());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '32kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'FinPay API' }));
app.post('/api/dev/token', devToken);
app.use('/api', api);
app.use((err, _req, res, _next) => {
  if (err.name === 'ZodError') return res.status(400).json({ error: 'Please check the amount and try again', details: err.issues });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : err.message });
});
