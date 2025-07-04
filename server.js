// server.js
// Main entry point for the Node.js application.

const express = require('express');
const path = require('path');
const { connectDB } = require('./config/database');
const mainRoutes = require('./routes/main');

// Load environment variables from .env file
require('dotenv').config();

// Connect to MongoDB
connectDB();

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

// --- Routes ---

// Use the routes defined in routes/main.js
app.use('/', mainRoutes);

// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('This app is designed to run in a Node.js environment.');
    console.log('--- SETUP INSTRUCTIONS ---');
    console.log('1. Make sure you have Node.js and MongoDB installed and running.');
    console.log('2. In your terminal, run `npm install express ejs dotenv node-fetch@2 mongodb`');
    console.log('3. Create a file named `.env` in the root of your project.');
    console.log('4. In the `.env` file, add your keys:');
    console.log('   GEMINI_API_KEY=YOUR_GEMINI_API_KEY');
    console.log('   MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING');
    console.log('5. Run `node server.js`');
});
