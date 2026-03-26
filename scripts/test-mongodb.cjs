/**
 * MongoDB 接続テスト（ping）。リポジトリルートの .env を読み込みます。
 *   npm run test:mongo
 * または:
 *   node scripts/test-mongodb.cjs
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error("見つかりません:", envPath);
    console.error(".env（ルート）を作成するか、MONGODB_URI を環境変数で渡してください。");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function main() {
  if (!process.env.MONGODB_URI) loadEnvFile();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI が設定されていません。");
    process.exit(1);
  }

  // プレースホルダのままだと必ず bad auth になる
  const userPass = uri.match(/^mongodb(\+srv)?:\/\/([^:]+):([^@]*)@/);
  if (userPass && (userPass[2] === "USER" || userPass[3] === "PASSWORD")) {
    console.error(
      "MONGODB_URI にまだ USER / PASSWORD のプレースホルダが残っています。\n" +
        "  リポジトリルートの .env を開き、Atlas の「Database Access」で作ったユーザー名とパスワードに置き換えてください。\n" +
        "  （パスワードに @ # : / ? などがある場合は URL エンコードが必要です）"
    );
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DB_NAME || "crawler_jobs";
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15_000,
  });

  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    const admin = client.db().admin();
    const build = await admin.buildInfo();
    console.log("OK: MongoDB に接続できました。");
    console.log("  データベース:", dbName);
    console.log("  サーバー:", build.version || "(version unknown)");
  } catch (err) {
    console.error("FAIL:", err.message);
    if (err.message.includes("ENOTFOUND") || err.message.includes("querySrv")) {
      console.error("  → DNS / SRV 解決を確認（mongodb+srv のホスト名）");
    }
    if (
      err.message.includes("authentication failed") ||
      err.message.includes("bad auth")
    ) {
      console.error("  → Atlas「Database Access」のユーザー名・パスワードが URI と一致しているか確認");
      console.error("  → パスワードに記号がある場合: encodeURIComponent でエンコードした値を URI に使う");
      console.error("  → 例: @ → %40  : → %3A  / → %2F  ? → %3F  # → %23");
    }
    if (err.message.includes("timed out") || err.message.includes("ETIMEDOUT")) {
      console.error("  → Atlas Network Access で IP が許可されているか確認");
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
