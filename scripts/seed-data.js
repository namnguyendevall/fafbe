const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

const categories = [
    { name: 'Programming & Tech', slug: 'programming-tech', description: 'Software development, web apps, mobile, and DevOps.' },
    { name: 'Graphics & Design', slug: 'graphics-design', description: 'Logo design, UI/UX, illustrations, and 3D modeling.' },
    { name: 'Digital Marketing', slug: 'digital-marketing', description: 'SEO, social media, ads, and content strategy.' },
    { name: 'Writing & Translation', slug: 'writing-translation', description: 'Copywriting, technical writing, and localized translations.' },
    { name: 'Video & Animation', slug: 'video-animation', description: 'Video editing, motion graphics, and 2D/3D animation.' },
    { name: 'AI Services', slug: 'ai-services', description: 'Prompt engineering, AI integration, and machine learning.' },
    { name: 'Business', slug: 'business', description: 'Project management, admin support, and financial consulting.' }
];

const allSkills = [
    // Tech
    'JavaScript', 'TypeScript', 'Node.js', 'React', 'Vue', 'Next.js', 'Angular', 'Python', 'Django', 'Flask', 'Java', 'Spring', 'C#', '.NET', 'Go', 'PHP', 'Laravel', 'Swift', 'Kotlin', 'PostgreSQL', 'MongoDB', 'Docker', 'Kubernetes', 'AWS', 'Google Cloud', 'Azure', 'DevOps', 'Cyber Security',
    // Design
    'Photoshop', 'Illustrator', 'Figma', 'Sketch', 'UI/UX Design', '3D Modeling', 'Blender', 'Logo Design', 'Branding', 'Typography',
    // Marketing
    'SEO', 'SEM', 'Social Media Marketing', 'Email Marketing', 'Google Ads', 'Facebook Ads', 'Content Strategy', 'Data Analytics',
    // Writing
    'Copywriting', 'Technical Writing', 'Content Writing', 'Translation', 'Creative Writing', 'Proofreading',
    // Video
    'Video Editing', 'Motion Graphics', 'After Effects', 'Premiere Pro', '2D Animation', '3D Animation',
    // AI
    'Prompt Engineering', 'Machine Learning', 'Data Science', 'Deep Learning', 'PyTorch', 'TensorFlow', 'AI API Integration',
    // Business
    'Project Management', 'Agile/Scrum', 'Business Analysis', 'Virtual Assistant', 'Data Entry', 'Financial Analysis', 'Business Strategy'
];

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start
        .replace(/-+$/, '');            // Trim - from end
}

async function seed() {
    try {
        console.log('--- Seeding Categories and Skills ---');

        // Seed Categories
        console.log('Inserting categories...');
        for (const cat of categories) {
            await pool.query(
                `INSERT INTO job_categories (name, slug, description, is_active) 
                 VALUES ($1, $2, $3, true) 
                 ON CONFLICT DO NOTHING`,
                [cat.name, cat.slug, cat.description]
            );
        }
        console.log(`✅ Seeded ${categories.length} categories.`);

        // Seed Skills
        console.log('Inserting skills...');
        for (const skill of allSkills) {
            await pool.query(
                `INSERT INTO skills (name, slug, is_active) 
                 VALUES ($1, $2, true) 
                 ON CONFLICT DO NOTHING`,
                [skill, slugify(skill)]
            );
        }
        console.log(`✅ Seeded ${allSkills.length} skills.`);

        console.log('✅ Seeding COMPLETED successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during seeding:', err.message);
        process.exit(1);
    }
}

seed();
