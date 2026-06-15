/**
 * WIP Manager - COMPLETE VERSION with Multiple MOs Support
 */

const WIPManager = {
    cards: [],
    cardIdCounter: 0,
    OVERDUE_THRESHOLD_HOURS: 72,
    MAX_MOS_PER_CARD: 3,

    /**
     * Create a new WIP card (or add MO to existing card if shelf exists)
     * MO number is REQUIRED - no blank cards allowed
     */
    createCard(shelfCode, moNumber) {
        // CRITICAL: MO number is required
        if (!moNumber || typeof moNumber !== 'string' || moNumber.trim() === '') {
            console.error('Cannot create card: MO number is required');
            BarcodeScanner.showScanFeedback('❌ MO number is required!', 'error');
            return null;
        }

        const trimmedMO = moNumber.trim();
        
        if (!trimmedMO) {
            console.error('Cannot create card: MO number cannot be blank');
            BarcodeScanner.showScanFeedback('❌ MO number cannot be blank!', 'error');
            return null;
        }

        // Check for duplicate MO globally
        if (this.isDuplicateMO(trimmedMO)) {
            console.warn(`Duplicate MO detected: ${trimmedMO}`);
            return null;
        }

        // Check if card already exists at this shelf
        const existingCard = this.cards.find(c => c.shelfCode === shelfCode);

        if (existingCard) {
            // Ensure moNumbers array exists (migration from old format)
            if (!existingCard.moNumbers) {
                existingCard.moNumbers = existingCard.moNumber ? [existingCard.moNumber] : [];
            }

            // Add MO to existing card if space available
            if (existingCard.moNumbers.length >= this.MAX_MOS_PER_CARD) {
                console.warn(`Card at ${shelfCode} is full (max ${this.MAX_MOS_PER_CARD} MOs)`);
                return null;
            }

            existingCard.moNumbers.push(trimmedMO);
            this.saveToStorage();

            // Log the addition
            if (typeof LogManager !== 'undefined') {
                LogManager.writeLog('ADD_MO', existingCard, null, trimmedMO);
            }

            console.log(`✓ Added MO ${trimmedMO} to existing card at ${shelfCode}`);
            return existingCard;
        }

        // Create new card
        const shelfName = ShelfLocations.getName(shelfCode);
        const cardId = `card-${this.cardIdCounter++}`;
        
        const now = new Date();
        const timestamp = now.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const areaColor = ShelfLocations.getAreaColor(shelfCode);

        const card = {
            id: cardId,
            shelfCode,
            shelfName,
            moNumbers: [trimmedMO], // Array of MO numbers (must have at least 1)
            timestamp,
            createdAt: now.toISOString(),
            areaColor
        };

        this.cards.push(card);
        this.saveToStorage();
        
        if (typeof LogManager !== 'undefined') {
            LogManager.writeLog('ADD', card);
        }
        
        console.log(`✓ Created new card: ${trimmedMO} at ${shelfCode}`);
        return card;
    },

    /**
     * Add MO to existing card
     */
    addMOToCard(cardId, moNumber) {
        const card = this.cards.find(c => c.id === cardId);
        
        if (!card) {
            console.error('Card not found:', cardId);
            return false;
        }

        if (this.isDuplicateMO(moNumber)) {
            console.warn(`Duplicate MO detected: ${moNumber}`);
            return false;
        }

        // Ensure moNumbers array exists (migration)
        if (!card.moNumbers) {
            card.moNumbers = card.moNumber ? [card.moNumber] : [];
        }

        if (card.moNumbers.length >= this.MAX_MOS_PER_CARD) {
            console.warn(`Card is full (max ${this.MAX_MOS_PER_CARD} MOs)`);
            return false;
        }

        card.moNumbers.push(moNumber);
        this.saveToStorage();

        if (typeof LogManager !== 'undefined') {
            LogManager.writeLog('ADD_MO', card, null, moNumber);
        }

        console.log(`✓ Added MO ${moNumber} to card ${cardId}`);
        return true;
    },

    /**
     * Remove specific MO from card
     */
    removeMOFromCard(cardId, moNumber) {
        const card = this.cards.find(c => c.id === cardId);
        
        if (!card) {
            console.error('Card not found:', cardId);
            return false;
        }

        // Ensure moNumbers array exists
        if (!card.moNumbers) {
            card.moNumbers = card.moNumber ? [card.moNumber] : [];
        }

        const index = card.moNumbers.indexOf(moNumber);
        if (index === -1) {
            console.error('MO not found in card:', moNumber);
            return false;
        }

        card.moNumbers.splice(index, 1);

        // If no MOs left, remove the entire card
        if (card.moNumbers.length === 0) {
            this.removeCard(cardId);
            console.log(`✓ Removed last MO, card deleted: ${cardId}`);
        } else {
            this.saveToStorage();
            
            if (typeof LogManager !== 'undefined') {
                LogManager.writeLog('REMOVE_MO', card, null, moNumber);
            }
            
            console.log(`✓ Removed MO ${moNumber} from card ${cardId}`);
        }

        return true;
    },

    /**
     * Remove a card by ID
     */
    removeCard(cardId) {
        const removedCard = this.cards.find(c => c.id === cardId);
        
        if (removedCard && typeof LogManager !== 'undefined') {
            const addTime = new Date(removedCard.createdAt);
            const removeTime = new Date();
            const duration = this.calculateDuration(addTime, removeTime);
            
            LogManager.writeLog('REMOVE', removedCard, duration);
        }
        
        this.cards = this.cards.filter(card => card.id !== cardId);
        this.saveToStorage();
        
        console.log(`✓ Removed card: ${cardId}`);
    },

    /**
     * Calculate duration between two dates
     */
    calculateDuration(startDate, endDate) {
        const diff = endDate - startDate;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            return `${days}d ${remainingHours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    },

    /**
     * Clear all cards
     */
    clearAll() {
        if (this.cards.length === 0) return false;
        
        if (confirm('Bạn có chắc muốn xóa tất cả sản phẩm?')) {
            if (typeof LogManager !== 'undefined') {
                const now = new Date();
                this.cards.forEach(card => {
                    const addTime = new Date(card.createdAt);
                    const duration = this.calculateDuration(addTime, now);
                    LogManager.writeLog('REMOVE', card, duration);
                });
            }
            
            this.cards = [];
            this.saveToStorage();
            return true;
        }
        return false;
    },

    /**
     * Check if MO exists in any card
     */
    isDuplicateMO(moNumber) {
        const upperMO = moNumber.toUpperCase().trim();
        return this.cards.some(card => {
            const moNumbers = card.moNumbers || (card.moNumber ? [card.moNumber] : []);
            return moNumbers.some(mo => mo.toUpperCase().trim() === upperMO);
        });
    },

    /**
     * Get card by MO number
     */
    getByMO(moNumber) {
        const upperMO = moNumber.toUpperCase().trim();
        return this.cards.find(card => {
            const moNumbers = card.moNumbers || (card.moNumber ? [card.moNumber] : []);
            return moNumbers.some(mo => mo.toUpperCase().trim() === upperMO);
        }) || null;
    },

    /**
     * Search cards by MO number or shelf code
     * Returns ONLY the matching MOs, not entire cards
     */
    search(searchTerm) {
        const term = searchTerm.toUpperCase().trim();
        const results = [];
        
        this.cards.forEach(card => {
            const moNumbers = card.moNumbers || (card.moNumber ? [card.moNumber] : []);
            const shelfMatch = card.shelfCode.toUpperCase().trim() === term;
            
            if (shelfMatch) {
                // If searching by shelf code, return entire card with all MOs
                results.push(card);
            } else {
                // If searching by MO, check each MO in the card
                const matchingMOs = moNumbers.filter(mo => 
                    mo.toUpperCase().trim() === term
                );
                
                if (matchingMOs.length > 0) {
                    // Create a filtered card containing ONLY the matching MO(s)
                    results.push({
                        ...card,
                        moNumbers: matchingMOs // Only the searched MO
                    });
                }
            }
        });
        
        return results;
    },

    /**
     * Get cards by line
     */
    getByLine(line) {
        return this.cards.filter(card => card.shelfCode.startsWith(line + '-'));
    },

    /**
     * Get cards by shelf code
     */
    getByShelf(shelfCode) {
        return this.cards.filter(card => card.shelfCode === shelfCode);
    },

    /**
     * Get total card count
     */
    getCount() {
        return this.cards.length;
    },

    /**
     * Get count by line
     */
    getCountByLine() {
        const counts = {};
        const lines = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        
        lines.forEach(line => {
            counts[line] = this.cards.filter(card => card.shelfCode.startsWith(line + '-')).length;
        });
        
        return counts;
    },

    /**
     * Get all cards
     */
    getAll() {
        return this.cards;
    },

    /**
     * Get overdue cards with tier information (3+ days)
     */
    getOverdue(threshold = this.OVERDUE_THRESHOLD_HOURS) {
        const now = new Date();
        return this.cards
            .filter(card => {
                const createdDate = card.createdAt ? new Date(card.createdAt) : new Date();
                const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
                return hoursDiff >= threshold;
            })
            .map(card => {
                const createdDate = card.createdAt ? new Date(card.createdAt) : new Date();
                const hoursDiff = (now - createdDate) / (1000 * 60 * 60);

                return {
                    ...card,
                    hoursDiff: Math.floor(hoursDiff * 10) / 10,
                    tier: 'alert',
                    color: 'oklch(0.637 0.237 25.331)',
                    icon: 'solar:danger-triangle-bold'
                };
            })
            .sort((a, b) => b.hoursDiff - a.hoursDiff);
    },

    /**
     * Get overdue cards by tier (3+ days on shelf)
     */
    getOverdueByTier() {
        const now = new Date();
        const result = {
            alert: [], // 3+ days (Red)
            total: 0
        };

        this.cards.forEach(card => {
            const createdDate = card.createdAt ? new Date(card.createdAt) : new Date();
            const hoursDiff = (now - createdDate) / (1000 * 60 * 60);

            if (hoursDiff >= this.OVERDUE_THRESHOLD_HOURS) {
                result.alert.push({
                    ...card,
                    hoursDiff: Math.floor(hoursDiff * 10) / 10,
                    tier: 'alert',
                    color: 'oklch(0.637 0.237 25.331)',
                    icon: 'solar:danger-triangle-bold'
                });
            }
        });

        result.alert.sort((a, b) => b.hoursDiff - a.hoursDiff);
        result.total = result.alert.length;

        return result;
    },

    /**
     * Get statistics with overdue breakdown
     */
    getStats() {
        const now = new Date();
        const lineCounts = this.getCountByLine();
        const overdueByTier = this.getOverdueByTier();
        
        // Calculate average time in storage
        let totalHours = 0;
        this.cards.forEach(card => {
            const createdDate = card.createdAt ? new Date(card.createdAt) : new Date();
            const hours = (now - createdDate) / (1000 * 60 * 60);
            totalHours += hours;
        });
        
        const avgHours = this.cards.length > 0 ? totalHours / this.cards.length : 0;
        
        return {
            total: this.cards.length,
            byLine: lineCounts,
            overdue: {
                total: overdueByTier.total,
                alertCards: overdueByTier.alert
            },
            averageHoursInStorage: Math.round(avgHours * 10) / 10,
            availableSlots: 700 - this.cards.length,
            capacityUsed: Math.round((this.cards.length / 700) * 100 * 10) / 10
        };
    },

    /**
     * Get cards by overdue tier
     */
    getByTier(tier) {
        const overdueByTier = this.getOverdueByTier();
        return overdueByTier[tier] || [];
    },

    /**
     * Check if card is overdue (3+ days on shelf)
     */
    getCardOverdueStatus(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return null;

        const now = new Date();
        const createdDate = card.createdAt ? new Date(card.createdAt) : new Date();
        const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
        const isOverdue = hoursDiff >= this.OVERDUE_THRESHOLD_HOURS;

        return {
            isOverdue,
            tier: isOverdue ? 'alert' : 'normal',
            hoursDiff: Math.floor(hoursDiff * 10) / 10,
            color: isOverdue ? 'oklch(0.637 0.237 25.331)' : 'gray',
            icon: isOverdue ? 'solar:danger-triangle-bold' : 'solar:box-linear'
        };
    },

    /**
     * Save cards to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem('wipCards', JSON.stringify(this.cards));
            localStorage.setItem('wipCardCounter', this.cardIdCounter.toString());
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },

    /**
     * Load cards from localStorage
     */
    loadFromStorage() {
        try {
            const savedCards = localStorage.getItem('wipCards');
            const savedCounter = localStorage.getItem('wipCardCounter');

            if (savedCards) {
                this.cards = JSON.parse(savedCards);
                
                // Migration: Convert old single moNumber to moNumbers array
                this.cards.forEach(card => {
                    if (!card.moNumbers && card.moNumber) {
                        card.moNumbers = [card.moNumber];
                        delete card.moNumber;
                    }
                });
                
                this.saveToStorage();
            }
            if (savedCounter) {
                this.cardIdCounter = parseInt(savedCounter, 10);
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
    },

    /**
     * Initialize the manager
     */
    async init() {
        if (typeof LogManager !== 'undefined' && LogManager.state.db) {
            try {
                const cards = await LogManager.loadState();
                if (cards && cards.length > 0) {
                    this.cards = cards;
                    
                    // Migration
                    this.cards.forEach(card => {
                        if (!card.moNumbers && card.moNumber) {
                            card.moNumbers = [card.moNumber];
                            delete card.moNumber;
                        }
                    });
                    
                    const maxId = Math.max(...cards.map(c => {
                        const match = c.id.match(/card-(\d+)/);
                        return match ? parseInt(match[1]) : 0;
                    }));
                    this.cardIdCounter = maxId + 1;
                    
                    console.log(`✓ Loaded ${cards.length} cards from database`);
                    return;
                }
            } catch (e) {
                console.error('Failed to load from IndexedDB:', e);
            }
        }
        
        this.loadFromStorage();
        console.log(`✓ Loaded ${this.cards.length} cards from localStorage`);
    },

    /**
     * Move card to different shelf
     */
    moveCard(cardId, newShelfCode) {
        const card = this.cards.find(c => c.id === cardId);
        
        if (!card) {
            console.error('Card not found:', cardId);
            return false;
        }
        
        if (!ShelfLocations.isValid(newShelfCode)) {
            console.error('Invalid shelf code:', newShelfCode);
            return false;
        }
        
        const oldShelfCode = card.shelfCode;
        
        card.shelfCode = newShelfCode;
        card.shelfName = ShelfLocations.getName(newShelfCode);
        card.areaColor = ShelfLocations.getAreaColor(newShelfCode);
        
        this.saveToStorage();
        
        if (typeof LogManager !== 'undefined') {
            LogManager.writeLog('MOVE', {
                ...card,
                oldShelfCode: oldShelfCode,
                newShelfCode: newShelfCode
            });
        }
        
        console.log(`✓ Moved card from ${oldShelfCode} to ${newShelfCode}`);
        return true;
    },

    /**
     * Check for duplicate MO on same shelf (DEPRECATED)
     */
    isDuplicate(shelfCode, moNumber) {
        return this.isDuplicateMO(moNumber);
    },

    /**
     * Get oldest cards
     */
    getOldest(limit = 10) {
        return [...this.cards]
            .sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateA - dateB;
            })
            .slice(0, limit);
    },

    /**
     * Get newest cards
     */
    getNewest(limit = 10) {
        return [...this.cards]
            .sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            })
            .slice(0, limit);
    },

    /**
     * Get summary report
     */
    getSummary() {
        const stats = this.getStats();

        return {
            timestamp: new Date().toISOString(),
            totalCards: stats.total,
            availableSlots: stats.availableSlots,
            capacityUsed: stats.capacityUsed + '%',
            averageStorageTime: stats.averageHoursInStorage + 'h',
            overdue: {
                total: stats.overdue.total
            },
            byLine: stats.byLine,
            oldestCard: this.getOldest(1)[0] || null,
            newestCard: this.getNewest(1)[0] || null
        };
    },

    /**
     * Export data to JSON
     */
    exportToJSON() {
        const exportData = {
            exportDate: new Date().toISOString(),
            totalCards: this.cards.length,
            cards: this.cards.map(card => {
                const overdueStatus = this.getCardOverdueStatus(card.id);
                return {
                    ...card,
                    overdueStatus
                };
            }),
            summary: this.getSummary()
        };
        
        return JSON.stringify(exportData, null, 2);
    },

    /**
     * Import data from JSON
     */
    importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (!data.cards || !Array.isArray(data.cards)) {
                console.error('Invalid import data: missing cards array');
                return false;
            }
            
            const backup = [...this.cards];
            const backupCounter = this.cardIdCounter;
            
            try {
                this.cards = data.cards.map(card => ({
                    id: card.id,
                    shelfCode: card.shelfCode,
                    shelfName: card.shelfName,
                    moNumbers: card.moNumbers || (card.moNumber ? [card.moNumber] : []),
                    timestamp: card.timestamp,
                    createdAt: card.createdAt,
                    areaColor: card.areaColor
                }));
                
                const maxId = Math.max(...this.cards.map(c => {
                    const match = c.id.match(/card-(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                }));
                this.cardIdCounter = maxId + 1;
                
                this.saveToStorage();
                
                console.log(`✓ Imported ${this.cards.length} cards`);
                return true;
                
            } catch (importError) {
                this.cards = backup;
                this.cardIdCounter = backupCounter;
                throw importError;
            }
            
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
};
