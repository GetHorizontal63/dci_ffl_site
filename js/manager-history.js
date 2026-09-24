// Manager History: one manager's career totals, season-by-season log, and
// head-to-head record against every other manager.
let seasonRows = [];
let accolades = [];
let allGames = [];
let currentSeason = null;
const weekMetrics = new Map();   // "owner|season|week" -> { actual, projected, optimal }

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('hp-content');
    try {
        const [teamRows, scoreRows, accoladeRows, metrics] = await Promise.all([
            LeagueDb.seasonTeamRows(), LeagueDb.scoreRows(),
            LeagueDb.query(`SELECT a.season, a.award, o.display_name AS owner
                            FROM accolades a JOIN owners o ON o.owner_id = a.owner_id`),
            RosterMetrics.load()
        ]);
        seasonRows = teamRows;
        accolades = accoladeRows;
        metrics.forEach((m, key) => weekMetrics.set(key, m));
        currentSeason = Math.max(...seasonRows.map(r => r.season));
        allGames = prepareGames(scoreRows);

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
        window.matchMedia('(max-width: 700px)').addEventListener('change', () => render(select.value));
        render(initial);
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="hp-error">Error loading manager history.</div>';
    }
});

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
    return `<div class="hp-tile"><span class="hp-label">${label}</span><span class="hp-big">${big}</span><span class="hp-sub">${sub || '&nbsp;'}</span></div>`;
}

// Every tile gets the same label / value / footnote rows, sized to the tallest of each across the
// whole grid, so the text sits in the same spot and size in every box.
function equalizeTiles() {
    const grid = document.querySelector('.hp-tiles');
    if (!grid) return;
    grid.style.removeProperty('--tile-label-h');
    grid.style.removeProperty('--tile-sub-h');
    const tallest = sel => Math.max(0, ...[...grid.querySelectorAll(sel)].map(el => el.getBoundingClientRect().height));
    grid.style.setProperty('--tile-label-h', `${Math.ceil(tallest('.hp-label'))}px`);
    grid.style.setProperty('--tile-sub-h', `${Math.ceil(tallest('.hp-sub'))}px`);
}
window.addEventListener('resize', () => { clearTimeout(equalizeTiles.timer); equalizeTiles.timer = setTimeout(equalizeTiles, 100); });

// ---------------------------------------------------------------------------
// Score distribution: how often this manager scores in each 10-point band, next to the whole league
// and to a perfect bell curve fitted to the manager's own mean and spread. Every game counts
// (regular season and playoffs), in percent of games so the manager and the league compare.
// ---------------------------------------------------------------------------
const BIN = 10;
let distribution = null;

const normalPdf = (x, mean, sd) => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

