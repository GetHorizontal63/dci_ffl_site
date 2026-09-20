// Transactions: every pickup, trade and drop, graded on rest-of-season points.
// The numbers and grades are derived in python/transaction_grades.py (see the
// header there); this page only explores them.
let moves = [];
const playersByMove = new Map();
const state = { tab: 'cards', season: 'ALL', manager: 'ALL', sort: 'gpa', shown: 150 };
const PAGE = 150;
const wideTrades = window.matchMedia('(min-width: 1301px)');
wideTrades.addEventListener('change', () => { if (state.tab === 'trades') render(); });

const SORTS = {
    pickups: [['best', 'Best first'], ['worst', 'Worst first'], ['newest', 'Newest'], ['oldest', 'Oldest']],
    drops: [['best', 'Best drops first'], ['worst', 'Worst drops first'], ['newest', 'Newest'], ['oldest', 'Oldest']],
    trades: [['margin', 'Biggest margin'], ['newest', 'Newest'], ['oldest', 'Oldest']],
    cards: [['gpa', 'Overall GPA']]
};

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('hp-content');
    try {
        const [moveRows, playerRows] = await Promise.all([
            LeagueDb.query(`
                SELECT m.move_id, m.transaction_id, m.kind, m.season, m.scoring_period, m.effective_week,
                       m.owner_id, o.display_name AS owner, c.display_name AS counterparty,
                       m.weeks_counted, m.pts_in, m.pts_out, m.started_in, m.started_out,
                       m.net_total, m.net_started, m.percentile, m.grade, m.provisional, m.evidence
                FROM transaction_moves m
                JOIN owners o ON o.owner_id = m.owner_id
                LEFT JOIN owners c ON c.owner_id = m.counterparty_owner_id`),
            LeagueDb.query(`
                SELECT mp.move_id, mp.direction, mp.ros_points, mp.started_points, mp.weeks_started,
                       COALESCE(p.name, 'Player #' || mp.player_id) AS name, p.position
                FROM transaction_move_players mp
                LEFT JOIN players p ON p.player_id = mp.player_id
                ORDER BY mp.ros_points DESC`)
        ]);
        moves = moveRows;
        playerRows.forEach(p => {
            if (!playersByMove.has(p.move_id)) playersByMove.set(p.move_id, []);
            playersByMove.get(p.move_id).push(p);
        });

        const seasons = [...new Set(moves.map(m => m.season))].sort((a, b) => b - a);
        const managers = [...new Set(moves.map(m => m.owner))].sort((a, b) => a.localeCompare(b));
        const seasonSelect = document.getElementById('season-select');
        seasonSelect.innerHTML = '<option value="ALL">All Seasons</option>' + seasons.map(s => `<option value="${s}">${s}</option>`).join('');
        const managerSelect = document.getElementById('manager-select');
        managerSelect.innerHTML = '<option value="ALL">All Managers</option>' + managers.map(m => `<option value="${m}">${m}</option>`).join('');

        seasonSelect.addEventListener('change', () => { state.season = seasonSelect.value; state.shown = PAGE; render(); });
        managerSelect.addEventListener('change', () => { state.manager = managerSelect.value; state.shown = PAGE; render(); });
        document.getElementById('sort-select').addEventListener('change', e => { state.sort = e.target.value; state.shown = PAGE; render(); });
        document.getElementById('hp-tabs').addEventListener('click', e => {
            const tab = e.target.closest('.hp-tab');
            if (!tab) return;
            state.tab = tab.dataset.tab;
            state.sort = SORTS[state.tab][0][0];
            state.shown = PAGE;
            document.querySelectorAll('.hp-tab').forEach(t => t.classList.toggle('active', t === tab));
            render();
        });
        // Deep links: ?tab=trades&season=2024&manager=Gabe
        const params = new URLSearchParams(window.location.search);
        if (SORTS[params.get('tab')]) {
            state.tab = params.get('tab');
            state.sort = SORTS[state.tab][0][0];
            document.querySelectorAll('.hp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
        }
        if (seasons.includes(Number(params.get('season')))) { state.season = params.get('season'); seasonSelect.value = state.season; }
        if (managers.includes(params.get('manager'))) { state.manager = params.get('manager'); managerSelect.value = state.manager; }
        content.addEventListener('click', e => {
            if (e.target.closest('#hp-more')) { state.shown += PAGE; render(); }
        });
        render();
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="hp-error">Error loading transactions.</div>';
    }
});

