"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import maplibregl, { Map } from "maplibre-gl";
import { gridDisk, latLngToCell } from "h3-js";
import { MOON_TILE_URL } from "@/lib/constants";
import { FIXED_HEX_RESOLUTION, cellsToFeatureCollection } from "@/lib/hex";

type PlayerId = "alice" | "bob" | "carol" | "dave";

type WalletState = Record<PlayerId, number>;
type EnergyState = Record<PlayerId, number>;
type ExploredState = Record<PlayerId, string[]>;

type OwnedCellState = {
  owner: PlayerId;
  listedPrice: number | null;
  updatedAt: string;
};

type LiteState = {
  wallets: WalletState;
  energy: EnergyState;
  exploredCellIds: ExploredState;
  cells: Record<string, OwnedCellState>;
  turn: number;
  gameHours: number;
  activePlayerIndex: number;
  lastEvent: string;
};

const PLAYERS: PlayerId[] = ["alice", "bob", "carol", "dave"];
const PLAYER_LABELS: Record<PlayerId, string> = {
  alice: "Alice",
  bob: "Bob",
  carol: "Carol",
  dave: "Dave",
};

const STORAGE_KEY = "moon-demo-lite-apollo11-v2";
const TURN_HOURS = 6;
const INITIAL_TOKENS = 300;
const INITIAL_ENERGY = 90;
const MAX_ENERGY = 180;
const SOLAR_BASE_GAIN = 18;
const EXPLORE_ENERGY_COST = 14;
const CLAIM_PRICE = 20;
const MIN_LIST_PRICE = 5;
const DEFAULT_LIST_PRICE = 35;

const APOLLO11_CENTER = { lat: 0.67408, lon: 23.47314 };
const DEMO_RING = 4;
const MONUMENT_CELL_ID = latLngToCell(APOLLO11_CENTER.lat, APOLLO11_CENTER.lon, FIXED_HEX_RESOLUTION);
const DEMO_CELL_IDS = gridDisk(MONUMENT_CELL_ID, DEMO_RING);
const MONUMENT_RING = gridDisk(MONUMENT_CELL_ID, 1).filter((cellId) => cellId !== MONUMENT_CELL_ID);

function parseIntSafe(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.floor(value);
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === "alice" || value === "bob" || value === "carol" || value === "dave";
}

function sanitizeCellState(value: unknown): OwnedCellState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OwnedCellState>;
  if (!isPlayerId(row.owner)) return null;
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
      carol: INITIAL_TOKENS,
      dave: INITIAL_TOKENS,
    },
    energy: {
      alice: INITIAL_ENERGY,
      bob: INITIAL_ENERGY,
      carol: INITIAL_ENERGY,
      dave: INITIAL_ENERGY,
    },
    exploredCellIds: {
      alice: [],
      bob: [],
      carol: [],
      dave: [],
    },
    cells: {},
    turn: 1,
    gameHours: 0,
    activePlayerIndex: 0,
    lastEvent: "Lite demo ready. Explore, claim, trade, and control the monument ring.",
  };
}

