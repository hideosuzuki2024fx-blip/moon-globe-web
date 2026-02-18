"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Cesium from "cesium";
import { MOON_TILE_URL, WEB_MERCATOR_MAX_LAT } from "@/lib/constants";

const MOON_ELLIPSOID = new Cesium.Ellipsoid(1738100.0, 1738100.0, 1736000.0);

export function CesiumGlobe() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    window.CESIUM_BASE_URL = "/cesium/Cesium";

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      shouldAnimate: false,
    });

    viewer.scene.globe = new Cesium.Globe(MOON_ELLIPSOID);
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: MOON_TILE_URL,
        maximumLevel: 7,
        minimumLevel: 0,
      }),
    );

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(0, 20, 9000000, MOON_ELLIPSOID),
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    const DRAG_THRESHOLD_PX = 6;
    let pointerDown: Cesium.Cartesian2 | null = null;

    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      pointerDown = Cesium.Cartesian2.clone(event.position);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!pointerDown) {
        return;
      }

      const delta = Cesium.Cartesian2.distance(pointerDown, event.position);
      pointerDown = null;
      if (delta > DRAG_THRESHOLD_PX) {
        return;
      }

      const picked = viewer.camera.pickEllipsoid(event.position, MOON_ELLIPSOID);
      if (!picked) {
        return;
      }

      const cartographic = Cesium.Cartographic.fromCartesian(picked);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const latClamped = Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));
      router.push(`/map?lat=${latClamped.toFixed(6)}&lon=${lon.toFixed(6)}`);
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    return () => {
      handler.destroy();
      viewer.destroy();
    };
  }, [router]);

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "rgba(0, 0, 0, 0.66)",
          color: "#f4ede5",
          padding: "10px 12px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8,
          fontSize: 14,
        }}
      >
        Click any point to open 2D map at that lat/lon
      </div>
      <Link
        href="/how-to-play"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(0, 0, 0, 0.66)",
          color: "#f4ede5",
          padding: "10px 12px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        How To Play
      </Link>
    </main>
  );
}
