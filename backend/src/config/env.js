require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

function requiredInProduction(name) {
  const value = process.env[name];

  if (nodeEnv === 'production' && !value) {
    throw new Error(`${name} must be set in production.`);
  }

  return value;
}

const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: nodeEnv,
  JWT_SECRET: requiredInProduction('JWT_SECRET'),
  CORS_ORIGIN: process.env.FRONTEND_URL || 'http://localhost:5173',
  DATABASE_URL: requiredInProduction('DATABASE_URL')
};

module.exports = env;
