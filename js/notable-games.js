// Notable Games Page
// This page lives under the Current Season section and shows the current
// season's notable games only — no other-season browsing here (that's what
// Past Seasons / Record Book are for).
let teamAbbreviations = {};

const CATEGORIES = [
    { key: 'highScore', title: 'Highest Single-Team Score', source: 'perTeam', metric: g => g.teamScore, sort: 'desc' },
    { key: 'blowout', title: 'Biggest Blowouts', source: 'perGame', metric: g => Math.abs(g.scoreDiff), sort: 'desc' },
    { key: 'closest', title: 'Closest Games', source: 'perGame', metric: g => Math.abs(g.scoreDiff), sort: 'asc' },
    { key: 'combined', title: 'Highest Combined Score', source: 'perGame', metric: g => g.teamScore + g.opponentScore, sort: 'desc' },
    { key: 'bench', title: 'Most Points Left on the Bench', source: 'perTeam', metric: g => g.benchScore, sort: 'desc' },
    { key: 'loss', title: 'Highest-Scoring Loss', source: 'perTeam', metric: g => g.teamScore, sort: 'desc', filter: g => g.teamScore < g.opponentScore }
];

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('ng-content');
    try {
        teamAbbreviations = await loadTeamAbbreviations();
        const rows = await LeagueDb.scoreRows();
        const parsed = rows
            .filter(g => g.Team && g.Opponent && g.Team.toLowerCase() !== 'bye' && g.Opponent.toLowerCase() !== 'bye')
            .map(g => ({
                season: g.Season,
                week: g.Week,
                gameId: g['Game ID'],
                team: g.Team,
                opponent: g.Opponent,
                teamScore: parseFloat(g['Team Score']),
                opponentScore: parseFloat(g['Opponent Score']),
                scoreDiff: parseFloat(g['Score Diff']),
                benchScore: parseFloat(g['Bench Score'])
            }))
            .filter(g => !Number.isNaN(g.teamScore) && !Number.isNaN(g.opponentScore));

        const currentSeason = parsed.reduce((max, g) => Math.max(max, g.season), -Infinity);
        const allGames = parsed.filter(g => g.season === currentSeason);
        const uniqueGames = dedupeGames(allGames);

        document.getElementById('ng-season-badge').textContent = Number.isFinite(currentSeason) ? `${currentSeason} Season` : '';
        render(allGames, uniqueGames);
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="error-state">Error loading data. Please try again later.</div>';
    }
});

async function loadTeamAbbreviations() {
    try {
        const data = await LeagueDb.teamAbbreviations();
        const lookup = {};
        data.teams.forEach(team => { lookup[team.name] = team.abbreviations.FFL; });
        return lookup;
    } catch (err) {
        console.error('Error loading team abbreviations:', err);
        return {};
    }
}

// Each real game appears twice in scoreRows (once per team's perspective).
// Game-level categories (blowout/closest/combined) need one row per game;
// per-team categories (high score/bench) use every row as its own data point.
function dedupeGames(games) {
    const seen = new Set();
    const result = [];
    games.forEach(g => {
        const key = `${g.season}-${g.gameId}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(g);
    });
    return result;
}

function render(allGames, uniqueGames) {
    const content = document.getElementById('ng-content');
    if (!allGames.length) {
        content.innerHTML = '<div class="ng-empty">No games played yet this season.</div>';
        return;
    }
    content.innerHTML = `<div class="ng-grid">${CATEGORIES
        .map(cat => renderCategory(cat, cat.source === 'perGame' ? uniqueGames : allGames))
        .join('')}</div>`;
}

function renderCategory(cat, rows) {
    const ranked = rows
        .filter(cat.filter || (() => true))
        .filter(g => !Number.isNaN(cat.metric(g)))
        .sort((a, b) => cat.sort === 'desc' ? cat.metric(b) - cat.metric(a) : cat.metric(a) - cat.metric(b))
        .slice(0, 5);

    if (!ranked.length) {
        return `<div class="ng-card"><h2 class="ng-card-title">${cat.title}</h2><div class="ng-empty">No games found.</div></div>`;
    }

    const rowsHtml = ranked.map((g, i) => renderRow(g, i + 1, cat)).join('');
    return `<div class="ng-card"><h2 class="ng-card-title">${cat.title}</h2><div class="ng-list">${rowsHtml}</div></div>`;
}

function renderRow(g, rank, cat) {
    const teamAbbr = teamAbbreviations[g.team] || 'default';
    const oppAbbr = teamAbbreviations[g.opponent] || 'default';
    const metricLabel = formatMetric(cat, g);
    const side = (abbr, name, score, other) => `
                <div class="ng-side">
                    <img class="ng-logo" src="../assets/icons/ffl-logos/${abbr}.png" alt="${name}" onerror="this.src='../assets/icons/ffl-logos/default.png'">
                    <span class="ng-team">${name}</span>
                    <span class="ng-score${score > other ? ' win' : ''}">${score.toFixed(2)}</span>
                </div>`;
    return `
        <a class="ng-row" href="game-details.html?id=${g.gameId}&season=${g.season}">
            <span class="ng-rank">${rank}</span>
            <div class="ng-teams">${side(teamAbbr, g.team, g.teamScore, g.opponentScore)}${side(oppAbbr, g.opponent, g.opponentScore, g.teamScore)}
            </div>
            <div class="ng-info">
                <span class="ng-metric">${metricLabel}</span>
                <span class="ng-meta">S${g.season} · Wk${g.week}</span>
            </div>
        </a>
    `;
}

function formatMetric(cat, g) {
    switch (cat.key) {
        case 'highScore': return `${g.teamScore.toFixed(2)} pts`;
        case 'blowout': case 'closest': return `${Math.abs(g.scoreDiff).toFixed(2)} pt margin`;
        case 'combined': return `${(g.teamScore + g.opponentScore).toFixed(2)} combined`;
        case 'loss': return `${g.teamScore.toFixed(2)} pts, still lost`;
        case 'bench': return `${g.benchScore.toFixed(2)} bench pts`;
        default: return '';
    }
}
