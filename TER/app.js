const os = require('os');
const nodemailer = require('nodemailer');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const Ollama = require('ollama');
const storage = multer.memoryStorage(); // Utiliser la mémoire comme stockage temporaire
const upload = multer({ storage: storage });
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const schedule = require('node-schedule');
const { generateExam } = require('./services/generateurExam');
const PDFDocument = require('pdfkit');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
fs.writeFileSync('env_nodejs.txt', Object.entries(process.env).map(([key, value]) => `${key}=${value}`).join('\n'));
const { spawn } = require('child_process');
// Configuration socket.io
const http = require('http');
const socketIo = require('socket.io');
const { ExpressPeerServer } = require('peer');
const { generateExercise } = require('./services/ollamaService');

const app = express();



//chargement clé https
const options = {
    key: fs.readFileSync('/home/aymen/Bureau/TER/key.pem'),
    cert: fs.readFileSync('/home/aymen/Bureau/TER/cert.pem')
  };







// CONFIGURATION SERVEUR SOCKET IO
// Créer le serveur HTTP
// CONFIGURATION SERVEUR SOCKET IO
// Créer le serveur HTTP
const server = https.createServer(options, app);
app.use(cors());
// Initialiser Socket.io
const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
// Initialiser le serveur Peer
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/'
});
app.use('/peerjs', peerServer);

// Connexion à MongoDB
mongoose.connect('mongodb://localhost:27017/myapp')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Définition du schéma d'utilisateur avec Mongoose
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    firstName: { type: String, required: false },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['student', 'teacher'] }, // Nouveau champ pour le rôle
    age: Number, // Spécifique aux étudiants
    class: String, // Spécifique aux étudiants
    experience: Number, // Spécifique aux professeurs
    teachingUnit: String, // Spécifique aux professeurs
    phone: String, // Nouveau champ pour le téléphone
    emailNotifications: Boolean,
    pushNotifications: Boolean,
    loginHistory: [{
        date: Date,
        location: String
    }],
    profilePicture: { type: Buffer }
});

const User = mongoose.model('User', userSchema);


//schema pour message
const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const Message = mongoose.model('Message', messageSchema);


//schema pour examen
const examSchema = new mongoose.Schema({
    title: { type: String, required: true },
    questions: [{
        question: String,
        options: [String],
        correctAnswer: String
    }],
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Exam = mongoose.model('Exam', examSchema);


// Schéma cours
const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pdfFile: { type: Buffer, required: true },
    uploadDate: { type: Date, default: Date.now },
    teachingUnit: { type: String, required: true }, // Nouveau champ
    discipline: { type: String, required: true },  // Nouvelle discipline
    niveau: { type: String, required: true },      // Nouveau champ pour le niveau
    annee: { type: Number, required: true }        // Nouveau champ pour l'année
});

const Course = mongoose.model('Course', courseSchema);

const videoCourseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teachingUnit: { type: String, required: true }, // Ajout de l'unité d'enseignement
    sessions: [{
        date: { type: Date, required: true },
        duration: { type: Number, required: true },
        details: { type: String, required: true }
    }]
});

const VideoCourse = mongoose.model('VideoCourse', videoCourseSchema);



// Schéma d'inscription
const enrollmentSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    videoCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoCourse', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, required: true },
    enrollmentDate: { type: Date, default: Date.now }
});

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);


// Schéma emploi du temps
const scheduleSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    events: [{
        title: { type: String, required: true },
        start: { type: Date, required: true },
        end: { type: Date, required: true },
        type: { type: String, enum: ['course', 'videoCourse'], required: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoCourse' }
    }]
});

const Schedule = mongoose.model('Schedule', scheduleSchema);


//Schéma quizz
const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teachingUnit: { type: String, required: true },
    questions: [{
        question: { type: String, required: true },
        correctAnswer: { type: String, required: true },
        incorrectAnswer1: { type: String, required: true },
        incorrectAnswer2: { type: String, required: true },
        incorrectAnswer3: { type: String, required: true }
    }],
    createdAt: { type: Date, default: Date.now }
});

function arrayLimit(val) {
    return val.length === 3;
}

const Quiz = mongoose.model('Quiz', quizSchema);



// Object to store user information
const users = {};

async function getUsername(userId) {
    if (users[userId]) {
        return users[userId];
    }
    const user = await User.findById(userId);
    if (user) {
        const username = `${user.firstName} ${user.lastName}`;
        users[userId] = username;
        return username;
    }
    return 'Unknown User';
}

