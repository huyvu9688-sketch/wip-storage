/**
 * UI Controller - Storage Layout Focus with Shelf Detail Card
 * Handles all UI rendering and user interactions
 */

const UIController = {
    elements: {
        searchMOInput: null,
        searchMOBtn: null,
        addMOInput: null,
        addMOBtn: null,
        heroPanelBody: null,
        heroPanelEmpty: null,
        heroPanelCards: null,
        heroPanelFooter: null,
        heroPanelCount: null,
        heroClearBtn: null,
        shelfDetailModal: null,
        shelfCardLocation: null,
        shelfCardMOList: null,
        shelfCardAddBtn: null
    },

    heroPanelCards: [],
    currentShelfCode: null,
    OVERDUE_THRESHOLD_HOURS: 72,

    /**
     * Initialize UI elements
     */
    init() {
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
        this.elements.shelfDetailModal = document.getElementById('shelf-detail-modal');
        this.elements.shelfCardLocation = document.getElementById('shelf-card-location');
        this.elements.shelfCardMOList = document.getElementById('shelf-card-mo-list');
        this.elements.shelfCardAddBtn = document.getElementById('shelf-card-add-btn');

        this.setupEventListeners();
        this.setupHeroPanelScrollListener();
        this.setupExcelImport();
        this.setupShelfCardModalListeners();
        this.render();
        this.setMode('add');
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
     * Setup shelf card modal listeners
     */
    setupShelfCardModalListeners() {
        if (!this.elements.shelfDetailModal) return;

        // Close modal when clicking overlay (not the card)
        this.elements.shelfDetailModal.addEventListener('click', (e) => {
            if (e.target === this.elements.shelfDetailModal) {
                this.closeShelfDetailCard();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.shelfDetailModal.classList.contains('hidden')) {
                this.closeShelfDetailCard();
            }
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
     * Setup Excel import functionality
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
     * Handle Excel file upload
     */
    async handleExcelUpload(file) {
        const fileNameEl = document.getElementById('import-file-name');
        
        if (!fileNameEl) {
            console.error('import-file-name element not found');
            return;
        }
        
        fileNameEl.textContent = 'Parsing...';
        
        try {
            if (typeof ExcelParser === 'undefined') {
                throw new Error('ExcelParser module not loaded');
            }
            
            const schedule = await ExcelParser.parseFile(file);
            
            fileNameEl.textContent = file.name;
            
            const summaryEl = document.getElementById('import-summary');
            const summaryText = document.getElementById('import-summary-text');
            
            if (summaryEl && summaryText) {
                summaryText.textContent = `Loaded ${schedule.moList.length} MOs${schedule.date ? ' for ' + schedule.date : ''}`;
                summaryEl.classList.remove('hidden');
            }
            
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
     * Update navbar delivery schedule
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
        
        this.updateNavbarSchedule(analysis);
        console.log('Navbar schedule updated:', analysis);
    },

    /**
     * Update navbar delivery schedule dropdown
     */
    updateNavbarSchedule(analysis) {
        if (!analysis) return;

        const indicator = document.getElementById('delivery-schedule-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }

        const urgentBadge = document.getElementById('urgent-badge');
        const upcomingBadge = document.getElementById('upcoming-badge');

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

        const inWIPCount = document.getElementById('dropdown-in-wip-count');
        const missingCount = document.getElementById('dropdown-missing-count');

        if (inWIPCount) inWIPCount.textContent = analysis.inWIP.length;
        if (missingCount) missingCount.textContent = analysis.missing.length;

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

        const scrollContainer = document.querySelector('#schedule-dropdown .overflow-y-auto');
        if (scrollContainer && analysis.overdue && analysis.overdue.length > 0) {
            const existingOverdue = document.getElementById('dropdown-overdue-section');
            if (existingOverdue) existingOverdue.remove();
            
            scrollContainer.insertBefore(overdueSection, scrollContainer.firstChild);
        }

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

        const nextShelf = ShelfLocations.getNextAvailable();

        if (!nextShelf) {
            BarcodeScanner.playError();
            BarcodeScanner.showScanFeedback('❌ TẤT CẢ 1,120 VỊ TRÍ ĐÃ ĐẦY!', 'error');
            console.error('All shelf locations are full!');
            return;
        }

        const card = WIPManager.createCard(nextShelf, moNumber);
        
        if (card) {
            this.render();
            
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
            this.elements.addMOInput.value = '';
            this.elements.addMOInput.focus();
        }
    },

    /**
     * Main render function
     */
    render() {
        this.renderStorageLayout();
        this.updateOverdueTicker();
    },

    /**
     * Render Storage Layout Visualization
     */
    renderStorageLayout() {
        const container = document.getElementById('storage-warehouse-grid');
        if (!container) return;

        const allCards = WIPManager.getAll();
        
        const OVERDUE_THRESHOLD = this.OVERDUE_THRESHOLD_HOURS || 72;
        const now = new Date();
        
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

        const leftColumn = [
            { type: 'cushion', dataLine: 'P', displayLine: 'P' },
            { type: 'normal', dataLine: 'O', displayLine: 'O' },
            { type: 'normal', dataLine: 'N', displayLine: 'N' },
            { type: 'normal', dataLine: 'M', displayLine: 'M' },
            { type: 'arrangement', dataLine: 'L', displayLine: 'L' },
            { type: 'arrangement', dataLine: 'K', displayLine: 'K' },
            { type: 'ready', dataLine: 'J', displayLine: 'J' },
            { type: 'other', dataLine: 'I', displayLine: 'I' }
        ];

        const rightColumn = [
            { type: 'cushion', dataLine: 'H', displayLine: 'H' },
            { type: 'normal', dataLine: 'G', displayLine: 'G' },
            { type: 'normal', dataLine: 'F', displayLine: 'F' },
            { type: 'normal', dataLine: 'E', displayLine: 'E' },
            { type: 'normal', dataLine: 'D', displayLine: 'D' },
            { type: 'normal', dataLine: 'C', displayLine: 'C' },
            { type: 'normal', dataLine: 'B', displayLine: 'B' },
            { type: 'normal', dataLine: 'A', displayLine: 'A' }
        ];

        let leftHTML = '';
        let rightHTML = '';

        leftColumn.forEach(item => {
            leftHTML += this.renderLineByType(item, occupancyMap, true);
        });

        rightColumn.forEach(item => {
            rightHTML += this.renderLineByType(item, occupancyMap, false);
        });

        container.innerHTML = `
            <div class="warehouse-column-left">
                ${leftHTML}
            </div>
            <div class="warehouse-column-right">
                ${rightHTML}
            </div>
        `;

        const totalOccupied = allCards.length;
        const totalSlots = 1120;
        const occupancyRate = Math.round((totalOccupied / totalSlots) * 100);
        
        const occupancyEl = document.getElementById('storage-occupancy-rate');
        if (occupancyEl) {
            occupancyEl.textContent = `${occupancyRate}%`;
        }
    },

    /**
     * Render a line based on its type
     */
    renderLineByType(item, occupancyMap, isLeftColumn = false) {
        const { type, dataLine, displayLine } = item;
        
        switch (type) {
            case 'cushion':
                return this.renderCushionRack(dataLine);
            
            case 'arrangement':
                return this.renderArrangementArea(dataLine);
            
            case 'ready':
                return this.renderReadyToGo(dataLine);
            
            case 'other':
                return this.renderOtherArea(dataLine);
            
            case 'normal':
                return this.renderNormalLine(dataLine, occupancyMap, displayLine, isLeftColumn);
            
            default:
                return '';
        }
    },

    /**
     * Render Cushion Rack
     */
    renderCushionRack(dataLine) {
        return `
            <div class="warehouse-line-row warehouse-line-cushion warehouse-line-no-label" data-line="${dataLine}">
                <div class="warehouse-cushion-box">
                    <iconify-icon icon="solar:sofa-bold" width="20" style="color: rgba(59, 130, 246, 0.8)"></iconify-icon>
                    <span class="cushion-text">Cushion rack</span>
                </div>
            </div>
        `;
    },

    /**
     * Render Arrangement Area
     */
    renderArrangementArea(dataLine) {
        return `
            <div class="warehouse-line-row warehouse-line-arrangement warehouse-line-no-label" data-line="${dataLine}">
                <div class="warehouse-arrangement-box">
                    <iconify-icon icon="solar:layers-minimalistic-bold" width="20" style="color: rgba(251, 191, 36, 0.8)"></iconify-icon>
                    <span class="arrangement-text">Arrangement Area</span>
                </div>
            </div>
        `;
    },

    /**
     * Render Ready to go
     */
    renderReadyToGo(dataLine) {
        return `
            <div class="warehouse-line-row warehouse-line-ready warehouse-line-no-label" data-line="${dataLine}">
                <div class="warehouse-ready-box">
                    <iconify-icon icon="solar:check-circle-bold" width="20" style="color: rgba(124, 156, 90, 0.8)"></iconify-icon>
                    <span class="ready-text">Ready to go</span>
                </div>
            </div>
        `;
    },

    /**
     * Render Other area
     */
    renderOtherArea(dataLine) {
        return `
            <div class="warehouse-line-row warehouse-line-other warehouse-line-no-label" data-line="${dataLine}">
                <div class="warehouse-other-box">
                    <iconify-icon icon="solar:widget-5-bold" width="20" style="color: rgba(124, 156, 90, 0.8)"></iconify-icon>
                    <span class="other-text">Other area</span>
                </div>
            </div>
        `;
    },

    /**
     * Render normal storage line with boxes
     */
    renderNormalLine(dataLine, occupancyMap, displayLine, isLeftColumn = false) {
        const lineColor = ShelfLocations.getAreaColor(`${dataLine}-01`);
        
        const isSingleRow = (dataLine === 'G' || dataLine === 'O');
        const maxPosition = isSingleRow ? 35 : 70;
        
        let occupiedCount = 0;
        for (let pos = 1; pos <= maxPosition; pos++) {
            const code = `${dataLine}-${pos.toString().padStart(2, '0')}`;
            if (occupancyMap[code]) occupiedCount++;
        }
        
        let slotsHTML = '';
        for (let pos = 1; pos <= maxPosition; pos++) {
            const code = `${dataLine}-${pos.toString().padStart(2, '0')}`;
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
        
        const containerClass = isSingleRow ? 'warehouse-slots-container-single' : 'warehouse-slots-container';
        const rowBaseClass = isSingleRow ? 'warehouse-line-row warehouse-line-single-row' : 'warehouse-line-row';
        
        if (isLeftColumn) {
            return `
                <div class="${rowBaseClass} warehouse-line-right" data-line="${dataLine}">
                    <div class="warehouse-stats-badge">
                        ${occupiedCount}/${maxPosition}
                    </div>
                    <div class="${containerClass}">
                        ${slotsHTML}
                    </div>
                    <div class="warehouse-line-label">
                        <span>${displayLine}</span>
                        <iconify-icon icon="solar:box-minimalistic-bold" width="16" style="color: ${lineColor}"></iconify-icon>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="${rowBaseClass}" data-line="${dataLine}">
                <div class="warehouse-line-label">
                    <iconify-icon icon="solar:box-minimalistic-bold" width="16" style="color: ${lineColor}"></iconify-icon>
                    <span>${displayLine}</span>
                </div>
                <div class="${containerClass}">
                    ${slotsHTML}
                </div>
                <div class="warehouse-stats-badge">
                    ${occupiedCount}/${maxPosition}
                </div>
            </div>
        `;
    },

    /**
     * Handle storage slot click - Opens shelf detail card
     */
    handleStorageSlotClick(shelfCode) {
        this.currentShelfCode = shelfCode;
        this.openShelfDetailCard(shelfCode);
    },

    /**
     * Open shelf detail card
     */
    openShelfDetailCard(shelfCode) {
        const cards = WIPManager.getByShelf(shelfCode);
        
        // Update location header
        this.elements.shelfCardLocation.textContent = shelfCode;
        
        // Render MO list
        this.renderShelfCardMOList(cards);
        
        // Show modal
        this.elements.shelfDetailModal.classList.remove('hidden');
        
        // Disable body scroll
        document.body.style.overflow = 'hidden';
        
        console.log(`Opened shelf detail card for: ${shelfCode}`);
    },

    /**
     * Close shelf detail card
     */
    closeShelfDetailCard() {
        this.elements.shelfDetailModal.classList.add('hidden');
        this.currentShelfCode = null;
        
        // Re-enable body scroll
        document.body.style.overflow = '';
        
        // Refresh storage layout to update slot colors
        this.render();
        
        console.log('Closed shelf detail card');
    },

    /**
     * Render MO list in shelf card
     */
    renderShelfCardMOList(cards) {
        if (!this.elements.shelfCardMOList) return;
        
        // Get all MOs at this shelf
        const allMOs = [];
        cards.forEach(card => {
            const moNumbers = card.moNumbers || [card.moNumber];
            moNumbers.forEach(mo => {
                allMOs.push({
                    moNumber: mo,
                    createdAt: card.createdAt,
                    cardId: card.id
                });
            });
        });
        
        // Update Add button state
        const isAtMax = allMOs.length >= WIPManager.MAX_MOS_PER_CARD;
        this.elements.shelfCardAddBtn.disabled = isAtMax;
        
        if (allMOs.length === 0) {
            // Empty state
            this.elements.shelfCardMOList.innerHTML = `
                <div class="shelf-card-empty">
                    <iconify-icon icon="solar:box-linear" width="48"></iconify-icon>
                    <p>Vị trí này đang trống<br>Nhấn "Thêm MO" để thêm</p>
                </div>
            `;
            return;
        }
        
        // Render MO items
        const html = allMOs.map(mo => {
            const createdDate = new Date(mo.createdAt);
            const dateStr = createdDate.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timeStr = createdDate.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            return `
                <div class="shelf-card-mo-item">
                    <div class="shelf-card-mo-number">
                        <iconify-icon icon="solar:box-minimalistic-bold" width="20"></iconify-icon>
                        ${mo.moNumber}
                    </div>
                    <div class="shelf-card-mo-time">
                        <iconify-icon icon="solar:clock-circle-linear" width="14"></iconify-icon>
                        ${dateStr} • ${timeStr}
                    </div>
                    <button class="shelf-card-remove-mo" 
                            onclick="UIController.removeMOFromShelfCard('${mo.cardId}', '${mo.moNumber}')"
                            title="Xóa MO này">
                        <iconify-icon icon="solar:trash-bin-minimalistic-bold" width="16"></iconify-icon>
                    </button>
                </div>
            `;
        }).join('');
        
        this.elements.shelfCardMOList.innerHTML = html;
    },

    /**
     * Add MO to current shelf
     */
    addMOToShelf() {
        if (!this.currentShelfCode) return;
        
        const moNumber = prompt('Nhập mã MO:');
        if (!moNumber || moNumber.trim() === '') return;
        
        const trimmedMO = moNumber.trim();
        
        // Check for duplicate
        if (WIPManager.isDuplicateMO(trimmedMO)) {
            const existingCard = WIPManager.getByMO(trimmedMO);
            BarcodeScanner.playError();
            BarcodeScanner.showCardNotification(
                'error',
                'Lỗi trùng mã MO',
                `MO "${trimmedMO}" đã tồn tại tại vị trí ${existingCard.shelfCode}`,
                null
            );
            return;
        }
        
        // Create or add to card
        const card = WIPManager.createCard(this.currentShelfCode, trimmedMO);
        
        if (card) {
            BarcodeScanner.playSuccess();
            BarcodeScanner.showScanFeedback(`✓ Đã thêm MO "${trimmedMO}" vào ${this.currentShelfCode}`, 'success');
            
            // Refresh card display
            const cards = WIPManager.getByShelf(this.currentShelfCode);
            this.renderShelfCardMOList(cards);
            
            // Refresh storage layout
            this.render();
            
            // Update dashboard if Excel schedule is loaded
            if (typeof ExcelParser !== 'undefined' && ExcelParser.scheduledMOs) {
                this.updateMODashboard();
            }
        } else {
            BarcodeScanner.playError();
            BarcodeScanner.showScanFeedback('Không thể thêm MO (đã đầy hoặc lỗi)', 'error');
        }
    },

    /**
     * Remove MO from shelf card
     */
    removeMOFromShelfCard(cardId, moNumber) {
        if (!confirm(`Xác nhận xóa MO "${moNumber}" khỏi kệ?`)) {
            return;
        }
        
        const success = WIPManager.removeMOFromCard(cardId, moNumber);
        
        if (success) {
            BarcodeScanner.playSuccess();
            BarcodeScanner.showScanFeedback(`✓ Đã xóa MO "${moNumber}"`, 'success');
            
            // Check if shelf is now empty
            const cards = WIPManager.getByShelf(this.currentShelfCode);
            if (cards.length === 0) {
                // Close card if empty
                this.closeShelfDetailCard();
            } else {
                // Refresh card display
                this.renderShelfCardMOList(cards);
            }
            
            // Refresh storage layout
            this.render();
            
            // Update dashboard if Excel schedule is loaded
            if (typeof ExcelParser !== 'undefined' && ExcelParser.scheduledMOs) {
                this.updateMODashboard();
            }
        } else {
            BarcodeScanner.playError();
            BarcodeScanner.showScanFeedback('Lỗi khi xóa MO', 'error');
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
            this.setMode('add');
        }, 100);
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
     * Generate card HTML for hero panel
     */
    generateCardHTML(card, isHeroPanel = false) {
        const createdDate = card.createdAt ? new Date(card.createdAt) : new Date();
        const now = new Date();
        const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
        const hoursOnShelf = Math.floor(hoursDiff);

        const isOverdue = hoursDiff >= this.OVERDUE_THRESHOLD_HOURS;
        const overdueClass = isOverdue ? 'card-overdue-alert' : '';
        const badgeClass = isOverdue ? 'overdue-badge-alert' : '';

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

                <div class="card-mo-section">
                    <div class="card-icon" style="background: transparent;">
                        <iconify-icon icon="solar:box-linear" style="color: #000000;" width="22" stroke-width="1.5"></iconify-icon>
                    </div>
                    
                    <div class="card-mo-list">
                        ${moTextHTML.join('')}
                    </div>
                </div>

                <div class="card-location">
                    <div class="location-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div class="location-text" title="${card.shelfCode}">
                        ${card.shelfCode}
                    </div>
                </div>

                <div class="card-datetime">
                    <div class="datetime-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                
                ${isOverdue ? `
                    <div class="overdue-badge ${badgeClass}"
                        title="${hoursOnShelf} giờ trên kệ - QUÁ 3 NGÀY!">
                        <iconify-icon icon="solar:danger-triangle-bold" width="12"></iconify-icon>
                        <span>${hoursOnShelf}h</span>
                    </div>
                ` : ''}
            </div>
        `;
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
     * Remove hero panel MOs from shelves
     */
    removeHeroPanelFromShelves() {
        if (this.heroPanelCards.length === 0) return;

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

        moRemovalList.forEach(item => {
            const card = WIPManager.cards.find(c => c.id === item.cardId);
            
            if (!card) {
                console.warn(`Card not found: ${item.cardId}`);
                return;
            }

            if (!card.moNumbers) {
                card.moNumbers = card.moNumber ? [card.moNumber] : [];
            }

            const moIndex = card.moNumbers.indexOf(item.moNumber);
            
            if (moIndex === -1) {
                console.warn(`MO not found in card: ${item.moNumber}`);
                return;
            }

            card.moNumbers.splice(moIndex, 1);
            removedCount++;

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
                if (typeof LogManager !== 'undefined') {
                    LogManager.writeLog('REMOVE_MO', card, null, item.moNumber);
                }
                
                console.log(`✓ Removed MO ${item.moNumber} from card ${card.shelfCode} (${card.moNumbers.length} MOs remaining)`);
            }
        });

        WIPManager.saveToStorage();

        let message = `✓ Đã lấy ${removedCount} MO khỏi kệ`;
        if (deletedCards > 0) {
            message += ` (${deletedCards} thẻ đã xóa do hết MO)`;
        }
        
        BarcodeScanner.showScanFeedback(message, 'success');
        
        this.clearHeroPanel();
        this.render();
        
        if (typeof ExcelParser !== 'undefined' && ExcelParser.scheduledMOs) {
            this.updateMODashboard();
        }
    },

    /**
     * Set mode (add/find)
     */
    setMode(mode) {
        console.log('═════════════════════════════════════');
        console.log(`🎯 setMode() called with mode: "${mode}"`);
        console.log('═════════════════════════════════════');
        
        const addModeBtn = document.getElementById('add-mode-btn');
        const findModeBtn = document.getElementById('find-mode-btn');
        
        console.log('Button elements found:', {
            addModeBtn: !!addModeBtn,
            findModeBtn: !!findModeBtn
        });
        
        const addMOInput = document.getElementById('addMOInput');
        const addMOBtn = document.getElementById('addMOBtn');
        const addMOContainer = addMOInput?.closest('.glass-light');
        
        const searchMOInput = document.getElementById('searchMOInput');
        const searchMOBtn = document.getElementById('searchMOBtn');
        const searchMOContainer = searchMOInput?.closest('.glass-light');
        
        const heroPanelBody = document.getElementById('hero-panel-body');
        
        console.log('Input elements found:', {
            addMOInput: !!addMOInput,
            addMOBtn: !!addMOBtn,
            addMOContainer: !!addMOContainer,
            searchMOInput: !!searchMOInput,
            searchMOBtn: !!searchMOBtn,
            searchMOContainer: !!searchMOContainer
        });
        
        if (!addModeBtn || !findModeBtn) {
            console.error('❌ Mode buttons not found in DOM!');
            return;
        }
        
        if (mode === 'add') {
            console.log('➡️ Activating ADD mode...');
            
            // Toggle button states
            addModeBtn.classList.add('active');
            findModeBtn.classList.remove('active');
            console.log('✓ Button classes toggled');
            
            // Enable Add MO section
            if (addMOContainer) {
                addMOContainer.classList.remove('opacity-50', 'pointer-events-none');
                console.log('✓ Add MO container enabled');
            }
            if (addMOInput) {
                addMOInput.disabled = false;
                setTimeout(() => {
                    addMOInput.focus();
                    console.log('✓ Add MO input focused');
                }, 100);
            }
            if (addMOBtn) {
                addMOBtn.disabled = false;
                console.log('✓ Add MO button enabled');
            }
            
            // Disable Find MO section
            if (searchMOContainer) {
                searchMOContainer.classList.add('opacity-50', 'pointer-events-none');
                console.log('✓ Search container disabled');
            }
            if (searchMOInput) {
                searchMOInput.disabled = true;
            }
            if (searchMOBtn) {
                searchMOBtn.disabled = true;
            }
            if (heroPanelBody) {
                const panel = heroPanelBody.parentElement;
                if (panel) {
                    panel.classList.add('opacity-50', 'pointer-events-none');
                    console.log('✓ Hero panel disabled');
                }
            }
            
            console.log('✅ ADD MO MODE ACTIVATED');
            
        } else if (mode === 'find') {
            console.log('➡️ Activating FIND mode...');
            
            // Toggle button states
            findModeBtn.classList.add('active');
            addModeBtn.classList.remove('active');
            console.log('✓ Button classes toggled');
            
            // Enable Find MO section
            if (searchMOContainer) {
                searchMOContainer.classList.remove('opacity-50', 'pointer-events-none');
                console.log('✓ Search container enabled');
            }
            if (searchMOInput) {
                searchMOInput.disabled = false;
                setTimeout(() => {
                    searchMOInput.focus();
                    console.log('✓ Search input focused');
                }, 100);
            }
            if (searchMOBtn) {
                searchMOBtn.disabled = false;
            }
            if (heroPanelBody) {
                const panel = heroPanelBody.parentElement;
                if (panel) {
                    panel.classList.remove('opacity-50', 'pointer-events-none');
                    console.log('✓ Hero panel enabled');
                }
            }
            
            // Disable Add MO section
            if (addMOContainer) {
                addMOContainer.classList.add('opacity-50', 'pointer-events-none');
                console.log('✓ Add MO container disabled');
            }
            if (addMOInput) {
                addMOInput.disabled = true;
            }
            if (addMOBtn) {
                addMOBtn.disabled = true;
            }
            
            console.log('✅ FIND MO MODE ACTIVATED');
        }
        
        console.log('═════════════════════════════════════\n');
    },

    /**
     * Update overdue ticker
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
    }
};
