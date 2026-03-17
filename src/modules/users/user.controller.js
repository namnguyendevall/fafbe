const s = require('./user.service');

exports.me = async (req, res) => {
  try {
    const profile = await s.getMyProfile(req.user.id);
    res.json(profile);
  } catch (error) {
    console.error('Error in me controller:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const profile = await s.updateProfile(req.user.id, req.body);
    res.json(profile);
  } catch (error) {
    console.error('Error in updateMe controller:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    const result = await s.listUsers(page, limit);
    res.json(result);
  } catch (error) {
    console.error('Error in listUsers controller:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getFeaturedWorkers = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const workers = await s.getFeaturedWorkers(limit);
    res.json(workers);
  } catch (error) {
    console.error('Error in getFeaturedWorkers controller:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getTopTalents = async (req, res) => {
    try {
        const limit = Number(req.query.limit || 10);
        const talents = await s.getTopTalents(limit);
        res.json(talents);
    } catch (error) {
        console.error('Error in getTopTalents controller:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getPublicProfile = async (req, res) => {
  const profile = await s.getPublicProfile(req.params.id);
  if (!profile) return res.status(404).json({ message: "User not found" });
  res.json({ data: profile });
};

exports.getPortfolio = async (req, res) => {
    try {
        const items = await s.getPortfolio(req.params.userId);
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updatePortfolio = async (req, res) => {
    try {
        const profile = await s.updatePortfolio(req.user.id, req.body.items);
        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.followUser = async (req, res) => {
    try {
        const result = await s.followUser(req.user.id, req.params.id);
        res.json({ message: 'Followed user successfully', data: result });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.checkFollowStatus = async (req, res) => {
    try {
        const result = await s.checkFollowStatus(req.user.id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.unfollowUser = async (req, res) => {
    try {
        const result = await s.unfollowUser(req.user.id, req.params.id);
        res.json({ message: 'Unfollowed user successfully', data: result });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


