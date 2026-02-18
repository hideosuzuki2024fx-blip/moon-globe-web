"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { Map } from "maplibre-gl";
import { gridDisk, latLngToCell } from "h3-js";
import { MOON_TILE_URL } from "@/lib/constants";
import { FIXED_HEX_RESOLUTION, cellsToFeatureCollection } from "@/lib/hex";

type PlayerId = "alice" | "bob";

type WalletState = Record<PlayerId, number>;

type OwnedCellState = {
  owner: PlayerId;
  listedPrice: number | null;
  updatedAt: string;
};

type LiteState = {
  wallets: WalletState;
  exploredCellIds: Record<PlayerId, string[]>;
  cells: Record<string, OwnedCellState>;
  turn: number;
  lastEvent: string;
};

const PLAYER_LABELS: Record<PlayerId, string> = {
  alice: "Alice",
  bob: "Bob",
};

const STORAGE_KEY = "moon-demo-lite-v1";
const INITIAL_TOKENS = 300;
const CLAIM_PRICE = 20;
const MIN_LIST_PRICE = 5;
const DEFAULT_LIST_PRICE = 35;
const DEMO_CENTER = { lat: -69.367621, lon: 32.348126 };
const DEMO_RING = 4;
const DEMO_CELL_IDS = gridDisk(latLngToCell(DEMO_CENTER.lat, DEMO_CENTER.lon, FIXED_HEX_RESOLUTION), DEMO_RING);

function parseIntSafe(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.floor(value);
}

function sanitizeCellState(value: unknown): OwnedCellState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OwnedCellState>;
  if (row.owner !== "alice" && row.owner !== "bob") return null;
  const listedPrice =
    typeof row.listedPrice === "number" && Number.isFinite(row.listedPrice)
      ? Math.max(MIN_LIST_PRICE, Math.floor(row.listedPrice))
      : null;
  return {
    owner: row.owner,
    listedPrice,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
  };
}

function createInitialState(): LiteState {
  return {
    wallets: {
      alice: INITIAL_TOKENS,
      bob: INITIAL_TOKENS,
    },
    exploredCellIds: {
      alice: [],
      bob: [],
    },
    cells: {},
    turn: 1,
    lastEvent: "Lite demo ready. Explore first, then claim and trade.",
  };
}

function sanitizeState(value: unknown): LiteState {
  const fallback = createInitialState();
  if (!value || typeof value !== "object") return fallback;
  const src = value as Partial<LiteState>;
  const nextCells: Record<string, OwnedCellState> = {};
  for (const [cellId, row] of Object.entries(src.cells ?? {})) {
    if (!DEMO_CELL_IDS.includes(cellId)) continue;
    const safe = sanitizeCellState(row);
    if (safe) nextCells[cellId] = safe;
  }
  const sanitizeExplored = (player: PlayerId) => {
    const source = src.exploredCellIds?.[player];
    if (!Array.isArray(source)) return [];
    return [...new Set(source.filter((item): item is string => typeof item === "string" && DEMO_CELL_IDS.includes(item)))];
  };

  return {
    wallets: {
      alice: parseIntSafe(src.wallets?.alice, INITIAL_TOKENS),
      bob: parseIntSafe(src.wallets?.bob, INITIAL_TOKENS),
    },
    exploredCellIds: {
      alice: sanitizeExplored("alice"),
      bob: sanitizeExplored("bob"),
    },
    cells: nextCells,
    turn: Math.max(1, parseIntSafe(src.turn, 1)),
    lastEvent: typeof src.lastEvent === "string" ? src.lastEvent : fallback.lastEvent,
  };
}

