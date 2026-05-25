export interface JwtPayload {
  sub: string;
  role: string;
  jti: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}
