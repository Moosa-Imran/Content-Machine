// public/js/framework.js
// Handles fetching and displaying the script generation framework.

document.addEventListener('DOMContentLoaded', () => {
    const frameworkContainer = document.getElementById('framework-container');

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

    const populateFramework = (framework) => {
        let html = '';
        for (const sectionKey in framework) {
            const section = framework[sectionKey];
            html += `
                <div class="mb-8">
                    <h3 class="text-xl font-semibold mb-2 text-slate-800 dark:text-white">${section.title}</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">${section.description}</p>
                    <ul class="space-y-3">
                        ${section.templates.map(template => `<li><code class="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded-md block text-slate-600 dark:text-slate-300">${template}</code></li>`).join('')}
                    </ul>
            `;

            // Add toggle for extra hooks if they exist in the data
            if (sectionKey === 'hooks' && section.extraHooks && section.extraHooks.length > 0) {
                html += `
                    <div class="mt-4">
                        <button class="extra-hooks-toggle flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                            <i data-lucide="chevron-down" class="w-4 h-4 transition-transform"></i>
                            <span>View Generic Viral Hooks</span>
                        </button>
                        <div class="extra-hooks-content hidden mt-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                            <ul class="space-y-3">
                                ${section.extraHooks.map(hook => `<li><code class="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded-md block text-slate-600 dark:text-slate-300">${hook}</code></li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            }

            html += `</div>`;
        }
        frameworkContainer.innerHTML = html;
        lucide.createIcons(); // Re-render icons for the new toggle

        // Add event listener for the toggle button
        frameworkContainer.querySelector('.extra-hooks-toggle')?.addEventListener('click', (e) => {
            const button = e.currentTarget;
            const content = button.nextElementSibling;
            const icon = button.querySelector('i');
            
            content.classList.toggle('hidden');
            icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        });
    };

    const loadFramework = async () => {
        frameworkContainer.innerHTML = `<div class="flex justify-center items-center py-20"><i data-lucide="refresh-cw" class="w-10 h-10 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();
        try {
            const framework = await apiCall('/api/get-framework');
            populateFramework(framework);
        } catch (error) {
            frameworkContainer.innerHTML = `<p class="text-center text-red-500 p-4">Failed to load framework. Please try again.</p>`;
        }
    };

    loadFramework();
});
