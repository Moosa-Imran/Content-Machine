// public/js/reels.js
// Handles all client-side interactions for the reels.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let contentFeed = [];
    let currentFeedIndex = 0;
    let totalCases = 0;
    let selectedFrameworkId = null;
    
    // --- ELEMENT SELECTORS ---
    const reelCardContainer = document.getElementById('reel-card-container');
    const paginationContainer = document.getElementById('pagination-container');
    const findNewScriptsBtn = document.getElementById('find-new-scripts-btn');
    const createFromModal = document.getElementById('create-from-modal');
    const closeCreateModalBtn = document.getElementById('close-create-modal-btn');
    const createFromNewsBtn = document.getElementById('create-from-news-btn');
    const frameworkSelectModal = document.getElementById('framework-select-modal');
    const frameworkOptionsContainer = document.getElementById('framework-options-container');
    const frameworkUpdateLoader = document.getElementById('framework-update-loader');

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
        } else {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-500/20';
            iconContainer.innerHTML = '<i data-lucide="check-circle" class="h-6 w-6 text-green-600 dark:text-green-400"></i>';
        }
        notificationModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) throw new Error((await response.json()).error || 'Server error');
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

    const showFrameworkSelector = async (onSelectCallback) => {
        frameworkOptionsContainer.innerHTML = `<div class="flex justify-center items-center py-10"><i data-lucide="refresh-cw" class="w-6 h-6 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();
        frameworkSelectModal.classList.remove('hidden');

        try {
            const frameworks = await apiCall('/api/frameworks');
            frameworkOptionsContainer.innerHTML = frameworks.map(fw => `
                <button class="framework-option-btn w-full text-left p-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex justify-between items-center" data-id="${fw._id}">
                    <span>
                        <span class="font-semibold text-slate-800 dark:text-white">${fw.name}</span>
                        <span class="ml-2 text-xs ${fw.type === 'news_commentary' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'} px-2 py-0.5 rounded-full font-medium">${fw.type === 'news_commentary' ? 'News Commentary' : 'Viral Script'}</span>
                        ${fw.isDefault ? '<span class="ml-2 text-xs bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium">Default</span>' : ''}
                    </span>
                    <i data-lucide="arrow-right" class="w-4 h-4 text-slate-400"></i>
                </button>
            `).join('');
            lucide.createIcons();
            
            document.querySelectorAll('.framework-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedFrameworkId = btn.dataset.id;
                    frameworkSelectModal.classList.add('hidden');
                    onSelectCallback(selectedFrameworkId);
                });
            });
        } catch (error) {
            frameworkOptionsContainer.innerHTML = `<p class="text-red-500">Could not load frameworks. Using default.</p>`;
            setTimeout(() => {
                frameworkSelectModal.classList.add('hidden');
                onSelectCallback(null);
            }, 1500);
        }
    };

    const fetchInitialScript = async () => {
        const loadingTextElement = document.getElementById('loading-text-animation');
        if (loadingTextElement) loadingTextElement.textContent = "Analyzing psychological triggers...";
        try {
            const countData = await apiCall('/api/business-cases/count');
            totalCases = countData.total;
            showFrameworkSelector(async (frameworkId) => {
                const firstScript = await apiCall('/api/new-script', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frameworkId })
                });
                contentFeed = [firstScript];
                currentFeedIndex = 0;
                renderCurrentReel();
            });
        } catch (error) {
            showNotification('Error', error.message, true);
        }
    };
    
    const renderCurrentReel = () => {
        if (!contentFeed || contentFeed.length === 0) return;
        const story = contentFeed[currentFeedIndex];
        reelCardContainer.innerHTML = story.type === 'news_commentary' 
            ? generateNewsCommentaryCardHTML(story) 
            : generateViralScriptCardHTML(story);
        updatePagination();
        document.querySelectorAll('[data-section-type]').forEach(section => {
            const firstOption = section.querySelector('.p-3');
            if (firstOption) selectOption(firstOption, section.dataset.sectionType);
        });
        lucide.createIcons();
    };

    const generateSectionHTML = (story, sec) => {
        if (!sec || !sec.type) return '';
        const options = story[sec.type] || [];
        const colors = colorMap[sec.color] || colorMap.blue;
        return `<div class="section-block rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div class="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800" data-color="${sec.color}">
                        <div class="flex items-center gap-2.5">
                            <i data-lucide="${sec.icon}" class="w-5 h-5 ${colors.icon}"></i>
                            <span class="font-semibold text-sm text-slate-700 dark:text-slate-200">${sec.title}</span>
                        </div>
                        <button class="regenerate-section-btn p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" data-section-type="${sec.type}" title="Regenerate"><i data-lucide="refresh-cw" class="w-4 h-4 text-slate-500"></i></button>
                    </div>
                    <div class="p-3 space-y-2" data-section-type="${sec.type}">
                        ${options.map((option, index) => `<div class="p-3 rounded-md border cursor-pointer transition-all" onclick="selectOption(this, '${sec.type}')">
                                <label class="flex items-start text-sm cursor-pointer">
                                    <input type="radio" name="${story.id}-${sec.type}" data-index="${index}" ${index === 0 ? 'checked' : ''} class="sr-only" />
                                    <div class="check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all"></div>
                                    <span class="flex-grow text-slate-600 dark:text-slate-300">${(option || '').replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-primary-600 dark:text-primary-400">$1</strong>')}</span>
                                </label>
                            </div>`).join('')}
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
        return `<div class="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 card-glow max-w-4xl mx-auto" data-story-id="${story.id}" data-business-case-id="${story._id}">
                <div class="flex justify-between items-center gap-4 mb-6">
                    <div>
                        <h3 class="text-2xl font-bold text-slate-800 dark:text-white">Principle: <span class="text-primary-600 dark:text-primary-400">${story.psychology}</span></h3>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.company}</span>
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.industry}</span>
                        </div>
                    </div>
                </div>
                <div class="space-y-4">${sections.map(sec => generateSectionHTML(story, sec)).join('')}</div>
                <div class="flex justify-center mt-8"><button class="build-script-btn flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold text-lg"><i data-lucide="file-text" class="w-5 h-5"></i> Build Script</button></div>
                <div class="script-editor-container mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 hidden"></div>
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
        return `<div class="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 card-glow max-w-4xl mx-auto" data-story-id="${story.id}" data-business-case-id="${story._id}">
                <div class="flex justify-between items-center gap-4 mb-6">
                    <div>
                        <h3 class="text-2xl font-bold text-slate-800 dark:text-white">News Commentary: <span class="text-primary-600 dark:text-primary-400">${story.company}</span></h3>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.industry}</span>
                        </div>
                    </div>
                </div>
                <div class="space-y-4">${sections.map(sec => generateSectionHTML(story, sec)).join('')}</div>
                <div class="flex justify-center mt-8"><button class="build-script-btn flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold text-lg"><i data-lucide="file-text" class="w-5 h-5"></i> Build Script</button></div>
                <div class="script-editor-container mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 hidden"></div>
            </div>`;
    };

    window.selectOption = (element, type) => {
        const sectionContainer = element.closest(`[data-section-type="${type}"]`);
        const color = element.closest('.section-block').querySelector('[data-color]').dataset.color;
        const colors = colorMap[color] || colorMap.blue;
        sectionContainer.querySelectorAll('.p-3').forEach(div => {
            div.className = 'p-3 rounded-md border cursor-pointer transition-all border-slate-200 dark:border-slate-700';
            const iconContainer = div.querySelector('.check-icon-container');
            iconContainer.innerHTML = '';
            iconContainer.className = 'check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all border-slate-400 dark:border-slate-500';
        });
        element.querySelector('input[type="radio"]').checked = true;
        element.className = `p-3 rounded-md border-2 cursor-pointer transition-all ${colors.border} ${colors.bg}`;
        const checkDiv = element.querySelector('.check-icon-container');
        checkDiv.className = `check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all ${colors.checkBorder} ${colors.checkBg}`;
        checkDiv.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-white"></i>';
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
                <h4 class="text-xl font-bold text-center mb-4 text-slate-800 dark:text-white flex items-center justify-center gap-2"><i data-lucide="edit" class="w-5 h-5 text-primary-500"></i>Script Editor</h4>
                <textarea id="final-script-textarea" class="w-full h-64 p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700">${scriptText}</textarea>
                <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button class="generate-audio-btn flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-semibold" data-icon="music-4" data-original-text="Generate Audio"><span class="btn-icon"><i data-lucide="music-4" class="w-5 h-5"></i></span><span class="btn-text">Generate Audio</span></button>
                    <button class="copy-text-btn flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"><i data-lucide="copy" class="w-5 h-5"></i>Copy Text</button>
                </div>
                <div class="audio-player-container mt-4"></div>
                <div class="save-story-container mt-4"></div>
            </div>`;
        editorContainer.classList.remove('hidden');
        lucide.createIcons();
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
                audioPlayerContainer.innerHTML = `<audio controls class="w-full"><source src="${result.audioUrl}" type="audio/mpeg">Your browser does not support the audio element.</audio>`;
                saveStoryContainer.innerHTML = `<button class="save-story-btn w-full mt-4 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold" data-audio-url="${result.audioUrl}" data-icon="save" data-original-text="Save Story"><span class="btn-icon"><i data-lucide="save" class="w-5 h-5"></i></span><span class="btn-text">Save Story</span></button>`;
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
        const story = contentFeed[currentFeedIndex];
        const scriptTextarea = document.getElementById('final-script-textarea');
        const transcript = scriptTextarea.value;
        const audioUrl = saveBtn.dataset.audioUrl;
        const storyData = { title: story.psychology || story.company, transcript, audioUrl, hashtags: story.hashtags, businessCaseId: story._id };
        
        toggleButtonLoading(saveBtn, true, 'Saving...');

        try {
            await apiCall('/api/save-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(storyData)
            });
            showNotification('Success!', 'Story has been saved successfully.');
        } catch (error) {
            showNotification('Error', `Failed to save story: ${error.message}`, true);
        } finally {
            toggleButtonLoading(saveBtn, false);
        }
    };

    const handleCardClick = (e) => {
        if (e.target.closest('.build-script-btn')) handleBuildScript();
        if (e.target.closest('.copy-text-btn')) handleCopyScript();
        if (e.target.closest('.generate-audio-btn')) handleGenerateAudio(e.target.closest('.generate-audio-btn'));
        if (e.target.closest('.save-story-btn')) handleSaveStory(e.target.closest('.save-story-btn'));
    };

    const updatePagination = () => {
        if (totalCases <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        paginationContainer.innerHTML = `
            <div class="flex items-center justify-between">
                <button id="prev-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" ${currentFeedIndex === 0 ? 'disabled' : ''}><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                <span class="text-sm font-medium text-slate-500">Script ${currentFeedIndex + 1} of ${totalCases}</span>
                <button id="next-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" ${currentFeedIndex + 1 >= totalCases ? 'disabled' : ''}><i data-lucide="arrow-right" class="w-5 h-5"></i></button>
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
                    showNotification('Error', 'Could not load the next script.', true);
                }
            }
        }
    };

    const init = async () => {
        findNewScriptsBtn?.addEventListener('click', () => createFromModal.classList.remove('hidden'));
        reelCardContainer.addEventListener('click', handleCardClick);
        paginationContainer.addEventListener('click', handlePaginationClick);
        createFromNewsBtn?.addEventListener('click', () => window.location.href = '/news');
        closeCreateModalBtn?.addEventListener('click', () => createFromModal.classList.add('hidden'));
        notificationOkBtn?.addEventListener('click', () => notificationModal.classList.add('hidden'));

        const generatedContent = sessionStorage.getItem('generatedContent');
        if (generatedContent) {
            contentFeed = JSON.parse(generatedContent);
            sessionStorage.removeItem('generatedContent');
            currentFeedIndex = 0;
            totalCases = contentFeed.length;
            renderCurrentReel();
        } else {
            fetchInitialScript();
        }
    };

    init();
});
