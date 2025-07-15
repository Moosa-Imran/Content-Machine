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
            const [countData, frameworks, firstScript] = await Promise.all([
                apiCall('/api/business-cases/count'),
                apiCall('/api/frameworks'),
                apiCall('/api/new-script', { method: 'POST', body: JSON.stringify({ frameworkId: null }), headers: { 'Content-Type': 'application/json' } })
            ]);
            
            totalCases = countData.total;
            allFrameworks = frameworks;
            
            if (firstScript && firstScript.frameworkId) {
                selectedFrameworkId = firstScript.frameworkId;
            } else {
                const defaultFramework = allFrameworks.find(f => f.isDefault);
                selectedFrameworkId = defaultFramework ? defaultFramework._id : (allFrameworks.length > 0 ? allFrameworks[0]._id : null);
            }

            contentFeed = [firstScript];
            currentFeedIndex = 0;
            renderCurrentReel();

        } catch (error) {
            if (error.message === 'MODEL_BUSY') {
                showNotification('Model Overloaded', 'The AI is currently busy. Please try again in a few moments.', 'modelBusy');
            } else {
                showNotification('Error', error.message, true);
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
            <label for="framework-selector" class="text-sm font-medium text-slate-600 dark:text-slate-400">Framework:</label>
            <select id="framework-selector" class="ml-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                ${optionsHTML}
            </select>
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
                showNotification('Error', 'Failed to regenerate script with the new framework.', true);
            }
            renderCurrentReel(); // Render the old one back
        }
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
    
    const generateCardHeaderHTML = (story) => {
        let titleHTML = '';
        if (story.type === 'news_commentary') {
            titleHTML = `<h3 class="text-2xl font-bold text-slate-800 dark:text-white">News Commentary: <span class="text-primary-600 dark:text-primary-400">${story.company}</span></h3>`;
        } else {
            titleHTML = `<h3 class="text-2xl font-bold text-slate-800 dark:text-white">Principle: <span class="text-primary-600 dark:text-primary-400">${story.psychology}</span></h3>`;
        }

        return `<div class="flex justify-between items-start gap-4 mb-4">
                    <div class="flex-grow">
                        ${titleHTML}
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.company}</span>
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.industry}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="framework-dropdown-container flex-shrink-0"></div>
                        <button class="delete-case-btn p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-md" data-business-case-id="${story._id}" title="Delete this case">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
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
                ${generateCardHeaderHTML(story)}
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
                ${generateCardHeaderHTML(story)}
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
        
        const scriptText = scriptTextarea.value
            .replace(/^\*\*[A-Z ]+:\*\*\s*/gim, '')
            .replace(/\n{2,}/g, '\n\n')
            .trim();

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
            showNotification('Error', `Failed to save story: ${error.message}`, true);
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
                    showNotification('Error', `Failed to delete case: ${error.message}`, true);
                }
            }
        );
    };

    const handleCardClick = (e) => {
        if (e.target.closest('.build-script-btn')) handleBuildScript();
        if (e.target.closest('.copy-text-btn')) handleCopyScript();
        if (e.target.closest('.generate-audio-btn')) handleGenerateAudio(e.target.closest('.generate-audio-btn'));
        if (e.target.closest('.save-story-btn')) handleSaveStory(e.target.closest('.save-story-btn'));
        if (e.target.closest('.delete-case-btn')) handleDeleteCase(e.target.closest('.delete-case-btn'));
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
                    if (error.message === 'MODEL_BUSY') {
                        showNotification('Model Overloaded', 'The AI is currently busy. Please try again in a few moments.', 'modelBusy');
                    } else {
                        showNotification('Error', 'Could not load the next script.', true);
                    }
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
                const [countData, frameworks] = await Promise.all([
                    apiCall('/api/business-cases/count'),
                    apiCall('/api/frameworks')
                ]);
                totalCases = countData.total;
                allFrameworks = frameworks;

                if (contentFeed[0] && contentFeed[0].frameworkId) {
                    selectedFrameworkId = contentFeed[0].frameworkId;
                } else {
                    const defaultFramework = allFrameworks.find(f => f.isDefault);
                    selectedFrameworkId = defaultFramework ? defaultFramework._id : null;
                }
                renderCurrentReel();
            } catch (error) {
                showNotification('Error', 'Could not load initial data.', true);
                renderCurrentReel(); // Render anyway
            }
        } else {
            fetchInitialData();
        }
    };

    init();
});
