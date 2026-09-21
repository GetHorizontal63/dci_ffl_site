// Record Book JavaScript
let leagueScoreData = [];

document.addEventListener('DOMContentLoaded', function() {
    initRecordBook();
});

function initRecordBook() {
    // Initialize tab navigation
    initTabNavigation();
    
    // Load league data
    loadLeagueData();
}

function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Add active class to clicked tab
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

function loadLeagueData() {
    LeagueDb.scoreRows()
        .then(data => {
            leagueScoreData = data;
            processLeagueRecords();
        })
        .catch(error => {
            console.error('Error loading league data:', error);
            showError();
        });
}

function processLeagueRecords() {
    const teamStats = {};
    const seasonStats = {};
    const weeklyPerformances = {};
    
    // Process each game
    leagueScoreData.forEach(game => {
        if (!game["Team"] || !game["Opponent"]) return;
        
        const team = game["Team"];
        const opponent = game["Opponent"];
        const teamScore = parseFloat(game["Team Score"]);
        const opponentScore = parseFloat(game["Opponent Score"]);
        const season = game["Season"];
        const week = game["Week"];
        const seasonPeriod = game["Season Period"] || "Regular";
        
        if (isNaN(teamScore) || isNaN(opponentScore)) return;
        
        // Initialize team stats
        if (!teamStats[team]) {
            teamStats[team] = {
                wins: 0,
                losses: 0,
                winStreak: 0,
                currentWinStreak: 0,
                losingStreak: 0,
                currentLosingStreak: 0,
                streak150Plus: 0,
                currentStreak150Plus: 0,
                streakUnder100: 0,
                currentStreakUnder100: 0,
                weeklyTopScores: 0,
                weeklyTop3Scores: 0,
                weeklyWorstScores: 0,
                weeklyBottom3Scores: 0,
                championships: 0,
                chumpionships: 0,
                championshipAppearances: 0,
                chumpionshipAppearances: 0,
                gameScores: []
            };
        }
        
        // Initialize season stats
        if (!seasonStats[season]) {
            seasonStats[season] = {};
        }
        if (!seasonStats[season][team]) {
            seasonStats[season][team] = {
                wins: 0,
                losses: 0,
                pointsFor: 0,
                pointsAgainst: 0
            };
        }
        
        // Record the game
        teamStats[team].gameScores.push({
            score: teamScore,
            season: season,
            week: week,
            opponent: opponent,
            opponentScore: opponentScore
        });
        
        // Update season stats
        seasonStats[season][team].pointsFor += teamScore;
        seasonStats[season][team].pointsAgainst += opponentScore;
        
        // Determine win/loss
        const isWin = teamScore > opponentScore;
        if (isWin) {
            teamStats[team].wins++;
            seasonStats[season][team].wins++;
            teamStats[team].currentWinStreak++;
            teamStats[team].currentLosingStreak = 0;
            teamStats[team].winStreak = Math.max(teamStats[team].winStreak, teamStats[team].currentWinStreak);
        } else if (teamScore < opponentScore) {
            teamStats[team].losses++;
            seasonStats[season][team].losses++;
            teamStats[team].currentLosingStreak++;
            teamStats[team].currentWinStreak = 0;
            teamStats[team].losingStreak = Math.max(teamStats[team].losingStreak, teamStats[team].currentLosingStreak);
        }
        
        // Track 150+ point streak
        if (teamScore >= 150) {
            teamStats[team].currentStreak150Plus++;
            teamStats[team].streak150Plus = Math.max(teamStats[team].streak150Plus, teamStats[team].currentStreak150Plus);
        } else {
            teamStats[team].currentStreak150Plus = 0;
        }
        
        // Track under 100 point streak
        if (teamScore < 100) {
            teamStats[team].currentStreakUnder100++;
            teamStats[team].streakUnder100 = Math.max(teamStats[team].streakUnder100, teamStats[team].currentStreakUnder100);
        } else {
            teamStats[team].currentStreakUnder100 = 0;
        }
        
        // Track weekly performances
        const weekKey = `${season}-${week}`;
        if (!weeklyPerformances[weekKey]) {
            weeklyPerformances[weekKey] = [];
        }
        weeklyPerformances[weekKey].push({ team: team, score: teamScore });
        
        // Track championship/chumpionship games
        if (seasonPeriod === "Championship") {
            teamStats[team].championshipAppearances++;
            if (isWin) {
                teamStats[team].championships++;
            }
        } else if (seasonPeriod === "Chumpionship") {
            teamStats[team].chumpionshipAppearances++;
            if (!isWin) {
                teamStats[team].chumpionships++;
            }
        }
    });
    
    // Process weekly performances for rankings
    Object.keys(weeklyPerformances).forEach(weekKey => {
        const weekScores = weeklyPerformances[weekKey].sort((a, b) => b.score - a.score);
        
        if (weekScores.length > 0) {
            // Top score
            teamStats[weekScores[0].team].weeklyTopScores++;
            
            // Top 3
            for (let i = 0; i < Math.min(3, weekScores.length); i++) {
                teamStats[weekScores[i].team].weeklyTop3Scores++;
            }
            
            // Worst score
            teamStats[weekScores[weekScores.length - 1].team].weeklyWorstScores++;
            
            // Bottom 3
            for (let i = Math.max(0, weekScores.length - 3); i < weekScores.length; i++) {
                teamStats[weekScores[i].team].weeklyBottom3Scores++;
            }
        }
    });
    
    // Calculate and display records
    calculateWinLossRecords(teamStats, seasonStats);
    calculateWinPercentageRecords(teamStats, seasonStats);
    calculateWeeklyPerformanceRecords(teamStats);
    calculateChampionshipRecords(teamStats);
    calculateStreakRecords(teamStats);
    calculateSingleGameRecords();
    calculateSingleSeasonRecords(seasonStats);
    calculatePlayerRecords();
    calculateTransactionAndLuckRecords();
}

