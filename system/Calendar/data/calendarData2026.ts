/**
 * Comprehensive Chinese Lunar Calendar data (1900–2100).
 *
 * The core lookup table is extracted from decompiled calendar resources.
 *
 * Each 16-bit entry encodes one lunar year:
 *   bits 15-4 (12 bits): month-length flags, bit=1→30 days, bit=0→29 days
 *                         bit 15=month 1, bit 14=month 2 … bit 4=month 12
 *   bits 3-0  (4 bits) : leap-month indicator
 *                         0x0 = no leap month
 *                         1-12 = that month is doubled (leap)
 *                         0xf  = no leap month (alternate encoding)
 *
 * Solar terms, public holidays, Chinese festivals and the 2026 work/rest
 * schedule are included alongside.
 */

import defaults from './defaults.json';
import * as TimeService from '@/os/TimeService';

// ============================================================
//  201-year lunar data table (1900-2100)
//  Extracted from Calendar_decompiled smali
// ============================================================
// Standard 20-bit encoding verified by solarlunar / calendar.js (1900-2100):
//   bit 16 (0x10000): leap month 30 days (1) or 29 days (0)
//   bits 15-4:        months 1-12 day lengths (bit15=M1, 1=30d 0=29d)
//   bits 3-0:         leap month number (0=none, 1-12=which month)
const LUNAR_INFO: number[] = defaults.lunarInfo;

const BASE_YEAR = 1900;

// ============================================================
//  Lunar calendar computation
// ============================================================

/** Leap month for a given lunar year (0 = none, 1-12 = which month) */
function leapMonth(year: number): number {
    const d = LUNAR_INFO[year - BASE_YEAR] & 0xf;
    return d === 0xf ? 0 : d;
}

/** Number of days in a normal month (29 or 30) */
function monthDays(year: number, month: number): number {
    // 0x10000 >> month: month=1 → bit 15, month=12 → bit 4
    return (LUNAR_INFO[year - BASE_YEAR] & (0x10000 >> month)) ? 30 : 29;
}

/** Number of days in the leap month (0 if no leap) */
function leapDays(year: number): number {
    if (!leapMonth(year)) return 0;
    // bit 16 (0x10000): 1 = 30 days, 0 = 29 days
    return (LUNAR_INFO[year - BASE_YEAR] & 0x10000) ? 30 : 29;
}

/** Total days in a lunar year */
function yearDays(year: number): number {
    let total = 0;
    for (let m = 1; m <= 12; m++) total += monthDays(year, m);
    total += leapDays(year);
    return total;
}

export interface LunarDateResult {
    lunarYear: number;
    lunarMonth: number;
    lunarDay: number;
    isLeapMonth: boolean;
    monthName: string;
    dayLabel: string;
}

/**
 * Convert a Gregorian date to Chinese lunar date.
 * Uses the classic algorithm proven in calendar.js (Jjonline).
 * Works for 1900-01-31 to 2100-12-31.
 */
export function toLunar(date: Date): LunarDateResult {
    const y = date.getFullYear();
    const m = date.getMonth(); // 0-based
    const d = date.getDate();

    // Offset in days from the epoch: Jan 31, 1900 = 正月初一 of lunar 1900
    let offset = Math.round(
        (Date.UTC(y, m, d) - Date.UTC(1900, 0, 31)) / 86400000
    );

    if (offset < 0) {
        return { lunarYear: 1900, lunarMonth: 1, lunarDay: 1, isLeapMonth: false, monthName: '正月', dayLabel: '初一' };
    }

    // --- Find lunar year ---
    let i: number;
    let temp = 0;
    for (i = 1900; i < 2101 && offset > 0; i++) {
        temp = yearDays(i);
        offset -= temp;
    }
    if (offset < 0) {
        offset += temp;
        i--;
    }
    const lunarYear = i;

    // --- Find lunar month ---
    const leap = leapMonth(lunarYear);
    let isLeapMonth = false;

    for (i = 1; i < 13 && offset > 0; i++) {
        // Leap month inserts after the regular month
        if (leap > 0 && i === leap + 1 && !isLeapMonth) {
            --i;
            isLeapMonth = true;
            temp = leapDays(lunarYear);
        } else {
            temp = monthDays(lunarYear, i);
        }
        // After processing the leap month, clear the flag
        if (isLeapMonth && i === leap + 1) {
            isLeapMonth = false;
        }
        offset -= temp;
    }

    // Edge case: offset lands exactly on start of leap month
    if (offset === 0 && leap > 0 && i === leap + 1) {
        if (isLeapMonth) {
            isLeapMonth = false;
        } else {
            isLeapMonth = true;
            --i;
        }
    }

    if (offset < 0) {
        offset += temp;
        --i;
    }

    const lunarMonth = i;
    const lunarDay = offset + 1;

    return {
        lunarYear,
        lunarMonth,
        lunarDay,
        isLeapMonth,
        monthName: lunarMonthName(lunarMonth, isLeapMonth),
        dayLabel: lunarDayLabel(lunarDay),
    };
}

