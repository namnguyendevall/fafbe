module.exports = {
  create: `
    INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment, moderation_status, moderation_result, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *
  `,
  
  getByUser: `
    SELECT r.*, 
           reviewer.email as reviewer_email,
           reviewee.email as reviewee_email,
           c.job_id,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', rsr.id,
                 'skill_id', rsr.skill_id,
                 'skill_name', s.name,
                 'rating', rsr.rating
               )
             ) FILTER (WHERE rsr.id IS NOT NULL), 
             '[]'
           ) as "skillRatings"
    FROM reviews r
    JOIN users reviewer ON r.reviewer_id = reviewer.id
    JOIN users reviewee ON r.reviewee_id = reviewee.id
    JOIN contracts c ON r.contract_id = c.id
    LEFT JOIN review_skill_ratings rsr ON r.id = rsr.review_id
    LEFT JOIN skills s ON rsr.skill_id = s.id
    WHERE r.reviewee_id = $1 AND r.moderation_status = 'APPROVED'
    GROUP BY r.id, r.contract_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.moderation_status, r.moderation_result, r.created_at, reviewer.email, reviewee.email, c.job_id
    ORDER BY r.created_at DESC
  `,
  
  getByContract: `
    SELECT r.*, 
           reviewer.email as reviewer_email,
           reviewee.email as reviewee_email
    FROM reviews r
    JOIN users reviewer ON r.reviewer_id = reviewer.id
    JOIN users reviewee ON r.reviewee_id = reviewee.id
    WHERE r.contract_id = $1
    ORDER BY r.created_at DESC
  `,
  
  checkExisting: `
    SELECT id FROM reviews
    WHERE contract_id = $1 AND reviewer_id = $2
  `,

  addSkillRating: `
    INSERT INTO review_skill_ratings (review_id, skill_id, rating)
    VALUES ($1, $2, $3)
    RETURNING *
  `,

  updateUserSkillPoints: `
    INSERT INTO user_skills (user_id, skill_id, skill_points)
    VALUES ($1, $2, 1)
    ON CONFLICT (user_id, skill_id) DO UPDATE 
    SET skill_points = LEAST(user_skills.skill_points + EXCLUDED.skill_points * $3, 1000)
    RETURNING *
  `
};

