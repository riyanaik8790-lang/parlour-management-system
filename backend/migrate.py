import psycopg2
dsn = 'postgresql://postgres.dldewlhruackgkwauxsx:Salon%40124456@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
conn = psycopg2.connect(dsn)
cur = conn.cursor()
cur.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT false;')
cur.execute('''
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         SERIAL        PRIMARY KEY,
    user_id    INT           NOT NULL,
    endpoint   TEXT          NOT NULL,
    p256dh     VARCHAR(512)  NOT NULL,
    auth       VARCHAR(256)  NOT NULL,
    created_at TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT fk_push_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_push_endpoint UNIQUE (endpoint)
);
''')
conn.commit()
print('Success!')
