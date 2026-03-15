import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/error.middleware';
import { successResponse } from './utils/response';

const app = express();
app.set('trust proxy', config.trustProxy);

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api/v1/health',
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check
app.get('/health', (_req, res) => {
  successResponse(res, { status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health', (_req, res) => {
  successResponse(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// Feature routes
import authRouter from './modules/auth/auth.routes';
import usersRouter from './modules/users/users.routes';
import rolesRouter from './modules/roles/roles.routes';
import clientsRouter from './modules/clients/clients.routes';
import loansRouter from './modules/loans/loans.routes';
import paymentsRouter from './modules/payments/payments.routes';
import expensesRouter from './modules/expenses/expenses.routes';
import collectorRouter from './modules/collector/collector.routes';
import dashboardRouter from './modules/dashboard/dashboard.routes';
import reportsRouter from './modules/reports/reports.routes';

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/roles', rolesRouter);
app.use('/api/v1/clients', clientsRouter);
app.use('/api/v1/loans', loansRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/collector', collectorRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/reports', reportsRouter);

// ---------------------------------------------------------------------------
// Error handling (must be registered last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
