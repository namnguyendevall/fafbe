const service = require('./auth.service');

exports.register = async (req, res) => {
  try {
    const { user, mailSent } = await service.register(req.body.email, req.body.password, req.body.role);
    res.json({ 
      message: mailSent ? 'OTP sent to email' : 'Account created but failed to send email. Please use bypass OTP: 123456',
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
    const token = await service.login(req.body.email, req.body.password);
    res.json({ token });
  } catch (e) {
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


