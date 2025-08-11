// server.js
// Main entry point for the Node.js application.

const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { connectDB } = require('./config/database');
const mainRoutes = require('./routes/main');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware Setup ---

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, client-side JS, images) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// To parse JSON bodies from incoming requests (for API calls from the frontend)
app.use(express.json());

// Add middleware to parse URL-encoded bodies (from HTML forms)
app.use(express.urlencoded({ extended: true }));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'Data',
        collectionName: 'Sessions'
    }),
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
}));

// --- Routes ---

// Use the routes defined in routes/main.js
app.use('/', mainRoutes);

// --- Server Startup ---
const startServer = async () => {
    try {
        // First, connect to the database
        await connectDB();
        
        // Then, start the Express server
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to connect to the database. Server did not start.", error);
        process.exit(1);
    }
};

startServer();