function calculateWinLossRecords(teamStats, seasonStats) {
    // Most Career Wins
    const mostWinsOverall = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.wins }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostWinsOverall', mostWinsOverall);
    
    // Most Single-Season Wins
    const mostWinsSeason = [];
    Object.entries(seasonStats).forEach(([season, teams]) => {
        Object.entries(teams).forEach(([team, stats]) => {
            mostWinsSeason.push({ 
                team: `${team} (${season})`, 
                value: stats.wins 
            });
        });
    });
    mostWinsSeason.sort((a, b) => b.value - a.value);
    updateRecord('mostWinsSeason', mostWinsSeason.slice(0, 3));
    
    // Most Career Losses
    const mostLossesOverall = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.losses }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostLossesOverall', mostLossesOverall);
    
    // Most Single-Season Losses
    const mostLossesSeason = [];
    Object.entries(seasonStats).forEach(([season, teams]) => {
        Object.entries(teams).forEach(([team, stats]) => {
            mostLossesSeason.push({ 
                team: `${team} (${season})`, 
                value: stats.losses 
            });
        });
    });
    mostLossesSeason.sort((a, b) => b.value - a.value);
    updateRecord('mostLossesSeason', mostLossesSeason.slice(0, 3));
}

function calculateWinPercentageRecords(teamStats, seasonStats) {
    // Best Career Win %
    const bestWinPctOverall = Object.entries(teamStats)
        .filter(([team, stats]) => stats.wins + stats.losses >= 10) // Minimum games
        .map(([team, stats]) => ({
            team,
            value: (stats.wins / (stats.wins + stats.losses)).toFixed(3).replace(/^0(?=\.)/, '')
        }))
        .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
        .slice(0, 3);
    updateRecord('bestWinPctOverall', bestWinPctOverall);
    
    // Best Single-Season Win %
    const bestWinPctSeason = [];
    Object.entries(seasonStats).forEach(([season, teams]) => {
        Object.entries(teams).forEach(([team, stats]) => {
            const totalGames = stats.wins + stats.losses;
            if (totalGames >= 10) {
                bestWinPctSeason.push({
                    team: `${team} (${season})`,
                    value: (stats.wins / totalGames).toFixed(3).replace(/^0(?=\.)/, '')
                });
            }
        });
    });
    bestWinPctSeason.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    updateRecord('bestWinPctSeason', bestWinPctSeason.slice(0, 3));
    
    // Worst Career Win %
    const worstWinPctOverall = Object.entries(teamStats)
        .filter(([team, stats]) => stats.wins + stats.losses >= 10)
        .map(([team, stats]) => ({
            team,
            value: (stats.wins / (stats.wins + stats.losses)).toFixed(3).replace(/^0(?=\.)/, '')
        }))
        .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
        .slice(0, 3);
    updateRecord('worstWinPctOverall', worstWinPctOverall);
    
    // Worst Single-Season Win %
    const worstWinPctSeason = [];
    Object.entries(seasonStats).forEach(([season, teams]) => {
        Object.entries(teams).forEach(([team, stats]) => {
            const totalGames = stats.wins + stats.losses;
            if (totalGames >= 10) {
                worstWinPctSeason.push({
                    team: `${team} (${season})`,
                    value: (stats.wins / totalGames).toFixed(3).replace(/^0(?=\.)/, '')
                });
            }
        });
    });
    worstWinPctSeason.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
    updateRecord('worstWinPctSeason', worstWinPctSeason.slice(0, 3));
}

function calculateStreakRecords(teamStats) {
    // Longest Win Streak
    const longestWinStreak = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.winStreak }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('longestWinStreak', longestWinStreak);
    
    // Longest Losing Streak
    const longestLosingStreak = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.losingStreak }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('longestLosingStreak', longestLosingStreak);
    
    // Longest 150+ Point Streak
    const longest150PlusStreak = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.streak150Plus }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('longest150PlusStreak', longest150PlusStreak);
    
    // Sub 100 Point Streak
    const longestUnder100Streak = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.streakUnder100 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('longestUnder100Streak', longestUnder100Streak);
}

function calculateWeeklyPerformanceRecords(teamStats) {
    // Most Weekly Top Scores
    const mostWeeklyTopScores = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.weeklyTopScores }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostWeeklyTopScores', mostWeeklyTopScores);
    
    // Most Weekly Top 3 Scores
    const mostWeeklyTop3Scores = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.weeklyTop3Scores }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostWeeklyTop3Scores', mostWeeklyTop3Scores);
    
    // Most Weekly Worst Scores
    const mostWeeklyWorstScores = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.weeklyWorstScores }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostWeeklyWorstScores', mostWeeklyWorstScores);
    
    // Most Weekly Bottom 3 Scores
    const mostWeeklyBottom3Scores = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.weeklyBottom3Scores }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostWeeklyBottom3Scores', mostWeeklyBottom3Scores);
}

