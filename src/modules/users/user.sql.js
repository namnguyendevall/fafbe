module.exports = {
  getProfileByUserId: `
    SELECT u.id, u.email, u.role, u.status,
           p.full_name, p.avatar_url, p.bio,
           p.skills, p.education, p.experience,
           p.portfolio, p.social_links,
           p.location, p.hourly_rate, p.availability,
           p.rating_avg, p.total_jobs_done, p.created_at, p.updated_at,
           COALESCE(
             json_agg(
               json_build_object('skill_id', us.skill_id, 'name', s.name, 'skill_points', us.skill_points)
             ) FILTER (WHERE us.skill_id IS NOT NULL),
             '[]'
           ) as skill_mastery
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN user_skills us ON us.user_id = u.id
    LEFT JOIN skills s ON s.id = us.skill_id
    WHERE u.id = $1
    GROUP BY u.id, u.email, u.role, u.status,
             p.full_name, p.avatar_url, p.bio,
             p.skills, p.education, p.experience,
             p.portfolio, p.social_links,
             p.location, p.hourly_rate, p.availability,
             p.rating_avg, p.total_jobs_done, p.created_at, p.updated_at
  `,

  createProfile: `
    INSERT INTO user_profiles (user_id, full_name)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO NOTHING
  `,

  createWalletIfNotExist: `
    INSERT INTO wallets (user_id, balance_points, locked_points, updated_at)
    VALUES ($1, 0, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING
  `,

  getProfileWithWallet: `
    SELECT
  u.id,
  u.email,
  u.role,
  u.status,

  p.full_name,
  p.avatar_url,
  p.bio,
  p.skills,
  p.education,
  p.experience,
  p.portfolio,
  p.social_links,
  p.location,
  p.hourly_rate,
  p.availability,
  p.rating_avg,
  p.total_jobs_done,
  p.created_at as profile_created_at,
  p.updated_at,

  w.balance_points,
  w.locked_points,

  COALESCE(
    json_agg(
      json_build_object('skill_id', us.skill_id, 'name', s.name, 'skill_points', us.skill_points)
    ) FILTER (WHERE us.skill_id IS NOT NULL),
    '[]'
  ) as skill_mastery

FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
LEFT JOIN wallets w ON w.user_id = u.id
LEFT JOIN user_skills us ON us.user_id = u.id
LEFT JOIN skills s ON s.id = us.skill_id
WHERE u.id = $1
GROUP BY u.id, u.email, u.role, u.status,
         p.full_name, p.avatar_url, p.bio, p.skills, p.education, p.experience,
         p.portfolio, p.social_links, p.location, p.hourly_rate, p.availability,
         p.rating_avg, p.total_jobs_done, p.created_at, p.updated_at,
         w.balance_points, w.locked_points

  `,

  updateProfile: `
  INSERT INTO user_profiles (
    user_id, full_name, bio, skills,
    location, hourly_rate, availability,
    avatar_url, education, experience, portfolio,
    created_at, updated_at
  )
  VALUES (
    $1, $2, $3, $4::jsonb,
    $5, $6, $7,
    $8, $9::jsonb, $10::jsonb, $11::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    bio = EXCLUDED.bio,
    skills = EXCLUDED.skills,
    location = EXCLUDED.location,
    hourly_rate = EXCLUDED.hourly_rate,
    availability = EXCLUDED.availability,
    avatar_url = EXCLUDED.avatar_url,
    education = EXCLUDED.education,
    experience = EXCLUDED.experience,
    portfolio = EXCLUDED.portfolio,
    updated_at = NOW()
  RETURNING *
`,
  listUsers: `
    SELECT u.id, u.email, u.role, u.status, u.created_at,
           p.full_name, p.rating_avg, p.total_jobs_done, p.tier
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
    LIMIT $1 OFFSET $2
  `,

  countUsers: `
    SELECT COUNT(*) FROM users
  `,

  getFeaturedWorkers: `
    SELECT u.id, u.email, u.role, u.status,
           p.full_name, p.avatar_url, p.bio,
           p.skills, p.location, p.hourly_rate,
           p.rating_avg, p.total_jobs_done, p.created_at
    FROM users u
    JOIN user_profiles p ON p.user_id = u.id
    WHERE u.role = 'worker' AND u.status = 'active'
    ORDER BY p.rating_avg DESC NULLS LAST, p.created_at DESC
    LIMIT $1
  `,

  getPublicProfile: `
    SELECT u.id, u.email, u.role, u.status, u.created_at,
           p.full_name, p.avatar_url, p.bio,
           p.skills, p.education, p.experience,
           p.portfolio, p.social_links,
           p.location, p.hourly_rate, p.availability,
           p.rating_avg, p.total_jobs_done,
           (SELECT COUNT(*) FROM user_followers WHERE following_id = u.id) as followers_count,
           (SELECT COUNT(*) FROM user_followers WHERE follower_id = u.id) as following_count,
           COALESCE(
             json_agg(
               json_build_object('skill_id', us.skill_id, 'name', s.name, 'skill_points', us.skill_points)
             ) FILTER (WHERE us.skill_id IS NOT NULL),
             '[]'
           ) as skill_mastery
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN user_skills us ON us.user_id = u.id
    LEFT JOIN skills s ON s.id = us.skill_id
    WHERE u.id = $1
    GROUP BY u.id, u.email, u.role, u.status, u.created_at,
             p.full_name, p.avatar_url, p.bio, p.skills, p.education, p.experience,
             p.portfolio, p.social_links, p.location, p.hourly_rate, p.availability,
             p.rating_avg, p.total_jobs_done
  `,

  checkFollow: `
    SELECT 1 FROM user_followers
    WHERE follower_id = $1 AND following_id = $2
  `,

  followUser: `
    INSERT INTO user_followers (follower_id, following_id)
    VALUES ($1, $2)
    RETURNING *
  `,

  unfollowUser: `
    DELETE FROM user_followers
    WHERE follower_id = $1 AND following_id = $2
    RETURNING *
  `,

  getTopTalents: `
    SELECT u.id, u.email,
           p.full_name, p.avatar_url, p.bio,
           p.skills, p.location, p.hourly_rate,
           p.rating_avg, p.total_jobs_done, p.tier,
           COALESCE(SUM(t.amount), 0) as total_earnings
    FROM users u
    JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN wallets w ON w.user_id = u.id
    LEFT JOIN transactions t ON t.wallet_id = w.id AND t.type = 'RELEASE' AND t.status = 'SUCCESS'
    WHERE u.role = 'worker' AND u.status = 'active'
    GROUP BY u.id, p.full_name, p.avatar_url, p.bio, p.skills, p.location, p.hourly_rate, p.rating_avg, p.total_jobs_done, p.tier
    ORDER BY p.rating_avg DESC NULLS LAST, total_earnings DESC
    LIMIT $1
  `
};
