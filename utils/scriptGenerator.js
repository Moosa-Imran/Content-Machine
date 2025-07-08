// utils/scriptGenerator.js
// Contains helper functions for generating creative content from case studies using a dynamic, prompt-based framework.

const { callGeminiAPI } = require('../services/aiService');

/**
 * Generates a specified number of creative options (e.g., hooks, build-ups) for a given business case
 * using a prompt-based framework.
 * @param {object} businessCase - The business case object with details like company, industry, etc.
 * @param {string} type - The type of content to generate (e.g., 'hooks', 'buildUps').
 * @param {object} framework - The framework object containing prompts and examples.
 * @returns {Promise<string[]>} A promise that resolves to an array of generated content strings.
 */
const generateMoreOptions = async (businessCase, type, framework) => {
    // Defensive checks for required inputs
    if (!businessCase || !type || !framework) {
        console.error("generateMoreOptions called with invalid arguments.", { businessCase, type, framework });
        return ["Error: Invalid data provided to generator."];
    }

    // Map the type to the corresponding framework keys (e.g., 'hooks' -> 'hooksPrompt', 'hooksExamples')
    const promptKey = `${type}Prompt`;
    const examplesKey = `${type}Examples`;

    const instructionPrompt = framework[promptKey];
    const examples = framework[examplesKey] || [];
    const overallContext = framework.overallPrompt;

    if (!instructionPrompt) {
        console.error(`Framework is missing instruction prompt for type: ${type}`);
        return [`Error: Framework prompt for '${type}' is not configured.`];
    }

    // Select a few random examples to guide the AI's style
    const shuffledExamples = [...examples].sort(() => 0.5 - Math.random());
    const selectedExamples = shuffledExamples.slice(0, 5);

    // Construct the detailed prompt for the Gemini API
    const fullPrompt = `
        **CONTEXT:**
        You are a creative director for a marketing agency specializing in viral, psychology-driven video content. Your overall brand voice is defined by this context: "${overallContext}"

        **TASK:**
        Generate exactly 3 unique, compelling, and creative options for a script's '${type}' section.

        **CASE STUDY DETAILS:**
        - Company: ${businessCase.company}
        - Industry: ${businessCase.industry}
        - Core Psychology/Tactic: ${businessCase.psychology}
        - Problem: ${businessCase.problem}
        - Solution: ${businessCase.solution}
        - Findings: ${businessCase.findings}

        **INSTRUCTIONS FOR THIS SECTION:**
        Follow this specific instruction: "${instructionPrompt}"

        **STYLE GUIDE (EXAMPLES):**
        Use the following examples as a reference for the tone, style, and structure. Do not copy them directly, but use them as inspiration:
        ${selectedExamples.map(ex => `- "${ex}"`).join('\n')}

        **OUTPUT FORMAT:**
        Return your response as a single, valid JSON object with one key: "options". The value should be an array of exactly 3 unique strings.
        Example: {"options": ["Generated option 1.", "Generated option 2.", "Generated option 3."]}
    `;

    try {
        const result = await callGeminiAPI(fullPrompt, true);
        
        // Validate the AI's response
        if (result && Array.isArray(result.options) && result.options.length > 0) {
            return result.options.slice(0, 3); // Ensure we only return 3 options
        } else {
            console.warn(`AI returned an invalid structure for type '${type}'. Response:`, result);
            // Fallback to a simple template if AI fails
            return [`${businessCase.company} used ${businessCase.psychology} to achieve amazing results.`];
        }
    } catch (error) {
        console.error(`Error calling Gemini API for type '${type}':`, error);
        return ["Error: Could not generate creative options at this time."];
    }
};

module.exports = {
    generateMoreOptions
};
