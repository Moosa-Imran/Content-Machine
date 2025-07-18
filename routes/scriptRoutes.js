// routes/scriptRoutes.js
// Handles all API routes for script and story generation and management.

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { getBusinessCases, getFrameworkById } = require('../utils/dbHelpers');
const { generateMoreOptions } = require('../utils/scriptGenerator');
const { callGeminiAPI, generateAudio, ApiError } = require('../services/aiService');

// --- HELPER FUNCTION ---

/**
 * Generates all sections of a script based on a business case and a framework.
 * @param {object} businessCase - The source business case.
 * @param {object} framework - The script framework to use.
 * @returns {Promise<object>} A promise that resolves to the complete script object.
 */
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
        frameworkId: framework._id, // Pass frameworkId to the frontend
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


// --- SCRIPT & STORY API ROUTES ---

router.get('/business-cases/count', async (req, res) => {
    try {
        const db = getDB();
        const count = await db.collection('Business_Cases').countDocuments({ used: { $ne: true } });
        res.json({ total: count });
    } catch (error) {
        console.error("Error fetching business case count:", error);
        res.status(500).json({ error: 'Failed to get total business cases.' });
    }
});

router.post('/new-script', async (req, res) => {
    const { frameworkId } = req.body;
    try {
        const [businessCases, framework] = await Promise.all([
            getBusinessCases(1),
            getFrameworkById(frameworkId) // Will use default if frameworkId is null/undefined
        ]);

        if (businessCases.length === 0) {
            return res.status(404).json({ error: 'No business cases found.' });
        }
        const businessCase = businessCases[0];
        const newScript = await generateScriptContent(businessCase, framework);
        res.json(newScript);
    } catch (error) {
        console.error("Error in /api/new-script:", error);
        if (error instanceof ApiError && error.status === 503) {
            return res.status(503).json({ error: 'The AI model is currently overloaded. Please try again in a few moments.' });
        }
        res.status(500).json({ error: 'Failed to generate new script' });
    }
});

router.post('/regenerate-script-from-case', async (req, res) => {
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
        if (error instanceof ApiError && error.status === 503) {
            return res.status(503).json({ error: 'The AI model is currently overloaded. Please try again in a few moments.' });
        }
        res.status(500).json({ error: 'Failed to regenerate script' });
    }
});

router.delete('/business-case/:id', async (req, res) => {
    try {
        const db = getDB();
        const caseId = new ObjectId(req.params.id);
        
        const result = await db.collection('Business_Cases').deleteOne({ _id: caseId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Business case not found.' });
        }

        res.json({ success: true, message: 'Business case deleted successfully.' });
    } catch (error) {
        console.error("Error deleting business case:", error);
        res.status(500).json({ error: 'Failed to delete the business case.' });
    }
});

router.get('/find-companies', async (req, res) => {
    const prompt = `Generate a diverse list of 5 companies known for using interesting or quirky psychological marketing tactics. Include well-known brands and some lesser-known or foreign examples. Return as a JSON array of strings. e.g., ["Apple", "Shein", "Patagonia", "Liquid Death", "KupiVip"]`;
    try {
        const result = await callGeminiAPI(prompt, true);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: `Could not fetch company list. Server error: ${error.message}` });
    }
});

router.post('/tactic-breakdown', async (req, res) => {
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


router.post('/create-story-from-news', async (req, res) => {
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
        if (error instanceof ApiError && error.status === 503) {
            return res.status(503).json({ error: 'The AI model is currently overloaded. Please try again in a few moments.' });
        }
        res.status(500).json({ error: 'Failed to create story from news.' });
    }
});

router.post('/regenerate-section', async (req, res) => {
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
        if (error instanceof ApiError && error.status === 503) {
            return res.status(503).json({ error: 'The AI model is currently overloaded. Please try again in a few moments.' });
        }
        res.status(500).json({ error: `Failed to regenerate ${sectionType}.` });
    }
});

router.post('/verify-story', async (req, res) => {
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

router.post('/rewrite-script', async (req, res) => {
    const { finalScript, aiPrompt } = req.body;
    const fullPrompt = `Here is a script:\n\n${finalScript}\n\nPlease rewrite it based on this instruction: "${aiPrompt}". Keep the core facts but improve the style, tone, or structure as requested. Return only the rewritten script.`;
    
    try {
        const newScript = await callGeminiAPI(fullPrompt, false);
        res.json({ newScript });
    } catch (error) {
        res.status(500).json({ error: `Failed to rewrite script. Server error: ${error.message}` });
    }
});

router.post('/generate-audio', async (req, res) => {
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

router.post('/save-story', async (req, res) => {
    const { title, transcript, audioUrl, hashtags, businessCaseId, style } = req.body;

    if (!title || !transcript || !audioUrl || !style) {
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
            style: style,
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

router.post('/analyze-sheet', async (req, res) => {
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
