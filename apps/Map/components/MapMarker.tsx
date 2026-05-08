import React, { useEffect } from 'react';
import { useMapStore, selectGoogle } from '../state';

interface MapMarkerProps {
  map: google.maps.Map | null;
  position: { lat: number; lng: number };
  title?: string;
  icon?: string | google.maps.Icon | google.maps.Symbol;
  onClick?: (event?: Event) => void;
  zIndex?: number;
}

function isIconObject(
  icon: string | google.maps.Icon | google.maps.Symbol,
): icon is google.maps.Icon {
  return typeof icon === 'object' && icon !== null && 'url' in icon && typeof (icon as google.maps.Icon).url === 'string';
}

function isSymbolObject(
  icon: string | google.maps.Icon | google.maps.Symbol,
): icon is google.maps.Symbol {
  return typeof icon === 'object' && icon !== null && 'path' in icon;
}

function createIconDom(icon: google.maps.Icon): Node {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:auto';
  const img = document.createElement('img');
  img.src = icon.url;
  img.alt = '';
  img.draggable = false;
  const w = icon.scaledSize?.width;
  const h = icon.scaledSize?.height;
  if (w != null) img.width = w;
  if (h != null) img.height = h;
  img.style.cssText = 'position:absolute;display:block';
  const ax = icon.anchor?.x ?? 0;
  const ay = icon.anchor?.y ?? 0;
  img.style.left = `${-ax}px`;
  img.style.top = `${-ay}px`;
  wrap.appendChild(img);
  return wrap;
}

function createSymbolDom(sym: google.maps.Symbol, maps: typeof google.maps): Node {
  const path = sym.path;
  const scale = sym.scale ?? 1;
  const fill = sym.fillColor ?? '#4285F4';
  const stroke = sym.strokeColor ?? '#ffffff';
  const strokeW = sym.strokeWeight ?? 0;

  if (path === maps.SymbolPath.CIRCLE) {
    const size = Math.max(8, scale * 2);
    const div = document.createElement('div');
    div.style.cssText = [
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:50%',
      `background-color:${fill}`,
      strokeW ? `border:${strokeW}px solid ${stroke}` : 'border:none',
      'box-sizing:border-box',
      'transform:translate(-50%,-50%)',
    ].join(';');
    return div;
  }

  const d = typeof path === 'string' ? path : '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '48');
  svg.setAttribute('height', '48');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.style.cssText = 'transform:translate(-50%,-50%);overflow:visible';
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', d);
  pathEl.setAttribute('fill', fill);
  if (strokeW > 0) {
    pathEl.setAttribute('stroke', stroke);
    pathEl.setAttribute('stroke-width', String(strokeW));
  }
  pathEl.setAttribute('transform', `scale(${scale})`);
  svg.appendChild(pathEl);
  return svg;
}

async function buildMarkerContent(
  maps: typeof google.maps,
  markerLib: google.maps.MarkerLibrary,
  icon: string | google.maps.Icon | google.maps.Symbol | undefined,
): Promise<Node> {
  const { PinElement } = markerLib;

  if (icon === undefined) {
    return new PinElement({
      background: '#EA4335',
      borderColor: '#ffffff',
      glyphColor: '#ffffff',
      scale: 1.05,
    });
  }

  if (typeof icon === 'string') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'transform:translate(-50%,-100%)';
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    img.draggable = false;
    wrap.appendChild(img);
    return wrap;
  }

  if (isIconObject(icon)) {
    return createIconDom(icon);
  }

  if (isSymbolObject(icon)) {
    return createSymbolDom(icon, maps);
  }

  return new PinElement({ background: '#EA4335', borderColor: '#fff', scale: 1.05 });
}

export const MapMarker: React.FC<MapMarkerProps> = ({
  map,
  position,
  title,
  icon,
  onClick,
  zIndex,
}) => {
  const google = useMapStore(selectGoogle);

  useEffect(() => {
    if (!google || !map) return;

    let cancelled = false;
    let markerEl: google.maps.marker.AdvancedMarkerElement | null = null;
    let boundClickHandler: EventListener | null = null;

    void (async () => {
      const markerLib = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;
      if (cancelled || !map) return;

      const content = await buildMarkerContent(google.maps, markerLib, icon);
      if (cancelled) return;

      const m = new markerLib.AdvancedMarkerElement({
        map,
        position,
        title,
        content,
        zIndex: zIndex ?? undefined,
        gmpClickable: !!onClick,
      });

      if (cancelled) {
        m.map = null;
        return;
      }

      if (onClick) {
        boundClickHandler = (event: Event) => onClick(event);
        m.addEventListener('gmp-click', boundClickHandler);
      }

      if (cancelled) {
        if (boundClickHandler) m.removeEventListener('gmp-click', boundClickHandler);
        m.map = null;
        return;
      }

      markerEl = m;
    })();

    return () => {
      cancelled = true;
      if (markerEl) {
        if (boundClickHandler) markerEl.removeEventListener('gmp-click', boundClickHandler);
        markerEl.map = null;
        markerEl = null;
      }
    };
  }, [google, map, position.lat, position.lng, title, icon, onClick, zIndex]);

  return null;
};
