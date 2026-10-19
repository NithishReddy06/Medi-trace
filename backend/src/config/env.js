require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

function valueIsPlaceholder(value) {
  return !value || value.startsWith('replace_');
}

const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: nodeEnv,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL,
  validate() {
    for (const name of ['DATABASE_URL', 'JWT_SECRET']) {
      if (valueIsPlaceholder(process.env[name])) {
        throw new Error(`${name} must be set to a real local value before the backend starts.`);
      }
    }
  }
};

module.exports = env;
