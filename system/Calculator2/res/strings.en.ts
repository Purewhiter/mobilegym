import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  // Error messages — only these are language-relevant
  error_syntax: 'Syntax error',
  error_nan: 'Not a number',
  error_divide_by_zero: 'Cannot divide by zero',
};
