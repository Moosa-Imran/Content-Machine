// routes/main.js
// Handles all application routing and server-side logic, including AI interactions.
// REFACIORED FOR SEPARATE PAGES

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// --- DATABASE & HELPERS (These remain on the backend) ---
const allVerifiedBusinessCases = [
    { id: 'cs01', company: "Lemonade Insurance", industry: "Insurance Tech", psychology: "Reciprocity & Honesty", problem: "Overcoming deep consumer mistrust in the insurance industry.", solution: "Donating unclaimed money to charities chosen by customers.", realStudy: "Featured in behavioral economics case studies.", findings: "This model builds trust and a sense of shared values, leading to higher customer loyalty and lower fraud rates.", verified: true, sources: ["Harvard Business School case studies", "Forbes articles on InsurTech"], source_url: "https://www.hbs.edu/faculty/Pages/item.aspx?num=53230", hashtags: ["#InsurTech", "#BehavioralEconomics", "#SocialImpact", "#Lemonade"] },
    { id: 'cs02', company: "Adagio Teas", industry: "E-commerce", psychology: "Gamification & Endowment Effect", problem: "Generating an endless supply of new products.", solution: "Allows customers to create and name their own signature tea blends, which can then be sold on the site.", realStudy: "Case studies in user-generated content and e-commerce personalization.", findings: "Customers who create blends become brand evangelists. They feel ownership (Endowment Effect) and are motivated to promote their own creations.", verified: true, sources: ["E-commerce marketing blogs", "Analysis of user-generated content platforms"], source_url: "https://www.adagio.com/", hashtags: ["#Ecommerce", "#UserGeneratedContent", "#Gamification", "#AdagioTeas"] },
    { id: 'cs03', company: "Chewy.com", industry: "E-commerce (Pet Supplies)", psychology: "Reciprocity & Peak-End Rule", problem: "Building extreme customer loyalty in a competitive market.", solution: "Empowering customer service reps to send hand-painted pet portraits and sympathy flowers after a pet passes away.", realStudy: "Widely cited example in customer service and CX strategy analyses.", findings: "These unexpected, high-emotion gestures create incredibly powerful, positive memories (Peak-End Rule), generating massive organic marketing and lifetime loyalty.", verified: true, sources: ["Forbes articles on customer experience", "Harvard Business Review analysis of customer loyalty"], source_url: "https://www.forbes.com/sites/shephyken/2021/11/21/chewys-formula-for-amazing-customer-service/", hashtags: ["#CustomerExperience", "#CX", "#BrandLoyalty", "#Chewy"] },
    { id: 'cs04', company: "IKEA", industry: "Retail", psychology: "The IKEA Effect & Sunk Cost Fallacy", problem: "Getting customers to value flat-pack furniture and increasing their commitment to a purchase.", solution: "Requiring customers to assemble the furniture themselves.", realStudy: "Dan Ariely's research at Duke University.", findings: "The effort invested in building the furniture (sunk cost) makes customers value the finished product significantly more than if it came pre-assembled.", verified: true, sources: ["Book: 'Predictably Irrational' by Dan Ariely", "Duke University research papers"], source_url: "https://www.danariely.com/the-ikea-effect-when-labor-leads-to-love/", hashtags: ["#IKEAEffect", "#BehavioralScience", "#RetailStrategy", "#IKEA"] },
    { id: 'cs05', company: "Starbucks", industry: "Food & Beverage", psychology: "Status Anxiety & The 'Third Place'", problem: "Selling mass-market coffee at a premium price.", solution: "Using Italian-sounding size names (Grande, Venti) and creating a comfortable 'third place' environment between work and home.", realStudy: "Sociological studies on consumer behavior and branding.", findings: "The foreign names add a layer of sophistication and create a unique in-group language, while the 'third place' concept fosters community and makes the higher price feel justified by the experience.", verified: true, sources: ["Book: 'The Starbucks Experience'", "Analysis by Prof. Bryant Simon"], source_url: "https://www.theguardian.com/lifeandstyle/2012/jan/07/starbucks-coffee-rules-bryant-simon", hashtags: ["#Starbucks", "#Branding", "#ThirdPlace", "#ConsumerPsychology"] },
    { id: 'cs06', company: "Trader Joe's", industry: "Grocery", psychology: "Paradox of Choice & Scarcity", problem: "Competing with massive supermarkets that offer endless options.", solution: "Offering a drastically limited selection of unique, private-label items and frequently rotating stock.", realStudy: "Analysis based on Barry Schwartz's 'Paradox of Choice' theory.", findings: "A smaller selection reduces shopper anxiety and decision fatigue. The rotating stock creates a sense of urgency and scarcity, encouraging customers to buy items 'before they're gone.'", verified: true, sources: ["Book: 'The Paradox of Choice' by Barry Schwartz", "CNBC analysis of Trader Joe's business model"], source_url: "https://www.cnbc.com/2022/01/15/how-trader-joes-convinces-you-to-buy-its-products.html", hashtags: ["#TraderJoes", "#ParadoxOfChoice", "#Scarcity", "#Retail"] },
    { id: 'cs07', company: "TikTok", industry: "Social Media", psychology: "Variable Reward Schedule", problem: "Maximizing user engagement and time spent on the app.", solution: "An algorithm that delivers a mix of highly engaging videos and mediocre ones in an unpredictable pattern.", realStudy: "Based on B.F. Skinner's research on operant conditioning.", findings: "Like a slot machine, a great video's unpredictable nature keeps users scrolling, seeking the next dopamine hit. It's more addictive than a predictable feed.", verified: true, sources: ["Center for Humane Technology analysis", "WSJ 'The TikTok Algorithm' documentary"], source_url: "https://www.humanetech.com/key-issues", hashtags: ["#TikTok", "#SocialMedia", "#AddictionByDesign", "#Dopamine"] },
    { id: 'cs08', company: "Casper", industry: "E-commerce (Mattresses)", psychology: "Cognitive Dissonance Reduction", problem: "Convincing customers to buy a large, important item like a mattress without trying it first.", solution: "Offering an extremely generous 100-night free trial and hassle-free return policy.", realStudy: "Case study in overcoming online purchase barriers.", findings: "The free trial removes the purchase risk. Once the mattress is in their home, the 'Endowment Effect' kicks in, making it feel like theirs. The hassle of returning it, combined with cognitive dissonance (admitting they made a bad choice), results in a very low return rate.", verified: true, sources: ["Inc Magazine articles", "HBS case studies"], source_url: "https://www.inc.com/magazine/201705/burt-helm/casper-mattress-philip-krim.html", hashtags: ["#Casper", "#Ecommerce", "#CognitiveDissonance", "#FreeTrial"] },
    { id: 'cs09', company: "HelloFresh", industry: "Meal Kit", psychology: "Choice Architecture", problem: "Making home cooking feel easy and preventing decision fatigue.", solution: "Pre-selecting recipes and pre-portioning all ingredients.", realStudy: "Application of nudge theory in product design.", findings: "By removing the most difficult parts of cooking (planning and shopping), they make the process feel achievable. Users are nudged towards cooking instead of ordering takeout.", verified: true, sources: ["Behavioral Scientist articles", "Meal kit industry analysis"], source_url: "https://behavioralscientist.org/how-meal-kits-hack-your-habits/", hashtags: ["#HelloFresh", "#NudgeTheory", "#ChoiceArchitecture"] },
    { id: 'cs10', company: "Tinder", industry: "Social Tech", psychology: "The Swipe Mechanic & Egorov Effect", problem: "Making dating apps fast, engaging, and addictive.", solution: "The simple 'swipe right/left' interface.", realStudy: "Based on principles of variable rewards and simplified choice.", findings: "The swipe is a form of variable reward schedule. The 'It's a Match!' screen provides a powerful dopamine hit. The simplicity reduces cognitive load and turns decision-making into a game.", verified: true, sources: ["UX design analysis blogs", "Psychology Today articles"], source_url: "https://www.psychologytoday.com/us/blog/love-and-modern-life/202203/the-psychology-tinders-swipe-right-or-left-feature", hashtags: ["#Tinder", "#UXDesign", "#Gamification", "#DatingApps"] },
    { id: 'cs11', company: "Amazon", industry: "E-commerce", psychology: "One-Click Ordering & Frictionless Purchasing", problem: "Maximizing the conversion rate between seeing a product and buying it.", solution: "Patenting and implementing the '1-Click' buy button.", realStudy: "A classic example of reducing friction in user experience.", findings: "By removing the steps of entering shipping and payment info, Amazon dramatically reduced the time for a customer to second-guess their impulse purchase, significantly boosting sales.", verified: true, sources: ["Nielsen Norman Group UX analysis", "Patents filed by Amazon"], source_url: "https://www.nngroup.com/articles/1-click-ordering/", hashtags: ["#Amazon", "#UX", "#Frictionless", "#Ecommerce"] },
    { id: 'cs12', company: "Ryanair", industry: "Airline", psychology: "Drip Pricing & Ancillary Revenue", problem: "Appearing to have the lowest price while maximizing revenue.", solution: "Advertising an extremely low base fare and then adding charges for every optional service (seat selection, bags, etc.) throughout the booking process.", realStudy: "Studies on consumer behavior regarding hidden fees.", findings: "Once a customer is committed to the initial low price (anchoring), they are more likely to accept the small additional fees. This 'drip pricing' model often results in a final price higher than competitors, but the initial perception is of a bargain.", verified: true, sources: ["The Guardian travel section", "Studies on airline pricing strategies"], source_url: "https://www.theguardian.com/money/2023/aug/25/ryanair-how-to-avoid-the-extra-charges", hashtags: ["#Ryanair", "#DripPricing", "#BehavioralEconomics", "#TravelHacks"] },
    { id: 'cs13', company: "McDonald's", industry: "Fast Food", psychology: "Sensory Marketing & Consistency", problem: "Ensuring a globally consistent brand experience that drives repeat purchases.", solution: "Strict control over store layout, smell (from cooking processes), and sound to create a familiar and predictable environment worldwide.", realStudy: "Sensory marketing research by Martin Lindstrom.", findings: "The consistent smell and environment trigger deep-seated brand associations and feelings of comfort and reliability, making it a low-risk, predictable choice for consumers anywhere.", verified: true, sources: ["Book: 'Brand Sense' by Martin Lindstrom", "QSR Magazine"], source_url: "https://www.qsrmagazine.com/outside-insights/sensory-marketing-how-brands-can-tap-all-five-senses/", hashtags: ["#McDonalds", "#SensoryMarketing", "#Branding", "#FastFood"] },
    { id: 'cs14', company: "Costco", industry: "Retail", psychology: "Treasure Hunt & Bulk Buying Bias", problem: "Encouraging frequent visits and large purchases.", solution: "A constantly rotating, limited-stock selection of non-essential 'treasure' items placed in the center of the store, and selling essentials in bulk.", realStudy: "Retail psychology studies on warehouse club models.", findings: "The 'Treasure Hunt' creates a fear of missing out (FOMO) and a reason to visit often. The bulk packaging makes customers feel they are getting an excellent deal, even if they purchase more than they need.", verified: true, sources: ["CNBC analysis", "The Wall Street Journal"], source_url: "https://www.cnbc.com/2018/09/26/the-psychological-reasons-you-cant-stop-shopping-at-costco.html", hashtags: ["#Costco", "#TreasureHunt", "#RetailPsychology", "#BulkBuy"] },
    { id: 'cs15', company: "ClassPass", industry: "Fitness Tech", psychology: "Gamified Scarcity & Loss Aversion", problem: "Getting users to commit to a monthly subscription for variable fitness classes.", solution: "Using a credit-based system where classes at popular times 'cost' more credits and unused credits expire.", realStudy: "Analysis of subscription models and user engagement.", findings: "The credit system makes users feel they are 'spending' a currency, creating a sense of scarcity for popular classes. The expiring credits trigger 'Loss Aversion', motivating users to book classes to avoid 'wasting' their monthly credits.", verified: true, sources: ["Subscription economy analysis on Substack", "Product management blogs"], source_url: "https://product.substack.com/p/the-genius-of-classpass", hashtags: ["#ClassPass", "#Gamification", "#LossAversion", "#Subscription"] }
];
const extraHooks = [ "You’ll probably scroll past this. And that’s exactly why it works.", "The best way to sell more? Stop trying to sell.", "This brand lost customers on purpose — and tripled revenue.", "They told customers not to buy… and sold out in 48 hours.", "Lower ratings = higher trust. Sounds backwards, but it’s science.", "Want more people to show up? Pretend you don’t care if they do.", "They removed all discounts — and people bought more.", "This ad doesn’t ask you to click… and that’s why everyone does.", "They said ‘Don’t follow us’ — 200,000 people did.", "Customers loved being rejected. Here’s how it boosted conversions.", "They made their product harder to buy — and demand exploded.", "They hid their most expensive item — and it became their bestseller.", "This brand admits it’s not for everyone. That’s what made it go viral.", "The less they posted, the more they grew. Here’s why.", "They made checkout slower. Sales jumped 19%.", "Why adding friction to the user journey increased loyalty.", "Telling customers ‘you won’t like this’ made them obsessed.", "They told customers to wait a month before buying. It backfired — in the best way.", "This site makes you click extra to see the price — and it works.", "The worst-performing product ad? It’s the one they ran again — and it blew up."];
const generateMoreOptions = (businessCase, type) => {
    const { company, industry, psychology, solution, problem, findings } = businessCase;
    let templates = [];
    if (type === 'hooks') {
        const dynamicHooks = [
            () => `How ${company} used ${psychology.split('&')[0].trim()} to solve a common ${industry} problem.`,
            () => `This company's secret isn't their product. It's this simple psychological trick.`,
            () => `If you think you're immune to marketing, wait until you see how ${company} changed their business.`
        ];
        const allHookOptions = [...extraHooks, ...dynamicHooks.map(fn => fn())];
        const shuffled = allHookOptions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
    } else if (type === 'buildUps') {
        templates = [
            () => `When a study published in '${businessCase.sources[0]}' analyzed this, they found a shocking correlation.`,
            () => `This works because of a cognitive bias that affects 99% of us, whether we realize it or not.`,
            () => `This isn't a new idea, but the way ${company} applied it is genius.`
        ];
    } else if (type === 'stories') {
        templates = [
            () => `${company} used a classic psychological tactic: **${psychology}**. They knew that by ${solution.toLowerCase()}, customers would feel a powerful, subconscious urge to respond. The result was clear: ${findings}.`,
            () => `The core of their strategy was **${psychology}**. Instead of a direct approach to solving '${problem.toLowerCase()}', they changed the environment. By ${solution.toLowerCase()}, they subtly guided customer behavior, leading to incredible results.`,
            () => `This is a textbook case of **${psychology.split('&')[0].trim()}** in the wild. The problem was ${problem.toLowerCase()}. The genius solution was ${solution.toLowerCase()}, which directly triggers this cognitive bias. Unsurprisingly, it worked: ${findings}.`
        ];
    } else if (type === 'psychologies') {
        templates = [
            () => `It all comes down to **${psychology}**. Our brains are wired to react this way because of our evolutionary need to fit in and trust others.`,
            () => `This is a textbook example of **${psychology.split('&')[0].trim()}**. It's about influencing decision-making by creating a specific emotional or social context, rather than just focusing on the product's features.`,
            () => `Why does this work? **${psychology}**. The company didn't change its product, it changed the psychological frame around the product, making it feel more valuable, trustworthy, or urgent.`
        ];
    }
    const options = new Set();
    while (options.size < 3 && templates.length > 0) {
        const randomIndex = Math.floor(Math.random() * templates.length);
        options.add(templates[randomIndex]());
        templates.splice(randomIndex, 1);
    }
    return Array.from(options);
};