// ============================================================
//  Display labels
// ============================================================
const MONTH_NAMES: Record<number, string> = {
    1: '正月', 2: '二月', 3: '三月', 4: '四月',
    5: '五月', 6: '六月', 7: '七月', 8: '八月',
    9: '九月', 10: '十月', 11: '冬月', 12: '腊月',
};

function lunarMonthName(month: number, isLeap: boolean): string {
    return (isLeap ? '闰' : '') + (MONTH_NAMES[month] || `${month}月`);
}

const DAY_LABELS = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

export function lunarDayLabel(day: number): string {
    if (day < 1 || day > 30) return '';
    return DAY_LABELS[day - 1];
}

// ============================================================
//  Heavenly Stems & Earthly Branches (天干地支)
// ============================================================
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI   = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

export function ganZhiYear(lunarYear: number) {
    const idx = (lunarYear - 4) % 60;
    return TIAN_GAN[idx % 10] + DI_ZHI[idx % 12];
}

export function zodiacAnimal(lunarYear: number) {
    return SHENG_XIAO[(lunarYear - 4) % 12];
}

// ============================================================
//  Solar Terms (节气) — approximate algorithm
//  Good to ±1 day for 1900-2100
// ============================================================
const SOLAR_TERM_NAMES = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
    '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
    '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
    '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

// Average Julian day offsets for each solar term (from year start)
const SOLAR_TERM_BASE = [
    5.4055, 20.12, 3.87, 18.73, 5.63, 20.646,
    4.81, 20.1, 5.52, 21.04, 5.678, 21.37,
    7.108, 22.83, 7.5, 23.13, 7.646, 23.042,
    8.318, 23.438, 7.438, 22.36, 7.18, 21.94,
];

/**
 * Get all solar terms for a given year as a map of "MM-DD" → name.
 */
export function getSolarTerms(year: number): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < 24; i++) {
        const monthIdx = Math.floor(i / 2); // 0=Jan, 1=Feb, ...
        const month = monthIdx; // 0-based
        const baseDay = SOLAR_TERM_BASE[i];
        // Century adjustment
        const centuryOffset = (year >= 2000) ? -0.1 : 0;
        const day = Math.floor(baseDay + centuryOffset + 0.5);
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        result[`${mm}-${dd}`] = SOLAR_TERM_NAMES[i];
    }
    return result;
}

// ============================================================
//  Public holidays (公历固定节日) — same every year
// ============================================================
export const PUBLIC_HOLIDAYS: Record<string, string> = {
    '01-01': '元旦',
    '02-14': '情人节',
    '03-08': '妇女节',
    '03-12': '植树节',
    '04-01': '愚人节',
    '05-01': '劳动节',
    '05-04': '青年节',
    '06-01': '儿童节',
    '07-01': '建党节',
    '08-01': '建军节',
    '09-10': '教师节',
    '10-01': '国庆节',
    '12-25': '圣诞节',
};

// ============================================================
//  Chinese traditional festivals (农历 → festival name)
// ============================================================
export const LUNAR_FESTIVALS: Record<string, string> = {
    '1-1':   '春节',
    '1-15':  '元宵节',
    '2-2':   '龙抬头',
    '5-5':   '端午节',
    '7-7':   '七夕',
    '7-15':  '中元节',
    '8-15':  '中秋节',
    '9-9':   '重阳节',
    '12-8':  '腊八',
    '12-23': '北方小年',
    '12-24': '南方小年',
};

// ============================================================
//  Work / Rest schedule (2026 only — announced yearly)
// ============================================================
export const WORK_REST_2026: Record<string, 'work' | 'rest'> = {
    '01-01': 'rest', '01-02': 'rest', '01-03': 'rest',
    '01-04': 'work',
    '02-14': 'work',
    '02-15': 'rest', '02-16': 'rest', '02-17': 'rest', '02-18': 'rest',
    '02-19': 'rest', '02-20': 'rest', '02-21': 'rest', '02-22': 'rest', '02-23': 'rest',
    '02-28': 'work',
    '04-04': 'rest', '04-05': 'rest', '04-06': 'rest',
    '05-01': 'rest', '05-02': 'rest', '05-03': 'rest', '05-04': 'rest', '05-05': 'rest',
    '05-09': 'work',
    '06-19': 'rest', '06-20': 'rest', '06-21': 'rest',
    '09-20': 'work',
    '09-25': 'rest', '09-26': 'rest', '09-27': 'rest',
    '10-01': 'rest', '10-02': 'rest', '10-03': 'rest', '10-04': 'rest',
    '10-05': 'rest', '10-06': 'rest', '10-07': 'rest',
    '10-10': 'work',
};

