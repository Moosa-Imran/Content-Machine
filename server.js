// server.js
// Main entry point for the Node.js application.

const express = require('express');
const path = require('path');
const mainRoutes = require('./routes/main');

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
});
