import { registerDecorator, ValidationOptions } from 'class-validator';

export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function isWithinBcryptByteLimit(
  value: unknown,
  maxBytes = BCRYPT_MAX_PASSWORD_BYTES,
): boolean {
  return (
    typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maxBytes
  );
}

/** Validate that a string does not exceed the UTF-8 byte limit enforced by bcrypt. */
export function MaxUtf8Bytes(
  maxBytes = BCRYPT_MAX_PASSWORD_BYTES,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'maxUtf8Bytes',
      target: object.constructor,
      propertyName,
      constraints: [maxBytes],
      options: {
        message: `Mật khẩu không được vượt quá ${maxBytes} byte UTF-8`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return isWithinBcryptByteLimit(value, maxBytes);
        },
      },
    });
  };
}
