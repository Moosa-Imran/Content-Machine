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
const getBusinessCases = async (limit = 1) => { // Default limit is now 1
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
        contentFeed: [], // Pass an empty array to prevent server-side blocking
    });
});

router.get('/framework', (req, res) => {
    res.render('framework', { 
        title: 'Script Framework Editor',
    });
});

// --- API ROUTES ---
router.get('/api/get-validation-prompt', async (req, res) => {
    try {
        const prompt = await getValidationPrompt();
        res.json({ prompt });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load validation prompt.' });
    }
});

router.post('/api/save-validation-prompt', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt content is missing.' });
        }
        const db = getDB();
        await db.collection('Validate_News').updateOne(
            { name: 'active' },
            { $set: { name: 'active', prompt: prompt } },
            { upsert: true }
        );
        res.json({ success: true, message: 'Prompt saved successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save validation prompt.' });
    }
});

router.post('/api/reset-validation-prompt', async (req, res) => {
    try {
        const db = getDB();
        await db.collection('Validate_News').deleteOne({ name: 'active' });
        const defaultDoc = await db.collection('Validate_News').findOne({ name: 'default' });
        if (!defaultDoc) {
             return res.status(404).json({ error: 'Default validation prompt not found.' });
        }
        res.json({ success: true, prompt: defaultDoc.prompt });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset validation prompt.' });
    }
});


router.get('/api/business-cases/count', async (req, res) => {
    try {
        const db = getDB();
        const count = await db.collection('Business_Cases').countDocuments();
        res.json({ total: count });
    } catch (error) {
        console.error("Error fetching business case count:", error);
        res.status(500).json({ error: 'Failed to get total business cases.' });
    }
});

router.get('/api/new-script', async (req, res) => {
    try {
        const [businessCases, framework] = await Promise.all([
            getBusinessCases(1),
            getFramework()
        ]);

        if (businessCases.length === 0) {
            return res.status(404).json({ error: 'No business cases found.' });
        }

        const businessCase = businessCases[0];
        const [hooks, buildUps, stories, psychologies] = await Promise.all([
            generateMoreOptions(businessCase, 'hooks', framework),
            generateMoreOptions(businessCase, 'buildUps', framework),
            generateMoreOptions(businessCase, 'stories', framework),
            generateMoreOptions(businessCase, 'psychologies', framework)
        ]);

        const newScript = {
            ...businessCase,
            id: `db-${businessCase._id.toString()}`,
            hooks,
            buildUps,
            stories,
            psychologies,
        };
        
        res.json(newScript);
    } catch (error) {
        console.error("Error in /api/new-script:", error);
        res.status(500).json({ error: 'Failed to generate new script' });
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
        
        delete framework._id;

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

router.post('/api/update-framework-from-prompt', async (req, res) => {
    const { aiPrompt } = req.body;
    if (!aiPrompt) {
        return res.status(400).json({ error: 'Rewrite instruction is required.' });
    }

    try {
        const db = getDB();
        const currentFramework = await getFramework();
        
        // **FIX:** Create a copy of the framework to be sent to the AI, sampling examples if the list is too long.
        const frameworkForPrompt = JSON.parse(JSON.stringify(currentFramework));
        const MAX_EXAMPLES_IN_PROMPT = 7; // A reasonable number to keep the prompt size down

        ['hooks', 'buildUps', 'stories', 'psychologies'].forEach(key => {
            const examplesKey = `${key}Examples`;
            if (frameworkForPrompt[examplesKey] && frameworkForPrompt[examplesKey].length > MAX_EXAMPLES_IN_PROMPT) {
                const shuffled = frameworkForPrompt[examplesKey].sort(() => 0.5 - Math.random());
                frameworkForPrompt[examplesKey] = shuffled.slice(0, MAX_EXAMPLES_IN_PROMPT);
            }
        });

        const updatePrompt = `
You are an AI assistant that refines script generation frameworks. Below is an existing framework in JSON format and a user's instruction for a new style. Your task is to intelligently update the '...Prompt' and '...Examples' fields in the JSON to reflect the user's new style.

**User's Style Instruction:** "${aiPrompt}"

**Analysis of Instruction:**
- Tone: Is it funnier, more serious, more technical, simpler?
- Structure: Does it imply shorter hooks, longer stories, more questions?
- Content: Does it ask for a specific focus, like data, emotion, or controversy?

**Your Task:**
Based on your analysis, rewrite the '...Prompt' and '...Examples' values in the following JSON. 
- The new prompts should guide an AI to generate content in the user's desired style.
- The new examples should perfectly match the new style.
- Maintain the use of placeholders like {company}, {psychology}, {industry}, etc., where appropriate in the examples.
- Do NOT change the JSON structure or key names. Return only the updated, valid JSON object.

**Existing Framework:**
\`\`\`json
${JSON.stringify(frameworkForPrompt, null, 2)}
\`\`\`

Return ONLY the complete, updated, and valid JSON object.
`;

        const updatedSections = await callGeminiAPI(updatePrompt, true);

        if (!updatedSections || typeof updatedSections.overallPrompt !== 'string') {
            throw new Error('AI returned an invalid framework structure.');
        }
        
        // **FIX:** Merge the AI's updated prompts with the original full list of examples
        const finalFramework = { ...currentFramework };
        Object.keys(updatedSections).forEach(key => {
            if (key.endsWith('Prompt')) {
                finalFramework[key] = updatedSections[key];
            }
        });
        
        delete finalFramework._id;

        await db.collection('Frameworks').updateOne(
            { name: 'active' },
            { $set: { ...finalFramework, name: 'active' } },
            { upsert: true }
        );

        res.json({ success: true, message: 'Framework updated successfully.' });

    } catch (error) {
        console.error("Error updating framework from prompt:", error);
        res.status(500).json({ error: 'Failed to update framework.' });
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

        let result = await callGeminiAPI(prompt, true);
        
        if (Array.isArray(result) && result.length > 0) {
            result = result[0];
        }

        if (result && typeof result === 'object' && !Array.isArray(result)) {
            const db = getDB();
            await db.collection('Business_Cases').insertOne(result);
            console.log('Successfully saved new business case to the database.');

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
            console.error("AI service returned an invalid structure. Received:", JSON.stringify(result, null, 2));
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

module.exports = router;
