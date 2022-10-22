const responseErrors = {
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
