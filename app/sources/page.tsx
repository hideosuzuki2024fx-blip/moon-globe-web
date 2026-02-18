import Link from "next/link";

const checkedDate = "2026-02-18";
const licenseRows = [
  {
    mission: "Apollo 11",
    site: "Tranquility Base",
    source: "NASA NSSDCA",
    status: "OK",
    note: "Factual coordinates/date metadata. Credit source. Avoid logos/endorsement use.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
  },
  {
    mission: "Apollo 12",
    site: "Ocean of Storms Site",
    source: "NASA NSSDCA",
    status: "OK",
    note: "Factual coordinates/date metadata. Credit source. Avoid logos/endorsement use.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
  },
  {
    mission: "Apollo 14",
    site: "Fra Mauro Site",
    source: "NASA NSSDCA",
    status: "OK",
    note: "Factual coordinates/date metadata. Credit source. Avoid logos/endorsement use.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
  },
  {
    mission: "Apollo 15",
    site: "Hadley-Apennine Site",
    source: "NASA NSSDCA",
    status: "OK",
    note: "Factual coordinates/date metadata. Credit source. Avoid logos/endorsement use.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
  },
  {
    mission: "Apollo 16",
    site: "Descartes Highlands Site",
    source: "NASA NSSDCA",
    status: "OK",
    note: "Factual coordinates/date metadata. Credit source. Avoid logos/endorsement use.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
  },
  {
    mission: "Apollo 17",
    site: "Taurus-Littrow Site",
    source: "NASA NSSDCA",
    status: "OK",
    note: "Factual coordinates/date metadata. Credit source. Avoid logos/endorsement use.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
  },
  {
    mission: "Chang'e 4",
    site: "Von Karman Crater Site",
    source: "CNSA",
    status: "Caution",
    note: "Use factual metadata only. CNSA site generally requires permission to mirror/copy page content.",
    url: "https://www.cnsa.gov.cn/english/n6465645/n6465650/index.html",
  },
  {
    mission: "Chang'e 3",
    site: "Guang Han Gong Crater Site",
    source: "CNSA",
    status: "Caution",
    note: "Use factual metadata only. Keep attribution and avoid reusing CNSA-hosted media assets without permission.",
    url: "https://www.cnsa.gov.cn/english/n6465652/n6465653/c6765505/content.html",
  },
  {
    mission: "Chandrayaan-3",
    site: "Shiv Shakti Point (Prime Site)",
    source: "ISRO",
    status: "OK",
    note: "ISRO permits reproduction with source acknowledgment; exclude third-party marked content.",
    url: "https://www.isro.gov.in/Copyright_Policy.html",
  },
  {
    mission: "IM-1 Odysseus",
    site: "Malapert A Region Site",
    source: "NASA",
    status: "OK",
    note: "Facts-only metadata with NASA source link. If using NASA media, keep attribution and non-endorsement use.",
    url: "https://www.nasa.gov/missions/commercial-lunar-payload-services/nasas-odysseus-lander-settles-onto-moons-surface/",
  },
];

export default function SourcesPage() {
  return (
    <main
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "28px 20px 48px",
        lineHeight: 1.65,
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Sources and Usage Notes</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Checked on {checkedDate}. This page is a practical attribution and usage memo, not legal advice.
      </p>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Policy References</h2>
        <ul>
          <li>
            NASA Media Usage Guidelines:{" "}
            <a href="https://www.nasa.gov/nasa-brand-center/images-and-media/" target="_blank" rel="noreferrer">
              nasa.gov/nasa-brand-center/images-and-media
            </a>
          </li>
          <li>
            NASA Open Data and Information Policy:{" "}
            <a href="https://www.nasa.gov/open/data-and-information-policy/" target="_blank" rel="noreferrer">
              nasa.gov/open/data-and-information-policy
            </a>
          </li>
          <li>
            USGS Data Licensing:{" "}
            <a href="https://www.usgs.gov/data-management/data-licensing" target="_blank" rel="noreferrer">
              usgs.gov/data-management/data-licensing
            </a>
          </li>
          <li>
            ISRO Copyright Policy:{" "}
            <a href="https://www.isro.gov.in/Copyright_Policy.html" target="_blank" rel="noreferrer">
              isro.gov.in/Copyright_Policy.html
            </a>
          </li>
          <li>
            CNSA Copyright Statement:{" "}
            <a href="https://www.cnsa.gov.cn/english/n6465652/n6465653/c6811957/content.html" target="_blank" rel="noreferrer">
              cnsa.gov.cn/.../content.html
            </a>
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Historic Event Data Sources</h2>
        <ul>
          <li>
            Apollo landing site coordinates:{" "}
            <a href="https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html" target="_blank" rel="noreferrer">
              NASA NSSDCA Lunar Sites
            </a>
          </li>
          <li>
            Chang&apos;e-4 landing coordinates:{" "}
            <a href="https://www.cnsa.gov.cn/english/n6465719/c6805106/content.html" target="_blank" rel="noreferrer">
              CNSA Chang&apos;e-4 release
            </a>
          </li>
          <li>
            Chandrayaan-3 landing coordinates:{" "}
            <a href="https://www.isro.gov.in/ISRO_EN/Chandrayaan3_Details.html" target="_blank" rel="noreferrer">
              ISRO Chandrayaan-3 Details
            </a>
          </li>
          <li>
            Chang&apos;e-3 landing coordinates:{" "}
            <a href="https://www.cnsa.gov.cn/english/n6465652/n6465653/c6765505/content.html" target="_blank" rel="noreferrer">
              CNSA Chang&apos;e-3 Mission
            </a>
          </li>
          <li>
            IM-1 Odysseus landing coordinates:{" "}
            <a
              href="https://www.nasa.gov/missions/commercial-lunar-payload-services/nasas-odysseus-lander-settles-onto-moons-surface/"
              target="_blank"
              rel="noreferrer"
            >
              NASA CLPS Odysseus release
            </a>
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>How This App Uses Data</h2>
        <ul>
          <li>Store factual metadata only: mission name, event date, coordinates.</li>
          <li>Do not embed external logos, images, or long copied text from source pages.</li>
          <li>Compute `cell_id` from lat/lon at runtime to link historic events with H3 grid cells.</li>
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Event-by-Event License Notes</h2>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Status meaning: <strong>OK</strong> = usable as configured (facts only). <strong>Caution</strong> = keep
          facts-only usage and avoid copying page assets/text.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px 6px" }}>Mission</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px 6px" }}>Site</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px 6px" }}>Source</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px 6px" }}>Status</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px 6px" }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {licenseRows.map((row) => (
                <tr key={row.mission}>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>{row.mission}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>{row.site}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {row.source}
                    </a>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>{row.status}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ marginTop: 28 }}>
        <Link href="/" style={{ marginRight: 12 }}>
          Back to Globe
        </Link>
        <Link href="/map">Open Map</Link>
      </div>
    </main>
  );
}
