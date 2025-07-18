// routes/socialScrapeRoutes.js
// Handles all API routes for social media scraping.

const express = require('express');
const router = express.Router();
require('dotenv').config();
const { ApifyClient } = require('apify-client');
const fetch = require('node-fetch');

// Initialize the ApifyClient with token from environment
const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

router.post('/scrape-instagram-hashtags', async (req, res) => {
    const { hashtags, resultsType } = req.body;

    if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
        return res.status(400).json({ error: 'Hashtags array is required.' });
    }

    const input = {
        hashtags: hashtags,
        resultsLimit: 50, // Increased limit to get more data for client-side filtering
        resultsType: resultsType || "posts" // Use 'stories' for reels
    };

    try {
        // Run the Actor and wait for it to finish
        const run = await client.actor("apify/instagram-hashtag-scraper").call(input);

        // Fetch Actor results from the run's dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        res.json(items);
    } catch (error) {
        console.error("Error running Apify actor:", error);
        res.status(500).json({ error: 'Failed to scrape Instagram hashtags.' });
    }
});

// Image Proxy Route
router.get('/image-proxy', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).send('Image URL is required.');
        }

        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
            return res.status(imageResponse.status).send('Failed to fetch image.');
        }

        res.setHeader('Content-Type', imageResponse.headers.get('content-type'));
        imageResponse.body.pipe(res);

    } catch (error) {
        console.error('Image proxy error:', error);
        res.status(500).send('Error fetching image.');
    }
});


module.exports = router;
