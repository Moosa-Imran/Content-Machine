// routes/main.js
// Handles all application routing and orchestrates calls to services and utilities.

const express = require('express');
const router = express.Router();

// --- MODULE IMPORTS ---
const scriptRoutes = require('./scriptRoutes');
const frameworkRoutes = require('./frameworkRoutes');
const newsRoutes = require('./newsRoutes');
const socialScrapeRoutes = require('./socialScrapeRoutes');

// --- PAGE RENDERING ROUTES ---
router.get('/', (req, res) => res.render('index', { title: 'Dashboard' }));
router.get('/breakdown', (req, res) => res.render('breakdown', { title: 'Tactic Breakdowns' }));
router.get('/sheet', (req, res) => res.render('sheet', { title: 'Analyze Sheet' }));
router.get('/news', (req, res) => res.render('news', { title: 'Industry News' }));
router.get('/validate', (req, res) => res.render('validate', { title: 'Edit Validation Prompt' }));
router.get('/social-scrape', (req, res) => res.render('social-scrape', { title: 'Social Media Scrape' }));
router.get('/saved-content', (req, res) => res.render('saved-content', { title: 'Saved Content' }));
router.get('/instagram-hashtags-live', (req, res) => res.render('instagram-hashtags-live', { title: 'Instagram Hashtag Scraper' }));
router.get('/instagram-hashtags', (req, res) => res.render('instagram-hashtags', { title: 'Instagram Content Pool' }));
router.get('/instagram-competitor', (req, res) => res.render('instagram-competitor', { title: 'Instagram Competitor Scraper' }));
router.get('/instagram-competitor-live', (req, res) => res.render('instagram-competitors-live', { title: 'Instagram Competitor Live' }));
router.get('/tiktok-hashtags-live', (req, res) => res.render('tiktok-hashtags-live', { title: 'TikTok Hashtag Scraper' }));
router.get('/tiktok-hashtags', (req, res) => res.render('tiktok-hashtags', { title: 'TikTok Content Pool' }));
router.get('/youtube-hashtags-live', (req, res) => res.render('youtube-hashtags-live', { title: 'YouTube Live Scraper' }));
router.get('/youtube-hashtags', (req, res) => res.render('youtube-hashtags', { title: 'YouTube Content Pool' }));
router.get('/reels', (req, res) => res.render('reels', { title: 'Viral Scripts', contentFeed: [] }));
router.get('/framework', (req, res) => res.render('framework', { title: 'Script Framework Editor' }));

// --- USE API ROUTE MODULES ---
// All API routes are prefixed with /api
router.use('/api', scriptRoutes);
router.use('/api', frameworkRoutes);
router.use('/api', newsRoutes);
router.use('/api', socialScrapeRoutes);


module.exports = router;