function distributionPanel(manager) {
    const mine = allGames.filter(g => g.owner === manager && g.us > 0).map(g => g.us);
    const league = allGames.filter(g => g.us > 0).map(g => g.us);
    if (mine.length < 5) { distribution = null; return ''; }
    const mStats = describeScores(mine), lStats = describeScores(league);

    const lo = Math.floor(Math.min(...league) / BIN) * BIN;
    const hi = (Math.floor(Math.max(...league) / BIN) + 1) * BIN;
    const bins = (hi - lo) / BIN;
    const share = scores => {
        const counts = new Array(bins).fill(0);
        scores.forEach(x => { counts[Math.min(bins - 1, Math.floor((x - lo) / BIN))] += 1; });
        return counts;
    };
    const mCounts = share(mine), lCounts = share(league);
    const mPct = mCounts.map(c => 100 * c / mine.length), lPct = lCounts.map(c => 100 * c / league.length);
    const bell = x => 100 * BIN * normalPdf(x, mStats.mean, mStats.sd);
    const nPct = mPct.map((_, i) => bell(lo + (i + 0.5) * BIN));

    const peak = Math.max(...mPct, ...lPct, bell(mStats.mean));
    const step = peak <= 12 ? 2 : peak <= 30 ? 5 : 10;
    const top = Math.ceil(peak / step) * step;

    const narrow = window.matchMedia('(max-width: 700px)').matches;   // a phone gets a squarer chart with bigger text
    const W = narrow ? 400 : 760, H = narrow ? 320 : 300, L = narrow ? 40 : 44, R = 10, T = 14, B = 36;
    const pw = W - L - R, ph = H - T - B;
    const xAt = x => L + (x - lo) / (hi - lo) * pw;
    const yAt = v => T + ph - v / top * ph;
    const binPx = pw / bins, barW = Math.min(24, binPx - 4);

    const grid = [];
    for (let v = 0; v <= top; v += step) {
        grid.push(`<line class="hp-dist-grid" x1="${L}" x2="${W - R}" y1="${yAt(v)}" y2="${yAt(v)}"/>
                   <text class="hp-dist-tick" x="${L - 8}" y="${yAt(v) + 4}" text-anchor="end">${v}%</text>`);
    }
    const xTicks = [];
    for (let x = Math.ceil(lo / (narrow ? 40 : 20)) * (narrow ? 40 : 20); x <= hi; x += narrow ? 40 : 20) {
        xTicks.push(`<text class="hp-dist-tick" x="${xAt(x)}" y="${H - 18}" text-anchor="middle">${x}</text>`);
    }
    const base = yAt(0);
    const bars = mPct.map((v, i) => {
        const h = base - yAt(v);
        if (h <= 0.5) return '';
        const x = xAt(lo + i * BIN) + (binPx - barW) / 2, y = yAt(v), r = Math.min(4, h, barW / 2);
        return `<path class="hp-dist-bar" d="M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${base} Z"/>`;
    }).join('');
    const leaguePath = lPct.map((v, i) => `${i ? 'L' : 'M'}${xAt(lo + (i + 0.5) * BIN).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
    let bellPath = '';
    for (let x = lo; x <= hi; x += 1) bellPath += `${x === lo ? 'M' : 'L'}${xAt(x).toFixed(1)},${yAt(bell(x)).toFixed(1)} `;
    const hits = mPct.map((_, i) => `<rect class="hp-dist-hit" tabindex="0" data-bin="${i}" x="${xAt(lo + i * BIN)}" y="${T}" width="${binPx}" height="${ph}" role="img" aria-label="${lo + i * BIN} to ${lo + (i + 1) * BIN} points"/>`).join('');

    distribution = { lo, mPct, lPct, nPct, mCounts, lCounts, mine: mine.length, league: league.length };
    const pts = v => v.toFixed(1);
    const row = (name, key, d) => `<tr><td class="hp-left hp-name"><i class="hp-key hp-key-${key}"></i>${name}</td><td>${d.n.toLocaleString()}</td><td>${pts(d.mean)}</td><td>${pts(d.sd)}</td><td>${pts(d.median)}</td><td>${pts(d.high)}</td><td>${pts(d.low)}</td></tr>`;
    const binRows = mPct.map((_, i) => `<tr><td class="hp-left hp-name">${lo + i * BIN}-${lo + (i + 1) * BIN}</td><td>${mCounts[i]} (${mPct[i].toFixed(1)}%)</td><td>${lPct[i].toFixed(1)}%</td><td>${nPct[i].toFixed(1)}%</td></tr>`).join('');

    return `
        <div class="hp-panel hp-dist">
            <h2 class="hp-panel-title">Score Distribution<small>every game, regular season and playoffs</small></h2>
            <div class="hp-dist-legend">
                <span><i class="hp-key hp-key-mgr"></i>${manager}</span>
                <span><i class="hp-key hp-key-league"></i>League</span>
                <span><i class="hp-key hp-key-bell"></i>Bell curve (${manager}'s mean and spread)</span>
            </div>
            <div class="hp-dist-wrap">
                <svg class="hp-dist-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="Score distribution: ${manager} against the league">
                    ${grid.join('')}${xTicks.join('')}
                    <text class="hp-dist-axis" x="${L + pw / 2}" y="${H - 2}" text-anchor="middle">Points scored</text>
                    <rect class="hp-dist-band" x="0" y="${T}" width="${binPx}" height="${ph}" visibility="hidden"/>
                    ${bars}
                    <path class="hp-dist-league" d="${leaguePath}"/>
                    <path class="hp-dist-bell" d="${bellPath}"/>
                    ${hits}
                </svg>
                <div class="hp-dist-tip" hidden></div>
            </div>
            <div class="hp-scroll">
                <table class="hp-table hp-dist-table">
                    <thead><tr><th class="hp-left"></th><th>Games</th><th>Mean</th><th>SD</th><th>Median</th><th>High</th><th>Low</th></tr></thead>
                    <tbody>${row(manager, 'mgr', mStats)}${row('League', 'league', lStats)}</tbody>
                </table>
            </div>
            <details class="hp-dist-details">
                <summary>Table view</summary>
                <div class="hp-scroll">
                    <table class="hp-table hp-dist-table">
                        <thead><tr><th class="hp-left">Points</th><th>${manager}</th><th>League</th><th>Bell curve</th></tr></thead>
                        <tbody>${binRows}</tbody>
                    </table>
                </div>
            </details>
            <p class="hp-note">Bars are the share of ${manager}'s games landing in each ${BIN}-point band and the blue line is the same share for every team in the league. The dashed curve is a perfect bell curve with ${manager}'s own mean and standard deviation, so the gap between the bars and the curve is how far their scoring is from a textbook normal distribution.</p>
        </div>`;
}

function wireDistribution() {
    const wrap = document.querySelector('.hp-dist-wrap');
    if (!wrap || !distribution) return;
    const tip = wrap.querySelector('.hp-dist-tip'), band = wrap.querySelector('.hp-dist-band');
    const svg = wrap.querySelector('svg');
    const line = (cls, label, value) => {
        const row = document.createElement('div');
        const key = document.createElement('i'); key.className = `hp-key hp-key-${cls}`;
        const strong = document.createElement('b'); strong.textContent = value;
        const name = document.createElement('span'); name.textContent = label;
        row.append(key, strong, name);
        return row;
    };
    const show = hit => {
        const i = Number(hit.dataset.bin), d = distribution;
        tip.replaceChildren();
        const head = document.createElement('div'); head.className = 'hp-dist-tip-head';
        head.textContent = `${d.lo + i * BIN}-${d.lo + (i + 1) * BIN} points`;
        tip.append(head,
            line('mgr', `${d.mCounts[i]} of ${d.mine} games`, `${d.mPct[i].toFixed(1)}%`),
            line('league', `${d.lCounts[i]} of ${d.league} games`, `${d.lPct[i].toFixed(1)}%`),
            line('bell', 'bell curve', `${d.nPct[i].toFixed(1)}%`));
        tip.hidden = false;
        band.setAttribute('x', hit.getAttribute('x')); band.setAttribute('width', hit.getAttribute('width'));
        band.setAttribute('visibility', 'visible');
        const box = svg.getBoundingClientRect(), scale = box.width / svg.viewBox.baseVal.width;
        const cx = (Number(hit.getAttribute('x')) + Number(hit.getAttribute('width')) / 2) * scale;
        const left = Math.min(Math.max(cx - tip.offsetWidth / 2, 0), box.width - tip.offsetWidth);
        tip.style.left = `${left}px`;
        tip.style.top = `${14 * scale}px`;
    };
    const hide = () => { tip.hidden = true; band.setAttribute('visibility', 'hidden'); };
    wrap.querySelectorAll('.hp-dist-hit').forEach(hit => {
        hit.addEventListener('pointerenter', () => show(hit));
        hit.addEventListener('focus', () => show(hit));
        hit.addEventListener('pointerleave', hide);
        hit.addEventListener('blur', hide);
    });
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

    const lineup = lineupOf(allGames.filter(g => g.owner === manager && doneSeasons.has(g.season)), weekMetrics);

    const tiles = `
        <div class="hp-tiles">
            ${tile('Seasons', done.length, inProgress ? `+ ${currentSeason} in progress` : 'completed')}
            ${tile('Record', record(totals.w, totals.l, totals.t), `${fmtPct(pctOf(totals.w, totals.l, totals.t))} PCT`)}
            ${tile('Titles', titles, `${seconds} runner-up${seconds === 1 ? '' : 's'}`)}
            ${tile('Top 3 finishes', top3, 'podium finishes')}
            ${tile('Championship bracket', champBracket, `of ${done.length} season${done.length === 1 ? '' : 's'}`)}
            ${tile('Best finish', bestPlace ? ordinal(bestPlace) : '-', bestSeasons.join(', '))}
            ${tile('Avg finish', avgFinish ? avgFinish.toFixed(1) : '-', 'per season')}
            ${tile('Points / game', games ? (totals.pf / games).toFixed(1) : '-', games ? `${(totals.pa / games).toFixed(1)} against` : '')}
            ${tile('Point differential', fmtPd(totals.pf - totals.pa), 'career total')}
            ${tile('Schedule luck index', career.idx == null ? '-' : career.idx.toFixed(0), career.idx == null ? '' : `${career.w - career.e >= 0 ? '+' : ''}${(career.w - career.e).toFixed(1)} wins vs all&#8209;play`)}
            ${tile('FP+', fmtIdx(lineup.fp), '100 = on projection')}
            ${tile('Roster efficiency', lineup.eff == null ? '-' : `${lineup.eff.toFixed(1)}%`, lineup.eff == null ? '' : `${Math.round(lineup.left).toLocaleString()} pts left on bench`)}
        </div>`;

    const seasonBody = mine.map(r => {
        const pd = r.pointsFor - r.pointsAgainst;
        const lk = r.place == null ? { idx: null } : luckOf(allGames.filter(g => g.owner === manager && g.season === r.season));   // one game says nothing
        const lu = lineupOf(allGames.filter(g => g.owner === manager && g.season === r.season), weekMetrics);
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
                <td class="${lu.fp == null ? '' : lu.fp >= 100 ? 'hp-pos' : 'hp-neg'}">${fmtIdx(lu.fp)}</td>
                <td>${lu.eff == null ? '-' : `${lu.eff.toFixed(1)}%`}</td>
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
                        <th>PD</th><th title="Starters' points vs. their projection: 100 = on projection">FP+</th><th title="Starters' points vs. the best lineup the roster allowed">Eff.</th><th>PF</th><th>PA</th><th>Finish</th><th>Postseason</th>
                    </tr></thead>
                    <tbody>${seasonBody}</tbody>
                </table>
            </div>
            <p class="hp-note">Luck is the schedule luck index: actual wins divided by the wins the weekly score ranks predict (all-play), times 100. 100 is the league average; above 100 the schedule helped, below it hurt. FP+ is starters' points divided by their projected points, times 100 (100 = right on projection). Eff. is starters' points divided by what the best available lineup would have scored, counting only bench players who beat a same-position starter. Both are the Game Log's per-game measures pooled over the regular season, and skip weeks with no projection or roster on file.</p>
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
        </div>
        ${distributionPanel(manager)}`;
    wireDistribution();
    equalizeTiles();
    const compare = document.getElementById('compare-link');
    if (compare) compare.href = `compare-managers.html?m=${encodeURIComponent(manager)}`;
}
