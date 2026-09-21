// Standings History: regular-season standings for any completed season as of
// any week, with the Championship and Gulag brackets that go with them.
//
// Standings are rebuilt from the game log through the chosen week. The
// brackets are seeded from those standings the same way the Play-Off Picture
// page projects them; at the final week of a season whose bracket games are
// recorded, the real results are drawn instead.
const HP_UI = { card: 'hp-panel br-panel', title: 'hp-panel-title' };

let seasonRows = [];
let games = [];
const pictureCache = new Map();

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('hp-content');
    try {
        const [teamRows, scoreRows] = await Promise.all([LeagueDb.seasonTeamRows(), LeagueDb.scoreRows()]);
        seasonRows = teamRows;
        games = scoreRows
            .filter(g => g['Season Period'] === 'Regular' && g.Team && g.Opponent &&
                g.Team.toLowerCase() !== 'bye' && g.Opponent.toLowerCase() !== 'bye')
            .map(g => ({
                season: g.Season, week: g.Week, owner: g.Team, opponent: g.Opponent,
                us: Number(g['Team Score']), them: Number(g['Opponent Score'])
            }));

        // Past seasons only: a season counts once it has final placements.
        const seasons = [...new Set(seasonRows.filter(r => r.place != null).map(r => r.season))].sort((a, b) => b - a);
        if (!seasons.length) {
            content.innerHTML = '<div class="hp-empty">No completed seasons yet.</div>';
            return;
        }

        const seasonSelect = document.getElementById('season-select');
        const weekSelect = document.getElementById('week-select');
        seasonSelect.innerHTML = seasons.map(s => `<option value="${s}">${s}</option>`).join('');

        const fillWeeks = season => {
            const weeks = weeksFor(season);
            weekSelect.innerHTML = weeks.map((w, i) =>
                `<option value="${w}">Week ${w}${i === weeks.length - 1 ? ' (final)' : ''}</option>`).join('');
            weekSelect.value = String(weeks[weeks.length - 1]);
        };

        seasonSelect.addEventListener('change', () => { fillWeeks(Number(seasonSelect.value)); render(); });
        weekSelect.addEventListener('change', render);
        fillWeeks(seasons[0]);
        render();
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="hp-error">Error loading standings history.</div>';
    }
});

// Regular-season games each team plays that season (the most any team played).
function seasonLength(season) {
    const perTeam = new Map();
    games.filter(g => g.season === season).forEach(g => perTeam.set(g.owner, (perTeam.get(g.owner) || 0) + 1));
    return perTeam.size ? Math.max(...perTeam.values()) : 0;
}

const weeksFor = season =>
    [...new Set(games.filter(g => g.season === season).map(g => g.week))].sort((a, b) => a - b);

function getPicture(season) {
    if (!pictureCache.has(season)) pictureCache.set(season, LeagueDb.playoffPicture(season));
    return pictureCache.get(season);
}

