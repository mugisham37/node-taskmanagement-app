import { DomainError } from '../domain/errors/domain.error';

/**
 * Validation guards for domain logic
 */

/**
 * Guard against null or undefined values
 */
export function guardAgainstNullOrUndefined(
  value: any,
  parameterName: string
): void {
  if (value === null || value === undefined) {
    throw new DomainError(`${parameterName} cannot be null or undefined`);
  }
}

/**
 * Guard against empty strings
 */
export function guardAgainstEmptyString(
  value: string,
  parameterName: string
): void {
  guardAgainstNullOrUndefined(value, parameterName);
  if (value.trim().length === 0) {
    throw new DomainError(`${parameterName} cannot be empty`);
  }
}

/**
 * Guard against invalid length
 */
export function guardAgainstInvalidLength(
  value: string,
  parameterName: string,
  minLength?: number,
  maxLength?: number
): void {
  guardAgainstNullOrUndefined(value, parameterName);

  if (minLength !== undefined && value.length < minLength) {
    throw new DomainError(
      `${parameterName} must be at least ${minLength} characters long`
    );
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new DomainError(
      `${parameterName} cannot exceed ${maxLength} characters`
    );
  }
}

/**
 * Guard against negative numbers
 */
export function guardAgainstNegativeNumber(
  value: number,
  parameterName: string
): void {
  guardAgainstNullOrUndefined(value, parameterName);
  if (value < 0) {
    throw new DomainError(`${parameterName} cannot be negative`);
  }
}

/**
 * Guard against invalid range
 */
export function guardAgainstInvalidRange(
  value: number,
  parameterName: string,
  min?: number,
  max?: number
): void {
  guardAgainstNullOrUndefined(value, parameterName);

  if (min !== undefined && value < min) {
    throw new DomainError(`${parameterName} must be at least ${min}`);
  }

  if (max !== undefined && value > max) {
    throw new DomainError(`${parameterName} cannot exceed ${max}`);
  }
}

/**
 * Guard against empty arrays
 */
export function guardAgainstEmptyArray<T>(
  value: T[],
  parameterName: string
): void {
  guardAgainstNullOrUndefined(value, parameterName);
  if (!Array.isArray(value) || value.length === 0) {
    throw new DomainError(`${parameterName} cannot be empty`);
  }
}

/**
 * Guard against invalid email format
 */
export function guardAgainstInvalidEmail(
  email: string,
  parameterName: string = 'email'
): void {
  guardAgainstEmptyString(email, parameterName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new DomainError(`${parameterName} must be a valid email address`);
  }
}

/**
 * Guard against invalid UUID format
 */
export function guardAgainstInvalidUuid(
  uuid: string,
  parameterName: string
): void {
  guardAgainstEmptyString(uuid, parameterName);
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new DomainError(`${parameterName} must be a valid UUID`);
  }
}