io.on('connection', socket => {
    console.log('New user connected');

    socket.on('join-room', async (roomId, userId) => {
        try {
            console.log(`User ${userId} joined room ${roomId}`);
            socket.join(roomId);

            // Envoyer la liste des utilisateurs actuels dans la salle au nouvel utilisateur
            const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
            socket.emit('all-users', usersInRoom.filter(id => id !== socket.id));

            // Informer les autres utilisateurs de la salle qu'un nouvel utilisateur s'est connecté
            socket.to(roomId).emit('user-connected', userId);

            // Gestion des messages
            socket.on('message', message => {
                io.to(roomId).emit('createMessage', message);
            });

            // Gestion de la déconnexion
            socket.on('disconnect', () => {
                console.log(`User ${userId} disconnected from room ${roomId}`);
                socket.to(roomId).emit('user-disconnected', userId);
            });

        } catch (error) {
            console.error('Error in join-room event:', error);
            socket.emit('error', 'An error occurred while joining the room');
        }
    });

    socket.on('error', (error) => {
        console.error('Socket encountered error: ', error.message);
        socket.emit('error', 'An unexpected error occurred');
    });
});



app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile('construction.html', { root: __dirname + '/public' });
});

// Configuration nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'smartifyplatform@gmail.com',
        pass: 'jpnm bdho egdr bcrs '
    }
});

// Page d'inscription
app.get('/register', (req, res) => {
    res.render('register');
});

// Traitement de l'inscription
app.post('/register', async (req, res) => {
    const { username, firstName, lastName, email, password, confirmPassword, role, age, class: userClass, experience, teachingUnit } = req.body;

    try {
        // Vérifier si l'email existe déjà
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.send('Email déjà utilisé');
        }

        // Vérifier que les mots de passe correspondent
        if (password !== confirmPassword) {
            return res.send('Les mots de passe ne correspondent pas');
        }

        // Hasher le mot de passe avant de le stocker
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer un nouvel utilisateur avec toutes les informations collectées
        const newUser = new User({
            username,
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role,
            age: role === 'student' ? age : undefined,
            class: role === 'student' ? userClass : undefined,
            experience: role === 'teacher' ? experience : undefined,
            teachingUnit: role === 'teacher' ? teachingUnit : undefined
        });

        await newUser.save();
        // Envoyer l'e-mail de confirmation
        const mailOptions = {
            from: 'smartifyplatform@gmail.com',
            to: email,
            subject: 'Confirmation de création de compte',
            text: `Bonjour ${firstName},\n\nVotre compte a été créé avec succès !\n\nCordialement,\nL'équipe Smartify`
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erreur lors de l\'envoi de l\'email:', error);
            } else {
                console.log('Email envoyé:', info.response);
            }
        });

        res.redirect('/login');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Une erreur est survenue lors de l\'inscription');
    }
});

// Page de connexion
app.get('/login', (req, res) => {
    res.render('login');
});

// Route de déconnexion
app.get('/logout', (req, res) => {
    // Déconnecter l'utilisateur en supprimant la session
    req.session.destroy(err => {
        if (err) {
            console.error('Error logging out:', err);
            res.status(500).send('Une erreur est survenue lors de la déconnexion');
        } else {
            res.redirect('/login'); // Rediriger vers la page de connexion
        }
    });
});

// Traitement de la connexion
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Trouver l'utilisateur dans la base de données
        const user = await User.findOne({ username });
        if (!user) {
            return res.send('Utilisateur non trouvé');
        }

        // Vérifier le mot de passe
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            // Authentification réussie
            req.session.username = username;
            req.session.firstName = user.firstName; // Ajouter le prénom à la session
            res.redirect('/userSpace');
        } else {
            res.send('Mot de passe incorrect');
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Une erreur est survenue lors de la connexion');
    }
});

// Page de tableau de bord
app.get('/userSpace', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            
            if (user.role === 'student') {
                const enrollments = await Enrollment.find({ student: user._id })
                    .populate('videoCourse')
                    .populate('session');

                // Récupérer le dernier message reçu
                const lastMessage = await Message.findOne({ receiver: user._id })
                    .sort({ timestamp: -1 })
                    .populate('sender', 'username')
                    .limit(1);

                res.render('userSpace', { 
                    username: req.session.username, 
                    enrollments: enrollments,
                    lastMessage: lastMessage
                });
            } else if (user.role === 'teacher') {
                res.render('teacherSpace', { username: req.session.username });
            } else {
                res.send('Rôle d\'utilisateur non valide');
            }
        } catch (error) {
            console.error('Error fetching user information:', error);
            res.status(500).send('Une erreur est survenue lors de la récupération des informations utilisateur');
        }
    } else {
        res.redirect('/login');
    }
});

// Route pour afficher la page des cours pour les professeurs
app.get('/courses', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                // Récupérer les cours ajoutés par le professeur
                const courses = await Course.find({ professor: user._id });
                res.render('coursProfesseur', { user, courses });
            } else {
                res.redirect('/login');
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
            res.status(500).send('Une erreur est survenue lors de la récupération des cours');
        }
    } else {
        res.redirect('/login');
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                //Ajout cours//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Route pour ajouter un nouveau cours en PDF
app.post('/add-course', upload.single('pdfFile'), async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                // Normaliser l'unité d'enseignement en minuscule
                const teachingUnit = user.teachingUnit.toLowerCase();

                // Créer un nouveau cours avec les informations fournies
                const newCourse = new Course({
                    title: req.body.title,
                    description: req.body.description,
                    professor: user._id,
                    teachingUnit: teachingUnit, // Ajouter l'unité d'enseignement normalisée
                    discipline: req.body.discipline, // Récupérer la discipline choisie
                    niveau: req.body.niveau,         // Récupérer le niveau d'étude
                    annee: req.body.annee,           // Récupérer l'année d'étude
                    pdfFile: req.file.buffer
                });

                await newCourse.save();
                res.redirect('/courses');
            } else {
                res.status(403).send('Non autorisé');
            }
        } catch (error) {
            console.error('Error adding course:', error);
            res.status(500).send('Une erreur est survenue lors de l\'ajout du cours');
        }
    } else {
        res.redirect('/login');
    }
});


