// Shared bracket drawing and projection, used by the Play-Off Picture page and
// the Standings History page. Plain script (no modules): everything here is a
// global, so load this file before the page script that calls it.

// ---------------------------------------------------------------------------
// Bracket drawing. A bracket is a tree: each node is one game (pre-rendered
// card HTML) plus the games that feed it. Drawing it as nested flex rows puts
// every later-round game vertically centered between the games that feed it,
// with connector lines, like a real bracket.
// ---------------------------------------------------------------------------
function bracketTree(node) {
    const feeders = node.children && node.children.length
        ? `<div class="br-children">${node.children.map(c => `<div class="br-branch">${bracketTree(c)}</div>`).join('')}</div>`
        : '';
    return `<div class="br-node">${feeders}<div class="br-game${feeders ? ' br-has-feeders' : ''}">${node.html}</div></div>`;
}

const BRACKET_UI_DEFAULT = { card: 'pp-card br-panel', title: 'pp-card-title' };

function renderBracketCard(title, root, labels, ui = BRACKET_UI_DEFAULT) {
    const heads = labels.map(l => `<div class="br-head">${l}</div>`).join('');
    return `
        <div class="${ui.card}">
            <h2 class="${ui.title}">${title}</h2>
            <div class="br-scroll" style="--cols:${labels.length}">
                <div class="br-inner">
                    <div class="br-heads">${heads}</div>
                    ${bracketTree(root)}
                </div>
            </div>
        </div>
    `;
}

function renderSeedListCard(title, entries, ui = BRACKET_UI_DEFAULT) {
    const list = entries.map((e, i) => `<div class="pp-seed-row"><span class="pp-seed-num">${i + 1}</span><span class="pp-seed-owner">${e.text}</span></div>`).join('');
    return `<div class="${ui.card}"><h2 class="${ui.title}">${title}</h2><div class="pp-seed-list">${list || '<div class="pp-empty-note">No teams yet.</div>'}</div></div>`;
}

function teamRowHtml(text, sub, placeholder, winner) {
    return `<div class="pp-bracket-team${placeholder ? ' pp-bracket-placeholder' : ''}${winner ? ' pp-winner' : ''}">`
        + `<span class="pp-bracket-name">${text}</span>${sub != null && sub !== '' ? `<span class="pp-bracket-score">${sub}</span>` : ''}</div>`;
}

function gameCardHtml(topRow, bottomRow, tag) {
    return `<div class="pp-bracket-game">${tag ? `<div class="br-tag">${tag}</div>` : ''}${topRow}${bottomRow}</div>`;
}

// Standard 8-team single elimination: 1v8, 4v5, 2v7, 3v6, then the two
// semifinals and the final. Each seed slot may carry a `feeder` game (a
// play-in) that decides who takes that seed.
const BRACKET_PAIRS = [[1, 8], [4, 5], [2, 7], [3, 6]];

function buildEightTeamTree(seeds) {
    const slotRow = s => teamRowHtml(s.text, s.sub, s.placeholder);
    const round1 = BRACKET_PAIRS.map(([a, b]) => ({
        html: gameCardHtml(slotRow(seeds[a - 1]), slotRow(seeds[b - 1])),
        children: [seeds[a - 1].feeder, seeds[b - 1].feeder].filter(Boolean)
    }));
    return finishTree(round1);
}

// Semifinals and final from four round-1 games.
function finishTree(round1) {
    const later = (kids, a, b) => ({
        html: gameCardHtml(teamRowHtml(a, null, true), teamRowHtml(b, null, true)),
        children: kids
    });
    const semi1 = later([round1[0], round1[1]], 'Winner of game 1', 'Winner of game 2');
    const semi2 = later([round1[2], round1[3]], 'Winner of game 3', 'Winner of game 4');
    return later([semi1, semi2], 'Winner of semi 1', 'Winner of semi 2');
}

