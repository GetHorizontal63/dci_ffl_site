// Global variables
let teamAbbreviations = {};
let gameData = null;
let rosterData = null;
let rosterRules = {};

// NFL team abbreviation mapping object - maps abbreviations from roster data to filename
const nflTeamAbbreviationMap = {
    'ari': 'ari', 'atl': 'atl', 'bal': 'bal', 'buf': 'buf', 
    'car': 'car', 'chi': 'chi', 'cin': 'cin', 'cle': 'cle', 
    'dal': 'dal', 'den': 'den', 'det': 'det', 'gb': 'gb', 
    'hou': 'hou', 'ind': 'ind', 'jax': 'jax', 'kc': 'kc', 
    'lac': 'lac', 'lar': 'lar', 'lv': 'lv', 'mia': 'mia', 
    'min': 'min', 'ne': 'ne', 'no': 'no', 'nyg': 'nyg', 
    'nyj': 'nyj', 'phi': 'phi', 'pit': 'pit', 'sea': 'sea', 
    'sf': 'sf', 'tb': 'tb', 'ten': 'ten', 'wsh': 'wsh',
    
    // Washington - handle both abbreviations explicitly
    'was': 'wsh', 'washington': 'wsh', 'redskins': 'wsh', 'commanders': 'wsh', 'wft': 'wsh',
    
    // Common alternate abbreviations
    'kan': 'kc', 'kcc': 'kc', 'kansas': 'kc', 'chiefs': 'kc',
    'oak': 'lv', 'raiders': 'lv', 'las': 'lv', 'vegas': 'lv',
    'sdg': 'lac', 'sd': 'lac', 'chargers': 'lac', 'la': 'lac',
    'stl': 'lar', 'rams': 'lar', 'los': 'lar',
    'jac': 'jax', 'jaguars': 'jax', 'jacksonville': 'jax',
    'nwe': 'ne', 'nep': 'ne', 'patriots': 'ne',
    'nor': 'no', 'saints': 'no', 'orleans': 'no',
    'gnb': 'gb', 'packers': 'gb', 'green': 'gb', 'bay': 'gb',
    'tam': 'tb', 'tamp': 'tb', 'tampa': 'tb', 'buccaneers': 'tb',
    'sfo': 'sf', '49ers': 'sf', 'niners': 'sf',
    'crd': 'ari', 'arizona': 'ari', 'cardinals': 'ari',
    
    // Handle legacy or relocated teams
    'oak': 'lv', 'stl': 'lar', 'sd': 'lac',
    
    // Handle teams that might appear in full name
    'cardinals': 'ari', 'falcons': 'atl', 'ravens': 'bal', 'bills': 'buf',
    'panthers': 'car', 'bears': 'chi', 'bengals': 'cin', 'browns': 'cle',
    'cowboys': 'dal', 'broncos': 'den', 'lions': 'det', 'texans': 'hou',
    'colts': 'ind', 'dolphins': 'mia', 'vikings': 'min', 'giants': 'nyg',
    'jets': 'nyj', 'eagles': 'phi', 'steelers': 'pit', 'seahawks': 'sea',
    'titans': 'ten'
};

document.addEventListener('DOMContentLoaded', function() {
    // Parse URL to get game ID
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('id');
    
    if (!gameId) {
        showError('No game ID provided');
        return;
    }
    
    // Initialize the application
    init(gameId);
});

async function init(gameId) {
    try {
        // Load team abbreviations and then load game data
        await loadTeamAbbreviations();
        await loadRosterRules();
        loadGameData(gameId);
    } catch (error) {
        console.error('Error loading initial data:', error);
        // Continue without abbreviations, we'll use fallbacks
        loadGameData(gameId);
    }
    
    // Set up tab navigation
    setupTabs();
}

async function loadTeamAbbreviations() {
    try {
        const data = await LeagueDb.teamAbbreviations();
        
        // Create a mapping of team name to FFL abbreviation
        data.teams.forEach(team => {
            if (team.abbreviations && team.abbreviations.FFL) {
                teamAbbreviations[team.name] = team.abbreviations.FFL;
            }
        });
        
        console.log('Loaded team abbreviations:', teamAbbreviations);
        return teamAbbreviations;
    } catch (error) {
        console.error('Error loading team abbreviations:', error);
        // Re-throw to handle in calling function
        throw error;
    }
}

