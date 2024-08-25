import subprocess
import sys
import json
import time
import os

def log(message):
    print(json.dumps({"log": message}), flush=True)
    sys.stdout.flush()

def is_ollama_running():
    try:
        subprocess.run(['pgrep', '-f', 'ollama'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError:
        return False

def generate_exercise(difficulty="easy"):
    log("Début du script")
    start_time = time.time()

    log(f"Variables d'environnement: {json.dumps(dict(os.environ))}")
    log(f"Utilisateur actuel: {os.getlogin()}")

    if not is_ollama_running():
        print(json.dumps({"error": "Ollama n'est pas en cours d'exécution"}))
        sys.exit(1)

    prompt = f"Générez un exercice simple de mathématiques sur les probabilités. L'exercice doit être court et adapté à un niveau {difficulty}, et ne donne pas le corrigé."
    
    try:
        log("Appel d'Ollama")
        ollama_start = time.time()
        result = subprocess.run(['ollama', 'run', 'phi3', prompt], capture_output=True, text=True, timeout=900)
        ollama_end = time.time()
        log(f"Fin de l'appel d'Ollama. Durée: {ollama_end - ollama_start} secondes")

        if result.returncode != 0:
            print(json.dumps({"error": f"Erreur Ollama: {result.stderr}"}))
            sys.exit(1)
        
        exercise = result.stdout.strip()
        
        print(json.dumps({"exercise": exercise}))
    
    except subprocess.TimeoutExpired:
        print(json.dumps({"error": "Timeout: Ollama n'a pas répondu dans le temps imparti"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Erreur inattendue: {str(e)}"}))
        sys.exit(1)
    finally:
        end_time = time.time()
        log(f"Fin du script. Durée totale: {end_time - start_time} secondes")

if __name__ == "__main__":
    generate_exercise()  # Appel avec la difficulté par défaut "easy"