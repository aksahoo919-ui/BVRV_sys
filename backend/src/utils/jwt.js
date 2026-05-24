import jwt from 'jsonwebtoken';

export function issueJWT(user) {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatar_url: user.avatar_url,
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}
