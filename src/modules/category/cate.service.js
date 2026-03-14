const pool = require("../../config/database")


exports.getActiveCategories = async () => {
  const { rows } = await pool.query(`
    SELECT id, name, slug, description
    FROM job_categories
    WHERE is_active = true
    ORDER BY name ASC
  `);
  return rows;
};


exports.getCategoryById = async (categoryId) => {
  const { rows } = await pool.query(`
    SELECT id, name, is_active
    FROM job_categories
    WHERE id = $1
    LIMIT 1
  `, [categoryId]);

  return rows[0];
};

exports.proposeCategory = async ({ userId, name, description }) => {
  const { rows } = await pool.query(`
    INSERT INTO category_proposals (user_id, name, description, status, created_at)
    VALUES ($1, $2, $3, 'PENDING', NOW())
    RETURNING *
  `, [userId, name, description]);

  return rows[0];
};

exports.createCategory = async ({ name, slug, description }) => {
  const { rows } = await pool.query(`
    INSERT INTO job_categories (name, slug, description, is_active, created_at)
    VALUES ($1, $2, $3, true, NOW())
    RETURNING *
  `, [name, slug, description]);

  return rows[0];
};