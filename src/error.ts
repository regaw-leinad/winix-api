export class RateLimitError extends Error {
  constructor() {
    super('Rate limited by Winix API');
    this.name = 'RateLimitError';
  }
}

export class NoDataError extends Error {
  constructor() {
    super('no data (invalid or unregistered device?)');
    this.name = 'NoDataError';
  }
}

export class MobileSessionInvalidError extends Error {
  constructor(
    public readonly resultCode: string,
    public readonly resultMessage: string,
    public readonly httpStatus: number,
    url: string,
  ) {
    super(`${url} failed (HTTP ${httpStatus}, resultCode=${resultCode}): ${resultMessage}`);
    this.name = 'MobileSessionInvalidError';
  }
}

type ErrorMessages = {
  [key: string]: { x: boolean; displayName?: string };
};

const responseErrors: ErrorMessages = {
  'no data': { x: true, displayName: 'no data (invalid or unregistered device?)' },
  'parameter(s) not valid : device id': { x: true },
  'device not registered': { x: true },
  'device not connected': { x: true },
};

export const isResponseError = (possibleError: string): boolean => {
  return possibleError in responseErrors;
};

export const getErrorMessage = (possibleError: string): string => {
  const error = responseErrors[possibleError];

  if (!error || !error.displayName) {
    return possibleError;
  }

  return error.displayName;
};

export const isMobileSessionInvalid = (httpStatus: number, resultCode: string | undefined): boolean => {
  if (httpStatus !== 400) {
    return false;
  }
  return resultCode === '400' || resultCode === '900';
};
