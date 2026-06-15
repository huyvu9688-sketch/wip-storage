/**
 * Main Application Entry Point
 * Initializes all modules in correct order
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('WIP Control System Initializing...');
    console.log('═══════════════════════════════════════════════════════');

    try {
        // Step 1: Initialize Shelf Locations (already auto-initialized)
        console.log('✓ Shelf Locations initialized (700 locations: A-01 to J-70)');

        // Step 2: Initialize Log Manager FIRST (database layer)
        if (typeof LogManager !== 'undefined') {
            await LogManager.init();
            console.log('✓ Log Manager initialized (IndexedDB ready)');
        } else {
            console.warn('⚠ Log Manager not found - logging disabled');
        }

        // Step 3: Initialize WIP Manager (loads from database)
        if (typeof WIPManager !== 'undefined') {
            await WIPManager.init();
            const cardCount = WIPManager.getCount();
            console.log(`✓ WIP Manager initialized (${cardCount} cards loaded)`);
        } else {
            console.error('✗ WIP Manager not found!');
        }

        // Step 4: Initialize UI Controller (renders the UI)
        if (typeof UIController !== 'undefined') {
            UIController.init();
            console.log('✓ UI Controller initialized');
        } else {
            console.error('✗ UI Controller not found!');
        }

        // Step 5: Initialize Navbar Controller
        if (typeof NavbarController !== 'undefined') {
            NavbarController.init();
            console.log('✓ Navbar Controller initialized');
        } else {
            console.warn('⚠ Navbar Controller not found');
        }

        // Step 6: Initialize Barcode Scanner
        if (typeof BarcodeScanner !== 'undefined') {
            BarcodeScanner.init();
            console.log('✓ Barcode Scanner initialized (USB mode)');
        } else {
            console.error('✗ Barcode Scanner not found!');
        }

        // Step 7: Initialize Reveal Animations
        initRevealAnimations();
        console.log('✓ Reveal animations initialized');

        // Step 8: Setup global keyboard shortcuts
        setupKeyboardShortcuts();
        console.log('✓ Keyboard shortcuts initialized');

        // Step 9: Setup auto-save interval (every 30 seconds)
        setupAutoSave();
        console.log('✓ Auto-save initialized (30s interval)');

        // Step 10: Check for overdue items
        checkOverdueItems();
        console.log('✓ Overdue check initialized');

        console.log('═══════════════════════════════════════════════════════');
        console.log('✓ WIP Control System Ready!');
        console.log('═══════════════════════════════════════════════════════');
        
        // Display system info
        displaySystemInfo();

    } catch (error) {
        console.error('═══════════════════════════════════════════════════════');
        console.error('✗ System initialization failed:', error);
        console.error('═══════════════════════════════════════════════════════');
        
        // Show user-friendly error message
        showInitError(error);
    }
});

/**
 * Initialize reveal animations using Intersection Observer
 */
function initRevealAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Don't unobserve - allow re-triggering if element scrolls out and back in
            }
        });
    }, observerOptions);

    // Observe all elements with 'reveal' class
    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });
}

/**
 * Setup keyboard shortcuts for power users
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Ctrl/Cmd + K - Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('searchMOInput');
            if (searchInput) {
                searchInput.focus();
                if (typeof UIController !== 'undefined') {
                    UIController.setMode('find');
                }
            }
        }

        // Ctrl/Cmd + N - Focus add MO
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            const addInput = document.getElementById('addMOInput');
            if (addInput) {
                addInput.focus();
                if (typeof UIController !== 'undefined') {
                    UIController.setMode('add');
                }
            }
        }

        // Escape - Clear search/add inputs
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('searchMOInput');
            const addInput = document.getElementById('addMOInput');
            
            if (searchInput && searchInput === document.activeElement) {
                searchInput.value = '';
                searchInput.blur();
            }
            if (addInput && addInput === document.activeElement) {
                addInput.value = '';
                addInput.blur();
            }
            
            // Clear hero panel if visible
            if (typeof UIController !== 'undefined' && UIController.heroPanelCards && UIController.heroPanelCards.length > 0) {
                UIController.clearHeroPanel();
            }
        }

        // Number keys 0-9 - Quick filter by line
        if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
            const lineIndex = parseInt(e.key);
            const lines = ['all', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
            
            if (lineIndex < lines.length && typeof UIController !== 'undefined') {
                UIController.filterByLine(lines[lineIndex]);
            }
        }

        // F - Toggle find mode
        if (e.key === 'f' || e.key === 'F') {
            if (typeof UIController !== 'undefined') {
                UIController.setMode('find');
            }
        }

        // A - Toggle add mode
        if (e.key === 'a' || e.key === 'A') {
            if (typeof UIController !== 'undefined') {
                UIController.setMode('add');
            }
        }
    });

    console.log('Keyboard shortcuts enabled:');
    console.log('  Ctrl/Cmd + K     - Focus search');
    console.log('  Ctrl/Cmd + N     - Focus add MO');
    console.log('  Escape           - Clear inputs');
    console.log('  0-9              - Filter by line');
    console.log('  F                - Find mode');
    console.log('  A                - Add mode');
}

/**
 * Setup auto-save interval
 */
function setupAutoSave() {
    // Save to localStorage every 30 seconds
    setInterval(() => {
        if (typeof WIPManager !== 'undefined') {
            WIPManager.saveToStorage();
            console.log('[Auto-save] Data saved to localStorage');
        }
    }, 30000); // 30 seconds
}

