// utils/scriptGenerator.js
// Contains helper functions for generating creative content from case studies.

const generateMoreOptions = (businessCase, type, extraHooks = []) => {
    const { company, industry, psychology, solution, problem, findings } = businessCase;
    let templates = [];
    if (type === 'hooks') {
        const dynamicHooks = [
            () => `How ${company} used ${psychology.split('&')[0].trim()} to solve a common ${industry} problem.`,
            () => `This company's secret isn't their product. It's this simple psychological trick.`,
            () => `If you think you're immune to marketing, wait until you see how ${company} changed their business.`
        ];
        const allHookOptions = [...extraHooks, ...dynamicHooks.map(fn => fn())];
        const shuffled = allHookOptions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
    } else if (type === 'buildUps') {
        templates = [
            () => `When a study published in '${businessCase.sources[0]}' analyzed this, they found a shocking correlation.`,
            () => `This works because of a cognitive bias that affects 99% of us, whether we realize it or not.`,
            () => `This isn't a new idea, but the way ${company} applied it is genius.`
        ];
    } else if (type === 'stories') {
        templates = [
            () => `${company} used a classic psychological tactic: **${psychology}**. They knew that by ${solution.toLowerCase()}, customers would feel a powerful, subconscious urge to respond. The result was clear: ${findings}.`,
            () => `The core of their strategy was **${psychology}**. Instead of a direct approach to solving '${problem.toLowerCase()}', they changed the environment. By ${solution.toLowerCase()}, they subtly guided customer behavior, leading to incredible results.`,
            () => `This is a textbook case of **${psychology.split('&')[0].trim()}** in the wild. The problem was ${problem.toLowerCase()}. The genius solution was ${solution.toLowerCase()}, which directly triggers this cognitive bias. Unsurprisingly, it worked: ${findings}.`
        ];
    } else if (type === 'psychologies') {
        templates = [
            () => `It all comes down to **${psychology}**. Our brains are wired to react this way because of our evolutionary need to fit in and trust others.`,
            () => `This is a textbook example of **${psychology.split('&')[0].trim()}**. It's about influencing decision-making by creating a specific emotional or social context, rather than just focusing on the product's features.`,
            () => `Why does this work? **${psychology}**. The company didn't change its product, it changed the psychological frame around the product, making it feel more valuable, trustworthy, or urgent.`
        ];
    }
    const options = new Set();
    while (options.size < 3 && templates.length > 0) {
        const randomIndex = Math.floor(Math.random() * templates.length);
        options.add(templates[randomIndex]());
        templates.splice(randomIndex, 1);
    }
    return Array.from(options);
};

module.exports = {
    generateMoreOptions
};
