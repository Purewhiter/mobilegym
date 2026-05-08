import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useMapStore, selectIsLoaded, selectLoadError, selectGoogle } from '../state';
import { manifest } from '../manifest';
import { GOOGLE_MAP_VECTOR_MAP_ID } from '../constants';
import { SIMULATOR_CONFIG } from '@/os/data';
const { viewportWidth } = SIMULATOR_CONFIG.framework;

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom: number;
  className?: string;
  onMapLoad?: (map: google.maps.Map) => void;
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onLongPress?: (e: google.maps.MapMouseEvent) => void;
  onIdle?: (map: google.maps.Map) => void;
  options?: google.maps.MapOptions;
}

/**
 * Compute inverse zoom to cancel out the OS-level design viewport zoom.
 * Google Maps manages its own coordinate system and doesn't handle
 * ancestor CSS zoom correctly, causing click position offsets.
 */
function useDesignZoomCompensation() {
  return useMemo(() => {
    const dvw = manifest.designViewportWidth;
    const vw = viewportWidth ?? 360;
    if (!dvw || dvw <= 0 || dvw === vw) return null;
    const designZoom = vw / dvw; // what OS applies (e.g. 360/412 ≈ 0.874)
    return {
      inverseZoom: 1 / designZoom, // e.g. 412/360 ≈ 1.144
    };
  }, []);
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
  center,
  zoom,
  className,
  onMapLoad,
  onClick,
  onLongPress,
  onIdle,
  options,
}) => {
  const isLoaded = useMapStore(selectIsLoaded);
  const loadError = useMapStore(selectLoadError);
  const google = useMapStore(selectGoogle);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const zoomComp = useDesignZoomCompensation();
  const onClickRef = useRef(onClick);
  const onLongPressRef = useRef(onLongPress);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onClickRef.current = onClick;
    onLongPressRef.current = onLongPress;
    onIdleRef.current = onIdle;
  }, [onClick, onLongPress, onIdle]);

  // Initialize Map
  useEffect(() => {
    if (isLoaded && google && mapRef.current && !mapInstance) {
      try {
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          disableDefaultUI: true, // Clean mobile look
          clickableIcons: false, // Handle clicks manually
          gestureHandling: 'greedy', // Standard mobile gesture handling
          ...options,
          mapId: options?.mapId ?? GOOGLE_MAP_VECTOR_MAP_ID,
        });

        setMapInstance(map);
        onMapLoad?.(map);

        // Bind events
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          onClickRef.current?.(e);
        });

        map.addListener('idle', () => {
          onIdleRef.current?.(map);
        });

        // Long Press Implementation
        map.addListener('mousedown', (e: google.maps.MapMouseEvent) => {
          if (!onLongPressRef.current) return;
          isDraggingRef.current = false;
          longPressTimerRef.current = setTimeout(() => {
            if (!isDraggingRef.current) {
              onLongPressRef.current?.(e);
            }
          }, 800); // 800ms for long press
        });

        map.addListener('mouseup', () => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        });

        map.addListener('dragstart', () => {
          isDraggingRef.current = true;
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        });
        
        // Touch events for mobile
        map.addListener('touchstart', (e: google.maps.MapMouseEvent) => {
           if (!onLongPressRef.current) return;
           isDraggingRef.current = false;
           longPressTimerRef.current = setTimeout(() => {
             if (!isDraggingRef.current) {
               onLongPressRef.current?.(e);
             }
           }, 800);
        });
        
        map.addListener('touchend', () => {
           if (longPressTimerRef.current) {
             clearTimeout(longPressTimerRef.current);
             longPressTimerRef.current = null;
           }
        });

      } catch (e) {
        console.error("Error initializing map", e);
      }
    }
  }, [isLoaded, google, mapRef, mapInstance, onMapLoad, options, center, zoom]);

  const prevPropsRef = useRef({ center, zoom });

  // Update View
  useEffect(() => {
    if (mapInstance) {
      const { center: prevCenter, zoom: prevZoom } = prevPropsRef.current;
      
      // Check Zoom
      if (prevZoom !== zoom) {
        mapInstance.setZoom(zoom);
      }
      
      // Check Center (Value comparison to avoid object reference issues)
      if (Math.abs(prevCenter.lat - center.lat) > 0.0000001 || Math.abs(prevCenter.lng - center.lng) > 0.0000001) {
         mapInstance.setCenter(center);
      }
      
      prevPropsRef.current = { center, zoom };
    }
  }, [center, zoom, mapInstance]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-red-500 p-4 text-center">
          <div>Map Failed to Load</div>
          <div className="text-xs text-app-text-muted mt-1">{loadError.message}</div>
          <div className="text-xs text-gray-400 mt-2">Check API Key configuration</div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-app-text-muted">Loading Map...</div>
      </div>
    );
  }

  if (zoomComp) {
    return (
      <div className={className} style={{ overflow: 'hidden' }}>
        <div
          ref={mapRef}
          style={{
            zoom: zoomComp.inverseZoom,
            // Keep full-size layout box; do not apply percentage shrink.
            // A prior width/height compensation caused right/bottom blank areas.
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
};
