// Play-Off Picture Page
// This page lives under the Current Season section and shows the current
// season's playoff picture only — no other-season browsing here (that's
// what Past Seasons / Record Book are for).

document.addEventListener('DOMContentLoaded', async () => {
    const content = document.getElementById('pp-content');
    try {
        const allSeasons = await LeagueDb.seasons();
        if (!allSeasons.length) {
            content.innerHTML = '<div class="empty-state">No seasons on record.</div>';
            return;
        }
        const currentSeason = allSeasons[0];
        const data = await LeagueDb.playoffPicture(currentSeason);
        renderPlayoffPicture(data, currentSeason);
    } catch (err) {
        console.error(err);
        content.innerHTML = '<div class="error-state">Error loading playoff data.</div>';
    }
});

function infoBar(items) {
    return `<div class="pp-info">${items.map(i => `
        <div class="pp-info-item${i.wide ? ' pp-info-wide' : ''}">
            <span class="pp-info-label">${i.label}</span>
            <span class="pp-info-value">${i.value}</span>
        </div>`).join('')}</div>`;
}

function renderPlayoffPicture(data, season) {
    const content = document.getElementById('pp-content');
    const { rules, qualifiers, bracket, placements, standings, divisionStandings, divisionSlots } = data;

    if (!rules) {
        content.innerHTML = '<div class="empty-state">No playoff format on record for this season.</div>';
        return;
    }

    if (!qualifiers.length) {
        // Season in progress: no qualifiers or bracket games exist yet, so
        // project the brackets from today's standings and show each division's
        // live standings underneath.
        if (!(divisionStandings && divisionStandings.length && divisionSlots && divisionSlots.length)) {
            content.innerHTML = renderStandingsCard(standings, rules.playoff_team_count);
            return;
        }
        const proj = buildProjection(data);
        content.innerHTML = `
            <div class="pp-brackets-row">
                ${renderProjectedBracket('Championship Bracket (Projected)', proj.championship)}
                ${renderProjectedBracket('Gulag Bracket (Projected)', proj.elimination)}
            </div>
            ${renderDivisionStandingsCard(divisionStandings, divisionSlots)}
        `;
        return;
    }

    // Brackets can vary in count/shape by season (a play-in bracket only
    // exists some years), so group by whatever's actually there instead of
    // assuming exactly "Championship" + "Gulag".
    const bracketNames = [...new Set(bracket.map(b => b.bracket))];
    const bracketCards = bracketNames.map(name => {
        const slots = bracket.filter(b => b.bracket === name);
        return renderBracket(name, slots[0]?.bracketType, slots);
    }).join('');
    content.innerHTML = `
        ${infoBar([{ label: 'Season', value: season }, { label: 'Status', value: 'Final' }])}
        ${bracketCards ? `<div class="pp-brackets-row">${bracketCards}</div>` : ''}
        ${renderQualifiersCard(qualifiers)}
        ${placements.length ? renderPlacementsCard(placements) : ''}
    `;
}

function fmtPd(n) {
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
}

