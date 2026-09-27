export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, "validation_error", message);
  }
}

export class AuthError extends HttpError {
  constructor(message = "Not authenticated") {
    super(401, "unauthorized", message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Not permitted") {
    super(403, "forbidden", message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, "not_found", message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, "conflict", message);
  }
}
