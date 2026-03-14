const pool = require("../../config/database");
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_prevent_crash'
});

/**
 * Perform an AI semantic match using OpenAI
 * @param {Object} workerProfile - Full details of the worker (bio, skills, education, experience, portfolio)
 * @param {Object} jobData - Full details of the job (title, description, required skills, job type, budget)
 * @returns {Promise<{match_score: number, reason: string}>}
 */
exports.getAILLLMMatchScore = async (workerId, jobId, workerProfile, jobData) => {
    // 1. Check Cache first
    const client = await pool.connect();
    try {
        const cacheRes = await client.query('SELECT match_score, reason FROM ai_match_cache WHERE worker_id = $1 AND job_id = $2', [workerId, jobId]);
        if (cacheRes.rows.length > 0) {
            return cacheRes.rows[0];
        }

        // 2. Fetch from OpenAI if no cache (and if we have an API key)
        if (!process.env.OPENAI_API_KEY) {
            return {
                match_score: 50,
                reason: "[Mock] AI matching requires OPENAI_API_KEY to be configured in .env."
            };
        }

        // Construct highly detailed System Prompt
        const prompt = `
You are an expert IT HR AI Assistant. Your task is to evaluate the technical fit between a Worker's CV and a Job Posting.
You must return your response STRICTLY as a JSON object with exactly two keys: "match_score" (an integer from 0 to 100) and "reason" (a short, concise string max 150 characters explaining why, in Vietnamese).

DO NOT wrap the response in markdown blocks like \`\`\`json. Just output the raw JSON string.

WORKER CV INFO:
- Bio: ${workerProfile.bio || 'N/A'}
- Title: ${workerProfile.title || 'N/A'}
- Hourly Rate: $${workerProfile.hourly_rate || 0}/hr
- Education: ${JSON.stringify(workerProfile.education || [])}
- Experience: ${JSON.stringify(workerProfile.experience || [])}
- Portfolio: ${JSON.stringify(workerProfile.portfolio || [])}
- Mastered Skills: ${JSON.stringify(workerProfile.skills || [])}

JOB POSTING:
- Title: ${jobData.title}
- Description: ${jobData.description}
- Type: ${jobData.job_type}
- Budget: $${jobData.budget}
- Required Skills: ${JSON.stringify(jobData.required_skills_data || [])}
`;
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: prompt }],
            temperature: 0.3, // Low temperature for consistent scoring
            max_tokens: 150
        });

        let aiResult = { match_score: 0, reason: "Phân tích AI thất bại, hãy thử lại." };

        try {
            const rawText = response.choices[0].message.content.trim();
            aiResult = JSON.parse(rawText);
        } catch (parseError) {
            console.error("Failed to parse OpenAI response:", response.choices[0].message.content);
            // Attempt to glean some fallback score
            aiResult = {
                match_score: 65,
                reason: "Robot AI không thể parse dữ liệu, nhưng có vẻ bạn phù hợp với công việc này."
            };
        }

        // Clamp score to 0-100
        aiResult.match_score = Math.max(0, Math.min(100, aiResult.match_score || 0));

        // Save to cache securely
        await client.query(`
            INSERT INTO ai_match_cache (worker_id, job_id, match_score, reason) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (worker_id, job_id) 
            DO UPDATE SET match_score = EXCLUDED.match_score, reason = EXCLUDED.reason, created_at = CURRENT_TIMESTAMP
        `, [workerId, jobId, aiResult.match_score, aiResult.reason]);

        return aiResult;
    } catch (e) {
        console.error("OpenAI matching error:", e);
        return { match_score: 0, reason: "Lỗi Server nội bộ khi phân tích AI." };
    } finally {
        client.release();
    }
};

/**
 * Calculate skill match score between user skills and job skills
 * @param {Object} userSkillMap - Map of skill IDs to points { id: points }
 * @param {Array<number>} jobSkills - Array of skill IDs job requires
 * @returns {number} Sum of matching skill points
 */
