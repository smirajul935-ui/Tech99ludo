/* game.js */
import { db, ref, update } from './firebase.js';

const boardEl = document.getElementById('ludo-board');
const btnRoll = document.getElementById('btn-roll');
const diceEl = document.getElementById('dice');
const timerDisplay = document.getElementById('timer-display');
const winnerPopup = document.getElementById('winner-popup');

let localTimerInterval = null;
let tokensRendered = false;

const pathCoords = [
    [1,6], [2,6],[3,6], [4,6], [5,6], [6,5], [6,4],[6,3], [6,2], [6,1], [6,0],[7,0], [8,0],
    [8,1], [8,2], [8,3],[8,4], [8,5], [9,6], [10,6], [11,6],[12,6], [13,6], [14,6],[14,7], [14,8],
    [13,8], [12,8],[11,8], [10,8], [9,8], [8,9],[8,10], [8,11], [8,12], [8,13],[8,14],
    [7,14], [6,14],
    [6,13],[6,12], [6,11], [6,10], [6,9],[5,8], [4,8], [3,8], [2,8], [1,8],[0,8],
    [0,7], [0,6]
];

const homePaths = {
    'r': [[1,7], [2,7], [3,7],[4,7], [5,7]],
    'g': [[7,1], [7,2],[7,3], [7,4], [7,5]],
    'y': [[13,7],[12,7], [11,7], [10,7], [9,7]],
    'b': [[7,13], [7,12], [7,11],[7,10], [7,9]]
};

const baseCoords = {
    'r': [[2,2], [3,2], [2,3], [3,3]],
    'g': [[11,2], [12,2], [11,3], [12,3]],
    'y': [[11,11], [12,11], [11,12], [12,12]],
    'b': [[2,11], [3,11], [2,12], [3,12]]
};

const safeZones =[0, 8, 13, 21, 26, 34, 39, 47];
const colorStartIndices = { 'r': 0, 'g': 13, 'y': 26, 'b': 39 };

function playDiceSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch(e){}
}

