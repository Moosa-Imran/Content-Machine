// utils/scriptGenerator.js
// Contains helper functions for generating creative content from case studies.

// This function is now synchronous and expects the framework to be passed in.
const generateMoreOptions = (businessCase, type, framework, extraHooks = []) => {
    // Defensive check for the framework object
    if (!framework || typeof framework !== 'object') {
        console.error("Invalid or missing framework provided to generateMoreOptions");
        return [];
    }
    
    const { company, industry, psychology, solution, problem, findings, sources } = businessCase;
    
    // A safe way to replace placeholders like {company} without using eval().
    const fillTemplate = (template) => {
        // Ensure template is a string before trying to replace
        if (typeof template !== 'string') {
            console.warn('Encountered non-string template:', template);
            return '';
        }
        const source = sources && sources.length > 0 ? sources[0] : 'a recent study';
        // Handle cases where psychology might have multiple parts, e.g., "Reciprocity & Honesty"
        const mainPsychology = psychology ? psychology.split('&')[0].trim() : 'a psychological principle';

        return template
            .replace(/{company}/g, company || 'A Company')
            .replace(/{industry}/g, industry || 'an industry')
            .replace(/{psychology}/g, mainPsychology)
            .replace(/{solution}/g, solution ? solution.toLowerCase() : 'a clever tactic')
            .replace(/{problem}/g, problem ? problem.toLowerCase() : 'a common problem')
            .replace(/{findings}/g, findings || 'significant results')
            .replace(/{source}/g, source);
    };

    if (type === 'hooks') {
        // Defensive check to ensure framework.hooks is an array
        const frameworkHooks = Array.isArray(framework.hooks) ? framework.hooks : [];
        const dynamicHooks = frameworkHooks.map(fillTemplate);
        
        // Defensive check for extraHooks
        const safeExtraHooks = Array.isArray(extraHooks) ? extraHooks : [];
        
        const allHookOptions = [...safeExtraHooks, ...dynamicHooks];
        const shuffled = allHookOptions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
    } 
    
    // Defensive check for other types
    const templatesSource = framework[type];
    if (!Array.isArray(templatesSource)) {
        console.warn(`Framework type '${type}' is not an array.`, templatesSource);
        return [];
    }

    const templates = templatesSource.map(fillTemplate);
    const shuffledTemplates = templates.sort(() => 0.5 - Math.random());
    return shuffledTemplates.slice(0, 3);
};

module.exports = {
    generateMoreOptions
};
