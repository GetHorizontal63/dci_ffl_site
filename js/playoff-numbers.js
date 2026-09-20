// Magic / elimination numbers, shared by the Current Season standings and the
// Standings History page. Plain script: everything here is a global.
//
// Per division a season has `autoSlots` spots that go straight to the
// Championship bracket and `playinSlots` further spots that make the playoff
// field through a play-in game (0 in most seasons); everyone else is out of it.
//
// teams: one division, already sorted best to worst. Returns one descriptor
// per team:
//   inside the auto spots      -> magic number to clinch an auto spot
//   inside the play-in spots   -> magic number to clinch a spot in the playoff
//                                 field (starred: a play-in berth, not a bracket berth)
//   outside the playoff field  -> elimination number from the playoff field
//
// Magic = (k-th best rival's best possible wins) - my wins + 1: the wins by me
// plus losses by that rival needed to finish ahead of them.
// Elim  = (my best possible wins) - (k-th best rival's wins) + 1: my losses plus
// that rival's wins needed to finish behind them.
// A tie is never enough to clinch or eliminate (tiebreakers aren't modeled), so
// the numbers are conservative.
function playoffNumbers(teams, games, autoSlots, playinSlots) {
    if (!games) return teams.map(() => ({ kind: 'none' }));
    const field = autoSlots + playinSlots;
    const rec = teams.map(t => ({ w: t.wins + 0.5 * t.ties, l: t.losses + 0.5 * t.ties }));
    const kth = (values, k) => [...values].sort((a, b) => b - a)[k - 1];

    return teams.map((_, i) => {
        const rank = i + 1;
        const others = rec.filter((_, j) => j !== i);
        const me = rec[i];

        if (rank > field) {
            if (others.length < field) return { kind: 'none' };
            const rival = kth(others.map(o => o.w), field);
            const n = Math.ceil((games - me.l) - rival + 1);
            return n <= 0 ? { kind: 'eliminated' } : { kind: 'elim', n };
        }

        const spots = rank <= autoSlots ? autoSlots : field;
        const starred = rank > autoSlots;
        if (others.length < spots) return { kind: 'clinched', starred };
        const rivalBest = kth(others.map(o => games - o.l), spots);
        const n = Math.ceil(rivalBest - me.w + 1);
        return n <= 0 ? { kind: 'clinched', starred } : { kind: 'magic', n, starred };
    });
}

function playoffNumberCell(c) {
    const star = c.starred ? '*' : '';
    switch (c.kind) {
        case 'magic':
            return `<span style="color:#4ade80;font-weight:600" title="Magic number${c.starred ? ' (playoff field, not a bracket berth)' : ''}">M ${c.n}${star}</span>`;
        case 'clinched':
            return `<span style="color:#4ade80;font-weight:700" title="Clinched">&#10003;${star}</span>`;
        case 'elim':
            return `<span style="color:#f87171;font-weight:600" title="Elimination number">E ${c.n}</span>`;
        case 'eliminated':
            return `<span style="color:#f87171;font-weight:700" title="Eliminated from the playoff field">Elim</span>`;
        default:
            return '-';
    }
}
