/**
 * Log Manager - Enhanced with Password-Protected Directory Selection
 */

const LogManager = {
    config: {
        enableLogging: true,
        enableBackup: true,
        autoSaveInterval: 5000,  // Auto-save every 5 seconds
        changeLocationPassword: 'admin123'  // TODO: Change this password!
    },

    state: {
        db: null,
        currentMonth: null,
        fileHandle: null,
        directoryHandle: null,
        logBuffer: [],
        lastWriteTime: null,
        isAuthenticated: false
    },

    /**
     * Initialize with file system access
     */
    async init() {
        await this.initIndexedDB();
        this.updateCurrentMonth();
        
        // Try to restore previous directory access
        await this.restorePreviousDirectoryAccess();
        
        // Start auto-save interval
        this.startAutoSave();
        
        console.log('✓ Log Manager initialized');
    },

    /**
     * Update current month tracker
     */
    updateCurrentMonth() {
        const now = new Date();
        this.state.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Initialize IndexedDB with settings store
     */
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('WIPStorageDB', 2);  // Increment version
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.state.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Logs store
                if (!db.objectStoreNames.contains('logs')) {
                    const logStore = db.createObjectStore('logs', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    logStore.createIndex('month', 'month', { unique: false });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                    logStore.createIndex('action', 'action', { unique: false });
                    logStore.createIndex('moNumber', 'moNumber', { unique: false });
                }
                
                // State store
                if (!db.objectStoreNames.contains('state')) {
                    db.createObjectStore('state', { keyPath: 'id' });
                }
                
                // Settings store (NEW)
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
            };
        });
    },

    /**
     * Restore previous directory access on page load
     */
    async restorePreviousDirectoryAccess() {
        try {
            const storedHandle = await this.getStoredDirectoryHandle();
            
            if (storedHandle) {
                // Verify we still have permission
                const permission = await storedHandle.queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    this.state.directoryHandle = storedHandle;
                    console.log('✓ Restored directory access:', storedHandle.name);
                    this.updateDirectoryDisplay();
                    return;
                }
            }
        } catch (error) {
            console.warn('Could not restore directory access:', error);
        }
    },

    /**
     * Prompt for password before allowing directory change
     */
    async promptPasswordAndChangeDirectory() {
        // Check browser support
        if (!window.showDirectoryPicker) {
            alert('⚠️ Trình duyệt không hỗ trợ chức năng này.\n\nVui lòng sử dụng Chrome hoặc Edge phiên bản 86 trở lên.');
            return;
        }

        // Show password dialog
        this.showPasswordDialog();
    },

    /**
     * Show password input dialog
     */
    showPasswordDialog() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'password-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
            animation: slideUp 0.3s ease;
        `;

        modal.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #7c7c67 0%, #5b5b4b 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <h2 style="color: var(--olive-950); font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">Xác Thực</h2>
                <p style="color: var(--olive-500); font-size: 0.875rem; margin-bottom: 1.5rem;">Nhập mật khẩu để thay đổi vị trí lưu log</p>
                
                <input type="password" id="password-input" placeholder="Mật khẩu"
                    style="width: 100%; padding: 0.75rem 1rem; border: 2px solid var(--olive-300); border-radius: 0.5rem; font-size: 0.875rem; margin-bottom: 0.5rem; outline: none; transition: border-color 0.2s;"
                    onfocus="this.style.borderColor='var(--olive-500)'"
                    onblur="this.style.borderColor='var(--olive-300)'">
                
                <div id="password-error" style="color: #DC2626; font-size: 0.75rem; margin-bottom: 1rem; min-height: 1rem; text-align: left;"></div>
                
                <div style="display: flex; gap: 0.75rem;">
                    <button id="cancel-btn" style="flex: 1; padding: 0.75rem; border: 2px solid var(--olive-300); background: white; color: var(--olive-700); border-radius: 0.5rem; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                        Hủy
                    </button>
                    <button id="confirm-btn" style="flex: 1; padding: 0.75rem; border: none; background: linear-gradient(135deg, var(--olive-500) 0%, var(--olive-600) 100%); color: white; border-radius: 0.5rem; font-weight: 500; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(124, 124, 103, 0.25);">
                        Xác Nhận
                    </button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            #password-input:focus {
                border-color: var(--olive-500) !important;
            }
            #cancel-btn:hover {
                background: var(--olive-50);
                border-color: var(--olive-400);
            }
            #confirm-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(124, 124, 103, 0.35);
            }
        `;
        document.head.appendChild(style);

        // Event listeners
        const passwordInput = document.getElementById('password-input');
        const errorDiv = document.getElementById('password-error');
        const cancelBtn = document.getElementById('cancel-btn');
        const confirmBtn = document.getElementById('confirm-btn');

        // Focus password input
        setTimeout(() => passwordInput.focus(), 100);

        // Cancel button
        cancelBtn.onclick = () => {
            overlay.remove();
        };

        // Confirm button
        const validatePassword = async () => {
            const password = passwordInput.value;

            if (!password) {
                errorDiv.textContent = 'Vui lòng nhập mật khẩu';
                passwordInput.style.borderColor = '#DC2626';
                return;
            }

            if (password === this.config.changeLocationPassword) {
                overlay.remove();
                await this.requestDirectoryAccess();
            } else {
                errorDiv.textContent = '❌ Mật khẩu không đúng';
                passwordInput.style.borderColor = '#DC2626';
                passwordInput.value = '';
                passwordInput.focus();
            }
        };

        confirmBtn.onclick = validatePassword;

        // Enter key to submit
        passwordInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                validatePassword();
            }
        };

        // Escape key to cancel
        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
            }
        };
    },

    /**
     * Request directory access from user (after password validation)
     */
    async requestDirectoryAccess() {
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents',  // Start in Documents folder
                id: 'wip-log-directory',  // Remember last used directory
            });

            // Verify we can write to this directory
            try {
                // Test write permission
                const testFileName = '.wip-test-write';
                const testFile = await dirHandle.getFileHandle(testFileName, { create: true });
                await dirHandle.removeEntry(testFileName);
                
                // Success - directory is writable
                this.state.directoryHandle = dirHandle;
                
                // Store the handle for future use
                await this.storeDirectoryHandle(dirHandle);
                
                // Update UI display
                this.updateDirectoryDisplay();
                
                BarcodeScanner.showScanFeedback('✓ Đã cập nhật vị trí lưu log', 'success');
                console.log('✓ Directory access granted:', dirHandle.name);
                
            } catch (writeError) {
                console.error('Directory is not writable:', writeError);
                
                BarcodeScanner.showCardNotification(
                    'error',
                    'Không thể ghi vào thư mục',
                    'Vui lòng chọn thư mục khác có quyền ghi.',
                    `Lỗi: ${writeError.message}`
                );
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('User cancelled directory selection');
            } else if (error.name === 'SecurityError') {
                console.error('Security error - cannot access this location:', error);
                
                BarcodeScanner.showCardNotification(
                    'error',
                    'Không thể truy cập vị trí này',
                    'Vui lòng chọn thư mục từ ổ đĩa cục bộ.',
                    'Không thể truy cập thư mục hệ thống, mạng, hoặc HTTP server.'
                );
            } else {
                console.error('Failed to get directory access:', error);
                
                BarcodeScanner.showCardNotification(
                    'error',
                    'Lỗi khi chọn thư mục',
                    'Vui lòng thử lại hoặc chọn thư mục khác.',
                    `Lỗi: ${error.message}`
                );
            }
        }
    },

    /**
     * Update directory display in footer
     */
    updateDirectoryDisplay() {
        const displayElement = document.getElementById('log-directory-display');
        if (displayElement && this.state.directoryHandle) {
            displayElement.textContent = this.state.directoryHandle.name;
            displayElement.style.color = 'rgba(255,255,255,0.8)';
        }
    },

    /**
     * Store directory handle in IndexedDB
     */
    async storeDirectoryHandle(dirHandle) {
        try {
            const transaction = this.state.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            await store.put({
                id: 'directoryHandle',
                handle: dirHandle,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to store directory handle:', error);
        }
    },

    /**
     * Get stored directory handle from IndexedDB
     */
    async getStoredDirectoryHandle() {
        try {
            const transaction = this.state.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('directoryHandle');
            
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(request.result ? request.result.handle : null);
                };
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    },

    /**
     * Write log entry - UPDATED for multiple MOs
     */
    async writeLog(action, card, duration = null, specificMO = null) {
        if (!this.config.enableLogging) return;

        this.updateCurrentMonth();
        
        const timestamp = new Date().toISOString();
        
        // Get MO numbers (handle old single MO format)
        const moNumbers = card.moNumbers || [card.moNumber];
        const logMO = specificMO || moNumbers.join(',');
        
        const logEntry = {
            timestamp,
            month: this.state.currentMonth,
            action,
            shelfCode: card.shelfCode,
            moNumber: logMO,
            cardId: card.id,
            duration: duration || null
        };

        this.state.logBuffer.push(logEntry);

        const transaction = this.state.db.transaction(['logs'], 'readwrite');
        const store = transaction.objectStore('logs');
        await store.add(logEntry);

        if (action === 'ADD' || action === 'ADD_MO') {
            await this.updateState(card, 'add');
        } else if (action === 'REMOVE' || action === 'REMOVE_MO') {
            await this.updateState(card, 'remove');
        }

        await this.flushLogBuffer();

        console.log(`[LOG] ${this.formatLogLine(logEntry)}`);
        
        return logEntry;
    },

    /**
     * Flush log buffer to disk file
     */
    async flushLogBuffer() {
        if (!this.state.directoryHandle || this.state.logBuffer.length === 0) {
            return;
        }

        try {
            // Get or create log file for current month
            const filename = `wip_log_${this.state.currentMonth}.txt`;
            const fileHandle = await this.state.directoryHandle.getFileHandle(filename, { create: true });
            
            // Get writable stream (append mode)
            const writable = await fileHandle.createWritable({ keepExistingData: true });
            
            // Read existing file size to append at end
            const file = await fileHandle.getFile();
            const fileSize = file.size;
            
            // Seek to end of file
            await writable.seek(fileSize);
            
            // Write all buffered entries
            const entriesToWrite = [...this.state.logBuffer];
            for (const entry of entriesToWrite) {
                const line = this.formatLogLine(entry) + '\n';
                await writable.write(line);
            }
            
            // Close the file
            await writable.close();
            
            // Clear buffer
            this.state.logBuffer = this.state.logBuffer.filter(
                entry => !entriesToWrite.includes(entry)
            );
            this.state.lastWriteTime = new Date();
            
            console.log(`[FILE] Wrote ${entriesToWrite.length} entries to ${filename}`);
            
        } catch (error) {
            console.error('Failed to write to file:', error);
            
            // If permission was lost, notify user
            if (error.name === 'NotAllowedError') {
                BarcodeScanner.showScanFeedback('⚠️ Mất quyền truy cập thư mục log', 'warning');
            }
        }
    },

    /**
     * Start auto-save interval
     */
    startAutoSave() {
        setInterval(async () => {
            if (this.state.logBuffer.length > 0) {
                await this.flushLogBuffer();
            }
        }, this.config.autoSaveInterval);
        
        console.log(`✓ Auto-save started (${this.config.autoSaveInterval}ms interval)`);
    },

    /**
     * Format log entry as text line
     */
    formatLogLine(entry) {
        const timestamp = new Date(entry.timestamp).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        let line = `[${timestamp}] ${entry.action} | ${entry.shelfCode} | ${entry.moNumber} | ${entry.cardId}`;
        
        if (entry.duration) {
            line += ` | Duration: ${entry.duration}`;
        }
        
        return line;
    },

    /**
     * Update current state
     */
    async updateState(card, operation) {
        const transaction = this.state.db.transaction(['state'], 'readwrite');
        const store = transaction.objectStore('state');
        
        if (operation === 'add') {
            await store.put({
                id: card.id,
                shelfCode: card.shelfCode,
                moNumber: card.moNumber,
                timestamp: card.timestamp,
                createdAt: card.createdAt,
                areaColor: card.areaColor
            });
        } else if (operation === 'remove') {
            await store.delete(card.id);
        }
    },

    /**
     * Load current state from IndexedDB
     */
    async loadState() {
        const transaction = this.state.db.transaction(['state'], 'readonly');
        const store = transaction.objectStore('state');
        const request = store.getAll();
        
        return new Promise((resolve) => {
            request.onsuccess = () => {
                const cards = request.result || [];
                resolve(cards);
            };
        });
    },

    /**
     * Get logs for specific month
     */
    async getLogsByMonth(month) {
        const transaction = this.state.db.transaction(['logs'], 'readonly');
        const store = transaction.objectStore('logs');
        const index = store.index('month');
        const request = index.getAll(month);
        
        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result || []);
        });
    },

    /**
     * Get all available months
     */
    async getAvailableMonths() {
        const transaction = this.state.db.transaction(['logs'], 'readonly');
        const store = transaction.objectStore('logs');
        const request = store.getAll();
        
        return new Promise((resolve) => {
            request.onsuccess = () => {
                const logs = request.result || [];
                const months = [...new Set(logs.map(log => log.month))].sort();
                resolve(months);
            };
        });
    },

    /**
     * Export logs to text file (manual download)
     */
    async exportLogsToFile(month = null) {
        let logs;
        let filename;
        
        if (month) {
            logs = await this.getLogsByMonth(month);
            filename = `wip_log_${month}.txt`;
        } else {
            this.updateCurrentMonth();
            logs = await this.getLogsByMonth(this.state.currentMonth);
            filename = `wip_log_${this.state.currentMonth}.txt`;
        }

        if (logs.length === 0) {
            BarcodeScanner.showScanFeedback('Không có log nào để xuất', 'warning');
            return;
        }

        const textContent = logs.map(entry => this.formatLogLine(entry)).join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        BarcodeScanner.showScanFeedback(`✓ Đã xuất ${logs.length} log entries`, 'success');
        
        return textContent;
    },

    /**
     * Show export dialog with month selection
     */
    async showExportDialog() {
        const months = await this.getAvailableMonths();
        
        if (months.length === 0) {
            BarcodeScanner.showScanFeedback('Chưa có log nào', 'warning');
            return;
        }

        this.updateCurrentMonth();
        const monthList = months.map((m, i) => `${i + 1}. ${m}${m === this.state.currentMonth ? ' (hiện tại)' : ''}`).join('\n');
        
        const selection = prompt(
            `Chọn tháng để xuất log:\n\n${monthList}\n\nNhập số (hoặc để trống để xuất tháng hiện tại):`,
            ''
        );

        if (selection === null) return;

        let selectedMonth;
        if (selection.trim() === '') {
            selectedMonth = this.state.currentMonth;
        } else {
            const index = parseInt(selection) - 1;
            if (index >= 0 && index < months.length) {
                selectedMonth = months[index];
            } else {
                BarcodeScanner.showScanFeedback('Lựa chọn không hợp lệ', 'error');
                return;
            }
        }

        await this.exportLogsToFile(selectedMonth);
    },

    /**
     * Clear old logs (keep last N months)
     */
    async clearOldLogs(keepMonths = 3) {
        const months = await this.getAvailableMonths();
        
        if (months.length <= keepMonths) {
            console.log('No old logs to clear');
            BarcodeScanner.showScanFeedback('Không có log cũ để xóa', 'info');
            return 0;
        }

        const monthsToDelete = months.slice(0, months.length - keepMonths);
        let deletedCount = 0;

        for (const month of monthsToDelete) {
            const logs = await this.getLogsByMonth(month);
            
            const transaction = this.state.db.transaction(['logs'], 'readwrite');
            const store = transaction.objectStore('logs');
            
            for (const log of logs) {
                await store.delete(log.id);
                deletedCount++;
            }
        }

        console.log(`✓ Cleared ${deletedCount} old log entries from ${monthsToDelete.length} months`);
        BarcodeScanner.showScanFeedback(`✓ Đã xóa ${deletedCount} log entries cũ`, 'success');
        return deletedCount;
    }
};