const callGeminiAPI = async (prompt, isJson = false) => {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) console.error("GEMINI_API_KEY is not set. API calls will fail.");
    
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
                textResponse = textResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                return JSON.parse(textResponse);
            }
            return textResponse;
        }
        throw new Error("Invalid API response structure");
    } catch (error) {
        console.error("Gemini API Call Error:", error);
        throw error;
    }
};

// --- PAGE RENDERING ROUTES ---

/**
 * @route   GET /
 * @desc    Render the main dashboard page
 */
router.get('/', (req, res) => {
    res.render('index', { 
        title: 'Dashboard',
        script: null // No specific script for the dashboard
    });
});

/**
 * @route   GET /reels
 * @desc    Render the Viral Scripts page
 */
router.get('/reels', (req, res) => {
    try {
        const shuffledCases = [...allVerifiedBusinessCases].sort(() => 0.5 - Math.random());
        const initialFeed = shuffledCases.slice(0, 10).map((businessCase, index) => ({
            ...businessCase,
            id: `preloaded-${Date.now()}-${index}`,
            hooks: generateMoreOptions(businessCase, 'hooks'),
            buildUps: generateMoreOptions(businessCase, 'buildUps'),
            stories: generateMoreOptions(businessCase, 'stories'),
            psychologies: generateMoreOptions(businessCase, 'psychologies'),
        }));
        
        res.render('reels', { 
            title: 'Viral Scripts',
            contentFeed: initialFeed,
            script: 'reels.js' // Specify the JS file for this page
        });
    } catch (error) {
        console.error("Error rendering reels page:", error);
        res.status(500).send("Error loading the Viral Scripts page.");
    }
});

