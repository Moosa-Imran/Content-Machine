// public/js/reels.js
// Handles all client-side interactions for the reels.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let contentFeed = [];
    let currentFeedIndex = 0;
    let totalCases = 0;
    
    // --- ELEMENT SELECTORS ---
    const reelCardContainer = document.getElementById('reel-card-container');
    const paginationContainer = document.getElementById('pagination-container');
    const findNewScriptsBtn = document.getElementById('find-new-scripts-btn');
    const createFromModal = document.getElementById('create-from-modal');
    const closeCreateModalBtn = document.getElementById('close-create-modal-btn');
    const createFromNewsBtn = document.getElementById('create-from-news-btn');
    const frameworkUpdateLoader = document.getElementById('framework-update-loader');

    // Notification Modal Elements
    const notificationModal = document.getElementById('notification-modal');
    const notificationIconContainer = document.getElementById('notification-icon-container');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationOkBtn = document.getElementById('notification-ok-btn');

    // --- API & UI HELPERS ---
    const showNotification = (title, message, type = 'success') => {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;

        if (type === 'error') {
            notificationIconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-500/20';
            notificationIconContainer.innerHTML = '<i data-lucide="alert-triangle" class="h-6 w-6 text-red-600 dark:text-red-400"></i>';
        } else if (type === 'modelBusy') {
            notificationIconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-500/20';
            notificationIconContainer.innerHTML = '<i data-lucide="bot" class="h-6 w-6 text-yellow-600 dark:text-yellow-400"></i>';
        } else { // success
            notificationIconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-500/20';
            notificationIconContainer.innerHTML = '<i data-lucide="check-circle" class="h-6 w-6 text-green-600 dark:text-green-400"></i>';
        }
        
        notificationModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                if (response.status === 529 || response.status === 429) {
                    throw new Error('MODEL_BUSY');
                }
                const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
                throw new Error(errorData.error);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    };

    // --- INITIALIZATION ---
    const init = async () => {
        attachEventListeners();
        
        const generatedContent = sessionStorage.getItem('generatedContent');
        if (generatedContent) {
            contentFeed = JSON.parse(generatedContent);
            sessionStorage.removeItem('generatedContent');
            currentFeedIndex = 0;
            totalCases = contentFeed.length;
            renderCurrentReel();
        } else {
            await fetchInitialScript();
        }
    };

    const showLoader = () => {
        const loaderHTML = `
            <div class="max-w-4xl mx-auto">
                <div class="bg-white dark:bg-slate-900/50 rounded-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 text-center">
                     <i data-lucide="brain-circuit" class="w-16 h-16 text-primary-500 mx-auto animate-bounce"></i>
                     <h2 class="text-2xl font-bold text-slate-800 dark:text-white mt-4">Fetching a New Viral Idea...</h2>
                     <p class="mt-2 text-slate-500 dark:text-slate-400 h-6">Please wait a moment.</p>
                </div>
            </div>`;
        reelCardContainer.innerHTML = loaderHTML;
        lucide.createIcons();
    };

    const fetchInitialScript = async () => {
        const loadingTextElement = document.getElementById('loading-text-animation');
        const loadingPhrases = [
            "Building compelling hooks...",
            "Crafting irresistible stories...",
            "Analyzing psychological triggers...",
            "Assembling the perfect build-up...",
            "Polishing the final script..."
        ];
        let phraseIndex = 0;
        let loadingInterval;

        if (loadingTextElement) {
            loadingInterval = setInterval(() => {
                loadingTextElement.textContent = loadingPhrases[phraseIndex % loadingPhrases.length];
                phraseIndex++;
            }, 1500);
        }

        try {
            const [countData, firstScript] = await Promise.all([
                apiCall('/api/business-cases/count'),
                apiCall('/api/new-script')
            ]);
            totalCases = countData.total;
            contentFeed = [firstScript];
            currentFeedIndex = 0;

            if (contentFeed.length > 0) {
                renderCurrentReel();
            } else {
                reelCardContainer.innerHTML = `<div class="text-center text-slate-500 dark:text-slate-400 p-8 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">No scripts found. Try finding new ones.</div>`;
            }
        } catch (error) {
            reelCardContainer.innerHTML = `<div class="text-center text-red-500 p-8 bg-red-500/10 rounded-xl border border-red-500/20">Failed to load scripts. Please try again later.</div>`;
            if (error.message === 'MODEL_BUSY') {
                showNotification('Oops! Model Is Busy', 'This is not your fault. The AI is currently overloaded. Please try again in a few seconds.', 'modelBusy');
            } else {
                showNotification('Error', error.message, 'error');
            }
        } finally {
            if (loadingInterval) {
                clearInterval(loadingInterval);
            }
        }
    };
    
    // --- EVENT LISTENERS ---
    const attachEventListeners = () => {
        findNewScriptsBtn?.addEventListener('click', () => createFromModal.classList.remove('hidden'));
        reelCardContainer.addEventListener('click', handleCardClick);
        paginationContainer.addEventListener('click', handlePaginationClick);
        closeCreateModalBtn?.addEventListener('click', () => createFromModal.classList.add('hidden'));
        createFromNewsBtn?.addEventListener('click', () => {
            window.location.href = '/news';
        });
        notificationOkBtn?.addEventListener('click', () => notificationModal.classList.add('hidden'));
    };
    
    const handleCardClick = (e) => {
        const buildBtn = e.target.closest('.build-script-btn');
        const verifyBtn = e.target.closest('.verify-story-btn');
        const rewriteBtn = e.target.closest('.rewrite-ai-btn');
        const copyBtn = e.target.closest('.copy-text-btn');
        const audioBtn = e.target.closest('.generate-audio-btn');
        const regenerateBtn = e.target.closest('.regenerate-section-btn');
        const saveStoryBtn = e.target.closest('.save-story-btn');

        if (buildBtn) handleBuildScript();
        if (verifyBtn) handleVerifyStory(verifyBtn);
        if (rewriteBtn) handleAiRewrite(rewriteBtn);
        if (copyBtn) handleCopyScript();
        if (audioBtn) handleGenerateAudio(audioBtn);
        if (regenerateBtn) handleRegenerateSection(regenerateBtn);
        if (saveStoryBtn) handleSaveStory(saveStoryBtn);
    };

    const handlePaginationClick = async (e) => {
        const prevBtn = e.target.closest('#prev-btn');
        const nextBtn = e.target.closest('#next-btn');

        if (prevBtn) {
            if (currentFeedIndex > 0) {
                currentFeedIndex--;
                renderCurrentReel();
            }
        }

        if (nextBtn) {
            if (currentFeedIndex < contentFeed.length - 1) {
                currentFeedIndex++;
                renderCurrentReel();
            } else {
                showLoader();
                try {
                    const newScript = await apiCall('/api/new-script');
                    contentFeed.push(newScript);
                    currentFeedIndex++;
                    renderCurrentReel();
                } catch (error) {
                    renderCurrentReel();
                    if (error.message === 'MODEL_BUSY') {
                        showNotification('Oops! Model Is Busy', 'Could not load the next script. Please try again.', 'modelBusy');
                    } else {
                        showNotification('Error', 'Could not load the next script. Please try again.', 'error');
                    }
                }
            }
        }
    };

    const handleRegenerateSection = async (button) => {
        const sectionType = button.dataset.sectionType;
        const businessCase = contentFeed[currentFeedIndex];
        const icon = button.firstElementChild;
        
        if (!icon) return;

        icon.classList.add('animate-spin');
        button.disabled = true;

        try {
            const { newOptions } = await apiCall('/api/regenerate-section', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessCase, sectionType })
            });

            contentFeed[currentFeedIndex][sectionType] = newOptions;

            const sectionBlock = button.closest('.section-block');
            const optionsContainer = sectionBlock.querySelector(`div[data-section-type="${sectionType}"]`);

            if (optionsContainer) {
                optionsContainer.innerHTML = newOptions.map((option, index) => `
                    <div class="p-3 rounded-md border cursor-pointer transition-all" onclick="selectOption(this, '${sectionType}')">
                        <label class="flex items-start text-sm cursor-pointer">
                            <input type="radio" name="${businessCase.id}-${sectionType}" data-index="${index}" ${index === 0 ? 'checked' : ''} class="sr-only" />
                            <div class="check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all"></div>
                            <span class="flex-grow text-slate-600 dark:text-slate-300">${option.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-primary-600 dark:text-primary-400">$1</strong>')}</span>
                        </label>
                    </div>
                `).join('');
                
                selectOption(optionsContainer.querySelector('.p-3'), sectionType);
            }
        } catch (error) {
            if (error.message === 'MODEL_BUSY') {
                showNotification('Oops! Model Is Busy', 'Could not regenerate options. Please try again.', 'modelBusy');
            } else {
                showNotification('Error', 'Could not regenerate options. Please try again.', 'error');
            }
        } finally {
            icon.classList.remove('animate-spin');
            button.disabled = false;
        }
    };
    
    const toggleButtonLoading = (button, isLoading, loadingText = 'Loading...') => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;

        if (isLoading) {
            if (icon) icon.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>';
            if (text) text.textContent = loadingText;
        } else {
            if (icon) icon.innerHTML = `<i data-lucide="${button.dataset.icon || 'search'}" class="w-4 h-4"></i>`;
            if (text) text.textContent = button.dataset.originalText || 'Submit';
        }
        lucide.createIcons();
    };
    
    const renderCurrentReel = () => {
        if (!contentFeed || contentFeed.length === 0) {
            reelCardContainer.innerHTML = `<div class="text-center text-slate-500 dark:text-slate-400 p-8 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">No scripts found.</div>`;
            return;
        }
        const story = contentFeed[currentFeedIndex];
        reelCardContainer.innerHTML = generateReelCardHTML(story);
        updatePagination();
        document.querySelectorAll('[data-section-type]').forEach(section => {
            const firstOption = section.querySelector('.p-3');
            if (firstOption) {
                selectOption(firstOption, section.dataset.sectionType);
            }
        });
        lucide.createIcons();
    };
    
    const updatePagination = () => {
        if (totalCases === 0) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        if (totalCases === 1) {
             paginationContainer.innerHTML = `
                <div class="flex items-center justify-center">
                     <span class="text-sm font-medium text-slate-500 dark:text-slate-400">Showing 1 script generated from news</span>
                </div>
            `;
             return;
        }

        paginationContainer.innerHTML = `
            <div class="flex items-center justify-between">
                <button id="prev-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                <span class="text-sm font-medium text-slate-500 dark:text-slate-400">Script <span class="text-primary-600 dark:text-primary-400 font-bold">${currentFeedIndex + 1}</span> of ${totalCases}</span>
                <button id="next-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"><i data-lucide="arrow-right" class="w-5 h-5"></i></button>
            </div>`;
        
        const prevBtn = paginationContainer.querySelector('#prev-btn');
        if (prevBtn) {
            prevBtn.disabled = currentFeedIndex === 0;
        }
        lucide.createIcons();
    };

    const generateReelCardHTML = (story) => {
        const sections = [
            { type: 'hooks', title: 'Hook (0-8s)', icon: 'anchor', color: 'red' },
            { type: 'buildUps', title: 'Build-Up (8-20s)', icon: 'trending-up', color: 'blue' },
            { type: 'stories', title: 'Story (20-45s)', icon: 'book-open', color: 'green' },
            { type: 'psychologies', title: 'Psychology (45-60s)', icon: 'brain-circuit', color: 'purple' }
        ];

        const generateSectionHTML = (sec) => {
            if (!sec || !sec.type) {
                console.error("generateSectionHTML was called with an invalid section:", sec);
                return ''; 
            }
            const options = story[sec.type] || [];
            return `
                <div class="section-block rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div class="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800" data-color="${sec.color}">
                        <div class="flex items-center gap-2.5">
                            <i data-lucide="${sec.icon}" class="w-5 h-5 text-${sec.color}-500 dark:text-${sec.color}-400"></i>
                            <span class="font-semibold text-sm text-slate-700 dark:text-slate-200">${sec.title}</span>
                        </div>
                        <button class="regenerate-section-btn p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" data-section-type="${sec.type}" title="Regenerate">
                           <i data-lucide="refresh-cw" class="w-4 h-4 text-slate-500"></i>
                        </button>
                    </div>
                    <div class="p-3 space-y-2" data-section-type="${sec.type}">
                        ${options.map((option, index) => `
                            <div class="p-3 rounded-md border cursor-pointer transition-all" onclick="selectOption(this, '${sec.type}')">
                                <label class="flex items-start text-sm cursor-pointer">
                                    <input type="radio" name="${story.id}-${sec.type}" data-index="${index}" ${index === 0 ? 'checked' : ''} class="sr-only" />
                                    <div class="check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all"></div>
                                    <span class="flex-grow text-slate-600 dark:text-slate-300">${(option || '').replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-primary-600 dark:text-primary-400">$1</strong>')}</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        };

        return `
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 card-glow max-w-4xl mx-auto" data-story-id="${story.id}">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h3 class="text-2xl font-bold text-slate-800 dark:text-white">Principle: <span class="text-primary-600 dark:text-primary-400">${story.psychology}</span></h3>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.company}</span>
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.industry}</span>
                        </div>
                    </div>
                    <button class="verify-story-btn flex-shrink-0 flex items-center gap-1.5 text-xs bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 px-3 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="shield-check" data-original-text="Verify Story">
                        <span class="btn-icon"><i data-lucide="shield-check" class="w-4 h-4"></i></span>
                        <span class="btn-text">Verify Story</span>
                    </button>
                </div>
                <div class="verification-container mb-4"></div>
                <div class="space-y-4">${sections.map(generateSectionHTML).join('')}</div>
                <div class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <div class="flex flex-wrap gap-2">
                        ${(story.hashtags || []).map(tag => `<span class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="flex justify-center mt-8">
                    <button class="build-script-btn flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"><i data-lucide="file-text" class="w-5 h-5"></i> Build Script</button>
                </div>
                <div class="script-editor-container mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 hidden"></div>
            </div>`;
    };

    window.selectOption = (element, type) => {
        const sectionContainer = element.closest(`[data-section-type="${type}"]`);
        const color = element.closest('.section-block').querySelector('[data-color]').dataset.color;

        sectionContainer.querySelectorAll('.p-3').forEach(div => {
            div.className = 'p-3 rounded-md border cursor-pointer transition-all border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500';
            const iconContainer = div.querySelector('.check-icon-container');
            iconContainer.innerHTML = '';
            iconContainer.className = 'check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all border-slate-400 dark:border-slate-500';
        });
        
        const radioInput = element.querySelector('input[type="radio"]');
        radioInput.checked = true;

        element.className = `p-3 rounded-md border-2 cursor-pointer transition-all border-${color}-500 dark:border-${color}-400 bg-${color}-500/10`;
        const checkDiv = element.querySelector('.check-icon-container');
        checkDiv.className = `check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all border-${color}-400 bg-${color}-500`;
        checkDiv.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-white"></i>';
        
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
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800">
                <h4 class="text-xl font-bold text-center mb-4 text-slate-800 dark:text-white flex items-center justify-center gap-2"><i data-lucide="edit" class="w-5 h-5 text-primary-500"></i>Script Editor</h4>
                <textarea id="final-script-textarea" class="w-full h-64 p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm">${scriptText}</textarea>
                <div class="mt-4 space-y-4">
                    <input type="text" id="ai-rewrite-prompt" placeholder="Optional: Enter a rewrite instruction (e.g., 'make it funnier')" class="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm" />
                    
                    <div class="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg mt-2">
                        <label for="update-framework-toggle" class="flex items-center justify-between cursor-pointer">
                            <span class="flex flex-col">
                                <span class="font-semibold text-slate-700 dark:text-slate-200">Evolve AI's Style</span>
                                <span class="text-xs text-slate-500 dark:text-slate-400">Update the script framework based on this rewrite instruction.</span>
                            </span>
                            <div class="relative">
                                <input type="checkbox" id="update-framework-toggle" class="sr-only peer">
                                <div class="block bg-slate-200 dark:bg-slate-700 w-14 h-8 rounded-full peer-checked:bg-purple-600"></div>
                                <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
                            </div>
                        </label>
                    </div>

                    <button class="rewrite-ai-btn w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="wand-2" data-original-text="Rewrite with AI">
                        <span class="btn-icon"><i data-lucide="wand-2" class="w-5 h-5"></i></span>
                        <span class="btn-text">Rewrite with AI</span>
                    </button>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button class="generate-audio-btn flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="music-4" data-original-text="Generate Audio">
                            <span class="btn-icon"><i data-lucide="music-4" class="w-5 h-5"></i></span>
                            <span class="btn-text">Generate Audio</span>
                        </button>
                        <button class="copy-text-btn flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"><i data-lucide="copy" class="w-5 h-5"></i>Copy Text</button>
                    </div>
                </div>
                <div class="audio-player-container mt-4"></div>
                <div class="save-story-container mt-4"></div>
            </div>`;
        editorContainer.classList.remove('hidden');
        lucide.createIcons();
    };

    const handleAiRewrite = async (rewriteBtn) => {
        const aiPromptInput = document.getElementById('ai-rewrite-prompt');
        const finalScriptTextarea = document.getElementById('final-script-textarea');
        const updateFrameworkToggle = document.getElementById('update-framework-toggle');
        
        if (!aiPromptInput || !finalScriptTextarea) return;

        const aiPrompt = aiPromptInput.value;
        const finalScript = finalScriptTextarea.value;

        if (!aiPrompt) {
            showNotification('Input Required', 'Please enter a rewrite instruction.', 'error');
            return;
        }

        toggleButtonLoading(rewriteBtn, true, 'Rewriting...');
        try {
            const result = await apiCall('/api/rewrite-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalScript, aiPrompt })
            });
            if (result && result.newScript) {
                finalScriptTextarea.value = result.newScript;
                showNotification('Success', 'Script rewritten successfully!');

                if (updateFrameworkToggle.checked) {
                    await updateFrameworkFromPrompt(aiPrompt);
                }
            } else {
                throw new Error('AI did not return a new script.');
            }
        } catch (error) {
            if (error.message === 'MODEL_BUSY') {
                showNotification('Oops! Model Is Busy', 'Failed to rewrite script. Please try again.', 'modelBusy');
            } else {
                showNotification('Error', `Failed to rewrite script: ${error.message}`, 'error');
            }
        } finally {
            toggleButtonLoading(rewriteBtn, false);
        }
    };

    const updateFrameworkFromPrompt = async (aiPrompt) => {
        frameworkUpdateLoader.classList.remove('hidden');
        try {
            await apiCall('/api/update-framework-from-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiPrompt })
            });
            showNotification('Framework Updated', 'The AI has learned your new style for future scripts.');
        } catch (error) {
             if (error.message === 'MODEL_BUSY') {
                showNotification('Oops! Model Is Busy', 'Failed to update framework. Please try again.', 'modelBusy');
            } else {
                showNotification('Error', `Failed to update framework: ${error.message}`, 'error');
            }
        } finally {
            frameworkUpdateLoader.classList.add('hidden');
        }
    };

    const handleVerifyStory = async (verifyBtn) => {
        const story = contentFeed[currentFeedIndex];
        toggleButtonLoading(verifyBtn, true, 'Verifying...');
        const verificationContainer = document.querySelector('.verification-container');
        verificationContainer.innerHTML = `<div class="text-center p-4 my-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg"><p class="text-slate-600 dark:text-slate-300">Verifying story with AI...</p></div>`;

        try {
            const result = await apiCall('/api/verify-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(story)
            });
            verificationContainer.innerHTML = `
                <div class="my-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-bold text-slate-700 dark:text-white">Verification Result:</h4>
                        ${story.source_url ? `<a href="${story.source_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md font-semibold transition-colors"><i data-lucide="link-2" class="w-4 h-4"></i>View Source</a>` : ''}
                    </div>
                    <ul class="space-y-2 text-sm mb-3">
                        ${result.checks.map(check => `
                            <li class="flex items-start gap-2">
                                ${check.is_correct ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"></i>' : '<i data-lucide="alert-triangle" class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"></i>'}
                                <span class="text-slate-600 dark:text-slate-300"><strong>${check.check}:</strong> ${check.comment}</span>
                            </li>`).join('')}
                    </ul>
                    <p class="text-sm font-semibold p-2 rounded ${result.confidence_score > 75 ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}">
                        <strong>Conclusion:</strong> ${result.conclusion} (Confidence: ${result.confidence_score}%)
                    </p>
                </div>`;
            lucide.createIcons();
        } catch (error) {
            verificationContainer.innerHTML = `<div class="text-center text-red-500 p-4 my-2 bg-red-500/10 rounded-lg border border-red-500/30">${error.message}</div>`;
        } finally {
            toggleButtonLoading(verifyBtn, false);
        }
    };
    
    const handleCopyScript = () => {
        const scriptTextarea = document.getElementById('final-script-textarea');
        const body = scriptTextarea.value.split('\n\n').map(part => (part.split(/:\n/)[1] || part).replace(/\*\*/g, '')).join('\n\n');
        navigator.clipboard.writeText(body).then(() => {
            showNotification('Copied!', 'Script text copied to clipboard.');
        }).catch(err => console.error('Copy failed', err));
    };

    const handleGenerateAudio = async (audioBtn) => {
        const scriptTextarea = document.getElementById('final-script-textarea');
        const audioPlayerContainer = document.querySelector('.audio-player-container');
        const saveStoryContainer = document.querySelector('.save-story-container');
        
        toggleButtonLoading(audioBtn, true, 'Generating...');
        audioPlayerContainer.innerHTML = '';
        saveStoryContainer.innerHTML = '';
        const scriptText = scriptTextarea.value.split('\n\n').map(part => (part.split(/:\n/)[1] || part)).join(' ');

        try {
            const result = await apiCall('/api/generate-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptText })
            });

            if (result.success && result.audioUrl) {
                audioPlayerContainer.innerHTML = `
                    <div class="custom-audio-player bg-slate-100 dark:bg-slate-800 p-3 rounded-lg flex items-center gap-4">
                        <button id="play-pause-btn" class="p-2 rounded-full bg-pink-500 text-white hover:bg-pink-600 transition">
                            <i data-lucide="play" class="w-5 h-5"></i>
                        </button>
                        <div class="flex-grow flex items-center gap-2">
                            <span id="current-time" class="text-xs font-mono text-slate-500 dark:text-slate-400">0:00</span>
                            <div id="progress-bar-container" class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 cursor-pointer">
                                <div id="progress-bar" class="bg-pink-500 h-2 rounded-full" style="width: 0%;"></div>
                            </div>
                            <span id="total-duration" class="text-xs font-mono text-slate-500 dark:text-slate-400">0:00</span>
                        </div>
                    </div>
                `;
                
                saveStoryContainer.innerHTML = `
                    <button class="save-story-btn w-full mt-4 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors" data-audio-url="${result.audioUrl}" data-icon="save" data-original-text="Save Story">
                         <span class="btn-icon"><i data-lucide="save" class="w-5 h-5"></i></span>
                         <span class="btn-text">Save Story</span>
                    </button>
                `;

                lucide.createIcons();

                const audio = new Audio(result.audioUrl);
                const playPauseBtn = document.getElementById('play-pause-btn');
                const playIcon = '<i data-lucide="play" class="w-5 h-5"></i>';
                const pauseIcon = '<i data-lucide="pause" class="w-5 h-5"></i>';
                const progressBar = document.getElementById('progress-bar');
                const progressBarContainer = document.getElementById('progress-bar-container');
                const currentTimeEl = document.getElementById('current-time');
                const totalDurationEl = document.getElementById('total-duration');

                const formatTime = (time) => {
                    if (!isFinite(time) || isNaN(time)) {
                        return '0:00';
                    }
                    const minutes = Math.floor(time / 60);
                    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
                    return `${minutes}:${seconds}`;
                };

                audio.addEventListener('loadedmetadata', () => {
                    totalDurationEl.textContent = formatTime(audio.duration);
                });

                audio.addEventListener('timeupdate', () => {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    progressBar.style.width = `${progress}%`;
                    currentTimeEl.textContent = formatTime(audio.currentTime);
                });

                audio.addEventListener('play', () => {
                    playPauseBtn.innerHTML = pauseIcon;
                    lucide.createIcons();
                });

                audio.addEventListener('pause', () => {
                    playPauseBtn.innerHTML = playIcon;
                    lucide.createIcons();
                });
                
                audio.addEventListener('ended', () => {
                    playPauseBtn.innerHTML = playIcon;
                    progressBar.style.width = '0%';
                    audio.currentTime = 0;
                    lucide.createIcons();
                });

                playPauseBtn.addEventListener('click', () => {
                    if (audio.paused) {
                        audio.play();
                    } else {
                        audio.pause();
                    }
                });

                progressBarContainer.addEventListener('click', (e) => {
                    const rect = progressBarContainer.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const width = progressBarContainer.clientWidth;
                    const duration = audio.duration;
                    if (isFinite(duration)) {
                        audio.currentTime = (clickX / width) * duration;
                    }
                });

            } else {
                throw new Error('Audio URL not received.');
            }
        } catch (error) {
            audioPlayerContainer.innerHTML = `<p class="text-red-500 dark:text-red-400">Failed to generate audio: ${error.message}</p>`;
        } finally {
            toggleButtonLoading(audioBtn, false);
        }
    };

    const handleSaveStory = async (saveBtn) => {
        const story = contentFeed[currentFeedIndex];
        const scriptTextarea = document.getElementById('final-script-textarea');
        const transcript = scriptTextarea.value;
        const audioUrl = saveBtn.dataset.audioUrl;

        const storyData = {
            title: story.psychology,
            transcript: transcript,
            audioUrl: audioUrl,
            hashtags: story.hashtags
        };

        toggleButtonLoading(saveBtn, true, 'Saving...');

        try {
            await apiCall('/api/save-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(storyData)
            });
            showNotification('Success!', 'Story has been saved successfully.');
        } catch (error) {
            if (error.message === 'MODEL_BUSY') {
                showNotification('Oops! Model Is Busy', 'Failed to save story. Please try again.', 'modelBusy');
            } else {
                showNotification('Error', `Failed to save story: ${error.message}`, 'error');
            }
        } finally {
            toggleButtonLoading(saveBtn, false);
        }
    };

    // --- START THE APP ---
    init();
});
