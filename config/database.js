// config/database.js
// Handles the connection to the MongoDB database.

const { MongoClient } = require('mongodb');
require('dotenv').config(); // Make sure environment variables are loaded

// Connection URI is now loaded from the .env file
const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("MongoDB connection string is not defined. Please set the MONGODB_URI environment variable.");
    process.exit(1);
}

const client = new MongoClient(uri);

let db;

const connectDB = async () => {
    if (db) return db;
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB.");
        db = client.db("Data"); // Your database name
        return db;
    } catch (e) {
        console.error("Could not connect to MongoDB", e);
        process.exit(1); // Exit the process if DB connection fails
    }
};

const getDB = () => {
    if (!db) {
        throw new Error("Database not initialized. Call connectDB first.");
    }
    return db;
};

module.exports = { connectDB, getDB };
