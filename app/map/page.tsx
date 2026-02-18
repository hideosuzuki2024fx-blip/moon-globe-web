import { Suspense } from "react";
import { MapView } from "@/components/map-view";

export default function MapPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading map...</main>}>
      <MapView />
    </Suspense>
  );
}