function loadState(): LiteState {
  if (typeof window === "undefined") return createInitialState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createInitialState();
  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

function saveState(state: LiteState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function DemoLiteView() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [state, setState] = useState<LiteState>(() => loadState());
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<PlayerId>("alice");
  const [listPriceInput, setListPriceInput] = useState(DEFAULT_LIST_PRICE.toString());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCell = useMemo(() => (selectedCellId ? state.cells[selectedCellId] ?? null : null), [selectedCellId, state.cells]);
  const activeBalance = state.wallets[activePlayer];
  const isExplored = Boolean(selectedCellId && state.exploredCellIds[activePlayer].includes(selectedCellId));
  const canClaim = Boolean(selectedCellId && !selectedCell && isExplored && activeBalance >= CLAIM_PRICE);
  const canList =
    Boolean(selectedCellId && selectedCell?.owner === activePlayer) &&
    Number.isFinite(Number(listPriceInput)) &&
    Number(listPriceInput) >= MIN_LIST_PRICE;
  const canBuy = Boolean(
    selectedCellId &&
      selectedCell &&
      selectedCell.owner !== activePlayer &&
      selectedCell.listedPrice !== null &&
      activeBalance >= selectedCell.listedPrice,
  );

  const applyState = (updater: (current: LiteState) => LiteState) => {
    setState((current) => {
      const next = updater(current);
      saveState(next);
      return next;
    });
  };

  const showSelectedCellOnMap = (map: Map, cellId: string | null) => {
    const polygonSource = map.getSource("selected-cell") as maplibregl.GeoJSONSource | undefined;
    if (!polygonSource) return;
    polygonSource.setData(cellsToFeatureCollection(cellId ? [cellId] : []));
  };

  const exploreCell = () => {
    if (!selectedCellId) {
      setErrorMessage("セルを選択してください。");
      return;
    }
    if (state.exploredCellIds[activePlayer].includes(selectedCellId)) {
      setErrorMessage("そのセルは探索済みです。");
      return;
    }
    setErrorMessage(null);
    const tokenGain = randomInt(4, 14);
    applyState((current) => ({
      ...current,
      wallets: {
        ...current.wallets,
        [activePlayer]: current.wallets[activePlayer] + tokenGain,
      },
      exploredCellIds: {
        ...current.exploredCellIds,
        [activePlayer]: [...current.exploredCellIds[activePlayer], selectedCellId],
      },
      turn: current.turn + 1,
      lastEvent: `${PLAYER_LABELS[activePlayer]} explored ${selectedCellId} (+${tokenGain} LUNA).`,
    }));
  };

  const claimCell = () => {
    if (!selectedCellId) return;
    if (!state.exploredCellIds[activePlayer].includes(selectedCellId)) {
      setErrorMessage("claim前に探索が必要です。");
      return;
    }
    if (state.cells[selectedCellId]) {
      setErrorMessage("すでに所有されています。");
      return;
    }
    if (activeBalance < CLAIM_PRICE) {
      setErrorMessage("残高不足です。");
      return;
    }
    setErrorMessage(null);
    applyState((current) => ({
      ...current,
      wallets: {
        ...current.wallets,
        [activePlayer]: current.wallets[activePlayer] - CLAIM_PRICE,
      },
      cells: {
        ...current.cells,
        [selectedCellId]: {
          owner: activePlayer,
          listedPrice: null,
          updatedAt: new Date().toISOString(),
        },
      },
      turn: current.turn + 1,
      lastEvent: `${PLAYER_LABELS[activePlayer]} claimed ${selectedCellId} (-${CLAIM_PRICE} LUNA).`,
    }));
  };

  const listCell = () => {
    if (!selectedCellId) return;
    const price = Math.max(MIN_LIST_PRICE, Math.floor(Number(listPriceInput)));
    if (!Number.isFinite(price)) {
      setErrorMessage("価格が不正です。");
      return;
    }
    setErrorMessage(null);
    applyState((current) => {
      const owned = current.cells[selectedCellId];
      if (!owned || owned.owner !== activePlayer) return current;
      return {
        ...current,
        cells: {
          ...current.cells,
          [selectedCellId]: {
            ...owned,
            listedPrice: price,
            updatedAt: new Date().toISOString(),
          },
        },
        turn: current.turn + 1,
        lastEvent: `${PLAYER_LABELS[activePlayer]} listed ${selectedCellId} at ${price} LUNA.`,
      };
    });
  };

  const unlistCell = () => {
    if (!selectedCellId) return;
    setErrorMessage(null);
    applyState((current) => {
      const owned = current.cells[selectedCellId];
      if (!owned || owned.owner !== activePlayer) return current;
      return {
        ...current,
        cells: {
          ...current.cells,
          [selectedCellId]: {
            ...owned,
            listedPrice: null,
            updatedAt: new Date().toISOString(),
          },
        },
        turn: current.turn + 1,
        lastEvent: `${PLAYER_LABELS[activePlayer]} removed listing from ${selectedCellId}.`,
      };
    });
  };

  const buyCell = () => {
    if (!selectedCellId) return;
    setErrorMessage(null);
    applyState((current) => {
      const target = current.cells[selectedCellId];
      if (!target || target.owner === activePlayer || target.listedPrice === null) return current;
      if (current.wallets[activePlayer] < target.listedPrice) {
        setErrorMessage("残高不足で購入できません。");
        return current;
      }
      const seller = target.owner;
      const price = target.listedPrice;
      return {
        ...current,
        wallets: {
          ...current.wallets,
          [activePlayer]: current.wallets[activePlayer] - price,
          [seller]: current.wallets[seller] + price,
        },
        cells: {
          ...current.cells,
          [selectedCellId]: {
            owner: activePlayer,
            listedPrice: null,
            updatedAt: new Date().toISOString(),
          },
        },
        turn: current.turn + 1,
        lastEvent: `${PLAYER_LABELS[activePlayer]} bought ${selectedCellId} from ${PLAYER_LABELS[seller]}.`,
      };
    });
  };

  const resetDemo = () => {
    const next = createInitialState();
    setState(next);
    saveState(next);
    setSelectedCellId(null);
    setErrorMessage(null);
    if (mapRef.current) {
      showSelectedCellOnMap(mapRef.current, null);
      mapRef.current.setFilter("demo-grid-fill", true);
      mapRef.current.setFilter("demo-grid-line", true);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [DEMO_CENTER.lon, DEMO_CENTER.lat],
      zoom: 6.2,
      minZoom: 5,
      maxZoom: 9,
      style: {
        version: 8,
        sources: {
          "moon-basemap": {
            type: "raster",
            tiles: [MOON_TILE_URL],
            tileSize: 256,
            maxzoom: 7,
          },
          "demo-grid": {
            type: "geojson",
            data: cellsToFeatureCollection(DEMO_CELL_IDS),
          },
          "selected-cell": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          { id: "moon-basemap", type: "raster", source: "moon-basemap" },
          {
            id: "demo-grid-fill",
            type: "fill",
            source: "demo-grid",
            paint: {
              "fill-color": "#0d0d0d",
              "fill-opacity": 0.12,
            },
          },
          {
            id: "demo-grid-line",
            type: "line",
            source: "demo-grid",
            paint: {
              "line-color": "#9fd6ff",
              "line-width": 1.1,
              "line-opacity": 0.52,
            },
          },
          {
            id: "selected-cell-fill",
            type: "fill",
            source: "selected-cell",
            paint: {
              "fill-color": "#fff27a",
              "fill-opacity": 0.65,
            },
          },
          {
            id: "selected-cell-line",
            type: "line",
            source: "selected-cell",
            paint: {
              "line-color": "#ffe066",
              "line-width": 2.5,
            },
          },
        ],
      },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (event) => {
      const feature = map
        .queryRenderedFeatures(event.point, { layers: ["demo-grid-fill"] })
        .find((item) => typeof item.properties?.cell_id === "string");
      if (!feature) return;
      const cellId = String(feature.properties?.cell_id);
      setSelectedCellId(cellId);
      showSelectedCellOnMap(map, cellId);
      map.setFilter("demo-grid-fill", ["!=", ["get", "cell_id"], cellId]);
      map.setFilter("demo-grid-line", ["!=", ["get", "cell_id"], cellId]);
      setErrorMessage(null);
    });

    mapRef.current = map;
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  return (
    <main style={{ width: "100vw", height: "100vh", display: "flex", background: "#111" }}>
      <div ref={mapContainerRef} style={{ flex: 1 }} />
      <aside
        style={{
          width: 340,
          borderLeft: "1px solid rgba(255,255,255,0.14)",
          padding: 16,
          background: "#13181a",
          color: "#f0f6fa",
          fontSize: 14,
          overflowY: "auto",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Lite Trade Demo</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Link href="/" style={{ color: "#c6e7ff", textDecoration: "none" }}>
            Globe
          </Link>
          <Link href="/map" style={{ color: "#c6e7ff", textDecoration: "none" }}>
            Full Map
          </Link>
        </div>
        <p style={{ marginTop: 0, opacity: 0.88 }}>
          Fixed small zone only. Use this mode to quickly test whether trading mechanics feel fun.
        </p>
        <div style={{ marginBottom: 8 }}>
          <strong>turn:</strong> {state.turn}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>zone:</strong> {DEMO_CELL_IDS.length} cells (ring {DEMO_RING})
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>selected:</strong> {selectedCellId ?? "none"}
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", marginBottom: 4 }}>Active Player</label>
          <select
            value={activePlayer}
            onChange={(event) => {
              setActivePlayer(event.target.value as PlayerId);
              setErrorMessage(null);
            }}
            style={{ width: "100%", padding: 6, background: "#1f272a", color: "#f0f6fa" }}
          >
            <option value="alice">Alice</option>
            <option value="bob">Bob</option>
          </select>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Wallet:</strong> {state.wallets[activePlayer]} LUNA
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Explored:</strong> {state.exploredCellIds[activePlayer].length}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Owner:</strong> {selectedCell ? PLAYER_LABELS[selectedCell.owner] : "none"}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Listed:</strong> {selectedCell?.listedPrice ?? "none"}
        </div>
        <div style={{ marginBottom: 8, opacity: 0.88 }}>{state.lastEvent}</div>
        <hr style={{ borderColor: "rgba(255,255,255,0.16)", margin: "12px 0" }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={exploreCell} disabled={!selectedCellId || isExplored} style={{ flex: 1, padding: "6px 8px" }}>
            Explore
          </button>
          <button onClick={claimCell} disabled={!canClaim} style={{ flex: 1, padding: "6px 8px" }}>
            Claim ({CLAIM_PRICE})
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="number"
            min={MIN_LIST_PRICE}
            step={5}
            value={listPriceInput}
            onChange={(event) => setListPriceInput(event.target.value)}
            style={{ width: "100%", padding: 6, background: "#1f272a", color: "#f0f6fa" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={listCell} disabled={!canList} style={{ flex: 1, padding: "6px 8px" }}>
            List
          </button>
          <button
            onClick={unlistCell}
            disabled={!selectedCellId || selectedCell?.owner !== activePlayer || selectedCell?.listedPrice === null}
            style={{ flex: 1, padding: "6px 8px" }}
          >
            Unlist
          </button>
        </div>
        <button onClick={buyCell} disabled={!canBuy} style={{ width: "100%", padding: "6px 8px", marginBottom: 8 }}>
          Buy Listed Cell
        </button>
        {errorMessage && <div style={{ color: "#ffb4a9", marginBottom: 8 }}>{errorMessage}</div>}
        <button onClick={resetDemo} style={{ width: "100%", padding: "6px 8px" }}>
          Reset Lite Demo
        </button>
      </aside>
    </main>
  );
}
