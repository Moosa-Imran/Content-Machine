// utils/dbHelpers.js
// Contains shared helper functions for querying the MongoDB database.

const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');

/**
 * Fetches a specified number of unused business cases from the database.
 * If no unused cases are found, it falls back to fetching any random cases.
 * @param {number} [limit=1] - The number of business cases to fetch.
 * @returns {Promise<Array>} A promise that resolves to an array of business cases.
 */
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

/**
 * Fetches a framework by its ID. If the ID is invalid or not provided,
 * it fetches the default framework.
 * @param {string} id - The ObjectId of the framework to fetch.
 * @returns {Promise<object>} A promise that resolves to a framework object.
 * @throws {Error} If no default framework is found.
 */
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

/**
 * Retrieves the active or default validation prompt from the database.
 * @returns {Promise<string>} A promise that resolves to the validation prompt string.
 * @throws {Error} If no validation prompt document is found.
 */
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

/**
 * Fetches the default keywords and categories for news scanning.
 * Provides a hardcoded fallback if the database entry is not found.
 * @returns {Promise<object>} A promise that resolves to an object with keywords and categories arrays.
 */
const getDefaultKeywordsAndCategories = async () => {
    try {
        const db = getDB();
        const doc = await db.collection('Keywords').findOne({ name: 'default' });
        if (doc && doc.keywords && doc.keywords.length > 0) {
            return {
                keywords: doc.keywords,
                categories: doc.categories || []
            };
        }
        // Hardcoded fallback if DB is empty or not set up
        console.warn("Default keywords not found in DB, using hardcoded fallback.");
        return { 
            keywords: ["marketing psychology", "behavioral economics", "neuromarketing", "cognitive bias", "pricing psychology"], 
            categories: ["business", "technology", "general"] 
        };
    } catch (error) {
        console.error("Error fetching default keywords/categories:", error);
        // Hardcoded fallback on error
        return { 
            keywords: ["marketing psychology", "behavioral economics", "neuromarketing", "cognitive bias", "pricing psychology"], 
            categories: ["business", "technology", "general"] 
        };
    }
};

module.exports = {
    getBusinessCases,
    getFrameworkById,
    getValidationPrompt,
    getDefaultKeywordsAndCategories
};
