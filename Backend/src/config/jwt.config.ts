export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-default-secret',
  expiresIn: '30d'
};