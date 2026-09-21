// H2H Matrix Page
let allGameData = [];

document.addEventListener('DOMContentLoaded', function() {
    loadGameData();
});

async function loadGameData() {
    try {
        const data = await LeagueDb.scoreRows();
        allGameData = data || [];
        
        console.log('Loaded games:', allGameData.length);
        
        // Build and render matrix with all data
        const h2hRecords = buildH2HRecords(allGameData);
        renderHeadToHeadMatrix(h2hRecords);
        
    } catch (error) {
        console.error('Error loading game data:', error);
        document.getElementById('matrix-container').innerHTML = 
            '<div class="error-state">Error loading data. Please try again later.</div>';
    }
}

function buildH2HRecords(games) {
    const records = {};
    
    // Track unique matchups to avoid duplicates
    const processedGames = new Set();
    
    games.forEach(game => {
        const team1 = game.Team;
        const team2 = game.Opponent;
        const score1 = game["Team Score"];
        const score2 = game["Opponent Score"];
        const gameId = game["Game ID"];
        const season = game.Season;
        
        // Skip games with Bye
        if (team1.toLowerCase() === 'bye' || team2.toLowerCase() === 'bye') {
            return;
        }
        
        // Create a unique key for this game (only process each game once)
        const gameKey = `${season}-${gameId}`;
        
        if (processedGames.has(gameKey)) {
            return; // Skip duplicate
        }
        processedGames.add(gameKey);
        
        // Initialize records for both teams if not exist
        if (!records[team1]) records[team1] = {};
        if (!records[team2]) records[team2] = {};
        if (!records[team1][team2]) records[team1][team2] = { wins: 0, losses: 0, totalGames: 0, totalPF: 0, totalPA: 0 };
        if (!records[team2][team1]) records[team2][team1] = { wins: 0, losses: 0, totalGames: 0, totalPF: 0, totalPA: 0 };
        
        // Update records
        if (score1 > score2) {
            records[team1][team2].wins++;
            records[team1][team2].totalGames++;
            records[team1][team2].totalPF += score1;
            records[team1][team2].totalPA += score2;
            records[team2][team1].losses++;
            records[team2][team1].totalGames++;
            records[team2][team1].totalPF += score2;
            records[team2][team1].totalPA += score1;
        } else if (score2 > score1) {
            records[team2][team1].wins++;
            records[team2][team1].totalGames++;
            records[team2][team1].totalPF += score2;
            records[team2][team1].totalPA += score1;
            records[team1][team2].losses++;
            records[team1][team2].totalGames++;
            records[team1][team2].totalPF += score1;
            records[team1][team2].totalPA += score2;
        }
    });
    
    console.log('Built H2H records:', records);
    return records;
}

