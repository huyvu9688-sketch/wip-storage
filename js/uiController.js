/**
 * UI Controller
 * Handles all UI rendering and user interactions
 */

const UIController = {
    elements: {
        allShelfContainer: null,
        allEmptyState: null,
        totalCards: null,
        searchMOInput: null,
        searchMOBtn: null,
        addMOInput: null,
        addMOBtn: null,
        heroPanelBody: null,
        heroPanelEmpty: null,
        heroPanelCards: null,
        heroPanelFooter: null,
        heroPanelCount: null,
        heroClearBtn: null
    },

    currentLine: 'all',
    heroPanelCards: [],
    OVERDUE_THRESHOLD_HOURS: 72,

    /**
     * Initialize UI elements
     */
    init() {
        this.elements.allShelfContainer = document.getElementById('allShelfContainer');
        this.elements.allEmptyState = document.getElementById('allEmptyState');
        this.elements.totalCards = document.getElementById('totalCards');
        this.elements.searchMOInput = document.getElementById('searchMOInput');
        this.elements.searchMOBtn = document.getElementById('searchMOBtn');
        this.elements.addMOInput = document.getElementById('addMOInput');
        this.elements.addMOBtn = document.getElementById('addMOBtn');
        this.elements.heroPanelBody = document.getElementById('hero-panel-body');
        this.elements.heroPanelEmpty = document.getElementById('hero-panel-empty');
        this.elements.heroPanelCards = document.getElementById('hero-panel-cards');
        this.elements.heroPanelFooter = document.getElementById('hero-panel-footer');
        this.elements.heroPanelCount = document.getElementById('hero-panel-count');
        this.elements.heroClearBtn = document.getElementById('hero-clear-btn');

        this.setupEventListeners();
        this.setupScrollListener();
        this.setupHeroPanelScrollListener();
        this.setupExcelImport(); // ← NEW: Excel import functionality
        this.setupStorageScrollListener(); // ← ADD THIS LINE
        this.render();
        this.setMode('add');
    },

    /**
     * Setup scroll listener for storage layout
     */
    setupStorageScrollListener() {
        const container = document.getElementById('storage-layout-container');
        if (!container) return;
        
        container.addEventListener('scroll', () => {
            this.updateStorageScrollIndicator();
        });
        
        window.addEventListener('resize', () => {
            this.updateStorageScrollIndicator();
        });
    },

    /**
     * Setup scroll listener for main WIP cards section 
     */
    setupScrollListener() {
        const wrapper = document.getElementById('allShelfContainerWrapper');
        if (!wrapper) return;
        
        wrapper.addEventListener('scroll', () => {
            this.updateScrollIndicator();
        });
        
        window.addEventListener('resize', () => {
            this.updateScrollIndicator();
        });
    },

    /**
     * Setup scroll listener for hero panel
     */
    setupHeroPanelScrollListener() {
        const wrapper = document.getElementById('hero-panel-body-wrapper');
        if (!wrapper) return;
        
        wrapper.addEventListener('scroll', () => {
            this.updateHeroPanelScrollState();
        });
        
        window.addEventListener('resize', () => {
            this.updateHeroPanelScrollState();
        });
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search functionality
        if (this.elements.searchMOBtn) {
            this.elements.searchMOBtn.addEventListener('click', () => this.handleSearch());
        }

        if (this.elements.searchMOInput) {
            this.elements.searchMOInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }

        // Add MO functionality
        if (this.elements.addMOBtn) {
            this.elements.addMOBtn.addEventListener('click', () => this.handleAddMO());
        }

        if (this.elements.addMOInput) {
            this.elements.addMOInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAddMO();
                }
            });
        }
    },

    /**
     * NEW: Setup Excel import functionality
     */
    setupExcelImport() {
        const dropZone = document.getElementById('excel-drop-zone');
        const fileInput = document.getElementById('excel-file-input');
        
        if (!dropZone || !fileInput) {
            console.warn('Excel import elements not found');
            return;
        }
        
        // Click to upload
        dropZone.addEventListener('click', () => fileInput.click());
        
        // File selected
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleExcelUpload(file);
        });
        
        // Drag & drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent)';
            dropZone.style.background = 'rgba(124,156,90,0.05)';
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = 'var(--olive-300)';
            dropZone.style.background = 'transparent';
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--olive-300)';
            dropZone.style.background = 'transparent';
            
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                this.handleExcelUpload(file);
            } else {
                BarcodeScanner.showScanFeedback('Please upload Excel file (.xlsx or .xls)', 'error');
            }
        });
    },

    /**
     * NEW: Handle Excel file upload
     */
    async handleExcelUpload(file) {
        const fileNameEl = document.getElementById('import-file-name');
        
        if (!fileNameEl) {
            console.error('import-file-name element not found');
            return;
        }
        
        fileNameEl.textContent = 'Parsing...';
        
        try {
            // Check if ExcelParser exists
            if (typeof ExcelParser === 'undefined') {
                throw new Error('ExcelParser module not loaded. Please check if excelParser.js is included.');
            }
            
            const schedule = await ExcelParser.parseFile(file);
            
            // Show file name
            fileNameEl.textContent = file.name;
            
            // Show summary
            const summaryEl = document.getElementById('import-summary');
            const summaryText = document.getElementById('import-summary-text');
            
            if (summaryEl && summaryText) {
                summaryText.textContent = `Loaded ${schedule.moList.length} MOs${schedule.date ? ' for ' + schedule.date : ''}`;
                summaryEl.classList.remove('hidden');
            }
            
            // Analyze and show dashboard
            this.updateMODashboard();
            
            BarcodeScanner.playSuccess();
            BarcodeScanner.showScanFeedback(`✓ Imported ${schedule.moList.length} MOs`, 'success');
            
            console.log('Excel import successful:', schedule);
            
        } catch (error) {
            console.error('Excel parse error:', error);
            fileNameEl.textContent = 'Click to upload';
            BarcodeScanner.showScanFeedback('Failed to parse Excel: ' + error.message, 'error');
        }
    },

    /**
     * Update navbar delivery schedule (NO DASHBOARD IN HERO)
     */
    updateMODashboard() {
        if (typeof ExcelParser === 'undefined') {
            console.warn('ExcelParser not available');
            return;
        }
        
        const analysis = ExcelParser.analyzeSchedule();
        if (!analysis) {
            console.warn('No analysis data available');
            return;
        }
        
        // Update navbar schedule dropdown
        this.updateNavbarSchedule(analysis);
        
        console.log('Navbar schedule updated:', analysis);
    },

    /**
     * Update navbar delivery schedule dropdown - WITH OVERDUE SECTION
     */
    updateNavbarSchedule(analysis) {
        if (!analysis) return;

        // Show/hide indicator
        const indicator = document.getElementById('delivery-schedule-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }

        // Update badges - prioritize overdue
        const urgentBadge = document.getElementById('urgent-badge');
        const upcomingBadge = document.getElementById('upcoming-badge');

        // Show urgent badge for overdue + urgent items
        const urgentCount = (analysis.overdue?.length || 0) + (analysis.urgent?.length || 0);
        if (urgentCount > 0 && urgentBadge) {
            urgentBadge.classList.remove('hidden');
            urgentBadge.textContent = urgentCount;
        } else if (urgentBadge) {
            urgentBadge.classList.add('hidden');
        }

        if (analysis.upcoming.length > 0 && upcomingBadge) {
            upcomingBadge.classList.remove('hidden');
            upcomingBadge.textContent = analysis.upcoming.length;
        } else if (upcomingBadge) {
            upcomingBadge.classList.add('hidden');
        }

        // Update dropdown counts
        const inWIPCount = document.getElementById('dropdown-in-wip-count');
        const missingCount = document.getElementById('dropdown-missing-count');

        if (inWIPCount) inWIPCount.textContent = analysis.inWIP.length;
        if (missingCount) missingCount.textContent = analysis.missing.length;

        // NEW: OVERDUE SECTION (Show first - highest priority)
        const overdueSection = document.createElement('div');
        overdueSection.id = 'dropdown-overdue-section';
        
        if (analysis.overdue && analysis.overdue.length > 0) {
            overdueSection.innerHTML = `
                <div class="px-4 py-2 text-xs font-semibold flex items-center gap-2" 
                    style="background: rgba(127, 29, 29, 0.15); color: #7f1d1d">
                    <iconify-icon icon="solar:danger-bold" width="14"></iconify-icon>
                    🚨 OVERDUE - Delivery date passed!
                </div>
                <div class="px-3 py-2">
                    ${analysis.overdue.map(delivery => `
                        <div class="flex items-center justify-between py-2 border-b" style="border-color: rgba(12,12,9,0.06)">
                            <div class="flex flex-col">
                                <span class="text-sm font-medium" style="color: var(--olive-950)">${delivery.moNumber}</span>
                                <span class="text-[10px]" style="color: #7f1d1d">
                                    ${delivery.deliveryDate} - ${delivery.time}
                                    ${delivery.daysDiff !== null ? ` (${Math.abs(delivery.daysDiff)} day${Math.abs(delivery.daysDiff) !== 1 ? 's' : ''} ago)` : ''}
                                </span>
                            </div>
                            <span class="text-xs font-bold px-2 py-0.5 rounded" style="background: rgba(127,29,29,0.1); color: #7f1d1d">LATE</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Update urgent section (non-overdue urgent items)
        const urgentSection = document.getElementById('dropdown-urgent-section');
        const urgentList = document.getElementById('dropdown-urgent-list');
        
        const urgentNonOverdue = analysis.urgent.filter(d => !d.isOverdue);

        if (urgentNonOverdue.length > 0 && urgentSection && urgentList) {
            urgentSection.classList.remove('hidden');
            urgentList.innerHTML = urgentNonOverdue.map(delivery => `
                <div class="flex items-center justify-between py-2 border-b" style="border-color: rgba(12,12,9,0.06)">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium" style="color: var(--olive-950)">${delivery.moNumber}</span>
                        <span class="text-[10px]" style="color: #dc2626">${delivery.deliveryDate || ''} ${delivery.time}</span>
                    </div>
                    <span class="text-xs font-semibold" style="color: #dc2626">NOW</span>
                </div>
            `).join('');
        } else if (urgentSection) {
            urgentSection.classList.add('hidden');
        }

        // Update upcoming section
        const upcomingSection = document.getElementById('dropdown-upcoming-section');
        const upcomingList = document.getElementById('dropdown-upcoming-list');
        const upcomingTitle = document.getElementById('dropdown-upcoming-title');

        if (analysis.upcoming.length > 0 && upcomingSection && upcomingList) {
            upcomingSection.classList.remove('hidden');
            
            const now = new Date();
            const currentHour = now.getHours();
            if (upcomingTitle) {
                upcomingTitle.textContent = `⏰ Next Hour (${currentHour}:00 - ${currentHour + 1}:00)`;
            }

            upcomingList.innerHTML = analysis.upcoming.map(delivery => `
                <div class="flex items-center justify-between py-2 border-b" style="border-color: rgba(12,12,9,0.06)">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium" style="color: var(--olive-950)">${delivery.moNumber}</span>
                        <span class="text-[10px]" style="color: #f59e0b">${delivery.deliveryDate || ''} ${delivery.time}</span>
                    </div>
                    <span class="text-xs font-semibold" style="color: #f59e0b">SOON</span>
                </div>
            `).join('');
        } else if (upcomingSection) {
            upcomingSection.classList.add('hidden');
        }

        // Update missing section
        const missingSection = document.getElementById('dropdown-missing-section');
        const missingList = document.getElementById('dropdown-missing-list');

        if (analysis.missing.length > 0 && missingSection && missingList) {
            missingSection.classList.remove('hidden');
            missingList.innerHTML = analysis.missing.slice(0, 30).map(delivery => `
                <div class="flex items-center justify-between py-1.5 text-xs">
                    <span style="color: var(--olive-700)">${delivery.moNumber}</span>
                    <span style="color: var(--olive-400)">${delivery.time || 'N/A'}</span>
                </div>
            `).join('');

            if (analysis.missing.length > 30) {
                missingList.innerHTML += `<div class="text-xs text-center py-2" style="color: var(--olive-400)">+ ${analysis.missing.length - 30} more...</div>`;
            }
        } else if (missingSection) {
            missingSection.classList.add('hidden');
        }

        // Insert overdue section at the top (if exists)
        const scrollContainer = document.querySelector('#schedule-dropdown .overflow-y-auto');
        if (scrollContainer && analysis.overdue && analysis.overdue.length > 0) {
            const existingOverdue = document.getElementById('dropdown-overdue-section');
            if (existingOverdue) existingOverdue.remove();
            
            scrollContainer.insertBefore(overdueSection, scrollContainer.firstChild);
        }

        // Hide empty state
        const emptyState = document.getElementById('dropdown-empty');
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
    },

    /**
     * Handle manual MO input
     */
    handleAddMO() {
        const moNumber = this.elements.addMOInput.value.trim();
        
        // Validate MO input
        if (!moNumber) {
            BarcodeScanner.showScanFeedback('❌ Vui lòng nhập mã MO!', 'warning');
            this.elements.addMOInput.focus();
            return;
        }
        
        if (moNumber.length < 2) {
            BarcodeScanner.showScanFeedback('❌ Mã MO quá ngắn!', 'warning');
            this.elements.addMOInput.focus();
            return;
        }

        // Check for duplicate MO
        if (WIPManager.isDuplicateMO(moNumber)) {
            const existingCard = WIPManager.getByMO(moNumber);
            BarcodeScanner.playError();
            
            BarcodeScanner.showCardNotification(
                'error',
                'Lỗi trùng mã MO',
                `<span class="notification-card-message-strong">Vị trí: ${existingCard.shelfCode}</span>`,
                `MO: ${moNumber}`
            );
            
            this.elements.addMOInput.value = '';
            this.elements.addMOInput.focus();
            return;
        }

        // Get next available shelf
        const nextShelf = ShelfLocations.getNextAvailable();

        if (!nextShelf) {
            BarcodeScanner.playError();
            BarcodeScanner.showScanFeedback('❌ TẤT CẢ 700 VỊ TRÍ ĐÃ ĐẦY!', 'error');
            console.error('All shelf locations are full!');
            return;
        }

        // Create the card (will validate MO again inside)
        const card = WIPManager.createCard(nextShelf, moNumber);
        
        if (card) {
            this.render();
            
            // Update dashboard if Excel data is loaded
            if (typeof ExcelParser !== 'undefined' && ExcelParser.scheduledMOs) {
                this.updateMODashboard();
            }
            
            BarcodeScanner.playSuccess();
            BarcodeScanner.showCardNotification(
                'success',
                'Thêm MO thành công',
                `<span class="notification-card-message-strong">Vị trí: ${nextShelf}</span>`,
                `MO: "${moNumber}"`
            );
            console.log(`Card created: MO ${moNumber} → ${nextShelf}`);
            
            this.elements.addMOInput.value = '';
            this.elements.addMOInput.focus();
        } else {
            // Error already shown by createCard()
            this.elements.addMOInput.value = '';
            this.elements.addMOInput.focus();
        }
    },

    /**
     * Filter cards by line
     */
    filterByLine(line) {
        this.currentLine = line;
        
        document.querySelectorAll('.line-tab-btn').forEach(btn => {
            const btnLine = btn.getAttribute('data-line');
            
            if (btnLine === line) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.render();
    },

    /**
     * Render all cards
     */
    render() {
        let allCards = WIPManager.getAll();

        if (this.currentLine !== 'all') {
            allCards = allCards.filter(card => card.shelfCode.startsWith(this.currentLine + '-'));
        }

        this.renderCards(allCards);
        this.updateTotalCount();
        this.updateOverdueTicker();
        this.renderStorageLayout(); // ← ADD THIS LINE
    },

    /**
     * Render cards grouped by line with dividers
     */
    renderCards(cards) {
        const container = this.elements.allShelfContainer;
        const emptyState = this.elements.allEmptyState;
        
        if (!container || !emptyState) return;

        if (cards.length === 0) {
            emptyState.style.display = 'block';
            container.innerHTML = '';
            container.appendChild(emptyState);
            this.updateScrollIndicator();
            return;
        }

        emptyState.style.display = 'none';

        const cardsByLine = this.groupCardsByLine(cards);
        
        let html = '';
        const lines = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        
        lines.forEach((line, index) => {
            const lineCards = cardsByLine[line] || [];
            
            if (lineCards.length > 0) {
                if (index > 0 || (this.currentLine === 'all' && Object.keys(cardsByLine).indexOf(line) > 0)) {
                    html += `<div class="line-divider" data-line-name="Line ${line}"></div>`;
                } else if (this.currentLine === 'all') {
                    html += `<div class="line-divider" data-line-name="Line ${line}"></div>`;
                }
                
                html += lineCards.map(card => this.generateCardHTML(card, false)).join('');
            }
        });
        
        container.innerHTML = html;
        
        this.setupAddMOButtonListeners();
        this.updateScrollIndicator();
    },

    /**
     * Group cards by production line
     */
    groupCardsByLine(cards) {
        const grouped = {};
        
        cards.forEach(card => {
            const line = card.shelfCode.charAt(0);
            if (!grouped[line]) {
                grouped[line] = [];
            }
            grouped[line].push(card);
        });
        
        Object.keys(grouped).forEach(line => {
            grouped[line].sort((a, b) => {
                const posA = parseInt(a.shelfCode.split('-')[1]);
                const posB = parseInt(b.shelfCode.split('-')[1]);
                return posA - posB;
            });
        });
        
        return grouped;
    },

    /**
     * Update scroll indicator visibility for main WIP section
     */
    updateScrollIndicator() {
        const wrapper = document.getElementById('allShelfContainerWrapper');
        const indicator = document.getElementById('scrollIndicator');
        
        if (!wrapper || !indicator) return;
        
        const isScrollable = wrapper.scrollHeight > wrapper.clientHeight;
        const isScrolledToBottom = wrapper.scrollHeight - wrapper.scrollTop <= wrapper.clientHeight + 10;
        
        if (isScrollable && !isScrolledToBottom) {
            indicator.classList.remove('hidden');
            indicator.classList.add('show');
            wrapper.classList.add('has-scroll');
        } else {
            indicator.classList.add('hidden');
            indicator.classList.remove('show');
            wrapper.classList.remove('has-scroll');
        }
        
        if (isScrolledToBottom) {
            wrapper.classList.add('scrolled-to-bottom');
        } else {
            wrapper.classList.remove('scrolled-to-bottom');
        }
    },

    /**
     * Update hero panel scroll state
     */
    updateHeroPanelScrollState() {
        const wrapper = document.getElementById('hero-panel-body-wrapper');
        if (!wrapper) return;
        
        const isScrollable = wrapper.scrollHeight > wrapper.clientHeight;
        const isScrolledToBottom = wrapper.scrollHeight - wrapper.scrollTop <= wrapper.clientHeight + 10;
        
        if (isScrollable && !isScrolledToBottom) {
            wrapper.classList.add('has-scroll');
        } else {
            wrapper.classList.remove('has-scroll');
        }
        
        if (isScrolledToBottom) {
            wrapper.classList.add('scrolled-to-bottom');
        } else {
            wrapper.classList.remove('scrolled-to-bottom');
        }
    },

    /**
     * Generate HTML for a single card - NO DELETE BUTTONS, FIXED LAYOUT
     */
    generateCardHTML(card, isHeroPanel = false) {
        const createdDate = card.createdAt ? new Date(card.createdAt) : new Date();
        const now = new Date();
        const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
        const hoursOnShelf = Math.floor(hoursDiff);

        const isOverdue = hoursDiff >= this.OVERDUE_THRESHOLD_HOURS;
        const overdueClass = isOverdue ? 'card-overdue-alert' : '';
        const badgeClass = isOverdue ? 'overdue-badge-alert' : '';
        const badgeIcon = 'solar:danger-triangle-bold';

        const dateObj = new Date(card.createdAt || new Date());
        const dateStr = dateObj.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const timeStr = dateObj.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const moNumbers = card.moNumbers || (card.moNumber ? [card.moNumber] : []);
        const canAddMoreMOs = moNumbers.length < WIPManager.MAX_MOS_PER_CARD;

        // Generate MO text list - 3 FIXED SLOTS
        const moTextHTML = [];
        for (let i = 0; i < 3; i++) {
            if (i < moNumbers.length) {
                moTextHTML.push(`
                    <div class="flex items-center gap-1.5 mo-line" data-mo="${moNumbers[i]}">
                        <div class="flex-1 min-w-0">
                            <div class="text-base font-medium truncate" style="color: var(--olive-950); line-height: 1.2;" title="${moNumbers[i]}">
                                ${moNumbers[i]}
                            </div>
                        </div>
                    </div>
                `);
            } else {
                moTextHTML.push(`
                    <div class="flex items-center gap-1.5 mo-line mo-placeholder">
                        <div class="flex-1 min-w-0">
                            <div class="text-base font-medium" style="color: transparent; line-height: 1.2;">
                                ···
                            </div>
                        </div>
                    </div>
                `);
            }
        }

        return `
            <div class="hero-search-card-multi group relative ${overdueClass}" 
                data-card-id="${card.id}" 
                data-shelf="${card.shelfCode}">

                <!-- MO Section: ONE icon + 3 fixed MO slots -->
                <div class="card-mo-section">
                    <div class="card-icon" style="background: oklch(0.58 0.031 107.3);">
                        <iconify-icon icon="solar:box-linear" class="text-white" width="22" stroke-width="1.5" style="display:block;"></iconify-icon>
                    </div>
                    
                    <div class="card-mo-list">
                        ${moTextHTML.join('')}
                    </div>
                </div>

                <!-- Location -->
                <div class="card-location">
                    <div class="location-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block; flex-shrink:0;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div class="location-text" title="${card.shelfCode}">
                        ${card.shelfCode}
                    </div>
                </div>

                <!-- Date/Time -->
                <div class="card-datetime">
                    <div class="datetime-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block; flex-shrink:0;">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <div class="datetime-text" title="${card.timestamp}">
                        ${dateStr} • ${timeStr}
                    </div>
                </div>

                <!-- Add MO Button (only if < 3 MOs) -->
                ${!isHeroPanel && canAddMoreMOs ? `
                    <button class="add-mo-btn"
                            title="Thêm MO vào thẻ này"
                            data-add-mo-card="${card.id}">
                        <iconify-icon icon="solar:add-circle-bold" width="14" class="inline-block mr-1"></iconify-icon>
                        Thêm MO (${moNumbers.length}/${WIPManager.MAX_MOS_PER_CARD})
                    </button>
                ` : ''}
                
                ${isOverdue ? `
                    <div class="overdue-badge ${badgeClass}"
                        title="${hoursOnShelf} giờ trên kệ - QUÁ 3 NGÀY!">
                        <iconify-icon icon="${badgeIcon}" width="12"></iconify-icon>
                        <span>${hoursOnShelf}h</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Setup event listeners for "Add MO" buttons
     */
    setupAddMOButtonListeners() {
        const container = this.elements.allShelfContainer;
        
        if (!container) return;

        if (container._addMOClickHandler) {
            container.removeEventListener('click', container._addMOClickHandler);
        }

        const clickHandler = (event) => {
            const button = event.target.closest('[data-add-mo-card]');
            
            if (button) {
                event.stopPropagation();
                const cardId = button.getAttribute('data-add-mo-card');
                this.showAddMODialog(cardId);
            }
        };

        container._addMOClickHandler = clickHandler;
        container.addEventListener('click', clickHandler);
    },

    /**
     * Show dialog to add MO to existing card
     */
    showAddMODialog(cardId) {
        const card = WIPManager.cards.find(c => c.id === cardId);
        if (!card) {
            console.error('Card not found:', cardId);
            return;
        }

        const moNumbers = card.moNumbers || (card.moNumber ? [card.moNumber] : []);
        const currentMOs = moNumbers.join(', ');

        const moNumber = prompt(
            `Thêm MO vào vị trí ${card.shelfCode}\n\nHiện tại: ${currentMOs}\n\nNhập mã MO mới (${moNumbers.length}/${WIPManager.MAX_MOS_PER_CARD}):`
        );

        if (!moNumber || !moNumber.trim()) return;

        const success = WIPManager.addMOToCard(cardId, moNumber.trim());

        if (success) {
            this.render();
            
            // Update dashboard if Excel data is loaded
            if (typeof ExcelParser !== 'undefined' && ExcelParser.scheduledMOs) {
                this.updateMODashboard();
            }
            
            BarcodeScanner.playSuccess();
            BarcodeScanner.showScanFeedback(`✓ Đã thêm MO "${moNumber.trim()}" vào ${card.shelfCode}`, 'success');
        } else {
            BarcodeScanner.playError();
            
            if (WIPManager.isDuplicateMO(moNumber.trim())) {
                const existingCard = WIPManager.getByMO(moNumber.trim());
                BarcodeScanner.showCardNotification(
                    'error',
                    'Lỗi trùng mã MO',
                    `<span class="notification-card-message-strong">Vị trí: ${existingCard.shelfCode}</span>`,
                    `MO: ${moNumber.trim()}`
                );
            } else {
                BarcodeScanner.showScanFeedback('Không thể thêm MO', 'error');
            }
        }
    },

    /**
     * Update hero panel display
     */
    updateHeroPanelDisplay() {
        if (!this.elements.heroPanelCards) return;

        if (this.heroPanelCards.length === 0) {
            this.clearHeroPanel();
            return;
        }

        const cardsHTML = this.heroPanelCards.map(card => this.generateCardHTML(card, true)).join('');
        this.elements.heroPanelCards.innerHTML = cardsHTML;

        if (this.elements.heroPanelCount) {
            this.elements.heroPanelCount.textContent = this.heroPanelCards.length;
        }
        
        this.elements.heroPanelEmpty.classList.add('hidden');
        this.elements.heroPanelCards.classList.remove('hidden');
        this.elements.heroPanelFooter.classList.remove('hidden');
        this.elements.heroClearBtn.classList.remove('hidden');
        
        setTimeout(() => {
            this.updateHeroPanelScrollState();
        }, 100);
    },

    /**
     * Update hero panel with search results
     */
    updateHeroPanel(cards) {
        if (!this.elements.heroPanelCards || !this.elements.heroPanelEmpty) return;

        cards.forEach(card => {
            const alreadyExists = this.heroPanelCards.some(c => c.id === card.id);
            if (!alreadyExists) {
                this.heroPanelCards.push(card);
            }
        });

        if (this.heroPanelCards.length === 0) {
            this.elements.heroPanelEmpty.classList.remove('hidden');
            this.elements.heroPanelCards.classList.add('hidden');
            this.elements.heroPanelFooter.classList.add('hidden');
            this.elements.heroClearBtn.classList.add('hidden');
            return;
        }

        this.elements.heroPanelEmpty.classList.add('hidden');
        this.elements.heroPanelCards.classList.remove('hidden');
        this.elements.heroPanelFooter.classList.remove('hidden');
        this.elements.heroClearBtn.classList.remove('hidden');

        this.updateHeroPanelDisplay();
        
        setTimeout(() => {
            this.updateHeroPanelScrollState();
        }, 100);
    },

    /**
     * Clear hero panel
     */
    clearHeroPanel() {
        this.heroPanelCards = [];
        this.elements.heroPanelEmpty.classList.remove('hidden');
        this.elements.heroPanelCards.classList.add('hidden');
        this.elements.heroPanelFooter.classList.add('hidden');
        this.elements.heroClearBtn.classList.add('hidden');
        
        const wrapper = document.getElementById('hero-panel-body-wrapper');
        if (wrapper) {
            wrapper.classList.remove('has-scroll', 'scrolled-to-bottom');
        }
    },

    /**
     * Remove hero panel MOs from shelves (individual MO removal, not entire cards)
     */
    removeHeroPanelFromShelves() {
        if (this.heroPanelCards.length === 0) return;

        // Build list of MOs to remove (with their parent cards)
        const moRemovalList = [];
        
        this.heroPanelCards.forEach(card => {
            const moNumbers = card.moNumbers || [card.moNumber];
            
            moNumbers.forEach(mo => {
                moRemovalList.push({
                    moNumber: mo,
                    shelfCode: card.shelfCode,
                    cardId: card.id
                });
            });
        });

        const moListDisplay = moRemovalList.map(item => 
            `${item.moNumber} (${item.shelfCode})`
        ).join('\n');

        const confirmMessage = `Xác nhận lấy ${moRemovalList.length} MO khỏi kệ?\n\n${moListDisplay}\n\nMO sẽ bị xóa khỏi hệ thống.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        let removedCount = 0;
        let deletedCards = 0;

        // Remove each MO individually
        moRemovalList.forEach(item => {
            const card = WIPManager.cards.find(c => c.id === item.cardId);
            
            if (!card) {
                console.warn(`Card not found: ${item.cardId}`);
                return;
            }

            // Ensure moNumbers array exists
            if (!card.moNumbers) {
                card.moNumbers = card.moNumber ? [card.moNumber] : [];
            }

            const moIndex = card.moNumbers.indexOf(item.moNumber);
            
            if (moIndex === -1) {
                console.warn(`MO not found in card: ${item.moNumber}`);
                return;
            }

            // Remove the MO
            card.moNumbers.splice(moIndex, 1);
            removedCount++;

            // If card is now empty (no MOs left), delete the entire card
            if (card.moNumbers.length === 0) {
                const removeTime = new Date();
                const addTime = new Date(card.createdAt);
                const duration = WIPManager.calculateDuration(addTime, removeTime);
                
                if (typeof LogManager !== 'undefined') {
                    LogManager.writeLog('REMOVE', card, duration);
                }
                
                WIPManager.cards = WIPManager.cards.filter(c => c.id !== card.id);
                deletedCards++;
                
                console.log(`✓ Removed last MO from card, deleted: ${card.shelfCode}`);
            } else {
                // Card still has MOs, just log the MO removal
                if (typeof LogManager !== 'undefined') {
                    LogManager.writeLog('REMOVE_MO', card, null, item.moNumber);
                }
                
                console.log(`✓ Removed MO ${item.moNumber} from card ${card.shelfCode} (${card.moNumbers.length} MOs remaining)`);
            }
        });

        WIPManager.saveToStorage();

        // Show success message
        let message = `✓ Đã lấy ${removedCount} MO khỏi kệ`;
        if (deletedCards > 0) {
            message += ` (${deletedCards} thẻ đã xóa do hết MO)`;
        }
        
        BarcodeScanner.showScanFeedback(message, 'success');
        
        this.clearHeroPanel();
        this.render();
        
        // Update dashboard if Excel data is loaded
        if (typeof ExcelParser !== 'undefined' && ExcelParser.scheduledMOs) {
            this.updateMODashboard();
        }
    },

    /**
     * Handle search
     */
    handleSearch() {
        const searchTerm = this.elements.searchMOInput.value.trim().toUpperCase();
        
        if (!searchTerm) {
            BarcodeScanner.showScanFeedback('Vui lòng nhập mã MO hoặc vị trí để tìm kiếm!', 'warning');
            return;
        }

        const foundCards = WIPManager.search(searchTerm);

        if (foundCards.length === 0) {
            BarcodeScanner.showScanFeedback(`Không tìm thấy sản phẩm với mã "${searchTerm}"`, 'error');
        } else {
            this.updateHeroPanel(foundCards);
            
            // Count total MOs found
            let totalMOs = 0;
            foundCards.forEach(card => {
                const moNumbers = card.moNumbers || [card.moNumber];
                totalMOs += moNumbers.length;
            });
            
            BarcodeScanner.showScanFeedback(
                `✓ Tìm thấy ${totalMOs} MO trong ${foundCards.length} vị trí`,
                'success'
            );
        }
        
        this.elements.searchMOInput.value = '';
    },

    /**
     * Set mode (add/find)
     */
    setMode(mode) {
        const addModeBtn = document.getElementById('add-mode-btn');
        const findModeBtn = document.getElementById('find-mode-btn');
        
        const addMOInput = document.getElementById('addMOInput');
        const addMOBtn = document.getElementById('addMOBtn');
        const addMOContainer = addMOInput?.closest('.glass-light');
        
        const searchMOInput = document.getElementById('searchMOInput');
        const searchMOBtn = document.getElementById('searchMOBtn');
        const searchMOContainer = searchMOInput?.closest('.glass-light');
        
        const heroPanelBody = document.getElementById('hero-panel-body');
        
        if (mode === 'add') {
            addModeBtn.style.backgroundColor = 'oklch(0.58 0.031 107.3)';
            addModeBtn.style.borderColor = 'oklch(0.58 0.031 107.3)';
            addModeBtn.classList.add('text-white');
            addModeBtn.classList.remove('text-[#0B1F3A]');
            
            findModeBtn.style.backgroundColor = 'rgba(251,251,249,0.9)';
            findModeBtn.style.borderColor = 'rgba(12,12,9,0.12)';
            findModeBtn.classList.remove('text-white');
            findModeBtn.classList.add('text-[#0B1F3A]');
            
            if (addMOContainer) addMOContainer.classList.remove('opacity-50', 'pointer-events-none');
            if (addMOInput) {
                addMOInput.disabled = false;
                addMOInput.focus();
            }
            if (addMOBtn) addMOBtn.disabled = false;
            
            if (searchMOContainer) searchMOContainer.classList.add('opacity-50', 'pointer-events-none');
            if (searchMOInput) searchMOInput.disabled = true;
            if (searchMOBtn) searchMOBtn.disabled = true;
            if (heroPanelBody) heroPanelBody.parentElement.classList.add('opacity-50', 'pointer-events-none');
            
        } else if (mode === 'find') {
            findModeBtn.style.backgroundColor = 'oklch(0.58 0.031 107.3)';
            findModeBtn.style.borderColor = 'oklch(0.58 0.031 107.3)';
            findModeBtn.classList.add('text-white');
            findModeBtn.classList.remove('text-[#0B1F3A]');
            
            addModeBtn.style.backgroundColor = 'rgba(251,251,249,0.9)';
            addModeBtn.style.borderColor = 'rgba(12,12,9,0.12)';
            addModeBtn.classList.remove('text-white');
            addModeBtn.classList.add('text-[#0B1F3A]');
            
            if (searchMOContainer) searchMOContainer.classList.remove('opacity-50', 'pointer-events-none');
            if (searchMOInput) {
                searchMOInput.disabled = false;
                searchMOInput.focus();
            }
            if (searchMOBtn) searchMOBtn.disabled = false;
            if (heroPanelBody) heroPanelBody.parentElement.classList.remove('opacity-50', 'pointer-events-none');
            
            if (addMOContainer) addMOContainer.classList.add('opacity-50', 'pointer-events-none');
            if (addMOInput) addMOInput.disabled = true;
            if (addMOBtn) addMOBtn.disabled = true;
        }
    },

    /**
     * Update total count
     */
    updateTotalCount() {
        const count = WIPManager.getCount();
        if (this.elements.totalCards) {
            this.elements.totalCards.textContent = count;
        }
    },

    /**
     * Update navbar delivery schedule dropdown
     */
    updateNavbarSchedule(analysis) {
        if (!analysis) return;

        // Show/hide indicator
        const indicator = document.getElementById('delivery-schedule-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }

        // Update badges
        const urgentBadge = document.getElementById('urgent-badge');
        const upcomingBadge = document.getElementById('upcoming-badge');

        if (analysis.urgent.length > 0 && urgentBadge) {
            urgentBadge.classList.remove('hidden');
            urgentBadge.textContent = analysis.urgent.length;
        } else if (urgentBadge) {
            urgentBadge.classList.add('hidden');
        }

        if (analysis.upcoming.length > 0 && upcomingBadge) {
            upcomingBadge.classList.remove('hidden');
            upcomingBadge.textContent = analysis.upcoming.length;
        } else if (upcomingBadge) {
            upcomingBadge.classList.add('hidden');
        }

        // Update dropdown counts
        const inWIPCount = document.getElementById('dropdown-in-wip-count');
        const missingCount = document.getElementById('dropdown-missing-count');

        if (inWIPCount) inWIPCount.textContent = analysis.inWIP.length;
        if (missingCount) missingCount.textContent = analysis.missing.length;

        // Update dropdown lists
        const urgentSection = document.getElementById('dropdown-urgent-section');
        const urgentList = document.getElementById('dropdown-urgent-list');

        if (analysis.urgent.length > 0 && urgentSection && urgentList) {
            urgentSection.classList.remove('hidden');
            urgentList.innerHTML = analysis.urgent.map(delivery => `
                <div class="flex items-center justify-between py-2 border-b" style="border-color: rgba(12,12,9,0.06)">
                    <span class="text-sm font-medium" style="color: var(--olive-950)">${delivery.moNumber}</span>
                    <span class="text-xs font-semibold" style="color: #dc2626">${delivery.time}</span>
                </div>
            `).join('');
        } else if (urgentSection) {
            urgentSection.classList.add('hidden');
        }

        const upcomingSection = document.getElementById('dropdown-upcoming-section');
        const upcomingList = document.getElementById('dropdown-upcoming-list');
        const upcomingTitle = document.getElementById('dropdown-upcoming-title');

        if (analysis.upcoming.length > 0 && upcomingSection && upcomingList) {
            upcomingSection.classList.remove('hidden');
            
            const now = new Date();
            const currentHour = now.getHours();
            if (upcomingTitle) {
                upcomingTitle.textContent = `⏰ Next Hour (${currentHour}:00 - ${currentHour + 1}:00)`;
            }

            upcomingList.innerHTML = analysis.upcoming.map(delivery => `
                <div class="flex items-center justify-between py-2 border-b" style="border-color: rgba(12,12,9,0.06)">
                    <span class="text-sm font-medium" style="color: var(--olive-950)">${delivery.moNumber}</span>
                    <span class="text-xs font-semibold" style="color: #f59e0b">${delivery.time}</span>
                </div>
            `).join('');
        } else if (upcomingSection) {
            upcomingSection.classList.add('hidden');
        }

        const missingSection = document.getElementById('dropdown-missing-section');
        const missingList = document.getElementById('dropdown-missing-list');

        if (analysis.missing.length > 0 && missingSection && missingList) {
            missingSection.classList.remove('hidden');
            missingList.innerHTML = analysis.missing.slice(0, 30).map(delivery => `
                <div class="flex items-center justify-between py-1.5 text-xs">
                    <span style="color: var(--olive-700)">${delivery.moNumber}</span>
                    <span style="color: var(--olive-400)">${delivery.time || 'N/A'}</span>
                </div>
            `).join('');

            if (analysis.missing.length > 30) {
                missingList.innerHTML += `<div class="text-xs text-center py-2" style="color: var(--olive-400)">+ ${analysis.missing.length - 30} more...</div>`;
            }
        } else if (missingSection) {
            missingSection.classList.add('hidden');
        }

        // Hide empty state
        const emptyState = document.getElementById('dropdown-empty');
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
    },

    /**
     * Update overdue ticker (3+ days cards)
     */
    updateOverdueTicker() {
        const tickerTrack = document.getElementById('overdue-ticker-track');
        const tickerCount = document.getElementById('overdue-ticker-count');
        const tickerBanner = document.getElementById('overdue-ticker-banner');
        if (!tickerTrack || !tickerBanner) return;

        const now = new Date();
        const overdueCards = WIPManager.getAll().filter(card => {
            const created = card.createdAt ? new Date(card.createdAt) : new Date();
            return (now - created) / (1000 * 60 * 60) >= this.OVERDUE_THRESHOLD_HOURS;
        });

        if (overdueCards.length === 0) {
            tickerBanner.classList.add('ticker-hidden');
            return;
        }

        tickerBanner.classList.remove('ticker-hidden');
        if (tickerCount) tickerCount.textContent = overdueCards.length;

        const items = overdueCards.map(card => {
            const moNumbers = card.moNumbers || [card.moNumber];
            const hrs = Math.floor((now - new Date(card.createdAt)) / (1000 * 60 * 60));
            return `<span class="ticker-item">
                <span class="ticker-dot"></span>
                <span class="ticker-mo">${moNumbers.join(', ')}</span>
                <span class="ticker-loc">${card.shelfCode}</span>
                <span class="ticker-hrs">${hrs}h</span>
            </span>`;
        }).join('');

        tickerTrack.innerHTML = `<div class="ticker-content ticker-measure-only" style="visibility:hidden;">${items}</div>`;

        requestAnimationFrame(() => {
            const measureEl = tickerTrack.querySelector('.ticker-measure-only');
            if (!measureEl) return;
            const contentWidth = measureEl.offsetWidth;

            tickerTrack.innerHTML = `
                <div class="ticker-content ticker-copy-a">${items}</div>
                <div class="ticker-content ticker-copy-b">${items}</div>
            `;

            const duration = Math.max(15, Math.round(contentWidth / 80));

            let styleEl = document.getElementById('ticker-keyframes');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'ticker-keyframes';
                document.head.appendChild(styleEl);
            }
            styleEl.textContent = `
                @keyframes ticker-scroll {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-${contentWidth}px); }
                }
                .ticker-copy-a {
                    animation: ticker-scroll ${duration}s linear infinite;
                }
                .ticker-copy-b {
                    animation: ticker-scroll ${duration}s linear infinite;
                    animation-delay: -${duration / 2}s;
                }
                .ticker-track:hover .ticker-copy-a,
                .ticker-track:hover .ticker-copy-b {
                    animation-play-state: paused;
                }
                @media (prefers-reduced-motion: reduce) {
                    .ticker-copy-a { animation: none; }
                    .ticker-copy-b { display: none; }
                }
            `;
        });
    },

    /**
     * Render Storage Layout Visualization
     */
    renderStorageLayout() {
        const container = document.getElementById('storage-layout-container');
        if (!container) return;

        const lines = ShelfLocations.getAllLines();
        const allCards = WIPManager.getAll();
        
        // Get overdue threshold
        const OVERDUE_THRESHOLD = UIController.OVERDUE_THRESHOLD_HOURS || 72;
        const now = new Date();
        
        // Build occupancy map
        const occupancyMap = {};
        allCards.forEach(card => {
            occupancyMap[card.shelfCode] = {
                moNumbers: card.moNumbers || [card.moNumber],
                createdAt: card.createdAt,
                isOverdue: card.createdAt 
                    ? ((now - new Date(card.createdAt)) / (1000 * 60 * 60)) >= OVERDUE_THRESHOLD
                    : false
            };
        });

        // Generate HTML for all lines
        let html = '';
        
        lines.forEach(line => {
            const lineColor = ShelfLocations.getAreaColor(`${line}-01`);
            
            // Count occupied slots for this line
            let occupiedCount = 0;
            for (let pos = 1; pos <= 70; pos++) {
                const code = `${line}-${pos.toString().padStart(2, '0')}`;
                if (occupancyMap[code]) occupiedCount++;
            }
            
            const occupancyPercent = Math.round((occupiedCount / 70) * 100);
            
            html += `
                <div class="storage-line" id="storage-line-${line}" data-line="${line}">
                    <!-- Line Header -->
                    <div class="storage-line-header">
                        <div class="storage-line-title" style="color: ${lineColor}">
                            <iconify-icon icon="solar:box-minimalistic-bold" width="20" class="inline-block mr-2"></iconify-icon>
                            Line ${line}
                        </div>
                        <div class="storage-line-stats">
                            <span>${occupiedCount}/70 occupied</span>
                            <span>•</span>
                            <span>${occupancyPercent}% full</span>
                        </div>
                    </div>
                    
                    <!-- Storage Slots Grid (35x2) -->
                    <div class="storage-slots-grid">
            `;
            
            // Generate 70 slots (2 rows x 35 columns)
            for (let pos = 1; pos <= 70; pos++) {
                const code = `${line}-${pos.toString().padStart(2, '0')}`;
                const occupied = occupancyMap[code];
                
                let slotClass = 'storage-slot empty';
                let tooltip = `${code} - Empty`;
                let moCount = '';
                
                if (occupied) {
                    if (occupied.isOverdue) {
                        slotClass = 'storage-slot overdue';
                        tooltip = `${code} - OVERDUE (3+ days)\\nMO: ${occupied.moNumbers.join(', ')}`;
                    } else {
                        slotClass = 'storage-slot occupied';
                        tooltip = `${code} - Occupied\\nMO: ${occupied.moNumbers.join(', ')}`;
                    }
                    
                    // Show MO count if multiple
                    if (occupied.moNumbers.length > 1) {
                        moCount = `<span class="storage-slot-mo-count">${occupied.moNumbers.length}</span>`;
                    }
                }
                
                html += `
                    <div class="${slotClass}" 
                        data-shelf="${code}" 
                        data-tooltip="${tooltip}"
                        onclick="UIController.handleStorageSlotClick('${code}')">
                        <span class="storage-slot-label">${pos.toString().padStart(2, '0')}</span>
                        ${moCount}
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Update occupancy rate
        const totalOccupied = allCards.length;
        const totalSlots = 700;
        const occupancyRate = Math.round((totalOccupied / totalSlots) * 100);
        
        const occupancyEl = document.getElementById('storage-occupancy-rate');
        if (occupancyEl) {
            occupancyEl.textContent = `${occupancyRate}%`;
        }
        
        // Setup scroll indicator
        this.updateStorageScrollIndicator();
    },

    /**
     * Handle storage slot click
     */
    handleStorageSlotClick(shelfCode) {
        const cards = WIPManager.getByShelf(shelfCode);
        
        if (cards.length === 0) {
            BarcodeScanner.showScanFeedback(`Position ${shelfCode} is empty`, 'info');
            return;
        }
        
        // Show card in hero panel
        this.updateHeroPanel(cards);
        BarcodeScanner.showScanFeedback(`✓ Showing ${cards.length} card(s) from ${shelfCode}`, 'success');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Scroll to specific storage line
     */
    scrollToStorageLine(line) {
        // Update tab active state
        document.querySelectorAll('.storage-line-tab').forEach(btn => {
            const btnLine = btn.getAttribute('data-storage-line');
            if (btnLine === line) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        if (line === 'all') {
            // Scroll to top of container
            const container = document.getElementById('storage-layout-container');
            if (container) {
                container.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }
        
        // Scroll to specific line
        const lineElement = document.getElementById(`storage-line-${line}`);
        if (lineElement) {
            lineElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    /**
     * Update storage scroll indicator
     */
    updateStorageScrollIndicator() {
        const container = document.getElementById('storage-layout-container');
        const indicator = document.getElementById('storage-scroll-indicator');
        
        if (!container || !indicator) return;
        
        const isScrollable = container.scrollHeight > container.clientHeight;
        const isScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
        
        if (isScrollable && !isScrolledToBottom) {
            indicator.classList.remove('hidden');
            indicator.classList.add('show');
            container.classList.add('has-scroll');
        } else {
            indicator.classList.add('hidden');
            indicator.classList.remove('show');
            container.classList.remove('has-scroll');
        }
        
        if (isScrolledToBottom) {
            container.classList.add('scrolled-to-bottom');
        } else {
            container.classList.remove('scrolled-to-bottom');
        }
    },

    /**
     * Render Storage Layout - NEW 2-COLUMN WAREHOUSE VIEW
     * RIGHT: A-H (bottom to top), LEFT: I-P (bottom to top)
     */
    renderStorageLayout() {
        const container = document.getElementById('storage-warehouse-grid');
        if (!container) return;

        const allCards = WIPManager.getAll();
        
        // Get overdue threshold
        const OVERDUE_THRESHOLD = this.OVERDUE_THRESHOLD_HOURS || 72;
        const now = new Date();
        
        // Build occupancy map
        const occupancyMap = {};
        allCards.forEach(card => {
            occupancyMap[card.shelfCode] = {
                moNumbers: card.moNumbers || [card.moNumber],
                createdAt: card.createdAt,
                isOverdue: card.createdAt 
                    ? ((now - new Date(card.createdAt)) / (1000 * 60 * 60)) >= OVERDUE_THRESHOLD
                    : false
            };
        });

        // Define line arrangement - CORRECTED
        // LEFT COLUMN: P, O, N, M, L, K, J, I (top to bottom)
        // RIGHT COLUMN: H, G, F, E, D, C, B, A (top to bottom)
        const leftColumn = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I'];
        const rightColumn = ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];

        // Generate HTML for both columns
        let leftHTML = '';
        let rightHTML = '';

        // LEFT COLUMN
        leftColumn.forEach(line => {
            leftHTML += this.renderWarehouseLine(line, occupancyMap);
        });

        // RIGHT COLUMN
        rightColumn.forEach(line => {
            rightHTML += this.renderWarehouseLine(line, occupancyMap);
        });

        container.innerHTML = `
            <div class="warehouse-column-left">
                ${leftHTML}
            </div>
            <div class="warehouse-column-right">
                ${rightHTML}
            </div>
        `;

        // Update occupancy rate
        const totalOccupied = allCards.length;
        const totalSlots = 1120; // 16 lines × 70 positions
        const occupancyRate = Math.round((totalOccupied / totalSlots) * 100);
        
        const occupancyEl = document.getElementById('storage-occupancy-rate');
        if (occupancyEl) {
            occupancyEl.textContent = `${occupancyRate}%`;
        }
    },

    /**
     * Render a single warehouse line with small squares
     * SPECIAL: Line J = "Ready to go" box (no label, no stats)
     * SPECIAL: Line K & L = "Arrangement Area" boxes (amber, no label, no stats)
     * SPECIAL: Line G & O = Single row (35 boxes only)
     * RIGHT COLUMN: P, O, N, M have labels on the right side
     */
    renderWarehouseLine(line, occupancyMap) {
        const lineColor = ShelfLocations.getAreaColor(`${line}-01`);
        
        // Check if this is a right-side line (P, O, N, M in right column)
        const isRightSide = ['P', 'O', 'N', 'M'].includes(line);
        
        // SPECIAL CASE: Line J - "Ready to go" box (NO LABEL, NO STATS)
        if (line === 'J') {
            return `
                <div class="warehouse-line-row warehouse-line-ready warehouse-line-no-label" data-line="${line}">
                    <div class="warehouse-ready-box">
                        <iconify-icon icon="solar:check-circle-bold" width="24" style="color: rgba(124, 156, 90, 0.8)"></iconify-icon>
                        <span class="ready-text">Ready to go</span>
                    </div>
                </div>
            `;
        }
        
        // SPECIAL CASE: Line K & L - "Arrangement Area" boxes (AMBER COLOR, NO LABEL, NO STATS)
        if (line === 'K' || line === 'L') {
            return `
                <div class="warehouse-line-row warehouse-line-arrangement warehouse-line-no-label" data-line="${line}">
                    <div class="warehouse-arrangement-box">
                        <iconify-icon icon="solar:layers-minimalistic-bold" width="24" style="color: rgba(251, 191, 36, 0.8)"></iconify-icon>
                        <span class="arrangement-text">Arrangement Area</span>
                    </div>
                </div>
            `;
        }
        
        // SPECIAL CASE: Line G & O - Single row (35 boxes only)
        if (line === 'G' || line === 'O') {
            return this.renderSingleRowLine(line, occupancyMap, isRightSide);
        }
        
        // NORMAL RENDERING for all other lines
        // Count occupied slots
        let occupiedCount = 0;
        for (let pos = 1; pos <= 70; pos++) {
            const code = `${line}-${pos.toString().padStart(2, '0')}`;
            if (occupancyMap[code]) occupiedCount++;
        }
        
        // Generate small rectangles for all 70 positions (2 rows)
        let slotsHTML = '';
        for (let pos = 1; pos <= 70; pos++) {
            const code = `${line}-${pos.toString().padStart(2, '0')}`;
            const occupied = occupancyMap[code];
            
            let slotClass = 'warehouse-slot empty';
            let tooltip = `${code} - Trống`;
            
            if (occupied) {
                if (occupied.isOverdue) {
                    slotClass = 'warehouse-slot overdue';
                    tooltip = `${code} - QUÁ HẠN\\nMO: ${occupied.moNumbers.join(', ')}`;
                } else {
                    slotClass = 'warehouse-slot occupied';
                    tooltip = `${code} - Đã dùng\\nMO: ${occupied.moNumbers.join(', ')}`;
                }
            }
            
            slotsHTML += `
                <div class="${slotClass}" 
                    data-shelf="${code}" 
                    data-tooltip="${tooltip}"
                    onclick="UIController.handleStorageSlotClick('${code}')">
                </div>
            `;
        }
        
        // RIGHT SIDE LAYOUT (P, O, N, M): Stats on left, content in middle, label on right
        if (isRightSide) {
            return `
                <div class="warehouse-line-row warehouse-line-right" data-line="${line}">
                    <div class="warehouse-stats-badge">
                        ${occupiedCount}/70
                    </div>
                    <div class="warehouse-slots-container">
                        ${slotsHTML}
                    </div>
                    <div class="warehouse-line-label">
                        <span>${line}</span>
                        <iconify-icon icon="solar:box-minimalistic-bold" width="16" style="color: ${lineColor}"></iconify-icon>
                    </div>
                </div>
            `;
        }
        
        // NORMAL LAYOUT (left side): Label on left, content in middle, stats on right
        return `
            <div class="warehouse-line-row" data-line="${line}">
                <div class="warehouse-line-label">
                    <iconify-icon icon="solar:box-minimalistic-bold" width="16" style="color: ${lineColor}"></iconify-icon>
                    <span>${line}</span>
                </div>
                <div class="warehouse-slots-container">
                    ${slotsHTML}
                </div>
                <div class="warehouse-stats-badge">
                    ${occupiedCount}/70
                </div>
            </div>
        `;
    },

    /**
     * Render a line with single row (35 boxes only) - for Lines G & O
     */
    renderSingleRowLine(line, occupancyMap, isRightSide = false) {
        const lineColor = ShelfLocations.getAreaColor(`${line}-01`);
        
        // Count occupied slots (only first 35)
        let occupiedCount = 0;
        for (let pos = 1; pos <= 35; pos++) {
            const code = `${line}-${pos.toString().padStart(2, '0')}`;
            if (occupancyMap[code]) occupiedCount++;
        }
        
        // Generate small rectangles for 35 positions only (1 row)
        let slotsHTML = '';
        for (let pos = 1; pos <= 35; pos++) {
            const code = `${line}-${pos.toString().padStart(2, '0')}`;
            const occupied = occupancyMap[code];
            
            let slotClass = 'warehouse-slot empty';
            let tooltip = `${code} - Trống`;
            
            if (occupied) {
                if (occupied.isOverdue) {
                    slotClass = 'warehouse-slot overdue';
                    tooltip = `${code} - QUÁ HẠN\\nMO: ${occupied.moNumbers.join(', ')}`;
                } else {
                    slotClass = 'warehouse-slot occupied';
                    tooltip = `${code} - Đã dùng\\nMO: ${occupied.moNumbers.join(', ')}`;
                }
            }
            
            slotsHTML += `
                <div class="${slotClass}" 
                    data-shelf="${code}" 
                    data-tooltip="${tooltip}"
                    onclick="UIController.handleStorageSlotClick('${code}')">
                </div>
            `;
        }
        
        // RIGHT SIDE LAYOUT (Line O): Stats on left, content in middle, label on right
        if (isRightSide) {
            return `
                <div class="warehouse-line-row warehouse-line-single-row warehouse-line-right" data-line="${line}">
                    <div class="warehouse-stats-badge">
                        ${occupiedCount}/35
                    </div>
                    <div class="warehouse-slots-container-single">
                        ${slotsHTML}
                    </div>
                    <div class="warehouse-line-label">
                        <span>${line}</span>
                        <iconify-icon icon="solar:box-minimalistic-bold" width="16" style="color: ${lineColor}"></iconify-icon>
                    </div>
                </div>
            `;
        }
        
        // NORMAL LAYOUT (Line G): Label on left, content in middle, stats on right
        return `
            <div class="warehouse-line-row warehouse-line-single-row" data-line="${line}">
                <div class="warehouse-line-label">
                    <iconify-icon icon="solar:box-minimalistic-bold" width="16" style="color: ${lineColor}"></iconify-icon>
                    <span>${line}</span>
                </div>
                <div class="warehouse-slots-container-single">
                    ${slotsHTML}
                </div>
                <div class="warehouse-stats-badge">
                    ${occupiedCount}/35
                </div>
            </div>
        `;
    }

};