/**
 * @route   GET /breakdown
 * @desc    Render the Tactic Breakdown page
 */
router.get('/breakdown', (req, res) => {
    res.render('breakdown', { 
        title: 'Tactic Breakdowns',
        script: 'breakdown.js' 
    });
});

/**
 * @route   GET /sheet
 * @desc    Render the Analyze Sheet page
 */
router.get('/sheet', (req, res) => {
    res.render('sheet', { 
        title: 'Analyze Sheet',
        script: 'sheet.js'
    });
});

/**
 * @route   GET /news
 * @desc    Render the Industry News page
 */
router.get('/news', (req, res) => {
    res.render('news', { 
        title: 'Industry News',
        script: 'news.js'
    });
});


// --- API Routes for Client-Side JS (remain the same) ---

/**
 * @route   GET /api/new-scripts
 * @desc    Get a new batch of pre-loaded stories
 */
router.get('/api/new-scripts', (req, res) => {
    try {
        const shuffledCases = [...allVerifiedBusinessCases].sort(() => 0.5 - Math.random());
        const newBatch = shuffledCases.slice(0, 10).map((businessCase, index) => ({
            ...businessCase,
            id: `preloaded-${Date.now()}-${index}`,
            hooks: generateMoreOptions(businessCase, 'hooks'),
            buildUps: generateMoreOptions(businessCase, 'buildUps'),
            stories: generateMoreOptions(businessCase, 'stories'),
            psychologies: generateMoreOptions(businessCase, 'psychologies'),
        }));
        res.json(newBatch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate new scripts' });
    }
});

/**
 * @route   POST /api/verify-story
 * @desc    Verify a story using Gemini API
 */
router.post('/api/verify-story', async (req, res) => {
    const { company, solution, psychology, findings, sources } = req.body;
    const prompt = `Please verify the following business story. Check for the accuracy of the company's action, the stated psychological principle, and the claimed outcome. Provide a step-by-step verification process and a final conclusion.
    Story to Verify:
    - Company: ${company}
    - Tactic: ${solution}
    - Stated Psychology: ${psychology}
    - Claimed Finding: ${findings}
    - Source: ${sources[0]}
    Return your verification as a JSON object with the structure: {"checks": [{"check": "string", "is_correct": boolean, "comment": "string"}], "conclusion": "string", "confidence_score": number_between_0_and_100}`;
    
    try {
        const result = await callGeminiAPI(prompt, true);
        res.json(result);
    } catch (error) {
        console.error("Verification API Error:", error);
        res.status(500).json({ error: 'Verification process failed.' });
    }
});

/**
 * @route   POST /api/rewrite-script
 * @desc    Rewrite a script using Gemini API
 */
router.post('/api/rewrite-script', async (req, res) => {
    const { finalScript, aiPrompt } = req.body;
    const fullPrompt = `Here is a script:\n\n${finalScript}\n\nPlease rewrite it based on this instruction: "${aiPrompt}". Keep the core facts but improve the style, tone, or structure as requested. Return only the rewritten script.`;
    
    try {
        const newScript = await callGeminiAPI(fullPrompt, false);
        res.json({ newScript });
    } catch (error) {
        res.status(500).json({ error: 'Failed to rewrite script.' });
    }
});

/**
 * @route   POST /api/tactic-breakdown
 * @desc    Generate a tactic breakdown for a company
 */
router.post('/api/tactic-breakdown', async (req, res) => {
    const { companyName } = req.body;
    const prompt = `For the company '${companyName}', create a viral script that breaks down 3 of their most quirky, shocking, or unknown marketing tactics. For each tactic, identify which pillar it belongs to (Psychological triggers, Biases, Behavioural economics, or Neuromarketing). Structure the entire output as a single JSON object for a script with the following keys: 'company', 'hook', 'buildUp', 'storyBreakdown', 'concludingPsychology'.

    - 'company': The name of the company.
    - 'hook': A compelling opening line for a short video about these tactics.
    - 'buildUp': A sentence to create anticipation.
    - 'storyBreakdown': An array of 3 objects, where each object has the keys: 'tacticName', 'pillar', and 'explanation'. The explanation should detail the quirky tactic.
    - 'concludingPsychology': A concluding sentence that summarizes the overall psychological genius.`;

    try {
        const result = await callGeminiAPI(prompt, true);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: `Failed to generate script for ${companyName}.` });
    }
});