function renderHeadToHeadMatrix(h2hRecords) {
    const container = document.getElementById('matrix-container');
    
    if (!container) {
        console.error('Matrix container not found');
        return;
    }
    
    const teams = Object.keys(h2hRecords).filter(team => team.toLowerCase() !== 'bye').sort();
    
    if (teams.length === 0) {
        container.innerHTML = '<p class="error-state">No head-to-head data available.</p>';
        return;
    }
    
    // Find max matchups for color scaling
    let maxMatchups = 0;
    teams.forEach(rowTeam => {
        teams.forEach(colTeam => {
            if (rowTeam !== colTeam) {
                const record = h2hRecords[rowTeam][colTeam];
                if (record && record.totalGames > maxMatchups) {
                    maxMatchups = record.totalGames;
                }
            }
        });
    });
    
    // Create table HTML
    let html = '<div class="heat-matrix-wrapper">';
    html += '<table class="heat-matrix-table">';
    
    // Header row
    html += '<thead><tr>';
    html += '<th class="corner-cell"></th>';
    teams.forEach(team => {
        html += `<th><span>${team}</span></th>`;
    });
    html += '</tr></thead>';
    
    // Body rows
    html += '<tbody>';
    teams.forEach(rowTeam => {
        html += '<tr>';
        html += `<th class="row-header">${rowTeam}</th>`;
        
        teams.forEach(colTeam => {
            if (rowTeam === colTeam) {
                html += '<td class="heat-matrix-cell self-matchup">';
                html += '<div class="heat-matrix-tooltip">';
                html += `<strong>${rowTeam}</strong><br>`;
                html += 'Cannot play against self';
                html += '</div>';
                html += '</td>';
            } else {
                const record = h2hRecords[rowTeam][colTeam];
                
                if (!record || record.totalGames === 0) {
                    html += '<td class="heat-matrix-cell no-matchup">';
                    html += '<div class="heat-matrix-tooltip">';
                    html += `<strong>${rowTeam} vs ${colTeam}</strong><br>`;
                    html += 'No matchups yet';
                    html += '</div>';
                    html += '</td>';
                } else {
                    const wins = record.wins;
                    const losses = record.losses;
                    const total = record.totalGames;
                    const winPct = total > 0 ? wins / total : 0;
                    const totalPF = record.totalPF || 0;
                    const totalPA = record.totalPA || 0;
                    const totalPointDiff = totalPF - totalPA;
                    const avgPointDiff = total > 0 ? totalPointDiff / total : 0;
                    
                    let colorBucket = 0;
                    if (maxMatchups > 0) {
                        colorBucket = Math.floor((total / maxMatchups) * 10);
                        if (total > 0 && colorBucket === 0) {
                            colorBucket = 1;
                        }
                    }
                    
                    html += `<td class="heat-matrix-cell" data-win-pct="${colorBucket}">`;
                    html += '<div class="heat-matrix-tooltip">';
                    html += `<strong>${rowTeam} vs ${colTeam}</strong>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">Record:</span><span class="tooltip-value">${wins}-${losses}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">PCT:</span><span class="tooltip-value">${winPct.toFixed(3).replace(/^0(?=\.)/, '')}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">Total Games:</span><span class="tooltip-value">${total}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">PFPG:</span><span class="tooltip-value">${(totalPF / total).toFixed(1)}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">PAPG:</span><span class="tooltip-value">${(totalPA / total).toFixed(1)}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">Avg Point Diff:</span><span class="tooltip-value">${avgPointDiff.toFixed(1)}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">Total PF:</span><span class="tooltip-value">${totalPF.toFixed(1)}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">Total PA:</span><span class="tooltip-value">${totalPA.toFixed(1)}</span></div>`;
                    html += `<div class="tooltip-row"><span class="tooltip-label">Total Point Diff:</span><span class="tooltip-value">${totalPointDiff.toFixed(1)}</span></div>`;
                    html += '</div>';
                    html += '</td>';
                }
            }
        });
        
        html += '</tr>';
    });
    html += '</tbody>';
    
    html += '</table>';
    
    // Add legend
    html += '<div class="heat-matrix-legend">';
    html += '<span class="legend-label">Fewest Matchups</span>';
    html += '<div class="legend-gradient">';
    for (let i = 0; i <= 10; i++) {
        const hue = 120;
        const saturation = 70;
        const lightness = 80 - (i * 5);
        html += `<div class="legend-gradient-stop" style="background: hsl(${hue}, ${saturation}%, ${lightness}%)"></div>`;
    }
    html += '</div>';
    html += `<span class="legend-label">Most Matchups (${maxMatchups})</span>`;
    html += '</div>';
    
    html += '</div>';
    
    container.innerHTML = html;
    fitMatrix();
}

// Size the cells so the whole matrix fits the space it has, with no scrolling:
// try sizes from large to small until the matrix (table + legend) fits.
function fitMatrix() {
    const container = document.getElementById('matrix-container');
    const wrapper = container && container.querySelector('.heat-matrix-wrapper');
    if (!wrapper) return;
    const style = getComputedStyle(container);
    const availW = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availH = container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const setCell = px => wrapper.style.setProperty('--cell', `${px}px`);
    const fits = () => wrapper.offsetHeight <= availH && wrapper.offsetWidth <= availW;
    // Largest cell size at which the matrix still fits. On a phone a fitted matrix would be
    // unreadably small, so it keeps 22px cells and the container scrolls instead.
    const minCell = window.innerWidth <= 800 ? 22 : 8;
    container.style.overflow = window.innerWidth <= 800 ? 'auto' : '';
    let best = minCell;
    for (let cell = 64; cell >= minCell; cell--) {
        setCell(cell);
        if (fits()) { best = cell; break; }
    }
    setCell(best);
}

let matrixResizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(matrixResizeTimer);
    matrixResizeTimer = setTimeout(fitMatrix, 100);
});
