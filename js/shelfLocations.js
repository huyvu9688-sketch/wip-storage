/**
 * Shelf Locations Database
 * Format: X-XX where X = Line (A-P), XX = Position (01-70)
 * Total: 16 production lines, up to 70 positions each = 1,120 total locations
 */

const ShelfLocations = {
    // All valid locations stored here
    locations: {},

    /**
     * Initialize locations on load
     * Generates all valid shelf codes from A-01 to P-70
     */
    init() {
        const lines = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
        
        lines.forEach(line => {
            for (let pos = 1; pos <= 70; pos++) {
                const code = `${line}-${pos.toString().padStart(2, '0')}`;
                this.locations[code] = `Line ${line} - Position ${pos}`;
            }
        });

        console.log(`✓ Generated ${Object.keys(this.locations).length} shelf locations (A-01 to P-70)`);
    },

    /**
     * Validate if a shelf code exists
     */
    isValid(code) {
        if (!code || typeof code !== 'string') return false;
        
        const pattern = /^[A-P]-\d{2}$/;
        if (!pattern.test(code)) return false;
        
        const parts = code.split('-');
        const position = parseInt(parts[1], 10);
        
        return position >= 1 && position <= 70;
    },

    /**
     * Get full location name from code
     */
    getName(code) {
        if (!this.isValid(code)) return code;
        
        const parts = code.split('-');
        const line = parts[0];
        const position = parseInt(parts[1], 10);
        
        return `Line ${line} - Position ${position}`;
    },

    /**
     * Get color based on line (A-P) - 16 distinct colors
     */
    getAreaColor(code) {
        if (!code || code.length < 1) return '#6B7280';
        
        const line = code.charAt(0).toUpperCase();
        
        const colorMap = {
            'A': '#EF4444', // Red
            'B': '#F97316', // Orange
            'C': '#F59E0B', // Amber
            'D': '#EAB308', // Yellow
            'E': '#84CC16', // Lime
            'F': '#22C55E', // Green
            'G': '#10B981', // Emerald
            'H': '#14B8A6', // Teal
            'I': '#06B6D4', // Cyan
            'J': '#0EA5E9', // Sky
            'K': '#3B82F6', // Blue
            'L': '#6366F1', // Indigo
            'M': '#8B5CF6', // Violet
            'N': '#A855F7', // Purple
            'O': '#D946EF', // Fuchsia
            'P': '#EC4899'  // Pink
        };
        
        return colorMap[line] || '#6B7280';
    },

    getAreaColorRGB(code) {
        const hex = this.getAreaColor(code);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 107, g: 114, b: 128 };
    },

    getLineName(code) {
        if (!code || code.length < 1) return 'Unknown';
        const line = code.charAt(0).toUpperCase();
        return `Line ${line}`;
    },

    getPosition(code) {
        if (!this.isValid(code)) return 0;
        const parts = code.split('-');
        return parseInt(parts[1], 10);
    },

    getLine(code) {
        if (!code || code.length < 1) return '';
        return code.charAt(0).toUpperCase();
    },

    getLineLocations(line) {
        if (!line || line.length !== 1) return [];
        
        const lineLetter = line.toUpperCase();
        if (!/^[A-P]$/.test(lineLetter)) return [];
        
        const locations = [];
        for (let pos = 1; pos <= 70; pos++) {
            const code = `${lineLetter}-${pos.toString().padStart(2, '0')}`;
            locations.push({
                code,
                name: this.getName(code),
                color: this.getAreaColor(code),
                line: lineLetter,
                position: pos
            });
        }
        return locations;
    },

    getAllGrouped() {
        const grouped = {};
        const lines = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
        
        lines.forEach(line => {
            grouped[line] = this.getLineLocations(line);
        });
        
        return grouped;
    },

    getAllLines() {
        return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
    },

    getAllLinesInfo() {
        return this.getAllLines().map(line => ({
            line,
            name: `Line ${line}`,
            color: this.getAreaColor(`${line}-01`),
            totalPositions: 70
        }));
    },

    search(searchTerm) {
        if (!searchTerm) return [];
        
        const term = searchTerm.toUpperCase().trim();
        const results = [];
        
        const lines = this.getAllLines();
        
        lines.forEach(line => {
            if (term === line) {
                results.push(...this.getLineLocations(line));
                return;
            }
            
            for (let pos = 1; pos <= 70; pos++) {
                const code = `${line}-${pos.toString().padStart(2, '0')}`;
                const name = this.getName(code);
                
                if (code.includes(term) || name.toUpperCase().includes(term)) {
                    results.push({
                        code,
                        name,
                        color: this.getAreaColor(code),
                        line: line,
                        position: pos
                    });
                }
            }
        });
        
        return results;
    },

    getRandom(line = null) {
        if (line) {
            const lineLetter = line.toUpperCase();
            if (!/^[A-P]$/.test(lineLetter)) return null;
            
            const randomPos = Math.floor(Math.random() * 70) + 1;
            return `${lineLetter}-${randomPos.toString().padStart(2, '0')}`;
        }
        
        const lines = this.getAllLines();
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        const randomPos = Math.floor(Math.random() * 70) + 1;
        
        return `${randomLine}-${randomPos.toString().padStart(2, '0')}`;
    },

    getNeighbors(code) {
        if (!this.isValid(code)) return { previous: null, next: null };
        
        const line = this.getLine(code);
        const position = this.getPosition(code);
        
        const neighbors = {
            previous: null,
            next: null,
            sameLine: {
                previous: null,
                next: null
            }
        };
        
        if (position > 1) {
            neighbors.sameLine.previous = `${line}-${(position - 1).toString().padStart(2, '0')}`;
            neighbors.previous = neighbors.sameLine.previous;
        }
        
        if (position < 70) {
            neighbors.sameLine.next = `${line}-${(position + 1).toString().padStart(2, '0')}`;
            neighbors.next = neighbors.sameLine.next;
        }
        
        return neighbors;
    },

    isSameLine(code1, code2) {
        if (!this.isValid(code1) || !this.isValid(code2)) return false;
        return this.getLine(code1) === this.getLine(code2);
    },

    getDistance(code1, code2) {
        if (!this.isSameLine(code1, code2)) return null;
        
        const pos1 = this.getPosition(code1);
        const pos2 = this.getPosition(code2);
        
        return Math.abs(pos1 - pos2);
    },

    getRange(startCode, endCode) {
        if (!this.isSameLine(startCode, endCode)) return null;
        
        const line = this.getLine(startCode);
        const startPos = this.getPosition(startCode);
        const endPos = this.getPosition(endCode);
        
        const minPos = Math.min(startPos, endPos);
        const maxPos = Math.max(startPos, endPos);
        
        const range = [];
        for (let pos = minPos; pos <= maxPos; pos++) {
            range.push(`${line}-${pos.toString().padStart(2, '0')}`);
        }
        
        return range;
    },

    getStats() {
        return {
            totalLocations: Object.keys(this.locations).length,
            totalLines: 16,
            positionsPerLine: 70,
            lines: this.getAllLinesInfo()
        };
    },

    formatCode(input) {
        if (!input || typeof input !== 'string') return null;
        
        const cleaned = input.toUpperCase().trim();
        
        const patterns = [
            /^([A-P])(\d{1,2})$/,
            /^([A-P])-(\d{1,2})$/,
            /^([A-P])\s+(\d{1,2})$/,
        ];
        
        for (const pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match) {
                const line = match[1];
                const position = parseInt(match[2], 10);
                
                if (position >= 1 && position <= 70) {
                    return `${line}-${position.toString().padStart(2, '0')}`;
                }
            }
        }
        
        return null;
    },

    getNextAvailable() {
        const lines = this.getAllLines();
        const occupiedCodes = WIPManager.getAll().map(card => card.shelfCode);
        
        for (const line of lines) {
            for (let pos = 1; pos <= 70; pos++) {
                const code = `${line}-${pos.toString().padStart(2, '0')}`;
                
                if (!occupiedCodes.includes(code)) {
                    return code;
                }
            }
        }
        
        return null;
    }
};

ShelfLocations.init();