// Route pour afficher ou télécharger un fichier spécifique
// Route pour télécharger un fichier PDF de cours
app.get('/download-course/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (course) {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', `attachment; filename="${course.title}.pdf"`);
            res.send(course.pdfFile);
        } else {
            res.status(404).send('Cours non trouvé');
        }
    } catch (error) {
        console.error('Error downloading course PDF:', error);
        res.status(500).send('Une erreur est survenue lors du téléchargement du PDF');
    }
});

// Pour s'assurer que le fichier a bien été enregistré
app.post('/add-course', upload.single('pdfFile'), async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                // Créer un nouveau cours avec les informations fournies
                const newCourse = new Course({
                    title: req.body.title,
                    description: req.body.description,
                    professor: user._id,
                    pdfFile: req.file.buffer
                });

                await newCourse.save();
                res.redirect('/courses');
            } else {
                res.status(403).send('Non autorisé');
            }
        } catch (error) {
            console.error('Error adding course:', error);
            res.status(500).send('Une erreur est survenue lors de l\'ajout du cours');
        }
    } else {
        res.redirect('/login');
    }
});

// Route pour traiter le fichier téléchargé
app.post('/upload', upload.single('pdfFile'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).send('Aucun fichier téléchargé.');
        }

        // Utilisation de GridFS pour stocker le fichier
        // Vous pouvez aussi choisir de sauvegarder le fichier localement ou sur un service cloud
        // Exemple de sauvegarde avec GridFS:
        const GridFSBucket = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(GridFSBucket, {
            bucketName: 'pdfs'
        });

        const uploadStream = bucket.openUploadStream(file.originalname, {
            contentType: 'application/pdf'
        });

        uploadStream.end(file.buffer);

        uploadStream.on('error', (error) => {
            console.error('Erreur lors du stockage du fichier', error);
            return res.status(500).send('Erreur lors du stockage du fichier');
        });

        uploadStream.on('finish', () => {
            res.send('Fichier téléchargé avec succès');
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement du fichier', error);
        res.status(500).send('Erreur lors du téléchargement');
    }
});


// Route pour supprimer un cours
app.delete('/delete-course/:id', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                const courseId = req.params.id;
                const course = await Course.findById(courseId);

                if (!course) {
                    return res.status(404).json({ message: 'Cours non trouvé' });
                }

                // Vérifier si le professeur est bien le propriétaire du cours
                if (course.professor.toString() !== user._id.toString()) {
                    return res.status(403).json({ message: 'Non autorisé à supprimer ce cours' });
                }

                await Course.findByIdAndDelete(courseId);
                res.json({ message: 'Cours supprimé avec succès' });
            } else {
                res.status(403).json({ message: 'Non autorisé' });
            }
        } catch (error) {
            console.error('Error deleting course:', error);
            res.status(500).json({ message: 'Une erreur est survenue lors de la suppression du cours' });
        }
    } else {
        res.status(401).json({ message: 'Non authentifié' });
    }
});




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        //MODIFICATION DE PROFIL ETUDIANT//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ROUTE POUR LA PAGE DE MODIFICATION DE PROFIL
app.get('/modifier-profil-etudiant', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user) {
                res.render('modifierProfilEtudiant', { user });
            } else {
                res.redirect('/login');
            }
        } catch (error) {
            console.error('Error fetching user information:', error);
            res.status(500).send('Une erreur est survenue lors de la récupération des informations utilisateur');
        }
    } else {
        res.redirect('/login');
    }
});

// TRAITEMENT DES MISE À JOUR
app.post('/update-profile', upload.single('profilePicture'), async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user) {
                // Mettre à jour seulement les champs fournis
                if (req.body.lastName) user.lastName = req.body.lastName;
                if (req.body.email) user.email = req.body.email;
                if (req.body.class) user.class = req.body.class;
                if (req.body.phone) user.phone = req.body.phone;

                // Ne pas mettre à jour le username ici pour éviter les conflits
                // Si vous voulez permettre le changement de username, 
                // il faudra gérer cela séparément et avec précaution

                // Vérifier si un nouveau mot de passe a été fourni
                if (req.body.password && req.body.password === req.body.confirmPassword) {
                    user.password = await bcrypt.hash(req.body.password, 10);
                }

                // Gérer le téléchargement de la photo de profil
                if (req.file) {
                    user.profilePicture = req.file.buffer;
                }

                await user.save();
                res.redirect('/userSpace');
            } else {
                res.status(404).send('Utilisateur non trouvé');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).send('Une erreur est survenue lors de la mise à jour du profil');
        }
    } else {
        res.redirect('/login');
    }
});

