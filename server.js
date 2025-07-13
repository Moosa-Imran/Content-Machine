// server.js
// Main entry point for the Node.js application.

const express = require('express');
const path = require('path');
const session = require('express-session');
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

// Session Middleware Setup
// Note: You should add a SESSION_SECRET to your .env file for security.
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-default-secret-key-for-development',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true, // Helps prevent XSS attacks
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
