// public/js/reels.js
// Handles all client-side interactions for the reels.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let contentFeed = [];
    let currentFeedIndex = 0;
    let totalCases = 0;
    let selectedFrameworkId = null;
    let allFrameworks = [];
    
    // --- ELEMENT SELECTORS ---
    const reelCardContainer = document.getElementById('reel-card-container');
    const paginationContainer = document.getElementById('pagination-container');
    const findNewScriptsBtn = document.getElementById('find-new-scripts-btn');
    const createFromModal = document.getElementById('create-from-modal');
    const closeCreateModalBtn = document.getElementById('close-create-modal-btn');
    const createFromNewsBtn = document.getElementById('create-from-news-btn');
    const frameworkUpdateLoader = document.getElementById('framework-update-loader');
    
    // Confirmation Modal Elements
    const confirmModal = document.getElementById('confirm-modal');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmModalMessage = document.getElementById('confirm-modal-message');
    let confirmCallback = null;

    // Notification Modal Elements
    const notificationModal = document.getElementById('notification-modal');
    const notificationIconContainer = document.getElementById('notification-icon-container');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationOkBtn = document.getElementById('notification-ok-btn');

    // --- COLOR MAPPING for Tailwind CSS ---
    const colorMap = {
        red:    { icon: 'text-red-500 dark:text-red-400',       bg: 'bg-red-500/10',    border: 'border-red-500 dark:border-red-400',       checkBg: 'bg-red-500',    checkBorder: 'border-red-400' },
        blue:   { icon: 'text-blue-500 dark:text-blue-400',      bg: 'bg-blue-500/10',   border: 'border-blue-500 dark:border-blue-400',     checkBg: 'bg-blue-500',   checkBorder: 'border-blue-400' },
        green:  { icon: 'text-green-500 dark:text-green-400',    bg: 'bg-green-500/10',  border: 'border-green-500 dark:border-green-400',   checkBg: 'bg-green-500',  checkBorder: 'border-green-400' },
        purple: { icon: 'text-purple-500 dark:text-purple-400',  bg: 'bg-purple-500/10', border: 'border-purple-500 dark:border-purple-400', checkBg: 'bg-purple-500', checkBorder: 'border-purple-400' },
        orange: { icon: 'text-orange-500 dark:text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500 dark:border-orange-400', checkBg: 'bg-orange-500', checkBorder: 'border-orange-400' },
        yellow: { icon: 'text-yellow-500 dark:text-yellow-400',  bg: 'bg-yellow-500/10', border: 'border-yellow-500 dark:border-yellow-400', checkBg: 'bg-yellow-500', checkBorder: 'border-yellow-400' },
        teal:   { icon: 'text-teal-500 dark:text-teal-400',      bg: 'bg-teal-500/10',   border: 'border-teal-500 dark:border-teal-400',     checkBg: 'bg-teal-500',   checkBorder: 'border-teal-400' }
    };

    // --- API & UI HELPERS ---
    const showNotification = (title, message, type = 'success') => {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        const iconContainer = notificationIconContainer;
        if (type === 'error') {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-500/20';
            iconContainer.innerHTML = '<i data-lucide="alert-triangle" class="h-6 w-6 text-red-600 dark:text-red-400"></i>';
        } else if (type === 'modelBusy') {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-500/20';
            iconContainer.innerHTML = '<i data-lucide="bot" class="h-6 w-6 text-yellow-600 dark:text-yellow-400"></i>';
        } else {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-500/20';
            iconContainer.innerHTML = '<i data-lucide="check-circle" class="h-6 w-6 text-green-600 dark:text-green-400"></i>';
        }
        notificationModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const showConfirmModal = (title, message, onConfirm) => {
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const hideConfirmModal = () => {
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    };

    // Redirect to social scrape page
    const redirectToSocialScrape = () => {
        window.location.href = '/social-scrape';
    };

    // Make function global so it can be called from HTML
    window.redirectToSocialScrape = redirectToSocialScrape;

    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error('MODEL_BUSY');
                }
                const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
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

    const fetchInitialData = async () => {
        const loadingTextElement = document.getElementById('loading-text-animation');
        if (loadingTextElement) loadingTextElement.textContent = "Analyzing psychological triggers...";
        
        try {
            const [frameworks, firstScript] = await Promise.all([
                apiCall('/api/frameworks'),
                apiCall('/api/new-script', { method: 'POST', body: JSON.stringify({ frameworkId: null }), headers: { 'Content-Type': 'application/json' } })
            ]);
            
            allFrameworks = frameworks;
            selectedFrameworkId = firstScript.frameworkId;
            
            const countData = await apiCall('/api/business-cases/count', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frameworkId: selectedFrameworkId })
            });
            totalCases = countData.total;

            contentFeed = [firstScript];
            currentFeedIndex = 0;
            renderCurrentReel();

        } catch (error) {
            if (error.message === 'MODEL_BUSY') {
                showNotification('Model Overloaded', 'The AI is currently busy. Please try again in a few moments.', 'modelBusy');
            } else {
                showNotification('Error', error.message, 'error');
            }
        }
    };
    
    const renderCurrentReel = () => {
        if (!contentFeed || contentFeed.length === 0) {
            reelCardContainer.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">No more scripts available. Try creating one from the news page!</div>`;
            paginationContainer.innerHTML = '';
            return;
        }
        const story = contentFeed[currentFeedIndex];
        reelCardContainer.innerHTML = story.type === 'news_commentary' 
            ? generateNewsCommentaryCardHTML(story) 
            : generateViralScriptCardHTML(story);
        renderFrameworkDropdown();
        updatePagination();
        document.querySelectorAll('[data-section-type]').forEach(section => {
            const firstOption = section.querySelector('.p-3');
            if (firstOption) selectOption(firstOption, section.dataset.sectionType);
        });
        lucide.createIcons();
    };

    const renderFrameworkDropdown = () => {
        const dropdownContainer = document.querySelector('.framework-dropdown-container');
        if (!dropdownContainer) return;

        const optionsHTML = allFrameworks.map(fw => 
            `<option value="${fw._id}" ${fw._id === selectedFrameworkId ? 'selected' : ''}>${fw.name}</option>`
        ).join('');

        dropdownContainer.innerHTML = `
            <div class="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                <div class="flex items-center gap-2">
                    <i data-lucide="settings" class="w-4 h-4 text-purple-500"></i>
                    <label for="framework-selector" class="text-sm font-semibold text-slate-700 dark:text-slate-300">Framework:</label>
                </div>
                <select id="framework-selector" class="bg-transparent border-none text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-0 focus:outline-none cursor-pointer">
                    ${optionsHTML}
                </select>
            </div>
        `;
        document.getElementById('framework-selector').addEventListener('change', handleFrameworkChange);
    };

    const handleFrameworkChange = async (event) => {
        const newFrameworkId = event.target.value;
        if (newFrameworkId === selectedFrameworkId) return;

        selectedFrameworkId = newFrameworkId;
        const currentCase = { ...contentFeed[currentFeedIndex] };
        
        delete currentCase.hooks;
        delete currentCase.buildUps;
        delete currentCase.stories;
        delete currentCase.psychologies;
        delete currentCase.contexts;
        delete currentCase.evidences;
        delete currentCase.patterns;
        delete currentCase.ctas;
        
        reelCardContainer.innerHTML = `<div class="flex justify-center items-center py-40"><i data-lucide="refresh-cw" class="w-12 h-12 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();

        try {
            const countData = await apiCall('/api/business-cases/count', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frameworkId: newFrameworkId })
            });
            totalCases = countData.total;

            const regeneratedScript = await apiCall('/api/regenerate-script-from-case', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessCase: currentCase, frameworkId: newFrameworkId })
            });
            contentFeed[currentFeedIndex] = regeneratedScript;
            renderCurrentReel();
        } catch (error) {
            if (error.message === 'MODEL_BUSY') {
                showNotification('Model Overloaded', 'The AI is currently busy. Please try again in a few moments.', 'modelBusy');
            } else {
                showNotification('Error', 'Failed to regenerate script with the new framework.', 'error');
            }
            renderCurrentReel(); // Render the old one back
        }
    };

    const generateSectionHTML = (story, sec) => {
        if (!sec || !sec.type) return '';
        const options = story[sec.type] || [];
        const colors = colorMap[sec.color] || colorMap.blue;
        return `<div class="section-block rounded-2xl border-2 border-slate-200/50 dark:border-slate-800/50 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:border-${sec.color}-200 dark:hover:border-${sec.color}-800/50 transition-all duration-300 hover:shadow-lg">
                    <div class="flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-slate-50/80 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50" data-color="${sec.color}">
                        <div class="flex items-center gap-3">
                            <div class="bg-gradient-to-r from-${sec.color}-500 to-${sec.color}-600 p-2.5 rounded-xl shadow-lg">
                                <i data-lucide="${sec.icon}" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <span class="font-bold text-slate-800 dark:text-white text-lg">${sec.title}</span>
                                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Choose your preferred option</p>
                            </div>
                        </div>
                        <button class="regenerate-section-btn group p-2.5 rounded-xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-200" data-section-type="${sec.type}" title="Regenerate options">
                            <i data-lucide="refresh-cw" class="w-4 h-4 text-slate-500 group-hover:text-${sec.color}-600 group-hover:rotate-180 transition-all duration-300"></i>
                        </button>
                    </div>
                    <div class="p-4 space-y-3" data-section-type="${sec.type}">
                        ${options.map((option, index) => `<div class="option-card p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-md" onclick="selectOption(this, '${sec.type}')">
                                <label class="flex items-start cursor-pointer">
                                    <input type="radio" name="${story.id}-${sec.type}" data-index="${index}" ${index === 0 ? 'checked' : ''} class="sr-only" />
                                    <div class="check-icon-container flex-shrink-0 w-6 h-6 rounded-full border-2 mt-0.5 mr-4 flex items-center justify-center transition-all duration-200"></div>
                                    <div class="flex-grow">
                                        <span class="text-slate-700 dark:text-slate-300 leading-relaxed">${(option || '').replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')}</span>
                                    </div>
                                </label>
                            </div>`).join('')}
                    </div>
                </div>`;
    };
    
    const generateCardHeaderHTML = (story) => {
        let titleHTML = '';
        if (story.type === 'news_commentary') {
            titleHTML = `<h3 class="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">News Commentary: <span class="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">${story.company}</span></h3>`;
        } else {
            titleHTML = `<h3 class="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">Psychology: <span class="bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">${story.psychology}</span></h3>`;
        }

        return `<div class="relative mb-8">
                    <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-blue-500/5 rounded-2xl"></div>
                    <div class="relative flex flex-col lg:flex-row justify-between items-start gap-6 p-6">
                        <div class="flex-grow">
                            ${titleHTML}
                            <div class="flex flex-wrap items-center gap-3 mt-4">
                               <span class="inline-flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                                   <i data-lucide="building" class="w-4 h-4 text-emerald-500"></i>
                                   ${story.company}
                               </span>
                               <span class="inline-flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                                   <i data-lucide="tag" class="w-4 h-4 text-blue-500"></i>
                                   ${story.industry}
                               </span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="framework-dropdown-container"></div>
                            <button class="delete-case-btn group p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 border border-transparent hover:border-red-200 dark:hover:border-red-800" data-business-case-id="${story._id}" title="Delete this case">
                                <i data-lucide="trash-2" class="w-5 h-5 group-hover:scale-110 transition-transform"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
    };
    
    const generateViralScriptCardHTML = (story) => {
        const sections = [
            { type: 'hooks', title: 'Hook', icon: 'anchor', color: 'red' },
            { type: 'buildUps', title: 'Build-Up', icon: 'trending-up', color: 'blue' },
            { type: 'stories', title: 'Story', icon: 'book-open', color: 'green' },
            { type: 'psychologies', title: 'Psychology', icon: 'brain-circuit', color: 'purple' },
            { type: 'ctas', title: 'Call to Action', icon: 'megaphone', color: 'orange' }
        ];
        return `<div class="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-white/20 dark:border-slate-800/50 shadow-2xl max-w-6xl mx-auto overflow-hidden" data-story-id="${story.id}" data-business-case-id="${story._id}">
                <!-- Background decorations -->
                <div class="absolute top-4 right-4 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
                <div class="absolute bottom-4 left-4 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
                
                <div class="relative z-10">
                    ${generateCardHeaderHTML(story)}
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        ${sections.map(sec => generateSectionHTML(story, sec)).join('')}
                    </div>
                    <div class="flex justify-center pt-6 border-t border-slate-200/50 dark:border-slate-800/50">
                        <button class="build-script-btn group flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                            <i data-lucide="file-text" class="w-6 h-6 group-hover:rotate-12 transition-transform"></i>
                            <span>Build My Script</span>
                            <i data-lucide="arrow-right" class="w-5 h-5 group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </div>
                    <div class="script-editor-container mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-800/50 hidden"></div>
                </div>
            </div>`;
    };

    const generateNewsCommentaryCardHTML = (story) => {
        const sections = [
            { type: 'hooks', title: 'Hook', icon: 'anchor', color: 'red' },
            { type: 'contexts', title: 'Context', icon: 'archive', color: 'yellow' },
            { type: 'evidences', title: 'Evidence', icon: 'file-search-2', color: 'blue' },
            { type: 'patterns', title: 'Pattern', icon: 'git-compare-arrows', color: 'teal' },
            { type: 'ctas', title: 'Call to Action', icon: 'megaphone', color: 'orange' }
        ];
        return `<div class="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-white/20 dark:border-slate-800/50 shadow-2xl max-w-6xl mx-auto overflow-hidden" data-story-id="${story.id}" data-business-case-id="${story._id}">
                <!-- Background decorations -->
                <div class="absolute top-4 right-4 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
                <div class="absolute bottom-4 left-4 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl"></div>
                
                <div class="relative z-10">
                    ${generateCardHeaderHTML(story)}
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        ${sections.map(sec => generateSectionHTML(story, sec)).join('')}
                    </div>
                    <div class="flex justify-center pt-6 border-t border-slate-200/50 dark:border-slate-800/50">
                        <button class="build-script-btn group flex items-center gap-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                            <i data-lucide="file-text" class="w-6 h-6 group-hover:rotate-12 transition-transform"></i>
                            <span>Build Commentary</span>
                            <i data-lucide="arrow-right" class="w-5 h-5 group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </div>
                    <div class="script-editor-container mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-800/50 hidden"></div>
                </div>
            </div>`;
    };

    window.selectOption = (element, type) => {
        const sectionContainer = element.closest(`[data-section-type="${type}"]`);
        const color = element.closest('.section-block').querySelector('[data-color]').dataset.color;
        const colors = colorMap[color] || colorMap.blue;
        
        // Reset all options in this section
        sectionContainer.querySelectorAll('.option-card').forEach(div => {
            div.className = 'option-card p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-md border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50';
            const checkDiv = div.querySelector('.check-icon-container');
            checkDiv.className = 'check-icon-container flex-shrink-0 w-6 h-6 rounded-full border-2 mt-0.5 mr-4 flex items-center justify-center transition-all duration-200 border-slate-300 dark:border-slate-600';
            checkDiv.innerHTML = '';
        });
        
        // Activate selected option
        element.querySelector('input[type="radio"]').checked = true;
        element.className = `option-card p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-md border-${color}-300 dark:border-${color}-600 bg-gradient-to-r from-${color}-50/50 to-${color}-100/50 dark:from-${color}-900/20 dark:to-${color}-800/20 shadow-lg transform scale-[1.02]`;
        
        const checkDiv = element.querySelector('.check-icon-container');
        checkDiv.className = `check-icon-container flex-shrink-0 w-6 h-6 rounded-full border-2 mt-0.5 mr-4 flex items-center justify-center transition-all duration-200 border-${color}-400 dark:border-${color}-500 bg-gradient-to-r from-${color}-500 to-${color}-600 shadow-lg`;
        checkDiv.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-white"></i>';
        lucide.createIcons();
    };

    const handleBuildScript = () => {
        const story = contentFeed[currentFeedIndex];
        const selections = {};
        let scriptText;

        if (story.type === 'news_commentary') {
            const sections = ['hooks', 'contexts', 'evidences', 'patterns', 'ctas'];
            sections.forEach(type => {
                const checkedRadio = document.querySelector(`[data-section-type="${type}"] input:checked`);
                selections[type] = checkedRadio ? parseInt(checkedRadio.dataset.index) : 0;
            });
            scriptText = `**HOOK:**\n${story.hooks[selections.hooks]}\n\n**CONTEXT:**\n${story.contexts[selections.contexts]}\n\n**EVIDENCE:**\n${story.evidences[selections.evidences]}\n\n**PATTERN:**\n${story.patterns[selections.patterns]}\n\n**CTA:**\n${story.ctas[selections.ctas]}`;
        } else {
            const sections = ['hooks', 'buildUps', 'stories', 'psychologies', 'ctas'];
            sections.forEach(type => {
                const checkedRadio = document.querySelector(`[data-section-type="${type}"] input:checked`);
                selections[type] = checkedRadio ? parseInt(checkedRadio.dataset.index) : 0;
            });
            scriptText = `**HOOK:**\n${story.hooks[selections.hooks]}\n\n**BUILD-UP:**\n${story.buildUps[selections.buildUps]}\n\n**STORY:**\n${story.stories[selections.stories]}\n\n**PSYCHOLOGY:**\n${story.psychologies[selections.psychologies]}\n\n**CTA:**\n${story.ctas[selections.ctas]}`;
        }
        
        const editorContainer = document.querySelector('.script-editor-container');
        editorContainer.innerHTML = `<div class="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800">
                <h4 class="text-xl font-bold text-center mb-4 text-slate-800 dark:text-white flex items-center justify-center gap-2"><i data-lucide="shield-check" class="w-5 h-5 text-green-500"></i>Script Verification</h4>
                <p class="text-center text-sm text-slate-500 dark:text-slate-400 mb-4">Cross-reference the case study findings with the original sources to ensure accuracy.</p>
                <button class="verify-script-btn w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="shield-check" data-original-text="Verify Script">
                    <span class="btn-icon"><i data-lucide="shield-check" class="w-5 h-5"></i></span>
                    <span class="btn-text">Verify Script</span>
                </button>
                <div class="verify-result-container mt-4"></div>

                <div class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <h4 class="text-xl font-bold text-center mb-4 text-slate-800 dark:text-white flex items-center justify-center gap-2"><i data-lucide="edit" class="w-5 h-5 text-primary-500"></i>Script Editor</h4>
                    <textarea id="final-script-textarea" class="w-full h-64 p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700">${scriptText}</textarea>
                    
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
                            <button class="generate-audio-btn flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-semibold" data-icon="music-4" data-original-text="Generate Audio"><span class="btn-icon"><i data-lucide="music-4" class="w-5 h-5"></i></span><span class="btn-text">Generate Audio</span></button>
                            <button class="copy-text-btn flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"><i data-lucide="copy" class="w-5 h-5"></i>Copy Text</button>
                        </div>
                    </div>
                </div>
                <div class="audio-player-container mt-4"></div>
                <div class="save-story-container mt-4"></div>
            </div>`;
        editorContainer.classList.remove('hidden');
        lucide.createIcons();
    };
    const handleVerifyScript = async (verifyBtn) => {
        const verifyResultContainer = document.querySelector('.verify-result-container');
        verifyResultContainer.innerHTML = '';
        toggleButtonLoading(verifyBtn, true, 'Verifying...');
        try {
            const story = contentFeed[currentFeedIndex];
            const payload = {
                company: story.company,
                solution: story.solution,
                psychology: story.psychology,
                findings: story.findings,
                sources: story.sources
            };
            const result = await apiCall('/api/verify-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (result && result.checks && Array.isArray(result.checks)) {
                const overallColor = result.confidence_score > 75 ? 'green' : result.confidence_score > 50 ? 'yellow' : 'red';
                const overallIcon = result.confidence_score > 75 ? 'check-circle' : result.confidence_score > 50 ? 'alert-triangle' : 'x-circle';

                verifyResultContainer.innerHTML = `
                    <div class="border rounded-lg overflow-hidden mt-4 border-${overallColor}-500/50">
                        <div class="p-4 bg-${overallColor}-500/10">
                            <div class="flex items-center gap-3">
                                <i data-lucide="${overallIcon}" class="w-8 h-8 text-${overallColor}-600 dark:text-${overallColor}-400"></i>
                                <div>
                                    <h4 class="text-lg font-bold text-${overallColor}-800 dark:text-${overallColor}-200">Verification Complete</h4>
                                    <p class="text-sm text-${overallColor}-700 dark:text-${overallColor}-300">${result.conclusion}</p>
                                </div>
                                <div class="ml-auto text-right">
                                     <div class="text-xs text-slate-500 dark:text-slate-400">Confidence</div>
                                     <div class="text-lg font-bold text-slate-800 dark:text-white">${result.confidence_score}%</div>
                                </div>
                            </div>
                        </div>
                        <div class="p-4 bg-white dark:bg-slate-900/50">
                             <ul class="space-y-3">
                                ${result.checks.map(check => `
                                    <li class="flex items-start gap-3">
                                        <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${check.is_correct ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}">
                                            <i data-lucide="${check.is_correct ? 'check' : 'x'}" class="w-4 h-4"></i>
                                        </div>
                                        <div class="flex-grow">
                                            <strong class="font-semibold text-slate-700 dark:text-slate-200">${check.check}</strong>
                                            <p class="text-sm text-slate-600 dark:text-slate-400">${check.comment}</p>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
                lucide.createIcons();
            } else {
                verifyResultContainer.innerHTML = `<p class="text-red-500">Verification failed or returned unexpected result.</p>`;
            }
        } catch (error) {
            verifyResultContainer.innerHTML = `<p class="text-red-500">Failed to verify script: ${error.message}</p>`;
        } finally {
            toggleButtonLoading(verifyBtn, false);
        }
    };

    const handleCopyScript = () => {
        const scriptTextarea = document.getElementById('final-script-textarea');
        const body = scriptTextarea.value.replace(/^\*\*.+?\*\*:\s*/gm, '').trim();
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

        // Remove all **LABEL:** style headings (e.g., **HOOK:**, **BUILD-UP:**, etc.)
        let scriptText = scriptTextarea.value.replace(/\*\*[A-Z0-9 \-]+:\*\*/g, '');
        // Also remove any lines that are just whitespace or empty after label removal
        scriptText = scriptText.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');

        try {
            const result = await apiCall('/api/generate-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptText })
            });

            if (result.success && result.audioUrl) {
                audioPlayerContainer.innerHTML = `<audio controls class="w-full"><source src="${result.audioUrl}" type="audio/mpeg">Your browser does not support the audio element.</audio>`;
                saveStoryContainer.innerHTML = `<div class="mt-4 space-y-4">
                        <div>
                            <label for="save-style-select" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Save script for:</label>
                            <select id="save-style-select" class="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                                <option value="" disabled selected>Select a style...</option>
                                <option value="Talking Head">Talking Head</option>
                                <option value="Faceless">Faceless</option>
                                <option value="News Commentary">News Commentary</option>
                            </select>
                        </div>
                        <button class="save-story-btn w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold" data-audio-url="${result.audioUrl}" data-icon="save" data-original-text="Save Story">
                            <span class="btn-icon"><i data-lucide="save" class="w-5 h-5"></i></span>
                            <span class="btn-text">Save Story</span>
                        </button>
                </div>`;
                lucide.createIcons();
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
        const styleSelect = document.getElementById('save-style-select');
        const selectedStyle = styleSelect.value;

        if (!selectedStyle) {
            showNotification('Selection Required', 'Please select a script style before saving.', 'error');
            styleSelect.classList.add('border-red-500', 'ring-red-500');
            setTimeout(() => styleSelect.classList.remove('border-red-500', 'ring-red-500'), 2000);
            return;
        }

        const story = contentFeed[currentFeedIndex];
        const scriptTextarea = document.getElementById('final-script-textarea');
        const transcript = scriptTextarea.value;
        const audioUrl = saveBtn.dataset.audioUrl;
        const storyData = { 
            title: story.psychology || story.company, 
            transcript, 
            audioUrl, 
            hashtags: story.hashtags, 
            businessCaseId: story._id,
            style: selectedStyle
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
            showNotification('Error', `Failed to save story: ${error.message}`, 'error');
        } finally {
            toggleButtonLoading(saveBtn, false);
        }
    };

    const handleDeleteCase = (button) => {
        const businessCaseId = button.dataset.businessCaseId;
        showConfirmModal(
            'Delete Business Case?',
            'This will permanently remove this case study. This action cannot be undone.',
            async () => {
                try {
                    await apiCall(`/api/business-case/${businessCaseId}`, { method: 'DELETE' });
                    hideConfirmModal();
                    showNotification('Success', 'Business case deleted.');
                    contentFeed.splice(currentFeedIndex, 1);
                    totalCases--;
                    if (currentFeedIndex >= contentFeed.length && contentFeed.length > 0) {
                        currentFeedIndex = contentFeed.length - 1;
                    }
                    if (contentFeed.length > 0) {
                        renderCurrentReel();
                    } else {
                        fetchInitialData();
                    }
                } catch (error) {
                    hideConfirmModal();
                    showNotification('Error', `Failed to delete case: ${error.message}`, 'error');
                }
            }
        );
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
                    await updateFrameworkFromPrompt(aiPrompt, selectedFrameworkId);
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

    const updateFrameworkFromPrompt = async (aiPrompt, frameworkId) => {
        frameworkUpdateLoader.classList.remove('hidden');
        try {
            await apiCall('/api/update-framework-from-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiPrompt, frameworkId })
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

    const handleCardClick = (e) => {
        if (e.target.closest('.build-script-btn')) handleBuildScript();
        if (e.target.closest('.copy-text-btn')) handleCopyScript();
        if (e.target.closest('.generate-audio-btn')) handleGenerateAudio(e.target.closest('.generate-audio-btn'));
        if (e.target.closest('.save-story-btn')) handleSaveStory(e.target.closest('.save-story-btn'));
        if (e.target.closest('.delete-case-btn')) handleDeleteCase(e.target.closest('.delete-case-btn'));
        if (e.target.closest('.rewrite-ai-btn')) handleAiRewrite(e.target.closest('.rewrite-ai-btn'));
        if (e.target.closest('.verify-script-btn')) handleVerifyScript(e.target.closest('.verify-script-btn'));
        if (e.target.closest('.regenerate-section-btn')) handleRegenerateSection(e.target.closest('.regenerate-section-btn'));
    };

    const updatePagination = () => {
        if (totalCases <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        paginationContainer.innerHTML = `
            <div class="inline-flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-2 border border-white/20 dark:border-slate-800/50 shadow-xl">
                <button id="prev-btn" class="group flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" ${currentFeedIndex === 0 ? 'disabled' : ''}>
                    <i data-lucide="chevron-left" class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"></i>
                    <span class="hidden sm:inline">Previous</span>
                </button>
                <div class="flex items-center px-4 py-2">
                    <span class="text-sm font-semibold text-slate-700 dark:text-slate-200 mx-2">
                        Script <span class="text-emerald-600 dark:text-emerald-400">${currentFeedIndex + 1}</span> of <span class="text-blue-600 dark:text-blue-400">${totalCases}</span>
                    </span>
                </div>
                <button id="next-btn" class="group flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" ${currentFeedIndex + 1 >= totalCases ? 'disabled' : ''}>
                    <span class="hidden sm:inline">Next</span>
                    <i data-lucide="chevron-right" class="w-4 h-4 group-hover:translate-x-0.5 transition-transform"></i>
                </button>
            </div>`;
        lucide.createIcons();
    };
    
    const handlePaginationClick = async (e) => {
        const prevBtn = e.target.closest('#prev-btn');
        const nextBtn = e.target.closest('#next-btn');

        if (prevBtn && currentFeedIndex > 0) {
            currentFeedIndex--;
            renderCurrentReel();
        }

        if (nextBtn) {
            if (currentFeedIndex < contentFeed.length - 1) {
                currentFeedIndex++;
                renderCurrentReel();
            } else {
                reelCardContainer.innerHTML = `<div class="flex justify-center items-center py-20"><i data-lucide="refresh-cw" class="w-10 h-10 animate-spin text-primary-500"></i></div>`;
                lucide.createIcons();
                try {
                    const newScript = await apiCall('/api/new-script', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ frameworkId: selectedFrameworkId })
                    });
                    contentFeed.push(newScript);
                    currentFeedIndex++;
                    renderCurrentReel();
                } catch (error) {
                    renderCurrentReel();
                    if (error.message === 'MODEL_BUSY') {
                        showNotification('Model Overloaded', 'The AI is currently busy. Please try again in a few moments.', 'modelBusy');
                    } else {
                        showNotification('Error', 'Could not load the next script.', 'error');
                    }
                }
            }
        }
    };

    const handleRegenerateSection = async (button) => {
        const sectionType = button.dataset.sectionType;
        const businessCase = contentFeed[currentFeedIndex];
        const icon = button.querySelector('svg'); // **FIX:** Select the SVG element directly
        const sectionBlock = button.closest('.section-block');
        const optionsContainer = sectionBlock.querySelector(`div[data-section-type="${sectionType}"]`);

        if (!icon || !optionsContainer) return;

        icon.classList.add('animate-spin');
        button.disabled = true;

        optionsContainer.innerHTML = `
            <div class="space-y-2 animate-pulse p-3">
                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
            </div>`;

        try {
            const { newOptions } = await apiCall('/api/regenerate-section', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessCase, sectionType, frameworkId: selectedFrameworkId })
            });

            contentFeed[currentFeedIndex][sectionType] = newOptions;

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
        
        } catch (error) {
            optionsContainer.innerHTML = `<p class="text-red-500 text-xs p-2">Failed to load new options.</p>`;
            if (error.message === 'MODEL_BUSY') {
                showNotification('Model Overloaded', 'Could not regenerate options. Please try again.', 'modelBusy');
            } else {
                showNotification('Error', 'Could not regenerate options. Please try again.', 'error');
            }
        } finally {
            icon.classList.remove('animate-spin');
            button.disabled = false;
            lucide.createIcons();
        }
    };

    const init = async () => {
        findNewScriptsBtn?.addEventListener('click', () => createFromModal.classList.remove('hidden'));
        reelCardContainer.addEventListener('click', handleCardClick);
        paginationContainer.addEventListener('click', handlePaginationClick);
        createFromNewsBtn?.addEventListener('click', () => window.location.href = '/news');
        closeCreateModalBtn?.addEventListener('click', () => createFromModal.classList.add('hidden'));
        notificationOkBtn?.addEventListener('click', () => notificationModal.classList.add('hidden'));
        confirmCancelBtn.addEventListener('click', hideConfirmModal);
        confirmActionBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
        });

        const generatedContent = sessionStorage.getItem('generatedContent');
        if (generatedContent) {
            contentFeed = JSON.parse(generatedContent);
            sessionStorage.removeItem('generatedContent');
            currentFeedIndex = 0;
            
            try {
                const [frameworks] = await Promise.all([
                    apiCall('/api/frameworks')
                ]);
                allFrameworks = frameworks;

                if (contentFeed[0] && contentFeed[0].frameworkId) {
                    selectedFrameworkId = contentFeed[0].frameworkId;
                } else {
                    const newsFramework = allFrameworks.find(f => f.type === 'news_commentary');
                    selectedFrameworkId = newsFramework ? newsFramework._id : (allFrameworks.length > 0 ? allFrameworks[0]._id : null);
                }

                const countData = await apiCall('/api/business-cases/count', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frameworkId: selectedFrameworkId })
                });
                totalCases = countData.total;

                renderCurrentReel();
            } catch (error) {
                showNotification('Error', 'Could not load initial data.', 'error');
                renderCurrentReel(); // Render anyway
            }
        } else {
            fetchInitialData();
        }
    };

    init();
});
