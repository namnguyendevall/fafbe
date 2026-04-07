const { Client } = require('pg');
const CONNECTION_STRING = 'postgresql://postgres:s2%Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres';

const TABLES_TO_TRUNCATE = [
  "admin_notifications",
  "ai_match_cache",
  "category_proposals",
  "checkpoint_submissions",
  "checkpoints",
  "contracts",
  "conversation_participants",
  "conversations",
  "dispute_evidences",
  "dispute_messages",
  "disputes",
  "job_skills",
  "jobs",
  "messages",
  "notifications",
  "otps",
  "post_comments",
  "post_likes",
  "posts",
  "proposals",
  "review_skill_ratings",
  "reviews",
  "transactions",
  "user_followers",
  "user_profiles",
  "user_skills",
  "users",
  "wallets",
  "withdrawal_requests",
  "work_sessions"
];

async function cleanup() {
    const client = new Client({ connectionString: CONNECTION_STRING });
    try {
        await client.connect();
        console.log("🚀 Starting Supabase Cleanup...");
        
        for (const table of TABLES_TO_TRUNCATE) {
            console.log(`🧹 Truncating table: ${table}...`);
            await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        }
        
        console.log("\n✨ Cleanup Finished Successfully!");
        
        // Verification
        console.log("\n📊 Verification:");
        const res = await client.query(`
            SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')))[1]::text::int as row_count
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ANY($1)
        `, [TABLES_TO_TRUNCATE]);
        
        res.rows.forEach(row => {
            console.log(`   - ${row.table_name}: ${row.row_count} rows`);
        });

        const preserveRes = await client.query(`
             SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')))[1]::text::int as row_count
             FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name IN ('skills', 'job_categories')
        `);
        console.log("\n✅ Preserved Tables:");
        preserveRes.rows.forEach(row => {
            console.log(`   - ${row.table_name}: ${row.row_count} rows`);
        });

    } catch (err) {
        console.error("\n❌ Cleanup Failed:", err.message);
    } finally {
        await client.end();
    }
}

cleanup();
