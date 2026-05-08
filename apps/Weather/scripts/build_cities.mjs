#!/usr/bin/env node
/**
 * Weather App 的可搜索城市数据生成工具。
 * 从 Railway12306 参考城市与车站数据生成 searchableCities.json。
 *
 * 用法: node apps/Weather/scripts/build_cities.mjs
 * 输出: apps/Weather/data/searchableCities.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const ROOT = resolve(APP_DIR, '../..');

const ADCODE_TO_PROVINCE = {
  '11': '北京', '12': '天津', '13': '河北', '14': '山西', '15': '内蒙古',
  '21': '辽宁', '22': '吉林', '23': '黑龙江',
  '31': '上海', '32': '江苏', '33': '浙江', '34': '安徽', '35': '福建',
  '36': '江西', '37': '山东',
  '41': '河南', '42': '湖北', '43': '湖南', '44': '广东', '45': '广西',
  '46': '海南',
  '50': '重庆', '51': '四川', '52': '贵州', '53': '云南', '54': '西藏',
  '61': '陕西', '62': '甘肃', '63': '青海', '64': '宁夏', '65': '新疆',
  '71': '台湾', '81': '香港', '82': '澳门',
};

// 某些城市名不带"市"后缀的特殊情况
const NO_CITY_SUFFIX = new Set([
  '香港', '澳门',
  // 自治州/地区/盟等非"市"单位在 cities.json 中已带完整名称
]);

function needsCitySuffix(name) {
  if (NO_CITY_SUFFIX.has(name)) return false;
  if (name.endsWith('市') || name.endsWith('州') || name.endsWith('地区') ||
      name.endsWith('盟') || name.endsWith('林区') || name.endsWith('区') ||
      name.endsWith('县')) return false;
  return true;
}

// 1. 读取数据
const citiesJson = JSON.parse(readFileSync(resolve(ROOT, 'apps/Railway12306/data/reference/cities.json'), 'utf-8'));
const stationList = JSON.parse(readFileSync(resolve(ROOT, 'apps/Railway12306/data/reference/stationList.json'), 'utf-8'));

// 2. 从 stationList 构建 cityName → 最高等级车站的 {lat, lng} 映射
const cityCoords = new Map();
for (const s of stationList) {
  if (s.lat == null || s.lng == null) continue;
  const existing = cityCoords.get(s.cityName);
  if (!existing || s.stationClass > existing.stationClass) {
    cityCoords.set(s.cityName, { lat: s.lat, lng: s.lng, stationClass: s.stationClass });
  }
}

// 3. 从 cities.json 提取所有城市（去重 hot 与字母分组的重复）
const seen = new Set();
const allCities = [];

for (const [key, items] of Object.entries(citiesJson)) {
  if (!Array.isArray(items)) continue;
  for (const city of items) {
    if (seen.has(city.adcode)) continue;
    seen.add(city.adcode);
    allCities.push(city);
  }
}

// 4. 合成结果
const results = [];
let noCoords = 0;

for (const city of allCities) {
  const adcodePrefix = city.adcode.substring(0, 2);
  const adm1 = ADCODE_TO_PROVINCE[adcodePrefix];
  if (!adm1) {
    console.warn(`未知 adcode 前缀: ${city.adcode} (${city.name})`);
    continue;
  }

  const displayName = needsCitySuffix(city.name) ? city.name + '市' : city.name;

  // 尝试匹配坐标：先用原始名（不带市），再用带"市"的名
  let coords = cityCoords.get(city.name) || cityCoords.get(displayName);

  // 部分城市名在 stationList 中可能有变体
  if (!coords) {
    // 自治州等名称可能只有前面部分匹配
    for (const [stCityName, stCoords] of cityCoords) {
      if (city.name.startsWith(stCityName) || stCityName.startsWith(city.name)) {
        coords = stCoords;
        break;
      }
    }
  }

  if (!coords) {
    noCoords++;
    continue;
  }

  const id = city.pinyin;
  const adm2 = displayName;

  results.push({
    id,
    name: displayName,
    adm1,
    adm2,
    pinyin: city.pinyin,
    lon: Math.round(coords.lng * 10000) / 10000,
    lat: Math.round(coords.lat * 10000) / 10000,
  });
}

// 按拼音排序
results.sort((a, b) => a.pinyin.localeCompare(b.pinyin));

console.log(`总计生成 ${results.length} 个城市（${noCoords} 个因缺少坐标被跳过）`);

// 5. 写入
const outPath = resolve(APP_DIR, 'data/searchableCities.json');
writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n', 'utf-8');
console.log(`已写入: ${outPath}`);