window.initGame = function() {
    boardEl.innerHTML = '';
    for(let y=0; y<15; y++){
        for(let x=0; x<15; x++){
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${x}-${y}`;
            
            if(x<6 && y<6) cell.classList.add('red-base');
            else if(x>8 && y<6) cell.classList.add('green-base');
            else if(x>8 && y>8) cell.classList.add('yellow-base');
            else if(x<6 && y>8) cell.classList.add('blue-base');
            else if(x>=6 && x<=8 && y>=6 && y<=8) cell.classList.add('center-home');
            
            boardEl.appendChild(cell);
        }
    }

    pathCoords.forEach((p, i) => {
        let c = document.getElementById(`cell-${p[0]}-${p[1]}`);
        if(safeZones.includes(i)) c.classList.add('safe-zone');
    });

    for(let i=0; i<5; i++){
        document.getElementById(`cell-${homePaths['r'][i][0]}-${homePaths['r'][i][1]}`).classList.add('path-red');
        document.getElementById(`cell-${homePaths['g'][i][0]}-${homePaths['g'][i][1]}`).classList.add('path-green');
        document.getElementById(`cell-${homePaths['y'][i][0]}-${homePaths['y'][i][1]}`).classList.add('path-yellow');
        document.getElementById(`cell-${homePaths['b'][i][0]}-${homePaths['b'][i][1]}`).classList.add('path-blue');
    }

    renderTokens();
};

function renderTokens() {
    ['r','g','y','b'].forEach(color => {
        for(let i=0; i<4; i++){
            let tid = `${color}${i}`;
            let t = document.createElement('div');
            t.className = `token t-${color}`;
            t.id = `token-${tid}`;
            t.onclick = () => handleTokenClick(tid);
            boardEl.appendChild(t);
        }
    });
    tokensRendered = true;
}

window.updateGameState = function(state) {
    if(!tokensRendered) return;

    document.getElementById('p1-info').querySelector('.p-name').innerText = state.player1.name;
    document.getElementById('p2-info').querySelector('.p-name').innerText = state.player2.name;

    diceEl.innerText = state.dice || '-';
    
    let isMyTurn = (state.turn === 'player1' && window.isPlayer1) || (state.turn === 'player2' && window.isPlayer2);
    btnRoll.disabled = !(isMyTurn && !state.diceRolled);

    clearInterval(localTimerInterval);
    localTimerInterval = setInterval(() => {
        let elapsed = Math.floor((Date.now() - state.turnStartTime)/1000);
        let left = 50 - elapsed;
        if(left < 0) left = 0;
        timerDisplay.innerText = left;
        if(left === 0 && isMyTurn) {
            clearInterval(localTimerInterval);
            switchTurn();
        }
    }, 1000);

    updateTokensVisuals(state.tokens);

    if(isMyTurn && state.diceRolled) {
        checkValidMoves(state);
    } else {
        clearHighlights();
    }

    if(state.winner) {
        document.getElementById('winner-name').innerText = state[state.winner].name;
        winnerPopup.classList.remove('hidden');
    }
};

function updateTokensVisuals(tokens) {
    let cellCounts = {};
    for(let t in tokens) {
        let pos = tokens[t];
        let color = t[0];
        let idx = parseInt(t[1]);
        let cx, cy;

        if(pos === -1) {
            cx = baseCoords[color][idx][0];
            cy = baseCoords[color][idx][1];
        } else if(pos < 51) {
            let globalIdx = (colorStartIndices[color] + pos) % 52;
            cx = pathCoords[globalIdx][0];
            cy = pathCoords[globalIdx][1];
        } else if(pos >= 51 && pos <= 55) {
            let hIdx = pos - 51;
            cx = homePaths[color][hIdx][0];
            cy = homePaths[color][hIdx][1];
        } else {
            cx = 7; cy = 7;
        }

        let key = `${cx}-${cy}`;
        if(!cellCounts[key]) cellCounts[key] = [];
        cellCounts[key].push(t);
    }

    for(let key in cellCounts) {
        let arr = cellCounts[key];
        let [x, y] = key.split('-');
        let cell = document.getElementById(`cell-${x}-${y}`);
        let rect = cell.getBoundingClientRect();
        let bRect = boardEl.getBoundingClientRect();
        
        let cx = rect.left - bRect.left + rect.width/2;
        let cy = rect.top - bRect.top + rect.height/2;

        arr.forEach((tid, i) => {
            let tEl = document.getElementById(`token-${tid}`);
            let offset = arr.length > 1 ? (i - (arr.length-1)/2) * 10 : 0;
            tEl.style.transform = `translate(calc(${cx}px - 50% + ${offset}px), calc(${cy}px - 50% + ${offset}px))`;
            if(arr.length > 1) tEl.style.width = '45%', tEl.style.height = '45%';
            else tEl.style.width = '65%', tEl.style.height = '65%';
        });
    }
}

btnRoll.onclick = async () => {
    playDiceSound();
    btnRoll.disabled = true;
    diceEl.classList.add('rolling');
    
    setTimeout(async () => {
        diceEl.classList.remove('rolling');
        let roll = Math.floor(Math.random() * 6) + 1;
        await update(ref(db, `matches/${window.matchCode}`), {
            dice: roll,
            diceRolled: true,
            turnStartTime: Date.now()
        });
    }, 500);
};

function getMyColors() {
    return window.isPlayer1 ? ['r','y'] : ['g','b'];
}

function checkValidMoves(state) {
    let validMoves = false;
    let myColors = getMyColors();
    let dice = state.dice;

    myColors.forEach(c => {
        for(let i=0; i<4; i++){
            let tid = `${c}${i}`;
            let pos = state.tokens[tid];
            if(pos === -1 && dice === 6) {
                highlightToken(tid);
                validMoves = true;
            } else if(pos !== -1 && pos + dice <= 56) {
                highlightToken(tid);
                validMoves = true;
            }
        }
    });

    if(!validMoves) {
        setTimeout(switchTurn, 1000);
    }
}

function highlightToken(tid) {
    document.getElementById(`token-${tid}`).classList.add('highlight');
}

function clearHighlights() {
    document.querySelectorAll('.token').forEach(t => t.classList.remove('highlight'));
}

async function handleTokenClick(tid) {
    let el = document.getElementById(`token-${tid}`);
    if(!el.classList.contains('highlight')) return;
    
    clearHighlights();
    
    let state = window.gameState;
    let tokens = {...state.tokens};
    let pos = tokens[tid];
    let dice = state.dice;
    let color = tid[0];

    if(pos === -1) {
        tokens[tid] = 0;
    } else {
        tokens[tid] += dice;
    }

    let captured = false;
    if(tokens[tid] < 51 && tokens[tid] !== -1) {
        let globalIdx = (colorStartIndices[color] + tokens[tid]) % 52;
        if(!safeZones.includes(globalIdx)) {
            for(let other in tokens) {
                if(other[0] !== color && tokens[other] !== -1 && tokens[other] < 51) {
                    let otherGlobalIdx = (colorStartIndices[other[0]] + tokens[other]) % 52;
                    if(otherGlobalIdx === globalIdx) {
                        let myColors = getMyColors();
                        if(!myColors.includes(other[0])) {
                            tokens[other] = -1;
                            captured = true;
                        }
                    }
                }
            }
        }
    }

    let winner = null;
    let myColors = getMyColors();
    let allFinished = true;
    myColors.forEach(c => {
        for(let i=0; i<4; i++){
            if(tokens[`${c}${i}`] !== 56) allFinished = false;
        }
    });
    
    if(allFinished) winner = state.turn;

    let updates = { tokens, turnStartTime: Date.now() };
    if(winner) {
        updates.winner = winner;
        updates.status = 'finished';
    } else if(dice === 6 || captured || tokens[tid] === 56) {
        updates.diceRolled = false;
    } else {
        updates.turn = state.turn === 'player1' ? 'player2' : 'player1';
        updates.diceRolled = false;
        updates.dice = 0;
    }

    await update(ref(db, `matches/${window.matchCode}`), updates);
}

async function switchTurn() {
    let nextTurn = window.gameState.turn === 'player1' ? 'player2' : 'player1';
    await update(ref(db, `matches/${window.matchCode}`), {
        turn: nextTurn,
        diceRolled: false,
        dice: 0,
        turnStartTime: Date.now()
    });
}

document.getElementById('btn-play-again').onclick = () => location.reload();
document.getElementById('btn-home').onclick = () => {
    localStorage.clear();
    location.reload();
};
