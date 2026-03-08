/* app.js */
import { db, ref, set, get, update, onValue, runTransaction } from './firebase.js';

const screens = {
    loading: document.getElementById('loading-screen'),
    auth: document.getElementById('auth-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen')
};

const UI = {
    playerName: document.getElementById('player-name'),
    btnCreate: document.getElementById('btn-create'),
    btnShowJoin: document.getElementById('btn-show-join'),
    joinSection: document.getElementById('join-section'),
    matchCodeInput: document.getElementById('match-code-input'),
    btnJoin: document.getElementById('btn-join'),
    authError: document.getElementById('auth-error'),
    displayMatchCode: document.getElementById('display-match-code')
};

let currentMatchCode = localStorage.getItem('techLudo_matchCode');
let currentPlayerId = localStorage.getItem('techLudo_playerId');
window.gameState = null;
window.isPlayer1 = false;
window.isPlayer2 = false;

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function showError(msg) {
    UI.authError.innerText = msg;
    setTimeout(() => UI.authError.innerText = '', 3000);
}

async function init() {
    if (currentMatchCode && currentPlayerId) {
        const matchRef = ref(db, `matches/${currentMatchCode}`);
        const snap = await get(matchRef);
        if (snap.exists()) {
            const data = snap.val();
            if (data.status === 'playing' || data.status === 'waiting') {
                listenToMatch(currentMatchCode);
                return;
            }
        }
        localStorage.clear();
    }
    switchScreen('auth');
}

UI.btnShowJoin.addEventListener('click', () => {
    UI.joinSection.classList.remove('hidden');
    UI.btnShowJoin.classList.add('hidden');
});

UI.btnCreate.addEventListener('click', async () => {
    let name = UI.playerName.value.trim();
    if (!name) return showError("Enter Your Name");
    switchScreen('loading');

    const counterRef = ref(db, 'matchCounter');
    const result = await runTransaction(counterRef, (currentData) => {
        return (currentData || 0) + 1;
    });

    const matchNum = result.snapshot.val();
    const matchCode = `Tech_${matchNum}`;
    const playerId = generateId();

    const initialTokens = {};
    ['r','g','y','b'].forEach(c => {
        for(let i=0; i<4; i++) initialTokens[`${c}${i}`] = -1;
    });

    const matchData = {
        player1: { id: playerId, name: name },
        player2: { id: null, name: null },
        status: 'waiting',
        turn: 'player1',
        dice: 0,
        diceRolled: false,
        turnStartTime: Date.now(),
        tokens: initialTokens,
        winner: null
    };

    await set(ref(db, `matches/${matchCode}`), matchData);
    
    localStorage.setItem('techLudo_matchCode', matchCode);
    localStorage.setItem('techLudo_playerId', playerId);
    localStorage.setItem('techLudo_playerName', name);
    
    listenToMatch(matchCode);
});

UI.btnJoin.addEventListener('click', async () => {
    let name = UI.playerName.value.trim();
    let code = UI.matchCodeInput.value.trim();
    if (!name) return showError("Enter Your Name");
    if (!code) return showError("Enter Match Code");
    
    switchScreen('loading');
    const matchRef = ref(db, `matches/${code}`);
    const snap = await get(matchRef);
    
    if (!snap.exists()) {
        switchScreen('auth');
        return showError("Match Not Found");
    }

    const data = snap.val();
    if (data.player2.id) {
        switchScreen('auth');
        return showError("Match Full");
    }

    const playerId = generateId();
    await update(matchRef, {
        player2: { id: playerId, name: name },
        status: 'playing',
        turnStartTime: Date.now()
    });

    localStorage.setItem('techLudo_matchCode', code);
    localStorage.setItem('techLudo_playerId', playerId);
    localStorage.setItem('techLudo_playerName', name);

    listenToMatch(code);
});

function listenToMatch(code) {
    const matchRef = ref(db, `matches/${code}`);
    onValue(matchRef, (snap) => {
        const data = snap.val();
        if(!data) return;
        
        window.gameState = data;
        window.matchCode = code;
        
        let pid = localStorage.getItem('techLudo_playerId');
        window.isPlayer1 = data.player1 && data.player1.id === pid;
        window.isPlayer2 = data.player2 && data.player2.id === pid;

        if (data.status === 'waiting') {
            UI.displayMatchCode.innerText = code;
            switchScreen('waiting');
        } else if (data.status === 'playing') {
            if(document.getElementById('waiting-screen').classList.contains('active') || document.getElementById('loading-screen').classList.contains('active')){
                switchScreen('game');
                if(window.initGame) window.initGame();
            }
            if(window.updateGameState) window.updateGameState(data);
        }
    });
}

init();
