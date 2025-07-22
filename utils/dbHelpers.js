// utils/dbHelpers.js
// Contains shared helper functions for querying the MongoDB database.

const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');

/**
 * Fetches a specified number of unused business cases from the database,
 * optionally filtering by origin based on the framework type.
 * @param {number} [limit=1] - The number of business cases to fetch.
 * @param {string} [frameworkType] - The type of framework being used (e.g., 'news_commentary').
 * @returns {Promise<Array>} A promise that resolves to an array of business cases.
 */
const getBusinessCases = async (limit = 1, frameworkType) => {
    const db = getDB();
    const matchStage = { used: { $ne: true } };

    if (frameworkType === 'news_commentary') {
        matchStage.origin = 'news';
    }

    const pipeline = [
        { $match: matchStage },
        { $sample: { size: limit } }
    ];
    
    const cases = await db.collection('Business_Cases').aggregate(pipeline).toArray();
    
    if (cases.length === 0) {
        console.warn("No unused business cases found with the current filter. Fetching from all matching cases as a fallback.");
        const fallbackPipeline = [{ $match: matchStage }, { $sample: { size: limit } }];
        return await db.collection('Business_Cases').aggregate(fallbackPipeline).toArray();
    }
    return cases;
};

/**
 * Fetches a framework by its ID. If the ID is invalid or not provided,
 * it fetches the first 'news_commentary' framework as the default.
 * @param {string} id - The ObjectId of the framework to fetch.
 * @returns {Promise<object>} A promise that resolves to a framework object.
 * @throws {Error} If no frameworks are found in the database.
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
        framework = await db.collection('Frameworks').findOne({ type: 'news_commentary' });
    }
    if (!framework) {
        framework = await db.collection('Frameworks').findOne();
    }
    if (!framework) {
        throw new Error("No frameworks found in the database. Please create at least one framework.");
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
        console.warn("Default keywords not found in DB, using hardcoded fallback.");
        return { 
            keywords: ["marketing psychology", "behavioral economics", "neuromarketing", "cognitive bias", "pricing psychology"], 
            categories: ["business", "technology", "general"] 
        };
    } catch (error) {
        console.error("Error fetching default keywords/categories:", error);
        return { 
            keywords: ["marketing psychology", "behavioral economics", "neuromarketing", "cognitive bias", "pricing psychology"], 
            categories: ["business", "technology", "general"] 
        };
    }
};

/**
 * Fetches the default Instagram hashtags from the database.
 * Provides a hardcoded fallback if the database entry is not found.
 * @returns {Promise<Array>} A promise that resolves to an array of hashtags.
 */
const getIgHashtags = async () => {
    try {
        const db = getDB();
        const doc = await db.collection('Keywords').findOne({ name: 'ig-hashtags' });
        if (doc && doc.hashtags && doc.hashtags.length > 0) {
            return doc.hashtags;
        }
        console.warn("Default Instagram hashtags not found in DB, using hardcoded fallback.");
        return ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"];
    } catch (error) {
        console.error("Error fetching default Instagram hashtags:", error);
        return ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"];
    }
};

/**
 * Fetches the default Instagram competitor usernames from the database.
 * Provides a hardcoded fallback if the database entry is not found.
 * @returns {Promise<Array>} A promise that resolves to an array of competitor usernames.
 */
const getIgCompetitors = async () => {
    try {
        const db = getDB();
        const doc = await db.collection('Keywords').findOne({ name: 'ig-competitors' });
        if (doc && doc.competitors && doc.competitors.length > 0) {
            return doc.competitors;
        }
        console.warn("Default Instagram competitors not found in DB, using hardcoded fallback.");
        return ["conexion.irracional", "bellman.media", "jon_davids", "thebrandzine", "badmarketing", "neuromark.pro", "theventure", "maxfinn", "sanjayarora", "brandsmanagement"];
    } catch (error) {
        console.error("Error fetching default Instagram competitors:", error);
        return ["conexion.irracional", "bellman.media", "jon_davids", "thebrandzine", "badmarketing", "neuromark.pro", "theventure", "maxfinn", "sanjayarora", "brandsmanagement"];
    }
};

/**
 * Adds a new competitor username to the database if it doesn't already exist.
 * @param {string} username - The Instagram username to add.
 * @returns {Promise<object>} A promise that resolves to the result of the update operation.
 */
const addIgCompetitor = async (username) => {
    try {
        const db = getDB();
        return await db.collection('Keywords').updateOne(
            { name: 'ig-competitors' },
            { $addToSet: { competitors: username } },
            { upsert: true } // Creates the document if it doesn't exist
        );
    } catch (error) {
        console.error("Error adding Instagram competitor:", error);
        throw error;
    }
};

module.exports = {
    getBusinessCases,
    getFrameworkById,
    getValidationPrompt,
    getDefaultKeywordsAndCategories,
    getIgHashtags,
    getIgCompetitors,
    addIgCompetitor
};
