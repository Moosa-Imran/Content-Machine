// routes/main.js
// Handles all application routing and orchestrates calls to services and utilities.

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const session = require('express-session');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { generateMoreOptions } = require('../utils/scriptGenerator');
const { callGeminiAPI, generateAudio } = require('../services/aiService');

// --- HELPER FUNCTIONS ---
const getBusinessCases = async (limit = 1) => {
    const db = getDB();
    const pipeline = [
        { $match: { used: { $ne: true } } },
        { $sample: { size: limit } }
    ];
    const cases = await db.collection('Business_Cases').aggregate(pipeline).toArray();
    if (cases.length === 0) {
        console.warn("No unused business cases found. Fetching from all cases as a fallback.");
        const fallbackPipeline = [{ $sample: { size: limit } }];
        return await db.collection('Business_Cases').aggregate(fallbackPipeline).toArray();
    }
    return cases;
};

const getFrameworkById = async (id) => {
    const db = getDB();
    let framework;
    if (id) {
        try {
            framework = await db.collection('Frameworks').findOne({ _id: new ObjectId(id) });
        } catch (error) {
            console.warn(`Invalid Framework ID: ${id}. Falling back to default.`);
        }
    }
    if (!framework) {
        framework = await db.collection('Frameworks').findOne({ isDefault: true });
    }
    if (!framework) {
        throw new Error("No default framework found in the database. Please seed the default framework.");
    }
    return framework;
};


const getValidationPrompt = async () => {
    try {
        const db = getDB();
        let doc = await db.collection('Validate_News').findOne({ name: 'active' });
        if (!doc) {
            doc = await db.collection('Validate_News').findOne({ name: 'default' });
        }
        if (!doc) {
            throw new Error("No validation prompt found in the database.");
        }
        return doc.prompt;
    } catch (error) {
        console.error("Error fetching validation prompt from DB:", error);
        throw error;
    }
};


// --- PAGE RENDERING ROUTES ---
router.get('/', (req, res) => res.render('index', { title: 'Dashboard' }));
router.get('/breakdown', (req, res) => res.render('breakdown', { title: 'Tactic Breakdowns' }));
router.get('/sheet', (req, res) => res.render('sheet', { title: 'Analyze Sheet' }));
router.get('/news', (req, res) => res.render('news', { title: 'Industry News' }));
router.get('/validate', (req, res) => res.render('validate', { title: 'Edit Validation Prompt' }));

router.get('/reels', (req, res) => {
    res.render('reels', { 
        title: 'Viral Scripts',
        contentFeed: [],
    });
});

router.get('/framework', (req, res) => {
    res.render('framework', { 
        title: 'Script Framework Editor',
    });
});

// --- AUTHENTICATION ---
const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) return next();
    res.redirect('/login');
};
router.get('/login', (req, res) => {
    if (req.session.isAuthenticated) return res.redirect('/stories');
    res.render('login', { title: 'Login', error: null });
});
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const db = getDB();
        const user = await db.collection('Users').findOne({ username: username });
        if (user && user.password === password) {
            req.session.isAuthenticated = true;
            req.session.save(() => res.redirect('/stories'));
        } else {
            res.render('login', { title: 'Login', error: 'Invalid username or password.' });
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.render('login', { title: 'Login', error: 'An error occurred during login.' });
    }
});
router.get('/stories', isAuthenticated, async (req, res) => {
    try {
        const db = getDB();
        const stories = await db.collection('Stories').find({}).sort({ createdAt: -1 }).toArray();
        res.render('stories', { title: 'Saved Stories', stories });
    } catch (error) {
        console.error("Error fetching stories:", error);
        res.status(500).send("Error fetching stories from the database.");
    }
});
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error("Session destruction error:", err);
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});


// --- API ROUTES ---

