	const { HfInference } = require('@huggingface/inference');
	const pdf = require('pdf-parse');
	const axios = require('axios');
	const { spawn } = require('child_process');
	const os = require('os');

	const hf = new HfInference('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');

	// Liste de mots à exclure
	const wordsToExclude = new Set([
	    'exemple', 'exemples', 'définition', 'définitions', 'exercice', 'exercices',
	    'méthode', 'propriété', 'propriétés', 'théorème', 'lemme', 'corollaire',
	    'proposition', 'remarque', 'note', 'attention', 'rappel'
	]);




	function checkSystemResources() {
	    const totalMemory = os.totalmem();
	    const freeMemory = os.freemem();
	    const cpuUsage = os.loadavg()[0]; // Charge moyenne sur 1 minute

	    console.log(`Mémoire totale: ${totalMemory / 1024 / 1024} MB`);
	    console.log(`Mémoire libre: ${freeMemory / 1024 / 1024} MB`);
	    console.log(`Utilisation CPU: ${cpuUsage}`);

	    if (freeMemory < 1024 * 1024 * 1024) { // Moins de 1 GB de mémoire libre
		console.warn("Attention: Faible mémoire disponible");
	    }
	    if (cpuUsage > 0.8) { // Charge CPU supérieure à 80%
		console.warn("Attention: Charge CPU élevée");
	    }
	}

	// Appelez cette fonction avant de lancer Ollama
	checkSystemResources();



	async function extractImportantConcepts(courses) {
	    let allConcepts = [];

	    for (const course of courses) {
		try {
		    const data = await pdf(course.pdfFile);
		    const concepts = extractConceptsFromText(data.text);
		    allConcepts = allConcepts.concat(concepts);
		} catch (error) {
		    console.error(`Erreur lors de l'extraction des concepts pour le cours ${course.title}:`, error);
		}
	    }

	    // Filtrer et nettoyer les concepts
	    allConcepts = allConcepts
		.filter(concept => 
		    !concept.match(/^\d+\s+sur\s+\d+$/) && // Supprime les "X sur Y"
		    concept.length > 3 && // Garde les concepts de plus de 3 caractères
		    !concept.startsWith('http') && // Supprime les URLs
		    !concept.match(/^\d+$/) && // Supprime les nombres seuls
		    !wordsToExclude.has(concept.toLowerCase().trim()) // Supprime les mots de la liste d'exclusion
		)
		.map(concept => {
		    // Supprime les numéros au début et nettoie les espaces
		    concept = concept.replace(/^\d+\)\s*/, '').trim();
		    // Supprime les mots de la liste d'exclusion au début du concept
		    const lowerConcept = concept.toLowerCase();
		    for (const word of wordsToExclude) {
		        if (lowerConcept.startsWith(word)) {
		            return concept.slice(word.length).trim();
		        }
		    }
		    return concept;
		});

	    // Supprimer les doublons et les concepts vides après nettoyage
	    allConcepts = [...new Set(allConcepts)].filter(concept => concept.length > 0);
	    console.log("Concepts extraits:", allConcepts);
	    return allConcepts;
	}

	function extractConceptsFromText(text) {
	    const lines = text.split('\n');
	    let concepts = [];
	    let currentFontSize = 0;
	    const titleFontSizes = new Set();

	    lines.forEach(line => {
		const trimmedLine = line.trim();
		if (trimmedLine && /^[A-Z0-9]/.test(trimmedLine)) {
		    const fontSize = estimateFontSize(line, text);
		    if (fontSize > currentFontSize) {
		        titleFontSizes.add(fontSize);
		    }
		    currentFontSize = fontSize;
		}
	    });

	    lines.forEach(line => {
		const trimmedLine = line.trim();
		if (trimmedLine && /^[A-Z0-9]/.test(trimmedLine)) {
		    const fontSize = estimateFontSize(line, text);
		    if (titleFontSizes.has(fontSize) && trimmedLine.length < 100) {
		        concepts.push(trimmedLine);
		    }
		}
	    });

	    return concepts;
	}

	function estimateFontSize(line, fullText) {
	    return line.length > 0 ? fullText.length / line.length : 0;
	}



	function getBackupConcepts(subject) {
	    const backupConceptsBySubject = {
		'mathématiques': ['probabilité', 'statistique', 'algèbre', 'géométrie', 'analyse', 'calcul différentiel', 'calcul intégral'],
		// Ajoutez d'autres sujets selon vos besoins
	    };
	    return backupConceptsBySubject[subject.toLowerCase()] || ['concept général'];
	}









	function generateExam(course, numExercises, difficulty) {
		console.log(`Début de la génération de l'examen: ${numExercises} exercices, difficulté ${difficulty}, cours: ${course.title}`);
		
		return new Promise((resolve, reject) => {
			const pythonProcess = spawn('python3', ['./scripts/generateExam.py']);
	
			let output = '';
			let errorOutput = '';
	
			pythonProcess.stdout.on('data', (data) => {
				output += data.toString();
			});
	
			pythonProcess.stderr.on('data', (data) => {
				errorOutput += data.toString();
			});
	
			pythonProcess.on('close', (code) => {
				if (code !== 0) {
					console.error(`Erreur lors de l'exécution du script Python: ${errorOutput}`);
					reject(new Error(`Script Python terminé avec le code ${code}`));
				} else {
					try {
						const parsedOutput = JSON.parse(output);
						resolve(parsedOutput.exercise);  // Assurez-vous que c'est "exercise" et non "exercises"
					} catch (err) {
						reject(new Error("Erreur lors de l'analyse de la sortie du script Python: " + err.message));
					}
				}
			});
		});
	}







module.exports = { generateExam };
