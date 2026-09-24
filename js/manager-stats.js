// Formatting and stat helpers shared by the Manager History and Compare Managers pages.

const ordinal = n => {
    const v = n % 100;
    const suffix = (v >= 11 && v <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${suffix}`;
};
const fmt2 = n => Number(n).toFixed(2);
const fmtPd = n => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
const record = (w, l, t) => `${w}-${l}${t ? `-${t}` : ''}`;
const pctOf = (w, l, t) => { const g = w + l + t; return g ? (w + 0.5 * t) / g : 0; };
const fmtPct = x => x.toFixed(3).replace(/^0(?=\.)/, '');   // .571, 1.000
const fmtIdx = x => (x == null ? '-' : x.toFixed(1));

// One row per team-game that was played (byes dropped), with the week's score rank and how many
// teams were ranked that week.
function prepareGames(scoreRows) {
    const played = scoreRows
        .filter(g => g.Team && g.Opponent && g.Team.toLowerCase() !== 'bye' && g.Opponent.toLowerCase() !== 'bye');
    const weekSize = {};
    played.filter(g => g['Season Period'] === 'Regular').forEach(g => {
        const w = weekSize[`${g.Season}-${g.Week}`] || (weekSize[`${g.Season}-${g.Week}`] = { rows: 0, maxRank: 0 });
        w.rows += 1;
        w.maxRank = Math.max(w.maxRank, Number(g['Score Rank on Week']) || 0);
    });
    return played.map(g => {
        const w = weekSize[`${g.Season}-${g.Week}`];
        return {
            owner: g.Team, opponent: g.Opponent, us: Number(g['Team Score']), them: Number(g['Opponent Score']),
            season: g.Season, week: g.Week,
            regular: g['Season Period'] === 'Regular',
            rank: Number(g['Score Rank on Week']), oppRank: Number(g['Opponent Score Rank on Week']),
            n: w ? Math.max(w.rows, w.maxRank) : 0
        };
    });
}

// Schedule luck index: actual wins / wins expected from each week's score rank
// (all-play), x 100. Wins across the league equal expected wins, so 100 is the
// league average; above 100 the schedule helped, below it hurt.
function luckOf(games) {
    let w = 0, e = 0;
    games.forEach(g => {
        if (!g.regular || !(g.rank >= 1) || !(g.n > 1)) return;
        w += g.us > g.them ? 1 : g.us === g.them ? 0.5 : 0;
        e += (g.n - g.rank) / (g.n - 1);
    });
    return { w, e, idx: e > 0 ? 100 * w / e : null };
}
const luckClass = idx => (idx == null ? '' : idx >= 100 ? 'hp-pos' : 'hp-neg');

// FP+ and roster efficiency over a manager's regular-season games (see roster-metrics.js).
function lineupOf(games, weekMetrics) {
    return RosterMetrics.pool(games.filter(g => g.regular).map(g => weekMetrics.get(`${g.owner}|${g.season}|${g.week}`)));
}

// Count, mean, standard deviation, median, high and low of a list of scores.
function describeScores(scores) {
    const n = scores.length;
    const mean = scores.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
    const sorted = [...scores].sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    return { n, mean, sd, median, high: sorted[n - 1], low: sorted[0] };
}
