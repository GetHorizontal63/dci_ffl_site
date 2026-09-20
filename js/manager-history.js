// Manager History: one manager's career totals, season-by-season log, and
// head-to-head record against every other manager.
let seasonRows = [];
let accolades = [];
let allGames = [];
let currentSeason = null;

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('hp-content');
    try {
        const [teamRows, scoreRows, accoladeRows] = await Promise.all([
            LeagueDb.seasonTeamRows(), LeagueDb.scoreRows(),
            LeagueDb.query(`SELECT a.season, a.award, o.display_name AS owner
                            FROM accolades a JOIN owners o ON o.owner_id = a.owner_id`)
        ]);
        seasonRows = teamRows;
        accolades = accoladeRows;
        currentSeason = Math.max(...seasonRows.map(r => r.season));
        const played = scoreRows
            .filter(g => g.Team && g.Opponent && g.Team.toLowerCase() !== 'bye' && g.Opponent.toLowerCase() !== 'bye');
        // Teams ranked each regular-season week (one row per team, never fewer
        // than the worst rank recorded).
        const weekSize = {};
        played.filter(g => g['Season Period'] === 'Regular').forEach(g => {
            const w = weekSize[`${g.Season}-${g.Week}`] || (weekSize[`${g.Season}-${g.Week}`] = { rows: 0, maxRank: 0 });
            w.rows += 1;
            w.maxRank = Math.max(w.maxRank, Number(g['Score Rank on Week']) || 0);
        });
        allGames = played.map(g => {
            const w = weekSize[`${g.Season}-${g.Week}`];
            return {
                owner: g.Team, opponent: g.Opponent, us: Number(g['Team Score']), them: Number(g['Opponent Score']),
                season: g.Season,
                regular: g['Season Period'] === 'Regular',
                rank: Number(g['Score Rank on Week']), oppRank: Number(g['Opponent Score Rank on Week']),
                n: w ? Math.max(w.rows, w.maxRank) : 0
            };
        });

        const counts = new Map();
        seasonRows.forEach(r => counts.set(r.owner, (counts.get(r.owner) || 0) + 1));
        const managers = [...counts.keys()].sort((a, b) => a.localeCompare(b));

        const requested = new URLSearchParams(window.location.search).get('manager');
        const mostSeasons = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        const initial = managers.includes(requested) ? requested : mostSeasons;

        const select = document.getElementById('manager-select');
        select.innerHTML = managers.map(m => `<option value="${m}">${m}</option>`).join('');
        select.value = initial;
        select.addEventListener('change', () => render(select.value));
        render(initial);
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="hp-error">Error loading manager history.</div>';
    }
});

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

// Accolades section: a championship shield for every 1st / 2nd / 3rd place finish, then the
// other season awards this manager has won, grouped by award.
const SHIELD_FILE = { 1: 'champ', 2: '2nd', 3: '3rd' };

function accoladesPanel(manager, mine) {
    const shields = mine.filter(r => r.place != null && r.place <= 3)
        .sort((a, b) => a.place - b.place || b.season - a.season)
        .map(r => `
            <figure class="hp-shield-card">
                <img class="hp-shield" src="../assets/banners/${r.season}_${SHIELD_FILE[r.place]}.png" alt="${r.season} ${ordinal(r.place)} place">
                <figcaption><b>${r.season}</b><span>${ordinal(r.place)} place</span></figcaption>
            </figure>`).join('');

    // Every accolade by season (the season's top-3 finish included), newest first.
    const bySeason = new Map();
    accolades.filter(a => a.owner === manager).forEach(a => {
        if (!bySeason.has(a.season)) bySeason.set(a.season, []);
        bySeason.get(a.season).push(a.award);
    });
    const order = award => (/Place$/.test(award) ? 0 : 1);
    const seasonRows = [...bySeason.entries()].sort((a, b) => b[0] - a[0]).map(([season, awards]) => `
        <div class="hp-acc-season">
            <b>${season}</b>
            <div class="hp-acc-chips">${awards.sort((x, y) => order(x) - order(y) || x.localeCompare(y))
                .map(a => `<span class="hp-badge ${/^1st Place$/.test(a) ? 'hp-green' : 'hp-gold'}">${a}</span>`).join('')}</div>
        </div>`).join('');

    return `
        <div class="hp-accolades">
            <div class="hp-panel">
                <h2 class="hp-panel-title">Championship Shields<small>top-3 finishes</small></h2>
                ${shields ? `<div class="hp-shields">${shields}</div>` : '<div class="hp-empty">No top-3 finishes yet.</div>'}
            </div>
            <div class="hp-panel">
                <h2 class="hp-panel-title">Season Awards<small>every accolade, by season</small></h2>
                ${seasonRows || '<div class="hp-empty">No accolades yet.</div>'}
            </div>
        </div>`;
}

function tile(label, big, sub) {
    return `<div class="hp-tile"><span class="hp-label">${label}</span><span class="hp-big">${big}</span>${sub ? `<span class="hp-sub">${sub}</span>` : ''}</div>`;
}

