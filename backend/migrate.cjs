const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgresql://postgres.dldewlhruackgkwauxsx:Salon%40124456@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  try {
    await client.connect();
    console.log("Connected to Supabase.");

    // Add push_enabled column
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT false;",
    );
    console.log("Added push_enabled column to users table.");

    // Create push_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Created push_subscriptions table.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
