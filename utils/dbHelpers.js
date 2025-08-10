// utils/dbHelpers.js
// Contains shared helper functions for querying the MongoDB database.

const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');


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


const getTiktokHashtags = async () => {
    try {
        const db = getDB();
        const doc = await db.collection('Keywords').findOne({ name: 'tiktok-hashtags' });
        if (doc && doc.hashtags && doc.hashtags.length > 0) {
            return doc.hashtags;
        }
        console.warn("Default TikTok hashtags not found in DB, using hardcoded fallback.");
        return ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"];
    } catch (error) {
        console.error("Error fetching default TikTok hashtags:", error);
        return ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"];
    }
};

const getYoutubeHashtags = async () => {
    try {
        const db = getDB();
        const doc = await db.collection('Keywords').findOne({ name: 'youtube-hashtags' });
        if (doc && doc.hashtags && doc.hashtags.length > 0) {
            return doc.hashtags;
        }
        console.warn("Default YouTube hashtags not found in DB, using hardcoded fallback.");
        return ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"];
    } catch (error) {
        console.error("Error fetching default YouTube hashtags:", error);
        return ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"];
    }
};

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
    getTiktokHashtags,
    getYoutubeHashtags,
    addIgCompetitor
};
