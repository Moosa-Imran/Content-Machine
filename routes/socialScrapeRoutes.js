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
        const dateFilter = req.query.dateFilter || 'any';

        let mongoQuery = { used: { $ne: true } };
        if (minViews > 0) {
            mongoQuery.videoPlayCount = { $gte: minViews };
        }
        if (minLikes > 0) {
            mongoQuery.likesCount = { $gte: minLikes };
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

router.delete('/instagram-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const postId = new ObjectId(req.params.id);
        const result = await db.collection('ig_posts').updateOne(
            { _id: postId },
            { $set: { used: true } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Post not found or already marked as used.' });
        }

        res.json({ success: true, message: 'Post marked as used.' });
    } catch (error) {
        console.error("Error marking post as used:", error);
        res.status(500).json({ error: 'Failed to mark the post as used.' });
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

// --- INSTAGRAM HASHTAGS API ENDPOINTS ---

// Get Instagram posts from database with pagination and filters
router.get('/instagram-posts', async (req, res) => {
    try {
        const db = getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const minViews = parseInt(req.query.minViews) || 0;
        const minLikes = parseInt(req.query.minLikes) || 0;
        const dateFilter = req.query.dateFilter || 'any';
        
        const skip = (page - 1) * limit;
        
        // Build filter query
        let filter = {
            likesCount: { $gte: minLikes }
        };
        
        if (minViews > 0) {
            filter.videoPlayCount = { $gte: minViews };
        }
        
        if (dateFilter !== 'any') {
            const now = new Date();
            let startDate;
            
            switch (dateFilter) {
                case '24h':
                    startDate = new Date(now - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    break;
            }
            
            if (startDate) {
                filter.timestamp = { $gte: startDate };
            }
        }
        
        const totalPosts = await db.collection('Instagram_Posts').countDocuments(filter);
        const posts = await db.collection('Instagram_Posts')
            .find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        
        const totalPages = Math.ceil(totalPosts / limit);
        
        res.json({
            posts,
            currentPage: page,
            totalPages,
            totalPosts
        });
    } catch (error) {
        console.error('Error fetching Instagram posts:', error);
        res.status(500).json({ error: 'Failed to fetch Instagram posts.' });
    }
});

// Get default Instagram hashtags
router.get('/default-ig-hashtags', async (req, res) => {
    try {
        const db = getDB();
        const doc = await db.collection('Instagram_Hashtags').findOne({ name: 'default' });
        const hashtags = doc ? doc.hashtags : [
            'marketingtips',
            'psychologyfacts', 
            'businesstips',
            'branding101',
            'digitalmarketing',
            'business',
            'sales',
            'entrepreneurship',
            'consumerbehavior',
            'marketingdigital'
        ];
        res.json({ hashtags });
    } catch (error) {
        console.error('Error fetching default hashtags:', error);
        res.status(500).json({ error: 'Failed to fetch default hashtags.' });
    }
});

// Run hashtag scrape job using Apify
router.post('/run-hashtag-scrape-job', async (req, res) => {
    const { hashtags, resultsLimit } = req.body;
    
    if (!hashtags || !Array.isArray(hashtags)) {
        return res.status(400).json({ error: 'Hashtags array is required.' });
    }
    
    try {
        const input = {
            hashtags: hashtags,
            resultsLimit: resultsLimit || 25,
            resultsType: "stories"
        };
        
        // Run the Actor and wait for it to finish
        const run = await client.actor("reGe1ST3OBgYZSsZJ").call(input);
        
        // Fetch and process Actor results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        if (items.length > 0) {
            const db = getDB();
            
            // Check for existing posts
            const existingUrls = await db.collection('Instagram_Posts')
                .find({ url: { $in: items.map(item => item.url) } })
                .project({ url: 1 })
                .toArray();
            
            const existingUrlSet = new Set(existingUrls.map(doc => doc.url));
            const newPosts = items.filter(item => !existingUrlSet.has(item.url));
            
            if (newPosts.length > 0) {
                // Add timestamp and process hashtags
                const processedPosts = newPosts.map(post => ({
                    ...post,
                    scrapedAt: new Date(),
                    hashtags: Array.isArray(post.hashtags) ? post.hashtags : []
                }));
                
                await db.collection('Instagram_Posts').insertMany(processedPosts);
            }
            
            res.json({ 
                message: `Successfully scraped ${items.length} posts, added ${newPosts.length} new posts to database.`,
                totalScraped: items.length,
                newPosts: newPosts.length
            });
        } else {
            res.json({ message: 'No posts found for the given hashtags.' });
        }
    } catch (error) {
        console.error('Error running hashtag scrape job:', error);
        res.status(500).json({ error: 'Failed to run scrape job.' });
    }
});

// Delete Instagram post
router.delete('/instagram-posts/:id', async (req, res) => {
    try {
        const db = getDB();
        const postId = new ObjectId(req.params.id);
        
        const result = await db.collection('Instagram_Posts').deleteOne({ _id: postId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Post not found.' });
        }
        
        res.json({ success: true, message: 'Post deleted successfully.' });
    } catch (error) {
        console.error('Error deleting Instagram post:', error);
        res.status(500).json({ error: 'Failed to delete post.' });
    }
});

// Create story from Instagram post
router.post('/create-story-from-instagram', async (req, res) => {
    const { post, transcript, frameworkId } = req.body;
    
    if (!post || !transcript) {
        return res.status(400).json({ error: 'Post and transcript are required.' });
    }
    
    try {
        // Create a business case from the Instagram post
        const businessCase = {
            company: post.ownerUsername,
            industry: "Social Media",
            psychology: "Viral Content Strategy",
            problem: "Creating engaging social media content",
            solution: post.caption || "Viral social media post strategy",
            realStudy: "Instagram engagement analysis",
            findings: `Post received ${post.likesCount} likes and ${post.commentsCount} comments`,
            verified: false,
            sources: [post.url],
            source_url: post.url,
            hashtags: post.hashtags || [],
            transcript: transcript
        };
        
        res.json(businessCase);
    } catch (error) {
        console.error('Error creating story from Instagram post:', error);
        res.status(500).json({ error: 'Failed to create story from Instagram post.' });
    }
});

module.exports = router;
