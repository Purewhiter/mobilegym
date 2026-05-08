export const strings = {
  // Error messages
  error_syntax: '格式错误', // [CHAR_LIMIT=14]
  error_nan: '非数字', // [CHAR_LIMIT=14]
  error_divide_by_zero: '除数不能为零', // [CHAR_LIMIT=14]

  // Functions
  fun_sin: 'sin', // [CHAR_LIMIT=3]
  fun_cos: 'cos',
  fun_tan: 'tan',
  fun_ln: 'ln',
  fun_log: 'log',

  // Operations / buttons
  clr: 'clr', // [CHAR_LIMIT=3]
  del: 'del', // [CHAR_LIMIT=3]
  decimal: '.', // [CHAR_LIMIT=1]
  equals: '=', // [CHAR_LIMIT=1]

  op_div: '÷', // [CHAR_LIMIT=1]
  op_mul: '×', // [CHAR_LIMIT=1]
  op_sub: '−', // [CHAR_LIMIT=1]
  op_add: '+', // [CHAR_LIMIT=1]
  op_fact: '!', // [CHAR_LIMIT=1]
  op_pow: '^', // [CHAR_LIMIT=1]
  op_sqrt: '√', // [CHAR_LIMIT=1]

  const_pi: 'π', // [CHAR_LIMIT=1]
  const_e: 'e', // [CHAR_LIMIT=1]

  paren_left: '(', // [CHAR_LIMIT=1]
  paren_right: ')', // [CHAR_LIMIT=1]
} as const;

export type StringKey = keyof typeof strings;
