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
const { getIgHashtags, getIgCompetitors, getTiktokHashtags, getYoutubeHashtags, addIgCompetitor } = require('../utils/dbHelpers');

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

router.post('/scrape-tiktok-hashtags', async (req, res) => {
    res.setTimeout(600000);

    const { hashtags, resultsLimit } = req.body;

    if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
        return res.status(400).json({ error: 'Hashtags are required.' });
    }

    const input = {
        hashtags,
        resultsPerPage: resultsLimit || 10
    };

    try {
        const run = await client.actor("clockworks/tiktok-hashtag-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        const fetchedUrls = items.map(post => post.webVideoUrl);
        let uniquePosts = [];

        if (fetchedUrls.length > 0) {
            const db = getDB();
            const existingCases = await db.collection('Business_Cases').find({
                source_url: { $in: fetchedUrls }
            }).project({ source_url: 1 }).toArray();
            
            const existingUrls = new Set(existingCases.map(caseDoc => caseDoc.source_url));
            uniquePosts = items.filter(post => !existingUrls.has(post.webVideoUrl));
        }

        const processedPostsPromises = uniquePosts.map(async (post) => {
            if (!post.text || post.text.trim() === '') {
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
                "${post.text}"
            `;

            try {
                const translatedText = await callGeminiAPI(translationPrompt, false);
                post.text = translatedText.trim();
                return post;
            } catch (error) {
                console.warn(`Text translation failed for post ${post.webVideoUrl}. Using original text.`, error);
                return post;
            }
        });

        const processedPosts = await Promise.all(processedPostsPromises);
        res.json(processedPosts);
    } catch (error) {
        console.error("Error running Apify actor:", error);
        res.status(500).json({ error: 'Failed to scrape TikTok hashtags.' });
    }
});

router.post('/transcribe-tiktok-video', async (req, res) => {
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
        console.error('TikTok transcription proxy error:', error);
        res.status(500).json({ error: 'Failed to transcribe TikTok video.' });
    }
});

router.post('/save-tiktok-post', async (req, res) => {
    const { post } = req.body;
    if (!post || !post.id) {
        return res.status(400).json({ error: 'Post data is required.' });
    }

    try {
        const db = getDB();
        await db.collection('saved_tiktok_content').insertOne({ 
            ...post, 
            savedAt: new Date(),
            platform: 'tiktok'
        });
        res.json({ success: true, message: 'TikTok post successfully saved.' });
    } catch (error) {
        console.error("Error saving TikTok post:", error);
        res.status(500).json({ error: 'Failed to save the TikTok post.' });
    }
});

router.post('/save-live-post', async (req, res) => {
    const { post } = req.body;
    if (!post || (!post.id && !post._id)) {
        return res.status(400).json({ error: 'Post data is required.' });
    }

    try {
        const db = getDB();
        await db.collection('saved_content').insertOne({ 
            ...post, 
            savedAt: new Date()
        });
        res.json({ success: true, message: 'Post successfully saved.' });
    } catch (error) {
        console.error("Error saving live post:", error);
        res.status(500).json({ error: 'Failed to save the post.' });
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

router.get('/default-tiktok-hashtags', async (req, res) => {
    try {
        const hashtags = await getTiktokHashtags();
        res.json({ hashtags });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch default hashtags.' });
    }
});

router.get('/default-youtube-hashtags', async (req, res) => {
    try {
        const keywords = await getYoutubeHashtags();
        res.json({ keywords });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch default keywords.' });
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

// --- HASHTAG CONTENT POOL ROUTES ---

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

router.delete('/saved-posts/:id', async (req, res) => {
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

// Legacy route for backward compatibility
router.delete('/saved-instagram-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        let query;

        // Check if the provided ID is a valid BSON ObjectId string
        if (ObjectId.isValid(id)) {
            query = {
                $or: [
                    { _id: new ObjectId(id) },
                    { _id: id } 
                ]
            };
        } else {
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

// --- TIKTOK CONTENT POOL ROUTES ---

router.get('/tiktok-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const minPlays = parseInt(req.query.minPlays) || 0;
        const minLikes = parseInt(req.query.minLikes) || 0;
        const minComments = parseInt(req.query.minComments) || 0;
        const minShares = parseInt(req.query.minShares) || 0;
        const dateFilter = req.query.dateFilter || 'any';
        const minDuration = parseInt(req.query.minDuration) || 0;

        let mongoQuery = { used: { $ne: true } };
        if (minPlays > 0) {
            mongoQuery.playCount = { $gte: minPlays };
        }
        if (minLikes > 0) {
            mongoQuery.diggCount = { $gte: minLikes };
        }
        if (minComments > 0) {
            mongoQuery.commentCount = { $gte: minComments };
        }
        if (minShares > 0) {
            mongoQuery.shareCount = { $gte: minShares };
        }
        if (minDuration > 0) {
            mongoQuery['videoMeta.duration'] = { $gte: minDuration };
        }
        if (dateFilter !== 'any') {
            let hours = 0;
            if (dateFilter === '24h') hours = 24;
            if (dateFilter === '7d') hours = 24 * 7;
            if (dateFilter === '30d') hours = 24 * 30;
            const cutoffDate = new Date(new Date().getTime() - (hours * 60 * 60 * 1000));
            mongoQuery.createTimeISO = { $gte: cutoffDate.toISOString() };
        }

        const posts = await db.collection('tiktok_posts').find(mongoQuery).sort({ createTimeISO: -1 }).skip(skip).limit(limit).toArray();
        const totalPosts = await db.collection('tiktok_posts').countDocuments(mongoQuery);

        res.json({
            posts,
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching TikTok posts from DB:", error);
        res.status(500).json({ error: 'Failed to fetch posts from the content pool.' });
    }
});

router.post('/run-tiktok-hashtag-scrape-job', async (req, res) => {
    res.setTimeout(600000);

    const { hashtags, resultsLimit } = req.body;
    try {
        const db = getDB();
        const hashtagsToScrape = hashtags || await getTiktokHashtags();
        const limit = resultsLimit || 10;

        const input = {
            hashtags: hashtagsToScrape,
            resultsPerPage: limit
        };

        const run = await client.actor("clockworks/tiktok-hashtag-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        let newPostsCount = 0;
        for (const post of items) {
            const existingPost = await db.collection('tiktok_posts').findOne({ id: post.id });
            if (!existingPost) {
                await db.collection('tiktok_posts').insertOne(post);
                newPostsCount++;
            }
        }
        res.json({ success: true, message: `Scraping complete. Added ${newPostsCount} new TikTok posts to the content pool.` });
    } catch (error) {
        console.error("Error running TikTok hashtag scrape job:", error);
        res.status(500).json({ error: 'Failed to run the TikTok scraping job.' });
    }
});

router.post('/save-tiktok-post-pool', async (req, res) => {
    const { post } = req.body;
    if (!post || !post._id) {
        return res.status(400).json({ error: 'Post data is required.' });
    }

    try {
        const db = getDB();
        const postId = new ObjectId(post._id);

        await db.collection('saved_content').insertOne({ ...post, originalId: postId, savedAt: new Date() });
        const result = await db.collection('tiktok_posts').updateOne({ _id: postId }, { $set: { used: true } });

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Post not found in the content pool or already marked as used.' });
        }
        res.json({ success: true, message: 'TikTok post successfully saved and marked as used.' });
    } catch (error) {
        console.error("Error saving TikTok post:", error);
        res.status(500).json({ error: 'Failed to save the TikTok post.' });
    }
});

router.delete('/tiktok-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const postId = new ObjectId(req.params.id);
        const result = await db.collection('tiktok_posts').updateOne({ _id: postId }, { $set: { used: true } });

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Post not found or already marked as used.' });
        }
        res.json({ success: true, message: 'TikTok post marked as used.' });
    } catch (error) {
        console.error("Error marking TikTok post as used:", error);
        res.status(500).json({ error: 'Failed to mark the TikTok post as used.' });
    }
});

router.delete('/saved-tiktok-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        let query;

        if (ObjectId.isValid(id)) {
            query = {
                $or: [
                    { _id: new ObjectId(id) },
                    { _id: id } 
                ]
            };
        } else {
            query = { _id: id };
        }

        const result = await db.collection('saved_content').deleteOne(query);

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Saved TikTok post not found.' });
        }

        res.json({ success: true, message: 'Saved TikTok post deleted successfully.' });
    } catch (error) {
        console.error("Error deleting saved TikTok post:", error);
        res.status(500).json({ error: 'Failed to delete the saved TikTok post.' });
    }
});

// Saved Content Route
// Universal Saved Content Route
router.get('/saved-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const platform = req.query.platform || 'all'; // 'instagram', 'tiktok', 'youtube', or 'all'

        // Build filter based on platform
        let filter = {};
        if (platform === 'instagram') {
            // Instagram posts have properties like 'ownerUsername', 'displayUrl', etc.
            filter.$or = [
                { ownerUsername: { $exists: true } },
                { platform: 'instagram' },
                { url: { $regex: 'instagram.com' } }
            ];
        } else if (platform === 'tiktok') {
            // TikTok posts have properties like 'authorMeta', 'webVideoUrl', etc.
            filter.$or = [
                { authorMeta: { $exists: true } },
                { platform: 'tiktok' },
                { webVideoUrl: { $exists: true } }
            ];
        } else if (platform === 'youtube') {
            // YouTube posts have properties like 'channelTitle', 'title', 'isShorts', etc.
            filter.$or = [
                { channelTitle: { $exists: true } },
                { platform: 'youtube' },
                { isShorts: { $exists: true } },
                { url: { $regex: 'youtube.com|youtu.be' } }
            ];
        }
        // 'all' doesn't add any filter

        const posts = await db.collection('saved_content').find(filter).sort({ savedAt: -1 }).skip(skip).limit(limit).toArray();
        const totalPosts = await db.collection('saved_content').countDocuments(filter);

        res.json({
            posts,
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page,
            platform
        });
    } catch (error) {
        console.error("Error fetching Saved Content from DB:", error);
        res.status(500).json({ error: 'Failed to fetch Saved Content.' });
    }
});

// Legacy route for backward compatibility
router.get('/saved-instagram-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Filter for Instagram posts
        const filter = {
            $or: [
                { ownerUsername: { $exists: true } },
                { platform: 'instagram' },
                { url: { $regex: 'instagram.com' } }
            ]
        };

        const posts = await db.collection('saved_content').find(filter).sort({ savedAt: -1 }).skip(skip).limit(limit).toArray();
        const totalPosts = await db.collection('saved_content').countDocuments(filter);

        res.json({
            posts,
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching Saved Content from DB:", error);
        res.status(500).json({ error: 'Failed to fetch Saved Content.' });
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


router.post('/save-default-ig-hashtags', async (req, res) => {
    const { hashtags } = req.body;
    
    if (!hashtags || !Array.isArray(hashtags)) {
        return res.status(400).json({ error: 'Hashtags array is required.' });
    }

    try {
        const db = getDB();
        
        // Update the default Instagram hashtags document
        await db.collection('Keywords').updateOne(
            { name: 'ig-hashtags' },
            { 
                $set: { 
                    hashtags: hashtags,
                    name: 'ig-hashtags'
                }
            },
            { upsert: true }
        );

        res.json({ success: true, message: 'Default Instagram hashtags saved successfully.' });
    } catch (error) {
        console.error('Error saving default Instagram hashtags:', error);
        res.status(500).json({ error: 'Failed to save default Instagram hashtags.' });
    }
});

router.post('/save-default-tiktok-hashtags', async (req, res) => {
    const { hashtags } = req.body;
    
    if (!hashtags || !Array.isArray(hashtags)) {
        return res.status(400).json({ error: 'Hashtags array is required.' });
    }

    try {
        const db = getDB();
        
        // Update the default TikTok hashtags document
        await db.collection('Keywords').updateOne(
            { name: 'tiktok-hashtags' },
            { 
                $set: { 
                    hashtags: hashtags,
                    name: 'tiktok-hashtags'
                }
            },
            { upsert: true }
        );

        res.json({ success: true, message: 'Default TikTok hashtags saved successfully.' });
    } catch (error) {
        console.error('Error saving default TikTok hashtags:', error);
        res.status(500).json({ error: 'Failed to save default TikTok hashtags.' });
    }
});

router.post('/save-default-ig-competitors', async (req, res) => {
    const { competitors } = req.body;
    
    if (!competitors || !Array.isArray(competitors)) {
        return res.status(400).json({ error: 'Competitors array is required.' });
    }

    try {
        const db = getDB();
        
        // Update the default Instagram competitors document
        await db.collection('Keywords').updateOne(
            { name: 'ig-competitors' },
            { 
                $set: { 
                    competitors: competitors,
                    name: 'ig-competitors'
                }
            },
            { upsert: true }
        );

        res.json({ success: true, message: 'Default Instagram competitors saved successfully.' });
    } catch (error) {
        console.error('Error saving default Instagram competitors:', error);
        res.status(500).json({ error: 'Failed to save default Instagram competitors.' });
    }
});

// --- YOUTUBE CONTENT POOL ROUTES ---

router.post('/scrape-youtube-keywords', async (req, res) => {
    res.setTimeout(600000);

    const { keywords, resultsLimit, duration, uploadDate } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'Keywords array is required.' });
    }

    const input = {
        "keywords": keywords,
        "maxItems": resultsLimit || 20,
        "duration": "s", // "s" for short (< 4 minutes) - this will include Shorts
        "uploadDate": uploadDate || "w", // "w" for this week
        "sort": "r", // "r" for relevance to keywords
        "gl": "us", // Geographic location
        "hl": "en", // Language
        "features": "all" // Include all features
    };

    try {
        const run = await client.actor("apidojo/youtube-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        // Filter to ensure we only get shorts (duration < 60 seconds)
        const shortsOnly = items.filter(video => {
            const duration = video.duration || video.lengthSeconds || 0;
            return duration <= 60; // Only videos 60 seconds or less
        });

        const fetchedUrls = shortsOnly.map(post => post.url);
        let uniquePosts = [];

        if (fetchedUrls.length > 0) {
            const db = getDB();
            const existingCases = await db.collection('Business_Cases').find({
                source_url: { $in: fetchedUrls }
            }).project({ source_url: 1 }).toArray();
            
            const existingUrls = new Set(existingCases.map(caseDoc => caseDoc.source_url));
            uniquePosts = shortsOnly.filter(post => !existingUrls.has(post.url));
        } else {
            uniquePosts = shortsOnly;
        }

        const processedPostsPromises = uniquePosts.map(async (post) => {
            const processedPost = {
                ...post,
                viewCount: post.views || 0,
                likeCount: post.likes || 0,
                commentCount: post.comments || 0,
                channelTitle: post.channel?.name || 'Unknown Channel',
                channelThumbnail: post.channel?.thumbnails?.[0]?.url,
                thumbnail: post.thumbnails?.find(t => t.width >= 480)?.url || post.thumbnails?.[0]?.url,
                publishedAt: post.publishDate || post.uploadDate,
                platform: 'youtube',
                duration: post.duration || post.lengthSeconds || 0,
                isShorts: true // Mark as YouTube Shorts
            };
            
            return processedPost;
        });

        const processedPosts = await Promise.all(processedPostsPromises);
        res.json(processedPosts);
    } catch (error) {
        console.error("Error running YouTube scraper:", error);
        res.status(500).json({ error: 'Failed to scrape YouTube videos.' });
    }
});

router.get('/youtube-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const minViews = parseInt(req.query.minViews) || 0;
        const minLikes = parseInt(req.query.minLikes) || 0;
        const minComments = parseInt(req.query.minComments) || 0;
        const dateFilter = req.query.dateFilter || 'any';
        const minDuration = parseInt(req.query.minDuration) || 0;
        const maxDuration = parseInt(req.query.maxDuration) || 0;

        let mongoQuery = { used: { $ne: true }, platform: 'youtube' };

        if (minViews > 0) {
            mongoQuery.viewCount = { $gte: minViews };
        }
        if (minLikes > 0) {
            mongoQuery.likeCount = { $gte: minLikes };
        }
        if (minComments > 0) {
            mongoQuery.commentCount = { $gte: minComments };
        }
        if (minDuration > 0) {
            mongoQuery.duration = { $gte: minDuration };
        }
        if (maxDuration > 0) {
            if (mongoQuery.duration) {
                mongoQuery.duration.$lte = maxDuration;
            } else {
                mongoQuery.duration = { $lte: maxDuration };
            }
        }

        if (dateFilter !== 'any') {
            let dateThreshold = new Date();
            switch (dateFilter) {
                case 'h':
                    dateThreshold.setHours(dateThreshold.getHours() - 1);
                    break;
                case 'd':
                    dateThreshold.setDate(dateThreshold.getDate() - 1);
                    break;
                case 'w':
                    dateThreshold.setDate(dateThreshold.getDate() - 7);
                    break;
                case 'm':
                    dateThreshold.setMonth(dateThreshold.getMonth() - 1);
                    break;
                case 'y':
                    dateThreshold.setFullYear(dateThreshold.getFullYear() - 1);
                    break;
            }
            mongoQuery.publishedAt = { $gte: dateThreshold.toISOString() };
        }

        const posts = await db.collection('youtube_posts').find(mongoQuery).sort({ publishedAt: -1 }).skip(skip).limit(limit).toArray();
        const totalPosts = await db.collection('youtube_posts').countDocuments(mongoQuery);

        res.json({
            posts,
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching YouTube posts from DB:", error);
        res.status(500).json({ error: 'Failed to fetch posts from the content pool.' });
    }
});

router.post('/run-youtube-keyword-scrape-job', async (req, res) => {
    res.setTimeout(600000);

    const { keywords, resultsLimit } = req.body;
    try {
        const db = getDB();
        const keywordsToScrape = keywords || await getYoutubeHashtags();
        const limit = resultsLimit || 20;

        const input = {
            "keywords": keywordsToScrape,
            "maxItems": limit,
            "duration": "s", // "s" for short (< 4 minutes) - includes Shorts
            "uploadDate": "w", // "w" for this week
            "sort": "r", // "r" for relevance to keywords
            "gl": "us",
            "hl": "en",
            "features": "all"
        };

        const run = await client.actor("apidojo/youtube-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        // Filter to ensure we only get shorts (duration < 60 seconds)
        const shortsOnly = items.filter(video => {
            const duration = video.duration || video.lengthSeconds || 0;
            return duration <= 60;
        });

        let newPostsCount = 0;
        for (const post of shortsOnly) {
            const existingPost = await db.collection('youtube_posts').findOne({ id: post.id });
            if (!existingPost) {
                const processedPost = {
                    ...post,
                    viewCount: post.views || 0,
                    likeCount: post.likes || 0,
                    commentCount: post.comments || 0,
                    channelTitle: post.channel?.name || 'Unknown Channel',
                    channelThumbnail: post.channel?.thumbnails?.[0]?.url,
                    thumbnail: post.thumbnails?.find(t => t.width >= 480)?.url || post.thumbnails?.[0]?.url,
                    publishedAt: post.publishDate || post.uploadDate,
                    platform: 'youtube',
                    duration: post.duration || post.lengthSeconds || 0,
                    isShorts: true,
                    timestamp: new Date(),
                    used: false
                };
                await db.collection('youtube_posts').insertOne(processedPost);
                newPostsCount++;
            }
        }
        res.json({ success: true, message: `Scraping complete. Added ${newPostsCount} new YouTube Shorts to the content pool.` });
    } catch (error) {
        console.error("Error running YouTube keyword scrape job:", error);
        res.status(500).json({ error: 'Failed to run the YouTube scraping job.' });
    }
});

router.post('/save-youtube-post-pool', async (req, res) => {
    const { post } = req.body;
    if (!post || !post._id) {
        return res.status(400).json({ error: 'Post data is required.' });
    }

    try {
        const db = getDB();
        const postId = new ObjectId(post._id);

        await db.collection('saved_content').insertOne({ ...post, originalId: postId, savedAt: new Date() });
        const result = await db.collection('youtube_posts').updateOne({ _id: postId }, { $set: { used: true } });

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'YouTube post not found.' });
        }
        res.json({ success: true, message: 'YouTube video successfully saved and marked as used.' });
    } catch (error) {
        console.error("Error saving YouTube post:", error);
        res.status(500).json({ error: 'Failed to save the YouTube video.' });
    }
});

router.delete('/youtube-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const postId = new ObjectId(req.params.id);
        const result = await db.collection('youtube_posts').updateOne({ _id: postId }, { $set: { used: true } });

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'YouTube post not found.' });
        }
        res.json({ success: true, message: 'YouTube video marked as used.' });
    } catch (error) {
        console.error("Error marking YouTube post as used:", error);
        res.status(500).json({ error: 'Failed to mark the YouTube video as used.' });
    }
});

router.post('/transcribe-youtube-video', async (req, res) => {
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
            throw new Error(`Transcription service responded with status ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('YouTube transcription proxy error:', error);
        res.status(500).json({ error: 'Failed to transcribe YouTube video.' });
    }
});

router.post('/save-default-youtube-keywords', async (req, res) => {
    const { keywords } = req.body;
    
    if (!keywords || !Array.isArray(keywords)) {
        return res.status(400).json({ error: 'Keywords array is required.' });
    }

    try {
        const db = getDB();
        
        // Update the default YouTube keywords document
        await db.collection('Keywords').updateOne(
            { name: 'youtube-hashtags' },
            { 
                $set: { 
                    hashtags: keywords,
                    name: 'youtube-hashtags'
                }
            },
            { upsert: true }
        );

        res.json({ success: true, message: 'Default YouTube keywords saved successfully.' });
    } catch (error) {
        console.error('Error saving default YouTube keywords:', error);
        res.status(500).json({ error: 'Failed to save default YouTube keywords.' });
    }
});


module.exports = router;
