/**
 * 视口感知工具：遮挡检测 + 条件性平移。
 *
 * 真机 Google Maps 行为：
 * - 选中地点后底部弹出 Sheet，仅当 Sheet 会遮挡标记时才移动视口
 * - 移动目标：将标记居中于"剩余可见区域"（视口 − Sheet 覆盖区域）
 */

const MARGIN_RATIO = 0.04;

function getMapDiv(map: google.maps.Map): HTMLElement | null {
  try {
    return map.getDiv() ?? null;
  } catch {
    return null;
  }
}

function getVisibleCenterYInMapCoords(map: google.maps.Map, sheetRatio: number) {
  const mapH = getMapDiv(map)?.clientHeight ?? 0;
  return mapH * (1 - sheetRatio) / 2;
}

function getVisibleCenterXInMapCoords(map: google.maps.Map) {
  const mapW = getMapDiv(map)?.clientWidth ?? 0;
  return mapW / 2;
}

function panLatLngToMapDivPoint(
  map: google.maps.Map,
  latLng: google.maps.LatLngLiteral,
  targetX: number,
  targetY: number,
): google.maps.LatLngLiteral {
  const projection = map.getProjection();
  const zoom = map.getZoom();
  const div = getMapDiv(map);
  if (!div) {
    map.panTo(latLng);
    return latLng;
  }

  const mapW = div.clientWidth;
  const mapH = div.clientHeight;
  if (
    !projection ||
    zoom == null ||
    mapW <= 0 ||
    mapH <= 0 ||
    targetX < 0 ||
    targetY < 0
  ) {
    map.panTo(latLng);
    return latLng;
  }

  const targetPoint = projection.fromLatLngToPoint(new google.maps.LatLng(latLng));
  if (!targetPoint) {
    map.panTo(latLng);
    return latLng;
  }

  const clampedTargetX = Math.max(0, Math.min(mapW, targetX));
  const clampedTargetY = Math.max(0, Math.min(mapH, targetY));
  const worldDeltaX = (mapW / 2 - clampedTargetX) / (2 ** zoom);
  const worldDeltaY = (mapH / 2 - clampedTargetY) / (2 ** zoom);

  const nextCenterPoint = new google.maps.Point(
    targetPoint.x + worldDeltaX,
    targetPoint.y + worldDeltaY,
  );
  const nextCenter = projection.fromPointToLatLng(nextCenterPoint);
  if (!nextCenter) {
    map.panTo(latLng);
    return latLng;
  }

  const center = { lat: nextCenter.lat(), lng: nextCenter.lng() };
  map.panTo(center);
  return center;
}

/**
 * 用 LatLng + map bounds 近似判断标记是否在 Sheet 遮挡区域。
 * 仅在无法获取 DOM clientY 时使用（如 Marker 组件 onClick 不暴露事件对象）。
 * 在城市级别缩放下 lat→screenY 近似线性，精度足够做遮挡判断。
 */
export function isLatLngOccludedBySheet(
  map: google.maps.Map,
  latLng: { lat: number; lng: number },
  sheetRatio: number,
): boolean {
  const bounds = map.getBounds();
  if (!bounds) return false;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const latRange = ne.lat() - sw.lat();
  if (latRange <= 0) return false;
  const sheetTopLat = sw.lat() + sheetRatio * latRange;
  const margin = latRange * MARGIN_RATIO;
  return latLng.lat < sheetTopLat + margin;
}

/**
 * 用 DOM 事件的 clientY 判断点击位置是否会被底部 Sheet 遮挡。
 * clientY 是浏览器原生屏幕坐标，不受任何 CSS zoom 影响。
 */
export function isClickOccludedBySheet(
  clickClientY: number,
  containerRect: DOMRect,
  sheetRatio: number,
): boolean {
  if (containerRect.height <= 0) return false;
  const relY = clickClientY - containerRect.top;
  const sheetTopScreen = containerRect.height * (1 - sheetRatio);
  const margin = containerRect.height * MARGIN_RATIO;
  return relY > sheetTopScreen - margin;
}

/**
 * 将标记从当前位置（地图中心）平移到"剩余可见区域"的中心。
 * 前提：调用前标记已在地图中心（通过 panTo 或 Google Maps 默认行为）。
 *
 * map.panBy() 使用的是地图 div 的内部 CSS 像素坐标系。
 * App 外层可能被 OS 用 CSS zoom 缩放，但这里全程使用 map div 的
 * clientWidth/clientHeight，因此不需要额外按全局视口比例换算。
 */
