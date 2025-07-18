// routes/newsRoutes.js
// Handles all API routes for scanning news and managing validation prompts.

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { getValidationPrompt, getDefaultKeywordsAndCategories } = require('../utils/dbHelpers');
const { callGeminiAPI, ApiError } = require('../services/aiService');

// --- NEWS & VALIDATION API ROUTES ---

router.post('/update-validation-prompt', async (req, res) => {
    const { article, feedback } = req.body; // feedback is 'thumbs_up' or 'thumbs_down'
    if (!article || !feedback) {
        return res.status(400).json({ error: 'Article and feedback are required.' });
    }

    try {
        const db = getDB();

        // --- Fetch current prompts and keywords in parallel ---
        const currentPromptDocPromise = getValidationPrompt();
        const currentKeywordsDocPromise = getDefaultKeywordsAndCategories();

        const [currentPrompt, currentKeywordsDoc] = await Promise.all([currentPromptDocPromise, currentKeywordsDocPromise]);

        if (!currentPrompt) {
            return res.status(404).json({ error: 'Validation prompt not found.' });
        }

        // --- PROMPT FOR VALIDATION PROMPT UPDATE ---
        const validationInstruction = feedback === 'thumbs_up'
            ? `The user LIKED this article. Analyze its structure, keywords, and themes. Update the 'MUST-HAVE Elements', 'HIGH-VALUE Content Indicators', and 'PRIORITY KEYWORDS TO SCAN FOR' sections of the prompt to be MORE INCLUSIVE of similar articles. Do not add specific titles or URLs.`
            : `The user DISLIKED this article. Analyze its structure, keywords, and themes. Update the 'REJECT Articles That Are' and 'PRIORITY KEYWORDS TO SCAN FOR' sections of the prompt to be MORE EXCLUSIVE of similar articles. Do not add specific titles or URLs.`;

        const updateValidationPrompt = `
            You are an AI assistant that refines prompts for another AI. Your task is to update a content validation prompt based on user feedback.
            **Current Validation Prompt:**
            ---
            ${currentPrompt}
            ---
            **Article for Analysis:**
            ---
            Title: ${article.title}
            Summary: ${article.summary}
            ---
            **Instruction:** ${validationInstruction}
            **Output Format:** Return ONLY the complete, updated prompt text.
        `;
        
        // --- PROMPT FOR KEYWORDS/CATEGORIES UPDATE ---
        const keywordUpdatePrompt = `
You are an expert AI system responsible for curating a news feed by refining search parameters. A user has provided feedback on an article. Your task is to intelligently update the default search keywords and categories to better match the user's preferences. This is a destructive action, so be cautious and precise.

**Current Search Parameters:**
- Keywords: ${JSON.stringify(currentKeywordsDoc.keywords)}
- Categories: ${JSON.stringify(currentKeywordsDoc.categories)}

**Article The User Gave Feedback On:**
- Title: ${article.title}
- Summary: ${article.summary}

**User Feedback:** ${feedback === 'thumbs_up' ? 'LIKED (Thumbs Up)' : 'DISLIKED (Thumbs Down)'}

**Your Task & Instructions:**

1.  **Analyze the Article:** Deeply analyze the article's content, main topics, specific terminology, and overall theme.
2.  **Analyze the Feedback:**
    * If the feedback is **LIKED (Thumbs Up)**: Your goal is to find **more** articles like this one. Identify the core concepts that make this article interesting. Consider if adding a new, general keyword or category would help achieve this. **Do not add overly specific terms, company names, or product names.** For example, if the article is about "Coca-Cola's new red can design boosting sales", a good keyword to add might be "brand color psychology", not "Coca-Cola" or "red cans". Only add a term if you are highly confident it will broaden the search in a relevant way.
    * If the feedback is **DISLIKED (Thumbs Down)**: Your goal is to find **fewer** articles like this one. Identify why this article was likely irrelevant. Is there a keyword in the current list that is too broad and brought in this unwanted content? For example, if the user dislikes a generic business news article, and "business" is a keyword, you might consider if a more specific keyword is needed. **Be extremely careful about removing keywords.** Only remove a keyword if you are certain it is the primary cause of irrelevant results and its removal will not harm the search for desired content.
3.  **Formulate the New Parameters:** Based on your analysis, decide on the new list of keywords and categories. It is perfectly acceptable to make no changes if you are not confident that a change would be an improvement.
4.  **Final Curation:** After generating the new list of keywords, review it and curate it down to a maximum of the 7 most relevant and effective keywords. The final \`keywords\` array in your JSON output must not contain more than 7 items.
5.  **Output:** Return a single, valid JSON object containing the **complete** updated lists. Do not explain your reasoning. The JSON object must have this exact structure:
    {
      "keywords": ["full", "list", "of", "up to 7", "keywords"],
      "categories": ["full", "list", "of", "categories"]
    }
`;

        // --- EXECUTE AI CALLS CONCURRENTLY ---
        const [updatedPrompt, newKeywordsAndCategories] = await Promise.all([
            callGeminiAPI(updateValidationPrompt, false),
            callGeminiAPI(keywordUpdatePrompt, true)
        ]);

        // --- UPDATE DATABASES ---
        const dbOperations = [];
        
        // 1. Update Validation Prompt
        dbOperations.push(
            db.collection('Validate_News').updateOne(
                { name: 'active' },
                { $set: { prompt: updatedPrompt, name: 'active' } },
                { upsert: true }
            )
        );

        // 2. Update Keywords and Categories
        if (newKeywordsAndCategories && newKeywordsAndCategories.keywords && newKeywordsAndCategories.categories) {
            dbOperations.push(
                db.collection('Keywords').updateOne(
                    { name: 'default' },
                    { $set: { 
                        keywords: newKeywordsAndCategories.keywords,
                        categories: newKeywordsAndCategories.categories
                    }},
                    { upsert: true }
                )
            );
        } else {
            console.warn("AI did not return valid keywords/categories to update.");
        }

        await Promise.all(dbOperations);

        res.json({ success: true, message: 'Validation prompt and keywords updated successfully.' });

    } catch (error) {
        console.error("Error updating validation prompt:", error);
        if (error instanceof ApiError && error.status === 503) {
            return res.status(503).json({ error: 'The AI model is currently overloaded. Please try again.' });
        }
        res.status(500).json({ error: 'Failed to update validation prompt.' });
    }
});

