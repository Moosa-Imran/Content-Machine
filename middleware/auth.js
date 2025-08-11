// middleware/auth.js
// Authentication middleware to protect routes

const requireAuth = (req, res, next) => {
    // Check if user is logged in via session
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    
    // If not authenticated, redirect to login page
    return res.redirect('/login');
};

const redirectIfAuthenticated = (req, res, next) => {
    // If user is already logged in, redirect to dashboard
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return res.redirect('/');
    }
    
    return next();
};

module.exports = {
    requireAuth,
    redirectIfAuthenticated
};