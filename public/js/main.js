// public/js/main.js
// This script handles all client-side interactions for the EJS application.

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let contentFeed = [];
    let currentFeedIndex = 0;
    
    // --- ELEMENT SELECTORS ---
    const mainTabs = document.getElementById('main-tabs');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const reelsContainer = document.getElementById('reels-container');
    const reelCardContainer = document.getElementById('reel-card-container');
    const paginationContainer = document.getElementById('pagination-container');
    const findNewScriptsBtn = document.getElementById('find-new-scripts-btn');
    
    // --- INITIALIZATION ---
    const init = () => {
        // Parse initial data embedded in the page (if any)
        const initialDataElement = document.getElementById('initial-data');
        if (initialDataElement) {
            contentFeed = JSON.parse(initialDataElement.textContent);
            currentFeedIndex = 0;
            renderCurrentReel();
        } else if(reelCardContainer.firstElementChild) {
            // If there's already a card, we assume the data is there
            // This is a simplified way to know we have at least one story
            contentFeed = [{}]; // Placeholder to make pagination work initially
            updatePagination();
        }
        
        attachEventListeners();
        lucide.createIcons(); // Re-initialize icons
    };
    
    // --- EVENT LISTENERS ---
    const attachEventListeners = () => {
        // Tab switching
        mainTabs.addEventListener('click', (e) => {
            const tabButton = e.target.closest('.tab-button');
            if (tabButton) {
                handleTabClick(tabButton.dataset.tab);
            }
        });

        // "Find New Scripts" button
        findNewScriptsBtn?.addEventListener('click', fetchNewScripts);

        // Event delegation for dynamic content inside the reel card container
        reelCardContainer.addEventListener('click', (e) => {
            const buildBtn = e.target.closest('.build-script-btn');
            const verifyBtn = e.target.closest('.verify-story-btn');
            const rewriteBtn = e.target.closest('.rewrite-ai-btn');
            const copyBtn = e.target.closest('.copy-text-btn');
            const audioBtn = e.target.closest('.generate-audio-btn');

            if (buildBtn) handleBuildScript();
            if (verifyBtn) handleVerifyStory();
            if (rewriteBtn) handleAiRewrite();
            if (copyBtn) handleCopyScript();
            if (audioBtn) handleGenerateAudio();
        });

        // Other tabs
        document.getElementById('find-companies-btn')?.addEventListener('click', findCompanies);
        document.getElementById('companies-container')?.addEventListener('click', handleCompanySelection);
        document.getElementById('analyze-sheet-btn')?.addEventListener('click', analyzeSheet);
        document.getElementById('scan-news-btn')?.addEventListener('click', scanForNews);
        document.getElementById('news-articles-container')?.addEventListener('click', handleCreateStoryFromNews);

    };

    // --- TAB HANDLING ---
    const handleTabClick = (tabId) => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
        
        tabPanes.forEach(pane => {
            pane.id === `${tabId}-content` ? pane.classList.remove('hidden') : pane.classList.add('hidden');
        });
    };

    // --- API & UI HELPERS ---
    const toggleButtonLoading = (button, isLoading) => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;
        if (isLoading) {
            icon.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5 animate-spin"></i>';
            if(text) text.textContent = 'Loading...';
        } else {
            icon.innerHTML = `<i data-lucide="${button.dataset.icon || 'search'}" class="w-5 h-5"></i>`;
            if(text) text.textContent = button.dataset.originalText || 'Submit';
        }
        lucide.createIcons();
    };
    
    // Universal fetch wrapper
    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown error occurred');
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    };
    
    // --- REELS TAB LOGIC ---
    const fetchNewScripts = async () => {
        toggleButtonLoading(findNewScriptsBtn, true);
        reelCardContainer.innerHTML = '';
        document.getElementById('reels-loader').classList.remove('hidden');
        try {
            contentFeed = await apiCall('/api/new-scripts');
            currentFeedIndex = 0;
            renderCurrentReel();
        } catch (error) {
            reelCardContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load scripts: ${error.message}</div>`;
        } finally {
            toggleButtonLoading(findNewScriptsBtn, false);
            document.getElementById('reels-loader').classList.add('hidden');
        }
    };
    
    const renderCurrentReel = () => {
        if (!contentFeed || contentFeed.length === 0) {
            reelCardContainer.innerHTML = `<div class="text-center text-gray-400 p-8">No scripts found.</div>`;
            return;
        }
        const story = contentFeed[currentFeedIndex];
        reelCardContainer.innerHTML = generateReelCardHTML(story);
        updatePagination();
        lucide.createIcons();
    };
    
    const updatePagination = () => {
        if (!contentFeed || contentFeed.length === 0) {
            paginationContainer.innerHTML = '';
            return;
        }
        paginationContainer.innerHTML = `
            <div class="flex items-center justify-center gap-4">
                <button id="prev-btn" class="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><i data-lucide="arrow-left" class="w-6 h-6"></i></button>
                <span class="text-lg font-semibold text-gray-300">Script <span class="text-yellow-400">${currentFeedIndex + 1}</span> of ${contentFeed.length}</span>
                <button id="next-btn" class="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"><i data-lucide="arrow-right" class="w-6 h-6"></i></button>
            </div>
        `;
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        prevBtn.disabled = currentFeedIndex === 0;
        prevBtn.addEventListener('click', () => {
            if (currentFeedIndex > 0) {
                currentFeedIndex--;
                renderCurrentReel();
            }
        });
        nextBtn.addEventListener('click', () => {
            if (currentFeedIndex < contentFeed.length - 1) {
                currentFeedIndex++;
                renderCurrentReel();
            } else {
                fetchNewScripts(); // Load new batch at the end
            }
        });
        lucide.createIcons();
    };

    const generateReelCardHTML = (story) => {
        const sections = [
            { type: 'hooks', title: 'HOOK (0-8s)', icon: 'target', color: 'red' },
            { type: 'buildUps', title: 'BUILD-UP (8-20s)', icon: 'trending-up', color: 'blue' },
            { type: 'stories', title: 'STORY (20-45s)', icon: 'video', color: 'green' },
            { type: 'psychologies', title: 'PSYCHOLOGY (45-60s)', icon: 'brain', color: 'purple' }
        ];

        const generateSectionHTML = (sec) => {
            const options = story[sec.type] || [];
            return `
                <div>
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <div class="flex items-center gap-2"><i data-lucide="${sec.icon}" class="w-5 h-5 text-${sec.color}-400"></i><span class="font-bold text-${sec.color}-400">${sec.title}</span></div>
                    </div>
                    <div class="space-y-2" data-section-type="${sec.type}">
                        ${options.map((option, index) => `
                            <div class="p-3 rounded-lg border-2 cursor-pointer transition-all ${index === 0 ? `bg-${sec.color}-500/20 border-${sec.color}-500` : 'bg-black/20 border-transparent hover:border-white/50'}" onclick="selectOption(this, '${sec.type}', ${index})">
                                <label class="flex items-start text-sm cursor-pointer">
                                    <input type="radio" name="${story.id}-${sec.type}" data-index="${index}" ${index === 0 ? 'checked' : ''} class="sr-only" />
                                    <div class="flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all ${index === 0 ? `border-${sec.color}-400 bg-${sec.color}-500` : 'border-gray-500'}">
                                        ${index === 0 ? '<i data-lucide="check-circle" class="w-3 h-3 text-white"></i>' : ''}
                                    </div>
                                    <span class="flex-grow text-gray-300">${option.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-400">$1</strong>')}</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        return `
            <div class="bg-white/5 rounded-xl p-4 sm:p-6 backdrop-blur-sm border border-white/20 shadow-lg max-w-4xl mx-auto" data-story-id="${story.id}">
                <div class="flex flex-wrap items-center gap-3 mb-6">
                    ${story.id.toString().startsWith('preloaded') ? '<span class="bg-gray-700 text-white px-3 py-1 rounded-full text-sm font-bold">Pre-loaded Story</span>' : ''}
                    ${story.id.toString().startsWith('sheet') ? '<span class="bg-purple-700 text-white px-3 py-1 rounded-full text-sm font-bold">From Sheet</span>' : ''}
                    ${story.id.toString().startsWith('news') ? '<span class="bg-blue-700 text-white px-3 py-1 rounded-full text-sm font-bold">From News</span>' : ''}
                    <span class="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-3 py-1 rounded-full text-sm font-bold">${story.company}</span>
                    <span class="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">${story.industry}</span>
                    <button class="verify-story-btn flex items-center gap-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 px-3 py-1 rounded-full font-semibold transition-colors disabled:opacity-50">
                        <span class="btn-icon"><i data-lucide="shield" class="w-4 h-4"></i></span>
                        <span class="btn-text">Verify Story</span>
                    </button>
                </div>
                
                <div class="verification-container"></div>
                <h3 class="text-2xl font-bold mb-4 text-yellow-400">Principle: ${story.psychology}</h3>
                <div class="space-y-6">
                    ${sections.map(generateSectionHTML).join('')}
                </div>

                <div class="mt-6 pt-4 border-t border-white/10">
                    <div class="flex flex-wrap gap-2">
                        ${(story.hashtags || []).map(tag => `<span class="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="flex justify-center mt-8">
                     <button class="build-script-btn flex items-center gap-2 bg-green-500 hover:bg-green-600 px-8 py-3 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"><i data-lucide="arrow-down" class="w-5 h-5"></i> Build Script</button>
                </div>
                
                <div class="script-editor-container mt-8 pt-6 border-t border-white/20 hidden"></div>
            </div>`;
    };

    window.selectOption = (element, type, index) => {
        const section = element.closest(`[data-section-type="${type}"]`);
        section.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
        section.querySelector(`input[data-index="${index}"]`).checked = true;

        section.querySelectorAll('.p-3').forEach(div => {
            div.classList.remove('bg-red-500/20', 'border-red-500', 'bg-blue-500/20', 'border-blue-500', 'bg-green-500/20', 'border-green-500', 'bg-purple-500/20', 'border-purple-500');
            div.classList.add('bg-black/20', 'border-transparent');
            div.querySelector('.flex-shrink-0').innerHTML = '';
            div.querySelector('.flex-shrink-0').classList.remove('border-red-400', 'bg-red-500', 'border-blue-400', 'bg-blue-500', 'border-green-400', 'bg-green-500', 'border-purple-400', 'bg-purple-500');
            div.querySelector('.flex-shrink-0').classList.add('border-gray-500');
        });

        const color = element.closest('.p-3').querySelector('i[data-lucide]').className.match(/text-(.*?)-400/)[1] || 'gray';
        element.classList.remove('bg-black/20', 'border-transparent');
        element.classList.add(`bg-${color}-500/20`, `border-${color}-500`);
        const checkDiv = element.querySelector('.flex-shrink-0');
        checkDiv.classList.remove('border-gray-500');
        checkDiv.classList.add(`border-${color}-400`, `bg-${color}-500`);
        checkDiv.innerHTML = '<i data-lucide="check-circle" class="w-3 h-3 text-white"></i>';

        lucide.createIcons();
    };

    const handleBuildScript = () => {
        const story = contentFeed[currentFeedIndex];
        const selections = {};
        document.querySelectorAll('[data-section-type]').forEach(section => {
            const type = section.dataset.sectionType;
            const checkedRadio = section.querySelector('input[type="radio"]:checked');
            selections[type] = checkedRadio ? parseInt(checkedRadio.dataset.index) : 0;
        });

        const scriptText = `**HOOK:**\n${story.hooks[selections.hooks]}\n\n**BUILD-UP:**\n${story.buildUps[selections.buildUps]}\n\n**STORY:**\n${story.stories[selections.stories]}\n\n**PSYCHOLOGY:**\n${story.psychologies[selections.psychologies]}`;
        
        const editorContainer = document.querySelector('.script-editor-container');
        editorContainer.innerHTML = `
            <h4 class="text-xl font-bold text-center mb-4 text-yellow-400 flex items-center justify-center gap-2"><i data-lucide="edit" class="w-5 h-5"></i>AI Script Editor</h4>
            <textarea id="final-script-textarea" class="w-full h-64 p-3 bg-black/20 rounded-md border border-white/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm">${scriptText}</textarea>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" id="ai-rewrite-prompt" placeholder="Enter rewrite instruction..." class="w-full md:col-span-2 p-3 bg-black/20 rounded-md border border-white/20 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm" />
                <button class="generate-audio-btn flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50">
                    <span class="btn-icon"><i data-lucide="play" class="w-5 h-5"></i></span>
                    <span class="btn-text">Generate Audio</span>
                </button>
                <button class="copy-text-btn flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"><i data-lucide="copy" class="w-5 h-5"></i>Copy Text</button>
                <div class="md:col-span-2">
                     <button class="rewrite-ai-btn w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <span class="btn-icon"><i data-lucide="wand-2" class="w-5 h-5"></i></span>
                        <span class="btn-text">Rewrite with AI</span>
                    </button>
                </div>
            </div>
            <div class="audio-player-container mt-4"></div>
        `;
        editorContainer.classList.remove('hidden');
        lucide.createIcons();
    };

    const handleVerifyStory = async () => {
        const story = contentFeed[currentFeedIndex];
        const verifyBtn = document.querySelector('.verify-story-btn');
        toggleButtonLoading(verifyBtn, true);
        const verificationContainer = document.querySelector('.verification-container');
        verificationContainer.innerHTML = `<div class="text-center p-4 my-4 bg-black/20 rounded-lg"><p class="text-yellow-400">Verifying story with AI...</p></div>`;

        try {
            const result = await apiCall('/api/verify-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(story)
            });
            verificationContainer.innerHTML = `
                <div class="my-4 p-4 bg-black/20 rounded-lg">
                    <h4 class="font-bold text-yellow-400 mb-2">Verification Result:</h4>
                    <ul class="space-y-2 text-sm mb-3">
                        ${result.checks.map(check => `
                            <li class="flex items-start gap-2">
                                ${check.is_correct ? '<i data-lucide="check-circle" class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"></i>' : '<i data-lucide="alert-triangle" class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"></i>'}
                                <span><strong>${check.check}:</strong> ${check.comment}</span>
                            </li>
                        `).join('')}
                    </ul>
                    <p class="text-sm font-semibold p-2 rounded ${result.confidence_score > 75 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}">
                        <strong>Conclusion:</strong> ${result.conclusion} (Confidence: ${result.confidence_score}%)
                    </p>
                </div>`;
            lucide.createIcons();
        } catch (error) {
            verificationContainer.innerHTML = `<div class="text-center text-red-400 p-4 my-4 bg-black/20 rounded-lg">${error.message}</div>`;
        } finally {
            toggleButtonLoading(verifyBtn, false);
        }
    };

    const handleAiRewrite = async () => {
        const rewriteBtn = document.querySelector('.rewrite-ai-btn');
        const promptInput = document.getElementById('ai-rewrite-prompt');
        const scriptTextarea = document.getElementById('final-script-textarea');
        if (!promptInput.value.trim()) return;

        toggleButtonLoading(rewriteBtn, true);
        try {
            const result = await apiCall('/api/rewrite-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    finalScript: scriptTextarea.value,
                    aiPrompt: promptInput.value
                })
            });
            scriptTextarea.value = result.newScript;
            promptInput.value = '';
        } catch(error) {
            scriptTextarea.value += `\n\n[AI rewrite failed: ${error.message}]`;
        } finally {
            toggleButtonLoading(rewriteBtn, false);
        }
    };
    
    const handleCopyScript = () => {
        const scriptTextarea = document.getElementById('final-script-textarea');
        const body = scriptTextarea.value.split('\n\n').map(part => (part.split(/:\n/)[1] || part).replace(/\*\*/g, '')).join('\n\n');
        navigator.clipboard.writeText(body).then(() => {
            alert('Script text copied to clipboard!');
        }).catch(err => console.error('Copy failed', err));
    };

    const handleGenerateAudio = async () => {
        const audioBtn = document.querySelector('.generate-audio-btn');
        const scriptTextarea = document.getElementById('final-script-textarea');
        const audioPlayerContainer = document.querySelector('.audio-player-container');
        
        // This is a placeholder check. A real app would have a more robust way to handle API keys.
        const ELEVENLABS_API_KEY = prompt("Please enter your ElevenLabs API Key:", "YOUR_ELEVENLABS_API_KEY_HERE");
        if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY === "YOUR_ELEVENLABS_API_KEY_HERE") {
            alert("An ElevenLabs API key is required for audio generation.");
            return;
        }

        toggleButtonLoading(audioBtn, true);
        audioPlayerContainer.innerHTML = '';
        const scriptText = scriptTextarea.value.split('\n\n').map(part => part.split(/:\n/)[1] || part).join(' ');
        const VOICE_ID = 'JE0bYmphWP8pWQIcVNZr';
        const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY
                },
                body: JSON.stringify({
                    text: scriptText,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                })
            });

            if (!response.ok) throw new Error(`ElevenLabs API responded with status: ${response.status}`);
            const audioBlob = await response.blob();
            const url = URL.createObjectURL(audioBlob);
            audioPlayerContainer.innerHTML = `<audio controls src="${url}" class="w-full">Your browser does not support the audio element.</audio>`;
        } catch (error) {
            audioPlayerContainer.innerHTML = `<p class="text-red-400">Failed to generate audio: ${error.message}</p>`;
        } finally {
            toggleButtonLoading(audioBtn, false);
        }
    };


    // --- BREAKDOWN TAB LOGIC ---
    const findCompanies = async () => {
        const btn = document.getElementById('find-companies-btn');
        const loader = document.getElementById('companies-loader');
        const errorDiv = document.getElementById('companies-error');
        const container = document.getElementById('companies-container');
        const scriptContainer = document.getElementById('script-container');

        toggleButtonLoading(btn, true);
        loader.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        container.innerHTML = '';
        scriptContainer.classList.add('hidden');

        try {
            const companies = await apiCall('/api/find-companies');
            container.innerHTML = companies.map(company => `
                <button data-company="${company}" class="company-select-btn p-3 font-semibold rounded-lg transition-all text-center bg-white/10 hover:bg-white/20">${company}</button>
            `).join('');
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        } finally {
            toggleButtonLoading(btn, false);
            loader.classList.add('hidden');
        }
    };

    const handleCompanySelection = async (e) => {
        const companyBtn = e.target.closest('.company-select-btn');
        if (!companyBtn) return;
        
        const companyName = companyBtn.dataset.company;
        const scriptLoader = document.getElementById('script-loader');
        const scriptContainer = document.getElementById('script-container');

        document.querySelectorAll('.company-select-btn').forEach(btn => btn.classList.remove('bg-yellow-500', 'text-black', 'scale-105'));
        companyBtn.classList.add('bg-yellow-500', 'text-black', 'scale-105');

        scriptLoader.querySelector('p').textContent = `Analyzing ${companyName}...`;
        scriptLoader.classList.remove('hidden');
        scriptContainer.classList.add('hidden');

        try {
            const script = await apiCall('/api/tactic-breakdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName })
            });

            scriptContainer.innerHTML = `
                <div class="flex justify-between items-start">
                     <h3 class="text-3xl font-bold text-yellow-400">${script.company}</h3>
                     <button class="verify-breakdown-btn flex items-center gap-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 px-3 py-1 rounded-full font-semibold transition-colors disabled:opacity-50">
                        <span class="btn-icon"><i data-lucide="shield" class="w-4 h-4"></i></span>
                        <span class="btn-text">Verify Tactics</span>
                     </button>
                </div>
                <div class="breakdown-verification-container"></div>
                <p class="text-lg italic text-gray-300">"${script.hook}"</p>
                <p class="text-gray-400">${script.buildUp}</p>
                <div class="space-y-4">
                    ${script.storyBreakdown?.map(tactic => `
                        <div class="border-l-4 border-green-500 pl-4 py-2">
                            <span class="text-sm font-semibold bg-green-500/20 text-green-300 px-2 py-1 rounded-full">${tactic.pillar}</span>
                            <h4 class="text-xl font-semibold mt-2 text-green-400">${tactic.tacticName}</h4>
                            <p class="text-gray-300">${tactic.explanation}</p>
                        </div>
                    `).join('')}
                </div>
                <p class="text-lg italic text-gray-300 pt-4 border-t border-white/10">"${script.concludingPsychology}"</p>
            `;
            scriptContainer.classList.remove('hidden');
            lucide.createIcons();

            scriptContainer.querySelector('.verify-breakdown-btn').addEventListener('click', async (e) => {
                 const verifyBtn = e.currentTarget;
                 toggleButtonLoading(verifyBtn, true);
                 const vContainer = scriptContainer.querySelector('.breakdown-verification-container');
                 vContainer.innerHTML = `<div class="text-center p-4 my-2 bg-black/20 rounded-lg"><p class="text-yellow-400">Verifying tactics...</p></div>`;
                 
                 const claims = script.storyBreakdown.map(t => `- ${t.tacticName}: ${t.explanation}`).join('\n');
                 const prompt = `Please act as a fact-checker. Verify the claims made in the following script about ${script.company}. For each tactic listed, confirm if it is a known strategy used by the company and if the explanation is accurate. Return as a JSON object with the structure: {"checks": [{"check": "string", "is_correct": boolean, "comment": "string"}], "conclusion": "string", "confidence_score": number_between_0_and_100}`;

                 try {
                     const verificationResult = await apiCall('/api/verify-story', { // Can reuse this endpoint
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ company: script.company, solution: 'Multiple Tactics', psychology: 'Various', findings: claims, sources: ['General Knowledge']})
                     });
                     vContainer.innerHTML = `
                        <div class="my-4 p-4 bg-black/20 rounded-lg border border-white/10">
                            <h4 class="font-bold text-yellow-400 mb-2">Verification Result:</h4>
                            <ul class="space-y-2 text-sm mb-3">${verificationResult.checks.map(c => `...`).join('')}</ul>
                            <p>...</p>
                        </div>
                     `;
                    lucide.createIcons();
                 } catch (error) {
                     vContainer.innerHTML = `<div class="text-red-400 text-center">${error.message}</div>`;
                 } finally {
                     toggleButtonLoading(verifyBtn, false);
                 }
            });

        } catch (error) {
            scriptContainer.innerHTML = `<p class="text-red-400 text-center">${error.message}</p>`;
            scriptContainer.classList.remove('hidden');
        } finally {
            scriptLoader.classList.add('hidden');
        }
    };
    
    // --- SHEET TAB LOGIC ---
    const analyzeSheet = async () => {
        const btn = document.getElementById('analyze-sheet-btn');
        const errorDiv = document.getElementById('sheet-error');
        const pastedData = document.getElementById('pasted-data').value;
        const sheetUrl = document.getElementById('sheet-url').value;

        if (!pastedData.trim() && !sheetUrl.trim()) {
            errorDiv.textContent = 'Please paste data or enter a Google Sheets URL.';
            errorDiv.classList.remove('hidden');
            return;
        }

        toggleButtonLoading(btn, true);
        errorDiv.classList.add('hidden');

        try {
            const results = await apiCall('/api/analyze-sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pastedData, sheetUrl })
            });
            contentFeed = results;
            currentFeedIndex = 0;
            renderCurrentReel();
            handleTabClick('reels'); // Switch to reels tab to show results
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        } finally {
            toggleButtonLoading(btn, false);
        }
    };
    
    // --- NEWS TAB LOGIC ---
    const scanForNews = async () => {
        const btn = document.getElementById('scan-news-btn');
        const loader = document.getElementById('news-loader');
        const errorDiv = document.getElementById('news-error');
        const container = document.getElementById('news-articles-container');

        toggleButtonLoading(btn, true);
        loader.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        container.innerHTML = '';
        
        try {
            const articles = await apiCall('/api/scan-news');
            if (articles.length === 0) {
                container.innerHTML = '<p class="text-gray-400 text-center">No relevant news found at the moment.</p>';
            } else {
                container.innerHTML = articles.map(article => {
                    const getHotScoreColor = (score) => {
                        if (score > 85) return 'text-red-500';
                        if (score > 70) return 'text-orange-500';
                        if (score > 50) return 'text-yellow-500';
                        return 'text-blue-500';
                    };

                    return `
                    <div class="bg-black/20 p-4 rounded-lg text-left transition-all hover:bg-black/30" data-article='${JSON.stringify(article)}'>
                        <h3 class="font-bold text-lg text-blue-300">${article.title}</h3>
                        <p class="text-sm text-gray-400 my-3">${article.summary}</p>
                        <div class="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-white/10">
                            <div class='flex flex-wrap gap-2 items-center'>
                                <button class="create-story-btn flex items-center gap-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-3 py-1 rounded-full font-semibold">
                                    <i data-lucide="wand-2" class="w-4 h-4"></i> Create Story
                                </button>
                                <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400"><i data-lucide="link" class="w-3 h-3"></i>Source</a>
                            </div>
                            <div class="flex items-center gap-2 text-sm font-bold" title="Hot Score: ${article.hot_score}">
                                <i data-lucide="flame" class="w-5 h-5 ${getHotScoreColor(article.hot_score)}"></i>
                                <span class="${getHotScoreColor(article.hot_score)}">${article.hot_score}</span>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
                lucide.createIcons();
            }
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        } finally {
            toggleButtonLoading(btn, false);
            loader.classList.add('hidden');
        }
    };

    const handleCreateStoryFromNews = async (e) => {
        const createBtn = e.target.closest('.create-story-btn');
        if (!createBtn) return;
        
        const articleDiv = createBtn.closest('[data-article]');
        const article = JSON.parse(articleDiv.dataset.article);
        
        toggleButtonLoading(document.getElementById('scan-news-btn'), true);

        try {
            const newStory = await apiCall('/api/create-story-from-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article })
            });
            contentFeed = [newStory];
            currentFeedIndex = 0;
            renderCurrentReel();
            handleTabClick('reels');
        } catch (error) {
            alert(`Failed to create story: ${error.message}`);
        } finally {
            toggleButtonLoading(document.getElementById('scan-news-btn'), false);
        }
    };


    // --- START THE APP ---
    init();
});
