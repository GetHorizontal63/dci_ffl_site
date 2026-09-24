// FP+ and roster efficiency for one team-week, defined exactly as in the Game Log (js/game-search.js).
//   FP+        = points scored by the starters / their projected points
//   Efficiency = points scored by the starters / points had every bench player who beat a same-position starter swapped in
const RosterMetrics = (() => {
    const isBench = p => p.slotPosition === 'BE' || p.slotPosition === 'IR';

    function weekOf(roster) {
        const active = roster.filter(p => !isBench(p));
        const bench = roster.filter(isBench);
        const actual = active.reduce((s, p) => s + (parseFloat(p.actualPoints) || 0), 0);
        const projected = active.reduce((s, p) => s + (parseFloat(p.projectedPoints) || 0), 0);

        const options = [];
        const emptyChecked = new Set();
        bench.forEach(b => {
            const benchPts = parseFloat(b.actualPoints) || 0;
            if (benchPts <= 0) return;
            const same = active.filter(p => p.position === b.position);
            same.forEach(a => {
                const activePts = parseFloat(a.actualPoints) || 0;
                if (benchPts > activePts) options.push({ bench: b, active: a, gain: benchPts - activePts });
            });
            if (!same.length && !emptyChecked.has(b.position)) {
                options.push({ bench: b, active: null, gain: benchPts });
                emptyChecked.add(b.position);
            }
        });
        options.sort((x, y) => y.gain - x.gain);

        const usedBench = new Set();
        const usedActive = new Set();
        let gain = 0;
        options.forEach(o => {
            if (usedBench.has(o.bench.playerId)) return;
            if (o.active && usedActive.has(o.active.playerId)) return;
            usedBench.add(o.bench.playerId);
            if (o.active) usedActive.add(o.active.playerId);
            gain += o.gain;
        });
        return { actual, projected, optimal: actual + gain };
    }

    return { weekOf };
})();