// Projection for an in-progress season, built from the same per-division
// tiers as the standings. Division auto qualifiers seed the Championship
// bracket (ordered across divisions by the season's tiebreak). The teams in
// each division's play-in band play play-in games (best vs worst of the band,
// next-best vs next-worst); winners take the remaining Championship seeds and
// losers take the first Gulag seeds, followed by everyone outside the play-in.
//
// Play-in pairing (cross-division, 3v6 and 4v5 against the opposite division)
// is per the league. ASSUMPTION (not recorded in the data): play-in games feed
// bracket seeds 5-8 in the order A 3v6, B 3v6, A 4v5, B 4v5.
function buildProjection(data) {
    const { rules, divisionStandings, divisionSlots } = data;
    const slotsBy = new Map(divisionSlots.map(s => [s.divisionId, s]));
    // Order across divisions with the league tiebreak (record, head-to-head,
    // point differential, points for).
    const rank = teams => LeagueDb.rankByTiebreak(teams, data.h2hOf);

    const byDivision = new Map();
    divisionStandings.forEach(r => {
        if (!byDivision.has(r.divisionId)) byDivision.set(r.divisionId, []);
        byDivision.get(r.divisionId).push(r);
    });

    const auto = [], rest = [], bands = [];
    byDivision.forEach((teams, id) => {
        const slots = slotsBy.get(id) || { autoSlots: 0, playinSlots: 0 };
        const a = Number(slots.autoSlots), p = Number(slots.playinSlots);
        auto.push(...teams.slice(0, a).map((t, i) => ({ ...t, divRank: i + 1, autoSlots: a, playinSlots: p })));
        rest.push(...teams.slice(a + p));
        bands.push({ division: teams[0].divisionName, firstRank: a + 1, teams: teams.slice(a, a + p) });
    });
    auto.splice(0, auto.length, ...rank(auto));
    rest.splice(0, rest.length, ...rank(rest));

    const rec = t => `${t.wins}-${t.losses}`;
    // Play-ins are cross-division: with two divisions, one division's best
    // remaining seeds face the OTHER division's worst (Furries 3 v Syndicate 6,
    // Furries 4 v Syndicate 5, Syndicate 3 v Furries 6, Syndicate 4 v Furries 5).
    const playins = [];
    const game = (X, xi, Y, yi) => ({
        division: 'Cross-division play-in',
        hi: X.teams[xi], lo: Y.teams[yi],
        hiRank: X.firstRank + xi, loRank: Y.firstRank + yi
    });
    if (bands.length === 2) {
        const [A, B] = bands;
        const n = Math.floor(Math.min(A.teams.length, B.teams.length) / 2);
        for (let i = 0; i < n; i++) {
            playins.push(game(A, i, B, B.teams.length - 1 - i));
            playins.push(game(B, i, A, A.teams.length - 1 - i));
        }
    }
    const playinNode = (g) => ({
        html: gameCardHtml(
            teamRowHtml(`#${g.hiRank} ${g.hi.owner}`, rec(g.hi)),
            teamRowHtml(`#${g.loRank} ${g.lo.owner}`, rec(g.lo)),
            g.division),
        children: []
    });

    // Championship round 1. Each auto qualifier faces the winner of the play-in
    // game that includes a team from ITS OWN division at division rank
    // (autoSlots + playinSlots/2 + its own division rank): with 2 auto and 4
    // play-in spots, division seed 1 <-> the game holding that division's #5,
    // and seed 2 <-> the game holding its #6 (e.g. Syndicate #1 faces the
    // winner of Furries 4 v Syndicate 5). Game order down the bracket follows
    // the overall auto seed (1, 4, 2, 3).
    let matchedRound1 = null;
    let matchNote = '';
    if (playins.length && auto.length === 4) {
        const feederFor = t => {
            const target = t.autoSlots + t.playinSlots / 2 + t.divRank;
            return playins.find(g =>
                (g.hi.divisionId === t.divisionId && g.hiRank === target) ||
                (g.lo.divisionId === t.divisionId && g.loRank === target));
        };
        const feeders = auto.map(feederFor);
        if (feeders.every(Boolean) && new Set(feeders).size === feeders.length) {
            matchedRound1 = BRACKET_PAIRS.map(([seedNo]) => {
                const t = auto[seedNo - 1];
                return {
                    html: gameCardHtml(teamRowHtml(`#${seedNo} ${t.owner}`, rec(t)), teamRowHtml('Play-in winner', null, true)),
                    children: [playinNode(feeders[seedNo - 1])]
                };
            });
            const t0 = auto[0], g0 = feeders[0];
            matchNote = ` Each auto qualifier faces the winner of the play-in that includes a team from its own division (${t0.divisionName} #${t0.divRank} faces the winner of ${g0.hi.divisionName} #${g0.hiRank} v ${g0.lo.divisionName} #${g0.loRank}).`;
        }
    }

    const champSeeds = [
        ...auto.map(t => ({ text: t.owner, sub: rec(t) })),
        ...playins.map(g => ({ text: 'Play-in winner', placeholder: true, feeder: playinNode(g) }))
    ].map((s, i) => ({ ...s, text: `#${i + 1} ${s.text}` }));
    const elimSeeds = [
        ...playins.map(() => ({ text: 'Play-in loser', placeholder: true })),
        ...rest.map(t => ({ text: t.owner, sub: rec(t) }))
    ].map((s, i) => ({ ...s, text: `#${i + 1} ${s.text}` }));

    const labelsFor = playinLabel => playins.length
        ? [playinLabel, 'Round 1', 'Round 2', 'Final']
        : ['Round 1', 'Round 2', 'Final'];
    return {
        championship: { labels: labelsFor('Play-In: winner advances'), seeds: champSeeds, root: matchedRound1 ? finishTree(matchedRound1) : (champSeeds.length === 8 ? buildEightTeamTree(champSeeds) : null) },
        elimination: { labels: ['Round 1', 'Round 2', 'Final'], seeds: elimSeeds, root: elimSeeds.length === 8 ? buildEightTeamTree(elimSeeds) : null },
        note: playins.length
            ? 'Projected from today\'s standings. Play-ins are cross-division (3v6 and 4v5 against the opposite division).' + matchNote + ' Bracket order follows 1v8 / 4v5 / 2v7 / 3v6 by overall auto seed; Gulag seeding (play-in losers first) is assumed.'
            : 'Projected from today\'s standings. Assumes standard 1v8 / 4v5 / 2v7 / 3v6 seeding.'
    };
}

