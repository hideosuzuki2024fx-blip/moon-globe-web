"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Cesium from "cesium";
import { cellToBoundary, latLngToCell } from "h3-js";
import { MOON_TILE_URL, WEB_MERCATOR_MAX_LAT } from "@/lib/constants";

const MOON_ELLIPSOID = new Cesium.Ellipsoid(1738100.0, 1738100.0, 1736000.0);
const SITE_VIEW_HEIGHT_METERS = 1500000;

type HistoricSite = {
  id: string;
  name: string;
  mission: string;
  lat: number;
  lon: number;
};

export function CesiumGlobe() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const selectedSiteEntityRef = useRef<Cesium.Entity | null>(null);
  const selectedGridEntityRef = useRef<Cesium.Entity | null>(null);
  const historicOverlayEntitiesRef = useRef<Cesium.Entity[]>([]);
  const [historicSites, setHistoricSites] = useState<HistoricSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const selectedSite = useMemo(
    () => historicSites.find((site) => site.id === selectedSiteId) ?? null,
    [historicSites, selectedSiteId],
  );

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
    viewerRef.current = viewer;
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
      selectedSiteEntityRef.current = null;
      selectedGridEntityRef.current = null;
      historicOverlayEntitiesRef.current = [];
      viewerRef.current = null;
      viewer.destroy();
    };
  }, [router]);

  useEffect(() => {
    let active = true;

    void fetch("/data/moon_historic_sites.geojson")
      .then((response) => response.json() as Promise<{ features?: unknown[] }>)
      .then((collection) => {
        if (!active || !Array.isArray(collection.features)) {
          return;
        }

        const nextSites: HistoricSite[] = [];
        for (const item of collection.features) {
          if (!item || typeof item !== "object") continue;
          const feature = item as {
            geometry?: { type?: string; coordinates?: number[] };
            properties?: Record<string, unknown>;
          };
          if (feature.geometry?.type !== "Point") continue;
          const [lon, lat] = feature.geometry.coordinates ?? [];
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const props = feature.properties ?? {};
          const id = String(props.id ?? `${props.mission ?? "site"}-${nextSites.length}`);
          nextSites.push({
            id,
            name: String(props.name ?? "Unknown Site"),
            mission: String(props.mission ?? "Unknown Mission"),
            lat,
            lon,
          });
        }
        setHistoricSites(nextSites);
      })
      .catch(() => {
        if (active) {
          setHistoricSites([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    for (const entity of historicOverlayEntitiesRef.current) {
      viewer.entities.remove(entity);
    }
    historicOverlayEntitiesRef.current = [];

    for (const site of historicSites) {
      const pointEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 1200),
        point: {
          pixelSize: 5,
          color: Cesium.Color.fromCssColorString("#7dd3fc"),
          outlineColor: Cesium.Color.fromCssColorString("#04131a"),
          outlineWidth: 1.5,
        },
        label: {
          text: site.mission,
          font: "11px sans-serif",
          fillColor: Cesium.Color.fromCssColorString("#e8f6ff"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 12),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5500000),
        },
      });
      historicOverlayEntitiesRef.current.push(pointEntity);

      const cellId = latLngToCell(site.lat, site.lon, 6);
      const boundary = cellToBoundary(cellId);
      const lonLatPairs = boundary.flatMap(([lat, lon]) => [lon, lat]);
      const first = boundary[0];
      if (first) {
        lonLatPairs.push(first[1], first[0]);
      }

      const gridEntity = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(lonLatPairs),
          width: 1.25,
          material: Cesium.Color.fromCssColorString("#7dd3fc").withAlpha(0.45),
        },
      });
      historicOverlayEntitiesRef.current.push(gridEntity);
    }
  }, [historicSites]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    if (selectedSiteEntityRef.current) {
      viewer.entities.remove(selectedSiteEntityRef.current);
      selectedSiteEntityRef.current = null;
    }
    if (selectedGridEntityRef.current) {
      viewer.entities.remove(selectedGridEntityRef.current);
      selectedGridEntityRef.current = null;
    }
    if (!selectedSite) {
      return;
    }

    const entity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(selectedSite.lon, selectedSite.lat, 1500),
      point: {
        pixelSize: 11,
        color: Cesium.Color.fromCssColorString("#ffe066"),
        outlineColor: Cesium.Color.fromCssColorString("#2b2102"),
        outlineWidth: 2,
      },
      label: {
        text: selectedSite.mission,
        font: "12px sans-serif",
        fillColor: Cesium.Color.fromCssColorString("#f4ede5"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 14),
      },
    });
    selectedSiteEntityRef.current = entity;

    const selectedCellId = latLngToCell(selectedSite.lat, selectedSite.lon, 6);
    const selectedBoundary = cellToBoundary(selectedCellId);
    const selectedHierarchy = selectedBoundary.map(([lat, lon]) =>
      Cesium.Cartesian3.fromDegrees(lon, lat, 250),
    );
    if (selectedHierarchy.length > 0) {
      selectedHierarchy.push(selectedHierarchy[0]);
    }
    selectedGridEntityRef.current = viewer.entities.add({
      polygon: {
        hierarchy: selectedHierarchy,
        material: Cesium.Color.fromCssColorString("#ffe066").withAlpha(0.2),
      },
      polyline: {
        positions: selectedHierarchy,
        width: 2.5,
        material: Cesium.Color.fromCssColorString("#ffe066").withAlpha(0.95),
      },
    });

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        selectedSite.lon,
        selectedSite.lat,
        SITE_VIEW_HEIGHT_METERS,
        MOON_ELLIPSOID,
      ),
      duration: 1.2,
    });
  }, [selectedSite]);

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
        <div style={{ marginBottom: 8 }}>Click any point to open 2D map at that lat/lon</div>
        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.9 }}>
          Historical cells are shown as blue points and hex outlines.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={selectedSiteId}
            onChange={(event) => setSelectedSiteId(event.target.value)}
            style={{
              width: 220,
              maxWidth: "45vw",
              padding: "4px 6px",
              background: "rgba(12,12,12,0.85)",
              color: "#f4ede5",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6,
            }}
          >
            <option value="">Historic event...</option>
            {historicSites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.mission}
              </option>
            ))}
          </select>
          {selectedSite && (
            <Link
              href={`/map?lat=${selectedSite.lat.toFixed(6)}&lon=${selectedSite.lon.toFixed(6)}`}
              style={{ color: "#9fd6ff", textDecoration: "none", fontSize: 12 }}
            >
              Open in Map
            </Link>
          )}
        </div>
      </div>
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        <Link
          href="/demo-lite"
          style={{
            background: "rgba(0, 0, 0, 0.66)",
            color: "#f4ede5",
            padding: "10px 12px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Lite Demo
        </Link>
        <Link
          href="/sources"
          style={{
            background: "rgba(0, 0, 0, 0.66)",
            color: "#f4ede5",
            padding: "10px 12px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Sources
        </Link>
        <Link
          href="/how-to-play"
          style={{
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
      </div>
    </main>
  );
}
