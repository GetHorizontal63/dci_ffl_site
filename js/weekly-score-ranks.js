// Weekly Score Ranks: where each manager's score landed against the whole
// league every week (1 = highest score), plus the all-play / luck view that
// falls out of it.
let teamWeeks = [];

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('hp-content');
    try {
        const rows = await LeagueDb.scoreRows();
        const regular = rows.filter(g =>
            g['Season Period'] === 'Regular' && g.Team && g.Opponent &&
            g.Team.toLowerCase() !== 'bye' && g.Opponent.toLowerCase() !== 'bye');

        // Teams ranked that week: usually one row per team, but never fewer
        // than the worst rank actually recorded.
        const perWeek = {};
        regular.forEach(g => {
            const key = `${g.Season}-${g.Week}`;
            const w = perWeek[key] || (perWeek[key] = { rows: 0, maxRank: 0 });
            w.rows += 1;
            w.maxRank = Math.max(w.maxRank, Number(g['Score Rank on Week']) || 0);
        });

        teamWeeks = regular
            .map(g => {
                const w = perWeek[`${g.Season}-${g.Week}`];
                const us = Number(g['Team Score']), them = Number(g['Opponent Score']);
                return {
                    season: g.Season,
                    owner: g.Team,
                    rank: Number(g['Score Rank on Week']),
                    n: Math.max(w.rows, w.maxRank),
                    win: us > them ? 1 : us === them ? 0.5 : 0
                };
            })
            .filter(t => t.rank >= 1 && t.n > 1);

        const seasons = [...new Set(teamWeeks.map(t => t.season))].sort((a, b) => b - a);
        const select = document.getElementById('season-select');
        select.innerHTML = '<option value="ALL">All Seasons</option>' + seasons.map(s => `<option value="${s}">${s}</option>`).join('');
        select.addEventListener('change', () => render(select.value));
        render('ALL');
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="hp-error">Error loading weekly scores.</div>';
    }
});

// Score-rank quads: 1-4, 5-8, 9-12, 13-16 (a 15-team week's 13-15 is the last quad).
const QUAD_LABELS = ['1-4', '5-8', '9-12', '13-16'];
const quadOf = rank => Math.min(3, Math.floor((rank - 1) / 4));

