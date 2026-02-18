import Link from "next/link";
import type { CSSProperties } from "react";

const cardStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 12,
  padding: 16,
  background: "rgba(255,255,255,0.04)",
};

const chipStyle: CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.24)",
  fontSize: 12,
  color: "#f6eadc",
  textDecoration: "none",
};

const kbdStyle: CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 6,
  padding: "2px 7px",
  fontSize: 12,
};

const cells = [
  { action: "Solar +Energy", cost: "Power +", reward: "行動回数を回復", when: "電力が50未満" },
  { action: "Explore", cost: "15 power", reward: "資源 + トークン", when: "未探索セルを開ける時" },
  { action: "Mine", cost: "20 power", reward: "資源を厚く回収", when: "探索済みセルが増えた時" },
  { action: "Build Base", cost: "120 token + 40 power", reward: "発電力/容量UP", when: "中盤の強化" },
  { action: "Claim", cost: "40 token", reward: "セル所有", when: "探索済みで確保したい時" },
  { action: "List / Buy", cost: "可変", reward: "トークン最適化", when: "余剰セル売買" },
  { action: "Terraform Operation", cost: "資源 + 35 power", reward: "進捗UP + token", when: "終盤の主目的" },
];

export default function HowToPlayPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        color: "#f7eedd",
        background:
          "radial-gradient(circle at 12% 0%, rgba(255,177,96,0.22), rgba(0,0,0,0)), radial-gradient(circle at 88% 8%, rgba(255,214,160,0.12), rgba(0,0,0,0)), #0b0908",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "26px 20px 72px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <Link href="/" style={chipStyle}>
            3D Globe
          </Link>
          <Link href="/map" style={chipStyle}>
            Start Playing
          </Link>
        </div>

        <h1 style={{ fontSize: 36, lineHeight: 1.15, marginBottom: 10 }}>How To Play</h1>
        <p style={{ opacity: 0.9, marginBottom: 20 }}>
          Opportunity周辺で限定トレードを行う、軽量な火星探査ゲームです。
          <code style={{ margin: "0 4px" }}>/map</code>で開始して、このページを横に置いて進めてください。
        </p>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ fontSize: 23, marginBottom: 10 }}>3分クイックスタート</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <p>
              1. <span style={kbdStyle}>Solar +Energy</span> を1回押して電力確保
            </p>
            <p>
              2. 取引ゾーン内セルをクリックして <span style={kbdStyle}>Explore</span>
            </p>
            <p>
              3. 探索済みセルで <span style={kbdStyle}>Mine</span> を1-2回
            </p>
            <p>
              4. 余裕が出たら <span style={kbdStyle}>Build Base</span>
            </p>
            <p>
              5. 確保したいセルを <span style={kbdStyle}>Claim</span>、不要セルを
              <span style={kbdStyle}>List</span>
            </p>
            <p>
              6. 資源が揃ったら <span style={kbdStyle}>Terraform Operation</span> で進捗を上げる
            </p>
          </div>
        </section>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ fontSize: 23, marginBottom: 10 }}>図解: 1 Sol ループ</h2>
          <svg viewBox="0 0 980 190" style={{ width: "100%", height: "auto", borderRadius: 10 }}>
            <rect x="0" y="0" width="980" height="190" fill="#15100d" />
            <rect x="18" y="24" width="170" height="62" rx="10" fill="#2e251f" stroke="#d8b08e" />
            <rect x="226" y="24" width="170" height="62" rx="10" fill="#2e251f" stroke="#d8b08e" />
            <rect x="434" y="24" width="170" height="62" rx="10" fill="#2e251f" stroke="#d8b08e" />
            <rect x="642" y="24" width="170" height="62" rx="10" fill="#2e251f" stroke="#d8b08e" />
            <rect x="810" y="102" width="152" height="62" rx="10" fill="#3f2f1f" stroke="#ffe0ba" />
            <text x="103" y="62" fill="#f7eedd" textAnchor="middle" fontSize="15">
              Solar
            </text>
            <text x="311" y="62" fill="#f7eedd" textAnchor="middle" fontSize="15">
              Explore
            </text>
            <text x="519" y="62" fill="#f7eedd" textAnchor="middle" fontSize="15">
              Mine
            </text>
            <text x="727" y="62" fill="#f7eedd" textAnchor="middle" fontSize="15">
              Build / Trade
            </text>
            <text x="886" y="140" fill="#f7eedd" textAnchor="middle" fontSize="14">
              Terraform
            </text>
            <text x="200" y="62" fill="#d8b08e" fontSize="24">
              →
            </text>
            <text x="408" y="62" fill="#d8b08e" fontSize="24">
              →
            </text>
            <text x="616" y="62" fill="#d8b08e" fontSize="24">
              →
            </text>
            <path d="M808 92 C 822 96, 840 98, 860 100" stroke="#d8b08e" fill="none" strokeWidth="2" />
          </svg>
          <p style={{ marginTop: 10, opacity: 0.9 }}>
            迷ったらこの順で進めると詰まりにくいです。電力が切れたら即Solarに戻してください。
          </p>
        </section>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ fontSize: 23, marginBottom: 10 }}>図解: 画面のどこを見るか</h2>
          <svg viewBox="0 0 980 320" style={{ width: "100%", height: "auto", borderRadius: 10 }}>
            <rect x="0" y="0" width="980" height="320" fill="#17120f" />
            <rect x="22" y="20" width="650" height="280" fill="#29211d" stroke="#b9906c" />
            <rect x="690" y="20" width="268" height="280" fill="#211914" stroke="#b9906c" />
            <text x="345" y="46" textAnchor="middle" fill="#f7eedd" fontSize="17">
              Map: セルをクリックして選択
            </text>
            <text x="824" y="46" textAnchor="middle" fill="#f7eedd" fontSize="17">
              Console: 操作ボタン
            </text>
            <circle cx="330" cy="176" r="74" fill="none" stroke="#ffe3b3" strokeWidth="2.2" />
            <text x="330" y="183" textAnchor="middle" fill="#ffe3b3" fontSize="13">
              Trade Zone
            </text>
            <line x1="412" y1="170" x2="682" y2="102" stroke="#d8b08e" strokeWidth="2" />
            <text x="690" y="100" fill="#f1d7ba" fontSize="12">
              Team Consoleで
            </text>
            <text x="690" y="118" fill="#f1d7ba" fontSize="12">
              Power/Resource確認
            </text>
            <text x="690" y="164" fill="#f1d7ba" fontSize="12">
              Sector Marketで
            </text>
            <text x="690" y="182" fill="#f1d7ba" fontSize="12">
              Claim/List/Buy
            </text>
          </svg>
        </section>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ fontSize: 23, marginBottom: 10 }}>操作早見表</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", padding: "8px 6px", textAlign: "left" }}>
                    Action
                  </th>
                  <th style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", padding: "8px 6px", textAlign: "left" }}>
                    Cost
                  </th>
                  <th style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", padding: "8px 6px", textAlign: "left" }}>
                    Reward
                  </th>
                  <th style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", padding: "8px 6px", textAlign: "left" }}>
                    Best Timing
                  </th>
                </tr>
              </thead>
              <tbody>
                {cells.map((row) => (
                  <tr key={row.action}>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "9px 6px" }}>{row.action}</td>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "9px 6px", opacity: 0.9 }}>{row.cost}</td>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "9px 6px", opacity: 0.9 }}>{row.reward}</td>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "9px 6px", opacity: 0.9 }}>{row.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ fontSize: 23, marginBottom: 10 }}>よくある詰まり</h2>
          <p style={{ marginBottom: 8 }}>
            Q. ボタンが押せない。<br />
            A. 選択セルが未探索、またはTrade Zone外、または電力不足です。
          </p>
          <p style={{ marginBottom: 8 }}>
            Q. Claimできない。<br />
            A. 先にそのセルをExploreしてからClaimしてください。
          </p>
          <p>
            Q. 進行がぐちゃぐちゃになった。<br />
            A. <code>Reset Scenario</code>で着陸地点ごと再生成できます。
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ fontSize: 23, marginBottom: 10 }}>目標</h2>
          <p>
            目標は <code>terraforming progress 100%</code>。<br />
            序盤は探索、中盤は基地強化、終盤はテラフォーム連続実行で押し切るのが安定です。
          </p>
        </section>
      </div>
    </main>
  );
}