// Central script generation logic
const generateScriptContent = async (businessCase, framework) => {
    const ctaPromise = framework.useFixedCta 
        ? Promise.resolve([framework.fixedCtaText || 'Follow for more!'])
        : generateMoreOptions(businessCase, 'ctas', framework);

    let scriptPromises;
    if (framework.type === 'news_commentary') {
        scriptPromises = [
            generateMoreOptions(businessCase, 'hooks', framework),
            generateMoreOptions(businessCase, 'contexts', framework),
            generateMoreOptions(businessCase, 'evidences', framework),
            generateMoreOptions(businessCase, 'patterns', framework),
            ctaPromise
        ];
    } else { // Default to 'viral_framework'
        scriptPromises = [
            generateMoreOptions(businessCase, 'hooks', framework),
            generateMoreOptions(businessCase, 'buildUps', framework),
            generateMoreOptions(businessCase, 'stories', framework),
            generateMoreOptions(businessCase, 'psychologies', framework),
            ctaPromise
        ];
    }

    const results = await Promise.all(scriptPromises);
    
    const newScript = {
        ...businessCase,
        id: `db-${businessCase._id.toString()}`,
        type: framework.type || 'viral_framework',
        hooks: results[0],
        ctas: results[results.length - 1]
    };

    if (framework.type === 'news_commentary') {
        newScript.contexts = results[1];
        newScript.evidences = results[2];
        newScript.patterns = results[3];
    } else {
        newScript.buildUps = results[1];
        newScript.stories = results[2];
        newScript.psychologies = results[3];
    }
    
    return newScript;
};

router.get('/api/business-cases/count', async (req, res) => {
    try {
        const db = getDB();
        const count = await db.collection('Business_Cases').countDocuments({ used: { $ne: true } });
        res.json({ total: count });
    } catch (error) {
        console.error("Error fetching business case count:", error);
        res.status(500).json({ error: 'Failed to get total business cases.' });
    }
});

router.post('/api/new-script', async (req, res) => {
    const { frameworkId } = req.body;
    try {
        const [businessCases, framework] = await Promise.all([
            getBusinessCases(1),
            getFrameworkById(frameworkId)
        ]);

        if (businessCases.length === 0) {
            return res.status(404).json({ error: 'No business cases found.' });
        }
        const businessCase = businessCases[0];
        const newScript = await generateScriptContent(businessCase, framework);
        res.json(newScript);
    } catch (error) {
        console.error("Error in /api/new-script:", error);
        res.status(500).json({ error: 'Failed to generate new script' });
    }
});

// **NEW**: Regenerates a script for an existing business case with a new framework
router.post('/api/regenerate-script-from-case', async (req, res) => {
    const { businessCase, frameworkId } = req.body;
    if (!businessCase || !frameworkId) {
        return res.status(400).json({ error: 'Business case and framework ID are required.' });
    }
    try {
        const framework = await getFrameworkById(frameworkId);
        const newScript = await generateScriptContent(businessCase, framework);
        res.json(newScript);
    } catch (error) {
        console.error("Error in /api/regenerate-script-from-case:", error);
        res.status(500).json({ error: 'Failed to regenerate script' });
    }
});


router.get('/api/frameworks', async (req, res) => {
    try {
        const db = getDB();
        const frameworks = await db.collection('Frameworks').find({}, {
            projection: { name: 1, isDefault: 1, type: 1 }
        }).toArray();
        res.json(frameworks);
    } catch (error) {
        res.status(500).json({ error: 'Could not load frameworks.' });
    }
});

router.get('/api/framework/:id', async (req, res) => {
    try {
        const framework = await getFrameworkById(req.params.id);
        res.json(framework);
    } catch (error) {
        res.status(500).json({ error: 'Could not load the script framework.' });
    }
});