const calculateMatchScore = (userSkillMap, jobSkills) => {
    if (!jobSkills || jobSkills.length === 0) return 0;
    if (!userSkillMap || Object.keys(userSkillMap).length === 0) return 0;
    
    let totalPoints = 0;
    jobSkills.forEach(skillId => {
        if (userSkillMap[skillId]) {
            totalPoints += userSkillMap[skillId];
        }
    });
    
    return totalPoints;
};

/**
 * Get recommended jobs for a worker based on their skills with filtering
 * @param {number} workerId 
 * @param {object} options - Filter options
 * @returns {Promise<Array>}
 */
exports.getRecommendedJobs = async (workerId, options = {}) => {
    const {
        categoryId,
        jobType,
        minBudget,
        maxBudget,
        minMatchScore = 0,
        limit = 20
    } = options;

    const client = await pool.connect();
    try {
        // 1. Get user's skills with points
        const userSkillsRes = await client.query(`
            SELECT skill_id, skill_points FROM user_skills WHERE user_id = $1
        `, [workerId]);
        
        const userSkillMap = {};
        const userSkillIds = [];
        userSkillsRes.rows.forEach(r => {
            userSkillMap[r.skill_id] = r.skill_points;
            userSkillIds.push(r.skill_id);
        });
        
        console.log(`👤 Worker ${workerId} has ${userSkillIds.length} skills with points tracking`);
        
        // Build dynamic WHERE conditions
        let whereConditions = [`j.status = 'OPEN'`];

        let queryParams = [workerId];
        let paramIndex = 2;

        if (categoryId) {
            whereConditions.push(`j.category_id = $${paramIndex}`);
            queryParams.push(categoryId);
            paramIndex++;
        }

        if (jobType) {
            whereConditions.push(`j.job_type = $${paramIndex}`);
            queryParams.push(jobType);
            paramIndex++;
        }

        if (minBudget) {
            whereConditions.push(`j.budget >= $${paramIndex}`);
            queryParams.push(minBudget);
            paramIndex++;
        }

        if (maxBudget) {
            whereConditions.push(`j.budget <= $${paramIndex}`);
            queryParams.push(maxBudget);
            paramIndex++;
        }

        // Add condition to exclude jobs user already applied to
        whereConditions.push(`NOT EXISTS (
            SELECT 1 FROM proposals p 
            WHERE p.job_id = j.id AND p.worker_id = $1
        )`);

        const whereClause = whereConditions.join(' AND ');
        
        // 2. Get all jobs with their skills
        const sqlQuery = `
            SELECT 
                   j.id,
                   j.client_id,
                   j.category_id,
                   j.title,
                   j.description,
                   j.job_type,
                   j.budget,
                   j.status,
                   j.created_at,
                   j.updated_at,
                   u.email as client_email,
                   c.name as category_name,
                   COALESCE(
                       json_agg(
                           jsonb_build_object(
                               'id', s.id,
                               'name', s.name,
                               'slug', s.slug
                           ) ORDER BY s.id
                       ) FILTER (WHERE s.id IS NOT NULL),
                       '[]'
                   ) AS skills,
                   ARRAY_AGG(s.id ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL) as required_skills
            FROM jobs j
            LEFT JOIN users u ON j.client_id = u.id
            LEFT JOIN job_categories c ON j.category_id = c.id
            LEFT JOIN job_skills js ON j.id = js.job_id
            LEFT JOIN skills s ON s.id = js.skill_id
            WHERE ${whereClause}
            GROUP BY j.id, j.client_id, j.category_id, j.title, j.description, j.job_type, j.budget, j.status, j.created_at, j.updated_at, u.email, c.name
            ORDER BY j.created_at DESC
        `;
        
        const jobsRes = await client.query(sqlQuery, queryParams);
        
        // 3. Calculate match score for each job
        const jobsWithScore = jobsRes.rows.map(job => {
            const jobSkills = job.required_skills || [];
            const matchScore = calculateMatchScore(userSkillMap, jobSkills);
            
            // Calculate a simple match percentage for display
            const matchingSkills = userSkillIds.filter(s => jobSkills.includes(s));
            const matchPercentage = jobSkills.length > 0 ? Math.round((matchingSkills.length / jobSkills.length) * 100) : 0;
            
            return {
                ...job,
                match_score: matchScore, // Now reflects skill points
                match_percentage: matchPercentage,
                matching_skills_count: matchingSkills.length,
                total_required_skills: jobSkills.length
            };
        });
        
        // 4. Filter by minimum match score (if needed) and sort
        const filteredJobs = jobsWithScore
            .filter(job => job.match_score >= minMatchScore)
            .sort((a, b) => {
                // Primary sort: match score (descending)
                if (b.match_score !== a.match_score) {
                    return b.match_score - a.match_score;
                }
                // Secondary sort: created_at (newest first)
                return new Date(b.created_at) - new Date(a.created_at);
            })
            .slice(0, limit);
        
        return filteredJobs;

        
    } catch (error) {
        console.error('❌ Error in getRecommendedJobs service:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Get recommended workers for a job based on required skills
 * @param {number} jobId 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
exports.getRecommendedWorkers = async (jobId, limit = 10) => {
    const client = await pool.connect();
    try {
        // 1. Get job's required skills
        const jobSkillsRes = await client.query(`
            SELECT skill_id FROM job_skills WHERE job_id = $1
        `, [jobId]);
        
        const jobSkills = jobSkillsRes.rows.map(r => r.skill_id);
        
        if (jobSkills.length === 0) {
            return []; // No required skills, can't recommend
        }
        
        // 2. Get all freelancers with their skills (including points) and reviews
        const workersRes = await client.query(`
            SELECT u.id, u.email,
                   up.full_name, up.bio, up.hourly_rate,
                   COALESCE(
                       json_agg(
                           jsonb_build_object(
                               'id', us.skill_id,
                               'points', us.skill_points
                           )
                       ) FILTER (WHERE us.skill_id IS NOT NULL),
                       '[]'
                   ) as user_skills_data,
                   COUNT(DISTINCT r.id) as total_reviews,
                   COALESCE(AVG(r.rating), 0) as average_rating
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN user_skills us ON u.id = us.user_id
            LEFT JOIN reviews r ON u.id = r.reviewee_id AND r.moderation_status = 'APPROVED'
            WHERE u.role = 'worker' 
              AND u.email_verified = true
              AND NOT EXISTS (
                  SELECT 1 FROM contracts c 
                  WHERE c.worker_id = u.id AND c.status = 'ACTIVE'
              )
            GROUP BY u.id, u.email, up.full_name, up.bio, up.hourly_rate
        `);

        
        // 3. Calculate match score for each worker
        const workersWithScore = workersRes.rows.map(worker => {
            const userSkillsData = worker.user_skills_data || [];
            
            // Convert to map for calculateMatchScore
            const userSkillMap = {};
            userSkillsData.forEach(s => {
                userSkillMap[s.id] = s.points;
            });

            const skillMatchPoints = calculateMatchScore(userSkillMap, jobSkills);
            
            // Bonus points for high ratings (can adjust multiplier as needed)
            const ratingBonus = worker.total_reviews > 0 ? (worker.average_rating / 5) * 10 : 0;
            const finalScore = skillMatchPoints + ratingBonus;
            
            return {
                id: worker.id,
                email: worker.email,
                full_name: worker.full_name,
                bio: worker.bio,
                hourly_rate: worker.hourly_rate,
                match_score: Math.round(finalScore),
                skill_match_points: skillMatchPoints,
                matching_skills_count: userSkillsData.filter(s => jobSkills.includes(s.id)).length,
                total_required_skills: jobSkills.length,
                total_reviews: parseInt(worker.total_reviews),
                average_rating: parseFloat(worker.average_rating).toFixed(2)
            };
        });
        
        // 4. Sort by match score (highest first) and limit
        const sortedWorkers = workersWithScore
            .filter(worker => worker.skill_match_points > 0) // Only workers with matching skills
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, limit);
        
        return sortedWorkers;

        
    } finally {
        client.release();
    }
};