// TÉLÉCHARGEMENT DE DONNÉES
app.post('/download-data', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user) {
                // Créez un objet avec les données de l'utilisateur
                const userData = {
                    username: user.username,
                    email: user.email,
                    // Ajoutez d'autres champs selon besoin
                };
                res.json(userData);
            } else {
                res.status(404).send('Utilisateur non trouvé');
            }
        } catch (error) {
            console.error('Error downloading user data:', error);
            res.status(500).send('Une erreur est survenue lors du téléchargement des données');
        }
    } else {
        res.redirect('/login');
    }
});

// ROUTE POUR AFFICHER L'IMAGE TÉLÉCHARGÉE
app.get('/profile-picture', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.profilePicture) {
                res.contentType('image/jpeg');
                res.send(user.profilePicture);
            } else {
                // Redirige vers une image par défaut si aucune image de profil n'est trouvée
                res.redirect('/images/default-profile.jpg');
            }
        } catch (error) {
            console.error('Error fetching profile picture:', error);
            res.status(500).send('Server error');
        }
    } else {
        res.status(401).send('Unauthorized');
    }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                        //MODIFICATION DE PROFIL PROFESSEUR//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ROUTE POUR LA PAGE DE MODIFICATION DE PROFIL
app.get('/modifier-profil-professeur', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user) {
                res.render('modifierProfilProf', { user });
            } else {
                res.redirect('/login');
            }
        } catch (error) {
            console.error('Error fetching user information:', error);
            res.status(500).send('Une erreur est survenue lors de la récupération des informations utilisateur');
        }
    } else {
        res.redirect('/login');
    }
});

// TRAITEMENT DES MISES À JOUR
app.post('/update-profile-teacher', upload.single('profilePicture'), async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                // Mettre à jour seulement les champs fournis
                if (req.body.lastName) user.lastName = req.body.lastName;
                if (req.body.email) user.email = req.body.email;
                if (req.body.experience) user.experience = req.body.experience;
                if (req.body.teachingUnit) user.teachingUnit = req.body.teachingUnit;
                if (req.body.phone) user.phone = req.body.phone;

                // Ne pas mettre à jour le username ici pour éviter les conflits
                // Si vous voulez permettre le changement de username, 
                // il faudra gérer cela séparément et avec précaution

                // Vérifier si un nouveau mot de passe a été fourni
                if (req.body.password && req.body.password === req.body.confirmPassword) {
                    user.password = await bcrypt.hash(req.body.password, 10);
                }

                // Gérer le téléchargement de la photo de profil
                if (req.file) {
                    user.profilePicture = req.file.buffer;
                }

                await user.save();
                res.redirect('/userSpace');
            } else {
                res.status(404).send('Utilisateur non trouvé');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).send('Une erreur est survenue lors de la mise à jour du profil');
        }
    } else {
        res.redirect('/login');
    }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                    //Cours Videos//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/add-video-course', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                const courses = await VideoCourse.find({ professor: user._id });
                res.render('coursVideo', { user, courses });
            } else {
                res.redirect('/login');
            }
        } catch (error) {
            console.error('Error fetching video courses:', error);
            res.status(500).send('Une erreur est survenue lors de la récupération des cours vidéo');
        }
    } else {
        res.redirect('/login');
    }
});

// Route pour ajouter une session de cours (une ou plusieurs séances) et afficher les sessions ajoutées
app.post('/save-video-course', async (req, res) => {
    try {
        const { courseTitle, sessionDate, sessionTime, sessionDuration, sessionDetails } = req.body;
        const sessions = sessionDate.map((date, index) => ({
            date: new Date(`${date}T${sessionTime[index]}`),
            duration: sessionDuration[index],
            details: sessionDetails[index]
        }));
        const user = await User.findOne({ username: req.session.username });
        if (user && user.role === 'teacher') {
            const newCourse = new VideoCourse({
                title: courseTitle,
                professor: user._id,
                teachingUnit: user.teachingUnit,
                sessions
            });
            await newCourse.save();

            // Mise à jour de l'emploi du temps du professeur
            let schedule = await Schedule.findOne({ user: user._id });
            if (!schedule) {
                schedule = new Schedule({ user: user._id, events: [] });
            }

            for (const session of sessions) {
                const endTime = new Date(session.date.getTime() + session.duration * 60000);
                schedule.events.push({
                    title: courseTitle,
                    start: session.date,
                    end: endTime,
                    type: 'videoCourse',
                    courseId: newCourse._id
                });

                // Planifier l'envoi d'e-mails aux étudiants inscrits
                const enrolledStudents = await Enrollment.find({ videoCourse: newCourse._id });
                for (const enrollment of enrolledStudents) {
                    const student = await User.findById(enrollment.student);
                    scheduleEmail(student.email, newCourse.title, session.date);
                }

                // Envoyer un email de rappel au professeur
                scheduleEmail(user.email, newCourse.title, session.date);
            }

            await schedule.save();

            const courses = await VideoCourse.find({ professor: user._id });
            res.render('coursVideo', { user, courses });
        } else {
            res.status(403).send('Non autorisé');
        }
    } catch (error) {
        console.error('Error saving video course:', error);
        res.status(500).send('Erreur lors de l\'enregistrement du cours vidéo');
    }
});




