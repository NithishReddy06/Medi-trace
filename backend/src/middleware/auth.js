const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');

const publicUserSelect = {
  userId: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  isActive: true,
};

function serializeUser(user) {
  return {
    id: user.userId.toString(),
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: user.userId.toString(),
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
}

async function requireAuth(request, response, next) {
  const authorization = request.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ status: 'error', message: 'Authentication is required.' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });

    if (!payload.sub || !/^\d+$/.test(payload.sub)) {
      throw new Error('Invalid token subject.');
    }

    const user = await prisma.user.findUnique({
      where: { userId: BigInt(payload.sub) },
      select: publicUserSelect,
    });

    if (!user || !user.isActive) {
      return response.status(401).json({ status: 'error', message: 'Your session is no longer active.' });
    }

    request.user = serializeUser(user);
    next();
  } catch (error) {
    return response.status(401).json({ status: 'error', message: 'Your session is invalid or has expired.' });
  }
}

function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ status: 'error', message: 'You do not have access to this resource.' });
    }

    next();
  };
}

module.exports = { publicUserSelect, requireAuth, requireRole, serializeUser, signAccessToken };
