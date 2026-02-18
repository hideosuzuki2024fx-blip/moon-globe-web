import Link from "next/link";
import Image from "next/image";
import { readFile } from "node:fs/promises";
import path from "node:path";

type SiteFeature = {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    mission: string;
    event_type: string;
    event_date: string;
    source: string;
    source_url: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

type EventCard = {
  summary?: string;
  facts?: string[];
  links?: Array<{ label: string; url: string }>;
  rights_note?: string;
  image?: {
    url: string;
    caption: string;
    credit: string;
    license: string;
    license_url: string;
    source_page: string;
  };
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const sitesPath = path.join(process.cwd(), "public", "data", "moon_historic_sites.geojson");
  const cardsPath = path.join(process.cwd(), "public", "data", "moon_historic_event_cards.json");
  const sitesRaw = JSON.parse(await readFile(sitesPath, "utf8")) as { features: SiteFeature[] };
  const cardsRaw = JSON.parse(await readFile(cardsPath, "utf8")) as Record<string, EventCard>;
  const feature = (sitesRaw.features as SiteFeature[]).find((item) => item.properties.id === eventId);
  if (!feature) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px" }}>
        <h1>Event Not Found</h1>
        <p>指定されたヒストリカルイベントは見つかりませんでした。</p>
        <Link href="/map">Back to Map</Link>
      </main>
    );
  }

  const card = cardsRaw[eventId];
  const [lon, lat] = feature.geometry.coordinates;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px 42px", lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: 4 }}>{feature.properties.mission}</h1>
      <div style={{ opacity: 0.86, marginBottom: 14 }}>{feature.properties.name}</div>
      <div style={{ fontSize: 14, marginBottom: 10 }}>
        Date: {feature.properties.event_date} | Type: {feature.properties.event_type}
      </div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>
        Coordinates: lat {lat.toFixed(6)}, lon {lon.toFixed(6)}
      </div>

      <p>{card?.summary ?? "No summary available."}</p>
      {card?.facts?.length ? (
        <ul>
          {card.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}

      {card?.image ? (
        <figure style={{ margin: "14px 0" }}>
          <Image
            src={card.image.url}
            alt={`${feature.properties.mission} reference`}
            width={1200}
            height={700}
            style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 8 }}
          />
          <figcaption style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>{card.image.caption}</figcaption>
          <div style={{ fontSize: 13 }}>Credit: {card.image.credit}</div>
          <div style={{ fontSize: 13 }}>
            License:{" "}
            <a href={card.image.license_url} target="_blank" rel="noreferrer">
              {card.image.license}
            </a>
          </div>
          <div style={{ fontSize: 13 }}>
            Image source:{" "}
            <a href={card.image.source_page} target="_blank" rel="noreferrer">
              Open source page
            </a>
          </div>
        </figure>
      ) : null}

      {card?.rights_note ? (
        <div
          style={{
            margin: "10px 0",
            padding: 10,
            border: "1px solid rgba(255,190,60,0.5)",
            borderRadius: 8,
            background: "rgba(255,190,60,0.12)",
          }}
        >
          Rights note: {card.rights_note}
        </div>
      ) : null}

      <h2 style={{ marginTop: 16, marginBottom: 8, fontSize: 20 }}>References</h2>
      <ul>
        <li>
          <a href={feature.properties.source_url} target="_blank" rel="noreferrer">
            {feature.properties.source} (site source)
          </a>
        </li>
        {(card?.links ?? []).map((link) => (
          <li key={link.url}>
            <a href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 20 }}>
        <Link href={`/map?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`} style={{ marginRight: 12 }}>
          Open on Map
        </Link>
        <Link href="/sources">Open Sources</Link>
      </div>
    </main>
  );
}
