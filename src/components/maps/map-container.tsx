"use client";

import { useRef, useCallback, type ReactNode } from "react";
import MapGL, { NavigationControl, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/utils";

export interface MapContainerProps {
  center?: [number, number]; // [lat, lng]
  zoom?: number;
  height?: number;
  children?: ReactNode;
  className?: string;
  mapStyle?: string;
  onLoad?: () => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function MapContainer({
  center = [41.8, -87.85],
  zoom = 9,
  height = 500,
  children,
  className,
  mapStyle = "mapbox://styles/mapbox/light-v11",
  onLoad,
}: MapContainerProps) {
  const mapRef = useRef<MapRef>(null);

  const handleLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-muted)]",
          className
        )}
        style={{ height }}
      >
        Map unavailable: Set NEXT_PUBLIC_MAPBOX_TOKEN in environment variables.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)]",
        className
      )}
      style={{ height }}
    >
      <MapGL
        ref={mapRef}
        initialViewState={{
          latitude: center[0],
          longitude: center[1],
          zoom,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={handleLoad}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />
        {children}
      </MapGL>
    </div>
  );
}