function render(manager) {
    const mine = seasonRows.filter(r => r.owner === manager).sort((a, b) => b.season - a.season);
    const done = mine.filter(r => r.place != null);   // completed seasons only for career totals

    const totals = done.reduce((t, r) => ({
        w: t.w + r.wins, l: t.l + r.losses, t: t.t + r.ties, pf: t.pf + r.pointsFor, pa: t.pa + r.pointsAgainst
    }), { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
    const games = totals.w + totals.l + totals.t;

    const titles = done.filter(r => r.place === 1).length;
    const seconds = done.filter(r => r.place === 2).length;
    const top3 = done.filter(r => r.place <= 3).length;
    const champBracket = done.filter(r => r.bracketType === 'championship').length;
    const bestPlace = done.length ? Math.min(...done.map(r => r.place)) : null;
    const bestSeasons = done.filter(r => r.place === bestPlace).map(r => r.season);
    const avgFinish = done.length ? done.reduce((s, r) => s + r.place, 0) / done.length : null;
    const inProgress = mine.some(r => r.place == null && r.season === currentSeason);

    const doneSeasons = new Set(done.map(r => r.season));
    const career = luckOf(allGames.filter(g => g.owner === manager && doneSeasons.has(g.season)));

    const tiles = `
        <div class="hp-tiles">
            ${tile('Seasons', done.length, inProgress ? `+ ${currentSeason} in progress` : '')}
            ${tile('Record', record(totals.w, totals.l, totals.t), `${fmtPct(pctOf(totals.w, totals.l, totals.t))} PCT`)}
            ${tile('Titles', titles, `${seconds} runner-up${seconds === 1 ? '' : 's'}`)}
            ${tile('Top 3 finishes', top3, '')}
            ${tile('Championship bracket', champBracket, `of ${done.length} season${done.length === 1 ? '' : 's'}`)}
            ${tile('Best finish', bestPlace ? ordinal(bestPlace) : '-', bestSeasons.join(', '))}
            ${tile('Avg finish', avgFinish ? avgFinish.toFixed(1) : '-', '')}
            ${tile('Points / game', games ? (totals.pf / games).toFixed(1) : '-', games ? `${(totals.pa / games).toFixed(1)} against` : '')}
            ${tile('Point differential', fmtPd(totals.pf - totals.pa), 'career')}
            ${tile('Schedule luck index', career.idx == null ? '-' : career.idx.toFixed(0), career.idx == null ? '' : `100 = average &middot; ${career.w - career.e >= 0 ? '+' : ''}${(career.w - career.e).toFixed(1)} wins vs all-play`)}
        </div>`;

    const seasonBody = mine.map(r => {
        const pd = r.pointsFor - r.pointsAgainst;
        const lk = r.place == null ? { idx: null } : luckOf(allGames.filter(g => g.owner === manager && g.season === r.season));   // one game says nothing
        const finish = r.place != null ? ordinal(r.place) : (r.season === currentSeason ? 'In progress' : '-');
        const post = r.bracketType === 'championship'
            ? '<span class="hp-badge hp-green">Championship</span>'
            : r.bracketType === 'elimination' ? '<span class="hp-badge">Gulag</span>' : '-';
        return `
            <tr class="${r.place === 1 ? 'hp-champ' : ''}">
                <td class="hp-name">${r.season}</td>
                <td class="hp-left">${r.divisionName}</td>
                <td>${record(r.wins, r.losses, r.ties)}</td>
                <td>${fmtPct(pctOf(r.wins, r.losses, r.ties))}</td>
                <td class="${luckClass(lk.idx)}" title="${lk.idx == null ? '' : `${lk.w - lk.e >= 0 ? '+' : ''}${(lk.w - lk.e).toFixed(1)} wins vs all-play`}">${lk.idx == null ? '-' : lk.idx.toFixed(0)}</td>
                <td class="${pd >= 0 ? 'hp-pos' : 'hp-neg'}">${fmtPd(pd)}</td>
                <td>${fmt2(r.pointsFor)}</td>
                <td>${fmt2(r.pointsAgainst)}</td>
                <td>${finish}</td>
                <td>${post}</td>
            </tr>`;
    }).join('');

    // Head to head: every game (regular season and playoffs) against each opponent.
    const h2h = new Map();
    allGames.filter(g => g.owner === manager).forEach(g => {
        const o = h2h.get(g.opponent) || { opponent: g.opponent, w: 0, l: 0, t: 0, pd: 0 };
        if (g.us > g.them) o.w += 1; else if (g.us < g.them) o.l += 1; else o.t += 1;
        o.pd += g.us - g.them;
        h2h.set(g.opponent, o);
    });
    const h2hBody = [...h2h.values()]
        .sort((a, b) => (b.w + b.l + b.t) - (a.w + a.l + a.t) || pctOf(b.w, b.l, b.t) - pctOf(a.w, a.l, a.t))
        .map(o => `
            <tr>
                <td class="hp-left hp-name">${o.opponent}</td>
                <td>${o.w + o.l + o.t}</td>
                <td>${record(o.w, o.l, o.t)}</td>
                <td class="${pctOf(o.w, o.l, o.t) >= 0.5 ? 'hp-pos' : 'hp-neg'}">${fmtPct(pctOf(o.w, o.l, o.t))}</td>
                <td class="${o.pd >= 0 ? 'hp-pos' : 'hp-neg'}">${fmtPd(o.pd)}</td>
            </tr>`).join('');

    // Spot matrix: rows = this manager's score rank that week (1 = highest in
    // the league), columns = the opponent's; each cell counts the regular-season
    // games with that pairing.
    const SPOTS = Array.from({ length: 16 }, (_, k) => k + 1);
    const cells = SPOTS.map(() => SPOTS.map(() => ({ n: 0, w: 0, l: 0, t: 0 })));
    allGames.filter(g => g.owner === manager && g.regular && g.rank >= 1 && g.oppRank >= 1).forEach(g => {
        const c = cells[Math.min(16, g.rank) - 1][Math.min(16, g.oppRank) - 1];
        c.n += 1;
        if (g.us > g.them) c.w += 1; else if (g.us < g.them) c.l += 1; else c.t += 1;
    });
    const maxCell = Math.max(1, ...cells.flat().map(c => c.n));
    const matrixBody = cells.map((row, i) => {
        const total = row.reduce((s, c) => s + c.n, 0);
        return `
            <tr>
                <td class="hp-name hp-spot">${i + 1}</td>
                ${row.map((c, j) => `<td class="hp-mcell" style="background:rgba(218,165,32,${c.n ? (0.12 + 0.7 * c.n / maxCell).toFixed(2) : 0})" title="${manager} ranked ${i + 1}, opponent ranked ${j + 1}: ${c.n} game${c.n === 1 ? '' : 's'} (${record(c.w, c.l, c.t)})">${c.n || ''}</td>`).join('')}
                <td class="hp-dim">${total || ''}</td>
            </tr>`;
    }).join('');

    // The career-totals panel is pinned with the page header; everything else scrolls.
    document.getElementById('hp-summary').innerHTML = `
        <div class="hp-panel">
            <h2 class="hp-panel-title">${manager}<small>career totals, completed seasons</small></h2>
            ${tiles}
        </div>`;
    document.getElementById('hp-content').innerHTML = `
        ${accoladesPanel(manager, mine)}
        <div class="hp-panel">
            <h2 class="hp-panel-title">Season by Season<small>regular season records</small></h2>
            <div class="hp-scroll">
                <table class="hp-table">
                    <thead><tr>
                        <th>Season</th><th class="hp-left">Division</th><th>W-L</th><th>PCT</th><th title="Schedule luck index: 100 = league average">Luck</th>
                        <th>PD</th><th>PF</th><th>PA</th><th>Finish</th><th>Postseason</th>
                    </tr></thead>
                    <tbody>${seasonBody}</tbody>
                </table>
            </div>
            <p class="hp-note">Luck is the schedule luck index: actual wins divided by the wins the weekly score ranks predict (all-play), times 100. 100 is the league average; above 100 the schedule helped, below it hurt.</p>
        </div>
        <div class="hp-grid hp-two hp-eq">
        <div class="hp-panel hp-h2h">
            <h2 class="hp-panel-title">Head to Head<small>all games, regular season and playoffs</small></h2>
            <div class="hp-scroll hp-h2h-scroll">
                <table class="hp-table">
                    <thead><tr><th class="hp-left">Opponent</th><th>GP</th><th>W-L</th><th>PCT</th><th>PD</th></tr></thead>
                    <tbody>${h2hBody}</tbody>
                </table>
            </div>
            <p class="hp-note">Championship-bracket seasons are computed from regular-season standings using the league tiebreak (record, head-to-head, point differential, points for).</p>
        </div>
        <div class="hp-panel">
            <h2 class="hp-panel-title">Weekly Rank Matrix<small>regular season &middot; games at each pairing of score ranks</small></h2>
            <div class="hp-scroll">
                <table class="hp-table hp-matrix">
                    <colgroup><col class="hp-col-name">${SPOTS.map(() => '<col>').join('')}<col class="hp-col-total"></colgroup>
                    <thead>
                        <tr><th class="hp-corner" rowspan="2" title="${manager}'s score rank that week">Rank &darr;</th><th colspan="16">Opponent's score rank that week &rarr;</th><th rowspan="2">Total</th></tr>
                        <tr>${SPOTS.map(k => `<th class="hp-mhead">${k}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${matrixBody}</tbody>
                </table>
            </div>
            <p class="hp-note">Each week every team is ranked by points scored (1 = highest in the league). A cell counts the weeks ${manager} ranked in that row while their opponent ranked in that column; hover a cell for ${manager}'s W-L in those games.</p>
        </div>
        </div>`;
}
