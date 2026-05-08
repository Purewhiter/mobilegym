const BANK_NAME_REPLACEMENTS: Array<[string, string]> = [
  ['\u4e2d\u56fd\u5efa\u8bbe\u94f6\u884c', 'China Construction Bank'],
  ['\u5efa\u8bbe\u94f6\u884c', 'China Construction Bank'],
  ['\u4e2d\u56fd\u5de5\u5546\u94f6\u884c', 'Industrial and Commercial Bank of China'],
  ['\u5de5\u5546\u94f6\u884c', 'Industrial and Commercial Bank of China'],
  ['\u4e2d\u56fd\u519c\u4e1a\u94f6\u884c', 'Agricultural Bank of China'],
  ['\u519c\u4e1a\u94f6\u884c', 'Agricultural Bank of China'],
  ['\u4e2d\u56fd\u94f6\u884c', 'Bank of China'],
  ['\u62db\u5546\u94f6\u884c', 'China Merchants Bank'],
  ['\u4ea4\u901a\u94f6\u884c', 'Bank of Communications'],
  ['\u4e2d\u56fd\u90ae\u653f\u50a8\u84c4\u94f6\u884c', 'Postal Savings Bank of China'],
  ['\u90ae\u653f\u50a8\u84c4\u94f6\u884c', 'Postal Savings Bank of China'],
  ['\u5e73\u5b89\u94f6\u884c', 'Ping An Bank'],
  ['\u4e2d\u4fe1\u94f6\u884c', 'China CITIC Bank'],
  ['\u6d66\u53d1\u94f6\u884c', 'SPD Bank'],
  ['\u4e2d\u56fd\u6c11\u751f\u94f6\u884c', 'China Minsheng Bank'],
  ['\u6c11\u751f\u94f6\u884c', 'China Minsheng Bank'],
  ['\u5e7f\u53d1\u94f6\u884c', 'China Guangfa Bank'],
  ['\u5174\u4e1a\u94f6\u884c', 'Industrial Bank'],
  ['\u4e2d\u56fd\u5149\u5927\u94f6\u884c', 'China Everbright Bank'],
  ['\u5149\u5927\u94f6\u884c', 'China Everbright Bank'],
  ['\u534e\u590f\u94f6\u884c', 'Huaxia Bank'],
  ['\u50a8\u84c4\u5361', 'Debit Card'],
  ['\u4fe1\u7528\u5361', 'Credit Card'],
  ['\u94f6\u884c\u5361', 'Bank Card'],
];

function isMostlyAscii(value: string): boolean {
  return /^[\x00-\x7F\s]*$/.test(value);
}

export function localizeBankName(name: string, isEnglish: boolean): string {
  const raw = String(name || '').trim();
  if (!raw) return isEnglish ? 'Bank Card' : '\u94f6\u884c\u5361';
  if (!isEnglish || isMostlyAscii(raw)) return raw;

  let result = raw;
  for (const [zh, en] of BANK_NAME_REPLACEMENTS) {
    result = result.split(zh).join(en);
  }
  return result || 'Bank Card';
}
