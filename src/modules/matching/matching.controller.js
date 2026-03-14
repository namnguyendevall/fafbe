const s = require("./matching.service");

/**
 * Get recommended jobs for the authenticated worker
 */
exports.getRecommendedJobs = async (req, res) => {
    try {
        const workerId = req.user.id;
        console.log('🔍 getRecommendedJobs called for worker:', workerId);
        console.log('📋 Query params:', req.query);
        
        const { 
            categoryId, 
            jobType, 
            minBudget, 
            maxBudget, 
            minMatchScore,
            limit 
        } = req.query;

        const options = {
            categoryId: categoryId ? parseInt(categoryId) : undefined,
            jobType,
            minBudget: minBudget ? parseFloat(minBudget) : undefined,
            maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
            minMatchScore: minMatchScore ? parseInt(minMatchScore) : 0,
            limit: limit ? parseInt(limit) : 20
        };

        console.log('⚙️ Options:', options);

        const jobs = await s.getRecommendedJobs(workerId, options);
        
        console.log(`✅ Found ${jobs.length} jobs`);
        
        return res.json({
            message: "Job recommendations based on your skills",
            data: jobs
        });
        
    } catch (error) {
        console.error('❌ Error in getRecommendedJobs controller:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

/**
 * Get recommended workers for a specific job
 */
exports.getRecommendedWorkers = async (req, res) => {
    try {
        const { jobId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        // Verify job ownership
        const pool = require("../../config/database");
        const jobRes = await pool.query('SELECT client_id FROM jobs WHERE id = $1', [jobId]);
        
        if (jobRes.rows.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }
        
        if (jobRes.rows[0].client_id !== req.user.id && req.user.role?.toLowerCase() !== 'admin') {
            return res.status(403).json({ message: "Unauthorized" });
        }
        
        const workers = await s.getRecommendedWorkers(jobId, limit);
        
        return res.json({
            message: "Worker recommendations based on job requirements",
            data: workers
        });
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Get AI semantic recommendations score for a specific job
 * GET /api/matching/ai-recommendations/:jobId
 */
exports.getAIRecommendations = async (req, res) => {
    try {
        const { jobId } = req.params;
        const workerId = req.user.id;

        const pool = require("../../config/database");

        // Fetch Worker Profile
        const workerRes = await pool.query(`
            SELECT u.email, up.full_name, up.bio, up.hourly_rate, up.education, up.experience, up.portfolio,
                   COALESCE(
                       json_agg(
                           json_build_object('name', s.name)
                       ) FILTER (WHERE s.id IS NOT NULL), '[]'
                   ) as skills
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN user_skills us ON u.id = us.user_id
            LEFT JOIN skills s ON us.skill_id = s.id
            WHERE u.id = $1
            GROUP BY u.id, up.full_name, up.bio, up.hourly_rate, up.education, up.experience, up.portfolio
        `, [workerId]);

        if (workerRes.rows.length === 0) return res.status(404).json({ message: "Worker not found" });
        const workerProfile = workerRes.rows[0];

        // Fetch Job Data
        const jobRes = await pool.query(`
            SELECT j.title, j.description, j.job_type, j.budget,
                   COALESCE(
                       json_agg(
                           json_build_object('name', s.name)
                       ) FILTER (WHERE s.id IS NOT NULL), '[]'
                   ) as required_skills_data
            FROM jobs j
            LEFT JOIN job_skills js ON j.id = js.job_id
            LEFT JOIN skills s ON js.skill_id = s.id
            WHERE j.id = $1
            GROUP BY j.id
        `, [jobId]);

        if (jobRes.rows.length === 0) return res.status(404).json({ message: "Job not found" });
        const jobData = jobRes.rows[0];

        // Call the service
        const aiResult = await s.getAILLLMMatchScore(workerId, jobId, workerProfile, jobData);

        return res.json({
            message: "AI Match Computed",
            data: aiResult
        });
    } catch (error) {
        console.error("AI Recommendation Setup Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
