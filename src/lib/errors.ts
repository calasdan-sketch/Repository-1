/**
 * Application error hierarchy.
 *
 * Using typed errors lets the HTTP layer and job runners decide how to respond
 * (retry, surface to the user, or fail hard) without string-matching messages.
 */

/** Base class for all errors thrown by this application. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Configuration is missing or invalid (e.g. a required API key is unset). */
export class ConfigError extends AppError {}

/** An external API returned an error response. */
export class ExternalApiError extends AppError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/** A webhook or request failed signature/authentication verification. */
export class VerificationError extends AppError {}

/** A requested resource could not be found in the datastore. */
export class NotFoundError extends AppError {}
