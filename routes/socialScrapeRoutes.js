// routes/socialScrapeRoutes.js
// Handles all API routes for social media scraping.

const express = require('express');
const router = express.Router();
require('dotenv').config();
const { ApifyClient } = require('apify-client');
const fetch = require('node-fetch');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { callGeminiAPI } = require('../services/aiService');
const { getIgHashtags, getIgCompetitors } = require('../utils/dbHelpers');

// Initialize the ApifyClient with token from environment
const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

router.post('/scrape-instagram-hashtags', async (req, res) => {
    res.setTimeout(300000);

    const { hashtags, resultsType } = req.body;

    if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
        return res.status(400).json({ error: 'Hashtags array is required.' });
    }

    const input = {
        hashtags: hashtags,
        resultsLimit: 50,
        resultsType: resultsType || "posts"
    };

    try {
        const run = await client.actor("apify/instagram-hashtag-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        const fetchedUrls = items.map(post => post.url);
        let uniquePosts = [];

        if (fetchedUrls.length > 0) {
            const db = getDB();
            const existingCases = await db.collection('Business_Cases').find({
                source_url: { $in: fetchedUrls }
            }).project({ source_url: 1 }).toArray();
            
            const existingUrls = new Set(existingCases.map(caseDoc => caseDoc.source_url));
            uniquePosts = items.filter(post => !existingUrls.has(post.url));
        }

        const processedPostsPromises = uniquePosts.map(async (post) => {
            if (!post.caption || post.caption.trim() === '') {
                return post;
            }

            const translationPrompt = `
                Your task is to analyze the following text to determine if it is in English. If it is not, you must translate it to English.

                **Instructions:**
                1.  Read the "Text to Analyze".
                2.  If the text is already in English, return the original text exactly as it is.
                3.  If the text is NOT in English, translate it to clear, natural-sounding English.
                4.  Return ONLY the final English text and nothing else. Do not add any introductory phrases or explanations.

                **Text to Analyze:**
                "${post.caption}"
            `;

            try {
                const translatedCaption = await callGeminiAPI(translationPrompt, false);
                post.caption = translatedCaption.trim();
                return post;
            } catch (error) {
                console.warn(`Caption translation failed for post ${post.url}. Using original caption.`, error);
                return post;
            }
        });

        const processedPosts = await Promise.all(processedPostsPromises);
        res.json(processedPosts);
    } catch (error) {
        console.error("Error running Apify actor:", error);
        res.status(500).json({ error: 'Failed to scrape Instagram hashtags.' });
    }
});

router.post('/scrape-instagram-competitors', async (req, res) => {
    res.setTimeout(300000);

    const { directUrls, resultsType, onlyPostsNewerThan } = req.body;

    if (!directUrls || !Array.isArray(directUrls) || directUrls.length === 0) {
        return res.status(400).json({ error: 'Competitor usernames are required.' });
    }

    const fullUrls = directUrls.map(username => `https://www.instagram.com/${username}/`);

    const input = {
        directUrls: fullUrls,
        resultsType: resultsType || "stories",
        onlyPostsNewerThan: onlyPostsNewerThan || "1 week",
        resultsLimit: 25
    };

    try {
        const run = await client.actor("apify/instagram-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        res.json(items);
    } catch (error) {
        console.error("Error running Apify actor:", error);
        res.status(500).json({ error: 'Failed to scrape Instagram competitors.' });
    }
});

router.get('/default-ig-hashtags', async (req, res) => {
    try {
        const hashtags = await getIgHashtags();
        res.json({ hashtags });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch default hashtags.' });
    }
});

router.get('/default-ig-competitors', async (req, res) => {
    try {
        const competitors = await getIgCompetitors();
        res.json({ competitors });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch default competitors.' });
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

// Transcription Proxy Route
router.post('/transcribe-video', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required for transcription.' });
    }
    try {
        const response = await fetch('http://localhost:3050/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Transcription service failed' }));
            throw new Error(errorData.error);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Transcription proxy error:', error);
        res.status(500).json({ error: 'Failed to transcribe video.' });
    }
});

module.exports = router;
