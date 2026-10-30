require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

function valueIsPlaceholder(value) {
  return !value || /^(replace_|change_me|your_)/i.test(value.trim());
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
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters. Generate a unique secret for this installation.');
    }
  }
};

module.exports = env;
