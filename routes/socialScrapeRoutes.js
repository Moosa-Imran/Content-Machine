// routes/socialScrapeRoutes.js
// Handles all API routes for social media scraping.

const express = require('express');
const router = express.Router();
require('dotenv').config();
const { ApifyClient } = require('apify-client');
const fetch = require('node-fetch');
const { ObjectId } = require('mongodb');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { callGeminiAPI } = require('../services/aiService');
const { getIgHashtags, getIgCompetitors, addIgCompetitor } = require('../utils/dbHelpers');

// Initialize the ApifyClient with token from environment
const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

router.post('/scrape-instagram-hashtags', async (req, res) => {
    res.setTimeout(600000);

    const { hashtags, resultsType, resultsLimit } = req.body;

    if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
        return res.status(400).json({ error: 'Hashtags array is required.' });
    }

    const input = {
        hashtags: hashtags,
        resultsLimit: resultsLimit || 5,
        resultsType: resultsType || "stories"
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
    res.setTimeout(600000);

    const { directUrls, resultsType, onlyPostsNewerThan, resultsLimit } = req.body;

    if (!directUrls || !Array.isArray(directUrls) || directUrls.length === 0) {
        return res.status(400).json({ error: 'Competitor usernames are required.' });
    }

    const fullUrls = directUrls.map(username => `https://www.instagram.com/${username}/`);

    const input = {
        directUrls: fullUrls,
        resultsType: resultsType || "stories",
        onlyPostsNewerThan: onlyPostsNewerThan || "1 week",
        resultsLimit: resultsLimit || 5
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

router.post('/add-competitor', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username is required.' });
    }

    try {
        const db = getDB();
        const existing = await db.collection('Keywords').findOne({ name: 'ig-competitors', competitors: username });
        if (existing) {
            return res.json({ success: true, alreadyExists: true, message: `${username} is already in the competitor list.` });
        }

        await addIgCompetitor(username);
        res.json({ success: true, message: `${username} added to competitors.` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add competitor.' });
    }
});

// --- CONTENT POOL ROUTES ---

router.get('/instagram-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const minViews = parseInt(req.query.minViews) || 0;
        const minLikes = parseInt(req.query.minLikes) || 0;
        const minComments = parseInt(req.query.minComments) || 0;
        const dateFilter = req.query.dateFilter || 'any';

        let mongoQuery = { used: { $ne: true } };
        if (minViews > 0) {
            mongoQuery.videoPlayCount = { $gte: minViews };
        }
        if (minLikes > 0) {
            mongoQuery.likesCount = { $gte: minLikes };
        }
        if (minComments > 0) {
            mongoQuery.commentsCount = { $gte: minComments };
        }
        if (dateFilter !== 'any') {
            let hours = 0;
            if (dateFilter === '24h') hours = 24;
            if (dateFilter === '7d') hours = 24 * 7;
            if (dateFilter === '30d') hours = 24 * 30;
            const cutoffDate = new Date(new Date().getTime() - (hours * 60 * 60 * 1000));
            mongoQuery.timestamp = { $gte: cutoffDate.toISOString() };
        }

        const posts = await db.collection('ig_posts').find(mongoQuery).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray();
        const totalPosts = await db.collection('ig_posts').countDocuments(mongoQuery);

        res.json({
            posts,
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching Instagram posts from DB:", error);
        res.status(500).json({ error: 'Failed to fetch posts from the content pool.' });
    }
});

router.get('/saved-instagram-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await db.collection('saved_content').find().sort({ savedAt: -1 }).skip(skip).limit(limit).toArray();
        const totalPosts = await db.collection('saved_content').countDocuments();

        res.json({
            posts,
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching saved Instagram posts from DB:", error);
        res.status(500).json({ error: 'Failed to fetch saved posts.' });
    }
});

router.post('/run-hashtag-scrape-job', async (req, res) => {
        res.setTimeout(600000);

    const { hashtags, resultsLimit } = req.body;
    try {
        const db = getDB();
        const hashtagsToScrape = hashtags || await getIgHashtags();
        const limit = resultsLimit || 5;

        const input = {
            hashtags: hashtagsToScrape,
            resultsLimit: limit,
            resultsType: "stories"
        };

        const run = await client.actor("apify/instagram-hashtag-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        let newPostsCount = 0;
        for (const post of items) {
            const existingPost = await db.collection('ig_posts').findOne({ url: post.url });
            if (!existingPost) {
                await db.collection('ig_posts').insertOne(post);
                newPostsCount++;
            }
        }
        res.json({ success: true, message: `Scraping complete. Added ${newPostsCount} new posts to the content pool.` });
    } catch (error) {
        console.error("Error running hashtag scrape job:", error);
        res.status(500).json({ error: 'Failed to run the scraping job.' });
    }
});

router.post('/save-instagram-post', async (req, res) => {
    const { post } = req.body;
    if (!post || !post._id) {
        return res.status(400).json({ error: 'Post data is required.' });
    }

    try {
        const db = getDB();
        const postId = new ObjectId(post._id);

        await db.collection('saved_content').insertOne({ ...post, originalId: postId, savedAt: new Date() });
        const result = await db.collection('ig_posts').updateOne({ _id: postId }, { $set: { used: true } });

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Post not found in the content pool or already marked as used.' });
        }
        res.json({ success: true, message: 'Post successfully saved and marked as used.' });
    } catch (error) {
        console.error("Error saving post:", error);
        res.status(500).json({ error: 'Failed to save the post.' });
    }
});

router.delete('/instagram-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const postId = new ObjectId(req.params.id);
        const result = await db.collection('ig_posts').updateOne({ _id: postId }, { $set: { used: true } });

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Post not found or already marked as used.' });
        }
        res.json({ success: true, message: 'Post marked as used.' });
    } catch (error) {
        console.error("Error marking post as used:", error);
        res.status(500).json({ error: 'Failed to mark the post as used.' });
    }
});

