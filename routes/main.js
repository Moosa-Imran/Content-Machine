// routes/main.js
// Handles all application routing and orchestrates calls to services and utilities.

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { ObjectId } = require('mongodb');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { generateMoreOptions } = require('../utils/scriptGenerator');
const { callGeminiAPI, generateAudio } = require('../services/aiService');

// --- HELPER FUNCTIONS ---
const getBusinessCases = async (limit = 3) => {
    const db = getDB();
    const pipeline = [{ $sample: { size: limit } }];
    return await db.collection('Business_Cases').aggregate(pipeline).toArray();
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

router.get('/reels', (req, res) => {
    res.render('reels', { 
        title: 'Viral Scripts',
        contentFeed: [], // Pass an empty array to prevent server-side blocking
    });
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
            getBusinessCases(3),
            getFramework()
        ]);

        const newBatch = [];
        for (const businessCase of businessCases) {
            const hooks = await generateMoreOptions(businessCase, 'hooks', framework);
            const buildUps = await generateMoreOptions(businessCase, 'buildUps', framework);
            const stories = await generateMoreOptions(businessCase, 'stories', framework);
            const psychologies = await generateMoreOptions(businessCase, 'psychologies', framework);

            newBatch.push({
                ...businessCase,
                id: `db-${businessCase._id.toString()}`,
                hooks,
                buildUps,
                stories,
                psychologies,
            });
        }
        res.json(newBatch);
    } catch (error) {
        console.error("Error in /api/new-scripts:", error);
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
        
        await db.collection('Frameworks').updateOne(
            { name: 'active' }, 
            { $set: { ...framework, name: 'active' } },
            { upsert: true }
        );

        res.json({ success: true, message: 'Framework saved successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save the framework.' });
    }
});

router.post('/api/reset-framework', async (req, res) => {
    try {
        const db = getDB();
        await db.collection('Frameworks').deleteOne({ name: 'active' });
        res.json({ success: true, message: 'Framework has been reset to default.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset the framework.' });
    }
});

router.post('/api/create-story-from-news', async (req, res) => {
    const { article } = req.body;
    if (!article) {
        return res.status(400).json({ error: 'No article provided.' });
    }

    try {
        const articleContent = article.summary;

        const prompt = `
        As an expert marketing analyst, your task is to dissect the following news article and transform it into a concise, insightful business case study. Your analysis should be structured as a clean JSON object.

        **Article Details:**
        - **Title:** ${article.title}
        - **URL:** ${article.url}
        - **Full Content:** ${articleContent}

        **Instructions:**
        Read the article content thoroughly. Identify the core marketing or business strategy discussed. Then, generate a single, valid JSON object with the following keys. Ensure every field is fully populated with complete sentences and detailed information summarized from the article. Do not use placeholders, abbreviations, or truncated text like "...".

        **JSON Structure and Field Descriptions:**
        {
            "company": "Identify the primary company involved. If not explicitly mentioned, infer a relevant company or use a descriptive placeholder like 'A leading e-commerce firm'.",
            "industry": "Specify the industry of the company (e.g., 'Fashion Retail', 'Consumer Electronics', 'SaaS').",
            "psychology": "Name the core psychological principle or marketing tactic being used (e.g., 'Scarcity Principle', 'Social Proof', 'Gamification').",
            "problem": "Describe the specific business problem or challenge the company was facing. This should be a full, descriptive sentence.",
            "solution": "Detail the specific solution or strategy the company implemented. Explain the tactic clearly and completely.",
            "realStudy": "If the article mentions a specific study, research paper, or data source, summarize it here. If not, state 'No specific study mentioned'.",
            "findings": "Summarize the key outcomes, results, or findings of the company's strategy. Use complete sentences and provide concrete details if available in the article.",
            "verified": false,
            "sources": ["${article.url}"],
            "source_url": "${article.url}",
            "hashtags": ["Generate an array of 3-5 relevant, specific hashtags in lowercase (e.g., '#customerloyalty', '#pricingstrategy')."]
        }
        `;

        const result = await callGeminiAPI(prompt, true);
        
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            const framework = await getFramework();
            const [hooks, buildUps, stories, psychologies] = await Promise.all([
                generateMoreOptions(result, 'hooks', framework),
                generateMoreOptions(result, 'buildUps', framework),
                generateMoreOptions(result, 'stories', framework),
                generateMoreOptions(result, 'psychologies', framework)
            ]);
            const newStory = { ...result, id: `news-${Date.now()}`, hooks, buildUps, stories, psychologies };
            res.status(201).json(newStory);
        } else {
            throw new Error("AI failed to generate a valid story structure.");
        }

    } catch (error) {
        console.error('Error creating story from news:', error);
        res.status(500).json({ error: 'Failed to create story from news.' });
    }
});

router.post('/api/regenerate-section', async (req, res) => {
    const { businessCase, sectionType } = req.body;

    if (!businessCase || !sectionType) {
        return res.status(400).json({ error: 'Missing business case or section type.' });
    }

    try {
        const framework = await getFramework();
        const newOptions = await generateMoreOptions(businessCase, sectionType, framework);
        res.json({ newOptions });
    } catch (error) {
        console.error(`Error regenerating section ${sectionType}:`, error);
        res.status(500).json({ error: `Failed to regenerate ${sectionType}.` });
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
        const newScript = await callGeminiAPI(fullPrompt, false);
        res.json({ newScript });
    } catch (error) {
        res.status(500).json({ error: `Failed to rewrite script. Server error: ${error.message}` });
    }
});

