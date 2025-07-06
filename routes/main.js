// routes/main.js
// Handles all application routing and orchestrates calls to services and utilities.

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { ObjectId } = require('mongodb');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { generateMoreOptions } = require('../utils/scriptGenerator');
const { callGeminiAPI } = require('../services/aiService');

// --- HELPER FUNCTIONS ---
const getBusinessCases = async (limit = 10) => {
    const db = getDB();
    const pipeline = [{ $sample: { size: limit } }];
    return await db.collection('Business_Cases').aggregate(pipeline).toArray();
};

const getExtraHooks = async () => {
    const db = getDB();
    const generalData = await db.collection('General').findOne({});
    return generalData ? generalData.hooks : [];
};

const getFramework = async () => {
    try {
        const db = getDB();
        let framework = await db.collection('Frameworks').findOne({ name: 'active' });
        if (!framework) {
            framework = await db.collection('Frameworks').findOne({ name: 'default' });
        }
        if (!framework) {
            throw new Error("No framework found in the database. Please seed the default framework.");
        }
        // Also fetch extra hooks and attach them to the framework object
        framework.extraHooks = await getExtraHooks();
        return framework;
    } catch (error) {
        console.error("Error fetching framework from DB:", error);
        throw error;
    }
};

// --- PAGE RENDERING ROUTES ---
router.get('/', (req, res) => res.render('index', { title: 'Dashboard' }));
router.get('/breakdown', (req, res) => res.render('breakdown', { title: 'Tactic Breakdowns' }));
router.get('/sheet', (req, res) => res.render('sheet', { title: 'Analyze Sheet' }));
router.get('/news', (req, res) => res.render('news', { title: 'Industry News' }));

router.get('/reels', async (req, res) => {
    try {
        const [businessCases, framework] = await Promise.all([
            getBusinessCases(10),
            getFramework()
        ]);
        
        const initialFeed = businessCases.map((businessCase) => ({
            ...businessCase,
            id: `db-${businessCase._id.toString()}`,
            hooks: generateMoreOptions(businessCase, 'hooks', framework, framework.extraHooks),
            buildUps: generateMoreOptions(businessCase, 'buildUps', framework),
            stories: generateMoreOptions(businessCase, 'stories', framework),
            psychologies: generateMoreOptions(businessCase, 'psychologies', framework),
        }));
        
        res.render('reels', { 
            title: 'Viral Scripts',
            contentFeed: initialFeed,
        });
    } catch (error) {
        console.error("Error rendering reels page:", error);
        res.status(500).send("Error loading the Viral Scripts page.");
    }
});

router.get('/framework', (req, res) => {
    res.render('framework', { 
        title: 'Script Framework Editor',
    });
});

