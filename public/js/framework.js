// public/js/framework.js
// Handles fetching, displaying, and editing the script generation framework.

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

    const createTemplateHTML = (template = "") => {
        return `
            <div class="template-item flex items-start gap-2">
                <textarea class="w-full h-20 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">${template}</textarea>
                <button class="remove-template-btn p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-md">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            </div>
        `;
    };

    const renderSection = (key, title, description, templates, extraHooks = []) => {
        let templatesHTML = templates.map(createTemplateHTML).join('');

        let sectionHTML = `
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800" data-section-key="${key}">
                <h3 class="text-xl font-semibold mb-1 text-slate-800 dark:text-white">${title}</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">${description}</p>
                <div class="templates-container space-y-3">${templatesHTML}</div>
                <button class="add-template-btn mt-4 flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i>
                    Add Template
                </button>
        `;

        if (key === 'hooks' && extraHooks.length > 0) {
            let extraHooksHTML = extraHooks.map(createTemplateHTML).join('');
            sectionHTML += `
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button class="extra-hooks-toggle flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <i data-lucide="chevron-down" class="w-4 h-4 transition-transform"></i>
                        <span>View/Edit Generic Viral Hooks</span>
                    </button>
                    <div class="extra-hooks-content hidden mt-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700" data-section-key="extraHooks">
                         <p class="text-xs text-slate-400 dark:text-slate-500 mb-3">These high-performing hooks are mixed in with the dynamic templates above.</p>
                         <div class="templates-container space-y-3">${extraHooksHTML}</div>
                         <button class="add-template-btn mt-4 flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i>
                            Add Generic Hook
                        </button>
                    </div>
                </div>
            `;
        }

        sectionHTML += `</div>`;
        return sectionHTML;
    };

    const populateFrameworkEditor = (framework) => {
        const sections = [
            { key: 'hooks', title: 'Hooks', description: 'Dynamic templates and a list of reusable viral hooks.' },
            { key: 'buildUps', title: 'Build-Ups', description: 'Lines to create anticipation and bridge the hook to the main story.' },
            { key: 'stories', title: 'Stories', description: 'The core narrative templates explaining the problem, solution, and results.' },
            { key: 'psychologies', title: 'Psychologies', description: 'Templates for the concluding explanation of the psychological principle.' }
        ];

        let editorHTML = '';
        sections.forEach(section => {
            editorHTML += renderSection(section.key, section.title, section.description, framework[section.key] || [], framework.extraHooks);
        });

        frameworkContainer.innerHTML = editorHTML;
        lucide.createIcons();
    };

    const saveFramework = async () => {
        const frameworkData = {};
        document.querySelectorAll('[data-section-key]').forEach(sectionDiv => {
            const key = sectionDiv.dataset.sectionKey;
            const templates = Array.from(sectionDiv.querySelectorAll('.template-item textarea'))
                                   .map(textarea => textarea.value.trim())
                                   .filter(value => value);
            frameworkData[key] = templates;
        });

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
            populateFrameworkEditor(framework);
        } catch (error) {
            frameworkContainer.innerHTML = `<p class="text-center text-red-500 p-4">Failed to load framework. Please try again.</p>`;
        }
    };

    // Event Delegation
    frameworkContainer.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-template-btn');
        const removeBtn = e.target.closest('.remove-template-btn');
        const toggleBtn = e.target.closest('.extra-hooks-toggle');

        if (addBtn) {
            const container = addBtn.closest('[data-section-key]').querySelector('.templates-container');
            container.insertAdjacentHTML('beforeend', createTemplateHTML());
            lucide.createIcons();
        }
        if (removeBtn) {
            removeBtn.closest('.template-item').remove();
        }
        if (toggleBtn) {
            const content = toggleBtn.nextElementSibling;
            const icon = toggleBtn.querySelector('i');
            content.classList.toggle('hidden');
            if (icon) {
                icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    });

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