async function loadRosterRules() {
    try {
        const data = { leagues: await LeagueDb.rosterRules() };
        console.log('Loaded raw roster rules data:', data);
        
        // Transform the data into the expected format
        if (data.leagues && Array.isArray(data.leagues)) {
            rosterRules = data.leagues.map(league => {
                // Create a new object with the Season and Slots properties
                const transformedLeague = {
                    Season: league.Season,
                    Slots: {}
                };
                
                // Copy all position properties except Season and total_slots into Slots
                Object.keys(league).forEach(key => {
                    if (key !== 'Season' && key !== 'total_slots') {
                        transformedLeague.Slots[key] = league[key];
                    }
                });
                
                return transformedLeague;
            });
        } else {
            // Fallback if the structure is not as expected
            rosterRules = data;
        }
        
        console.log('Transformed roster rules:', rosterRules);
        return rosterRules;
    } catch (error) {
        console.error('Error loading roster rules:', error);
        // Default fallback rules in case loading fails
        rosterRules = [
            {
                "Season": "default",
                "Slots": {
                    "QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 1, 
                    "D/ST": 1, "K": 1, "BE": 7
                }
            }
        ];
        return rosterRules;
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Add active class to current button
            this.classList.add('active');
            
            // Show the corresponding panel
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

async function loadGameData(gameId) {
    // Show loading state
    const container = document.querySelector('.game-details-container');
    container.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading game data...</p>
        </div>
    `;
    
    try {
        console.log(`Attempting to load game data from SQLite for game ${gameId}`);
        const gameRows = await LeagueDb.gameById(gameId);
        const game = gameRows[0];
        
        if (!game) {
            throw new Error(`Game with ID ${gameId} not found in the data`);
        }

        // Store the game data globally
        gameData = game;
        
        // Transform the data into a format suitable for display
        const processedGame = processGameData(game);
        
        // Try to load roster data for this game
        await loadRosterData(processedGame.season, processedGame.week);
        
        // Render the game details
        renderGameDetails(processedGame);
        
    } catch (error) {
        console.error('Error loading game data:', error);
        showError(error.message);
    }
}

async function loadRosterData(season, week) {
    try {
        // Construct the path to the roster JSON file
        const rosterPath = `../data/league_data/rosters/${season}/week_${week}_rosters.json`;
        console.log(`Attempting to load roster data from: ${rosterPath}`);
        
        const data = await LeagueDb.fantasyRoster(season, week);
        console.log('Loaded roster data:', data);
        
        // Store globally for access in other functions
        rosterData = data;

        // After loading the roster data, try to add NFL opponent info
        if (rosterData && rosterData.teams) {
            try {
                // Try to load NFL game data for this week
                let nflGames = await loadNFLGameData(season, week);
                
                // If we couldn't load NFL games, create mock data for testing Washington players
                if (!nflGames || nflGames.length === 0) {
                    console.warn("No NFL game data found - creating mock data for testing");
                    nflGames = createMockNflGameData();
                }
                
                if (nflGames) {
                    console.log("Processing NFL games data:", nflGames);
                    
                    // Add opponent and outcome data to players
                    rosterData.teams.forEach(team => {
                        if (team.roster) {
                            team.roster.forEach(player => {
                                if (player.proTeam) {
                                    // Normalize the player's team abbreviation to lowercase for comparison
                                    let playerTeamAbbr = player.proTeam.toLowerCase();
                                    
                                    // Handle Washington team specifically - convert WAS to WSH
                                    if (playerTeamAbbr === 'was') {
                                        playerTeamAbbr = 'wsh';
                                    }
                                    
                                    // Look for games where this player's team played
                                    const teamGame = nflGames.find(game => {
                                        return game.teamAbbr === playerTeamAbbr;
                                    });
                                    
                                    if (teamGame) {
                                        console.log(`Found NFL game for ${player.name} (${player.proTeam}):`, teamGame);
                                        
                                        // Set opponent and outcome
                                        player.proOpponent = teamGame.opponentAbbr;
                                        player.gameOutcome = teamGame.outcome;
                                        player.teamScore = teamGame.teamScore;
                                        player.opponentScore = teamGame.opponentScore;
                                        player.scoreDisplay = teamGame.scoreDisplay;
                                        
                                        console.log(`Updated ${player.name}: opponent=${player.proOpponent}, outcome=${player.gameOutcome}, score=${player.scoreDisplay}`);
                                    } else {
                                        console.log(`No NFL game found for ${player.name} (${player.proTeam})`);
                                    }
                                }
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Error loading NFL game data:', error);
                // Continue without NFL game data
            }
        }
        
        console.log('Loaded roster data with NFL info:', rosterData);
        return rosterData;
    } catch (error) {
        console.error('Error loading roster data:', error);
        return null;
    }
}

// Create mock NFL game data for testing Washington players
function createMockNflGameData() {
    return [
        {
            teamAbbr: "was",
            team: "Washington Commanders",
            opponent: "Philadelphia Eagles",
            opponentAbbr: "phi",
            outcome: "W",
            teamScore: 28,
            opponentScore: 21,
            scoreDisplay: "28-21"
        },
        {
            teamAbbr: "phi",
            team: "Philadelphia Eagles",
            opponent: "Washington Commanders",
            opponentAbbr: "was", 
            outcome: "L",
            teamScore: 21,
            opponentScore: 28,
            scoreDisplay: "21-28"
        },
        {
            teamAbbr: "dal",
            team: "Dallas Cowboys",
            opponent: "New York Giants",
            opponentAbbr: "nyg",
            outcome: "W",
            teamScore: 24,
            opponentScore: 17,
            scoreDisplay: "24-17"
        }
        // You can add more mock teams as needed
    ];
}

async function loadNFLGameData(season, week) {
    try {
        // Try the ESPN game stats format first
        let response = await fetch(`../data/espn_game_stats/${season}/nfl_data_${season}_week_${week}.json`);
        
        if (!response.ok) {
            // Try different file name patterns as fallback
            response = await fetch(`../data/nfl_games/${season}_week${week}.json`);
        }
        
        // If that fails, try the yearly format
        if (!response.ok) {
            response = await fetch(`../data/nfl_games/${season}_nfl_games.json`);
        }
        
        if (!response.ok) {
            console.warn(`No NFL game data found for ${season} week ${week}`);
            return null;
        }
        
        const data = await response.json();
        console.log(`Loaded NFL data for ${season} week ${week}:`, data);
        
        // Check if this is ESPN format data (has games array with boxscore structure)
        if (data.games && Array.isArray(data.games)) {
            return extractSimpleGameData(data.games);
        }
        
        // Otherwise assume it's already in simple format
        console.log(`Using simple format NFL games for ${season} week ${week}:`, data);
        return data;
    } catch (error) {
        console.error(`Error loading NFL game data for ${season} week ${week}:`, error);
        return null;
    }
}

// Extract simple game data from ESPN boxscore format
function extractSimpleGameData(espnGames) {
    const simpleGames = [];
    
    // NFL teams mapping for consistent abbreviations
    const nflTeams = [
        { code: 'ARI', name: 'Arizona Cardinals' },
        { code: 'ATL', name: 'Atlanta Falcons' },
        { code: 'BAL', name: 'Baltimore Ravens' },
        { code: 'BUF', name: 'Buffalo Bills' },
        { code: 'CAR', name: 'Carolina Panthers' },
        { code: 'CHI', name: 'Chicago Bears' },
        { code: 'CIN', name: 'Cincinnati Bengals' },
        { code: 'CLE', name: 'Cleveland Browns' },
        { code: 'DAL', name: 'Dallas Cowboys' },
        { code: 'DEN', name: 'Denver Broncos' },
        { code: 'DET', name: 'Detroit Lions' },
        { code: 'GB', name: 'Green Bay Packers' },
        { code: 'HOU', name: 'Houston Texans' },
        { code: 'IND', name: 'Indianapolis Colts' },
        { code: 'JAX', name: 'Jacksonville Jaguars' },
        { code: 'KC', name: 'Kansas City Chiefs' },
        { code: 'LV', name: 'Las Vegas Raiders' },
        { code: 'LAC', name: 'Los Angeles Chargers' },
        { code: 'LAR', name: 'Los Angeles Rams' },
        { code: 'MIA', name: 'Miami Dolphins' },
        { code: 'MIN', name: 'Minnesota Vikings' },
        { code: 'NE', name: 'New England Patriots' },
        { code: 'NO', name: 'New Orleans Saints' },
        { code: 'NYG', name: 'New York Giants' },
        { code: 'NYJ', name: 'New York Jets' },
        { code: 'PHI', name: 'Philadelphia Eagles' },
        { code: 'PIT', name: 'Pittsburgh Steelers' },
        { code: 'SF', name: 'San Francisco 49ers' },
        { code: 'SEA', name: 'Seattle Seahawks' },
        { code: 'TB', name: 'Tampa Bay Buccaneers' },
        { code: 'TEN', name: 'Tennessee Titans' },
        { code: 'WSH', name: 'Washington Commanders' }
    ];
    
    espnGames.forEach(game => {
        try {
            if (!game.boxscore || !game.boxscore.teams || game.boxscore.teams.length < 2) {
                console.warn('Game missing boxscore or teams data', game);
                return;
            }
            
            const boxscoreTeams = game.boxscore.teams;
            const awayTeamBoxscore = boxscoreTeams.find(t => t.homeAway === 'away') || boxscoreTeams[0];
            const homeTeamBoxscore = boxscoreTeams.find(t => t.homeAway === 'home') || boxscoreTeams[1];
            
            if (!homeTeamBoxscore || !awayTeamBoxscore) {
                console.warn('Could not determine home or away team', game);
                return;
            }
            
            // Extract team codes and names
            let homeTeamCode = '';
            let awayTeamCode = '';
            let homeTeamName = '';
            let awayTeamName = '';
            
            // First try to get from team data
            if (homeTeamBoxscore.team) {
                homeTeamCode = homeTeamBoxscore.team.abbreviation || '';
                homeTeamName = homeTeamBoxscore.team.displayName || homeTeamBoxscore.team.name || '';
            }
            
            if (awayTeamBoxscore.team) {
                awayTeamCode = awayTeamBoxscore.team.abbreviation || '';
                awayTeamName = awayTeamBoxscore.team.displayName || awayTeamBoxscore.team.name || '';
            }
            
            // If not found, try to determine from logo URL
            if (!homeTeamCode && homeTeamBoxscore.team && homeTeamBoxscore.team.logo) {
                const logoMatch = homeTeamBoxscore.team.logo.match(/\/([a-z]+)\.png$/i);
                if (logoMatch) {
                    homeTeamCode = logoMatch[1].toUpperCase();
                }
            }
            
            if (!awayTeamCode && awayTeamBoxscore.team && awayTeamBoxscore.team.logo) {
                const logoMatch = awayTeamBoxscore.team.logo.match(/\/([a-z]+)\.png$/i);
                if (logoMatch) {
                    awayTeamCode = logoMatch[1].toUpperCase();
                }
            }
            
            // Handle Washington team specifically - ESPN sometimes uses WAS instead of WSH
            if (homeTeamCode === 'WAS') homeTeamCode = 'WSH';
            if (awayTeamCode === 'WAS') awayTeamCode = 'WSH';
            
            // Find team objects from our nflTeams array to get consistent names
            const homeTeam = nflTeams.find(team => team.code === homeTeamCode) || 
                            { code: homeTeamCode || 'UNK', name: homeTeamName || 'Unknown Team' };
            
            const awayTeam = nflTeams.find(team => team.code === awayTeamCode) || 
                            { code: awayTeamCode || 'UNK', name: awayTeamName || 'Unknown Team' };
            
            // Get scores
            let homeScore = 0;
            let awayScore = 0;
            
            if (game.header && game.header.competitions && game.header.competitions.length > 0) {
                const competition = game.header.competitions[0];
                if (competition.competitors && competition.competitors.length >= 2) {
                    const homeCompetitor = competition.competitors.find(c => 
                        c.homeAway === 'home' || 
                        (c.team && c.team.abbreviation === homeTeamCode));
                    
                    const awayCompetitor = competition.competitors.find(c => 
                        c.homeAway === 'away' || 
                        (c.team && c.team.abbreviation === awayTeamCode));
                    
                    if (homeCompetitor && homeCompetitor.score) {
                        homeScore = parseInt(homeCompetitor.score) || 0;
                    }
                    
                    if (awayCompetitor && awayCompetitor.score) {
                        awayScore = parseInt(awayCompetitor.score) || 0;
                    }
                }
            }
            
            // Determine outcomes
            let homeOutcome = 'T';
            let awayOutcome = 'T';
            
            if (homeScore > awayScore) {
                homeOutcome = 'W';
                awayOutcome = 'L';
            } else if (awayScore > homeScore) {
                homeOutcome = 'L';
                awayOutcome = 'W';
            }
            
            // Create game entries for both teams (this format makes it easier to look up opponents)
            simpleGames.push({
                teamAbbr: homeTeam.code.toLowerCase(),
                team: homeTeam.name,
                opponent: awayTeam.name,
                opponentAbbr: awayTeam.code.toLowerCase(),
                outcome: homeOutcome,
                teamScore: homeScore,
                opponentScore: awayScore,
                scoreDisplay: `${homeScore}-${awayScore}`
            });
            
            simpleGames.push({
                teamAbbr: awayTeam.code.toLowerCase(),
                team: awayTeam.name,
                opponent: homeTeam.name,
                opponentAbbr: homeTeam.code.toLowerCase(),
                outcome: awayOutcome,
                teamScore: awayScore,
                opponentScore: homeScore,
                scoreDisplay: `${awayScore}-${homeScore}`
            });
            
        } catch (error) {
            console.error('Error processing game data:', error, game);
        }
    });
    
    console.log('Extracted simple game data:', simpleGames);
    return simpleGames;
}

function renderGameDetails(game) {
    const container = document.querySelector('.game-details-container');
    
    console.log('Rendering game details:', game);
    
    // Get team logo abbreviations
    const teamLogoAbbr = teamAbbreviations[game.team] || game.team.replace(/\s+/g, '-').toLowerCase();
    const opponentLogoAbbr = teamAbbreviations[game.opponent] || game.opponent.replace(/\s+/g, '-').toLowerCase();
    
    container.innerHTML = `
        <div class="game-header">
            <a href="game-log.html" class="back-button"><i class="fas fa-arrow-left"></i> Back to Game Search</a>
            <div class="game-season-info">
                <div class="season-badge">Season ${game.season}</div>
                <div class="week-badge">Week ${game.week}</div>
                <div class="type-badge ${game.gameType.toLowerCase()}">${game.gameType}</div>
            </div>
            
            <div class="matchup-display">
                <div class="team-container" style="--team-logo-url: url('../assets/icons/ffl-logos/${teamLogoAbbr}.png');">
                    <img src="../assets/icons/ffl-logos/${teamLogoAbbr}.png"
                        onerror="this.src='../assets/icons/ffl-logos/default.png'; this.parentElement.style.setProperty('--team-logo-url', 'url(../assets/icons/ffl-logos/default.png)');"
                        alt="${game.team}" class="team-logo-large">
                    <div class="team-name">${game.team}</div>
                    <div class="team-record"></div>
                </div>
                
                <div class="score-container">
                    <div class="matchup-score">
                        <span class="${game.teamScore > game.opponentScore ? 'winner-score' : ''}">${game.teamScore.toFixed(1)}</span>
                        <span class="score-divider">-</span>
                        <span class="${game.opponentScore > game.teamScore ? 'winner-score' : ''}">${game.opponentScore.toFixed(1)}</span>
                    </div>
                </div>
                
                <div class="team-container" style="--team-logo-url: url('../assets/icons/ffl-logos/${opponentLogoAbbr}.png');">
                    <img src="../assets/icons/ffl-logos/${opponentLogoAbbr}.png"
                        onerror="this.src='../assets/icons/ffl-logos/default.png'; this.parentElement.style.setProperty('--team-logo-url', 'url(../assets/icons/ffl-logos/default.png)');"
                        alt="${game.opponent}" class="team-logo-large">
                    <div class="team-name">${game.opponent}</div>
                    <div class="team-record"></div>
                </div>
            </div>
        </div>
        
        <div class="game-tabs">
            <button class="tab-button active" data-tab="rosters">Team Rosters</button>
            <button class="tab-button" data-tab="roster-analysis">Roster Analysis</button>
        </div>
        
        <div class="tab-content">
            <div id="rosters" class="tab-panel active">
                ${renderTeamRosters(game)}
            </div>
            
            <div id="roster-analysis" class="tab-panel">
                ${renderRosterAnalysis(game)}
            </div>
            
            <div id="game-analysis" class="tab-panel">
                ${renderGameAnalysis(game)}
            </div>
        </div>
    `;
    
    // Re-attach tab event listeners
    setupTabs();
}

function renderRosterAnalysis(game) {
    const homeTeamRoster = findTeamRoster(game.team);
    const awayTeamRoster = findTeamRoster(game.opponent);
    
    if (!homeTeamRoster && !awayTeamRoster) {
        return `
            <div class="no-data-message">
                <i class="fas fa-users"></i>
                <p>No roster data available for analysis.</p>
            </div>
        `;
    }

    // Get team logo abbreviations
    const teamLogoAbbr = teamAbbreviations[game.team] || game.team.replace(/\s+/g, '-').toLowerCase();
    const opponentLogoAbbr = teamAbbreviations[game.opponent] || game.opponent.replace(/\s+/g, '-').toLowerCase();
    
    // Calculate roster stats
    const homeTeamStats = homeTeamRoster ? calculateRosterStats(homeTeamRoster) : null;
    const awayTeamStats = awayTeamRoster ? calculateRosterStats(awayTeamRoster) : null;
    
    // Calculate optimization for each team using the existing function
    const seasonRules = getRosterSlotsForSeason(game.season);
    const homeOptimization = homeTeamRoster ? calculateRosterOptimization(homeTeamRoster, seasonRules, game.season) : null;
    const awayOptimization = awayTeamRoster ? calculateRosterOptimization(awayTeamRoster, seasonRules, game.season) : null;
    
    // Combined top performers from both teams
    let combinedRoster = [];
    
    if (homeTeamRoster) {
        const teamPlayers = homeTeamRoster
            .filter(p => p.actualPoints) // Include all players with points
            .map(p => ({
                name: p.name,
                position: p.position,
                slotPosition: p.slotPosition,
                points: p.actualPoints || 0,
                projected: p.projectedPoints || 0,
                team: game.team,
                playerId: p.playerId
            }));
        combinedRoster = combinedRoster.concat(teamPlayers);
    }
    
    if (awayTeamRoster) {
        const opponentPlayers = awayTeamRoster
            .filter(p => p.actualPoints) // Include all players with points
            .map(p => ({
                name: p.name,
                position: p.position,
                slotPosition: p.slotPosition,
                points: p.actualPoints || 0,
                projected: p.projectedPoints || 0,
                team: game.opponent,
                playerId: p.playerId
            }));
        combinedRoster = combinedRoster.concat(opponentPlayers);
    }
    
    // Sort by points (highest first)
    const topPerformers = combinedRoster
        .sort((a, b) => b.points - a.points)
        .slice(0, 5); // Get top 5 players
    
    return `
        <div class="roster-analysis-container">
            <div class="analysis-section">
                <h3>Top Performers</h3>
                <div class="player-performances-grid">
                    ${topPerformers.map(player => {
                        // Calculate FP+ (Fantasy Points Plus) as percentage of projected
                        const fpPlus = player.projected > 0 ? (player.points / player.projected) * 100 : 100;
                        const fpPlusClass = fpPlus >= 120 ? 'excellent' : 
                                            fpPlus >= 100 ? 'good' : 
                                            fpPlus >= 80 ? 'average' : 'poor';
                        
                        // Get team logo abbreviation for the player's team
                        const playerTeamLogo = player.team === game.team ? teamLogoAbbr : opponentLogoAbbr;
                        
                        return `
                            <div class="player-performance-card">
                                <div class="player-team">
                                    <img src="../assets/icons/ffl-logos/${playerTeamLogo}.png"
                                        onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                        alt="${player.team}" class="player-team-logo">
                                </div>
                                <div class="player-name-opt">
                                    <a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(player.name)}" class="player-name-link">${player.name}</a>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>Position Analysis</h3>
                <div class="position-analysis-grid">
                    <div class="position-analysis-card">
                        <h4>${game.team}</h4>
                        ${homeTeamStats ? `
                            <table class="position-stats-table">
                                <thead>
                                    <tr>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Projected</th>
                                        <th>FP+</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(homeTeamStats.byPosition).map(([pos, stat]) => {
                                        const fpPlus = stat.projected > 0 ? (stat.actual / stat.projected * 100).toFixed(0) : '0';
                                        const fpClass = getFPColorClass(stat.actual, stat.projected);
                                        return `
                                            <tr>
                                                <td>${pos}</td>
                                                <td>${stat.actual.toFixed(1)}</td>
                                                <td>${stat.projected.toFixed(1)}</td>
                                                <td class="${fpClass}">${fpPlus}%</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : '<p>No position data available</p>'}
                    </div>
                    
                    <div class="position-analysis-card">
                        <h4>${game.opponent}</h4>
                        ${awayTeamStats ? `
                            <table class="position-stats-table">
                                <thead>
                                    <tr>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Projected</th>
                                        <th>FP+</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(awayTeamStats.byPosition).map(([pos, stat]) => {
                                        const fpPlus = stat.projected > 0 ? (stat.actual / stat.projected * 100).toFixed(0) : '0';
                                        const fpClass = getFPColorClass(stat.actual, stat.projected);
                                        return `
                                            <tr>
                                                <td>${pos}</td>
                                                <td>${stat.actual.toFixed(1)}</td>
                                                <td>${stat.projected.toFixed(1)}</td>
                                                <td class="${fpClass}">${fpPlus}%</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : '<p>No position data available</p>'}
                    </div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>Lineup Optimization Analysis</h3>
                <div class="optimization-description">
                    <p>This analysis shows how efficiently each team utilized their roster. A perfect score of 100% means the team started their best possible lineup.</p>
                </div>
                <div class="optimization-grid">
                    ${homeOptimization ? `
                    <div class="team-optimization">
                        <div class="optimization-header">
                            <img src="../assets/icons/ffl-logos/${teamLogoAbbr}.png"
                                onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                alt="${game.team}" class="optimization-team-logo">
                            <h4>${game.team}</h4>
                        </div>
                        <div class="optimization-score-container">
                            <div class="optimization-gauge ${getOptimizationClass(homeOptimization.optimizationScore)}">
                                <div class="gauge-value">${homeOptimization.optimizationScore}%</div>
                                <div class="gauge-label">EFFICIENCY</div>
                            </div>
                            <div class="optimization-details">
                                <div class="detail-row">
                                    <span class="detail-label">Actual Points:</span>
                                    <span>${homeOptimization.actualPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Optimal Points:</span>
                                    <span>${homeOptimization.optimalPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Points Left on Bench:</span>
                                    <span class="${homeOptimization.pointsLeft > 0 ? 'fp-lower' : ''}">${homeOptimization.pointsLeft.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                        ${homeOptimization.missedOpportunities.length > 0 ? `
                        <div class="missed-opportunities">
                            <h4>Missed Opportunities</h4>
                            <table class="optimization-table">
                                <thead>
                                    <tr>
                                        <th>Should Have Started</th>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Over</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${homeOptimization.missedOpportunities.map(swap => `
                                    <tr>
                                        <td>${swap.benchPlayer.name}</td>
                                        <td>${swap.benchPlayer.position}</td>
                                        <td>${swap.benchPlayer.actualPoints.toFixed(1)}</td>
                                        <td>${swap.activePlayer.name}</td>
                                        <td>${swap.activePlayer.actualPoints.toFixed(1)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="perfect-lineup">
                            <h4>Perfect Lineup</h4>
                            <p>Congratulations! This team fielded their optimal lineup.</p>
                        </div>
                        `}
                    </div>
                    ` : ''}
                    
                    ${awayOptimization ? `
                    <div class="team-optimization">
                        <div class="optimization-header">
                            <img src="../assets/icons/ffl-logos/${opponentLogoAbbr}.png"
                                onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                alt="${game.opponent}" class="optimization-team-logo">
                            <h4>${game.opponent}</h4>
                        </div>
                        <div class="optimization-score-container">
                            <div class="optimization-gauge ${getOptimizationClass(awayOptimization.optimizationScore)}">
                                <div class="gauge-value">${awayOptimization.optimizationScore}%</div>
                                <div class="gauge-label">EFFICIENCY</div>
                            </div>
                            <div class="optimization-details">
                                <div class="detail-row">
                                    <span class="detail-label">Actual Points:</span>
                                    <span>${awayOptimization.actualPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Optimal Points:</span>
                                    <span>${awayOptimization.optimalPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Points Left on Bench:</span>
                                    <span class="${awayOptimization.pointsLeft > 0 ? 'fp-lower' : ''}">${awayOptimization.pointsLeft.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                        ${awayOptimization.missedOpportunities.length > 0 ? `
                        <div class="missed-opportunities">
                            <h4>Missed Opportunities</h4>
                            <table class="optimization-table">
                                <thead>
                                    <tr>
                                        <th>Should Have Started</th>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Over</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${awayOptimization.missedOpportunities.map(swap => `
                                    <tr>
                                        <td>${swap.benchPlayer.name}</td>
                                        <td>${swap.benchPlayer.position}</td>
                                        <td>${swap.benchPlayer.actualPoints.toFixed(1)}</td>
                                        <td>${swap.activePlayer.name}</td>
                                        <td>${swap.activePlayer.actualPoints.toFixed(1)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="perfect-lineup">
                            <h4>Perfect Lineup</h4>
                            <p>Congratulations! This team fielded their optimal lineup.</p>
                        </div>
                        `}
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Helper function to calculate roster stats by position
function calculateRosterStats(roster) {
    const stats = {
        total: { actual: 0, projected: 0 },
        byPosition: {},
        activeVsBench: {
            active: { actual: 0, projected: 0 },
            bench: { actual: 0, projected: 0 }
        }
    };
    
    roster.forEach(player => {
        // Use slotPosition for position grouping in stats
        const pos = player.slotPosition;
        const isActive = pos !== 'BE' && pos !== 'IR';
        const actual = parseFloat(player.actualPoints) || 0;
        const projected = parseFloat(player.projectedPoints) || 0;
        
        // Add to total
        stats.total.actual += actual;
        stats.total.projected += projected;
        
        // Add to active/bench
        if (isActive) {
            stats.activeVsBench.active.actual += actual;
            stats.activeVsBench.active.projected += projected;
        } else {
            stats.activeVsBench.bench.actual += actual;
            stats.activeVsBench.bench.projected += projected;
        }
        
        // Add to position stats
        if (isActive) {
            if (!stats.byPosition[pos]) {
                stats.byPosition[pos] = { actual: 0, projected: 0, count: 0 };
            }
            
            stats.byPosition[pos].actual += actual;
            stats.byPosition[pos].projected += projected;
            stats.byPosition[pos].count++;
        }
    });
    
    return stats;
}

// New helper function to render positions in the specified order
function renderPositionsInOrder(positionStats) {
    // Define the order of positions
    const positionOrder = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'P', 'D/ST', 'HC'];
    
    let html = '';
    
    // Loop through the positions in the defined order
    positionOrder.forEach(pos => {
        // Only render if this position exists in the stats
        if (positionStats[pos]) {
            const stat = positionStats[pos];
            // FP+ is now a direct ratio with 2 decimal places, not a percentage
            const fpPlus = stat.projected > 0 ? (stat.actual / stat.projected).toFixed(2) : '0.00';
            const fpClass = getFPColorClass(stat.actual, stat.projected);
            
            html += `
                <tr>
                    <td>${pos}</td>
                    <td>${stat.actual.toFixed(1)}</td>
                    <td>${stat.projected.toFixed(1)}</td>
                    <td class="${fpClass}">${fpPlus}</td>
                </tr>
            `;
        }
    });
    
    return html;
}

// Override the renderRosterAnalysis function to use our new position ordering
// This is a modified version of the original function that uses renderPositionsInOrder
function renderRosterAnalysis(game) {
    const homeTeamRoster = findTeamRoster(game.team);
    const awayTeamRoster = findTeamRoster(game.opponent);
    
    if (!homeTeamRoster && !awayTeamRoster) {
        return `
            <div class="no-data-message">
                <i class="fas fa-users"></i>
                <p>No roster data available for analysis.</p>
            </div>
        `;
    }

    // Get team logo abbreviations
    const teamLogoAbbr = teamAbbreviations[game.team] || game.team.replace(/\s+/g, '-').toLowerCase();
    const opponentLogoAbbr = teamAbbreviations[game.opponent] || game.opponent.replace(/\s+/g, '-').toLowerCase();
    
    // Calculate roster stats
    const homeTeamStats = homeTeamRoster ? calculateRosterStats(homeTeamRoster) : null;
    const awayTeamStats = awayTeamRoster ? calculateRosterStats(awayTeamRoster) : null;
    
    // Calculate optimization for each team using the existing function
    const seasonRules = getRosterSlotsForSeason(game.season);
    const homeOptimization = homeTeamRoster ? calculateRosterOptimization(homeTeamRoster, seasonRules, game.season) : null;
    const awayOptimization = awayTeamRoster ? calculateRosterOptimization(awayTeamRoster, seasonRules, game.season) : null;
    
    // Combined top performers from both teams
    let combinedRoster = [];
    
    if (homeTeamRoster) {
        const teamPlayers = homeTeamRoster
            .filter(p => p.actualPoints) // Include all players with points
            .map(p => ({
                name: p.name,
                position: p.position,
                slotPosition: p.slotPosition,
                points: p.actualPoints || 0,
                projected: p.projectedPoints || 0,
                team: game.team,
                playerId: p.playerId
            }));
        combinedRoster = combinedRoster.concat(teamPlayers);
    }
    
    if (awayTeamRoster) {
        const opponentPlayers = awayTeamRoster
            .filter(p => p.actualPoints) // Include all players with points
            .map(p => ({
                name: p.name,
                position: p.position,
                slotPosition: p.slotPosition,
                points: p.actualPoints || 0,
                projected: p.projectedPoints || 0,
                team: game.opponent,
                playerId: p.playerId
            }));
        combinedRoster = combinedRoster.concat(opponentPlayers);
    }
    
    // Sort by points (highest first)
    const topPerformers = combinedRoster
        .sort((a, b) => b.points - a.points)
        .slice(0, 5); // Get top 5 players
    
    return `
        <div class="roster-analysis-container">
            <div class="analysis-section">
                <h3>Top Performers</h3>
                <div class="player-performances-grid">
                    ${topPerformers.map(player => {
                        // Calculate FP+ (Fantasy Points Plus) as percentage of projected
                        const fpPlus = player.projected > 0 ? (player.points / player.projected) * 100 : 100;
                        const fpPlusClass = fpPlus >= 120 ? 'excellent' : 
                                            fpPlus >= 100 ? 'good' : 
                                            fpPlus >= 80 ? 'average' : 'poor';
                        
                        // Get team logo abbreviation for the player's team
                        const playerTeamLogo = player.team === game.team ? teamLogoAbbr : opponentLogoAbbr;
                        
                        return `
                            <div class="player-performance-card">
                                <div class="player-team">
                                    <img src="../assets/icons/ffl-logos/${playerTeamLogo}.png"
                                        onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                        alt="${player.team}" class="player-team-logo">
                                </div>
                                <div class="player-name-opt">
                                    <a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(player.name)}" class="player-name-link">${player.name}</a>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>Position Analysis</h3>
                <div class="position-analysis-grid">
                    <div class="position-analysis-card">
                        <h4>${game.team}</h4>
                        ${homeTeamStats ? `
                            <table class="position-stats-table">
                                <thead>
                                    <tr>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Projected</th>
                                        <th>FP+</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${renderPositionsInOrder(homeTeamStats.byPosition)}
                                </tbody>
                            </table>
                        ` : '<p>No position data available</p>'}
                    </div>
                    
                    <div class="position-analysis-card">
                        <h4>${game.opponent}</h4>
                        ${awayTeamStats ? `
                            <table class="position-stats-table">
                                <thead>
                                    <tr>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Projected</th>
                                        <th>FP+</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${renderPositionsInOrder(awayTeamStats.byPosition)}
                                </tbody>
                            </table>
                        ` : '<p>No position data available</p>'}
                    </div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h3>Lineup Optimization Analysis</h3>
                <div class="optimization-description">
                    <p>This analysis shows how efficiently each team utilized their roster. A perfect score of 100% means the team started their best possible lineup.</p>
                </div>
                <div class="optimization-grid">
                    ${homeOptimization ? `
                    <div class="team-optimization">
                        <div class="optimization-header">
                            <img src="../assets/icons/ffl-logos/${teamLogoAbbr}.png"
                                onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                alt="${game.team}" class="optimization-team-logo">
                            <h4>${game.team}</h4>
                        </div>
                        <div class="optimization-score-container">
                            <div class="optimization-gauge ${getOptimizationClass(homeOptimization.optimizationScore)}">
                                <div class="gauge-value">${homeOptimization.optimizationScore}%</div>
                                <div class="gauge-label">EFFICIENCY</div>
                            </div>
                            <div class="optimization-details">
                                <div class="detail-row">
                                    <span class="detail-label">Actual Points:</span>
                                    <span>${homeOptimization.actualPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Optimal Points:</span>
                                    <span>${homeOptimization.optimalPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Points Left on Bench:</span>
                                    <span class="${homeOptimization.pointsLeft > 0 ? 'fp-lower' : ''}">${homeOptimization.pointsLeft.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                        ${homeOptimization.missedOpportunities.length > 0 ? `
                        <div class="missed-opportunities">
                            <h4>Missed Opportunities</h4>
                            <table class="optimization-table">
                                <thead>
                                    <tr>
                                        <th>Should Have Started</th>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Over</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${homeOptimization.missedOpportunities.map(swap => `
                                    <tr>
                                        <td>${swap.benchPlayer.name}</td>
                                        <td>${swap.benchPlayer.position}</td>
                                        <td>${swap.benchPlayer.actualPoints.toFixed(1)}</td>
                                        <td>${swap.activePlayer.name}</td>
                                        <td>${swap.activePlayer.actualPoints.toFixed(1)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="perfect-lineup">
                            <h4>Perfect Lineup</h4>
                            <p>Congratulations! This team fielded their optimal lineup.</p>
                        </div>
                        `}
                    </div>
                    ` : ''}
                    
                    ${awayOptimization ? `
                    <div class="team-optimization">
                        <div class="optimization-header">
                            <img src="../assets/icons/ffl-logos/${opponentLogoAbbr}.png"
                                onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                alt="${game.opponent}" class="optimization-team-logo">
                            <h4>${game.opponent}</h4>
                        </div>
                        <div class="optimization-score-container">
                            <div class="optimization-gauge ${getOptimizationClass(awayOptimization.optimizationScore)}">
                                <div class="gauge-value">${awayOptimization.optimizationScore}%</div>
                                <div class="gauge-label">EFFICIENCY</div>
                            </div>
                            <div class="optimization-details">
                                <div class="detail-row">
                                    <span class="detail-label">Actual Points:</span>
                                    <span>${awayOptimization.actualPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Optimal Points:</span>
                                    <span>${awayOptimization.optimalPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Points Left on Bench:</span>
                                    <span class="${awayOptimization.pointsLeft > 0 ? 'fp-lower' : ''}">${awayOptimization.pointsLeft.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                        ${awayOptimization.missedOpportunities.length > 0 ? `
                        <div class="missed-opportunities">
                            <h4>Missed Opportunities</h4>
                            <table class="optimization-table">
                                <thead>
                                    <tr>
                                        <th>Should Have Started</th>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Over</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${awayOptimization.missedOpportunities.map(swap => `
                                    <tr>
                                        <td>${swap.benchPlayer.name}</td>
                                        <td>${swap.benchPlayer.position}</td>
                                        <td>${swap.benchPlayer.actualPoints.toFixed(1)}</td>
                                        <td>${swap.activePlayer.name}</td>
                                        <td>${swap.activePlayer.actualPoints.toFixed(1)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="perfect-lineup">
                            <h4>Perfect Lineup</h4>
                            <p>Congratulations! This team fielded their optimal lineup.</p>
                        </div>
                        `}
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}



// Helper function to render NFL team logos
function renderNflLogo(teamAbbr) {
    if (!teamAbbr) return '-';
    
    // Standardize team abbreviation to lowercase for mapping
    const normalizedAbbr = teamAbbr.toLowerCase();
    
    // Get the mapped filename or use the original if no mapping exists
    const logoFileName = nflTeamAbbreviationMap[normalizedAbbr] || normalizedAbbr;
    
    // Add specific debug logging for Washington team
    if (normalizedAbbr === 'wsh' || normalizedAbbr === 'was' || normalizedAbbr.includes('wash')) {
        console.log(`Washington team detected for logo: ${teamAbbr} -> ${logoFileName}`);
    }
    
    return `<img src="../assets/nfl-logos/${logoFileName}.png" alt="${teamAbbr}" class="nfl-logo" onerror="this.src='../assets/nfl-logos/nfl.png'; this.onerror=null;">`;
}

// Helper function to render game score with color coding
function renderGameScore(player) {
    if (!player || !player.scoreDisplay) return '-';
    
    const outcome = player.gameOutcome;
    let colorClass = '';
    
    if (outcome === 'W') {
        colorClass = 'score-win';
    } else if (outcome === 'L') {
        colorClass = 'score-loss';
    } else {
        colorClass = 'score-tie';
    }
    
    return `<span class="${colorClass}">${player.scoreDisplay}</span>`;
}

function findGameById(gamesData, targetId) {
    // Convert targetId to number for comparison
    targetId = parseInt(targetId);
    
    // If gamesData is an array, search it directly for the Game ID
    if (Array.isArray(gamesData)) {
        const foundGame = gamesData.find(game => game["Game ID"] === targetId);
        if (foundGame) return foundGame;
    }
    
    // If gamesData has a games or matchups property, search there
    if (gamesData.games && Array.isArray(gamesData.games)) {
        const foundGame = gamesData.games.find(game => game["Game ID"] === targetId);
        if (foundGame) return foundGame;
    }
    
    if (gamesData.matchups && Array.isArray(gamesData.matchups)) {
        const foundGame = gamesData.matchups.find(game => game["Game ID"] === targetId);
        if (foundGame) return foundGame;
    }
    
    // Try searching through seasons if available
    if (gamesData.seasons && Array.isArray(gamesData.seasons)) {
        for (const season of gamesData.seasons) {
            if (season.games && Array.isArray(season.games)) {
                const foundGame = season.games.find(game => game["Game ID"] === targetId);
                if (foundGame) return foundGame;
            }
            
            if (season.weeks && Array.isArray(season.weeks)) {
                for (const week of season.weeks) {
                    if (week.games && Array.isArray(week.games)) {
                        const foundGame = week.games.find(game => game["Game ID"] === targetId);
                        if (foundGame) return foundGame;
                    }
                }
            }
        }
    }
    
    return null;
}

function findTeamRoster(teamName) {
    if (!rosterData || !rosterData.teams) return null;
    
    // Try to find the team in the roster data
    const team = rosterData.teams.find(t => 
        t.team_name?.toLowerCase() === teamName.toLowerCase() || 
        t.owner?.toLowerCase() === teamName.toLowerCase()
    );
    
    return team ? team.roster : null;
}

function getRosterSlotsForSeason(season) {
    // If rosterRules is an array (new format)
    if (Array.isArray(rosterRules)) {
        // Try to find exact season match
        const exactMatch = rosterRules.find(rule => rule.Season == season);
        if (exactMatch) {
            return exactMatch.Slots;
        }
        
        // If no exact match, find closest previous season
        const previousSeasons = rosterRules
            .filter(rule => !isNaN(Number(rule.Season)) && Number(rule.Season) <= season)
            .sort((a, b) => Number(b.Season) - Number(a.Season));
            
        if (previousSeasons.length > 0) {
            return previousSeasons[0].Slots;
        }
        
        // If no previous season, use earliest available
        const allSeasons = rosterRules
            .filter(rule => !isNaN(Number(rule.Season)))
            .sort((a, b) => Number(a.Season) - Number(b.Season));
            
        if (allSeasons.length > 0) {
            return allSeasons[0].Slots;
        }
        
        // Final fallback to default if available
        const defaultRule = rosterRules.find(rule => rule.Season === "default");
        if (defaultRule) {
            return defaultRule.Slots;
        }
    }
    
    // If none of the above worked or if using old format, use hardcoded defaults
    return {
        "QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 1, 
        "D/ST": 1, "K": 1, "BE": 7
    };
}

// Helper function to determine CSS class for actual points based on projection
function getScoreClass(actual, projected) {
    if (!actual || !projected) return '';
    
    const ratio = actual / projected;
    
    if (ratio >= 1.5) return 'score-excellent';
    if (ratio >= 1.0) return 'score-good';
    if (ratio >= 0.7) return 'score-average';
    return 'score-poor';
}

// Helper function to determine color class for FP based on comparison with projected points
function getFPColorClass(actual, projected) {
    if (!actual || !projected) return '';
    
    if (actual > projected) return 'fp-higher';
    if (actual < projected) return 'fp-lower';
    return 'fp-equal';
}

// Helper function to generate an array of position slots from the rules
function generatePositionSlotsFromRules(rules) {
    const slots = [];
    
    // Define position order for consistent display
    const positionOrder = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'D/ST', 'P', 'HC'];
    
    // Build the array based on the slots in the rules
    positionOrder.forEach(position => {
        if (rules[position]) {
            // Add the position to the array the number of times specified in the rules
            for (let i = 0; i < rules[position]; i++) {
                slots.push(position);
            }
        }
    });
    
    return slots;
}

// Helper function to determine which team has higher FP and return triangle indicator
function getComparisonArrow(homePlayerFP, awayPlayerFP) {
    if (!homePlayerFP || !awayPlayerFP) return '';
    
    if (homePlayerFP > awayPlayerFP) {
        return '<span class="fp-arrow-left">&#9664;</span>'; // Triangle pointing left (to home team)
    } else if (awayPlayerFP > homePlayerFP) {
        return '<span class="fp-arrow-right">&#9654;</span>'; // Triangle pointing right (to away team)
    }
    
    return ''; // Equal or insufficient data
}

function processGameData(game) {
    // Create a standardized game object with all required properties
    return {
        id: game["Game ID"] || game.id || '',
        season: game.Season || game.season || '',
        week: game.Week || game.week || '',
        gameType: determineGameType(game),
        
        team: game.Team || game.team || '',
        teamScore: parseFloat(game["Team Score"] || game.teamScore || 0),
        teamRecord: game.teamRecord || game["Team Record"] || '0-0',
        
        opponent: game.Opponent || game.opponent || '',
        opponentScore: parseFloat(game["Opponent Score"] || game.opponentScore || 0),
        opponentRecord: game.opponentRecord || game["Opponent Record"] || '0-0',
        
        margin: parseFloat(game["Score Diff"] || game.margin || 0),
        
        // Additional stats for detailed view
        comparisonMetrics: {
            qbRating: {
                team: game.teamQBRating || Math.random() * 100,
                opponent: game.opponentQBRating || Math.random() * 100
            },
            rushYards: {
                team: game.teamRushYards || Math.floor(Math.random() * 200),
                opponent: game.opponentRushYards || Math.floor(Math.random() * 200)
            },
            passYards: {
                team: game.teamPassYards || Math.floor(Math.random() * 300),
                opponent: game.opponentPassYards || Math.floor(Math.random() * 300)
            },
            turnovers: {
                team: game.teamTurnovers || Math.floor(Math.random() * 4),
                opponent: game.opponentTurnovers || Math.floor(Math.random() * 4)
            }
        },
        
        // Player performances (simulated if not provided)
        playerPerformances: game.playerPerformances || generatePlayerPerformances()
    };
}

function determineGameType(game) {
    // Determine game type based on Season Period or explicit gameType field
    if (game.gameType) {
        return game.gameType;
    }
    
    if (game["Season Period"]) {
        const seasonPeriod = game["Season Period"].toLowerCase();
        
        if (seasonPeriod === "regular") {
            return "Regular";
        } else if (seasonPeriod.startsWith("post-wc")) {
            return "Consolation";
        } else if (seasonPeriod.startsWith("post-wb")) {
            return "Playoff";
        } else if (seasonPeriod.startsWith("post-lb")) {
            return "Gulag";
        } else if (seasonPeriod.startsWith("post-lp")) {
            return "Survivor";
        } else if (seasonPeriod === "placements") {
            return "Consolation";
        } else if (seasonPeriod === "championship") {
            return "Championship";
        } else if (seasonPeriod === "chumpionship") {
            return "Chumpionship";
        } else if (!isNaN(parseInt(seasonPeriod))) {
            return "Consolation";
        }
    }
    
    // Default to regular season if no type info available
    return "Regular";
}

function generatePlayerPerformances() {
    // Generate random player performances for demonstration
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const names = [
        'Tom Brady', 'Aaron Rodgers', 'Patrick Mahomes',
        'Derrick Henry', 'Dalvin Cook', 'Alvin Kamara',
        'Davante Adams', 'Tyreek Hill', 'DeAndre Hopkins',
        'Travis Kelce', 'George Kittle', 'Darren Waller',
        'Justin Tucker', 'Harrison Butker', 'Jason Sanders',
        'Steelers D/ST', 'Ravens D/ST', 'Rams D/ST'
    ];
    
    const performances = [];
    
    for (let i = 0; i < 10; i++) {
        const posIndex = Math.floor(Math.random() * positions.length);
        const nameIndex = Math.floor(Math.random() * names.length);
        
        performances.push({
            name: names[nameIndex],
            position: positions[posIndex],
            points: Math.round(Math.random() * 30 * 10) / 10,
            projected: Math.round(Math.random() * 20 * 10) / 10
        });
    }
    
    return performances;
}

async function displayPlayerDetails(playerData, year, week) {
    // ...existing code...
    
    // Check if player has NFL team info
    if (playerData.team && playerData.position !== 'DEF') {
        // Get NFL game info
        const nflGameInfo = await getNflGameInfo(playerData.team, year, week);
        
        // Add NFL game info to player card
        if (nflGameInfo) {
            const gameInfoDisplay = formatNflGameInfo(nflGameInfo);
            
            // Add to player-game-info-row div
            const gameInfoRow = `
                <div class="player-game-info-row">
                    <div class="pro-game-info">
                        <span class="pro-opponent">${gameInfoDisplay}</span>
                    </div>
                </div>
            `;
            
            // Insert after player-header-row
            // ...implementation details depending on your DOM structure
        }
    }
    
    // ...existing code...
}

function renderGameDetails(game) {
    const container = document.querySelector('.game-details-container');
    
    console.log('Rendering game details:', game);
    
    // Get team logo abbreviations
    const teamLogoAbbr = teamAbbreviations[game.team] || game.team.replace(/\s+/g, '-').toLowerCase();
    const opponentLogoAbbr = teamAbbreviations[game.opponent] || game.opponent.replace(/\s+/g, '-').toLowerCase();
    
    container.innerHTML = `
        <div class="game-header">
            <a href="game-log.html" class="back-button"><i class="fas fa-arrow-left"></i> Back to Game Search</a>
            <div class="game-season-info">
                <div class="season-badge">Season ${game.season}</div>
                <div class="week-badge">Week ${game.week}</div>
                <div class="type-badge ${game.gameType.toLowerCase()}">${game.gameType}</div>
            </div>
            
            <div class="matchup-display">
                <div class="team-container">
                    <img src="../assets/icons/ffl-logos/${teamLogoAbbr}.png"
                        onerror="this.src='../assets/icons/ffl-logos/default.png'"
                        alt="${game.team}" class="team-logo-large">
                    <div class="team-name">${game.team}</div>
                    <div class="team-record"></div>
                </div>
                
                <div class="score-container">
                    <div class="matchup-score">
                        <span class="${game.teamScore > game.opponentScore ? 'winner-score' : ''}">${game.teamScore.toFixed(1)}</span>
                        <span class="score-divider">-</span>
                        <span class="${game.opponentScore > game.teamScore ? 'winner-score' : ''}">${game.opponentScore.toFixed(1)}</span>
                    </div>
                </div>
                
                <div class="team-container">
                    <img src="../assets/icons/ffl-logos/${opponentLogoAbbr}.png"
                        onerror="this.src='../assets/icons/ffl-logos/default.png'"
                        alt="${game.opponent}" class="team-logo-large">
                    <div class="team-name">${game.opponent}</div>
                    <div class="team-record"></div>
                </div>
            </div>
        </div>
        
        <div class="game-tabs">
            <button class="tab-button active" data-tab="rosters">Team Rosters</button>
            <button class="tab-button" data-tab="roster-analysis">Roster Analysis</button>
        </div>
        
        <div class="tab-content">
            <div id="rosters" class="tab-panel active">
                ${renderTeamRosters(game)}
            </div>
            
            <div id="roster-analysis" class="tab-panel">
                ${renderRosterAnalysis(game)}
            </div>
            
            <div id="game-analysis" class="tab-panel">
                ${renderGameAnalysis(game)}
            </div>
        </div>
    `;
    
    // Re-attach tab event listeners
    setupTabs();
}

function renderTeamRosters(game) {
    if (!rosterData || !rosterData.teams) {
        return `
            <div class="no-data-message">
                <i class="fas fa-users"></i>
                <p>No roster data available for this game.</p>
            </div>
        `;
    }
    
    console.log("Rendering rosters for teams:", game.team, game.opponent);
    console.log("Available teams in roster data:", rosterData.teams.map(t => ({ name: t.team_name, owner: t.owner })));
    
    // Find team rosters - try matching by team name or owner name
    const homeTeam = rosterData.teams.find(t => 
        (t.team_name && t.team_name.toLowerCase() === game.team.toLowerCase()) || 
        (t.owner && t.owner.toLowerCase() === game.team.toLowerCase())
    );
    
    const awayTeam = rosterData.teams.find(t => 
        (t.team_name && t.team_name.toLowerCase() === game.opponent.toLowerCase()) || 
        (t.owner && t.owner.toLowerCase() === game.opponent.toLowerCase())
    );
    
    console.log("Home team found:", homeTeam?.team_name || homeTeam?.owner);
    console.log("Away team found:", awayTeam?.team_name || awayTeam?.owner);
    
    // Get team logo abbreviations
    const teamLogoAbbr = teamAbbreviations[game.team] || game.team.replace(/\s+/g, '-').toLowerCase();
    const opponentLogoAbbr = teamAbbreviations[game.opponent] || game.opponent.replace(/\s+/g, '-').toLowerCase();
    
    // Get roster rules for this season
    const seasonRules = getRosterSlotsForSeason(game.season);
    console.log("Season rules for", game.season, ":", seasonRules);
    
    // Generate position slots for the roster display based on rules
    const positionSlots = generatePositionSlotsFromRules(seasonRules);
    console.log("Generated position slots:", positionSlots);
    
    // If we have roster data, log the slot positions to help debug
    if (homeTeam?.roster) {
        console.log("Home team roster slot positions:", 
            homeTeam.roster.map(p => ({ name: p.name, slot: p.slotPosition, id: p.slotId })));
    }
    
    if (awayTeam?.roster) {
        console.log("Away team roster slot positions:", 
            awayTeam.roster.map(p => ({ name: p.name, slot: p.slotPosition, id: p.slotId })));
    }
    
    // HTML for the roster display with player names on the outside
    let rosterHTML = `
        <div class="roster-header">
            <div class="team-column">
                <img src="../assets/icons/ffl-logos/${teamLogoAbbr}.png"
                    onerror="this.src='../assets/icons/ffl-logos/default.png'"
                    alt="${game.team}" class="roster-team-logo">
                <h3>${game.team}</h3>
            </div>
            <div class="position-column">
                <h3></h3>
            </div>
            <div class="team-column">
                <img src="../assets/icons/ffl-logos/${opponentLogoAbbr}.png"
                    onerror="this.src='../assets/icons/ffl-logos/default.png'"
                    alt="${game.opponent}" class="roster-team-logo">
                <h3>${game.opponent}</h3>
            </div>
        </div>`;

    // Only continue with the table rendering if we found at least one team
    if (homeTeam || awayTeam) {
        rosterHTML += `
            <div class="roster-table-container">
                <table class="roster-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>POS</th>
                            <th>NFL</th>
                            <th>Opp</th>
                            <th>Result</th>
                            <th>Proj</th>
                            <th>FP</th>
                            <th class="position-center">Pos</th>
                            <th>FP</th>
                            <th>Proj</th>
                            <th>Result</th>
                            <th>Opp</th>
                            <th>NFL</th>
                            <th>POS</th>
                            <th>Player</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        // Keep track of players we've already displayed to avoid duplicates
        const displayedHomePlayers = new Set();
        const displayedAwayPlayers = new Set();
        
        // Track team totals for active players
        let homeActiveProjected = 0;
        let homeActiveActual = 0;
        let awayActiveProjected = 0;
        let awayActiveActual = 0;
        
        // Create rows for each position slot
        positionSlots.forEach((position, index) => {
            // Find players in this position for each team
            // Use index to handle multiple positions of the same type (like multiple FLEX spots)
            const homePlayer = findPlayerForPositionSlot(homeTeam?.roster, position, index, displayedHomePlayers);
            const awayPlayer = findPlayerForPositionSlot(awayTeam?.roster, position, index, displayedAwayPlayers);
            
            // Add displayed players to our tracking set
            if (homePlayer) displayedHomePlayers.add(homePlayer.playerId);
            if (awayPlayer) displayedAwayPlayers.add(awayPlayer.playerId);
            
            // Determine which player has higher FP and add arrow
            const comparisonArrow = getComparisonArrow(
                homePlayer?.actualPoints, 
                awayPlayer?.actualPoints
            );
            
            // Add to the running totals for active players
            if (homePlayer && homePlayer.projectedPoints !== undefined) {
                homeActiveProjected += parseFloat(homePlayer.projectedPoints) || 0;
            }
            if (homePlayer && homePlayer.actualPoints !== undefined) {
                homeActiveActual += parseFloat(homePlayer.actualPoints) || 0;
            }
            if (awayPlayer && awayPlayer.projectedPoints !== undefined) {
                awayActiveProjected += parseFloat(awayPlayer.projectedPoints) || 0;
            }
            if (awayPlayer && awayPlayer.actualPoints !== undefined) {
                awayActiveActual += parseFloat(awayPlayer.actualPoints) || 0;
            }
            
            rosterHTML += `
                <tr>
                    <td>${homePlayer ? `<a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(homePlayer.name)}" class="player-name-link">${homePlayer.name}</a>` : '-'}</td>
                    <td>${homePlayer ? homePlayer.position : '-'}</td>
                    <td>${homePlayer ? renderNflLogo(homePlayer.proTeam) : '-'}</td>
                    <td>${homePlayer && homePlayer.proOpponent ? renderNflLogo(homePlayer.proOpponent) : '-'}</td>
                    <td class="${homePlayer && homePlayer.gameOutcome ? homePlayer.gameOutcome.toLowerCase() : ''}">
                        ${homePlayer ? renderGameScore(homePlayer) : '-'}
                    </td>
                    <td>${homePlayer && homePlayer.projectedPoints ? homePlayer.projectedPoints.toFixed(1) : '-'}</td>
                    <td class="${getFPColorClass(homePlayer?.actualPoints, homePlayer?.projectedPoints)}">
                        ${homePlayer && homePlayer.actualPoints ? homePlayer.actualPoints.toFixed(1) : '-'}
                    </td>
                    <td class="position-center">${position} ${comparisonArrow}</td>
                    <td class="${getFPColorClass(awayPlayer?.actualPoints, awayPlayer?.projectedPoints)}">
                        ${awayPlayer && awayPlayer.actualPoints ? awayPlayer.actualPoints.toFixed(1) : '-'}
                    </td>
                    <td>${awayPlayer && awayPlayer.projectedPoints ? awayPlayer.projectedPoints.toFixed(1) : '-'}</td>
                    <td class="${awayPlayer && awayPlayer.gameOutcome ? awayPlayer.gameOutcome.toLowerCase() : ''}">
                        ${awayPlayer ? renderGameScore(awayPlayer) : '-'}
                    </td>
                    <td>${awayPlayer && awayPlayer.proOpponent ? renderNflLogo(awayPlayer.proOpponent) : '-'}</td>
                    <td>${awayPlayer ? renderNflLogo(awayPlayer.proTeam) : '-'}</td>
                    <td>${awayPlayer ? awayPlayer.position : '-'}</td>
                    <td>${awayPlayer ? `<a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(awayPlayer.name)}" class="player-name-link">${awayPlayer.name}</a>` : '-'}</td>
                </tr>
            `;
        });
        
        // Calculate FP+ for active players (actual / projected * 100)
        const homeActiveFpPlus = homeActiveProjected > 0 ? ((homeActiveActual / homeActiveProjected) * 100).toFixed(2) : "0.00";
        const awayActiveFpPlus = awayActiveProjected > 0 ? ((awayActiveActual / awayActiveProjected) * 100).toFixed(2) : "0.00";
        
        // Add totals row for active players - putting FP+ in the Result column
        rosterHTML += `
            <tr class="team-totals">
                <td colspan="4"><strong></strong></td>
                <td><strong><span class="${getFPColorClass(homeActiveActual, homeActiveProjected)}">${homeActiveFpPlus}</span></strong></td>
                <td><strong>${homeActiveProjected.toFixed(1)}</strong></td>
                <td><strong>${homeActiveActual.toFixed(1)}</strong></td>
                <td class="position-center"><strong>TOTALS</strong></td>
                <td><strong>${awayActiveActual.toFixed(1)}</strong></td>
                <td><strong>${awayActiveProjected.toFixed(1)}</strong></td>
                <td><strong><span class="${getFPColorClass(awayActiveActual, awayActiveProjected)}">${awayActiveFpPlus}</span></strong></td>
                <td colspan="4"><strong></strong></td>
            </tr>
        `;
        
        // Close the active players table
        rosterHTML += `
                    </tbody>
                </table>
            </div>`;
        
        // Get bench and IR players for both teams
        const homeBenchPlayers = homeTeam?.roster?.filter(p => p.slotPosition === 'BE') || [];
        const homeIRPlayers = homeTeam?.roster?.filter(p => p.slotPosition === 'IR') || [];
        const awayBenchPlayers = awayTeam?.roster?.filter(p => p.slotPosition === 'BE') || [];
        const awayIRPlayers = awayTeam?.roster?.filter(p => p.slotPosition === 'IR') || [];
        
        // Get the number of bench and IR slots for this season
        const benchSlots = seasonRules.BE || 7; // Default to 7 if not specified
        const irSlots = seasonRules.IR || 0; // Default to 0 if not specified
        
        // Only render bench section if we have bench slots or bench players
        if (benchSlots > 0 || homeBenchPlayers.length > 0 || awayBenchPlayers.length > 0) {
            rosterHTML += `
                <div class="bench-section">
                    <h3>Bench Players</h3>
                    <div class="roster-table-container">
                        <table class="roster-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>POS</th>
                                    <th>NFL</th>
                                    <th>Opp</th>
                                    <th>Result</th>
                                    <th>Proj</th>
                                    <th>FP</th>
                                    <th class="position-center">Slot</th>
                                    <th>FP</th>
                                    <th>Proj</th>
                                    <th>Result</th>
                                    <th>Opp</th>
                                    <th>NFL</th>
                                    <th>POS</th>
                                    <th>Player</th>
                                </tr>
                            </thead>
                            <tbody>`;
            
            // Track team totals for bench players - initialize before the loop
            let homeBenchProjected = 0;
            let homeBenchActual = 0;
            let awayBenchProjected = 0;
            let awayBenchActual = 0;
            
            // First create rows for bench players, skipping players already displayed
            for (let i = 0; i < benchSlots; i++) {
                // Get bench players that haven't been displayed yet
                const homePlayer = i < homeBenchPlayers.length ? 
                    (displayedHomePlayers.has(homeBenchPlayers[i].playerId) ? null : homeBenchPlayers[i]) : null;
                const awayPlayer = i < awayBenchPlayers.length ? 
                    (displayedAwayPlayers.has(awayBenchPlayers[i].playerId) ? null : awayBenchPlayers[i]) : null;
                
                // Add displayed players to our tracking set
                if (homePlayer) displayedHomePlayers.add(homePlayer.playerId);
                if (awayPlayer) displayedAwayPlayers.add(awayPlayer.playerId);
                
                // Add to bench totals if the player has points
                if (homePlayer) {
                    homeBenchProjected += parseFloat(homePlayer.projectedPoints || 0);
                    homeBenchActual += parseFloat(homePlayer.actualPoints || 0);
                }
                
                if (awayPlayer) {
                    awayBenchProjected += parseFloat(awayPlayer.projectedPoints || 0);
                    awayBenchActual += parseFloat(awayPlayer.actualPoints || 0);
                }
                
                rosterHTML += `
                    <tr>
                        <td>${homePlayer ? `<a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(homePlayer.name)}" class="player-name-link">${homePlayer.name}</a>` : '-'}</td>
                        <td>${homePlayer ? homePlayer.position : '-'}</td>
                        <td>${homePlayer ? renderNflLogo(homePlayer.proTeam) : '-'}</td>
                        <td>${homePlayer && homePlayer.proOpponent ? renderNflLogo(homePlayer.proOpponent) : '-'}</td>
                        <td class="${homePlayer && homePlayer.gameOutcome ? homePlayer.gameOutcome.toLowerCase() : ''}">
                            ${homePlayer ? renderGameScore(homePlayer) : '-'}
                        </td>
                        <td>${homePlayer && homePlayer.projectedPoints ? homePlayer.projectedPoints.toFixed(1) : '-'}</td>
                        <td class="${getFPColorClass(homePlayer?.actualPoints, homePlayer?.projectedPoints)}">
                            ${homePlayer && homePlayer.actualPoints ? homePlayer.actualPoints.toFixed(1) : '-'}
                        </td>
                        <td class="position-center">BE</td>
                        <td class="${getFPColorClass(awayPlayer?.actualPoints, awayPlayer?.projectedPoints)}">
                            ${awayPlayer && awayPlayer.actualPoints ? awayPlayer.actualPoints.toFixed(1) : '-'}
                        </td>
                        <td>${awayPlayer && awayPlayer.projectedPoints ? awayPlayer.projectedPoints.toFixed(1) : '-'}</td>
                        <td class="${awayPlayer && awayPlayer.gameOutcome ? awayPlayer.gameOutcome.toLowerCase() : ''}">
                            ${awayPlayer ? renderGameScore(awayPlayer) : '-'}
                        </td>
                        <td>${awayPlayer && awayPlayer.proOpponent ? renderNflLogo(awayPlayer.proOpponent) : '-'}</td>
                        <td>${awayPlayer ? renderNflLogo(awayPlayer.proTeam) : '-'}</td>
                        <td>${awayPlayer ? awayPlayer.position : '-'}</td>
                        <td>${awayPlayer ? `<a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(awayPlayer.name)}" class="player-name-link">${awayPlayer.name}</a>` : '-'}</td>
                    </tr>
                `;
            }
            
            // Then create rows for IR players if the season has IR slots
            if (irSlots > 0 || homeIRPlayers.length > 0 || awayIRPlayers.length > 0) {
                // Add a separator row for IR section
                rosterHTML += `
                    <tr>
                        <td colspan="15" style="text-align:center; background:rgba(0,0,0,0.2); padding:5px;">
                            <strong>Injured Reserve (IR)</strong>
                        </td>
                    </tr>
                `;
                
                for (let i = 0; i < Math.max(irSlots, homeIRPlayers.length, awayIRPlayers.length); i++) {
                    // Get IR players that haven't been displayed yet
                    const homePlayer = i < homeIRPlayers.length ? 
                        (displayedHomePlayers.has(homeIRPlayers[i].playerId) ? null : homeIRPlayers[i]) : null;
                    const awayPlayer = i < awayIRPlayers.length ? 
                        (displayedAwayPlayers.has(awayIRPlayers[i].playerId) ? null : awayIRPlayers[i]) : null;
                    
                    // Add displayed players to our tracking set
                    if (homePlayer) displayedHomePlayers.add(homePlayer.playerId);
                    if (awayPlayer) displayedAwayPlayers.add(awayPlayer.playerId);
                    
                    rosterHTML += `
                        <tr>
                            <td>${homePlayer ? `<a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(homePlayer.name)}" class="player-name-link">${homePlayer.name}</a>` : '-'}</td>
                            <td>${homePlayer ? homePlayer.position : '-'}</td>
                            <td>${homePlayer ? renderNflLogo(homePlayer.proTeam) : '-'}</td>
                            <td>${homePlayer && homePlayer.proOpponent ? renderNflLogo(homePlayer.proOpponent) : '-'}</td>
                            <td class="${homePlayer && homePlayer.gameOutcome ? homePlayer.gameOutcome.toLowerCase() : ''}">
                                ${homePlayer ? renderGameScore(homePlayer) : '-'}
                            </td>
                            <td>${homePlayer && homePlayer.projectedPoints ? homePlayer.projectedPoints.toFixed(1) : '-'}</td>
                            <td class="${getFPColorClass(homePlayer?.actualPoints, homePlayer?.projectedPoints)}">
                                ${homePlayer && homePlayer.actualPoints ? homePlayer.actualPoints.toFixed(1) : '-'}
                            </td>
                            <td class="position-center">IR</td>
                            <td class="${getFPColorClass(awayPlayer?.actualPoints, awayPlayer?.projectedPoints)}">
                                ${awayPlayer && awayPlayer.actualPoints ? awayPlayer.actualPoints.toFixed(1) : '-'}
                            </td>
                            <td>${awayPlayer && awayPlayer.projectedPoints ? awayPlayer.projectedPoints.toFixed(1) : '-'}</td>
                            <td class="${awayPlayer && awayPlayer.gameOutcome ? awayPlayer.gameOutcome.toLowerCase() : ''}">
                                ${awayPlayer ? renderGameScore(awayPlayer) : '-'}
                            </td>
                            <td>${awayPlayer && awayPlayer.proOpponent ? renderNflLogo(awayPlayer.proOpponent) : '-'}</td>
                            <td>${awayPlayer ? renderNflLogo(awayPlayer.proTeam) : '-'}</td>
                            <td>${awayPlayer ? awayPlayer.position : '-'}</td>
                            <td>${awayPlayer ? `<a href="player-profiles.html?season=${game.season}&name=${encodeURIComponent(awayPlayer.name)}" class="player-name-link">${awayPlayer.name}</a>` : '-'}</td>
                        </tr>
                    `;
                }
            }
            
            // Calculate FP+ for bench players (actual / projected * 100)
            const homeBenchFpPlus = homeBenchProjected > 0 ? ((homeBenchActual / homeBenchProjected) * 100).toFixed(2) : "0.00";
            const awayBenchFpPlus = awayBenchProjected > 0 ? ((awayBenchActual / awayBenchProjected) * 100).toFixed(2) : "0.00";
            
            // Add totals row for bench players - putting FP+ in the Result column
            rosterHTML += `
                <tr class="team-totals">
                    <td colspan="4"><strong></strong></td>
                    <td><strong><span class="${getFPColorClass(homeBenchActual, homeBenchProjected)}">${homeBenchFpPlus}</span></strong></td>
                    <td><strong>${homeBenchProjected.toFixed(1)}</strong></td>
                    <td><strong>${homeBenchActual.toFixed(1)}</strong></td>
                    <td class="position-center"><strong>TOTALS</strong></td>
                    <td><strong>${awayBenchActual.toFixed(1)}</strong></td>
                    <td><strong>${awayBenchProjected.toFixed(1)}</strong></td>
                    <td><strong><span class="${getFPColorClass(awayBenchActual, awayBenchProjected)}">${awayBenchFpPlus}</span></strong></td>
                    <td colspan="4"><strong></strong></td>
                </tr>
            `;
            
            // Close the bench table
            rosterHTML += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        }
    } else {
        // If no teams were found, display a message
        rosterHTML += `
            <div class="no-data-message">
                <i class="fas fa-users"></i>
                <p>Could not find roster data for ${game.team} or ${game.opponent}.</p>
                <p>Available teams: ${rosterData.teams.map(t => t.team_name || t.owner).join(', ')}</p>
            </div>
        `;
    }
    
    return rosterHTML;
}

// New helper function to find the correct player for a position slot
function findPlayerForPositionSlot(roster, position, positionIndex, displayedPlayers) {
    if (!roster) return null;
    
    // Count how many of this position we've seen so far
    let currentPositionCount = 0;
    
    // Find a player in this position that hasn't been displayed yet
    for (const player of roster) {
        if (player.slotPosition === position) {
            // If we've found the correct instance of this position and the player hasn't been displayed yet
            if (currentPositionCount === positionIndex && !displayedPlayers.has(player.playerId)) {
                return player;
            }
            currentPositionCount++;
        }
    }
    
    // If we don't find the exact position match, look for any player with this position that hasn't been displayed
    const playerInPosition = roster.find(p => 
        p.slotPosition === position && !displayedPlayers.has(p.playerId)
    );
    
    return playerInPosition || null;
}

function renderPlayerPerformances(game) {
    const teamRoster = findTeamRoster(game.team);
    const opponentRoster = findTeamRoster(game.opponent);
    
    // If we don't have roster data, fall back to the simulated data
    if (!teamRoster && !opponentRoster) {
        const performances = game.playerPerformances || [];
        
        if (!performances.length) {
            return `
                <div class="no-data-message">
                    <i class="fas fa-users"></i>
                    <p>No player performance data available for this game.</p>
                </div>
            `;
        }
        
        // Sort by points (highest first)
        const sortedPerformances = [...performances].sort((a, b) => b.points - a.points);
        

    }
    
    // Create combined array of active players from both teams
    let combinedRoster = [];
    
    if (teamRoster) {
        const teamPlayers = teamRoster
            .filter(p => p.slotPosition !== 'BE' && p.slotPosition !== 'IR') // Only include starting players
            .map(p => ({
                name: p.name,
                position: p.position,
                points: p.actualPoints || 0,
                projected: p.projectedPoints || 0,
                team: game.team
            }));
        combinedRoster = combinedRoster.concat(teamPlayers);
    }
    
    if (opponentRoster) {
        const opponentPlayers = opponentRoster
            .filter(p => p.slotPosition !== 'BE' && p.slotPosition !== 'IR') // Only include starting players
            .map(p => ({
                name: p.name,
                position: p.position,
                points: p.actualPoints || 0,
                projected: p.projectedPoints || 0,
                team: game.opponent
            }));
        combinedRoster = combinedRoster.concat(opponentPlayers);
    }
    
    // Sort by points (highest first)
    const sortedPlayers = combinedRoster.sort((a, b) => b.points - a.points);
    
    return `
        <div class="player-performances-container">
            <h3>Top Performers</h3>
            <div class="player-performances-grid">
                ${sortedPlayers.map(player => {
                    // Calculate FP+ (Fantasy Points Plus) as percentage of projected
                    const fpPlus = player.projected > 0 ? (player.points / player.projected) * 100 : 100;
                    const fpPlusClass = fpPlus >= 120 ? 'excellent' : 
                                        fpPlus >= 100 ? 'good' : 
                                        fpPlus >= 80 ? 'average' : 'poor';
                    
                    // Get team logo abbreviation for the player's team
                    const teamLogoAbbr = teamAbbreviations[player.team] || player.team.replace(/\s+/g, '-').toLowerCase();
                    
                    return `
                        <div class="player-performance-card">
                            <div class="player-team">
                                <img src="../assets/icons/ffl-logos/${teamLogoAbbr}.png"
                                    onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                    alt="${player.team}" class="player-team-logo">
                            </div>
                            <div class="player-name-opt">${player.name}</div>
                            <div class="player-position">${player.position}</div>
                            <div class="player-points-opt">${player.points.toFixed(1)}</div>
                            <div class="player-projected">Proj: ${player.projected.toFixed(1)}</div>
                            <div class="player-fp-plus ${fpPlusClass}">FP+: ${fpPlus.toFixed(0)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderGameAnalysis(game) {
    // Get team rosters if available
    const homeTeamRoster = findTeamRoster(game.team);
    const awayTeamRoster = findTeamRoster(game.opponent);
    
    let optimizationHTML = '';
    
    // If we have roster data, show optimization analysis
    if (homeTeamRoster || awayTeamRoster) {
        // Get roster rules for this season
        const seasonRules = getRosterSlotsForSeason(game.season);
        
        // Calculate optimization for home team if available
        let homeOptimization = null;
        if (homeTeamRoster) {
            homeOptimization = calculateRosterOptimization(homeTeamRoster, seasonRules, game.season);
        }
        
        // Calculate optimization for away team if available
        let awayOptimization = null;
        if (awayTeamRoster) {
            awayOptimization = calculateRosterOptimization(awayTeamRoster, seasonRules, game.season);
        }
        
        // Get team logo abbreviations
        const teamLogoAbbr = teamAbbreviations[game.team] || game.team.replace(/\s+/g, '-').toLowerCase();
        const opponentLogoAbbr = teamAbbreviations[game.opponent] || game.opponent.replace(/\s+/g, '-').toLowerCase();
        
        optimizationHTML = `
            <div class="analysis-section">
                <h3>Lineup Optimization Analysis</h3>
                <div class="optimization-description">
                    <p>This analysis shows how efficiently each team utilized their roster. A perfect score of 100% means the team started their best possible lineup.</p>
                </div>
                <div class="optimization-grid">
                    ${homeOptimization ? `
                    <div class="team-optimization">
                        <div class="optimization-header">
                            <img src="../assets/icons/ffl-logos/${teamLogoAbbr}.png"
                                onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                alt="${game.team}" class="optimization-team-logo">
                            <h4>${game.team}</h4>
                        </div>
                        <div class="optimization-score-container">
                            <div class="optimization-gauge ${getOptimizationClass(homeOptimization.optimizationScore)}">
                                <div class="gauge-value">${homeOptimization.optimizationScore}%</div>
                                <div class="gauge-label">EFFICIENCY</div>
                            </div>
                            <div class="optimization-details">
                                <div class="detail-row">
                                    <span class="detail-label">Actual Points:</span>
                                    <span>${homeOptimization.actualPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Optimal Points:</span>
                                    <span>${homeOptimization.optimalPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Points Left on Bench:</span>
                                    <span class="${homeOptimization.pointsLeft > 0 ? 'fp-lower' : ''}">${homeOptimization.pointsLeft.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                        ${homeOptimization.missedOpportunities.length > 0 ? `
                        <div class="missed-opportunities">
                            <h4>Missed Opportunities</h4>
                            <table class="optimization-table">
                                <thead>
                                    <tr>
                                        <th>Should Have Started</th>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Over</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${homeOptimization.missedOpportunities.map(swap => `
                                    <tr>
                                        <td>${swap.benchPlayer.name}</td>
                                        <td>${swap.benchPlayer.position}</td>
                                        <td>${swap.benchPlayer.actualPoints.toFixed(1)}</td>
                                        <td>${swap.activePlayer.name}</td>
                                        <td>${swap.activePlayer.actualPoints.toFixed(1)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="perfect-lineup">
                            <h4>Perfect Lineup</h4>
                            <p>Congratulations! This team fielded their optimal lineup.</p>
                        </div>
                        `}
                    </div>
                    ` : ''}
                    
                    ${awayOptimization ? `
                    <div class="team-optimization">
                        <div class="optimization-header">
                            <img src="../assets/icons/ffl-logos/${opponentLogoAbbr}.png"
                                onerror="this.src='../assets/icons/ffl-logos/default.png'"
                                alt="${game.opponent}" class="optimization-team-logo">
                            <h4>${game.opponent}</h4>
                        </div>
                        <div class="optimization-score-container">
                            <div class="optimization-gauge ${getOptimizationClass(awayOptimization.optimizationScore)}">
                                <div class="gauge-value">${awayOptimization.optimizationScore}%</div>
                                <div class="gauge-label">EFFICIENCY</div>
                            </div>
                            <div class="optimization-details">
                                <div class="detail-row">
                                    <span class="detail-label">Actual Points:</span>
                                    <span>${awayOptimization.actualPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Optimal Points:</span>
                                    <span>${awayOptimization.optimalPoints.toFixed(1)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Points Left on Bench:</span>
                                    <span class="${awayOptimization.pointsLeft > 0 ? 'fp-lower' : ''}">${awayOptimization.pointsLeft.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                        ${awayOptimization.missedOpportunities.length > 0 ? `
                        <div class="missed-opportunities">
                            <h4>Missed Opportunities</h4>
                            <table class="optimization-table">
                                <thead>
                                    <tr>
                                        <th>Should Have Started</th>
                                        <th>Position</th>
                                        <th>Points</th>
                                        <th>Over</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${awayOptimization.missedOpportunities.map(swap => `
                                    <tr>
                                        <td>${swap.benchPlayer.name}</td>
                                        <td>${swap.benchPlayer.position}</td>
                                        <td>${swap.benchPlayer.actualPoints.toFixed(1)}</td>
                                        <td>${swap.activePlayer.name}</td>
                                        <td>${swap.activePlayer.actualPoints.toFixed(1)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="perfect-lineup">
                            <h4>Perfect Lineup</h4>
                            <p>Congratulations! This team fielded their optimal lineup.</p>
                        </div>
                        `}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // This function would show various analyses of the game
    return `
        <div class="game-analysis-container">
            <div class="analysis-section">
                <h3>Game Summary</h3>
                <p>This was a ${Math.abs(game.margin) < 10 ? 'close' : 'decisive'} ${game.teamScore > game.opponentScore ? 'victory' : 'loss'} for ${game.team} against ${game.opponent} in Week ${game.week} of the ${game.season} season.</p>
                
                <p>The final score was ${game.teamScore.toFixed(1)} - ${game.opponentScore.toFixed(1)}, with a margin of ${Math.abs(game.margin).toFixed(1)} points.</p>
            </div>
            
            ${optimizationHTML}
            
            <div class="analysis-section">
                <h3>Key Insights</h3>
                <ul class="analysis-list">
                    <li>Quarterback performance was ${game.comparisonMetrics.qbRating.team > game.comparisonMetrics.qbRating.opponent ? 'better' : 'worse'} than the opponent</li>
                    <li>${game.comparisonMetrics.rushYards.team > game.comparisonMetrics.rushYards.opponent ? 'Superior' : 'Inferior'} rushing attack with ${game.comparisonMetrics.rushYards.team} total yards</li>
                    <li>${game.comparisonMetrics.passYards.team > game.comparisonMetrics.passYards.opponent ? 'Effective' : 'Struggling'} passing game compared to the opponent</li>
                    <li>${game.comparisonMetrics.turnovers.team < game.comparisonMetrics.turnovers.opponent ? 'Better' : 'Worse'} ball security with ${game.comparisonMetrics.turnovers.team} turnovers</li>
                </ul>
            </div>
            
            <div class="analysis-section">
                <h3>League Context</h3>
                <p>This game's combined score of ${(game.teamScore + game.opponentScore).toFixed(1)} points is ${Math.random() > 0.5 ? 'above' : 'below'} the league average for Week ${game.week}.</p>
            </div>
        </div>
    `;
}

function showError(message) {
    const container = document.querySelector('.game-details-container');
    container.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <a href="game-log.html" class="btn-back">Back to Game Search</a>
        </div>
    `;
}

function calculateRosterOptimization(roster, rosterRules, season) {
    // Determine which players were starters vs bench
    const activePlayersByPosition = {};
    const benchPlayersByPosition = {};
    let actualPoints = 0;
    
    // Track filled positions for empty slot detection
    const filledPositionSlots = {};
    
    // Group players by position
    roster.forEach(player => {
        // Handle null actual points
        if (player.actualPoints === null || player.actualPoints === undefined) {
            player.actualPoints = 0;
        }
        
        // Create arrays for each position
        if (!activePlayersByPosition[player.position]) {
            activePlayersByPosition[player.position] = [];
        }
        if (!benchPlayersByPosition[player.position]) {
            benchPlayersByPosition[player.position] = [];
        }
        
        // Categorize as active or bench
        if (player.slotPosition !== 'BE' && player.slotPosition !== 'IR') {
            activePlayersByPosition[player.position].push(player);
            actualPoints += parseFloat(player.actualPoints) || 0;
            
            // Track filled slot positions
            if (!filledPositionSlots[player.slotPosition]) {
                filledPositionSlots[player.slotPosition] = 0;
            }
            filledPositionSlots[player.slotPosition]++;
        } else if (player.slotPosition === 'BE') {
            benchPlayersByPosition[player.position].push(player);
        }
    });
    
    // Get expected slots from roster rules
    const expectedSlots = {};
    if (Array.isArray(rosterRules)) {
        const ruleSet = rosterRules.find(r => r.Season == season) || 
                       rosterRules.find(r => r.Season === "default");
        if (ruleSet && ruleSet.Slots) {
            Object.keys(ruleSet.Slots).forEach(pos => {
                if (pos !== 'BE' && pos !== 'IR' && pos !== 'FLEX Eligible') {
                    expectedSlots[pos] = ruleSet.Slots[pos];
                }
            });
        }
    } else {
        Object.keys(rosterRules).forEach(pos => {
            if (pos !== 'BE' && pos !== 'IR' && pos !== 'FLEX Eligible') {
                expectedSlots[pos] = rosterRules[pos];
            }
        });
    }
    
    // Get the FLEX eligibility for this season
    let flexEligible = ["RB", "WR", "TE"]; // Default
    if (Array.isArray(rosterRules) && rosterRules.length > 0) {
        const seasonRule = rosterRules.find(rule => rule.Season == season);
        if (seasonRule && seasonRule.Slots && seasonRule.Slots["FLEX Eligible"]) {
            flexEligible = seasonRule.Slots["FLEX Eligible"].split(", ");
        }
    }
    
    // Create flat arrays of active and bench players
    const activePlayers = Object.values(activePlayersByPosition).flat();
    const benchPlayers = Object.values(benchPlayersByPosition).flat();
    
    // For optimization, find any swaps that would have improved the score
    const missedOpportunities = [];
    
    // Sort both arrays by points (highest first)
    activePlayers.sort((a, b) => (parseFloat(b.actualPoints) || 0) - (parseFloat(a.actualPoints) || 0));
    benchPlayers.sort((a, b) => (parseFloat(b.actualPoints) || 0) - (parseFloat(a.actualPoints) || 0));
    
    // For each bench player, see if they outscored an active player at their position or flex
    benchPlayers.forEach(benchPlayer => {
        const benchPoints = parseFloat(benchPlayer.actualPoints) || 0;
        
        // Skip if bench player scored 0 points
        if (benchPoints <= 0) return;
        
        // First check for direct position matches
        const activePlayersInSamePosition = activePlayersByPosition[benchPlayer.position] || [];
        
        activePlayersInSamePosition.forEach(activePlayer => {
            const activePoints = parseFloat(activePlayer.actualPoints) || 0;
            
            if (benchPoints > activePoints) {
                missedOpportunities.push({
                    benchPlayer: benchPlayer,
                    activePlayer: activePlayer,
                    difference: benchPoints - activePoints
                });
            }
        });
        
        // Then check if eligible for FLEX and outscored a FLEX player
        if (flexEligible.includes(benchPlayer.position)) {
            const flexPlayers = activePlayers.filter(p => p.slotPosition === 'FLEX');
            
            flexPlayers.forEach(flexPlayer => {
                const flexPoints = parseFloat(flexPlayer.actualPoints) || 0;
                
                if (benchPoints > flexPoints) {
                    // Check if not already counted in same-position swaps
                    const alreadyCounted = missedOpportunities.some(
                        op => op.benchPlayer === benchPlayer && op.activePlayer === flexPlayer
                    );
                    
                    if (!alreadyCounted) {
                        missedOpportunities.push({
                            benchPlayer: benchPlayer,
                            activePlayer: flexPlayer,
                            difference: benchPoints - flexPoints
                        });
                    }
                }
            });
        }
        
        // Check for empty slots in both regular positions and FLEX
        Object.keys(expectedSlots).forEach(pos => {
            const expectedCount = expectedSlots[pos];
            const filledCount = filledPositionSlots[pos] || 0;
            
            // If this position has unfilled slots and the bench player can play this position
            if (filledCount < expectedCount && 
                (benchPlayer.position === pos || (pos === 'FLEX' && flexEligible.includes(benchPlayer.position)))) {
                
                missedOpportunities.push({
                    benchPlayer: benchPlayer,
                    activePlayer: {
                        name: `Empty ${pos} Slot`,
                        position: pos,
                        actualPoints: 0,
                        emptySlot: true
                    },
                    difference: benchPoints
                });
            }
        });
    });
    
    // Sort missed opportunities by the points difference (highest first)
    missedOpportunities.sort((a, b) => b.difference - a.difference);
    
    // Remove duplicate player references and track used slots
    const uniqueMissedOpportunities = [];
    const usedBenchPlayers = new Set();
    const usedActivePlayers = new Set();
    const filledEmptySlots = {};
    
    missedOpportunities.forEach(opportunity => {
        // For empty slots, we need to track by position
        if (opportunity.activePlayer.emptySlot) {
            const position = opportunity.activePlayer.position;
            const expectedCount = expectedSlots[position] || 0;
            const filledCount = filledPositionSlots[position] || 0;
            const alreadyFilledCount = filledEmptySlots[position] || 0;
            
            // Only add if we haven't already filled all empty slots for this position
            // and if this bench player hasn't been used elsewhere
            if (!usedBenchPlayers.has(opportunity.benchPlayer.playerId) && 
                (filledCount + alreadyFilledCount) < expectedCount) {
                
                uniqueMissedOpportunities.push(opportunity);
                usedBenchPlayers.add(opportunity.benchPlayer.playerId);
                
                // Track that we've filled one more slot of this position
                filledEmptySlots[position] = (filledEmptySlots[position] || 0) + 1;
            }
        } else if (!usedBenchPlayers.has(opportunity.benchPlayer.playerId) && 
                  !usedActivePlayers.has(opportunity.activePlayer.playerId)) {
            
            uniqueMissedOpportunities.push(opportunity);
            usedBenchPlayers.add(opportunity.benchPlayer.playerId);
            usedActivePlayers.add(opportunity.activePlayer.playerId);
        }
    });
    
    // Calculate optimal points total
    let optimalPoints = actualPoints;
    let pointsLeft = 0;
    
    uniqueMissedOpportunities.forEach(opportunity => {
        optimalPoints += opportunity.difference;
        pointsLeft += opportunity.difference;
    });
    
    // Calculate optimization score as percentage
    const optimizationScore = Math.round((actualPoints / optimalPoints) * 100);
    
    return {
        actualPoints,
        optimalPoints,
        pointsLeft,
        optimizationScore,
        missedOpportunities: uniqueMissedOpportunities
    };
}

// Helper function to determine CSS class for optimization score
function getOptimizationClass(score) {
    if (score >= 95) return 'excellent';
    if (score >= 85) return 'good';
    if (score >= 75) return 'average';
    return 'poor';
}
