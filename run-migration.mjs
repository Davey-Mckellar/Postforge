// One-shot migration: adds intro_answers + intro_completed_at to users table.
// Run from postforge root: node run-migration.mjs
import postgres from 'postgres';
import { writeFileSync } from 'fs';

const DB_URL = 'postgresql://neondb_owner:npg_wrk1gG6CQouB@ep-wild-king-a48ilxbb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(DB_URL, { ssl: 'require', max: 1 });
const log = [];

try {
  // Check which columns already exist
  const existing = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name IN ('intro_answers', 'intro_completed_at')
  `;
  const existingNames = existing.map(r => r.column_name);
  log.push('Existing columns: ' + (existingNames.join(', ') || 'none'));

  if (!existingNames.includes('intro_answers')) {
    await sql`ALTER TABLE "users" ADD COLUMN "intro_answers" jsonb`;
    log.push('Added: intro_answers');
  } else {
    log.push('Already exists: intro_answers');
  }

  if (!existingNames.includes('intro_completed_at')) {
    await sql`ALTER TABLE "users" ADD COLUMN "intro_completed_at" timestamp with time zone`;
    log.push('Added: intro_completed_at');
  } else {
    log.push('Already exists: intro_completed_at');
  }

  log.push('DONE — migration complete.');
} catch (e) {
  log.push('ERROR: ' + e.message);
} finally {
  await sql.end();
  const output = log.join('\n');
  console.log(output);
  writeFileSync('migrate-result.txt', output + '\n', 'utf8');
}
