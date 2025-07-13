// public/js/framework.js
// Handles fetching, displaying, and editing the new prompt-based script generation framework.

document.addEventListener('DOMContentLoaded', () => {
    const frameworkContainer = document.getElementById('framework-container');
    const saveBtn = document.getElementById('save-framework-btn');
    const resetBtn = document.getElementById('reset-framework-btn');
    
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

    const renderFrameworkEditor = (framework = {}) => {
        const sections = [
            { key: 'hooks', title: 'Hooks' },
            { key: 'buildUps', title: 'Build-Ups' },
            { key: 'stories', title: 'Stories' },
            { key: 'psychologies', title: 'Psychologies' }
        ];

        let editorHTML = `
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                <h3 class="text-xl font-semibold mb-1 text-slate-800 dark:text-white">Overall Brand Prompt</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Give the AI overall context on your brand, tone of voice, and content goals.</p>
                <textarea id="overallPrompt" class="w-full h-24 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">${framework.overallPrompt || ''}</textarea>
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
        
        // **NEW:** Add CTA Section HTML
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
        `;

        frameworkContainer.innerHTML = editorHTML;
        
        // Add event listener for the new toggle
        const useFixedCtaToggle = document.getElementById('use-fixed-cta-toggle');
        const fixedCtaContainer = document.getElementById('fixed-cta-container');
        const dynamicCtaContainer = document.getElementById('dynamic-cta-container');

        useFixedCtaToggle.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            fixedCtaContainer.classList.toggle('hidden', !isChecked);
            dynamicCtaContainer.classList.toggle('hidden', isChecked);
        });
    };

    const saveFramework = async () => {
        const frameworkData = {
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

        // **NEW:** Save CTA settings
        frameworkData.useFixedCta = document.getElementById('use-fixed-cta-toggle').checked;
        frameworkData.fixedCtaText = document.getElementById('fixedCtaText').value.trim();

        try {
            await apiCall('/api/save-framework', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ framework: frameworkData })
            });
            showNotification('Success!', 'Framework saved successfully.');
        } catch (error) {
            showNotification('Error', 'Failed to save framework.', true);
        }
    };

    const resetFramework = () => {
        showConfirmModal(
            'Reset Framework?',
            'This will discard any custom changes and restore the original default templates. This action cannot be undone.',
            async () => {
                try {
                    await apiCall('/api/reset-framework', { method: 'POST' });
                    hideConfirmModal();
                    showNotification('Framework Reset', 'The framework has been restored to its default settings.');
                    loadFramework();
                } catch (error) {
                    hideConfirmModal();
                    showNotification('Error', 'Failed to reset framework.', true);
                }
            }
        );
    };

    const loadFramework = async () => {
        frameworkContainer.innerHTML = `<div class="flex justify-center items-center py-20"><i data-lucide="refresh-cw" class="w-10 h-10 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();
        try {
            const framework = await apiCall('/api/get-framework');
            renderFrameworkEditor(framework);
        } catch (error) {
            frameworkContainer.innerHTML = `<p class="text-center text-red-500 p-4">Failed to load framework. Please try again.</p>`;
        }
    };

    saveBtn.addEventListener('click', saveFramework);
    resetBtn.addEventListener('click', resetFramework);
    confirmCancelBtn.addEventListener('click', hideConfirmModal);
    notificationOkBtn.addEventListener('click', hideNotification);
    confirmActionBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
    });

    loadFramework();
});
