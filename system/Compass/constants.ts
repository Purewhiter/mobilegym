/**
 * Compass App 常量/纯计算工具
 *
 * 说明：
 * - 这些函数不依赖运行时环境，属于“常量层/工具层”，不应与默认数据混在一起。
 */

export interface DirectionLabels {
  north: string;
  northeast: string;
  east: string;
  southeast: string;
  south: string;
  southwest: string;
  west: string;
  northwest: string;
}

const DEFAULT_DIRECTION_LABELS: DirectionLabels = {
  north: '北',
  northeast: '东北',
  east: '东',
  southeast: '东南',
  south: '南',
  southwest: '西南',
  west: '西',
  northwest: '西北',
};

/** 根据朝向角度计算方向文字 */
export function getDirectionText(deg: number, labels: DirectionLabels = DEFAULT_DIRECTION_LABELS): string {
  // 归一化到 [0, 360)
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return labels.north;
  if (normalized < 67.5) return labels.northeast;
  if (normalized < 112.5) return labels.east;
  if (normalized < 157.5) return labels.southeast;
  if (normalized < 202.5) return labels.south;
  if (normalized < 247.5) return labels.southwest;
  if (normalized < 292.5) return labels.west;
  return labels.northwest;
}

/** 将十进制度数格式化为度分秒 (DMS) 显示 */
export function formatDMS(decimal: number): string {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  return `${degrees}°${minutes}'${seconds}"`;
}

/** 根据经纬度计算显示标签和值 */
export function formatLatLon(
  latitude: number,
  longitude: number,
  labels?: { latNorth: string; latSouth: string; lonEast: string; lonWest: string },
) {
  const latNorth = labels?.latNorth ?? '北纬';
  const latSouth = labels?.latSouth ?? '南纬';
  const lonEast = labels?.lonEast ?? '东经';
  const lonWest = labels?.lonWest ?? '西经';
  return {
    latLabel: latitude >= 0 ? latNorth : latSouth,
    latValue: formatDMS(latitude),
    lonLabel: longitude >= 0 ? lonEast : lonWest,
    lonValue: formatDMS(longitude),
  };
}