// Affichage des sessions dispos
// Route pour afficher les cours vidéo pour les enseignants
app.get('/courses-video', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                const courses = await VideoCourse.find({ professor: user._id });
                res.render('coursVideo', { user, courses });
            } else {
                res.redirect('/login');
            }
        } catch (error) {
            console.error('Error fetching video courses:', error);
            res.status(500).send('Une erreur est survenue lors de la récupération des cours vidéo');
        }
    } else {
        res.redirect('/login');
    }
});

// Route pour rejoindre une session vidéo
app.get('/video-session/:id', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    try {
        const sessionId = req.params.id;
        const user = await User.findOne({ username: req.session.username });

        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        const session = await VideoCourse.findOne({ 'sessions._id': sessionId }, { 'sessions.$': 1 }).populate('professor');
        
        if (session) {
            const sessionStartTime = new Date(session.sessions[0].date);
            const sessionEndTime = new Date(sessionStartTime.getTime() + session.sessions[0].duration * 60000);
            const now = new Date();

            if (now >= sessionStartTime && now <= sessionEndTime) {
                // Rediriger vers le salon vidéo si l'heure du cours est arrivée
                res.render('videoChat', { roomId: sessionId, userRole: user.role }); // Passer le roomId et le role de l'utilisateur
            } else if (now < sessionStartTime) {
                res.send('Le cours n\'a pas encore commencé');
            } else {
                res.send('Le cours est terminé');
                // Optionnel: supprimer la session si elle est terminée
                await VideoCourse.updateOne(
                    { 'sessions._id': sessionId },
                    { $pull: { sessions: { _id: sessionId } } }
                );
            }
        } else {
            res.status(404).send('Session non trouvée');
        }
    } catch (error) {
        console.error('Error accessing video session:', error);
        res.status(500).send('Erreur lors de l\'accès à la session vidéo');
    }
});





// Route pour obtenir les détails d'un cours vidéo pour la modification
app.get('/edit-video-course/:id', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                const courseId = req.params.id;
                const course = await VideoCourse.findById(courseId);

                if (!course) {
                    return res.status(404).json({ message: 'Cours vidéo non trouvé' });
                }

                if (course.professor.toString() !== user._id.toString()) {
                    return res.status(403).json({ message: 'Non autorisé à modifier ce cours' });
                }

                res.json(course);
            } else {
                res.status(403).json({ message: 'Non autorisé' });
            }
        } catch (error) {
            console.error('Error fetching video course details:', error);
            res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des détails du cours vidéo' });
        }
    } else {
        res.status(401).json({ message: 'Non authentifié' });
    }
});

// Route pour mettre à jour un cours vidéo
app.put('/update-video-course/:id', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                const courseId = req.params.id;
                const { courseTitle, sessions } = req.body;

                const course = await VideoCourse.findById(courseId);

                if (!course) {
                    return res.status(404).json({ message: 'Cours vidéo non trouvé' });
                }

                if (course.professor.toString() !== user._id.toString()) {
                    return res.status(403).json({ message: 'Non autorisé à modifier ce cours' });
                }

                course.title = courseTitle;
                course.sessions = sessions.map(session => ({
                    date: new Date(session.date),
                    duration: session.duration,
                    details: session.details
                }));

                await course.save();

                // Mettre à jour l'emploi du temps
                await Schedule.updateMany(
                    { user: user._id, 'events.courseId': courseId },
                    { $pull: { events: { courseId: courseId } } }
                );

                const schedule = await Schedule.findOne({ user: user._id });
                for (const session of course.sessions) {
                    const endTime = new Date(session.date.getTime() + session.duration * 60000);
                    schedule.events.push({
                        title: course.title,
                        start: session.date,
                        end: endTime,
                        type: 'videoCourse',
                        courseId: course._id
                    });
                }
                await schedule.save();

                res.json({ message: 'Cours vidéo mis à jour avec succès', course });
            } else {
                res.status(403).json({ message: 'Non autorisé' });
            }
        } catch (error) {
            console.error('Error updating video course:', error);
            res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour du cours vidéo' });
        }
    } else {
        res.status(401).json({ message: 'Non authentifié' });
    }
});





