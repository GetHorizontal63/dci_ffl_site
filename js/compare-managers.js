// Compare Managers: up to three managers side by side. The best value in each row is highlighted.
let seasonRows = [];
let allGames = [];
let moves = [];
const weekMetrics = new Map();   // "owner|season|week" -> { actual, projected, optimal }
const GRADE_POINTS = { A: 4, B: 3, C: 2, D: 1, F: 0 };

const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('hp-content');
    try {
        const [teamRows, scoreRows, moveRows, metrics] = await Promise.all([
            LeagueDb.seasonTeamRows(), LeagueDb.scoreRows(),
            LeagueDb.query(`SELECT m.kind, m.grade, o.display_name AS owner
                            FROM transaction_moves m JOIN owners o ON o.owner_id = m.owner_id
                            WHERE m.provisional = 0`),
            RosterMetrics.load()
        ]);
        seasonRows = teamRows;
        moves = moveRows;
        allGames = prepareGames(scoreRows);
        metrics.forEach((m, key) => weekMetrics.set(key, m));

        const managers = [...new Set(seasonRows.map(r => r.owner))].sort((a, b) => a.localeCompare(b));
        const seasonCount = new Map();
        seasonRows.forEach(r => seasonCount.set(r.owner, (seasonCount.get(r.owner) || 0) + 1));

        const picks = new URLSearchParams(window.location.search).getAll('m').filter(m => managers.includes(m));
        const selects = [1, 2, 3].map(i => document.getElementById(`cmp-${i}`));
        const options = managers.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
        selects[0].innerHTML = options;
        selects[1].innerHTML = `<option value="">None</option>${options}`;
        selects[2].innerHTML = `<option value="">None</option>${options}`;
        const first = picks[0] || [...seasonCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        selects[0].value = first;
        selects[1].value = picks[1] || '';
        selects[2].value = picks[2] || '';

        const update = () => {
            const chosen = selects.map(s => s.value).filter((m, i, list) => m && list.indexOf(m) === i);
            const query = new URLSearchParams();
            chosen.forEach(m => query.append('m', m));
            history.replaceState(null, '', `${location.pathname}?${query}`);
            render(chosen);
        };
        selects.forEach(s => s.addEventListener('change', update));
        update();
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="hp-error">Error loading managers.</div>';
    }
});

