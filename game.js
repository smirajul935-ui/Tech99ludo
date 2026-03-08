import { db, ref, onValue, update } from './firebase.js';

let matchId, playerId, gameState, unsub, timerInt;

const UI = {
    p1: document.getElementById('p1-name'), p2: document.getElementById('p2-name'),
    turn: document.getElementById('turn-indicator'), time: document.getElementById('timer-display'),
    dice: document.getElementById('dice-display'), btnRoll: document.getElementById('btn-roll-dice'),
    board: document.getElementById('ludo-board'), tokens: document.getElementById('tokens-container')
};

const path =[{r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5},{r:7,c:6},{r:6,c:7},{r:5,c:7},{r:4,c:7},{r:3,c:7},{r:2,c:7},{r:1,c:7},{r:1,c:8},{r:1,c:9},{r:2,c:9},{r:3,c:9},{r:4,c:9},{r:5,c:9},{r:6,c:9},{r:7,c:10},{r:7,c:11},{r:7,c:12},{r:7,c:13},{r:7,c:14},{r:7,c:15},{r:8,c:15},{r:9,c:15},{r:9,c:14},{r:9,c:13},{r:9,c:12},{r:9,c:11},{r:9,c:10},{r:10,c:9},{r:11,c:9},{r:12,c:9},{r:13,c:9},{r:14,c:9},{r:15,c:9},{r:15,c:8},{r:15,c:7},{r:14,c:7},{r:13,c:7},{r:12,c:7},{r:11,c:7},{r:10,c:7},{r:9,c:6},{r:9,c:5},{r:9,c:4},{r:9,c:3},{r:9,c:2},{r:9,c:1},{r:8,c:1},{r:7,c:1}];
const safeZones =[0, 8, 13, 21, 26, 34, 39, 47];
const homes = { player1:[{r:8,c:2},{r:8,c:3},{r:8,c:4},{r:8,c:5},{r:8,c:6},{r:8,c:7}], player2:[{r:8,c:14},{r:8,c:13},{r:8,c:12},{r:8,c:11},{r:8,c:10},{r:8,c:9}] };
const bases = { player1:[{r:2.5,c:2.5},{r:2.5,c:4.5},{r:4.5,c:2.5},{r:4.5,c:4.5}], player2:[{r:11.5,c:11.5},{r:11.5,c:13.5},{r:13.5,c:11.5},{r:13.5,c:13.5}] };

function drawBoard() {
    UI.board.innerHTML = '';
    for(let r=1; r<=15; r++) {
        for(let c=1; c<=15; c++) {
            let div = document.createElement('div'); div.className = 'cell';
            if(r<=6&&c<=6) div.classList.add('base-red-zone'); else if(r>=10&&c>=10) div.classList.add('base-yellow-zone');
            else if(r<=6&&c>=10) div.classList.add('base-green-zone'); else if(r>=10&&c<=6) div.classList.add('base-blue-zone');
            else {
                path.forEach((p,i)=>{ if(p.r===r&&p.c===c){ if(safeZones.includes(i)) div.classList.add('safe-zone'); }});
                homes.player1.forEach(p=>{if(p.r===r&&p.c===c) div.style.background='#ff4757'});
                homes.player2.forEach(p=>{if(p.r===r&&p.c===c) div.style.background='#ffa502'});
            }
            div.style.gridArea = `${r}/${c}`; UI.board.appendChild(div);
        }
    }
}

export function startGame(mId, pId) {
    matchId = mId; playerId = pId; drawBoard();
    UI.tokens.innerHTML = '';
    ['player1','player2'].forEach(p => {
        for(let i=0; i<4; i++){
            let t=document.createElement('div'); t.className=`token ${p==='player1'?'red':'yellow'}`;
            t.id=`t-${p}-${i}`; t.onclick=()=>move(p,i); UI.tokens.appendChild(t);
        }
    });
    unsub = onValue(ref(db, `matches/${matchId}`), s => {
        if(!s.exists()) return; gameState = s.val();
        
        // FIX: Screen transition ko direct kar diya
        if(gameState.status==='playing' && document.getElementById('lobby-screen').className.indexOf('hidden') === -1) {
            document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
            document.getElementById('game-screen').classList.remove('hidden');
        }
        
        updateUI(); render();
        if(gameState.winner) { document.getElementById('winner-name').innerText=gameState[gameState.winner].name; document.getElementById('winner-modal').classList.remove('hidden'); }
    });
    timerInt = setInterval(() => {
        if(gameState?.status==='playing' && gameState.turn===playerId && !gameState.winner) {
            if(gameState.timer>0) update(ref(db, `matches/${matchId}`), {timer: gameState.timer-1});
            else update(ref(db, `matches/${matchId}`), {turn: playerId==='player1'?'player2':'player1', diceRolled:false, timer:50});
        }
    }, 1000);
}

