import { HttpErrorResponse } from '@angular/common/http';
import { Schema } from 'effect';
import { firstValueFrom, type Observable } from 'rxjs';

interface CodedFailure {
  readonly code: string;
}

export interface ApiRequestFailure {
  readonly cause: unknown;
}

export type ApiFailure<Failure extends CodedFailure, Fallback extends string> = {
  readonly success: false;
  readonly code: Failure['code'] | Fallback;
  readonly failure?: Failure;
  readonly status?: number;
  readonly serverError?: unknown;
  readonly cause?: unknown;
};

export type ApiOutcome<Success, Failure extends CodedFailure, Fallback extends string> =
  | { readonly success: true; readonly result: Success }
  | ApiFailure<Failure, Fallback>;

export const decodeApiFailure = <Failure extends CodedFailure, Fallback extends string>(
  requestFailure: ApiRequestFailure,
  failureSchema: Schema.ConstraintDecoder<Failure>,
  fallback: Fallback,
): ApiFailure<Failure, Fallback> => {
  const error = requestFailure.cause;
  const status = error instanceof HttpErrorResponse ? error.status : undefined;
  const serverError = error instanceof HttpErrorResponse ? error.error : undefined;

  if (error instanceof HttpErrorResponse) {
    const decoded = Schema.decodeUnknownOption(failureSchema)(serverError);
    if (decoded._tag === 'Some') {
      return {
        success: false,
        code: decoded.value.code,
        failure: decoded.value,
        status,
        serverError,
        cause: error,
      };
    }
  }

  return { success: false, code: fallback, status, serverError, cause: error };
};

export const requestOutcome = async <
  Success,
  Failure extends CodedFailure,
  Fallback extends string,
>(
  source: Observable<unknown>,
  successSchema: Schema.ConstraintDecoder<Success>,
  failureSchema: Schema.ConstraintDecoder<Failure>,
  fallback: Fallback,
): Promise<ApiOutcome<Success, Failure, Fallback>> => {
  try {
    return {
      success: true,
      result: Schema.decodeUnknownSync(successSchema)(await firstValueFrom(source)),
    };
  } catch (error) {
    return decodeApiFailure({ cause: error }, failureSchema, fallback);
  }
};
