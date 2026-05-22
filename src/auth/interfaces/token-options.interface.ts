/**
 * TokenOptions — optional parameters for JWT token generation.
 */
export interface TokenOptions {
  /**
   * If true, the refresh token will have extended lifetime (30 days).
   * If false or omitted, the default refresh token TTL is used (7 days).
   */
  rememberMe?: boolean;
}
