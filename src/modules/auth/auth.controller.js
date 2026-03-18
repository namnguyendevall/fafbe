const service = require('./auth.service');

exports.register = async (req, res) => {
  try {
    const { user, mailSent } = await service.register(req.body.email, req.body.password, req.body.role);
    res.json({ 
      message: mailSent ? 'OTP sent to email' : 'Account created. Please check your email for the OTP.',
      mailSent 
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    await service.verifyOtp(req.body.email, req.body.otp);
    res.json({ message: 'Verified successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    await service.sendOtp(req.body.email, 'Resend OTP');
    res.json({ message: 'OTP resent' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    console.log(`>>> [Login Controller] Attempting login for: ${req.body.email}`);
    const token = await service.login(req.body.email, req.body.password);
    console.log(`[Login Controller] SUCCESS for: ${req.body.email}`);
    res.json({ token });
  } catch (e) {
    console.error(`[Login Controller] FAILED for ${req.body.email}:`, e.message);
    res.status(401).json({ error: e.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    await service.forgotPassword(req.body.email);
    res.json({ message: 'OTP sent to email' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    await service.resetPassword(
      req.body.email,
      req.body.otp,
      req.body.newPassword
    );
    res.json({ message: 'Password updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new passwords required' });
    }
    await service.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};


