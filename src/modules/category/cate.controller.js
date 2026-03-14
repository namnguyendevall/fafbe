const s = require("../category/cate.service");

exports.listCategories = async (req, res) =>{
    try {
        const categories = await s.getActiveCategories();
        return res.status(200).json({
            message: "Categories retrieved successfully",
            data: categories
        });
    } catch (error) {
        console.error("Error in listCategories:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}



exports.createCategory = async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        message: 'name and slug are required',
      });
    }

    const category = await s.createCategory({
      name,
      slug,
      description,
    });

    return res.status(201).json({ data: category });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.proposeCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const proposal = await s.proposeCategory({
      userId,
      name,
      description
    });

    return res.status(201).json({ 
      message: 'Proposal submitted successfully',
      data: proposal 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};