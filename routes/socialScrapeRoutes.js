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

// Initialize the ApifyClient with token from environment
const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

router.post('/scrape-instagram-hashtags', async (req, res) => {
    // **FIX:** Increase the timeout for this specific route to 5 minutes (300,000 ms)
    // This gives the scraper more time to complete its job before the server times out.
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
        // Run the Actor and wait for it to finish
        const run = await client.actor("apify/instagram-hashtag-scraper").call(input);

        // Fetch Actor results from the run's dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        // --- Check for existing URLs in the database ---
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

        // --- Translate non-English captions ---
        const processedPostsPromises = uniquePosts.map(async (post) => {
            if (!post.caption || post.caption.trim() === '') {
                return post; // Return post as is if there's no caption
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
                post.caption = translatedCaption.trim(); // Update the caption with the result
                return post;
            } catch (error) {
                console.warn(`Caption translation failed for post ${post.url}. Using original caption.`, error);
                return post; // In case of an error, return the original post
            }
        });

        const processedPosts = await Promise.all(processedPostsPromises);

        res.json(processedPosts);
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
