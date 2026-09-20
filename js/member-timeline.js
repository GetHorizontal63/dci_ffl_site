// Member Timeline
// Built from the seasons each manager actually played (games or division membership),
// so current members show as active and "Bye" is not treated as a member.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const rows = await LeagueDb.query(`
            SELECT display_name AS name, season FROM (
                SELECT o.display_name, m.season
                FROM matchup_team_stats s
                JOIN matchups m ON m.game_id = s.game_id
                JOIN owners o ON o.owner_id = s.owner_id
                UNION
                SELECT o.display_name, d.season
                FROM division_members dm
                JOIN divisions d ON d.division_id = dm.division_id
                JOIN owners o ON o.owner_id = dm.owner_id
            )
            WHERE LOWER(display_name) <> 'bye'
            ORDER BY display_name, season`);

        const seasonsBy = new Map();
        rows.forEach(r => {
            if (!seasonsBy.has(r.name)) seasonsBy.set(r.name, []);
            seasonsBy.get(r.name).push(r.season);
        });
        const allSeasons = rows.map(r => r.season);
        const firstSeason = Math.min(...allSeasons);
        const latestSeason = Math.max(...allSeasons);

        const members = [...seasonsBy.entries()].map(([name, seasons]) => {
            // Consecutive seasons become one bar, so a break in tenure shows as a gap.
            const runs = [];
            seasons.forEach(s => {
                const last = runs[runs.length - 1];
                if (last && s === last.end + 1) last.end = s; else runs.push({ start: s, end: s });
            });
            return { name, seasons, runs, first: seasons[0], last: seasons[seasons.length - 1] };
        }).sort((a, b) => a.first - b.first || a.name.localeCompare(b.name));

        const years = Array.from({ length: latestSeason - firstSeason + 1 }, (_, i) => firstSeason + i);
        renderTimeline(members, years, latestSeason);
    } catch (error) {
        console.error('Error loading timeline:', error);
        document.getElementById('hp-content').innerHTML = '<div class="hp-error">Failed to load timeline data.</div>';
    }
});

function renderTimeline(members, years, latestSeason) {
    const startYear = years[0];
    const totalYears = years.length;

    const rows = members.map(member => {
        const isActive = member.last === latestSeason;
        const bars = member.runs.map(run => {
            const runActive = run.end === latestSeason;
            const left = ((run.start - startYear) / totalYears) * 100;
            const width = ((run.end - run.start + 1) / totalYears) * 100;
            const label = run.start === run.end ? run.start : `${run.start}-${run.end}`;
            return `<div class="hp-tl-bar ${runActive ? 'on' : 'off'}" style="left: ${left}%; width: ${width}%;" title="${member.name}: ${label}${runActive ? ' (active)' : ''}"></div>`;
        }).join('');
        return `
            <div class="hp-tl-row">
                <div class="hp-tl-name${isActive ? '' : ' gone'}">${member.name}<small>${member.seasons.length}yr</small></div>
                <div class="hp-tl-track" style="--years: ${totalYears}">${bars}</div>
            </div>`;
    }).join('');

    const activeCount = members.filter(m => m.last === latestSeason).length;
    const founderCount = members.filter(m => m.first === startYear).length;

    document.getElementById('hp-content').innerHTML = `
        <div class="hp-panel">
            <h2 class="hp-panel-title">Member Timeline<small><span class="hp-key on"></span>Active <span class="hp-key off"></span>Not in league</small></h2>
            <div class="hp-tl">
                <div class="hp-tl-row hp-tl-axis">
                    <div class="hp-tl-name">Member</div>
                    <div class="hp-tl-years" style="--years: ${totalYears}">${years.map(y => `<span>${y}</span>`).join('')}</div>
                </div>
                <div class="hp-tl-rows">${rows}</div>
            </div>
            <p class="hp-note"><strong>${members.length}</strong> total members &middot; <strong>${activeCount}</strong> currently active &middot; <strong>${founderCount}</strong> founding members</p>
        </div>`;
}
