<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Ciber-Tabuleiro Pro</title>
    <style>
        :root { --main-color: #00ffff; --bg-dark: #02111a; }
        body { 
            background: var(--bg-dark); color: white; font-family: 'Segoe UI', sans-serif; 
            display: flex; flex-direction: column; align-items: center; 
            margin: 0; overflow: hidden; touch-action: none; height: 100vh; justify-content: center;
        }
        
        #ui-container { margin: 10px; text-align: center; width: 100%; z-index: 10; }
        .score-panel {
            background: rgba(0, 40, 60, 0.4); backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 255, 255, 0.2); border-radius: 15px;
            padding: 10px; margin: 5px; box-shadow: 0 0 15px rgba(0, 255, 255, 0.1);
        }
        .stats-row { display: flex; justify-content: center; gap: 20px; }
        .stat-val { color: var(--main-color); font-weight: bold; font-size: 18px; }

        canvas { background: rgba(0,0,0,0.5); border: 2px solid #333; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.5); }

        .pieces-selector { display: flex; gap: 10px; margin-top: 15px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 15px; }
        .slot { width: 90px; height: 90px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed #444; display: flex; align-items: center; justify-content: center; }
        .disabled { opacity: 0.2; filter: grayscale(1); }
        
        #start-screen, #game-over { 
            position: fixed; inset: 0; background: rgba(2, 17, 26, 0.95); 
            z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; 
        }
        .btn { 
            background: linear-gradient(45deg, #00ffff, #0080ff); color: #000; 
            border: none; padding: 15px 40px; font-size: 18px; font-weight: bold; 
            border-radius: 50px; cursor: pointer; box-shadow: 0 5px 15px rgba(0,255,255,0.4);
        }
    </style>
</head>
<body>

<div id="start-screen">
    <h1 style="color:var(--main-color); letter-spacing:2px;">CIBER-TABULEIRO</h1>
    <p id="menu-best">RECORDE: 0</p>
    <button class="btn" onclick="initGame()">INICIAR JOGO</button>
</div>

<div id="ui-container">
    <div class="score-panel">
        <div id="info" style="font-size: 12px; opacity: 0.7;">NÍVEL 1</div>
        <div class="stats-row">
            <div>PONTOS: <span id="score" class="stat-val">0</span></div>
            <div>RECORDE: <span id="best" class="stat-val">0</span></div>
        </div>
    </div>
    <div id="mission-bar" style="margin-top: 5px; font-size: 18px;"></div>
</div>

<canvas id="gameCanvas" width="320" height="320"></canvas>

<div class="pieces-selector">
    <div id="slot0" class="slot"></div>
    <div id="slot1" class="slot"></div>
    <div id="slot2" class="slot"></div>
</div>

<div id="game-over" style="display:none;">
    <h2 style="color:#ff4444;">FIM DE JOGO</h2>
    <p id="final-score">Pontuação: 0</p>
    <button class="btn" onclick="location.reload()">RECOMEÇAR</button>
</div>

<script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const size = 40;

    // --- CARREGAMENTO DE IMAGENS (Assets) ---
    const imgBtn = new Image(); imgBtn.src = './assets/bloco.png';
    const imgStar = new Image(); imgStar.src = './assets/estrela.png';
    const imgFire = new Image(); imgFire.src = './assets/fogo.png';
    const imgThunder = new Image(); imgThunder.src = './assets/raio.png';

    const imgMap = { "⭐": imgStar, "🔥": imgFire, "⚡": imgThunder };

    // Forçar atualização quando as imagens carregarem
    [imgBtn, imgStar, imgFire, imgThunder].forEach(img => {
        img.onload = () => { renderUI(); };
    });

    let grid = Array(8).fill().map(() => Array(8).fill(0));
    let score = 0, level = 1, best = localStorage.getItem('blockBest') || 0;
    let missionGoals = {}, missionCollected = {};
    let pieces = [null, null, null], dragIdx = -1, dragPiece = null, mX = -1000, mY = -1000;
    let particles = [], floatingItems = [], moved = false, touchT = 0, audioCtx;

    const icons = { star: "⭐", fire: "🔥", thunder: "⚡" };
    const shapes = [[[1,1],[1,1]], [[1,1,1,1]], [[1,1,1],[0,1,0]], [[1,1,0],[0,1,1]], [[1,0,0],[1,1,1]], [[1]]];

    document.getElementById('best').innerText = best;
    document.getElementById('menu-best').innerText = "RECORDE: " + best;

    function initGame() {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        document.getElementById('start-screen').style.display = 'none';
        setupLevel();
        requestAnimationFrame(loop);
    }

    function setupLevel() {
        missionGoals = {}; missionCollected = {};
        missionGoals[icons.star] = 3 + Math.floor(level * 1.5);
        if(level >= 3) missionGoals[icons.fire] = 2 + level;
        for (let key in missionGoals) missionCollected[key] = 0;
        grid = Array(8).fill().map(() => Array(8).fill(0));
        newSet();
    }

    function drawBlock(x, y, type) {
        let img = imgBtn;
        if (type && typeof type === 'string' && imgMap[type]) img = imgMap[type];

        if (img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, x, y, size - 1, size - 1);
        } else {
            // Fallback: Quadrado azul se a imagem não carregar
            ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
            ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
            if(type && type.length < 3) {
                ctx.fillStyle = "white"; ctx.font = "14px Arial";
                ctx.fillText(type, x+10, y+25);
            }
        }
    }

    function rotate(p) { return p[0].map((_, i) => p.map(row => row[i]).reverse()); }
    
    function canPlace(p, r, c) {
        if (r < 0 || c < 0 || r + p.length > 8 || c + p[0].length > 8) return false;
        for (let i = 0; i < p.length; i++) 
            for (let j = 0; j < p[0].length; j++) 
                if (p[i][j] && grid[r+i][c+j] !== 0) return false;
        return true;
    }

    function canFitAnywhere(p) {
        let cur = p;
        for (let rot = 0; rot < 4; rot++) {
            for (let r = 0; r <= 8 - cur.length; r++)
                for (let c = 0; c <= 8 - cur[0].length; c++)
                    if (canPlace(cur, r, c)) return true;
            cur = rotate(cur);
        }
        return false;
    }

    function injectItems(piece) {
        let types = Object.keys(missionGoals);
        if (Math.random() < 0.4 && types.length > 0) {
            let type = types[Math.floor(Math.random() * types.length)];
            let coords = [];
            piece.forEach((row, r) => row.forEach((v, c) => { if(v === 1) coords.push([r,c]); }));
            if (coords.length > 0) {
                let choice = coords[Math.floor(Math.random() * coords.length)];
                piece[choice[0]][choice[1]] = type;
            }
        }
        return piece;
    }

    function newSet() {
        for(let i=0; i<3; i++) pieces[i] = injectItems(JSON.parse(JSON.stringify(shapes[Math.floor(Math.random()*shapes.length)])));
        renderUI();
    }

    function renderUI() {
        document.getElementById('info').innerText = `NÍVEL ${level}`;
        document.getElementById('score').innerText = score;
        const mBar = document.getElementById('mission-bar');
        mBar.innerHTML = '';
        for (let type in missionGoals) {
            let done = missionCollected[type] >= missionGoals[type];
            mBar.innerHTML += `<span style="margin:0 10px; opacity:${done?0.3:1}">${type} ${missionCollected[type]}/${missionGoals[type]}</span>`;
        }
        
        let moves = 0;
        for(let i=0; i<3; i++) {
            const s = document.getElementById('slot'+i); s.innerHTML = '';
            if(!pieces[i]) continue;
            if(!canFitAnywhere(pieces[i])) s.classList.add('disabled'); else { s.classList.remove('disabled'); moves++; }
            
            const cvPiece = document.createElement('canvas'); 
            cvPiece.width = pieces[i][0].length * 20; cvPiece.height = pieces[i].length * 20;
            const cxP = cvPiece.getContext('2d');
            pieces[i].forEach((row,r)=>row.forEach((v,c)=>{
                if(v){
                    let pImg = (typeof v === 'string') ? imgMap[v] : imgBtn;
                    if(pImg.complete) cxP.drawImage(pImg, c*20, r*20, 19, 19);
                    else { cxP.fillStyle="#00ffff"; cxP.fillRect(c*20, r*20, 18, 18); }
                }
            }));
            s.appendChild(cvPiece);
        }
        if (moves === 0 && pieces.some(p => p !== null)) {
            document.getElementById('game-over').style.display = 'flex';
            document.getElementById('final-score').innerText = `Pontos: ${score}`;
        }
    }

    function checkLines() {
        let rd = [], cd = [];
        for(let r=0; r<8; r++) if(grid[r].every(v => v !== 0)) rd.push(r);
        for(let c=0; c<8; c++) {
            let f = true; for(let r=0; r<8; r++) if(grid[r][c] === 0) f = false;
            if(f) cd.push(c);
        }
        if(rd.length || cd.length) { 
            score += (rd.length + cd.length) * 10; 
            if(score > best) { best = score; localStorage.setItem('blockBest', best); document.getElementById('best').innerText = best; }
        }
        const rect = canvas.getBoundingClientRect();
        rd.forEach(r => { for(let c=0; c<8; c++) collect(r,c, rect); });
        cd.forEach(c => { for(let r=0; r<8; r++) collect(r,c, rect); });
        
        let allDone = true;
        for (let type in missionGoals) if (missionCollected[type] < missionGoals[type]) allDone = false;
        if (allDone && Object.keys(missionGoals).length > 0) { level++; setupLevel(); }
        renderUI();
    }

    function collect(r,c, rect) {
        let val = grid[r][c]; if(val === 0) return;
        if(missionGoals[val]) { missionCollected[val]++; }
        grid[r][c] = 0;
    }

    window.addEventListener('touchstart', e => {
        const t = e.touches[0]; moved = false; touchT = Date.now();
        for(let i=0; i<3; i++) {
            const r = document.getElementById('slot'+i).getBoundingClientRect();
            if(t.clientX > r.left && t.clientX < r.right && t.clientY > r.top && t.clientY < r.bottom) {
                if(pieces[i]) { dragIdx = i; dragPiece = pieces[i]; mX = t.clientX; mY = t.clientY; }
            }
        }
    });

    window.addEventListener('touchmove', e => {
        if(dragIdx === -1) return; moved = true; mX = e.touches[0].clientX; mY = e.touches[0].clientY;
        document.getElementById('slot'+dragIdx).style.opacity = '0.1';
    });

    window.addEventListener('touchend', () => {
        if(dragIdx === -1) return;
        if(!moved && Date.now()-touchT < 250) { pieces[dragIdx] = rotate(pieces[dragIdx]); renderUI(); }
        else if(moved) {
            const r = canvas.getBoundingClientRect();
            const col = Math.round((mX - r.left - (dragPiece[0].length*size/2))/size);
            const row = Math.round((mY - r.top - (dragPiece.length*size/2))/size);
            if(canPlace(dragPiece, row, col)) {
                dragPiece.forEach((rd, i) => rd.forEach((v, j) => {
                    if(v) grid[row+i][col+j] = v;
                }));
                pieces[dragIdx] = null; checkLines();
                if(pieces.every(p => p === null)) newSet(); else renderUI();
            }
        }
        document.getElementById('slot'+dragIdx).style.opacity = '1'; dragIdx = -1; dragPiece = null;
    });

    function loop() {
        ctx.clearRect(0,0,320,320);
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                ctx.fillStyle = "rgba(255,255,255,0.03)"; ctx.fillRect(c*size, r*size, size-1, size-1);
                if(grid[r][c]) drawBlock(c*size, r*size, grid[r][c]);
            }
        }
        if(dragPiece && moved) {
            const r = canvas.getBoundingClientRect();
            const x = mX - r.left - (dragPiece[0].length*size/2);
            const y = mY - r.top - (dragPiece.length*size/2);
            dragPiece.forEach((rd, i) => rd.forEach((v, j) => {
                if(v) drawBlock(x + j*size, y + i*size, v);
            }));
        }
        requestAnimationFrame(loop);
    }
</script>
</body>
</html>