router.post('/api/frameworks', async (req, res) => {
    try {
        const db = getDB();
        const { framework } = req.body;
        
        if (framework._id) {
            const frameworkId = new ObjectId(framework._id);
            delete framework._id;
            await db.collection('Frameworks').updateOne({ _id: frameworkId }, { $set: framework });
            res.json({ success: true, message: 'Framework updated successfully.', frameworkId });
        } else {
            framework.isDefault = false;
            const result = await db.collection('Frameworks').insertOne(framework);
            res.status(201).json({ success: true, message: 'Framework created successfully.', frameworkId: result.insertedId });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to save the framework.' });
    }
});

router.delete('/api/framework/:id', async (req, res) => {
    try {
        const db = getDB();
        const frameworkId = new ObjectId(req.params.id);
        const frameworkToDelete = await db.collection('Frameworks').findOne({ _id: frameworkId });
        if (frameworkToDelete && frameworkToDelete.isDefault) {
            return res.status(400).json({ error: 'Cannot delete the default framework.' });
        }
        await db.collection('Frameworks').deleteOne({ _id: frameworkId });
        res.json({ success: true, message: 'Framework has been deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete the framework.' });
    }
});

router.post('/api/create-story-from-news', async (req, res) => {
    const { article, frameworkId } = req.body;
    if (!article) return res.status(400).json({ error: 'No article provided.' });

    try {
        const prompt = `
        As an expert marketing analyst, transform the following news article into a concise, insightful business case study, structured as a clean JSON object.
        **Article Details:**
        - Title: ${article.title}
        - URL: ${article.url}
        - Full Content: ${article.summary}
        **Instructions:**
        Generate a single, valid JSON object with the following keys, ensuring every field is fully populated:
        {
            "company": "Primary company involved.",
            "industry": "Industry of the company.",
            "psychology": "Core psychological principle or marketing tactic.",
            "problem": "The business problem or challenge.",
            "solution": "The specific solution or strategy implemented.",
            "realStudy": "If a study is mentioned, summarize it. Otherwise, state 'No specific study mentioned'.",
            "findings": "Key outcomes, results, or findings.",
            "verified": false,
            "sources": ["${article.url}"],
            "source_url": "${article.url}",
            "hashtags": ["array of 3-5 relevant hashtags"]
        }`;

        let result = await callGeminiAPI(prompt, true);
        if (Array.isArray(result)) result = result[0];

        if (result && typeof result === 'object' && !Array.isArray(result)) {
            const db = getDB();
            await db.collection('Business_Cases').insertOne(result);
            const framework = await getFrameworkById(frameworkId);
            const newStory = await generateScriptContent(result, framework);
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
    const { businessCase, sectionType, frameworkId } = req.body;

    if (!businessCase || !sectionType) {
        return res.status(400).json({ error: 'Missing business case or section type.' });
    }

    try {
        const framework = await getFrameworkById(frameworkId);
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

router.post('/api/generate-audio', async (req, res) => {
    const { scriptText } = req.body;
    if (!scriptText) {
        return res.status(400).json({ error: 'No script text provided.' });
    }

    try {
        const audioStream = await generateAudio(scriptText);
        const audioDir = path.join(__dirname, '..', 'public', 'audio');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }
        const filename = `${Date.now()}.mp3`;
        const filePath = path.join(audioDir, filename);
        const writableStream = fs.createWriteStream(filePath);
        audioStream.pipe(writableStream);

        writableStream.on('finish', () => {
            res.json({ success: true, audioUrl: `/audio/${filename}` });
        });

        writableStream.on('error', (err) => {
            console.error('Error writing audio file:', err);
            res.status(500).json({ error: 'Failed to save audio file.' });
        });

    } catch (error) {
        res.status(500).json({ error: `Failed to generate audio. Server error: ${error.message}` });
    }
});

router.post('/api/save-story', async (req, res) => {
    const { title, transcript, audioUrl, hashtags, businessCaseId } = req.body;

    if (!title || !transcript || !audioUrl) {
        return res.status(400).json({ error: 'Missing required story data.' });
    }

    try {
        const db = getDB();
        
        const igPrompt = `You are a social media copywriter. Write a short, engaging Instagram description for the following story in a friendly, conversational, and story-driven style. Make it highly readable and SEO-friendly. Use relevant emojis and include exactly 3 trending hashtags that match the story.

        Story Transcript:
        ${transcript}

        Return only the description text.`;
        
        const igDescription = await callGeminiAPI(igPrompt, false);

        const newStory = {
            title,
            transcript,
            audioUrl,
            igDescription,
            hashtags: hashtags || [],
            createdAt: new Date(),
            sourceBusinessCase: businessCaseId ? new ObjectId(businessCaseId) : null
        };

        await db.collection('Stories').insertOne(newStory);

        if (businessCaseId) {
            await db.collection('Business_Cases').updateOne(
                { _id: new ObjectId(businessCaseId) },
                { $set: { used: true } }
            );
        }

        res.status(201).json({ success: true, message: 'Story saved successfully.' });
    } catch (error) {
        console.error('Error saving story:', error);
        res.status(500).json({ error: 'Failed to save the story.' });
    }
});

router.get('/api/scan-news', async (req, res) => {
    const { keyword, category, page = 1, sortBy = 'rel', dateWindow = '31', validate = 'false' } = req.query;

    const keywords = (keyword || "marketing psychology,behavioral economics,neuromarketing,cognitive bias,pricing psychology").split(',');
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
    
    if (dateWindow && dateWindow !== '31') {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - parseInt(dateWindow));
        const dateStartString = startDate.toISOString().split('T')[0];
        queryConditions.push({ "dateStart": dateStartString });
    }

    const query = {
        "$query": { "$and": queryConditions },
        "$filter": { "lang": "eng" }
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
        
        const fetchedUrls = articles.map(article => article.url);
        let uniqueArticles = [];

        if (fetchedUrls.length > 0) {
            const db = getDB();
            const existingCases = await db.collection('Business_Cases').find({
                source_url: { $in: fetchedUrls }
            }).project({ source_url: 1 }).toArray();
            
            const existingUrls = new Set(existingCases.map(caseDoc => caseDoc.source_url));
            uniqueArticles = articles.filter(article => !existingUrls.has(article.url));
        }
        
        let articlesToEnrich = uniqueArticles;

        if (validate === 'true') {
            const validationPrompt = await getValidationPrompt();
            if (validationPrompt) {
                const validationPromises = uniqueArticles.map(async (article) => {
                    const fullValidationPrompt = `${validationPrompt}\n\n---\n\n**ARTICLE TO EVALUATE:**\nTitle: ${article.title}\nBody: ${article.body}`;
                    try {
                        const verdict = await callGeminiAPI(fullValidationPrompt, false);
                        return { article, verdict };
                    } catch (err) {
                        console.warn(`Validation failed for article: ${article.title}`);
                        return { article, verdict: 'REJECT' };
                    }
                });
                const validationResults = await Promise.all(validationPromises);
                articlesToEnrich = validationResults
                    .filter(res => res.verdict.startsWith('ACCEPT'))
                    .map(res => res.article);
            }
        }


        const enrichedArticlesPromises = articlesToEnrich.map(article => (async () => {
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
                    dateTimePub: article.dateTimePub,
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
                    dateTimePub: article.dateTimePub,
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

router.post('/api/analyze-sheet', async (req, res) => {
    const { pastedData, sheetUrl, frameworkId } = req.body;
    const hasPastedData = pastedData && pastedData.trim().length > 0;
    const hasUrl = sheetUrl && sheetUrl.trim().length > 0;

    if (!hasPastedData && !hasUrl) {
        return res.status(400).json({ error: 'No data or URL provided.' });
    }

    const analysisSource = hasPastedData 
        ? `the following pasted data:\n\n${pastedData}`
        : `the data from this Google Sheet: ${sheetUrl}`;

    const prompt = `Analyze ${analysisSource}. Assume the data is structured with columns like 'Company', 'Industry', 'Problem', 'Solution'. 
    For each row/entry, create a business case study object.
    Return a JSON array of these business case objects.`;

    try {
        const results = await callGeminiAPI(prompt, true);
        const framework = await getFrameworkById(frameworkId);
        
        const formattedResultsPromises = results.map(async (r) => {
            const scriptContent = await generateScriptContent(r, framework);
            return {
                ...scriptContent,
                sources: [hasPastedData ? 'Pasted Data' : sheetUrl],
            };
        });
        
        const formattedResults = await Promise.all(formattedResultsPromises);
        res.json(formattedResults);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: `Failed to analyze the provided data. Server error: ${err.message}` });
    }
});

module.exports = router;