// --- API ROUTES ---
router.get('/api/new-scripts', async (req, res) => {
    try {
        const [businessCases, framework] = await Promise.all([
            getBusinessCases(10),
            getFramework()
        ]);

        const newBatch = businessCases.map((businessCase) => ({
            ...businessCase,
            id: `db-${businessCase._id.toString()}`,
            hooks: generateMoreOptions(businessCase, 'hooks', framework, framework.extraHooks),
            buildUps: generateMoreOptions(businessCase, 'buildUps', framework),
            stories: generateMoreOptions(businessCase, 'stories', framework),
            psychologies: generateMoreOptions(businessCase, 'psychologies', framework),
        }));
        res.json(newBatch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate new scripts' });
    }
});

router.get('/api/get-framework', async (req, res) => {
    try {
        const framework = await getFramework();
        res.json(framework);
    } catch (error) {
        res.status(500).json({ error: 'Could not load the script framework.' });
    }
});

router.post('/api/save-framework', async (req, res) => {
    try {
        const db = getDB();
        const { framework } = req.body;
        
        // Separate extraHooks from the main framework data
        const { extraHooks, ...mainFramework } = framework;

        // Save the main framework templates
        await db.collection('Frameworks').updateOne(
            { name: 'active' }, 
            { $set: { ...mainFramework, name: 'active' } },
            { upsert: true }
        );

        // Save the extra hooks to the General collection
        await db.collection('General').updateOne(
            {}, // Assuming there's only one document in this collection
            { $set: { hooks: extraHooks } },
            { upsert: true }
        );

        res.json({ success: true, message: 'Framework and hooks saved successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save the framework.' });
    }
});

router.post('/api/reset-framework', async (req, res) => {
    try {
        const db = getDB();
        await db.collection('Frameworks').deleteOne({ name: 'active' });
        // You might also want to reset the General hooks collection to its default state
        // For now, we'll just reset the main framework.
        res.json({ success: true, message: 'Framework has been reset to default.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset the framework.' });
    }
});


// ... (rest of the file remains the same)
router.get('/api/fetch-news-for-story-creation', async (req, res) => {
    try {
        let newsServerUrl = 'https://news-server-opal.vercel.app/';
        const { keyword, category } = req.query;

        if (keyword || category) {
            const params = new URLSearchParams();
            if (keyword) params.append('keyword', keyword);
            if (category) params.append('category', category);
            newsServerUrl += `news?${params.toString()}`;
        }

        const response = await fetch(newsServerUrl);
        if (!response.ok) {
            throw new Error(`News server responded with status: ${response.status}`);
        }
        const articles = await response.json();
        
        const db = getDB();
        const existingCases = await db.collection('Business_Cases').find({}, { projection: { source_url: 1 } }).toArray();
        const existingSourceUrls = new Set(existingCases.map(doc => doc.source_url));

        const uniqueArticles = (articles.articles || articles).filter(article => !existingSourceUrls.has(article.url));

        const formattedArticles = uniqueArticles.map(article => ({
            title: article.title,
            url: article.url,
            summary: article.description,
            source: article.source
        }));

        res.json(formattedArticles);
    } catch (error) {
        console.error("Error fetching or filtering news:", error);
        res.status(500).json({ error: 'Failed to fetch news articles.' });
    }
});

router.post('/api/create-stories-from-news', async (req, res) => {
    const { articles } = req.body;
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
        return res.status(400).json({ error: 'No articles provided.' });
    }

    try {
        const db = getDB();
        const newBusinessCases = [];

        for (const article of articles) {
            const prompt = `Based on the following news article, create a business case study.
            Article Title: ${article.title}
            Article URL: ${article.url}
            Article Description: ${article.summary}

            Generate a JSON object with the following structure:
            {
                "company": "A relevant company or 'A Company'",
                "industry": "A relevant industry",
                "psychology": "The core psychological principle discussed",
                "problem": "The problem the company was trying to solve",
                "solution": "The solution or tactic used",
                "realStudy": "A brief mention of the study or research",
                "findings": "The key findings or results",
                "verified": false,
                "sources": ["${article.url}"],
                "source_url": "${article.url}",
                "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
            }`;

            const result = await callGeminiAPI(prompt, true);
            
            const caseToAdd = Array.isArray(result) ? result[0] : result;
            if (caseToAdd && typeof caseToAdd === 'object' && !Array.isArray(caseToAdd)) {
                newBusinessCases.push(caseToAdd);
            } else {
                console.warn(`Skipping invalid result from Gemini for article: ${article.title}`);
            }
        }

        if (newBusinessCases.length > 0) {
            const collection = db.collection('Business_Cases');
            const insertResult = await collection.insertMany(newBusinessCases);
            const newDocs = await collection.find({ _id: { $in: Object.values(insertResult.insertedIds) } }).toArray();
            
            const [extraHooks, framework] = await Promise.all([getExtraHooks(), getFramework()]);
            const formattedStories = newDocs.map((story) => ({
                ...story,
                id: `db-${story._id.toString()}`,
                hooks: generateMoreOptions(story, 'hooks', framework, extraHooks),
                buildUps: generateMoreOptions(story, 'buildUps', framework),
                stories: generateMoreOptions(story, 'stories', framework),
                psychologies: generateMoreOptions(story, 'psychologies', framework),
            }));
            
            res.status(201).json(formattedStories);
        } else {
            res.status(200).json([]);
        }

    } catch (error) {
        console.error('Error creating stories from news:', error);
        res.status(500).json({ error: 'Failed to create stories from news.' });
    }
});

router.get('/api/get-extra-hooks', async (req, res) => {
    try {
        const extraHooks = await getExtraHooks();
        res.json(extraHooks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get extra hooks.' });
    }
});

router.post('/api/verify-story', async (req, res) => {
    const { company, solution, psychology, findings, sources } = req.body;
    const prompt = `Please verify the following business story. Check for the accuracy of the company's action, the stated psychological principle, and the claimed outcome. Provide a step-by-step verification process and a final conclusion.
    Story to Verify:
    - Company: ${company}
    - Tactic: ${solution}
    - Stated Psychology: ${psychology}
    - Claimed Finding: ${findings}
    - Source: ${sources ? sources[0] : 'N/A'}
    Return your verification as a JSON object with the structure: {"checks": [{"check": "string", "is_correct": boolean, "comment": "string"}], "conclusion": "string", "confidence_score": number_between_0_and_100}`;
    
    try {
        const result = await callGeminiAPI(prompt, true);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: `Verification process failed. Server error: ${error.message}` });
    }
});

router.post('/api/rewrite-script', async (req, res) => {
    const { finalScript, aiPrompt } = req.body;
    const fullPrompt = `Here is a script:\n\n${finalScript}\n\nPlease rewrite it based on this instruction: "${aiPrompt}". Keep the core facts but improve the style, tone, or structure as requested. Return only the rewritten script.`;
    
    try {
        const newScript = await callGeminiAPI(prompt, false);
        res.json({ newScript });
    } catch (error) {
        res.status(500).json({ error: `Failed to rewrite script. Server error: ${error.message}` });
    }
});