function calculateChampionshipRecords(teamStats) {
    // Most Championships (wins in championship game)
    const mostChampionships = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.championships }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostChampionships', mostChampionships);
    
    // Most Chumpionships (losses in chumpionship game)
    const mostChumpionships = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.chumpionships }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostChumpionships', mostChumpionships);
    
    // Most Championship Appearances
    const mostChampionshipAppearances = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.championshipAppearances }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostChampionshipAppearances', mostChampionshipAppearances);
    
    // Most Chumpionship Appearances
    const mostChumpionshipAppearances = Object.entries(teamStats)
        .map(([team, stats]) => ({ team, value: stats.chumpionshipAppearances }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    updateRecord('mostChumpionshipAppearances', mostChumpionshipAppearances);
}

async function calculatePlayerRecords() {
    try {
        const rosterData = await LeagueDb.leagueRosterPlayers();
        
        // Track unique players per team
        const teamPlayers = {};
        const seasonPlayers = {};
        
        rosterData.forEach(entry => {
            const team = entry.Team;
            const season = entry.Season;
            const player = entry.Player;
            
            if (!team || !season || !player) return;
            
            // Track all seasons
            if (!teamPlayers[team]) {
                teamPlayers[team] = new Set();
            }
            teamPlayers[team].add(player);
            
            // Track by season
            const seasonKey = `${team}-${season}`;
            if (!seasonPlayers[seasonKey]) {
                seasonPlayers[seasonKey] = {
                    team: team,
                    season: season,
                    players: new Set()
                };
            }
            seasonPlayers[seasonKey].players.add(player);
        });
        
        // The subtitles promise minimums (20 games overall, 10 in a season). That also keeps
        // managers with a handful of games and the season in progress out of the "fewest" records.
        const gamesByTeam = {}, gamesByTeamSeason = {};
        leagueScoreData.forEach(g => {
            if (!g.Team || !g.Opponent || g.Opponent.toLowerCase() === 'bye') return;
            gamesByTeam[g.Team] = (gamesByTeam[g.Team] || 0) + 1;
            const key = `${g.Team}-${g.Season}`;
            gamesByTeamSeason[key] = (gamesByTeamSeason[key] || 0) + 1;
        });
        Object.keys(teamPlayers).forEach(team => { if ((gamesByTeam[team] || 0) < 20) delete teamPlayers[team]; });
        Object.keys(seasonPlayers).forEach(key => { if ((gamesByTeamSeason[key] || 0) < 10) delete seasonPlayers[key]; });

        // Most unique players overall (min 20 games)
        const mostPlayersOverall = Object.entries(teamPlayers)
            .map(([team, players]) => ({ team, value: players.size }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);
        updateRecord('mostUniquePlayersOverall', mostPlayersOverall);
        
        // Fewest unique players overall (min 20 games)
        const fewestPlayersOverall = Object.entries(teamPlayers)
            .map(([team, players]) => ({ team, value: players.size }))
            .sort((a, b) => a.value - b.value)
            .slice(0, 3);
        updateRecord('fewestUniquePlayersOverall', fewestPlayersOverall);
        
        // Most unique players single season (min 10 games)
        const mostPlayersSeason = Object.values(seasonPlayers)
            .map(entry => ({ 
                team: `${entry.team} (${entry.season})`, 
                value: entry.players.size 
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);
        updateRecord('mostUniquePlayersSeason', mostPlayersSeason);
        
        // Fewest unique players single season (min 10 games)
        const fewestPlayersSeason = Object.values(seasonPlayers)
            .map(entry => ({ 
                team: `${entry.team} (${entry.season})`, 
                value: entry.players.size 
            }))
            .sort((a, b) => a.value - b.value)
            .slice(0, 3);
        updateRecord('fewestUniquePlayersSeason', fewestPlayersSeason);
        
    } catch (error) {
        console.error('Error calculating player records:', error);
        // Set empty records if calculation fails
        updateRecord('mostUniquePlayersOverall', []);
        updateRecord('fewestUniquePlayersOverall', []);
        updateRecord('mostUniquePlayersSeason', []);
        updateRecord('fewestUniquePlayersSeason', []);
    }
}

function calculateSingleGameRecords() {
    const allScores = [];
    const processedBlowouts = new Set();
    const processedCloseGames = new Set();
    const allBlowouts = [];
    const allCloseGames = [];
    
    leagueScoreData.forEach(game => {
        if (!game["Team"] || !game["Opponent"]) return;
        
        const teamScore = parseFloat(game["Team Score"]);
        const opponentScore = parseFloat(game["Opponent Score"]);
        const scoreDiff = Math.abs(teamScore - opponentScore);
        const gameId = game["Game ID"];
        
        if (isNaN(teamScore) || isNaN(opponentScore)) return;
        
        // Add all individual team scores
        allScores.push({
            team: game["Team"],
            value: teamScore.toFixed(2)
        });
        
        // Track blowouts and close games only once per Game ID
        if (gameId && !processedBlowouts.has(gameId)) {
            processedBlowouts.add(gameId);
            const winner = teamScore > opponentScore ? game["Team"] : game["Opponent"];
            const loser = teamScore > opponentScore ? game["Opponent"] : game["Team"];
            
            allBlowouts.push({
                team: `${winner} vs ${loser}`,
                value: scoreDiff.toFixed(2)
            });
            
            // Only consider games with diff < 50 for closest
            if (scoreDiff < 50 && !processedCloseGames.has(gameId)) {
                processedCloseGames.add(gameId);
                allCloseGames.push({
                    team: `${winner} vs ${loser}`,
                    value: scoreDiff.toFixed(2)
                });
            }
        }
    });
    
    // Highest Score
    allScores.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    updateRecord('highestScore', allScores.slice(0, 3));
    
    // Lowest Score
    allScores.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
    updateRecord('lowestScore', allScores.slice(0, 3));
    
    // Largest Blowout
    allBlowouts.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    updateRecord('largestBlowout', allBlowouts.slice(0, 3));
    
    // Closest Matchup
    allCloseGames.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
    updateRecord('closestMatchup', allCloseGames.slice(0, 3));
}

function calculateSingleSeasonRecords(seasonStats) {
    const pointTotals = [];
    const pointDiffs = [];
    
    Object.entries(seasonStats).forEach(([season, teams]) => {
        Object.entries(teams).forEach(([team, stats]) => {
            if (stats.wins + stats.losses < 10) return;   // season in progress (or too few games) says nothing
            pointTotals.push({
                team: `${team} (${season})`,
                value: stats.pointsFor.toFixed(2)
            });
            
            const diff = stats.pointsFor - stats.pointsAgainst;
            pointDiffs.push({
                team: `${team} (${season})`,
                value: diff.toFixed(2)
            });
        });
    });
    
    // Highest Point Total
    pointTotals.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    updateRecord('highestPointTotal', pointTotals.slice(0, 3));
    
    // Lowest Point Total
    pointTotals.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
    updateRecord('lowestPointTotal', pointTotals.slice(0, 3));
    
    // Highest Point Differential
    pointDiffs.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    updateRecord('highestPointDiff', pointDiffs.slice(0, 3));
    
    // Lowest Point Differential
    pointDiffs.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
    updateRecord('lowestPointDiff', pointDiffs.slice(0, 3));
}

function updateRecord(recordName, data) {
    const positions = ['holder', 'runner-up-1', 'runner-up-2'];
    
    positions.forEach((position, index) => {
        const element = document.querySelector(`[data-record="${recordName}"][data-position="${position}"]`);
        if (!element) return;
        
        const nameElement = element.querySelector('.record-name');
        const valueElement = element.querySelector('.record-value');
        
        if (data[index]) {
            nameElement.textContent = data[index].team;
            valueElement.textContent = data[index].value;
        } else {
            nameElement.textContent = '--';
            valueElement.textContent = '--';
        }
    });
}

function showError() {
    document.querySelectorAll('.record-name').forEach(el => {
        el.textContent = 'Error loading data';
    });
    document.querySelectorAll('.record-value').forEach(el => {
        el.textContent = '--';
    });
}

// ---------------------------------------------------------------------------
// Transactions and luck. Completed seasons only: an in-progress season has too
// little history to grade or compare. Grades come from python/transaction_grades.py.
// ---------------------------------------------------------------------------
const GRADE_POINTS = { A: 4, B: 3, C: 2, D: 1, F: 0 };

function addRecordCategory(tabId, title, cards) {
    const tab = document.getElementById(tabId);
    if (!tab) return;
    const holders = key => ['holder', 'runner-up-1', 'runner-up-2'].map((position, i) => `
                <div class="${i === 0 ? 'record-holder' : 'record-runner-up'}" data-record="${key}" data-position="${position}">
                    <span class="record-rank">${i + 1}.</span>
                    <span class="record-name">Loading...</span>
                    <span class="record-value">0</span>
                </div>`).join('');
    const section = document.createElement('div');
    section.className = 'records-category';
    section.innerHTML = `
        <h2 class="category-title">${title}</h2>
        <div class="records-grid">${cards.map(card => `
            <div class="record-card">
                <h3 class="record-title">${card.title}</h3>
                <p class="record-subtitle">${card.subtitle}</p>
                <div class="record-holders">${holders(card.key)}
                </div>
            </div>`).join('')}
        </div>`;
    tab.appendChild(section);
}

const topN = (list, better) => [...list].sort((a, b) => better === 'high' ? b.raw - a.raw : a.raw - b.raw).slice(0, 3);

async function calculateTransactionAndLuckRecords() {
    try {
        const [completedRows, moves, playerNames] = await Promise.all([
            LeagueDb.query('SELECT DISTINCT season FROM final_placements'),
            LeagueDb.query(`
                SELECT m.move_id, m.kind, m.season, m.effective_week, m.grade, m.net_total, o.display_name AS owner
                FROM transaction_moves m JOIN owners o ON o.owner_id = m.owner_id
                WHERE m.provisional = 0`),
            LeagueDb.query(`
                SELECT mp.move_id, mp.direction, p.name
                FROM transaction_move_players mp JOIN players p ON p.player_id = mp.player_id`)
        ]);
        const completed = new Set(completedRows.map(r => r.season));

        const namesByMove = new Map();
        playerNames.forEach(r => {
            const key = `${r.move_id}|${r.direction}`;
            if (!namesByMove.has(key)) namesByMove.set(key, []);
            namesByMove.get(key).push(r.name);
        });

        // ----- counts and GPA, per manager (career) and per manager-season -----
        const career = new Map(), seasonal = new Map();
        const bucket = (map, key, label) => {
            if (!map.has(key)) map.set(key, { label, PICKUP: [], TRADE: [], DROP: [] });
            return map.get(key);
        };
        moves.forEach(m => {
            bucket(career, m.owner, m.owner)[m.kind].push(m);
            bucket(seasonal, `${m.owner}|${m.season}`, `${m.owner} (${m.season})`)[m.kind].push(m);
        });
        const gpa = list => {
            const graded = list.filter(m => m.grade);
            return { n: graded.length, value: graded.length ? graded.reduce((s, m) => s + GRADE_POINTS[m.grade], 0) / graded.length : null };
        };
        const countRecord = (map, kind) => [...map.values()].map(b => ({ team: b.label, raw: b[kind].length, value: String(b[kind].length) }));
        const gpaRecord = (map, kind, minGraded) => [...map.values()]
            .map(b => ({ b, g: gpa(b[kind]) })).filter(x => x.g.n >= minGraded)
            .map(x => ({ team: x.b.label, raw: x.g.value, value: x.g.value.toFixed(2) }));
        const set = (key, list, better) => updateRecord(key, topN(list, better));

        // ----- luck: actual wins / wins the weekly score ranks predict, x 100 -----
        const weekSize = {};
        const regular = leagueScoreData.filter(g => g['Season Period'] === 'Regular' && g.Team && g.Opponent &&
            g.Opponent.toLowerCase() !== 'bye' && completed.has(g.Season));
        regular.forEach(g => {
            const w = weekSize[`${g.Season}-${g.Week}`] || (weekSize[`${g.Season}-${g.Week}`] = { rows: 0, maxRank: 0 });
            w.rows += 1;
            w.maxRank = Math.max(w.maxRank, Number(g['Score Rank on Week']) || 0);
        });
        const luckCareer = new Map(), luckSeason = new Map();
        regular.forEach(g => {
            const rank = Number(g['Score Rank on Week']);
            const w = weekSize[`${g.Season}-${g.Week}`];
            const n = Math.max(w.rows, w.maxRank);
            if (!(rank >= 1) || !(n > 1)) return;
            const us = Number(g['Team Score']), them = Number(g['Opponent Score']);
            const win = us > them ? 1 : us === them ? 0.5 : 0;
            const expected = (n - rank) / (n - 1);
            const add = (map, key, label) => {
                const e = map.get(key) || { label, wins: 0, expected: 0, games: 0, seasons: new Set() };
                e.wins += win; e.expected += expected; e.games += 1; e.seasons.add(g.Season);
                map.set(key, e);
            };
            add(luckCareer, g.Team, g.Team);
            add(luckSeason, `${g.Team}|${g.Season}`, `${g.Team} (${g.Season})`);
        });
        const luckList = (map, minGames, minSeasons) => [...map.values()]
            .filter(e => e.games >= minGames && e.seasons.size >= minSeasons && e.expected > 0)
            .map(e => ({ team: e.label, raw: 100 * e.wins / e.expected, value: (100 * e.wins / e.expected).toFixed(1) }));

        // ----- single moves (best / worst) -----
        const moveList = (kind, side) => moves.filter(m => m.kind === kind).map(m => {
            const names = (namesByMove.get(`${m.move_id}|${side}`) || []).slice(0, 2).join(', ');
            const what = names ? ` - ${names}` : '';
            // a drop's net is minus what the player scored afterwards, so show those points as a plain number
            const shown = kind === 'DROP' ? `${(-m.net_total).toFixed(1)}` : `${m.net_total >= 0 ? '+' : ''}${m.net_total.toFixed(1)}`;
            return { team: `${m.owner} (${m.season} Wk ${m.effective_week})${what}`, raw: m.net_total, value: shown };
        });

        // ----- cards -----
        addRecordCategory('league-records', 'Transactions (Full History)', [
            { key: 'txMostPickups', title: 'Waiver Wire Regular', subtitle: 'Most waiver and free-agent pickups' },
            { key: 'txMostTrades', title: 'Deal Maker', subtitle: 'Most trades made' },
            { key: 'txMostDrops', title: 'Cut Happy', subtitle: 'Most players dropped outright' },
            { key: 'txBestPickupGpa', title: 'Waiver Wire Wizard', subtitle: 'Best pickup GPA, career (min 25 graded pickups)' },
            { key: 'txWorstPickupGpa', title: 'Waiver Wire Dud', subtitle: 'Worst pickup GPA, career (min 25 graded pickups)' },
            { key: 'txBestTradeGpa', title: 'Trade Shark', subtitle: 'Best trade GPA, career (min 3 trades)' },
            { key: 'txWorstTradeGpa', title: 'Robbed Blind', subtitle: 'Worst trade GPA, career (min 3 trades)' },
            { key: 'txBestDropGpa', title: 'Ruthless Cutter', subtitle: 'Best drop GPA, career (min 15 graded drops)' },
            { key: 'txWorstDropGpa', title: 'Cut Him Too Soon', subtitle: 'Worst drop GPA, career (min 15 graded drops)' }
        ]);
        addRecordCategory('league-records', 'Luck', [
            { key: 'luckBestCareer', title: 'Charmed Life', subtitle: 'Luckiest career: actual wins vs. wins the weekly scores predict (100 = average, min 3 seasons)' },
            { key: 'luckWorstCareer', title: 'Born Under a Bad Sign', subtitle: 'Unluckiest career (100 = average, min 3 seasons)' }
        ]);
        addRecordCategory('single-season', 'Transactions (Single Season)', [
            { key: 'txMostPickupsSeason', title: 'Always on the Wire', subtitle: 'Most pickups in a single season' },
            { key: 'txMostTradesSeason', title: 'Wheeler Dealer', subtitle: 'Most trades in a single season' },
            { key: 'txMostDropsSeason', title: 'Roster Churn', subtitle: 'Most players dropped outright in a single season' },
            { key: 'txBestPickupGpaSeason', title: 'Wire Genius', subtitle: 'Best pickup GPA in a season (min 8 graded pickups)' },
            { key: 'txWorstPickupGpaSeason', title: 'Wire Disaster', subtitle: 'Worst pickup GPA in a season (min 8 graded pickups)' },
            { key: 'txBestTradeGpaSeason', title: 'Fleeced Them', subtitle: 'Best trade GPA in a season (min 2 trades)' },
            { key: 'txWorstTradeGpaSeason', title: 'Fleeced', subtitle: 'Worst trade GPA in a season (min 2 trades)' }
        ]);
        addRecordCategory('single-season', 'Best & Worst Moves', [
            { key: 'txBestPickupEver', title: 'Best Pickup Ever', subtitle: 'Most rest-of-season points gained on one pickup (added minus dropped)' },
            { key: 'txBestTradeEver', title: 'Best Trade Ever', subtitle: 'Most rest-of-season points gained on one side of a trade' },
            { key: 'txWorstTradeEver', title: 'Worst Trade Ever', subtitle: 'Most rest-of-season points lost on one side of a trade' },
            { key: 'txCostliestDrop', title: 'Costliest Drop', subtitle: 'Dropped a player who then scored the most points for the rest of the regular season' }
        ]);
        addRecordCategory('single-season', 'Luck (Single Season)', [
            { key: 'luckBestSeason', title: 'Charmed Season', subtitle: 'Luckiest season (100 = average, min 10 games)' },
            { key: 'luckWorstSeason', title: 'Cursed Season', subtitle: 'Unluckiest season (100 = average, min 10 games)' }
        ]);

        set('txMostPickups', countRecord(career, 'PICKUP'), 'high');
        set('txMostTrades', countRecord(career, 'TRADE'), 'high');
        set('txMostDrops', countRecord(career, 'DROP'), 'high');
        set('txBestPickupGpa', gpaRecord(career, 'PICKUP', 25), 'high');
        set('txWorstPickupGpa', gpaRecord(career, 'PICKUP', 25), 'low');
        set('txBestTradeGpa', gpaRecord(career, 'TRADE', 3), 'high');
        set('txWorstTradeGpa', gpaRecord(career, 'TRADE', 3), 'low');
        set('txBestDropGpa', gpaRecord(career, 'DROP', 15), 'high');
        set('txWorstDropGpa', gpaRecord(career, 'DROP', 15), 'low');
        set('luckBestCareer', luckList(luckCareer, 0, 3), 'high');
        set('luckWorstCareer', luckList(luckCareer, 0, 3), 'low');

        set('txMostPickupsSeason', countRecord(seasonal, 'PICKUP'), 'high');
        set('txMostTradesSeason', countRecord(seasonal, 'TRADE'), 'high');
        set('txMostDropsSeason', countRecord(seasonal, 'DROP'), 'high');
        set('txBestPickupGpaSeason', gpaRecord(seasonal, 'PICKUP', 8), 'high');
        set('txWorstPickupGpaSeason', gpaRecord(seasonal, 'PICKUP', 8), 'low');
        set('txBestTradeGpaSeason', gpaRecord(seasonal, 'TRADE', 2), 'high');
        set('txWorstTradeGpaSeason', gpaRecord(seasonal, 'TRADE', 2), 'low');
        set('luckBestSeason', luckList(luckSeason, 10, 1), 'high');
        set('luckWorstSeason', luckList(luckSeason, 10, 1), 'low');

        set('txBestPickupEver', moveList('PICKUP', 'IN'), 'high');
        set('txBestTradeEver', moveList('TRADE', 'IN'), 'high');
        set('txWorstTradeEver', moveList('TRADE', 'IN'), 'low');
        // a drop's net is the negative of what the player scored afterwards, so the worst is the lowest
        set('txCostliestDrop', moveList('DROP', 'OUT'), 'low');
    } catch (error) {
        console.error('Error calculating transaction records:', error);
    }
}

// ---------------------------------------------------------------------------
// Record vs. playoffs (cumulative): wins down the side, losses across the top. Every team is
// followed through every week of every completed season, and each record it passes through
// counts once (a team is 0-0, then 1-0, then 1-1, ...). A cell's number is how many team-seasons
// have ever been at that record; its colour is the share of them that went on to make the
// Championship bracket.
// ---------------------------------------------------------------------------
function recordOddsPanel(teamRows, scoreRows) {
    const finished = new Set(teamRows.filter(r => r.place != null).map(r => r.season));
    const madeBracket = new Map(teamRows.filter(r => r.place != null)
        .map(r => [`${r.season}|${r.owner}`, r.bracketType === 'championship']));

    // one list of results per team-season, in week order
    const paths = new Map();
    scoreRows.forEach(g => {
        if (g['Season Period'] !== 'Regular' || !finished.has(g.Season) || !g.Team || !g.Opponent) return;
        if (g.Team.toLowerCase() === 'bye' || g.Opponent.toLowerCase() === 'bye') return;
        const us = Number(g['Team Score']), them = Number(g['Opponent Score']);
        if (Number.isNaN(us) || Number.isNaN(them)) return;
        const key = `${g.Season}|${g.Team}`;
        if (!paths.has(key)) paths.set(key, []);
        paths.get(key).push({ week: g.Week, win: us > them, loss: us < them });
    });

    const cells = new Map();                                     // 'w-l' -> { n, made }
    let maxWins = 0, maxLosses = 0;
    paths.forEach((games, key) => {
        games.sort((a, b) => a.week - b.week);
        let w = 0, l = 0;
        const seen = new Set(['0-0']);
        games.forEach(g => { if (g.win) w += 1; else if (g.loss) l += 1; seen.add(`${w}-${l}`); });
        const made = madeBracket.get(key) === true;
        seen.forEach(rec => {
            const cell = cells.get(rec) || { n: 0, made: 0 };
            cell.n += 1;
            if (made) cell.made += 1;
            cells.set(rec, cell);
            const [rw, rl] = rec.split('-').map(Number);
            maxWins = Math.max(maxWins, rw);
            maxLosses = Math.max(maxLosses, rl);
        });
    });
    if (!paths.size) return '';

    const losses = Array.from({ length: maxLosses + 1 }, (_, i) => i);
    const wins = Array.from({ length: maxWins + 1 }, (_, i) => maxWins - i);   // most wins at the top
    const shade = share => `hsl(${Math.round(share * 125)}, 62%, 34%)`;          // red (0%) -> amber -> green (100%)

    const body = wins.map(w => `
        <tr>
            <th class="hp-rec-side">${w}</th>
            ${losses.map(l => {
                const cell = cells.get(`${w}-${l}`);
                if (!cell) return '<td class="hp-rec-empty"></td>';
                const share = cell.made / cell.n;
                const pct = Math.round(share * 100);
                const tip = `${w}-${l}: reached ${cell.n} time${cell.n === 1 ? '' : 's'}; ${cell.made} of those teams made the Championship bracket (${pct}%)`;
                return `<td class="hp-rec-cell" style="background:${shade(share)}" title="${tip}"><b>${cell.n}</b><span>${pct}%</span></td>`;
            }).join('')}
        </tr>`).join('');

    return `
        <div class="hp-panel hp-rec">
            <h2 class="hp-panel-title">Record vs. Playoffs<small>every team, every week, every completed season</small></h2>
            <div class="hp-scroll">
                <table class="hp-rec-table">
                    <thead>
                        <tr><th class="hp-rec-corner" rowspan="2">Wins &darr;</th><th colspan="${losses.length}">Losses &rarr;</th></tr>
                        <tr>${losses.map(l => `<th>${l}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            <div class="hp-rec-legend">
                <span>Share that made the Championship bracket:</span><span>0%</span>
                <span class="hp-rec-bar"></span>
                <span>100%</span>
                <span class="hp-rec-key"><b>N</b> = teams that reached the record</span>
            </div>
        </div>`;
}

// On a desktop-size window the matrix is sized to fill the tab so it never needs scrolling; on phones
// it keeps a fixed cell size and scrolls sideways.
function fitRecordOdds() {
    const panel = document.querySelector('#record-odds .hp-rec');
    const table = panel && panel.querySelector('.hp-rec-table');
    const host = document.getElementById('hp-content');
    if (!table || !host || !host.clientHeight || panel.offsetParent === null) return;
    if (window.innerWidth <= 800) {
        table.style.removeProperty('--rec-w');
        table.style.removeProperty('--rec-h');
        table.classList.remove('hp-rec-tight');
        return;
    }
    const rows = table.tBodies[0].rows.length;
    const cols = table.tBodies[0].rows[0].cells.length - 1;
    const hostStyle = getComputedStyle(host);
    const availH = host.clientHeight - parseFloat(hostStyle.paddingBottom || 0);
    const scroll = panel.querySelector('.hp-scroll');
    const scrollStyle = getComputedStyle(scroll);
    const used = panel.querySelector('.hp-panel-title').offsetHeight
        + panel.querySelector('.hp-rec-legend').offsetHeight
        + table.tHead.offsetHeight
        + parseFloat(scrollStyle.paddingTop) + parseFloat(scrollStyle.paddingBottom)
        + parseFloat(getComputedStyle(panel).marginBottom) + 8;      // panel gap below it, borders, table edge spacing
    const spacing = 3;
    const cellH = Math.max(18, Math.floor((availH - used) / rows) - spacing);
    const sideW = table.querySelector('.hp-rec-side').offsetWidth || 40;
    const availW = scroll.clientWidth - parseFloat(scrollStyle.paddingLeft) - parseFloat(scrollStyle.paddingRight) - sideW;
    const cellW = Math.max(24, Math.min(Math.floor(cellH * 1.5), Math.floor(availW / cols) - spacing));
    table.style.setProperty('--rec-h', `${cellH}px`);
    table.style.setProperty('--rec-w', `${cellW}px`);
    table.classList.toggle('hp-rec-tight', cellH < 34);
}

// The matrix is cumulative (all teams, all weeks, all completed seasons), so it lives here rather than on
// the season-by-season Standings History page.
async function renderRecordOdds() {
    const target = document.getElementById('record-odds');
    if (!target) return;
    try {
        const [teamRows, scoreRows] = await Promise.all([LeagueDb.seasonTeamRows(), LeagueDb.scoreRows()]);
        target.innerHTML = recordOddsPanel(teamRows, scoreRows) || '<div class="hp-panel"><div class="hp-empty">No completed seasons yet.</div></div>';
        fitRecordOdds();
    } catch (error) {
        console.error('Error building record odds:', error);
        target.innerHTML = '<div class="hp-panel"><div class="hp-error">Error loading data.</div></div>';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    renderRecordOdds();
    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => setTimeout(fitRecordOdds, 0)));
    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(fitRecordOdds, 100); });
});

// ---------------------------------------------------------------------------
// Scorigami: every final score the league has ever produced. The x axis is the LOSING team's score,
// the y axis the WINNING team's, both rounded down to a whole number, from 50 to 250. A cell lights up
// once a game has ended with exactly that pair; its colour says how many games have.
// ---------------------------------------------------------------------------
const SCORI_MIN = 50, SCORI_MAX = 250, SCORI_N = SCORI_MAX - SCORI_MIN + 1;
const SCORI_COLORS = ['#4b4b4b', 'hsl(48, 88%, 52%)', 'hsl(28, 88%, 52%)', 'hsl(6, 82%, 50%)'];   // 0 (unused), 1, 2, 3+
let scorigami = null;                       // { cells: Map('w-l' -> [games]), games }
let scoriLayout = null;                     // canvas geometry, kept for the hover lookup

async function renderScorigami() {
    const target = document.getElementById('scorigami');
    if (!target) return;
    try {
        const rows = await LeagueDb.scoreRows();
        const cells = new Map();
        let games = 0;
        rows.forEach(g => {
            // each game is listed once per team; take it from the lower owner id's side only
            if (!(Number(g['Team Owner ID']) < Number(g['Opponent Owner ID']))) return;
            if (!g.Team || !g.Opponent || g.Opponent.toLowerCase() === 'bye' || g.Team.toLowerCase() === 'bye') return;
            const a = Number(g['Team Score']), b = Number(g['Opponent Score']);
            if (Number.isNaN(a) || Number.isNaN(b) || a === b) return;
            const win = Math.floor(Math.max(a, b)), lose = Math.floor(Math.min(a, b));
            if (win < SCORI_MIN || win > SCORI_MAX || lose < SCORI_MIN) return;
            const winnerIsTeam = a > b;
            const key = `${win}-${lose}`;
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push({
                winner: winnerIsTeam ? g.Team : g.Opponent, loser: winnerIsTeam ? g.Opponent : g.Team,
                win: Math.max(a, b), lose: Math.min(a, b), season: g.Season, week: g.Week, period: g['Season Period']
            });
            games += 1;
        });
        scorigami = { cells, games };
        const possible = SCORI_N * (SCORI_N + 1) / 2;
        target.innerHTML = `
            <div class="hp-panel hp-scori">
                <h2 class="hp-panel-title">Scorigami<small>${cells.size.toLocaleString()} different final scores in ${games.toLocaleString()} games</small></h2>
                <div class="hp-scori-body">
                    <canvas id="scori-canvas"></canvas>
                    <div id="scori-tip" class="hp-scori-tip"></div>
                </div>
                <div class="hp-rec-legend">
                    <span>Times that exact score has happened:</span>
                    <span class="hp-scori-key" style="background:${SCORI_COLORS[1]}"></span><span>1</span>
                    <span class="hp-scori-key" style="background:${SCORI_COLORS[2]}"></span><span>2</span>
                    <span class="hp-scori-key" style="background:${SCORI_COLORS[3]}"></span><span>3+</span>
                    <span class="hp-rec-key">${cells.size.toLocaleString()} of ${possible.toLocaleString()} possible scores reached (${(cells.size / possible * 100).toFixed(1)}%) &middot; scores rounded down &middot; hover a square for its games</span>
                </div>
            </div>`;
        setupScoriCanvas();
        fitScorigami();
    } catch (error) {
        console.error('Error building scorigami:', error);
        target.innerHTML = '<div class="hp-panel"><div class="hp-error">Error loading data.</div></div>';
    }
}

// Size the canvas to the space the tab has: square cells as large as fit (a phone keeps 3px cells and scrolls).
function fitScorigami() {
    const panel = document.querySelector('#scorigami .hp-scori');
    const canvas = document.getElementById('scori-canvas');
    const host = document.getElementById('hp-content');
    if (!panel || !canvas || !host || panel.offsetParent === null) return;
    const AX = 46, AY = 34;                                  // room for the axis numbers and titles
    let cell = 3;
    if (window.innerWidth > 800) {
        const body = panel.querySelector('.hp-scori-body');
        const used = panel.querySelector('.hp-panel-title').offsetHeight + panel.querySelector('.hp-rec-legend').offsetHeight
            + parseFloat(getComputedStyle(panel).marginBottom) + 8
            + parseFloat(getComputedStyle(body).paddingTop) + parseFloat(getComputedStyle(body).paddingBottom);
        const availH = host.clientHeight - parseFloat(getComputedStyle(host).paddingBottom || 0) - used;
        const availW = body.clientWidth - 24;
        cell = Math.max(2, Math.min((availH - AY) / SCORI_N, (availW - AX) / SCORI_N));   // fractional: fill the space, snapped to device pixels below
    }
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.ceil(AX + SCORI_N * cell + 8), cssH = Math.ceil(AY + SCORI_N * cell + 6);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scoriLayout = { cell, AX, AY, top: 6 };

    // background: possible scores (winner >= loser) are faint squares, impossible ones are empty
    ctx.clearRect(0, 0, cssW, cssH);
    const gap = cell >= 5 ? 1 : 0;
    const snap = v => Math.round(v * dpr) / dpr;                    // snap cell edges to device pixels so there are no seams
    const colX = i => snap(AX + i * cell), rowY = j => snap(scoriLayout.top + j * cell);
    for (let lose = SCORI_MIN; lose <= SCORI_MAX; lose++) {
        for (let win = lose; win <= SCORI_MAX; win++) {
            const games = scorigami.cells.get(`${win}-${lose}`);
            const n = games ? Math.min(3, games.length) : 0;
            ctx.fillStyle = n ? SCORI_COLORS[n] : 'rgba(255, 255, 255, 0.05)';
            const i = lose - SCORI_MIN, j = SCORI_MAX - win;
            ctx.fillRect(colX(i), rowY(j), colX(i + 1) - colX(i) - gap, rowY(j + 1) - rowY(j) - gap);
        }
    }
    // axes: a label every 25, gridline ticks, and titles
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.textBaseline = 'middle';
    for (let v = SCORI_MIN; v <= SCORI_MAX; v += 25) {
        const y = scoriLayout.top + (SCORI_MAX - v) * cell + cell / 2;
        ctx.textAlign = 'right';
        ctx.fillText(String(v), AX - 6, y);
        ctx.beginPath(); ctx.moveTo(AX - 3, y); ctx.lineTo(AX, y); ctx.stroke();
        const x = AX + (v - SCORI_MIN) * cell + cell / 2;
        ctx.textAlign = 'center';
        ctx.fillText(String(v), x, scoriLayout.top + SCORI_N * cell + 14);
        ctx.beginPath(); ctx.moveTo(x, scoriLayout.top + SCORI_N * cell); ctx.lineTo(x, scoriLayout.top + SCORI_N * cell + 3); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '600 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOSING TEAM SCORE \u2192', AX + (SCORI_N * cell) / 2, scoriLayout.top + SCORI_N * cell + 28);
    ctx.save();
    ctx.translate(11, scoriLayout.top + (SCORI_N * cell) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('WINNING TEAM SCORE \u2192', 0, 0);
    ctx.restore();
}

function setupScoriCanvas() {
    const canvas = document.getElementById('scori-canvas');
    const tip = document.getElementById('scori-tip');
    if (!canvas || !tip) return;
    const show = event => {
        if (!scoriLayout || !scorigami) return;
        const rect = canvas.getBoundingClientRect();
        const px = (event.touches ? event.touches[0].clientX : event.clientX) - rect.left;
        const py = (event.touches ? event.touches[0].clientY : event.clientY) - rect.top;
        const lose = SCORI_MIN + Math.floor((px - scoriLayout.AX) / scoriLayout.cell);
        const win = SCORI_MAX - Math.floor((py - scoriLayout.top) / scoriLayout.cell);
        if (lose < SCORI_MIN || lose > SCORI_MAX || win < SCORI_MIN || win > SCORI_MAX || win < lose) { tip.style.display = 'none'; return; }
        const games = (scorigami.cells.get(`${win}-${lose}`) || []).slice().sort((a, b) => b.season - a.season || b.week - a.week);
        const lines = games.slice(0, 4).map(g => `<div>${g.winner} ${g.win.toFixed(2)} def. ${g.loser} ${g.lose.toFixed(2)} <i>${g.season} wk ${g.week}${g.period && g.period !== 'Regular' ? ` &middot; ${g.period}` : ''}</i></div>`).join('');
        tip.innerHTML = `<b>${win} - ${lose}</b>${games.length
            ? `<span>${games.length} game${games.length === 1 ? '' : 's'}</span>${lines}${games.length > 4 ? `<div><i>and ${games.length - 4} more</i></div>` : ''}`
            : '<span>never happened (a scorigami waiting to happen)</span>'}`;
        tip.style.display = 'block';
        const body = canvas.parentElement.getBoundingClientRect();
        const left = px + rect.left - body.left + 16;
        tip.style.left = `${Math.min(left, body.width - tip.offsetWidth - 8)}px`;
        tip.style.top = `${Math.max(4, py + rect.top - body.top - tip.offsetHeight - 10)}px`;
    };
    canvas.addEventListener('mousemove', show);
    canvas.addEventListener('click', show);
    canvas.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}

document.addEventListener('DOMContentLoaded', () => {
    renderScorigami();
    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => setTimeout(fitScorigami, 0)));
    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(fitScorigami, 100); });
});
