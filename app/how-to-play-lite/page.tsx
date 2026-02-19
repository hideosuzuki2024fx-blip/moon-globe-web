import Link from "next/link";
import type { CSSProperties } from "react";

const cardStyle: CSSProperties = {
  background: "#151515",
  color: "#f6efe7",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};

export default function HowToPlayLitePage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 40px", lineHeight: 1.7 }}>
      <h1 style={{ marginTop: 0 }}>かんたんあそびかた（Lite Demo）</h1>
      <p>
        これは「月面の土地をえらんで、さがして、うって、かう」ゲームです。
        <br />
        4人でじゅんばんに1ターンずつあそびます。
      </p>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>1. まずセルをえらぶ</h2>
        <p>地図の六角形（セル）をクリックします。右にえらんだセルIDが出ます。</p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>2. Explore（たんさく）する</h2>
        <p>
          はじめてのセルは、まず <strong>Explore</strong> します。
          <br />
          たんさくするとエネルギーを使って、LUNAをもらえます。
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>3. Claim（じぶんの土地にする）</h2>
        <p>
          たんさくしたセルは <strong>Claim</strong> できます。
          <br />
          Claim には LUNA がいります。
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>4. List / Buy（うる・かう）</h2>
        <p>
          じぶんのセルは <strong>List</strong> でうりに出せます。
          <br />
          ほかの人のセルは <strong>Buy</strong> でかえます。
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>5. モニュメントのルール</h2>
        <p>
          まんなかの赤いセル（Monument）は、だれも うったり かったり できません。
          <br />
          そのまわり6セルのうち、4セル以上をもつと「支配」になってボーナスがもらえます。
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>6. 昼と夜</h2>
        <p>
          ターンが進むと時間が進みます。昼は発電がつよく、夜はよわくなります。
          <br />
          エネルギーがへると行動しにくくなるので、よく見てあそびましょう。
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>こまったら</h2>
        <p>
          うまくいかなくなったら <strong>Reset Lite Demo</strong> を押すと最初からやりなおせます。
        </p>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/demo-lite" style={{ marginRight: 12 }}>
          Lite Demoへもどる
        </Link>
        <Link href="/">グローブへ</Link>
      </div>
    </main>
  );
}
