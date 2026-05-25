import { plainToClass } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  IsOptional,
  IsIn,
  validateSync,
  MinLength,
} from 'class-validator';

class EnvironmentVariables {
  @IsNotEmpty()
  @IsString()
  DATABASE_URL!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters long' })
  JWT_ACCESS_SECRET!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters long' })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ISSUER?: string;

  @IsOptional()
  @IsString()
  JWT_AUDIENCE?: string;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsOptional()
  @IsString()
  ASAAS_API_KEY?: string;

  @IsOptional()
  @IsString()
  @MinLength(32, { message: 'KEYS_ENCRYPTION_KEY must be at least 32 characters long if provided' })
  KEYS_ENCRYPTION_KEY?: string;

  @IsOptional()
  @IsString()
  STORAGE_DRIVER?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map(err => {
        const constraints = err.constraints ? Object.values(err.constraints).join(', ') : '';
        return `${err.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(`Invalid environment variables:\n${messages}`);
  }

  return validatedConfig;
}