function sanitizeState(value: unknown): LiteState {
  const fallback = createInitialState();
  if (!value || typeof value !== "object") return fallback;
  const src = value as Partial<LiteState>;
  const cells: Record<string, OwnedCellState> = {};
  for (const [cellId, row] of Object.entries(src.cells ?? {})) {
    if (!DEMO_CELL_IDS.includes(cellId)) continue;
    const safe = sanitizeCellState(row);
    if (safe && cellId !== MONUMENT_CELL_ID) cells[cellId] = safe;
  }

  const sanitizePlayerList = (player: PlayerId) => {
    const row = src.exploredCellIds?.[player];
    if (!Array.isArray(row)) return [];
    return [...new Set(row.filter((item): item is string => typeof item === "string" && DEMO_CELL_IDS.includes(item)))];
  };

  return {
    wallets: {
      alice: parseIntSafe(src.wallets?.alice, INITIAL_TOKENS),
      bob: parseIntSafe(src.wallets?.bob, INITIAL_TOKENS),
      carol: parseIntSafe(src.wallets?.carol, INITIAL_TOKENS),
      dave: parseIntSafe(src.wallets?.dave, INITIAL_TOKENS),
    },
    energy: {
      alice: Math.max(0, Math.min(MAX_ENERGY, parseIntSafe(src.energy?.alice, INITIAL_ENERGY))),
      bob: Math.max(0, Math.min(MAX_ENERGY, parseIntSafe(src.energy?.bob, INITIAL_ENERGY))),
      carol: Math.max(0, Math.min(MAX_ENERGY, parseIntSafe(src.energy?.carol, INITIAL_ENERGY))),
      dave: Math.max(0, Math.min(MAX_ENERGY, parseIntSafe(src.energy?.dave, INITIAL_ENERGY))),
    },
    exploredCellIds: {
      alice: sanitizePlayerList("alice"),
      bob: sanitizePlayerList("bob"),
      carol: sanitizePlayerList("carol"),
      dave: sanitizePlayerList("dave"),
    },
    cells,
    turn: Math.max(1, parseIntSafe(src.turn, 1)),
    gameHours: Math.max(0, parseIntSafe(src.gameHours, 0)),
    activePlayerIndex: Math.min(PLAYERS.length - 1, Math.max(0, parseIntSafe(src.activePlayerIndex, 0))),
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

function illuminationAtHours(gameHours: number, lon: number) {
  const localHour = ((gameHours + lon / 15) % 24 + 24) % 24;
  if (localHour < 6 || localHour > 18) return 0;
  const progress = (localHour - 6) / 12;
  return Math.sin(progress * Math.PI);
}

function getMonumentController(cells: Record<string, OwnedCellState>): PlayerId | null {
  let best: PlayerId | null = null;
  let bestCount = 0;
  for (const player of PLAYERS) {
    const count = MONUMENT_RING.reduce((acc, cellId) => acc + (cells[cellId]?.owner === player ? 1 : 0), 0);
    if (count > bestCount) {
      best = player;
      bestCount = count;
    }
  }
  if (bestCount < 4) return null;
  return best;
}

function getMonumentProgress(cells: Record<string, OwnedCellState>) {
  const result: Record<PlayerId, number> = {
    alice: 0,
    bob: 0,
    carol: 0,
    dave: 0,
  };
  for (const cellId of MONUMENT_RING) {
    const owner = cells[cellId]?.owner;
    if (owner) result[owner] += 1;
  }
  return result;
}

export function DemoLiteView() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [state, setState] = useState<LiteState>(() => loadState());
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [listPriceInput, setListPriceInput] = useState(DEFAULT_LIST_PRICE.toString());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activePlayer = PLAYERS[state.activePlayerIndex];
  const selectedCell = selectedCellId ? state.cells[selectedCellId] ?? null : null;
  const isMonumentCell = selectedCellId === MONUMENT_CELL_ID;
  const activeBalance = state.wallets[activePlayer];
  const activeEnergy = state.energy[activePlayer];
  const activeExplored = selectedCellId ? state.exploredCellIds[activePlayer].includes(selectedCellId) : false;
  const canExplore = Boolean(selectedCellId && !activeExplored && activeEnergy >= EXPLORE_ENERGY_COST);
  const canClaim = Boolean(
    selectedCellId &&
      !isMonumentCell &&
      !selectedCell &&
      activeExplored &&
      activeBalance >= CLAIM_PRICE &&
      activeEnergy >= 4,
  );
  const canList =
    Boolean(selectedCellId && selectedCell && selectedCell.owner === activePlayer && !isMonumentCell) &&
    Number.isFinite(Number(listPriceInput)) &&
    Number(listPriceInput) >= MIN_LIST_PRICE;
  const canBuy = Boolean(
    selectedCellId &&
      selectedCell &&
      !isMonumentCell &&
      selectedCell.owner !== activePlayer &&
      selectedCell.listedPrice !== null &&
      activeBalance >= selectedCell.listedPrice,
  );

  const illumination = illuminationAtHours(state.gameHours, APOLLO11_CENTER.lon);
  const temperatureBand = illumination > 0.6 ? "hot day" : illumination > 0.2 ? "day" : "night";
  const monumentController = getMonumentController(state.cells);
  const monumentProgress = getMonumentProgress(state.cells);

  const applyState = (updater: (current: LiteState) => LiteState) => {
    setState((current) => {
      const next = updater(current);
      saveState(next);
      return next;
    });
  };

  const advanceTurn = (current: LiteState, eventText: string) => {
    const nextHours = current.gameHours + TURN_HOURS;
    const illum = illuminationAtHours(nextHours, APOLLO11_CENTER.lon);
    const nextEnergy: EnergyState = { ...current.energy };
    for (const player of PLAYERS) {
      const gain = Math.floor(SOLAR_BASE_GAIN * (0.25 + illum * 0.75));
      nextEnergy[player] = Math.min(MAX_ENERGY, nextEnergy[player] + gain);
    }

    const controller = getMonumentController(current.cells);
    const nextWallets = { ...current.wallets };
    let bonusText = "";
    if (controller) {
      nextWallets[controller] += 10;
      bonusText = ` Monument bonus: ${PLAYER_LABELS[controller]} +10 LUNA.`;
    }

    return {
      ...current,
      wallets: nextWallets,
      energy: nextEnergy,
      gameHours: nextHours,
      turn: current.turn + 1,
      activePlayerIndex: (current.activePlayerIndex + 1) % PLAYERS.length,
      lastEvent: `${eventText}${bonusText}`,
    };
  };

  const showSelectedCellOnMap = (map: Map, cellId: string | null) => {
    const source = map.getSource("selected-cell") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(cellsToFeatureCollection(cellId ? [cellId] : []));
  };

  const exploreCell = () => {
    if (!selectedCellId) return;
    if (state.exploredCellIds[activePlayer].includes(selectedCellId)) {
      setErrorMessage("That cell is already explored by this player.");
      return;
    }
    if (activeEnergy < EXPLORE_ENERGY_COST) {
      setErrorMessage("Not enough energy.");
      return;
    }
    setErrorMessage(null);

    const yieldFactor = temperatureBand === "night" ? 0.7 : temperatureBand === "hot day" ? 1.15 : 1;
    const gain = Math.max(3, Math.floor(randomInt(6, 16) * yieldFactor));

    applyState((current) =>
      advanceTurn(
        {
          ...current,
          wallets: {
            ...current.wallets,
            [activePlayer]: current.wallets[activePlayer] + gain,
          },
          energy: {
            ...current.energy,
            [activePlayer]: Math.max(0, current.energy[activePlayer] - EXPLORE_ENERGY_COST),
          },
          exploredCellIds: {
            ...current.exploredCellIds,
            [activePlayer]: [...new Set([...current.exploredCellIds[activePlayer], selectedCellId])],
          },
        },
        `${PLAYER_LABELS[activePlayer]} explored ${selectedCellId} (+${gain} LUNA).`,
      ),
    );
  };

  const claimCell = () => {
    if (!selectedCellId || isMonumentCell) return;
    if (!state.exploredCellIds[activePlayer].includes(selectedCellId)) {
      setErrorMessage("Explore before claim.");
      return;
    }
    if (state.cells[selectedCellId]) {
      setErrorMessage("Cell already owned.");
      return;
    }
    if (activeBalance < CLAIM_PRICE) {
      setErrorMessage("Not enough balance.");
      return;
    }
    setErrorMessage(null);
    applyState((current) =>
      advanceTurn(
        {
          ...current,
          wallets: {
            ...current.wallets,
            [activePlayer]: current.wallets[activePlayer] - CLAIM_PRICE,
          },
          energy: {
            ...current.energy,
            [activePlayer]: Math.max(0, current.energy[activePlayer] - 4),
          },
          cells: {
            ...current.cells,
            [selectedCellId]: {
              owner: activePlayer,
              listedPrice: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        `${PLAYER_LABELS[activePlayer]} claimed ${selectedCellId} (-${CLAIM_PRICE} LUNA).`,
      ),
    );
  };

  const listCell = () => {
    if (!selectedCellId) return;
    const price = Math.max(MIN_LIST_PRICE, Math.floor(Number(listPriceInput)));
    if (!Number.isFinite(price)) {
      setErrorMessage("Invalid list price.");
      return;
    }
    setErrorMessage(null);
    applyState((current) => {
      const owned = current.cells[selectedCellId];
      if (!owned || owned.owner !== activePlayer) return current;
      return advanceTurn(
        {
          ...current,
          cells: {
            ...current.cells,
            [selectedCellId]: {
              ...owned,
              listedPrice: price,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        `${PLAYER_LABELS[activePlayer]} listed ${selectedCellId} at ${price} LUNA.`,
      );
    });
  };

  const unlistCell = () => {
    if (!selectedCellId) return;
    setErrorMessage(null);
    applyState((current) => {
      const owned = current.cells[selectedCellId];
      if (!owned || owned.owner !== activePlayer) return current;
      return advanceTurn(
        {
          ...current,
          cells: {
            ...current.cells,
            [selectedCellId]: {
              ...owned,
              listedPrice: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        `${PLAYER_LABELS[activePlayer]} removed listing on ${selectedCellId}.`,
      );
    });
  };

  const buyCell = () => {
    if (!selectedCellId || isMonumentCell) return;
    setErrorMessage(null);
    applyState((current) => {
      const target = current.cells[selectedCellId];
      if (!target || target.owner === activePlayer || target.listedPrice === null) return current;
      if (current.wallets[activePlayer] < target.listedPrice) {
        setErrorMessage("Not enough balance.");
        return current;
      }
      const seller = target.owner;
      const price = target.listedPrice;
      return advanceTurn(
        {
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
        },
        `${PLAYER_LABELS[activePlayer]} bought ${selectedCellId} from ${PLAYER_LABELS[seller]}.`,
      );
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
      mapRef.current.setFilter("monument-cell-fill", true);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [APOLLO11_CENTER.lon, APOLLO11_CENTER.lat],
      zoom: 6.4,
      minZoom: 5.8,
      maxZoom: 9.4,
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
          "monument-cell": {
            type: "geojson",
            data: cellsToFeatureCollection([MONUMENT_CELL_ID]),
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
              "line-width": 1.15,
              "line-opacity": 0.5,
            },
          },
          {
            id: "monument-cell-fill",
            type: "fill",
            source: "monument-cell",
            paint: {
              "fill-color": "#ff8a5b",
              "fill-opacity": 0.45,
            },
          },
          {
            id: "monument-cell-line",
            type: "line",
            source: "monument-cell",
            paint: {
              "line-color": "#ffd3c2",
              "line-width": 2.2,
            },
          },
          {
            id: "selected-cell-fill",
            type: "fill",
            source: "selected-cell",
            paint: {
              "fill-color": "#fff27a",
              "fill-opacity": 0.62,
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
          width: 360,
          borderLeft: "1px solid rgba(255,255,255,0.14)",
          padding: 16,
          background: "#13181a",
          color: "#f0f6fa",
          fontSize: 14,
          overflowY: "auto",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Apollo Monument Lite</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, fontSize: 13 }}>
          <Link href="/" style={{ color: "#c6e7ff", textDecoration: "none" }}>
            Globe
          </Link>
          <Link href="/map" style={{ color: "#c6e7ff", textDecoration: "none" }}>
            Full Map
          </Link>
          <Link href="/how-to-play-lite" style={{ color: "#c6e7ff", textDecoration: "none" }}>
            Lite Guide
          </Link>
        </div>
        <p style={{ marginTop: 0, opacity: 0.88 }}>
          4-player compact zone. Monument cell is not tradable. Control at least 4/6 surrounding cells for bonus.
        </p>
        <div style={{ marginBottom: 8 }}>
          <strong>turn:</strong> {state.turn}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>time:</strong> +{state.gameHours}h (x{TURN_HOURS}h/turn)
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>illumination:</strong> {Math.round(illumination * 100)}% ({temperatureBand})
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>active:</strong> {PLAYER_LABELS[activePlayer]}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>wallet:</strong> {activeBalance} LUNA
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>energy:</strong> {activeEnergy}/{MAX_ENERGY}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>selected:</strong> {selectedCellId ?? "none"}
        </div>
        <div style={{ marginBottom: 10 }}>
          <strong>monument control:</strong>{" "}
          {monumentController ? `${PLAYER_LABELS[monumentController]} (bonus active)` : "none"}
        </div>
        <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.88 }}>
          {PLAYERS.map((player) => (
            <div key={player}>
              {PLAYER_LABELS[player]}: {monumentProgress[player]}/6 ring cells
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 10, opacity: 0.88 }}>{state.lastEvent}</div>
        <hr style={{ borderColor: "rgba(255,255,255,0.16)", margin: "12px 0" }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={exploreCell} disabled={!canExplore} style={{ flex: 1, padding: "6px 8px" }}>
            Explore (-{EXPLORE_ENERGY_COST}E)
          </button>
          <button onClick={claimCell} disabled={!canClaim} style={{ flex: 1, padding: "6px 8px" }}>
            Claim ({CLAIM_PRICE})
          </button>
        </div>
        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.9 }}>
          {isMonumentCell ? "Monument cell is locked from ownership and trading." : "Selected cell can be traded."}
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
            disabled={!selectedCellId || !selectedCell || selectedCell.owner !== activePlayer || selectedCell.listedPrice === null}
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
