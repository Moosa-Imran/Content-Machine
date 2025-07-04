// services/aiService.js
// Handles all communication with the external Gemini API.

const fetch = require('node-fetch');

const callGeminiAPI = async (prompt, isJson = false) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set. API calls will fail.");
        throw new Error("Server is missing API Key configuration. Please set the GEMINI_API_KEY environment variable.");
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(isJson && { generationConfig: { responseMimeType: "application/json" } })
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error Response:", errorBody);
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            let textResponse = result.candidates[0].content.parts[0].text;
            if (isJson) {
                // Clean up potential markdown formatting from the JSON response
                textResponse = textResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                return JSON.parse(textResponse);
            }
            return textResponse;
        }
        throw new Error("Invalid API response structure");
    } catch (error) {
        console.error("Gemini API Call Error:", error);
        throw error; // Re-throw to be caught by the route handler
    }
};

module.exports = {
    callGeminiAPI
};