function statsFor(name) {
    const mine = seasonRows.filter(r => r.owner === name);
    const done = mine.filter(r => r.place != null);
    const t = done.reduce((a, r) => ({ w: a.w + r.wins, l: a.l + r.losses, t: a.t + r.ties, pf: a.pf + r.pointsFor, pa: a.pa + r.pointsAgainst }),
        { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
    const games = t.w + t.l + t.t;
    const doneSeasons = new Set(done.map(r => r.season));
    const played = allGames.filter(g => g.owner === name);
    const doneGames = played.filter(g => doneSeasons.has(g.season));
    const regular = played.filter(g => g.regular && g.rank >= 1 && g.n > 1);
    const scores = played.filter(g => g.us > 0).map(g => g.us);

    const gpa = kind => {
        const graded = moves.filter(m => m.owner === name && m.kind === kind && m.grade);
        return graded.length ? graded.reduce((s, m) => s + GRADE_POINTS[m.grade], 0) / graded.length : null;
    };
    const count = kind => moves.filter(m => m.owner === name && m.kind === kind).length;
    const rate = n => (scores.length ? n / scores.length : null);

    return {
        name, seasons: done.length, inProgress: mine.length - done.length, games, t,
        titles: done.filter(r => r.place === 1).length,
        seconds: done.filter(r => r.place === 2).length,
        top3: done.filter(r => r.place <= 3).length,
        champBracket: done.filter(r => r.bracketType === 'championship').length,
        best: done.length ? Math.min(...done.map(r => r.place)) : null,
        avg: done.length ? done.reduce((s, r) => s + r.place, 0) / done.length : null,
        luck: luckOf(doneGames).idx,
        lineup: lineupOf(doneGames, weekMetrics),
        desc: scores.length ? describeScores(scores) : null,
        n150: rate(scores.filter(x => x >= 150).length), c150: scores.filter(x => x >= 150).length,
        n200: rate(scores.filter(x => x >= 200).length), c200: scores.filter(x => x >= 200).length,
        topWeeks: regular.filter(g => g.rank === 1).length, lowWeeks: regular.filter(g => g.rank === g.n).length, weeks: regular.length,
        pickups: count('PICKUP'), trades: count('TRADE'), drops: count('DROP'),
        pickupGpa: gpa('PICKUP'), tradeGpa: gpa('TRADE'), dropGpa: gpa('DROP'),
        played
    };
}

const dash = '-';
const perGame = (v, s) => (s.games ? v / s.games : null);
const num = (v, d = 1) => (v == null ? dash : v.toFixed(d));
const share = (count, rateValue) => (rateValue == null ? dash : `${count} (${(100 * rateValue).toFixed(1)}%)`);

// better: 'high' or 'low' picks the highlighted value; null means the row is only for reading.
const SECTIONS = [
    { title: 'Career', note: 'completed seasons', rows: [
        { label: 'Seasons', raw: s => s.seasons, text: s => String(s.seasons), better: 'high' },
        { label: 'Record', raw: s => (s.games ? pctOf(s.t.w, s.t.l, s.t.t) : null), text: s => (s.games ? record(s.t.w, s.t.l, s.t.t) : dash), better: 'high' },
        { label: 'Win %', raw: s => (s.games ? pctOf(s.t.w, s.t.l, s.t.t) : null), text: s => (s.games ? fmtPct(pctOf(s.t.w, s.t.l, s.t.t)) : dash), better: 'high' },
        { label: 'Titles', raw: s => s.titles, text: s => String(s.titles), better: 'high' },
        { label: 'Runner-ups', raw: s => s.seconds, text: s => String(s.seconds), better: 'high' },
        { label: 'Top 3 finishes', raw: s => s.top3, text: s => String(s.top3), better: 'high' },
        { label: 'Championship bracket', raw: s => s.champBracket, text: s => String(s.champBracket), better: 'high' },
        { label: 'Best finish', raw: s => s.best, text: s => (s.best ? ordinal(s.best) : dash), better: 'low' },
        { label: 'Avg finish', raw: s => s.avg, text: s => num(s.avg), better: 'low' },
        { label: 'Points / game', raw: s => perGame(s.t.pf, s), text: s => num(perGame(s.t.pf, s)), better: 'high' },
        { label: 'Points against / game', raw: s => perGame(s.t.pa, s), text: s => num(perGame(s.t.pa, s)), better: 'low' },
        { label: 'Point differential', raw: s => (s.games ? s.t.pf - s.t.pa : null), text: s => (s.games ? fmtPd(s.t.pf - s.t.pa) : dash), better: 'high' },
        { label: 'Schedule luck index', raw: s => s.luck, text: s => (s.luck == null ? dash : s.luck.toFixed(0)), better: 'high' }
    ] },
    { title: 'Lineup', note: 'regular season, completed seasons', rows: [
        { label: 'FP+', raw: s => s.lineup.fp, text: s => fmtIdx(s.lineup.fp), better: 'high' },
        { label: 'Roster efficiency', raw: s => s.lineup.eff, text: s => (s.lineup.eff == null ? dash : `${s.lineup.eff.toFixed(1)}%`), better: 'high' },
        { label: 'Points left on bench', raw: s => (s.lineup.weeks ? s.lineup.left : null), text: s => (s.lineup.weeks ? Math.round(s.lineup.left).toLocaleString() : dash), better: null }
    ] },
    { title: 'Scoring', note: 'every game, regular season and playoffs', rows: [
        { label: 'Average score', raw: s => s.desc && s.desc.mean, text: s => num(s.desc && s.desc.mean), better: 'high' },
        { label: 'Median score', raw: s => s.desc && s.desc.median, text: s => num(s.desc && s.desc.median), better: 'high' },
        { label: 'Highest score', raw: s => s.desc && s.desc.high, text: s => num(s.desc && s.desc.high, 2), better: 'high' },
        { label: 'Lowest score', raw: s => s.desc && s.desc.low, text: s => num(s.desc && s.desc.low, 2), better: 'high' },
        { label: 'Consistency (std dev)', raw: s => s.desc && s.desc.sd, text: s => num(s.desc && s.desc.sd), better: 'low' },
        { label: '150+ point games', raw: s => s.n150, text: s => share(s.c150, s.n150), better: 'high' },
        { label: '200+ point games', raw: s => s.n200, text: s => share(s.c200, s.n200), better: 'high' },
        { label: 'Weekly high scores', raw: s => (s.weeks ? s.topWeeks / s.weeks : null), text: s => (s.weeks ? share(s.topWeeks, s.topWeeks / s.weeks) : dash), better: 'high' },
        { label: 'Weekly low scores', raw: s => (s.weeks ? s.lowWeeks / s.weeks : null), text: s => (s.weeks ? share(s.lowWeeks, s.lowWeeks / s.weeks) : dash), better: 'low' }
    ] },
    { title: 'Transactions', note: 'completed seasons; GPA out of 4.0', rows: [
        { label: 'Waiver pickups', raw: s => s.pickups, text: s => String(s.pickups), better: null },
        { label: 'Pickup GPA', raw: s => s.pickupGpa, text: s => num(s.pickupGpa, 2), better: 'high' },
        { label: 'Trades', raw: s => s.trades, text: s => String(s.trades), better: null },
        { label: 'Trade GPA', raw: s => s.tradeGpa, text: s => num(s.tradeGpa, 2), better: 'high' },
        { label: 'Drops', raw: s => s.drops, text: s => String(s.drops), better: null },
        { label: 'Drop GPA', raw: s => s.dropGpa, text: s => num(s.dropGpa, 2), better: 'high' }
    ] }
];

function render(names) {
    const content = document.getElementById('hp-content');
    if (!names.length) { content.innerHTML = '<div class="hp-panel"><div class="hp-empty">Pick a manager to start.</div></div>'; return; }
    const stats = names.map(statsFor);

    const bestOf = (row) => {
        if (!row.better || stats.length < 2) return new Set();
        const values = stats.map(row.raw);
        const usable = values.filter(v => v != null && !Number.isNaN(v));
        if (usable.length < 2) return new Set();
        const target = row.better === 'high' ? Math.max(...usable) : Math.min(...usable);
        const winners = new Set();
        values.forEach((v, i) => { if (v != null && Math.abs(v - target) < 1e-9) winners.add(i); });
        const shown = [...winners].map(i => row.text(stats[i]));
        stats.forEach((s, i) => { if (values[i] != null && shown.includes(row.text(s))) winners.add(i); });   // equal as displayed = tied
        return winners.size === stats.length ? new Set() : winners;   // everyone tied: nothing to highlight
    };

    const head = `<tr><th class="hp-left"></th>${stats.map(s => `
        <th class="hp-cmp-head"><a href="manager-history.html?manager=${encodeURIComponent(s.name)}">${esc(s.name)}</a>
            <small>${s.seasons} season${s.seasons === 1 ? '' : 's'}</small></th>`).join('')}</tr>`;

    const body = SECTIONS.map(section => `
        <tr class="hp-cmp-section"><th class="hp-left" colspan="${stats.length + 1}">${section.title}<small>${section.note}</small></th></tr>
        ${section.rows.map(row => {
            const best = bestOf(row);
            return `<tr><td class="hp-left hp-name">${row.label}</td>${stats.map((s, i) => `<td class="${best.has(i) ? 'hp-best' : ''}">${row.text(s)}</td>`).join('')}</tr>`;
        }).join('')}`).join('');

    let h2h = '';
    if (stats.length > 1) {
        const versus = (s, other) => {
            if (s.name === other.name) return dash;
            const g = s.played.filter(x => x.opponent === other.name);
            if (!g.length) return 'no games';
            const w = g.filter(x => x.us > x.them).length, l = g.filter(x => x.us < x.them).length, t = g.length - w - l;
            const pd = g.reduce((sum, x) => sum + x.us - x.them, 0);
            return `${record(w, l, t)} <small>${fmtPd(pd)}</small>`;
        };
        h2h = `<tr class="hp-cmp-section"><th class="hp-left" colspan="${stats.length + 1}">Head to Head<small>all games between these managers, with point differential</small></th></tr>
            ${stats.map(other => `<tr><td class="hp-left hp-name">vs. ${esc(other.name)}</td>${stats.map(s => `<td>${versus(s, other)}</td>`).join('')}</tr>`).join('')}`;
    }

    content.innerHTML = `
        <div class="hp-panel">
            <h2 class="hp-panel-title">${stats.map(s => esc(s.name)).join(' vs. ')}<small>the best value in each row is highlighted</small></h2>
            <div class="hp-scroll">
                <table class="hp-table hp-compare hp-cols-${stats.length}">
                    <thead>${head}</thead>
                    <tbody>${body}${h2h}</tbody>
                </table>
            </div>
            <p class="hp-note">Career, lineup and transaction rows cover completed seasons; scoring rows cover every game played. FP+ is starters' points divided by their projected points (100 = on projection). Efficiency is starters' points divided by the best lineup the roster allowed. Consistency is the standard deviation of game scores, so lower is steadier. Rows that are only a volume (pickups, trades, drops, points left on the bench) are not highlighted.</p>
        </div>`;
}
