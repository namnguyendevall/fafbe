const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function resetAndSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Truncating tables...');
    const tables = [
        'notifications', 'messages', 'conversation_participants', 'conversations',
        'otps', 'post_comments', 'post_likes', 'posts', 'user_followers',
        'review_skill_ratings', 'reviews', 'work_sessions', 'withdrawal_requests',
        'checkpoints', 'contracts', 'proposals', 'job_skills', 'jobs', 
        'user_skills', 'transactions', 'wallets', 'user_profiles', 'users',
        'skills', 'job_categories'
    ];

    for (const table of tables) {
        try {
            await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
            console.log(`- Truncated ${table}`);
        } catch (e) {
            console.warn(`- Table ${table} not found or skipped: ${e.message}`);
        }
    }

    console.log('Seeding Categories...');
    const categories = [
        ['Chỉnh sửa Video', 'video-editing'],
        ['Quay phim & Cinematography', 'videography'],
        ['Kỹ xảo hình ảnh (VFX)', 'vfx'],
        ['Đồ họa chuyển động (Motion Graphics)', 'motion-graphics'],
        ['Dựng phim ngắn (TikTok/Reels/Shorts)', 'short-form-video'],
        ['Lồng tiếng & Âm thanh', 'audio-production'],
        ['Biên kịch & Kịch bản', 'scriptwriting']
    ];

    for (const [name, slug] of categories) {
        await client.query('INSERT INTO job_categories (name, slug) VALUES ($1, $2)', [name, slug]);
        console.log(`- Seeded category: ${name}`);
    }

    console.log('Seeding Skills...');
    const skills = [
        ['Adobe Premiere Pro', 'premiere-pro'],
        ['Adobe After Effects', 'after-effects'],
        ['DaVinci Resolve', 'davinci-resolve'],
        ['CapCut', 'capcut'],
        ['Final Cut Pro', 'final-cut'],
        ['Quay phim 4K', '4k-filming'],
        ['Chỉnh màu (Color Grading)', 'color-grading'],
        ['Hiệu ứng âm thanh (Sound FX)', 'sound-design'],
        ['Thiết kế nhân vật 3D', '3d-animation'],
        ['Kỹ thuật Green Screen', 'chroma-key'],
        ['Kịch bản Viral TikTok', 'viral-script'],
        ['Biên tập Subtitles', 'subtitling']
    ];

    for (const [name, slug] of skills) {
        await client.query('INSERT INTO skills (name, slug) VALUES ($1, $2)', [name, slug]);
        console.log(`- Seeded skill: ${name}`);
    }

    await client.query('COMMIT');
    console.log('DATABASE RESET AND SEEDED SUCCESSFULLY!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during reset/seed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndSeed();
