"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import { MOON_TILE_URL, WEB_MERCATOR_MAX_LAT } from "@/lib/constants";
import {
  buildCellsAroundCenter,
  cellsToFeatureCollection,
  FIXED_HEX_RESOLUTION,
  MIN_GRID_ZOOM,
  pointToCellId,
} from "@/lib/hex";

type CellApiPayload = {
  cell: {
    cell_id: string;
    props: Record<string, unknown>;
    updated_at: string;
  } | null;
};

type PlayerId = "alice" | "bob";

type WalletState = Record<PlayerId, number>;

type OwnedCellState = {
  owner: PlayerId;
  listedPrice: number | null;
  updatedAt: string;
};

type InventoryState = {
  ore: number;
  ice: number;
  artifact: number;
  rareItem: number;
};

type TeamState = {
  landingCellId: string;
  landerName: string;
  roverName: string;
  baseLevel: number;
  solarPanels: number;
  power: number;
  powerCapacity: number;
  inventory: InventoryState;
  equipment: string[];
  exploredCellIds: string[];
};

type TeamsState = Record<PlayerId, TeamState>;

type TradeState = {
  wallets: WalletState;
  cells: Record<string, OwnedCellState>;
  teams: TeamsState;
  sol: number;
  terraformingProgress: number;
  lastEvent: string;
};

type HistoricSiteState = {
  id: string;
  name: string;
  mission: string;
  eventType: string;
  eventDate: string;
  source: string;
  sourceUrl: string;
  lat: number;
  lon: number;
  cellId: string;
};

type EventLink = {
  label: string;
  url: string;
};

type EventImage = {
  url: string;
  caption: string;
  credit: string;
  license: string;
  licenseUrl: string;
  sourcePage: string;
};

type HistoricEventCard = {
  summary: string;
  facts: string[];
  links: EventLink[];
  rightsNote?: string;
  image?: EventImage;
};

const PLAYER_LABELS: Record<PlayerId, string> = {
  alice: "Alice",
  bob: "Bob",
};

const STORAGE_KEY = "mars-grid-trade-v1";
const INITIAL_TOKENS = 1000;
const CLAIM_PRICE = 40;
const DEFAULT_LIST_PRICE = 80;
const MIN_TRADE_PRICE = 5;
const TRADE_ZONE_CENTER = { lat: -14.5684, lon: -34.1912 };
const OPPORTUNITY_TRAVERSE_POINTS: Array<{ lat: number; lon: number }> = [
  { lat: -14.5684, lon: -34.1912 },
  { lat: -14.57, lon: -34.2 },
  { lat: -14.575, lon: -34.215 },
];
const LANDING_ZONE_RING = 8;
const TRAVERSE_ZONE_RING = 4;
const INITIAL_POWER = 120;
const INITIAL_POWER_CAP = 180;
const INITIAL_SOLAR_PANELS = 2;
const EXPLORE_POWER_COST = 15;
const MINE_POWER_COST = 20;
const BUILD_BASE_POWER_COST = 40;
const BUILD_BASE_TOKEN_COST = 120;
const TERRAFORM_POWER_COST = 35;
const TERRAFORM_ORE_COST = 20;
const TERRAFORM_ICE_COST = 12;
const TERRAFORM_ARTIFACT_COST = 1;
const MAX_TERRAFORM_PROGRESS = 100;
const START_EQUIPMENT = ["Hab Kit", "Drill", "Spectrometer"];
const PLAYER_NAMES: Record<PlayerId, { lander: string; rover: string }> = {
  alice: { lander: "Ares Lander A", rover: "Aurora Rover" },
  bob: { lander: "Ares Lander B", rover: "Borealis Rover" },
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(MAX_TERRAFORM_PROGRESS, value));
}

function isPlayerId(value: string): value is PlayerId {
  return value === "alice" || value === "bob";
}

function sanitizeNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function loadTradeState(): TradeState {
  if (typeof window === "undefined") {
    return createInitialTradeState();
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialTradeState();
  }
  try {
    return sanitizeTradeState(JSON.parse(raw));
  } catch {
    return createInitialTradeState();
  }
}