/**
 * Check for overdue items and show notification
 */
function checkOverdueItems() {
    if (typeof WIPManager === 'undefined') return;

    const checkOverdue = () => {
        const overdueByTier = WIPManager.getOverdueByTier();

        if (overdueByTier.total > 0) {
            console.warn(`⚠ ${overdueByTier.total} overdue items (3+ days):`);
            console.warn(`  🔴 ${overdueByTier.alert.length} alert`);
        }
    };

    // Check immediately
    checkOverdue();

    // Check every 5 minutes
    setInterval(checkOverdue, 5 * 60 * 1000);
}

/**
 * Display system information in console
 */
function displaySystemInfo() {
    if (typeof WIPManager === 'undefined') return;

    const stats = WIPManager.getStats();

    console.log('\n📊 System Statistics:');
    console.log('─────────────────────────────────────────────────────');
    console.log(`Total Cards: ${stats.total}`);
    console.log(`Overdue Cards: ${stats.overdue.total} (3+ days)`);
    console.log(`Average Time in Storage: ${stats.averageHoursInStorage} hours`);
    console.log('\nCards by Line:');
    
    Object.entries(stats.byLine).forEach(([line, count]) => {
        if (count > 0) {
            const color = ShelfLocations.getAreaColor(`${line}-01`);
            console.log(`  Line ${line}: ${count} cards (${color})`);
        }
    });
    
    console.log('─────────────────────────────────────────────────────\n');
}

/**
 * Show initialization error to user
 */
function showInitError(error) {
    const errorHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 9999;
            max-width: 500px;
            text-align: center;
        ">
            <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
            <h2 style="color: #DC2626; margin-bottom: 1rem;">System Initialization Failed</h2>
            <p style="color: #6B7280; margin-bottom: 1.5rem;">
                The WIP Storage System failed to initialize properly.
            </p>
            <pre style="
                background: #F3F4F6;
                padding: 1rem;
                border-radius: 0.5rem;
                text-align: left;
                overflow: auto;
                font-size: 0.875rem;
                color: #DC2626;
            ">${error.message}</pre>
            <button onclick="location.reload()" style="
                margin-top: 1.5rem;
                background: #0c0c09;
                color: white;
                padding: 0.75rem 2rem;
                border: none;
                border-radius: 0.5rem;
                cursor: pointer;
                font-weight: 500;
            ">Reload Page</button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', errorHTML);
}

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
});

/**
 * Global unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

/**
 * Page visibility change handler (for auto-save when user leaves tab)
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // User left the tab - save data
        if (typeof WIPManager !== 'undefined') {
            WIPManager.saveToStorage();
            console.log('[Visibility] Data saved (tab hidden)');
        }
    }
});

/**
 * Before unload handler (save data before page closes)
 */
window.addEventListener('beforeunload', () => {
    if (typeof WIPManager !== 'undefined') {
        WIPManager.saveToStorage();
        console.log('[Unload] Data saved before page close');
    }
});

/**
 * Console helper functions for debugging
 */
window.WIP = {
    // Get system info
    info: () => {
        displaySystemInfo();
    },
    
    // Get all cards
    cards: () => {
        if (typeof WIPManager !== 'undefined') {
            return WIPManager.getAll();
        }
        return [];
    },
    
    // Get stats
    stats: () => {
        if (typeof WIPManager !== 'undefined') {
            return WIPManager.getStats();
        }
        return null;
    },
    
    // Clear all data (with confirmation)
    clear: () => {
        if (typeof WIPManager !== 'undefined') {
            return WIPManager.clearAll();
        }
        return false;
    },
    
    // Search
    search: (term) => {
        if (typeof WIPManager !== 'undefined') {
            return WIPManager.search(term);
        }
        return [];
    },
    
    // Get overdue items
    overdue: () => {
        if (typeof WIPManager !== 'undefined') {
            return WIPManager.getOverdue();
        }
        return [];
    },
    
    // Simulate barcode scan (for testing)
    scan: (code) => {
        if (typeof BarcodeScanner !== 'undefined') {
            BarcodeScanner.simulateScan(code);
        }
    },
    
    // Get random shelf location
    randomShelf: () => {
        if (typeof ShelfLocations !== 'undefined') {
            return ShelfLocations.getRandom();
        }
        return null;
    },
    
    // Toggle continuous scan mode
    continuous: () => {
        if (typeof BarcodeScanner !== 'undefined') {
            return BarcodeScanner.toggleContinuousMode();
        }
        return false;
    },
    
    // Help
    help: () => {
        console.log(`
WIP Console Helper Commands:
═══════════════════════════════════════════════════════

WIP.info()          - Show system statistics
WIP.cards()         - Get all cards
WIP.stats()         - Get detailed statistics
WIP.clear()         - Clear all data (with confirmation)
WIP.search(term)    - Search for cards
WIP.overdue()       - Get overdue cards (>24h)
WIP.scan(code)      - Simulate barcode scan
WIP.randomShelf()   - Get random shelf location
WIP.continuous()    - Toggle continuous scan mode
WIP.help()          - Show this help

Keyboard Shortcuts:
───────────────────────────────────────────────────────
Ctrl/Cmd + K       - Focus search
Ctrl/Cmd + N       - Focus add MO
Escape             - Clear inputs
0-9                - Filter by line
F                  - Find mode
A                  - Add mode

═══════════════════════════════════════════════════════
        `);
    }
};

// Show help on first load
console.log('\n💡 Tip: Type WIP.help() for console commands\n');