const GPA = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const fmt1 = n => Number(n).toFixed(1);
const signed = n => `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}`;
const cls = n => (n >= 0 ? 'hp-pos' : 'hp-neg');
const when = m => `${m.season} &middot; Wk ${m.effective_week}`;
const kindWord = { PICKUP: 'pickups', TRADE: 'trade sides', DROP: 'drops' };

function gradeChip(m) {
    if (!m.grade) {
        const why = m.provisional ? 'Season in progress: graded once it finishes' : 'No regular-season weeks left after this move';
        return `<span class="hp-grade hp-grade-none" title="${why}">&mdash;</span>`;
    }
    const better = Math.round(m.percentile * 100);
    return `<span class="hp-grade hp-grade-${m.grade}" title="Better than ${better}% of ${kindWord[m.kind]} in completed seasons">${m.grade}</span>`;
}

function playerList(moveId, direction, started) {
    const list = (playersByMove.get(moveId) || []).filter(p => p.direction === direction);
    if (!list.length) return '<span class="hp-dim">&mdash;</span>';
    return list.map(p => `
        <div class="hp-player">
            <span class="hp-pname">${p.name}</span>${p.position ? `<span class="hp-ppos">${p.position}</span>` : ''}
            <span class="hp-ppts" title="${fmt1(p.started_points)} pts in a starting lineup over ${p.weeks_started} week${p.weeks_started === 1 ? '' : 's'}">${fmt1(started ? p.started_points : p.ros_points)}</span>
        </div>`).join('');
}

function filtered(kind) {
    return moves.filter(m => (kind ? m.kind === kind : true) &&
        (state.season === 'ALL' || String(m.season) === state.season) &&
        (state.manager === 'ALL' || m.owner === state.manager || m.counterparty === state.manager));
}

const newest = (a, b) => b.season - a.season || b.effective_week - a.effective_week || b.move_id - a.move_id;

function sortMoves(list) {
    const s = state.sort;
    const copy = [...list];
    if (s === 'newest') return copy.sort(newest);
    if (s === 'oldest') return copy.sort((a, b) => -newest(a, b));
    if (s === 'worst') return copy.sort((a, b) => a.net_total - b.net_total);
    return copy.sort((a, b) => b.net_total - a.net_total);
}

function moreButton(total) {
    return total > state.shown
        ? `<div class="hp-more"><button id="hp-more" class="hp-tab">Show more (${total - state.shown} left)</button></div>` : '';
}

