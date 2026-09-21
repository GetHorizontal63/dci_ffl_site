// 200+ Point Games Page
let allGames = [];
let currentPage = 1;
// Rows per page is worked out from the height of the results area (see fitGamesPerPage).
let gamesPerPage = 8;
let fittingPage = false;
let teamAbbreviations = {};

document.addEventListener('DOMContentLoaded', function() {
    loadTeamAbbreviations();
});

function loadTeamAbbreviations() {
    LeagueDb.teamAbbreviations()
        .then(data => {
            // Build abbreviation lookup from FFL team data
            data.teams.forEach(team => {
                teamAbbreviations[team.name] = team.abbreviations.FFL;
            });
            loadHighScoreGames();
        })
        .catch(error => {
            console.error('Error loading team abbreviations:', error);
            loadHighScoreGames();
        });
}

function loadHighScoreGames() {
    // Add high-score-table class to results container
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        resultsContainer.classList.add('high-score-table');
    }

    LeagueDb.scoreRows()
        .then(data => {
            // Filter games with 200+ points
            allGames = data.filter(game => {
                const teamScore = parseFloat(game["Team Score"]);
                return !isNaN(teamScore) && teamScore >= 200;
            }).map((game, index) => ({
                rank: index + 1,
                team: game["Team"],
                score: parseFloat(game["Team Score"]),
                opponent: game["Opponent"],
                oppScore: parseFloat(game["Opponent Score"]),
                season: game["Season"],
                week: game["Week"],
                gameId: game["Game ID"],
                teamAbbr: teamAbbreviations[game["Team"]] || 'default',
                oppAbbr: teamAbbreviations[game["Opponent"]] || 'default'
            }));

            // Sort by score descending
            allGames.sort((a, b) => b.score - a.score);
            
            // Re-rank after sorting
            allGames.forEach((game, index) => {
                game.rank = index + 1;
            });

            // Update results count
            const resultsCount = document.getElementById('results-count');
            if (resultsCount) {
                resultsCount.textContent = `${allGames.length} games found`;
            }

            displayGames();
        })
        .catch(error => {
            console.error('Error loading high score games:', error);
            document.getElementById('high-score-results').innerHTML = 
                '<div class="error-state">Error loading data. Please try again later.</div>';
            const resultsCount = document.getElementById('results-count');
            if (resultsCount) {
                resultsCount.textContent = 'Error loading data';
            }
        });
}

function displayGames() {
    const container = document.getElementById('high-score-results');
    
    if (allGames.length === 0) {
        container.innerHTML = '<div class="empty-state">No 200+ point games found.</div>';
        return;
    }

    // Fill the results area: draw one row to learn its height, then size the page to fit
    if (!fittingPage) {
        fittingPage = true;
        const firstShown = (currentPage - 1) * gamesPerPage;
        gamesPerPage = 1;
        currentPage = firstShown + 1;
        displayGames();
        const fit = fitGamesPerPage();
        gamesPerPage = fit;
        currentPage = Math.floor(firstShown / fit) + 1;     // keep the first game you were looking at on screen
        fittingPage = false;
    }

    // Calculate pagination
    const totalPages = Math.ceil(allGames.length / gamesPerPage);
    const startIndex = (currentPage - 1) * gamesPerPage;
    const endIndex = Math.min(startIndex + gamesPerPage, allGames.length);
    const pagGames = allGames.slice(startIndex, endIndex);

    // Render games
    container.innerHTML = '';
    pagGames.forEach(game => {
        const row = document.createElement('div');
        row.className = 'result-row';
        
        row.innerHTML = `
            <div class="result-cell">${game.rank}</div>
            <div class="result-cell"></div>
            <div class="result-cell">
                <div class="team-logo">
                    <img src="../assets/icons/ffl-logos/${game.teamAbbr}.png" 
                         alt="${game.team}" 
                         onerror="this.src='../assets/icons/ffl-logos/default.png'">
                </div>
                ${game.team}
            </div>
            <div class="result-cell" style="color: #4ade80; font-weight: bold;">${game.score.toFixed(2)}</div>
            <div class="result-cell"></div>
            <div class="result-cell">
                <div class="team-logo">
                    <img src="../assets/icons/ffl-logos/${game.oppAbbr}.png" 
                         alt="${game.opponent}" 
                         onerror="this.src='../assets/icons/ffl-logos/default.png'">
                </div>
                ${game.opponent}
            </div>
            <div class="result-cell">${game.oppScore.toFixed(2)}</div>
            <div class="result-cell">${game.season}</div>
            <div class="result-cell">${game.week}</div>
            <div class="result-cell">
                <a href="game-details.html?id=${game.gameId}&season=${game.season}" 
                   class="details-link">View Details</a>
            </div>
        `;
        
        container.appendChild(row);
    });

    // Update pagination
    renderPagination(totalPages);
}

function fitGamesPerPage() {
    if (window.innerWidth <= 800) return 8;      // phones: the page scrolls, so a plain page size
    const list = document.getElementById('high-score-results');
    const row = list && list.querySelector('.result-row');
    if (!row) return gamesPerPage;
    return Math.max(1, Math.floor(list.clientHeight / row.getBoundingClientRect().height));
}

// Re-fit whenever the results area changes size (window resize, layout settling after load).
let lastListHeight = 0;
function watchListHeight() {
    const list = document.getElementById('high-score-results');
    if (!list || !window.ResizeObserver) return;
    new ResizeObserver(() => {
        const h = list.clientHeight;
        if (window.innerWidth <= 800) return;
        if (allGames.length && Math.abs(h - lastListHeight) > 2) {
            lastListHeight = h;
            displayGames();
        }
    }).observe(list);
}
document.addEventListener('DOMContentLoaded', watchListHeight);

function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('bottom-pagination');
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.className = 'pagination-controls';
    paginationContainer.innerHTML = `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(1)" 
                ${currentPage === 1 ? 'disabled' : ''}>
            First
        </button>
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
        <div class="page-indicator">
            Page ${currentPage} of ${totalPages}
        </div>
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${totalPages})" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            Last
        </button>
    `;
}

function changePage(page) {
    const totalPages = Math.ceil(allGames.length / gamesPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayGames();
    
    // Scroll to top of results
    document.querySelector('.results-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