export function panMarkerToVisibleCenter(
  map: google.maps.Map,
  sheetRatio: number,
) {
  const div = getMapDiv(map);
  if (!div) return;
  const mapH = div.clientHeight;
  const mapW = div.clientWidth;
  if (mapH <= 0 || mapW <= 0 || sheetRatio <= 0) return;
  const visibleCenterXInMapCoords = getVisibleCenterXInMapCoords(map);
  const visibleCenterInMapCoords = getVisibleCenterYInMapCoords(map, sheetRatio);
  const currentMarkerXInMapCoords = mapW / 2;
  const currentMarkerYInMapCoords = mapH / 2;
  const deltaX = currentMarkerXInMapCoords - visibleCenterXInMapCoords;
  const deltaY = currentMarkerYInMapCoords - visibleCenterInMapCoords;
  map.panBy(deltaX, deltaY);
}

/**
 * 已知点击点在屏幕上的坐标时，直接一次性把该点移动到剩余可见区域中心。
 * 适用于地图 POI 点击、长按落点等“有原始 domEvent/clientX/clientY”的入口。
 */
export function panScreenPointToVisibleCenter(
  map: google.maps.Map,
  pointClientX: number,
  pointClientY: number,
  containerRect: DOMRect,
  sheetRatio: number,
) {
  const div = getMapDiv(map);
  const rect = div?.getBoundingClientRect() ?? containerRect;
  const mapW = div?.clientWidth ?? containerRect.width;
  const mapH = div?.clientHeight ?? containerRect.height;
  const screenToMapX = rect.width > 0 ? mapW / rect.width : 1;
  const screenToMapY = rect.height > 0 ? mapH / rect.height : 1;
  const relX = (pointClientX - rect.left) * screenToMapX;
  const relY = (pointClientY - rect.top) * screenToMapY;
  const targetX = mapW / 2;
  const targetY = mapH * (1 - sheetRatio) / 2;
  const deltaX = relX - targetX;
  const deltaY = relY - targetY;
  map.panBy(deltaX, deltaY);
}

export function clientPointToLatLng(
  map: google.maps.Map,
  pointClientX: number,
  pointClientY: number,
): google.maps.LatLngLiteral | null {
  const projection = map.getProjection();
  const zoom = map.getZoom();
  const center = map.getCenter();
  const div = getMapDiv(map);
  if (!projection || zoom == null || !center || !div) return null;

  const rect = div.getBoundingClientRect();
  const mapW = div.clientWidth;
  const mapH = div.clientHeight;
  if (rect.width <= 0 || rect.height <= 0 || mapW <= 0 || mapH <= 0) return null;

  const screenToMapX = mapW / rect.width;
  const screenToMapY = mapH / rect.height;
  const relX = (pointClientX - rect.left) * screenToMapX;
  const relY = (pointClientY - rect.top) * screenToMapY;
  const offsetX = relX - mapW / 2;
  const offsetY = relY - mapH / 2;

  const centerPoint = projection.fromLatLngToPoint(center);
  if (!centerPoint) return null;

  const scale = 2 ** zoom;
  const point = new google.maps.Point(
    centerPoint.x + offsetX / scale,
    centerPoint.y + offsetY / scale,
  );
  const latLng = projection.fromPointToLatLng(point);
  return latLng ? { lat: latLng.lat(), lng: latLng.lng() } : null;
}

/**
 * 已知目标地点的 LatLng 时，直接计算最终 center 并一次 panTo 到位。
 * 适用于搜索结果点击、程序化选点、没有原始点击坐标的 marker 点击等入口。
 */
export function panLatLngToVisibleCenter(
  map: google.maps.Map,
  latLng: google.maps.LatLngLiteral,
  sheetRatio: number,
): google.maps.LatLngLiteral {
  const div = getMapDiv(map);
  if (!div) {
    map.panTo(latLng);
    return latLng;
  }
  const mapW = div.clientWidth;
  const mapH = div.clientHeight;
  if (mapW <= 0 || mapH <= 0 || sheetRatio <= 0) {
    map.panTo(latLng);
    return latLng;
  }

  return panLatLngToMapDivPoint(
    map,
    latLng,
    getVisibleCenterXInMapCoords(map),
    getVisibleCenterYInMapCoords(map, sheetRatio),
  );
}

export function panLatLngToVisibleRectCenter(
  map: google.maps.Map,
  latLng: google.maps.LatLngLiteral,
  visibleRect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>,
): google.maps.LatLngLiteral {
  const div = getMapDiv(map);
  if (!div) {
    map.panTo(latLng);
    return latLng;
  }

  const mapRect = div.getBoundingClientRect();
  const mapW = div.clientWidth;
  const mapH = div.clientHeight;
  if (mapRect.width <= 0 || mapRect.height <= 0 || mapW <= 0 || mapH <= 0) {
    map.panTo(latLng);
    return latLng;
  }

  const targetClientX = (visibleRect.left + visibleRect.right) / 2;
  const targetClientY = (visibleRect.top + visibleRect.bottom) / 2;
  const targetX = (targetClientX - mapRect.left) * (mapW / mapRect.width);
  const targetY = (targetClientY - mapRect.top) * (mapH / mapRect.height);
  return panLatLngToMapDivPoint(map, latLng, targetX, targetY);
}