function render(selection) {
    const list = selection === 'ALL' ? teamWeeks : teamWeeks.filter(t => String(t.season) === selection);

    const byOwner = new Map();
    list.forEach(t => {
        if (!byOwner.has(t.owner)) {
            byOwner.set(t.owner, { owner: t.owner, games: 0, rankSum: 0, top1: 0, top3: 0, bottom3: 0, last: 0, expected: 0, wins: 0, dist: {}, quads: [0, 1, 2, 3].map(() => ({ g: 0, w: 0 })) });
        }
        const o = byOwner.get(t.owner);
        o.games += 1;
        o.rankSum += t.rank;
        if (t.rank === 1) o.top1 += 1;
        if (t.rank <= 3) o.top3 += 1;
        if (t.rank > t.n - 3) o.bottom3 += 1;
        if (t.rank === t.n) o.last += 1;
        o.expected += (t.n - t.rank) / (t.n - 1);   // share of the league beaten this week
        o.wins += t.win;
        o.dist[t.rank] = (o.dist[t.rank] || 0) + 1;
        const q = o.quads[quadOf(t.rank)];
        q.g += 1;
        q.w += t.win;
    });

    const managers = [...byOwner.values()]
        .map(o => ({ ...o, avgRank: o.rankSum / o.games, allPlay: o.expected / o.games, winPct: o.wins / o.games, luck: o.wins - o.expected }));

    // A handful of games says little (a manager with one game can top the
    // table), so only managers with a full season's worth of games are ranked;
    // everyone else is listed after them, unranked. With a single short season
    // selected the bar drops to the most games anyone has played.
    const MIN_GAMES = Math.min(14, Math.max(...managers.map(m => m.games)));
    managers.sort((a, b) => ((b.games >= MIN_GAMES) - (a.games >= MIN_GAMES)) || (b.allPlay - a.allPlay));

    if (!managers.length) {
        document.getElementById('hp-content').innerHTML = '<div class="hp-empty">No games for this selection.</div>';
        return;
    }

    const pct = x => x.toFixed(3).replace(/^0(?=\.)/, '');   // .571, 1.000
    let rank = 0;
    const rows = managers.map(m => `
        <tr${m.games < MIN_GAMES ? ' style="opacity:0.55"' : ''}>
            <td class="hp-dim">${m.games >= MIN_GAMES ? ++rank : '-'}</td>
            <td class="hp-left hp-name">${m.owner}</td>
            <td>${m.games}</td>
            <td>${m.avgRank.toFixed(1)}</td>
            <td>${m.top1}</td>
            <td>${m.top3}</td>
            <td>${m.bottom3}</td>
            <td>${m.last}</td>
            <td>${pct(m.allPlay)}</td>
            <td>${pct(m.winPct)}</td>
            <td class="${m.luck >= 0 ? 'hp-pos' : 'hp-neg'}">${m.luck >= 0 ? '+' : ''}${m.luck.toFixed(1)}</td>
            ${m.quads.map((q, k) => q.g
                ? `<td class="${q.w / q.g >= 0.5 ? 'hp-pos' : 'hp-neg'}" title="${q.w} win${q.w === 1 ? '' : 's'} in ${q.g} week${q.g === 1 ? '' : 's'} ranked ${QUAD_LABELS[k]}">${pct(q.w / q.g)}</td>`
                : '<td class="hp-dim">-</td>').join('')}
        </tr>`).join('');

    const maxRank = Math.max(...list.map(t => t.n));
    const ranks = Array.from({ length: maxRank }, (_, i) => i + 1);
    // Shade scale comes from managers with a real sample, so a one-game
    // manager (100% in a single cell) doesn't wash out everyone else.
    const maxShare = Math.max(...managers.filter(m => m.games >= MIN_GAMES).flatMap(m => ranks.map(r => (m.dist[r] || 0) / m.games)));
    const heatRows = managers.map(m => `
        <tr>
            <td class="hp-left hp-name">${m.owner}</td>
            ${ranks.map(r => {
                const c = m.dist[r] || 0;
                const share = c / m.games;
                const alpha = c ? Math.min(0.85, 0.1 + 0.75 * (share / maxShare)).toFixed(2) : 0;
                return `<td class="hp-cell" style="background:rgba(218,165,32,${alpha})" title="${m.owner}: ${c} week${c === 1 ? '' : 's'} ranked ${r}">${c || ''}</td>`;
            }).join('')}
        </tr>`).join('');

    // Luck index: actual wins / all-play expected wins x 100 (league average = 100).
    const luckList = managers.filter(m => m.games >= MIN_GAMES && m.expected > 0)
        .map(m => ({ owner: m.owner, idx: 100 * m.wins / m.expected, diff: m.wins - m.expected }))
        .sort((a, b) => b.idx - a.idx);
    const span = Math.max(5, ...luckList.map(l => Math.abs(l.idx - 100)));
    const luckBars = luckList.map(l => {
        const w = (Math.abs(l.idx - 100) / span * 50).toFixed(1);
        const pos = l.idx >= 100;
        return `
            <div class="hp-bar-row" title="${l.owner}: ${l.diff >= 0 ? '+' : ''}${l.diff.toFixed(1)} wins vs all-play">
                <span class="hp-bar-name">${l.owner}</span>
                <span class="hp-bar-track">
                    <span class="hp-bar ${pos ? 'hp-bar-pos' : 'hp-bar-neg'}" style="${pos ? 'left:50%' : `right:50%`};width:${w}%"></span>
                </span>
                <span class="hp-bar-val ${pos ? 'hp-pos' : 'hp-neg'}">${l.idx.toFixed(0)}</span>
            </div>`;
    }).join('');

    document.getElementById('hp-content').innerHTML = `
        <div class="hp-panel">
            <h2 class="hp-panel-title">Weekly Scoring Position<small>by All-Play PCT &middot; PCT 1-4 etc. = win PCT by score-rank quad</small></h2>
            <div class="hp-scroll">
                <table class="hp-table">
                    <thead><tr>
                        <th>#</th><th class="hp-left">Manager</th><th>GP</th><th>Avg Rank</th>
                        <th>Top Score</th><th>Top 3</th><th>Bottom 3</th><th>Last</th>
                        <th>All-Play PCT</th><th>PCT</th><th>Luck</th>
                        ${QUAD_LABELS.map((l, k) => `<th title="Win PCT in weeks the score ranked ${l}">PCT ${l}</th>`).join('')}
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="hp-note">All-Play PCT is the share of the league a team would have beaten each week. Luck is actual wins minus the wins All-Play PCT predicts (positive = the schedule helped). Top 3 / Bottom 3 count weeks in the league's three highest / lowest scores.</p>
        </div>
        <div class="hp-grid hp-two hp-eq">
        <div class="hp-panel">
            <h2 class="hp-panel-title">Score Rank Distribution<small>weeks at each rank &middot; 1 = highest score</small></h2>
            <div class="hp-scroll">
                <table class="hp-table hp-heat">
                    <colgroup><col class="hp-col-name">${ranks.map(() => '<col>').join('')}</colgroup>
                    <thead><tr>
                        <th class="hp-left">Manager</th>
                        ${ranks.map(r => `<th class="hp-rankhead">${r}</th>`).join('')}
                    </tr></thead>
                    <tbody>${heatRows}</tbody>
                </table>
            </div>
            <p class="hp-note">Regular season only. Managers with fewer than ${MIN_GAMES} games are listed unranked.</p>
        </div>
        <div class="hp-panel hp-luck">
            <h2 class="hp-panel-title">Schedule Luck Index<small>100 = league average &middot; above = the schedule helped</small></h2>
            <div class="hp-bars">${luckBars}</div>
            <p class="hp-note">Actual wins &divide; the wins each week's score rank predicts (all-play), &times; 100. Only managers with at least ${MIN_GAMES} games are shown.</p>
        </div>
        </div>`;
}