/**
 * @route   GET /api/find-companies
 * @desc    Get a list of companies for breakdown
 */
router.get('/api/find-companies', async (req, res) => {
    const prompt = `Generate a diverse list of 5 companies known for using interesting or quirky psychological marketing tactics. Include well-known brands and some lesser-known or foreign examples. Return as a JSON array of strings. e.g., ["Apple", "Shein", "Patagonia", "Liquid Death", "KupiVip"]`;
    try {
        const result = await callGeminiAPI(prompt, true);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Could not fetch company list.' });
    }
});


/**
 * @route   POST /api/analyze-sheet
 * @desc    Analyze pasted spreadsheet data
 */
router.post('/api/analyze-sheet', async (req, res) => {
    const { pastedData, sheetUrl } = req.body;
    const hasPastedData = pastedData && pastedData.trim().length > 0;
    const hasUrl = sheetUrl && sheetUrl.trim().length > 0;

    if (!hasPastedData && !hasUrl) {
        return res.status(400).json({ error: 'No data or URL provided.' });
    }

    const analysisSource = hasPastedData 
        ? `the following pasted data:\n\n${pastedData}`
        : `the data from this Google Sheet: ${sheetUrl}`;

    const prompt = `Analyze ${analysisSource}. Assume the data is structured with columns like 'Company', 'Industry', 'Problem', 'Solution'. 
    For each row/entry, create a business case study object. Then, for each case, generate a hook, a build-up, a story, and a psychology explanation.
    Return a JSON array of these objects, where each object has this structure:
    {"company": "string", "industry": "string", "problem": "string", "solution": "string", "findings": "string", "psychology": "string", "hashtags": ["string"], "hooks": ["string"], "buildUps": ["string"], "stories": ["string"], "psychologies": ["string"]}`;

    try {
        const results = await callGeminiAPI(prompt, true);
        const formattedResults = results.map((r, i) => ({
            ...r,
            id: `sheet-${Date.now()}-${i}`,
            sources: [hasPastedData ? 'Pasted Data' : sheetUrl],
        }));
        res.json(formattedResults);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to analyze the provided data.' });
    }
});


