// config/database.js
// Handles the connection to the MongoDB database.

const { MongoClient } = require('mongodb');

// Connection URI - It's best to use an environment variable for this.
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
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
