// Division Page JavaScript
console.log('Grass Touchers FFL - Division Page Loaded');

// Load Championship Chips
async function loadChampionshipChips() {
    const container = document.getElementById('championshipChips');
    if (!container) return; // Only run if on past-seasons page
    
    try {
        const [placementsData, divisionsData, accoladesData] = await Promise.all([
            LeagueDb.placements(),
            LeagueDb.divisions(),
            LeagueDb.accolades()
        ]);
        
        // Accolade colors
        const accoladeColors = {
            "All-Play Champion": "#27ae60",
            "Division Champion": "#3498db",
            "In-Season Champion": "#9b59b6",
            "Points Champion": "#f39c12"
        };
        
        // Filter for champions (place === 1)
        const champions = placementsData.seasonPlacements
            .map(season => {
                const champion = season.placements.find(p => p.place === 1);
                const teamName = champion.team.replace('*', '');
                const leagueName = divisionsData[season.year]?.["League Name"] || "Grass Touchers FFL";
                const stripeColor = leagueName === "Roll Chos FFL" ? "#003466" : "#3B7A57";
                
                // Count championships for this team up to and including this year
                const starCount = placementsData.seasonPlacements
                    .filter(s => s.year <= season.year)
                    .filter(s => {
                        const champ = s.placements.find(p => p.place === 1);
                        return champ.team.replace('*', '') === teamName;
                    }).length;
                
                // Find accolades for this champion
                const yearAccolades = accoladesData.awards.find(a => a.year === season.year);
                const championAccolades = [];
                if (yearAccolades) {
                    ["All-Play Champion", "Division Champion", "In-Season Champion", "Points Champion"].forEach(award => {
                        if (yearAccolades.results.some(r => r.award === award && r.winner === teamName)) {
                            championAccolades.push(award);
                        }
                    });
                }
                
                return {
                    year: season.year,
                    team: champion.team,
                    teamName: teamName,
                    stripeColor: stripeColor,
                    accolades: championAccolades,
                    starCount: starCount
                };
            })
            .reverse(); // Display newest to oldest
        
        // Create chips using PNG banner images
        container.innerHTML = champions.map(champ => {
            return `
                <div class="champion-chip">
                    <img src="../assets/banners/${champ.year}_champ.png" 
                         alt="${champ.year} Champion - ${champ.teamName}" 
                         class="chip-banner-img">
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading championship data:', error);
        container.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center;">Unable to load championship history.</p>';
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', loadChampionshipChips);