router.delete('/saved-instagram-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        let query;

        // Check if the provided ID is a valid BSON ObjectId string
        if (ObjectId.isValid(id)) {
            // If it's valid, the _id in the DB could be an ObjectId or a string.
            // This query handles both cases.
            query = {
                $or: [
                    { _id: new ObjectId(id) },
                    { _id: id } 
                ]
            };
        } else {
            // If it's not a valid ObjectId string, it must be stored as a string.
            query = { _id: id };
        }

        const result = await db.collection('saved_content').deleteOne(query);

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Saved post not found.' });
        }

        res.json({ success: true, message: 'Saved post deleted successfully.' });
    } catch (error) {
        console.error("Error deleting saved post:", error);
        res.status(500).json({ error: 'Failed to delete the saved post.' });
    }
});

// --- COMPETITOR CONTENT POOL ROUTES ---

// Get paginated competitor posts
router.get('/competitor-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const minViews = parseInt(req.query.minViews) || 0;
        const minLikes = parseInt(req.query.minLikes) || 0;
        const minComments = parseInt(req.query.minComments) || 0;
        const dateFilter = req.query.dateFilter || 'any';

        let mongoQuery = { used: { $ne: true } };
        if (minViews > 0) {
            mongoQuery.videoPlayCount = { $gte: minViews };
        }
        if (minLikes > 0) {
            mongoQuery.likesCount = { $gte: minLikes };
        }
        if (minComments > 0) {
            mongoQuery.commentsCount = { $gte: minComments };
        }
        if (dateFilter !== 'any') {
            let hours = 0;
            if (dateFilter === '24h') hours = 24;
            if (dateFilter === '7d') hours = 24 * 7;
            if (dateFilter === '30d') hours = 24 * 30;
            const cutoffDate = new Date(new Date().getTime() - (hours * 60 * 60 * 1000));
            mongoQuery.timestamp = { $gte: cutoffDate.toISOString() };
        }

        const posts = await db.collection('ig_competitor').find(mongoQuery).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray();
        const totalPosts = await db.collection('ig_competitor').countDocuments(mongoQuery);

        res.json({
            posts,
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching competitor posts from DB:", error);
        res.status(500).json({ error: 'Failed to fetch competitor posts.' });
    }
});

// Save competitor post
router.post('/save-competitor-post', async (req, res) => {
    const { post } = req.body;
    if (!post || !post._id) {
        return res.status(400).json({ error: 'Post data is required.' });
    }
    try {
        const db = getDB();
        const postId = new ObjectId(post._id);
        await db.collection('saved_content').insertOne({ ...post, originalId: postId, savedAt: new Date() });
        const result = await db.collection('ig_competitor').updateOne({ _id: postId }, { $set: { used: true } });
        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Post not found in the competitor pool or already marked as used.' });
        }
        res.json({ success: true, message: 'Post successfully saved and marked as used.' });
    } catch (error) {
        console.error("Error saving competitor post:", error);
        res.status(500).json({ error: 'Failed to save the competitor post.' });
    }
});

// Mark competitor post as used (delete from pool)
router.delete('/competitor-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const postId = new ObjectId(req.params.id);
        const result = await db.collection('ig_competitor').updateOne({ _id: postId }, { $set: { used: true } });
        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Post not found or already marked as used.' });
        }
        res.json({ success: true, message: 'Competitor post marked as used.' });
    } catch (error) {
        console.error("Error marking competitor post as used:", error);
        res.status(500).json({ error: 'Failed to mark the competitor post as used.' });
    }
});

// Run competitor scrape job and update pool
router.post('/run-competitor-scrape-job', async (req, res) => {
        res.setTimeout(600000);
    const { competitors, resultsLimit } = req.body;
    try {
        const db = getDB();
        // If not provided, get default competitors
        const competitorsToScrape = competitors || (await getIgCompetitors());
        const limit = resultsLimit || 5;
        const fullUrls = competitorsToScrape.map(username => `https://www.instagram.com/${username}/`);
        const input = {
            directUrls: fullUrls,
            resultsType: "stories",
            onlyPostsNewerThan: "1 week",
            resultsLimit: limit
        };
        const run = await client.actor("apify/instagram-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        let newPostsCount = 0;
        for (const post of items) {
            const existingPost = await db.collection('ig_competitor').findOne({ url: post.url });
            if (!existingPost) {
                await db.collection('ig_competitor').insertOne(post);
                newPostsCount++;
            }
        }
        res.json({ success: true, message: `Scraping complete. Added ${newPostsCount} new competitor posts to the pool.` });
    } catch (error) {
        console.error("Error running competitor scrape job:", error);
        res.status(500).json({ error: 'Failed to run the competitor scraping job.' });
    }
});

// --- UTILITY ROUTES ---

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
