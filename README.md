# Mars Globe Web

このリポジトリは、火星グリッド取引デモの「入口（ハブ）」です。  
ポートフォリオとしては、まずここを見れば全体像が分かる構成にしています。

## Portfolio Overview (3 Repositories)

- Hub / Globe UI（このリポジトリ）
  - https://github.com/hideosuzuki2024fx-blip/mars-globe-web
  - 3D Globe -> 2D Hex Map の体験入口
- Trade Demo（取引ロジック + Join + Market）
  - https://github.com/hideosuzuki2024fx-blip/mars-grid-demo
  - v1/v2 マップ、所有・出品・売買の動作デモ
- NFT / Chain Concept（将来統合先）
  - https://github.com/hideosuzuki2024fx-blip/cosmorwa-mars-nft
  - NFT/コントラクト側の構想・実装ベース

## Demo Flow (Recommended)

1. `mars-globe-web` の `/` で 3D Globe を回す  
2. 地点クリックで `/map` に遷移（Hex選択）  
3. `mars-grid-demo` の map/join/market で取引デモを見る  
4. `cosmorwa-mars-nft` でオンチェーン側の将来拡張を確認する

## This Repository Scope (`mars-globe-web`)

Google Mars 風 UI で、以下を行う Next.js アプリです。

- `/` : CesiumJS で 3D 火星グローブ表示。クリック地点の緯度経度を取得して `/map` へ遷移
- `/map` : MapLibre GL JS で 2D 平面マップ表示。Hex グリッドを描画し、セルクリックで `/api/cell` を参照
- `/api/cell` : Neon Postgres 上の `cells` テーブルを GET/POST で参照・upsert

## Tech Stack

- Next.js (App Router) + TypeScript
- CesiumJS (3D)
- MapLibre GL JS (2D)
- Neon Postgres (`@neondatabase/serverless`)
- Hex: `h3-js`
- Mars basemap (external tiles):
  `https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png`

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create env file

`.env.local`:

```bash
DATABASE_URL=postgresql://...
```

3. Create table (run SQL in Neon SQL Editor or psql)

```sql
-- db/migrations/001_create_cells.sql
CREATE TABLE IF NOT EXISTS cells (
  cell_id TEXT PRIMARY KEY,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

4. Run dev server

```bash
npm run dev
```

5. Open:
- `http://localhost:3000/` (3D globe)
- click globe -> `http://localhost:3000/map?lat=...&lon=...`

## API

- `GET /api/cell?cell_id=<id>`
  - returns `{ cell: {...} }` or `{ cell: null }`
- `POST /api/cell`
  - body:
    ```json
    {
      "cell_id": "84754e3ffffffff",
      "props": { "status": "surveyed" }
    }
    ```
  - upsert and returns `{ cell: {...} }`

## Data Files

Placeholder files are included:

- `public/data/landing_sites.geojson`
- `public/data/rover_traverses/opportunity.geojson`

### Extending Data (PDS etc.)

1. Add new GeoJSON files under `public/data/...`
2. Keep coordinate system in lon/lat (WGS84-like degrees)
3. Add properties needed by your UI (mission name, sols, links, etc.)
4. In future, load these files in `/map` as additional MapLibre sources/layers

## Vercel + Neon Deploy (New Project)

1. Push this repo to GitHub.
2. In Vercel, `Add New... > Project`, import the repo.
3. In project dashboard, open `Storage` and add `Neon` integration.
4. Confirm `DATABASE_URL` is injected into Vercel Environment Variables.
5. In Neon SQL Editor, run `db/migrations/001_create_cells.sql`.
6. Deploy on Vercel.
7. Verify:
   - `/` shows 3D globe
   - click on globe transitions to `/map?lat=...&lon=...`
   - `/map` shows OPM tiles and clickable hex
   - clicking hex returns cell state (`未登録` when no record)

## Portfolio Notes

- リポジトリが分かれていても、デモとして問題ありません。
- 重要なのは「入口」と「見る順番」が明確なことです。
- 本リポジトリをハブとして、上記3リポを相互リンクする運用を想定しています。

## Notes

- Cesium ion API key is not required.
- OPM basemap tiles are referenced externally. Tile images are not committed.
