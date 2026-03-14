type TrustProxyConfig = boolean | number | string;

const nodeEnv = process.env.NODE_ENV || 'development';

const parseTrustProxy = (value: string | undefined): TrustProxyConfig => {
  if (value === undefined || value === '') {
    return 1;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric;

  return value;
};

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  database: {
    url: process.env.DATABASE_URL || '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
};