//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                //Afficher les cours pour les étudiants 
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/ressourcesEtudiant', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    try {
        // Récupérer les unités d'enseignement distinctes des professeurs et les normaliser
        const teachingUnits = await User.distinct('teachingUnit', { role: 'teacher' });
        const normalizedUnits = teachingUnits.map(unit => unit.toLowerCase());
        const uniqueUnits = [...new Set(normalizedUnits)];

        // Récupérer les paramètres de requête pour le filtrage, le tri et la pagination
        const { discipline, niveau, annee, page = 1, limit = 10, sort = 'title' } = req.query;
        const filters = {};

        if (discipline) filters.discipline = discipline;
        if (niveau) filters.niveau = niveau;
        if (annee) filters.annee = annee;

        const coursesQuery = Course.find(filters)
            .select('title _id teachingUnit discipline niveau annee')
            .sort({ [sort]: 1 }) // Tri par le champ spécifié, par défaut par titre
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const [files, totalCourses] = await Promise.all([
            coursesQuery.exec(),
            Course.countDocuments(filters) // Compter le nombre total de documents pour les filtres appliqués
        ]);

        const totalPages = Math.ceil(totalCourses / limit);

        res.render('ressourcesEtudiant', {
            files,
            uniqueUnits,
            totalPages,
            currentPage: parseInt(page),
            sort,
            filters: { discipline, niveau, annee }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des ressources:', error);
        res.status(500).send('Erreur lors de la récupération des ressources');
    }
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                //Cours video étudiant
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Route pour afficher les sessions de cours vidéo pour les étudiants
// Route pour afficher les sessions de cours vidéo pour les étudiants
app.get('/student-video-courses', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    try {
        const videoCourses = await VideoCourse.find().populate('professor', 'firstName lastName teachingUnit');
        res.render('studentVideoCourses', { videoCourses });
    } catch (error) {
        console.error('Erreur lors de la récupération des cours vidéo:', error);
        res.status(500).send('Erreur lors de la récupération des cours vidéo');
    }
});

// Route pour afficher les détails d'un cours vidéo spécifique
app.get('/video-course-details/:id', async (req, res) => {
    try {
        const courseId = req.params.id;
        const videoCourse = await VideoCourse.findById(courseId).populate('professor', 'firstName lastName teachingUnit');
        if (!videoCourse) {
            return res.status(404).send('Cours vidéo non trouvé');
        }
        res.render('videoCourseDetails', { videoCourse });
    } catch (error) {
        console.error('Erreur lors de la récupération des détails du cours vidéo:', error);
        res.status(500).send('Erreur lors de la récupération des détails du cours vidéo');
    }
});

// Route pour gérer l'inscription aux sessions vidéo
app.post('/enroll', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findOne({ username: req.session.username });
        const { courseId, sessionId } = req.body;
        
        const existingEnrollment = await Enrollment.findOne({
            student: user._id,
            videoCourse: courseId,
            session: sessionId
        });
        
        if (existingEnrollment) {
            return res.send('Vous êtes déjà inscrit à cette session.');
        }
        
        const newEnrollment = new Enrollment({
            student: user._id,
            videoCourse: courseId,
            session: sessionId
        });
        await newEnrollment.save();

        // Mise à jour de l'emploi du temps de l'étudiant
        const course = await VideoCourse.findById(courseId);
        const session = course.sessions.id(sessionId);
        
        let schedule = await Schedule.findOne({ user: user._id });
        if (!schedule) {
            schedule = new Schedule({ user: user._id, events: [] });
        }

        const endTime = new Date(session.date.getTime() + session.duration * 60000);
        schedule.events.push({
            title: course.title,
            start: session.date,
            end: endTime,
            type: 'videoCourse',
            courseId: course._id
        });

        await schedule.save();

        res.redirect('/userSpace');
    } catch (error) {
        console.error('Erreur lors de l\'inscription à la session vidéo:', error);
        res.status(500).send('Erreur lors de l\'inscription à la session vidéo');
    }
});


//Messagerie
app.get('/messages/:userId?', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    try {
        const currentUser = await User.findOne({ username: req.session.username });
        let otherUser = null;
        let messages = [];

        if (req.params.userId) {
            otherUser = await User.findById(req.params.userId);
            messages = await Message.find({
                $or: [
                    { sender: currentUser._id, receiver: otherUser._id },
                    { sender: otherUser._id, receiver: currentUser._id }
                ]
            }).sort('timestamp');
        }

        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: currentUser._id }, { receiver: currentUser._id }]
                }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$sender", currentUser._id] },
                            "$receiver",
                            "$sender"
                        ]
                    },
                    lastMessage: { $last: "$$ROOT" }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            { $unwind: '$userDetails' },
            { $sort: { 'lastMessage.timestamp': -1 } }
        ]);

        res.render('messages', { currentUser, otherUser, messages, conversations });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Une erreur est survenue lors de la récupération des messages');
    }
});

app.post('/send-message', async (req, res) => {
    if (!req.session.username) {
        return res.status(403).send('Non autorisé');
    }

    try {
        const { receiverId, content } = req.body;
        const sender = await User.findOne({ username: req.session.username });
        
        const newMessage = new Message({
            sender: sender._id,
            receiver: receiverId,
            content
        });

        await newMessage.save();
        res.redirect(`/messages/${receiverId}`);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Erreur lors de l\'envoi du message');
    }
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                            //génération des exams
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.get('/configure-exam', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user && user.role === 'teacher') {
                const courses = await Course.find({ professor: user._id });
                res.render('configureExam', { courses });
            } else {
                res.status(403).send('Non autorisé');
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
            res.status(500).send('Une erreur est survenue');
        }
    } else {
        res.redirect('/login');
    }
});