function render() {
    const sortSelect = document.getElementById('sort-select');
    sortSelect.innerHTML = SORTS[state.tab].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    sortSelect.value = state.sort;
    document.querySelectorAll('.hp-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
    sortSelect.closest('.hp-field').style.display = SORTS[state.tab].length > 1 ? '' : 'none';   // nothing to sort on Report Cards
    const content = document.getElementById('hp-content');
    content.innerHTML = { cards: renderCards, pickups: renderPickups, trades: renderTrades, drops: renderDrops }[state.tab]();
}

// ---------- Report cards ----------
function renderCards() {
    const byOwner = new Map();
    filtered().forEach(m => {
        if (state.manager !== 'ALL' && m.owner !== state.manager) return;   // a card is the manager's own moves
        const o = byOwner.get(m.owner) || { owner: m.owner, pickups: [], trades: [], drops: [] };
        ({ PICKUP: o.pickups, TRADE: o.trades, DROP: o.drops })[m.kind].push(m);
        byOwner.set(m.owner, o);
    });
    const gpa = list => {
        const graded = list.filter(m => m.grade);
        return graded.length ? graded.reduce((s, m) => s + GPA[m.grade], 0) / graded.length : null;
    };
    const cell = v => (v == null ? '<td class="hp-dim">-</td>' : `<td>${v.toFixed(2)}</td>`);
    const rows = [...byOwner.values()].map(o => {
        const all = [...o.pickups, ...o.trades, ...o.drops];
        return { ...o, overall: gpa(all), pickupGpa: gpa(o.pickups), tradeGpa: gpa(o.trades), dropGpa: gpa(o.drops), graded: all.filter(m => m.grade).length };
    }).sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));

    if (!rows.length) return '<div class="hp-panel"><div class="hp-empty">No transactions for this selection.</div></div>';
    const body = rows.map((o, i) => {
        const pickupNet = o.pickups.reduce((s, m) => s + m.net_total, 0);
        const tradeNet = o.trades.reduce((s, m) => s + m.net_total, 0);
        const won = o.trades.filter(m => m.net_total > 0).length, lost = o.trades.filter(m => m.net_total < 0).length;
        return `
            <tr>
                <td class="hp-dim">${o.overall == null ? '-' : i + 1}</td>
                <td class="hp-left hp-name">${o.owner}</td>
                ${cell(o.overall)}
                <td>${o.pickups.length}</td>
                ${cell(o.pickupGpa)}
                <td class="${cls(pickupNet)}">${signed(pickupNet)}</td>
                <td>${o.trades.length ? `${won}-${lost}` : '-'}</td>
                ${cell(o.tradeGpa)}
                <td class="${o.trades.length ? cls(tradeNet) : ''}">${o.trades.length ? signed(tradeNet) : '-'}</td>
                <td>${o.drops.length}</td>
                ${cell(o.dropGpa)}
            </tr>`;
    }).join('');
    return `
        <div class="hp-panel">
            <h2 class="hp-panel-title">Manager Report Cards<small>GPA: A = 4, B = 3, C = 2, D = 1, F = 0</small></h2>
            <div class="hp-scroll">
                <table class="hp-table">
                    <thead><tr>
                        <th>#</th><th class="hp-left">Manager</th><th>Overall GPA</th>
                        <th>Pickups</th><th>Pickup GPA</th><th>Pickup Net</th>
                        <th>Trades W-L</th><th>Trade GPA</th><th>Trade Net</th>
                        <th>Drops</th><th>Drop GPA</th>
                    </tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            <p class="hp-note">Net is rest-of-season points gained (or lost) across all of a manager's moves of that kind. Moves in a season still in progress are not graded, so the current season adds counts but no GPA.</p>
        </div>`;
}

// ---------- Pickups ----------
function renderPickups() {
    const list = sortMoves(filtered('PICKUP'));
    if (!list.length) return '<div class="hp-panel"><div class="hp-empty">No pickups for this selection.</div></div>';
    const body = list.slice(0, state.shown).map(m => `
        <tr>
            <td class="hp-left hp-when">${when(m)}</td>
            <td class="hp-left hp-name">${m.owner}</td>
            <td class="hp-left hp-plist">${playerList(m.move_id, 'IN')}</td>
            <td class="hp-left hp-plist">${playerList(m.move_id, 'OUT')}</td>
            <td class="${cls(m.net_total)}">${signed(m.net_total)}</td>
            <td class="${cls(m.net_started)}">${signed(m.net_started)}</td>
            <td>${gradeChip(m)}</td>
        </tr>`).join('');
    return `
        <div class="hp-panel">
            <h2 class="hp-panel-title">Waivers &amp; Free Agents<small>${list.length.toLocaleString()} pickups</small></h2>
            <div class="hp-scroll">
                <table class="hp-table hp-moves">
                    <thead><tr>
                        <th class="hp-left">When</th><th class="hp-left">Manager</th>
                        <th class="hp-left">Added <small>rest-of-season pts</small></th><th class="hp-left">Dropped <small>rest-of-season pts</small></th>
                        <th>Net</th><th>Net Started</th><th>Grade</th>
                    </tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            ${moreButton(list.length)}
            <p class="hp-note">Rest of season = the week the player hit the roster through the last regular-season week. Net = added minus dropped; Net Started counts only points scored while in a starting lineup (hover a player's points for his starts). Grade is percentile against every pickup in completed seasons.</p>
        </div>`;
}

