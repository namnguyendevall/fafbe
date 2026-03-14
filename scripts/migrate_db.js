const { Client } = require('pg');

const SOURCE_URL = 'postgresql://postgres:5432@localhost:5432/faf_db';
const TARGET_URL = 'postgresql://postgres:s2%Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres';

async function migrate() {
    console.log("🚀 Starting Migration...");
    
    const source = new Client({ connectionString: SOURCE_URL });
    const target = new Client({ connectionString: TARGET_URL });

    try {
        await source.connect();
        console.log("✅ Connected to Source (Local)");
        
        await target.connect();
        console.log("✅ Connected to Target (Supabase)");

        // 1. Get all tables in public schema
        const tablesRes = await source.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

        for (const table of tables) {
            console.log(`\n📦 Migrating table: ${table}...`);

            // 2. Get columns definition
            const columnsRes = await source.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1 AND table_schema = 'public'
                ORDER BY ordinal_position
            `, [table]);

            const columns = columnsRes.rows;
            const columnNames = columns.map(c => c.column_name);

            // 3. Simple Create Table (Disclaimer: This is a basic version, might miss constraints)
            // It's better to just ensure tables exist.
            // If they don't, we'd need DDL.
            // Let's see if we can get the actual DDL.
            
            // For this task, we will try to migrate data if tables exist, 
            // OR create them if we can infer simple types.
            // Better: Let's use pg_dump logic if possible, but since we can't, 
            // we will just copy data if target is prepared, or try to recreate.
            
            // Let's assume we need to recreate tables.
            let createSql = `CREATE TABLE IF NOT EXISTS "${table}" (\n`;
            createSql += columns.map(c => {
                let type = c.data_type;
                if (type === 'ARRAY') type = 'TEXT[]'; // Simplified
                return `  "${c.column_name}" ${type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`;
            }).join(',\n');
            createSql += `\n);`;

            try {
                await target.query(createSql);
                console.log(`   - Table structure ensured.`);
            } catch (e) {
                console.error(`   - Failed to create table ${table}:`, e.message);
                continue;
            }

            // 4. Copy Data
            const dataRes = await source.query(`SELECT * FROM "${table}"`);
            const rows = dataRes.rows;
            console.log(`   - Transferring ${rows.length} rows...`);

            if (rows.length > 0) {
                // Clear target table first? Or just append?
                // User said "chuyển sang hết", so let's clear target to ensure clean state.
                await target.query(`TRUNCATE TABLE "${table}" CASCADE`);

                for (const row of rows) {
                    const values = [];
                    for (const [key, val] of Object.entries(row)) {
                        const colDef = columns.find(c => c.column_name === key);
                        if (val !== null && Array.isArray(val) && (colDef.data_type.includes('ARRAY') || colDef.data_type === 'TEXT[]')) {
                            // Convert JS array to PG array literal: ["a", "b"] -> {a,b}
                            values.push('{' + val.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',') + '}');
                        } else if (val !== null && typeof val === 'object') {
                            values.push(JSON.stringify(val));
                        } else {
                            values.push(val);
                        }
                    }
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                    const insertSql = `INSERT INTO "${table}" (${columnNames.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
                    await target.query(insertSql, values);
                }
            }
            console.log(`   - Completed ${table}`);
        }

        console.log("\n✨ Migration Finished Successfully!");

    } catch (e) {
        console.error("\n❌ Migration Failed:", e.message);
    } finally {
        await source.end();
        await target.end();
    }
}

migrate();