app.post('/generate-exam', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findOne({ username: req.session.username });
        if (!user || user.role !== 'teacher') {
            return res.status(403).send('Non autorisé');
        }

        const { selectedCourses, numQuestions, difficulty, concepts } = req.body;
        if (!selectedCourses || !numQuestions || !difficulty || !concepts) {
            return res.status(400).send('Paramètres manquants');
        }

        const courses = await Course.find({ _id: { $in: selectedCourses } });
        if (courses.length === 0) {
            return res.status(404).send('Aucun cours trouvé');
        }

        let allQuestions = [];
        for (const course of courses) {
            for (let i = 0; i < parseInt(numQuestions); i++) {
                try {
                    const concept = concepts[i] || 'général';
                    console.log(`Génération d'exercice pour le cours ${course.title}, concept: ${concept}`);
                    const exercise = await generateExercise(difficulty, concept, course.teachingUnit);
                    allQuestions.push({
                        question: exercise,
                        course: course._id,
                        concept: concept
                    });
                } catch (error) {
                    console.error(`Erreur lors de la génération de la question:`, error);
                }
            }
        }

        if (allQuestions.length === 0) {
            return res.status(500).send('Aucune question n\'a pu être générée pour l\'examen');
        }

        const exam = new Exam({
            title: `Examen généré le ${new Date().toLocaleDateString()}`,
            questions: allQuestions,
            difficulty: difficulty,
            creator: user._id,
            concepts: concepts
        });

        await exam.save();
        res.redirect('/exams');
    } catch (error) {
        console.error('Erreur lors de la génération de l\'examen:', error);
        res.status(500).send('Une erreur est survenue lors de la génération de l\'examen');
    }
});





app.get('/exams', async (req, res) => {
    if (req.session.username) {
        try {
            const user = await User.findOne({ username: req.session.username });
            if (user) {
                let exams;
                const sortOption = req.query.sort || 'createdAt'; // Par défaut, trier par date de création
                const sortOrder = {}; // Initialisation de l'objet de tri
                
                // Définir l'ordre de tri en fonction de l'option choisie
                sortOrder[sortOption] = sortOption === 'title' ? 1 : -1; // Titre en ordre croissant, les autres en ordre décroissant

                // Initialiser les filtres
                const filters = {};
                if (req.query.difficulty) {
                    filters.difficulty = req.query.difficulty;
                }

                if (user.role === 'teacher') {
                    // Les professeurs voient les examens qu'ils ont créés
                    exams = await Exam.find({ creator: user._id, ...filters }).sort(sortOrder);
                } else if (user.role === 'student') {
                    // Les étudiants voient tous les examens
                    exams = await Exam.find({ ...filters }).sort(sortOrder);
                } else {
                    return res.status(403).send('Rôle non autorisé');
                }

                // Passer les variables 'filters' et 'sort' à la vue
                res.render('exams', { exams, userRole: user.role, sort: sortOption, filters });
            } else {
                res.status(403).send('Utilisateur non trouvé');
            }
        } catch (error) {
            console.error('Error fetching exams:', error);
            res.status(500).send('Une erreur est survenue');
        }
    } else {
        res.redirect('/login');
    }
});