router.post('/api/generate-filters-from-prompt', async (req, res) => {
    const { userPrompt } = req.body;
    if (!userPrompt) {
        return res.status(400).json({ error: 'A prompt is required.' });
    }

    const validCategories = ["business", "technology", "entertainment", "general", "health", "science", "sports"];
    
    const promptForAI = `
        From the user's request: "${userPrompt}", extract relevant search keywords and news categories.
        - The keywords should be a concise, comma-separated string of the most important terms.
        - The categories must be an array containing only strings from this allowed list: ${JSON.stringify(validCategories)}.
        
        Return ONLY a single, valid JSON object with this exact structure:
        {
          "keywords": "keyword1, keyword2",
          "categories": ["category1", "category2"]
        }
    `;

    try {
        const result = await callGeminiAPI(promptForAI, true);
        if (result && typeof result.keywords === 'string' && Array.isArray(result.categories)) {
            const validResultCategories = result.categories.filter(cat => validCategories.includes(cat));
            res.json({ keywords: result.keywords, categories: validResultCategories });
        } else {
            console.warn("AI returned an invalid data structure:", result);
            throw new Error("AI returned data in an unexpected format.");
        }
    } catch (error) {
        console.error('Error in /api/generate-filters-from-prompt:', error);
        res.status(500).json({ error: 'Failed to generate filters using the provided prompt.' });
    }
});

router.post('/api/generate-audio', async (req, res) => {
    const { scriptText } = req.body;
    if (!scriptText) {
        return res.status(400).json({ error: 'No script text provided.' });
    }

    try {
        const audioStream = await generateAudio(scriptText);
        res.setHeader('Content-Type', 'audio/mpeg');
        audioStream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: `Failed to generate audio. Server error: ${error.message}` });
    }
});

router.get('/api/scan-news', async (req, res) => {
    const { keyword, category, page = 1, sortBy = 'rel' } = req.query;

    const DEFAULT_KEYWORDS = "marketing psychology,behavioral economics,neuromarketing,cognitive bias,pricing psychology";
    const keywords = (keyword || DEFAULT_KEYWORDS).split(',');
    const categories = category ? category.split(',') : [];

    const categoryMap = {
        business: "dmoz/Business",
        technology: "dmoz/Technology",
        entertainment: "dmoz/Entertainment",
        general: "dmoz/Society",
        health: "dmoz/Health",
        science: "dmoz/Science",
        sports: "dmoz/Sports"
    };

    const queryConditions = [{
        "$or": keywords.map(kw => ({ "keyword": kw.trim(), "keywordLoc": "body" }))
    }];

    if (categories.length > 0) {
        queryConditions.push({
            "$or": categories.map(cat => ({ "categoryUri": categoryMap[cat.trim()] })).filter(c => c.categoryUri)
        });
    }

    const query = {
        "$query": { "$and": queryConditions },
        "$filter": { "forceMaxDataTimeWindow": "31", "lang": "eng" }
    };

    try {
        const newsApiResponse = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                resultType: "articles",
                articlesSortBy: sortBy,
                articlesPage: parseInt(page),
                articlesCount: 100,
                apiKey: process.env.NEWS_API_KEY
            })
        });

        if (!newsApiResponse.ok) {
            const errorBody = await newsApiResponse.text();
            console.error("News API Error:", errorBody);
            throw new Error(`News API failed with status: ${newsApiResponse.status}`);
        }

        const newsData = await newsApiResponse.json();
        const articles = newsData?.articles?.results || [];

        const enrichedArticlesPromises = articles.map(article => (async () => {
            const analysisPrompt = `
                Analyze the following article to identify a core psychological marketing tactic and its explanation. Also, provide a 'hot_score' from 1-100 based on how quirky, controversial, or intriguing the story is.

                **Article Title:** ${article.title}
                **Article Body:** ${article.body}

                Return ONLY a single, valid JSON object with this exact structure:
                {
                  "tactic": "The name of the primary psychological tactic.",
                  "tactic_explanation": "A brief, one-sentence explanation of the tactic.",
                  "hot_score": "A number between 1 and 100."
                }
            `;
            
            try {
                const analysisResult = await callGeminiAPI(analysisPrompt, true);
                return {
                    title: article.title,
                    summary: article.body,
                    url: article.url,
                    tactic: analysisResult.tactic || "N/A",
                    tactic_explanation: analysisResult.tactic_explanation || "No specific tactic identified.",
                    hot_score: analysisResult.hot_score || 50
                };
            } catch (geminiError) {
                console.warn(`Gemini analysis failed for article: ${article.title}. Skipping enrichment.`);
                return {
                    title: article.title,
                    summary: article.body,
                    url: article.url,
                    tactic: "N/A",
                    tactic_explanation: "Analysis not available.",
                    hot_score: 50
                };
            }
        })());
        
        const enrichedArticles = await Promise.all(enrichedArticlesPromises);
        
        res.json({
            articles: {
                results: enrichedArticles,
                page: newsData?.articles?.page,
                pages: newsData?.articles?.pages,
                totalResults: newsData?.articles?.totalResults
            }
        });

    } catch (err) {
        console.error("Error in /api/scan-news route:", err);
        res.status(500).json({ error: `Could not fetch news articles. Server error: ${err.message}` });
    }
});

module.exports = router;
