import { db, ref, get, set, update, runTransaction } from './firebase.js';
import { startGame, stopGame } from './game.js';

const screens = {
    loading: document.getElementById('loading-screen'),
    home: document.getElementById('home-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};

let localPlayer = { name: '', id: '', matchCode: '' };

window.addEventListener('DOMContentLoaded', checkReconnect);

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

document.getElementById('btn-create').addEventListener('click', async () => {
    const name = document.getElementById('player-name').value.trim();
    if (!name) return showToast("Enter your name");
    
    showScreen('loading');
    const counterRef = ref(db, 'global/matchCounter');
    const tx = await runTransaction(counterRef, (current) => (current || 0) + 1);
    const code = `Tech_${tx.snapshot.val()}`;
    
    await set(ref(db, `matches/${code}`), {
        player1: { name }, player2: { name: null }, status: 'waiting', turn: 'player1',
        dice: 0, diceRolled: false, timer: 50, winner: null,
        board: { tokens: { player1: [-1,-1,-1,-1], player2:[-1,-1,-1,-1] } }
    });

    localPlayer = { name, id: 'player1', matchCode: code };
    localStorage.setItem('techludo', JSON.stringify(localPlayer));
    document.getElementById('display-match-code').textContent = code;
    showScreen('lobby');
    startGame(code, 'player1');
});

document.getElementById('btn-join').addEventListener('click', () => {
    if(!document.getElementById('player-name').value.trim()) return showToast("Enter your name");
    document.getElementById('join-modal').classList.remove('hidden');
});

document.getElementById('btn-cancel-join').addEventListener('click', () => {
    document.getElementById('join-modal').classList.add('hidden');
});

document.getElementById('btn-confirm-join').addEventListener('click', async () => {
    const name = document.getElementById('player-name').value.trim();
    const code = document.getElementById('match-code-input').value.trim();
    if (!code) return showToast("Enter code");
    
    document.getElementById('join-modal').classList.add('hidden');
    showScreen('loading');
    
    const snap = await get(ref(db, `matches/${code}`));
    if (!snap.exists()) { showToast("Not Found"); return showScreen('home'); }
    if (snap.val().status !== 'waiting') { showToast("Match Full"); return showScreen('home'); }

    await update(ref(db, `matches/${code}`), { "player2/name": name, status: 'playing' });
    localPlayer = { name, id: 'player2', matchCode: code };
    localStorage.setItem('techludo', JSON.stringify(localPlayer));
    
    showScreen('game');
    startGame(code, 'player2');
});

async function checkReconnect() {
    const saved = localStorage.getItem('techludo');
    if (saved) {
        const parsed = JSON.parse(saved);
        try {
            const snap = await get(ref(db, `matches/${parsed.matchCode}`));
            if (snap.exists() && (snap.val().status === 'playing' || snap.val().status === 'waiting')) {
                localPlayer = parsed;
                if(snap.val().status === 'waiting' && localPlayer.id === 'player1') {
                    document.getElementById('display-match-code').textContent = localPlayer.matchCode;
                    showScreen('lobby');
                } else { showScreen('game'); }
                return startGame(localPlayer.matchCode, localPlayer.id);
            }
        } catch(e) {}
    }
    localStorage.removeItem('techludo');
    showScreen('home');
}

document.getElementById('btn-return-home').addEventListener('click', () => {
    stopGame(); localStorage.removeItem('techludo'); window.location.reload();
});

export { navigateTo: showScreen };