export function getMapVisibleRectAboveBottomSheet(
  map: google.maps.Map,
  sheetEl: HTMLElement | null,
  fallbackBottomInset = 0,
): Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'> | null {
  const div = getMapDiv(map);
  if (!div) return null;

  const mapRect = div.getBoundingClientRect();
  if (mapRect.width <= 0 || mapRect.height <= 0) return null;

  let bottom = mapRect.bottom;
  const sheetRect = sheetEl?.getBoundingClientRect();
  const sheetOverlapsMap =
    sheetRect &&
    sheetRect.width > 0 &&
    sheetRect.height > 0 &&
    sheetRect.right > mapRect.left &&
    sheetRect.left < mapRect.right &&
    sheetRect.top < mapRect.bottom &&
    sheetRect.bottom > mapRect.top;

  if (sheetOverlapsMap) {
    bottom = Math.min(bottom, Math.max(mapRect.top, sheetRect.top));
  }

  if (fallbackBottomInset > 0) {
    const rawSheetScale =
      sheetEl && sheetRect && sheetEl.offsetWidth > 0
        ? sheetRect.width / sheetEl.offsetWidth
        : mapRect.width / div.clientWidth;
    const sheetScale = Number.isFinite(rawSheetScale) && rawSheetScale > 0 ? rawSheetScale : 1;
    const expectedBottom = sheetRect?.bottom ?? mapRect.bottom;
    bottom = Math.min(
      bottom,
      Math.max(mapRect.top, expectedBottom - fallbackBottomInset * sheetScale),
    );
  }

  if (bottom <= mapRect.top) return null;
  return {
    left: mapRect.left,
    right: mapRect.right,
    top: mapRect.top,
    bottom,
  };
}

interface ApplySearchResultsViewportOptions {
  map: google.maps.Map;
  biasCenter?: google.maps.LatLng | null;
  locations: Array<google.maps.LatLng | google.maps.LatLngLiteral>;
  sheetRatio?: number;
  topPadding?: number;
  edgePadding?: number;
  maxZoom?: number;
  fitCount?: number;
}

/**
 * 搜索结果列表打开时的统一视口策略：
 * 1. 先用前几个结果 + bias center 做 fitBounds 保留真机缩放感
 * 2. 再把第一个结果校正到「去掉底部 sheet 后」的可见视口中心
 */
export function applySearchResultsViewport({
  map,
  biasCenter,
  locations,
  sheetRatio = 0.7,
  topPadding = 80,
  edgePadding = 20,
  maxZoom = 16,
  fitCount = 5,
}: ApplySearchResultsViewportOptions) {
  const validLocations = locations.filter((loc) => {
    const lat = typeof (loc as google.maps.LatLng).lat === 'function'
      ? (loc as google.maps.LatLng).lat()
      : (loc as google.maps.LatLngLiteral).lat;
    const lng = typeof (loc as google.maps.LatLng).lng === 'function'
      ? (loc as google.maps.LatLng).lng()
      : (loc as google.maps.LatLngLiteral).lng;
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  });
  if (!validLocations.length) return;

  const bounds = new google.maps.LatLngBounds();
  if (biasCenter) {
    bounds.extend(biasCenter);
  }
  validLocations.slice(0, fitCount).forEach((loc) => {
    bounds.extend(loc);
  });

  const containerDiv = getMapDiv(map);
  if (!containerDiv) return;
  const containerH = containerDiv.clientHeight;
  const sheetBottomPadding = Math.round(containerH * sheetRatio);
  map.fitBounds(bounds, {
    top: topPadding,
    bottom: sheetBottomPadding,
    left: edgePadding,
    right: edgePadding,
  });

  const firstLocation = validLocations[0];
  google.maps.event.addListenerOnce(map, 'idle', () => {
    const alignFirstResult = () => {
      const latLng = typeof (firstLocation as google.maps.LatLng).lat === 'function'
        ? {
            lat: (firstLocation as google.maps.LatLng).lat(),
            lng: (firstLocation as google.maps.LatLng).lng(),
          }
        : (firstLocation as google.maps.LatLngLiteral);
      panLatLngToVisibleCenter(map, latLng, sheetRatio);
    };

    const zoom = map.getZoom();
    if (zoom != null && zoom > maxZoom) {
      google.maps.event.addListenerOnce(map, 'idle', alignFirstResult);
      map.setZoom(maxZoom);
      return;
    }

    alignFirstResult();
  });
}

export interface SavedViewport {
  center: google.maps.LatLngLiteral;
  zoom: number;
}

export function captureViewport(map: google.maps.Map): SavedViewport | null {
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (!center || zoom == null) return null;
  return { center: { lat: center.lat(), lng: center.lng() }, zoom };
}

export function restoreViewport(map: google.maps.Map, saved: SavedViewport) {
  map.panTo(saved.center);
  map.setZoom(saved.zoom);
}
