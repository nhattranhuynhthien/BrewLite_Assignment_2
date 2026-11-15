import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

export const APP_VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

/** Build the canonical global ValidationPipe shared by bootstrap and e2e tests. */
export function createAppValidationPipe(): ValidationPipe {
  return new ValidationPipe(APP_VALIDATION_PIPE_OPTIONS);
}
