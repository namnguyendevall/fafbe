const pool = require("../../config/database");
const sql = require("./review.sql");
const moderationService = require("../../services/moderation.service");

exports.createReview = async ({ contractId, reviewerId, rating, comment, skillRatings }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verify Contract exists and is completed
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        const contract = contractRes.rows[0];
        
        if (!contract) throw new Error("CONTRACT_NOT_FOUND");
        if (contract.status !== 'COMPLETED' && contract.status !== 'TERMINATED') {
            throw new Error("Chỉ có thể đánh giá các hợp đồng đã hoàn thành hoặc đã bị chấm dứt (sau tranh chấp)");
        }
        
        // 2. Determine reviewee (the other party)
        let revieweeId;
        let isClientReviewingWorker = false;
        if (contract.client_id === reviewerId) {
            // Client reviewing Worker
            revieweeId = contract.worker_id;
            isClientReviewingWorker = true;
        } else if (contract.worker_id === reviewerId) {
            // Worker reviewing Client
            const jobRes = await client.query('SELECT client_id FROM jobs WHERE id = $1', [contract.job_id]);
            revieweeId = jobRes.rows[0].client_id;
        } else {
            throw new Error("UNAUTHORIZED");
        }
        
        // 3. Check if already reviewed
        const existingRes = await client.query(sql.checkExisting, [contractId, reviewerId]);
        if (existingRes.rows.length > 0) throw new Error("ALREADY_REVIEWED");
        
        // 4. Moderate comment
        const moderationResult = await moderationService.moderateContent(comment || '');
        const moderationStatus = moderationService.getModerationStatus(moderationResult.approved);
        
        // 5. Create review
        const { rows } = await client.query(sql.create, [
            contractId,
            reviewerId,
            revieweeId,
            rating,
            comment,
            moderationStatus,
            JSON.stringify(moderationResult)
        ]);
        const review = rows[0];

        // 6. Handle Skill Ratings (only if client is reviewing worker)
        if (isClientReviewingWorker && skillRatings && Array.isArray(skillRatings)) {
            for (const sr of skillRatings) {
                const skill_id = sr.skillId || sr.skill_id;
                const skillRating = sr.rating;
                if (!skill_id || !skillRating) continue;


                // Insert into review_skill_ratings
                await client.query(sql.addSkillRating, [review.id, skill_id, skillRating]);

                // Calculate points delta based on new rules:
                // 1 star = -1, 2 star = 0, 3 star = +1, 4 star = +2, 5 star = +3
                let pointsDelta = 0;
                switch (Number(skillRating)) {
                    case 1: pointsDelta = -1; break;
                    case 2: pointsDelta = 0; break;
                    case 3: pointsDelta = 1; break;
                    case 4: pointsDelta = 2; break;
                    case 5: pointsDelta = 3; break;
                }

                if (pointsDelta !== 0) {
                    // Check if worker already has the skill
                    const existingSkillRes = await client.query('SELECT skill_points FROM user_skills WHERE user_id = $1 AND skill_id = $2', [revieweeId, skill_id]);
                    
                    if (existingSkillRes.rows.length > 0) {
                        // Worker has skill, update points
                        const currentPoints = Number(existingSkillRes.rows[0].skill_points);
                        const newPoints = currentPoints + pointsDelta;
                        
                        if (newPoints <= 0) {
                            // "nếu điểm bằng không thì xóa skill đó ra"
                            await client.query('DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2', [revieweeId, skill_id]);
                        } else {
                            await client.query('UPDATE user_skills SET skill_points = LEAST($1, 1000) WHERE user_id = $2 AND skill_id = $3', [newPoints, revieweeId, skill_id]);
                        }
                    } else if (pointsDelta > 0) {
                        // "nếu skill chưa có thì đánh giá từ 3 trở lên sẽ được cộng 1"
                        // Since pointsDelta > 0 only when rating >= 3, and the spec says "+1" for new skills:
                        await client.query('INSERT INTO user_skills (user_id, skill_id, skill_points) VALUES ($1, $2, 1)', [revieweeId, skill_id]);
                    }
                }
            }
        }
        
        // 7. Update User Global Rating and Stats
        const ratingStatsRes = await client.query(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating
            FROM reviews
            WHERE reviewee_id = $1 AND moderation_status = 'APPROVED'
        `, [revieweeId]);
        
        const totalReviews = parseInt(ratingStatsRes.rows[0].total_reviews);
        const avgRating = parseFloat(ratingStatsRes.rows[0].average_rating) || 0;

        // Update user_profiles (Ensuring profile exists)
        await client.query(`
            INSERT INTO user_profiles (user_id, rating_avg, total_jobs_done, updated_at)
            VALUES ($1, $2, CASE WHEN $3 = true THEN 1 ELSE 0 END, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                rating_avg = $2,
                total_jobs_done = CASE WHEN $3 = true THEN user_profiles.total_jobs_done + 1 ELSE user_profiles.total_jobs_done END,
                updated_at = NOW()
        `, [revieweeId, avgRating, isClientReviewingWorker]);

        // 8. Update Tier (New Innovation Feature)
        const userService = require('../users/user.service');
        await userService.updateUserTier(client, revieweeId);

        await client.query('COMMIT');

        return review;
        
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};


exports.getReviewsByUser = async (userId) => {
    const { rows } = await pool.query(sql.getByUser, [userId]);
    return rows;
};

exports.getReviewsByContract = async (contractId) => {
    const { rows } = await pool.query(sql.getByContract, [contractId]);
    return rows;
};

exports.getUserRating = async (userId) => {
    const { rows } = await pool.query(`
        SELECT 
            COUNT(*) as total_reviews,
            AVG(rating) as average_rating
        FROM reviews
        WHERE reviewee_id = $1 AND moderation_status = 'APPROVED'
    `, [userId]);
    
    return {
        totalReviews: parseInt(rows[0].total_reviews),
        averageRating: parseFloat(rows[0].average_rating) || 0
    };
};