export function stopGame() { if(unsub) unsub(); clearInterval(timerInt); }

function updateUI() {
    UI.p1.innerText = gameState.player1.name; UI.p2.innerText = gameState.player2?.name || 'Waiting...';
    let myTurn = gameState.turn === playerId;
    UI.turn.innerText = myTurn ? "Your Turn" : "Opponent's Turn"; UI.turn.style.color = myTurn ? '#2ed573' : '#fff';
    UI.time.innerText = `Time Left: ${gameState.timer}s`;
    UI.btnRoll.disabled = !(myTurn && !gameState.diceRolled);
    UI.dice.innerText = gameState.dice===0?'🎲':['','⚀','⚁','⚂','⚃','⚄','⚅'][gameState.dice];
}

UI.btnRoll.onclick = () => {
    UI.dice.classList.add('rolling');
    setTimeout(() => {
        UI.dice.classList.remove('rolling');
        let d = Math.floor(Math.random()*6)+1;
        update(ref(db, `matches/${matchId}`), {dice:d, diceRolled:true, timer:50}).then(()=>{
            if(!gameState.board.tokens[playerId].some(p=>(p===-1&&d===6)||(p>=0&&p+d<=57))) 
                setTimeout(()=>update(ref(db, `matches/${matchId}`),{turn:playerId==='player1'?'player2':'player1',diceRolled:false,timer:50}), 1000);
        });
    }, 400);
};

function move(p, i) {
    if(p!==playerId || gameState.turn!==playerId || !gameState.diceRolled) return;
    let pos = gameState.board.tokens[p][i], d = gameState.dice;
    if(pos===-1 && d!==6) return; if(pos>=0 && pos+d>57) return;
    
    let nPos = pos===-1?0:pos+d, opp = p==='player1'?'player2':'player1';
    let myT =[...gameState.board.tokens[p]], oppT = [...gameState.board.tokens[opp]];
    myT[i] = nPos;
    
    let captured = false;
    if(nPos<=51 && !safeZones.includes(nPos)) {
        let gNew = p==='player1'?nPos:(nPos+26)%52;
        oppT.forEach((op, oi)=>{
            if(op>=0 && op<=51 && (opp==='player1'?op:(op+26)%52)===gNew){ oppT[oi]=-1; captured=true; }
        });
    }
    
    let nTurn = (!captured && nPos!==57 && d!==6) ? opp : p;
    update(ref(db, `matches/${matchId}`), {"board/tokens":{[p]:myT,[opp]:oppT}, turn:nTurn, diceRolled:false, timer:50}).then(()=>{
        if(myT.every(x=>x===57)) update(ref(db, `matches/${matchId}`),{winner:p});
    });
}

function render() {
    ['player1','player2'].forEach(p => {
        gameState.board.tokens[p].forEach((pos, i) => {
            let c = pos===-1?bases[p][i]:(pos<=51?path[p==='player1'?pos:(pos+26)%52]:(pos<=57?homes[p][pos-52]:{r:8,c:8}));
            let t = document.getElementById(`t-${p}-${i}`);
            t.style.top = `${(c.r-0.5)*6.66}%`; t.style.left = `${(c.c-0.5)*6.66}%`;
            t.classList.toggle('active', gameState.turn===playerId && p===playerId && gameState.diceRolled && ((pos===-1&&gameState.dice===6)||(pos>=0&&pos+gameState.dice<=57)));
        });
    });
}                                                                               }