router.post('/api/tactic-breakdown', async (req, res) => {
    const { companyName } = req.body;
    const prompt = `For the company '${companyName}', create a viral script that breaks down 3 of their most quirky, shocking, or unknown marketing tactics. For each tactic, identify which pillar it belongs to (Psychological triggers, Biases, Behavioural economics, or Neuromarketing). Structure the entire output as a single JSON object for a script with the following keys: 'company', 'hook', 'buildUp', 'storyBreakdown', 'concludingPsychology'.

    - 'company': The name of the company.
    - 'hook': A compelling opening line for a short video about these tactics.
    - 'buildUp': A sentence to create anticipation.
    - 'storyBreakdown': An array of 3 objects, where each object has the keys: 'tacticName', 'pillar', and 'explanation'. The explanation should detail the quirky tactic.
    - 'concludingPsychology': A concluding sentence that summarizes the overall psychological genius.`;

    try {
        const result = await callGeminiAPI(prompt, true);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: `Failed to generate script for ${companyName}. Server error: ${error.message}` });
    }
});

router.get('/api/find-companies', async (req, res) => {
    const prompt = `Generate a diverse list of 5 companies known for using interesting or quirky psychological marketing tactics. Include well-known brands and some lesser-known or foreign examples. Return as a JSON array of strings. e.g., ["Apple", "Shein", "Patagonia", "Liquid Death", "KupiVip"]`;
    try {
        const result = await callGeminiAPI(prompt, true);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: `Could not fetch company list. Server error: ${error.message}` });
    }
});

router.post('/api/analyze-sheet', async (req, res) => {
    const { pastedData, sheetUrl } = req.body;
    const hasPastedData = pastedData && pastedData.trim().length > 0;
    const hasUrl = sheetUrl && sheetUrl.trim().length > 0;

    if (!hasPastedData && !hasUrl) {
        return res.status(400).json({ error: 'No data or URL provided.' });
    }

    const analysisSource = hasPastedData 
        ? `the following pasted data:\n\n${pastedData}`
        : `the data from this Google Sheet: ${sheetUrl}`;

    const prompt = `Analyze ${analysisSource}. Assume the data is structured with columns like 'Company', 'Industry', 'Problem', 'Solution'. 
    For each row/entry, create a business case study object. Then, for each case, generate a hook, a build-up, a story, and a psychology explanation.
    Return a JSON array of these objects, where each object has this structure:
    {"company": "string", "industry": "string", "problem": "string", "solution": "string", "findings": "string", "psychology": "string", "hashtags": ["string"], "hooks": ["string"], "buildUps": ["string"], "stories": ["string"], "psychologies": ["string"]}`;

    try {
        const results = await callGeminiAPI(prompt, true);
        const formattedResults = results.map((r, i) => ({
            ...r,
            id: `sheet-${Date.now()}-${i}`,
            sources: [hasPastedData ? 'Pasted Data' : sheetUrl],
        }));
        res.json(formattedResults);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: `Failed to analyze the provided data. Server error: ${err.message}` });
    }
});

router.get('/api/scan-news', async (req, res) => {
    const prompt = `Find 3 recent news articles or case studies about companies using psychological triggers, cognitive biases, behavioural economics, or neuromarketing. For each, provide the title, summary, URL, the primary psychological tactic used, a brief explanation of that tactic, and a 'hot_score' (1-100) based on how quirky, controversial, or intriguing the story is. Return this as a JSON array with this structure: [{"title": "string", "summary": "string", "url": "string", "tactic": "string", "tactic_explanation": "string", "hot_score": "number"}]`;
    try {
        const results = await callGeminiAPI(prompt, true);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: `Could not fetch news articles. Server error: ${err.message}` });
    }
});

router.post('/api/create-story-from-news', async (req, res) => {
    const { article } = req.body;
    const prompt = `Based on this news article titled "${article.title}" which is about using the '${article.tactic}' tactic, create a viral story script.
    Identify a company, a core problem, a clever solution, the underlying psychological tactic, and the potential findings.
    Then generate a hook, build-up, story, and psychology explanation.
    Return a single JSON object with this structure:
    {"company": "string", "industry": "string", "problem": "string", "solution": "string", "findings": "string", "psychology": "string", "hashtags": ["string"], "hooks": ["string"], "buildUps": ["string"], "stories": ["string"], "psychologies": ["string"]}`;
    try {
        const result = await callGeminiAPI(prompt, true);
        const newStory = {
            ...result,
            id: `news-${Date.now()}`,
            sources: [article.url],
            company: result.company || 'A Company',
        };
        res.json(newStory);
    } catch (err) {
        res.status(500).json({ error: `Failed to generate a story from this article. Server error: ${err.message}` });
    }
});


module.exports = router;