const ordinal = n => {
    const v = n % 100;
    const suffix = (v >= 11 && v <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${suffix}`;
};
const fmt2 = n => Number(n).toFixed(2);
const fmtPd = n => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

// One row per manager with the season's division and their record through
// `week`, ranked within each division by the league tiebreak (record,
// head-to-head, point differential, points for). Also returns the head-to-head
// lookup so brackets can order teams across divisions the same way.
function standingsThrough(season, week) {
    const meta = seasonRows.filter(r => r.season === season);
    const agg = new Map();
    const h2h = new Map();
    games.filter(g => g.season === season && g.week <= week).forEach(g => {
        const a = agg.get(g.owner) || { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
        const h = h2h.get(`${g.owner}|${g.opponent}`) || { w: 0, l: 0, t: 0 };
        if (g.us > g.them) { a.w += 1; h.w += 1; } else if (g.us < g.them) { a.l += 1; h.l += 1; } else { a.t += 1; h.t += 1; }
        a.pf += g.us; a.pa += g.them;
        agg.set(g.owner, a);
        h2h.set(`${g.owner}|${g.opponent}`, h);
    });
    const h2hOf = (a, b) => h2h.get(`${a}|${b}`) || null;

    const byDivision = new Map();
    meta.forEach(m => {
        const a = agg.get(m.owner) || { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
        if (!byDivision.has(m.divisionId)) byDivision.set(m.divisionId, []);
        byDivision.get(m.divisionId).push({
            divisionId: m.divisionId, divisionName: m.divisionName, owner: m.owner,
            wins: a.w, losses: a.l, ties: a.t, pointsFor: a.pf, pointsAgainst: a.pa,
            place: m.place, bracketType: m.bracketType
        });
    });
    const rows = [...byDivision.values()]
        .sort((x, y) => String(x[0].divisionName).localeCompare(String(y[0].divisionName)))
        .flatMap(group => LeagueDb.rankByTiebreak(group, h2hOf, season));
    return { rows, h2hOf };
}

async function render() {
    const content = document.getElementById('hp-content');
    const season = Number(document.getElementById('season-select').value);
    const week = Number(document.getElementById('week-select').value);
    const finalWeek = weeksFor(season).slice(-1)[0];
    const isFinal = week === finalWeek;

    content.innerHTML = '<div class="hp-loading">Loading...</div>';
    try {
        const picture = await getPicture(season);
        const { rows, h2hOf } = standingsThrough(season, week);
        const seasonGames = seasonLength(season);
        const slotsByDivision = new Map((picture.divisionSlots || []).map(s => [s.divisionId, s]));

        const champion = seasonRows.find(r => r.season === season && r.place === 1);
        document.getElementById('hp-champion').textContent = champion ? champion.owner : '-';
        document.getElementById('hp-ranking').textContent = 'Record, then head-to-head, then point differential, then points for';

        // ---- Brackets ----
        const projection = buildProjection({ rules: picture.rules || {}, divisionStandings: rows, divisionSlots: picture.divisionSlots || [], h2hOf });
        const linked = isFinal && picture.bracket.some(b => b.gameId != null);
        let bracketHtml;
        if (linked) {
            const rank = { championship: 0, play_in: 1, elimination: 2 };
            const typeOf = name => picture.bracket.find(x => x.bracket === name).bracketType;
            const names = [...new Set(picture.bracket.map(b => b.bracket))].sort((a, b) => rank[typeOf(a)] - rank[typeOf(b)]);
            bracketHtml = names.map(name => {
                const slots = picture.bracket.filter(b => b.bracket === name);
                return renderBracket(name, slots[0].bracketType, slots, HP_UI);
            }).join('');
        } else {
            const tag = isFinal ? 'Seeded' : `Projected after Week ${week}`;
            bracketHtml =
                renderProjectedBracket(`Championship Bracket (${tag})`, projection.championship, HP_UI) +
                renderProjectedBracket(`Gulag Bracket (${tag})`, projection.elimination, HP_UI);
        }
        // The shared note is worded for the live season ("today's standings").
        const historyNote = projection.note.replace(/^Projected from today.s standings\./,
            isFinal ? 'Seeded from the final regular-season standings.' : `Projected from the standings after Week ${week}.`);
        document.getElementById('hp-bracket-note').textContent = linked
            ? 'Real bracket results for this season.'
            : historyNote;

        // ---- Division tables ----
        const divisions = new Map();
        rows.forEach(r => {
            if (!divisions.has(r.divisionId)) divisions.set(r.divisionId, { name: r.divisionName, teams: [] });
            divisions.get(r.divisionId).teams.push(r);
        });

        const panels = [...divisions.entries()].map(([divisionId, div]) => {
            const slots = slotsByDivision.get(divisionId) || { autoSlots: 0, playinSlots: 0 };
            const auto = Number(slots.autoSlots), playin = Number(slots.playinSlots);
            const numbers = isFinal ? [] : playoffNumbers(div.teams, seasonGames, auto, playin);
            const body = div.teams.map((t, i) => {
                const rank = i + 1;
                const gp = t.wins + t.losses + t.ties;
                const pct = gp ? (t.wins + 0.5 * t.ties) / gp : 0;
                const pd = t.pointsFor - t.pointsAgainst;
                let status = '<span class="hp-badge">Gulag</span>';
                if (rank <= auto) status = '<span class="hp-badge hp-green">Championship</span>';
                else if (rank <= auto + playin) status = '<span class="hp-badge hp-gold">Play-in</span>';
                // Final week: where they finished. Earlier weeks: what's left to clinch or be eliminated.
                const lastCell = isFinal ? (t.place != null ? ordinal(t.place) : '-') : playoffNumberCell(numbers[i]);
                return `
                    <tr class="${isFinal && t.place === 1 ? 'hp-champ' : ''}">
                        <td class="hp-dim">${rank}</td>
                        <td class="hp-left hp-name">${t.owner}</td>
                        <td>${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}</td>
                        <td>${pct.toFixed(3).replace(/^0(?=\.)/, '')}</td>
                        <td class="${pd >= 0 ? 'hp-pos' : 'hp-neg'}">${fmtPd(pd)}</td>
                        <td>${fmt2(t.pointsFor)}</td>
                        <td>${fmt2(t.pointsAgainst)}</td>
                        <td>${status}</td>
                        <td>${lastCell}</td>
                    </tr>`;
            }).join('');
            return `
                <div class="hp-panel">
                    <h2 class="hp-panel-title">${div.name}<small>through week ${week}</small></h2>
                    <div class="hp-scroll">
                        <table class="hp-table">
                            <thead><tr>
                                <th>#</th><th class="hp-left">Team</th><th>W-L</th><th>PCT</th>
                                <th>PD</th><th>PF</th><th>PA</th><th>If ended now</th><th>${isFinal ? 'Final finish' : 'Magic / Elim'}</th>
                            </tr></thead>
                            <tbody>${body}</tbody>
                        </table>
                    </div>
                </div>`;
        });

        const note = '<p class="hp-note">Regular-season games only. "If ended now" is the bracket a team would be in if the regular season stopped after the selected week. ' +
            (isFinal
                ? 'Final finish is the placement after the playoffs.'
                : '<strong>M</strong> = magic number: wins by the team plus losses by its closest rival needed to clinch a Championship spot (<strong>M*</strong> = a play-in berth, in seasons that had a play-in). ' +
                  '<strong>E</strong> = elimination number: losses by the team plus wins by the rival on the cutoff needed to be out of the playoff field. ' +
                  '&#10003; = clinched, <strong>Elim</strong> = eliminated. Based on a ' + seasonGames + '-game season; a tie never counts as clinching or eliminating, so the numbers are conservative.') +
            '</p>';
        content.innerHTML =
            `<div class="hp-brackets">${bracketHtml}</div>` +
            `<div class="hp-grid${panels.length > 1 ? ' hp-two' : ''}">${panels.join('')}</div>${note}`;
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="hp-error">Error loading standings history.</div>';
    }
}
