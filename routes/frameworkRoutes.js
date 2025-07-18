// routes/frameworkRoutes.js
// Handles all API routes for CRUD operations on Frameworks.

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// --- MODULE IMPORTS ---
const { getDB } = require('../config/database');
const { getFrameworkById } = require('../utils/dbHelpers');
const { callGeminiAPI } = require('../services/aiService');


// --- FRAMEWORK API ROUTES ---

router.get('/frameworks', async (req, res) => {
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

router.get('/framework/:id', async (req, res) => {
    try {
        const framework = await getFrameworkById(req.params.id);
        res.json(framework);
    } catch (error) {
        res.status(500).json({ error: 'Could not load the script framework.' });
    }
});

router.post('/frameworks', async (req, res) => {
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

router.delete('/framework/:id', async (req, res) => {
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

router.post('/update-framework-from-prompt', async (req, res) => {
    const { aiPrompt, frameworkId } = req.body;
    if (!aiPrompt || !frameworkId) {
        return res.status(400).json({ error: 'Rewrite instruction and Framework ID are required.' });
    }

    try {
        const db = getDB();
        const currentFramework = await getFrameworkById(frameworkId);
        
        const frameworkForPrompt = JSON.parse(JSON.stringify(currentFramework));
        const MAX_EXAMPLES_IN_PROMPT = 7;

        ['hooks', 'buildUps', 'stories', 'psychologies', 'ctas', 'contexts', 'evidences', 'patterns'].forEach(key => {
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
        
        const finalFramework = { ...currentFramework, ...updatedSections };
        delete finalFramework._id;

        await db.collection('Frameworks').updateOne(
            { _id: new ObjectId(frameworkId) },
            { $set: finalFramework }
        );

        res.json({ success: true, message: 'Framework updated successfully.' });

    } catch (error) {
        console.error("Error updating framework from prompt:", error);
        res.status(500).json({ error: 'Failed to update framework.' });
    }
});


module.exports = router;
