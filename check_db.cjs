const { Client } = require("pg");
const client = new Client({
  connectionString:
    "postgresql://postgres.dldewlhruackgkwauxsx:Salon%40124456@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});
async function run() {
  await client.connect();
  const res = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
  );
  console.log(res.rows);
  await client.end();
}
run();
