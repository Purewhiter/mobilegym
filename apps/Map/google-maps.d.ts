/// <reference types="google.maps" />

declare global {
  interface Window {
    google: typeof google;
  }
}

declare namespace google.maps {
  interface RoutesLibrary {
    Route: typeof google.maps.routes.Route;
  }
}

declare namespace google.maps.routes {
  class Route {
    static computeRoutes(
      request: ComputeRoutesRequest,
    ): Promise<{
      routes?: Route[];
      fallbackInfo?: FallbackInfo;
      geocodingResults?: GeocodingResults;
    }>;

    path?: LatLngAltitude[];
    legs?: RouteLeg[];
    distanceMeters?: number;
    durationMillis?: number;
    staticDurationMillis?: number;
    localizedValues?: RouteLocalizedValues;
    description?: string;
    viewport?: LatLngBounds;
    routeLabels?: string[];
    warnings?: string[];

    createPolylines(options?: object): Polyline[];
    createWaypointAdvancedMarkers(
      options?: marker.AdvancedMarkerElementOptions,
    ): Promise<marker.AdvancedMarkerElement[]>;
    toJSON(): object;
  }

  interface ComputeRoutesRequest {
    origin: string | LatLngLiteral | LatLngAltitudeLiteral | places.Place;
    destination: string | LatLngLiteral | LatLngAltitudeLiteral | places.Place;
    fields: string[];
    travelMode?: TravelMode;
    computeAlternativeRoutes?: boolean;
    routingPreference?: string;
    language?: string;
    region?: string;
    departureTime?: Date;
    arrivalTime?: Date;
    routeModifiers?: RouteModifiers;
    extraComputations?: string[];
    intermediates?: Array<string | LatLngLiteral | places.Place>;
    optimizeWaypointOrder?: boolean;
    polylineQuality?: string;
    units?: UnitSystem;
  }

  interface RouteModifiers {
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
    avoidIndoor?: boolean;
  }

  interface RouteLeg {
    distanceMeters: number;
    durationMillis?: number;
    staticDurationMillis?: number;
    startLocation?: DirectionalLocation;
    endLocation?: DirectionalLocation;
    steps?: RouteLegStep[];
    localizedValues?: RouteLegLocalizedValues;
    path?: LatLngAltitude[];
  }

  interface RouteLegStep {
    distanceMeters: number;
    staticDurationMillis?: number;
    instructions?: string;
    maneuver?: string;
    startLocation?: DirectionalLocation;
    endLocation?: DirectionalLocation;
    travelMode?: TravelMode;
    localizedValues?: RouteLegStepLocalizedValues;
    path?: LatLngAltitude[];
    transitDetails?: object;
  }

  interface RouteLegLocalizedValues {
    distance?: string;
    duration?: string;
    staticDuration?: string;
  }

  interface RouteLegStepLocalizedValues {
    distance?: string;
    staticDuration?: string;
  }

  interface RouteLocalizedValues {
    distance?: string;
    duration?: string;
    staticDuration?: string;
  }

  class DirectionalLocation extends LatLngAltitude {
    heading?: number;
  }

  interface FallbackInfo {
    reason?: string;
    routingMode?: string;
  }

  interface GeocodingResults {
    origin?: GeocodedWaypoint;
    destination?: GeocodedWaypoint;
    intermediates?: GeocodedWaypoint[];
  }

  interface GeocodedWaypoint {
    geocoderStatus?: object;
    placeId?: string;
    types?: string[];
    partialMatch?: boolean;
  }
}

export {};
