import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBlgn4kpqd3schg2i1_eECyQO2Pf3fW1Wg",
    authDomain: "tech99ludo.firebaseapp.com",
    databaseURL: "https://tech99ludo-default-rtdb.firebaseio.com",
    projectId: "tech99ludo",
    storageBucket: "tech99ludo.firebasestorage.app",
    messagingSenderId: "656890089311",
    appId: "1:656890089311:web:a829d9eabdc3fd5cf7b0ea",
    measurementId: "G-S6B8L31960"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, update, onValue, runTransaction };
