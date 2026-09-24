// Mobile helpers, loaded on every page:
//  1. a menu button for the navbar (the links are hidden on phones)
//  2. data-label attributes on table cells, so the tables can be shown as stacked cards on phones
(function () {
    // ---- 1. navbar menu ----
    function initNav() {
        const nav = document.querySelector('.navbar');
        const container = nav && nav.querySelector('.nav-container');
        if (!container || container.querySelector('.nav-toggle')) return;
        const button = document.createElement('button');
        button.className = 'nav-toggle';
        button.type = 'button';
        button.setAttribute('aria-label', 'Menu');
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = '<span></span><span></span><span></span>';
        container.appendChild(button);
        button.addEventListener('click', () => {
            const open = nav.classList.toggle('open');
            button.setAttribute('aria-expanded', String(open));
        });
        nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
    }

    // ---- 2. table cards ----
    // Matrices, and the Game Details roster / analysis tables (side-by-side layouts) stay real tables.
    const SKIP = '.hp-heat, .hp-matrix, .hp-rec-table, .hp-compare, .hp-dist-table, .heat-matrix-table, .roster-table, .position-stats-table, .optimization-table';
    function labelTables() {
        document.querySelectorAll('table').forEach(table => {
            if (table.matches(SKIP) || !table.tBodies.length) return;
            const headRows = table.tHead ? table.tHead.rows : [];
            if (!headRows.length) return;
            const headers = [...headRows[headRows.length - 1].cells].map(th => {
                const first = [...th.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
                return (th.getAttribute('data-label') || (first ? first.textContent : th.textContent)).trim();
            });
            let touched = false;
            [...table.tBodies[0].rows].forEach(row => {
                [...row.cells].forEach((cell, i) => {
                    if (!cell.hasAttribute('data-label') && headers[i] !== undefined) { cell.setAttribute('data-label', headers[i]); touched = true; }
                });
            });
            if (!table.classList.contains('m-cards')) table.classList.add('m-cards');
            return touched;
        });
    }

    let timer;
    function schedule() { clearTimeout(timer); timer = setTimeout(labelTables, 50); }

    document.addEventListener('DOMContentLoaded', () => {
        initNav();
        labelTables();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    });
})();
