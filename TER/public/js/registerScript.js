// Gestionnaire d'événement pour le clic sur l'image de l'étudiant
document.getElementById('studentBtn').addEventListener('click', function() {
    document.getElementById('studentForm').style.display = 'block';
    document.getElementById('teacherForm').style.display = 'none';
});

// Gestionnaire d'événement pour le clic sur l'image du professeur
document.getElementById('teacherBtn').addEventListener('click', function() {
    document.getElementById('studentForm').style.display = 'none';
    document.getElementById('teacherForm').style.display = 'block';
});

// Gestionnaire d'événement pour le clic de changement de signin vers login
document.getElementById('loginLink').addEventListener('click', function(){
    document.getElementById('studentForm').style.display = "none";
    document.getElementById('teacherForm').style.display = "none";
    document.getElementById('loginForm').style.display = "block";
});

// Gestionnaire pour détecter le passage vers le sens inverse
document.getElementById('signinLink').addEventListener('click', function(){
    document.getElementById('studentForm').style.display = "block";
    document.getElementById('teacherForm').style.display = "none";
    document.getElementById('loginForm').style.display = "none";
});