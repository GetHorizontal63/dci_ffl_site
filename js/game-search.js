document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const seasonFilter = document.getElementById('season-filter');
    const weekFilter = document.getElementById('week-filter');
    const teamFilter = document.getElementById('team-filter');
    const matchupTypeFilter = document.getElementById('matchup-type-filter');
    const sortFilter = document.getElementById('sort-filter');
    const gameResults = document.getElementById('game-results');
    const resultsCount = document.querySelector('.results-count');
    const bottomPagination = document.getElementById('bottom-pagination');
    
    // Game data and pagination variables
    let allGames = [];
    let filteredGames = [];
    let currentPage = 1;
    const gamesPerPage = 20;
    let uniqueTeams = new Set();
    let teamAbbreviations = {}; // Store team abbreviations
    
    // Cache to store roster data for each season/week combination
    let rosterDataCache = {};
    let rosterRules = {};
    
    // Initialize filters
    function initializeFilters() {
        // Populate weeks (1-17)
        for (let week = 1; week <= 17; week++) {
            const option = document.createElement('option');
            option.value = week;
            option.textContent = `Week ${week}`;
            weekFilter.appendChild(option);
        }
    }
    
    // Load team abbreviations first, then load roster rules, then load game data
    function loadTeamAbbreviations() {
        LeagueDb.teamAbbreviations()
            .then(data => {
                // Create a mapping of team names to their FFL values
                data.teams.forEach(team => {
                    teamAbbreviations[team.name] = team.abbreviations.FFL;
                });
                
                // Now load roster rules, then game data
                return loadRosterRules();
            })
            .then(() => {
                // Now load the game data
                loadGameData();
            })
            .catch(error => {
                console.error('Error loading team abbreviations:', error);
                // Still try to load game data even if abbreviations fail
                loadGameData();
            });
    }
    
    // Load roster rules for efficiency calculations
    function loadRosterRules() {
        return LeagueDb.rosterRules()
            .then(data => {
                rosterRules = { leagues: data };
                console.log('Loaded roster rules:', rosterRules);
                return rosterRules;
            })
            .catch(error => {
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
            });
    }
    
    // Load roster data for a specific season and week
    async function loadRosterData(season, week) {
        // Create a cache key for this season/week combination
        const cacheKey = `${season}_${week}`;
        
        // Return cached data if available
        if (rosterDataCache[cacheKey]) {
            return rosterDataCache[cacheKey];
        }
        
        try {
            const data = await LeagueDb.fantasyRoster(season, week);
            
            // Cache the data for future use
            rosterDataCache[cacheKey] = data;
            return data;
        } catch (error) {
            console.error(`Error loading roster data for Season ${season} Week ${week}:`, error);
            return null;
        }
    }
    
    // Find team roster in the roster data
    async function findTeamRoster(teamName, rosterData) {
        if (!rosterData || !rosterData.teams) {
            console.log(`No roster data available for team ${teamName}`);
            return null;
        }
        
        // Try to find the team in the roster data
        // First try direct match by team name or owner
        let team = rosterData.teams.find(t => 
            t.team_name?.toLowerCase() === teamName.toLowerCase() || 
            t.owner?.toLowerCase() === teamName.toLowerCase()
        );
        
        // If not found, try to match using league config mapping
        if (!team) {
            try {
                const owners = await LeagueDb.owners();
                const manager = owners.find(m => m.display_name?.toLowerCase() === teamName.toLowerCase());
                
                if (manager) {
                    // Find team by matching team_id to franchise_id
                    team = rosterData.teams.find(t => 
                        t.owner?.toLowerCase() === manager.display_name.toLowerCase()
                    );
                }
            } catch (error) {
                console.log('Could not load league config for team mapping:', error);
            }
        }
        
        if (!team) {
            console.log(`Could not find roster for team ${teamName} in roster data`);
            console.log('Available teams:', rosterData.teams.map(t => `ID: ${t.team_id}, Name: ${t.team_name || 'Unknown'}, Owner: ${t.owner || 'null'}`));
            return null;
        }
        
        console.log(`Found roster for team ${teamName} with ${team.roster.length} players`);
        return team.roster;
    }
    
    // Get roster rules for a specific season
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
    
    // Calculate roster optimization to get efficiency percentage
    function calculateRosterOptimization(roster, rosterRules, season) {
        // Group all players by active/bench 
        const activePlayers = [];
        const benchPlayers = [];
        let actualPoints = 0;
        
        // First pass - separate active and bench players
        roster.forEach(player => {
            if (!player.actualPoints) player.actualPoints = 0;
            
            if (player.slotPosition === 'BE' || player.slotPosition === 'IR') {
                benchPlayers.push(player);
            } else {
                activePlayers.push(player);
                actualPoints += parseFloat(player.actualPoints) || 0;
            }
        });
        
        console.log(`Active players: ${activePlayers.length}, Bench players: ${benchPlayers.length}`);
        
        // Find all possible improvements - both position swaps and empty slots
        const possibleImprovements = [];
        const checkedPositions = new Set();
        
        // CRITICAL FIX: Look for players that are on bench but should be in lineup
        // This directly looks for position matches (P, HC, etc.)
        benchPlayers.forEach(benchPlayer => {
            const benchPoints = parseFloat(benchPlayer.actualPoints) || 0;
            const position = benchPlayer.position; // Use the actual position, not slot
            
            if (benchPoints <= 0) return; // Skip bench players with no points
            
            // We'll store whether this player could be used in a position swap
            let usedInSwap = false;
            
            // Check if this player outperforms any active player in the same position
            const samePositionActive = activePlayers.filter(p => p.position === position);
            
            samePositionActive.forEach(activePlayer => {
                const activePoints = parseFloat(activePlayer.actualPoints) || 0;
                
                if (benchPoints > activePoints) {
                    possibleImprovements.push({
                        benchPlayer: benchPlayer,
                        activePlayer: activePlayer,
                        difference: benchPoints - activePoints,
                        type: 'swap'
                    });
                    usedInSwap = true;
                }
            });
            
            // If position not already checked AND this player wasn't part of a swap
            // Check if there's an empty slot this player could fill
            if (!checkedPositions.has(position)) {
                // Count active players in this position
                const activeInPosition = activePlayers.filter(p => p.position === position).length;
                
                // See if this position has an active count of EXACTLY ZERO
                // This is the key to finding completely unfilled positions like P and HC
                if (activeInPosition === 0) {
                    possibleImprovements.push({
                        benchPlayer: benchPlayer,
                        activePlayer: {
                            name: `Empty ${position} Slot`,
                            position: position,
                            actualPoints: 0,
                            emptySlot: true
                        },
                        difference: benchPoints,
                        type: 'empty'
                    });
                    
                    // Mark this position as checked to avoid duplicates
                    checkedPositions.add(position);
                }
            }
        });
        
        // Sort by highest point difference
        possibleImprovements.sort((a, b) => b.difference - a.difference);
        
        // Deduplicate to avoid using same player multiple times
        const improvements = [];
        const usedBenchPlayers = new Set();
        const usedActiveSlots = new Set();
        
        possibleImprovements.forEach(improvement => {
            if (!usedBenchPlayers.has(improvement.benchPlayer.playerId)) {
                if (improvement.type === 'empty' || 
                    !usedActiveSlots.has(improvement.activePlayer.playerId)) {
                    
                    improvements.push(improvement);
                    usedBenchPlayers.add(improvement.benchPlayer.playerId);
                    
                    if (improvement.type === 'swap') {
                        usedActiveSlots.add(improvement.activePlayer.playerId);
                    }
                }
            }
        });
        
        // Calculate optimal points total
        let optimalPoints = actualPoints;
        let pointsLeft = 0;
        
        improvements.forEach(improvement => {
            optimalPoints += improvement.difference;
            pointsLeft += improvement.difference;
            console.log(`Improvement: ${improvement.benchPlayer.name} (${improvement.benchPlayer.position}) ${improvement.benchPlayer.actualPoints} pts should replace ${improvement.activePlayer.name} ${improvement.activePlayer.actualPoints || 0} pts, difference: ${improvement.difference}`);
        });
        
        // Calculate optimization score
        const optimizationScore = optimalPoints > 0 ? Math.round((actualPoints / optimalPoints) * 100) : 100;
        
        console.log(`Roster optimization: ${actualPoints} / ${optimalPoints} = ${optimizationScore}%`);
        console.log(`Points left on bench: ${pointsLeft}`);
        
        return {
            actualPoints,
            optimalPoints,
            pointsLeft,
            optimizationScore,
            missedOpportunities: improvements
        };
    }
    
    // Calculate total projected points for a roster
    function calculateRosterProjectedPoints(roster) {
        if (!roster) {
            return 0;
        }
        
        const activePlayers = roster.filter(player => player.slotPosition !== 'BE' && player.slotPosition !== 'IR');
        
        // For debugging
        console.log('Active players for projected points:', 
            activePlayers.length, 
            activePlayers.map(p => ({
                name: p.name,
                position: p.position,
                slot: p.slotPosition,
                projected: p.projectedPoints
            }))
        );
        
        const totalProjected = activePlayers.reduce((total, player) => {
            const points = parseFloat(player.projectedPoints) || 0;
            return total + points;
        }, 0);
        
        console.log('Total projected points:', totalProjected.toFixed(1));
        
        return totalProjected;
    }
    
    // Calculate FP+ (actual points / projected points) for a roster
    function calculateFPPlus(actual, projected) {
        if (!projected || projected === 0) {
            return 0;
        }
        return Math.round((actual / projected) * 100);
    }
    
    // Load actual game data from JSON file
    function loadGameData() {
        gameResults.innerHTML = '<div class="loading-message">Loading games...</div>';
        
        LeagueDb.scoreRows()
            .then(data => {
                // Process the game data and wait for metrics to be enriched before searching
                return processGameData(data);
            })
            .then(() => {
                // Initial search with default filters after metrics are loaded
                searchGames();
            })
            .catch(error => {
                console.error('Error loading game data:', error);
                gameResults.innerHTML = `<div class="error-state">Error loading game data: ${error.message}</div>`;
            });
    }
    
    // Process the raw game data to create unique game entries
    function processGameData(rawData) {
        // Group games by Game ID
        const gamesByID = {};
        const seasons = new Set();
        
        // Process each game entry
        rawData.forEach(entry => {
            // Skip entries with "Score Diff" only (these appear to be incomplete entries in the data)
            if (Object.keys(entry).length === 1 && entry["Score Diff"]) {
                return;
            }
            
            const gameId = entry["Game ID"];
            const season = entry["Season"];
            
            // Add to unique teams set
            uniqueTeams.add(entry["Team"]);
            uniqueTeams.add(entry["Opponent"]);
            
            // Add to unique seasons set
            seasons.add(season);
            
            // If we haven't seen this game ID yet, create a new entry
            if (!gamesByID[gameId]) {
                gamesByID[gameId] = {
                    id: gameId,
                    season: season,
                    week: entry["Week"],
                    period: entry["Season Period"],
                    leagueWeek: entry["League Week"],
                    team1: entry["Team"],
                    team1Score: parseFloat(entry["Team Score"]) || 0,
                    team1Proj: 0, // Will be populated from roster data
                    team1FPPlus: 0, // Will be calculated
                    team1Eff: "0%", // Will be calculated
                    team2: entry["Opponent"],
                    team2Score: parseFloat(entry["Opponent Score"]) || 0,
                    team2Proj: 0, // Will be populated from roster data
                    team2FPPlus: 0, // Will be calculated
                    team2Eff: "0%", // Will be calculated
                    scoreDiff: Math.abs(parseFloat(String(entry["Score Diff"]).replace(/^-/, ''))),
                    winnerId: parseFloat(String(entry["Score Diff"])) > 0 ? entry["Team"] : entry["Opponent"]
                };
            }
        });
        
        // Convert to array and sort by season and week
        allGames = Object.values(gamesByID);
        
        // Sort by season (descending) and week (descending)
        allGames.sort((a, b) => {
            if (b.season !== a.season) return b.season - a.season;
            return b.week - a.week;
        });
        
        // Populate seasons filter
        populateSeasonsFilter(Array.from(seasons).sort((a, b) => b - a));
        
        // Populate teams filter
        populateTeamsFilter(Array.from(uniqueTeams).sort());
        
        // Return a promise that resolves when metrics have been enriched
        return enrichGamesWithMetrics(allGames);
    }
    
    // Function to enrich games with roster data and calculate metrics
    async function enrichGamesWithMetrics(games) {
        // Show a loading message in the results area while calculating metrics
        gameResults.innerHTML = '<div class="loading-message">Calculating game metrics...</div>';
        
        // Create a map to group games by season and week for batch processing
        const gamesBySeason = {};
        
        games.forEach(game => {
            const key = game.season;
            if (!gamesBySeason[key]) {
                gamesBySeason[key] = {};
            }
            
            const weekKey = game.week;
            if (!gamesBySeason[key][weekKey]) {
                gamesBySeason[key][weekKey] = [];
            }
            
            gamesBySeason[key][weekKey].push(game);
        });
        
        // Process each season/week combination
        for (const season in gamesBySeason) {
            for (const week in gamesBySeason[season]) {
                const gamesInWeek = gamesBySeason[season][week];
                await enrichGamesForWeek(gamesInWeek, season, week);
            }
        }
        
        // Log completion of metrics enrichment
        console.log('Finished enriching all games with metrics');
        
        // Return the enriched games
        return games;
    }
    
    // Enrich games for a specific week with projected points and efficiency
    async function enrichGamesForWeek(games, season, week) {
        // Load roster data for this week
        const rosterData = await loadRosterData(season, week);
        
        if (!rosterData) {
            console.log(`No roster data available for Season ${season} Week ${week}`);
            return;
        }
        
        console.log(`Processing ${games.length} games for Season ${season} Week ${week}`);
        
        // Get roster rules for this season
        const seasonRules = getRosterSlotsForSeason(season);
        
        // Process each game
        for (const game of games) {
            console.log(`Processing game: ${game.team1} vs ${game.team2}`);
            
            // Find roster data for both teams
            const team1Roster = await findTeamRoster(game.team1, rosterData);
            const team2Roster = await findTeamRoster(game.team2, rosterData);
            
            // Calculate projected points for team 1
            if (team1Roster) {
                console.log(`Calculating projected points for ${game.team1}`);
                game.team1Proj = calculateRosterProjectedPoints(team1Roster);
                
                // Calculate FP+ for team 1
                game.team1FPPlus = calculateFPPlus(game.team1Score, game.team1Proj);
                
                // Calculate efficiency for team 1
                const team1Optimization = calculateRosterOptimization(team1Roster, seasonRules, season);
                game.team1Eff = `${team1Optimization.optimizationScore}%`;
            }
            
            // Calculate projected points for team 2
            if (team2Roster) {
                console.log(`Calculating projected points for ${game.team2}`);
                game.team2Proj = calculateRosterProjectedPoints(team2Roster);
                
                // Calculate FP+ for team 2
                game.team2FPPlus = calculateFPPlus(game.team2Score, game.team2Proj);
                
                // Calculate efficiency for team 2
                const team2Optimization = calculateRosterOptimization(team2Roster, seasonRules, season);
                game.team2Eff = `${team2Optimization.optimizationScore}%`;
            }
            
            console.log(`Game metrics calculated:`, {
                game: `${game.team1} vs ${game.team2}`,
                team1Proj: game.team1Proj,
                team1FPPlus: game.team1FPPlus, 
                team1Eff: game.team1Eff,
                team2Proj: game.team2Proj,
                team2FPPlus: game.team2FPPlus,
                team2Eff: game.team2Eff
            });
        }
    }
    
    // Populate seasons filter with actual seasons from data
    function populateSeasonsFilter(seasons) {
        seasonFilter.innerHTML = '<option value="">All Seasons</option>';
        
        seasons.forEach((season, index) => {
            const option = document.createElement('option');
            option.value = season;
            option.textContent = season;
            // Set the first season (most recent) as selected by default
            if (index === 0) {
                option.selected = true;
            }
            seasonFilter.appendChild(option);
        });
    }
    
    // Populate teams filter with actual teams from data
    function populateTeamsFilter(teams) {
        teamFilter.innerHTML = '<option value="">All Teams</option>';
        
        // Filter out "Bye" before populating dropdown
        teams.filter(team => team !== "Bye").forEach(team => {
            const option = document.createElement('option');
            option.value = team;
            option.textContent = team;
            teamFilter.appendChild(option);
        });
    }
    
    // Search games based on filters
    function searchGames() {
        const season = seasonFilter.value;
        const week = weekFilter.value;
        const team = teamFilter.value;
        const matchupType = matchupTypeFilter.value;
        const sortBy = sortFilter.value;
        
        // Filter games
        filteredGames = allGames.filter(game => {
            // Season filter
            if (season && game.season != season) {
                return false;
            }
            
            // Week filter
            if (week && game.week != week) {
                return false;
            }
            
            // Team filter
            if (team && game.team1 !== team && game.team2 !== team) {
                return false;
            }
            
            // Matchup type filter
            if (matchupType) {
                const periodLower = game.period.toLowerCase();
                if (matchupType === 'regular' && periodLower !== 'regular') {
                    return false;
                } else if (matchupType === 'playoff' && !periodLower.includes('post')) {
                    return false;
                } else if (matchupType === 'championship' && !periodLower.includes('championship')) {
                    return false;
                } else if (matchupType === 'consolation' && !periodLower.includes('consolation')) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Sort games
        filteredGames.sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return (b.season - a.season) || (b.week - a.week);
                case 'date-asc':
                    return (a.season - b.season) || (a.week - b.week);
                case 'score-desc':
                    return ((parseFloat(b.team1Score) || 0) + (parseFloat(b.team2Score) || 0)) - ((parseFloat(a.team1Score) || 0) + (parseFloat(a.team2Score) || 0));
                case 'score-asc':
                    return ((parseFloat(a.team1Score) || 0) + (parseFloat(a.team2Score) || 0)) - ((parseFloat(b.team1Score) || 0) + (parseFloat(b.team2Score) || 0));
                case 'fpplus-desc':
                    return Math.max(b.team1FPPlus, b.team2FPPlus) - Math.max(a.team1FPPlus, a.team2FPPlus);
                case 'fpplus-asc':
                    return Math.max(a.team1FPPlus, a.team2FPPlus) - Math.max(b.team1FPPlus, b.team2FPPlus);
                case 'eff-desc':
                    return parseInt(b.team1Eff) - parseInt(a.team1Eff) || parseInt(b.team2Eff) - parseInt(a.team2Eff);
                case 'eff-asc':
                    return parseInt(a.team1Eff) - parseInt(b.team1Eff) || parseInt(a.team2Eff) - parseInt(b.team2Eff);
                default:
                    return (b.season - a.season) || (b.week - a.week);
            }
        });
        
        // Reset to first page
        currentPage = 1;
        
        // Display results
        displayGames();
    }
    
    // Display games with pagination
    function displayGames() {
        // Clear previous results
        gameResults.innerHTML = '';
        bottomPagination.innerHTML = '';
        
        if (filteredGames.length === 0) {
            gameResults.innerHTML = `
                <div class="empty-state">
                    <p>No games found matching your criteria. Try adjusting your filters.</p>
                </div>
            `;
            resultsCount.textContent = '0 games found';
            return;
        }
        
        // Calculate pagination
        const totalGames = filteredGames.length;
        const totalPages = Math.ceil(totalGames / gamesPerPage);
        
        // Ensure current page is valid
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;
        
        // Get current page of games
        const startIndex = (currentPage - 1) * gamesPerPage;
        const endIndex = Math.min(startIndex + gamesPerPage, totalGames);
        const currentGames = filteredGames.slice(startIndex, endIndex);
        
        // Update results count
        resultsCount.textContent = `${totalGames} games found (showing ${startIndex + 1}-${endIndex})`;
        
        // Display each game (two rows per game - one for each team)
        currentGames.forEach(game => {
            // Determine winners and losers
            const team1IsWinner = (parseFloat(game.team1Score) || 0) > (parseFloat(game.team2Score) || 0);
            const team2IsWinner = (parseFloat(game.team2Score) || 0) > (parseFloat(game.team1Score) || 0);
            
            // Format period display text
            let displayPeriod = game.period;
            
            // Check if period is in the "Bracket" list
            if (['Post-WB', 'Post-WC', 'Post-WP', '3rd Place', '5th Place', '7th Place'].includes(game.period)) {
                displayPeriod = 'Bracket';
            }
            // Check if period is in the "Gulag" list
            else if (['Post-LB', 'Post-LC', 'Post-LP', '11th Place', '13th Place', '9th Place', '10th Place', '12th Place'].includes(game.period)) {
                displayPeriod = 'Gulag';
            }
            // Display "Champ" for Championship
            else if (game.period === 'Championship') {
                displayPeriod = 'Champ';
            }
            // Display "Hell" for Chumpionship
            else if (game.period === 'Chumpionship') {
                displayPeriod = 'Hell';
            }
            
            // Get team logo paths
            const team1Logo = getTeamLogoPath(game.team1);
            const team2Logo = getTeamLogoPath(game.team2);
            
            // Helper functions to get appropriate css classes for the metrics
            const getFPPlusClass = (fpPlus) => {
                if (!fpPlus) return '';
                if (fpPlus > 100) return 'fp-plus-good';      // Green for values over 100
                if (fpPlus < 100) return 'fp-plus-poor';      // Red for values under 100
                return 'fp-plus-equal';                       // White for exactly 100
            };
            
            // First team row
            const team1Row = document.createElement('div');
            team1Row.className = `result-row ${team1IsWinner ? 'winner' : 'loser'}`;
            
            team1Row.innerHTML = `
                <div class="result-cell" data-label="Season">${game.season}</div>
                <div class="result-cell" data-label="Week">${game.week}</div>
                <div class="result-cell" data-label="Period">${displayPeriod}</div>
                <div class="result-cell"></div>
                <div class="result-cell" data-label="Team">
                    <div class="team-logo">
                        <img src="${team1Logo}" alt="${game.team1}" onerror="this.src='../assets/icons/ffl-logos/default.png'">
                    </div>
                    ${game.team1}
                </div>
                <div class="result-cell ${team1IsWinner ? 'high-score' : ''}" data-label="Score">${typeof game.team1Score === 'number' ? game.team1Score.toFixed(2) : '0.00'}</div>
                <div class="result-cell ${getFPPlusClass(game.team1FPPlus)}" data-label="FP+">${game.team1FPPlus ? game.team1FPPlus : '-'}</div>
                <div class="result-cell" data-label="Eff.">${game.team1Eff || '-'}</div>
                <div class="result-cell"></div>
                <div class="result-cell" data-label="Opponent">
                    <div class="team-logo">
                        <img src="${team2Logo}" alt="${game.team2}" onerror="this.src='../assets/icons/ffl-logos/default.png'">
                    </div>
                    ${game.team2}
                </div>
                <div class="result-cell ${team2IsWinner ? 'high-score' : ''}" data-label="Score">${typeof game.team2Score === 'number' ? game.team2Score.toFixed(2) : '0.00'}</div>
                <div class="result-cell ${getFPPlusClass(game.team2FPPlus)}" data-label="FP+">${game.team2FPPlus ? game.team2FPPlus : '-'}</div>
                <div class="result-cell" data-label="Eff.">${game.team2Eff || '-'}</div>
                <div class="result-cell details-cell" data-label="Details"><a href="game-details.html?id=${game.id}&season=${game.season}" class="details-link"><i class="fas fa-chart-bar"></i>Details</a></div>
            `;
            
            gameResults.appendChild(team1Row);
        });
        
        // Add pagination controls at the bottom if more than one page
        if (totalPages > 1) {
            addPaginationControls(bottomPagination, totalPages);
        }
    }
    
    // Add pagination controls
    function addPaginationControls(container, totalPages) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-controls';
        
        // Previous page button
        const prevButton = document.createElement('button');
        prevButton.className = 'pagination-btn' + (currentPage === 1 ? ' disabled' : '');
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayGames();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        
        // Page indicator
        const pageIndicator = document.createElement('div');
        pageIndicator.className = 'page-indicator';
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
        
        // Next page button - Fixed missing variable declaration
        const nextButton = document.createElement('button');
        nextButton.className = 'pagination-btn' + (currentPage === totalPages ? ' disabled' : '');
        nextButton.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayGames();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        
        // Add buttons to container
        paginationContainer.appendChild(prevButton);
        paginationContainer.appendChild(pageIndicator);
        paginationContainer.appendChild(nextButton);
        
        // Add pagination to the provided container
        container.appendChild(paginationContainer);
    }
    
    // Helper function to get the team logo path
    function getTeamLogoPath(teamName) {
        // Default to 'default.png' if team not found in abbreviations
        const fflValue = teamAbbreviations[teamName] || 'default';
        return `../assets/icons/ffl-logos/${fflValue}.png`;
    }
    
    // Initialize the page
    function initializeGameSearch() {
        initializeFilters();
        
        // Show initial loading state
        gameResults.innerHTML = '<div class="loading-message"><i class="fas fa-spinner fa-spin"></i><p>Loading game data and metrics...</p></div>';
        
        // Load team abbreviations, roster rules, then game data (with metrics)
        loadTeamAbbreviations();
    }
    
    initializeGameSearch();
    
    // Add event listeners for filters
    seasonFilter.addEventListener('change', searchGames);
    weekFilter.addEventListener('change', searchGames);
    teamFilter.addEventListener('change', searchGames);
    matchupTypeFilter.addEventListener('change', searchGames);
    sortFilter.addEventListener('change', searchGames);
});