function renderProjectedBracket(title, part, ui = BRACKET_UI_DEFAULT) {
    return part.root ? renderBracketCard(title, part.root, part.labels, ui) : renderSeedListCard(title, part.seeds, ui);
}

function renderBracket(name, bracketType, slots, ui = BRACKET_UI_DEFAULT) {
    if (!slots.length) return '';
    // Build a tree from the stored rounds: game k of round r is fed by games
    // 2k-1 and 2k of round r-1 (true of every stored bracket shape so far,
    // including the 2021 elimination bracket whose bye is its own slot).
    const byRound = new Map();
    slots.forEach(s => {
        if (!byRound.has(s.roundNumber)) byRound.set(s.roundNumber, []);
        byRound.get(s.roundNumber).push(s);
    });
    const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
    let previous = [];
    roundNumbers.forEach(rn => {
        const games = byRound.get(rn).sort((a, b) => a.slotInRound - b.slotInRound);
        const nodes = games.map((slot, i) => ({
            html: actualGameHtml(slot),
            children: rn === roundNumbers[0] ? [] : [previous[2 * i], previous[2 * i + 1]].filter(Boolean)
        }));
        previous = nodes;
    });

    const labels = roundNumbers.map((rn, i) =>
        roundNumbers.length > 1 && i === roundNumbers.length - 1 ? 'Final' : `Round ${rn}`);
    const label = `${name} Bracket${bracketType === 'elimination' ? ' (Elimination)' : ''}`;
    return previous.length === 1
        ? renderBracketCard(label, previous[0], labels, ui)
        : renderSeedListCard(label, [], ui);
}

function actualGameHtml(slot) {
    if (slot.note) {
        return gameCardHtml(teamRowHtml(slot.note, null, true), '').replace('pp-bracket-game"', 'pp-bracket-game br-note"');
    }
    if (slot.gameId == null || slot.team == null) {
        return gameCardHtml(teamRowHtml('Not yet linked', null, true), '');
    }
    const teamScore = Number(slot.teamScore);
    const opponentScore = Number(slot.opponentScore);
    const teamWon = teamScore > opponentScore;
    const fmt = n => (Number.isNaN(n) ? '-' : n.toFixed(2));
    return gameCardHtml(
        teamRowHtml(slot.team, fmt(teamScore), false, teamWon),
        teamRowHtml(slot.opponent, fmt(opponentScore), false, !teamWon));
}