app.get('/exam-pdf/:id', async (req, res) => {
    if (req.session.username) {
        try {
            const exam = await Exam.findById(req.params.id);
            if (!exam) {
                return res.status(404).send('Examen non trouvé');
            }

            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=exam-${exam._id}.pdf`);
            doc.pipe(res);

            doc.fontSize(18).text(exam.title, { align: 'center' });
            doc.moveDown();
            exam.questions.forEach((q, index) => {
                doc.fontSize(14).text(`Question ${index + 1}: ${q.question}`);
                doc.moveDown();
            });

            doc.end();
        } catch (error) {
            console.error('Error generating PDF:', error);
            res.status(500).send('Une erreur est survenue lors de la génération du PDF');
        }
    } else {
        res.redirect('/login');
    }
});









app.get('/schedule', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findOne({ username: req.session.username });
        let schedule = await Schedule.findOne({ user: user._id }).populate('events.courseId');
        
        let events = [];
        if (schedule && schedule.events) {
            events = schedule.events.map(event => ({
                title: event.title,
                start: event.start,
                end: event.end,
                url: `/video-session/${event.courseId._id}`
            }));
        }

        res.render('schedule', { user, events });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'emploi du temps:', error);
        res.status(500).send('Erreur lors de la récupération de l\'emploi du temps');
    }
});








///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////          Partie quizz            ////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////


// Routes pour les quiz

// Route pour afficher le formulaire d'ajout de quiz (professeurs)
app.get('/add-quiz', async (req, res) => {
    const user = await User.findOne({ username: req.session.username });
    if (user.role === 'teacher') {
        res.render('addQuiz', { user });
    } else {
        res.redirect('/dashboard');
    }
});

// Route pour créer un nouveau quiz
app.post('/api/quiz/create', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.username });
        if (user.role !== 'teacher') {
            return res.status(403).json({ message: "Access denied" });
        }

        const { title, description, teachingUnit, questions } = req.body;

        const newQuiz = new Quiz({
            title,
            description,
            author: user._id,
            teachingUnit,
            questions: questions.map(q => ({
                question: q.question,
                correctAnswer: q.correctAnswer,
                incorrectAnswer1: q.incorrectAnswers[0],
                incorrectAnswer2: q.incorrectAnswers[1],
                incorrectAnswer3: q.incorrectAnswers[2]
            }))
        });

        console.log('New quiz object:', newQuiz);
        const savedQuiz = await newQuiz.save();
        console.log('Saved quiz:', savedQuiz);
        res.status(201).json(savedQuiz);
    } catch (error) {
        console.error('Error creating quiz:', error);
        res.status(400).json({ message: error.message });
    }
});

// Route pour obtenir la liste des quiz
app.get('/api/quiz/list', async (req, res) => {
    try {
        const quizzes = await Quiz.find()
            .select('title description author teachingUnit createdAt')
            .populate('author', 'firstName lastName');
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route pour afficher la liste des quiz aux étudiants
app.get('/quizzes', async (req, res) => {
    const user = await User.findOne({ username: req.session.username });

    if (user.role === 'student') {
        res.render('quizList', { user });
    } else {
        res.redirect('/dashboard');
    }
});

// Route pour obtenir un quiz spécifique
// Route pour obtenir un quiz spécifique
app.get('/api/quiz/:id', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.username });
        const quiz = await Quiz.findById(req.params.id).populate('author', 'firstName lastName');
        
        if (!quiz) {
            return res.status(404).json({ message: "Quiz not found" });
        }

        if (user.role === 'student') {
            // Pour les étudiants, mélanger les réponses et ne pas envoyer la réponse correcte
            quiz.questions = quiz.questions.map(q => ({
                _id: q._id,
                question: q.question,
                answers: shuffle([q.incorrectAnswer1, q.incorrectAnswer2, q.incorrectAnswer3, q.correctAnswer])
            }));
        }
        
        res.json(quiz);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route pour afficher un quiz spécifique à un étudiant
app.get('/quiz/:id', async (req, res) => {
    try {
        // Récupérer l'utilisateur
        const user = await User.findOne({ username: req.session.username });
        
        // Récupérer le quiz
        const quiz = await Quiz.findById(req.params.id).populate('author', 'firstName lastName');
        
        if (!quiz) {
            return res.status(404).send("Quiz not found");
        }

        // Pour les étudiants, mélanger les réponses
        const quizForStudent = {
            ...quiz.toObject(),
            questions: quiz.questions.map(q => ({
                question: q.question,
                answers: shuffle([q.incorrectAnswer1, q.incorrectAnswer2, q.incorrectAnswer3, q.correctAnswer])
            }))
        };
        
        // Rendre la vue avec les données du quiz et de l'utilisateur
        res.render('takeQuiz', { quiz: quizForStudent, user });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).send("An error occurred");
    }
});

app.post('/api/quiz/:id/answer', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.username });
        if (user.role !== 'student') {
            return res.status(403).json({ message: "Access denied" });
        }

        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ message: "Quiz not found" });
        }

        const { answers } = req.body;
        let score = 0;

        quiz.questions.forEach((question, index) => {
            const userAnswer = answers[index];
            if (userAnswer === question.correctAnswer) {
                score++;
            }
        });

        const result = {
            quiz: quiz._id,
            student: user._id,
            score: (score / quiz.questions.length) * 100
        };

        // Ici, vous pouvez sauvegarder le résultat dans la base de données si nécessaire
        console.log('Quiz result:', result);  // Log pour le débogage

        res.json({ score: result.score });
    } catch (error) {
        console.error('Error processing quiz answer:', error);
        res.status(400).json({ message: error.message });
    }
});

// Fonction utilitaire pour mélanger un tableau
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// Fonction pour planifier un e-mail
function scheduleEmail(userEmail, courseTitle, startTime) {
    const mailOptions = {
        from: 'smartifyplatform@gmail.com',
        to: userEmail,
        subject: `Rappel: Votre cours ${courseTitle} commence bientôt`,
        text: `Bonjour,\n\nVotre cours ${courseTitle} commence dans une heure.\n\nCordialement,\nL'équipe Smartify`
    };

    // Calculer l'heure d'envoi : une heure avant le début du cours
    const sendTime = new Date(startTime.getTime() - 60 * 60 * 1000);

    // Programmer l'envoi de l'e-mail
    schedule.scheduleJob(sendTime, function() {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erreur lors de l\'envoi de l\'email:', error);
            } else {
                console.log('Email envoyé:', info.response);
            }
        });
    });
}






const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on port ${PORT}`);
});
