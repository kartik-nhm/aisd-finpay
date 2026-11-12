import jwt from 'jsonwebtoken';

/**
 * Verifies the same JWT issued by TalentHub. Configure JWT_SECRET (HS256) or
 * JWT_PUBLIC_KEY (RS256) to match TalentHub. The expected identity claim is
 * sub; optional role claim is used by admin-only routes.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing Bearer token' });
  try {
    const key = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || process.env.JWT_SECRET;
    if (!key) return res.status(500).json({ error: 'JWT verification key is not configured' });
    const options = { algorithms: process.env.JWT_PUBLIC_KEY ? ['RS256'] : ['HS256'] };
    if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;
    req.user = jwt.verify(token, key, options);
    if (!req.user.sub) return res.status(401).json({ error: 'JWT must contain a sub claim' });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired TalentHub token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!['ADMIN', 'FINANCE_ADMIN'].includes(req.user?.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Only enabled for local demo. This endpoint is not an authentication system.
export function devToken(req, res) {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_AUTH !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { studentId = 'student-rahul', role = 'STUDENT' } = req.body || {};
  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'Set JWT_SECRET in .env' });
  const token = jwt.sign({ role }, secret, {
    subject: studentId, expiresIn: '2h',
    ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
    ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {})
  });
  res.json({ token, warning: 'Local demo token only. Production must use TalentHub-issued tokens.' });
}