router.get('/scan-news', async (req, res) => {
    const { keyword, category, page = 1, sortBy = 'rel', dateWindow = '31', validate = 'false' } = req.query;

    const defaults = await getDefaultKeywordsAndCategories();

    // Use query param if it exists, otherwise use the default from the DB/fallback.
    const keywords = keyword ? keyword.split(',') : defaults.keywords;
    const categories = category ? category.split(',') : defaults.categories;


    const categoryMap = {
        business: "dmoz/Business",
        technology: "dmoz/Technology",
        entertainment: "dmoz/Entertainment",
        general: "dmoz/Society",
        health: "dmoz/Health",
        science: "dmoz/Science",
        sports: "dmoz/Sports"
    };

    const queryConditions = [];

    if (keywords.length > 0) {
        queryConditions.push({
            "$or": keywords.map(kw => ({ "keyword": kw.trim(), "keywordLoc": "body" }))
        });
    }

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
    
    if (queryConditions.length === 0) {
        // Prevent a search with no criteria which might be invalid for the API
        return res.json({ articles: { results: [], page: 1, pages: 1, totalResults: 0 } });
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

router.get('/get-validation-prompt', async (req, res) => {
    try {
        const prompt = await getValidationPrompt();
        res.json({ prompt });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/default-keywords-and-categories', async (req, res) => {
    try {
        const defaults = await getDefaultKeywordsAndCategories();
        res.json(defaults);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch default filters.' });
    }
});

router.post('/save-validation-prompt', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt content is required.' });
    }
    try {
        const db = getDB();
        await db.collection('Validate_News').updateOne(
            { name: 'active' },
            { $set: { prompt: prompt, name: 'active' } },
            { upsert: true }
        );
        res.json({ success: true, message: 'Active prompt saved.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save prompt.' });
    }
});

router.post('/reset-validation-prompt', async (req, res) => {
    try {
        const db = getDB();
        // Delete the active prompt if it exists
        await db.collection('Validate_News').deleteOne({ name: 'active' });
        
        // Fetch and return the default prompt
        const defaultDoc = await db.collection('Validate_News').findOne({ name: 'default' });
        if (!defaultDoc) {
            return res.status(404).json({ error: 'Default prompt not found.' });
        }
        res.json({ success: true, prompt: defaultDoc.prompt });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset prompt.' });
    }
});

module.exports = router;