// ---------- Drops ----------
function renderDrops() {
    const list = sortMoves(filtered('DROP'));
    if (!list.length) return '<div class="hp-panel"><div class="hp-empty">No drops for this selection.</div></div>';
    const body = list.slice(0, state.shown).map(m => `
        <tr>
            <td class="hp-left hp-when">${when(m)}</td>
            <td class="hp-left hp-name">${m.owner}</td>
            <td class="hp-left hp-plist">${playerList(m.move_id, 'OUT')}</td>
            <td>${fmt1(m.started_out)}</td>
            <td>${gradeChip(m)}</td>
        </tr>`).join('');
    return `
        <div class="hp-panel">
            <h2 class="hp-panel-title">Drops<small>${list.length.toLocaleString()} drops</small></h2>
            <div class="hp-scroll">
                <table class="hp-table hp-moves">
                    <thead><tr>
                        <th class="hp-left">When</th><th class="hp-left">Manager</th><th class="hp-left">Dropped <small>points since the drop</small></th>
                        <th>Started Since</th><th>Grade</th>
                    </tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            ${moreButton(list.length)}
            <p class="hp-note">Points since the drop is what the dropped player scored for anyone through the end of the regular season; Started Since counts only weeks he was in a starting lineup. Cutting someone who kept producing grades badly; cutting a dud grades well. Drops made as part of a waiver claim or trade are judged inside that move instead.</p>
        </div>`;
}

// ---------- Trades ----------
function renderTrades() {
    const groups = new Map();
    filtered('TRADE').forEach(m => {
        if (!groups.has(m.transaction_id)) groups.set(m.transaction_id, []);
        groups.get(m.transaction_id).push(m);
    });
    const list = [...groups.values()];   // both sides of a trade match a manager filter (owner or counterparty)
    const margin = g => Math.max(...g.map(m => Math.abs(m.net_total)));
    const order = g => g[0].season * 1000 + g[0].effective_week;
    if (state.sort === 'margin') list.sort((a, b) => margin(b) - margin(a));
    else if (state.sort === 'oldest') list.sort((a, b) => order(a) - order(b));
    else list.sort((a, b) => order(b) - order(a));

    if (!list.length) return '<div class="hp-panel"><div class="hp-empty">No trades for this selection.</div></div>';
    const cards = list.map(g => {
        const sorted = [...g].sort((a, b) => b.net_total - a.net_total);
        const inferred = g[0].evidence === 'rosters'
            ? ' <span class="hp-badge" title="ESPN never marked this trade processed, but the players changed teams in the weekly rosters">From rosters</span>' : '';
        return `
            <div class="hp-panel hp-trade">
                <h2 class="hp-panel-title"><span>${when(g[0])}${inferred}</span><small>${sorted.map(m => m.owner).join(' &amp; ')}</small></h2>
                <div class="hp-trade-sides">
                    ${sorted.map(m => `
                        <div class="hp-trade-side">
                            <div class="hp-trade-head"><span class="hp-name">${m.owner}</span>${gradeChip(m)}</div>
                            <div class="hp-label">Received</div>${playerList(m.move_id, 'IN')}
                            <div class="hp-label">Sent</div>${playerList(m.move_id, 'OUT')}
                            <div class="hp-trade-fill"></div>
                            <div class="hp-trade-net">
                                <span>Net <b class="${cls(m.net_total)}">${signed(m.net_total)}</b></span>
                                <span>Started <b class="${cls(m.net_started)}">${signed(m.net_started)}</b></span>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
    });
    // Cards keep their own height: they are dealt alternately into independent
    // columns (2 on wide screens, 1 on narrow) rather than into rows of equal height.
    const columns = wideTrades.matches ? 2 : 1;
    const cols = Array.from({ length: columns }, () => []);
    cards.forEach((card, i) => cols[i % columns].push(card));
    return `<div class="hp-trade-list">${cols.map(col => `<div class="hp-trade-col">${col.join('')}</div>`).join('')}</div>
        <p class="hp-note hp-trade-note">${list.length} trade${list.length === 1 ? '' : 's'}. Points are rest of season from the week the players landed. "From rosters" marks trades ESPN never recorded as processed but that show up in the weekly rosters. A side's Sent total includes players cut to make room, since that was part of the cost.</p>`;
}