// ============================================================
//  数九 computation (from 冬至)
// ============================================================
function getShujiu(year: number): Record<string, string> {
    // 冬至 of the previous year
    const terms = getSolarTerms(year - 1);
    let dongzhiDay = 22; // default Dec 22
    for (const [key, name] of Object.entries(terms)) {
        if (name === '冬至') {
            dongzhiDay = parseInt(key.split('-')[1]);
            break;
        }
    }
    const dongzhi = TimeService.fromLocalParts(year - 1, 11, dongzhiDay);

    const result: Record<string, string> = {};
    const labels = ['', '', '三九', '四九', '五九', '六九', '冬七九', '冬八九', '冬九九'];

    for (let i = 2; i <= 8; i++) {
        const d = TimeService.fromTimestamp(dongzhi.getTime());
        d.setDate(dongzhi.getDate() + i * 9);
        if (d.getFullYear() === year) {
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            result[`${mm}-${dd}`] = labels[i];
        }
    }
    return result;
}

// ============================================================
//  Main API: get full display info for any date
// ============================================================
export interface CalendarDateInfo {
    label: string;
    isFestival: boolean;
    isSolarTerm: boolean;
    isSpecial: boolean;
    isWorkDay: boolean;
    isRestDay: boolean;
    isHoliday: boolean;
    lunarMonth: number;
    lunarDay: number;
    monthName: string;
    lunarYear: number;
}

// Cache solar terms per year
const solarTermCache = new Map<number, Record<string, string>>();
const shujiuCache = new Map<number, Record<string, string>>();

function getCachedSolarTerms(year: number) {
    if (!solarTermCache.has(year)) solarTermCache.set(year, getSolarTerms(year));
    return solarTermCache.get(year)!;
}

function getCachedShujiu(year: number) {
    if (!shujiuCache.has(year)) shujiuCache.set(year, getShujiu(year));
    return shujiuCache.get(year)!;
}

export function getCalendarDateInfo(date: Date): CalendarDateInfo {
    const year = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateKey = `${mm}-${dd}`;

    // Lunar date
    const lunar = toLunar(date);
    const lunarKey = `${lunar.lunarMonth}-${lunar.lunarDay}`;

    let label = lunar.dayLabel;
    let isFestival = false;
    let isSolarTerm = false;
    let isSpecial = false;

    // Show month name on 初一
    if (lunar.lunarDay === 1) {
        label = lunar.monthName;
        isSpecial = true;
    }

    // Lunar festivals (highest priority for label)
    const lunarFest = LUNAR_FESTIVALS[lunarKey];
    if (lunarFest && !lunar.isLeapMonth) {
        label = lunarFest;
        isFestival = true;
        isSpecial = true;
    }

    // 除夕: last day of 腊月
    if (lunar.lunarMonth === 12 && !lunar.isLeapMonth) {
        const daysInMonth = monthDays(lunar.lunarYear, 12);
        if (lunar.lunarDay === daysInMonth) {
            label = '除夕';
            isFestival = true;
            isSpecial = true;
        }
    }

    // Solar terms
    const terms = getCachedSolarTerms(year);
    const term = terms[dateKey];
    if (term) {
        if (!isFestival) label = term;
        isSolarTerm = true;
        isSpecial = true;
    }

    // Public holidays (lowest label priority)
    const pubHol = PUBLIC_HOLIDAYS[dateKey];
    if (pubHol && !isFestival && !isSolarTerm) {
        label = pubHol;
        isFestival = true;
        isSpecial = true;
    }

    // 数九
    if (!isSpecial) {
        const shujiu = getCachedShujiu(year);
        const sj = shujiu[dateKey];
        if (sj) {
            label = sj;
            isSpecial = true;
        }
    }

    // Work / Rest (2026 only)
    const wr = year === 2026 ? WORK_REST_2026[dateKey] : undefined;
    const isWorkDay = wr === 'work';
    const isRestDay = wr === 'rest';

    return {
        label,
        isFestival,
        isSolarTerm,
        isSpecial,
        isWorkDay,
        isRestDay,
        isHoliday: isRestDay,
        lunarMonth: lunar.lunarMonth,
        lunarDay: lunar.lunarDay,
        monthName: lunar.monthName,
        lunarYear: lunar.lunarYear,
    };
}

// ============================================================
//  Convenience: full lunar info for agenda panel
// ============================================================
export function resolveLunarDate(date: Date) {
    return toLunar(date);
}
