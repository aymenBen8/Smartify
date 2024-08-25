const { Ollama } = require('ollama');

const ollama = new Ollama();

async function generateExercise(difficulty, concept, teachingUnit) {
    const prompt = `Générez un exercice de ${teachingUnit} sur le concept de ${concept}. 
    L'exercice doit être adapté à un niveau ${difficulty}. 
    L'exercice doit être concis et clair. 
    IMPORTANT: Ne fournissez PAS de corrigé ni d'indices sur la façon de résoudre l'exercice.`;

    console.log("Requête envoyée à l'IA :", prompt);

    try {
        const response = await ollama.chat({
            model: 'phi3',
            messages: [{ role: 'user', content: prompt }],
            options: {
                temperature: 0.7,
            },
        });
        return response.message.content.trim();
    } catch (error) {
        console.error('Erreur lors de la génération de l\'exercice:', error);
        throw error;
    }
}

module.exports = { generateExercise };