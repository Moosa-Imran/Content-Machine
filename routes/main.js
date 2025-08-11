// routes/main.js
// Handles all application routing and orchestrates calls to services and utilities.

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// --- MODULE IMPORTS ---
const { requireAuth, redirectIfAuthenticated } = require('../middleware/auth');
const scriptRoutes = require('./scriptRoutes');
const frameworkRoutes = require('./frameworkRoutes');
const newsRoutes = require('./newsRoutes');
const socialScrapeRoutes = require('./socialScrapeRoutes');

// MongoDB connection
let db;
MongoClient.connect(process.env.MONGODB_URI)
    .then(client => {
        console.log('Connected to MongoDB for authentication');
        db = client.db('Data'); // Use "Data" database
    })
    .catch(error => console.error('MongoDB connection error:', error));

// --- AUTHENTICATION ROUTES ---
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('login', { 
        title: 'Admin Login',
        error: null,
        username: ''
    });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Find user in Users collection with role 'admin'
        const user = await db.collection('Users').findOne({ 
            username: username, 
            role: 'admin' 
        });
        
        if (!user) {
            return res.render('login', {
                title: 'Admin Login',
                error: 'Invalid username or password',
                username: username
            });
        }
        
        // Check password (plain text comparison for now)
        if (user.password !== password) {
            return res.render('login', {
                title: 'Admin Login',
                error: 'Invalid username or password',
                username: username
            });
        }
        
        // Set session
        req.session.user = {
            id: user._id,
            username: user.username,
            role: user.role
        };
        
        // Redirect to dashboard
        res.redirect('/');
        
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            title: 'Admin Login',
            error: 'An error occurred during login. Please try again.',
            username: username
        });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

// --- PROTECTED PAGE RENDERING ROUTES ---
router.get('/', requireAuth, async (req, res) => {
    try {
        // Get real stats from database
        const [businessCasesCount, igPostsCount, tiktokPostsCount, youtubePostsCount, usersCount] = await Promise.all([
            db.collection('Business_Cases').countDocuments(),
            db.collection('ig_posts').countDocuments(),
            db.collection('tiktok_posts').countDocuments(),
            db.collection('youtube_posts').countDocuments(),
            db.collection('Users').countDocuments({ role: 'admin' })
        ]);

        const totalContentFetched = igPostsCount + tiktokPostsCount + youtubePostsCount;

        const stats = {
            scriptsGenerated: businessCasesCount,
            contentFetched: totalContentFetched,
            activeUsers: usersCount
        };

        res.render('index', { 
            title: 'Dashboard', 
            user: req.session.user, 
            stats: stats 
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Fallback stats if database error occurs
        const stats = {
            scriptsGenerated: 0,
            contentFetched: 0,
            activeUsers: 0
        };
        res.render('index', { 
            title: 'Dashboard', 
            user: req.session.user, 
            stats: stats 
        });
    }
});
router.get('/breakdown', requireAuth, (req, res) => res.render('breakdown', { title: 'Tactic Breakdowns', user: req.session.user }));
router.get('/sheet', requireAuth, (req, res) => res.render('sheet', { title: 'Analyze Sheet', user: req.session.user }));
router.get('/news', requireAuth, (req, res) => res.render('news', { title: 'Industry News', user: req.session.user }));
router.get('/validate', requireAuth, (req, res) => res.render('validate', { title: 'Edit Validation Prompt', user: req.session.user }));
router.get('/social-scrape', requireAuth, (req, res) => res.render('social-scrape', { title: 'Social Media Scrape', user: req.session.user }));
router.get('/saved-content', requireAuth, (req, res) => res.render('saved-content', { title: 'Saved Content', user: req.session.user }));
router.get('/instagram-hashtags-live', requireAuth, (req, res) => res.render('instagram-hashtags-live', { title: 'Instagram Hashtag Scraper', user: req.session.user }));
router.get('/instagram-hashtags', requireAuth, (req, res) => res.render('instagram-hashtags', { title: 'Instagram Content Pool', user: req.session.user }));
router.get('/instagram-competitor', requireAuth, (req, res) => res.render('instagram-competitor', { title: 'Instagram Competitor Scraper', user: req.session.user }));
router.get('/instagram-competitor-live', requireAuth, (req, res) => res.render('instagram-competitors-live', { title: 'Instagram Competitor Live', user: req.session.user }));
router.get('/tiktok-hashtags-live', requireAuth, (req, res) => res.render('tiktok-hashtags-live', { title: 'TikTok Hashtag Scraper', user: req.session.user }));
router.get('/tiktok-hashtags', requireAuth, (req, res) => res.render('tiktok-hashtags', { title: 'TikTok Content Pool', user: req.session.user }));
router.get('/youtube-hashtags-live', requireAuth, (req, res) => res.render('youtube-hashtags-live', { title: 'YouTube Live Scraper', user: req.session.user }));
router.get('/youtube-hashtags', requireAuth, (req, res) => res.render('youtube-hashtags', { title: 'YouTube Content Pool', user: req.session.user }));
router.get('/reels', requireAuth, (req, res) => res.render('reels', { title: 'Viral Scripts', contentFeed: [], user: req.session.user }));
router.get('/framework', requireAuth, (req, res) => res.render('framework', { title: 'Script Framework Editor', user: req.session.user }));

// --- USE API ROUTE MODULES ---
// All API routes are prefixed with /api and require authentication
router.use('/api', requireAuth, scriptRoutes);
router.use('/api', requireAuth, frameworkRoutes);
router.use('/api', requireAuth, newsRoutes);
router.use('/api', requireAuth, socialScrapeRoutes);

module.exports = router;
