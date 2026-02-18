import Link from "next/link";

const checkedDate = "2026-02-18";

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

      <div style={{ marginTop: 28 }}>
        <Link href="/" style={{ marginRight: 12 }}>
          Back to Globe
        </Link>
        <Link href="/map">Open Map</Link>
      </div>
    </main>
  );
}
