#!/usr/bin/env node
/**
 * 12306 反编译数据导入脚本
 *
 * 读取 decompiled/Mobileticket_decompiled/assets/ 中的 JSON 数据，
 * 清洗后输出到 apps/Railway12306/data/ 下的 JSON 文件。
 *
 * 用法: node scripts/import_12306_data.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DECOMPILED = resolve(ROOT, 'decompiled/Mobileticket_decompiled/assets');
const OUTPUT = resolve(ROOT, 'apps/Railway12306/data');

function readJson(filename) {
  return JSON.parse(readFileSync(resolve(DECOMPILED, filename), 'utf-8'));
}

function writeJson(filename, data) {
  writeFileSync(resolve(OUTPUT, filename), JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ ${filename} (${Array.isArray(data) ? data.length + ' 条' : 'object'})`);
}

// ─── 1. stationList.json ─────────────────────────────────────────────
function processStations() {
  const raw = readJson('stationList.json');
  const list = raw.stationList || [];

  // 过滤带空格的重复站名（如 "重  庆北" / "福  州" / "成  都东"）
  // 这些是12306特殊调度编码的站点，与正常站点重复
  const seen = new Map(); // name -> station
  const result = [];

  for (const s of list) {
    const name = s.value.trim();
    // 跳过名称包含空格的条目（这些是重复/特殊编码站点）
    if (/\s/.test(s.value)) {
      continue;
    }

    // 去重：同名站只保留第一个（station_class 更高的在前面）
    if (seen.has(name)) {
      continue;
    }
    seen.set(name, true);

    const pinyin = (s.py_code || '').toLowerCase();
    const station = {
      name,
      code: s.id,
      pinyin,
      shortPinyin: (s.first_code || '').toLowerCase(),
      initial: pinyin.charAt(0).toUpperCase(),
      cityCode: s.city_code || '',
      cityName: s.city_name || '',
      stationClass: parseInt(s.station_class, 10) || 0,
      sameCityCode: s.same_city_code || '0',
    };

    // 可选字段：经纬度
    if (s.latitude && s.longitute) {
      station.lat = parseFloat(s.latitude);
      station.lng = parseFloat(s.longitute);
    }

    // 可选字段：国际站点
    if (s.country_code) {
      station.countryCode = s.country_code;
      station.countryName = s.country_name || '';
    }

    result.push(station);
  }

  // 按 stationClass 降序、拼音升序排列
  result.sort((a, b) => {
    if (a.stationClass !== b.stationClass) return b.stationClass - a.stationClass;
    return a.pinyin.localeCompare(b.pinyin);
  });

  writeJson('stationList.json', result);
  return result;
}

// ─── 2. cities.json ──────────────────────────────────────────────────
function processCities() {
  const raw = readJson('cities.json');
  // 直接使用，结构已经是干净的 { hotCity: [...], cities: { A: [...], ... } }
  writeJson('cities.json', raw);
}

// ─── 3. cityList.json ────────────────────────────────────────────────
function processCityList() {
  const raw = readJson('cityList.json');
  const list = (raw.city || []).map(c => ({
    cityCode: c.city_code,
    cityName: c.city_name,
    cityShortPy: (c.city_short_py || '').toLowerCase(),
  }));
  writeJson('cityList.json', list);
}

// ─── 4. seatTypes.json ──────────────────────────────────────────────
function processSeatTypes() {
  const raw = readJson('seatType.json');
  const list = (raw.seatType || []).map(s => ({
    code: s.seat_type_code,
    name: s.seat_type_name,
  }));
  writeJson('seatTypes.json', list);
}

// ─── 5. seatTypesByTrain.json ───────────────────────────────────────
function processSeatTypesByTrain() {
  const raw = readJson('seatTypeList.json');
  const list = (raw.optionList || []).map(o => ({
    trainHeader: o.train_header,
    seatTypes: o.seat_types,
    displayFlag: o.display_flag,
  }));
  writeJson('seatTypesByTrain.json', list);
}

// ─── 6. ticketTypes.json ────────────────────────────────────────────
function processTicketTypes() {
  const raw = readJson('ticketTypeList.json');
  const list = (raw.ticketType || [])
    .filter(t => t.ticket_type_name) // 过滤空名称
    .map(t => ({
      code: t.ticket_type_code,
      name: t.ticket_type_name,
    }));
  writeJson('ticketTypes.json', list);
}

// ─── 7. cardTypes.json ──────────────────────────────────────────────
function processCardTypes() {
  const raw = readJson('cardTypeList.json');
  const list = (raw.cardType || []).map(c => ({
    code: c.card_type_code,
    name: c.card_type_name,
  }));
  writeJson('cardTypes.json', list);
}

// ─── 8. provinces.json ──────────────────────────────────────────────
function processProvinces() {
  const raw = readJson('provinceList.json');
  const list = (raw.provinceList || []).map(p => ({
    id: p.id,
    name: p.value,
  }));
  writeJson('provinces.json', list);
}

// ─── 9. stationServices.json ────────────────────────────────────────
function processStationServices() {
  const raw = readJson('stationServerList.json');
  // 结构: { jsbean: [{ station_name, station_service: ["担架","轮椅"] }] }
  const list = (raw.jsbean || []).map(s => ({
    stationName: s.station_name,
    services: s.station_service || [],
  }));
  writeJson('stationServices.json', list);
}

// ─── 10. countries.json ─────────────────────────────────────────────
function processCountries() {
  const raw = readJson('countryList.json');
  // 结构: { countryList: [{ value: "中国China", id: "CN", new_id: "CHN" }] }
  const list = (raw.countryList || []).map(c => ({
    code: c.id,
    code3: c.new_id,
    name: c.value,
  }));
  writeJson('countries.json', list);
}

// ─── Main ────────────────────────────────────────────────────────────
console.log('📥 开始导入 12306 反编译数据...\n');

mkdirSync(OUTPUT, { recursive: true });

const stations = processStations();
processCities();
processCityList();
processSeatTypes();
processSeatTypesByTrain();
processTicketTypes();
processCardTypes();
processProvinces();
processStationServices();
processCountries();

console.log(`\n✅ 完成！共导入 ${stations.length} 个车站，数据输出到 apps/Railway12306/data/`);
