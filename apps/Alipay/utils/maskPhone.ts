/** 11 位手机号 → 前 3 位 + ****** + 后 2 位 */
export function maskPhone(phone: string): string {
  if (/^1\d{10}$/.test(phone)) {
    return phone.slice(0, 3) + '******' + phone.slice(-2);
  }
  return phone;
}
