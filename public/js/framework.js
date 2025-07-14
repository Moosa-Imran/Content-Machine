// public/js/framework.js
// Handles fetching, displaying, and editing multiple script generation frameworks.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const frameworkListContainer = document.getElementById('framework-list-container');
    const frameworkEditorContainer = document.getElementById('framework-editor-container');
    const createNewFrameworkBtn = document.getElementById('create-new-framework-btn');

    // Confirmation Modal Elements
    const confirmModal = document.getElementById('confirm-modal');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmModalMessage = document.getElementById('confirm-modal-message');
    let confirmCallback = null;

    // Notification Modal Elements
    const notificationModal = document.getElementById('notification-modal');
    const notificationOkBtn = document.getElementById('notification-ok-btn');
    const notificationModalTitle = document.getElementById('notification-modal-title');
    const notificationModalMessage = document.getElementById('notification-modal-message');

    // --- STATE ---
    let currentFramework = null;

    // --- API & UI HELPERS ---
    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
                throw new Error(errorData.error);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
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

    const showNotification = (title, message, isError = false) => {
        notificationModalTitle.textContent = title;
        notificationModalMessage.textContent = message;
        
        const iconContainer = document.getElementById('notification-modal-icon-container');
        
        if (isError) {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-500/20';
            iconContainer.innerHTML = '<i data-lucide="alert-circle" class="h-6 w-6 text-red-600 dark:text-red-400"></i>';
        } else {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-500/20';
            iconContainer.innerHTML = '<i data-lucide="check-circle" class="h-6 w-6 text-green-600 dark:text-green-400"></i>';
        }
        
        notificationModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const hideNotification = () => {
        notificationModal.classList.add('hidden');
    };

    // --- CORE LOGIC ---

    const loadFrameworkList = async () => {
        frameworkListContainer.innerHTML = `<div class="flex justify-center items-center py-10"><i data-lucide="refresh-cw" class="w-8 h-8 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();
        try {
            const frameworks = await apiCall('/api/frameworks');
            renderFrameworkList(frameworks);
        } catch (error) {
            frameworkListContainer.innerHTML = `<p class="text-center text-red-500 p-4">Failed to load frameworks.</p>`;
        }
    };

    const renderFrameworkList = (frameworks) => {
        frameworkListContainer.innerHTML = frameworks.map(fw => `
            <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div>
                    <h3 class="font-semibold text-slate-800 dark:text-white">${fw.name}</h3>
                    ${fw.isDefault ? '<span class="text-xs bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium">Default</span>' : ''}
                </div>
                <div class="flex items-center gap-2">
                    <button class="edit-framework-btn p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md" data-id="${fw._id}" title="Edit">
                        <i data-lucide="edit" class="w-4 h-4 text-slate-600 dark:text-slate-300"></i>
                    </button>
                    ${!fw.isDefault ? `
                    <button class="delete-framework-btn p-2 hover:bg-red-500/10 rounded-md" data-id="${fw._id}" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    };

    const renderFrameworkEditor = (framework) => {
        currentFramework = framework;
        const sections = [
            { key: 'hooks', title: 'Hooks' },
            { key: 'buildUps', title: 'Build-Ups' },
            { key: 'stories', title: 'Stories' },
            { key: 'psychologies', title: 'Psychologies' }
        ];

        let editorHTML = `
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800 space-y-6">
                 <div>
                    <label for="frameworkName" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Framework Name</label>
                    <input type="text" id="frameworkName" value="${framework.name || ''}" class="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" ${framework.isDefault ? 'disabled' : ''}>
                 </div>
                 <div>
                    <h3 class="text-xl font-semibold mb-1 text-slate-800 dark:text-white">Overall Brand Prompt</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Give the AI overall context on your brand, tone of voice, and content goals.</p>
                    <textarea id="overallPrompt" class="w-full h-24 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">${framework.overallPrompt || ''}</textarea>
                 </div>
            </div>
        `;

        sections.forEach(section => {
            const promptKey = `${section.key}Prompt`;
            const examplesKey = `${section.key}Examples`;
            const promptValue = framework[promptKey] || '';
            const examplesValue = (framework[examplesKey] || []).join('\n');

            editorHTML += `
                <div class="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800" data-section-key="${section.key}">
                    <h3 class="text-xl font-semibold mb-1 text-slate-800 dark:text-white">${section.title}</h3>
                    <div class="mt-4">
                        <label for="${promptKey}" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Instruction Prompt for ${section.title}</label>
                        <textarea id="${promptKey}" class="w-full h-20 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">${promptValue}</textarea>
                    </div>
                    <div class="mt-4">
                        <label for="${examplesKey}" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Examples for ${section.title} (one per line)</label>
                        <textarea id="${examplesKey}" class="w-full h-40 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">${examplesValue}</textarea>
                    </div>
                </div>
            `;
        });
        
        const useFixedCta = framework.useFixedCta || false;
        const fixedCtaText = framework.fixedCtaText || '';
        const ctaPrompt = framework.ctasPrompt || '';
        const ctaExamples = (framework.ctasExamples || []).join('\n');

        editorHTML += `
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                <h3 class="text-xl font-semibold mb-1 text-slate-800 dark:text-white">Call to Action (CTA)</h3>
                <div class="mt-4 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
                    <label for="use-fixed-cta-toggle" class="flex items-center justify-between cursor-pointer">
                        <span class="flex flex-col">
                            <span class="font-semibold text-slate-700 dark:text-slate-200">Use Fixed CTA</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400">Always use the same CTA for every script.</span>
                        </span>
                        <div class="relative">
                            <input type="checkbox" id="use-fixed-cta-toggle" class="sr-only peer" ${useFixedCta ? 'checked' : ''}>
                            <div class="block bg-slate-200 dark:bg-slate-700 w-14 h-8 rounded-full peer-checked:bg-primary-600"></div>
                            <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
                        </div>
                    </label>
                </div>
                <div id="fixed-cta-container" class="mt-4 ${useFixedCta ? '' : 'hidden'}">
                     <label for="fixedCtaText" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Fixed CTA Text</label>
                     <input type="text" id="fixedCtaText" value="${fixedCtaText}" class="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                </div>
                <div id="dynamic-cta-container" class="mt-4 space-y-4 ${useFixedCta ? 'hidden' : ''}">
                    <div>
                        <label for="ctasPrompt" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Dynamic CTA Instruction Prompt</label>
                        <textarea id="ctasPrompt" class="w-full h-20 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">${ctaPrompt}</textarea>
                    </div>
                    <div>
                        <label for="ctasExamples" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Dynamic CTA Examples (one per line)</label>
                        <textarea id="ctasExamples" class="w-full h-40 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">${ctaExamples}</textarea>
                    </div>
                </div>
            </div>
            <div class="flex justify-end gap-4">
                <button id="cancel-edit-btn" class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                <button id="save-framework-btn" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg">Save Changes</button>
            </div>
        `;

        frameworkEditorContainer.innerHTML = editorHTML;
        frameworkEditorContainer.classList.remove('hidden');
        
        document.getElementById('use-fixed-cta-toggle').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.getElementById('fixed-cta-container').classList.toggle('hidden', !isChecked);
            document.getElementById('dynamic-cta-container').classList.toggle('hidden', isChecked);
        });
        document.getElementById('save-framework-btn').addEventListener('click', saveFramework);
        document.getElementById('cancel-edit-btn').addEventListener('click', hideEditor);
    };

    const saveFramework = async () => {
        const frameworkData = {
            _id: currentFramework._id,
            name: document.getElementById('frameworkName').value.trim(),
            overallPrompt: document.getElementById('overallPrompt').value.trim()
        };
        
        const sections = ['hooks', 'buildUps', 'stories', 'psychologies', 'ctas'];
        sections.forEach(key => {
            const promptKey = `${key}Prompt`;
            const examplesKey = `${key}Examples`;
            
            frameworkData[promptKey] = document.getElementById(promptKey)?.value.trim() || '';
            frameworkData[examplesKey] = document.getElementById(examplesKey)?.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line) || [];
        });

        frameworkData.useFixedCta = document.getElementById('use-fixed-cta-toggle').checked;
        frameworkData.fixedCtaText = document.getElementById('fixedCtaText').value.trim();

        try {
            await apiCall('/api/frameworks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ framework: frameworkData })
            });
            showNotification('Success!', 'Framework saved successfully.');
            hideEditor();
            loadFrameworkList();
        } catch (error) {
            showNotification('Error', 'Failed to save framework.', true);
        }
    };

    const deleteFramework = async (id) => {
        showConfirmModal(
            'Delete Framework?',
            'This will permanently delete this framework. This action cannot be undone.',
            async () => {
                try {
                    await apiCall(`/api/framework/${id}`, { method: 'DELETE' });
                    hideConfirmModal();
                    showNotification('Framework Deleted', 'The framework has been successfully deleted.');
                    loadFrameworkList();
                } catch (error) {
                    hideConfirmModal();
                    showNotification('Error', `Failed to delete framework: ${error.message}`, true);
                }
            }
        );
    };

    const hideEditor = () => {
        frameworkEditorContainer.innerHTML = '';
        frameworkEditorContainer.classList.add('hidden');
        currentFramework = null;
    };
    
    const handleListClick = async (e) => {
        const editBtn = e.target.closest('.edit-framework-btn');
        const deleteBtn = e.target.closest('.delete-framework-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const framework = await apiCall(`/api/framework/${id}`);
                renderFrameworkEditor(framework);
            } catch (error) {
                showNotification('Error', 'Could not load framework for editing.', true);
            }
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            deleteFramework(id);
        }
    };
    
    const handleCreateNew = () => {
        renderFrameworkEditor({ name: 'New Framework' });
    };

    // --- EVENT LISTENERS ---
    frameworkListContainer.addEventListener('click', handleListClick);
    createNewFrameworkBtn.addEventListener('click', handleCreateNew);
    confirmCancelBtn.addEventListener('click', hideConfirmModal);
    notificationOkBtn.addEventListener('click', hideNotification);
    confirmActionBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
    });

    // --- INITIALIZATION ---
    loadFrameworkList();
});