/**
 * @route   GET /api/scan-news
 * @desc    Scan for relevant industry news
 */
router.get('/api/scan-news', async (req, res) => {
    const prompt = `Find 3 recent news articles or case studies about companies using psychological triggers, cognitive biases, behavioural economics, or neuromarketing. For each, provide the title, summary, URL, the primary psychological tactic used, a brief explanation of that tactic, and a 'hot_score' (1-100) based on how quirky, controversial, or intriguing the story is. Return this as a JSON array with this structure: [{"title": "string", "summary": "string", "url": "string", "tactic": "string", "tactic_explanation": "string", "hot_score": "number"}]`;
    try {
        const results = await callGeminiAPI(prompt, true);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch news articles.' });
    }
});


/**
 * @route   POST /api/create-story-from-news
 * @desc    Create a story from a news article
 */
router.post('/api/create-story-from-news', async (req, res) => {
    const { article } = req.body;
    const prompt = `Based on this news article titled "${article.title}" which is about using the '${article.tactic}' tactic, create a viral story script.
    Identify a company, a core problem, a clever solution, the underlying psychological tactic, and the potential findings.
    Then generate a hook, build-up, story, and psychology explanation.
    Return a single JSON object with this structure:
    {"company": "string", "industry": "string", "problem": "string", "solution": "string", "findings": "string", "psychology": "string", "hashtags": ["string"], "hooks": ["string"], "buildUps": ["string"], "stories": ["string"], "psychologies": ["string"]}`;
    try {
        const result = await callGeminiAPI(prompt, true);
        const newStory = {
            ...result,
            id: `news-${Date.now()}`,
            sources: [article.url],
            company: result.company || 'A Company',
        };
        res.json(newStory);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate a story from this article.' });
    }
});

module.exports = router;
