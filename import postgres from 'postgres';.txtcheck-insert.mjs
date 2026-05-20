import postgres from 'postgres';

const DB_URL = 'postgresql://neondb_owner:npg_wrk1gG6CQouB@ep-wild-king-a48ilxbb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(DB_URL, { ssl: 'require', prepare: false, max: 1 });

try {
  // Check current columns on users table
  const cols = await sql`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`;
  console.log('=== users columns ===');
  for (const c of cols) console.log(JSON.stringify(c));

  // Try exact insert that Drizzle does
  try {
    const r = await sql`INSERT INTO "users" ("id", "email", "password_hash", "intro_answers", "intro_completed_at", "created_at", "updated_at") VALUES (default, ${'testprobe999@example.com'}, ${'fakehash'}, default, default, default, default) RETURNING "id"`;
    console.log('INSERT OK:', r[0].id);
    await sql`DELETE FROM "users" WHERE email = 'testprobe999@example.com'`;
  } catch (e) {
    console.log('INSERT FAILED code:', e.code);
    console.log('INSERT FAILED msg:', e.message);
    console.log('INSERT FAILED detail:', e.detail);
    console.log('INSERT FAILED full:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await sql.end();
}