function renderStandingsCard(standings, cutoff) {
    if (!standings.length) {
        return `
            <div class="pp-card">
                <h2 class="pp-card-title">Current Standings</h2>
                <div class="pp-empty-note">No games played yet this season.</div>
            </div>
        `;
    }

    const cutoffIndex = Math.min(cutoff, standings.length) - 1;
    const cutoffTeam = standings[cutoffIndex];
    const currentWeek = Math.max(...standings.map(s => s.gamesPlayed));

    const rows = standings.map((s, i) => {
        const rank = i + 1;
        const isIn = rank <= cutoff;
        const gamesBack = isIn ? null
            : ((Number(cutoffTeam.wins) - Number(s.wins)) + (Number(s.losses) - Number(cutoffTeam.losses))) / 2;
        const record = `${s.wins}-${s.losses}${Number(s.ties) ? `-${s.ties}` : ''}`;
        return `
            <div class="pp-standing-row${isIn ? ' pp-in' : ' pp-out'}${rank === cutoff ? ' pp-cutoff-line' : ''}">
                <span class="pp-standing-rank">${rank}</span>
                <span class="pp-standing-owner">${s.owner}</span>
                <span class="pp-standing-record">${record}</span>
                <span class="pp-standing-pd">${fmtPd(Number(s.pointsFor) - Number(s.pointsAgainst))}</span>
                <span class="pp-standing-pf">${Number(s.pointsFor).toFixed(2)}</span>
                <span class="pp-standing-gb">${gamesBack == null ? '' : gamesBack.toFixed(1)}</span>
                <span class="pp-standing-badge ${isIn ? 'pp-badge-in' : 'pp-badge-out'}">${isIn ? 'IN' : 'OUT'}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="pp-card">
            <h2 class="pp-card-title">Current Standings — If the Season Ended Today</h2>
            <p class="pp-standing-note">Top ${cutoff} make the playoffs. ${currentWeek} week${currentWeek === 1 ? '' : 's'} played.</p>
            <div class="pp-standing-list">${rows}</div>
        </div>
    `;
}

// Per-division "if the season ended today". Every format this league has used
// (other than a single 15-team pool, which is just one division here) decides
// qualification within each division, so ranking all teams together can name
// the wrong teams as "in". Tiers come from playoff_division_slots: top
// auto_slots go straight to the Championship bracket, the next playin_slots
// play a play-in game, and anyone left drops to the Gulag (or is simply out
// when there's no play-in tier).
function renderDivisionStandingsCard(divisionStandings, divisionSlots) {
    const slotsByDivision = new Map(divisionSlots.map(s => [s.divisionId, s]));
    const divisions = new Map();
    divisionStandings.forEach(row => {
        if (!divisions.has(row.divisionId)) divisions.set(row.divisionId, { name: row.divisionName, teams: [] });
        divisions.get(row.divisionId).teams.push(row);
    });

    const sections = [...divisions.entries()].map(([divisionId, div]) => {
        const slots = slotsByDivision.get(divisionId) || { autoSlots: 0, playinSlots: 0 };
        const auto = Number(slots.autoSlots);
        const playin = Number(slots.playinSlots);
        const teams = div.teams; // already ranked per the season's tiebreak (see league-db.js)

        const rows = teams.map((t, i) => {
            const rank = i + 1;
            let tier = 'out';
            let badge = playin ? 'GULAG' : 'OUT';
            if (rank <= auto) { tier = 'in'; badge = 'IN'; }
            else if (rank <= auto + playin) { tier = 'playin'; badge = 'PLAY-IN'; }

            // Games back from the last team in the tier above.
            let gb = '';
            if (tier !== 'in') {
                const target = teams[(tier === 'playin' ? auto : auto + playin) - 1];
                if (target) {
                    const diff = ((Number(target.wins) - Number(t.wins)) + (Number(t.losses) - Number(target.losses))) / 2;
                    gb = diff.toFixed(1);
                }
            }
            const boundary = rank === auto || (playin && rank === auto + playin);
            const record = `${t.wins}-${t.losses}${Number(t.ties) ? `-${t.ties}` : ''}`;
            return `
                <div class="pp-standing-row pp-${tier}${boundary ? ' pp-cutoff-line' : ''}">
                    <span class="pp-standing-rank">${rank}</span>
                    <span class="pp-standing-owner">${t.owner}</span>
                    <span class="pp-standing-record">${record}</span>
                    <span class="pp-standing-pd">${fmtPd(Number(t.pointsFor) - Number(t.pointsAgainst))}</span>
                    <span class="pp-standing-pf">${Number(t.pointsFor).toFixed(2)}</span>
                    <span class="pp-standing-gb">${gb}</span>
                    <span class="pp-standing-badge pp-badge-${tier}">${badge}</span>
                </div>
            `;
        }).join('');

        const rule = playin
            ? `Top ${auto} clinch the Championship bracket if the season ended today; next ${playin} play in; the rest drop to the Gulag.`
            : `Top ${auto} make the Championship bracket if the season ended today.`;
        return `
            <div class="pp-card pp-division">
                <h2 class="pp-card-title">${div.name}</h2>
                <p class="pp-standing-note">${rule}</p>
                <div class="pp-standing-list">
                    <div class="pp-standing-head"><span>#</span><span>Team</span><span>W-L</span><span>PD</span><span>PF</span><span>GB</span><span>Status</span></div>
                    ${rows}
                </div>
            </div>
        `;
    }).join('');

    return `<div class="pp-divisions-row">${sections}</div>`;
}

function renderQualifiersCard(qualifiers) {
    // Group by bracket (Championship / Play-In / Gulag) rather than assuming
    // everyone qualified for a single bracket -- the play-in and elimination
    // fields are qualifiers too, just for a different bracket.
    const groups = new Map();
    qualifiers.forEach(q => {
        const key = q.bracket || 'Qualifiers';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(q);
    });

    const sectionsHtml = [...groups.entries()].map(([bracketName, group]) => {
        const rows = group.map(q => `
            <div class="pp-seed-row">
                <span class="pp-seed-num">${q.seed ?? '-'}</span>
                <span class="pp-seed-owner">${q.owner}</span>
                <span class="pp-seed-reason">${q.reason}${q.week ? ` (through week ${q.week})` : ''}</span>
            </div>
        `).join('');
        return `
            <div class="pp-seed-group">
                <h3 class="pp-seed-group-title">${bracketName}</h3>
                <div class="pp-seed-list">${rows}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="pp-card">
            <h2 class="pp-card-title">Qualifiers</h2>
            ${sectionsHtml}
        </div>
    `;
}

function renderPlacementsCard(placements) {
    const rows = placements.map(p => `
        <div class="pp-place-row${p.place <= 3 ? ' pp-podium' : ''}">
            <span class="pp-place-num">${p.place}</span>
            <span class="pp-place-owner">${p.owner || 'Unknown'}${p.note || ''}</span>
        </div>
    `).join('');
    return `
        <div class="pp-card">
            <h2 class="pp-card-title">Final Standings</h2>
            <div class="pp-place-list">${rows}</div>
        </div>
    `;
}