function saveTradeState(state: TradeState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildOpportunityTradeZone(): Set<string> {
  const result = new Set<string>();
  const centerCell = latLngToCell(TRADE_ZONE_CENTER.lat, TRADE_ZONE_CENTER.lon, FIXED_HEX_RESOLUTION);
  for (const cellId of gridDisk(centerCell, LANDING_ZONE_RING)) {
    result.add(cellId);
  }

  for (const point of OPPORTUNITY_TRAVERSE_POINTS) {
    const pointCell = latLngToCell(point.lat, point.lon, FIXED_HEX_RESOLUTION);
    for (const cellId of gridDisk(pointCell, TRAVERSE_ZONE_RING)) {
      result.add(cellId);
    }
  }

  return result;
}

function buildTradeZonePerimeter(tradeZone: Set<string>) {
  const perimeter: string[] = [];
  for (const cellId of tradeZone) {
    const neighbors = gridDisk(cellId, 1);
    const hasOutsideNeighbor = neighbors.some((neighbor) => !tradeZone.has(neighbor));
    if (hasOutsideNeighbor) {
      perimeter.push(cellId);
    }
  }
  return perimeter;
}

const OPPORTUNITY_TRADE_ZONE = buildOpportunityTradeZone();
const OPPORTUNITY_TRADE_ZONE_PERIMETER = buildTradeZonePerimeter(OPPORTUNITY_TRADE_ZONE);

function pickUniqueLandingCells(): Record<PlayerId, string> {
  const pool = [...OPPORTUNITY_TRADE_ZONE_PERIMETER];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const aliceCell = pool[0];
  const bobCell = pool.find((cellId) => cellId !== aliceCell) ?? pool[1] ?? pool[0];

  return {
    alice: aliceCell,
    bob: bobCell,
  };
}

function createTeamState(playerId: PlayerId, landingCellId: string): TeamState {
  return {
    landingCellId,
    landerName: PLAYER_NAMES[playerId].lander,
    roverName: PLAYER_NAMES[playerId].rover,
    baseLevel: 0,
    solarPanels: INITIAL_SOLAR_PANELS,
    power: INITIAL_POWER,
    powerCapacity: INITIAL_POWER_CAP,
    inventory: {
      ore: 0,
      ice: 0,
      artifact: 0,
      rareItem: 0,
    },
    equipment: [...START_EQUIPMENT],
    exploredCellIds: [landingCellId],
  };
}

function createInitialTradeState(): TradeState {
  const landingCells = pickUniqueLandingCells();

  return {
    wallets: {
      alice: INITIAL_TOKENS,
      bob: INITIAL_TOKENS,
    },
    cells: {
      [landingCells.alice]: {
        owner: "alice",
        listedPrice: null,
        updatedAt: new Date().toISOString(),
      },
      [landingCells.bob]: {
        owner: "bob",
        listedPrice: null,
        updatedAt: new Date().toISOString(),
      },
    },
    teams: {
      alice: createTeamState("alice", landingCells.alice),
      bob: createTeamState("bob", landingCells.bob),
    },
    sol: 1,
    terraformingProgress: 0,
    lastEvent: "Two exploration teams landed near Opportunity perimeter.",
  };
}

function sanitizeInventory(value: unknown): InventoryState {
  if (!value || typeof value !== "object") {
    return { ore: 0, ice: 0, artifact: 0, rareItem: 0 };
  }
  const row = value as Partial<InventoryState>;
  return {
    ore: sanitizeNumber(row.ore, 0),
    ice: sanitizeNumber(row.ice, 0),
    artifact: sanitizeNumber(row.artifact, 0),
    rareItem: sanitizeNumber(row.rareItem, 0),
  };
}

function sanitizeTeamState(value: unknown, fallback: TeamState): TeamState {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const row = value as Partial<TeamState>;
  const landingCellId =
    typeof row.landingCellId === "string" && OPPORTUNITY_TRADE_ZONE.has(row.landingCellId)
      ? row.landingCellId
      : fallback.landingCellId;

  return {
    landingCellId,
    landerName: typeof row.landerName === "string" ? row.landerName : fallback.landerName,
    roverName: typeof row.roverName === "string" ? row.roverName : fallback.roverName,
    baseLevel: sanitizeNumber(row.baseLevel, fallback.baseLevel),
    solarPanels: sanitizeNumber(row.solarPanels, fallback.solarPanels),
    power: sanitizeNumber(row.power, fallback.power),
    powerCapacity: Math.max(50, sanitizeNumber(row.powerCapacity, fallback.powerCapacity)),
    inventory: sanitizeInventory(row.inventory),
    equipment:
      Array.isArray(row.equipment) && row.equipment.every((item) => typeof item === "string")
        ? row.equipment
        : fallback.equipment,
    exploredCellIds:
      Array.isArray(row.exploredCellIds) &&
      row.exploredCellIds.every((id) => typeof id === "string" && OPPORTUNITY_TRADE_ZONE.has(id))
        ? [...new Set(row.exploredCellIds)]
        : fallback.exploredCellIds,
  };
}

function sanitizeTradeState(value: unknown): TradeState {
  const fallback = createInitialTradeState();
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const source = value as Partial<TradeState>;
  const sourceWallets = source.wallets ?? {};
  const sourceCells = source.cells ?? {};
  const sourceTeams = (source.teams ?? {}) as Partial<TeamsState>;
  const cells: Record<string, OwnedCellState> = {};

  for (const [cellId, rawCell] of Object.entries(sourceCells)) {
    if (!rawCell || typeof rawCell !== "object") continue;
    if (!OPPORTUNITY_TRADE_ZONE.has(cellId)) continue;
    const row = rawCell as Partial<OwnedCellState>;
    const ownerCandidate = String(row.owner);
    if (!isPlayerId(ownerCandidate)) continue;

    const listedPrice =
      typeof row.listedPrice === "number" && Number.isFinite(row.listedPrice)
        ? Math.max(MIN_TRADE_PRICE, Math.floor(row.listedPrice))
        : null;

    cells[cellId] = {
      owner: ownerCandidate,
      listedPrice,
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    };
  }

  const teams: TeamsState = {
    alice: sanitizeTeamState(sourceTeams.alice, fallback.teams.alice),
    bob: sanitizeTeamState(sourceTeams.bob, fallback.teams.bob),
  };

  cells[teams.alice.landingCellId] = cells[teams.alice.landingCellId] ?? {
    owner: "alice",
    listedPrice: null,
    updatedAt: new Date().toISOString(),
  };
  cells[teams.bob.landingCellId] = cells[teams.bob.landingCellId] ?? {
    owner: "bob",
    listedPrice: null,
    updatedAt: new Date().toISOString(),
  };

  return {
    wallets: {
      alice: sanitizeNumber((sourceWallets as Partial<WalletState>).alice, INITIAL_TOKENS),
      bob: sanitizeNumber((sourceWallets as Partial<WalletState>).bob, INITIAL_TOKENS),
    },
    cells,
    teams,
    sol: Math.max(1, sanitizeNumber(source.sol, 1)),
    terraformingProgress: clampPercent(
      typeof source.terraformingProgress === "number" ? source.terraformingProgress : 0,
    ),
    lastEvent:
      typeof source.lastEvent === "string" && source.lastEvent.length > 0
        ? source.lastEvent
        : fallback.lastEvent,
  };
}

function parseCoordinate(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function MapView() {
  const searchParams = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellApiPayload["cell"]>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [isLoadingCell, setIsLoadingCell] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [tradeState, setTradeState] = useState<TradeState>(() => createInitialTradeState());
  const [activePlayer, setActivePlayer] = useState<PlayerId>("alice");
  const [listPriceInput, setListPriceInput] = useState(DEFAULT_LIST_PRICE.toString());
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedHistoricSite, setSelectedHistoricSite] = useState<HistoricSiteState | null>(null);
  const [historicSites, setHistoricSites] = useState<HistoricSiteState[]>([]);
  const [eventCards, setEventCards] = useState<Record<string, HistoricEventCard>>({});
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const initialLat = useMemo(
    () =>
      Math.max(
        -WEB_MERCATOR_MAX_LAT,
        Math.min(WEB_MERCATOR_MAX_LAT, parseCoordinate(searchParams.get("lat"), 0)),
      ),
    [searchParams],
  );
  const initialLon = useMemo(() => parseCoordinate(searchParams.get("lon"), 0), [searchParams]);

  useEffect(() => {
    const loaded = loadTradeState();
    setTradeState(loaded);
    saveTradeState(loaded);
  }, []);

  useEffect(() => {
    let active = true;

    void fetch("/data/moon_historic_event_cards.json")
      .then((response) => response.json() as Promise<Record<string, unknown>>)
      .then((raw) => {
        if (!active || !raw || typeof raw !== "object") {
          return;
        }

        const next: Record<string, HistoricEventCard> = {};
        for (const [eventId, value] of Object.entries(raw)) {
          if (!value || typeof value !== "object") continue;
          const row = value as {
            summary?: unknown;
            facts?: unknown;
            links?: unknown;
            rights_note?: unknown;
            image?: {
              url?: unknown;
              caption?: unknown;
              credit?: unknown;
              license?: unknown;
              license_url?: unknown;
              source_page?: unknown;
            };
          };

          const facts = Array.isArray(row.facts) ? row.facts.filter((item) => typeof item === "string") : [];
          const links = Array.isArray(row.links)
            ? row.links
                .map((item) => {
                  if (!item || typeof item !== "object") return null;
                  const link = item as { label?: unknown; url?: unknown };
                  if (typeof link.label !== "string" || typeof link.url !== "string") return null;
                  return { label: link.label, url: link.url };
                })
                .filter((item): item is EventLink => item !== null)
            : [];

          const image =
            row.image &&
            typeof row.image.url === "string" &&
            typeof row.image.caption === "string" &&
            typeof row.image.credit === "string" &&
            typeof row.image.license === "string" &&
            typeof row.image.license_url === "string" &&
            typeof row.image.source_page === "string"
              ? {
                  url: row.image.url,
                  caption: row.image.caption,
                  credit: row.image.credit,
                  license: row.image.license,
                  licenseUrl: row.image.license_url,
                  sourcePage: row.image.source_page,
                }
              : undefined;

          next[eventId] = {
            summary: typeof row.summary === "string" ? row.summary : "",
            facts,
            links,
            rightsNote: typeof row.rights_note === "string" ? row.rights_note : undefined,
            image,
          };
        }
        setEventCards(next);
      })
      .catch(() => {
        if (active) {
          setEventCards({});
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void fetch("/data/moon_historic_sites.geojson")
      .then((response) => response.json() as Promise<{ features?: unknown[] }>)
      .then((collection) => {
        if (!active || !Array.isArray(collection.features)) {
          return;
        }

        const nextSites: HistoricSiteState[] = [];
        for (const item of collection.features) {
          if (!item || typeof item !== "object") continue;
          const feature = item as {
            geometry?: { type?: string; coordinates?: number[] };
            properties?: Record<string, unknown>;
          };
          if (feature.geometry?.type !== "Point") continue;
          const coordinates = feature.geometry.coordinates ?? [];
          if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
          const [lon, lat] = coordinates;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const props = (feature.properties ?? {}) as Record<string, unknown>;
          const id = String(props.id ?? `${props.mission ?? "site"}-${nextSites.length}`);
          nextSites.push({
            id,
            name: String(props.name ?? "Unknown Site"),
            mission: String(props.mission ?? "Unknown Mission"),
            eventType: String(props.event_type ?? "unknown"),
            eventDate: String(props.event_date ?? "unknown"),
            source: String(props.source ?? "unknown"),
            sourceUrl: String(props.source_url ?? ""),
            lat,
            lon,
            cellId: latLngToCell(lat, lon, FIXED_HEX_RESOLUTION),
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

  const selectedOwnedCell = useMemo(() => {
    if (!selectedCellId) return null;
    return tradeState.cells[selectedCellId] ?? null;
  }, [selectedCellId, tradeState.cells]);

  const activeTeam = tradeState.teams[activePlayer];
  const activeBalance = tradeState.wallets[activePlayer];
  const selectedOwnerLabel = selectedOwnedCell ? PLAYER_LABELS[selectedOwnedCell.owner] : "none";
  const listedPrice = selectedOwnedCell?.listedPrice ?? null;
  const isExploredByActiveTeam = Boolean(
    selectedCellId && activeTeam.exploredCellIds.includes(selectedCellId),
  );
  const isTradeEnabledCell = Boolean(selectedCellId && OPPORTUNITY_TRADE_ZONE.has(selectedCellId));
  const canClaim = Boolean(
    selectedCellId && !selectedOwnedCell && isTradeEnabledCell && isExploredByActiveTeam,
  );
  const canList =
    Boolean(selectedCellId && selectedOwnedCell?.owner === activePlayer && isTradeEnabledCell) &&
    Number.isFinite(Number(listPriceInput)) &&
    Number(listPriceInput) >= MIN_TRADE_PRICE;
  const canBuy =
    Boolean(
      selectedCellId &&
        isTradeEnabledCell &&
        selectedOwnedCell &&
        selectedOwnedCell.owner !== activePlayer &&
        selectedOwnedCell.listedPrice !== null &&
        activeBalance >= selectedOwnedCell.listedPrice,
    );
  const canExplore = Boolean(selectedCellId && isTradeEnabledCell && !isExploredByActiveTeam);
  const canMine = Boolean(selectedCellId && isTradeEnabledCell && isExploredByActiveTeam);
  const canBuildBase =
    activeBalance >= BUILD_BASE_TOKEN_COST && activeTeam.power >= BUILD_BASE_POWER_COST;
  const canTerraform =
    activeTeam.baseLevel > 0 &&
    activeTeam.power >= TERRAFORM_POWER_COST &&
    activeTeam.inventory.ore >= TERRAFORM_ORE_COST &&
    activeTeam.inventory.ice >= TERRAFORM_ICE_COST &&
    activeTeam.inventory.artifact >= TERRAFORM_ARTIFACT_COST &&
    tradeState.terraformingProgress < MAX_TERRAFORM_PROGRESS;
  const selectedEventCard = selectedHistoricSite ? eventCards[selectedHistoricSite.id] : undefined;

  const commitTradeState = (updater: (current: TradeState) => TradeState) => {
    setTradeState((current) => {
      const next = updater(current);
      saveTradeState(next);
      return next;
    });
  };

  const claimCell = () => {
    if (!selectedCellId) return;
    if (!OPPORTUNITY_TRADE_ZONE.has(selectedCellId)) {
      setTradeError("このセルは取引対象外です（Opportunity 探査範囲のみ）。");
      return;
    }
    if (!tradeState.teams[activePlayer].exploredCellIds.includes(selectedCellId)) {
      setTradeError("セルをclaimする前に、そのセルを探索してください。");
      return;
    }
    setTradeError(null);

    commitTradeState((current) => {
      if (current.cells[selectedCellId]) {
        return current;
      }
      if (current.wallets[activePlayer] < CLAIM_PRICE) {
        setTradeError("残高不足です。");
        return current;
      }
      return {
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
        teams: current.teams,
        sol: current.sol,
        terraformingProgress: current.terraformingProgress,
        lastEvent: `${PLAYER_LABELS[activePlayer]} claimed ${selectedCellId}.`,
      };
    });
    setStatusMessage(`${PLAYER_LABELS[activePlayer]} claimed a surveyed sector.`);
  };

  const listCell = () => {
    if (!selectedCellId) return;
    if (!OPPORTUNITY_TRADE_ZONE.has(selectedCellId)) {
      setTradeError("このセルは取引対象外です（Opportunity 探査範囲のみ）。");
      return;
    }
    const parsedPrice = Math.max(MIN_TRADE_PRICE, Math.floor(Number(listPriceInput)));
    if (!Number.isFinite(parsedPrice)) {
      setTradeError("価格が不正です。");
      return;
    }
    setTradeError(null);

    commitTradeState((current) => {
      const target = current.cells[selectedCellId];
      if (!target || target.owner !== activePlayer) {
        return current;
      }
      return {
        ...current,
        cells: {
          ...current.cells,
          [selectedCellId]: {
            ...target,
            listedPrice: parsedPrice,
            updatedAt: new Date().toISOString(),
          },
        },
        lastEvent: `${PLAYER_LABELS[activePlayer]} listed ${selectedCellId} at ${parsedPrice} LUNA.`,
      };
    });
    setStatusMessage("Cell listed for trade.");
  };

  const unlistCell = () => {
    if (!selectedCellId) return;
    if (!OPPORTUNITY_TRADE_ZONE.has(selectedCellId)) {
      setTradeError("このセルは取引対象外です（Opportunity 探査範囲のみ）。");
      return;
    }
    setTradeError(null);

    commitTradeState((current) => {
      const target = current.cells[selectedCellId];
      if (!target || target.owner !== activePlayer) {
        return current;
      }
      return {
        ...current,
        cells: {
          ...current.cells,
          [selectedCellId]: {
            ...target,
            listedPrice: null,
            updatedAt: new Date().toISOString(),
          },
        },
        lastEvent: `${PLAYER_LABELS[activePlayer]} canceled listing on ${selectedCellId}.`,
      };
    });
    setStatusMessage("Listing removed.");
  };

  const buyCell = () => {
    if (!selectedCellId) return;
    if (!OPPORTUNITY_TRADE_ZONE.has(selectedCellId)) {
      setTradeError("このセルは取引対象外です（Opportunity 探査範囲のみ）。");
      return;
    }
    setTradeError(null);

    commitTradeState((current) => {
      const target = current.cells[selectedCellId];
      if (!target || target.owner === activePlayer || target.listedPrice === null) {
        return current;
      }
      if (current.wallets[activePlayer] < target.listedPrice) {
        setTradeError("残高不足で購入できません。");
        return current;
      }
      const seller = target.owner;
      const price = target.listedPrice;
      return {
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
        teams: current.teams,
        sol: current.sol,
        terraformingProgress: current.terraformingProgress,
        lastEvent: `${PLAYER_LABELS[activePlayer]} bought ${selectedCellId} from ${PLAYER_LABELS[seller]}.`,
      };
    });
    setStatusMessage("Trade completed.");
  };

  const harvestSolarEnergy = () => {
    setTradeError(null);
    commitTradeState((current) => {
      const team = current.teams[activePlayer];
      const gain = team.solarPanels * 12 + team.baseLevel * 4 + 3;
      const nextPower = Math.min(team.powerCapacity, team.power + gain);
      const actualGain = nextPower - team.power;
      const message = `${PLAYER_LABELS[activePlayer]} harvested ${actualGain} energy from solar arrays.`;
      return {
        ...current,
        teams: {
          ...current.teams,
          [activePlayer]: {
            ...team,
            power: nextPower,
          },
        },
        sol: current.sol + 1,
        lastEvent: message,
      };
    });
    setStatusMessage("Solar generation complete.");
  };

  const buildBase = () => {
    setTradeError(null);
    if (activeBalance < BUILD_BASE_TOKEN_COST) {
      setTradeError("トークン不足でbaseを構築できません。");
      return;
    }
    if (activeTeam.power < BUILD_BASE_POWER_COST) {
      setTradeError("電力不足でbaseを構築できません。");
      return;
    }

    commitTradeState((current) => {
      const team = current.teams[activePlayer];
      const message = `${PLAYER_LABELS[activePlayer]} expanded base to Lv.${team.baseLevel + 1}.`;
      return {
        ...current,
        wallets: {
          ...current.wallets,
          [activePlayer]: current.wallets[activePlayer] - BUILD_BASE_TOKEN_COST,
        },
        teams: {
          ...current.teams,
          [activePlayer]: {
            ...team,
            baseLevel: team.baseLevel + 1,
            solarPanels: team.solarPanels + 1,
            power: team.power - BUILD_BASE_POWER_COST,
            powerCapacity: team.powerCapacity + 40,
          },
        },
        terraformingProgress: clampPercent(current.terraformingProgress + 2.5),
        sol: current.sol + 1,
        lastEvent: message,
      };
    });
    setStatusMessage("Base expansion completed.");
  };

  const exploreSector = () => {
    if (!selectedCellId) {
      setTradeError("探索するセルを選択してください。");
      return;
    }
    if (!OPPORTUNITY_TRADE_ZONE.has(selectedCellId)) {
      setTradeError("探索はOpportunityトレード範囲内のみ可能です。");
      return;
    }
    if (activeTeam.exploredCellIds.includes(selectedCellId)) {
      setTradeError("このセルはすでに探索済みです。");
      return;
    }
    if (activeTeam.power < EXPLORE_POWER_COST) {
      setTradeError("電力不足で探索できません。");
      return;
    }
    setTradeError(null);

    commitTradeState((current) => {
      const team = current.teams[activePlayer];
      const oreGain = randomInt(2, 9);
      const iceGain = randomInt(1, 6);
      const artifactGain = Math.random() < 0.22 ? 1 : 0;
      const rareItemGain = Math.random() < 0.08 ? 1 : 0;
      const tokenGain = randomInt(8, 28) + rareItemGain * 12;
      const message = `${PLAYER_LABELS[activePlayer]} explored ${selectedCellId} (+${oreGain} ore, +${iceGain} ice).`;

      return {
        ...current,
        wallets: {
          ...current.wallets,
          [activePlayer]: current.wallets[activePlayer] + tokenGain,
        },
        teams: {
          ...current.teams,
          [activePlayer]: {
            ...team,
            power: team.power - EXPLORE_POWER_COST,
            inventory: {
              ore: team.inventory.ore + oreGain,
              ice: team.inventory.ice + iceGain,
              artifact: team.inventory.artifact + artifactGain,
              rareItem: team.inventory.rareItem + rareItemGain,
            },
            exploredCellIds: [...new Set([...team.exploredCellIds, selectedCellId])],
          },
        },
        terraformingProgress: clampPercent(current.terraformingProgress + artifactGain * 0.8),
        sol: current.sol + 1,
        lastEvent: message,
      };
    });
    setStatusMessage("Sector exploration completed.");
  };

  const mineSector = () => {
    if (!selectedCellId) {
      setTradeError("採掘するセルを選択してください。");
      return;
    }
    if (!activeTeam.exploredCellIds.includes(selectedCellId)) {
      setTradeError("未探索セルでは採掘できません。");
      return;
    }
    if (activeTeam.power < MINE_POWER_COST) {
      setTradeError("電力不足で採掘できません。");
      return;
    }
    setTradeError(null);

    commitTradeState((current) => {
      const team = current.teams[activePlayer];
      const oreGain = randomInt(5, 16);
      const iceGain = randomInt(2, 10);
      const artifactGain = Math.random() < 0.12 ? 1 : 0;
      const message = `${PLAYER_LABELS[activePlayer]} mined ${selectedCellId} (+${oreGain} ore, +${iceGain} ice).`;
      return {
        ...current,
        teams: {
          ...current.teams,
          [activePlayer]: {
            ...team,
            power: team.power - MINE_POWER_COST,
            inventory: {
              ore: team.inventory.ore + oreGain,
              ice: team.inventory.ice + iceGain,
              artifact: team.inventory.artifact + artifactGain,
              rareItem: team.inventory.rareItem,
            },
          },
        },
        sol: current.sol + 1,
        lastEvent: message,
      };
    });
    setStatusMessage("Mining completed.");
  };

  const contributeTerraform = () => {
    setTradeError(null);
    if (activeTeam.baseLevel <= 0) {
      setTradeError("まずbaseを構築してください。");
      return;
    }
    if (activeTeam.power < TERRAFORM_POWER_COST) {
      setTradeError("電力不足でテラフォーム作業できません。");
      return;
    }
    if (
      activeTeam.inventory.ore < TERRAFORM_ORE_COST ||
      activeTeam.inventory.ice < TERRAFORM_ICE_COST ||
      activeTeam.inventory.artifact < TERRAFORM_ARTIFACT_COST
    ) {
      setTradeError("資源不足でテラフォーム作業できません。");
      return;
    }

    commitTradeState((current) => {
      const team = current.teams[activePlayer];
      const progressGain = 4 + team.baseLevel * 1.3 + (team.inventory.rareItem > 0 ? 1.5 : 0);
      const message = `${PLAYER_LABELS[activePlayer]} contributed to terraforming (+${progressGain.toFixed(1)}%).`;
      return {
        ...current,
        wallets: {
          ...current.wallets,
          [activePlayer]: current.wallets[activePlayer] + 35,
        },
        teams: {
          ...current.teams,
          [activePlayer]: {
            ...team,
            power: team.power - TERRAFORM_POWER_COST,
            inventory: {
              ore: team.inventory.ore - TERRAFORM_ORE_COST,
              ice: team.inventory.ice - TERRAFORM_ICE_COST,
              artifact: team.inventory.artifact - TERRAFORM_ARTIFACT_COST,
              rareItem: team.inventory.rareItem,
            },
          },
        },
        terraformingProgress: clampPercent(current.terraformingProgress + progressGain),
        sol: current.sol + 1,
        lastEvent: message,
      };
    });
    setStatusMessage("Terraforming operation executed.");
  };

  const resetScenario = () => {
    const next = createInitialTradeState();
    setTradeState(next);
    saveTradeState(next);
    setTradeError(null);
    setStatusMessage("Scenario reset. New landing positions generated.");
  };

  const showSelectedCellOnMap = (map: Map, cellId: string | null) => {
    const polygonSource = map.getSource("selected-cell") as maplibregl.GeoJSONSource | undefined;
    const centerSource = map.getSource("selected-cell-center") as maplibregl.GeoJSONSource | undefined;
    if (!polygonSource || !centerSource) {
      return;
    }

    polygonSource.setData(cellsToFeatureCollection(cellId ? [cellId] : []));

    if (!cellId) {
      centerSource.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const [lat, lon] = cellToLatLng(cellId);
    centerSource.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { cell_id: cellId },
          geometry: {
            type: "Point",
            coordinates: [lon, lat],
          },
        },
      ],
    });
  };

  const selectCell = async (map: Map, cellId: string) => {
    setSelectedCellId(cellId);
    showSelectedCellOnMap(map, cellId);
    map.setFilter("hex-grid-fill", ["!=", ["get", "cell_id"], cellId]);
    map.setFilter("hex-grid-line", ["!=", ["get", "cell_id"], cellId]);
    setIsLoadingCell(true);

    try {
      const response = await fetch(`/api/cell?cell_id=${encodeURIComponent(cellId)}`);
      const payload = (await response.json()) as CellApiPayload;
      setSelectedCell(payload.cell);
    } catch {
      setSelectedCell(null);
    } finally {
      setIsLoadingCell(false);
    }
  };

  const selectHistoricSiteById = async (siteId: string) => {
    const site = historicSites.find((item) => item.id === siteId) ?? null;
    setSelectedHistoricSite(site);
    if (!site || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo({ center: [site.lon, site.lat], zoom: Math.max(mapRef.current.getZoom(), 6) });
    setStatusMessage(`Historic site selected: ${site.mission}`);
    await selectCell(mapRef.current, site.cellId);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [initialLon, initialLat],
      zoom: 4.5,
      minZoom: 1.5,
      maxZoom: 12,
      style: {
        version: 8,
        sources: {
          "moon-basemap": {
            type: "raster",
            tiles: [MOON_TILE_URL],
            tileSize: 256,
            maxzoom: 7,
          },
          "hex-grid": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          "selected-cell": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          "selected-cell-center": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
          "historic-sites": {
            type: "geojson",
            data: "/data/moon_historic_sites.geojson",
          },
        },
        layers: [
          {
            id: "moon-basemap",
            type: "raster",
            source: "moon-basemap",
          },
          {
            id: "hex-grid-fill",
            type: "fill",
            source: "hex-grid",
            paint: {
              "fill-color": "#0d0d0d",
              "fill-opacity": 0.1,
            },
          },
          {
            id: "hex-grid-line",
            type: "line",
            source: "hex-grid",
            paint: {
              "line-color": "#f5d3b4",
              "line-opacity": 0.22,
              "line-width": 0.8,
            },
          },
          {
            id: "historic-sites-circle",
            type: "circle",
            source: "historic-sites",
            paint: {
              "circle-radius": 5,
              "circle-color": "#7dd3fc",
              "circle-stroke-color": "#04131a",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.95,
            },
          },
          {
            id: "selected-cell-fill",
            type: "fill",
            source: "selected-cell",
            paint: {
              "fill-color": "#fff27a",
              "fill-opacity": 0.72,
            },
          },
          {
            id: "selected-cell-line-outer",
            type: "line",
            source: "selected-cell",
            paint: {
              "line-color": "#000000",
              "line-width": 8,
              "line-opacity": 1,
            },
          },
          {
            id: "selected-cell-line",
            type: "line",
            source: "selected-cell",
            paint: {
              "line-color": "#ffe066",
              "line-width": 4,
            },
          },
          {
            id: "selected-cell-center",
            type: "circle",
            source: "selected-cell-center",
            paint: {
              "circle-radius": 6,
              "circle-color": "#ffe066",
              "circle-stroke-color": "#000000",
              "circle-stroke-width": 2,
            },
          },
        ],
      },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const refreshGrid = () => {
      const source = map.getSource("hex-grid") as maplibregl.GeoJSONSource | undefined;
      if (!source) {
        return;
      }

      const bounds = map.getBounds();
      const center = bounds.getCenter();
      const cellIds = buildCellsAroundCenter(center.lat, center.lng, map.getZoom());
      setIsGridVisible(map.getZoom() >= MIN_GRID_ZOOM);

      source.setData(cellsToFeatureCollection(cellIds));
    };

    map.on("load", refreshGrid);
    map.on("moveend", refreshGrid);
    map.on("mouseenter", "historic-sites-circle", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "historic-sites-circle", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("click", async (event) => {
      const historicFeature = map
        .queryRenderedFeatures(event.point, { layers: ["historic-sites-circle"] })
        .find((feature) => feature.geometry.type === "Point");

      let cellId: string | undefined;
      if (historicFeature && historicFeature.geometry.type === "Point") {
        const props = historicFeature.properties ?? {};
        const [lon, lat] = historicFeature.geometry.coordinates as [number, number];
        cellId = latLngToCell(lat, lon, FIXED_HEX_RESOLUTION);
        setSelectedHistoricSite({
          id: String(props.id ?? "unknown"),
          name: String(props.name ?? "Unknown Site"),
          mission: String(props.mission ?? "Unknown Mission"),
          eventType: String(props.event_type ?? "unknown"),
          eventDate: String(props.event_date ?? "unknown"),
          source: String(props.source ?? "unknown"),
          sourceUrl: String(props.source_url ?? ""),
          lat,
          lon,
          cellId,
        });
        setStatusMessage(`Historic site selected: ${String(props.mission ?? "Unknown Mission")}`);
        setIsEventModalOpen(true);
      }

      const clickedFeature = map
        .queryRenderedFeatures(event.point, { layers: ["hex-grid-fill"] })
        .find((feature) => typeof feature.properties?.cell_id === "string");

      const resolvedCellId =
        cellId ??
        (clickedFeature?.properties?.cell_id as string | undefined) ??
        pointToCellId(event.lngLat.lat, event.lngLat.lng);

      if (!historicFeature) {
        const linkedSite = historicSites.find((site) => site.cellId === resolvedCellId);
        setSelectedHistoricSite(linkedSite ?? null);
        setIsEventModalOpen(Boolean(linkedSite));
      }

      setSelectedCellId(resolvedCellId);
      showSelectedCellOnMap(map, resolvedCellId);
      map.setFilter("hex-grid-fill", ["!=", ["get", "cell_id"], resolvedCellId]);
      map.setFilter("hex-grid-line", ["!=", ["get", "cell_id"], resolvedCellId]);
      setIsLoadingCell(true);

      try {
        const response = await fetch(`/api/cell?cell_id=${encodeURIComponent(resolvedCellId)}`);
        const payload = (await response.json()) as CellApiPayload;
        setSelectedCell(payload.cell);
      } catch {
        setSelectedCell(null);
      } finally {
        setIsLoadingCell(false);
      }
    });

    mapRef.current = map;

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [historicSites, initialLat, initialLon]);

  return (
    <main style={{ width: "100vw", height: "100vh", display: "flex", background: "#111" }}>
      <div ref={mapContainerRef} style={{ flex: 1 }} />
      <aside
        style={{
          width: 320,
          borderLeft: "1px solid rgba(255,255,255,0.14)",
          padding: 16,
          background: "#1a1411",
          color: "#f5e8dc",
          fontSize: 14,
          overflowY: "auto",
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Opportunity Frontier Ops</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              color: "#f5e8dc",
              border: "1px solid rgba(255,255,255,0.24)",
              borderRadius: 999,
              padding: "4px 10px",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            Back to Globe
          </Link>
          <Link
            href="/how-to-play"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              color: "#f5e8dc",
              border: "1px solid rgba(255,255,255,0.24)",
              borderRadius: 999,
              padding: "4px 10px",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            Full Guide
          </Link>
          <Link
            href="/sources"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              color: "#f5e8dc",
              border: "1px solid rgba(255,255,255,0.24)",
              borderRadius: 999,
              padding: "4px 10px",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            Sources
          </Link>
        </div>
        <details
          style={{
            marginBottom: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          <summary style={{ cursor: "pointer", fontSize: 12 }}>Quick Guide</summary>
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, opacity: 0.95 }}>
            <div>1. Select a sector on the map.</div>
            <div>2. Explore to unlock cells and gather resources.</div>
            <div>3. Claim, list, and buy cells in the trade zone.</div>
            <div>4. Build base and run terraforming operations.</div>
          </div>
        </details>
        <p style={{ opacity: 0.9, marginBottom: 12 }}>
          Teams landed near the trade-zone perimeter. Explore, mine, build base, and trade sectors.
        </p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Historic Event
          </label>
          <select
            value={selectedHistoricSite?.id ?? ""}
            onChange={(event) => {
              void selectHistoricSiteById(event.target.value);
            }}
            style={{ width: "100%", padding: 6, background: "#221b17", color: "#f5e8dc" }}
          >
            <option value="">Select event...</option>
            {historicSites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.mission} - {site.name}
              </option>
            ))}
          </select>
        </div>
        {selectedHistoricSite && (
          <div
            style={{
              marginBottom: 12,
              background: "rgba(125,211,252,0.12)",
              border: "1px solid rgba(125,211,252,0.35)",
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
            }}
          >
            <div>
              <strong>Historic Site</strong>: {selectedHistoricSite.name}
            </div>
            <div>
              <strong>Mission</strong>: {selectedHistoricSite.mission}
            </div>
            <div>
              <strong>Date</strong>: {selectedHistoricSite.eventDate}
            </div>
            <div>
              <strong>Type</strong>: {selectedHistoricSite.eventType}
            </div>
            <div>
              <strong>Linked Cell</strong>: {selectedHistoricSite.cellId}
            </div>
            {selectedHistoricSite.sourceUrl && (
              <div>
                <a
                  href={selectedHistoricSite.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#c6e7ff" }}
                >
                  Source
                </a>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setIsEventModalOpen(true)}
                style={{ width: "100%", padding: "6px 8px" }}
              >
                Open Event Card
              </button>
            </div>
          </div>
        )}
        <div style={{ fontFamily: "var(--font-geist-mono), monospace", marginBottom: 12 }}>
          <strong>sol:</strong>
          <div style={{ marginBottom: 8 }}>{tradeState.sol}</div>
          <strong>terraforming:</strong>
          <div style={{ marginBottom: 8 }}>{tradeState.terraformingProgress.toFixed(1)}%</div>
          <strong>h3_res:</strong>
          <div style={{ marginBottom: 8 }}>{FIXED_HEX_RESOLUTION} (fixed)</div>
          <strong>grid:</strong>
          <div style={{ marginBottom: 8 }}>
            {isGridVisible ? "visible" : `hidden (zoom >= ${MIN_GRID_ZOOM})`}
          </div>
          <strong>cell_id:</strong>
          <div>{selectedCellId ?? "none"}</div>
        </div>
        {isLoadingCell && <div>Loading...</div>}
        {!isLoadingCell && selectedCell === null && selectedCellId && <div>未登録</div>}
        {!isLoadingCell && selectedCell && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "rgba(255,255,255,0.06)",
              padding: 10,
              borderRadius: 6,
            }}
          >
            {JSON.stringify(selectedCell, null, 2)}
          </pre>
        )}
        <hr style={{ borderColor: "rgba(255,255,255,0.15)", margin: "14px 0" }} />
        <h3 style={{ marginBottom: 8 }}>Team Console</h3>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", marginBottom: 4 }}>Active Player</label>
          <select
            value={activePlayer}
            onChange={(event) => {
              setActivePlayer(event.target.value as PlayerId);
              setTradeError(null);
            }}
            style={{ width: "100%", padding: 6, background: "#221b17", color: "#f5e8dc" }}
          >
            <option value="alice">Alice</option>
            <option value="bob">Bob</option>
          </select>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Lander</strong>: {activeTeam.landerName}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Rover</strong>: {activeTeam.roverName}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Landing Cell</strong>: {activeTeam.landingCellId}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Base</strong>: Lv.{activeTeam.baseLevel} / Panels {activeTeam.solarPanels}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Power</strong>: {activeTeam.power}/{activeTeam.powerCapacity}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Wallet</strong>: {activeBalance} LUNA
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Equipment</strong>: {activeTeam.equipment.join(", ")}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Resources</strong>: ore {activeTeam.inventory.ore} / ice {activeTeam.inventory.ice} /
          artifact {activeTeam.inventory.artifact} / rare {activeTeam.inventory.rareItem}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Explored</strong>: {activeTeam.exploredCellIds.length} cells
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={harvestSolarEnergy} style={{ flex: 1, padding: "6px 8px" }}>
            Solar +Energy
          </button>
          <button onClick={buildBase} disabled={!canBuildBase} style={{ flex: 1, padding: "6px 8px" }}>
            Build Base
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={exploreSector} disabled={!canExplore} style={{ flex: 1, padding: "6px 8px" }}>
            Explore
          </button>
          <button onClick={mineSector} disabled={!canMine} style={{ flex: 1, padding: "6px 8px" }}>
            Mine
          </button>
        </div>
        <button
          onClick={contributeTerraform}
          disabled={!canTerraform}
          style={{ width: "100%", padding: "6px 8px", marginBottom: 8 }}
        >
          Terraform Operation
        </button>
        <div style={{ opacity: 0.82, fontSize: 12, marginBottom: 8 }}>{tradeState.lastEvent}</div>
        <div style={{ opacity: 0.82, fontSize: 12, marginBottom: 8 }}>{statusMessage}</div>
        <hr style={{ borderColor: "rgba(255,255,255,0.15)", margin: "14px 0" }} />
        <h3 style={{ marginBottom: 8 }}>Sector Market</h3>
        <div style={{ marginBottom: 8 }}>
          <strong>Owner</strong>: {selectedOwnerLabel}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Trade Zone</strong>: {isTradeEnabledCell ? "enabled" : "view only"}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Explored by Team</strong>: {isExploredByActiveTeam ? "yes" : "no"}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Listed Price</strong>: {listedPrice ?? "not listed"}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={claimCell}
            disabled={!canClaim || activeBalance < CLAIM_PRICE}
            style={{ flex: 1, padding: "6px 8px" }}
          >
            Claim ({CLAIM_PRICE})
          </button>
          <button onClick={buyCell} disabled={!canBuy} style={{ flex: 1, padding: "6px 8px" }}>
            Buy
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="number"
            value={listPriceInput}
            min={MIN_TRADE_PRICE}
            step={5}
            onChange={(event) => setListPriceInput(event.target.value)}
            style={{ width: "100%", padding: 6, background: "#221b17", color: "#f5e8dc" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={listCell} disabled={!canList} style={{ flex: 1, padding: "6px 8px" }}>
            List
          </button>
          <button
            onClick={unlistCell}
            disabled={!selectedCellId || selectedOwnedCell?.owner !== activePlayer || !isTradeEnabledCell}
            style={{ flex: 1, padding: "6px 8px" }}
          >
            Unlist
          </button>
        </div>
        {tradeError && <div style={{ color: "#ffb4a9", marginTop: 8 }}>{tradeError}</div>}
        <div style={{ opacity: 0.8, marginTop: 8, fontSize: 12 }}>
          Trading is limited to Opportunity landing and nearby traverse cells.
        </div>
        <button onClick={resetScenario} style={{ width: "100%", padding: "6px 8px", marginTop: 10 }}>
          Reset Scenario
        </button>
      </aside>
      {isEventModalOpen && selectedHistoricSite && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.58)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => setIsEventModalOpen(false)}
        >
          <div
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "88vh",
              overflowY: "auto",
              background: "#151515",
              color: "#f2efe9",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 10,
              padding: 16,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedHistoricSite.mission}</h3>
                <div style={{ opacity: 0.85, fontSize: 13 }}>{selectedHistoricSite.name}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  href={`/history/${selectedHistoricSite.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: 8,
                    padding: "4px 8px",
                    textDecoration: "none",
                    color: "#d7ecff",
                    fontSize: 12,
                    height: "fit-content",
                  }}
                >
                  Open in New Window
                </Link>
                <button onClick={() => setIsEventModalOpen(false)} style={{ padding: "4px 8px" }}>
                  Close
                </button>
              </div>
            </div>
            <div style={{ fontSize: 13, opacity: 0.92, marginBottom: 10 }}>
              Date: {selectedHistoricSite.eventDate} | Type: {selectedHistoricSite.eventType} | Cell:{" "}
              {selectedHistoricSite.cellId}
            </div>
            <p style={{ marginTop: 0 }}>
              {selectedEventCard?.summary ?? "Event details are loading or not available yet."}
            </p>
            {selectedEventCard?.facts?.length ? (
              <ul style={{ marginTop: 0 }}>
                {selectedEventCard.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            ) : null}
            {selectedEventCard?.image ? (
              <figure style={{ margin: "14px 0" }}>
                <Image
                  src={selectedEventCard.image.url}
                  alt={`${selectedHistoricSite.mission} reference`}
                  width={1200}
                  height={700}
                  style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 8 }}
                />
                <figcaption style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>
                  {selectedEventCard.image.caption}
                </figcaption>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  Credit: {selectedEventCard.image.credit}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  License:{" "}
                  <a
                    href={selectedEventCard.image.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#bde3ff" }}
                  >
                    {selectedEventCard.image.license}
                  </a>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  Image source:{" "}
                  <a
                    href={selectedEventCard.image.sourcePage}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#bde3ff" }}
                  >
                    Open source page
                  </a>
                </div>
              </figure>
            ) : null}
            {selectedEventCard?.rightsNote ? (
              <div
                style={{
                  fontSize: 12,
                  margin: "10px 0",
                  padding: 8,
                  borderRadius: 6,
                  background: "rgba(255,205,113,0.14)",
                  border: "1px solid rgba(255,205,113,0.4)",
                }}
              >
                Rights note: {selectedEventCard.rightsNote}
              </div>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(selectedEventCard?.links ?? []).map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: 999,
                    padding: "4px 10px",
                    textDecoration: "none",
                    color: "#d7ecff",
                    fontSize: 12,
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

