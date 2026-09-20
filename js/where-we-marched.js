// Load and display DCI corps data
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await LeagueDb.dci();
        
        // Extract the corps data
        const worldClass = data.DCI_Corps.World_Class || [];
        const openClass = data.DCI_Corps.Open_Class || [];
        const allAge = data.DCI_Corps.All_Age || [];
        
        // Sort each class alphabetically by name
        worldClass.sort((a, b) => a.name.localeCompare(b.name));
        openClass.sort((a, b) => a.name.localeCompare(b.name));
        if (allAge.length > 0) {
            allAge.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        // Render each section
        renderCorpsSection('world-class-grid', worldClass);
        renderCorpsSection('open-class-grid', openClass);
        renderCorpsSection('all-age-grid', allAge);
        
        // After rendering, equalize card heights
        equalizeCardHeights();
        
    } catch (error) {
        console.error('Error loading DCI data:', error);
        showError();
    }
});

/**
 * Render a section of corps cards
 */
function renderCorpsSection(gridId, corpsArray) {
    const grid = document.getElementById(gridId);
    
    if (!grid) {
        console.error(`Grid element not found: ${gridId}`);
        return;
    }
    
    // Clear loading message
    grid.innerHTML = '';
    
    // If no corps data, show message
    if (!corpsArray || corpsArray.length === 0) {
        grid.innerHTML = '<div class="loading-message">No corps data available</div>';
        return;
    }
    
    // Create cards for each corps
    corpsArray.forEach(corps => {
        const card = createCorpsCard(corps);
        grid.appendChild(card);
    });
}

/**
 * Create a card for a single corps
 */
function createCorpsCard(corps) {
    const card = document.createElement('div');
    card.className = 'corps-card';
    
    // Add no-members class if no members
    const hasMembers = corps.members && corps.members.trim() !== '';
    if (!hasMembers) {
        card.classList.add('no-members');
    }
    
    // Logo
    const logo = document.createElement('img');
    logo.className = 'corps-logo';
    logo.src = `../assets/icons/dci-logos/${corps.abbreviation.toLowerCase()}.png`;
    logo.alt = `${corps.name} Logo`;
    logo.onerror = function() {
        // Fallback to generic DCI logo if specific logo not found
        this.src = '../assets/icons/dci-logos/dci.png';
    };
    
    // Corps name
    const name = document.createElement('div');
    name.className = 'corps-name';
    name.textContent = corps.name;
    
    // Assemble card
    card.appendChild(logo);
    card.appendChild(name);
    
    // Add members list if there are members
    if (hasMembers) {
        const membersList = document.createElement('div');
        membersList.className = 'members-list';
        
        const membersTitle = document.createElement('div');
        membersTitle.className = 'members-title';
        membersTitle.textContent = 'Members';
        
        const memberNames = document.createElement('div');
        memberNames.className = 'member-names';
        
        // Split members by comma and create individual elements
        const membersArray = corps.members.split(',').map(m => m.trim()).filter(m => m);
        membersArray.forEach(member => {
            const memberElement = document.createElement('div');
            memberElement.className = 'member-name';
            memberElement.textContent = member;
            memberNames.appendChild(memberElement);
        });
        
        membersList.appendChild(membersTitle);
        membersList.appendChild(memberNames);
        card.appendChild(membersList);
    }
    
    return card;
}

/**
 * Equalize the heights of all corps cards to match the tallest
 */
function equalizeCardHeights() {
    // Get all corps cards
    const cards = document.querySelectorAll('.corps-card');
    
    if (cards.length === 0) return;
    
    // Reset heights first
    cards.forEach(card => {
        card.style.height = 'auto';
    });
    
    // Find the tallest card
    let maxHeight = 0;
    cards.forEach(card => {
        const height = card.offsetHeight;
        if (height > maxHeight) {
            maxHeight = height;
        }
    });
    
    // Set all cards to the max height
    cards.forEach(card => {
        card.style.height = `${maxHeight}px`;
    });
}

/**
 * Show error message if data fails to load
 */
function showError() {
    const grids = ['world-class-grid', 'open-class-grid', 'all-age-grid'];
    grids.forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (grid) {
            grid.innerHTML = '<div class="loading-message">Error loading data. Please try again later.</div>';
        }
    });
}

// Re-equalize heights on window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        equalizeCardHeights();
    }, 250);
});
