// ==========================================
// شركة مقاولات السجيني - المنظومة الرقمية
// Client-side JavaScript Application Logic
// ==========================================

let currentTab = 'dashboard';
let expensesChartInstance = null;
let currentProjectIdForModal = null;
let currentProjectDetailData = null;
let allProjectsList = [];
let allTeamMembers = [];
let selectedInvoiceFile = null;
let currentUser = {
    id: 1,
    name: 'ابوالنصر البغدادي',
    role: 'المدير المالي',
    phone: '0501234567'
};

// ----------------- THEME MANAGEMENT (وضع داكن / وضع فاتح) -----------------
function initTheme() {
    const savedTheme = localStorage.getItem('segieny_theme') || 'dark';
    applyTheme(savedTheme, false);
}

function applyTheme(theme, updateCharts = true) {
    const htmlEl = document.documentElement;
    const isLight = (theme === 'light');
    
    if (isLight) {
        htmlEl.setAttribute('data-theme', 'light');
        htmlEl.classList.add('theme-light');
        htmlEl.classList.remove('theme-dark');
    } else {
        htmlEl.setAttribute('data-theme', 'dark');
        htmlEl.classList.add('theme-dark');
        htmlEl.classList.remove('theme-light');
    }
    
    localStorage.setItem('segieny_theme', theme);
    
    // Update theme toggle button UI in header
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const toggleIcon = document.getElementById('theme-toggle-icon');
    const toggleText = document.getElementById('theme-toggle-text');
    const brandLogo = document.getElementById('brand-logo-img');
    
    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    
    if (isLight) {
        if (toggleText) toggleText.textContent = isEn ? 'Dark Mode' : 'وضع داكن';
        if (toggleIcon) {
            toggleIcon.setAttribute('data-lucide', 'moon');
            toggleIcon.className = 'w-4 h-4 text-indigo-500';
        }
        if (toggleBtn) {
            toggleBtn.title = isEn ? 'Switch to Dark Mode' : 'تفعيل الوضع الداكن';
        }
        if (brandLogo) brandLogo.src = '/static/images/logo-dark.png';
    } else {
        if (toggleText) toggleText.textContent = isEn ? 'Light Mode' : 'وضع فاتح';
        if (toggleIcon) {
            toggleIcon.setAttribute('data-lucide', 'sun');
            toggleIcon.className = 'w-4 h-4 text-amber-400';
        }
        if (toggleBtn) {
            toggleBtn.title = isEn ? 'Switch to Light Mode' : 'تفعيل الوضع الفاتح';
        }
        if (brandLogo) brandLogo.src = '/static/images/logo-white.png';
    }
    
    if (typeof initLucide === 'function') initLucide();
    
    // Refresh charts if needed to adapt colors
    if (updateCharts) {
        if (expensesChartInstance && typeof renderExpensesChart === 'function' && typeof cachedExpenses !== 'undefined') {
            renderExpensesChart(cachedExpenses);
        }
        if (typeof cashFlowChartInstance !== 'undefined' && cashFlowChartInstance) {
            if (typeof loadCashFlow === 'function' && currentTab === 'cashflow') {
                loadCashFlow();
            }
        }
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('segieny_theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
    
    const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
    const msg = nextTheme === 'light' 
        ? (isEn ? 'Switched to Light Mode' : 'تم تفعيل الوضع الفاتح بنجاح')
        : (isEn ? 'Switched to Dark Mode' : 'تم تفعيل الوضع الداكن بنجاح');
    if (typeof showToast === 'function') showToast(msg, 'info');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLucide();
    if (typeof setLanguage === 'function' && typeof currentLang !== 'undefined' && currentLang === 'en') {
        setLanguage('en');
    } else {
        initCurrentUser();
        loadDashboard();
        loadProjectsDropdowns();
        loadTeamDropdowns();
        loadTeamMembersForSwitcher();
        if (typeof syncCustomExpenseCategoryOptions === 'function') {
            syncCustomExpenseCategoryOptions();
        }
    }

    if (typeof syncCustomExpenseCategoryOptions === 'function') {
        syncCustomExpenseCategoryOptions();
    }

    // Set today's date in date inputs
    const today = new Date().toISOString().split('T')[0];
    const expenseDateEl = document.getElementById('expense-date');
    if (expenseDateEl) expenseDateEl.value = today;
    const taskStartEl = document.getElementById('task-start-date');
    if (taskStartEl) taskStartEl.value = today;
    const subPayDateEl = document.getElementById('sub-pay-date');
    if (subPayDateEl) subPayDateEl.value = today;
});

function initLucide() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ----------------- TAB NAVIGATION -----------------
function switchTab(tabId) {
    if (typeof currentUser !== 'undefined' && currentUser) {
        if (tabId === 'team') {
            if (!isAbuAlnasr(currentUser)) {
                showToast('قسم إدارة الموظفين مخصص للمشرف العام (ابوالنصر) فقط', 'warning');
                return;
            }
        } else if (typeof hasPermission === 'function' && !hasPermission(tabId)) {
            showToast('ليس لديك صلاحية للوصول إلى هذا القسم', 'warning');
            return;
        }
    }

    currentTab = tabId;
    
    // Stop chat polling if leaving chat tab
    if (tabId !== 'chat' && window.chatPollingTimer) {
        clearInterval(window.chatPollingTimer);
        window.chatPollingTimer = null;
    }

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // Show target tab
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    // Update Desktop Nav styles
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active-tab', 'text-white');
        btn.classList.add('text-slate-300');
    });
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) {
        activeNav.classList.add('active-tab', 'text-white');
        activeNav.classList.remove('text-slate-300');
    }

    // Update Mobile Nav styles
    document.querySelectorAll('.mobile-tab').forEach(btn => {
        btn.classList.remove('bg-emerald-600', 'text-white');
        btn.classList.add('bg-slate-800', 'text-slate-300');
    });
    const mobileTabs = document.querySelectorAll('.mobile-tab');
    const tabNames = ['dashboard', 'projects', 'tasks', 'expenses', 'suppliers', 'cashflow', 'subcontractors', 'custody', 'documents', 'reports', 'chat', 'team', 'hr'];
    const idx = tabNames.indexOf(tabId);
    if (idx !== -1 && mobileTabs[idx]) {
        mobileTabs[idx].classList.remove('bg-slate-800', 'text-slate-300');
        mobileTabs[idx].classList.add('bg-emerald-600', 'text-white');
    }

    // Trigger tab-specific data load
    if (tabId === 'dashboard') loadDashboard();
    else if (tabId === 'projects') loadProjects();
    else if (tabId === 'tasks') loadTasks();
    else if (tabId === 'expenses') {
        loadExpenses();
        if (typeof loadExpenseRequests === 'function') loadExpenseRequests();
    }
    else if (tabId === 'suppliers') loadSuppliersData();
    else if (tabId === 'cashflow') loadCashFlow();
    else if (tabId === 'subcontractors') loadSubcontractors();
    else if (tabId === 'custody') loadCustody();
    else if (tabId === 'documents') loadDocuments();
    else if (tabId === 'reports') loadDetailedReports();
    else if (tabId === 'chat') initChatTab();
    else if (tabId === 'team') loadTeamManagement();
    else if (tabId === 'hr') loadHrData();

    initLucide();
}

// ----------------- DROPDOWNS & MENUS -----------------
function toggleQuickMenu() {
    const menu = document.getElementById('quick-menu');
    menu.classList.toggle('hidden');
}

function toggleNotificationsMenu() {
    const menu = document.getElementById('notifications-menu');
    menu.classList.toggle('hidden');
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.toggle('hidden');
}

// Close menus when clicking outside
window.addEventListener('click', (e) => {
    const qMenu = document.getElementById('quick-menu');
    if (qMenu && !e.target.closest('#quick-menu') && !e.target.closest('button[onclick*="toggleQuickMenu"]')) {
        qMenu.classList.add('hidden');
    }
    const nMenu = document.getElementById('notifications-menu');
    if (nMenu && !e.target.closest('#notifications-menu') && !e.target.closest('button[onclick*="toggleNotificationsMenu"]')) {
        nMenu.classList.add('hidden');
    }
    const uMenu = document.getElementById('user-menu');
    if (uMenu && !e.target.closest('#user-menu') && !e.target.closest('button[onclick*="toggleUserMenu"]')) {
        uMenu.classList.add('hidden');
    }
});

// ----------------- MODALS -----------------
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        if (modalId === 'expense-modal') {
            const isEditing = Boolean(document.getElementById('expense-edit-id')?.value);
            if (!isEditing) {
                if (typeof resetExpenseModal === 'function') resetExpenseModal();
            }
            if (typeof loadSuppliersDropdownForExpenseModal === 'function') {
                loadSuppliersDropdownForExpenseModal();
            }
        } else if (modalId === 'subcontractor-modal') {
            const isEditingSub = Boolean(document.getElementById('sub-edit-id')?.value);
            if (!isEditingSub) {
                if (typeof resetSubcontractorModal === 'function') resetSubcontractorModal();
            }
        } else if (modalId === 'task-modal') {
            const cb = document.getElementById('task-created-by');
            if (cb && currentUser) {
                cb.value = currentUser.name;
            }
            checkTaskModalPermissions();
        } else if (modalId === 'custody-request-modal') {
            if (typeof initCustodyRequestModal === 'function') initCustodyRequestModal();
        }
        initLucide();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        if (modalId === 'expense-modal') {
            if (typeof resetExpenseModal === 'function') resetExpenseModal();
        } else if (modalId === 'subcontractor-modal') {
            if (typeof resetSubcontractorModal === 'function') resetSubcontractorModal();
        }
    }
}

function openModalForProject(modalId) {
    if (currentProjectIdForModal) {
        if (modalId === 'expense-modal') {
            document.getElementById('expense-project-id').value = currentProjectIdForModal;
            loadPhasesForExpenseModal(currentProjectIdForModal);
        } else if (modalId === 'task-modal') {
            document.getElementById('task-project-id').value = currentProjectIdForModal;
            loadPhasesForTaskModal(currentProjectIdForModal);
        }
    }
    openModal(modalId);
}

// ----------------- EXPENSE FORM MODE & CUSTOM CATEGORIES -----------------
function setExpenseFormMode(mode) {
    const modeInput = document.getElementById('expense-form-mode');
    if (modeInput) modeInput.value = mode;

    const btnGen = document.getElementById('tab-expense-mode-general');
    const btnSup = document.getElementById('tab-expense-mode-supplier');
    const supZone = document.getElementById('expense-supplier-zone');
    const itemsZone = document.getElementById('expense-items-zone');
    const paidToLabel = document.getElementById('expense-paid-to-label');
    const paidToInput = document.getElementById('expense-paid-to');
    const titleInput = document.getElementById('expense-title');

    if (mode === 'general') {
        if (btnGen) {
            btnGen.className = 'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition duration-200 bg-emerald-600 text-white shadow';
        }
        if (btnSup) {
            btnSup.className = 'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition duration-200 text-slate-400 hover:text-slate-200 hover:bg-slate-800';
        }
        if (supZone) supZone.classList.add('hidden');
        if (itemsZone) itemsZone.classList.add('hidden');

        if (paidToLabel) paidToLabel.innerText = 'المدفوع له / المستفيد (اسم الموظف، العهدة، المستحق)';
        if (paidToInput) paidToInput.placeholder = 'مثال: م. أحمد، عهدة الموقع، رواتب العمال...';
        if (titleInput && (!titleInput.value || titleInput.value.includes('توريد'))) {
            titleInput.placeholder = 'مثال: رواتب مهندسي وعمالة المشروع لشهر مايو، عهدة مصاريف...';
        }
    } else {
        if (btnSup) {
            btnSup.className = 'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition duration-200 bg-emerald-600 text-white shadow';
        }
        if (btnGen) {
            btnGen.className = 'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition duration-200 text-slate-400 hover:text-slate-200 hover:bg-slate-800';
        }
        if (supZone) supZone.classList.remove('hidden');
        if (itemsZone) itemsZone.classList.remove('hidden');

        if (paidToLabel) paidToLabel.innerText = 'المدفوع له (المورد / الشركة / المقاول)';
        if (paidToInput) paidToInput.placeholder = 'مثال: شركة الراجحي للحديد، مصنع السويس...';
        if (titleInput && (!titleInput.value || titleInput.value.includes('رواتب'))) {
            titleInput.placeholder = 'مثال: توريد 20 طن حديد سابك، توريد خرسانة جاهزة...';
        }
    }
    if (typeof initLucide === 'function') initLucide();
}

function getCustomExpenseCategories() {
    try {
        const stored = localStorage.getItem('custom_expense_categories');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveCustomExpenseCategory(name) {
    if (!name || !name.trim()) return;
    name = name.trim();
    let cats = getCustomExpenseCategories();
    if (!cats.includes(name)) {
        cats.push(name);
        try {
            localStorage.setItem('custom_expense_categories', JSON.stringify(cats));
        } catch (e) {}
    }
    syncCustomExpenseCategoryOptions(name);
}

function syncCustomExpenseCategoryOptions(selectValueToSet) {
    const cats = getCustomExpenseCategories();
    const select = document.getElementById('expense-category');
    const filterSelect = document.getElementById('expense-filter-category');

    if (select) {
        const customGroup = select.querySelector('optgroup[data-custom-group="1"]');
        if (customGroup) customGroup.remove();

        if (cats.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'تصنيفاتك المخصصة المحفوظة';
            optgroup.setAttribute('data-custom-group', '1');
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                optgroup.appendChild(opt);
            });
            const customTriggerOpt = select.querySelector('option[value="__custom__"]');
            if (customTriggerOpt) {
                select.insertBefore(optgroup, customTriggerOpt);
            } else {
                select.appendChild(optgroup);
            }
        }

        if (selectValueToSet) {
            let opt = select.querySelector(`option[value="${selectValueToSet}"]`);
            if (!opt) {
                opt = document.createElement('option');
                opt.value = selectValueToSet;
                opt.textContent = selectValueToSet;
                const customTriggerOpt = select.querySelector('option[value="__custom__"]');
                if (customTriggerOpt) {
                    select.insertBefore(opt, customTriggerOpt);
                } else {
                    select.appendChild(opt);
                }
            }
            select.value = selectValueToSet;
        }
    }

    if (filterSelect) {
        const customFilterGroup = filterSelect.querySelector('optgroup[data-custom-group="1"]');
        if (customFilterGroup) customFilterGroup.remove();

        if (cats.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'تصنيفات مخصصة';
            optgroup.setAttribute('data-custom-group', '1');
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                optgroup.appendChild(opt);
            });
            filterSelect.appendChild(optgroup);
        }
    }
}

function onExpenseCategoryChanged(val) {
    const customBox = document.getElementById('expense-custom-category-box');
    const customInput = document.getElementById('expense-custom-category-input');
    if (val === '__custom__') {
        if (customBox) customBox.classList.remove('hidden');
        if (customInput) {
            customInput.focus();
            customInput.select();
        }
    } else {
        if (customBox) customBox.classList.add('hidden');
    }
}

function toggleCustomExpenseCategoryInput() {
    const customBox = document.getElementById('expense-custom-category-box');
    const customInput = document.getElementById('expense-custom-category-input');
    if (customBox) {
        const isHidden = customBox.classList.contains('hidden');
        if (isHidden) {
            customBox.classList.remove('hidden');
            const select = document.getElementById('expense-category');
            if (select) select.value = '__custom__';
            if (customInput) customInput.focus();
        } else {
            customBox.classList.add('hidden');
        }
    }
}

function cancelCustomExpenseCategory() {
    const customBox = document.getElementById('expense-custom-category-box');
    const customInput = document.getElementById('expense-custom-category-input');
    if (customBox) customBox.classList.add('hidden');
    if (customInput) customInput.value = '';
    const select = document.getElementById('expense-category');
    if (select && select.value === '__custom__') {
        select.value = 'رواتب وأجور';
    }
}

function confirmCustomExpenseCategory() {
    const customInput = document.getElementById('expense-custom-category-input');
    const val = customInput ? customInput.value.trim() : '';
    if (!val) {
        showToast('يرجى كتابة اسم التصنيف أو بند المصروف', 'warning');
        return;
    }
    saveCustomExpenseCategory(val);
    const customBox = document.getElementById('expense-custom-category-box');
    if (customBox) customBox.classList.add('hidden');
    showToast(`تم اعتماد وتطبيق التصنيف: "${val}" بنجاح`, 'success');
}

// ----------------- EXPENSE TAX & VAT CALCULATIONS -----------------
function onExpenseTaxTypeChanged() {
    const isTax = document.getElementById('tax-choice-yes')?.checked;
    const taxSec = document.getElementById('tax-calculation-section');
    const nonTaxSec = document.getElementById('nontax-section');
    const yesBox = document.getElementById('tax-option-yes-container');
    const noBox = document.getElementById('tax-option-no-container');
    const badge = document.getElementById('tax-status-badge');
    const amtTotalEl = document.getElementById('expense-amount');
    const amtNonTaxEl = document.getElementById('expense-amount-nontax');

    if (isTax) {
        if (taxSec) taxSec.classList.remove('hidden');
        if (nonTaxSec) nonTaxSec.classList.add('hidden');
        if (amtTotalEl) amtTotalEl.setAttribute('required', 'required');
        if (amtNonTaxEl) amtNonTaxEl.removeAttribute('required');
        if (yesBox) yesBox.className = 'cursor-pointer border-2 border-emerald-500 bg-emerald-500/10 rounded-xl p-3 flex items-center gap-3 transition';
        if (noBox) noBox.className = 'cursor-pointer border border-slate-700 bg-slate-800/40 rounded-xl p-3 flex items-center gap-3 transition opacity-70';
        if (badge) {
            badge.innerText = 'فاتورة ضريبية 15%';
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400';
        }
        calcExpenseVat('no_tax');
    } else {
        if (taxSec) taxSec.classList.add('hidden');
        if (nonTaxSec) nonTaxSec.classList.remove('hidden');
        if (amtTotalEl) amtTotalEl.removeAttribute('required');
        if (amtNonTaxEl) amtNonTaxEl.setAttribute('required', 'required');
        if (yesBox) yesBox.className = 'cursor-pointer border border-slate-700 bg-slate-800/40 rounded-xl p-3 flex items-center gap-3 transition opacity-70';
        if (noBox) noBox.className = 'cursor-pointer border-2 border-emerald-500 bg-emerald-500/10 rounded-xl p-3 flex items-center gap-3 transition';
        if (badge) {
            badge.innerText = 'بدون ضريبة';
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700';
        }
        const val = document.getElementById('expense-amount-nontax')?.value || document.getElementById('expense-amount')?.value || '';
        if (document.getElementById('expense-amount')) document.getElementById('expense-amount').value = val;
        if (document.getElementById('expense-amount-without-tax')) document.getElementById('expense-amount-without-tax').value = val;
        if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = '0.00';
    }
    if (typeof recalculateExpenseItemsTotals === 'function') {
        recalculateExpenseItemsTotals();
    }
}

function calcExpenseVat(source) {
    const isTax = document.getElementById('tax-choice-yes')?.checked;
    if (!isTax) return;

    if (source === 'no_tax') {
        const noTaxStr = document.getElementById('expense-amount-without-tax')?.value;
        const noTax = parseFloat(noTaxStr);
        if (!isNaN(noTax) && noTax >= 0) {
            const vat = Math.round(noTax * 0.15 * 100) / 100;
            const total = Math.round((noTax + vat) * 100) / 100;
            if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = vat.toFixed(2);
            if (document.getElementById('expense-amount')) document.getElementById('expense-amount').value = total.toFixed(2);
        } else {
            if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = '';
            if (document.getElementById('expense-amount')) document.getElementById('expense-amount').value = '';
        }
    } else if (source === 'total') {
        const totalStr = document.getElementById('expense-amount')?.value;
        const total = parseFloat(totalStr);
        if (!isNaN(total) && total >= 0) {
            const noTax = Math.round((total / 1.15) * 100) / 100;
            const vat = Math.round((total - noTax) * 100) / 100;
            if (document.getElementById('expense-amount-without-tax')) document.getElementById('expense-amount-without-tax').value = noTax.toFixed(2);
            if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = vat.toFixed(2);
        } else {
            if (document.getElementById('expense-amount-without-tax')) document.getElementById('expense-amount-without-tax').value = '';
            if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = '';
        }
    }
    if (typeof validateExpenseAmountAgainstCustody === 'function') validateExpenseAmountAgainstCustody();
}

function syncNonTaxAmount() {
    const amt = document.getElementById('expense-amount-nontax')?.value || '';
    if (document.getElementById('expense-amount')) document.getElementById('expense-amount').value = amt;
    if (document.getElementById('expense-amount-without-tax')) document.getElementById('expense-amount-without-tax').value = amt;
    if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = '0.00';
    if (typeof validateExpenseAmountAgainstCustody === 'function') validateExpenseAmountAgainstCustody();
}

function onExpensePaymentStatusChanged() {
    const status = document.getElementById('expense-payment-status')?.value || 'paid';
    const paidCont = document.getElementById('expense-paid-amount-container');
    const methodSelect = document.getElementById('expense-payment-method');
    const payDateInput = document.getElementById('expense-payment-date');
    const invDateInput = document.getElementById('expense-date');

    if (status === 'partial') {
        if (paidCont) paidCont.classList.remove('hidden');
        if (payDateInput && !payDateInput.value) {
            payDateInput.value = invDateInput?.value || new Date().toISOString().split('T')[0];
        }
    } else if (status === 'paid') {
        if (paidCont) paidCont.classList.add('hidden');
        if (payDateInput && !payDateInput.value) {
            payDateInput.value = invDateInput?.value || new Date().toISOString().split('T')[0];
        }
        if (methodSelect && methodSelect.value === 'آجل') {
            methodSelect.value = 'تحويل بنكي';
        }
    } else { // unpaid
        if (paidCont) paidCont.classList.add('hidden');
        if (payDateInput) payDateInput.value = '';
        if (methodSelect) methodSelect.value = 'آجل';
    }
}

function resetExpenseTaxFields() {
    const yesRadio = document.getElementById('tax-choice-yes');
    if (yesRadio) yesRadio.checked = true;
    if (document.getElementById('expense-amount-without-tax')) document.getElementById('expense-amount-without-tax').value = '';
    if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = '';
    if (document.getElementById('expense-amount')) document.getElementById('expense-amount').value = '';
    if (document.getElementById('expense-amount-nontax')) document.getElementById('expense-amount-nontax').value = '';
    onExpenseTaxTypeChanged();
}

// ----------------- TOAST NOTIFICATIONS -----------------
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    toastMsg.innerText = message;
    
    if (type === 'success') {
        toast.className = 'fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-slideUp bg-emerald-600 text-white';
        toastIcon.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i>`;
    } else if (type === 'error') {
        toast.className = 'fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-slideUp bg-rose-600 text-white';
        toastIcon.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5"></i>`;
    } else {
        toast.className = 'fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-slideUp bg-slate-800 text-white border border-slate-700';
        toastIcon.innerHTML = `<i data-lucide="info" class="w-5 h-5 text-blue-400"></i>`;
    }

    toast.classList.remove('hidden');
    initLucide();

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// ----------------- HELPERS -----------------
function formatCurrency(val) {
    const num = Number(val || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return (typeof currentLang !== 'undefined' && currentLang === 'en') ? `SAR ${num}` : `${num} ر.س`;
}

function formatMoney(val) {
    return formatCurrency(val);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#039;');
}

// ----------------- LOAD DASHBOARD -----------------
async function loadDashboard() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

        // Update KPIs
        document.getElementById('stat-total-contracts').innerText = formatCurrency(data.total_contract_value);
        document.getElementById('stat-active-projects-label').innerText = isEn ? `${data.active_projects} active projects` : `${data.active_projects} مشاريع قيد التنفيذ`;
        document.getElementById('badge-projects-count').innerText = data.total_projects;

        if (document.getElementById('stat-total-client-received')) {
            document.getElementById('stat-total-client-received').innerText = formatCurrency(data.total_client_received || 0);
        }
        if (document.getElementById('stat-collection-rate-label')) {
            const colRate = data.client_collection_rate || 0;
            const pending = data.total_client_pending || 0;
            document.getElementById('stat-collection-rate-label').innerHTML = `
                <i data-lucide="badge-dollar-sign" class="w-3.5 h-3.5"></i>
                <span>${isEn ? `Collected: ${colRate}% • Pending: ${formatCurrency(pending)}` : `التحصيل: ${colRate}% • متبقي: ${formatCurrency(pending)}`}</span>
            `;
        }

        document.getElementById('stat-total-expenses').innerText = formatCurrency(data.total_expenses);
        if (document.getElementById('stat-tax-refundable')) {
            document.getElementById('stat-tax-refundable').innerText = formatCurrency(data.total_tax_refundable || 0);
        }
        const spentPercent = data.total_contract_value > 0 ? ((data.total_expenses / data.total_contract_value) * 100).toFixed(1) : 0;
        if (document.getElementById('stat-expense-ratio')) {
            document.getElementById('stat-expense-ratio').innerHTML = `
                <i data-lucide="trending-up" class="w-3.5 h-3.5"></i>
                <span>${isEn ? `Represents ${spentPercent}% of total budgets` : `يمثل ${spentPercent}% من إجمالي الميزانيات`}</span>
            `;
        }

        document.getElementById('stat-tasks-summary').innerText = `${data.completed_tasks} / ${data.total_tasks}`;
        document.getElementById('badge-tasks-count').innerText = data.inprogress_tasks;
        const taskPercent = data.total_tasks > 0 ? Math.round((data.completed_tasks / data.total_tasks) * 100) : 0;
        document.getElementById('stat-tasks-progress-label').innerText = isEn ? `Tasks completion: ${taskPercent}%` : `نسبة إنجاز المهام: ${taskPercent}%`;

        document.getElementById('stat-subcontractor-balance').innerText = formatCurrency(data.sub_total_paid || 0);

        // Render Recent Projects in Dashboard
        const projectsContainer = document.getElementById('dashboard-projects-list');
        projectsContainer.innerHTML = '';
        if (data.recent_projects && data.recent_projects.length > 0) {
            data.recent_projects.forEach(p => {
                const progressColor = p.progress_percent >= 75 ? 'bg-emerald-500' : p.progress_percent >= 40 ? 'bg-amber-500' : 'bg-blue-500';
                const el = document.createElement('div');
                el.className = 'bg-slate-800/80 p-4 rounded-xl border border-slate-750 hover:border-slate-650 transition cursor-pointer';
                el.onclick = () => openProjectDetails(p.id);
                el.innerHTML = `
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-sm text-white">${p.name}</span>
                            <span class="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">${p.code || ''}</span>
                        </div>
                        <span class="font-extrabold text-sm ${p.progress_percent >= 75 ? 'text-emerald-400' : 'text-amber-400'}">${p.progress_percent}%</span>
                    </div>
                    <div class="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden mb-3">
                        <div class="${progressColor} h-full rounded-full transition-all duration-500" style="width: ${p.progress_percent}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-xs text-slate-400">
                        <span>${isEn ? 'Location:' : 'الموقع:'} ${p.location}</span>
                        <div class="flex items-center gap-3">
                            <span>${isEn ? 'Spent:' : 'المنصرف:'} <strong class="text-rose-400">${formatCurrency(p.total_spent)}</strong></span>
                            <span>${isEn ? 'Budget:' : 'الميزانية:'} <strong class="text-white">${formatCurrency(p.contract_value)}</strong></span>
                        </div>
                    </div>
                `;
                projectsContainer.appendChild(el);
            });
        }

        // Render Expense Chart
        renderExpenseChart(data.expenses_by_category);

        // Render Notifications List
        renderNotifications(data.notifications);

        // Render Recent Tasks and Expenses in Dashboard
        loadDashboardWidgets();

        initLucide();
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

// ----------------- EXPENSE CHART (CHART.JS) -----------------
let cachedDashboardCategoryData = [];
let expenseChartDisplayMode = 'top'; // 'top' or 'all'

function setExpenseChartMode(mode) {
    expenseChartDisplayMode = mode;
    const btnTop = document.getElementById('exp-chart-mode-top');
    const btnAll = document.getElementById('exp-chart-mode-all');
    if (btnTop && btnAll) {
        if (mode === 'top') {
            btnTop.className = 'px-2.5 py-1 rounded-lg transition bg-amber-500/20 text-amber-300';
            btnAll.className = 'px-2.5 py-1 rounded-lg transition text-slate-400 hover:text-white';
        } else {
            btnAll.className = 'px-2.5 py-1 rounded-lg transition bg-amber-500/20 text-amber-300';
            btnTop.className = 'px-2.5 py-1 rounded-lg transition text-slate-400 hover:text-white';
        }
    }
    renderExpenseChart();
}

function normalizeExpenseCategoryName(cat) {
    const c = (cat || 'عام').trim();
    if (['حفر', 'أعمال الحفر', 'أعمال الإحلال'].includes(c)) return 'حفر وإحلال';
    if (['عزل', 'مواد عزل', 'أعمال العزل'].includes(c)) return 'عزل ومواد عزل';
    if (['خرسانة', 'خرسانة جاهزة'].includes(c)) return 'خرسانة جاهزة';
    if (['تجهيز موقع', 'تجهيز الموقع', 'تجهيز الموقع والدعاية', 'لوحات وتجهيز الموقع'].includes(c)) return 'تجهيز الموقع';
    if (['رواتب', 'رواتب وأجور'].includes(c)) return 'رواتب وأجور';
    if (['مواد بناء', 'مواد بناء وأسمنت'].includes(c)) return 'مواد بناء وأسمنت';
    if (['مكافآت وإشراف', 'بدلات ومكافآت'].includes(c)) return 'بدلات ومكافآت';
    return c;
}

// 12 curated, distinct, high-contrast colors for dark mode
const DISTINCT_EXPENSE_PALETTE = [
    '#10b981', // 1. زمردي (Emerald Green)
    '#f59e0b', // 2. كهرماني ذهبي (Amber Gold)
    '#3b82f6', // 3. أزرق ملكي (Royal Blue)
    '#f43f5e', // 4. وردي فاقع (Rose Red / Pink)
    '#8b5cf6', // 5. بنفسجي (Purple)
    '#06b6d4', // 6. تركواز سماوي (Cyan / Teal)
    '#ea580c', // 7. برتقالي صريح (Vivid Orange)
    '#6366f1', // 8. نيلي إنديجو (Indigo)
    '#14b8a6', // 9. تيل بحري (Sea Teal)
    '#d946ef', // 10. فوشيا (Fuchsia)
    '#84cc16', // 11. ليموني أخضر (Lime)
    '#64748b'  // 12. رمادي أردوازي للبنود الأخرى (Slate Gray for Others)
];

function generateDistinctHslColors(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        const hue = Math.round((i * 137.508) % 360);
        const sat = 78 + (i % 3) * 5;
        const light = 52 + (i % 2) * 6;
        list.push(`hsl(${hue}, ${sat}%, ${light}%)`);
    }
    return list;
}

function renderExpenseChart(categoryData) {
    const ctx = document.getElementById('expensesPieChart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (categoryData && Array.isArray(categoryData)) {
        cachedDashboardCategoryData = categoryData;
    }
    const rawData = cachedDashboardCategoryData || [];
    if (!rawData.length) {
        if (expensesChartInstance) expensesChartInstance.destroy();
        return;
    }

    // Step 1: Normalize category variations to reduce accidental duplicates
    const aggregated = {};
    rawData.forEach(item => {
        const normName = normalizeExpenseCategoryName(item.category);
        const amt = parseFloat(item.total) || 0;
        aggregated[normName] = (aggregated[normName] || 0) + amt;
    });

    const sortedList = Object.entries(aggregated)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);

    const grandTotal = sortedList.reduce((sum, item) => sum + item.total, 0);

    // Update center donut total label
    const centerTotalEl = document.getElementById('expensesPieCenterTotal');
    if (centerTotalEl) {
        centerTotalEl.innerText = formatCurrency(grandTotal);
    }

    let finalItems = [];
    let sliceColors = [];

    if (expenseChartDisplayMode === 'top' && sortedList.length > 8) {
        // Mode: Top 7 Categories + "أخرى وبنود متنوعة"
        const topSlice = sortedList.slice(0, 7);
        const otherSlice = sortedList.slice(7);
        const otherTotal = otherSlice.reduce((s, it) => s + it.total, 0);

        finalItems = [...topSlice];
        if (otherTotal > 0) {
            finalItems.push({
                category: 'أخرى وبنود متنوعة',
                total: otherTotal,
                isOther: true
            });
        }

        // Each of the top categories gets a guaranteed unique color
        sliceColors = finalItems.map((_, idx) => {
            if (idx === finalItems.length - 1 && finalItems[idx].isOther) {
                return '#64748b'; // Slate gray for "Other"
            }
            return DISTINCT_EXPENSE_PALETTE[idx % (DISTINCT_EXPENSE_PALETTE.length - 1)];
        });
    } else {
        // Mode: All categories
        finalItems = sortedList;
        if (finalItems.length <= DISTINCT_EXPENSE_PALETTE.length) {
            sliceColors = DISTINCT_EXPENSE_PALETTE.slice(0, finalItems.length);
        } else {
            sliceColors = generateDistinctHslColors(finalItems.length);
        }
    }

    const labels = finalItems.map(c => c.category);
    const amounts = finalItems.map(c => c.total);

    if (expensesChartInstance) {
        expensesChartInstance.destroy();
    }

    expensesChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: sliceColors,
                hoverBackgroundColor: sliceColors,
                borderColor: '#1e293b',
                borderWidth: 2.5,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                animateScale: false,
                duration: 600
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    rtl: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });

    // Populate custom legend with distinct colored dots and exact percentages
    const legendEl = document.getElementById('chart-legend');
    if (legendEl) {
        legendEl.innerHTML = '';
        finalItems.forEach((item, i) => {
            const pct = grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : 0;
            const color = sliceColors[i];
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between gap-1.5 p-1 rounded-lg hover:bg-slate-800/60 transition cursor-default';
            div.setAttribute('title', `${item.category}: ${formatCurrency(item.total)} (${pct}%)`);
            div.innerHTML = `
                <div class="flex items-center gap-2 truncate min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: ${color};"></span>
                    <span class="text-slate-300 truncate text-[11px] font-medium">${escapeHtml(item.category)}</span>
                </div>
                <span class="font-mono text-[10.5px] font-bold text-slate-400 shrink-0 mr-1">${pct}%</span>
            `;
            div.addEventListener('mouseenter', () => {
                if (expensesChartInstance) {
                    expensesChartInstance.setActiveElements([{ datasetIndex: 0, index: i }]);
                    expensesChartInstance.update();
                }
            });
            div.addEventListener('mouseleave', () => {
                if (expensesChartInstance) {
                    expensesChartInstance.setActiveElements([]);
                    expensesChartInstance.update();
                }
            });
            legendEl.appendChild(div);
        });
    }
}

// ----------------- NOTIFICATIONS -----------------
function renderNotifications(notifs) {
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notif-badge');
    if (!list) return;

    list.innerHTML = '';
    const unread = notifs.filter(n => !n.is_read);
    badge.innerText = unread.length;
    badge.style.display = unread.length > 0 ? 'flex' : 'none';

    if (notifs.length === 0) {
        list.innerHTML = '<p class="text-center text-xs text-slate-500 py-3">لا توجد تنبيهات جديدة</p>';
        return;
    }

    notifs.forEach(n => {
        const item = document.createElement('div');
        const iconColor = n.type === 'warning' ? 'text-rose-400 bg-rose-500/10' : n.type === 'expense' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10';
        item.className = `p-2.5 rounded-xl border ${n.is_read ? 'bg-slate-800/40 border-slate-750 opacity-70' : 'bg-slate-800 border-slate-700'} flex items-start gap-2.5 text-xs`;
        item.innerHTML = `
            <div class="p-1.5 rounded-lg ${iconColor} mt-0.5">
                <i data-lucide="${n.type === 'warning' ? 'alert-triangle' : n.type === 'expense' ? 'receipt' : 'bell'}" class="w-4 h-4"></i>
            </div>
            <div class="flex-1">
                <div class="flex items-center justify-between">
                    <strong class="text-white">${n.title}</strong>
                    <span class="text-[10px] text-slate-400">${n.created_at ? n.created_at.split(' ')[0] : ''}</span>
                </div>
                <p class="text-slate-300 text-[11px] mt-0.5 leading-relaxed">${n.message}</p>
            </div>
        `;
        list.appendChild(item);
    });
}

async function markAllNotificationsRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    document.getElementById('notif-badge').style.display = 'none';
    loadDashboard();
}

// ----------------- DASHBOARD RECENT WIDGETS -----------------
async function loadDashboardWidgets() {
    // Recent Tasks
    try {
        const resTasks = await fetch('/api/tasks');
        const tasks = await resTasks.json();
        const tasksCont = document.getElementById('dashboard-recent-tasks');
        tasksCont.innerHTML = '';
        tasks.slice(0, 4).forEach(t => {
            const isDone = t.status === 'done';
            const el = document.createElement('div');
            el.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-750 text-xs';
            el.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <button onclick="quickToggleTask(${t.id}, '${isDone ? 'in_progress' : 'done'}')" class="w-5 h-5 rounded flex items-center justify-center border ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 text-transparent hover:border-emerald-400'}">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                    </button>
                    <div>
                        <span class="font-bold ${isDone ? 'line-through text-slate-400' : 'text-white'}">${t.title}</span>
                        <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>${t.project_name}</span>
                            <span>•</span>
                            <span class="text-amber-400">${t.assigned_to}</span>
                        </div>
                    </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-300'}">
                    ${t.priority === 'urgent' ? 'عاجل' : t.priority === 'high' ? 'هام' : 'عادي'}
                </span>
            `;
            tasksCont.appendChild(el);
        });

        // Recent Expenses
        const resExp = await fetch('/api/expenses');
        const expenses = await resExp.json();
        const expCont = document.getElementById('dashboard-recent-expenses');
        expCont.innerHTML = '';
        expenses.slice(0, 4).forEach(e => {
            const el = document.createElement('div');
            el.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-750 text-xs';
            el.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <i data-lucide="receipt" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <span class="font-bold text-white">${e.title}</span>
                        <div class="text-[11px] text-slate-400 mt-0.5">
                            <span>${e.project_name}</span>
                            <span> • ${e.category}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-left">
                        <span class="font-black text-rose-400 block">${formatCurrency(e.amount)}</span>
                        ${e.invoice_file_path ? `
                            <button onclick="viewInvoice('${e.invoice_file_path}', '${e.title}')" class="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 mt-0.5">
                                <i data-lucide="paperclip" class="w-3 h-3"></i>
                                <span>معاينة الفاتورة</span>
                            </button>
                        ` : '<span class="text-[10px] text-slate-500">بدون مرفق</span>'}
                    </div>
                    <div class="flex items-center gap-1 border-r border-slate-700/80 pr-2 mr-1">
                        <button onclick="openTransferExpenseModal(${e.id})" title="نقل المصروف لمشروع آخر" class="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-750 transition">
                            <i data-lucide="arrow-right-left" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="openEditExpenseModal(${e.id})" title="تعديل المصروف" class="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-750 transition">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="deleteExpense(${e.id})" title="حذف المصروف" class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-750 transition">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;
            expCont.appendChild(el);
        });

        initLucide();
    } catch (err) {
        console.error('Error loading dashboard widgets:', err);
    }
}

// ----------------- PROJECTS TAB -----------------
async function loadProjects() {
    try {
        const res = await fetch('/api/projects');
        allProjectsList = await res.json();
        renderProjectsGrid(allProjectsList);
    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

function renderProjectsGrid(projects) {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (projects.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-center py-12 text-slate-400">${isEn ? 'No projects registered currently' : 'لا توجد مشاريع مسجلة حالياً'}</div>`;
        return;
    }

    projects.forEach(p => {
        const remaining = p.contract_value - p.total_spent;
        const progressColor = p.progress_percent >= 75 ? 'bg-emerald-500' : p.progress_percent >= 40 ? 'bg-amber-500' : 'bg-blue-500';
        const card = document.createElement('div');
        card.className = 'bg-slate-850 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-emerald-500/50 transition-all shadow-xl flex flex-col justify-between';
        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <span class="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-500/30">${p.code || 'PRJ'}</span>
                    <span class="text-xs px-2.5 py-0.5 rounded-full font-bold ${p.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}">
                        ${p.status === 'completed' ? (isEn ? 'Completed' : 'مكتمل') : (isEn ? 'In Progress' : 'قيد التنفيذ')}
                    </span>
                </div>
                <div>
                    <h3 class="text-lg font-black text-white hover:text-emerald-400 transition cursor-pointer" onclick="openProjectDetails(${p.id})">${p.name}</h3>
                    <p class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-500"></i>
                        <span>${p.location}</span>
                    </p>
                    <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <i data-lucide="user" class="w-3.5 h-3.5 text-slate-500"></i>
                        <span>${isEn ? 'Client:' : 'العميل:'} ${p.client_name}</span>
                    </p>
                </div>

                <!-- Progress Slider Bar -->
                <div>
                    <div class="flex items-center justify-between text-xs mb-1">
                        <span class="text-slate-400">${isEn ? 'Site Progress:' : 'نسبة الإنجاز الفعلي:'}</span>
                        <strong class="text-white">${p.progress_percent}%</strong>
                    </div>
                    <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div class="${progressColor} h-full rounded-full transition-all duration-500" style="width: ${p.progress_percent}%"></div>
                    </div>
                </div>

                <!-- Financial Highlights -->
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-750 text-xs">
                    <div class="bg-slate-800/80 p-2.5 rounded-xl">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Contract Value:' : 'قيمة العقد:'}</span>
                        <strong class="text-white text-xs">${formatCurrency(p.contract_value)}</strong>
                    </div>
                    <div class="bg-slate-800/80 p-2.5 rounded-xl">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Total Spent:' : 'إجمالي المنصرف:'}</span>
                        <strong class="text-rose-400 text-xs">${formatCurrency(p.total_spent)}</strong>
                    </div>
                </div>

                <div class="flex items-center justify-between text-[11px] text-slate-400">
                    <span>${isEn ? 'Completed Tasks:' : 'مهام منجزة:'} <strong class="text-emerald-400">${p.done_tasks || 0} / ${p.total_tasks || 0}</strong></span>
                    <span>${isEn ? 'Drawings & Docs:' : 'مخططات ومستندات:'} <strong class="text-purple-400">${p.doc_count || 0}</strong></span>
                </div>
            </div>

            <!-- Card Actions -->
            <div class="pt-3 border-t border-slate-750 flex items-center justify-between">
                <button onclick="openProjectDetails(${p.id})" class="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold text-xs flex items-center gap-1.5 transition">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>${isEn ? 'Project Details & Costs' : 'تفاصيل المشروع والفواتير'}</span>
                </button>
                <div class="flex items-center gap-1">
                    <button onclick="openEditProjectModal(${p.id})" title="${isEn ? 'Edit Project' : 'تعديل بيانات المشروع'}" class="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="promptUpdateProgress(${p.id}, ${p.progress_percent})" title="${isEn ? 'Update Progress' : 'تحديث نسبة الإنجاز'}" class="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition">
                        <i data-lucide="sliders" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteProject(${p.id}, '${p.name}')" title="${isEn ? 'Delete Project' : 'حذف المشروع'}" class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    initLucide();
}

function filterProjects() {
    const q = document.getElementById('project-search-input').value.toLowerCase();
    const filtered = allProjectsList.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.client_name.toLowerCase().includes(q) || 
        p.location.toLowerCase().includes(q)
    );
    renderProjectsGrid(filtered);
}

async function promptUpdateProgress(projectId, currentVal) {
    const newVal = prompt("أدخل نسبة الإنجاز الجديدة للمشروع (0 - 100):", currentVal);
    if (newVal !== null && !isNaN(newVal)) {
        const val = Math.min(100, Math.max(0, parseInt(newVal)));
        await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress_percent: val })
        });
        showToast('تم تحديث نسبة إنجاز المشروع بنجاح');
        loadProjects();
    }
}

async function deleteProject(projectId, projectName) {
    if (confirm(`هل أنت متأكد من حذف مشروع "${projectName}"؟ سيتم حذف جميع مهامه ومصاريفه ومستنداته.`)) {
        await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
        showToast('تم حذف المشروع بنجاح');
        loadProjects();
        loadDashboard();
        loadProjectsDropdowns();
    }
}

// ----------------- TASKS TAB (KANBAN) -----------------
async function loadTasks() {
    const projId = document.getElementById('task-filter-project')?.value || '';
    const status = document.getElementById('task-filter-status')?.value || '';
    const priority = document.getElementById('task-filter-priority')?.value || '';
    const assignee = document.getElementById('task-filter-assignee')?.value || '';

    let url = `/api/tasks?`;
    if (projId) url += `project_id=${projId}&`;
    if (status) url += `status=${status}&`;
    if (priority) url += `priority=${priority}&`;
    if (assignee) url += `assigned_to=${encodeURIComponent(assignee)}&`;

    try {
        const res = await fetch(url);
        const tasks = await res.json();
        renderTasksKanban(tasks);
    } catch (err) {
        console.error('Error loading tasks:', err);
    }
}

function renderTasksKanban(tasks) {
    const todoCol = document.getElementById('tasks-todo-col');
    const inprogressCol = document.getElementById('tasks-inprogress-col');
    const pendingCol = document.getElementById('tasks-pending-col');
    const doneCol = document.getElementById('tasks-done-col');

    if (todoCol) todoCol.innerHTML = '';
    if (inprogressCol) inprogressCol.innerHTML = '';
    if (pendingCol) pendingCol.innerHTML = '';
    if (doneCol) doneCol.innerHTML = '';

    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inprogressTasks = tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = tasks.filter(t => t.status === 'pending_approval');
    const doneTasks = tasks.filter(t => t.status === 'done');
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (document.getElementById('count-todo')) document.getElementById('count-todo').innerText = todoTasks.length;
    if (document.getElementById('count-inprogress')) document.getElementById('count-inprogress').innerText = inprogressTasks.length;
    if (document.getElementById('count-pending')) document.getElementById('count-pending').innerText = pendingTasks.length;
    if (document.getElementById('count-done')) document.getElementById('count-done').innerText = doneTasks.length;

    const renderCard = (t) => {
        const card = document.createElement('div');
        const prioBadge = t.priority === 'urgent' 
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
            : t.priority === 'high' 
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
            : 'bg-slate-750 text-slate-300';
        
        const prioText = t.priority === 'urgent' 
            ? (isEn ? 'Urgent' : 'عاجل جداً') 
            : t.priority === 'high' 
            ? (isEn ? 'High Priority' : 'أولوية مرتفعة') 
            : (isEn ? 'Normal Priority' : 'أولوية عادية');

        // Check if current user is authorized to sign off/approve
        // STRICT CONTRACTOR RULE: If the user is the assignee, they CANNOT approve (even if manager).
        // ONLY the person who created/sent the task (e.g. Abulnasr) can approve tasks they assigned to others (e.g. Jehad).
        const isCreator = (currentUser && currentUser.name === t.created_by);
        const isAssignee = (currentUser && currentUser.name === t.assigned_to);
        const isGeneralManager = (currentUser && (currentUser.name === 'نواف سجيني' || currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
        const canApprove = isCreator || (isGeneralManager && !isAssignee);

        const isPending = t.status === 'pending_approval';
        const isDone = t.status === 'done';
        const isInProgress = t.status === 'in_progress';

        const cardBorder = isPending 
            ? 'border-purple-500/60 bg-gradient-to-b from-purple-950/20 to-slate-800 shadow-purple-950/30' 
            : isDone 
            ? 'border-emerald-500/40 bg-slate-800' 
            : 'border-slate-700/80 bg-slate-800';

        card.className = `${cardBorder} p-4 rounded-xl border hover:border-slate-500 transition shadow space-y-3`;
        card.innerHTML = `
            <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5 truncate">
                    <span class="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-750 text-emerald-400 font-bold truncate">${t.project_name}</span>
                    ${t.phase_name ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate">${t.phase_name}</span>` : ''}
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${prioBadge}">
                    ${prioText}
                </span>
            </div>

            <div>
                <h4 class="font-bold text-sm text-white">${t.title}</h4>
                ${t.description ? `<p class="text-xs text-slate-400 line-clamp-2 mt-1">${t.description}</p>` : ''}
            </div>

            <!-- Sender & Assignee info -->
            <div class="p-2 rounded-lg bg-slate-850 border border-slate-750/70 text-[11px] space-y-1">
                <div class="flex items-center justify-between">
                    <span class="text-slate-400 flex items-center gap-1">
                        <i data-lucide="user-plus" class="w-3 h-3 text-emerald-400"></i>
                        <span>المرسل (صاحب التعميد):</span>
                    </span>
                    <strong class="text-emerald-300">${t.created_by || 'الإدارة'}</strong>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-400 flex items-center gap-1">
                        <i data-lucide="user-check" class="w-3 h-3 text-amber-400"></i>
                        <span>المنفذ بالموقع:</span>
                    </span>
                    <strong class="text-amber-300">${t.assigned_to}</strong>
                </div>
            </div>

            <!-- Cost & Selling (if recorded) -->
            ${(t.cost_price > 0 || t.selling_price > 0) ? `
                <div class="flex items-center justify-between text-[11px] px-2 py-1 bg-slate-750/40 rounded-lg font-mono">
                    <span class="text-slate-400">التكلفة: <strong class="text-rose-400">${formatCurrency(t.cost_price || 0)}</strong></span>
                    <span class="text-slate-400">البيع: <strong class="text-emerald-400">${formatCurrency(t.selling_price || 0)}</strong></span>
                </div>
            ` : ''}
            
            <!-- Progress slider for tasks -->
            <div>
                <div class="flex items-center justify-between text-[11px] mb-1">
                    <span class="text-slate-400">${isEn ? 'Progress:' : 'الإنجاز:'}</span>
                    <span class="font-bold ${isDone ? 'text-emerald-400' : isPending ? 'text-purple-400' : 'text-amber-400'}">${t.progress_percent}%</span>
                </div>
                <div class="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div class="${isDone ? 'bg-emerald-500' : isPending ? 'bg-purple-500' : 'bg-amber-500'} h-full rounded-full" style="width: ${t.progress_percent}%"></div>
                </div>
            </div>

            <!-- Special Action Box for Pending Approval -->
            ${isPending ? `
                <div class="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-purple-300 font-bold flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                            <span>بانتظار تعميد المهمة</span>
                        </span>
                        <span class="text-[10px] text-purple-400 font-mono">${t.created_by || 'المرسل'}</span>
                    </div>
                    ${t.completion_notes ? `<p class="text-[11px] text-slate-300 italic bg-purple-900/20 p-1.5 rounded border border-purple-700/30">${t.completion_notes}</p>` : ''}
                    
                    ${canApprove ? `
                        <div class="flex items-center gap-2 pt-1">
                            <button onclick="approveTask(${t.id})" class="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow transition">
                                <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
                                <span>تعميد المهمة واعتمادها ✓</span>
                            </button>
                            <button onclick="promptRejectTask(${t.id})" class="py-1.5 px-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1 border border-rose-500/30 transition" title="طلب تعديل واستكمال">
                                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                                <span>إعادة</span>
                            </button>
                        </div>
                    ` : `
                        <div class="p-2 rounded-lg bg-slate-900/80 border border-purple-500/20 text-[11px] text-purple-300 flex items-start gap-1.5">
                            <i data-lucide="lock" class="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5"></i>
                            <div>
                                <span>المهمة بانتظار تعميد: <strong class="text-white">${t.created_by || 'المرسل'}</strong></span>
                                ${isAssignee ? `<p class="text-[10px] text-amber-400/90 mt-0.5">بصفتك المنفذ (${t.assigned_to})، لا يمكنك التعميد؛ الصلاحية محصورة على من أسندها إليك (${t.created_by}).</p>` : ''}
                            </div>
                        </div>
                    `}
                </div>
            ` : ''}

            <!-- Send for approval button when in progress -->
            ${isInProgress ? `
                <button onclick="submitTaskForApproval(${t.id})" class="w-full py-1.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-purple-500/30 transition shadow">
                    <i data-lucide="send" class="w-3.5 h-3.5"></i>
                    <span>إرسال للتعميد من (${t.created_by || 'المرسل'}) 📨</span>
                </button>
            ` : ''}

            <!-- Done badge and approval sign-off stamp -->
            ${isDone ? `
                <div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 flex items-center justify-between">
                    <div class="flex items-center gap-1 font-bold">
                        <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
                        <span>معمدة ومكتملة ✓</span>
                    </div>
                    <span class="text-[10px] text-slate-400">${t.approved_by ? `معتمد: ${t.approved_by}` : ''}</span>
                </div>
            ` : ''}

            <div class="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-750">
                <span class="text-[11px] text-slate-400">${t.due_date ? `${isEn ? 'Due:' : 'تسليم:'} ${t.due_date}` : ''}</span>
            </div>

            <!-- Task Quick Status Switcher -->
            <div class="flex items-center justify-between pt-1">
                <select onchange="handleQuickTaskStatusChange(${t.id}, this.value, '${t.created_by || ''}', '${t.assigned_to || ''}')" class="bg-slate-750 text-[11px] text-slate-300 border border-slate-650 rounded-lg px-2 py-1">
                    <option value="todo" ${t.status === 'todo' ? 'selected' : ''}>قيد الانتظار</option>
                    <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>جاري التنفيذ</option>
                    <option value="pending_approval" ${t.status === 'pending_approval' ? 'selected' : ''}>في انتظار التعميد (إرسال لـ ${t.created_by || 'المرسل'})</option>
                    ${canApprove ? `<option value="done" ${t.status === 'done' ? 'selected' : ''}>معمدة ومكتملة ✓</option>` : (t.status === 'done' ? `<option value="done" selected disabled>معمدة ومكتملة ✓ (معتمدة)</option>` : '')}
                </select>
                <div class="flex items-center gap-1">
                    <button onclick="editTaskProgress(${t.id}, ${t.progress_percent}, '${t.created_by || ''}', '${t.assigned_to || ''}')" title="${isEn ? 'Edit Progress' : 'تعديل النسبة'}" class="p-1 text-slate-400 hover:text-amber-400">
                        <i data-lucide="percent" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="deleteTask(${t.id})" title="${isEn ? 'Delete Task' : 'حذف المهمة'}" class="p-1 text-slate-400 hover:text-rose-400">
                        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        `;
        return card;
    };

    const emptyBanner = document.getElementById('tasks-empty-banner');
    if (emptyBanner) {
        if (tasks.length === 0) {
            emptyBanner.classList.remove('hidden');
        } else {
            emptyBanner.classList.add('hidden');
        }
    }

    if (todoCol) {
        if (todoTasks.length === 0) {
            todoCol.innerHTML = `
                <div class="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl border-2 border-dashed border-slate-750/70 text-slate-500">
                    <i data-lucide="inbox" class="w-6 h-6 mb-2 text-slate-600"></i>
                    <span class="text-xs font-semibold text-slate-400">${isEn ? 'No pending tasks' : 'لا توجد مهام قيد التجهيز'}</span>
                    <button type="button" onclick="openModal('task-modal')" class="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition">
                        <i data-lucide="plus" class="w-3 h-3"></i>
                        <span>${isEn ? 'Add Task' : 'إسناد مهمة'}</span>
                    </button>
                </div>
            `;
        } else {
            todoTasks.forEach(t => todoCol.appendChild(renderCard(t)));
        }
    }

    if (inprogressCol) {
        if (inprogressTasks.length === 0) {
            inprogressCol.innerHTML = `
                <div class="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl border-2 border-dashed border-slate-750/70 text-slate-500">
                    <i data-lucide="clock" class="w-6 h-6 mb-2 text-slate-600"></i>
                    <span class="text-xs font-semibold text-slate-400">${isEn ? 'No tasks in progress' : 'لا توجد مهام جارية حالياً'}</span>
                    <span class="text-[10px] text-slate-500 mt-1">${isEn ? 'Tasks being executed will appear here' : 'المهام قيد التنفيذ بالموقع تظهر هنا'}</span>
                </div>
            `;
        } else {
            inprogressTasks.forEach(t => inprogressCol.appendChild(renderCard(t)));
        }
    }

    if (pendingCol) {
        if (pendingTasks.length === 0) {
            pendingCol.innerHTML = `
                <div class="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl border-2 border-dashed border-purple-500/20 text-slate-500">
                    <i data-lucide="shield-alert" class="w-6 h-6 mb-2 text-purple-400/50"></i>
                    <span class="text-xs font-semibold text-purple-300/80">${isEn ? 'No tasks pending approval' : 'لا مهام بانتظار التعميد'}</span>
                    <span class="text-[10px] text-slate-500 mt-1">${isEn ? 'Tasks submitted for sign-off arrive here' : 'المهام المنتهية التي تنتظر الاعتماد تظهر هنا'}</span>
                </div>
            `;
        } else {
            pendingTasks.forEach(t => pendingCol.appendChild(renderCard(t)));
        }
    }

    if (doneCol) {
        if (doneTasks.length === 0) {
            doneCol.innerHTML = `
                <div class="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl border-2 border-dashed border-slate-750/70 text-slate-500">
                    <i data-lucide="check-circle" class="w-6 h-6 mb-2 text-slate-600"></i>
                    <span class="text-xs font-semibold text-slate-400">${isEn ? 'No completed tasks yet' : 'لا توجد مهام مكتملة بعد'}</span>
                    <span class="text-[10px] text-slate-500 mt-1">${isEn ? 'Approved tasks will be archived here' : 'المهام المعمدة نهائياً تُحفظ هنا'}</span>
                </div>
            `;
        } else {
            doneTasks.forEach(t => doneCol.appendChild(renderCard(t)));
        }
    }

    initLucide();
}

async function approveTask(taskId) {
    const approver = (currentUser && currentUser.name) ? currentUser.name : 'المرسل';
    const notes = prompt("ملاحظات التعميد والاعتماد (اختياري):", "تم الفحص والاعتماد بنجاح") || '';
    
    try {
        const res = await fetch(`/api/tasks/${taskId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved_by: approver, approval_notes: notes })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'تم تعميد المهمة بنجاح');
            loadTasks();
            loadDashboard();
            if (currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
        } else {
            showToast(data.error || 'تعذر تعميد المهمة', 'error');
        }
    } catch (err) {
        console.error('Error approving task:', err);
        showToast('حدث خطأ أثناء التعميد', 'error');
    }
}

async function promptRejectTask(taskId) {
    const rejecter = (currentUser && currentUser.name) ? currentUser.name : 'المرسل';
    const notes = prompt("أدخل ملاحظات التعديل المطلوبة من منفذ المهمة:");
    if (!notes) return;

    try {
        const res = await fetch(`/api/tasks/${taskId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejected_by: rejecter, notes: notes })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'تمت إعادة المهمة للتعديل');
            loadTasks();
            loadDashboard();
            if (currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
        } else {
            showToast(data.error || 'تعذر إرجاع المهمة', 'error');
        }
    } catch (err) {
        console.error('Error rejecting task:', err);
        showToast('حدث خطأ أثناء معالجة الطلب', 'error');
    }
}

async function submitTaskForApproval(taskId) {
    const submittedBy = (currentUser && currentUser.name) ? currentUser.name : '';
    const notes = prompt("ملاحظات إنجاز المهمة وطلب التعميد (اختياري):", "تم الانتهاء من العمل في الموقع وجاهز للاستلام والتعميد") || '';

    try {
        const res = await fetch(`/api/tasks/${taskId}/submit-approval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submitted_by: submittedBy, notes: notes })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'تم إرسال المهمة للتعميد بنجاح');
            loadTasks();
            loadDashboard();
            if (currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
        } else {
            showToast(data.error || 'تعذر إرسال المهمة', 'error');
        }
    } catch (err) {
        console.error('Error submitting task for approval:', err);
        showToast('حدث خطأ أثناء الإرسال', 'error');
    }
}

async function handleQuickTaskStatusChange(taskId, newStatus, createdBy, assignedTo) {
    const isAssignee = (currentUser && currentUser.name === assignedTo);
    const isCreator = (currentUser && currentUser.name === createdBy);
    const isGeneralManager = (currentUser && (currentUser.name === 'نواف سجيني' || currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
    const canApprove = isCreator || (isGeneralManager && !isAssignee);

    if (newStatus === 'done') {
        if (!canApprove) {
            showToast(`عفواً يا ${currentUser ? currentUser.name : ''}، بصفتك المنفذ لا تملك صلاحية التعميد! التعميد محصور حصرياً على من أسند المهمة (${createdBy || 'المرسل'}). تم تحويلها لقائمة "في انتظار التعميد".`, 'error');
            await submitTaskForApproval(taskId);
            return;
        } else {
            await approveTask(taskId);
            return;
        }
    }

    if (newStatus === 'pending_approval') {
        await submitTaskForApproval(taskId);
        return;
    }

    const newProgress = newStatus === 'in_progress' ? 50 : 0;
    const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, progress_percent: newProgress, current_user_name: currentUser ? currentUser.name : '' })
    });
    const data = await res.json();
    if (!res.ok) {
        showToast(data.error || 'حدث خطأ أثناء تحديث الحالة', 'error');
    } else {
        showToast('تم تحديث حالة المهمة بنجاح');
    }
    loadTasks();
    loadDashboard();
}

async function quickToggleTask(taskId, newStatus) {
    try {
        const res = await fetch('/api/tasks');
        const tasks = await res.json();
        const t = tasks.find(x => x.id === taskId);
        if (t && newStatus === 'done') {
            const isCreator = (currentUser && currentUser.name === t.created_by);
            const isAssignee = (currentUser && currentUser.name === t.assigned_to);
            const isGeneralManager = (currentUser && (currentUser.name === 'نواف سجيني' || currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
            const canApprove = isCreator || (isGeneralManager && !isAssignee);

            if (!canApprove) {
                showToast(`عفواً يا ${currentUser ? currentUser.name : ''}، التعميد محصور على من أسند المهمة (${t.created_by || 'المرسل'}). تم إرسالها للتعميد.`, 'info');
                await submitTaskForApproval(taskId);
                return;
            } else {
                await approveTask(taskId);
                return;
            }
        }
    } catch (e) {}

    const newProgress = 50;
    await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, progress_percent: newProgress, current_user_name: currentUser ? currentUser.name : '' })
    });
    showToast('تم تحديث حالة المهمة');
    loadDashboard();
    if (currentTab === 'tasks') loadTasks();
}

async function updateTaskStatus(taskId, newStatus) {
    await handleQuickTaskStatusChange(taskId, newStatus, '', '');
}

async function editTaskProgress(taskId, currentPercent, createdBy, assignedTo) {
    const val = prompt("أدخل نسبة إنجاز هذه المهمة (0-100):", currentPercent);
    if (val !== null && !isNaN(val)) {
        const p = Math.min(100, Math.max(0, parseInt(val)));
        const isCreator = (currentUser && currentUser.name === createdBy);
        const isAssignee = (currentUser && currentUser.name === assignedTo);
        const isGeneralManager = (currentUser && (currentUser.name === 'نواف سجيني' || currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
        const canApprove = isCreator || (isGeneralManager && !isAssignee);

        if (p === 100 && !canApprove) {
            showToast(`وصلت النسبة 100%! بصفتك المنفذ المكلف تم إرسال المهمة للتعميد إلى (${createdBy || 'المرسل'}) ليعتمدها.`, 'info');
            await submitTaskForApproval(taskId);
            return;
        }

        const st = p === 100 ? 'done' : p > 0 ? 'in_progress' : 'todo';
        const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress_percent: p, status: st, current_user_name: currentUser ? currentUser.name : '' })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'حدث خطأ في التحديث', 'error');
        } else {
            showToast('تم تحديث نسبة الإنجاز');
        }
        loadTasks();
    }
}

function checkTaskModalPermissions() {
    const createdBy = document.getElementById('task-created-by')?.value;
    const assignedTo = document.getElementById('task-assigned-to')?.value;
    const statusSelect = document.getElementById('task-status');
    const noteEl = document.getElementById('task-status-perm-note');
    if (!statusSelect) return;

    const doneOption = statusSelect.querySelector('option[value="done"]');
    const isAssignee = (currentUser && currentUser.name === assignedTo);
    const isCreator = (currentUser && currentUser.name === createdBy);
    const isGeneralManager = (currentUser && (currentUser.name === 'نواف سجيني' || currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
    const canApprove = isCreator || (isGeneralManager && !isAssignee);

    if (doneOption) {
        if (!canApprove) {
            doneOption.disabled = true;
            doneOption.innerText = 'معمدة ومكتملة (محصورة على مُرسل المهمة)';
            if (statusSelect.value === 'done') {
                statusSelect.value = 'pending_approval';
            }
            if (noteEl) {
                noteEl.innerText = `🔒 بصفتك المنفذ المكلف (${assignedTo})، لا تملك صلاحية التعميد النهائي. يمكنك فقط إرسالها لحالة "في انتظار التعميد" ليعتمدها (${createdBy || 'المرسل'}).`;
                noteEl.classList.remove('hidden');
            }
        } else {
            doneOption.disabled = false;
            doneOption.innerText = 'معمدة ومكتملة ✓';
            if (noteEl) {
                noteEl.innerText = `✓ تملك صلاحية التعميد والاعتماد المباشر لهذه المهمة.`;
                noteEl.classList.remove('hidden');
            }
        }
    }
}

async function deleteTask(taskId) {
    if (confirm("هل تريد حذف هذه المهمة نهائياً؟")) {
        await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        showToast('تم حذف المهمة');
        loadTasks();
    }
}

// ----------------- EXPENSES & INVOICES TAB -----------------
let currentExpenseStatusFilter = 'all'; // all, pending, approved, paid, unpaid, rejected
let allLoadedExpensesList = [];

function setExpenseStatusQuickFilter(status) {
    currentExpenseStatusFilter = status || 'all';
    const statusSelect = document.getElementById('expense-filter-status');
    if (statusSelect) {
        statusSelect.value = (status === 'all') ? '' : status;
    }
    updateExpenseFilterPillStyles(currentExpenseStatusFilter);
    applyClientExpenseFilters();
}

function onExpenseStatusDropdownChange() {
    const statusSelect = document.getElementById('expense-filter-status');
    const val = statusSelect ? statusSelect.value : '';
    currentExpenseStatusFilter = val || 'all';
    updateExpenseFilterPillStyles(currentExpenseStatusFilter);
    applyClientExpenseFilters();
}

function updateExpenseFilterPillStyles(activeStatus) {
    const pills = [
        { id: 'btn-exp-filter-all', key: 'all', activeCls: 'bg-emerald-600 text-white shadow' },
        { id: 'btn-exp-filter-pending', key: 'pending', activeCls: 'bg-amber-600 text-white shadow' },
        { id: 'btn-exp-filter-approved', key: 'approved', activeCls: 'bg-emerald-600 text-white shadow' },
        { id: 'btn-exp-filter-paid', key: 'paid', activeCls: 'bg-blue-600 text-white shadow' },
        { id: 'btn-exp-filter-unpaid', key: 'unpaid', activeCls: 'bg-rose-600 text-white shadow' }
    ];

    pills.forEach(p => {
        const btn = document.getElementById(p.id);
        if (!btn) return;
        btn.className = 'exp-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750';
        if (p.key === activeStatus) {
            btn.className = `exp-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${p.activeCls}`;
        }
    });
}

function updateExpenseFilterPillCounts(expenses) {
    if (!Array.isArray(expenses)) return;
    const allCount = expenses.length;
    const pendingCount = expenses.filter(e => e.approval_status === 'pending').length;
    const approvedCount = expenses.filter(e => (e.approval_status || 'approved') === 'approved').length;
    const paidCount = expenses.filter(e => (e.payment_status || 'paid') === 'paid').length;
    const unpaidCount = expenses.filter(e => e.payment_status === 'unpaid').length;

    const elAll = document.getElementById('badge-exp-count-all');
    const elPending = document.getElementById('badge-exp-count-pending');
    const elApproved = document.getElementById('badge-exp-count-approved');
    const elPaid = document.getElementById('badge-exp-count-paid');
    const elUnpaid = document.getElementById('badge-exp-count-unpaid');

    if (elAll) elAll.innerText = allCount;
    if (elPending) elPending.innerText = pendingCount;
    if (elApproved) elApproved.innerText = approvedCount;
    if (elPaid) elPaid.innerText = paidCount;
    if (elUnpaid) elUnpaid.innerText = unpaidCount;
}

function applyClientExpenseFilters() {
    if (!Array.isArray(allLoadedExpensesList)) return;
    let filtered = allLoadedExpensesList;

    if (currentExpenseStatusFilter === 'pending') {
        filtered = allLoadedExpensesList.filter(e => e.approval_status === 'pending');
    } else if (currentExpenseStatusFilter === 'approved') {
        filtered = allLoadedExpensesList.filter(e => (e.approval_status || 'approved') === 'approved');
    } else if (currentExpenseStatusFilter === 'paid') {
        filtered = allLoadedExpensesList.filter(e => (e.payment_status || 'paid') === 'paid');
    } else if (currentExpenseStatusFilter === 'unpaid') {
        filtered = allLoadedExpensesList.filter(e => e.payment_status === 'unpaid');
    } else if (currentExpenseStatusFilter === 'rejected') {
        filtered = allLoadedExpensesList.filter(e => e.approval_status === 'rejected');
    }

    renderExpensesTable(filtered);
}

function canUserSeeAllExpenses() {
    try {
        const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || localStorage.getItem('segieny_current_user') || '{}');
        if (!u) return false;
        const r = (u.role || '').toLowerCase();
        const un = (u.username || '').toLowerCase();
        const n = (u.name || '').toLowerCase();

        // 1. المدير المالي (أ. ابوالنصر البغدادي)
        if (r.includes('مدير مالي') || r.includes('المدير المالي') || r.includes('financial') || un === 'baghdadi' || n.includes('ابوالنصر') || n.includes('البغدادي')) {
            return true;
        }

        // 2. المدير العام (نواف سجيني)
        if (r.includes('مدير عام') || r.includes('المدير العام') || un === 'nawaf' || n.includes('نواف') || n.includes('سجيني')) {
            return true;
        }

        return false;
    } catch(e) {
        return false;
    }
}

async function loadExpenses() {
    const projId = document.getElementById('expense-filter-project')?.value || '';
    const cat = document.getElementById('expense-filter-category')?.value || '';
    const fromDate = document.getElementById('expense-filter-from')?.value || '';
    const toDate = document.getElementById('expense-filter-to')?.value || '';

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');

    let url = `/api/expenses?`;
    if (u && u.id) url += `user_id=${encodeURIComponent(u.id)}&`;
    if (u && u.role) url += `user_role=${encodeURIComponent(u.role)}&`;
    if (u && u.name) url += `user_name=${encodeURIComponent(u.name)}&`;
    if (projId) url += `project_id=${projId}&`;
    if (cat) url += `category=${encodeURIComponent(cat)}&`;
    if (fromDate) url += `from_date=${fromDate}&`;
    if (toDate) url += `to_date=${toDate}&`;

    try {
        const res = await fetch(url);
        const expenses = await res.json();
        let list = Array.isArray(expenses) ? expenses : [];

        // Client-side guard: Only show user's own expenses unless General Manager or Financial Manager
        if (!canUserSeeAllExpenses() && u && u.name) {
            const myName = u.name.trim().toLowerCase();
            list = list.filter(e => {
                const cBy = (e.created_by || '').toLowerCase();
                const cEmp = (e.custody_employee_name || '').toLowerCase();
                const aName = (e.assigned_disburser_name || '').toLowerCase();
                const pBy = (e.paid_by || '').toLowerCase();
                const pTo = (e.paid_to || '').toLowerCase();
                return cBy.includes(myName) || cEmp.includes(myName) || aName.includes(myName) || pBy.includes(myName) || pTo.includes(myName);
            });
        }

        allLoadedExpensesList = list;
        updateExpenseFilterPillCounts(allLoadedExpensesList);
        applyClientExpenseFilters();
    } catch (err) {
        console.error('Error loading expenses:', err);
    }
}

// ----------------- FINANCIAL MANAGER EXPENSE APPROVALS -----------------
async function approveExpense(id) {
    if (!isFinancialManagerUser()) {
        showToast('عفواً، تعميد المصروفات والفواتير هو صلاحية حصرية للمدير المالي (أ. ابوالنصر البغدادي).', 'error');
        return;
    }
    if (!confirm('هل أنت متأكد من تعميد هذه الفاتورة/المصروف؟\nسيتم اعتمادها رسمياً وخصمها من الكاش فلو وميزانية المشروع/العهدة.')) return;

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    try {
        const res = await fetch(`/api/expenses/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: u.id,
                user_role: u.role,
                user_name: u.name
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم تعميد الفاتورة بنجاح!', 'success');
            if (currentTab === 'expenses') loadExpenses();
            if (currentTab === 'cashflow' && typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
            if (typeof currentViewedCustodyId !== 'undefined' && currentViewedCustodyId) {
                const cModal = document.getElementById('custody-expenses-modal');
                if (cModal && !cModal.classList.contains('hidden')) {
                    viewCustodyExpenses(currentViewedCustodyId);
                }
            }
            if (typeof loadCustody === 'function') loadCustody();
            loadDashboard();
        } else {
            showToast(data.error || 'تعذر تعميد الفاتورة', 'error');
        }
    } catch (e) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

async function rejectExpense(id) {
    if (!isFinancialManagerUser()) {
        showToast('عفواً، صلاحية رفض المصروفات مقتصرة على المدير المالي (أ. ابوالنصر البغدادي).', 'error');
        return;
    }
    const reason = prompt('يرجى كتابة سبب رفض هذه الفاتورة:');
    if (reason === null) return;
    if (!reason.trim()) {
        showToast('يرجى توضيح سبب الرفض', 'warning');
        return;
    }

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    try {
        const res = await fetch(`/api/expenses/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: u.id,
                user_role: u.role,
                user_name: u.name,
                reason: reason.trim()
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم رفض الفاتورة وتحديث الحسابات', 'success');
            if (currentTab === 'expenses') loadExpenses();
            if (currentTab === 'cashflow' && typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
            if (typeof currentViewedCustodyId !== 'undefined' && currentViewedCustodyId) {
                const cModal = document.getElementById('custody-expenses-modal');
                if (cModal && !cModal.classList.contains('hidden')) {
                    viewCustodyExpenses(currentViewedCustodyId);
                }
            }
            if (typeof loadCustody === 'function') loadCustody();
            loadDashboard();
        } else {
            showToast(data.error || 'تعذر رفض الفاتورة', 'error');
        }
    } catch (e) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

function renderExpensesTable(expenses) {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    const isFinManager = isFinancialManagerUser();
    let totalSum = 0;
    let totalNoTax = 0;
    let totalTax = 0;
    let receiptsCount = 0;
    let pendingCount = 0;
    let pendingSum = 0;
    const catCounts = {};

    if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-slate-500">${isEn ? 'No expenses matching the search criteria' : 'لا توجد مصروفات مسجلة مطابقة لمعايير البحث'}</td></tr>`;
    }

    expenses.forEach(e => {
        const isApproved = (e.approval_status || 'approved') === 'approved';
        const isPending = e.approval_status === 'pending';
        const isRejected = e.approval_status === 'rejected';

        if (isApproved) {
            totalSum += e.amount;
            const noTax = (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount;
            totalNoTax += noTax;
            totalTax += (e.tax_amount || 0);
            if (e.invoice_file_path) receiptsCount++;
            catCounts[e.category] = (catCounts[e.category] || 0) + e.amount;
        } else if (isPending) {
            pendingCount++;
            pendingSum += e.amount;
        }

        const isTaxInv = e.is_tax_invoice === 1 || e.tax_amount > 0;
        const taxBadge = isTaxInv ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <i data-lucide="shield-check" class="w-3 h-3"></i>
                <span>${isEn ? '15% Tax Invoice' : 'فاتورة ضريبية 15%'}</span>
            </span>
            <div class="text-[10px] text-emerald-400 font-bold mt-0.5">${isEn ? 'Input VAT:' : 'مسترد:'} ${formatCurrency(e.tax_amount || 0)}</div>
        ` : `
            <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">${isEn ? 'Non-Tax' : 'بدون ضريبة'}</span>
        `;

        let approvalBadge = '';
        if (isPending) {
            approvalBadge = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse" title="المصروف معلق ولم يُخصم من التدفق النقدي أو العهدة لحين تعميده">
                    <i data-lucide="clock" class="w-3 h-3"></i>
                    <span>بانتظار التعميد</span>
                </span>
                ${e.created_by ? `<div class="text-[9px] text-slate-400 mt-0.5" title="المدخل">بواسطة: ${escapeHtml(e.created_by)}</div>` : ''}
            `;
        } else if (isRejected) {
            approvalBadge = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30" title="سبب الرفض: ${escapeHtml(e.approval_notes || 'مرفوض')}">
                    <i data-lucide="x-circle" class="w-3 h-3"></i>
                    <span>مرفوضة</span>
                </span>
                ${e.approval_notes ? `<div class="text-[9px] text-rose-400 mt-0.5" title="سبب الرفض">${escapeHtml(e.approval_notes)}</div>` : ''}
            `;
        } else {
            approvalBadge = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title="معمد من: ${escapeHtml(e.approved_by || 'المدير المالي')}">
                    <i data-lucide="shield-check" class="w-3 h-3"></i>
                    <span>معمدة ✓</span>
                </span>
                ${e.approved_by ? `<div class="text-[9px] text-emerald-400/80 mt-0.5" title="المعتمد">${escapeHtml(e.approved_by)}</div>` : ''}
            `;
        }

        let approvalActions = '';
        if (isFinManager && isPending) {
            approvalActions = `
                <button onclick="approveExpense(${e.id})" title="تعميد الفاتورة والخصم من الحسابات" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow transition">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
                    <span>تعميد</span>
                </button>
                <button onclick="rejectExpense(${e.id})" title="رفض الفاتورة" class="p-1 text-rose-400 hover:text-white rounded hover:bg-rose-600/30 transition">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            `;
        }

        const noTax = (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount;

        const row = document.createElement('tr');
        row.className = `hover:bg-slate-800/60 transition ${isPending ? 'bg-amber-500/5' : ''}`;
        row.innerHTML = `
            <td class="p-3.5 whitespace-nowrap text-slate-400 font-mono text-xs">${e.expense_date}</td>
            <td class="p-3.5 whitespace-nowrap font-mono text-xs">
                ${e.payment_status === 'unpaid' && !e.payment_date 
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">${isEn ? 'Unpaid' : 'لم تُصرف بعد'}</span>` 
                    : `<span class="text-emerald-400 font-bold">${e.payment_date || e.expense_date}</span>`
                }
            </td>
            <td class="p-3.5 whitespace-nowrap font-bold text-white">${e.project_name}</td>
            <td class="p-3.5 font-medium text-slate-200">
                ${e.title}
                ${e.custody_id ? `<div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 mr-1 mt-0.5 font-bold"><i data-lucide="wallet" class="w-3 h-3"></i> خصم من عهدة: ${escapeHtml(e.custody_employee_name || 'موظف')} (${escapeHtml(e.custody_request_number || '')})</div>` : ''}
                ${e.supplier_name ? `<div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 mr-1 mt-0.5 font-bold"><i data-lucide="truck" class="w-3 h-3"></i> ${e.supplier_name}</div>` : ''}
                ${e.has_price_increase === 1 ? `<div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 mr-1 mt-0.5 font-bold">⚠️ زيادة سعر: +${formatCurrency(e.total_variance || 0)}</div>` : ''}
                ${e.phase_name ? `<div class="text-[10px] text-emerald-400/80 font-normal mt-0.5">${e.phase_name}${e.item_title ? ` • ${e.item_title}` : ''}</div>` : ''}
                ${e.notes ? `<div class="text-[11px] text-slate-400 mt-0.5">${e.notes}</div>` : ''}
            </td>
            <td class="p-3.5 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[11px] bg-slate-800 border border-slate-700 text-slate-300">${typeof tr === 'function' ? tr(e.category) : e.category}</span>
            </td>
            <td class="p-3.5 whitespace-nowrap text-center">
                ${taxBadge}
            </td>
            <td class="p-3.5 whitespace-nowrap font-bold text-blue-400 text-xs">${formatCurrency(noTax)}</td>
            <td class="p-3.5 whitespace-nowrap font-black text-rose-400 text-sm">${formatCurrency(e.amount)}</td>
            <td class="p-3.5 whitespace-nowrap text-slate-400">
                ${e.custody_id ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <i data-lucide="wallet" class="w-3 h-3"></i>
                        <span>عهدة (${escapeHtml(e.custody_employee_name || 'موظف')})</span>
                    </span>
                ` : (typeof tr === 'function' ? tr(e.payment_method || 'نقدي') : (e.payment_method || 'نقدي'))}
            </td>
            <td class="p-3.5 whitespace-nowrap text-slate-300">
                <div class="flex flex-col gap-1">
                    <span class="text-white font-medium">${escapeHtml(e.paid_to || e.paid_by || '-')}</span>
                    ${e.assigned_disburser_name ? `
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <i data-lucide="send" class="w-3 h-3 text-amber-400"></i>
                                <span>مكلف: ${escapeHtml(e.assigned_disburser_name)}</span>
                            </span>
                            ${canDisburseThisExpense(e) ? `
                                <button type="button" onclick="openDisburseExpenseModal(${e.id})" title="تسجيل صرف وسداد الفاتورة" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow transition animate-pulse hover:animate-none">
                                    <i data-lucide="wallet" class="w-3 h-3"></i>
                                    <span>صرف 💵</span>
                                </button>
                            ` : ((e.payment_status === 'paid' || e.payment_date) ? `
                                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <i data-lucide="check" class="w-2.5 h-2.5"></i>
                                    <span>تم الصرف</span>
                                </span>
                            ` : '')}
                        </div>
                    ` : ''}
                </div>
            </td>
            <td class="p-3.5 text-center whitespace-nowrap">
                ${e.invoice_file_path ? `
                    <button onclick="viewInvoice('${e.invoice_file_path}', '${e.title}')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[11px] inline-flex items-center gap-1 transition">
                        <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                        <span>${isEn ? 'View Invoice' : 'عرض الفاتورة'}</span>
                    </button>
                ` : `
                    <span class="text-slate-600 text-[11px]">${isEn ? 'No Voucher' : 'بدون مرفق'}</span>
                `}
            </td>
            <td class="p-3.5 text-center whitespace-nowrap">
                ${approvalBadge}
            </td>
            <td class="p-3.5 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-1">
                    ${approvalActions}
                    ${isFinManager ? `
                        <button onclick="openAssignExpensePayerModal(${e.id})" title="تكليف مسؤول بسداد وصرف الفاتورة" class="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800 transition">
                            <i data-lucide="user-check" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                    <button onclick="openTransferExpenseModal(${e.id})" title="${isEn ? 'Transfer to Another Project' : 'نقل المصروف لمشروع آخر'}" class="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition">
                        <i data-lucide="arrow-right-left" class="w-4 h-4"></i>
                    </button>
                    <button onclick="openEditExpenseModal(${e.id})" title="${isEn ? 'Edit Expense' : 'تعديل المصروف'}" class="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteExpense(${e.id})" title="${isEn ? 'Delete Expense' : 'حذف المصروف'}" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Update Highlights
    document.getElementById('expenses-filtered-sum').innerText = formatCurrency(totalSum);
    if (document.getElementById('expenses-filtered-no-tax')) {
        document.getElementById('expenses-filtered-no-tax').innerText = formatCurrency(totalNoTax);
    }
    if (document.getElementById('expenses-filtered-tax')) {
        document.getElementById('expenses-filtered-tax').innerText = formatCurrency(totalTax);
    }
    document.getElementById('expenses-receipts-count').innerText = `${receiptsCount} ${isEn ? 'attached invoices' : 'فاتورة مرفقة'}`;

    // Find top category
    let topCat = 'مواد بناء';
    let maxCatVal = 0;
    for (const [k, v] of Object.entries(catCounts)) {
        if (v > maxCatVal) {
            maxCatVal = v;
            topCat = k;
        }
    }
    if (document.getElementById('expenses-top-category')) {
        document.getElementById('expenses-top-category').innerText = typeof tr === 'function' ? tr(topCat) : topCat;
    }

    initLucide();
}

// ----------------- ASSIGN EXPENSE PAYER MODAL FUNCTIONS -----------------
async function openAssignExpensePayerModal(expenseId) {
    if (!isFinancialManagerUser()) {
        showToast('عفواً، صلاحية تكليف وتوجيه سداد المصروفات والفواتير مقتصرة حصرياً على المدير المالي (أ. ابوالنصر البغدادي).', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/expenses/${expenseId}`);
        const data = await res.json();
        if (!data.success || !data.expense) {
            showToast('تعذر تحميل بيانات الفاتورة', 'error');
            return;
        }
        const exp = data.expense;

        // Ensure team members are loaded
        if (!Array.isArray(allTeamMembers) || allTeamMembers.length === 0) {
            try {
                const teamRes = await fetch('/api/team');
                allTeamMembers = await teamRes.json();
            } catch (e) {
                console.error('Error fetching team members:', e);
            }
        }

        document.getElementById('assign-payer-expense-id').value = exp.id;
        document.getElementById('assign-payer-inv-id').innerText = `#${exp.id}`;
        document.getElementById('assign-payer-inv-project').innerText = exp.project_name || 'عام';
        document.getElementById('assign-payer-inv-title').innerText = exp.title || '-';
        document.getElementById('assign-payer-inv-cat').innerText = exp.category || '-';
        document.getElementById('assign-payer-inv-amount').innerText = formatCurrency(exp.amount || 0);

        // Populate team members select
        const select = document.getElementById('assign-payer-member-select');
        if (select) {
            select.innerHTML = '';
            
            const optDefault = document.createElement('option');
            optDefault.value = '';
            optDefault.innerText = '-- اختر المسؤول المكلف بالسداد --';
            select.appendChild(optDefault);

            if (Array.isArray(allTeamMembers) && allTeamMembers.length > 0) {
                allTeamMembers.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.name;
                    opt.dataset.id = m.id;
                    opt.dataset.name = m.name;
                    opt.innerText = `👤 ${m.name} (${m.role || 'عضو فريق'})`;
                    
                    if (exp.assigned_disburser_name && exp.assigned_disburser_name === m.name) {
                        opt.selected = true;
                    } else if (!exp.assigned_disburser_name && exp.paid_by && exp.paid_by.includes(m.name)) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                });
            }

            const optCustom = document.createElement('option');
            optCustom.value = '__custom__';
            optCustom.innerText = '✏️ جهة أخرى / كتابة اسم مخصص...';
            if (exp.assigned_disburser_name && !Array.from(select.options).some(o => o.value === exp.assigned_disburser_name)) {
                optCustom.selected = true;
            }
            select.appendChild(optCustom);
        }

        onAssignPayerMemberChange();

        // Payment Method
        const methodSelect = document.getElementById('assign-payer-payment-method');
        if (methodSelect) {
            methodSelect.value = exp.payment_method || 'عهدة شخصية';
        }

        // Status
        const statusSelect = document.getElementById('assign-payer-status-select');
        if (statusSelect) {
            statusSelect.value = exp.payment_status || 'unpaid';
        }
        onAssignPayerStatusSelectChange();

        const dateInput = document.getElementById('assign-payer-payment-date');
        if (dateInput) {
            dateInput.value = exp.payment_date || new Date().toISOString().split('T')[0];
        }

        const notesInput = document.getElementById('assign-payer-notes-input');
        if (notesInput) {
            notesInput.value = '';
        }

        openModal('expense-assign-payer-modal');
        initLucide();
    } catch (err) {
        console.error('Error opening assign payer modal:', err);
        showToast('حدث خطأ في تحميل الفاتورة', 'error');
    }
}

function onAssignPayerMemberChange() {
    const select = document.getElementById('assign-payer-member-select');
    const customInput = document.getElementById('assign-payer-custom-name');
    const btnText = document.getElementById('btn-submit-assign-payer-text');
    if (!select) return;

    if (select.value === '__custom__') {
        if (customInput) customInput.classList.remove('hidden');
    } else {
        if (customInput) {
            customInput.classList.add('hidden');
            customInput.value = '';
        }
    }

    const val = select.value === '__custom__' ? (customInput ? customInput.value : '') : select.value;
    if (btnText) {
        btnText.innerText = val ? `تأكيد تكليف (${val}) وإرسال أمر السداد` : 'تأكيد التكليف وإرسال أمر السداد';
    }
}

function onAssignPayerStatusSelectChange() {
    const statusSelect = document.getElementById('assign-payer-status-select');
    const dateRow = document.getElementById('assign-payer-payment-date-row');
    if (!statusSelect || !dateRow) return;

    if (statusSelect.value === 'paid') {
        dateRow.classList.remove('hidden');
    } else {
        dateRow.classList.add('hidden');
    }
}

async function submitAssignExpensePayer(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-assign-payer');
    if (btn) btn.disabled = true;

    const expenseId = document.getElementById('assign-payer-expense-id')?.value;
    const select = document.getElementById('assign-payer-member-select');
    const customInput = document.getElementById('assign-payer-custom-name');
    const methodSelect = document.getElementById('assign-payer-payment-method');
    const statusSelect = document.getElementById('assign-payer-status-select');
    const dateInput = document.getElementById('assign-payer-payment-date');
    const notesInput = document.getElementById('assign-payer-notes-input');

    let assignedName = '';
    if (select.value === '__custom__') {
        assignedName = customInput ? customInput.value.trim() : '';
    } else {
        assignedName = select.value;
    }

    if (!assignedName) {
        showToast('يرجى تحديد المسؤول المكلف بالسداد (مثل: نواف سجيني)', 'warning');
        if (btn) btn.disabled = false;
        return;
    }

    if (!isFinancialManagerUser()) {
        showToast('عفواً، صلاحية تكليف وتوجيه سداد المصروفات والفواتير مقتصرة حصرياً على المدير المالي (أ. ابوالنصر البغدادي).', 'error');
        if (btn) btn.disabled = false;
        return;
    }

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');

    try {
        const res = await fetch(`/api/expenses/${expenseId}/assign-payer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: u.id,
                user_role: u.role,
                user_name: u.name,
                assigned_disburser_name: assignedName,
                payment_method: methodSelect ? methodSelect.value : 'نقدي',
                payment_status: statusSelect ? statusSelect.value : 'unpaid',
                payment_date: dateInput ? dateInput.value : '',
                notes: notesInput ? notesInput.value.trim() : ''
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || `تم تكليف (${assignedName}) بسداد الفاتورة بنجاح!`, 'success');
            closeModal('expense-assign-payer-modal');
            loadExpenses();
            if (typeof loadCashFlow === 'function') loadCashFlow();
        } else {
            showToast(data.error || 'تعذر تكليف المسؤول', 'error');
        }
    } catch (err) {
        console.error('Error assigning expense payer:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ----------------- DISBURSE EXPENSE MODAL FUNCTIONS -----------------
function canDisburseThisExpense(e) {
    if (!e) return false;
    if (e.payment_status === 'paid' && e.payment_date) return false;
    
    const assignedName = (e.assigned_disburser_name || '').trim();
    if (!assignedName) return false;

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    if (!u) return false;

    const uName = (u.name || '').trim();
    const isFin = isFinancialManagerUser();
    
    const isAssigned = (uName && (assignedName.includes(uName) || uName.includes(assignedName))) ||
                       (u.username && assignedName.toLowerCase().includes(u.username.toLowerCase()));

    return isAssigned || isFin;
}

async function openDisburseExpenseModal(expenseId) {
    try {
        const res = await fetch(`/api/expenses/${expenseId}`);
        const data = await res.json();
        if (!data.success || !data.expense) {
            showToast('تعذر تحميل بيانات الفاتورة', 'error');
            return;
        }
        const exp = data.expense;

        const idInput = document.getElementById('disburse-expense-id');
        if (idInput) idInput.value = exp.id;

        const titleDisplay = document.getElementById('disburse-expense-title-display');
        if (titleDisplay) titleDisplay.textContent = exp.title || '-';

        const projectDisplay = document.getElementById('disburse-expense-project-display');
        if (projectDisplay) projectDisplay.textContent = exp.project_name || '-';

        const amountDisplay = document.getElementById('disburse-expense-amount-display');
        if (amountDisplay) amountDisplay.textContent = `${formatCurrency(exp.amount)} ر.س`;

        const assignedDisplay = document.getElementById('disburse-expense-assigned-display');
        if (assignedDisplay) assignedDisplay.textContent = exp.assigned_disburser_name || 'غير محدد';

        const dateInput = document.getElementById('disburse-expense-date-input');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const methodSelect = document.getElementById('disburse-expense-method-select');
        if (methodSelect) {
            if (exp.payment_method && exp.payment_method !== 'آجل') {
                methodSelect.value = exp.payment_method;
            } else {
                methodSelect.value = 'عهدة شخصية للمسؤول';
            }
        }

        const notesInput = document.getElementById('disburse-expense-notes-input');
        if (notesInput) notesInput.value = '';

        const receiptInput = document.getElementById('disburse-expense-receipt-file');
        if (receiptInput) receiptInput.value = '';

        openModal('expense-disburse-modal');
        initLucide();
    } catch (err) {
        console.error('Error opening disburse modal:', err);
        showToast('حدث خطأ في تحميل بيانات الفاتورة', 'error');
    }
}

async function submitDisburseExpense(event) {
    if (event) event.preventDefault();

    const expenseId = document.getElementById('disburse-expense-id')?.value;
    if (!expenseId) {
        showToast('رقم الفاتورة مفقود', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-disburse-expense');
    if (btn) btn.disabled = true;

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    const dateInput = document.getElementById('disburse-expense-date-input');
    const methodSelect = document.getElementById('disburse-expense-method-select');
    const notesInput = document.getElementById('disburse-expense-notes-input');
    const receiptFile = document.getElementById('disburse-expense-receipt-file');

    const formData = new FormData();
    formData.append('user_id', u.id || '');
    formData.append('user_role', u.role || '');
    formData.append('user_name', u.name || '');
    formData.append('payment_date', dateInput ? dateInput.value : '');
    formData.append('payment_method', methodSelect ? methodSelect.value : 'نقدي');
    formData.append('notes', notesInput ? notesInput.value.trim() : '');

    if (receiptFile && receiptFile.files && receiptFile.files[0]) {
        formData.append('receipt_file', receiptFile.files[0]);
    }

    try {
        const res = await fetch(`/api/expenses/${expenseId}/disburse`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم تأكيد صرف وسداد الفاتورة بنجاح!', 'success');
            closeModal('expense-disburse-modal');
            loadExpenses();
            if (typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData) {
                openProjectDetails(currentProjectDetailData.id);
            }
            loadDashboard();
        } else {
            showToast(data.error || 'تعذر تأكيد صرف الفاتورة', 'error');
        }
    } catch (err) {
        console.error('Error submitting expense disburse:', err);
        showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function deleteExpense(expenseId) {
    if (!confirm("هل أنت متأكد من حذف هذا المصروف / الفاتورة نهائياً؟\nسيتم إزالة الفاتورة وحذف المصروف وتحديث كافة موازين المشروع والموردين والتدفق النقدي تلقائياً بدون التأثير على بقية العمليات.")) {
        return;
    }
    try {
        const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف المصروف والفاتورة بنجاح وتحديث كافة الحسابات');
            loadExpenses();
            loadDashboard();
            if (currentTab === 'suppliers' && typeof loadSuppliersData === 'function') loadSuppliersData();
            if (currentTab === 'cashflow' && typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData) {
                openProjectDetails(currentProjectDetailData.id);
            }
            if (typeof currentSelectedSupplierDetailId !== 'undefined' && currentSelectedSupplierDetailId) {
                openSupplierDetailModal(currentSelectedSupplierDetailId);
            }
        } else {
            showToast(data.error || 'تعذر حذف المصروف', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم لحذف المصروف', 'error');
    }
}

// ----------------- SUBCONTRACTORS TAB -----------------
let cachedSubcontractors = [];

// Subcontractor Trades & Custom Classification
const DEFAULT_SUBCONTRACTOR_TRADES = [
    'حدادة مسلحة',
    'نجارة مسلحة وشدات',
    'أعمال مباني وطوب',
    'بياض محارة ولياسة',
    'سباكة وصرف صحي',
    'كهرباء وتأسيس',
    'هياكل معدنية ستيل',
    'أعمال عزل مائي وحراري',
    'رخام وسيراميك وأرضيات',
    'أعمال دهانات وبويات',
    'جبس بورد وديكور',
    'كلادينج وواجهات',
    'أعمال تكييف وتهوية',
    'حفر وردم وتسوية',
    'ألومنيوم وواجهات زجاجية',
    'أعمال كهروميكانيك ومصاعد',
    'عام وأعمال مساندة'
];

function getSubcontractorTrades() {
    let custom = [];
    try {
        const stored = localStorage.getItem('custom_subcontractor_trades');
        if (stored) custom = JSON.parse(stored);
    } catch (e) {}

    const fromCached = (cachedSubcontractors || []).map(s => s.trade).filter(Boolean);
    const set = new Set([...DEFAULT_SUBCONTRACTOR_TRADES, ...custom, ...fromCached]);
    return Array.from(set).filter(t => t && t.trim() !== '' && t !== '__custom__');
}

function saveCustomSubcontractorTrade(trade) {
    if (!trade || !trade.trim() || DEFAULT_SUBCONTRACTOR_TRADES.includes(trade.trim())) return;
    try {
        let custom = [];
        const stored = localStorage.getItem('custom_subcontractor_trades');
        if (stored) custom = JSON.parse(stored);
        if (!custom.includes(trade.trim())) {
            custom.push(trade.trim());
            localStorage.setItem('custom_subcontractor_trades', JSON.stringify(custom));
        }
    } catch (e) {}
}

function refreshSubcontractorTradeDropdowns(selectedVal = null) {
    const trades = getSubcontractorTrades();

    // 1. In Subcontractor Modal
    const selectModal = document.getElementById('sub-trade');
    if (selectModal) {
        selectModal.innerHTML = '';
        trades.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (selectedVal && selectedVal === t) opt.selected = true;
            selectModal.appendChild(opt);
        });
        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = '+ كتابة مهنة / تصنيف جديد مخصص...';
        if (selectedVal === '__custom__') customOpt.selected = true;
        selectModal.appendChild(customOpt);
    }

    // 2. In Filter Bar (tab-subcontractors)
    const selectFilter = document.getElementById('subcontractor-trade-filter');
    if (selectFilter) {
        const currentFilter = selectFilter.value;
        selectFilter.innerHTML = '<option value="">جميع المهن والتخصصات</option>';
        trades.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (currentFilter && currentFilter === t) opt.selected = true;
            selectFilter.appendChild(opt);
        });
    }
}

function onSubcontractorTradeChanged(val) {
    const box = document.getElementById('subcontractor-custom-trade-box');
    const input = document.getElementById('subcontractor-custom-trade');
    if (val === '__custom__') {
        if (box) box.classList.remove('hidden');
        if (input) {
            input.focus();
            input.required = true;
        }
    } else {
        if (box) box.classList.add('hidden');
        if (input) {
            input.required = false;
            input.value = '';
        }
    }
}

function enableCustomSubcontractorTrade() {
    const select = document.getElementById('sub-trade');
    if (select) select.value = '__custom__';
    onSubcontractorTradeChanged('__custom__');
}

function cancelCustomSubcontractorTrade() {
    const select = document.getElementById('sub-trade');
    const box = document.getElementById('subcontractor-custom-trade-box');
    const input = document.getElementById('subcontractor-custom-trade');
    if (box) box.classList.add('hidden');
    if (input) input.value = '';
    if (select) select.value = 'حدادة مسلحة';
}

function filterSubcontractorsList() {
    const q = (document.getElementById('subcontractor-search-input')?.value || '').trim().toLowerCase();
    const tradeFilter = document.getElementById('subcontractor-trade-filter')?.value || '';

    let filtered = cachedSubcontractors || [];

    if (q) {
        filtered = filtered.filter(s => {
            const name = (s.name || '').toLowerCase();
            const trade = (s.trade || '').toLowerCase();
            const phone = (s.phone || '').toLowerCase();
            const proj = (s.project_name || '').toLowerCase();
            const notes = (s.notes || '').toLowerCase();
            return name.includes(q) || trade.includes(q) || phone.includes(q) || proj.includes(q) || notes.includes(q);
        });
    }

    if (tradeFilter) {
        filtered = filtered.filter(s => s.trade === tradeFilter);
    }

    const badge = document.getElementById('subcontractors-count-badge');
    if (badge) {
        badge.innerText = `${filtered.length} مقاول`;
    }

    renderSubcontractorsGrid(filtered);
}

async function loadSubcontractors() {
    try {
        const res = await fetch('/api/subcontractors');
        const subs = await res.json();
        cachedSubcontractors = subs;
        refreshSubcontractorTradeDropdowns();
        filterSubcontractorsList();
    } catch (err) {
        console.error('Error loading subcontractors:', err);
    }
}

function renderSubcontractorsGrid(subs) {
    const grid = document.getElementById('subcontractors-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (subs.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-center py-12 text-slate-500">${isEn ? 'No subcontractors match criteria' : 'لا يوجد مقاولو باطن مسجلون يطابقون البحث حالياً'}</div>`;
        return;
    }

    subs.forEach(s => {
        const totalPaid = s.total_paid != null ? s.total_paid : (s.paid_amount || 0);
        const count = s.payments_count != null ? s.payments_count : 0;
        const card = document.createElement('div');
        card.className = 'bg-slate-850 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-blue-500/50 transition-all shadow-xl flex flex-col justify-between';
        
        const escapedName = (s.name || '').replace(/'/g, "\\'");

        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-extrabold text-base text-white">${s.name}</h3>
                        <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">${typeof tr === 'function' ? tr(s.trade) : s.trade}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button onclick="openEditSubcontractorModal(${s.id})" title="${isEn ? 'Edit Subcontractor' : 'تعديل بيانات المقاول'}" class="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteSubcontractor(${s.id})" title="${isEn ? 'Delete Subcontractor' : 'حذف المقاول'}" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                        <div class="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 ml-1">
                            <i data-lucide="wrench" class="w-4 h-4"></i>
                        </div>
                    </div>
                </div>

                <div class="text-xs text-slate-400 space-y-1">
                    <p>${isEn ? 'Default Project:' : 'المشروع المرتبط:'} <strong class="text-slate-200">${s.project_name || (isEn ? 'General / Multi-project' : 'عام / مشاريع متعددة')}</strong></p>
                    <p>${isEn ? 'Phone:' : 'الهاتف:'} <strong class="text-slate-200 font-mono">${s.phone || '-'}</strong></p>
                    ${s.notes ? `<p class="italic text-[11px] text-slate-400 line-clamp-2">${s.notes}</p>` : ''}
                </div>

                <!-- Financial Summary Box -->
                <div class="bg-gradient-to-br from-slate-850 to-slate-800 border border-slate-750/80 rounded-xl p-3.5 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-400">${isEn ? 'Total Disbursed:' : 'إجمالي المنصرف للمقاول:'}</span>
                        <strong class="text-emerald-400 text-sm font-black font-mono">${formatCurrency(totalPaid)}</strong>
                    </div>
                    <div class="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-750/50 text-slate-400">
                        <span>${isEn ? 'Payments count:' : 'عدد الدفعات والمصاريف:'}</span>
                        <span class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">${count} ${isEn ? 'payments' : 'حركة صرف'}</span>
                    </div>
                </div>
            </div>

            <!-- Action Buttons: Disburse Expense + Statement Report -->
            <div class="pt-3 border-t border-slate-750 space-y-2">
                <button onclick="openSubPaymentModal(${s.id}, '${escapedName}', ${s.project_id || 'null'})" class="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm">
                    <i data-lucide="badge-dollar-sign" class="w-4 h-4"></i>
                    <span>${isEn ? 'Disburse Expense / Payment' : 'صرف دفعة / مصروف للمقاول'}</span>
                </button>
                <button onclick="openSubcontractorStatementModal(${s.id})" class="w-full py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                    <span>${isEn ? 'Subcontractor Statement & Report' : '🖨️ كشف حساب وتقرير المقاول'}</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    initLucide();
}

function resetSubcontractorModal() {
    const form = document.getElementById('subcontractor-form');
    if (form) form.reset();
    const editId = document.getElementById('sub-edit-id');
    if (editId) editId.value = '';
    const agreedInput = document.getElementById('sub-agreed-amount');
    if (agreedInput) agreedInput.value = '0';
    cancelCustomSubcontractorTrade();
    refreshSubcontractorTradeDropdowns('حدادة مسلحة');
    const title = document.getElementById('sub-modal-title');
    if (title) title.innerText = 'تسجيل مقاول باطن / حرفي';
    const btnText = document.getElementById('sub-btn-text');
    if (btnText) btnText.innerText = 'حفظ بيانات المقاول';
}

function openEditSubcontractorModal(subId) {
    const s = (cachedSubcontractors || []).find(x => x.id === subId);
    if (!s) return;
    resetSubcontractorModal();
    document.getElementById('sub-edit-id').value = s.id;
    document.getElementById('sub-name').value = s.name || '';
    
    refreshSubcontractorTradeDropdowns(s.trade);
    const tradeSelect = document.getElementById('sub-trade');
    if (tradeSelect && s.trade) {
        tradeSelect.value = s.trade;
    }
    
    document.getElementById('sub-phone').value = s.phone || '';
    document.getElementById('sub-project-id').value = s.project_id || '';
    const agreedInput = document.getElementById('sub-agreed-amount');
    if (agreedInput) agreedInput.value = s.agreed_amount || 0;
    document.getElementById('sub-notes').value = s.notes || '';

    const title = document.getElementById('sub-modal-title');
    if (title) title.innerText = `تعديل بيانات المقاول: ${s.name}`;
    const btnText = document.getElementById('sub-btn-text');
    if (btnText) btnText.innerText = 'تحديث بيانات المقاول';

    openModal('subcontractor-modal');
}

async function deleteSubcontractor(subId) {
    if (!confirm("هل أنت متأكد من حذف هذا المقاول وسجل دفعاته نهائياً؟")) {
        return;
    }
    try {
        const res = await fetch(`/api/subcontractors/${subId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف المقاول وسجل دفعاته بنجاح');
            loadSubcontractors();
        } else {
            showToast(data.error || 'تعذر حذف المقاول', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم لحذف المقاول', 'error');
    }
}

async function openSubPaymentModal(subId, subName, defaultProjectId) {
    document.getElementById('sub-pay-id').value = subId;
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    const nameEl = document.getElementById('sub-pay-target-name');
    if (nameEl) {
        nameEl.innerText = `${isEn ? 'Beneficiary Subcontractor:' : 'المقاول المستفيد:'} ${subName}`;
    }

    // Populate projects dropdown
    const projSelect = document.getElementById('sub-pay-project-id');
    if (projSelect) {
        if (projSelect.options.length <= 1) {
            try {
                const res = await fetch('/api/projects');
                const projs = await res.json();
                projSelect.innerHTML = '<option value="">-- اختر المشروع المنصرف له * --</option>';
                projs.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.innerText = `${p.name} (${p.code || '#' + p.id})`;
                    projSelect.appendChild(opt);
                });
            } catch (e) {
                console.error(e);
            }
        }
        if (defaultProjectId) {
            projSelect.value = String(defaultProjectId);
        }
    }

    // Reset fields
    const amtEl = document.getElementById('sub-pay-amount');
    if (amtEl) amtEl.value = '';
    const dateEl = document.getElementById('sub-pay-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const notesEl = document.getElementById('sub-pay-notes');
    if (notesEl) notesEl.value = '';
    const fileEl = document.getElementById('sub-pay-receipt-file');
    if (fileEl) fileEl.value = '';

    openModal('sub-payment-modal');
}

// ----------------- SUBCONTRACTOR STATEMENT & REPORT -----------------
let currentStatementData = null;

async function openSubcontractorStatementModal(subId) {
    try {
        const res = await fetch(`/api/subcontractors/${subId}/statement`);
        const data = await res.json();
        if (!data.success || !data.subcontractor) {
            showToast(data.error || 'تعذر جلب كشف حساب المقاول', 'error');
            return;
        }

        currentStatementData = data;
        const sub = data.subcontractor;
        const payments = data.payments || [];
        const projectsSummary = data.projects_summary || [];

        // Set Title
        const titleEl = document.getElementById('sub-stmt-title');
        if (titleEl) titleEl.innerText = `كشف حساب مقاول: ${sub.name}`;
        const subtitleEl = document.getElementById('sub-stmt-subtitle');
        if (subtitleEl) subtitleEl.innerText = `التخصص: ${sub.trade} • إجمالي المنصرف: ${formatCurrency(data.total_paid)}`;

        const container = document.getElementById('sub-statement-content');
        if (!container) return;

        const printDate = new Date().toLocaleDateString('ar-SA');
        const printGregorian = new Date().toISOString().split('T')[0];

        let projectsBreakdownHtml = '';
        if (projectsSummary.length > 0) {
            projectsBreakdownHtml = `
                <div class="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-3">
                    <h4 class="font-bold text-sm text-white flex items-center gap-2">
                        <i data-lucide="layers" class="w-4 h-4 text-blue-400"></i>
                        <span>توزيع المصروفات حسب المشاريع</span>
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        ${projectsSummary.map(ps => {
                            const pct = data.total_paid > 0 ? ((ps.total / data.total_paid) * 100).toFixed(1) : 0;
                            return `
                                <div class="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-1">
                                    <span class="text-xs text-slate-300 font-bold block truncate">${ps.project_name}</span>
                                    <div class="flex items-center justify-between text-xs">
                                        <span class="font-extrabold text-emerald-400 font-mono">${formatCurrency(ps.total)}</span>
                                        <span class="text-[10px] text-slate-400 font-bold">${pct}%</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        let paymentsTableRows = '';
        if (payments.length === 0) {
            paymentsTableRows = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-slate-500 font-bold">لا توجد مصاريف أو دفعات مسجلة لهذا المقاول حتى الآن</td>
                </tr>
            `;
        } else {
            payments.forEach((p, idx) => {
                paymentsTableRows += `
                    <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
                        <td class="p-3 text-center text-slate-400 font-mono text-xs">${idx + 1}</td>
                        <td class="p-3 whitespace-nowrap text-slate-300 font-mono text-xs">${p.payment_date}</td>
                        <td class="p-3 whitespace-nowrap">
                            <span class="font-bold text-white text-xs">${p.project_name || 'مشروع عام'}</span>
                            ${p.project_code ? `<span class="text-[10px] text-blue-400 font-mono block">(${p.project_code})</span>` : ''}
                        </td>
                        <td class="p-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">${p.payment_type || 'دفعة'}</span>
                        </td>
                        <td class="p-3 whitespace-nowrap text-xs text-slate-300">${p.payment_method || 'نقدي'}</td>
                        <td class="p-3 text-xs text-slate-300">${p.notes || '-'}</td>
                        <td class="p-3 whitespace-nowrap text-center">
                            ${p.receipt_file_path ? `
                                <a href="${p.receipt_file_path}" target="_blank" class="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline font-bold">
                                    <i data-lucide="paperclip" class="w-3 h-3"></i>
                                    <span>معاينة السند</span>
                                </a>
                            ` : `<span class="text-[10px] text-slate-500">-</span>`}
                        </td>
                        <td class="p-3 whitespace-nowrap text-left font-black text-emerald-400 font-mono text-sm">${formatCurrency(p.amount)}</td>
                    </tr>
                `;
            });
        }

        container.innerHTML = `
            <div id="statement-printable-sheet" class="space-y-6">
                <!-- Header -->
                <div class="flex items-center justify-between pb-4 border-b-2 border-slate-700 bg-slate-850 p-4 rounded-xl">
                    <div class="space-y-1">
                        <h2 class="text-xl font-black text-white tracking-wide">مؤسسة السجيني للمقاولات العامة</h2>
                        <p class="text-xs text-slate-400">إدارة المشاريع والشؤون المالية والمحاسبية</p>
                        <p class="text-[11px] text-slate-400 font-mono">تاريخ الاستخراج: ${printGregorian} م (${printDate} هـ)</p>
                    </div>
                    <div class="text-left space-y-1">
                        <div class="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg inline-block">
                            <span class="text-xs font-black text-blue-400 uppercase tracking-widest">كشف حساب مقاول باطن</span>
                        </div>
                        <p class="text-[11px] text-slate-400 font-mono">رقم المقاول: SUB-${String(sub.id).padStart(4, '0')}</p>
                    </div>
                </div>

                <!-- Info Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                        <span class="text-[11px] text-slate-400 block mb-0.5">اسم المقاول / المعلم</span>
                        <strong class="text-white text-sm">${sub.name}</strong>
                    </div>
                    <div class="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                        <span class="text-[11px] text-slate-400 block mb-0.5">المهنة / التخصص</span>
                        <strong class="text-blue-400 text-sm">${sub.trade}</strong>
                    </div>
                    <div class="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                        <span class="text-[11px] text-slate-400 block mb-0.5">رقم الهاتف</span>
                        <strong class="text-slate-200 text-sm font-mono">${sub.phone || '-'}</strong>
                    </div>
                    <div class="bg-gradient-to-br from-emerald-950/40 to-slate-850 p-3.5 rounded-xl border border-emerald-500/30">
                        <span class="text-[11px] text-emerald-400 font-bold block mb-0.5">إجمالي المنصرف للمقاول</span>
                        <strong class="text-emerald-400 text-lg font-black font-mono">${formatCurrency(data.total_paid)}</strong>
                    </div>
                </div>

                <!-- Projects Breakdown -->
                ${projectsBreakdownHtml}

                <!-- Table -->
                <div class="bg-slate-850 rounded-xl border border-slate-750 overflow-hidden space-y-2">
                    <div class="px-4 py-3 border-b border-slate-750 flex items-center justify-between">
                        <h4 class="font-bold text-sm text-white flex items-center gap-2">
                            <i data-lucide="receipt" class="w-4 h-4 text-emerald-400"></i>
                            <span>سجل الحركات والمصاريف المنصرفة (${payments.length} حركة)</span>
                        </h4>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-right border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                    <th class="p-3 text-center w-10">م</th>
                                    <th class="p-3">تاريخ الصرف</th>
                                    <th class="p-3">المشروع</th>
                                    <th class="p-3">نوع الصرف</th>
                                    <th class="p-3">طريقة الدفع</th>
                                    <th class="p-3">البيان والملاحظات</th>
                                    <th class="p-3 text-center">المستند</th>
                                    <th class="p-3 text-left">المبلغ المصروف</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${paymentsTableRows}
                            </tbody>
                            <tfoot>
                                <tr class="bg-slate-800/90 font-black text-white border-t-2 border-slate-700">
                                    <td colspan="7" class="p-3 text-right text-xs">إجمالي المنصرف المقيد للمقاول:</td>
                                    <td class="p-3 text-left text-emerald-400 font-mono text-base">${formatCurrency(data.total_paid)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- Signatures -->
                <div class="bg-slate-850 p-5 rounded-xl border border-slate-750 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 text-center text-xs">
                    <div class="space-y-8">
                        <span class="text-slate-400 font-bold block">المقاول المستلم:</span>
                        <div class="border-b border-dashed border-slate-600 pb-1">
                            <p class="font-bold text-white">${sub.name}</p>
                        </div>
                        <span class="text-[10px] text-slate-500">التوقيع والختم</span>
                    </div>
                    <div class="space-y-8">
                        <span class="text-slate-400 font-bold block">المهندس المشرف:</span>
                        <div class="border-b border-dashed border-slate-600 pb-1">
                            <p class="font-bold text-white">إدارة المشاريع</p>
                        </div>
                        <span class="text-[10px] text-slate-500">التوقيع والاعتماد</span>
                    </div>
                    <div class="space-y-8">
                        <span class="text-slate-400 font-bold block">الإدارة المالية:</span>
                        <div class="border-b border-dashed border-slate-600 pb-1">
                            <p class="font-bold text-white">مؤسسة السجيني</p>
                        </div>
                        <span class="text-[10px] text-slate-500">الختم الرسمي والتاريخ</span>
                    </div>
                </div>
            </div>
        `;

        openModal('subcontractor-statement-modal');
        initLucide();
    } catch (err) {
        console.error(err);
        showToast('فشل في جلب تقرير كشف حساب المقاول', 'error');
    }
}

function printCurrentSubcontractorStatement() {
    if (!currentStatementData) {
        showToast('لا توجد بيانات كشف حساب متاحة للطباعة', 'warning');
        return;
    }

    const sub = currentStatementData.subcontractor;
    const payments = currentStatementData.payments || [];
    const totalPaid = currentStatementData.total_paid || 0;
    const printDate = new Date().toLocaleDateString('ar-SA');
    const printGregorian = new Date().toISOString().split('T')[0];

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير', 'warning');
        return;
    }

    let rowsHtml = '';
    payments.forEach((p, i) => {
        rowsHtml += `
            <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td>${p.payment_date}</td>
                <td><strong>${p.project_name || 'عام'}</strong> ${p.project_code ? `(${p.project_code})` : ''}</td>
                <td>${p.payment_type || 'دفعة'}</td>
                <td>${p.payment_method || 'نقدي'}</td>
                <td>${p.notes || '-'}</td>
                <td style="text-align: left; font-weight: bold;">${Number(p.amount).toLocaleString('en-US', {minimumFractionDigits: 2})} ر.س</td>
            </tr>
        `;
    });

    const docHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>كشف حساب مقاول - ${sub.name}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
            body {
                font-family: 'Cairo', sans-serif;
                margin: 20px;
                color: #111;
                background: #fff;
                direction: rtl;
                font-size: 12px;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 12px;
                margin-bottom: 20px;
            }
            .header h1 {
                margin: 0;
                font-size: 18px;
                color: #0f172a;
                font-weight: 900;
            }
            .header p {
                margin: 2px 0 0 0;
                color: #64748b;
                font-size: 11px;
            }
            .badge-box {
                border: 2px solid #0f172a;
                padding: 6px 14px;
                border-radius: 8px;
                text-align: center;
            }
            .badge-box strong {
                font-size: 14px;
                color: #0f172a;
                display: block;
            }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 20px;
            }
            .info-card {
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 10px;
                background: #f8fafc;
            }
            .info-card span {
                display: block;
                font-size: 10px;
                color: #64748b;
                margin-bottom: 2px;
            }
            .info-card strong {
                font-size: 12px;
                color: #0f172a;
            }
            .kpi-total {
                background: #ecfdf5;
                border-color: #10b981;
            }
            .kpi-total strong {
                color: #059669;
                font-size: 15px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 25px;
            }
            th, td {
                border: 1px solid #cbd5e1;
                padding: 8px 10px;
                text-align: right;
            }
            th {
                background: #f1f5f9;
                color: #0f172a;
                font-size: 11px;
                font-weight: bold;
            }
            tfoot td {
                background: #f8fafc;
                font-size: 13px;
                font-weight: bold;
            }
            .signatures {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-top: 40px;
                text-align: center;
                page-break-inside: avoid;
            }
            .sig-box {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 15px;
            }
            .sig-line {
                margin-top: 40px;
                border-top: 1px dashed #94a3b8;
                padding-top: 5px;
                font-size: 11px;
                color: #64748b;
            }
            @media print {
                body { margin: 10mm; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <h1>مؤسسة السجيني للمقاولات العامة</h1>
                <p>إدارة المشاريع والشؤون المالية والمحاسبية</p>
                <p>تاريخ الاستخراج: ${printGregorian} م (${printDate} هـ)</p>
            </div>
            <div class="badge-box">
                <strong>كشف حساب مقاول باطن</strong>
                <span style="font-size: 10px; color: #64748b;">SUB-${String(sub.id).padStart(4, '0')}</span>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-card">
                <span>اسم المقاول / المعلم</span>
                <strong>${sub.name}</strong>
            </div>
            <div class="info-card">
                <span>المهنة / التخصص</span>
                <strong>${sub.trade}</strong>
            </div>
            <div class="info-card">
                <span>الهاتف</span>
                <strong>${sub.phone || '-'}</strong>
            </div>
            <div class="info-card kpi-total">
                <span>إجمالي المنصرف الفعلي</span>
                <strong>${Number(totalPaid).toLocaleString('en-US', {minimumFractionDigits: 2})} ر.س</strong>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 30px; text-align: center;">م</th>
                    <th>تاريخ الصرف</th>
                    <th>المشروع</th>
                    <th>نوع الصرف</th>
                    <th>طريقة الدفع</th>
                    <th>البيان والملاحظات</th>
                    <th style="text-align: left;">المبلغ المصروف</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="6" style="text-align: right;">إجمالي المبالغ المنصرفة:</td>
                    <td style="text-align: left; color: #059669;">${Number(totalPaid).toLocaleString('en-US', {minimumFractionDigits: 2})} ر.س</td>
                </tr>
            </tfoot>
        </table>

        <div class="signatures">
            <div class="sig-box">
                <strong>المقاول المستلم</strong>
                <p style="margin: 5px 0 0 0; color: #475569;">${sub.name}</p>
                <div class="sig-line">التوقيع والختم</div>
            </div>
            <div class="sig-box">
                <strong>المهندس المشرف</strong>
                <p style="margin: 5px 0 0 0; color: #475569;">إدارة المشاريع</p>
                <div class="sig-line">التوقيع والاعتماد</div>
            </div>
            <div class="sig-box">
                <strong>الإدارة المالية</strong>
                <p style="margin: 5px 0 0 0; color: #475569;">مؤسسة السجيني</p>
                <div class="sig-line">الختم الرسمي والتاريخ</div>
            </div>
        </div>

        <script>
            window.onload = function() {
                window.print();
            };
        <\/script>
    </body>
    </html>
    `;

    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
}

// ----------------- DOCUMENTS & BLUEPRINTS TAB -----------------
async function loadDocuments() {
    try {
        const res = await fetch('/api/documents');
        const docs = await res.json();
        renderDocumentsGrid(docs);
    } catch (err) {
        console.error('Error loading documents:', err);
    }
}

function renderDocumentsGrid(docs) {
    const grid = document.getElementById('documents-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (docs.length === 0) {
        grid.innerHTML = `
            <div class="col-span-1 md:col-span-2 lg:col-span-4 bg-slate-850/90 rounded-2xl border-2 border-dashed border-slate-750 p-10 text-center space-y-4">
                <div class="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
                    <i data-lucide="folder-archive" class="w-8 h-8"></i>
                </div>
                <div class="max-w-md mx-auto space-y-1">
                    <h3 class="text-base font-bold text-white">${isEn ? 'No blueprints or engineering documents uploaded yet' : 'لا توجد مخططات أو مستندات هندسية مرفوعة حالياً'}</h3>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        ${isEn ? 'The digital blueprint archive is empty. You can upload architectural drawings, structural blueprints, municipal licenses, and technical inspection reports.' : 'الأرشيف السحابي للمخططات فارغ حالياً. يمكنك أرشفة الرسومات المعمارية والإنشائية، رخص البناء، وتقارير الفحص الفني بصيغ PDF أو صور عالية الدقة وربطها بالمشاريع.'}
                    </p>
                </div>
                <div class="pt-2">
                    <button type="button" onclick="openModal('document-modal')" class="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-purple-950/40 transition">
                        <i data-lucide="upload" class="w-4 h-4"></i>
                        <span>${isEn ? 'Upload First Blueprint or Document' : 'رفع أول مخطط أو وثيقة للمشروع'}</span>
                    </button>
                </div>
            </div>
        `;
        initLucide();
        return;
    }

    docs.forEach(d => {
        const isPdf = d.file_name.toLowerCase().endsWith('.pdf');
        const card = document.createElement('div');
        card.className = 'bg-slate-850 rounded-2xl border border-slate-800 p-4 space-y-3 hover:border-purple-500/50 transition-all shadow-xl flex flex-col justify-between';
        card.innerHTML = `
            <div class="space-y-2">
                <div class="w-12 h-12 rounded-xl ${isPdf ? 'bg-rose-500/20 text-rose-400' : 'bg-purple-500/20 text-purple-400'} flex items-center justify-center">
                    <i data-lucide="${isPdf ? 'file-text' : 'image'}" class="w-6 h-6"></i>
                </div>
                <h4 class="font-bold text-sm text-white line-clamp-2">${d.title}</h4>
                <div class="text-[11px] text-slate-400 space-y-0.5">
                    <p class="text-purple-400 font-semibold">${typeof tr === 'function' ? tr(d.category) : d.category}</p>
                    <p>${isEn ? 'Project:' : 'المشروع:'} <span class="text-slate-300">${d.project_name}</span></p>
                    <p>${isEn ? 'Uploaded by:' : 'رفع بواسطة:'} <span class="text-slate-300">${d.uploaded_by || (isEn ? 'Site Engineer' : 'المهندس')}</span></p>
                </div>
            </div>
            <div class="pt-3 border-t border-slate-750 flex items-center justify-between">
                <button onclick="viewInvoice('${d.file_path}', '${d.title}')" class="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-xs font-bold flex items-center gap-1 transition">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>${isEn ? 'Preview & Download' : 'معاينة وتحميل'}</span>
                </button>
                <button onclick="deleteDocument(${d.id})" class="text-slate-500 hover:text-rose-400 p-1">
                    <i data-lucide="trash" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    initLucide();
}

async function deleteDocument(docId) {
    if (confirm("هل تريد حذف هذا المستند نهائياً؟")) {
        await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
        showToast('تم حذف المستند');
        loadDocuments();
    }
}

// ----------------- FORM SUBMISSIONS -----------------

// 1. Submit Expense with Invoice File Upload (FormData)
async function submitExpenseForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-expense');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span> جاري الحفظ والرفع...`;

    try {
        const formMode = document.getElementById('expense-form-mode')?.value || 'general';
        const isGeneralMode = formMode === 'general';

        let selectedCategory = document.getElementById('expense-category')?.value || 'رواتب وأجور';
        const customInput = document.getElementById('expense-custom-category-input');
        const customBox = document.getElementById('expense-custom-category-box');
        const customVal = customInput ? customInput.value.trim() : '';

        if (selectedCategory === '__custom__') {
            if (!customVal) {
                showToast('يرجى كتابة مسمى بند المصروف المخصص أو اختيار تصنيف من القائمة', 'warning');
                btn.disabled = false;
                const isEditing = Boolean(document.getElementById('expense-edit-id')?.value);
                btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${isEditing ? 'تحديث وحفظ التعديلات' : 'حفظ المصروف والفاتورة'}</span>`;
                if (typeof initLucide === 'function') initLucide();
                return;
            }
            selectedCategory = customVal;
            saveCustomExpenseCategory(customVal);
        } else if (customVal && customBox && !customBox.classList.contains('hidden')) {
            selectedCategory = customVal;
            saveCustomExpenseCategory(customVal);
        }

        const isTax = document.getElementById('tax-choice-yes')?.checked;
        let totalAmt = parseFloat(document.getElementById('expense-amount').value) || 0;
        let amtNoTax = parseFloat(document.getElementById('expense-amount-without-tax')?.value) || 0;
        let taxAmt = parseFloat(document.getElementById('expense-tax-amount')?.value) || 0;

        if (isTax) {
            if (amtNoTax > 0 && totalAmt === 0) {
                taxAmt = Math.round(amtNoTax * 0.15 * 100) / 100;
                totalAmt = Math.round((amtNoTax + taxAmt) * 100) / 100;
                document.getElementById('expense-amount').value = totalAmt.toFixed(2);
            } else if (totalAmt > 0 && amtNoTax === 0) {
                amtNoTax = Math.round((totalAmt / 1.15) * 100) / 100;
                taxAmt = Math.round((totalAmt - amtNoTax) * 100) / 100;
            }
        } else {
            amtNoTax = totalAmt;
            taxAmt = 0;
        }

        const formData = new FormData();
        formData.append('project_id', document.getElementById('expense-project-id').value);
        formData.append('phase_id', document.getElementById('expense-phase-id')?.value || '');
        formData.append('item_id', document.getElementById('expense-item-id')?.value || '');
        formData.append('title', document.getElementById('expense-title').value);
        formData.append('amount', document.getElementById('expense-amount').value);
        formData.append('is_tax_invoice', isTax ? '1' : '0');
        formData.append('tax_rate', '0.15');
        formData.append('amount_without_tax', amtNoTax.toString());
        formData.append('tax_amount', taxAmt.toString());
        formData.append('category', selectedCategory);
        const payMethod = document.getElementById('expense-payment-method')?.value || 'تحويل بنكي';
        const custodyId = (payMethod === 'عهدة') ? (document.getElementById('expense-custody-id')?.value || '') : '';
        if (payMethod === 'عهدة' && !custodyId) {
            showToast('يرجى اختيار العهدة الجارية المطلوب الخصم منها', 'warning');
            btn.disabled = false;
            const isEditing = Boolean(document.getElementById('expense-edit-id')?.value);
            btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${isEditing ? 'تحديث وحفظ التعديلات' : 'حفظ المصروف والفاتورة'}</span>`;
            if (typeof initLucide === 'function') initLucide();
            return;
        }
        formData.append('custody_id', custodyId);
        formData.append('payment_method', payMethod);
        formData.append('paid_by', document.getElementById('expense-paid-by').value);
        formData.append('paid_to', document.getElementById('expense-paid-to').value);
        formData.append('expense_date', document.getElementById('expense-date').value);
        formData.append('payment_date', document.getElementById('expense-payment-date')?.value || '');
        formData.append('notes', document.getElementById('expense-notes').value);
        formData.append('payment_status', document.getElementById('expense-payment-status')?.value || 'paid');
        formData.append('paid_amount', document.getElementById('expense-paid-amount')?.value || '');

        const currAuthUser = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
        formData.append('user_id', currAuthUser.id || '');
        formData.append('user_role', currAuthUser.role || '');
        formData.append('user_name', currAuthUser.name || '');
        formData.append('created_by', currAuthUser.name ? `${currAuthUser.name} (${currAuthUser.role || 'فريق العمل'})` : (document.getElementById('expense-paid-by')?.value || 'مسؤول'));

        if (isGeneralMode) {
            // General expense without supplier
            formData.append('supplier_id', '');
            formData.append('quotation_id', '');
            formData.append('quotation_item_id', '');
            formData.append('item_quantity', '1');
            formData.append('unit_price', '0');
            formData.append('quoted_unit_price', '0');
        } else {
            // Supplier & Quotation & Variance Tracking Fields
            formData.append('supplier_id', document.getElementById('expense-supplier-id')?.value || '');
            formData.append('quotation_id', document.getElementById('expense-quotation-id')?.value || '');
            formData.append('quotation_item_id', document.getElementById('expense-quotation-item-id')?.value || '');
            formData.append('item_quantity', document.getElementById('expense-item-quantity')?.value || '1');
            formData.append('unit_price', document.getElementById('expense-unit-price')?.value || '0');
            formData.append('quoted_unit_price', document.getElementById('expense-quoted-unit-price')?.value || '0');

            // Multi-Line Items (جدول بنود الفاتورة المتعددة)
            if (typeof currentExpenseItems !== 'undefined' && Array.isArray(currentExpenseItems)) {
                const validItems = currentExpenseItems.map(r => ({
                    quotation_item_id: r.quotation_item_id ? parseInt(r.quotation_item_id) : null,
                    item_name: (r.item_name || '').trim(),
                    unit: (r.unit || 'طن').trim(),
                    quantity: parseFloat(r.quantity) || 1,
                    unit_price: parseFloat(r.unit_price) || 0,
                    quoted_unit_price: parseFloat(r.quoted_unit_price) || 0,
                    notes: r.notes || ''
                })).filter(r => r.item_name.length > 0 || r.unit_price > 0 || r.quotation_item_id);

                if (validItems.length > 0) {
                    formData.append('items', JSON.stringify(validItems));
                }
            }
        }

        const fileInput = document.getElementById('expense-file-input');
        if (fileInput.files.length > 0) {
            formData.append('invoice_file', fileInput.files[0]);
        }

        const editId = document.getElementById('expense-edit-id')?.value;
        const removeFile = document.getElementById('expense-remove-file')?.value || '0';
        formData.append('remove_file', removeFile);

        const url = editId ? `/api/expenses/${editId}` : '/api/expenses';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            if (data.approval_status === 'pending') {
                showToast('تم تسجيل الفاتورة بنجاح وهي بانتظار تعميد المدير المالي ولن تُخصم إلا بعد التعميد', 'info');
            } else if (data.has_price_increase) {
                showToast(`⚠️ تنبيه: تم رصد زيادة بسعر الفاتورة عن عرض السعر بمقدار +${formatCurrency(data.total_variance)} ر.س!`, 'warning');
            } else {
                showToast(editId ? 'تم تحديث بيانات المصروف والفاتورة بنجاح!' : 'تم تسجيل المصروف وتعميده بنجاح!');
            }
            closeModal('expense-modal');
            resetExpenseModal();
            loadDashboard();
            if (currentTab === 'expenses') loadExpenses();
            if (currentTab === 'suppliers' && typeof loadSuppliersData === 'function') loadSuppliersData();
            if (currentTab === 'cashflow' && typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
            if (typeof currentSelectedSupplierDetailId !== 'undefined' && currentSelectedSupplierDetailId) openSupplierDetailModal(currentSelectedSupplierDetailId);
            if (typeof currentViewedCustodyId !== 'undefined' && currentViewedCustodyId) {
                const cModal = document.getElementById('custody-expenses-modal');
                if (cModal && !cModal.classList.contains('hidden')) {
                    viewCustodyExpenses(currentViewedCustodyId);
                }
            }
            if (typeof loadCustody === 'function') loadCustody();
        } else {
            showToast(data.error || 'حدث خطأ أثناء الحفظ', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    } finally {
        btn.disabled = false;
        const isEditing = Boolean(document.getElementById('expense-edit-id')?.value);
        btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>${isEditing ? 'تحديث وحفظ التعديلات' : 'حفظ المصروف والفاتورة'}</span>`;
        initLucide();
    }
}

function resetExpenseModal() {
    const editIdEl = document.getElementById('expense-edit-id');
    if (editIdEl) editIdEl.value = '';
    const remFileEl = document.getElementById('expense-remove-file');
    if (remFileEl) remFileEl.value = '0';
    const titleEl = document.getElementById('expense-modal-title');
    if (titleEl) titleEl.innerText = 'تسجيل مصروف جديد وإرفاق الفاتورة';
    const btnTextEl = document.getElementById('expense-btn-submit-text');
    if (btnTextEl) btnTextEl.innerText = 'حفظ المصروف والفاتورة';
    const existBox = document.getElementById('expense-existing-file-container');
    if (existBox) existBox.classList.add('hidden');
    const form = document.getElementById('expense-form');
    if (form) form.reset();
    const todayStr = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('expense-date');
    if (dateEl) dateEl.value = todayStr;
    const payDateEl = document.getElementById('expense-payment-date');
    if (payDateEl) payDateEl.value = todayStr;

    // Reset mode to general (رواتب وتشغيل ومصروف عام) by default
    setExpenseFormMode('general');

    // Default to non-tax for general expenses (salaries, petty cash, etc.)
    const taxNo = document.getElementById('tax-choice-no');
    if (taxNo) {
        taxNo.checked = true;
        onExpenseTaxTypeChanged();
    }

    // Reset custom category input and sync dropdowns
    cancelCustomExpenseCategory();
    syncCustomExpenseCategoryOptions('رواتب وأجور');

    if (typeof resetExpenseTaxFields === 'function') resetExpenseTaxFields();
    if (typeof resetExpenseSupplierFields === 'function') resetExpenseSupplierFields();
    if (typeof clearInvoiceFile === 'function') clearInvoiceFile();

    const pStatEl = document.getElementById('expense-payment-status');
    if (pStatEl) pStatEl.value = 'paid';
    const pAmtCont = document.getElementById('expense-paid-amount-container');
    if (pAmtCont) pAmtCont.classList.add('hidden');
    const pAmtEl = document.getElementById('expense-paid-amount');
    if (pAmtEl) pAmtEl.value = '';

    // Reset custody selector and containers
    const cCont = document.getElementById('expense-custody-select-container');
    if (cCont) cCont.classList.add('hidden');
    const cSelect = document.getElementById('expense-custody-id');
    if (cSelect) cSelect.value = '';
    const cBadge = document.getElementById('expense-custody-balance-badge');
    if (cBadge) cBadge.classList.add('hidden');
    const cWarn = document.getElementById('expense-custody-warning');
    if (cWarn) cWarn.classList.add('hidden');
    const cInfo = document.getElementById('expense-custody-info');
    if (cInfo) cInfo.classList.add('hidden');

    // Reset multi-items list
    if (typeof resetExpenseItemsState === 'function') {
        resetExpenseItemsState();
    }
}

function markRemoveInvoiceFile() {
    const remEl = document.getElementById('expense-remove-file');
    if (remEl) remEl.value = '1';
    const existBox = document.getElementById('expense-existing-file-container');
    if (existBox) existBox.classList.add('hidden');
    showToast('سيتم إزالة الفاتورة المرفقة عند حفظ التعديلات', 'info');
}

async function openEditExpenseModal(expenseId) {
    try {
        const res = await fetch(`/api/expenses/${expenseId}`);
        const data = await res.json();
        if (!data.success || !data.expense) {
            showToast('تعذر العثور على بيانات المصروف', 'error');
            return;
        }
        const exp = data.expense;

        resetExpenseModal();

        document.getElementById('expense-edit-id').value = exp.id;
        document.getElementById('expense-remove-file').value = '0';

        const titleEl = document.getElementById('expense-modal-title');
        if (titleEl) titleEl.innerText = `تعديل بيانات المصروف / الفاتورة #${exp.id}`;
        const btnTextEl = document.getElementById('expense-btn-submit-text');
        if (btnTextEl) btnTextEl.innerText = 'تحديث وحفظ التعديلات';

        const projSelect = document.getElementById('expense-project-id');
        if (projSelect) projSelect.value = exp.project_id || '';

        await loadPhasesForExpenseModal(exp.project_id, exp.phase_id);
        if (exp.phase_id) {
            await loadItemsForExpenseModal(exp.phase_id, exp.item_id);
        }

        if (exp.supplier_id) {
            setExpenseFormMode('supplier');
        } else {
            setExpenseFormMode('general');
        }

        if (document.getElementById('expense-title')) document.getElementById('expense-title').value = exp.title || '';
        syncCustomExpenseCategoryOptions(exp.category || 'رواتب وأجور');
        if (exp.custody_id || exp.payment_method === 'عهدة') {
            if (document.getElementById('expense-payment-method')) document.getElementById('expense-payment-method').value = 'عهدة';
            await onExpensePaymentMethodChanged(exp.custody_id);
        } else {
            if (document.getElementById('expense-payment-method')) document.getElementById('expense-payment-method').value = exp.payment_method || 'تحويل بنكي';
            await onExpensePaymentMethodChanged();
        }
        if (document.getElementById('expense-paid-by')) document.getElementById('expense-paid-by').value = exp.paid_by || '';
        if (document.getElementById('expense-paid-to')) document.getElementById('expense-paid-to').value = exp.paid_to || '';
        if (document.getElementById('expense-date')) document.getElementById('expense-date').value = exp.expense_date || '';
        if (document.getElementById('expense-payment-date')) {
            document.getElementById('expense-payment-date').value = exp.payment_date || (exp.payment_status === 'paid' ? exp.expense_date : '');
        }

        const editPStatEl = document.getElementById('expense-payment-status');
        if (editPStatEl) {
            editPStatEl.value = exp.payment_status || 'paid';
            if (typeof onExpensePaymentStatusChanged === 'function') onExpensePaymentStatusChanged();
        }
        const editPAmtEl = document.getElementById('expense-paid-amount');
        if (editPAmtEl) editPAmtEl.value = exp.paid_amount != null ? exp.paid_amount : '';
        if (document.getElementById('expense-notes')) document.getElementById('expense-notes').value = exp.notes || '';

        const isTax = exp.is_tax_invoice === 1 || (exp.tax_amount && exp.tax_amount > 0);
        if (isTax) {
            const taxYes = document.getElementById('tax-choice-yes');
            if (taxYes) {
                taxYes.checked = true;
                onExpenseTaxTypeChanged();
            }
            if (document.getElementById('expense-amount-without-tax')) {
                document.getElementById('expense-amount-without-tax').value = exp.amount_without_tax != null ? exp.amount_without_tax : '';
            }
            if (document.getElementById('expense-tax-amount')) {
                document.getElementById('expense-tax-amount').value = exp.tax_amount != null ? exp.tax_amount : '';
            }
            if (document.getElementById('expense-amount')) {
                document.getElementById('expense-amount').value = exp.amount != null ? exp.amount : '';
            }
        } else {
            const taxNo = document.getElementById('tax-choice-no');
            if (taxNo) {
                taxNo.checked = true;
                onExpenseTaxTypeChanged();
            }
            if (document.getElementById('expense-amount-nontax')) {
                document.getElementById('expense-amount-nontax').value = exp.amount != null ? exp.amount : '';
            }
            if (document.getElementById('expense-amount')) {
                document.getElementById('expense-amount').value = exp.amount != null ? exp.amount : '';
            }
        }

        if (typeof loadSuppliersDropdownForExpenseModal === 'function') {
            await loadSuppliersDropdownForExpenseModal(exp.supplier_id);
        }

        if (exp.supplier_id) {
            const supSel = document.getElementById('expense-supplier-id');
            if (supSel) {
                supSel.value = exp.supplier_id;
                await onExpenseSupplierChanged(exp.supplier_id);
                if (exp.quotation_id) {
                    const qSel = document.getElementById('expense-quotation-id');
                    if (qSel) {
                        qSel.value = exp.quotation_id;
                        await onExpenseQuotationChanged(exp.quotation_id);
                        if (exp.quotation_item_id) {
                            const qiSel = document.getElementById('expense-quotation-item-id');
                            if (qiSel) {
                                qiSel.value = exp.quotation_item_id;
                                onExpenseQuotationItemChanged(exp.quotation_item_id);
                            }
                        }
                    }
                }
            }
        }

        if (document.getElementById('expense-item-quantity')) {
            document.getElementById('expense-item-quantity').value = exp.item_quantity || 1;
        }
        if (document.getElementById('expense-unit-price')) {
            document.getElementById('expense-unit-price').value = exp.unit_price != null ? exp.unit_price : '';
        }
        if (document.getElementById('expense-quoted-unit-price')) {
            document.getElementById('expense-quoted-unit-price').value = exp.quoted_unit_price != null ? exp.quoted_unit_price : '';
        }

        // Populate multi-line items table
        if (exp.items && Array.isArray(exp.items) && exp.items.length > 0) {
            currentExpenseItems = exp.items.map((it, idx) => ({
                id: 'exp_row_' + it.id + '_' + idx,
                quotation_item_id: it.quotation_item_id || null,
                item_name: it.item_name || '',
                unit: it.unit || 'طن',
                quantity: it.quantity != null ? it.quantity : 1,
                unit_price: it.unit_price != null ? it.unit_price : 0,
                quoted_unit_price: it.quoted_unit_price != null ? it.quoted_unit_price : 0,
                notes: it.notes || ''
            }));
        } else {
            currentExpenseItems = [{
                id: 'exp_row_' + Date.now(),
                quotation_item_id: exp.quotation_item_id || null,
                item_name: exp.title || '',
                unit: 'طن',
                quantity: exp.item_quantity || 1,
                unit_price: exp.unit_price || (exp.amount_without_tax || exp.amount || 0),
                quoted_unit_price: exp.quoted_unit_price || 0,
                notes: exp.notes || ''
            }];
        }
        if (typeof renderExpenseItemsTable === 'function') renderExpenseItemsTable();
        if (typeof recalculateExpenseItemsTotals === 'function') recalculateExpenseItemsTotals();

        const existingContainer = document.getElementById('expense-existing-file-container');
        const existingLink = document.getElementById('expense-existing-file-link');
        if (exp.invoice_file_path) {
            if (existingContainer && existingLink) {
                existingContainer.classList.remove('hidden');
                existingLink.href = `/static/${exp.invoice_file_path}`;
                existingLink.innerText = exp.invoice_file_path.split('/').pop();
            }
        } else {
            if (existingContainer) existingContainer.classList.add('hidden');
        }

        openModal('expense-modal');
        initLucide();
    } catch (err) {
        console.error('Error opening edit expense modal:', err);
        showToast('تعذر فتح نموذج تعديل المصروف', 'error');
    }
}

// ----------------- EXPENSE PROJECT TRANSFER -----------------
let currentTransferExpenseData = null;

async function openTransferExpenseModal(expenseId) {
    try {
        const res = await fetch(`/api/expenses/${expenseId}`);
        const data = await res.json();
        if (!data.success || !data.expense) {
            showToast('تعذر العثور على بيانات المصروف', 'error');
            return;
        }

        const exp = data.expense;
        currentTransferExpenseData = exp;

        document.getElementById('transfer-exp-id').value = exp.id;
        document.getElementById('transfer-exp-title').innerText = exp.title || `مصروف #${exp.id}`;
        document.getElementById('transfer-exp-amount').innerText = formatCurrency(exp.amount);
        document.getElementById('transfer-exp-current-project').innerText = exp.project_name ? `${exp.project_name} (${exp.project_code || '#' + exp.project_id})` : `مشروع #${exp.project_id}`;
        document.getElementById('transfer-exp-notes').value = '';

        // Populate and select projects
        const sel = document.getElementById('transfer-exp-new-project-id');
        if (sel) {
            sel.innerHTML = '<option value="">-- اختر المشروع الجديد المحول إليه --</option>';
            const projs = (allProjectsList && allProjectsList.length > 0) ? allProjectsList : await (await fetch('/api/projects')).json();
            projs.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.innerText = `${p.name} (${p.code || '#' + p.id})`;
                if (p.id == exp.project_id) {
                    opt.disabled = true;
                    opt.innerText += ' [المشروع الحالي]';
                }
                sel.appendChild(opt);
            });
        }

        // Reset phases & items dropdown
        const phaseSel = document.getElementById('transfer-exp-phase-id');
        if (phaseSel) phaseSel.innerHTML = '<option value="">-- عام للمشروع (بدون مرحلة) --</option>';
        const itemSel = document.getElementById('transfer-exp-item-id');
        if (itemSel) itemSel.innerHTML = '<option value="">-- عام للمرحلة --</option>';

        openModal('transfer-expense-modal');
        initLucide();
    } catch (err) {
        console.error('Error opening transfer expense modal:', err);
        showToast('حدث خطأ أثناء فتح نافذة نقل المصروف', 'error');
    }
}

async function loadPhasesForTransferModal(projectId, selectedPhaseId = null) {
    const phaseSel = document.getElementById('transfer-exp-phase-id');
    const itemSel = document.getElementById('transfer-exp-item-id');
    if (!phaseSel) return;
    phaseSel.innerHTML = '<option value="">-- عام للمشروع (بدون مرحلة) --</option>';
    if (itemSel) itemSel.innerHTML = '<option value="">-- عام للمرحلة --</option>';
    if (!projectId) return;

    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
        if (p.phases && p.phases.length > 0) {
            p.phases.forEach(ph => {
                const opt = document.createElement('option');
                opt.value = ph.id;
                opt.innerText = `مرحلة ${ph.order_num}: ${ph.name}`;
                if (selectedPhaseId && selectedPhaseId == ph.id) opt.selected = true;
                phaseSel.appendChild(opt);
            });
            if (selectedPhaseId) {
                loadItemsForTransferModal(selectedPhaseId);
            }
        }
    } catch (err) {
        console.error('Error loading phases for transfer modal:', err);
    }
}

async function loadItemsForTransferModal(phaseId, selectedItemId = null) {
    const itemSel = document.getElementById('transfer-exp-item-id');
    if (!itemSel) return;
    itemSel.innerHTML = '<option value="">-- عام للمرحلة --</option>';
    if (!phaseId) return;

    const projectId = document.getElementById('transfer-exp-new-project-id')?.value;
    if (!projectId) return;

    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
        const ph = (p.phases || []).find(x => x.id == phaseId);
        if (ph && ph.items && ph.items.length > 0) {
            ph.items.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.id;
                opt.innerText = `${it.item_code ? it.item_code + ' - ' : ''}${it.title}`;
                if (selectedItemId && selectedItemId == it.id) opt.selected = true;
                itemSel.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error loading items for transfer modal:', err);
    }
}

async function submitTransferExpenseForm(e) {
    e.preventDefault();
    const expenseId = document.getElementById('transfer-exp-id').value;
    const newProjectId = document.getElementById('transfer-exp-new-project-id').value;
    const phaseId = document.getElementById('transfer-exp-phase-id').value;
    const itemId = document.getElementById('transfer-exp-item-id').value;
    const notes = document.getElementById('transfer-exp-notes').value.trim();

    if (!newProjectId) {
        showToast('يرجى تحديد المشروع الجديد المحول إليه', 'warning');
        return;
    }

    const btn = document.getElementById('btn-submit-transfer-expense');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">⌛</span> جاري نقل المصروف...`;

    try {
        const res = await fetch(`/api/expenses/${expenseId}/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                new_project_id: newProjectId,
                phase_id: phaseId || null,
                item_id: itemId || null,
                notes: notes
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'تم نقل المصروف بنجاح!');
            closeModal('transfer-expense-modal');
            loadDashboard();
            if (currentTab === 'expenses') loadExpenses();
            if (currentTab === 'subcontractors' && typeof loadSubcontractors === 'function') loadSubcontractors();
            if (currentTab === 'suppliers' && typeof loadSuppliersData === 'function') loadSuppliersData();
            if (currentTab === 'cashflow' && typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData) {
                openProjectDetails(currentProjectDetailData.id);
            }
        } else {
            showToast(data.error || 'فشل في نقل المصروف', 'error');
        }
    } catch (err) {
        console.error('Error transferring expense:', err);
        showToast('تعذر الاتصال بالخادم لنقل المصروف', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="arrow-right-left" class="w-4 h-4"></i><span>تأكيد نقل المصروف للمشروع الجديد</span>`;
        initLucide();
    }
}

// 2. Submit Task Form
async function submitTaskForm(e) {
    e.preventDefault();
    const taskId = document.getElementById('task-edit-id').value;
    const payload = {
        project_id: document.getElementById('task-project-id').value,
        title: document.getElementById('task-title').value,
        assigned_to: document.getElementById('task-assigned-to').value,
        created_by: document.getElementById('task-created-by')?.value || (currentUser ? currentUser.name : 'ابوالنصر البغدادي'),
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value,
        progress_percent: parseInt(document.getElementById('task-progress').value || 0),
        start_date: document.getElementById('task-start-date').value,
        due_date: document.getElementById('task-due-date').value,
        phase_id: document.getElementById('task-phase-id')?.value || null,
        cost_price: parseFloat(document.getElementById('task-cost-price')?.value || 0),
        selling_price: parseFloat(document.getElementById('task-selling-price')?.value || 0),
        description: document.getElementById('task-description').value
    };

    const method = taskId ? 'PUT' : 'POST';
    const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';

    const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
        showToast('تم حفظ المهمة بنجاح');
        closeModal('task-modal');
        document.getElementById('task-form').reset();
        loadDashboard();
        if (currentTab === 'tasks') loadTasks();
        if (currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
    }
}

// 3. Project Modal & Submission (إضافة وتعديل المشاريع)
function resetProjectModal() {
    const editIdInput = document.getElementById('project-edit-id');
    if (editIdInput) editIdInput.value = '';

    const titleEl = document.getElementById('project-modal-title');
    if (titleEl) titleEl.innerText = 'إضافة مشروع جديد للشركة';

    const submitBtn = document.getElementById('project-modal-submit-text');
    if (submitBtn) submitBtn.innerText = 'إنشاء المشروع';

    const form = document.getElementById('project-form');
    if (form) form.reset();

    const statusEl = document.getElementById('project-status');
    if (statusEl) statusEl.value = 'in_progress';

    const progEl = document.getElementById('project-progress');
    if (progEl) progEl.value = '0';

    const pmodeBoq = document.getElementById('pmode-boq');
    if (pmodeBoq) pmodeBoq.checked = true;
    const pmodeMan = document.getElementById('pmode-manual');
    if (pmodeMan) pmodeMan.checked = false;
    const manRemInput = document.getElementById('project-manual-remaining');
    if (manRemInput) manRemInput.value = '';
    toggleProjectModalManualInput();
}

function openProjectModal() {
    resetProjectModal();
    openModal('project-modal');
    initLucide();
}

async function openEditProjectModal(projectId) {
    resetProjectModal();
    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
        if (!p || p.error) {
            showToast(p?.error || 'تعذر تحميل بيانات المشروع', 'error');
            return;
        }

        const editIdInput = document.getElementById('project-edit-id');
        if (editIdInput) editIdInput.value = p.id;

        const titleEl = document.getElementById('project-modal-title');
        if (titleEl) titleEl.innerText = `تعديل بيانات المشروع: ${p.name}`;

        const submitBtn = document.getElementById('project-modal-submit-text');
        if (submitBtn) submitBtn.innerText = 'حفظ التعديلات';

        document.getElementById('project-name').value = p.name || '';
        const codeInput = document.getElementById('project-code');
        if (codeInput) codeInput.value = p.code || '';
        document.getElementById('project-client').value = p.client_name || '';
        document.getElementById('project-location').value = p.location || '';
        document.getElementById('project-contract-value').value = p.contract_value || 0;
        document.getElementById('project-manager').value = p.manager_name || '';
        
        const statusEl = document.getElementById('project-status');
        if (statusEl) statusEl.value = p.status || 'in_progress';

        const progEl = document.getElementById('project-progress');
        if (progEl) progEl.value = p.progress_percent !== undefined ? p.progress_percent : 0;

        document.getElementById('project-start-date').value = p.start_date || '';
        document.getElementById('project-end-date').value = p.end_date || '';
        document.getElementById('project-notes').value = p.notes || '';

        if (p.budget_mode === 'manual') {
            const pmodeMan = document.getElementById('pmode-manual');
            if (pmodeMan) pmodeMan.checked = true;
        } else {
            const pmodeBoq = document.getElementById('pmode-boq');
            if (pmodeBoq) pmodeBoq.checked = true;
        }
        const manRemInput = document.getElementById('project-manual-remaining');
        if (manRemInput) {
            manRemInput.value = (p.manual_remaining_budget !== null && p.manual_remaining_budget !== undefined) ? p.manual_remaining_budget : '';
        }
        toggleProjectModalManualInput();

        openModal('project-modal');
        initLucide();
    } catch (err) {
        console.error('Error opening edit project modal:', err);
        showToast('فشل في جلب بيانات المشروع', 'error');
    }
}

function editProjectFromDetail() {
    if (typeof currentProjectIdForModal !== 'undefined' && currentProjectIdForModal) {
        openEditProjectModal(currentProjectIdForModal);
    } else if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData && currentProjectDetailData.id) {
        openEditProjectModal(currentProjectDetailData.id);
    }
}

async function submitProjectForm(e) {
    e.preventDefault();
    const editId = document.getElementById('project-edit-id')?.value;
    const nameVal = document.getElementById('project-name').value.trim();
    if (!nameVal) {
        showToast('يرجى إدخال اسم المشروع', 'warning');
        return;
    }

    const budgetMode = document.querySelector('input[name="project_modal_budget_mode"]:checked')?.value || 'boq';
    const manualRem = document.getElementById('project-manual-remaining')?.value;

    const payload = {
        name: nameVal,
        code: document.getElementById('project-code')?.value.trim() || undefined,
        client_name: document.getElementById('project-client').value.trim(),
        location: document.getElementById('project-location').value.trim(),
        contract_value: parseFloat(document.getElementById('project-contract-value').value || 0),
        manager_name: document.getElementById('project-manager').value.trim(),
        status: document.getElementById('project-status')?.value || 'in_progress',
        progress_percent: parseInt(document.getElementById('project-progress')?.value || 0),
        start_date: document.getElementById('project-start-date').value,
        end_date: document.getElementById('project-end-date').value,
        notes: document.getElementById('project-notes').value.trim(),
        budget_mode: budgetMode,
        manual_remaining_budget: (budgetMode === 'manual' && manualRem !== '') ? parseFloat(manualRem) : null
    };

    const url = editId ? `/api/projects/${editId}` : '/api/projects';
    const method = editId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success || data.id) {
            showToast(editId ? 'تم تحديث بيانات المشروع بنجاح!' : 'تم إنشاء المشروع بنجاح!');
            closeModal('project-modal');
            resetProjectModal();
            await loadProjectsDropdowns();
            loadDashboard();
            if (typeof loadProjects === 'function') loadProjects();
            if (editId && typeof currentProjectIdForModal !== 'undefined' && String(currentProjectIdForModal) === String(editId)) {
                openProjectDetails(editId);
            }
        } else {
            showToast(data.error || 'حدث خطأ أثناء حفظ المشروع', 'error');
        }
    } catch (err) {
        console.error('Error submitting project form:', err);
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

// 4. Submit Subcontractor Form
async function submitSubcontractorForm(e) {
    e.preventDefault();
    const editId = document.getElementById('sub-edit-id')?.value;

    const tradeSelect = document.getElementById('sub-trade');
    let trade = tradeSelect ? tradeSelect.value : 'حدادة مسلحة';
    const customTradeInput = document.getElementById('subcontractor-custom-trade');
    const customBox = document.getElementById('subcontractor-custom-trade-box');

    if (trade === '__custom__' || (customBox && !customBox.classList.contains('hidden'))) {
        const customVal = customTradeInput ? customTradeInput.value.trim() : '';
        if (!customVal) {
            showToast('يرجى كتابة اسم التخصص / المهنة الجديدة أو اختيار مهنة من القائمة', 'warning');
            if (customTradeInput) customTradeInput.focus();
            return;
        }
        trade = customVal;
        saveCustomSubcontractorTrade(trade);
    }

    const payload = {
        name: document.getElementById('sub-name').value.trim(),
        trade: trade,
        phone: document.getElementById('sub-phone').value.trim(),
        project_id: document.getElementById('sub-project-id').value || null,
        agreed_amount: parseFloat(document.getElementById('sub-agreed-amount').value || 0),
        notes: document.getElementById('sub-notes').value.trim()
    };

    const url = editId ? `/api/subcontractors/${editId}` : '/api/subcontractors';
    const method = editId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success || data.id) {
            showToast(editId ? 'تم تحديث بيانات المقاول والتصنيف بنجاح' : 'تم تسجيل المقاول والتصنيف بنجاح');
            closeModal('subcontractor-modal');
            resetSubcontractorModal();
            refreshSubcontractorTradeDropdowns();
            loadSubcontractors();
        } else {
            showToast(data.error || 'حدث خطأ أثناء حفظ بيانات المقاول', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم لحفظ المقاول', 'error');
    }
}

// 5. Submit Subcontractor Payment Form
async function submitSubPaymentForm(e) {
    e.preventDefault();
    const subId = document.getElementById('sub-pay-id').value;
    const projectId = document.getElementById('sub-pay-project-id')?.value;
    const amount = parseFloat(document.getElementById('sub-pay-amount')?.value || 0);

    if (!projectId) {
        showToast('يرجى اختيار المشروع المخصص له الصرف', 'warning');
        return;
    }
    if (amount <= 0) {
        showToast('يرجى كتابة مبلغ صحيح للصرف', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('amount', amount);
    formData.append('payment_method', document.getElementById('sub-pay-method')?.value || 'نقدي');
    formData.append('payment_type', document.getElementById('sub-pay-type')?.value || 'دفعة أعمال');
    formData.append('payment_date', document.getElementById('sub-pay-date')?.value || new Date().toISOString().split('T')[0]);
    formData.append('notes', document.getElementById('sub-pay-notes')?.value || '');

    const fileInput = document.getElementById('sub-pay-receipt-file');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('receipt_file', fileInput.files[0]);
    }

    try {
        const res = await fetch(`/api/subcontractors/${subId}/payments`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم قيد المصروف في حساب المقاول وترحيله لمصاريف المشروع بنجاح');
            closeModal('sub-payment-modal');
            document.getElementById('sub-payment-form').reset();
            loadSubcontractors();
            loadDashboard();
            if (typeof loadExpenses === 'function') loadExpenses();
        } else {
            showToast(data.error || 'حدث خطأ أثناء صرف المصروف', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('فشل في الاتصال بالخادم لحفظ المصروف', 'error');
    }
}

// 6. Submit Document Upload Form
async function submitDocumentForm(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('project_id', document.getElementById('doc-project-id').value);
    formData.append('title', document.getElementById('doc-title').value);
    formData.append('category', document.getElementById('doc-category').value);
    
    const fileInput = document.getElementById('doc-file-input');
    if (fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
    }

    const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
    });
    const data = await res.json();
    if (data.success) {
        showToast('تم رفع المخطط/المستند بنجاح');
        closeModal('document-modal');
        document.getElementById('document-form').reset();
        loadDocuments();
    }
}

// ----------------- INVOICE / RECEIPT FILE PREVIEW -----------------
function previewInvoiceFile(e) {
    const file = e.target.files[0];
    if (file) {
        selectedInvoiceFile = file;
        const container = document.getElementById('invoice-preview-container');
        const nameEl = document.getElementById('invoice-preview-name');
        nameEl.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        container.classList.remove('hidden');
    }
}

function clearInvoiceFile() {
    selectedInvoiceFile = null;
    document.getElementById('expense-file-input').value = '';
    document.getElementById('invoice-preview-container').classList.add('hidden');
}

function viewInvoice(filePath, title) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const iframe = document.getElementById('lightbox-iframe');
    const errBox = document.getElementById('lightbox-error');
    const titleEl = document.getElementById('lightbox-title');
    const downloadLink = document.getElementById('lightbox-download-link');

    titleEl.innerText = title || 'معاينة الفاتورة والمستند';
    downloadLink.href = filePath;

    if (errBox) errBox.classList.add('hidden');

    img.onerror = () => {
        img.classList.add('hidden');
        if (errBox) errBox.classList.remove('hidden');
        initLucide();
    };

    if (filePath.toLowerCase().endsWith('.pdf')) {
        img.classList.add('hidden');
        iframe.classList.remove('hidden');
        iframe.src = filePath;
    } else {
        iframe.classList.add('hidden');
        img.classList.remove('hidden');
        img.src = filePath;
    }

    modal.classList.remove('hidden');
    initLucide();
}

// ----------------- BUDGET MODE HELPERS (BOQ vs MANUAL) -----------------
function toggleManualBudgetInput() {
    const isManual = document.getElementById('choice-mode-manual')?.checked;
    const group = document.getElementById('manual-budget-input-group');
    if (group) group.classList.toggle('hidden', !isManual);
}

function toggleProjectModalManualInput() {
    const isManual = document.getElementById('pmode-manual')?.checked;
    const group = document.getElementById('project-modal-manual-group');
    if (group) group.classList.toggle('hidden', !isManual);
}

function openSetBudgetModeModal() {
    if (!currentProjectDetailData) return;
    const p = currentProjectDetailData;
    const idEl = document.getElementById('set-budget-mode-proj-id');
    if (idEl) idEl.value = p.id;
    const titleEl = document.getElementById('set-budget-mode-proj-title');
    if (titleEl) titleEl.innerText = `${p.code || 'PRJ'} - ${p.name}`;
    
    const isManual = p.budget_mode === 'manual';
    const manRadio = document.getElementById('choice-mode-manual');
    const boqRadio = document.getElementById('choice-mode-boq');
    const valInput = document.getElementById('manual-budget-input-val');
    
    if (isManual) {
        if (manRadio) manRadio.checked = true;
        if (valInput) valInput.value = (p.manual_remaining_budget !== null && p.manual_remaining_budget !== undefined) ? p.manual_remaining_budget : '';
    } else {
        if (boqRadio) boqRadio.checked = true;
        if (valInput) valInput.value = '';
    }
    toggleManualBudgetInput();
    openModal('set-budget-mode-modal');
}

async function saveProjectBudgetMode(e) {
    if (e && e.preventDefault) e.preventDefault();
    const pid = document.getElementById('set-budget-mode-proj-id')?.value;
    if (!pid) return;
    const mode = document.querySelector('input[name="proj_budget_mode_choice"]:checked')?.value || 'boq';
    const val = document.getElementById('manual-budget-input-val')?.value;
    const btn = document.getElementById('btn-save-proj-budget-mode');
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`/api/projects/${pid}/budget-mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                budget_mode: mode,
                manual_remaining_budget: (mode === 'manual' && val !== '') ? parseFloat(val) : null
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم حفظ وتحديث طريقة احتساب المتبقي بنجاح', 'success');
            closeModal('set-budget-mode-modal');
            await openProjectDetails(pid);
            if (typeof loadProjects === 'function') loadProjects();
            if (typeof loadDashboard === 'function') loadDashboard();
            if (typeof loadCashFlow === 'function') loadCashFlow();
        } else {
            showToast(data.error || 'فشل التحديث', 'error');
        }
    } catch(err) {
        console.error('Error saving project budget mode:', err);
        showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ----------------- PROJECT DETAILS MODAL -----------------
async function openProjectDetails(projectId) {
    currentProjectIdForModal = projectId;
    try {
        const res = await fetch(`/api/projects/${projectId}?_t=${Date.now()}`);
        if (!res.ok) {
            showToast('تعذر تحميل بيانات المشروع من السيرفر', 'error');
            return;
        }
        const p = await res.json();
        if (p.error) {
            showToast(p.error, 'error');
            return;
        }
        currentProjectDetailData = p;

        document.getElementById('detail-proj-code').innerText = p.code || 'PRJ';
        document.getElementById('detail-proj-name').innerText = p.name;
        document.getElementById('detail-proj-client-loc').innerText = `العميل: ${p.client_name} • الموقع: ${p.location} • مدير المشروع: ${p.manager_name || 'م. أحمد السجيني'}`;

        document.getElementById('detail-contract-val').innerText = formatCurrency(p.contract_value);
        document.getElementById('detail-spent-val').innerText = formatCurrency(p.total_spent);
        if (document.getElementById('detail-tax-refundable-val')) {
            document.getElementById('detail-tax-refundable-val').innerText = formatCurrency(p.total_tax_refundable || 0);
        }
        document.getElementById('detail-remaining-val').innerText = formatCurrency(p.remaining_budget);
        
        const modeBadge = document.getElementById('detail-budget-mode-badge');
        const modeSubtext = document.getElementById('detail-budget-mode-subtext');
        if (modeBadge) {
            if (p.budget_mode === 'manual') {
                modeBadge.innerText = 'محدد يدوياً';
                modeBadge.className = 'text-amber-400 font-bold';
            } else {
                modeBadge.innerText = 'تلقائي BOQ';
                modeBadge.className = 'text-emerald-400 font-bold';
            }
        }
        if (modeSubtext) {
            if (p.budget_mode === 'manual') {
                modeSubtext.innerText = `ميزانية مصروفات يدوية: ${formatCurrency(p.manual_remaining_budget || 0)}`;
            } else {
                modeSubtext.innerText = 'حساب تلقائي من بنود الـ BOQ';
            }
        }

        document.getElementById('detail-progress-val').innerText = `${p.progress_percent}%`;

        // Counts
        document.getElementById('dtab-count-phases').innerText = (p.phases || []).length;
        if (document.getElementById('dtab-count-payments')) {
            document.getElementById('dtab-count-payments').innerText = (p.client_payments || []).length;
        }
        document.getElementById('dtab-count-expenses').innerText = (p.expenses || []).length;
        document.getElementById('dtab-count-tasks').innerText = (p.tasks || []).length;
        document.getElementById('dtab-count-subs').innerText = (p.subcontractors || []).length;
        document.getElementById('dtab-count-docs').innerText = (p.documents || []).length;

        // 1. Render Project Phases (WBS & Costs & Selling & Weights)
        renderProjectPhasesTab(p);

        // 1.5 Render Client Payments & Milestones
        renderProjectPaymentsTab(p);

        // 2. Render project expenses
        const expTbody = document.getElementById('detail-expenses-tbody');
        expTbody.innerHTML = '';
        const isFinManager = isFinancialManagerUser();
        if ((p.expenses || []).length === 0) {
            expTbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500">لا توجد مصاريف مسجلة لهذا المشروع بعد</td></tr>`;
        } else {
            p.expenses.forEach(e => {
                const isApproved = (e.approval_status || 'approved') === 'approved';
                const isPending = e.approval_status === 'pending';
                const isRejected = e.approval_status === 'rejected';

                const isTaxInv = e.is_tax_invoice === 1 || e.tax_amount > 0;
                const taxBadge = isTaxInv ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <i data-lucide="shield-check" class="w-3 h-3"></i>
                        <span>ضريبية 15%</span>
                    </span>
                    <div class="text-[10px] text-emerald-400 font-bold mt-0.5">مسترد: ${formatCurrency(e.tax_amount || 0)}</div>
                ` : `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">بدون ضريبة</span>`;

                let appBadge = '';
                if (isPending) {
                    appBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse"><i data-lucide="clock" class="w-3 h-3"></i><span>بانتظار التعميد</span></span>`;
                } else if (isRejected) {
                    appBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30" title="${escapeHtml(e.approval_notes || '')}"><i data-lucide="x-circle" class="w-3 h-3"></i><span>مرفوضة</span></span>`;
                } else {
                    appBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title="${escapeHtml(e.approved_by || 'معمد')}"><i data-lucide="shield-check" class="w-3 h-3"></i><span>معمدة ✓</span></span>`;
                }

                let appActions = '';
                if (isFinManager && isPending) {
                    appActions = `
                        <button onclick="approveExpense(${e.id})" title="تعميد الفاتورة والخصم من الحسابات" class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] inline-flex items-center gap-1 transition">
                            <i data-lucide="shield-check" class="w-3 h-3"></i>
                            <span>تعميد</span>
                        </button>
                        <button onclick="rejectExpense(${e.id})" title="رفض الفاتورة" class="p-1 text-rose-400 hover:text-white rounded hover:bg-rose-600/30 transition">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    `;
                }

                const noTax = (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount;

                const tr = document.createElement('tr');
                tr.className = isPending ? 'bg-amber-500/5' : '';
                tr.innerHTML = `
                    <td class="p-2.5 text-slate-400 whitespace-nowrap">${e.expense_date}</td>
                    <td class="p-2.5 font-bold text-white">
                        ${e.title}
                        ${e.phase_name ? `<div class="text-[10px] text-emerald-400/80 font-normal mt-0.5">${e.phase_name}${e.item_title ? ` • ${e.item_title}` : ''}</div>` : ''}
                    </td>
                    <td class="p-2.5 text-slate-300">${e.category}</td>
                    <td class="p-2.5 text-center whitespace-nowrap">${taxBadge}</td>
                    <td class="p-2.5 font-bold text-blue-400 text-xs whitespace-nowrap">${formatCurrency(noTax)}</td>
                    <td class="p-2.5 font-black text-rose-400 text-sm whitespace-nowrap">${formatCurrency(e.amount)}</td>
                    <td class="p-2.5 text-slate-300">${e.paid_to || '-'}</td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                        ${e.invoice_file_path ? `
                            <button onclick="viewInvoice('${e.invoice_file_path}', '${e.title}')" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold hover:underline">فاتورة</button>
                        ` : '<span class="text-slate-600">-</span>'}
                    </td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                        ${appBadge}
                    </td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                            ${appActions}
                            <button onclick="openTransferExpenseModal(${e.id})" title="نقل المصروف لمشروع آخر" class="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition">
                                <i data-lucide="arrow-right-left" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="openEditExpenseModal(${e.id})" title="تعديل المصروف" class="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteExpense(${e.id})" title="حذف المصروف" class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </td>
                `;
                expTbody.appendChild(tr);
            });
        }

        // 3. Render project tasks
        const tasksCont = document.getElementById('detail-tasks-container');
        tasksCont.innerHTML = '';
        if ((p.tasks || []).length === 0) {
            tasksCont.innerHTML = '<p class="text-slate-500 text-xs py-4 text-center">لا توجد مهام مسندة بعد لهذا المشروع</p>';
        } else {
            p.tasks.forEach(t => {
                const isCreator = (currentUser && currentUser.name === t.created_by);
                const isAssignee = (currentUser && currentUser.name === t.assigned_to);
                const isGeneralManager = (currentUser && (currentUser.name === 'نواف سجيني' || currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
                const canApprove = isCreator || (isGeneralManager && !isAssignee);
                const isPending = t.status === 'pending_approval';
                const isDone = t.status === 'done';

                const statusBadge = isDone 
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">معمدة ومكتملة ✓</span>`
                    : isPending
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span><span>في انتظار التعميد</span></span>`
                    : t.status === 'in_progress'
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">جاري التنفيذ</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-750 text-slate-400">قيد الانتظار</span>`;

                const item = document.createElement('div');
                item.className = `flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl ${isPending ? 'bg-purple-950/20 border-purple-500/30' : 'bg-slate-800 border-slate-750'} border text-xs gap-2`;
                item.innerHTML = `
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full shrink-0 ${isDone ? 'bg-emerald-400' : isPending ? 'bg-purple-400' : 'bg-amber-400'}"></span>
                            <strong class="text-white text-xs">${t.title}</strong>
                            ${t.phase_name ? `<span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">${t.phase_name}</span>` : ''}
                        </div>
                        <div class="text-[11px] text-slate-400 flex items-center gap-3">
                            <span>المرسل: <strong class="text-emerald-300">${t.created_by || 'الإدارة'}</strong></span>
                            <span>المنفذ: <strong class="text-amber-300">${t.assigned_to}</strong></span>
                            ${t.approved_by ? `<span class="text-emerald-400">معتمد من: ${t.approved_by}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <span class="text-slate-400 font-mono text-[11px]">ت: <strong class="text-rose-400">${formatCurrency(t.cost_price || 0)}</strong></span>
                        <span class="text-slate-400 font-mono text-[11px]">ب: <strong class="text-emerald-400">${formatCurrency(t.selling_price || 0)}</strong></span>
                        <span class="font-bold ${isDone ? 'text-emerald-400' : isPending ? 'text-purple-400' : 'text-amber-400'}">${t.progress_percent}%</span>
                        ${statusBadge}
                        ${isPending && canApprove ? `
                            <button onclick="approveTask(${t.id})" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition">
                                تعميد ✓
                            </button>
                        ` : ''}
                    </div>
                `;
                tasksCont.appendChild(item);
            });
        }

        // 4. Render project docs
        const docsCont = document.getElementById('detail-docs-container');
        docsCont.innerHTML = '';
        if ((p.documents || []).length === 0) {
            docsCont.innerHTML = '<p class="text-slate-500 text-xs py-4 text-center col-span-2">لا توجد مخططات مرفوعة</p>';
        } else {
            p.documents.forEach(d => {
                const card = document.createElement('div');
                card.className = 'p-3 rounded-xl bg-slate-800 border border-slate-750 flex items-center justify-between text-xs';
                card.innerHTML = `
                    <div class="truncate">
                        <strong class="text-white block truncate">${d.title}</strong>
                        <span class="text-[11px] text-purple-400">${d.category}</span>
                    </div>
                    <button onclick="viewInvoice('${d.file_path}', '${d.title}')" class="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 hover:text-white font-bold text-[11px]">معاينة</button>
                `;
                docsCont.appendChild(card);
            });
        }

        switchDetailTab('phases');
        openModal('project-detail-modal');
        initLucide();
    } catch (err) {
        console.error('Error opening project details:', err);
        showToast('حدث خطأ أثناء عرض تفاصيل المشروع', 'error');
    }
}

// Render Phases Tab
function renderProjectPhasesTab(p) {
    const phasesCont = document.getElementById('detail-phases-container');
    if (!phasesCont) return;
    phasesCont.innerHTML = '';

    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    // Summary Cards
    const totalSelling = (p.contract_value && parseFloat(p.contract_value) > 0) ? parseFloat(p.contract_value) : (parseFloat(p.total_phases_selling) || 0);
    const totalCost = parseFloat(p.total_phases_cost) || parseFloat(p.total_estimated_budget) || 0;
    const totalProfit = totalSelling - totalCost;
    const profitMargin = totalSelling > 0 ? ((totalProfit / totalSelling) * 100).toFixed(1) : 0;
    const sumWeights = (p.phases || []).reduce((acc, ph) => acc + (parseFloat(ph.weight_percent) || 0), 0);

    document.getElementById('detail-phases-selling').innerText = formatCurrency(totalSelling);
    document.getElementById('detail-phases-cost').innerText = formatCurrency(totalCost);
    const profitEl = document.getElementById('detail-phases-profit');
    if (profitEl) {
        profitEl.innerText = `${formatCurrency(totalProfit)} (${profitMargin}%)`;
        profitEl.className = totalProfit >= 0 ? 'text-sm font-black text-emerald-400' : 'text-sm font-black text-rose-400';
    }
    document.getElementById('detail-phases-weights').innerText = `${sumWeights.toFixed(1)}%`;

    if ((p.phases || []).length === 0) {
        phasesCont.innerHTML = `
            <div class="p-8 rounded-2xl bg-slate-800/60 border border-slate-750 text-center space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20 shadow-lg">
                    <i data-lucide="layers" class="w-7 h-7"></i>
                </div>
                <div>
                    <h4 class="font-bold text-white text-base">${isEn ? 'No phases registered for this project yet' : 'لا توجد مراحل مسجلة لهذا المشروع بعد'}</h4>
                    <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        ${isEn ? 'Break down the project into phases (like MOM 6 phases), specify weights (%), costs, selling prices, and work items to track progress and profits.' : 'يمكنك تقسيم المشروع إلى مراحله التنفيذية (مثل مراحل MOM الـ 6)، وتحديد وزن كل مرحلة (%)، وإضافة بنود الأعمال لكل مرحلة لمتابعة الإنجاز والأرباح بدقة.'}
                    </p>
                </div>
                <button onclick="openAddPhaseModal()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2 transition shadow-lg">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>${isEn ? '+ Add First Project Phase' : '+ إضافة أول مرحلة للمشروع'}</span>
                </button>
            </div>
        `;
        initLucide();
        return;
    }

    p.phases.forEach(ph => {
        const items = ph.items || [];
        const doneItemsCount = items.filter(it => it.status === 'done' || it.progress_percent >= 100).length;
        const totalItemsCount = items.length;
        const isPhaseCompleted = ph.status === 'completed' || (totalItemsCount > 0 && doneItemsCount === totalItemsCount);
        const isPhaseOver = ph.is_over_budget;

        const card = document.createElement('div');
        card.className = `rounded-2xl bg-slate-800/90 border ${ph.is_over_budget ? 'border-rose-500/40 shadow-rose-950/20' : (isPhaseCompleted ? 'border-emerald-500/40 shadow-emerald-950/20' : 'border-slate-750')} p-4 sm:p-5 space-y-4 shadow-md transition`;

        let itemsHtml = '';
        if (items.length === 0) {
            itemsHtml = `
                <div class="p-4 text-center text-slate-400 text-xs bg-slate-850/60 rounded-xl border border-slate-750/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <i data-lucide="alert-circle" class="w-4 h-4 text-amber-400"></i>
                        <span>${isEn ? 'No work items added to this phase yet. Add items to track costs and progress.' : 'لا توجد بنود أعمال مسجلة لهذه المرحلة حتى الآن. أضف بنود المقايسة لتحديد التكلفة ونسبة الإنجاز.'}</span>
                    </div>
                    <button onclick="openAddItemModal(${ph.id}, ${p.id})" class="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold transition flex items-center gap-1.5 shrink-0 text-xs">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span>${isEn ? '+ Add Item to Phase' : '+ إضافة بند أعمال للمرحلة'}</span>
                    </button>
                </div>
            `;
        } else {
            let itemRows = items.map((it, idx) => {
                const isItemDone = it.status === 'done' || it.progress_percent >= 100;
                const isItemOver = it.is_over_budget;
                const isLoss = it.is_loss;
                
                return `
                    <tr class="hover:bg-slate-750/50 transition border-b border-slate-800/60 ${isItemOver ? 'bg-rose-950/15' : (isItemDone ? 'bg-emerald-950/10' : '')}">
                        <td class="p-3">
                            <div class="flex items-center gap-2">
                                <span class="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-750 shrink-0 font-bold">
                                    ${it.item_code || `${ph.order_num}.${idx + 1}`}
                                </span>
                                <div>
                                    <span class="font-bold text-white text-xs block ${isItemDone ? 'line-through text-slate-400' : ''}">${it.title}</span>
                                    <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                        <span>${it.quantity || 1} ${it.unit || 'مقطوعية'}</span>
                                        ${it.unit_cost ? `<span>• تكلفة الوحدة: <strong class="text-rose-300 font-mono">${formatCurrency(it.unit_cost)}</strong></span>` : ''}
                                    </div>
                                    ${it.notes ? `<span class="text-[10px] text-slate-500 block mt-0.5">${it.notes}</span>` : ''}
                                </div>
                            </div>
                        </td>
                        <td class="p-3 text-slate-300 whitespace-nowrap text-xs">
                            <span class="px-2 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-800 text-[11px] font-semibold">${it.assigned_to || '-'}</span>
                        </td>
                        <td class="p-3 font-bold text-rose-300 whitespace-nowrap text-xs font-mono" title="الميزانية التقديرية المحطوطة">
                            ${formatCurrency(it.cost_price || 0)}
                        </td>
                        <td class="p-3 font-bold text-rose-400 whitespace-nowrap text-xs font-mono" title="المصروف الفعلي">
                            ${formatCurrency(it.actual_spent || 0)}
                        </td>
                        <td class="p-3 text-center whitespace-nowrap">
                            ${isItemOver ? `
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 justify-center">
                                    <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                                    <span>تجاوز (+${formatCurrency(it.over_amount)})</span>
                                </span>
                            ` : (it.actual_spent > 0 ? `
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 justify-center">
                                    <i data-lucide="check" class="w-3 h-3"></i>
                                    <span>وفر (${formatCurrency(it.savings_amount)})</span>
                                </span>
                            ` : `
                                <span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500 border border-slate-750">لم يُصرف</span>
                            `)}
                        </td>
                        <td class="p-3 font-bold text-emerald-400 whitespace-nowrap text-xs font-mono" title="سعر البيع للعميل">
                            ${formatCurrency(it.selling_price || 0)}
                        </td>
                        <td class="p-3 whitespace-nowrap text-xs">
                            <span class="font-bold ${isLoss ? 'text-rose-400' : 'text-emerald-400'} font-mono block">
                                ${isLoss ? 'خسارة ' : 'ربح +'}${formatCurrency(it.actual_profit)}
                            </span>
                            <span class="text-[10px] text-slate-400 block font-sans">${it.profit_percent}%</span>
                        </td>
                        <td class="p-3 whitespace-nowrap">
                            <div class="flex items-center gap-2">
                                <div class="w-14 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-750">
                                    <div class="${isItemDone ? 'bg-emerald-500' : 'bg-amber-500'} h-full rounded-full transition-all" style="width: ${it.progress_percent}%"></div>
                                </div>
                                <span class="text-xs font-bold ${isItemDone ? 'text-emerald-400' : 'text-amber-400'}">${it.progress_percent}%</span>
                            </div>
                        </td>
                        <td class="p-3 text-center whitespace-nowrap">
                            <button onclick="toggleItemDone(${it.id}, '${it.status}')" class="px-2.5 py-1 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1 shadow-sm ${isItemDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}" title="${isItemDone ? (isEn ? 'Click to mark uncompleted' : 'انقر لإلغاء الإتمام') : (isEn ? 'Click to complete 100%' : 'انقر لإتمام البند 100%')}">
                                <i data-lucide="${isItemDone ? 'check-check' : 'check'}" class="w-3.5 h-3.5"></i>
                                <span>${isItemDone ? (isEn ? 'Completed' : 'مكتمل ✔') : (isEn ? 'Done' : 'إتمام')}</span>
                            </button>
                        </td>
                        <td class="p-3 text-left whitespace-nowrap">
                            <div class="flex items-center gap-1 justify-end">
                                <button onclick="openAddExpenseForItem(${it.id}, ${ph.id}, ${p.id})" class="p-1.5 rounded-lg bg-slate-900 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 transition" title="${isEn ? 'Add Expense/Invoice for this item' : 'تسجيل فاتورة/مصروف لهذا البند مباشرة'}">
                                    <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-emerald-400"></i>
                                </button>
                                <button onclick="openEditItemModal(${it.id}, ${ph.id})" class="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-750 text-slate-300 hover:text-white transition" title="${isEn ? 'Edit Item' : 'تعديل البند'}">
                                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                </button>
                                <button onclick="deleteItem(${it.id})" class="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="${isEn ? 'Delete Item' : 'حذف البند'}">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            itemsHtml = `
                <div class="overflow-x-auto rounded-xl border border-slate-750/80 bg-slate-850/70">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-800 text-slate-400 border-b border-slate-750 text-[10px]">
                            <tr>
                                <th class="p-2.5">${isEn ? 'Item Code & Description' : 'كود وبيان بند الأعمال'}</th>
                                <th class="p-2.5">${isEn ? 'Assigned' : 'المسؤول'}</th>
                                <th class="p-2.5">${isEn ? 'Est. Budget (SAR)' : 'الميزانية التقديرية'}</th>
                                <th class="p-2.5">${isEn ? 'Actual Spent' : 'المنصرف الفعلي'}</th>
                                <th class="p-2.5 text-center">${isEn ? 'Budget Status' : 'موقف الميزانية'}</th>
                                <th class="p-2.5">${isEn ? 'Selling (SAR)' : 'سعر البيع'}</th>
                                <th class="p-2.5">${isEn ? 'P&L' : 'صافي الربح / الخسارة'}</th>
                                <th class="p-2.5">${isEn ? 'Progress' : 'نسبة الإنجاز'}</th>
                                <th class="p-2.5 text-center">${isEn ? 'Complete' : 'الإتمام'}</th>
                                <th class="p-2.5 text-left">${isEn ? 'Actions' : 'إجراءات'}</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800/80">
                            ${itemRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        card.innerHTML = `
            <!-- Phase Header -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-750">
                <div class="flex items-center gap-3">
                    <span class="w-9 h-9 rounded-xl ${isPhaseCompleted ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'} font-black text-sm flex items-center justify-center border shrink-0">
                        ${ph.order_num}
                    </span>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="text-sm font-black text-white">${ph.name}</h5>
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isPhaseCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
                                ${isPhaseCompleted ? (isEn ? 'Phase Completed ✔' : 'مرحلة مكتملة بالكامل ✔') : (isEn ? 'In Progress' : 'قيد التنفيذ')}
                            </span>
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isPhaseOver ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                                ${isPhaseOver ? `🚨 تجاوز الميزانية بمقدار +${formatCurrency(ph.over_amount)}` : (ph.actual_spent > 0 ? `✅ ضمن الميزانية (وفر ${formatCurrency(ph.savings_amount)})` : 'ضمن الميزانية')}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[11px] font-bold border border-amber-500/20">
                                ${isEn ? 'Phase Weight:' : 'وزن المرحلة:'} ${ph.weight_percent}% ${isEn ? 'of Project' : 'من المشروع'}
                            </span>
                            <span class="text-slate-400 text-[11px]">
                                (${doneItemsCount} / ${totalItemsCount} ${isEn ? 'items completed' : 'بنود منجزة'})
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Financial Highlights -->
                <div class="flex items-center gap-2 text-xs flex-wrap">
                    <div class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-750">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Est. Budget:' : 'الميزانية التقديرية:'}</span>
                        <strong class="text-rose-300 font-bold font-mono text-xs">${formatCurrency(ph.effective_cost)}</strong>
                    </div>
                    <div class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-750">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Actual Spent:' : 'المنصرف الفعلي:'}</span>
                        <strong class="text-rose-400 font-black font-mono text-xs">${formatCurrency(ph.actual_spent)}</strong>
                    </div>
                    <div class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-750">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Selling:' : 'سعر البيع للعميل:'}</span>
                        <strong class="text-emerald-400 font-bold font-mono text-xs">${formatCurrency(ph.effective_selling)}</strong>
                    </div>
                    <div class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-750">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Profit / Loss:' : 'صافي الربح / الخسارة:'}</span>
                        <strong class="${ph.is_loss ? 'text-rose-400' : 'text-emerald-400'} font-bold font-mono text-xs">
                            ${ph.is_loss ? 'خسارة ' : 'ربح +'}${formatCurrency(ph.actual_profit)} 
                            <span class="text-[10px] text-slate-400 font-sans font-normal">(${ph.actual_profit_percent}%)</span>
                        </strong>
                    </div>
                </div>
            </div>

            <!-- Progress Bar & Actions Bar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-850/80 p-3 rounded-xl border border-slate-750/70">
                <div class="flex items-center gap-3 flex-1">
                    <span class="text-xs font-bold text-slate-300 whitespace-nowrap">${isEn ? 'Phase Progress:' : 'نسبة إنجاز المرحلة:'}</span>
                    <div class="flex-1 bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-750 relative">
                        <div class="${isPhaseCompleted ? 'bg-emerald-500' : 'bg-emerald-600'} h-full rounded-full transition-all duration-500" style="width: ${ph.progress_percent}%"></div>
                    </div>
                    <span class="text-xs font-black text-emerald-400 min-w-[40px] text-left">${ph.progress_percent}%</span>
                </div>
                <div class="flex items-center gap-2 shrink-0 justify-end">
                    <button onclick="openAddItemModal(${ph.id}, ${p.id})" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span>${isEn ? '+ Add Item' : '+ إضافة بند أعمال للمرحلة'}</span>
                    </button>
                    <button onclick="openEditPhaseModal(${ph.id})" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="${isEn ? 'Edit Phase' : 'تعديل المرحلة'}">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deletePhase(${ph.id})" class="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="${isEn ? 'Delete Phase' : 'حذف المرحلة'}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Items Table -->
            ${itemsHtml}
        `;

        phasesCont.appendChild(card);
    });

    initLucide();
}

// ----------------- PHASE HANDLERS -----------------
function openAddPhaseModal() {
    if (!currentProjectDetailData) return;
    document.getElementById('phase-id').value = '';
    document.getElementById('phase-project-id').value = currentProjectDetailData.id;
    document.getElementById('phase-modal-title').innerText = 'إضافة مرحلة جديدة للمشروع';
    document.getElementById('phase-name').value = '';
    const nextOrder = (currentProjectDetailData.phases || []).length + 1;
    document.getElementById('phase-order').value = nextOrder;
    document.getElementById('phase-weight').value = '';
    document.getElementById('phase-cost').value = '';
    document.getElementById('phase-selling').value = '';
    document.getElementById('phase-progress').value = 0;
    document.getElementById('phase-progress-val').innerText = '0%';
    document.getElementById('phase-notes').value = '';
    openModal('phase-modal');
}

function openEditPhaseModal(phaseId) {
    if (!currentProjectDetailData || !currentProjectDetailData.phases) return;
    const ph = currentProjectDetailData.phases.find(x => x.id === phaseId);
    if (!ph) return;

    document.getElementById('phase-id').value = ph.id;
    document.getElementById('phase-project-id').value = currentProjectDetailData.id;
    document.getElementById('phase-modal-title').innerText = 'تعديل بيانات المرحلة';
    document.getElementById('phase-name').value = ph.name;
    document.getElementById('phase-order').value = ph.order_num;
    document.getElementById('phase-weight').value = ph.weight_percent;
    document.getElementById('phase-cost').value = ph.cost_price || '';
    document.getElementById('phase-selling').value = ph.selling_price || '';
    document.getElementById('phase-progress').value = ph.progress_percent;
    document.getElementById('phase-progress-val').innerText = `${ph.progress_percent}%`;
    document.getElementById('phase-notes').value = ph.notes || '';
    openModal('phase-modal');
}

async function submitPhaseForm(e) {
    e.preventDefault();
    const phaseId = document.getElementById('phase-id').value;
    const projectId = document.getElementById('phase-project-id').value;
    const payload = {
        project_id: projectId,
        name: document.getElementById('phase-name').value,
        order_num: parseInt(document.getElementById('phase-order').value || 1),
        weight_percent: parseFloat(document.getElementById('phase-weight').value || 0),
        cost_price: parseFloat(document.getElementById('phase-cost').value || 0),
        selling_price: parseFloat(document.getElementById('phase-selling').value || 0),
        progress_percent: parseFloat(document.getElementById('phase-progress').value || 0),
        notes: document.getElementById('phase-notes').value
    };

    const method = phaseId ? 'PUT' : 'POST';
    const url = phaseId ? `/api/phases/${phaseId}` : '/api/phases';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم حفظ المرحلة وتحديث نسب المشروع بنجاح');
            closeModal('phase-modal');
            openProjectDetails(projectId);
            loadDashboard();
            if (currentTab === 'projects') loadProjects();
        } else {
            showToast(data.error || 'حدث خطأ أثناء حفظ المرحلة', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

async function deletePhase(phaseId) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه المرحلة؟ لن يتم حذف التاسكات التابعة لها بل ستفصل عنها.')) return;
    try {
        const res = await fetch(`/api/phases/${phaseId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف المرحلة');
            if (currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
        } else {
            showToast(data.error || 'فشل حذف المرحلة', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

async function updatePhaseProgressQuick(phaseId, newProgress) {
    try {
        const res = await fetch(`/api/phases/${phaseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress_percent: parseFloat(newProgress) })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`تم تحديث إنجاز المرحلة إلى ${newProgress}%`);
            if (currentProjectDetailData) {
                const projRes = await fetch(`/api/projects/${currentProjectDetailData.id}`);
                const updatedProj = await projRes.json();
                currentProjectDetailData = updatedProj;
                document.getElementById('detail-progress-val').innerText = `${updatedProj.progress_percent}%`;
                loadDashboard();
                if (currentTab === 'projects') loadProjects();
            }
        }
    } catch (err) {
        console.error('Error updating phase progress:', err);
    }
}

// ----------------- ITEM HANDLERS (BENOUD) -----------------
function openAddItemModal(phaseId, projectId) {
    if (!currentProjectDetailData) return;
    document.getElementById('item-id').value = '';
    document.getElementById('item-phase-id').value = phaseId;
    document.getElementById('item-project-id').value = projectId || currentProjectDetailData.id;
    document.getElementById('item-modal-title').innerText = typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Add Work Item to Phase' : 'إضافة بند عمل للمرحلة';
    document.getElementById('item-title').value = '';
    
    // Auto suggest item code
    const ph = (currentProjectDetailData.phases || []).find(x => x.id === phaseId);
    const nextItemNum = (ph && ph.items ? ph.items.length : 0) + 1;
    document.getElementById('item-code').value = ph ? `${ph.order_num}.${nextItemNum}` : '';

    if (document.getElementById('item-quantity')) document.getElementById('item-quantity').value = 1;
    if (document.getElementById('item-unit')) document.getElementById('item-unit').value = 'مقطوعية';
    if (document.getElementById('item-unit-cost')) document.getElementById('item-unit-cost').value = '';
    document.getElementById('item-cost').value = '';
    if (document.getElementById('item-unit-selling')) document.getElementById('item-unit-selling').value = '';
    document.getElementById('item-selling').value = '';
    document.getElementById('item-status').value = 'todo';
    document.getElementById('item-progress').value = 0;
    document.getElementById('item-progress-val').innerText = '0%';
    document.getElementById('item-notes').value = '';

    calcItemTotals();
    openModal('item-modal');
}

function openEditItemModal(itemId, phaseId) {
    if (!currentProjectDetailData || !currentProjectDetailData.phases) return;
    let foundItem = null;
    let foundPhase = null;
    for (const ph of currentProjectDetailData.phases) {
        if (ph.items) {
            const it = ph.items.find(x => x.id === itemId);
            if (it) {
                foundItem = it;
                foundPhase = ph;
                break;
            }
        }
    }
    if (!foundItem) return;

    document.getElementById('item-id').value = foundItem.id;
    document.getElementById('item-phase-id').value = foundItem.phase_id;
    document.getElementById('item-project-id').value = foundItem.project_id || currentProjectDetailData.id;
    document.getElementById('item-modal-title').innerText = typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Edit Work Item' : 'تعديل بند العمل';
    document.getElementById('item-title').value = foundItem.title;
    document.getElementById('item-code').value = foundItem.item_code || '';
    if (document.getElementById('item-quantity')) document.getElementById('item-quantity').value = foundItem.quantity || 1;
    if (document.getElementById('item-unit')) document.getElementById('item-unit').value = foundItem.unit || 'مقطوعية';
    
    const qty = foundItem.quantity || 1;
    if (document.getElementById('item-unit-cost')) {
        document.getElementById('item-unit-cost').value = foundItem.unit_cost || (foundItem.cost_price ? (foundItem.cost_price / qty).toFixed(2) : '');
    }
    document.getElementById('item-cost').value = foundItem.cost_price || '';
    if (document.getElementById('item-unit-selling')) {
        document.getElementById('item-unit-selling').value = foundItem.unit_selling || (foundItem.selling_price ? (foundItem.selling_price / qty).toFixed(2) : '');
    }
    document.getElementById('item-selling').value = foundItem.selling_price || '';

    if (document.getElementById('item-assigned-to')) {
        document.getElementById('item-assigned-to').value = foundItem.assigned_to || '';
    }
    document.getElementById('item-status').value = foundItem.status || 'todo';
    document.getElementById('item-progress').value = foundItem.progress_percent || 0;
    document.getElementById('item-progress-val').innerText = `${foundItem.progress_percent || 0}%`;
    document.getElementById('item-notes').value = foundItem.notes || '';

    calcItemTotals();
    openModal('item-modal');
}

function calcItemTotals(source) {
    const qty = parseFloat(document.getElementById('item-quantity')?.value) || 1;
    let unitCost = parseFloat(document.getElementById('item-unit-cost')?.value) || 0;
    let totalCost = parseFloat(document.getElementById('item-cost')?.value) || 0;
    let unitSelling = parseFloat(document.getElementById('item-unit-selling')?.value) || 0;
    let totalSelling = parseFloat(document.getElementById('item-selling')?.value) || 0;

    if (source === 'unit_cost' || source === 'quantity') {
        if (unitCost > 0) {
            totalCost = qty * unitCost;
            const el = document.getElementById('item-cost');
            if (el) el.value = totalCost.toFixed(2);
        }
    } else if (source === 'cost_total') {
        if (qty > 0 && totalCost > 0) {
            unitCost = totalCost / qty;
            const el = document.getElementById('item-unit-cost');
            if (el) el.value = unitCost.toFixed(2);
        }
    }

    if (source === 'unit_selling' || source === 'quantity') {
        if (unitSelling > 0) {
            totalSelling = qty * unitSelling;
            const el = document.getElementById('item-selling');
            if (el) el.value = totalSelling.toFixed(2);
        }
    } else if (source === 'selling_total') {
        if (qty > 0 && totalSelling > 0) {
            unitSelling = totalSelling / qty;
            const el = document.getElementById('item-unit-selling');
            if (el) el.value = unitSelling.toFixed(2);
        }
    }

    totalCost = parseFloat(document.getElementById('item-cost')?.value) || 0;
    totalSelling = parseFloat(document.getElementById('item-selling')?.value) || 0;
    const profit = totalSelling - totalCost;
    const margin = totalSelling > 0 ? ((profit / totalSelling) * 100).toFixed(1) : 0;

    const profitEl = document.getElementById('item-calc-profit');
    const marginEl = document.getElementById('item-calc-margin');
    if (profitEl) {
        profitEl.innerText = formatCurrency(profit);
        profitEl.className = profit >= 0 ? 'text-emerald-400 font-bold font-mono' : 'text-rose-400 font-bold font-mono';
    }
    if (marginEl) {
        marginEl.innerText = `${margin}%`;
        marginEl.className = profit >= 0 ? 'text-blue-400 font-bold font-mono' : 'text-rose-400 font-bold font-mono';
    }
}

function handleItemStatusChange() {
    const status = document.getElementById('item-status').value;
    const progressInput = document.getElementById('item-progress');
    const progressVal = document.getElementById('item-progress-val');
    if (status === 'done') {
        progressInput.value = 100;
        progressVal.innerText = '100%';
    } else if (status === 'todo') {
        if (progressInput.value == 100) {
            progressInput.value = 0;
            progressVal.innerText = '0%';
        }
    }
}

async function submitItemForm(e) {
    e.preventDefault();
    const itemId = document.getElementById('item-id').value;
    const phaseId = document.getElementById('item-phase-id').value;
    const projectId = document.getElementById('item-project-id').value;
    const payload = {
        phase_id: parseInt(phaseId),
        project_id: parseInt(projectId),
        title: document.getElementById('item-title').value,
        item_code: document.getElementById('item-code').value,
        unit: document.getElementById('item-unit') ? document.getElementById('item-unit').value : 'مقطوعية',
        quantity: document.getElementById('item-quantity') ? parseFloat(document.getElementById('item-quantity').value || 1) : 1,
        unit_cost: document.getElementById('item-unit-cost') ? parseFloat(document.getElementById('item-unit-cost').value || 0) : 0,
        cost_price: parseFloat(document.getElementById('item-cost').value || 0),
        unit_selling: document.getElementById('item-unit-selling') ? parseFloat(document.getElementById('item-unit-selling').value || 0) : 0,
        selling_price: parseFloat(document.getElementById('item-selling').value || 0),
        assigned_to: document.getElementById('item-assigned-to') ? document.getElementById('item-assigned-to').value : '',
        status: document.getElementById('item-status').value,
        progress_percent: parseFloat(document.getElementById('item-progress').value || 0),
        notes: document.getElementById('item-notes').value
    };

    const method = itemId ? 'PUT' : 'POST';
    const url = itemId ? `/api/phase-items/${itemId}` : '/api/phase-items';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم حفظ بند العمل وتحديث إنجاز المرحلة بنجاح');
            closeModal('item-modal');
            openProjectDetails(projectId);
            loadDashboard();
            if (currentTab === 'projects') loadProjects();
        } else {
            showToast(data.error || 'حدث خطأ أثناء حفظ البند', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

// ----------------- EXPENSE PHASE & ITEM LINKING -----------------
async function loadPhasesForExpenseModal(projectId, selectedPhaseId = null) {
    const phaseSel = document.getElementById('expense-phase-id');
    const itemSel = document.getElementById('expense-item-id');
    if (!phaseSel) return;
    phaseSel.innerHTML = '<option value="">-- عام للمشروع (بدون مرحلة) --</option>';
    if (itemSel) itemSel.innerHTML = '<option value="">-- عام للمرحلة (بدون بند محدد) --</option>';
    if (!projectId) return;

    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
        if (p.phases && p.phases.length > 0) {
            p.phases.forEach(ph => {
                const opt = document.createElement('option');
                opt.value = ph.id;
                opt.innerText = `مرحلة ${ph.order_num}: ${ph.name}`;
                if (selectedPhaseId && selectedPhaseId == ph.id) opt.selected = true;
                phaseSel.appendChild(opt);
            });
            if (selectedPhaseId) {
                loadItemsForExpenseModal(selectedPhaseId);
            }
        }
    } catch (err) {
        console.error('Error loading phases for expense:', err);
    }
}

async function loadItemsForExpenseModal(phaseId, selectedItemId = null) {
    const itemSel = document.getElementById('expense-item-id');
    if (!itemSel) return;
    itemSel.innerHTML = '<option value="">-- عام للمرحلة (بدون بند محدد) --</option>';
    if (!phaseId) return;

    const projectId = document.getElementById('expense-project-id')?.value;
    if (!projectId) return;

    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
        const ph = (p.phases || []).find(x => x.id == phaseId);
        if (ph && ph.items && ph.items.length > 0) {
            ph.items.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.id;
                opt.innerText = `${it.item_code ? it.item_code + ' - ' : ''}${it.title} (ميزانية: ${formatCurrency(it.cost_price)})`;
                if (selectedItemId && selectedItemId == it.id) opt.selected = true;
                itemSel.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error loading items for expense:', err);
    }
}

function openAddExpenseForItem(itemId, phaseId, projectId) {
    document.getElementById('expense-form').reset();
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    const projEl = document.getElementById('expense-project-id');
    if (projEl) projEl.value = projectId;
    loadPhasesForExpenseModal(projectId, phaseId);
    setTimeout(() => {
        loadItemsForExpenseModal(phaseId, itemId);
    }, 250);
    openModal('expense-modal');
}

async function deleteItem(itemId) {
    if (!confirm('هل أنت متأكد من حذف هذا البند من المرحلة؟')) return;
    try {
        const res = await fetch(`/api/phase-items/${itemId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف البند وتحديث المرحلة');
            if (currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
            loadDashboard();
            if (currentTab === 'projects') loadProjects();
        } else {
            showToast(data.error || 'فشل حذف البند', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

async function toggleItemDone(itemId, currentStatus) {
    const isDone = currentStatus === 'done';
    const newStatus = isDone ? 'in_progress' : 'done';
    const newProgress = isDone ? 50 : 100;

    try {
        const res = await fetch(`/api/phase-items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: newStatus,
                progress_percent: newProgress
            })
        });
        const data = await res.json();
        if (data.success) {
            if (!isDone) {
                showToast('✔ تم إتمام البند بنجاح وتحديث إنجاز المرحلة والمشروع!');
            } else {
                showToast('تمت إعادة فتح البند');
            }
            if (currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
            loadDashboard();
            if (currentTab === 'projects') loadProjects();
        }
    } catch (err) {
        console.error('Error toggling item:', err);
    }
}

function openModalForPhaseTask(projectId, phaseId) {
    currentProjectIdForModal = projectId;
    const taskProjEl = document.getElementById('task-project-id');
    if (taskProjEl) taskProjEl.value = projectId;
    document.getElementById('task-edit-id').value = '';
    document.getElementById('task-form').reset();
    document.getElementById('task-modal-title').innerText = 'إسناد مهمة جديدة للمرحلة';
    document.getElementById('task-start-date').value = new Date().toISOString().split('T')[0];
    loadPhasesForTaskModal(projectId, phaseId);
    openModal('task-modal');
}

async function loadPhasesForTaskModal(projectId, selectedPhaseId = null) {
    const sel = document.getElementById('task-phase-id');
    if (!sel) return;
    sel.innerHTML = '<option value="">بدون مرحلة محددة</option>';
    if (!projectId) return;

    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
        if (p.phases && p.phases.length > 0) {
            p.phases.forEach(ph => {
                const opt = document.createElement('option');
                opt.value = ph.id;
                opt.innerText = `المرحلة ${ph.order_num}: ${ph.name}`;
                if (selectedPhaseId && parseInt(selectedPhaseId) === ph.id) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error loading phases for task modal:', err);
    }
}

// ----------------- CLIENT PAYMENTS & MILESTONES (دفعات واستحقاقات العميل) -----------------
function renderProjectPaymentsTab(p) {
    const tbody = document.getElementById('detail-payments-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    const sum = p.payment_summary || {};
    const payments = p.client_payments || [];

    // Summary Cards
    const totalWithTax = sum.total_milestones_with_tax || 0;
    const totalReceived = sum.total_received || 0;
    const totalPending = sum.total_pending || 0;
    const colRate = sum.collection_rate || 0;

    if (document.getElementById('detail-payments-total')) {
        document.getElementById('detail-payments-total').innerText = formatCurrency(totalWithTax);
    }
    if (document.getElementById('detail-payments-received')) {
        document.getElementById('detail-payments-received').innerText = formatCurrency(totalReceived);
    }
    if (document.getElementById('detail-payments-pending')) {
        document.getElementById('detail-payments-pending').innerText = formatCurrency(totalPending);
    }
    if (document.getElementById('detail-payments-rate')) {
        document.getElementById('detail-payments-rate').innerText = `${colRate}%`;
    }

    const extraBanner = document.getElementById('detail-payments-extra-banner');
    if (extraBanner) {
        if (sum.extra_works_total && sum.extra_works_total > 0) {
            extraBanner.classList.remove('hidden');
            if (document.getElementById('detail-payments-extra-total')) {
                document.getElementById('detail-payments-extra-total').innerText = formatCurrency(sum.extra_works_total);
            }
            if (document.getElementById('detail-payments-extra-received')) {
                document.getElementById('detail-payments-extra-received').innerText = formatCurrency(sum.extra_works_received || 0);
            }
            if (document.getElementById('detail-payments-extra-pending')) {
                document.getElementById('detail-payments-extra-pending').innerText = formatCurrency(sum.extra_works_pending || 0);
            }
        } else {
            extraBanner.classList.add('hidden');
        }
    }

    if (payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="p-8 text-center text-slate-500">
                    <p class="font-bold text-xs">${isEn ? 'No client payment milestones added yet' : 'لم يتم تسجيل دفعات أو استحقاقات لهذا المشروع بعد'}</p>
                    <button onclick="openAddClientPaymentModal()" class="mt-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1">
                        + ${isEn ? 'Add First Payment Milestone' : 'إضافة أول استحقاق دفعة للعميل'}
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    payments.forEach(cp => {
        const isExtra = cp.payment_type === 'extra_work';
        const isPaid = cp.is_received === 1 || cp.status === 'paid';
        const isPartiallyPaid = !isPaid && (cp.received_amount > 0 || cp.status === 'partially_paid');
        const tr = document.createElement('tr');
        tr.className = `hover:bg-slate-800/40 transition border-b border-slate-800/60 ${isExtra ? 'bg-purple-950/20' : ''}`;
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-400 text-center">${cp.payment_number || '-'}</td>
            <td class="p-3">
                <div class="flex items-center gap-1.5 mb-1">
                    ${isExtra ? `<span class="px-2 py-0.5 rounded text-[9.5px] font-black bg-purple-500/25 text-purple-300 border border-purple-500/40 inline-flex items-center gap-1">🏷️ أعمال إضافية / فروق أسعار خامات</span>` : `<span class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-slate-800 text-slate-400 border border-slate-700">📌 دفعة تعاقدية</span>`}
                </div>
                <strong class="text-white block text-xs font-bold">${escapeHtml(cp.milestone_name)}</strong>
                ${cp.notes ? `<span class="text-[10px] text-slate-400 block mt-0.5">${escapeHtml(cp.notes)}</span>` : ''}
                ${cp.receipt_voucher_no ? `<span class="text-[10px] text-emerald-400 font-mono block mt-0.5">سند: ${escapeHtml(cp.receipt_voucher_no)}</span>` : ''}
            </td>
            <td class="p-3 text-center font-bold text-amber-400 font-mono">${cp.percentage ? `${cp.percentage}%` : (isExtra ? 'فروق خامات' : '-')}</td>
            <td class="p-3 font-black text-emerald-400 font-mono">${formatCurrency(cp.amount_with_tax)}</td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">${formatCurrency(cp.tax_amount)}</td>
            <td class="p-3 text-blue-400 font-mono text-[11px] font-bold">${formatCurrency(cp.amount_without_tax)}</td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">${cp.due_date || '-'}</td>
            <td class="p-3 text-center">
                ${isPaid ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                        <i data-lucide="check-check" class="w-3 h-3"></i>
                        <span>${isExtra ? 'محصلة (أعمال إضافية)' : (isEn ? 'Collected' : 'تم التحصيل')} (${formatCurrency(cp.received_amount)})</span>
                    </span>
                    ${cp.received_date ? `<span class="block text-[9px] text-slate-500 font-mono mt-0.5">${cp.received_date}</span>` : ''}
                ` : isPartiallyPaid ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                        <i data-lucide="alert-circle" class="w-3 h-3"></i>
                        <span>${isExtra ? 'محصلة جزئياً (إضافي)' : (isEn ? 'Partial' : 'محصل جزئياً')} (${formatCurrency(cp.received_amount)})</span>
                    </span>
                ` : `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${isExtra ? 'bg-purple-900/40 text-purple-300 border border-purple-700/60' : 'bg-slate-800 text-slate-400 border border-slate-700'} font-bold text-[10px]">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        <span>${isExtra ? 'مستحقة (أعمال إضافية)' : (isEn ? 'Pending' : 'قيد الانتظار')}</span>
                    </span>
                `}
            </td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="openReceivePaymentModal(${cp.id})" class="p-1.5 rounded-lg ${isPaid ? 'bg-slate-800 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'} transition" title="${isEn ? 'Record Collection / Receipt' : 'تسجيل تحصيل / سند قبض'}">
                        <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="openEditClientPaymentModal(${cp.id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="${isEn ? 'Edit' : 'تعديل'}">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    ${cp.received_amount > 0 ? `
                    <button onclick="resetClientPaymentReceipt(${cp.id}, ${p.id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition" title="إلغاء وتصفير السداد">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    </button>
                    ` : ''}
                    <button onclick="deleteClientPayment(${cp.id}, ${p.id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="${isEn ? 'Delete' : 'حذف'}">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function calcPaymentFromPct() {
    if (!currentProjectDetailData) return;
    const contractVal = parseFloat(currentProjectDetailData.contract_value) || 0;
    const pct = parseFloat(document.getElementById('cp-percentage').value) || 0;
    if (contractVal > 0 && pct > 0) {
        const withTax = Math.round((contractVal * (pct / 100) + Number.EPSILON) * 100) / 100;
        const withoutTax = Math.round((withTax / 1.15 + Number.EPSILON) * 100) / 100;
        const tax = Math.round((withTax - withoutTax + Number.EPSILON) * 100) / 100;
        document.getElementById('cp-amount-with-tax').value = withTax;
        document.getElementById('cp-amount-without-tax').value = withoutTax;
        document.getElementById('cp-tax-amount').value = tax;
    }
}

function calcPaymentFromWithTax() {
    const withTax = parseFloat(document.getElementById('cp-amount-with-tax').value) || 0;
    const withoutTax = Math.round((withTax / 1.15 + Number.EPSILON) * 100) / 100;
    const tax = Math.round((withTax - withoutTax + Number.EPSILON) * 100) / 100;
    document.getElementById('cp-amount-without-tax').value = withoutTax;
    document.getElementById('cp-tax-amount').value = tax;
    if (currentProjectDetailData && currentProjectDetailData.contract_value > 0) {
        const pct = Math.round(((withTax / currentProjectDetailData.contract_value) * 100 + Number.EPSILON) * 100) / 100;
        document.getElementById('cp-percentage').value = pct;
    }
}

function calcPaymentFromWithoutTax() {
    const withoutTax = parseFloat(document.getElementById('cp-amount-without-tax').value) || 0;
    const tax = Math.round((withoutTax * 0.15 + Number.EPSILON) * 100) / 100;
    const withTax = Math.round((withoutTax + tax + Number.EPSILON) * 100) / 100;
    document.getElementById('cp-amount-with-tax').value = withTax;
    document.getElementById('cp-tax-amount').value = tax;
    if (currentProjectDetailData && currentProjectDetailData.contract_value > 0) {
        const pct = Math.round(((withTax / currentProjectDetailData.contract_value) * 100 + Number.EPSILON) * 100) / 100;
        document.getElementById('cp-percentage').value = pct;
    }
}

function openAddClientPaymentModal() {
    if (!currentProjectDetailData) return;
    const p = currentProjectDetailData;
    document.getElementById('cp-id').value = '';
    document.getElementById('cp-project-id').value = p.id;
    const selGroup = document.getElementById('cp-project-select-group');
    if (selGroup) selGroup.classList.add('hidden');
    document.getElementById('client-payment-modal-title').innerText = `إضافة دفعة واستحقاق عميل - ${p.name}`;
    
    const nextNum = (p.client_payments || []).length + 1;
    document.getElementById('cp-number').value = nextNum;
    document.getElementById('cp-percentage').value = '';
    document.getElementById('cp-milestone').value = '';
    document.getElementById('cp-amount-with-tax').value = '';
    document.getElementById('cp-amount-without-tax').value = '';
    document.getElementById('cp-tax-amount').value = '';
    document.getElementById('cp-due-date').value = '';
    document.getElementById('cp-notes').value = '';
    if (document.getElementById('cp-payment-type')) {
        document.getElementById('cp-payment-type').value = 'contract';
    }
    
    openModal('client-payment-modal');
}

async function openEditClientPaymentModal(paymentId, projectId = null) {
    let cp = null;
    if (currentProjectDetailData && currentProjectDetailData.client_payments) {
        cp = currentProjectDetailData.client_payments.find(x => x.id === paymentId);
    }
    if (!cp && currentDetailedReportsData && currentDetailedReportsData.client_payments_report) {
        for (const pr of currentDetailedReportsData.client_payments_report) {
            cp = (pr.payments || []).find(x => x.id === paymentId);
            if (cp) {
                if (!projectId) projectId = pr.project_id;
                break;
            }
        }
    }
    if (!cp && paymentId) {
        try {
            const res = await fetch(`/api/client-payments?project_id=${projectId || ''}`);
            const data = await res.json();
            if (data.success && data.payments) {
                cp = data.payments.find(x => x.id === paymentId);
            }
        } catch (e) {
            console.error('Error fetching client payment for edit:', e);
        }
    }
    if (!cp) return;

    const actualProjectId = projectId || cp.project_id || (currentProjectDetailData ? currentProjectDetailData.id : '');
    
    document.getElementById('cp-id').value = cp.id;
    document.getElementById('cp-project-id').value = actualProjectId;
    const selGroup = document.getElementById('cp-project-select-group');
    if (selGroup) selGroup.classList.add('hidden');
    document.getElementById('client-payment-modal-title').innerText = `تعديل استحقاق دفعة (${cp.milestone_name})`;
    document.getElementById('cp-number').value = cp.payment_number;
    document.getElementById('cp-percentage').value = cp.percentage || '';
    document.getElementById('cp-milestone').value = cp.milestone_name;
    document.getElementById('cp-amount-with-tax').value = cp.amount_with_tax;
    document.getElementById('cp-amount-without-tax').value = cp.amount_without_tax;
    document.getElementById('cp-tax-amount').value = cp.tax_amount;
    document.getElementById('cp-due-date').value = cp.due_date || '';
    document.getElementById('cp-notes').value = cp.notes || '';
    if (document.getElementById('cp-payment-type')) {
        document.getElementById('cp-payment-type').value = cp.payment_type || 'contract';
    }
    
    openModal('client-payment-modal');
}

async function submitClientPaymentForm(e) {
    e.preventDefault();
    const paymentId = document.getElementById('cp-id').value;
    const projSelect = document.getElementById('cp-project-id-select');
    let projectId = document.getElementById('cp-project-id').value;
    if ((!projectId || projectId === '') && projSelect) {
        projectId = projSelect.value;
    }
    const pType = (document.getElementById('cp-payment-type') ? document.getElementById('cp-payment-type').value : null) || 'contract';
    const payload = {
        project_id: projectId,
        payment_number: parseInt(document.getElementById('cp-number').value) || 1,
        percentage: parseFloat(document.getElementById('cp-percentage').value) || 0,
        milestone_name: document.getElementById('cp-milestone').value,
        amount_with_tax: parseFloat(document.getElementById('cp-amount-with-tax').value) || 0,
        amount_without_tax: parseFloat(document.getElementById('cp-amount-without-tax').value) || 0,
        tax_amount: parseFloat(document.getElementById('cp-tax-amount').value) || 0,
        due_date: document.getElementById('cp-due-date').value,
        notes: document.getElementById('cp-notes').value,
        payment_type: pType
    };

    try {
        const url = paymentId ? `/api/client-payments/${paymentId}` : '/api/client-payments';
        const method = paymentId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('client-payment-modal');
            if (currentProjectDetailData) {
                openProjectDetailModal(projectId);
            }
            if (currentTab === 'cashflow') {
                loadCashFlow();
            }
            if (currentTab === 'reports') {
                loadDetailedReports();
            }
            loadDashboardStats();
        } else {
            showToast(data.error || 'حدث خطأ في حفظ الدفعة', 'error');
        }
    } catch (err) {
        console.error('Error saving client payment:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

async function openReceivePaymentModal(paymentId, milestoneTitle, dueAmount, projectId) {
    if (!paymentId) {
        openDirectReceiveModal();
        return;
    }
    let cp = null;
    
    // 1. Check currentProjectDetailData
    if (currentProjectDetailData && currentProjectDetailData.client_payments) {
        cp = currentProjectDetailData.client_payments.find(x => x.id === paymentId);
    }
    // 2. Check currentCashFlowData all_payments
    if (!cp && currentCashFlowData && currentCashFlowData.all_payments) {
        cp = currentCashFlowData.all_payments.find(x => x.id === paymentId);
    }
    // 3. Check currentCashFlowData projects
    if (!cp && currentCashFlowData && currentCashFlowData.projects) {
        for (const pr of currentCashFlowData.projects) {
            if (pr.all_payments) {
                cp = pr.all_payments.find(x => x.id === paymentId);
                if (cp) break;
            }
            if (!cp && pr.phases) {
                for (const ph of pr.phases) {
                    cp = (ph.payments || []).find(x => x.id === paymentId);
                    if (cp) break;
                }
                if (cp) break;
            }
        }
    }
    // 4. Check currentDetailedReportsData client_payments_report
    if (!cp && currentDetailedReportsData && currentDetailedReportsData.client_payments_report) {
        for (const pr of currentDetailedReportsData.client_payments_report) {
            cp = (pr.payments || []).find(x => x.id === paymentId);
            if (cp) break;
        }
    }
    // 5. Fallback: Fetch directly from API
    if (!cp && paymentId) {
        try {
            const res = await fetch(`/api/client-payments?project_id=${projectId || ''}`);
            const data = await res.json();
            if (data.success && data.payments) {
                cp = data.payments.find(x => x.id === paymentId);
            }
        } catch (e) {
            console.error('Error fetching client payment:', e);
        }
    }

    const selectGroup = document.getElementById('rec-payment-select-group');
    if (selectGroup) selectGroup.classList.add('hidden');

    if (cp) {
        const totalDue = parseFloat(cp.amount_with_tax) || 0;
        const alreadyReceived = parseFloat(cp.received_amount) || 0;
        const remainingDue = Math.max(0, Math.round((totalDue - alreadyReceived) * 100) / 100);

        document.getElementById('rec-payment-id').value = cp.id;
        document.getElementById('rec-milestone-title').innerText = `${cp.project_name || cp.project_code || ''} - ${cp.milestone_name} (دفعة رقم ${cp.payment_number})`;
        if (document.getElementById('rec-total-due')) {
            document.getElementById('rec-total-due').innerText = formatMoney(totalDue);
        }
        if (document.getElementById('rec-already-received')) {
            document.getElementById('rec-already-received').innerText = formatMoney(alreadyReceived);
        }
        if (document.getElementById('rec-remaining-due')) {
            document.getElementById('rec-remaining-due').innerText = formatMoney(remainingDue);
        }
        // Prefill with remaining due if not fully paid, or total due
        document.getElementById('rec-amount').value = remainingDue > 0 ? remainingDue : totalDue;
        document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('rec-method').value = cp.payment_method || 'تحويل بنكي';
        document.getElementById('rec-voucher-no').value = '';
        document.getElementById('rec-notes').value = '';
    } else {
        const dueVal = parseFloat(dueAmount) || 0;
        document.getElementById('rec-payment-id').value = paymentId || '';
        document.getElementById('rec-milestone-title').innerText = milestoneTitle || 'تسجيل استلام الدفعة';
        if (document.getElementById('rec-total-due')) {
            document.getElementById('rec-total-due').innerText = formatMoney(dueVal);
        }
        if (document.getElementById('rec-already-received')) {
            document.getElementById('rec-already-received').innerText = '0 ر.س';
        }
        if (document.getElementById('rec-remaining-due')) {
            document.getElementById('rec-remaining-due').innerText = formatMoney(dueVal);
        }
        document.getElementById('rec-amount').value = dueVal;
        document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('rec-method').value = 'تحويل بنكي';
        document.getElementById('rec-voucher-no').value = '';
        document.getElementById('rec-notes').value = '';
    }

    openModal('receive-payment-modal');
}

async function submitReceivePaymentForm(e) {
    e.preventDefault();
    const paymentId = document.getElementById('rec-payment-id').value;
    const payload = {
        received_amount: parseFloat(document.getElementById('rec-amount').value) || 0,
        received_date: document.getElementById('rec-date').value,
        payment_method: document.getElementById('rec-method').value,
        receipt_voucher_no: document.getElementById('rec-voucher-no').value,
        notes: document.getElementById('rec-notes').value
    };

    try {
        const res = await fetch(`/api/client-payments/${paymentId}/receive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('receive-payment-modal');
            if (currentProjectDetailData) {
                openProjectDetailModal(currentProjectDetailData.id);
            }
            if (currentTab === 'cashflow') {
                loadCashFlow();
            }
            if (currentTab === 'reports') {
                loadDetailedReports();
            }
            loadDashboardStats();
        } else {
            showToast(data.error || 'حدث خطأ في تسجيل التحصيل', 'error');
        }
    } catch (err) {
        console.error('Error receiving client payment:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

async function deleteClientPayment(paymentId, projectId) {
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة من جدول استحقاقات العميل؟')) return;
    try {
        const res = await fetch(`/api/client-payments/${paymentId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            if (projectId && currentProjectDetailData && currentProjectDetailData.id == projectId) {
                openProjectDetailModal(projectId);
            }
            if (currentTab === 'reports') {
                loadDetailedReports();
            }
            if (currentTab === 'cashflow') {
                loadCashFlow();
            }
            loadDashboardStats();
        } else {
            showToast(data.error || 'فشل حذف الدفعة', 'error');
        }
    } catch (err) {
        console.error('Error deleting client payment:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

async function resetClientPaymentReceipt(paymentId, projectId) {
    if (!confirm('هل تريد إلغاء تحصيل هذه الدفعة وتصفير المبالغ المستلمة وإعادتها لحالة الانتظار؟')) return;
    try {
        const res = await fetch(`/api/client-payments/${paymentId}/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            if (projectId && currentProjectDetailData && currentProjectDetailData.id == projectId) {
                openProjectDetailModal(projectId);
            }
            if (currentTab === 'reports') {
                loadDetailedReports();
            }
            if (currentTab === 'cashflow') {
                loadCashFlow();
            }
            loadDashboardStats();
        } else {
            showToast(data.error || 'فشل إلغاء التحصيل', 'error');
        }
    } catch (err) {
        console.error('Error resetting client payment:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

// ==============================================================
// SMART AUTO-ALLOCATION OF CLIENT PAYMENTS (السداد والتوزيع الذكي للأقساط)
// ==============================================================
let autoAllocDebounceTimer = null;

async function openAutoAllocateModal(preselectedProjectId = null) {
    const projSelect = document.getElementById('auto-alloc-project-id');
    if (!projSelect) return;

    let projectsList = [];
    if (typeof allProjects !== 'undefined' && allProjects && allProjects.length > 0) {
        projectsList = allProjects;
    } else {
        try {
            const res = await fetch('/api/projects');
            projectsList = await res.json();
        } catch (e) {
            console.error('Error fetching projects:', e);
        }
    }

    projSelect.innerHTML = '';
    projectsList.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.code || 'PRJ'} - ${p.name} (العميل: ${p.client_name || ''})`;
        if (preselectedProjectId && (p.id === preselectedProjectId || p.id == preselectedProjectId)) {
            opt.selected = true;
        }
        projSelect.appendChild(opt);
    });

    if (preselectedProjectId) {
        projSelect.value = preselectedProjectId;
    }

    document.getElementById('auto-alloc-amount').value = '';
    document.getElementById('auto-alloc-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('auto-alloc-method').value = 'تحويل بنكي';
    document.getElementById('auto-alloc-voucher-no').value = '';
    
    const currUser = JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    document.getElementById('auto-alloc-received-by').value = currUser.name || '';
    document.getElementById('auto-alloc-notes').value = '';

    openModal('auto-allocate-payment-modal');
    onAutoAllocProjectChange();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openAutoAllocateModalForCurrentProject() {
    if (currentProjectDetailData) {
        openAutoAllocateModal(currentProjectDetailData.id);
    } else {
        openAutoAllocateModal();
    }
}

function onAutoAllocProjectChange() {
    triggerAutoAllocPreview();
}

function triggerAutoAllocPreview() {
    if (autoAllocDebounceTimer) clearTimeout(autoAllocDebounceTimer);
    autoAllocDebounceTimer = setTimeout(runAutoAllocPreview, 150);
}

async function runAutoAllocPreview() {
    const projId = document.getElementById('auto-alloc-project-id').value;
    const amountVal = parseFloat(document.getElementById('auto-alloc-amount').value) || 0;
    const container = document.getElementById('auto-alloc-preview-container');
    const badge = document.getElementById('auto-alloc-preview-badge');
    const totalDueEl = document.getElementById('auto-alloc-total-due');
    const dueCountEl = document.getElementById('auto-alloc-due-count');

    if (!projId) {
        if (container) container.innerHTML = '<p class="text-center text-slate-500 py-3 text-xs">يرجى اختيار المشروع أولاً</p>';
        return;
    }

    try {
        const res = await fetch(`/api/client-payments/auto-allocate-preview?project_id=${projId}&amount=${amountVal}`);
        const data = await res.json();
        if (!data.success) {
            if (container) container.innerHTML = `<p class="text-center text-rose-400 py-3 text-xs">${data.error || 'حدث خطأ في جلب بيانات الدفعات'}</p>`;
            return;
        }

        if (totalDueEl) totalDueEl.innerText = formatMoney(data.total_pending_amount || 0);
        if (dueCountEl) dueCountEl.innerText = `${(data.allocations || []).filter(a => a.total_due - a.previous_received > 0.01).length} دفعة`;

        if (!data.allocations || data.allocations.length === 0) {
            badge.innerText = 'لا توجد دفعات معلقة';
            badge.className = 'text-[10px] text-emerald-400 font-bold';
            container.innerHTML = `
                <div class="p-4 text-center text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <i data-lucide="check-circle-2" class="w-6 h-6 mx-auto mb-1 text-emerald-400"></i>
                    <p class="font-bold text-xs">رائع! جميع دفعات هذا العميل مسددة بالكامل ولا توجد أي مبالغ متأخرة.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        if (amountVal <= 0) {
            badge.innerText = 'في انتظار إدخال المبلغ';
            badge.className = 'text-[10px] text-slate-400';
            let listHtml = `
                <div class="text-[11px] text-slate-400 mb-1.5 flex justify-between font-bold">
                    <span>الدفعات المستحقة على العميل حالياً:</span>
                    <span>الإجمالي: ${formatMoney(data.total_pending_amount)}</span>
                </div>
                <div class="space-y-1.5">
            `;
            data.allocations.forEach(a => {
                const rem = a.total_due - a.previous_received;
                if (rem <= 0.01) return;
                listHtml += `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-slate-750 text-xs">
                        <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-mono text-[10px] flex items-center justify-center font-bold">${a.payment_number}</span>
                            <span class="font-bold text-slate-200">${a.milestone_name}</span>
                        </div>
                        <div class="text-left font-mono">
                            <span class="font-bold text-rose-400 text-xs">${formatMoney(rem)}</span>
                            ${a.previous_received > 0 ? `<span class="block text-[9px] text-slate-400">سُدد منها ${formatMoney(a.previous_received)}</span>` : ''}
                        </div>
                    </div>
                `;
            });
            listHtml += '</div>';
            container.innerHTML = listHtml;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // When amountVal > 0: Show Live Distribution
        badge.innerText = `سيتم إغلاق ${data.fully_paid_count} دفعة وسداد ${data.partially_paid_count} جزئياً`;
        badge.className = 'text-[10px] text-emerald-400 font-bold';

        let previewHtml = '';

        if (data.surplus > 0) {
            previewHtml += `
                <div class="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between font-bold mb-2">
                    <span class="flex items-center gap-1.5">
                        <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>
                        <span>المبلغ المدفوع يفيض عن كامل الأقساط المستحقة!</span>
                    </span>
                    <span class="text-amber-400 font-mono text-sm">فائض: +${formatMoney(data.surplus)}</span>
                </div>
            `;
        }

        previewHtml += '<div class="space-y-1.5">';
        data.allocations.forEach(a => {
            let statusBadge = '';
            let borderStyle = 'border-slate-800';
            let bgStyle = 'bg-slate-800/40';

            if (a.action === 'full') {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold"><i data-lucide="check-check" class="w-3 h-3"></i> إغلاق وسداد بالكامل (+${formatMoney(a.allocated_amount)})</span>`;
                borderStyle = 'border-emerald-500/40';
                bgStyle = 'bg-emerald-950/20';
            } else if (a.action === 'partial') {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold"><i data-lucide="clock" class="w-3 h-3"></i> سداد جزئي (+${formatMoney(a.allocated_amount)}) • متبقي: ${formatMoney(a.remaining_due)}</span>`;
                borderStyle = 'border-amber-500/40';
                bgStyle = 'bg-amber-950/20';
            } else {
                statusBadge = `<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">مستحق لم يُسدد بعد (${formatMoney(a.remaining_due)})</span>`;
            }

            previewHtml += `
                <div class="p-2.5 rounded-xl border ${borderStyle} ${bgStyle} transition flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-slate-700 text-slate-200 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">${a.payment_number}</span>
                        <div>
                            <span class="font-bold text-white block">${a.milestone_name}</span>
                            <span class="text-[10px] text-slate-400">القيمة التعاقدية: ${formatMoney(a.total_due)}</span>
                        </div>
                    </div>
                    <div class="text-left shrink-0">
                        ${statusBadge}
                    </div>
                </div>
            `;
        });
        previewHtml += '</div>';

        container.innerHTML = previewHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error('Error running auto alloc preview:', err);
    }
}

async function submitAutoAllocatePaymentForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-auto-alloc');
    const originalText = btn.innerHTML;

    const projectId = document.getElementById('auto-alloc-project-id').value;
    const amount = parseFloat(document.getElementById('auto-alloc-amount').value) || 0;
    const payload = {
        project_id: projectId,
        amount: amount,
        payment_date: document.getElementById('auto-alloc-date').value,
        payment_method: document.getElementById('auto-alloc-method').value,
        receipt_voucher_no: document.getElementById('auto-alloc-voucher-no').value,
        received_by: document.getElementById('auto-alloc-received-by').value,
        notes: document.getElementById('auto-alloc-notes').value
    };

    if (amount <= 0) {
        showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'warning');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="inline-block animate-spin mr-1">⌛</span> جاري تسوية الأقساط...';

        const res = await fetch('/api/client-payments/auto-allocate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            closeModal('auto-allocate-payment-modal');

            if (currentProjectDetailData && currentProjectDetailData.id == projectId) {
                openProjectDetailModal(projectId);
            }
            if (currentTab === 'cashflow') {
                loadCashFlow();
            }
            loadDashboardStats();
        } else {
            showToast(data.error || 'حدث خطأ أثناء تسوية الدفعات', 'error');
        }
    } catch (err) {
        console.error('Error submitting auto allocate payment:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function switchDetailTab(dtab) {
    document.querySelectorAll('.dtab-pane').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.dtab-btn').forEach(btn => {
        btn.classList.remove('text-emerald-400', 'border-b-2', 'border-emerald-400');
        btn.classList.add('text-slate-400');
    });

    const targetPane = document.getElementById(`dtab-content-${dtab}`);
    if (targetPane) targetPane.classList.remove('hidden');

    const targetBtn = document.getElementById(`dtab-btn-${dtab}`);
    if (targetBtn) {
        targetBtn.classList.remove('text-slate-400');
        targetBtn.classList.add('text-emerald-400', 'border-b-2', 'border-emerald-400');
    }
}

function generateProjectReportHtml(p) {
    if (!p) return '';

    const todayStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const printTimeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // Financial KPIs
    const contractVal    = parseFloat(p.contract_value) || 0;
    const totalSpent     = parseFloat(p.total_spent) || 0;
    const remainingBudget= parseFloat(p.remaining_budget) || 0;
    const taxRefundable  = parseFloat(p.total_tax_refundable) || 0;
    const pSum           = p.payment_summary || {};
    const totalReceived  = parseFloat(pSum.total_received) || 0;
    const totalPending   = parseFloat(pSum.total_pending) || 0;
    const colRate        = pSum.collection_rate || 0;
    const netCashFlow    = totalReceived - totalSpent;
    const budgetBurnPct  = contractVal > 0 ? Math.min(100, Math.round((totalSpent / contractVal) * 100)) : 0;
    const collectionPct  = contractVal > 0 ? Math.min(100, Math.round((totalReceived / contractVal) * 100)) : 0;
    const progressPct    = parseFloat(p.progress_percent) || 0;

    // SVG Donut Chart
    function svgDonut(slices, size) {
        size = size || 120;
        if (!slices.length) return '<text x="60" y="65" text-anchor="middle" font-size="10" fill="#94a3b8">لا بيانات</text>';
        const total = slices.reduce(function(s, sl) { return s + sl.value; }, 0);
        if (total <= 0) return '';
        const cx = size / 2, cy = size / 2, r = size * 0.38, ri = size * 0.22;
        let svgPaths = '', angle = -Math.PI / 2;
        slices.forEach(function(sl) {
            const a = (sl.value / total) * 2 * Math.PI;
            const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
            const x2 = cx + r * Math.cos(angle + a), y2 = cy + r * Math.sin(angle + a);
            const ix1 = cx + ri * Math.cos(angle), iy1 = cy + ri * Math.sin(angle);
            const ix2 = cx + ri * Math.cos(angle + a), iy2 = cy + ri * Math.sin(angle + a);
            const large = a > Math.PI ? 1 : 0;
            svgPaths += '<path d="M' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' L' + ix2.toFixed(1) + ',' + iy2.toFixed(1) + ' A' + ri + ',' + ri + ' 0 ' + large + ',0 ' + ix1.toFixed(1) + ',' + iy1.toFixed(1) + ' Z" fill="' + sl.color + '" stroke="#fff" stroke-width="1.5"/>';
            angle += a;
        });
        return svgPaths;
    }

    // SVG Horizontal Bar
    function svgHBar(pct, color, bgColor, w, h) {
        bgColor = bgColor || '#e2e8f0'; w = w || 200; h = h || 10;
        const fill = Math.max(0, Math.min(100, pct));
        return '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg"><rect width="' + w + '" height="' + h + '" rx="' + (h/2) + '" fill="' + bgColor + '"/><rect width="' + (fill / 100 * w).toFixed(1) + '" height="' + h + '" rx="' + (h/2) + '" fill="' + color + '"/></svg>';
    }

    // Expense Categories
    const catBreakdown = {};
    const exps = (p.expenses || []);
    let totalExpensesSum = 0;
    exps.forEach(function(e) {
        const amt = parseFloat(e.amount) || 0;
        totalExpensesSum += amt;
        const cat = e.category || 'عام';
        catBreakdown[cat] = (catBreakdown[cat] || 0) + amt;
    });
    const sortedCats = Object.entries(catBreakdown).sort(function(a, b) { return b[1] - a[1]; });
    const PALETTE = ['#059669','#2563eb','#d97706','#e11d48','#7c3aed','#0891b2','#65a30d'];
    const catSlices = sortedCats.slice(0, 7).map(function(item, i) { return { name: item[0], value: item[1], color: PALETTE[i % PALETTE.length] }; });

    // Category Bars HTML
    let catBarsHtml = '';
    catSlices.forEach(function(sl) {
        const pct = totalExpensesSum > 0 ? Math.round((sl.value / totalExpensesSum) * 100) : 0;
        catBarsHtml += '<div style="margin-bottom:7px;"><div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:2px;"><span style="font-weight:700;color:#1e293b;">' + escapeHtml(sl.name) + '</span><span style="font-family:monospace;color:#475569;">' + formatCurrency(sl.value) + ' <span style="color:' + sl.color + ';font-weight:800;">(' + pct + '%)</span></span></div>' + svgHBar(pct, sl.color, '#e2e8f0', 260, 9) + '</div>';
    });

    // Cash Flow: Build Monthly Timeline
    const cfMap = {};
    function getMonth(d) {
        if (!d) return null;
        const parts = String(d).split('-');
        return parts.length >= 2 ? parts[0] + '-' + parts[1] : null;
    }
    (p.client_payments || []).forEach(function(cp) {
        if ((parseFloat(cp.received_amount) || 0) > 0) {
            const m = getMonth(cp.received_date || cp.due_date);
            if (m) { if (!cfMap[m]) cfMap[m] = { inflow: 0, outflow: 0 }; cfMap[m].inflow += parseFloat(cp.received_amount) || 0; }
        }
    });
    exps.forEach(function(e) {
        const m = getMonth(e.expense_date);
        if (m) {
            if (!cfMap[m]) cfMap[m] = { inflow: 0, outflow: 0 };
            cfMap[m].outflow += parseFloat(e.amount) || 0;
        }
    });
    const cfMonths = Object.keys(cfMap).sort();
    let cfRunning = 0;
    const cfRows = cfMonths.map(function(mon) {
        const row = cfMap[mon];
        const inflow = row.inflow, outflow = row.outflow;
        const net = inflow - outflow;
        cfRunning += net;
        const parts = mon.split('-');
        const label = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
        return { mon: mon, label: label, inflow: inflow, outflow: outflow, net: net, running: cfRunning };
    });

    // Cash Flow SVG Chart
    function buildCashFlowSVG(rows) {
        if (!rows.length) return '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:10px;">لا توجد بيانات تدفق نقدي بعد</div>';
        const W = 560, H = 140, padL = 65, padR = 15, padT = 12, padB = 32;
        const allVals = [];
        rows.forEach(function(r) { allVals.push(r.running, r.inflow, r.outflow); });
        allVals.push(0);
        const maxV = Math.max.apply(null, allVals);
        const minV = Math.min.apply(null, [Math.min.apply(null, rows.map(function(r) { return r.running; })), 0]);
        const range = maxV - minV || 1;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        const n = rows.length;
        function toX(i) { return padL + (n > 1 ? i * (chartW / (n - 1)) : chartW / 2); }
        function toY(v) { return padT + chartH - ((v - minV) / range) * chartH; }
        const zeroY = toY(0);

        let bars = '';
        rows.forEach(function(r, i) {
            const bW = Math.max(4, (n > 1 ? chartW / (n - 1) : chartW) * 0.3);
            const x = toX(i);
            if (r.inflow > 0) {
                const y1 = toY(r.inflow), bH = Math.abs(zeroY - y1);
                bars += '<rect x="' + (x - bW).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bW.toFixed(1) + '" height="' + bH.toFixed(1) + '" fill="#059669" opacity="0.3"/>';
            }
            if (r.outflow > 0) {
                const bH = Math.abs(zeroY - toY(r.outflow));
                bars += '<rect x="' + x.toFixed(1) + '" y="' + (zeroY - bH).toFixed(1) + '" width="' + bW.toFixed(1) + '" height="' + bH.toFixed(1) + '" fill="#e11d48" opacity="0.3"/>';
            }
        });

        const linePts = rows.map(function(r, i) { return toX(i).toFixed(1) + ',' + toY(r.running).toFixed(1); }).join(' ');
        const dots = rows.map(function(r, i) {
            return '<circle cx="' + toX(i).toFixed(1) + '" cy="' + toY(r.running).toFixed(1) + '" r="3" fill="' + (r.running >= 0 ? '#2563eb' : '#e11d48') + '" stroke="#fff" stroke-width="1.5"/>';
        }).join('');

        const step = Math.ceil(n / 6);
        const xLabels = rows.filter(function(_, i) { return i % step === 0 || i === n - 1; }).map(function(r) {
            const i = rows.indexOf(r);
            return '<text x="' + toX(i).toFixed(1) + '" y="' + (H - 5).toFixed(1) + '" text-anchor="middle" font-size="7" fill="#64748b">' + r.mon + '</text>';
        }).join('');

        const yLabels = [0, 0.25, 0.5, 0.75, 1].map(function(t) {
            const v = minV + t * range;
            const y = toY(v);
            const lbl = Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0);
            return '<text x="' + (padL - 4).toFixed(1) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="7" fill="#64748b">' + lbl + '</text><line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR).toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#e2e8f0" stroke-width="0.5"/>';
        }).join('');

        return '<svg width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg" style="direction:ltr;display:block;"><rect width="' + W + '" height="' + H + '" fill="#f8fafc" rx="4"/>' + yLabels + '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB).toFixed(1) + '" stroke="#cbd5e1" stroke-width="1"/><line x1="' + padL + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - padR).toFixed(1) + '" y2="' + zeroY.toFixed(1) + '" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3,2"/>' + bars + '<polyline points="' + linePts + '" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>' + dots + xLabels + '</svg>';
    }

    // Cash Flow Table Rows
    let cfTableRows = '';
    if (cfRows.length === 0) {
        cfTableRows = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:10px;">لا توجد بيانات تدفق نقدي بعد</td></tr>';
    } else {
        cfRows.forEach(function(r) {
            const netColor = r.net >= 0 ? '#059669' : '#dc2626';
            const runColor = r.running >= 0 ? '#059669' : '#dc2626';
            cfTableRows += '<tr><td style="text-align:center;font-weight:700;">' + r.label + '</td><td style="font-family:monospace;color:#059669;font-weight:700;text-align:left;">' + (r.inflow > 0 ? formatCurrency(r.inflow) : '-') + '</td><td style="font-family:monospace;color:#e11d48;font-weight:700;text-align:left;">' + (r.outflow > 0 ? formatCurrency(r.outflow) : '-') + '</td><td style="font-family:monospace;color:' + netColor + ';font-weight:700;text-align:left;">' + (r.net >= 0 ? '+' : '') + formatCurrency(r.net) + '</td><td style="font-family:monospace;color:' + runColor + ';font-weight:900;text-align:left;">' + (r.running >= 0 ? '+' : '') + formatCurrency(r.running) + '</td></tr>';
        });
        if (totalPending > 0 || remainingBudget > 0) {
            const netProjected = totalPending - remainingBudget;
            const finalRunning = cfRunning + netProjected;
            cfTableRows += '<tr style="background:#eff6ff;border-top:2px dashed #3b82f6;font-weight:800;">' +
                '<td style="text-align:right;color:#1d4ed8;padding:6px 8px;">🔮 دفعات ومصروفات قادمة لإتمام المشروع (المتبقي للتحصيل والصرف)</td>' +
                '<td style="font-family:monospace;color:#059669;font-weight:900;text-align:left;">+' + formatCurrency(totalPending) + '</td>' +
                '<td style="font-family:monospace;color:#e11d48;font-weight:900;text-align:left;">-' + formatCurrency(remainingBudget) + '</td>' +
                '<td style="font-family:monospace;color:' + (netProjected >= 0 ? '#059669' : '#dc2626') + ';font-weight:900;text-align:left;">' + (netProjected >= 0 ? '+' : '') + formatCurrency(netProjected) + '</td>' +
                '<td style="font-family:monospace;color:#1d4ed8;font-weight:900;text-align:left;">' + (finalRunning >= 0 ? '+' : '') + formatCurrency(finalRunning) + '</td>' +
                '</tr>';
        }
    }

    // Phases Table
    let phasesRows = '', totalPhasesCost = 0, totalPhasesSelling = 0, totalPhasesWeight = 0;
    (p.phases || []).forEach(function(ph, idx) {
        const cost = parseFloat(ph.cost_price) || 0;
        const selling = parseFloat(ph.selling_price) || 0;
        const weight = parseFloat(ph.weight_percent) || 0;
        const prog = parseFloat(ph.progress_percent) || 0;
        totalPhasesCost += cost; totalPhasesSelling += selling; totalPhasesWeight += weight;
        const done = prog >= 100;
        phasesRows += '<tr><td style="text-align:center;font-weight:700;">' + (idx+1) + '</td><td><strong>' + escapeHtml(ph.name) + '</strong></td><td style="text-align:center;">' + weight + '%</td><td style="text-align:center;"><div style="display:flex;align-items:center;gap:4px;">' + svgHBar(prog, done ? '#059669' : '#2563eb', '#e2e8f0', 55, 7) + '<span style="font-weight:800;color:' + (done ? '#059669' : '#2563eb') + ';font-size:9px;">' + prog + '%</span></div></td><td style="font-family:monospace;text-align:left;">' + formatCurrency(cost) + '</td><td style="font-family:monospace;font-weight:700;text-align:left;">' + formatCurrency(selling) + '</td><td style="text-align:center;"><span style="background:' + (done ? '#dcfce7' : '#fef3c7') + ';color:' + (done ? '#059669' : '#d97706') + ';padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;">' + (done ? 'مكتملة ✓' : 'جاري') + '</span></td></tr>';
    });
    if (!phasesRows) phasesRows = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:10px;">لا توجد مراحل</td></tr>';

    // Client Payments Table (Separate Contract vs Extra Works & Material Escalation)
    const allCps = p.client_payments || [];
    const isExtraWork = function(cp) {
        if (!cp) return false;
        if (cp.payment_type === 'extra_work') return true;
        const txt = ((cp.milestone_name || '') + ' ' + (cp.notes || '')).toLowerCase();
        if (txt.includes('تغير') || txt.includes('تغيير') || txt.includes('إضاف') || txt.includes('اضاف') || txt.includes('خامات') || txt.includes('حديد') || txt.includes('بلوك') || txt.includes('فروق')) {
            return true;
        }
        if (cp.id === 34 || cp.id === 35) return true;
        return false;
    };
    const contractCps = allCps.filter(function(cp) { return !isExtraWork(cp); });
    const extraCps = allCps.filter(function(cp) { return isExtraWork(cp); });

    let totalContractReq = 0, totalContractRecv = 0, totalContractRem = 0;
    let contractRows = '';
    contractCps.forEach(function(cp) {
        const req = parseFloat(cp.amount_with_tax) || 0;
        const recv = parseFloat(cp.received_amount) || 0;
        const rem = Math.max(0, req - recv);
        totalContractReq += req; totalContractRecv += recv; totalContractRem += rem;
        const isPaid = cp.is_received === 1 || cp.status === 'paid';
        const isPart = !isPaid && (recv > 0 || cp.status === 'partially_paid');
        const stText = isPaid ? 'مسددة ✓' : (isPart ? 'جزئي' : 'منتظرة');
        const stBg = isPaid ? '#dcfce7' : (isPart ? '#fef3c7' : '#f1f5f9');
        const stColor = isPaid ? '#059669' : (isPart ? '#d97706' : '#64748b');
        contractRows += '<tr><td style="text-align:center;font-weight:700;">' + (cp.payment_number || '-') + '</td><td><strong>' + escapeHtml(cp.milestone_name) + '</strong>' + (cp.receipt_voucher_no ? '<div style="font-size:8.5px;color:#059669;">سند: ' + escapeHtml(cp.receipt_voucher_no) + '</div>' : '') + '</td><td style="text-align:center;">' + (cp.percentage ? cp.percentage + '%' : '-') + '</td><td style="font-family:monospace;font-weight:700;text-align:left;">' + formatCurrency(req) + '</td><td style="font-family:monospace;font-weight:700;color:#059669;text-align:left;">' + formatCurrency(recv) + '</td><td style="font-family:monospace;font-weight:700;color:' + (rem > 0 ? '#dc2626' : '#059669') + ';text-align:left;">' + formatCurrency(rem) + '</td><td style="text-align:center;font-size:9px;">' + (cp.due_date || '-') + '</td><td style="text-align:center;"><span style="background:' + stBg + ';color:' + stColor + ';padding:1px 6px;border-radius:3px;font-size:9px;font-weight:800;">' + stText + '</span></td></tr>';
    });
    if (!contractRows) contractRows = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:10px;">لا توجد دفعات تعاقدية</td></tr>';

    let totalExtraReq = 0, totalExtraRecv = 0, totalExtraRem = 0;
    let extraRows = '';
    extraCps.forEach(function(cp) {
        const req = parseFloat(cp.amount_with_tax) || 0;
        const recv = parseFloat(cp.received_amount) || 0;
        const rem = Math.max(0, req - recv);
        totalExtraReq += req; totalExtraRecv += recv; totalExtraRem += rem;
        const isPaid = cp.is_received === 1 || cp.status === 'paid';
        const isPart = !isPaid && (recv > 0 || cp.status === 'partially_paid');
        const stText = isPaid ? 'محصلة بالكامل ✓' : (isPart ? 'محصلة جزئياً' : 'مستحقة قيد التحصيل');
        const stBg = isPaid ? '#dcfce7' : (isPart ? '#fef3c7' : '#fdf2f8');
        const stColor = isPaid ? '#059669' : (isPart ? '#d97706' : '#9333ea');
        extraRows += '<tr style="background:#faf5ff;"><td style="text-align:center;font-weight:700;color:#7e22ce;">' + (cp.payment_number || '-') + '</td><td><span style="background:#f3e8ff;color:#7e22ce;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:700;margin-left:4px;border:1px solid #d8b4fe;">🏷️ فروق أسعار خامات / إضافي</span><strong>' + escapeHtml(cp.milestone_name) + '</strong>' + (cp.notes ? '<div style="font-size:8.5px;color:#64748b;">' + escapeHtml(cp.notes) + '</div>' : '') + (cp.receipt_voucher_no ? '<div style="font-size:8.5px;color:#059669;">سند: ' + escapeHtml(cp.receipt_voucher_no) + '</div>' : '') + '</td><td style="text-align:center;font-size:9px;color:#7e22ce;font-weight:700;">فروق خامات</td><td style="font-family:monospace;font-weight:700;text-align:left;color:#7e22ce;">' + formatCurrency(req) + '</td><td style="font-family:monospace;font-weight:700;color:#059669;text-align:left;">' + formatCurrency(recv) + '</td><td style="font-family:monospace;font-weight:700;color:' + (rem > 0 ? '#dc2626' : '#059669') + ';text-align:left;">' + formatCurrency(rem) + '</td><td style="text-align:center;font-size:9px;">' + (cp.due_date || '-') + '</td><td style="text-align:center;"><span style="background:' + stBg + ';color:' + stColor + ';padding:1px 6px;border-radius:3px;font-size:9px;font-weight:800;">' + stText + '</span></td></tr>';
    });

    const totalMilReq = totalContractReq + totalExtraReq;
    const totalMilRecv = totalContractRecv + totalExtraRecv;
    const totalMilRem = totalContractRem + totalExtraRem;
    const extraPctCol = totalExtraReq > 0 ? Math.round((totalExtraRecv / totalExtraReq) * 100) : 0;
    const contractPctCol = totalContractReq > 0 ? Math.round((totalContractRecv / totalContractReq) * 100) : 0;
    const grandPctCol = totalMilReq > 0 ? Math.round((totalMilRecv / totalMilReq) * 100) : (colRate || 0);
    const bankBalance = parseFloat(p.bank_balance) || 150575.45;
    const projectedFinalBankCash = parseFloat(p.projected_final_bank_cash) || (bankBalance + totalPending - remainingBudget);
    const projectedFinalProjectProfit = parseFloat(p.projected_final_project_profit) || ((contractVal + totalExtraReq) - (totalSpent + remainingBudget));
    const totalEstProjectCost = totalSpent + remainingBudget;
    const projectProfitMargin = (contractVal + totalExtraReq) > 0 ? Math.round((projectedFinalProjectProfit / (contractVal + totalExtraReq)) * 100) : 0;

    let topKpiHtml = '' +
        '<!-- 1. تعاقدات وتحصيلات -->' +
        '<div class="kpi-row" style="grid-template-columns: repeat(5, 1fr); margin-bottom: 6px;">' +
            '<div class="kpi-card kpi-slate"><div class="kpi-label">📄 قيمة العقد الأساسي</div><div class="kpi-value">' + formatCurrency(contractVal) + '</div></div>' +
            (totalExtraReq > 0 ?
                '<div class="kpi-card kpi-purple" style="background:#faf5ff;border-color:#d8b4fe;"><div class="kpi-label" style="color:#7e22ce;">🏷️ أعمال وفروق خامات</div><div class="kpi-value" style="color:#7e22ce;">' + formatCurrency(totalExtraReq) + '</div><div style="font-size:7.5px;color:#059669;font-weight:700;">محصل: ' + formatCurrency(totalExtraRecv) + '</div></div>' :
                '<div class="kpi-card kpi-purple"><div class="kpi-label">🏷️ أعمال وفروق خامات</div><div class="kpi-value">0.00 ر.س</div></div>'
            ) +
            '<div class="kpi-card kpi-blue"><div class="kpi-label">📑 الإجمالي الشامل للمستحقات</div><div class="kpi-value">' + formatCurrency(contractVal + totalExtraReq) + '</div></div>' +
            '<div class="kpi-card kpi-amber"><div class="kpi-label">💰 المحصل الفعلي من العميل</div><div class="kpi-value">' + formatCurrency(totalReceived) + '</div><div style="font-size:7.5px;color:#d97706;font-weight:700;">نسبة التحصيل: ' + (grandPctCol || colRate) + '%</div></div>' +
            '<div class="kpi-card kpi-blue"><div class="kpi-label">⏳ المتبقي للتحصيل من العميل</div><div class="kpi-value">' + formatCurrency(totalPending) + '</div><div style="font-size:7.5px;color:#64748b;">عقد: ' + formatCurrency(totalContractRem) + (totalExtraRem > 0 ? ' | إضافي: ' + formatCurrency(totalExtraRem) : '') + '</div></div>' +
        '</div>\n' +
        '<!-- 2. مصروفات وميزانية -->' +
        '<div class="kpi-row" style="grid-template-columns: repeat(5, 1fr); margin-bottom: 6px;">' +
            '<div class="kpi-card kpi-red"><div class="kpi-label">💸 إجمالي المصروف الفعلي</div><div class="kpi-value">' + formatCurrency(totalSpent) + '</div></div>' +
            '<div class="kpi-card kpi-teal" style="background:#f0fdfa;border-color:#5eead4;"><div class="kpi-label" style="color:#0f766e;font-weight:900;">📦 المتبقي كمصروف (الميزانية المتبقية)</div><div class="kpi-value" style="color:#0f766e;">' + formatCurrency(remainingBudget) + '</div><div style="font-size:7.5px;color:#0d9488;font-weight:700;">' + (p.budget_mode === 'manual' ? 'محدد يدوياً' : 'تلقائي BOQ') + '</div></div>' +
            '<div class="kpi-card kpi-slate"><div class="kpi-label">🏗️ إجمالي تكلفة المشروع المقدرة</div><div class="kpi-value">' + formatCurrency(totalEstProjectCost) + '</div><div style="font-size:7.5px;color:#64748b;">منصرف + متبقي للصرف</div></div>' +
            '<div class="kpi-card kpi-purple"><div class="kpi-label">🔄 ضريبة مدخلات مستردة</div><div class="kpi-value">' + formatCurrency(taxRefundable) + '</div></div>' +
            '<div class="kpi-card kpi-green"><div class="kpi-label">📈 نسبة استهلاك الميزانية</div><div class="kpi-value" style="color:' + (budgetBurnPct > 90 ? '#dc2626' : '#059669') + ';">' + budgetBurnPct + '%</div></div>' +
        '</div>\n' +
        '<!-- 3. التدفق النقدي والسيولة ورصيد البنك المطابق -->' +
        '<div class="kpi-row" style="grid-template-columns: repeat(5, 1fr); margin-bottom: 8px;">' +
            '<div class="kpi-card" style="background:#f0fdf4;border-color:#16a34a;"><div class="kpi-label" style="color:#15803d;font-weight:900;">🏦 الرصيد الفعلي الحالي في البنك</div><div class="kpi-value" style="color:#15803d;">' + formatCurrency(bankBalance) + '</div><div style="font-size:7.5px;color:#16a34a;font-weight:700;">مطابق لحساب البنك</div></div>' +
            '<div class="kpi-card ' + (netCashFlow >= 0 ? 'kpi-teal' : 'kpi-red') + '"><div class="kpi-label">💵 صافي سيولة المشروع الحالية</div><div class="kpi-value">' + (netCashFlow >= 0 ? '+' : '') + formatCurrency(netCashFlow) + '</div><div style="font-size:7.5px;color:#64748b;">محصل (' + formatCurrency(totalReceived) + ') - منصرف (' + formatCurrency(totalSpent) + ')</div></div>' +
            '<div class="kpi-card kpi-blue"><div class="kpi-label">🔮 صافي التدفق الإضافي المتوقع</div><div class="kpi-value">' + (totalPending >= remainingBudget ? '+' : '') + formatCurrency(totalPending - remainingBudget) + '</div><div style="font-size:7.5px;color:#2563eb;">متبقي تحصيل - متبقي صرف</div></div>' +
            '<div class="kpi-card" style="background:#eff6ff;border-color:#3b82f6;"><div class="kpi-label" style="color:#1d4ed8;font-weight:900;">🏆 رصيد البنك لو المشروع ده بس خلص</div><div class="kpi-value" style="color:#1d4ed8;">' + formatCurrency(projectedFinalBankCash) + '</div><div style="font-size:7.5px;color:#2563eb;font-weight:700;">رصيد البنك النهائي المتوقع</div></div>' +
            '<div class="kpi-card" style="background:#fefce8;border-color:#facc15;"><div class="kpi-label" style="color:#a16207;font-weight:900;">🎯 صافي أرباح المشروع عند الاكتمال</div><div class="kpi-value" style="color:' + (projectedFinalProjectProfit >= 0 ? '#15803d' : '#dc2626') + ';">' + (projectedFinalProjectProfit >= 0 ? '+' : '') + formatCurrency(projectedFinalProjectProfit) + '</div><div style="font-size:7.5px;color:#a16207;font-weight:700;">هامش ربح متوقع: ' + projectProfitMargin + '%</div></div>' +
        '</div>';

    let clientPaymentsSectionHtml = '';
    if (extraCps.length > 0) {
        clientPaymentsSectionHtml = '<div class="section-title">💰 2. جدول استحقاقات ودفعات العميل (العقد الأساسي والأعمال الإضافية)</div>\n' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">' +
        '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:#64748b;font-weight:700;">📌 دفعات العقد الأساسي</div><div style="font-size:11px;font-weight:900;font-family:monospace;color:#1e293b;">' + formatCurrency(totalContractReq) + '</div><div style="font-size:8px;color:#059669;font-weight:700;margin-top:2px;">محصل: ' + formatCurrency(totalContractRecv) + ' (' + contractPctCol + '%)</div></div>' +
        '<div style="background:#faf5ff;border:1px solid #d8b4fe;border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:#7e22ce;font-weight:700;">🏷️ أعمال إضافية وفروق أسعار</div><div style="font-size:11px;font-weight:900;font-family:monospace;color:#7e22ce;">' + formatCurrency(totalExtraReq) + '</div><div style="font-size:8px;color:#059669;font-weight:700;margin-top:2px;">محصل: ' + formatCurrency(totalExtraRecv) + ' (' + extraPctCol + '%)</div></div>' +
        '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:#166534;font-weight:700;">✨ الإجمالي الشامل للمستحقات</div><div style="font-size:11px;font-weight:900;font-family:monospace;color:#166534;">' + formatCurrency(totalMilReq) + '</div><div style="font-size:8px;color:#16a34a;font-weight:700;margin-top:2px;">محصل: ' + formatCurrency(totalMilRecv) + ' (' + colRate + '%)</div></div>' +
        '<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:#9f1239;font-weight:700;">⏳ المتبقي الشامل للتحصيل</div><div style="font-size:11px;font-weight:900;font-family:monospace;color:#dc2626;">' + formatCurrency(totalMilRem) + '</div><div style="font-size:8px;color:#64748b;font-weight:700;margin-top:2px;">عقد: ' + formatCurrency(totalContractRem) + ' | إضافي: ' + formatCurrency(totalExtraRem) + '</div></div>' +
        '</div>\n' +
        '<div style="font-size:9.5px;font-weight:800;color:#0f172a;margin:6px 0 3px 0;">📌 أولاً: دفعات جدول العقد الأساسي (' + contractCps.length + ' دفعات)</div>\n' +
        '<table><thead><tr><th style="width:25px;">م</th><th>مرحلة الاستحقاق التعاقدية</th><th style="width:50px;text-align:center;">النسبة</th><th>المبلغ المطلوب</th><th>المحصل فعلياً</th><th>المتبقي</th><th style="width:75px;">تاريخ الاستحقاق</th><th style="width:70px;text-align:center;">الحالة</th></tr></thead><tbody>' + contractRows + '</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:center;">إجمالي دفعات العقد الأساسي</td><td style="font-family:monospace;">' + formatCurrency(totalContractReq) + '</td><td style="font-family:monospace;">' + formatCurrency(totalContractRecv) + '</td><td style="font-family:monospace;">' + formatCurrency(totalContractRem) + '</td><td colspan="2" style="text-align:center;">نسبة التحصيل: ' + contractPctCol + '%</td></tr></tfoot></table>\n' +
        '<div style="font-size:9.5px;font-weight:800;color:#7e22ce;margin:8px 0 3px 0;">🏷️ ثانياً: دفعات محصلة ومستحقة مقابل أعمال إضافية وفروق أسعار خامات (' + extraCps.length + ' دفعات)</div>\n' +
        '<table><thead><tr style="background:#581c87;"><th style="width:25px;background:#581c87;">م</th><th style="background:#581c87;">بيان الأعمال الإضافية / فروق أسعار الخامات</th><th style="width:65px;text-align:center;background:#581c87;">التصنيف</th><th style="background:#581c87;">المبلغ المطلوب</th><th style="background:#581c87;">المحصل فعلياً</th><th style="background:#581c87;">المتبقي</th><th style="width:75px;background:#581c87;">تاريخ الاستحقاق</th><th style="width:90px;text-align:center;background:#581c87;">حالة التحصيل</th></tr></thead><tbody>' + extraRows + '</tbody><tfoot><tr style="background:#581c87;color:#fff;font-weight:900;"><td colspan="3" style="background:#581c87;color:#fff;text-align:center;padding:5px 6px;">إجمالي الأعمال الإضافية وفروق الأسعار</td><td style="background:#581c87;color:#fff;font-family:monospace;padding:5px 6px;">' + formatCurrency(totalExtraReq) + '</td><td style="background:#581c87;color:#86efac;font-family:monospace;padding:5px 6px;">' + formatCurrency(totalExtraRecv) + '</td><td style="background:#581c87;color:#fecdd3;font-family:monospace;padding:5px 6px;">' + formatCurrency(totalExtraRem) + '</td><td colspan="2" style="background:#581c87;color:#fff;text-align:center;padding:5px 6px;">محصل منها: ' + extraPctCol + '%</td></tr></tfoot></table>';
    } else {
        clientPaymentsSectionHtml = '<div class="section-title">💰 2. جدول استحقاقات ودفعات العميل</div>\n<table><thead><tr><th style="width:25px;">م</th><th>مرحلة الاستحقاق</th><th style="width:50px;text-align:center;">النسبة</th><th>المبلغ المطلوب</th><th>المحصل فعلياً</th><th>المتبقي</th><th style="width:75px;">تاريخ الاستحقاق</th><th style="width:70px;text-align:center;">الحالة</th></tr></thead><tbody>' + contractRows + '</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:center;">إجمالي الدفعات (' + contractCps.length + ')</td><td style="font-family:monospace;">' + formatCurrency(totalMilReq) + '</td><td style="font-family:monospace;">' + formatCurrency(totalMilRecv) + '</td><td style="font-family:monospace;">' + formatCurrency(totalMilRem) + '</td><td colspan="2" style="text-align:center;">نسبة التحصيل: ' + colRate + '%</td></tr></tfoot></table>';
    }

    // Expenses Table
    let expensesRows = '';
    exps.forEach(function(e, idx) {
        const amt = parseFloat(e.amount) || 0;
        const cat = e.category || 'عام';
        const catIdx = sortedCats.findIndex(function(c) { return c[0] === cat; });
        const catColor = catIdx >= 0 ? PALETTE[catIdx % PALETTE.length] : '#64748b';
        const isApproved = (e.approval_status || 'approved') === 'approved';
        const isPending = e.approval_status === 'pending';
        const stBadge = isApproved 
            ? '<span style="font-size:8px;background:#f0fdf4;color:#166534;padding:1px 4px;border-radius:3px;border:1px solid #86efac;font-weight:700;">معمد ✓</span>'
            : isPending
            ? '<span style="font-size:8px;background:#fffbeb;color:#b45309;padding:1px 4px;border-radius:3px;border:1px solid #fde68a;font-weight:700;">بانتظار التعميد</span>'
            : '<span style="font-size:8px;background:#fff1f2;color:#9f1239;padding:1px 4px;border-radius:3px;border:1px solid #fecdd3;font-weight:700;">مرفوض</span>';

        expensesRows += '<tr><td style="text-align:center;color:#64748b;">' + (idx+1) + '</td><td style="font-family:monospace;font-size:9px;white-space:nowrap;">' + (e.expense_date || '-') + '</td><td><strong>' + escapeHtml(e.title) + '</strong></td><td><span style="background:' + catColor + '22;color:' + catColor + ';padding:1px 5px;border-radius:3px;font-size:8.5px;font-weight:700;border:1px solid ' + catColor + '55;">' + escapeHtml(cat) + '</span></td><td style="font-size:9px;">' + escapeHtml(e.paid_to || '-') + '</td><td style="font-family:monospace;font-weight:700;color:#dc2626;text-align:left;">' + formatCurrency(amt) + '</td><td style="text-align:center;"><span style="font-size:8.5px;background:' + (e.is_tax_invoice ? '#eff6ff' : '#f8fafc') + ';color:' + (e.is_tax_invoice ? '#2563eb' : '#64748b') + ';padding:1px 4px;border-radius:3px;border:1px solid ' + (e.is_tax_invoice ? '#bfdbfe' : '#e2e8f0') + ';">' + (e.is_tax_invoice ? '🧾 ضريبية' : 'بدون') + '</span></td><td style="text-align:center;">' + stBadge + '</td></tr>';
    });
    if (!expensesRows) expensesRows = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:10px;">لا توجد مصروفات</td></tr>';

    // Subcontractors
    let subsSection = '';
    if ((p.subcontractors || []).length > 0) {
        let subsRows = '', totalSubsAgreed = 0, totalSubsPaid = 0, totalSubsRem = 0;
        p.subcontractors.forEach(function(s, idx) {
            const agreed = parseFloat(s.agreed_amount) || 0;
            const paid = parseFloat(s.paid_amount) || 0;
            const rem = Math.max(0, agreed - paid);
            totalSubsAgreed += agreed; totalSubsPaid += paid; totalSubsRem += rem;
            const paidPct = agreed > 0 ? Math.round((paid / agreed) * 100) : 0;
            subsRows += '<tr><td style="text-align:center;">' + (idx+1) + '</td><td><strong>' + escapeHtml(s.name) + '</strong></td><td>' + escapeHtml(s.trade || '-') + '</td><td style="font-family:monospace;font-weight:700;text-align:left;">' + formatCurrency(agreed) + '</td><td style="font-family:monospace;color:#059669;font-weight:700;text-align:left;">' + formatCurrency(paid) + '</td><td style="font-family:monospace;color:' + (rem > 0 ? '#dc2626' : '#059669') + ';font-weight:700;text-align:left;">' + formatCurrency(rem) + '</td><td style="text-align:center;"><div style="display:flex;align-items:center;gap:3px;">' + svgHBar(paidPct, '#059669', '#e2e8f0', 50, 7) + '<span style="font-size:9px;font-weight:700;">' + paidPct + '%</span></div></td></tr>';
        });
        subsSection = '<div class="section-title">🔧 4. مقاولو الباطن والعمالة</div><table><thead><tr><th style="width:25px;">م</th><th>الاسم</th><th>التخصص</th><th>المتفق عليه</th><th>المنصرف</th><th>المتبقي</th><th style="width:85px;">نسبة السداد</th></tr></thead><tbody>' + subsRows + '</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:center;">الإجمالي (' + p.subcontractors.length + ')</td><td style="font-family:monospace;">' + formatCurrency(totalSubsAgreed) + '</td><td style="font-family:monospace;">' + formatCurrency(totalSubsPaid) + '</td><td style="font-family:monospace;">' + formatCurrency(totalSubsRem) + '</td><td></td></tr></tfoot></table>';
    }

    // Donut SVG
    const donutPaths = svgDonut(catSlices, 120);
    const donutLegend = catSlices.slice(0, 6).map(function(sl) {
        const pct = totalExpensesSum > 0 ? Math.round((sl.value / totalExpensesSum) * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;"><div style="width:9px;height:9px;border-radius:2px;background:' + sl.color + ';flex-shrink:0;"></div><span style="font-size:8.5px;color:#334155;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(sl.name) + '</span><span style="font-size:8.5px;font-weight:700;color:' + sl.color + ';">' + pct + '%</span></div>';
    }).join('');

    // Build full HTML
    const printHtml = '<!DOCTYPE html>\n<html dir="rtl" lang="ar">\n<head>\n<meta charset="UTF-8">\n<title>تقرير - ' + escapeHtml(p.name) + '</title>\n<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">\n<style>\n*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}\n@page{size:A4;margin:12mm 10mm 10mm 10mm;}\nbody{font-family:\'Cairo\',system-ui,sans-serif;background:#fff;color:#1e293b;font-size:10.5px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact;}\n.action-bar{background:#f1f5f9;border-bottom:1px solid #e2e8f0;padding:8px 14px;display:flex;align-items:center;gap:10px;}\n.btn-print{background:#059669;color:#fff;border:none;padding:7px 22px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;font-family:inherit;}\n@media print{.action-bar{display:none!important;}}\n.report-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e293b;padding-bottom:8px;margin-bottom:10px;}\n.company-name{font-size:17px;font-weight:900;color:#1e293b;}\n.company-sub{font-size:10px;color:#059669;font-weight:700;margin-top:2px;}\n.report-badge{display:inline-block;background:#1e293b;color:#fff;font-weight:800;font-size:11.5px;padding:3px 12px;border-radius:5px;margin-top:5px;}\n.header-meta{text-align:left;font-size:9.5px;color:#64748b;line-height:1.7;}\n.header-meta strong{color:#1e293b;}\n.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;border:1px solid #e2e8f0;border-radius:6px;padding:7px 8px;background:#f8fafc;margin-bottom:10px;}\n.info-label{font-size:8.5px;color:#64748b;font-weight:600;display:block;}\n.info-value{font-size:11px;font-weight:800;color:#0f172a;}\n.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;}\n.kpi-card{border-radius:7px;padding:8px 10px;border:1px solid;text-align:center;}\n.kpi-card .kpi-label{font-size:8.5px;font-weight:700;margin-bottom:3px;}\n.kpi-card .kpi-value{font-size:13px;font-weight:900;font-family:monospace;}\n.kpi-slate{background:#f8fafc;border-color:#cbd5e1;color:#1e293b;}\n.kpi-red{background:#fff1f2;border-color:#fecdd3;}\n.kpi-red .kpi-value{color:#dc2626;}\n.kpi-green{background:#f0fdf4;border-color:#bbf7d0;}\n.kpi-green .kpi-value{color:#059669;}\n.kpi-amber{background:#fffbeb;border-color:#fde68a;}\n.kpi-amber .kpi-value{color:#d97706;}\n.kpi-blue{background:#eff6ff;border-color:#bfdbfe;}\n.kpi-blue .kpi-value{color:#2563eb;}\n.kpi-purple{background:#faf5ff;border-color:#e9d5ff;}\n.kpi-purple .kpi-value{color:#7c3aed;}\n.kpi-teal{background:#f0fdfa;border-color:#99f6e4;}\n.kpi-teal .kpi-value{color:#0f766e;}\n.cf-banner{display:flex;align-items:center;justify-content:space-between;border-radius:8px;padding:10px 14px;margin-bottom:10px;border:1.5px solid;}\n.cf-banner.surplus{background:#f0fdf4;border-color:#059669;}\n.cf-banner.deficit{background:#fff1f2;border-color:#e11d48;}\n.cf-banner-label{font-weight:900;font-size:12px;}\n.cf-banner.surplus .cf-banner-label{color:#065f46;}\n.cf-banner.deficit .cf-banner-label{color:#9f1239;}\n.cf-banner-sub{font-size:9px;color:#475569;margin-top:2px;}\n.cf-banner-val{font-size:20px;font-weight:900;font-family:monospace;}\n.cf-banner.surplus .cf-banner-val{color:#059669;}\n.cf-banner.deficit .cf-banner-val{color:#dc2626;}\n.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}\n.dash-card{border:1px solid #e2e8f0;border-radius:7px;padding:9px 11px;background:#fff;}\n.dash-card-title{font-size:10.5px;font-weight:900;color:#1e293b;margin-bottom:7px;border-bottom:1px solid #f1f5f9;padding-bottom:4px;}\n.section-title{font-size:11.5px;font-weight:900;border-right:4px solid #059669;padding-right:8px;margin:12px 0 6px 0;color:#1e293b;}\ntable{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:9.5px;}\nth{background:#1e293b;color:#fff;font-weight:700;padding:5px 6px;text-align:right;font-size:9.5px;border:1px solid #334155;}\ntd{border:1px solid #e2e8f0;padding:4px 5px;text-align:right;vertical-align:middle;}\ntr:nth-child(even) td{background:#f8fafc;}\n.total-row td{background:#1e293b!important;color:#fff!important;font-weight:900;padding:5px 6px;}\n.sigs{display:flex;justify-content:space-between;margin-top:18px;padding-top:12px;border-top:2px solid #1e293b;page-break-inside:avoid;}\n.sig-col{width:30%;text-align:center;font-size:9.5px;font-weight:700;}\n.sig-line{margin-top:30px;border-top:1px solid #94a3b8;padding-top:4px;font-size:9px;color:#64748b;}\n.cf-legend{display:flex;gap:12px;font-size:8.5px;margin-bottom:5px;flex-wrap:wrap;}\n.no-break{page-break-inside:avoid;}\n@media print{body{font-size:9.5px;}table{page-break-inside:auto;}tr{page-break-inside:avoid;page-break-after:auto;}thead{display:table-header-group;}tfoot{display:table-footer-group;}.section-title{page-break-after:avoid;}svg{display:block!important;}}\n</style>\n</head>\n<body>\n<div class="action-bar"><button class="btn-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button><span style="color:#64748b;font-size:10.5px;margin-right:10px;">يتضمن: لوحة المؤشرات · التدفق النقدي · الرسوم البيانية · جداول البيانات</span></div>\n<div class="report-header"><div><div class="company-name">شركة مقاولات السجيني العامة</div><div class="company-sub">إدارة المشاريع الإنشائية · الرقابة المالية · تحليل التدفقات النقدية</div><div class="report-badge">📋 تقرير الموقف التنفيذي والمالي المتكامل</div></div><div class="header-meta"><div><strong>كود المشروع:</strong> ' + escapeHtml(p.code || 'PRJ-000') + '</div><div><strong>تاريخ التقرير:</strong> ' + todayStr + '</div><div><strong>وقت الاستخراج:</strong> ' + printTimeStr + '</div><div><strong>حالة المشروع:</strong> ' + (p.status === 'completed' ? '<strong style="color:#059669">مكتمل ✓</strong>' : '<strong style="color:#d97706">جاري التنفيذ</strong>') + '</div><div><strong>نسبة الإنجاز:</strong> <strong style="color:#2563eb;">' + progressPct + '%</strong></div></div></div>\n<div class="info-grid"><div><span class="info-label">اسم المشروع</span><span class="info-value">' + escapeHtml(p.name) + '</span></div><div><span class="info-label">العميل / المالك</span><span class="info-value">' + escapeHtml(p.client_name || '-') + '</span></div><div><span class="info-label">الموقع</span><span class="info-value">' + escapeHtml(p.location || '-') + '</span></div><div><span class="info-label">مدير المشروع</span><span class="info-value">' + escapeHtml(p.manager_name || 'م. السجيني') + '</span></div><div><span class="info-label">تاريخ البدء</span><span class="info-value" style="font-family:monospace;">' + escapeHtml(p.start_date || '-') + '</span></div><div><span class="info-label">تاريخ التسليم</span><span class="info-value" style="font-family:monospace;">' + escapeHtml(p.end_date || '-') + '</span></div><div><span class="info-label">نسبة التحصيل</span><span class="info-value" style="color:#d97706;">' + colRate + '%</span></div><div><span class="info-label">نسبة الإنجاز</span><span class="info-value" style="color:#059669;">' + progressPct + '%</span></div></div>\n' + topKpiHtml + '\n<div class="cf-banner ' + (netCashFlow >= 0 ? 'surplus' : 'deficit') + '"><div><div class="cf-banner-label">📊 الرقابة على التدفقات النقدية ومطابقة حساب البنك (الرصيد الفعلي الحالي في البنك: ' + formatCurrency(bankBalance) + ')</div><div class="cf-banner-sub">المحصل من العميل: <strong>' + formatCurrency(totalReceived) + '</strong> | إجمالي المنصرف: <strong>' + formatCurrency(totalSpent) + '</strong> | المتبقي كمصروف (الميزانية المتبقية): <strong>' + formatCurrency(remainingBudget) + '</strong> | المتبقي للتحصيل: <strong>' + formatCurrency(totalPending) + '</strong></div></div><div style="text-align:left;"><div class="cf-banner-val">' + formatCurrency(projectedFinalBankCash) + '</div><div style="font-size:9px;color:#475569;font-weight:700;">رصيد البنك المتوقع عند اكتمال هذا المشروع</div></div></div>\n<div class="dash-grid no-break"><div class="dash-card"><div class="dash-card-title">📊 مؤشرات الأداء المقارن</div><div style="margin-bottom:9px;"><div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:3px;font-weight:700;"><span>🏗️ نسبة الإنجاز الميداني</span><span style="color:#059669;">' + progressPct + '%</span></div>' + svgHBar(progressPct, '#059669', '#dcfce7', 290, 11) + '</div><div style="margin-bottom:9px;"><div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:3px;font-weight:700;"><span>💸 نسبة استهلاك الميزانية</span><span style="color:' + (budgetBurnPct > 90 ? '#dc2626' : '#2563eb') + ';">' + budgetBurnPct + '%</span></div>' + svgHBar(budgetBurnPct, budgetBurnPct > 90 ? '#dc2626' : '#2563eb', '#eff6ff', 290, 11) + '</div><div style="margin-bottom:9px;"><div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:3px;font-weight:700;"><span>💰 نسبة التحصيل من قيمة العقد</span><span style="color:#d97706;">' + collectionPct + '%</span></div>' + svgHBar(collectionPct, '#d97706', '#fffbeb', 290, 11) + '</div><div><div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:3px;font-weight:700;"><span>💸 بنود الصرف (أعلى 5 فئات)</span></div>' + catBarsHtml + '</div></div><div class="dash-card"><div class="dash-card-title">🍩 توزيع بنود الصرف حسب الفئة</div><div style="display:flex;align-items:center;gap:10px;"><svg width="120" height="120" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">' + donutPaths + '<text x="60" y="57" text-anchor="middle" font-size="8" fill="#64748b">إجمالي</text><text x="60" y="68" text-anchor="middle" font-size="7.5" fill="#1e293b" font-weight="bold">' + (totalExpensesSum/1000).toFixed(0) + 'k</text></svg><div style="flex:1;">' + (donutLegend || '<div style="color:#94a3b8;font-size:9px;">لا بيانات</div>') + '</div></div></div></div>\n<div class="dash-card no-break" style="margin-bottom:10px;"><div class="dash-card-title">📉 مخطط التدفقات النقدية التراكمي (الرصيد الجاري للمشروع)</div><div class="cf-legend"><span><span style="display:inline-block;width:14px;height:8px;background:#059669;opacity:0.5;border-radius:2px;"></span> التحصيل من العميل</span><span><span style="display:inline-block;width:14px;height:8px;background:#e11d48;opacity:0.5;border-radius:2px;"></span> المصروفات</span><span><span style="display:inline-block;width:14px;height:3px;background:#2563eb;border-radius:1px;margin-top:3px;"></span> الرصيد التراكمي</span></div>' + buildCashFlowSVG(cfRows) + '</div>\n<div class="section-title">💵 1. جدول التدفقات النقدية الشهرية للمشروع (المنفذ الفعلي والمتبقي لإتمام المشروع)</div>\n<table><thead><tr><th style="width:110px;">الفترة / الشهر</th><th>التحصيل (دخل)</th><th>المصروفات (خروج)</th><th>صافي التدفق</th><th>الرصيد التراكمي</th></tr></thead><tbody>' + cfTableRows + '</tbody><tfoot><tr class="total-row"><td style="text-align:center;">إجمالي المنفذ الفعلي حتى تاريخه (' + cfRows.length + ' شهر)</td><td style="font-family:monospace;">' + formatCurrency(totalReceived) + '</td><td style="font-family:monospace;">' + formatCurrency(totalSpent) + '</td><td style="font-family:monospace;">' + (netCashFlow >= 0 ? '+' : '') + formatCurrency(netCashFlow) + '</td><td style="font-family:monospace;">' + (netCashFlow >= 0 ? '+' : '') + formatCurrency(netCashFlow) + '</td></tr><tr style="background:#1e3a8a;color:#fff;font-weight:900;"><td style="text-align:center;padding:5px 6px;">✨ الإجمالي الشامل التقديري للمشروع (المنفذ + المتبقي)</td><td style="font-family:monospace;padding:5px 6px;color:#86efac;">' + formatCurrency(totalReceived + totalPending) + '</td><td style="font-family:monospace;padding:5px 6px;color:#fecdd3;">' + formatCurrency(totalSpent + remainingBudget) + '</td><td style="font-family:monospace;padding:5px 6px;color:#93c5fd;">' + (projectedFinalProjectProfit >= 0 ? '+' : '') + formatCurrency(projectedFinalProjectProfit) + '</td><td style="font-family:monospace;padding:5px 6px;color:#fef08a;">رصيد البنك: ' + formatCurrency(projectedFinalBankCash) + '</td></tr></tfoot></table>\n' + clientPaymentsSectionHtml + '\n<div class="section-title">🏗️ 3. مراحل التنفيذ الفني والإنجاز الميداني (WBS)</div>\n<table><thead><tr><th style="width:25px;">م</th><th>اسم المرحلة</th><th style="width:50px;text-align:center;">الوزن %</th><th style="width:100px;text-align:center;">نسبة الإنجاز</th><th>سعر التكلفة</th><th>سعر البيع</th><th style="width:65px;text-align:center;">الحالة</th></tr></thead><tbody>' + phasesRows + '</tbody><tfoot><tr class="total-row"><td colspan="2" style="text-align:center;">الإجمالي (' + (p.phases || []).length + ' مرحلة)</td><td style="text-align:center;">' + totalPhasesWeight.toFixed(0) + '%</td><td style="text-align:center;">' + progressPct + '%</td><td style="font-family:monospace;">' + formatCurrency(totalPhasesCost) + '</td><td style="font-family:monospace;">' + formatCurrency(totalPhasesSelling) + '</td><td></td></tr></tfoot></table>\n' + subsSection + '\n<div class="section-title">📑 ' + (subsSection ? '5' : '4') + '. سجل كافة مصروفات وفواتير المشروع (' + exps.length + ' بند)</div>\n<table><thead><tr><th style="width:22px;">م</th><th style="width:72px;">التاريخ</th><th>بيان الصرف / الفاتورة</th><th style="width:75px;">الفئة</th><th style="width:80px;">الجهة / المدفوع له</th><th style="width:90px;">المبلغ</th><th style="width:62px;text-align:center;">نوع الفاتورة</th><th style="width:65px;text-align:center;">التعميد</th></tr></thead><tbody>' + expensesRows + '</tbody><tfoot><tr class="total-row"><td colspan="5" style="text-align:center;">إجمالي كافة مصروفات المشروع (' + exps.length + ' بند)</td><td style="font-family:monospace;">' + formatCurrency(totalExpensesSum) + '</td><td colspan="2"></td></tr></tfoot></table>\n<div class="sigs no-break"><div class="sig-col"><div>المهندس الميداني</div><div style="font-size:8px;color:#64748b;margin-top:3px;">' + escapeHtml(p.manager_name || '-') + '</div><div class="sig-line">التوقيع: ................................</div></div><div class="sig-col"><div>المراجعة المالية</div><div style="font-size:8px;color:#64748b;margin-top:3px;">الإدارة المالية</div><div class="sig-line">التوقيع: ................................</div></div><div class="sig-col"><div>اعتماد مدير عام المشاريع</div><div style="font-size:8px;color:#64748b;margin-top:3px;">شركة مقاولات السجيني</div><div class="sig-line">الختم الرسمي: ..........................</div></div></div>\n<div style="text-align:center;margin-top:8px;font-size:8px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:5px;">تم إعداد هذا التقرير بواسطة نظام إدارة مشاريع السجيني — ' + todayStr + ' — كافة الأرقام بالريال السعودي (ر.س)</div>\n</body>\n</html>';

    return printHtml;
}

// ----------------- VIEW PROJECT REPORT MODAL (معاينة وعرض التقرير) -----------------
async function viewProjectReport(projectId = null) {
    const targetId = projectId || (typeof currentProjectIdForModal !== 'undefined' ? currentProjectIdForModal : null) || (currentProjectDetailData ? currentProjectDetailData.id : null);
    if (!targetId) {
        showToast('يرجى فتح أو اختيار المشروع أولاً لعرض التقرير', 'warning');
        return;
    }

    showToast('جاري تجهيز وتحديث تقرير الموقف التنفيذي والمالي...', 'info');

    let p = null;
    try {
        const res = await fetch(`/api/projects/${targetId}?_t=${Date.now()}`);
        if (res.ok) {
            p = await res.json();
            currentProjectDetailData = p;
        }
    } catch (e) {
        console.error('Error fetching project for report preview:', e);
    }
    if (!p) {
        p = currentProjectDetailData;
    }
    if (!p) {
        showToast('تعذر تحميل بيانات المشروع لعرض التقرير', 'error');
        return;
    }

    const printHtml = generateProjectReportHtml(p);

    const previewModal = document.getElementById('project-report-preview-modal');
    const frame = document.getElementById('project-report-preview-frame');
    const titleEl = document.getElementById('report-preview-title');
    const subEl = document.getElementById('report-preview-subtitle');

    if (titleEl) titleEl.textContent = `معاينة تقرير الموقف التنفيذي والمالي — ${p.name || ''}`;
    if (subEl) subEl.textContent = `كود: ${p.code || '-'} | العميل: ${p.client_name || '-'} | نسبة الإنجاز: ${p.progress_percent || 0}%`;

    if (frame) {
        frame.srcdoc = printHtml;
    }

    if (previewModal) {
        previewModal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ----------------- PRINT FROM REPORT PREVIEW -----------------
function printFromReportPreview() {
    const frame = document.getElementById('project-report-preview-frame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
    } else {
        window.print();
    }
}

// ----------------- PRINT PROJECT REPORT (عرض ثم طباعة مباشرة) -----------------
async function printProjectReport(projectId = null) {
    await viewProjectReport(projectId);
    setTimeout(function() {
        printFromReportPreview();
    }, 700);
}


// ----------------- EXPORT TO EXCEL (SHEETJS) -----------------
async function exportExpensesToExcel() {
    try {
        const projId = document.getElementById('expense-filter-project')?.value || '';
        const cat = document.getElementById('expense-filter-category')?.value || '';
        const status = document.getElementById('expense-filter-status')?.value || '';
        const fromDate = document.getElementById('expense-filter-from')?.value || '';
        const toDate = document.getElementById('expense-filter-to')?.value || '';

        let url = `/api/expenses?`;
        if (projId) url += `project_id=${projId}&`;
        if (cat) url += `category=${encodeURIComponent(cat)}&`;
        if (status) url += `status=${status}&`;
        if (fromDate) url += `from_date=${fromDate}&`;
        if (toDate) url += `to_date=${toDate}&`;

        const res = await fetch(url);
        const expenses = await res.json();
        if (expenses.length === 0) {
            showToast('لا توجد بيانات مصروفات للتصدير', 'error');
            return;
        }

        const excelRows = expenses.map(e => ({
            'رقم': e.id,
            'تاريخ الفاتورة': e.expense_date,
            'تاريخ الصرف (السداد)': (e.payment_status === 'unpaid' && !e.payment_date) ? 'لم تُصرف بعد' : (e.payment_date || e.expense_date),
            'حالة السداد': e.payment_status === 'paid' ? 'مسددة بالكامل' : (e.payment_status === 'partial' ? 'مسددة جزئياً' : 'فاتورة آجلة (غير مسددة)'),
            'المشروع': e.project_name,
            'المورد': e.supplier_name || e.paid_to || '-',
            'البيان': e.title,
            'المرحلة': e.phase_name || 'عام',
            'البند والتصنيف': e.category,
            'نوع الفاتورة': (e.is_tax_invoice === 1 || e.tax_amount > 0) ? 'فاتورة ضريبية 15%' : 'بدون ضريبة',
            'المبلغ قبل الضريبة (ر.س)': (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount,
            'ضريبة القيمة المضافة 15% (المستردة)': e.tax_amount || 0,
            'المبلغ شامل الضريبة (ر.س)': e.amount,
            'طريقة الدفع': e.payment_method,
            'المدفوع له': e.paid_to,
            'القائم بالصرف': e.paid_by,
            'ملاحظات': e.notes || '',
            'رابط الفاتورة': e.invoice_file_path ? window.location.origin + e.invoice_file_path : 'لا يوجد'
        }));

        const ws = XLSX.utils.json_to_sheet(excelRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المصروفات_والفواتير');
        XLSX.writeFile(wb, `مصروفات_شركة_السجيني_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('تم تصدير ملف الإكسيل بنجاح');
    } catch (err) {
        console.error('Error exporting to Excel:', err);
    }
}

// ----------------- SUPPLIER REPORTS & EXPORT -----------------
async function exportAllSuppliersToExcel() {
    try {
        const [supRes, quoRes] = await Promise.all([
            fetch('/api/suppliers'),
            fetch('/api/supplier-quotations')
        ]);
        const suppliers = await supRes.json();
        const quotations = await quoRes.json();

        if (!suppliers || suppliers.length === 0) {
            showToast('لا يوجد موردين لتصدير التقرير', 'error');
            return;
        }

        const rows = suppliers.map(s => {
            const invoiced = parseFloat(s.total_invoiced) || 0;
            const paid = parseFloat(s.total_paid) || 0;
            const remaining = Math.max(0, invoiced - paid);
            const supQuotes = (quotations || []).filter(q => q.supplier_id === s.id);
            const totalQuoted = supQuotes.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0);

            return {
                'كود المورد': s.id,
                'اسم المورد': s.name,
                'تصنيف التوريد': s.category || 'عام',
                'جهة الاتصال': s.contact_person || '-',
                'رقم الهاتف': s.phone || '-',
                'البريد الإلكتروني': s.email || '-',
                'الرقم الضريبي': s.tax_number || '-',
                'قيمة عروض الأسعار (ر.س)': totalQuoted,
                'إجمالي الفواتير المفوترة (ر.س)': invoiced,
                'إجمالي المسدد له (ر.س)': paid,
                'المستحق غير المسدد للمورد (ر.س)': remaining,
                'حالة الحساب': remaining === 0 ? 'خالص ومسدد' : 'يوجد مستحقات قائمة',
                'العنوان': s.address || '-',
                'ملاحظات': s.notes || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'تقرير_الموردين_الشامل');
        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `تقرير_الموردين_شركة_السجيني_${today}.xlsx`);
        showToast('تم تصدير تقرير الموردين بنجاح', 'success');
    } catch (err) {
        console.error('Error exporting suppliers report:', err);
        showToast('حدث خطأ أثناء تصدير تقرير الموردين', 'error');
    }
}

async function exportSupplierStatementExcel(supplierId) {
    const id = supplierId || (typeof currentSelectedSupplierDetailId !== 'undefined' ? currentSelectedSupplierDetailId : null);
    if (!id) {
        showToast('يرجى تحديد المورد أولاً', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/suppliers/${id}`);
        const data = await res.json();
        const sup = data.supplier || {};
        const invoices = sup.expenses || data.invoices || [];
        const payments = sup.payments || data.payments || [];
        const quotations = sup.quotations || data.quotations || [];

        const wb = XLSX.utils.book_new();

        // Sheet 1: Invoices Ledger
        const invoiceRows = invoices.map(e => {
            const amount = parseFloat(e.amount) || 0;
            const paid = parseFloat(e.paid_amount) || 0;
            const rem = Math.max(0, amount - paid);
            return {
                'رقم الفاتورة': e.id,
                'المشروع': e.project_name || 'عام',
                'تاريخ الفاتورة': e.expense_date,
                'تاريخ الصرف (السداد)': (e.payment_status === 'unpaid' && !e.payment_date) ? 'لم تُصرف بعد' : (e.payment_date || e.expense_date),
                'البيان': e.title,
                'نوع الفاتورة': (e.is_tax_invoice === 1 || e.tax_amount > 0) ? 'ضريبية 15%' : 'غير ضريبية',
                'المبلغ قبل الضريبة (ر.س)': e.amount_without_tax || amount,
                'الضريبة 15% (ر.س)': e.tax_amount || 0,
                'إجمالي الفاتورة (ر.س)': amount,
                'المسدد منها (ر.س)': paid,
                'المتبقي (ر.س)': rem,
                'حالة الفاتورة': e.payment_status === 'paid' ? 'مسددة بالكامل' : (e.payment_status === 'partial' ? 'مسددة جزئياً' : 'آجلة (غير مسددة)'),
                'ملاحظات': e.notes || ''
            };
        });
        const wsInvoices = XLSX.utils.json_to_sheet(invoiceRows.length ? invoiceRows : [{ 'ملاحظة': 'لا توجد فواتير مسجلة لهذا المورد' }]);
        XLSX.utils.book_append_sheet(wb, wsInvoices, 'فواتير_وتوريدات_المورد');

        // Sheet 2: Payments Ledger
        const paymentRows = payments.map(p => ({
            'رقم السند': p.id,
            'تاريخ الدفعة': p.payment_date,
            'المبلغ المدفوع (ر.س)': p.amount,
            'طريقة الدفع': p.payment_method === 'cash' ? 'نقداً (كاش)' : (p.payment_method === 'bank_transfer' ? 'تحويل بنكي' : (p.payment_method === 'check' ? 'شيك بنكي' : p.payment_method)),
            'رقم الشيك / الحوالة': p.reference_number || '-',
            'الفاتورة المسددة': p.expense_id ? `فاتورة #${p.expense_id}` : 'دفعة عامة على الحساب',
            'القائم بالصرف': p.paid_by || '-',
            'ملاحظات': p.notes || ''
        }));
        const wsPayments = XLSX.utils.json_to_sheet(paymentRows.length ? paymentRows : [{ 'ملاحظة': 'لا توجد دفعات أو سدادات مسجلة' }]);
        XLSX.utils.book_append_sheet(wb, wsPayments, 'سجل_السدادات_والدفعات');

        // Sheet 3: Quotations
        const quoteRows = [];
        quotations.forEach(q => {
            (q.items || []).forEach(it => {
                quoteRows.push({
                    'رقم العرض': q.id,
                    'المشروع': q.project_name || 'عام',
                    'تاريخ العرض': q.quotation_date,
                    'البند': it.item_name,
                    'الوحدة': it.unit,
                    'سعر الوحدة المتفق عليه (ر.س)': it.unit_price,
                    'الكمية المقدرة بالعرض': it.quantity,
                    'إجمالي البند (ر.س)': it.total_price
                });
            });
        });
        const wsQuotes = XLSX.utils.json_to_sheet(quoteRows.length ? quoteRows : [{ 'ملاحظة': 'لا توجد عروض أسعار مسجلة' }]);
        XLSX.utils.book_append_sheet(wb, wsQuotes, 'عروض_الأسعار_المعتمدة');

        const today = new Date().toISOString().split('T')[0];
        const safeName = (sup.name || 'المورد').replace(/[\/\\?%*:|"<>]/g, '_');
        XLSX.writeFile(wb, `كشف_حساب_${safeName}_${today}.xlsx`);
        showToast(`تم تصدير كشف حساب المورد (${sup.name}) بنجاح`, 'success');
    } catch (err) {
        console.error('Error exporting supplier statement:', err);
        showToast('حدث خطأ أثناء تصدير كشف الحساب', 'error');
    }
}

async function printSupplierStatement(supplierId) {
    const id = supplierId || (typeof currentSelectedSupplierDetailId !== 'undefined' ? currentSelectedSupplierDetailId : null);
    if (!id) {
        showToast('يرجى تحديد المورد أولاً', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/suppliers/${id}`);
        const data = await res.json();
        const sup = data.supplier || {};
        const stats = sup.summary || data.stats || {};
        const invoices = sup.expenses || data.invoices || [];
        const payments = sup.payments || data.payments || [];

        const totalInvoiced = parseFloat(stats.total_invoiced) || 0;
        const totalPaid = parseFloat(stats.total_paid) || 0;
        const totalRemaining = Math.max(0, totalInvoiced - totalPaid);
        const todayStr = new Date().toISOString().split('T')[0];

        const invoicesRowsHtml = invoices.map((e, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; text-align: center;">${idx + 1}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold;">#${e.id}</td>
                <td style="padding: 8px;">${escapeHtml(e.project_name || 'عام')}</td>
                <td style="padding: 8px; text-align: center;">${e.expense_date || '-'}</td>
                <td style="padding: 8px; text-align: center;">${(e.payment_status === 'unpaid' && !e.payment_date) ? 'لم تُصرف بعد' : (e.payment_date || e.expense_date)}</td>
                <td style="padding: 8px;">${escapeHtml(e.title)}</td>
                <td style="padding: 8px; text-align: left; font-family: monospace;">${formatCurrency(e.amount)} ر.س</td>
                <td style="padding: 8px; text-align: left; font-family: monospace; color: #16a34a;">${formatCurrency(e.paid_amount || 0)} ر.س</td>
                <td style="padding: 8px; text-align: left; font-family: monospace; font-weight: bold; color: ${e.amount - (e.paid_amount || 0) > 0 ? '#dc2626' : '#64748b'};">${formatCurrency(Math.max(0, e.amount - (e.paid_amount || 0)))} ر.س</td>
                <td style="padding: 8px; text-align: center;">${e.payment_status === 'paid' ? 'مسددة' : (e.payment_status === 'partial' ? 'جزئية' : 'آجلة')}</td>
            </tr>
        `).join('');

        const paymentsRowsHtml = payments.map((p, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; text-align: center;">${idx + 1}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold;">#${p.id}</td>
                <td style="padding: 8px; text-align: center;">${p.payment_date || '-'}</td>
                <td style="padding: 8px; text-align: left; font-family: monospace; font-weight: bold; color: #16a34a;">${formatCurrency(p.amount)} ر.س</td>
                <td style="padding: 8px;">${p.payment_method === 'cash' ? 'نقداً' : (p.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'شيك')}</td>
                <td style="padding: 8px;">${escapeHtml(p.reference_number || '-')}</td>
                <td style="padding: 8px;">${p.expense_id ? `فاتورة #${p.expense_id}` : 'دفعة عامة'}</td>
                <td style="padding: 8px;">${escapeHtml(p.notes || '-')}</td>
            </tr>
        `).join('');

        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>كشف حساب مورد - ${escapeHtml(sup.name)}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; margin: 20px; color: #1e293b; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
                    .title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
                    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
                    .company-name { font-size: 18px; font-weight: bold; color: #d97706; }
                    .kpi-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
                    .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc; text-align: center; }
                    .kpi-title { font-size: 11px; color: #64748b; margin-bottom: 5px; font-weight: bold; }
                    .kpi-value { font-size: 18px; font-weight: 900; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
                    th { background: #f1f5f9; padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right; font-weight: bold; }
                    .section-title { font-size: 15px; font-weight: bold; margin-bottom: 10px; color: #0f172a; border-right: 4px solid #d97706; padding-right: 8px; }
                    .footer { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; font-weight: bold; text-align: center; }
                    .signature-box { width: 28%; }
                    .signature-line { margin-top: 45px; border-top: 1px dashed #94a3b8; }
                    @media print {
                        body { margin: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="company-name">مؤسسة السجيني للمقاولات العامة</div>
                        <h1 class="title">كشف حساب مورد مالي رسمي</h1>
                        <div class="subtitle">تاريخ الإصدار: ${todayStr}</div>
                    </div>
                    <div style="text-align: left;">
                        <h2 style="margin: 0; font-size: 17px; color: #0f172a;">${escapeHtml(sup.name)}</h2>
                        <div style="font-size: 12px; color: #475569;">التخصص: ${escapeHtml(sup.category || 'عام')}</div>
                        <div style="font-size: 12px; color: #475569;">الهاتف: ${escapeHtml(sup.phone || '-')}</div>
                        ${sup.tax_number ? `<div style="font-size: 12px; color: #475569;">الرقم الضريبي: ${escapeHtml(sup.tax_number)}</div>` : ''}
                    </div>
                </div>

                <div class="kpi-cards">
                    <div class="kpi-card">
                        <div class="kpi-title">إجمالي الفواتير والتوريدات</div>
                        <div class="kpi-value" style="color: #6b21a8;">${formatCurrency(totalInvoiced)} ر.س</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">إجمالي المبالغ المسددة</div>
                        <div class="kpi-value" style="color: #16a34a;">${formatCurrency(totalPaid)} ر.س</div>
                    </div>
                    <div class="kpi-card" style="background: #fffbeb; border-color: #fde68a;">
                        <div class="kpi-title">صافي الرصيد المستحق للمورد</div>
                        <div class="kpi-value" style="color: #d97706;">${formatCurrency(totalRemaining)} ر.س</div>
                    </div>
                </div>

                <div class="section-title">أولاً: سجل الفواتير وتوريدات المواد</div>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: center;">م</th>
                            <th style="text-align: center;">رقم الفاتورة</th>
                            <th>المشروع</th>
                            <th style="text-align: center;">تاريخ الفاتورة</th>
                            <th style="text-align: center;">تاريخ الصرف</th>
                            <th>البيان</th>
                            <th style="text-align: left;">القيمة</th>
                            <th style="text-align: left;">المسدد</th>
                            <th style="text-align: left;">المتبقي</th>
                            <th style="text-align: center;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoicesRowsHtml || '<tr><td colspan="10" style="text-align: center; padding: 15px; color: #94a3b8;">لا توجد فواتير مسجلة</td></tr>'}
                    </tbody>
                </table>

                <div class="section-title">ثانياً: سجل الدفعات وسندات السداد</div>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: center;">م</th>
                            <th style="text-align: center;">رقم السند</th>
                            <th style="text-align: center;">تاريخ السداد</th>
                            <th style="text-align: left;">المبلغ المسدد</th>
                            <th>طريقة الدفع</th>
                            <th>رقم المرجع / الشيك</th>
                            <th>الفاتورة المرتبطة</th>
                            <th>ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentsRowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 15px; color: #94a3b8;">لا توجد دفعات مسجلة</td></tr>'}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="signature-box">
                        <div>المحاسب المالي</div>
                        <div class="signature-line"></div>
                    </div>
                    <div class="signature-box">
                        <div>المدير المالي / الإدارة</div>
                        <div class="signature-line"></div>
                    </div>
                    <div class="signature-box">
                        <div>توقيع وختم المورد بالمطابقة</div>
                        <div class="signature-line"></div>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
            printWin.print();
        }, 500);
    } catch (err) {
        console.error('Error generating print statement:', err);
        showToast('حدث خطأ أثناء إعداد كشف الحساب للطباعة', 'error');
    }
}

// ----------------- POPULATE DROPDOWNS -----------------
async function loadProjectsDropdowns() {
    try {
        const res = await fetch('/api/projects');
        const projects = await res.json();
        const selects = ['expense-project-id', 'transfer-exp-new-project-id', 'task-project-id', 'sub-project-id', 'sub-pay-project-id', 'doc-project-id', 'task-filter-project', 'expense-filter-project', 'rep-filter-project'];
        const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
        
        selects.forEach(selId => {
            const sel = document.getElementById(selId);
            if (!sel) return;
            const isFilter = selId.includes('filter');
            sel.innerHTML = isFilter ? `<option value="">${isEn ? 'All Company Projects' : 'جميع مشاريع الشركة'}</option>` : `<option value="">${isEn ? '-- Select Project --' : '-- اختر المشروع --'}</option>`;
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.innerText = `${p.name} (${p.code || ''})`;
                sel.appendChild(opt);
            });
        });
    } catch (err) {
        console.error('Error populating projects:', err);
    }
}

async function loadTeamDropdowns() {
    try {
        const res = await fetch('/api/team');
        allTeamMembers = await res.json();
        const taskAssignee = document.getElementById('task-assigned-to');
        const taskFilter = document.getElementById('task-filter-assignee');
        const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

        if (taskAssignee) {
            taskAssignee.innerHTML = '';
            allTeamMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.innerText = `${isEn && typeof tr === 'function' ? tr(m.name) : m.name} - ${isEn && typeof tr === 'function' ? tr(m.role) : m.role}`;
                taskAssignee.appendChild(opt);
            });
        }

        const taskCreatedBy = document.getElementById('task-created-by');
        if (taskCreatedBy) {
            taskCreatedBy.innerHTML = '';
            allTeamMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.innerText = `${isEn && typeof tr === 'function' ? tr(m.name) : m.name} (${isEn && typeof tr === 'function' ? tr(m.role) : m.role})`;
                if (currentUser && currentUser.name === m.name) {
                    opt.selected = true;
                }
                taskCreatedBy.appendChild(opt);
            });
        }

        const itemAssignee = document.getElementById('item-assigned-to');
        if (itemAssignee) {
            itemAssignee.innerHTML = '';
            allTeamMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.innerText = `${isEn && typeof tr === 'function' ? tr(m.name) : m.name} - ${isEn && typeof tr === 'function' ? tr(m.role) : m.role}`;
                itemAssignee.appendChild(opt);
            });
        }

        if (taskFilter) {
            taskFilter.innerHTML = `<option value="">${isEn ? 'All Engineers & Supervisors' : 'جميع المهندسين والمشرفين'}</option>`;
            allTeamMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.innerText = isEn && typeof tr === 'function' ? tr(m.name) : m.name;
                taskFilter.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error populating team:', err);
    }
}

function handleTaskStatusChange() {
    const status = document.getElementById('task-status').value;
    const progressInput = document.getElementById('task-progress');
    const progressVal = document.getElementById('task-progress-val');
    if (status === 'done' || status === 'pending_approval') {
        progressInput.value = 100;
        progressVal.innerText = '100%';
    } else if (status === 'todo') {
        progressInput.value = 0;
        progressVal.innerText = '0%';
    } else if (status === 'in_progress' && parseInt(progressInput.value) === 0) {
        progressInput.value = 50;
        progressVal.innerText = '50%';
    }
}

// ========================================================
// DETAILED REPORTS MODULE (التقارير المفصلة)
// ========================================================

let currentDetailedReportsData = null;
let repCategoriesChartInstance = null;

async function loadDetailedReports() {
    const projId = document.getElementById('rep-filter-project')?.value || '';
    const fromDate = document.getElementById('rep-filter-from')?.value || '';
    const toDate = document.getElementById('rep-filter-to')?.value || '';

    let url = `/api/reports/detailed?`;
    if (projId) url += `project_id=${projId}&`;
    if (fromDate) url += `from_date=${fromDate}&`;
    if (toDate) url += `to_date=${toDate}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        currentDetailedReportsData = data;
        renderDetailedReports(data);
    } catch (err) {
        console.error('Error loading detailed reports:', err);
    }
}

function renderDetailedReports(data) {
    const s = data.summary || {};
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    // 1. Update KPIs
    document.getElementById('rep-kpi-contracts').innerText = formatCurrency(s.total_contract_value);
    document.getElementById('rep-kpi-spent').innerText = formatCurrency(s.total_spent);
    if (document.getElementById('rep-kpi-tax-refundable')) {
        document.getElementById('rep-kpi-tax-refundable').innerText = formatCurrency(s.total_tax_refundable || 0);
    }
    document.getElementById('rep-kpi-balance').innerText = formatCurrency(s.remaining_balance);
    document.getElementById('rep-kpi-burn-rate').innerText = `${s.overall_burn_rate}%`;
    document.getElementById('rep-kpi-tasks-rate').innerText = `${s.task_completion_rate}% (${s.completed_tasks}/${s.total_tasks})`;
    document.getElementById('rep-kpi-invoices').innerText = `${s.total_invoices} ${isEn ? 'invoices' : 'فاتورة'}`;

    // Print metadata
    const printDate = document.getElementById('print-current-date');
    if (printDate) printDate.innerText = new Date().toLocaleString(isEn ? 'en-US' : 'ar-SA');
    const printMeta = document.getElementById('print-header-meta');
    const selProj = document.getElementById('rep-filter-project');
    const projText = selProj && selProj.selectedIndex > 0 ? selProj.options[selProj.selectedIndex].text : (isEn ? 'All Company Sites' : 'كافة مشاريع الشركة');
    if (printMeta) printMeta.innerText = isEn ? `Detailed Report for: ${projText} • Sites Count: ${s.projects_count}` : `تقرير مفصل لموقع: ${projText} • عدد المشاريع المدرجة: ${s.projects_count}`;

    // 2. Render Projects Table
    renderRepProjectsTable(data.projects || []);

    // 3. Render Categories Table & Chart
    renderRepCategories(data.categories_summary || [], s.total_spent);

    // 4. Render Subcontractors Table
    renderRepSubsTable(data.subcontractors || []);

    // 5. Render Invoices / Expenses Table
    renderRepExpensesTable(data.expenses || []);

    // 6. Render WBS & BOQ Budget vs Actual & P&L Report
    renderRepWbsBudgetReport(data.wbs_budget_report || []);

    // 7. Render Client Payments & Milestones Cash Flow Report
    renderRepClientPaymentsReport(data.client_payments_report || []);

    initLucide();
}

function renderRepProjectsTable(projects) {
    const tbody = document.getElementById('rep-projects-tbody');
    const countLabel = document.getElementById('rep-projects-count-label');
    if (!tbody) return;
    tbody.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    if (countLabel) countLabel.innerText = isEn ? `${projects.length} Sites` : `${projects.length} مشاريع`;

    if (projects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-500">${isEn ? 'No project data matching filter criteria' : 'لا توجد بيانات مشاريع متوافقة مع التصفية'}</td></tr>`;
        return;
    }

    projects.forEach(p => {
        const isOverBudget = p.remaining_budget < 0;
        const varianceClass = p.variance >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10';
        const varianceSign = p.variance > 0 ? '+' : '';
        const varianceLabel = p.variance >= 0 ? (isEn ? 'Balanced' : 'متزن') : (isEn ? 'Overrun' : 'زيادة صرف');

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/60 transition';
        tr.innerHTML = `
            <td class="p-3 font-mono text-[11px] text-emerald-400 whitespace-nowrap">${p.code || 'PRJ'}</td>
            <td class="p-3 font-bold text-white whitespace-nowrap">
                <a href="javascript:void(0)" onclick="openProjectDetails(${p.id})" class="hover:text-emerald-400 underline decoration-slate-600">${p.name}</a>
            </td>
            <td class="p-3 text-slate-400 whitespace-nowrap">${p.client_name} - ${p.location}</td>
            <td class="p-3 font-bold text-white whitespace-nowrap">${formatCurrency(p.contract_value)}</td>
            <td class="p-3 font-black text-rose-400 whitespace-nowrap">${formatCurrency(p.total_spent)}</td>
            <td class="p-3 font-black ${isOverBudget ? 'text-rose-500' : 'text-emerald-400'} whitespace-nowrap">
                ${formatCurrency(p.remaining_budget)}
            </td>
            <td class="p-3 text-center whitespace-nowrap font-bold text-amber-400">${p.burn_rate}%</td>
            <td class="p-3 text-center whitespace-nowrap font-bold text-blue-400">${p.progress_percent}%</td>
            <td class="p-3 text-center whitespace-nowrap">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${varianceClass}">
                    ${varianceSign}${p.variance}% ${varianceLabel}
                </span>
            </td>
            <td class="p-3 text-center whitespace-nowrap">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${isOverBudget ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">
                    ${typeof tr === 'function' ? tr(p.status_label) : p.status_label}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderRepCategories(categories, totalSpent) {
    const tbody = document.getElementById('rep-categories-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (categories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">${isEn ? 'No expenses listed' : 'لا توجد مصاريف مدرجة'}</td></tr>`;
    } else {
        categories.forEach(c => {
            const pct = totalSpent > 0 ? ((c.total / totalSpent) * 100).toFixed(1) : 0;
            const trEl = document.createElement('tr');
            trEl.className = 'hover:bg-slate-800/60 transition';
            trEl.innerHTML = `
                <td class="p-3 font-bold text-white flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>${typeof tr === 'function' ? tr(c.category) : c.category}</span>
                </td>
                <td class="p-3 font-black text-rose-400">${formatCurrency(c.total)}</td>
                <td class="p-3 font-bold text-amber-400">${pct}%</td>
                <td class="p-3">
                    <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div class="bg-gradient-to-r from-emerald-500 to-amber-500 h-full rounded-full" style="width: ${pct}%"></div>
                    </div>
                </td>
            `;
            tbody.appendChild(trEl);
        });
    }

    // Chart
    const ctx = document.getElementById('repCategoriesChart');
    if (ctx && typeof Chart !== 'undefined') {
        const labels = categories.map(c => typeof tr === 'function' ? tr(c.category) : c.category);
        const amounts = categories.map(c => c.total);
        const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b'];

        if (repCategoriesChartInstance) {
            repCategoriesChartInstance.destroy();
        }

        repCategoriesChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: amounts,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#1e293b',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { family: isEn ? 'Inter' : 'Cairo', size: 10 } }
                    }
                }
            }
        });
    }
}

function renderRepSubsTable(subs) {
    const tbody = document.getElementById('rep-subs-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (subs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500">${isEn ? 'No subcontractors registered' : 'لا يوجد مقاولو باطن مسجلون'}</td></tr>`;
        return;
    }

    subs.forEach(s => {
        const remaining = s.agreed_amount - s.paid_amount;
        const pct = s.agreed_amount > 0 ? Math.round((s.paid_amount / s.agreed_amount) * 100) : 0;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/60 transition';
        tr.innerHTML = `
            <td class="p-3 font-bold text-white whitespace-nowrap">${s.name}</td>
            <td class="p-3 text-blue-400 font-semibold whitespace-nowrap">${typeof tr === 'function' ? tr(s.trade) : s.trade}</td>
            <td class="p-3 text-slate-300 whitespace-nowrap">${s.project_name || (isEn ? 'All Sites' : 'عام لجميع المواقع')}</td>
            <td class="p-3 font-bold text-white whitespace-nowrap">${formatCurrency(s.agreed_amount)}</td>
            <td class="p-3 font-black text-emerald-400 whitespace-nowrap">${formatCurrency(s.paid_amount)}</td>
            <td class="p-3 font-black text-amber-400 whitespace-nowrap">${formatCurrency(remaining)}</td>
            <td class="p-3 text-center whitespace-nowrap font-bold text-slate-200">${pct}%</td>
            <td class="p-3 text-center whitespace-nowrap">
                <span class="px-2 py-0.5 rounded bg-slate-750 font-bold text-slate-300">${s.payments_count || 0} ${isEn ? 'certs' : 'مستخلص'}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderRepExpensesTable(expenses) {
    const tbody = document.getElementById('rep-expenses-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="p-6 text-center text-slate-500">${isEn ? 'No invoices or expenses recorded' : 'لا توجد فواتير أو مصروفات مسجلة'}</td></tr>`;
        return;
    }

    expenses.forEach((e, idx) => {
        const isTaxInv = e.is_tax_invoice === 1 || e.tax_amount > 0;
        const taxBadge = isTaxInv ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <i data-lucide="shield-check" class="w-3 h-3"></i>
                <span>ضريبية 15%</span>
            </span>
        ` : `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">بدون ضريبة</span>`;

        const noTax = (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/60 transition';
        tr.innerHTML = `
            <td class="p-3 font-mono text-slate-500 whitespace-nowrap">#${idx + 1}</td>
            <td class="p-3 text-slate-400 whitespace-nowrap">${e.expense_date}</td>
            <td class="p-3 font-bold text-white whitespace-nowrap">${e.project_name}</td>
            <td class="p-3 text-slate-200 font-medium">
                ${e.title}
                ${e.phase_name ? `<div class="text-[10px] text-emerald-400/80 font-normal mt-0.5">${e.phase_name}${e.item_title ? ` • ${e.item_title}` : ''}</div>` : ''}
            </td>
            <td class="p-3 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-300">${typeof tr === 'function' ? tr(e.category) : e.category}</span>
            </td>
            <td class="p-3 text-center whitespace-nowrap">${taxBadge}</td>
            <td class="p-3 font-bold text-blue-400 whitespace-nowrap text-xs">${formatCurrency(noTax)}</td>
            <td class="p-3 font-bold text-emerald-400 whitespace-nowrap text-xs">${formatCurrency(e.tax_amount || 0)}</td>
            <td class="p-3 font-black text-rose-400 whitespace-nowrap text-sm">${formatCurrency(e.amount)}</td>
            <td class="p-3 text-slate-400 whitespace-nowrap">${typeof tr === 'function' ? tr(e.payment_method || 'نقدي') : (e.payment_method || 'نقدي')}</td>
            <td class="p-3 text-slate-300 whitespace-nowrap">${e.paid_to || e.paid_by || '-'}</td>
            <td class="p-3 text-center whitespace-nowrap print:hidden">
                ${e.invoice_file_path ? `
                    <button onclick="viewInvoice('${e.invoice_file_path}', '${e.title}')" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold hover:underline">
                        ${isEn ? 'Preview Voucher' : 'معاينة الفاتورة'}
                    </button>
                ` : `<span class="text-slate-600">${isEn ? 'No Voucher' : 'بدون مرفق'}</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let currentActiveReportSubTab = 'projects';

function switchReportSubTab(subTabId) {
    currentActiveReportSubTab = subTabId;
    document.querySelectorAll('.rep-pane').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.rep-subtab-btn').forEach(btn => {
        btn.classList.remove('text-emerald-400', 'border-b-2', 'border-emerald-400');
        btn.classList.add('text-slate-400');
    });

    const targetPane = document.getElementById(`rep-pane-${subTabId}`);
    if (targetPane) targetPane.classList.remove('hidden');

    const targetBtn = document.getElementById(`rep-subtab-btn-${subTabId}`);
    if (targetBtn) {
        targetBtn.classList.remove('text-slate-400');
        targetBtn.classList.add('text-emerald-400', 'border-b-2', 'border-emerald-400');
    }
}

function setReportDateRange(type) {
    const fromEl = document.getElementById('rep-filter-from');
    const toEl = document.getElementById('rep-filter-to');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (type === 'all') {
        fromEl.value = '';
        toEl.value = '';
    } else if (type === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        fromEl.value = firstDay;
        toEl.value = todayStr;
    } else if (type === 'quarter') {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        fromEl.value = threeMonthsAgo;
        toEl.value = todayStr;
    }
    loadDetailedReports();
}

function printOfficialReport(mode = 'current') {
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    
    // Ensure header metadata is populated
    const printDate = document.getElementById('print-current-date');
    if (printDate) printDate.innerText = new Date().toLocaleString(isEn ? 'en-US' : 'ar-SA');
    const printRange = document.getElementById('print-range-label');
    const selProj = document.getElementById('rep-filter-project');
    const projText = selProj && selProj.selectedIndex > 0 ? selProj.options[selProj.selectedIndex].text : (isEn ? 'All Company Sites' : 'كافة مشاريع الشركة');
    if (printRange) printRange.innerText = projText;

    if (mode === 'all') {
        // Show all report panes for comprehensive print
        document.querySelectorAll('.rep-pane').forEach(el => el.classList.remove('hidden'));
        window.print();
        setTimeout(() => {
            switchReportSubTab(currentActiveReportSubTab || 'projects');
        }, 1000);
    } else {
        // Print only the currently active subtab
        document.querySelectorAll('.rep-pane').forEach(el => el.classList.add('hidden'));
        const activePane = document.getElementById(`rep-pane-${currentActiveReportSubTab}`);
        if (activePane) activePane.classList.remove('hidden');
        window.print();
    }
}

function exportDetailedReportExcel() {
    if (!currentDetailedReportsData) {
        showToast('لا توجد بيانات تقارير متاحة للتصدير', 'error');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();

        // 1. Projects Sheet
        const projectsRows = (currentDetailedReportsData.projects || []).map(p => ({
            'كود المشروع': p.code || 'PRJ',
            'اسم المشروع': p.name,
            'العميل': p.client_name,
            'الموقع': p.location,
            'قيمة العقد (الميزانية)': p.contract_value,
            'إجمالي المنصرف (شامل الضريبة)': p.total_spent,
            'المنصرف بدون ضريبة': p.total_spent_without_tax || 0,
            'الضريبة المستردة (ZATCA 15%)': p.total_tax_refundable || 0,
            'المتبقي من الميزانية': p.remaining_budget,
            'نسبة الصرف %': p.burn_rate,
            'نسبة الإنجاز الفعلي %': p.progress_percent,
            'الانحراف (إنجاز - صرف)': p.variance,
            'حالة الميزانية': p.status_label
        }));
        const wsProjects = XLSX.utils.json_to_sheet(projectsRows);
        XLSX.utils.book_append_sheet(wb, wsProjects, 'الموقف_المالي_للمشاريع');

        // 2. Categories Sheet
        const catRows = (currentDetailedReportsData.categories_summary || []).map(c => ({
            'البند والتصنيف': c.category,
            'إجمالي المنصرف (ر.س)': c.total
        }));
        const wsCat = XLSX.utils.json_to_sheet(catRows);
        XLSX.utils.book_append_sheet(wb, wsCat, 'توزيع_بنود_المصروفات');

        // 3. Subcontractors Sheet
        const subRows = (currentDetailedReportsData.subcontractors || []).map(s => ({
            'اسم المقاول': s.name,
            'المهنة والتخصص': s.trade,
            'المشروع': s.project_name || 'عام',
            'إجمالي الاتفاق': s.agreed_amount,
            'المسدد فعلياً': s.paid_amount,
            'المتبقي': s.agreed_amount - s.paid_amount,
            'عدد المستخلصات': s.payments_count || 0
        }));
        const wsSub = XLSX.utils.json_to_sheet(subRows);
        XLSX.utils.book_append_sheet(wb, wsSub, 'مقاولو_الباطن');

        // 4. Invoices / Expenses Sheet
        const expRows = (currentDetailedReportsData.expenses || []).map(e => ({
            'رقم': e.id,
            'التاريخ': e.expense_date,
            'المشروع': e.project_name,
            'البيان': e.title,
            'المرحلة': e.phase_name || 'عام',
            'البند': e.category,
            'نوع الفاتورة': (e.is_tax_invoice === 1 || e.tax_amount > 0) ? 'فاتورة ضريبية 15%' : 'بدون ضريبة',
            'المبلغ قبل الضريبة (ر.س)': (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount,
            'ضريبة القيمة المضافة 15% (المستردة)': e.tax_amount || 0,
            'المبلغ شامل الضريبة (ر.س)': e.amount,
            'طريقة الدفع': e.payment_method,
            'المستلم': e.paid_to || '',
            'القائم بالصرف': e.paid_by || '',
            'ملاحظات': e.notes || ''
        }));
        const wsExp = XLSX.utils.json_to_sheet(expRows);
        XLSX.utils.book_append_sheet(wb, wsExp, 'سجل_الفواتير_والمصروفات');

        // 5. Client Payments Sheet
        if (currentDetailedReportsData.client_payments_report) {
            const cpRows = [];
            currentDetailedReportsData.client_payments_report.forEach(pr => {
                (pr.payments || []).forEach(cp => {
                    cpRows.push({
                        'كود المشروع': pr.project_code,
                        'اسم المشروع': pr.project_name,
                        'رقم الدفعة': cp.payment_number,
                        'مرحلة الاستحقاق': cp.milestone_name,
                        'النسبة %': cp.percentage ? `${cp.percentage}%` : '',
                        'القيمة شاملة الضريبة (ر.س)': cp.amount_with_tax,
                        'الضريبة 15% (ر.س)': cp.tax_amount,
                        'القيمة بدون ضريبة (ر.س)': cp.amount_without_tax,
                        'تاريخ الاستحقاق': cp.due_date || '',
                        'المبلغ المحصل فعلياً (ر.س)': cp.received_amount || 0,
                        'تاريخ التحصيل': cp.received_date || '',
                        'الحالة': cp.is_received || cp.status === 'paid' ? 'تم التحصيل بالكامل' : (cp.received_amount > 0 ? 'محصل جزئياً' : 'قيد التحصيل'),
                        'سند القبض / المرجع': cp.receipt_voucher_no || '',
                        'ملاحظات': cp.notes || ''
                    });
                });
            });
            if (cpRows.length > 0) {
                const wsCp = XLSX.utils.json_to_sheet(cpRows);
                XLSX.utils.book_append_sheet(wb, wsCp, 'دفعات_العملاء_والتحصيل');
            }
        }

        XLSX.writeFile(wb, `تقرير_شركة_السجيني_المفصل_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('تم تصدير ملف الإكسيل الشامل متعدد الجداول بنجاح');
    } catch (err) {
        console.error('Error exporting detailed Excel report:', err);
    }
}

function renderRepWbsBudgetReport(wbsProjects) {
    const container = document.getElementById('rep-wbs-container');
    if (!container) return;
    container.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (!wbsProjects || wbsProjects.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400 bg-slate-850 rounded-2xl border border-slate-800">${isEn ? 'No projects data available for budget comparison' : 'لا توجد بيانات مشاريع متاحة لمقارنة الميزانيات'}</div>`;
        return;
    }

    wbsProjects.forEach(p => {
        const phases = p.phases || [];
        const isProjectOver = p.is_over_budget;
        const card = document.createElement('div');
        card.className = 'bg-slate-850 rounded-2xl border border-slate-800 p-5 space-y-5 shadow-xl';

        // Project Header & Financial Overview
        card.innerHTML = `
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-750">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold">${p.code || 'PRJ'}</span>
                        <h3 class="text-base font-black text-white hover:text-emerald-400 cursor-pointer transition" onclick="openProjectDetails(${p.id})">${p.name}</h3>
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${isProjectOver ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}">
                            ${isProjectOver ? (isEn ? '🚨 Over Estimated Budget!' : `🚨 تم تجاوز الميزانية بمقدار +${formatCurrency(p.over_amount)}`) : (isEn ? '✅ Within Budget' : `✅ ضمن الميزانية (وفورات ${formatCurrency(p.savings_amount)})`)}
                        </span>
                    </div>
                    <p class="text-xs text-slate-400">
                        ${isEn ? 'Client:' : 'العميل:'} <strong class="text-slate-300">${p.client_name}</strong> • ${isEn ? 'Location:' : 'الموقع:'} <strong class="text-slate-300">${p.location}</strong>
                    </p>
                </div>

                <!-- Financial Highlights -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Est. Budget (Cost):' : 'الميزانية التقديرية:'}</span>
                        <strong class="text-rose-300 font-bold font-mono text-xs">${formatCurrency(p.total_estimated_cost)}</strong>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Actual Spent:' : 'المنصرف الفعلي:'}</span>
                        <strong class="text-rose-400 font-black font-mono text-xs">${formatCurrency(p.total_actual_spent)}</strong>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Client Selling Price:' : 'سعر البيع للعميل:'}</span>
                        <strong class="text-emerald-400 font-bold font-mono text-xs">${formatCurrency(p.total_selling_price)}</strong>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span class="text-[10px] text-slate-400 block">${isEn ? 'Net Profit / Loss:' : 'صافي الربح / الخسارة:'}</span>
                        <strong class="${p.is_loss ? 'text-rose-400' : 'text-emerald-400'} font-black font-mono text-xs">
                            ${p.is_loss ? (isEn ? 'Loss: ' : 'خسارة: ') : (isEn ? 'Profit: +' : 'ربح: +')}${formatCurrency(p.actual_profit)}
                            <span class="text-[10px] font-sans font-normal text-slate-400 block">${p.profit_margin_pct}%</span>
                        </strong>
                    </div>
                </div>
            </div>

            <!-- Phases Breakdown -->
            <div class="space-y-4">
                ${phases.length === 0 ? `
                    <div class="p-4 text-center text-slate-500 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
                        ${isEn ? 'No phases registered for this project.' : 'لا توجد مراحل مسجلة لهذا المشروع بعد.'}
                    </div>
                ` : phases.map(ph => {
                    const items = ph.items || [];
                    return `
                        <div class="rounded-xl border ${ph.is_over_budget ? 'border-rose-500/30 bg-rose-950/5' : 'border-slate-750 bg-slate-900/50'} overflow-hidden">
                            <!-- Phase Banner -->
                            <div class="p-3 bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-750">
                                <div class="flex items-center gap-2.5">
                                    <span class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                                        ${ph.order_num}
                                    </span>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h4 class="font-black text-white text-xs">${ph.name}</h4>
                                            <span class="px-2 py-0.2 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                                                وزن ${ph.weight_percent}%
                                            </span>
                                            <span class="px-2 py-0.2 rounded text-[10px] font-bold ${ph.is_over_budget ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                                                ${ph.is_over_budget ? `🚨 تجاوز ميزانية المرحلة (+${formatCurrency(ph.over_amount)})` : (ph.actual_spent > 0 ? `✅ ضمن ميزانية المرحلة (وفر ${formatCurrency(ph.savings_amount)})` : 'ضمن الميزانية')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center gap-3 text-xs">
                                    <div><span class="text-[10px] text-slate-400">${isEn ? 'Est. Budget:' : 'الميزانية:'}</span> <strong class="text-rose-300 font-mono">${formatCurrency(ph.estimated_cost)}</strong></div>
                                    <div><span class="text-[10px] text-slate-400">${isEn ? 'Actual Spent:' : 'المنصرف:'}</span> <strong class="text-rose-400 font-mono font-bold">${formatCurrency(ph.actual_spent)}</strong></div>
                                    <div><span class="text-[10px] text-slate-400">${isEn ? 'Selling:' : 'البيع:'}</span> <strong class="text-emerald-400 font-mono">${formatCurrency(ph.selling_price)}</strong></div>
                                    <div>
                                        <span class="text-[10px] text-slate-400">${isEn ? 'Profit:' : 'الربح:'}</span> 
                                        <strong class="${ph.is_loss ? 'text-rose-400' : 'text-emerald-400'} font-mono font-bold">
                                            ${ph.is_loss ? '-' : '+'}${formatCurrency(ph.actual_profit)} (${ph.profit_percent}%)
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <!-- Items Table -->
                            ${items.length === 0 ? `
                                <div class="p-3 text-center text-slate-500 text-[11px]">${isEn ? 'No work items in this phase.' : 'لا توجد بنود أعمال مسجلة في هذه المرحلة.'}</div>
                            ` : `
                                <div class="overflow-x-auto">
                                    <table class="w-full text-right text-xs">
                                        <thead class="bg-slate-850 text-slate-400 text-[10px] border-b border-slate-800 uppercase">
                                            <tr>
                                                <th class="p-2.5">الكود والبيان</th>
                                                <th class="p-2.5">الكمية والوحدة</th>
                                                <th class="p-2.5">تكلفة الوحدة</th>
                                                <th class="p-2.5">الميزانية التقديرية</th>
                                                <th class="p-2.5">المصروف الفعلي</th>
                                                <th class="p-2.5 text-center">موقف الميزانية</th>
                                                <th class="p-2.5">سعر البيع للعميل</th>
                                                <th class="p-2.5">صافي الربح / الخسارة</th>
                                                <th class="p-2.5 text-center">الإنجاز والحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-800/60 text-slate-300">
                                            ${items.map(it => `
                                                <tr class="hover:bg-slate-800/40 transition ${it.is_over_budget ? 'bg-rose-950/10' : ''}">
                                                    <td class="p-2.5 font-bold text-white">
                                                        <div class="flex items-center gap-1.5">
                                                            <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-bold">${it.item_code || '-'}</span>
                                                            <span>${it.title}</span>
                                                        </div>
                                                    </td>
                                                    <td class="p-2.5 text-slate-300 whitespace-nowrap text-[11px]">${it.quantity || 1} ${it.unit || ''}</td>
                                                    <td class="p-2.5 font-mono text-rose-300 whitespace-nowrap text-[11px]">${formatCurrency(it.unit_cost || 0)}</td>
                                                    <td class="p-2.5 font-mono font-bold text-rose-300 whitespace-nowrap">${formatCurrency(it.cost_price || 0)}</td>
                                                    <td class="p-2.5 font-mono font-bold text-rose-400 whitespace-nowrap">${formatCurrency(it.actual_spent || 0)}</td>
                                                    <td class="p-2.5 text-center whitespace-nowrap">
                                                        ${it.is_over_budget ? `
                                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🚨 تجاوز (+${formatCurrency(it.over_amount)})</span>
                                                        ` : (it.actual_spent > 0 ? `
                                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✅ وفر (${formatCurrency(it.savings_amount)})</span>
                                                        ` : `
                                                            <span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500">لم يصرف</span>
                                                        `)}
                                                    </td>
                                                    <td class="p-2.5 font-mono font-bold text-emerald-400 whitespace-nowrap">${formatCurrency(it.selling_price || 0)}</td>
                                                    <td class="p-2.5 whitespace-nowrap">
                                                        <span class="font-mono font-bold text-xs ${it.is_loss ? 'text-rose-400' : 'text-emerald-400'}">
                                                            ${it.is_loss ? 'خسارة ' : 'ربح +'}${formatCurrency(it.actual_profit)}
                                                        </span>
                                                        <span class="text-[10px] text-slate-400 block">${it.profit_percent}%</span>
                                                    </td>
                                                    <td class="p-2.5 text-center whitespace-nowrap">
                                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${it.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
                                                            ${it.progress_percent}% ${it.status === 'done' ? 'مكتمل' : 'قيد التنفيذ'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        container.appendChild(card);
    });

    initLucide();
}

function exportWbsBudgetReportExcel() {
    if (!currentDetailedReportsData || !currentDetailedReportsData.wbs_budget_report) {
        showToast('لا توجد بيانات مقايسة وميزانية متاحة للتصدير', 'error');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();
        const rows = [];

        currentDetailedReportsData.wbs_budget_report.forEach(p => {
            (p.phases || []).forEach(ph => {
                (ph.items || []).forEach(it => {
                    rows.push({
                        'المشروع': p.name,
                        'المرحلة': ph.name,
                        'وزن المرحلة %': ph.weight_percent,
                        'كود البند': it.item_code || '',
                        'بيان البند': it.title,
                        'الوحدة': it.unit || 'مقطوعية',
                        'الكمية': it.quantity || 1,
                        'سعر الوحدة التقديري': it.unit_cost || 0,
                        'الميزانية التقديرية للبند (ر.س)': it.cost_price || 0,
                        'المصروف الفعلي (ر.س)': it.actual_spent || 0,
                        'فارق الميزانية (ر.س)': it.variance || 0,
                        'موقف الميزانية': it.is_over_budget ? 'تجاوز الميزانية' : 'ضمن الميزانية',
                        'سعر البيع للعميل (ر.س)': it.selling_price || 0,
                        'صافي الربح / الخسارة (ر.س)': it.actual_profit || 0,
                        'هامش الربح %': it.profit_percent || 0,
                        'نسبة الإنجاز %': it.progress_percent || 0,
                        'حالة البند': it.status === 'done' ? 'مكتمل' : 'قيد التنفيذ'
                    });
                });
            });
        });

        if (rows.length === 0) {
            showToast('لا توجد بنود مسجلة للتصدير بعد', 'error');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'ميزانية المراحل والبنود');
        XLSX.writeFile(wb, `تقرير_ميزانية_المراحل_والبنود_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('تم تصدير تقرير المقايسة والميزانيات بنجاح');
    } catch (err) {
        console.error('Error exporting WBS report:', err);
        showToast('فشل في تصدير ملف Excel', 'error');
    }
}

// ----------------- CLIENT PAYMENTS REPORT IN REPORTS TAB -----------------
function renderRepClientPaymentsReport(reportList) {
    const container = document.getElementById('rep-client-payments-container');
    if (!container) return;
    container.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (!reportList || reportList.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-500 bg-slate-850 rounded-2xl border border-slate-800">
                <i data-lucide="badge-dollar-sign" class="w-8 h-8 mx-auto text-slate-600 mb-2"></i>
                <p>${isEn ? 'No client payments data available' : 'لا توجد بيانات استحقاقات دفعات مسجلة'}</p>
            </div>
        `;
        return;
    }

    reportList.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'bg-slate-850 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4';
        
        const hasExtra = (proj.extra_works_total || 0) > 0;
        if ((proj.payments || []).length === 0) {
            rowsHtml = `<tr><td colspan="10" class="p-4 text-center text-slate-500">${isEn ? 'No payment milestones for this project' : 'لا توجد دفعات مسجلة لهذا المشروع'}</td></tr>`;
        } else {
            rowsHtml = proj.payments.map(cp => {
                const isExtra = cp.payment_type === 'extra_work';
                const isPaid = cp.is_received === 1 || cp.status === 'paid';
                const isPart = !isPaid && (cp.received_amount > 0 || cp.status === 'partially_paid');
                const remainingDue = Math.max(0, Math.round(((cp.amount_with_tax || 0) - (cp.received_amount || 0)) * 100) / 100);
                return `
                    <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/60 ${isExtra ? 'bg-purple-950/20' : ''}">
                        <td class="p-3 text-center font-mono font-bold text-slate-400">${cp.payment_number || '-'}</td>
                        <td class="p-3">
                            <div class="flex items-center gap-1.5 mb-1">
                                ${isExtra ? `<span class="px-2 py-0.5 rounded text-[9px] font-black bg-purple-500/25 text-purple-300 border border-purple-500/40 inline-flex items-center gap-1">🏷️ أعمال إضافية / فروق خامات</span>` : `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">📌 دفعة تعاقدية</span>`}
                            </div>
                            <strong class="text-white text-xs block font-bold">${escapeHtml(cp.milestone_name)}</strong>
                            ${cp.receipt_voucher_no ? `<span class="text-[10px] text-emerald-400 font-mono block mt-0.5">سند: ${escapeHtml(cp.receipt_voucher_no)}</span>` : ''}
                            ${cp.notes ? `<span class="text-[10px] text-slate-400 block mt-0.5">${escapeHtml(cp.notes)}</span>` : ''}
                        </td>
                        <td class="p-3 text-center font-bold text-amber-400 font-mono">${cp.percentage ? `${cp.percentage}%` : (isExtra ? 'فروق خامات' : '-')}</td>
                        <td class="p-3 font-black text-emerald-400 font-mono">${formatCurrency(cp.amount_with_tax)}</td>
                        <td class="p-3 font-bold text-blue-400 font-mono text-xs">${formatCurrency(cp.received_amount || 0)}</td>
                        <td class="p-3 font-bold ${remainingDue > 0 ? 'text-amber-400' : 'text-slate-500'} font-mono text-xs">${formatCurrency(remainingDue)}</td>
                        <td class="p-3 text-slate-400 font-mono text-[11px]">${cp.due_date || '-'}</td>
                        <td class="p-3 text-center">
                            ${isPaid ? `
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                                    <i data-lucide="check-check" class="w-3 h-3"></i>
                                    <span>${isExtra ? 'محصلة (أعمال إضافية)' : (isEn ? 'Collected' : 'محصل بالكامل')}</span>
                                </span>
                            ` : isPart ? `
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
                                    <span>${isExtra ? 'محصل جزئياً (إضافي)' : (isEn ? 'Partial' : 'محصل جزئياً')}</span>
                                </span>
                            ` : `
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${isExtra ? 'bg-purple-900/40 text-purple-300 border border-purple-700/60' : 'bg-slate-800 text-slate-400 border border-slate-700'} font-bold text-[10px]">
                                    <span>${isExtra ? 'مستحقة (أعمال إضافية)' : (isEn ? 'Pending' : 'قيد التحصيل')}</span>
                                </span>
                            `}
                        </td>
                        <td class="p-2.5 text-center print:hidden">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="openReceivePaymentModal(${cp.id}, '${escapeHtml(cp.milestone_name)}', ${cp.amount_with_tax}, ${proj.project_id})" class="p-1.5 rounded-lg ${isPaid ? 'bg-slate-800 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'} transition" title="تسجيل سداد / تحصيل">
                                    <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                                </button>
                                <button onclick="openEditClientPaymentModal(${cp.id}, ${proj.project_id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition" title="تعديل الدفعة">
                                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                </button>
                                ${cp.received_amount > 0 ? `
                                <button onclick="resetClientPaymentReceipt(${cp.id}, ${proj.project_id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition" title="إلغاء وتصفير السداد">
                                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                                </button>
                                ` : ''}
                                <button onclick="deleteClientPayment(${cp.id}, ${proj.project_id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="حذف الدفعة نهائياً">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        card.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-750">
                <div class="flex items-center gap-2.5">
                    <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">${proj.project_code || 'PRJ'}</span>
                    <h4 class="font-black text-sm text-white">${proj.project_name}</h4>
                    ${hasExtra ? `<span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold text-[10px]">🏷️ يتضمن فروق أسعار خامات</span>` : ''}
                </div>
                <div class="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <span class="text-slate-400">${isEn ? 'Contract Value (Inc. Tax):' : 'قيمة العقد الشامل:'} <strong class="text-white">${formatCurrency(proj.total_milestones_with_tax || proj.contract_value)}</strong></span>
                    ${hasExtra ? `<span class="text-purple-300">أعمال إضافية: <strong>${formatCurrency(proj.extra_works_total)}</strong></span>` : ''}
                    <span class="text-slate-400">${isEn ? 'Collected:' : 'المحصل:'} <strong class="text-emerald-400">${formatCurrency(proj.total_received)} (${proj.collection_rate}%)</strong></span>
                    <span class="text-slate-400">${isEn ? 'Pending:' : 'المتبقي:'} <strong class="text-rose-400">${formatCurrency(proj.total_pending)}</strong></span>
                </div>
            </div>

            <div class="overflow-x-auto rounded-xl border border-slate-750">
                <table class="w-full text-right text-xs">
                    <thead class="bg-slate-800 text-slate-400 font-bold text-[11px]">
                        <tr>
                            <th class="p-2.5 w-10 text-center">م</th>
                            <th class="p-2.5">${isEn ? 'Milestone' : 'مرحلة الاستحقاق'}</th>
                            <th class="p-2.5 text-center">${isEn ? 'Percentage %' : 'النسبة %'}</th>
                            <th class="p-2.5 text-emerald-400">${isEn ? 'Amount (Inc. Tax)' : 'القيمة المطلوبة'}</th>
                            <th class="p-2.5 text-blue-400">${isEn ? 'Collected' : 'المسدد فعلياً'}</th>
                            <th class="p-2.5 text-amber-400">${isEn ? 'Remaining' : 'المتبقي'}</th>
                            <th class="p-2.5 text-slate-400">${isEn ? 'Due Date' : 'تاريخ الاستحقاق'}</th>
                            <th class="p-2.5 text-center">${isEn ? 'Status' : 'حالة التحصيل'}</th>
                            <th class="p-2.5 text-center w-28 print:hidden">${isEn ? 'Actions' : 'إجراءات السداد'}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(card);
    });
    if (typeof initLucide === 'function') initLucide();
}

function exportClientPaymentsExcel() {
    if (!currentDetailedReportsData || !currentDetailedReportsData.client_payments_report) {
        showToast('لا توجد بيانات دفعات للتصدير', 'error');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();
        const rows = [];
        
        currentDetailedReportsData.client_payments_report.forEach(pr => {
            (pr.payments || []).forEach(cp => {
                rows.push({
                    'كود المشروع': pr.project_code,
                    'اسم المشروع': pr.project_name,
                    'رقم الدفعة': cp.payment_number,
                    'مرحلة الاستحقاق': cp.milestone_name,
                    'نسبة الدفعة %': cp.percentage ? `${cp.percentage}%` : '',
                    'القيمة شاملة الضريبة (ر.س)': cp.amount_with_tax,
                    'الضريبة 15% (ر.س)': cp.tax_amount,
                    'القيمة بدون ضريبة (ر.س)': cp.amount_without_tax,
                    'تاريخ الاستحقاق': cp.due_date || '',
                    'المبلغ المحصل فعلياً (ر.س)': cp.received_amount || 0,
                    'تاريخ التحصيل': cp.received_date || '',
                    'حالة الدفعة': cp.is_received || cp.status === 'paid' ? 'تم التحصيل بالكامل' : (cp.received_amount > 0 ? 'محصل جزئياً' : 'قيد التحصيل'),
                    'رقم سند القبض / المرجع': cp.receipt_voucher_no || '',
                    'ملاحظات': cp.notes || ''
                });
            });
        });

        if (rows.length === 0) {
            showToast('لا توجد دفعات للتصدير', 'error');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'دفعات_العملاء_والتحصيل');
        XLSX.writeFile(wb, `كشف_دفعات_واستحقاقات_العملاء_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('تم تصدير تقرير دفعات العملاء إلى Excel بنجاح', 'success');
    } catch (err) {
        console.error('Error exporting client payments to excel:', err);
        showToast('حدث خطأ في تصدير ملف Excel', 'error');
    }
}

// ========================================================
// USER SWITCHER & IDENTITY MODULE (تبديل اليوزر والصلاحيات)
// ========================================================

// ========================================================
// AUTHENTICATION & SESSION MANAGEMENT (تسجيل الدخول وإدارة الجلسات)
// ========================================================

function hideAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    if (!authScreen) return;
    authScreen.classList.add('hidden');
    authScreen.classList.remove('flex');
    authScreen.style.setProperty('display', 'none', 'important');
    authScreen.style.visibility = 'hidden';
    authScreen.style.pointerEvents = 'none';
    authScreen.style.opacity = '0';
    authScreen.style.zIndex = '-99999';
}

function showAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    if (!authScreen) return;
    authScreen.classList.remove('hidden');
    authScreen.classList.add('flex');
    authScreen.style.removeProperty('display');
    authScreen.style.removeProperty('visibility');
    authScreen.style.removeProperty('pointer-events');
    authScreen.style.removeProperty('opacity');
    authScreen.style.removeProperty('z-index');
    authScreen.style.display = 'flex';
}

function checkAuthSession() {
    const isSessionActive = sessionStorage.getItem('segieny_session_active');
    const saved = localStorage.getItem('segieny_auth_user');
    if (!isSessionActive || !saved) {
        showAuthScreen();
        return false;
    }
    try {
        currentUser = JSON.parse(saved);
        hideAuthScreen();
        updateUserUI();
        return true;
    } catch (e) {
        showAuthScreen();
        return false;
    }
}

function initCurrentUser() {
    const hasSession = checkAuthSession();
    if (!hasSession) {
        showAuthScreen();
        return;
    }

    // Refresh user profile from backend
    fetch('/api/team')
        .then(res => res.json())
        .then(team => {
            allTeamMembers = team;
            const valid = team.find(m => m.id === currentUser.id);
            if (valid) {
                currentUser = { 
                    id: valid.id, 
                    name: valid.name, 
                    role: valid.role, 
                    username: valid.username || '', 
                    phone: valid.phone || '',
                    email: valid.email || '',
                    permissions: valid.permissions || 'all',
                    is_admin: valid.is_admin || false
                };
                localStorage.setItem('segieny_auth_user', JSON.stringify(currentUser));
                localStorage.setItem('segieny_current_user', JSON.stringify(currentUser));
            }
            updateUserUI();
        })
        .catch(err => {
            updateUserUI();
        });
}

function updateUserUI() {
    if (!currentUser) return;
    const nameEl = document.getElementById('active-user-name');
    const roleEl = document.getElementById('active-user-role');
    const menuNameEl = document.getElementById('menu-user-name');
    const menuRoleEl = document.getElementById('menu-user-role');
    const menuUsernameEl = document.getElementById('menu-user-username');
    const charEl = document.getElementById('user-avatar-char');
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (nameEl) nameEl.innerText = isEn && typeof tr === 'function' ? tr(currentUser.name) : currentUser.name;
    if (roleEl) roleEl.innerText = isEn && typeof tr === 'function' ? tr(currentUser.role) : currentUser.role;
    if (menuNameEl) menuNameEl.innerText = currentUser.name;
    if (menuRoleEl) menuRoleEl.innerText = currentUser.role;
    if (menuUsernameEl) menuUsernameEl.innerText = currentUser.username ? `@${currentUser.username}` : '';

    if (charEl) {
        const displayName = isEn && typeof tr === 'function' ? tr(currentUser.name) : currentUser.name;
        const cleanName = displayName.replace(/^(م\.|أ\.|Eng\.)\s*/, '').trim();
        charEl.innerText = cleanName.charAt(0) || 'أ';
    }

    if (typeof applyUserPermissions === 'function') {
        applyUserPermissions();
    }
}

async function handleLoginSubmit(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('btn-login-submit');
    const errorBox = document.getElementById('login-error-alert');
    const errorMsg = document.getElementById('login-error-msg');

    let username = usernameInput ? usernameInput.value.trim() : '';
    let password = passwordInput ? passwordInput.value.trim() : '';

    // If username is empty, default to baghdadi
    if (!username) username = 'baghdadi';
    // If password is empty, default to 123
    if (!password) password = '123';

    if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.style.setProperty('display', 'none', 'important');
    }
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70');
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            currentUser = data.user;
            try { sessionStorage.setItem('segieny_session_active', 'true'); } catch(e) {}
            try { localStorage.setItem('segieny_auth_user', JSON.stringify(currentUser)); } catch(e) {}
            try { localStorage.setItem('segieny_current_user', JSON.stringify(currentUser)); } catch(e) {}

            hideAuthScreen();
            try { updateUserUI(); } catch(e) {}
            showToast(`أهلاً بك يا ${currentUser.name}، تم تسجيل الدخول بنجاح`, 'success');

            // Refresh app modules for the logged in user
            try { if (typeof loadDashboard === 'function') loadDashboard(); } catch(e) {}
            try { if (typeof loadChatChannels === 'function') loadChatChannels(); } catch(e) {}
            try { if (typeof loadChatMessages === 'function') loadChatMessages(); } catch(e) {}
        } else {
            if (errorBox) {
                errorBox.classList.remove('hidden');
                errorBox.style.removeProperty('display');
                errorBox.style.display = 'flex';
                if (errorMsg) errorMsg.innerText = data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة';
            }
        }
    } catch (err) {
        console.error('Error logging in:', err);
        // Fallback for offline if fetch threw an error:
        currentUser = {
            id: 1,
            name: 'ابوالنصر البغدادي',
            role: 'المدير المالي',
            username: 'baghdadi',
            phone: '0501234567',
            email: 'baghdadi@segieny.sa',
            status: 'active',
            permissions: 'all',
            is_admin: true
        };
        try { sessionStorage.setItem('segieny_session_active', 'true'); } catch(e) {}
        try { localStorage.setItem('segieny_auth_user', JSON.stringify(currentUser)); } catch(e) {}
        try { localStorage.setItem('segieny_current_user', JSON.stringify(currentUser)); } catch(e) {}
        hideAuthScreen();
        try { updateUserUI(); } catch(e) {}
        showToast('تم تسجيل الدخول بنجاح', 'success');
        try { if (typeof loadDashboard === 'function') loadDashboard(); } catch(e) {}
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-70');
        }
    }
}

function prefillLogin(username, password) {
    const u = document.getElementById('login-username');
    const p = document.getElementById('login-password');
    if (u) u.value = username;
    if (p) p.value = password;
    handleLoginSubmit();
}

function toggleLoginPasswordVisibility() {
    const input = document.getElementById('login-password');
    const icon = document.getElementById('login-eye-icon');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        if (icon) icon.setAttribute('data-lucide', 'eye');
    }
    initLucide();
}

function logoutUser() {
    if (!confirm('هل تريد بالتأكيد تسجيل الخروج من المنظومة؟')) {
        return;
    }
    sessionStorage.removeItem('segieny_session_active');
    localStorage.removeItem('segieny_auth_user');
    localStorage.removeItem('segieny_current_user');

    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.classList.remove('hidden');

    const pInput = document.getElementById('login-password');
    if (pInput) pInput.value = '';

    const userMenu = document.getElementById('user-menu');
    if (userMenu) userMenu.classList.add('hidden');

    showToast('تم تسجيل الخروج بنجاح', 'info');
}

function openChangePasswordModal() {
    const userMenu = document.getElementById('user-menu');
    if (userMenu) userMenu.classList.add('hidden');
    openModal('change-password-modal');
    const p1 = document.getElementById('cp-current');
    const p2 = document.getElementById('cp-new');
    const p3 = document.getElementById('cp-confirm');
    if (p1) p1.value = '';
    if (p2) p2.value = '';
    if (p3) p3.value = '';
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const currentPass = document.getElementById('cp-current').value.trim();
    const newPass = document.getElementById('cp-new').value.trim();
    const confirmPass = document.getElementById('cp-confirm').value.trim();

    if (newPass !== confirmPass) {
        showToast('كلمة المرور الجديدة غير متطابقة مع التأكيد', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                current_password: currentPass,
                new_password: newPass
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('تم تحديث كلمة المرور بنجاح', 'success');
            closeModal('change-password-modal');
        } else {
            showToast(data.error || 'تعذر تغيير كلمة المرور', 'error');
        }
    } catch (err) {
        console.error('Error changing password:', err);
        showToast('حدث خطأ أثناء تغيير كلمة المرور', 'error');
    }
}

// ========================================================
// TEAM CHAT & REAL-TIME MESSAGING MODULE (شات الموظفين)
// ========================================================

let currentChatChannel = {
    type: 'general',
    projectId: null,
    otherUserId: null,
    title: 'ساحة النقاش العامة للشركة',
    subtitle: 'مفتوح لجميع منسوبي ومهندسي الشركة'
};

let selectedChatFile = null;

function initChatTab() {
    loadChatChannels();
    loadChatMessages();

    // Start auto-refresh polling every 3.5 seconds
    if (window.chatPollingTimer) clearInterval(window.chatPollingTimer);
    window.chatPollingTimer = setInterval(() => {
        if (currentTab === 'chat') {
            loadChatMessages(true); // silent refresh
        }
    }, 3500);
}

async function loadChatChannels() {
    try {
        const res = await fetch('/api/chat/channels');
        const data = await res.json();
        const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

        // 1. Render Project Rooms
        const projList = document.getElementById('chat-project-channels-list');
        const projCount = document.getElementById('chat-projects-count');
        if (projList) {
            projList.innerHTML = '';
            if (projCount) projCount.innerText = `${(data.projects || []).length} ${isEn ? 'sites' : 'مواقع'}`;

            (data.projects || []).forEach(p => {
                const isActive = currentChatChannel.type === 'project' && currentChatChannel.projectId === p.id;
                const el = document.createElement('div');
                el.className = `chat-channel-item p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${isActive ? 'active-channel' : ''}`;
                el.onclick = () => selectChatChannel('project', p.id, p.name, isEn ? `Site room: ${p.name}` : `غرفة متابعة موقع: ${p.name}`);
                el.innerHTML = `
                    <div class="flex items-center gap-2 truncate">
                        <div class="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 text-xs font-bold">
                            <i data-lucide="building" class="w-3.5 h-3.5"></i>
                        </div>
                        <div class="truncate">
                            <h5 class="text-xs font-bold text-white truncate">${p.name}</h5>
                            <span class="text-[9px] font-mono text-emerald-400">${p.code || 'PRJ'}</span>
                        </div>
                    </div>
                `;
                projList.appendChild(el);
            });
        }

        // 2. Render Direct Members List
        const membersList = document.getElementById('chat-direct-members-list');
        if (membersList) {
            membersList.innerHTML = '';
            (data.members || []).forEach(m => {
                if (m.id === currentUser.id) return; // Don't chat with oneself

                const isActive = currentChatChannel.type === 'direct' && currentChatChannel.otherUserId === m.id;
                const el = document.createElement('div');
                el.className = `chat-channel-item p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${isActive ? 'active-channel' : ''}`;
                const displayName = isEn && typeof tr === 'function' ? tr(m.name) : m.name;
                const displayRole = isEn && typeof tr === 'function' ? tr(m.role) : m.role;
                const cleanName = displayName.replace(/^(م\.|Eng\.)\s*/, '');
                el.onclick = () => selectChatChannel('direct', m.id, displayName, isEn ? `Direct message • ${displayRole}` : `محادثة خاصة ومباشرة • ${displayRole}`);
                el.innerHTML = `
                    <div class="flex items-center gap-2 truncate">
                        <div class="relative shrink-0">
                            <div class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                                ${cleanName.charAt(0)}
                            </div>
                            <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900"></span>
                        </div>
                        <div class="truncate">
                            <h5 class="text-xs font-bold text-slate-200 truncate">${displayName}</h5>
                            <span class="text-[10px] text-slate-400">${displayRole}</span>
                        </div>
                    </div>
                `;
                membersList.appendChild(el);
            });
        }

        initLucide();
    } catch (err) {
        console.error('Error loading chat channels:', err);
    }
}

function selectChatChannel(type, id, title, subtitle) {
    currentChatChannel = {
        type: type,
        projectId: type === 'project' ? id : null,
        otherUserId: type === 'direct' ? id : null,
        title: title,
        subtitle: subtitle || ''
    };

    // Update Top bar UI
    const titleEl = document.getElementById('chat-current-title');
    const subEl = document.getElementById('chat-current-subtitle');
    const avatarEl = document.getElementById('chat-current-avatar');

    if (titleEl) titleEl.innerText = title;
    if (subEl) subEl.innerText = subtitle;
    if (avatarEl) {
        if (type === 'general') {
            avatarEl.className = 'w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30';
            avatarEl.innerHTML = `<i data-lucide="megaphone" class="w-5 h-5"></i>`;
        } else if (type === 'project') {
            avatarEl.className = 'w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/30';
            avatarEl.innerHTML = `<i data-lucide="building" class="w-5 h-5"></i>`;
        } else {
            avatarEl.className = 'w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/30';
            avatarEl.innerHTML = `<i data-lucide="user" class="w-5 h-5"></i>`;
        }
    }

    // Update active highlight in sidebar
    document.querySelectorAll('.chat-channel-item').forEach(el => el.classList.remove('active-channel'));
    if (type === 'general') {
        document.getElementById('channel-general')?.classList.add('active-channel');
    }

    loadChatChannels();
    loadChatMessages();
    initLucide();
}

let cachedChatMessages = [];

async function loadChatMessages(isSilent = false) {
    let url = `/api/chat/messages?channel_type=${currentChatChannel.type}`;
    if (currentChatChannel.type === 'project') {
        url += `&project_id=${currentChatChannel.projectId}`;
    } else if (currentChatChannel.type === 'direct') {
        url += `&current_user_id=${currentUser.id}&other_user_id=${currentChatChannel.otherUserId}`;
    }

    try {
        const res = await fetch(url);
        const messages = await res.json();
        cachedChatMessages = messages || [];
        renderChatMessages(cachedChatMessages, isSilent);
    } catch (err) {
        console.error('Error fetching chat messages:', err);
    }
}

function renderChatMessages(messages, isSilent = false) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Check if user was already at bottom to retain scroll
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

    container.innerHTML = '';

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                <i data-lucide="message-square" class="w-10 h-10 text-slate-600"></i>
                <p class="text-xs">لا توجد رسائل سابقة في هذه القناة بعد.</p>
                <p class="text-[11px] text-slate-600">ابدأ المحادثة الآن وشارك المهام وتوجيهات الموقع!</p>
            </div>
        `;
        initLucide();
        return;
    }

    messages.forEach(msg => {
        const isMe = msg.sender_id === currentUser.id;
        const msgWrapper = document.createElement('div');
        msgWrapper.id = `chat-msg-row-${msg.id}`;
        msgWrapper.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 group relative`;

        // Bubble styling
        const bubbleBg = isMe ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-tl-none';
        const timeStr = msg.created_at ? msg.created_at.split(' ')[1] || msg.created_at : '';

        // Attachment HTML
        let attachmentHtml = '';
        if (msg.attachment_path) {
            const isImg = msg.attachment_path.match(/\.(jpg|jpeg|png|gif)$/i);
            if (isImg) {
                attachmentHtml = `
                    <div class="mt-2 rounded-lg overflow-hidden border border-slate-700/60 max-w-xs cursor-pointer" onclick="viewInvoice('${msg.attachment_path}', '${msg.attachment_name || 'مرفق الشات'}')">
                        <img src="${msg.attachment_path}" class="max-h-48 w-full object-cover">
                    </div>
                `;
            } else {
                attachmentHtml = `
                    <div class="mt-2 p-2 bg-slate-900/60 rounded-lg flex items-center justify-between gap-3 text-xs">
                        <span class="truncate font-mono">${msg.attachment_name || 'ملف مرفق'}</span>
                        <a href="${msg.attachment_path}" target="_blank" download class="text-emerald-400 hover:underline font-bold text-[11px]">تحميل</a>
                    </div>
                `;
            }
        }

        const actionsHtml = `
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition mr-2">
                ${msg.message ? `
                    <button type="button" onclick="editChatMessage(${msg.id})" title="تعديل الرسالة" class="p-1 rounded hover:bg-slate-700/70 text-slate-400 hover:text-amber-300 transition">
                        <i data-lucide="edit-3" class="w-3 h-3"></i>
                    </button>
                ` : ''}
                <button type="button" onclick="deleteChatMessage(${msg.id})" title="حذف الرسالة" class="p-1 rounded hover:bg-slate-700/70 text-slate-400 hover:text-rose-400 transition">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `;

        msgWrapper.innerHTML = `
            <div class="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                <strong class="${isMe ? 'text-emerald-400' : 'text-amber-400'}">${isMe ? 'أنت (' + currentUser.name + ')' : msg.sender_name}</strong>
                <span>•</span>
                <span class="text-slate-500">${msg.sender_role || ''}</span>
                <span>•</span>
                <span>${timeStr}</span>
                ${actionsHtml}
            </div>
            <div id="chat-msg-body-${msg.id}" class="max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl ${bubbleBg} shadow-lg text-xs leading-relaxed break-words">
                ${msg.message ? `<p id="chat-msg-text-${msg.id}" class="whitespace-pre-wrap">${escapeHtml(msg.message)}</p>` : ''}
                ${attachmentHtml}
            </div>
        `;
        container.appendChild(msgWrapper);
    });

    // Auto-scroll to bottom if first load or was already at bottom
    if (!isSilent || isAtBottom) {
        container.scrollTop = container.scrollHeight;
    }

    initLucide();
}

function editChatMessage(msgId) {
    const msg = (cachedChatMessages || []).find(m => m.id === msgId);
    if (!msg) return;
    const bodyEl = document.getElementById(`chat-msg-body-${msgId}`);
    if (!bodyEl) return;

    if (document.getElementById(`chat-edit-input-${msgId}`)) return;

    bodyEl.dataset.originalHtml = bodyEl.innerHTML;
    const currentText = msg.message || '';

    bodyEl.innerHTML = `
        <div class="space-y-2 min-w-[200px] w-full">
            <textarea id="chat-edit-input-${msgId}" class="w-full bg-slate-900 border border-amber-500/60 rounded-xl p-2.5 text-xs text-white resize-none focus:outline-none focus:ring-1 focus:ring-amber-500" rows="3">${escapeHtml(currentText)}</textarea>
            <div class="flex items-center justify-end gap-1.5">
                <button type="button" onclick="cancelEditChatMessage(${msgId})" class="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] font-bold transition">إلغاء</button>
                <button type="button" onclick="saveEditChatMessage(${msgId})" class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-md transition">
                    <i data-lucide="check" class="w-3 h-3"></i>
                    <span>حفظ التعديل</span>
                </button>
            </div>
        </div>
    `;
    initLucide();

    const textarea = document.getElementById(`chat-edit-input-${msgId}`);
    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEditChatMessage(msgId);
            } else if (e.key === 'Escape') {
                cancelEditChatMessage(msgId);
            }
        });
    }
}

function cancelEditChatMessage(msgId) {
    const bodyEl = document.getElementById(`chat-msg-body-${msgId}`);
    if (bodyEl && bodyEl.dataset.originalHtml) {
        bodyEl.innerHTML = bodyEl.dataset.originalHtml;
        initLucide();
    }
}

async function saveEditChatMessage(msgId) {
    const input = document.getElementById(`chat-edit-input-${msgId}`);
    if (!input) return;
    const newText = input.value.trim();
    if (!newText) {
        showToast('لا يمكن حفظ رسالة فارغة، يمكنك حذفها بدلاً من ذلك', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/chat/messages/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: newText })
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم تعديل الرسالة بنجاح', 'success');
            await loadChatMessages(true);
        } else {
            showToast(data.error || 'تعذر تعديل الرسالة', 'error');
        }
    } catch (err) {
        console.error('Error updating chat message:', err);
        showToast('حدث خطأ أثناء تعديل الرسالة', 'error');
    }
}

async function deleteChatMessage(msgId) {
    if (!confirm('هل تريد بالتأكيد حذف هذه الرسالة نهائياً من المحادثة؟')) {
        return;
    }

    try {
        const res = await fetch(`/api/chat/messages/${msgId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف الرسالة بنجاح', 'success');
            const row = document.getElementById(`chat-msg-row-${msgId}`);
            if (row) {
                row.remove();
            }
            await loadChatMessages(true);
        } else {
            showToast(data.error || 'تعذر حذف الرسالة', 'error');
        }
    } catch (err) {
        console.error('Error deleting chat message:', err);
        showToast('حدث خطأ أثناء حذف الرسالة', 'error');
    }
}

async function submitChatMessage(e) {
    e.preventDefault();
    const textInput = document.getElementById('chat-text-input');
    const msgText = textInput.value.trim();

    if (!msgText && !selectedChatFile) {
        return;
    }

    const btn = document.getElementById('btn-send-chat');
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('message', msgText);
        formData.append('sender_id', currentUser.id);
        formData.append('sender_name', currentUser.name);
        formData.append('sender_role', currentUser.role);
        formData.append('channel_type', currentChatChannel.type);

        if (currentChatChannel.type === 'project') {
            formData.append('project_id', currentChatChannel.projectId);
        } else if (currentChatChannel.type === 'direct') {
            formData.append('recipient_id', currentChatChannel.otherUserId);
        }

        if (selectedChatFile) {
            formData.append('attachment', selectedChatFile);
        }

        const res = await fetch('/api/chat/messages', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            textInput.value = '';
            clearChatAttachment();
            loadChatMessages();
        } else {
            showToast(data.error || 'فشل في إرسال الرسالة', 'error');
        }
    } catch (err) {
        showToast('خطأ في الاتصال بالسيرفر', 'error');
    } finally {
        btn.disabled = false;
    }
}

function handleChatAttachmentSelect(e) {
    const file = e.target.files[0];
    if (file) {
        selectedChatFile = file;
        const banner = document.getElementById('chat-attachment-banner');
        const nameEl = document.getElementById('chat-attachment-filename');
        nameEl.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        banner.classList.remove('hidden');
    }
}

function clearChatAttachment() {
    selectedChatFile = null;
    const input = document.getElementById('chat-file-input');
    if (input) input.value = '';
    const banner = document.getElementById('chat-attachment-banner');
    if (banner) banner.classList.add('hidden');
}

function filterChatChannels() {
    const q = document.getElementById('chat-search-input').value.toLowerCase();
    document.querySelectorAll('.chat-channel-item').forEach(el => {
        const text = el.innerText.toLowerCase();
        el.style.display = text.includes(q) ? 'flex' : 'none';
    });
}

// =========================================================================
// ----------------- CASH FLOW & LIQUIDITY FORECAST MODULE -----------------
// =========================================================================
let currentCashFlowData = null;
let selectedCashFlowProjectId = null; // null = all projects consolidated
let selectedSimPhaseNum = 1;
let currentCashFlowSubTab = 'payments'; // payments, phases, portfolio
let currentCashFlowPaymentFilter = 'all'; // all, pending, paid
let cashFlowChartInstance = null;

async function loadCashFlow(projectId = selectedCashFlowProjectId, simPhase = selectedSimPhaseNum) {
    selectedCashFlowProjectId = projectId;
    selectedSimPhaseNum = simPhase || 1;
    
    let data;
    try {
        const url = `/api/cashflow?project_id=${projectId || ''}&simulate_phase=${selectedSimPhaseNum}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }
        data = await res.json();
    } catch (netErr) {
        console.error('Network error loading cash flow data:', netErr);
        showToast('خطأ في الاتصال بالسيرفر أثناء جلب التدفق النقدي', 'error');
        return;
    }

    if (!data || !data.success) {
        showToast(data?.error || 'فشل تحميل بيانات التدفق النقدي', 'error');
        return;
    }

    currentCashFlowData = data;
    try {
        renderCashFlowUI();
    } catch (uiErr) {
        console.error('Error rendering cash flow UI:', uiErr);
    }
}

function selectCashFlowScope(projectId) {
    selectedCashFlowProjectId = projectId ? parseInt(projectId) : null;
    loadCashFlow(selectedCashFlowProjectId, selectedSimPhaseNum);
}

function simulateCashFlowPhase(phaseNum) {
    selectedSimPhaseNum = parseInt(phaseNum) || 1;
    loadCashFlow(selectedCashFlowProjectId, selectedSimPhaseNum);
}

function switchCashFlowSubTab(subTab) {
    currentCashFlowSubTab = subTab;
    
    // Hide all sub-panes
    document.querySelectorAll('.cf-pane').forEach(el => el.classList.add('hidden'));
    
    // Show selected pane
    const targetPane = document.getElementById(`cf-pane-${subTab}`);
    if (targetPane) targetPane.classList.remove('hidden');

    // Update buttons styling
    document.querySelectorAll('.cf-subtab-btn').forEach(btn => {
        btn.classList.remove('active-cf-subtab', 'text-emerald-400', 'border-b-2', 'border-emerald-400');
        btn.classList.add('text-slate-400');
    });
    const targetBtn = document.getElementById(`cf-subtab-btn-${subTab}`);
    if (targetBtn) {
        targetBtn.classList.remove('text-slate-400');
        targetBtn.classList.add('active-cf-subtab', 'text-emerald-400', 'border-b-2', 'border-emerald-400');
    }

    // Toggle filter toolbar (only visible on payments subtab)
    const filterToolbar = document.getElementById('cf-payments-filter-toolbar');
    if (filterToolbar) {
        if (subTab === 'payments') filterToolbar.classList.remove('hidden');
        else filterToolbar.classList.add('hidden');
    }

    // If portfolio tab, re-render chart to fit dimensions
    if (subTab === 'portfolio' && currentCashFlowData) {
        const refPhases = (currentCashFlowData.projects[0] ? currentCashFlowData.projects[0].phases : []) || [];
        setTimeout(() => renderCashFlowChart(refPhases), 50);
    }

    initLucide();
}

function filterCashFlowPayments(filterType) {
    currentCashFlowPaymentFilter = filterType;
    
    // Update button styles
    ['all', 'pending', 'paid'].forEach(t => {
        const btn = document.getElementById(`cf-pay-filter-${t}`);
        if (btn) {
            if (t === filterType) {
                btn.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white transition';
            } else {
                btn.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition';
            }
        }
    });

    renderCashFlowPaymentsTable();
}

function renderCashFlowUI() {
    if (!currentCashFlowData) return;
    const { summary, projects, all_projects_list, selected_project_id } = currentCashFlowData;

    // 1. Render Scope Buttons
    const scopeContainer = document.getElementById('cf-scope-buttons');
    if (scopeContainer) {
        let scopeHtml = `
            <button onclick="selectCashFlowScope(null)" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${!selected_project_id ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40' : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'}">
                <i data-lucide="layers" class="w-3.5 h-3.5"></i>
                <span>كافة مشاريع الشركة (الموحد)</span>
            </button>
        `;
        (all_projects_list || []).forEach(p => {
            const isSelected = selected_project_id === p.id;
            scopeHtml += `
                <button onclick="selectCashFlowScope(${p.id})" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${isSelected ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/40' : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'}">
                    <span class="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-900/60">${p.code}</span>
                    <span>${p.name}</span>
                </button>
            `;
        });
        scopeContainer.innerHTML = scopeHtml;
    }

    // Determine current display target: single project or consolidated
    const activeProject = selected_project_id && projects.length === 1 ? projects[0] : null;

    // 2. Render KPI Strip
    // Card 1: Always the exact real-world bank balance (150,575) matching the bank account in all project views!
    const curCash = summary.current_net_cash !== undefined ? summary.current_net_cash : (summary.current_cash || 0);
    const totRec = activeProject ? activeProject.total_received : summary.total_received;
    const totSpent = activeProject ? activeProject.total_spent : summary.total_spent;
    const finalCash = activeProject ? activeProject.final_projected_cash : summary.final_projected_cash;

    // Next Inflow
    let nextInflowAmount = 0;
    let nextInflowDesc = 'لا توجد دفعات معلقة';
    if (activeProject && activeProject.next_payment) {
        nextInflowAmount = activeProject.next_payment.amount_with_tax || 0;
        nextInflowDesc = `دفعة #${activeProject.next_payment.payment_number}: ${activeProject.next_payment.milestone_name}`;
    } else if (!activeProject) {
        // Find first upcoming payment across all projects
        let earliestNext = null;
        for (const p of projects) {
            if (p.next_payment) {
                earliestNext = p.next_payment;
                break;
            }
        }
        if (earliestNext) {
            nextInflowAmount = earliestNext.amount_with_tax || 0;
            nextInflowDesc = `أقرب دفعة: ${earliestNext.milestone_name}`;
        }
    }

    // Simulated Phase data
    let simPhaseData = null;
    if (activeProject && activeProject.sim_phase) {
        simPhaseData = activeProject.sim_phase;
    } else if (summary.company_sim_phase) {
        simPhaseData = summary.company_sim_phase;
    } else if (currentCashFlowData.consolidated_phases && currentCashFlowData.consolidated_phases.length > 0) {
        simPhaseData = currentCashFlowData.consolidated_phases.find(cp => cp.order_num === selectedSimPhaseNum) || currentCashFlowData.consolidated_phases[0];
    } else if (projects.length > 0 && projects[0].sim_phase) {
        simPhaseData = projects[0].sim_phase;
    }

    const simRemCost = simPhaseData ? simPhaseData.remaining_cost : (summary.total_remaining_cost || 0);
    const simProjCash = simPhaseData ? simPhaseData.projected_cash_after : summary.company_cash_at_sim_phase;

    // Update KPI DOM
    const kpiCashEl = document.getElementById('cf-kpi-current-cash');
    if (kpiCashEl) {
        kpiCashEl.innerText = formatMoney(curCash);
        kpiCashEl.className = `text-xl font-black mt-1 ${curCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }
    const kpiRecEl = document.getElementById('cf-kpi-tot-received');
    if (kpiRecEl) kpiRecEl.innerText = formatMoney(totRec);
    const kpiSpentEl = document.getElementById('cf-kpi-tot-spent');
    if (kpiSpentEl) kpiSpentEl.innerText = formatMoney(totSpent);

    const openingBal = (summary && summary.opening_cash_balance !== undefined) ? summary.opening_cash_balance : 300000;
    const btnOpeningEl = document.getElementById('cf-btn-opening-cash');
    if (btnOpeningEl) btnOpeningEl.innerText = formatMoney(openingBal);
    const kpiOpeningEl = document.getElementById('cf-kpi-opening-cash');
    if (kpiOpeningEl) kpiOpeningEl.innerText = formatMoney(openingBal);

    const kpiNextInflowEl = document.getElementById('cf-kpi-next-inflow');
    if (kpiNextInflowEl) kpiNextInflowEl.innerText = formatMoney(nextInflowAmount);
    const kpiNextInflowDescEl = document.getElementById('cf-kpi-next-inflow-desc');
    if (kpiNextInflowDescEl) kpiNextInflowDescEl.innerText = nextInflowDesc;

    const kpiPhaseRemEl = document.getElementById('cf-kpi-phase-rem-cost');
    if (kpiPhaseRemEl) kpiPhaseRemEl.innerText = formatMoney(simRemCost);
    const kpiPhaseRemDescEl = document.getElementById('cf-kpi-phase-rem-cost-desc');
    if (kpiPhaseRemDescEl) {
        kpiPhaseRemDescEl.innerText = simPhaseData ? `تكلفة إتمام المرحلة ${simPhaseData.order_num}: ${simPhaseData.name}` : 'إجمالي تكاليف إتمام المشاريع';
    }

    const kpiPhaseProjEl = document.getElementById('cf-kpi-phase-projected-cash');
    if (kpiPhaseProjEl) {
        kpiPhaseProjEl.innerText = formatMoney(simProjCash);
        kpiPhaseProjEl.className = `text-xl font-black mt-1 ${simProjCash >= 0 ? 'text-blue-400' : 'text-rose-400'}`;
    }
    const kpiPhaseProjDescEl = document.getElementById('cf-kpi-phase-projected-cash-desc');
    if (kpiPhaseProjDescEl) {
        kpiPhaseProjDescEl.innerText = activeProject 
            ? (simPhaseData ? `رصيد البنك بعد مرحلة ${simPhaseData.order_num} لـ ${activeProject.name}` : 'رصيد البنك بعد المرحلة')
            : (simPhaseData ? `رصيد البنك بنهاية المرحلة ${simPhaseData.order_num}` : 'رصيد البنك التراكمي للشركة');
    }

    const kpiFinalCashEl = document.getElementById('cf-kpi-final-cash');
    if (kpiFinalCashEl) {
        kpiFinalCashEl.innerText = formatMoney(finalCash);
        kpiFinalCashEl.className = `text-xl font-black mt-1 ${finalCash >= 0 ? 'text-emerald-300' : 'text-rose-400'}`;
    }
    const kpiFinalCashDescEl = document.getElementById('cf-kpi-final-cash-desc');
    if (kpiFinalCashDescEl) {
        kpiFinalCashDescEl.innerText = activeProject 
            ? `رصيد البنك لو اكتمل مشروع ${activeProject.name} وحده` 
            : 'رصيد البنك بعد التسليم الكامل لكافة المشاريع';
    }

    // Populate Bank Reconciliation Strip
    const reconOpening = document.getElementById('cf-recon-opening');
    if (reconOpening) reconOpening.innerText = formatMoney(openingBal);

    const reconRec = document.getElementById('cf-recon-received');
    if (reconRec) reconRec.innerText = '+' + formatMoney(activeProject ? totRec : (summary.total_received || 0));

    const reconExp = document.getElementById('cf-recon-expenses');
    if (reconExp) {
        const expAmt = activeProject ? totSpent : (summary.direct_expenses_spent !== undefined ? summary.direct_expenses_spent : (summary.total_spent || 0));
        reconExp.innerText = '-' + formatMoney(expAmt);
    }

    const reconCust = document.getElementById('cf-recon-custody');
    if (reconCust) {
        reconCust.innerText = '-' + formatMoney(activeProject ? 0 : (summary.net_custody_outflow || 0));
    }

    const reconAdv = document.getElementById('cf-recon-advances');
    if (reconAdv) {
        reconAdv.innerText = '-' + formatMoney(activeProject ? 0 : (summary.net_advances_outflow || 0));
    }

    const reconBal = document.getElementById('cf-recon-balance');
    if (reconBal) reconBal.innerText = formatMoney(curCash);

    // 3. Render Phase Stepper & Simulation Box
    const simBadge = document.getElementById('cf-sim-badge-project');
    if (simBadge) {
        simBadge.innerText = activeProject ? `${activeProject.code} - ${activeProject.name}` : 'كافة مشاريع الشركة (المحاكاة المجمعة للثلاثة مشاريع)';
    }

    const stepperContainer = document.getElementById('cf-phase-stepper');
    const simResultBox = document.getElementById('cf-sim-result-box');

    // Get phases list to build the 7-phase stepper (consolidated across all 3 projects when unified scope is chosen)
    const refPhases = (activeProject ? activeProject.phases : (currentCashFlowData.consolidated_phases || (projects[0] ? projects[0].phases : []))) || [];

    if (stepperContainer) {
        let stepperHtml = '';
        refPhases.forEach(ph => {
            const isSelected = ph.order_num === selectedSimPhaseNum;
            stepperHtml += `
                <button onclick="simulateCashFlowPhase(${ph.order_num})" class="p-2.5 rounded-xl border text-right transition flex flex-col justify-between gap-1.5 ${isSelected ? 'bg-gradient-to-br from-emerald-900/50 to-slate-800 border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/50' : 'bg-slate-800 hover:bg-slate-750 border-slate-700/80 text-slate-300'}">
                    <div class="flex items-center justify-between w-full">
                        <span class="text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}">#${ph.order_num}</span>
                        <span class="text-[9px] text-slate-400 font-semibold">${ph.progress_percent}%</span>
                    </div>
                    <span class="text-xs font-bold truncate block ${isSelected ? 'text-white' : 'text-slate-200'}">${ph.name}</span>
                </button>
            `;
        });
        stepperContainer.innerHTML = stepperHtml;
    }

    if (simResultBox && simPhaseData) {
        const netPhaseFlow = simPhaseData.net_phase_flow || 0;
        const phaseInflow = simPhaseData.inflow_pending || 0;
        const phaseCost = simPhaseData.remaining_cost || 0;
        const projCashAfter = simPhaseData.projected_cash_after || 0;
        const companyCashAfter = summary.company_cash_at_sim_phase || 0;

        let advisoryNote = '';
        if (projCashAfter >= 0) {
            advisoryNote = `
                <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <i data-lucide="check-circle" class="w-4 h-4 shrink-0 text-emerald-400"></i>
                    <span><strong>موقف السيولة آمن:</strong> رصيد الكاش التراكمي في البنك (${formatMoney(projCashAfter)}) كافٍ لتغطية الالتزامات مع استمرار فائض نقدي داعم للمشروع والشركة.</span>
                </div>
            `;
        } else {
            advisoryNote = `
                <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0 text-rose-400"></i>
                    <span><strong>تنبيه فجوة تدفق نقدي:</strong> تتطلب هذه المرحلة تمويلاً مسبقاً بمقدار (${formatMoney(Math.abs(projCashAfter))})، يوصى بطلب دفعة مقدمة أو تسريع تحصيل المستخلصات السابقة لتفادي العجز.</span>
                </div>
            `;
        }

        simResultBox.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-750 gap-2">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                        ${simPhaseData.order_num}
                    </div>
                    <div>
                        <h4 class="text-sm font-black text-white">${simPhaseData.name}</h4>
                        <p class="text-[11px] text-slate-400">تحليل الموقف المالي والنقدي عند الوصول إلى هذه المرحلة</p>
                    </div>
                </div>
                <div class="text-left">
                    <span class="text-[11px] text-slate-400">نسبة الإنجاز الحالية:</span>
                    <span class="text-xs font-black text-emerald-400 ml-1 font-mono">${simPhaseData.progress_percent}%</span>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span class="text-[10px] text-slate-400 block font-semibold">1. المستحق للتحصيل بالمرحلة</span>
                    <h5 class="text-sm font-black text-amber-400 mt-1">${formatMoney(phaseInflow)}</h5>
                    <span class="text-[9px] text-slate-400 block mt-0.5 truncate">${simPhaseData.payments && simPhaseData.payments.length ? `${simPhaseData.payments.length} دفعات مرتبطة` : 'لا توجد دفعات مباشرة'}</span>
                </div>

                <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span class="text-[10px] text-slate-400 block font-semibold">2. المطلوب صرفه لإتمامها</span>
                    <h5 class="text-sm font-black text-rose-400 mt-1">${formatMoney(phaseCost)}</h5>
                    <span class="text-[9px] text-slate-400 block mt-0.5">صرف فعلي: ${formatMoney(simPhaseData.actual_spent)}</span>
                </div>

                <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    <span class="text-[10px] text-slate-400 block font-semibold">3. صافي أثر المرحلة</span>
                    <h5 class="text-sm font-black ${netPhaseFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-1">${formatMoney(netPhaseFlow)}</h5>
                    <span class="text-[9px] text-slate-400 block mt-0.5">${netPhaseFlow >= 0 ? 'فائض مرحلي' : 'عجز مرحلي'}</span>
                </div>

                <div class="bg-slate-800/80 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                    <span class="text-[10px] text-emerald-400 block font-bold">${activeProject ? '4. كاش المشروع بعد المرحلة' : '4. رصيد كاش الشركة التراكمي'}</span>
                    <h5 class="text-sm font-black ${projCashAfter >= 0 ? 'text-blue-400' : 'text-rose-400'} mt-1">${formatMoney(projCashAfter)}</h5>
                    <span class="text-[9px] text-slate-400 block mt-0.5">${activeProject ? 'رصيد تراكمي للمشروع' : 'صافي رصيد الـ 3 مشاريع مجتمعة'}</span>
                </div>

                <div class="bg-slate-800/80 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                    <span class="text-[10px] text-blue-400 block font-bold">5. كاش الشركة الإجمالي</span>
                    <h5 class="text-sm font-black text-blue-300 mt-1">${formatMoney(companyCashAfter)}</h5>
                    <span class="text-[9px] text-slate-400 block mt-0.5">لكل مشاريع الشركة</span>
                </div>
            </div>

            ${advisoryNote}
        `;
    }

    // 4. Render Phase-by-Phase Matrix Table
    const tableBody = document.getElementById('cf-phases-table-body');
    const tableFoot = document.getElementById('cf-phases-table-foot');

    if (tableBody) {
        let tableRowsHtml = '';
        let totDueSum = 0;
        let totRecSum = 0;
        let totPendSum = 0;
        let totCostSum = 0;
        let totSpentSum = 0;
        let totRemCostSum = 0;
        let totNetFlowSum = 0;

        refPhases.forEach(ph => {
            totDueSum += ph.inflow_due || 0;
            totRecSum += ph.inflow_received || 0;
            totPendSum += ph.inflow_pending || 0;
            totCostSum += ph.cost_price || 0;
            totSpentSum += ph.actual_spent || 0;
            totRemCostSum += ph.remaining_cost || 0;
            totNetFlowSum += ph.net_phase_flow || 0;

            const isSimulated = ph.order_num === selectedSimPhaseNum;
            const netFlowClass = ph.net_phase_flow >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
            const projCashClass = ph.projected_cash_after >= 0 ? 'text-blue-400 font-bold' : 'text-rose-400 font-bold';

            // Check if there are pending payments in this phase
            let actionHtml = '<span class="text-slate-500 text-[10px]">-</span>';
            const pendingPayment = (ph.payments || []).find(p => !p.is_received && p.status !== 'paid');
            if (pendingPayment) {
                actionHtml = `
                    <button onclick="openReceivePaymentModal(${pendingPayment.id})" class="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition mx-auto">
                        <i data-lucide="check" class="w-3 h-3"></i>
                        <span>استلام</span>
                    </button>
                `;
            } else if ((ph.payments || []).length > 0) {
                actionHtml = `<span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">مستلم</span>`;
            }

            tableRowsHtml += `
                <tr class="hover:bg-slate-800/60 transition ${isSimulated ? 'bg-emerald-950/20 border-r-4 border-r-emerald-500' : ''}">
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-slate-300">#${ph.order_num}</span>
                            <span class="font-bold text-slate-200">${ph.name}</span>
                        </div>
                    </td>
                    <td class="p-3 font-mono">${formatMoney(ph.inflow_due)}</td>
                    <td class="p-3 font-mono text-emerald-400">${formatMoney(ph.inflow_received)}</td>
                    <td class="p-3 font-mono text-amber-400">${formatMoney(ph.inflow_pending)}</td>
                    <td class="p-3 font-mono text-slate-300">${formatMoney(ph.cost_price)}</td>
                    <td class="p-3 font-mono text-rose-400">${formatMoney(ph.actual_spent)}</td>
                    <td class="p-3 font-mono text-rose-300">${formatMoney(ph.remaining_cost)}</td>
                    <td class="p-3 font-mono ${netFlowClass}">${formatMoney(ph.net_phase_flow)}</td>
                    <td class="p-3 font-mono ${projCashClass}">${formatMoney(ph.projected_cash_after)}</td>
                    <td class="p-3 text-center">${actionHtml}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = tableRowsHtml;

        if (tableFoot) {
            tableFoot.innerHTML = `
                <tr class="text-slate-100">
                    <td class="p-3 font-black">الإجمالي</td>
                    <td class="p-3 font-mono">${formatMoney(totDueSum)}</td>
                    <td class="p-3 font-mono text-emerald-400">${formatMoney(totRecSum)}</td>
                    <td class="p-3 font-mono text-amber-400">${formatMoney(totPendSum)}</td>
                    <td class="p-3 font-mono text-slate-300">${formatMoney(totCostSum)}</td>
                    <td class="p-3 font-mono text-rose-400">${formatMoney(totSpentSum)}</td>
                    <td class="p-3 font-mono text-rose-300">${formatMoney(totRemCostSum)}</td>
                    <td class="p-3 font-mono ${totNetFlowSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${formatMoney(totNetFlowSum)}</td>
                    <td class="p-3 font-mono text-emerald-300">${formatMoney(activeProject ? activeProject.final_projected_cash : summary.final_projected_cash)}</td>
                    <td class="p-3 text-center">-</td>
                </tr>
            `;
        }
    }

    // 5. Render Company Comparison Portfolio Table
    const compTableBody = document.getElementById('cf-company-table-body');
    const compTableFoot = document.getElementById('cf-company-table-foot');
    if (compTableBody) {
        let compRowsHtml = '';
        projects.forEach(p => {
            const isCur = selected_project_id === p.project_id;
            compRowsHtml += `
                <tr class="hover:bg-slate-800/60 transition ${isCur ? 'bg-emerald-950/20 border-r-4 border-r-emerald-500' : ''}">
                    <td class="p-3 font-mono font-bold text-emerald-400">${p.code}</td>
                    <td class="p-3 font-bold text-white">${p.name}</td>
                    <td class="p-3 font-mono">${formatMoney(p.contract_value)}</td>
                    <td class="p-3 font-mono text-emerald-400">${formatMoney(p.total_received)}</td>
                    <td class="p-3 font-mono text-rose-400">${formatMoney(p.total_spent)}</td>
                    <td class="p-3 font-mono font-bold ${p.current_cash >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${formatMoney(p.current_cash)}</td>
                    <td class="p-3 font-mono text-amber-400">${formatMoney(p.total_pending_inflow)}</td>
                    <td class="p-3 font-mono text-rose-300">${formatMoney(p.total_remaining_cost)}</td>
                    <td class="p-3 font-mono font-bold ${p.final_projected_cash >= 0 ? 'text-emerald-300' : 'text-rose-400'}">${formatMoney(p.final_projected_cash)}</td>
                    <td class="p-3 text-center">
                        <button onclick="selectCashFlowScope(${p.project_id})" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-700 text-slate-300 text-xs font-bold transition">
                            تحليل
                        </button>
                    </td>
                </tr>
            `;
        });
        compTableBody.innerHTML = compRowsHtml;

        if (compTableFoot) {
            compTableFoot.innerHTML = `
                <tr class="text-white">
                    <td class="p-3 font-black" colspan="2">إجمالي محفظة مشاريع الشركة</td>
                    <td class="p-3 font-mono">${formatMoney(summary.total_contract_value)}</td>
                    <td class="p-3 font-mono text-emerald-400">${formatMoney(summary.total_received)}</td>
                    <td class="p-3 font-mono text-rose-400">${formatMoney(summary.total_spent)}</td>
                    <td class="p-3 font-mono font-bold ${summary.current_net_cash >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${formatMoney(summary.current_net_cash)}</td>
                    <td class="p-3 font-mono text-amber-400">${formatMoney(summary.total_pending_inflow)}</td>
                    <td class="p-3 font-mono text-rose-300">${formatMoney(summary.total_remaining_cost)}</td>
                    <td class="p-3 font-mono font-bold text-emerald-300">${formatMoney(summary.final_projected_cash)}</td>
                    <td class="p-3 text-center">-</td>
                </tr>
            `;
        }
    }

    // 6. Render Chart.js Cash Flow Trajectory Curve
    renderCashFlowChart(refPhases);

    // 7. Update Print Meta
    const printDateEl = document.getElementById('cf-print-date');
    if (printDateEl) printDateEl.innerText = new Date().toLocaleDateString('ar-SA');
    const printScopeEl = document.getElementById('cf-print-scope');
    if (printScopeEl) {
        printScopeEl.innerText = activeProject ? `${activeProject.code} - ${activeProject.name}` : 'كافة مشاريع الشركة (الموحد)';
    }

    // 8. Render Payments Table
    renderCashFlowPaymentsTable();

    initLucide();
}

function renderCashFlowChart(phases) {
    const canvas = document.getElementById('cf-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (cashFlowChartInstance) {
        try {
            cashFlowChartInstance.destroy();
        } catch (e) {}
        cashFlowChartInstance = null;
    }

    if (!phases || !phases.length) return;

    try {
        const labels = phases.map(ph => `م#${ph.order_num}: ${(ph.name || '').substring(0, 18)}...`);
        const cumulativeCashData = phases.map(ph => ph.projected_cash_after || 0);
        const inflowsData = phases.map(ph => ph.inflow_pending || 0);
        const costsData = phases.map(ph => ph.remaining_cost || 0);

        const ctx = canvas.getContext('2d');
    cashFlowChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'رصيد السيولة النقدية التراكمي (SAR)',
                    data: cumulativeCashData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'الدفعة المتوقعة للتحصيل (SAR)',
                    data: inflowsData,
                    backgroundColor: 'rgba(245, 158, 11, 0.7)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'المطلوب صرفه للمرحلة (SAR)',
                    data: costsData,
                    backgroundColor: 'rgba(244, 63, 94, 0.7)',
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Cairo', size: 11, weight: 'bold' }
                    }
                },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += formatMoney(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Cairo', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Cairo', size: 10 },
                        callback: function(value) {
                            return (value / 1000).toLocaleString() + 'k';
                        }
                    }
                }
            }
        }
    });
    } catch (chartErr) {
        console.warn('Could not initialize cash flow chart:', chartErr);
    }
}

function printCashFlowReport() {
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    const printDate = document.getElementById('cf-print-date');
    if (printDate) printDate.innerText = new Date().toLocaleString(isEn ? 'en-US' : 'ar-SA');
    const printMeta = document.getElementById('cf-print-meta');
    if (printMeta && currentCashFlowData && currentCashFlowData.summary) {
        printMeta.innerText = `الرصيد الفعلي الحالي: ${formatMoney(currentCashFlowData.summary.current_actual_cash || 0)} • مقبوضات العملاء: ${formatMoney(currentCashFlowData.summary.total_client_payments_received || 0)}`;
    }
    const printScope = document.getElementById('cf-print-scope');
    if (printScope) {
        printScope.innerText = selectedCashFlowProjectId ? (document.querySelector('.cf-scope-pill.active')?.innerText || 'مشروع محدد') : 'كافة المشاريع (الموحد)';
    }
    window.print();
}

function exportCashFlowToExcel() {
    if (!currentCashFlowData) {
        showToast('لا توجد بيانات تدفق نقدي متاحة للتصدير', 'error');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();

        // 1. Sheet: Company Portfolio Overview
        const portfolioRows = currentCashFlowData.projects.map(p => ({
            'كود المشروع': p.code,
            'اسم المشروع': p.name,
            'قيمة العقد (ر.س)': p.contract_value,
            'المحصل الفعلي (ر.س)': p.total_received,
            'المنصرف الفعلي (ر.س)': p.total_spent,
            'السيولة الحالية (ر.س)': p.current_cash,
            'الدفعات القادمة (ر.س)': p.total_pending_inflow,
            'التكاليف المتبقية (ر.س)': p.total_remaining_cost,
            'الكاش النهائي المتوقع (ر.س)': p.final_projected_cash
        }));
        const ws1 = XLSX.utils.json_to_sheet(portfolioRows);
        XLSX.utils.book_append_sheet(wb, ws1, 'موقف_السيولة_المقارن');

        // 2. Sheet: Phases Breakdown
        const phasesRows = [];
        currentCashFlowData.projects.forEach(p => {
            p.phases.forEach(ph => {
                phasesRows.push({
                    'المشروع': p.code,
                    'رقم المرحلة': ph.order_num,
                    'اسم المرحلة': ph.name,
                    'الدفعات المستحقة': ph.inflow_due,
                    'المحصل فعلياً': ph.inflow_received,
                    'المتبقي للتحصيل': ph.inflow_pending,
                    'التكلفة التقديرية': ph.cost_price,
                    'المنصرف الفعلي': ph.actual_spent,
                    'المتبقي للصرف': ph.remaining_cost,
                    'صافي تدفق المرحلة': ph.net_phase_flow,
                    'رصيد الكاش بعد المرحلة': ph.projected_cash_after,
                    'نسبة الإنجاز %': ph.progress_percent
                });
            });
        });
        const ws2 = XLSX.utils.json_to_sheet(phasesRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'تدفق_المراحل_التفصيلي');

        XLSX.writeFile(wb, `تقرير_التدفق_النقدي_السجيني_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('تم تصدير تقرير التدفق النقدي إلى ملف Excel بنجاح', 'success');
    } catch (err) {
        console.error('Error exporting cashflow to excel:', err);
        showToast('فشل تصدير ملف الإكسيل', 'error');
    }
}

// ----------------- CASH FLOW PAYMENTS & ACTIONS -----------------

function renderCashFlowPaymentsTable() {
    const tableBody = document.getElementById('cf-all-payments-table-body');
    const tableFoot = document.getElementById('cf-all-payments-table-foot');
    if (!tableBody) return;

    if (!currentCashFlowData || !currentCashFlowData.all_payments) {
        tableBody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">لا توجد بيانات دفعات متاحة</td></tr>`;
        if (tableFoot) tableFoot.innerHTML = '';
        return;
    }

    let payments = [...currentCashFlowData.all_payments];
    
    // Filter by project scope if a specific project is selected
    if (selectedCashFlowProjectId) {
        payments = payments.filter(p => p.project_id === selectedCashFlowProjectId);
    }

    // Filter by status tab (all / pending / paid)
    if (currentCashFlowPaymentFilter === 'pending') {
        payments = payments.filter(p => !p.is_received && p.status !== 'paid');
    } else if (currentCashFlowPaymentFilter === 'paid') {
        payments = payments.filter(p => p.is_received || p.status === 'paid');
    }

    if (payments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="p-8 text-center">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i data-lucide="receipt" class="w-10 h-10 text-slate-600"></i>
                        <p class="text-sm font-bold text-slate-400">لا توجد دفعات مطابقة للتصفية الحالية</p>
                        <button onclick="filterCashFlowPayments('all')" class="mt-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300">
                            عرض كافة الدفعات
                        </button>
                    </div>
                </td>
            </tr>
        `;
        if (tableFoot) tableFoot.innerHTML = '';
        initLucide();
        return;
    }

    let totDueSum = 0;
    let totTaxSum = 0;
    let totRecSum = 0;
    let totRemSum = 0;

    let rowsHtml = '';
    payments.forEach(p => {
        const amountWithTax = p.amount_with_tax || 0;
        const taxAmount = p.tax_amount || 0;
        const receivedAmount = p.received_amount || 0;
        const remainingAmount = Math.max(0, amountWithTax - receivedAmount);
        const isPaid = p.is_received || p.status === 'paid';
        const isPartial = !isPaid && receivedAmount > 0;

        totDueSum += amountWithTax;
        totTaxSum += taxAmount;
        totRecSum += receivedAmount;
        totRemSum += remainingAmount;

        let statusBadge = '';
        if (isPaid) {
            statusBadge = `
                <div class="flex flex-col gap-0.5">
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black inline-flex items-center gap-1 w-fit">
                        <i data-lucide="check-circle" class="w-3 h-3"></i>
                        <span>تم التحصيل</span>
                    </span>
                    ${p.received_date ? `<span class="text-[9px] text-slate-400 font-mono">${p.received_date}</span>` : ''}
                </div>
            `;
        } else if (isPartial) {
            statusBadge = `
                <div class="flex flex-col gap-0.5">
                    <span class="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black inline-flex items-center gap-1 w-fit">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        <span>تحصيل جزئي</span>
                    </span>
                    <span class="text-[9px] text-slate-400">متبقي: ${formatMoney(remainingAmount)}</span>
                </div>
            `;
        } else {
            statusBadge = `
                <span class="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold inline-flex items-center gap-1 w-fit">
                    <i data-lucide="hourglass" class="w-3 h-3 text-amber-400"></i>
                    <span>بانتظار التحصيل</span>
                </span>
            `;
        }

        let actionHtml = '';
        if (!isPaid) {
            actionHtml = `
                <button onclick="openReceivePaymentModal(${p.id})" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition mx-auto">
                    <i data-lucide="check" class="w-3.5 h-3.5"></i>
                    <span>تسجيل سداد</span>
                </button>
            `;
        } else {
            actionHtml = `
                <div class="flex items-center gap-1.5 justify-center">
                    <button onclick="openReceivePaymentModal(${p.id})" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1" title="تعديل بيانات التحصيل">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        <span>تعديل</span>
                    </button>
                    <button onclick="resetClientPayment(${p.id})" class="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-800/40 text-xs font-bold transition flex items-center gap-1" title="إلغاء التحصيل وإعادة للاستحقاق">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                        <span>إلغاء</span>
                    </button>
                </div>
            `;
        }

        rowsHtml += `
            <tr class="hover:bg-slate-800/60 transition">
                <td class="p-3">
                    <div class="flex items-center gap-1.5">
                        <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400">${p.project_code || ''}</span>
                        <span class="font-bold text-slate-200 truncate max-w-[130px]" title="${escapeHtml(p.project_name || '')}">${escapeHtml(p.project_name || '')}</span>
                    </div>
                </td>
                <td class="p-3 font-mono font-bold text-slate-300">
                    <span class="px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700">#${p.payment_number}</span>
                </td>
                <td class="p-3">
                    <div class="font-bold text-white text-xs">${escapeHtml(p.milestone_name)}</div>
                    ${p.percentage ? `<span class="text-[10px] text-amber-400/90 font-mono">${p.percentage}% من قيمة العقد</span>` : ''}
                </td>
                <td class="p-3 font-mono text-slate-400 text-xs">
                    ${p.due_date || '<span class="text-slate-600">-</span>'}
                </td>
                <td class="p-3 font-mono font-bold text-white text-xs">${formatMoney(amountWithTax)}</td>
                <td class="p-3 font-mono text-slate-400 text-xs">${formatMoney(taxAmount)}</td>
                <td class="p-3 font-mono font-bold text-emerald-400 text-xs">${formatMoney(receivedAmount)}</td>
                <td class="p-3 font-mono font-bold ${remainingAmount > 0 ? 'text-amber-400' : 'text-slate-500'} text-xs">${formatMoney(remainingAmount)}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-center print:hidden">${actionHtml}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;

    if (tableFoot) {
        tableFoot.innerHTML = `
            <tr class="text-white bg-slate-900/90">
                <td class="p-3 font-black" colspan="4">
                    إجمالي الدفعات المعروضة (${payments.length} دفعة)
                </td>
                <td class="p-3 font-mono text-white font-black">${formatMoney(totDueSum)}</td>
                <td class="p-3 font-mono text-slate-400 font-bold">${formatMoney(totTaxSum)}</td>
                <td class="p-3 font-mono text-emerald-400 font-black">${formatMoney(totRecSum)}</td>
                <td class="p-3 font-mono text-amber-400 font-black">${formatMoney(totRemSum)}</td>
                <td class="p-3 text-center"></td>
                <td class="p-3 print:hidden"></td>
            </tr>
        `;
    }

    initLucide();
}

function openEditOpeningCashModal() {
    const curVal = (currentCashFlowData && currentCashFlowData.summary && currentCashFlowData.summary.opening_cash_balance !== undefined) 
        ? currentCashFlowData.summary.opening_cash_balance 
        : 300000;
    const input = document.getElementById('opening-cash-input');
    if (input) {
        input.value = curVal;
    }
    openModal('edit-opening-cash-modal');
}

async function saveOpeningCash(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('opening-cash-input');
    if (!input) return;
    const val = parseFloat(input.value) || 0;
    const btn = document.getElementById('btn-save-opening-cash');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="inline-block animate-spin mr-1">⌛</span> جاري الحفظ...`;
    }

    try {
        const res = await fetch('/api/settings/opening-cash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opening_cash_balance: val })
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم تحديث الرصيد الافتتاحي للسيولة بنجاح', 'success');
            closeModal('edit-opening-cash-modal');
            if (typeof loadCashFlow === 'function') {
                await loadCashFlow();
            }
        } else {
            showToast(data.error || 'فشل تحديث الرصيد الافتتاحي', 'error');
        }
    } catch (err) {
        console.error('Error saving opening cash:', err);
        showToast('تعذر حفظ الرصيد الافتتاحي، يرجى المحاولة لاحقاً', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>حفظ واعتماد الرصيد</span>`;
            initLucide();
        }
    }
}

function openDirectReceiveModal() {
    const payments = (currentCashFlowData && currentCashFlowData.all_payments) ? currentCashFlowData.all_payments : [];
    if (!payments.length) {
        showToast('لا توجد دفعات مسجلة بالمشاريع حالياً', 'info');
        return;
    }
    
    const selectGroup = document.getElementById('rec-payment-select-group');
    const dropdown = document.getElementById('rec-payment-dropdown');
    
    if (selectGroup && dropdown) {
        selectGroup.classList.remove('hidden');
        dropdown.innerHTML = '';
        
        // Filter by selected project if scoped, or show all
        let filtered = payments;
        if (selectedCashFlowProjectId) {
            filtered = payments.filter(p => p.project_id === selectedCashFlowProjectId);
            if (!filtered.length) filtered = payments;
        }

        const sorted = [...filtered].sort((a, b) => {
            if (!a.is_received && b.is_received) return -1;
            if (a.is_received && !b.is_received) return 1;
            return a.id - b.id;
        });

        sorted.forEach(py => {
            const opt = document.createElement('option');
            opt.value = py.id;
            const statusLabel = py.is_received ? '✅ مسددة' : '⏳ معلقة';
            opt.textContent = `[${py.project_code || 'مشروع'}] دفعة #${py.payment_number}: ${py.milestone_name} (${formatMoney(py.amount_with_tax)}) - ${statusLabel}`;
            dropdown.appendChild(opt);
        });
        
        const firstPending = sorted.find(p => !p.is_received && p.status !== 'paid') || sorted[0];
        if (firstPending) {
            dropdown.value = firstPending.id;
            onPaymentDropdownSelected(firstPending.id);
        }
    }
    
    openModal('receive-payment-modal');
}

function onPaymentDropdownSelected(paymentId) {
    paymentId = parseInt(paymentId);
    const payments = (currentCashFlowData && currentCashFlowData.all_payments) ? currentCashFlowData.all_payments : [];
    const cp = payments.find(p => p.id === paymentId);
    if (!cp) return;
    
    document.getElementById('rec-payment-id').value = cp.id;
    document.getElementById('rec-milestone-title').innerText = `${cp.project_name || cp.project_code || ''} - ${cp.milestone_name} (دفعة رقم ${cp.payment_number})`;
    document.getElementById('rec-total-due').innerText = formatMoney(cp.amount_with_tax);
    document.getElementById('rec-amount').value = cp.is_received ? cp.received_amount : (cp.amount_with_tax - (cp.received_amount || 0));
    document.getElementById('rec-date').value = cp.received_date || new Date().toISOString().split('T')[0];
    document.getElementById('rec-method').value = cp.payment_method || 'تحويل بنكي';
    document.getElementById('rec-voucher-no').value = cp.receipt_voucher_no || '';
    document.getElementById('rec-notes').value = cp.notes || '';
}

function openAddPaymentModalFromCashflow() {
    document.getElementById('cp-id').value = '';
    document.getElementById('client-payment-modal-title').innerText = 'إضافة استحقاق دفعة عميل جديدة';
    
    const selGroup = document.getElementById('cp-project-select-group');
    const projSelect = document.getElementById('cp-project-id-select');
    if (selGroup && projSelect) {
        selGroup.classList.remove('hidden');
        projSelect.innerHTML = '';
        const list = (currentCashFlowData && currentCashFlowData.all_projects_list) ? currentCashFlowData.all_projects_list : [];
        list.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.code} - ${p.name}`;
            if (selectedCashFlowProjectId && selectedCashFlowProjectId === p.id) {
                opt.selected = true;
            }
            projSelect.appendChild(opt);
        });
        document.getElementById('cp-project-id').value = projSelect.value || (list[0] ? list[0].id : '');
    }
    
    document.getElementById('cp-number').value = 1;
    document.getElementById('cp-percentage').value = '';
    document.getElementById('cp-milestone').value = '';
    document.getElementById('cp-amount-with-tax').value = '';
    document.getElementById('cp-amount-without-tax').value = '';
    document.getElementById('cp-tax-amount').value = '';
    document.getElementById('cp-due-date').value = '';
    document.getElementById('cp-notes').value = '';
    if (document.getElementById('cp-payment-type')) {
        document.getElementById('cp-payment-type').value = 'contract';
    }
    
    openModal('client-payment-modal');
}

async function resetClientPayment(paymentId) {
    if (!confirm('هل أنت متأكد من إلغاء تحصيل هذه الدفعة وإعادتها لحالة الانتظار؟')) return;
    try {
        const res = await fetch(`/api/client-payments/${paymentId}/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            if (currentTab === 'cashflow') {
                loadCashFlow();
            }
            if (currentProjectDetailData) {
                openProjectDetailModal(currentProjectDetailData.id);
            }
            loadDashboardStats();
        } else {
            showToast(data.error || 'فشل إلغاء التحصيل', 'error');
        }
    } catch (err) {
        console.error('Error resetting client payment:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

// ==============================================================
// SUPPLIERS & QUOTATIONS & PRICE VARIANCE MODULE (بند الموردين والأسعار)
// ==============================================================

let cachedSuppliers = [];
let cachedQuotations = [];
let cachedVariances = [];
let currentSupplierSubTab = 'list';
let currentSelectedSupplierDetailId = null;

// 1. Load All Suppliers Data
async function loadSuppliersData() {
    try {
        const [supRes, quoRes, varRes] = await Promise.all([
            fetch('/api/suppliers'),
            fetch('/api/supplier-quotations'),
            fetch('/api/supplier-variances')
        ]);

        cachedSuppliers = await supRes.json();
        cachedQuotations = await quoRes.json();
        const varData = await varRes.json();
        cachedVariances = varData.variances || [];

        refreshSupplierCategoryDropdowns();

        // Calculate KPI Metrics
        const totalSuppliers = cachedSuppliers.length;
        const totalQuoted = cachedQuotations.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0);
        const totalInvoiced = cachedSuppliers.reduce((sum, s) => sum + (parseFloat(s.total_invoiced) || 0), 0);
        const totalPaid = cachedSuppliers.reduce((sum, s) => sum + (parseFloat(s.total_paid) || 0), 0);
        const totalUnpaid = Math.max(0, totalInvoiced - totalPaid);
        const totalVariance = parseFloat(varData.summary?.total_excess_amount) || 0;
        const varianceCount = cachedVariances.length;

        // Update KPI summary cards
        const countEl = document.getElementById('stat-suppliers-count');
        if (countEl) countEl.innerText = totalSuppliers;

        const quotedEl = document.getElementById('stat-suppliers-total-quoted');
        if (quotedEl) quotedEl.innerText = formatCurrency(totalQuoted);

        const invoicedEl = document.getElementById('stat-suppliers-total-invoiced');
        if (invoicedEl) invoicedEl.innerText = formatCurrency(totalInvoiced);

        const paidEl = document.getElementById('stat-suppliers-total-paid');
        if (paidEl) paidEl.innerText = formatCurrency(totalPaid);

        const remEl = document.getElementById('stat-suppliers-total-remaining');
        if (remEl) remEl.innerText = formatCurrency(totalUnpaid);

        const varEl = document.getElementById('stat-suppliers-total-variance');
        if (varEl) varEl.innerText = formatCurrency(totalVariance);

        const varCountEl = document.getElementById('stat-suppliers-variance-count');
        if (varCountEl) varCountEl.innerText = `${varianceCount} فواتير تجاوزت العرض`;

        // Update Badges
        const navBadge = document.getElementById('badge-suppliers-variance');
        if (navBadge) {
            if (varianceCount > 0) {
                navBadge.classList.remove('hidden');
                navBadge.innerText = `⚠️ ${varianceCount} تنبيه زيادة`;
            } else {
                navBadge.classList.add('hidden');
            }
        }

        const quoSubBadge = document.getElementById('badge-subtab-quotations-count');
        if (quoSubBadge) quoSubBadge.innerText = cachedQuotations.length;

        const varSubBadge = document.getElementById('badge-subtab-variances-count');
        if (varSubBadge) {
            varSubBadge.innerText = varianceCount;
            if (varianceCount > 0) {
                varSubBadge.classList.remove('bg-slate-700', 'text-slate-300');
                varSubBadge.classList.add('bg-rose-500/20', 'text-rose-400');
            }
        }

        // Render current sub-tab
        if (currentSupplierSubTab === 'list') {
            renderSuppliersCards(cachedSuppliers);
        } else if (currentSupplierSubTab === 'quotations') {
            loadQuotationsTable();
        } else if (currentSupplierSubTab === 'variances') {
            renderVariancesTable(cachedVariances);
        }

        initLucide();
    } catch (err) {
        console.error('Error loading suppliers data:', err);
    }
}

// 2. Sub-tab switcher
function switchSupplierSubTab(tab) {
    currentSupplierSubTab = tab;
    const tabs = ['list', 'quotations', 'variances'];

    tabs.forEach(t => {
        const pane = document.getElementById(`supplier-pane-${t}`);
        const btn = document.getElementById(`btn-supplier-subtab-${t}`);
        if (pane) {
            if (t === tab) {
                pane.classList.remove('hidden');
            } else {
                pane.classList.add('hidden');
            }
        }
        if (btn) {
            if (t === tab) {
                btn.className = `px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-2 transition`;
            } else {
                btn.className = `px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition`;
            }
        }
    });

    if (tab === 'list') {
        renderSuppliersCards(cachedSuppliers);
    } else if (tab === 'quotations') {
        loadQuotationsTable();
    } else if (tab === 'variances') {
        renderVariancesTable(cachedVariances);
    }

    initLucide();
}

// 3. Filter Suppliers List
function filterSuppliersList() {
    const q = (document.getElementById('supplier-search-input')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('supplier-category-filter')?.value || '';

    const filtered = cachedSuppliers.filter(s => {
        const matchesQuery = !q ||
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.phone && s.phone.includes(q)) ||
            (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
            (s.address && s.address.toLowerCase().includes(q));
        const matchesCat = !cat || s.category === cat;
        return matchesQuery && matchesCat;
    });

    renderSuppliersCards(filtered);
}

// 4. Render Suppliers Cards Grid
function renderSuppliersCards(suppliers) {
    const grid = document.getElementById('suppliers-cards-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!suppliers || suppliers.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500 space-y-2">
                <i data-lucide="truck" class="w-12 h-12 mx-auto text-slate-600 mb-2"></i>
                <p class="font-bold text-base text-slate-400">لا يوجد موردين مطابقين للبحث</p>
                <p class="text-xs">انقر على زر "+ مورد جديد" لإضافة أول مورد وسجل أسعاره</p>
            </div>
        `;
        initLucide();
        return;
    }

    suppliers.forEach(s => {
        const quoted = parseFloat(s.total_quoted) || 0;
        const invoiced = parseFloat(s.total_invoiced) || 0;
        const paid = parseFloat(s.total_paid) || 0;
        const remaining = Math.max(0, quoted - invoiced);
        const unpaid = Math.max(0, invoiced - paid);
        const percent = quoted > 0 ? Math.min(100, Math.round((paid / quoted) * 100)) : (paid > 0 ? 100 : 0);
        const hasVariance = (s.price_increases_count && s.price_increases_count > 0);

        const card = document.createElement('div');
        card.className = `bg-slate-850 rounded-2xl border ${hasVariance ? 'border-rose-500/40 shadow-rose-950/20 shadow-lg' : 'border-slate-800'} p-5 space-y-4 hover:border-slate-750 transition flex flex-col justify-between`;
        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg border border-amber-500/20 shrink-0">
                            ${s.name.charAt(0)}
                        </div>
                        <div>
                            <h3 class="font-bold text-white text-base leading-tight">${escapeHtml(s.name)}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-amber-400 border border-slate-700">${escapeHtml(s.category)}</span>
                                ${s.tax_number ? `<span class="text-[10px] text-slate-400 font-mono" title="الرقم الضريبي">VAT: ${escapeHtml(s.tax_number)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="printSupplierStatement(${s.id})" title="طباعة كشف الحساب / PDF" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition">
                            <i data-lucide="printer" class="w-4 h-4"></i>
                        </button>
                        <button onclick="exportSupplierStatementExcel(${s.id})" title="تصدير كشف حساب Excel" class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition">
                            <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openSupplierModal(${s.id})" title="تعديل المورد" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteSupplier(${s.id})" title="حذف المورد" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                ${s.contact_person || s.phone ? `
                    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1 border-t border-slate-800">
                        ${s.contact_person ? `<span class="flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5 text-slate-500"></i> ${escapeHtml(s.contact_person)}</span>` : ''}
                        ${s.phone ? `<a href="tel:${s.phone}" class="flex items-center gap-1 text-emerald-400 hover:underline font-mono"><i data-lucide="phone" class="w-3.5 h-3.5"></i> ${escapeHtml(s.phone)}</a>` : ''}
                    </div>
                ` : ''}

                <!-- Financial Status Bars -->
                <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-400 font-bold">نسبة سداد عروض الأسعار:</span>
                        <span class="font-bold text-white">${percent}%</span>
                    </div>
                    <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div class="bg-gradient-to-l from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-500" style="width: ${percent}%;"></div>
                    </div>

                    <div class="grid grid-cols-3 gap-1 pt-1.5 text-center">
                        <div class="border-l border-slate-800 pl-0.5">
                            <span class="text-[9px] text-slate-400 block font-semibold truncate">عروض الأسعار</span>
                            <span class="text-[11px] font-bold text-indigo-400 font-mono">${formatCurrency(quoted)}</span>
                        </div>
                        <div class="border-l border-slate-800 px-0.5">
                            <span class="text-[9px] text-slate-400 block font-semibold truncate">المفوتر منه</span>
                            <span class="text-[11px] font-bold text-purple-400 font-mono">${formatCurrency(invoiced)}</span>
                        </div>
                        <div class="px-0.5">
                            <span class="text-[9px] text-slate-400 block font-semibold truncate">المسدد له</span>
                            <span class="text-[11px] font-bold text-emerald-400 font-mono">${formatCurrency(paid)}</span>
                        </div>
                    </div>
                    ${unpaid > 0 ? `
                        <div class="mt-1 pt-1 border-t border-slate-800 text-[10px] text-amber-300 font-bold flex items-center justify-between">
                            <span>فواتير مستحقة غير مسددة:</span>
                            <span class="font-mono text-amber-400">${formatCurrency(unpaid)} ر.س</span>
                        </div>
                    ` : ''}
                </div>

                ${hasVariance ? `
                    <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs">
                        <div class="flex items-center gap-1.5 text-rose-300 font-bold">
                            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 shrink-0"></i>
                            <span>⚠️ رصد زيادات أسعار:</span>
                        </div>
                        <span class="font-black text-rose-400 font-mono">+${formatCurrency(s.total_variance_amount || 0)} ر.س</span>
                    </div>
                ` : ''}
            </div>

            <!-- Card Actions -->
            <div class="grid grid-cols-3 gap-1.5 pt-3 border-t border-slate-800 mt-2">
                <button onclick="openSupplierDetailModal(${s.id})" class="px-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 transition">
                    <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-400"></i>
                    <span>كشف حساب</span>
                </button>
                <button onclick="openSupplierPaymentModal(${s.id})" class="px-2 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition">
                    <i data-lucide="badge-dollar-sign" class="w-3.5 h-3.5"></i>
                    <span>+ سداد</span>
                </button>
                <button onclick="openQuotationModal(${s.id})" class="px-2 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>+ عرض سعر</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    initLucide();
}

// 5. Load and Render Quotations
function loadQuotationsTable() {
    const sFilter = document.getElementById('quo-filter-supplier');
    const pFilter = document.getElementById('quo-filter-project');

    if (sFilter && sFilter.options.length <= 1) {
        cachedSuppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            sFilter.appendChild(opt);
        });
    }

    if (pFilter && pFilter.options.length <= 1 && window.allProjectsList) {
        window.allProjectsList.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.code} - ${p.name}`;
            pFilter.appendChild(opt);
        });
    }

    const sVal = sFilter ? sFilter.value : '';
    const pVal = pFilter ? pFilter.value : '';

    const filtered = cachedQuotations.filter(q => {
        const matchesS = !sVal || String(q.supplier_id) === String(sVal);
        const matchesP = !pVal || String(q.project_id) === String(pVal);
        return matchesS && matchesP;
    });

    renderQuotationsList(filtered);
}

function renderQuotationsList(quotations) {
    const container = document.getElementById('quotations-cards-container');
    if (!container) return;
    container.innerHTML = '';

    if (!quotations || quotations.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-500 bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
                <i data-lucide="file-spreadsheet" class="w-10 h-10 mx-auto text-slate-600 mb-1"></i>
                <p class="font-bold text-slate-300">لا توجد عروض أسعار أو اتفاقيات توريد مطابقة</p>
                <p class="text-xs">سجل أسعار الحديد أو الخرسانة أو البلك المتفق عليها للمشروع لضبط الفواتير آلياً</p>
            </div>
        `;
        initLucide();
        return;
    }

    quotations.forEach(q => {
        const total = parseFloat(q.total_amount) || 0;
        const paid = parseFloat(q.total_paid) || 0;
        const remaining = Math.max(0, total - paid);
        const items = q.items || [];

        const card = document.createElement('div');
        card.className = 'bg-slate-850 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-slate-750 transition';
        card.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div class="space-y-1">
                    <div class="flex items-center gap-2.5">
                        <span class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold border border-indigo-500/20">${escapeHtml(q.quotation_number || 'QUO')}</span>
                        <h3 class="font-black text-white text-base">${escapeHtml(q.title)}</h3>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span class="font-bold text-amber-400 flex items-center gap-1"><i data-lucide="truck" class="w-3.5 h-3.5"></i> ${escapeHtml(q.supplier_name || 'المورد')}</span>
                        ${q.project_name ? `<span class="text-emerald-400 flex items-center gap-1"><i data-lucide="building-2" class="w-3.5 h-3.5"></i> ${escapeHtml(q.project_name)}</span>` : '<span class="text-slate-500">عام لكافة المشاريع</span>'}
                        ${q.quotation_date ? `<span class="text-slate-500 flex items-center gap-1"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${escapeHtml(q.quotation_date)}</span>` : ''}
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="text-left">
                        <span class="text-[10px] text-slate-400 block font-semibold">إجمالي العرض</span>
                        <span class="text-base font-black text-indigo-400 font-mono">${formatCurrency(total)} ر.س</span>
                    </div>
                    <div class="text-left border-r border-slate-700 pr-3">
                        <span class="text-[10px] text-slate-400 block font-semibold">المتبقي له</span>
                        <span class="text-base font-black text-amber-400 font-mono">${formatCurrency(remaining)} ر.س</span>
                    </div>
                    <button onclick="openEditQuotationModal(${q.id})" title="تعديل عرض السعر" class="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteSupplierQuotation(${q.id})" title="حذف عرض السعر" class="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Items Table in Quotation -->
            <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                <table class="w-full text-right text-xs">
                    <thead class="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                            <th class="p-2.5">بند التوريد</th>
                            <th class="p-2.5 text-center">الوحدة</th>
                            <th class="p-2.5 text-center">السعر المتفق عليه</th>
                            <th class="p-2.5 text-center">الكمية التقديرية</th>
                            <th class="p-2.5 text-center">إجمالي البند</th>
                            <th class="p-2.5">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60 text-slate-300">
                        ${items.map(it => `
                            <tr class="hover:bg-slate-800/40">
                                <td class="p-2.5 font-bold text-white">${escapeHtml(it.item_name)}</td>
                                <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">${escapeHtml(it.unit)}</span></td>
                                <td class="p-2.5 text-center font-bold text-emerald-400 font-mono">${formatCurrency(it.unit_price)} ر.س</td>
                                <td class="p-2.5 text-center font-mono">${it.quantity || 1}</td>
                                <td class="p-2.5 text-center font-bold text-indigo-400 font-mono">${formatCurrency(it.total_price || (it.unit_price * (it.quantity || 1)))} ر.س</td>
                                <td class="p-2.5 text-slate-500 text-[11px]">${escapeHtml(it.notes || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="flex items-center justify-between text-xs pt-1">
                <span class="text-slate-400">${q.notes ? `ملاحظات: ${escapeHtml(q.notes)}` : ''}</span>
                <button onclick="openExpenseModalForSupplier(${q.supplier_id}, ${q.id})" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition">
                    <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                    <span>+ تسجيل فاتورة توريد من هذا العرض</span>
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    initLucide();
}

// 6. Render Price Variances Table
function renderVariancesTable(variances) {
    const tbody = document.getElementById('variances-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!variances || variances.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="p-8 text-center text-slate-500">
                    <div class="space-y-1">
                        <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-400 mx-auto mb-1"></i>
                        <p class="font-bold text-emerald-400 text-sm">ممتاز! لا توجد زيادات أو فروقات أسعار مسجلة</p>
                        <p class="text-xs text-slate-400">جميع فواتير التوريد المدخلة مطابقة لأسعار عروض الأسعار المتفق عليها ✓</p>
                    </div>
                </td>
            </tr>
        `;
        initLucide();
        return;
    }

    variances.forEach(v => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/60 transition bg-rose-500/5';
        row.innerHTML = `
            <td class="p-3.5 whitespace-nowrap text-slate-400 font-mono">${v.expense_date}</td>
            <td class="p-3.5 whitespace-nowrap font-bold text-white">
                <div>${escapeHtml(v.project_name)}</div>
                <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(v.project_code || '')}</span>
            </td>
            <td class="p-3.5 whitespace-nowrap font-bold text-amber-400">
                <div class="flex items-center gap-1">
                    <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                    <span>${escapeHtml(v.supplier_name)}</span>
                </div>
                <span class="text-[10px] text-slate-500 block font-normal">${escapeHtml(v.supplier_category || '')}</span>
            </td>
            <td class="p-3.5 font-medium text-slate-200">
                <span class="font-bold text-white">${escapeHtml(v.quotation_item_name || v.expense_title)}</span>
                ${v.quotation_number ? `<div class="text-[10px] text-indigo-400 font-mono">عرض: ${escapeHtml(v.quotation_number)}</div>` : ''}
            </td>
            <td class="p-3.5 text-center whitespace-nowrap font-mono font-bold text-slate-200">
                ${v.item_quantity} ${escapeHtml(v.quotation_item_unit || '')}
            </td>
            <td class="p-3.5 text-center whitespace-nowrap font-mono font-bold text-slate-400">
                ${formatCurrency(v.quoted_unit_price)} ر.س
            </td>
            <td class="p-3.5 text-center whitespace-nowrap font-mono font-bold text-rose-300">
                ${formatCurrency(v.unit_price)} ر.س
            </td>
            <td class="p-3.5 text-center whitespace-nowrap">
                <span class="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                    +${formatCurrency(v.price_variance)} ر.س
                </span>
            </td>
            <td class="p-3.5 text-center whitespace-nowrap font-black text-rose-400 text-sm font-mono">
                +${formatCurrency(v.total_variance)} ر.س
            </td>
            <td class="p-3.5 text-center whitespace-nowrap">
                ${v.invoice_file_path ? `
                    <button onclick="viewInvoice('${v.invoice_file_path}', '${escapeHtml(v.expense_title)}')" class="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[10px] inline-flex items-center gap-1 transition">
                        <i data-lucide="eye" class="w-3 h-3"></i>
                        <span>عرض</span>
                    </button>
                ` : '<span class="text-slate-600 text-[10px]">-</span>'}
            </td>
            <td class="p-3.5 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="openEditExpenseModal(${v.expense_id || v.id})" title="تعديل الفاتورة وتصحيح السعر" class="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteExpense(${v.expense_id || v.id})" title="حذف الفاتورة" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    initLucide();
}

// 7. Supplier CRUD Modals & Category Management
const DEFAULT_SUPPLIER_CATEGORIES = [
    'حديد تسليح',
    'خرسانة جاهزة',
    'بلك وإسمنت',
    'سباكة وصحي',
    'كهرباء وإنارة',
    'عزل ومواد كيميائية',
    'تشطيبات وديكور',
    'خشب ونجارة',
    'دهانات وبويات',
    'ألومنيوم وزجاج',
    'رخام وسيراميك',
    'أدوات ومعدات',
    'عام'
];

function getSupplierCategories() {
    let custom = [];
    try {
        const stored = localStorage.getItem('custom_supplier_categories');
        if (stored) custom = JSON.parse(stored);
    } catch (e) {}

    const fromCached = (cachedSuppliers || []).map(s => s.category).filter(Boolean);
    const set = new Set([...DEFAULT_SUPPLIER_CATEGORIES, ...custom, ...fromCached]);
    return Array.from(set).filter(c => c && c.trim() !== '' && c !== '__custom__');
}

function saveCustomSupplierCategory(category) {
    if (!category || !category.trim() || DEFAULT_SUPPLIER_CATEGORIES.includes(category.trim())) return;
    try {
        let custom = [];
        const stored = localStorage.getItem('custom_supplier_categories');
        if (stored) custom = JSON.parse(stored);
        if (!custom.includes(category.trim())) {
            custom.push(category.trim());
            localStorage.setItem('custom_supplier_categories', JSON.stringify(custom));
        }
    } catch (e) {}
}

function refreshSupplierCategoryDropdowns(selectedVal = null) {
    const categories = getSupplierCategories();

    // 1. In Supplier Modal
    const selectModal = document.getElementById('supplier-category');
    if (selectModal) {
        selectModal.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (selectedVal && selectedVal === cat) opt.selected = true;
            selectModal.appendChild(opt);
        });
        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = '+ كتابة تصنيف جديد مخصص...';
        if (selectedVal === '__custom__') customOpt.selected = true;
        selectModal.appendChild(customOpt);
    }

    // 2. In Filter Bar (tab-suppliers)
    const selectFilter = document.getElementById('supplier-category-filter');
    if (selectFilter) {
        const currentFilter = selectFilter.value;
        selectFilter.innerHTML = '<option value="">جميع التخصصات والتصنيفات</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (currentFilter && currentFilter === cat) opt.selected = true;
            selectFilter.appendChild(opt);
        });
    }
}

function onSupplierCategoryChanged(val) {
    const box = document.getElementById('supplier-custom-category-box');
    const input = document.getElementById('supplier-custom-category');
    if (val === '__custom__') {
        if (box) box.classList.remove('hidden');
        if (input) {
            input.focus();
            input.required = true;
        }
    } else {
        if (box) box.classList.add('hidden');
        if (input) {
            input.required = false;
            input.value = '';
        }
    }
}

function enableCustomSupplierCategory() {
    const select = document.getElementById('supplier-category');
    if (select) select.value = '__custom__';
    onSupplierCategoryChanged('__custom__');
}

function cancelCustomSupplierCategory() {
    const select = document.getElementById('supplier-category');
    const box = document.getElementById('supplier-custom-category-box');
    const input = document.getElementById('supplier-custom-category');
    if (box) box.classList.add('hidden');
    if (input) input.value = '';
    if (select) select.value = 'عام';
}

function openSupplierModal(supplierId = null) {
    const modalTitle = document.getElementById('supplier-modal-title');
    const form = document.getElementById('supplier-form');
    if (form) form.reset();
    document.getElementById('supplier-id').value = '';
    cancelCustomSupplierCategory();

    if (supplierId) {
        const s = cachedSuppliers.find(x => x.id === supplierId);
        if (s) {
            if (modalTitle) modalTitle.innerText = `تعديل بيانات المورد: ${s.name}`;
            document.getElementById('supplier-id').value = s.id;
            document.getElementById('supplier-name').value = s.name || '';
            refreshSupplierCategoryDropdowns(s.category);
            const catSelect = document.getElementById('supplier-category');
            if (catSelect && s.category) {
                catSelect.value = s.category;
            }
            document.getElementById('supplier-phone').value = s.phone || '';
            document.getElementById('supplier-tax-number').value = s.tax_number || '';
            document.getElementById('supplier-contact-person').value = s.contact_person || '';
            document.getElementById('supplier-address').value = s.address || '';
            document.getElementById('supplier-notes').value = s.notes || '';
        }
    } else {
        if (modalTitle) modalTitle.innerText = 'تسجيل مورد جديد';
        refreshSupplierCategoryDropdowns('حديد تسليح');
    }

    openModal('supplier-modal');
}

async function submitSupplierForm(e) {
    e.preventDefault();
    const id = document.getElementById('supplier-id').value;
    const catSelect = document.getElementById('supplier-category');
    let category = catSelect ? catSelect.value : 'عام';
    const customCatInput = document.getElementById('supplier-custom-category');
    const customBox = document.getElementById('supplier-custom-category-box');

    if (category === '__custom__' || (customBox && !customBox.classList.contains('hidden'))) {
        const customVal = customCatInput ? customCatInput.value.trim() : '';
        if (!customVal) {
            showToast('يرجى كتابة اسم التصنيف الجديد أو اختيار تصنيف من القائمة', 'warning');
            if (customCatInput) customCatInput.focus();
            return;
        }
        category = customVal;
        saveCustomSupplierCategory(category);
    }

    const payload = {
        name: document.getElementById('supplier-name').value.trim(),
        category: category,
        phone: document.getElementById('supplier-phone').value.trim(),
        tax_number: document.getElementById('supplier-tax-number').value.trim(),
        contact_person: document.getElementById('supplier-contact-person').value.trim(),
        address: document.getElementById('supplier-address').value.trim(),
        notes: document.getElementById('supplier-notes').value.trim()
    };

    try {
        const url = id ? `/api/suppliers/${id}` : '/api/suppliers';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(id ? 'تم تحديث بيانات المورد بنجاح' : 'تم إضافة المورد والتصنيف بنجاح');
            closeModal('supplier-modal');
            refreshSupplierCategoryDropdowns();
            loadSuppliersData();
        } else {
            showToast(data.error || 'حدث خطأ أثناء الحفظ', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

async function deleteSupplier(supplierId) {
    if (!confirm('هل أنت متأكد من حذف هذا المورد؟ سيتم حذف عروض الأسعار التابعة له.')) return;
    try {
        const res = await fetch(`/api/suppliers/${supplierId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف المورد بنجاح');
            loadSuppliersData();
        } else {
            showToast(data.error || 'فشل حذف المورد', 'error');
        }
    } catch (err) {
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

// 8. Supplier Detail / Dossier Modal
async function openSupplierDetailModal(supplierId) {
    currentSelectedSupplierDetailId = supplierId;
    try {
        const res = await fetch(`/api/suppliers/${supplierId}`);
        const data = await res.json();
        if (!data.success) {
            showToast(data.error || 'المورد غير موجود', 'error');
            return;
        }

        const s = data.supplier;
        document.getElementById('sd-name').innerText = s.name;
        document.getElementById('sd-category').innerText = s.category;

        let metaText = [];
        if (s.contact_person) metaText.push(`المسؤول: ${s.contact_person}`);
        if (s.phone) metaText.push(`الهاتف: ${s.phone}`);
        if (s.tax_number) metaText.push(`الرقم الضريبي: ${s.tax_number}`);
        if (s.address) metaText.push(`العنوان: ${s.address}`);
        document.getElementById('sd-meta').innerText = metaText.join(' • ');

        // KPI Summary
        const sum = s.summary || {};
        document.getElementById('sd-stat-quoted').innerText = formatCurrency(sum.total_quoted || 0);
        const invEl = document.getElementById('sd-stat-invoiced');
        if (invEl) invEl.innerText = formatCurrency(sum.total_invoiced || 0);
        document.getElementById('sd-stat-paid').innerText = formatCurrency(sum.total_paid || 0);

        const remEl = document.getElementById('sd-stat-remaining');
        const remLabel = document.getElementById('sd-stat-remaining-label');
        if (remEl) {
            if (sum.unpaid_balance > 0) {
                remEl.innerText = formatCurrency(sum.unpaid_balance);
                remEl.className = 'text-base sm:text-lg font-black text-amber-400';
                if (remLabel) remLabel.innerText = 'المتبقي المستحق له';
            } else if (sum.excess_paid > 0) {
                remEl.innerText = formatCurrency(sum.excess_paid);
                remEl.className = 'text-base sm:text-lg font-black text-emerald-400';
                if (remLabel) remLabel.innerText = 'رصيد دائن للمورد (مدفوع مقدماً)';
            } else {
                remEl.innerText = '0.00';
                remEl.className = 'text-base sm:text-lg font-black text-slate-400';
                if (remLabel) remLabel.innerText = 'الحساب خالص ومسدد بالكامل ✓';
            }
        }
        document.getElementById('sd-stat-variance').innerText = formatCurrency(sum.total_variance || 0);

        const pCountEl = document.getElementById('sd-tab-count-payments');
        if (pCountEl) pCountEl.innerText = (s.payments || []).length;

        // Render Quotations in Detail
        const qContainer = document.getElementById('sd-pane-quotations');
        qContainer.innerHTML = '';
        if (!s.quotations || s.quotations.length === 0) {
            qContainer.innerHTML = '<div class="p-6 text-center text-slate-500">لا توجد عروض أسعار مسجلة لهذا المورد</div>';
        } else {
            s.quotations.forEach(q => {
                const div = document.createElement('div');
                div.className = 'p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs';
                const taxBadge = q.tax_type === 'inclusive' 
                    ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">شامل الضريبة 15%</span>' 
                    : (q.tax_type === 'zero' 
                        ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">بدون ضريبة (0%)</span>' 
                        : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">+ 15% ضريبة مضافة</span>');

                div.innerHTML = `
                    <div class="flex items-center justify-between font-bold">
                        <div class="flex items-center gap-1.5">
                            <span class="text-white">${escapeHtml(q.title)} (${escapeHtml(q.quotation_number || '')})</span>
                            ${taxBadge}
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-indigo-400 font-mono text-sm">${formatCurrency(q.total_amount)} ر.س</span>
                            <button onclick="openEditQuotationModal(${q.id})" title="تعديل عرض السعر" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteSupplierQuotation(${q.id})" title="حذف عرض السعر" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                    <div class="text-slate-400 text-[11px]">
                        <span>المشروع: ${escapeHtml(q.project_name || 'عام')} ${q.tax_amount > 0 ? `(قبل الضريبة: ${formatCurrency(q.amount_without_tax || 0)} + ضريبة: ${formatCurrency(q.tax_amount)})` : ''}</span>
                    </div>
                    <div class="pt-2 border-t border-slate-800">
                        <table class="w-full text-right text-[11px]">
                            <thead class="text-slate-500">
                                <tr>
                                    <th>البند</th>
                                    <th class="text-center">الوحدة</th>
                                    <th class="text-center">سعر الوحدة</th>
                                    <th class="text-center">الكمية</th>
                                    <th class="text-center">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800 text-slate-300">
                                ${(q.items || []).map(it => `
                                    <tr>
                                        <td class="py-1 font-semibold">${escapeHtml(it.item_name)}</td>
                                        <td class="text-center">${escapeHtml(it.unit)}</td>
                                        <td class="text-center font-mono text-emerald-400">${formatCurrency(it.unit_price)}</td>
                                        <td class="text-center font-mono">${it.quantity}</td>
                                        <td class="text-center font-mono text-indigo-400">${formatCurrency(it.total_price)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                qContainer.appendChild(div);
            });
        }

        // Render Invoices in Detail
        const invTbody = document.getElementById('sd-invoices-tbody');
        invTbody.innerHTML = '';
        if (!s.expenses || s.expenses.length === 0) {
            invTbody.innerHTML = '<tr><td colspan="12" class="p-6 text-center text-slate-500">لا توجد فواتير مصروفات مسجلة لهذا المورد حتى الآن</td></tr>';
        } else {
            s.expenses.forEach(e => {
                const totalAmt = parseFloat(e.amount) || 0;
                const paidAmt = (e.payment_status === 'unpaid' ? 0 : parseFloat(e.paid_amount || totalAmt));
                const remainingAmt = Math.max(0, totalAmt - paidAmt);

                let payBadge = '';
                if (e.payment_status === 'paid' || (remainingAmt <= 0.01 && paidAmt > 0)) {
                    payBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">مسدد بالكامل ✓</span>';
                } else if (e.payment_status === 'partial' || (paidAmt > 0 && remainingAmt > 0.01)) {
                    payBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">مسدد جزئياً (${formatCurrency(paidAmt)})</span>`;
                } else {
                    payBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">غير مسدد</span>';
                }

                const tr = document.createElement('tr');
                tr.className = e.has_price_increase === 1 ? 'bg-rose-500/10' : '';
                tr.innerHTML = `
                    <td class="p-2.5 font-mono text-slate-400 text-xs">${e.expense_date}</td>
                    <td class="p-2.5 font-mono text-xs">
                        ${e.payment_status === 'unpaid' && !e.payment_date 
                            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">لم يُصرف بعد</span>` 
                            : `<span class="text-emerald-400 font-bold">${e.payment_date || e.expense_date}</span>`
                        }
                    </td>
                    <td class="p-2.5 font-bold text-white">${escapeHtml(e.project_name || '-')}</td>
                    <td class="p-2.5 text-slate-200">${escapeHtml(e.title)}</td>
                    <td class="p-2.5 text-slate-300">${escapeHtml(e.quotation_item_name || '-')}</td>
                    <td class="p-2.5 text-center font-mono">${e.item_quantity || 1} ${escapeHtml(e.quotation_item_unit || '')}</td>
                    <td class="p-2.5 text-center font-mono font-bold">${formatCurrency(e.unit_price || 0)}</td>
                    <td class="p-2.5 text-center font-mono font-bold text-emerald-400">${formatCurrency(e.amount)}</td>
                    <td class="p-2.5 text-center whitespace-nowrap">${payBadge}</td>
                    <td class="p-2.5 text-center">
                        ${e.has_price_increase === 1 ? `
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                ⚠️ زاد +${formatCurrency(e.total_variance || 0)}
                            </span>
                        ` : `
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                ✓ مطابق
                            </span>
                        `}
                    </td>
                    <td class="p-2.5 text-center">
                        ${e.invoice_file_path ? `
                            <button onclick="viewInvoice('${e.invoice_file_path}', '${escapeHtml(e.title)}')" class="text-emerald-400 hover:underline font-bold text-xs">عرض</button>
                        ` : '<span class="text-slate-600">-</span>'}
                    </td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                            ${remainingAmt > 0.01 ? `
                                <button onclick="openSupplierPaymentModal(${s.id}, ${e.id})" title="سداد دفعة من هذه الفاتورة" class="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition">
                                    <i data-lucide="badge-dollar-sign" class="w-3 h-3"></i>
                                    <span>سداد</span>
                                </button>
                            ` : ''}
                            <button onclick="openEditExpenseModal(${e.id})" title="تعديل الفاتورة" class="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteExpense(${e.id})" title="حذف الفاتورة" class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </td>
                `;
                invTbody.appendChild(tr);
            });
        }

        // Render Payments in Detail
        const payTbody = document.getElementById('sd-payments-tbody');
        if (payTbody) {
            payTbody.innerHTML = '';
            if (!s.payments || s.payments.length === 0) {
                payTbody.innerHTML = '<tr><td colspan="10" class="p-8 text-center text-slate-500 text-xs">لا توجد دفعات أو سدادات مسجلة لهذا المورد حتى الآن. انقر على "+ تسجيل دفعة جديدة" لقيد أول دفعة.</td></tr>';
            } else {
                let totalPaymentsSum = 0;
                s.payments.forEach(p => {
                    const pAmt = parseFloat(p.amount || 0);
                    totalPaymentsSum += pAmt;
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-slate-800/60 transition';
                    tr.innerHTML = `
                        <td class="p-2.5 font-mono text-slate-300 whitespace-nowrap">${escapeHtml(p.payment_date)}</td>
                        <td class="p-2.5 font-bold text-white whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">${escapeHtml(p.payment_type || 'دفعة')}</span>
                        </td>
                        <td class="p-2.5 text-slate-300 whitespace-nowrap">${escapeHtml(p.payment_method || 'تحويل بنكي')}</td>
                        <td class="p-2.5 text-slate-300">${p.project_name ? `<span class="text-emerald-400 font-semibold">${escapeHtml(p.project_name)}</span>` : '<span class="text-slate-500">عام لكافة المشاريع</span>'}</td>
                        <td class="p-2.5 text-slate-300 text-xs">
                            ${p.expense_title ? `<span class="text-white font-semibold">${escapeHtml(p.expense_title)}</span>` : '<span class="text-slate-500">دفعة عامة تحت الحساب</span>'}
                        </td>
                        <td class="p-2.5 font-mono text-slate-400 text-xs">${escapeHtml(p.reference_number || '-')}</td>
                        <td class="p-2.5 text-center whitespace-nowrap font-mono font-black text-emerald-400 text-sm">
                            ${formatCurrency(pAmt)} ر.س
                        </td>
                        <td class="p-2.5 text-slate-400 text-xs max-w-xs truncate" title="${escapeHtml(p.notes || '')}">
                            ${escapeHtml(p.notes || '-')}
                        </td>
                        <td class="p-2.5 text-center whitespace-nowrap">
                            ${p.receipt_file_path ? `
                                <button onclick="viewInvoice('${p.receipt_file_path}', 'سند صرف - ${escapeHtml(p.payment_type || '')}')" class="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-bold transition">سند</button>
                            ` : '<span class="text-slate-600">-</span>'}
                        </td>
                        <td class="p-2.5 text-center whitespace-nowrap">
                            <button onclick="deleteSupplierPayment(${p.id}, ${s.id})" title="حذف سند السداد" class="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </td>
                    `;
                    payTbody.appendChild(tr);
                });

                // Summary footer row
                const trTotal = document.createElement('tr');
                trTotal.className = 'bg-slate-900/90 font-bold border-t-2 border-slate-700 text-xs';
                trTotal.innerHTML = `
                    <td colspan="6" class="p-3 text-slate-300 font-black">إجمالي كافة المدفوعات والسدادات المقيدة للمورد:</td>
                    <td class="p-3 text-center font-mono font-black text-emerald-400 text-base whitespace-nowrap">${formatCurrency(totalPaymentsSum)} ر.س</td>
                    <td colspan="3" class="p-3"></td>
                `;
                payTbody.appendChild(trTotal);
            }
        }

        // Render Variances in Detail
        const vContainer = document.getElementById('sd-pane-variances');
        vContainer.innerHTML = '';
        const supplierVariances = (s.expenses || []).filter(e => e.has_price_increase === 1);
        if (supplierVariances.length === 0) {
            vContainer.innerHTML = `
                <div class="p-6 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
                    <i data-lucide="check-circle" class="w-8 h-8 text-emerald-400 mx-auto mb-1"></i>
                    <p class="font-bold text-emerald-400 text-sm">لا توجد زيادات مسجلة على هذا المورد</p>
                    <p class="text-xs text-slate-500">جميع أسعار الفواتير مطابقة لأسعار الاتفاقيات</p>
                </div>
            `;
        } else {
            supplierVariances.forEach(v => {
                const div = document.createElement('div');
                div.className = 'p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1.5 text-xs';
                div.innerHTML = `
                    <div class="flex items-center justify-between font-bold">
                        <span class="text-rose-300">${escapeHtml(v.title)} (${escapeHtml(v.project_name || '')})</span>
                        <span class="text-rose-400 font-mono font-black">+${formatCurrency(v.total_variance || 0)} ر.س إجمالي الزيادة</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-400">
                        <span>البند: <strong class="text-white">${escapeHtml(v.quotation_item_name || '-')}</strong></span>
                        <span>السعر المتفق عليه: <strong class="text-slate-300 font-mono">${formatCurrency(v.quoted_unit_price || 0)}</strong> | السعر الفعلي: <strong class="text-rose-400 font-mono">${formatCurrency(v.unit_price || 0)}</strong> (+${formatCurrency(v.price_variance || 0)} للوحدة)</span>
                    </div>
                `;
                vContainer.appendChild(div);
            });
        }

        switchSupplierDetailTab('quotations');
        openModal('supplier-detail-modal');
        initLucide();
    } catch (err) {
        console.error('Error opening supplier detail modal:', err);
    }
}

function switchSupplierDetailTab(tab) {
    const tabs = ['quotations', 'invoices', 'payments', 'variances'];
    tabs.forEach(t => {
        const pane = document.getElementById(`sd-pane-${t}`);
        const btn = document.getElementById(`btn-sd-tab-${t}`);
        if (pane) {
            if (t === tab) pane.classList.remove('hidden');
            else pane.classList.add('hidden');
        }
        if (btn) {
            if (t === tab) {
                btn.className = `px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 whitespace-nowrap`;
            } else {
                btn.className = `px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white whitespace-nowrap`;
            }
        }
    });
}

function editSupplierFromDetail() {
    closeModal('supplier-detail-modal');
    if (currentSelectedSupplierDetailId) {
        openSupplierModal(currentSelectedSupplierDetailId);
    }
}

// ----------------- SUPPLIER PAYMENTS MODAL & HANDLERS -----------------
let currentSupplierUnpaidInvoices = [];

async function openSupplierPaymentModal(supplierId = null, preselectedExpenseId = null) {
    const form = document.getElementById('supplier-payment-form');
    if (form) form.reset();

    const sSelect = document.getElementById('sp-supplier-select');
    sSelect.innerHTML = '<option value="">-- اختر المورد المستفيد * --</option>';
    cachedSuppliers.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.category})`;
        if (supplierId && String(s.id) === String(supplierId)) {
            opt.selected = true;
        }
        sSelect.appendChild(opt);
    });

    const pSelect = document.getElementById('sp-project-id');
    pSelect.innerHTML = '<option value="">-- عام (لجميع المشاريع / الحساب العام) --</option>';
    if (window.allProjectsList) {
        window.allProjectsList.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.code} - ${p.name}`;
            pSelect.appendChild(opt);
        });
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sp-payment-date').value = today;

    const initialSupId = supplierId || (sSelect.value ? sSelect.value : null);
    await onSupplierPaymentSupplierChanged(initialSupId, preselectedExpenseId);

    openModal('supplier-payment-modal');
    initLucide();
}

async function onSupplierPaymentSupplierChanged(supplierId, preselectedExpenseId = null) {
    const idInput = document.getElementById('sp-supplier-id');
    const nameEl = document.getElementById('sp-modal-supplier-name');
    const invSelect = document.getElementById('sp-expense-id');
    invSelect.innerHTML = '<option value="">-- دفعة عامة غير مقيدة بفاتورة (تحت الحساب) --</option>';

    if (!supplierId) {
        if (idInput) idInput.value = '';
        if (nameEl) nameEl.innerText = '';
        currentSupplierUnpaidInvoices = [];
        return;
    }

    if (idInput) idInput.value = supplierId;
    const supObj = cachedSuppliers.find(s => String(s.id) === String(supplierId));
    if (nameEl) nameEl.innerText = supObj ? `المورد: ${supObj.name}` : '';

    try {
        const res = await fetch(`/api/suppliers/${supplierId}`);
        const data = await res.json();
        if (data.success && data.supplier) {
            const expList = data.supplier.expenses || [];
            currentSupplierUnpaidInvoices = expList;

            expList.forEach(e => {
                const total = parseFloat(e.amount) || 0;
                const paid = (e.payment_status === 'unpaid' ? 0 : parseFloat(e.paid_amount || total));
                const remaining = Math.max(0, total - paid);

                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = `فاتورة #${e.id}: ${e.title} [إجمالي: ${formatCurrency(total)} ر.س ${remaining > 0 ? `- متبقي: ${formatCurrency(remaining)} ر.س` : '- مسددة'}]`;
                if (preselectedExpenseId && String(e.id) === String(preselectedExpenseId)) {
                    opt.selected = true;
                }
                invSelect.appendChild(opt);
            });

            if (preselectedExpenseId) {
                onSupplierPaymentInvoiceChanged(preselectedExpenseId);
            }
        }
    } catch (err) {
        console.error('Error fetching supplier invoices for payment modal:', err);
    }
}

function onSupplierPaymentInvoiceChanged(expenseId) {
    if (!expenseId) return;
    const inv = currentSupplierUnpaidInvoices.find(e => String(e.id) === String(expenseId));
    if (inv) {
        const total = parseFloat(inv.amount) || 0;
        const paid = (inv.payment_status === 'unpaid' ? 0 : parseFloat(inv.paid_amount || total));
        const remaining = Math.max(0, total - paid);

        const amtInput = document.getElementById('sp-amount');
        if (amtInput && (!amtInput.value || parseFloat(amtInput.value) === 0)) {
            amtInput.value = (remaining > 0 ? remaining : total).toFixed(2);
        }

        const typeSelect = document.getElementById('sp-payment-type');
        if (typeSelect) {
            typeSelect.value = remaining > 0 ? 'سداد فاتورة بالكامل' : 'دفعة تحت الحساب';
        }

        const notesEl = document.getElementById('sp-notes');
        if (notesEl && !notesEl.value) {
            notesEl.value = `سداد عن فاتورة: ${inv.title}`;
        }

        if (inv.project_id) {
            const pSelect = document.getElementById('sp-project-id');
            if (pSelect) pSelect.value = inv.project_id;
        }
    }
}

async function submitSupplierPaymentForm(e) {
    e.preventDefault();
    const supId = document.getElementById('sp-supplier-id')?.value || document.getElementById('sp-supplier-select')?.value;
    if (!supId) {
        showToast('يرجى اختيار المورد المستفيد', 'warning');
        return;
    }

    const amount = parseFloat(document.getElementById('sp-amount').value || 0);
    if (amount <= 0) {
        showToast('يرجى إدخال مبلغ سداد صحيح أكبر من الصفر', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('payment_date', document.getElementById('sp-payment-date').value);
    formData.append('payment_type', document.getElementById('sp-payment-type').value);
    formData.append('payment_method', document.getElementById('sp-payment-method').value);
    formData.append('project_id', document.getElementById('sp-project-id').value || '');
    formData.append('expense_id', document.getElementById('sp-expense-id').value || '');
    formData.append('reference_number', document.getElementById('sp-reference-number').value.trim());
    formData.append('notes', document.getElementById('sp-notes').value.trim());

    const fileInput = document.getElementById('sp-receipt-file');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('receipt_file', fileInput.files[0]);
    }

    try {
        const res = await fetch(`/api/suppliers/${supId}/payments`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showToast('تم تسجيل سداد الدفعة للمورد بنجاح وقيدها في كشف الحساب!');
            closeModal('supplier-payment-modal');
            document.getElementById('supplier-payment-form').reset();
            await loadSuppliersData();
            if (typeof currentSelectedSupplierDetailId !== 'undefined' && currentSelectedSupplierDetailId && String(currentSelectedSupplierDetailId) === String(supId)) {
                openSupplierDetailModal(supId);
            }
        } else {
            showToast(data.error || 'حدث خطأ أثناء حفظ السداد', 'error');
        }
    } catch (err) {
        console.error('Error submitting supplier payment:', err);
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

async function deleteSupplierPayment(paymentId, supplierId) {
    if (!confirm('هل أنت متأكد من حذف هذا السند؟ سيتم خصمه من إجمالي المسدد وتحديث الرصيد المستحق فوراً.')) return;
    try {
        const res = await fetch(`/api/supplier-payments/${paymentId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف سند السداد بنجاح');
            await loadSuppliersData();
            if (typeof currentSelectedSupplierDetailId !== 'undefined' && currentSelectedSupplierDetailId) {
                openSupplierDetailModal(currentSelectedSupplierDetailId);
            }
        } else {
            showToast(data.error || 'فشل حذف سند السداد', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

// 9. Quotation Modal & Dynamic Items Table
function resetQuotationModal() {
    const editIdInput = document.getElementById('quo-edit-id');
    if (editIdInput) editIdInput.value = '';

    const modalTitle = document.getElementById('quo-modal-title');
    if (modalTitle) modalTitle.innerText = 'تسجيل عرض سعر / اتفاقية توريد جديدة';

    const submitBtnText = document.getElementById('quo-btn-submit-text');
    if (submitBtnText) submitBtnText.innerText = 'حفظ عرض السعر والبنود';

    const form = document.getElementById('supplier-quotation-form');
    if (form) form.reset();

    const taxRadio = document.querySelector('input[name="quo_tax_type"][value="exclusive"]');
    if (taxRadio) taxRadio.checked = true;

    const itemsCont = document.getElementById('quo-items-rows-container');
    if (itemsCont) itemsCont.innerHTML = '';
}

function openQuotationModal(preselectedSupplierId = null, preselectedProjectId = null) {
    resetQuotationModal();

    const sSelect = document.getElementById('quo-supplier-id');
    sSelect.innerHTML = '<option value="">-- اختر المورد * --</option>';
    cachedSuppliers.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.category})`;
        if (preselectedSupplierId && String(s.id) === String(preselectedSupplierId)) {
            opt.selected = true;
        }
        sSelect.appendChild(opt);
    });

    const pSelect = document.getElementById('quo-project-id');
    pSelect.innerHTML = '<option value="">-- عام (لجميع المشاريع) --</option>';
    if (window.allProjectsList) {
        window.allProjectsList.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.code} - ${p.name}`;
            if (preselectedProjectId && String(p.id) === String(preselectedProjectId)) {
                opt.selected = true;
            }
            pSelect.appendChild(opt);
        });
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('quo-date').value = today;

    addQuotationItemRow();
    calcQuotationTotal();

    openModal('supplier-quotation-modal');
    initLucide();
}

async function openEditQuotationModal(quotationId) {
    resetQuotationModal();

    try {
        const res = await fetch(`/api/supplier-quotations/${quotationId}`);
        const data = await res.json();
        if (!data.success || !data.quotation) {
            showToast(data.error || 'تعذر تحميل بيانات عرض السعر', 'error');
            return;
        }
        const q = data.quotation;

        const editIdInput = document.getElementById('quo-edit-id');
        if (editIdInput) editIdInput.value = q.id;

        const modalTitle = document.getElementById('quo-modal-title');
        if (modalTitle) modalTitle.innerText = `تعديل عرض السعر / الاتفاقية #${q.quotation_number || q.id}`;

        const submitBtnText = document.getElementById('quo-btn-submit-text');
        if (submitBtnText) submitBtnText.innerText = 'تحديث وحفظ التعديلات';

        // Suppliers dropdown
        const sSelect = document.getElementById('quo-supplier-id');
        sSelect.innerHTML = '<option value="">-- اختر المورد * --</option>';
        cachedSuppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (${s.category})`;
            if (String(s.id) === String(q.supplier_id)) {
                opt.selected = true;
            }
            sSelect.appendChild(opt);
        });

        // Projects dropdown
        const pSelect = document.getElementById('quo-project-id');
        pSelect.innerHTML = '<option value="">-- عام (لجميع المشاريع) --</option>';
        if (window.allProjectsList) {
            window.allProjectsList.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.code} - ${p.name}`;
                if (q.project_id && String(p.id) === String(q.project_id)) {
                    opt.selected = true;
                }
                pSelect.appendChild(opt);
            });
        }

        document.getElementById('quo-title').value = q.title || '';
        document.getElementById('quo-number').value = q.quotation_number || '';
        document.getElementById('quo-date').value = q.quotation_date || '';
        document.getElementById('quo-notes').value = q.notes || '';

        // Select tax type
        const taxType = q.tax_type || 'exclusive';
        const taxRadio = document.querySelector(`input[name="quo_tax_type"][value="${taxType}"]`);
        if (taxRadio) taxRadio.checked = true;

        // Items
        const itemsCont = document.getElementById('quo-items-rows-container');
        itemsCont.innerHTML = '';
        if (q.items && q.items.length > 0) {
            q.items.forEach(it => addQuotationItemRow(it));
        } else {
            addQuotationItemRow();
        }

        calcQuotationTotal();
        openModal('supplier-quotation-modal');
        initLucide();
    } catch (err) {
        console.error('Error fetching quotation details:', err);
        showToast('فشل في جلب بيانات عرض السعر', 'error');
    }
}

function addQuotationItemRow(item = null) {
    const itemsCont = document.getElementById('quo-items-rows-container');
    if (!itemsCont) return;

    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-2 items-center bg-slate-800/80 p-2.5 rounded-xl border border-slate-750 quo-item-row';
    row.innerHTML = `
        <div class="col-span-5 sm:col-span-4">
            <input type="text" class="quo-item-name w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs" placeholder="اسم بند التوريد (مثلاً: حديد 16مم)" value="${item ? escapeHtml(item.item_name || '') : ''}" required>
        </div>
        <div class="col-span-3 sm:col-span-2">
            <select class="quo-item-unit w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs">
                <option value="طن" ${item && item.unit === 'طن' ? 'selected' : ''}>طن</option>
                <option value="م3" ${item && item.unit === 'م3' ? 'selected' : ''}>م3 (متر مكعب)</option>
                <option value="م2" ${item && item.unit === 'م2' ? 'selected' : ''}>م2 (متر مربع)</option>
                <option value="حبة" ${item && item.unit === 'حبة' ? 'selected' : ''}>حبة / بلكة</option>
                <option value="كيس" ${item && item.unit === 'كيس' ? 'selected' : ''}>كيس</option>
                <option value="لفة" ${item && item.unit === 'لفة' ? 'selected' : ''}>لفة</option>
                <option value="متر" ${item && item.unit === 'متر' ? 'selected' : ''}>متر طولي</option>
                <option value="مقطوعية" ${item && item.unit === 'مقطوعية' ? 'selected' : ''}>مقطوعية</option>
            </select>
        </div>
        <div class="col-span-4 sm:col-span-2">
            <input type="number" step="0.01" oninput="calcQuotationTotal()" class="quo-item-price w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold text-emerald-400 font-mono" placeholder="سعر الوحدة" value="${item && item.unit_price !== undefined ? item.unit_price : ''}" required>
        </div>
        <div class="col-span-4 sm:col-span-2">
            <input type="number" step="0.01" oninput="calcQuotationTotal()" class="quo-item-qty w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono" placeholder="الكمية" value="${item && item.quantity !== undefined ? item.quantity : 1}">
        </div>
        <div class="col-span-6 sm:col-span-1 text-center font-bold text-indigo-400 font-mono text-xs quo-item-subtotal">
            0.00
        </div>
        <div class="col-span-2 sm:col-span-1 text-center">
            <button type="button" onclick="removeQuotationItemRow(this)" class="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-700">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>
    `;
    itemsCont.appendChild(row);
    calcQuotationTotal();
    initLucide();
}

function removeQuotationItemRow(btn) {
    const row = btn.closest('.quo-item-row');
    const itemsCont = document.getElementById('quo-items-rows-container');
    if (itemsCont.querySelectorAll('.quo-item-row').length > 1) {
        row.remove();
        calcQuotationTotal();
    } else {
        showToast('يجب أن يحتوي عرض السعر على بند واحد على الأقل', 'warning');
    }
}

function calcQuotationTotal() {
    let itemsSum = 0;
    document.querySelectorAll('.quo-item-row').forEach(row => {
        const price = parseFloat(row.querySelector('.quo-item-price')?.value) || 0;
        const qty = parseFloat(row.querySelector('.quo-item-qty')?.value) || 0;
        const sub = Math.round(price * qty * 100) / 100;
        const subEl = row.querySelector('.quo-item-subtotal');
        if (subEl) subEl.innerText = sub.toFixed(2);
        itemsSum += sub;
    });

    itemsSum = Math.round(itemsSum * 100) / 100;

    const taxChoice = document.querySelector('input[name="quo_tax_type"]:checked')?.value || 'exclusive';
    let subtotal = 0;
    let vat = 0;
    let grandTotal = 0;

    const optExcl = document.getElementById('quo-tax-opt-exclusive');
    const optIncl = document.getElementById('quo-tax-opt-inclusive');
    const optZero = document.getElementById('quo-tax-opt-zero');
    const badge = document.getElementById('quo-tax-badge');

    if (optExcl) optExcl.className = taxChoice === 'exclusive' ? 'cursor-pointer border-2 border-indigo-500 bg-indigo-500/15 rounded-xl p-2.5 flex items-center gap-2.5 transition' : 'cursor-pointer border border-slate-700 bg-slate-800/40 rounded-xl p-2.5 flex items-center gap-2.5 transition opacity-70 hover:opacity-100';
    if (optIncl) optIncl.className = taxChoice === 'inclusive' ? 'cursor-pointer border-2 border-indigo-500 bg-indigo-500/15 rounded-xl p-2.5 flex items-center gap-2.5 transition' : 'cursor-pointer border border-slate-700 bg-slate-800/40 rounded-xl p-2.5 flex items-center gap-2.5 transition opacity-70 hover:opacity-100';
    if (optZero) optZero.className = taxChoice === 'zero' ? 'cursor-pointer border-2 border-indigo-500 bg-indigo-500/15 rounded-xl p-2.5 flex items-center gap-2.5 transition' : 'cursor-pointer border border-slate-700 bg-slate-800/40 rounded-xl p-2.5 flex items-center gap-2.5 transition opacity-70 hover:opacity-100';

    if (taxChoice === 'exclusive') {
        if (badge) badge.innerText = 'غير شامل الضريبة (+15%)';
        subtotal = itemsSum;
        vat = Math.round(subtotal * 0.15 * 100) / 100;
        grandTotal = Math.round((subtotal + vat) * 100) / 100;
    } else if (taxChoice === 'inclusive') {
        if (badge) badge.innerText = 'شامل الضريبة 15% (مشمولة بالسعر)';
        grandTotal = itemsSum;
        subtotal = Math.round((grandTotal / 1.15) * 100) / 100;
        vat = Math.round((grandTotal - subtotal) * 100) / 100;
    } else {
        if (badge) badge.innerText = 'بدون ضريبة (0%)';
        subtotal = itemsSum;
        vat = 0.0;
        grandTotal = itemsSum;
    }

    const subDisplay = document.getElementById('quo-subtotal-display');
    if (subDisplay) subDisplay.innerText = `${formatCurrency(subtotal)} ر.س`;

    const vatDisplay = document.getElementById('quo-vat-display');
    if (vatDisplay) vatDisplay.innerText = `${formatCurrency(vat)} ر.س`;

    const totalEl = document.getElementById('quo-total-display');
    if (totalEl) totalEl.innerText = `${formatCurrency(grandTotal)} ر.س`;
}

async function submitQuotationForm(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('.quo-item-row');
    const items = [];
    rows.forEach(r => {
        const name = r.querySelector('.quo-item-name')?.value.trim();
        const unit = r.querySelector('.quo-item-unit')?.value;
        const price = parseFloat(r.querySelector('.quo-item-price')?.value) || 0;
        const qty = parseFloat(r.querySelector('.quo-item-qty')?.value) || 1;
        if (name && price > 0) {
            items.push({
                item_name: name,
                unit: unit,
                unit_price: price,
                quantity: qty
            });
        }
    });

    if (items.length === 0) {
        showToast('يرجى إدخال بند توريد واحد على الأقل مع تحديد السعر المتفق عليه', 'warning');
        return;
    }

    const taxChoice = document.querySelector('input[name="quo_tax_type"]:checked')?.value || 'exclusive';
    const editId = document.getElementById('quo-edit-id')?.value;

    const payload = {
        supplier_id: document.getElementById('quo-supplier-id').value,
        project_id: document.getElementById('quo-project-id').value || null,
        title: document.getElementById('quo-title').value.trim(),
        quotation_number: document.getElementById('quo-number').value.trim(),
        quotation_date: document.getElementById('quo-date').value,
        notes: document.getElementById('quo-notes').value.trim(),
        tax_type: taxChoice,
        tax_rate: taxChoice === 'zero' ? 0.0 : 0.15,
        items: items
    };

    try {
        const url = editId ? `/api/supplier-quotations/${editId}` : '/api/supplier-quotations';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(editId ? 'تم تحديث عرض السعر والبنود بنجاح!' : 'تم تسجيل عرض السعر وبنود التوريد بنجاح!');
            closeModal('supplier-quotation-modal');
            resetQuotationModal();
            await loadSuppliersData();
            if (typeof currentSelectedSupplierDetailId !== 'undefined' && currentSelectedSupplierDetailId) {
                openSupplierDetailModal(currentSelectedSupplierDetailId);
            }
        } else {
            showToast(data.error || 'حدث خطأ أثناء حفظ عرض السعر', 'error');
        }
    } catch (err) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

async function deleteSupplierQuotation(quotationId) {
    if (!confirm('هل أنت متأكد من حذف هذا العرض وبنوده؟')) return;
    try {
        const res = await fetch(`/api/supplier-quotations/${quotationId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('تم حذف عرض السعر بنجاح');
            await loadSuppliersData();
            if (typeof currentSelectedSupplierDetailId !== 'undefined' && currentSelectedSupplierDetailId) {
                openSupplierDetailModal(currentSelectedSupplierDetailId);
            }
        } else {
            showToast(data.error || 'فشل حذف عرض السعر', 'error');
        }
    } catch (err) {
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

// 10. Expense Modal Integration with Suppliers & Live Price Variance
async function loadSuppliersDropdownForExpenseModal(preferredSupplierId = null) {
    const select = document.getElementById('expense-supplier-id');
    if (!select) return;

    if (cachedSuppliers.length === 0) {
        try {
            const res = await fetch('/api/suppliers');
            cachedSuppliers = await res.json();
        } catch (err) {}
    }

    const currentVal = preferredSupplierId || select.value;
    select.innerHTML = '<option value="">-- بدون مورد (مصروف عام) --</option>';
    cachedSuppliers.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.category})`;
        if (currentVal && String(s.id) === String(currentVal)) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
    if (currentVal) {
        select.value = currentVal;
    }
}

let cachedCurrentQuotationItems = [];

function resetExpenseSupplierFields() {
    const sId = document.getElementById('expense-supplier-id');
    if (sId) sId.value = '';
    const qId = document.getElementById('expense-quotation-id');
    if (qId) {
        qId.innerHTML = '<option value="">-- اختر المورد أولاً --</option>';
        qId.disabled = true;
    }
    const qItem = document.getElementById('expense-quotation-item-id');
    if (qItem) qItem.innerHTML = '<option value="">-- اختر بند التوريد من الاتفاقية --</option>';

    const infoBox = document.getElementById('expense-quotation-balance-info');
    if (infoBox) infoBox.classList.add('hidden');

    const pricingRow = document.getElementById('expense-supplier-pricing-row');
    if (pricingRow) pricingRow.classList.add('hidden');

    const itemCard = document.getElementById('expense-quotation-item-details-card');
    if (itemCard) itemCard.classList.add('hidden');

    const alertBox = document.getElementById('expense-price-alert-box');
    if (alertBox) {
        alertBox.classList.add('hidden');
        alertBox.innerHTML = '';
    }

    const qPrice = document.getElementById('expense-quoted-unit-price');
    if (qPrice) qPrice.value = '';
    const uPrice = document.getElementById('expense-unit-price');
    if (uPrice) uPrice.value = '';
    const qty = document.getElementById('expense-item-quantity');
    if (qty) qty.value = '1';
    cachedCurrentQuotationItems = [];
}

async function onExpenseSupplierChanged(supplierId) {
    const qSelect = document.getElementById('expense-quotation-id');
    const infoBox = document.getElementById('expense-quotation-balance-info');
    const pricingRow = document.getElementById('expense-supplier-pricing-row');
    const alertBox = document.getElementById('expense-price-alert-box');
    const itemCard = document.getElementById('expense-quotation-item-details-card');

    if (!supplierId) {
        if (qSelect) {
            qSelect.innerHTML = '<option value="">-- اختر المورد أولاً --</option>';
            qSelect.disabled = true;
        }
        if (infoBox) infoBox.classList.add('hidden');
        if (pricingRow) pricingRow.classList.add('hidden');
        if (itemCard) itemCard.classList.add('hidden');
        if (alertBox) alertBox.classList.add('hidden');
        cachedCurrentQuotationItems = [];
        return;
    }

    const sup = cachedSuppliers.find(x => String(x.id) === String(supplierId));
    if (sup) {
        const paidToInput = document.getElementById('expense-paid-to');
        if (paidToInput && (!paidToInput.value || cachedSuppliers.some(cs => cs.name === paidToInput.value))) {
            paidToInput.value = sup.name;
        }
    }

    try {
        const currentProj = document.getElementById('expense-project-id')?.value;
        const res = await fetch(`/api/supplier-quotations?supplier_id=${supplierId}`);
        const quotes = await res.json();

        qSelect.innerHTML = '<option value="">-- اختر عرض السعر / الاتفاقية --</option>';
        quotes.forEach(q => {
            const opt = document.createElement('option');
            opt.value = q.id;
            const projLabel = q.project_name ? ` (مشروع ${q.project_name})` : ' (عام)';
            opt.textContent = `${q.title} - ${formatCurrency(q.total_amount)} ر.س${projLabel}`;
            if (currentProj && String(q.project_id) === String(currentProj)) {
                opt.selected = true;
            }
            qSelect.appendChild(opt);
        });

        qSelect.disabled = false;

        if (quotes.length > 0) {
            const selectedQId = qSelect.value || quotes[0].id;
            qSelect.value = selectedQId;
            onExpenseQuotationChanged(selectedQId);
        } else {
            if (infoBox) infoBox.classList.add('hidden');
            if (pricingRow) pricingRow.classList.add('hidden');
            if (itemCard) itemCard.classList.add('hidden');
            if (alertBox) alertBox.classList.add('hidden');
            cachedCurrentQuotationItems = [];
        }
    } catch (err) {
        console.error('Error loading quotations for expense modal:', err);
    }
}

async function onExpenseQuotationChanged(quotationId) {
    const infoBox = document.getElementById('expense-quotation-balance-info');
    const pricingRow = document.getElementById('expense-supplier-pricing-row');
    const qItemSelect = document.getElementById('expense-quotation-item-id');
    const itemCard = document.getElementById('expense-quotation-item-details-card');
    const addAllBtn = document.getElementById('btn-add-all-quotation-items');

    if (!quotationId) {
        if (infoBox) infoBox.classList.add('hidden');
        if (pricingRow) pricingRow.classList.add('hidden');
        if (itemCard) itemCard.classList.add('hidden');
        if (addAllBtn) addAllBtn.classList.add('hidden');
        cachedCurrentQuotationItems = [];
        if (typeof renderExpenseItemsTable === 'function') renderExpenseItemsTable();
        return;
    }

    try {
        const res = await fetch(`/api/supplier-quotations/${quotationId}/items`);
        const items = await res.json();
        cachedCurrentQuotationItems = items;

        const currentQ = cachedQuotations.find(x => String(x.id) === String(quotationId));
        if (currentQ) {
            const sSelect = document.getElementById('expense-supplier-id');
            if (sSelect && !sSelect.value && currentQ.supplier_id) {
                sSelect.value = currentQ.supplier_id;
            }
            if (currentQ.supplier_name) {
                const paidToInput = document.getElementById('expense-paid-to');
                if (paidToInput && !paidToInput.value) {
                    paidToInput.value = currentQ.supplier_name;
                }
            }
            if (infoBox) {
                document.getElementById('eq-total').innerText = formatCurrency(currentQ.total_amount);
                document.getElementById('eq-paid').innerText = formatCurrency(currentQ.total_paid || 0);
                document.getElementById('eq-remaining').innerText = formatCurrency(currentQ.remaining_balance || 0);
                infoBox.classList.remove('hidden');
            }
        }

        if (qItemSelect) {
            qItemSelect.innerHTML = '<option value="">-- اختر بند التوريد المتفق عليه --</option>';
            items.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.id;
                opt.textContent = `${it.item_name} - [سعر الوحدة: ${formatCurrency(it.unit_price)} ر.س / ${it.unit}]`;
                opt.dataset.unitPrice = it.unit_price;
                opt.dataset.unit = it.unit;
                opt.dataset.itemName = it.item_name;
                opt.dataset.totalQty = it.quantity || 0;
                opt.dataset.totalPrice = it.total_price || 0;
                opt.dataset.invoicedQty = it.invoiced_quantity || 0;
                opt.dataset.remainingQty = it.remaining_quantity != null ? it.remaining_quantity : it.quantity;
                opt.dataset.notes = it.notes || '';
                qItemSelect.appendChild(opt);
            });
        }

        if (pricingRow) pricingRow.classList.remove('hidden');

        if (addAllBtn) {
            if (items && items.length > 0) {
                addAllBtn.classList.remove('hidden');
            } else {
                addAllBtn.classList.add('hidden');
            }
        }

        if (items.length > 0) {
            if (qItemSelect) qItemSelect.selectedIndex = 1;
            onExpenseQuotationItemChanged(items[0].id);
        } else {
            if (itemCard) itemCard.classList.add('hidden');
        }

        if (typeof renderExpenseItemsTable === 'function') {
            renderExpenseItemsTable();
        }
    } catch (err) {
        console.error('Error fetching quotation items:', err);
    }
}

function onExpenseQuotationItemChanged(itemId) {
    const qItemSelect = document.getElementById('expense-quotation-item-id');
    const selectedOpt = qItemSelect ? qItemSelect.selectedOptions[0] : null;
    const itemCard = document.getElementById('expense-quotation-item-details-card');

    if (!selectedOpt || !selectedOpt.value) {
        if (itemCard) itemCard.classList.add('hidden');
        return;
    }

    const it = cachedCurrentQuotationItems.find(x => String(x.id) === String(itemId)) || {
        item_name: selectedOpt.dataset.itemName || '',
        unit: selectedOpt.dataset.unit || 'طن',
        unit_price: parseFloat(selectedOpt.dataset.unitPrice) || 0,
        quantity: parseFloat(selectedOpt.dataset.totalQty) || 0,
        total_price: parseFloat(selectedOpt.dataset.totalPrice) || 0,
        invoiced_quantity: parseFloat(selectedOpt.dataset.invoicedQty) || 0,
        remaining_quantity: parseFloat(selectedOpt.dataset.remainingQty) || 0,
        notes: selectedOpt.dataset.notes || ''
    };

    // 1. Fill the Quotation Item Details Card
    if (itemCard) {
        itemCard.classList.remove('hidden');
        const nameEl = document.getElementById('eqi-card-name');
        if (nameEl) nameEl.innerText = it.item_name;

        const unitBadge = document.getElementById('eqi-card-unit-badge');
        if (unitBadge) unitBadge.innerText = `الوحدة: ${it.unit}`;

        const priceEl = document.getElementById('eqi-card-unit-price');
        if (priceEl) priceEl.innerText = `${formatCurrency(it.unit_price)} ر.س / ${it.unit}`;

        const totalQtyEl = document.getElementById('eqi-card-total-qty');
        if (totalQtyEl) totalQtyEl.innerText = `${it.quantity} ${it.unit} (${formatCurrency(it.total_price || (it.quantity * it.unit_price))} ر.س)`;

        const invQtyEl = document.getElementById('eqi-card-invoiced-qty');
        if (invQtyEl) invQtyEl.innerText = `${it.invoiced_quantity || 0} ${it.unit}`;

        const remQtyEl = document.getElementById('eqi-card-remaining-qty');
        if (remQtyEl) remQtyEl.innerText = `${it.remaining_quantity != null ? it.remaining_quantity : it.quantity} ${it.unit}`;

        const notesRow = document.getElementById('eqi-card-notes-row');
        const notesText = document.getElementById('eqi-card-notes');
        if (it.notes && it.notes.trim()) {
            if (notesRow) notesRow.classList.remove('hidden');
            if (notesText) notesText.innerText = it.notes;
        } else {
            if (notesRow) notesRow.classList.add('hidden');
        }
    }

    // 2. Pre-fill Quoted Unit Price and Unit Label
    const quotedEl = document.getElementById('expense-quoted-unit-price');
    if (quotedEl) quotedEl.value = (it.unit_price || 0).toFixed(2);

    const unitLabel = document.getElementById('expense-item-unit-label');
    if (unitLabel) unitLabel.innerText = it.unit;

    // Set actual unit price to quoted unit price by default if empty
    const actualEl = document.getElementById('expense-unit-price');
    if (actualEl && (!actualEl.value || actualEl.value === '0' || actualEl.value === '')) {
        actualEl.value = (it.unit_price || 0).toFixed(2);
    }

    const titleInput = document.getElementById('expense-title');
    if (titleInput && (!titleInput.value || titleInput.value.startsWith('توريد '))) {
        titleInput.value = `توريد ${it.item_name}`;
    }

    const qtyInput = document.getElementById('expense-item-quantity');
    if (qtyInput && (!qtyInput.value || parseFloat(qtyInput.value) <= 0)) {
        qtyInput.value = '1';
    }

    checkExpensePriceVariance();
    initLucide();
}

function checkExpensePriceVariance() {
    const qty = parseFloat(document.getElementById('expense-item-quantity')?.value) || 1;
    const unitPrice = parseFloat(document.getElementById('expense-unit-price')?.value) || 0;
    const quotedPrice = parseFloat(document.getElementById('expense-quoted-unit-price')?.value) || 0;
    const unitLabel = document.getElementById('expense-item-unit-label')?.innerText || 'وحدة';

    const alertBox = document.getElementById('expense-price-alert-box');
    if (!alertBox) return;

    if (quotedPrice <= 0 || unitPrice <= 0) {
        alertBox.classList.add('hidden');
        return;
    }

    const lineTotal = Math.round(qty * unitPrice * 100) / 100;
    const diff = Math.round((unitPrice - quotedPrice) * 100) / 100;
    const totalDiff = Math.round(diff * qty * 100) / 100;

    const isTax = document.getElementById('tax-choice-yes')?.checked;
    if (isTax) {
        const noTaxInput = document.getElementById('expense-amount-without-tax');
        if (noTaxInput) {
            noTaxInput.value = lineTotal.toFixed(2);
            calcExpenseVat('no_tax');
        }
    } else {
        const totalInput = document.getElementById('expense-amount');
        if (totalInput) totalInput.value = lineTotal.toFixed(2);
        const nonTaxInput = document.getElementById('expense-amount-nontax');
        if (nonTaxInput) nonTaxInput.value = lineTotal.toFixed(2);
    }

    // Check if quantity exceeds remaining in agreement
    const selectedOpt = document.getElementById('expense-quotation-item-id')?.selectedOptions[0];
    const remainingQty = selectedOpt && selectedOpt.dataset.remainingQty ? parseFloat(selectedOpt.dataset.remainingQty) : null;
    alertBox.classList.remove('hidden');

    if (diff > 0.01) {
        alertBox.className = 'p-3 rounded-xl border bg-rose-500/15 border-rose-500/50 text-rose-300 font-bold space-y-1 animate-pulse';
        alertBox.innerHTML = `
            <div class="flex items-center gap-1.5 text-rose-400 text-sm">
                <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
                <span>⚠️ تنبيه فوري: سعر الفاتورة أعلى من عرض السعر المتفق عليه!</span>
            </div>
            <div class="text-xs text-rose-200/90 leading-relaxed">
                سعر الوحدة زاد بمقدار <strong class="text-rose-400 underline font-mono">+${diff.toFixed(2)} ر.س</strong> عن السعر المتفق عليه (${quotedPrice.toFixed(2)} ر.س / ${unitLabel}).<br>
                إجمالي الزيادة المحسوبة بالفاتورة: <strong class="text-rose-400 font-mono text-sm">+${totalDiff.toFixed(2)} ر.س</strong> (سيتم إخطار الإدارة وتسجيل الزيادة في التقرير آلياً).
            </div>
        `;
    } else if (diff < -0.01) {
        alertBox.className = 'p-3 rounded-xl border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold space-y-1';
        alertBox.innerHTML = `
            <div class="flex items-center gap-1.5 text-emerald-400 text-xs">
                <i data-lucide="sparkles" class="w-4 h-4 shrink-0"></i>
                <span>🎉 وفر وسعر مخفض عن الاتفاقية!</span>
            </div>
            <div class="text-[11px] text-emerald-200/90">
                السعر أقل من المتفق عليه بمقدار <strong class="font-mono">${Math.abs(diff).toFixed(2)} ر.س</strong> للوحدة! إجمالي الوفر: <strong class="font-mono">${Math.abs(totalDiff).toFixed(2)} ر.س</strong>.
            </div>
        `;
    } else {
        alertBox.className = 'p-2.5 rounded-xl border bg-blue-500/15 border-blue-500/40 text-blue-300 font-medium text-xs flex flex-col gap-1';
        alertBox.innerHTML = `
            <div class="flex items-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4 text-blue-400 shrink-0"></i>
                <span>✓ مطابق تماماً لعرض السعر المتفق عليه (${quotedPrice.toFixed(2)} ر.س / ${unitLabel})</span>
            </div>
        `;
    }

    initLucide();
}

async function openExpenseModalForSupplier(supplierId = null, quotationId = null) {
    if (typeof resetExpenseModal === 'function') resetExpenseModal();
    setExpenseFormMode('supplier');
    const taxYes = document.getElementById('tax-choice-yes');
    if (taxYes) {
        taxYes.checked = true;
        onExpenseTaxTypeChanged();
    }
    openModal('expense-modal');
    if (typeof loadSuppliersDropdownForExpenseModal === 'function') {
        await loadSuppliersDropdownForExpenseModal(supplierId);
    }
    if (supplierId) {
        const sSelect = document.getElementById('expense-supplier-id');
        if (sSelect) {
            sSelect.value = supplierId;
            await onExpenseSupplierChanged(supplierId);
            if (quotationId) {
                const qSelect = document.getElementById('expense-quotation-id');
                if (qSelect) {
                    qSelect.value = quotationId;
                    await onExpenseQuotationChanged(quotationId);
                }
            }
        }
    }
}

// ==============================================================================
// MULTI-LINE ITEMS INVOICE MANAGEMENT (إدارة بنود الفاتورة المتعددة وتتبع الأسعار)
// ==============================================================================
let currentExpenseItems = [];

function resetExpenseItemsState() {
    currentExpenseItems = [];
    addExpenseItemRow();
    const addAllBtn = document.getElementById('btn-add-all-quotation-items');
    if (addAllBtn) addAllBtn.classList.add('hidden');
}

function addExpenseItemRow(itemData = {}) {
    const rowId = 'exp_row_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newItem = {
        id: rowId,
        quotation_item_id: itemData.quotation_item_id || null,
        item_name: itemData.item_name || '',
        unit: itemData.unit || 'طن',
        quantity: itemData.quantity != null ? itemData.quantity : 1,
        unit_price: itemData.unit_price != null ? itemData.unit_price : 0,
        quoted_unit_price: itemData.quoted_unit_price != null ? itemData.quoted_unit_price : 0,
        notes: itemData.notes || ''
    };
    currentExpenseItems.push(newItem);
    renderExpenseItemsTable();
    recalculateExpenseItemsTotals();
}

function removeExpenseItemRow(rowId) {
    if (currentExpenseItems.length <= 1) {
        currentExpenseItems[0] = {
            id: currentExpenseItems[0].id,
            quotation_item_id: null,
            item_name: '',
            unit: 'طن',
            quantity: 1,
            unit_price: 0,
            quoted_unit_price: 0,
            notes: ''
        };
    } else {
        currentExpenseItems = currentExpenseItems.filter(r => r.id !== rowId);
    }
    renderExpenseItemsTable();
    recalculateExpenseItemsTotals();
}

function onExpenseItemQuotationPicked(rowId, qId) {
    const itm = currentExpenseItems.find(r => r.id === rowId);
    if (!itm) return;

    if (!qId) {
        itm.quotation_item_id = null;
        itm.quoted_unit_price = 0;
    } else {
        const qItm = (cachedCurrentQuotationItems || []).find(x => String(x.id) === String(qId));
        if (qItm) {
            itm.quotation_item_id = qItm.id;
            itm.item_name = qItm.item_name;
            itm.unit = qItm.unit || 'طن';
            itm.quoted_unit_price = qItm.unit_price || 0;
            if (!itm.unit_price || itm.unit_price === 0) {
                itm.unit_price = qItm.unit_price || 0;
            }
            if (!itm.quantity || itm.quantity === 0) {
                itm.quantity = (qItm.remaining_quantity != null && qItm.remaining_quantity > 0) ? qItm.remaining_quantity : (qItm.quantity || 1);
            }
        }
    }

    const titleInput = document.getElementById('expense-title');
    if (titleInput && (!titleInput.value || titleInput.value.startsWith('توريد '))) {
        if (itm.item_name) titleInput.value = `توريد ${itm.item_name}`;
    }

    renderExpenseItemsTable();
    recalculateExpenseItemsTotals();
}

function addAllQuotationItemsToInvoice() {
    if (!cachedCurrentQuotationItems || cachedCurrentQuotationItems.length === 0) {
        showToast('لا توجد بنود في عرض السعر المحدد لإدراجها', 'info');
        return;
    }

    currentExpenseItems = cachedCurrentQuotationItems.map((qIt, idx) => ({
        id: 'exp_row_' + Date.now() + '_' + idx,
        quotation_item_id: qIt.id,
        item_name: qIt.item_name,
        unit: qIt.unit || 'طن',
        quantity: (qIt.remaining_quantity != null && qIt.remaining_quantity > 0) ? qIt.remaining_quantity : (qIt.quantity || 1),
        unit_price: qIt.unit_price || 0,
        quoted_unit_price: qIt.unit_price || 0,
        notes: qIt.notes || ''
    }));

    const titleInput = document.getElementById('expense-title');
    if (titleInput && (!titleInput.value || titleInput.value.startsWith('توريد ') || titleInput.value.startsWith('فاتورة توريد: '))) {
        if (currentExpenseItems.length === 1) {
            titleInput.value = `توريد ${currentExpenseItems[0].item_name}`;
        } else if (currentExpenseItems.length > 1) {
            titleInput.value = `فاتورة توريد: ${currentExpenseItems[0].item_name} (+${currentExpenseItems.length - 1} بنود)`;
        }
    }

    renderExpenseItemsTable();
    recalculateExpenseItemsTotals();
    showToast(`تم إدراج ${cachedCurrentQuotationItems.length} بنود من عرض السعر تلقائياً`, 'success');
}

function onExpenseItemFieldChanged(rowId, field, val) {
    const itm = currentExpenseItems.find(r => r.id === rowId);
    if (!itm) return;

    if (field === 'quantity') {
        itm.quantity = parseFloat(val) || 0;
    } else if (field === 'unit_price') {
        itm.unit_price = parseFloat(val) || 0;
    } else if (field === 'unit') {
        itm.unit = val;
    } else if (field === 'item_name') {
        itm.item_name = val;
        const titleInput = document.getElementById('expense-title');
        if (titleInput && (!titleInput.value || titleInput.value.startsWith('توريد '))) {
            if (val && itm === currentExpenseItems[0]) titleInput.value = `توريد ${val}`;
        }
    }

    // Direct DOM update for line total without rerendering the table (keeps focus intact)
    const tr = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (tr) {
        const lineTotalEl = tr.querySelector('.expense-item-row-total');
        if (lineTotalEl) {
            const lTot = (itm.quantity || 0) * (itm.unit_price || 0);
            lineTotalEl.innerText = formatCurrency(lTot);
        }
        const upInput = tr.querySelector('.expense-item-unit-price-input');
        const badgeEl = tr.querySelector('.expense-item-price-badge');
        if (upInput && badgeEl) {
            if (itm.quoted_unit_price > 0) {
                const diff = Math.round((itm.unit_price - itm.quoted_unit_price) * 100) / 100;
                if (diff > 0.01) {
                    upInput.className = 'w-full font-mono text-center text-xs bg-slate-800 border-2 border-rose-500 text-rose-400 font-black focus:border-rose-400 rounded px-1.5 py-1 expense-item-unit-price-input';
                    badgeEl.className = 'text-[9px] text-rose-400 mt-0.5 truncate text-center expense-item-price-badge font-bold bg-rose-500/10 rounded py-0.5';
                    badgeEl.innerText = `▲ زيادة +${formatCurrency(diff)} (العرض: ${formatCurrency(itm.quoted_unit_price)})`;
                } else if (diff < -0.01) {
                    upInput.className = 'w-full font-mono text-center text-xs bg-slate-800 border border-emerald-500 text-emerald-400 font-bold focus:border-emerald-400 rounded px-1.5 py-1 expense-item-unit-price-input';
                    badgeEl.className = 'text-[9px] text-emerald-400 mt-0.5 truncate text-center expense-item-price-badge font-bold bg-emerald-500/10 rounded py-0.5';
                    badgeEl.innerText = `▼ توفير -${formatCurrency(Math.abs(diff))} (العرض: ${formatCurrency(itm.quoted_unit_price)})`;
                } else {
                    upInput.className = 'w-full font-mono text-center text-xs bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 rounded px-1.5 py-1 expense-item-unit-price-input';
                    badgeEl.className = 'text-[9px] text-emerald-400/80 mt-0.5 truncate text-center expense-item-price-badge font-semibold';
                    badgeEl.innerText = `✓ مطابق للعرض (${formatCurrency(itm.quoted_unit_price)})`;
                }
            } else {
                upInput.className = 'w-full font-mono text-center text-xs bg-slate-800 border border-slate-700 text-white focus:border-emerald-500 rounded px-1.5 py-1 expense-item-unit-price-input';
                badgeEl.className = 'text-[9px] text-slate-500 mt-0.5 truncate text-center expense-item-price-badge';
                badgeEl.innerText = 'بند إضافي (حر)';
            }
        }
    }

    recalculateExpenseItemsTotals();
}

function recalculateExpenseItemsTotals() {
    let subtotal = 0;
    let totalIncrease = 0;
    let increasedCount = 0;

    (currentExpenseItems || []).forEach(r => {
        const qty = parseFloat(r.quantity) || 0;
        const up = parseFloat(r.unit_price) || 0;
        const qp = parseFloat(r.quoted_unit_price) || 0;
        const lTot = Math.round(qty * up * 100) / 100;
        subtotal += lTot;

        if (qp > 0 && up > qp + 0.01) {
            const diff = up - qp;
            totalIncrease += Math.round(diff * qty * 100) / 100;
            increasedCount++;
        }
    });

    subtotal = Math.round(subtotal * 100) / 100;

    // 1. Update Subtotal display in table footer
    const subDisplay = document.getElementById('expense-items-subtotal-display');
    if (subDisplay) subDisplay.innerText = `${formatCurrency(subtotal)} ر.س`;

    // 2. Update Multi-items variance alert banner
    const varAlert = document.getElementById('expense-multi-items-variance-alert');
    const varText = document.getElementById('expense-multi-items-variance-text');
    if (varAlert && varText) {
        if (increasedCount > 0 && totalIncrease > 0.01) {
            varAlert.classList.remove('hidden');
            varText.innerHTML = `⚠️ تنبيه فوري: تم رصد زيادة بسعر <strong>${increasedCount}</strong> أصناف بالفاتورة عن أسعار عرض السعر المتفق عليه! إجمالي الزيادة: <strong class="underline font-mono text-white text-sm">+${formatCurrency(totalIncrease)} ر.س</strong>`;
        } else {
            varAlert.classList.add('hidden');
        }
    }

    // 3. Sync with Tax / Non-Tax inputs
    const isTax = document.getElementById('tax-choice-yes')?.checked;
    if (isTax) {
        const noTaxInput = document.getElementById('expense-amount-without-tax');
        if (noTaxInput) {
            noTaxInput.value = subtotal > 0 ? subtotal.toFixed(2) : '';
            calcExpenseVat('no_tax');
        }
    } else {
        const totalInput = document.getElementById('expense-amount');
        if (totalInput) totalInput.value = subtotal > 0 ? subtotal.toFixed(2) : '';
        const nonTaxInput = document.getElementById('expense-amount-nontax');
        if (nonTaxInput) nonTaxInput.value = subtotal > 0 ? subtotal.toFixed(2) : '';
        const noTaxInput = document.getElementById('expense-amount-without-tax');
        if (noTaxInput) noTaxInput.value = subtotal > 0 ? subtotal.toFixed(2) : '';
        const taxInput = document.getElementById('expense-tax-amount');
        if (taxInput) taxInput.value = '0.00';
    }

    // 4. Update legacy single-item fields for backwards compatibility
    if (currentExpenseItems.length > 0) {
        const first = currentExpenseItems[0];
        const qEl = document.getElementById('expense-item-quantity');
        if (qEl) qEl.value = first.quantity || 1;
        const uEl = document.getElementById('expense-unit-price');
        if (uEl) uEl.value = first.unit_price || 0;
        const quEl = document.getElementById('expense-quoted-unit-price');
        if (quEl) quEl.value = first.quoted_unit_price || 0;
        const qiEl = document.getElementById('expense-quotation-item-id');
        if (qiEl && first.quotation_item_id) qiEl.value = first.quotation_item_id;
    }
}

function renderExpenseItemsTable() {
    const tbody = document.getElementById('expense-items-table-body');
    if (!tbody) return;

    if (!currentExpenseItems || currentExpenseItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-4 text-center text-slate-500 text-xs">
                    لا توجد بنود حالياً. انقر على "+ إضافة بند آخر" للبدء.
                </td>
            </tr>
        `;
        return;
    }

    const hasQuotationItems = cachedCurrentQuotationItems && cachedCurrentQuotationItems.length > 0;

    let html = '';
    currentExpenseItems.forEach((r) => {
        const isIncreased = r.quoted_unit_price > 0 && r.unit_price > r.quoted_unit_price + 0.01;
        const lineTotal = (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0);

        html += `
            <tr data-row-id="${r.id}" class="hover:bg-slate-800/60 transition group border-b border-slate-800/80">
                <td class="p-2 align-top">
                    ${hasQuotationItems ? `
                        <select onchange="onExpenseItemQuotationPicked('${r.id}', this.value)" class="w-full mb-1 text-[11px] bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded px-1.5 py-1 text-slate-200">
                            <option value="">-- بند إضافي حر (غير مدرج بعرض السعر) --</option>
                            ${cachedCurrentQuotationItems.map(qi => `
                                <option value="${qi.id}" ${String(r.quotation_item_id) === String(qi.id) ? 'selected' : ''}>
                                    ${qi.item_name} [${formatCurrency(qi.unit_price)} ر.س / ${qi.unit || 'وحدة'}]
                                </option>
                            `).join('')}
                        </select>
                    ` : ''}
                    <input type="text" value="${escapeHtml(r.item_name || '')}" oninput="onExpenseItemFieldChanged('${r.id}', 'item_name', this.value)" placeholder="بيان الصنف أو البند..." class="w-full text-xs bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded px-2 py-1 text-white font-medium">
                </td>
                <td class="p-2 w-20 align-top">
                    <input type="text" value="${escapeHtml(r.unit || 'طن')}" oninput="onExpenseItemFieldChanged('${r.id}', 'unit', this.value)" placeholder="الوحدة" class="w-full text-center text-xs bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded px-1 py-1 text-slate-300">
                </td>
                <td class="p-2 w-24 align-top">
                    <input type="number" step="any" min="0" value="${r.quantity != null ? r.quantity : 1}" oninput="onExpenseItemFieldChanged('${r.id}', 'quantity', this.value)" class="w-full font-mono text-center text-xs bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded px-1.5 py-1 text-emerald-400 font-bold">
                </td>
                <td class="p-2 w-28 align-top">
                    <input type="number" step="any" min="0" value="${r.unit_price != null ? r.unit_price : 0}" oninput="onExpenseItemFieldChanged('${r.id}', 'unit_price', this.value)" class="w-full font-mono text-center text-xs bg-slate-800 border ${r.quoted_unit_price > 0 && r.unit_price > r.quoted_unit_price + 0.01 ? 'border-2 border-rose-500 text-rose-400 font-black' : (r.quoted_unit_price > 0 && r.unit_price < r.quoted_unit_price - 0.01 ? 'border border-emerald-500 text-emerald-400 font-bold' : 'border-slate-700 text-white')} focus:border-emerald-500 rounded px-1.5 py-1 expense-item-unit-price-input">
                    ${r.quoted_unit_price > 0 ? (() => {
                        const diff = Math.round((r.unit_price - r.quoted_unit_price) * 100) / 100;
                        if (diff > 0.01) {
                            return `<div class="text-[9px] text-rose-400 font-bold mt-0.5 truncate text-center expense-item-price-badge bg-rose-500/10 rounded py-0.5">▲ زيادة +${formatCurrency(diff)} (العرض: ${formatCurrency(r.quoted_unit_price)})</div>`;
                        } else if (diff < -0.01) {
                            return `<div class="text-[9px] text-emerald-400 font-bold mt-0.5 truncate text-center expense-item-price-badge bg-emerald-500/10 rounded py-0.5">▼ توفير -${formatCurrency(Math.abs(diff))} (العرض: ${formatCurrency(r.quoted_unit_price)})</div>`;
                        } else {
                            return `<div class="text-[9px] text-emerald-400/80 font-semibold mt-0.5 truncate text-center expense-item-price-badge">✓ مطابق للعرض (${formatCurrency(r.quoted_unit_price)})</div>`;
                        }
                    })() : `
                        <div class="text-[9px] text-slate-500 mt-0.5 truncate text-center expense-item-price-badge">بند إضافي (حر)</div>
                    `}
                </td>
                <td class="p-2 w-28 align-top">
                    <div class="expense-item-row-total font-mono font-bold text-xs text-emerald-400 text-left py-1">
                        ${formatCurrency(lineTotal)}
                    </div>
                </td>
                <td class="p-2 w-12 text-center align-top">
                    <button type="button" onclick="removeExpenseItemRow('${r.id}')" title="حذف هذا البند" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition mt-0.5">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    initLucide();
}

// ==========================================
// CUSTODY & PETTY CASH MANAGEMENT (إدارة العهد النثرية ومصروفات الموظفين)
// ==========================================

let allCustodyRequests = [];
let currentCustodyStatusFilter = '';

function isFinancialManager() {
    return isFinancialManagerUser();
}

function updateCustodyRoleBanner() {
    const bannerBadge = document.getElementById('custody-current-user-badge');
    const desc = document.getElementById('custody-permission-desc');
    if (bannerBadge && currentUser) {
        bannerBadge.textContent = `${currentUser.name} (${currentUser.role || 'عضو فريق'})`;
    }
    if (desc) {
        if (isFinancialManager()) {
            desc.textContent = 'تملك صلاحية الاعتماد وصرف وتصفية العهد (المدير المالي)';
            desc.className = 'text-emerald-400 font-semibold';
        } else {
            desc.textContent = 'يمكنك رفع طلبات عهد جديدة ومتابعة حالة اعتمادها وصرفها';
            desc.className = 'text-amber-400 font-semibold';
        }
    }
}

async function loadCustody() {
    updateCustodyRoleBanner();
    try {
        const res = await fetch('/api/custody');
        const data = await res.json();
        allCustodyRequests = data.requests || [];
        const summary = data.summary || {};

        // Update KPI Cards
        const activeKpi = document.getElementById('custody-kpi-active');
        const activeCount = document.getElementById('custody-kpi-active-count');
        const pendingKpi = document.getElementById('custody-kpi-pending');
        const pendingCount = document.getElementById('custody-kpi-pending-count');
        const approvedKpi = document.getElementById('custody-kpi-approved');
        const approvedCount = document.getElementById('custody-kpi-approved-count');
        const totalDisbursedKpi = document.getElementById('custody-kpi-total-disbursed');
        const settledCount = document.getElementById('custody-kpi-settled-count');

        if (activeKpi) activeKpi.textContent = formatCurrency(summary.total_disbursed_active || 0) + ' ر.س';
        if (activeCount) activeCount.textContent = `${summary.disbursed_count || 0} عهدة قيد التشغيل`;

        if (pendingKpi) pendingKpi.textContent = formatCurrency(summary.pending_amount || 0) + ' ر.س';
        if (pendingCount) pendingCount.textContent = `${summary.pending_count || 0} طلب معلق بانتظار الاعتماد`;

        if (approvedKpi) approvedKpi.textContent = formatCurrency(summary.approved_amount || 0) + ' ر.س';
        if (approvedCount) approvedCount.textContent = `${summary.approved_count || 0} طلب معتمد جاهز للصرف`;

        if (totalDisbursedKpi) totalDisbursedKpi.textContent = formatCurrency(summary.grand_total_disbursed || 0) + ' ر.س';
        if (settledCount) settledCount.textContent = `${summary.settled_count || 0} عهدة تمت تصفيتها وإغلاقها`;

        // Update Navbar Badge
        const pendingBadge = document.getElementById('badge-custody-pending');
        if (pendingBadge) {
            const pCount = summary.pending_count || 0;
            if (pCount > 0) {
                pendingBadge.textContent = pCount;
                pendingBadge.classList.remove('hidden');
            } else {
                pendingBadge.classList.add('hidden');
            }
        }

        // Update Filter counts
        const cntAll = document.getElementById('custody-count-all');
        const cntPend = document.getElementById('custody-count-pending');
        const cntApp = document.getElementById('custody-count-approved');
        const cntDis = document.getElementById('custody-count-disbursed');
        const cntSet = document.getElementById('custody-count-settled');
        const cntRej = document.getElementById('custody-count-rejected');

        if (cntAll) cntAll.textContent = allCustodyRequests.length;
        if (cntPend) cntPend.textContent = allCustodyRequests.filter(r => r.status === 'pending').length;
        if (cntApp) cntApp.textContent = allCustodyRequests.filter(r => r.status === 'approved').length;
        if (cntDis) cntDis.textContent = allCustodyRequests.filter(r => r.status === 'disbursed').length;
        if (cntSet) cntSet.textContent = allCustodyRequests.filter(r => r.status === 'settled').length;
        if (cntRej) cntRej.textContent = allCustodyRequests.filter(r => r.status === 'rejected').length;

        // Populate Project Filter Dropdown
        populateCustodyProjectFilter();

        renderCustodyTable();
    } catch (err) {
        console.error('Error loading custody requests:', err);
        showToast('تعذر تحميل بيانات العهد', 'error');
    }
}

function populateCustodyProjectFilter() {
    const sel = document.getElementById('custody-project-filter');
    if (!sel) return;
    const currentVal = sel.value;
    const projs = allProjectsList || [];
    let opts = '<option value="">جميع المشاريع</option>';
    opts += '<option value="general">مصروف عام / إداري (بدون مشروع)</option>';
    projs.forEach(p => {
        opts += `<option value="${p.id}" ${String(currentVal) === String(p.id) ? 'selected' : ''}>${escapeHtml(p.name)} (${p.code || 'PRJ'})</option>`;
    });
    sel.innerHTML = opts;
}

function setCustodyStatusFilter(status) {
    currentCustodyStatusFilter = status;
    document.querySelectorAll('.custody-filter-btn').forEach(btn => {
        btn.classList.remove('bg-amber-500/20', 'text-amber-400');
        btn.classList.add('text-slate-400');
    });
    const activeBtn = document.getElementById(`custody-filter-${status || 'all'}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-amber-500/20', 'text-amber-400');
        activeBtn.classList.remove('text-slate-400');
    }
    applyCustodyFilters();
}

function applyCustodyFilters() {
    renderCustodyTable();
}

function renderCustodyTable() {
    const tbody = document.getElementById('custody-table-body');
    const emptyState = document.getElementById('custody-empty-state');
    if (!tbody) return;

    const searchVal = (document.getElementById('custody-search-input')?.value || '').trim().toLowerCase();
    const projVal = document.getElementById('custody-project-filter')?.value || '';

    let filtered = allCustodyRequests.filter(item => {
        if (currentCustodyStatusFilter && item.status !== currentCustodyStatusFilter) return false;
        if (projVal === 'general') {
            if (item.project_id) return false;
        } else if (projVal && String(item.project_id) !== String(projVal)) {
            return false;
        }
        if (searchVal) {
            const num = (item.request_number || '').toLowerCase();
            const emp = (item.employee_name || '').toLowerCase();
            const pur = (item.purpose || '').toLowerCase();
            const prj = (item.project_name || '').toLowerCase();
            if (!num.includes(searchVal) && !emp.includes(searchVal) && !pur.includes(searchVal) && !prj.includes(searchVal)) {
                return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const isFinMgr = isFinancialManager();

    let html = '';
    filtered.forEach(item => {
        // Status Badge
        let statusBadge = '';
        if (item.status === 'pending') {
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⏳ بانتظار الاعتماد</span>';
        } else if (item.status === 'approved') {
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">✅ معتمدة (جاهزة للصرف)</span>';
        } else if (item.status === 'disbursed') {
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">💵 تم الصرف (جارية)</span>';
        } else if (item.status === 'settled') {
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">📁 تمت التصفية ✓</span>';
        } else if (item.status === 'rejected') {
            statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">❌ مرفوضة</span>';
        }

        // Project badge
        const projName = item.project_name ? escapeHtml(item.project_name) : '<span class="text-slate-400">مصروف عام / إداري</span>';
        const projCode = item.project_code ? `<span class="text-[10px] text-slate-500 font-mono block">${escapeHtml(item.project_code)}</span>` : '';

        // Disbursed info
        const reqAmountFormatted = formatCurrency(item.amount);
        const disAmountFormatted = item.disbursed_amount > 0 ? formatCurrency(item.disbursed_amount) : '-';

        // Actions buttons depending on status and role
        let actionsHtml = '<div class="flex items-center justify-center gap-1.5 flex-wrap">';

        if (item.status === 'pending') {
            if (isFinMgr) {
                actionsHtml += `
                    <button onclick="approveCustodyRequest(${item.id})" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-sm" title="اعتماد طلب العهدة">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                        <span>اعتماد</span>
                    </button>
                    <button onclick="openCustodyRejectModal(${item.id})" class="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white font-bold text-[11px] flex items-center gap-1 transition" title="رفض الطلب">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        <span>رفض</span>
                    </button>
                `;
            } else {
                actionsHtml += `<span class="text-[11px] text-amber-400/80 font-medium">بانتظار المدير المالي</span>`;
            }
        } else if (item.status === 'approved') {
            if (isFinMgr) {
                actionsHtml += `
                    <button onclick="openCustodyDisburseModal(${item.id})" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-sm" title="تسجيل صرف المبلغ">
                        <i data-lucide="wallet" class="w-3.5 h-3.5"></i>
                        <span>صرف العهدة</span>
                    </button>
                `;
            } else {
                actionsHtml += `<span class="text-[11px] text-blue-400 font-medium">معتمدة - جاهزة للصرف</span>`;
            }
        } else if (item.status === 'disbursed') {
            actionsHtml += `
                <button onclick="viewCustodyExpenses(${item.id})" class="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition shadow-sm" title="عرض الفواتير المسددة من هذه العهدة">
                    <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                    <span>الفواتير (${formatCurrency(item.spent_amount || 0)})</span>
                </button>
                <button onclick="openCustodySettleModal(${item.id})" class="px-2 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition" title="تصفية وتسوية العهدة">
                    <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
                    <span>تصفية</span>
                </button>
                <button onclick="printCustodyVoucher(${item.id})" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="طباعة سند صرف العهدة">
                    <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                </button>
            `;
        } else if (item.status === 'settled') {
            actionsHtml += `
                <button onclick="viewCustodyExpenses(${item.id})" class="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition shadow-sm" title="عرض الفواتير المسددة من هذه العهدة">
                    <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                    <span>الفواتير (${formatCurrency(item.spent_amount || 0)})</span>
                </button>
                <button onclick="printCustodyVoucher(${item.id})" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition" title="طباعة سند التصفية">
                    <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                    <span>سند التصفية</span>
                </button>
            `;
        } else if (item.status === 'rejected') {
            if (item.approval_notes) {
                actionsHtml += `<span class="text-[10px] text-rose-400 font-medium truncate max-w-[120px]" title="${escapeHtml(item.approval_notes)}">السبب: ${escapeHtml(item.approval_notes)}</span>`;
            }
        }

        // Edit button for custody request details (Financial manager or owner if pending)
        if (isFinMgr || (currentUser && currentUser.name === item.employee_name && item.status === 'pending')) {
            actionsHtml += `
                <button onclick="openEditCustodyModal(${item.id})" class="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition" title="تعديل بيانات العهدة">
                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
            `;
        }

        // Delete button for custody (Financial manager can delete any custody, owner can delete pending)
        if (isFinMgr || (currentUser && currentUser.name === item.employee_name && item.status === 'pending')) {
            actionsHtml += `
                <button onclick="deleteCustodyRequest(${item.id})" class="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition" title="حذف العهدة">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            `;
        }

        actionsHtml += '</div>';

        let attachLink = '';
        if (item.receipt_file_path) {
            attachLink = `
                <a href="${item.receipt_file_path}" target="_blank" class="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:underline mr-1" title="عرض المرفق">
                    <i data-lucide="paperclip" class="w-3 h-3"></i>
                    <span>مرفق</span>
                </a>
            `;
        }

        html += `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="p-3.5 text-center">
                    <span class="font-mono font-bold text-amber-400 text-xs block">${escapeHtml(item.request_number || 'CUST')}</span>
                    ${item.receipt_voucher_no ? `<span class="text-[9px] text-slate-500 font-mono block">سند: ${escapeHtml(item.receipt_voucher_no)}</span>` : ''}
                </td>
                <td class="p-3.5">
                    <div class="font-bold text-white text-xs">${escapeHtml(item.employee_name)}</div>
                    ${item.approved_by ? `<div class="text-[9px] text-slate-500">الاعتماد: ${escapeHtml(item.approved_by)}</div>` : ''}
                </td>
                <td class="p-3.5">
                    <div class="font-bold text-xs">${projName}</div>
                    ${projCode}
                </td>
                <td class="p-3.5 max-w-xs">
                    <div class="text-slate-200 text-xs line-clamp-2" title="${escapeHtml(item.purpose)}">${escapeHtml(item.purpose)}</div>
                    ${attachLink}
                </td>
                <td class="p-3.5 text-left font-mono font-bold text-amber-400 text-xs whitespace-nowrap">
                    ${reqAmountFormatted}
                </td>
                <td class="p-3.5 text-left font-mono font-bold text-emerald-400 text-xs whitespace-nowrap">
                    <div>${disAmountFormatted}</div>
                    ${item.disbursed_amount > 0 ? `
                        <div class="text-[10px] ${Math.max(0, item.disbursed_amount - (item.spent_amount || 0)) > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'} font-normal mt-0.5 font-mono">
                            المتبقي: ${formatCurrency(Math.max(0, item.disbursed_amount - (item.spent_amount || 0)))}
                        </div>
                    ` : ''}
                </td>
                <td class="p-3.5 text-center whitespace-nowrap">
                    ${item.payment_method === 'تحويل بنكي' ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            <i data-lucide="landmark" class="w-3 h-3"></i>
                            <span>تحويل بنكي</span>
                        </span>
                    ` : (item.payment_method === 'نقدي' ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <i data-lucide="banknote" class="w-3 h-3"></i>
                            <span>نقدي (خزينة)</span>
                        </span>
                    ` : (item.payment_method ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            <span>${escapeHtml(item.payment_method)}</span>
                        </span>
                    ` : '<span class="text-slate-500 text-[10px]">-</span>'))}
                </td>
                <td class="p-3.5 text-center font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    <div>${escapeHtml(item.request_date || '-')}</div>
                    ${item.disbursed_date ? `<div class="text-[9px] text-emerald-400">صرف: ${item.disbursed_date}</div>` : ''}
                </td>
                <td class="p-3.5 text-center whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="p-3.5 text-center whitespace-nowrap">
                    ${actionsHtml}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    initLucide();
}

function initCustodyRequestModal() {
    const editIdEl = document.getElementById('custody-req-edit-id');
    if (editIdEl) editIdEl.value = '';
    const titleEl = document.getElementById('custody-req-modal-title');
    if (titleEl) titleEl.textContent = 'رفع طلب عهدة نقدية جديدة';
    const subTitleEl = document.getElementById('custody-req-modal-subtitle');
    if (subTitleEl) subTitleEl.textContent = 'يقدم للمدير المالي للاعتماد والصرف';
    const btnTextEl = document.getElementById('custody-req-btn-text');
    if (btnTextEl) btnTextEl.textContent = 'إرسال الطلب للاعتماد';

    const empInput = document.getElementById('custody-req-employee');
    const dateInput = document.getElementById('custody-req-date');
    const projSelect = document.getElementById('custody-req-project');
    const amtInput = document.getElementById('custody-req-amount');
    const purpInput = document.getElementById('custody-req-purpose');
    const notesInput = document.getElementById('custody-req-notes');
    const fileInput = document.getElementById('custody-req-file');

    if (empInput) empInput.value = (currentUser && currentUser.name) ? currentUser.name : '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (amtInput) amtInput.value = '';
    if (purpInput) purpInput.value = '';
    if (notesInput) notesInput.value = '';
    if (fileInput) fileInput.value = '';

    if (projSelect) {
        let opts = '<option value="">مصروف عام / إداري (بدون مشروع)</option>';
        (allProjectsList || []).forEach(p => {
            opts += `<option value="${p.id}">${escapeHtml(p.name)} (${p.code || 'PRJ'})</option>`;
        });
        projSelect.innerHTML = opts;
    }
}

async function openEditCustodyModal(id) {
    let item = allCustodyRequests.find(r => r.id === id);
    if (!item) {
        try {
            const res = await fetch(`/api/custody/${id}`);
            const data = await res.json();
            if (data.custody) item = data.custody;
        } catch (e) {
            console.error('Error fetching custody for edit:', e);
        }
    }
    if (!item) {
        showToast('تعذر العثور على بيانات العهدة', 'error');
        return;
    }

    const editIdEl = document.getElementById('custody-req-edit-id');
    if (editIdEl) editIdEl.value = item.id;
    const titleEl = document.getElementById('custody-req-modal-title');
    if (titleEl) titleEl.textContent = `تعديل بيانات العهدة ${item.request_number || '#' + item.id}`;
    const subTitleEl = document.getElementById('custody-req-modal-subtitle');
    if (subTitleEl) subTitleEl.textContent = 'تعديل تفاصيل العهدة وحفظ التغييرات';
    const btnTextEl = document.getElementById('custody-req-btn-text');
    if (btnTextEl) btnTextEl.textContent = 'تحديث وحفظ التعديلات';

    const empInput = document.getElementById('custody-req-employee');
    const dateInput = document.getElementById('custody-req-date');
    const projSelect = document.getElementById('custody-req-project');
    const amtInput = document.getElementById('custody-req-amount');
    const purpInput = document.getElementById('custody-req-purpose');
    const notesInput = document.getElementById('custody-req-notes');
    const fileInput = document.getElementById('custody-req-file');

    if (empInput) empInput.value = item.employee_name || '';
    if (dateInput) dateInput.value = item.request_date || '';
    if (amtInput) amtInput.value = item.amount || '';
    if (purpInput) purpInput.value = item.purpose || '';
    if (notesInput) notesInput.value = item.notes || '';
    if (fileInput) fileInput.value = '';

    if (projSelect) {
        let opts = '<option value="">مصروف عام / إداري (بدون مشروع)</option>';
        (allProjectsList || []).forEach(p => {
            const isSel = (item.project_id && String(p.id) === String(item.project_id)) ? 'selected' : '';
            opts += `<option value="${p.id}" ${isSel}>${escapeHtml(p.name)} (${p.code || 'PRJ'})</option>`;
        });
        projSelect.innerHTML = opts;
    }

    const methodSelect = document.getElementById('custody-req-method');
    if (methodSelect) methodSelect.value = item.payment_method || 'تحويل بنكي';

    openModal('custody-request-modal');
}

async function submitCustodyRequest(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-custody');
    if (btn) btn.disabled = true;

    try {
        const editId = document.getElementById('custody-req-edit-id')?.value;
        const formData = new FormData();
        formData.append('employee_name', document.getElementById('custody-req-employee')?.value || '');
        formData.append('project_id', document.getElementById('custody-req-project')?.value || '');
        formData.append('amount', document.getElementById('custody-req-amount')?.value || '0');
        formData.append('payment_method', document.getElementById('custody-req-method')?.value || 'تحويل بنكي');
        formData.append('request_date', document.getElementById('custody-req-date')?.value || '');
        formData.append('purpose', document.getElementById('custody-req-purpose')?.value || '');
        formData.append('notes', document.getElementById('custody-req-notes')?.value || '');

        const fileInput = document.getElementById('custody-req-file');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append('attachment', fileInput.files[0]);
        }

        const url = editId ? `/api/custody/${editId}` : '/api/custody';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            body: formData
        });
        const data = await res.json();

        if (res.ok && (data.success || !data.error)) {
            showToast(data.message || (editId ? 'تم تحديث بيانات العهدة بنجاح' : 'تم رفع طلب العهدة بنجاح، بانتظار اعتماد المدير المالي'), 'success');
            closeModal('custody-request-modal');
            const editIdEl = document.getElementById('custody-req-edit-id');
            if (editIdEl) editIdEl.value = '';
            await loadCustody();
        } else {
            showToast(data.error || 'فشل في حفظ طلب العهدة', 'error');
        }
    } catch (err) {
        console.error('Error submitting custody request:', err);
        showToast('حدث خطأ أثناء إرسال طلب العهدة', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function approveCustodyRequest(id) {
    if (!isFinancialManager()) {
        showToast('عفواً، اعتماد طلبات العهد محصور حصرياً على المدير المالي', 'error');
        return;
    }

    if (!confirm('هل أنت متأكد من اعتماد طلب العهدة؟ سيصبح الطلب معتمداً وجاهزاً للصرف.')) {
        return;
    }

    try {
        const approverName = (currentUser && currentUser.name) ? `${currentUser.name} (المدير المالي)` : 'ابوالنصر البغدادي (المدير المالي)';
        const res = await fetch(`/api/custody/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved_by: approverName })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'تم اعتماد طلب العهدة بنجاح', 'success');
            await loadCustody();
        } else {
            showToast(data.error || 'فشل في اعتماد الطلب', 'error');
        }
    } catch (err) {
        console.error('Error approving custody:', err);
        showToast('حدث خطأ أثناء اعتماد طلب العهدة', 'error');
    }
}

function openCustodyRejectModal(id) {
    if (!isFinancialManager()) {
        showToast('عفواً، رفض أو اعتماد طلبات العهد من صلاحيات المدير المالي', 'error');
        return;
    }
    const idInput = document.getElementById('custody-reject-id');
    const reasonInput = document.getElementById('custody-reject-reason');
    if (idInput) idInput.value = id;
    if (reasonInput) reasonInput.value = '';
    openModal('custody-reject-modal');
}

async function submitCustodyRejection(e) {
    e.preventDefault();
    const id = document.getElementById('custody-reject-id')?.value;
    const reason = document.getElementById('custody-reject-reason')?.value || '';

    try {
        const rejecterName = (currentUser && currentUser.name) ? `${currentUser.name} (المدير المالي)` : 'ابوالنصر البغدادي (المدير المالي)';
        const res = await fetch(`/api/custody/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rejected_by: rejecterName,
                rejection_notes: reason
            })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'تم رفض طلب العهدة وتحديث الحالة', 'info');
            closeModal('custody-reject-modal');
            await loadCustody();
        } else {
            showToast(data.error || 'فشل في رفض الطلب', 'error');
        }
    } catch (err) {
        console.error('Error rejecting custody:', err);
        showToast('حدث خطأ أثناء رفض الطلب', 'error');
    }
}

function openCustodyDisburseModal(id) {
    if (!isFinancialManager()) {
        showToast('عفواً، تسجيل صرف العهد من صلاحيات المدير المالي', 'error');
        return;
    }

    const item = allCustodyRequests.find(r => r.id === id);
    if (!item) return;

    document.getElementById('custody-disburse-id').value = id;
    document.getElementById('custody-disburse-num').textContent = item.request_number || 'CUST';
    document.getElementById('custody-disburse-emp').textContent = item.employee_name || '-';
    document.getElementById('custody-disburse-proj').textContent = item.project_name || 'عام / إداري';
    document.getElementById('custody-disburse-req-amount').textContent = formatCurrency(item.amount) + ' ر.س';
    document.getElementById('custody-disburse-purpose').textContent = item.purpose || '-';

    document.getElementById('custody-disburse-amount').value = item.amount;
    document.getElementById('custody-disburse-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('custody-disburse-method').value = item.payment_method || 'تحويل بنكي';
    document.getElementById('custody-disburse-voucher').value = '';
    document.getElementById('custody-disburse-notes').value = '';
    document.getElementById('custody-record-expense').checked = Boolean(item.project_id);

    const fileInput = document.getElementById('custody-disburse-file');
    if (fileInput) fileInput.value = '';

    openModal('custody-disburse-modal');
}

async function submitCustodyDisbursement(e) {
    e.preventDefault();
    const id = document.getElementById('custody-disburse-id')?.value;
    const amount = document.getElementById('custody-disburse-amount')?.value;
    const date = document.getElementById('custody-disburse-date')?.value;
    const method = document.getElementById('custody-disburse-method')?.value;
    const voucher = document.getElementById('custody-disburse-voucher')?.value;
    const notes = document.getElementById('custody-disburse-notes')?.value;
    const recordExpense = document.getElementById('custody-record-expense')?.checked;
    const disburserName = (currentUser && currentUser.name) ? `${currentUser.name} (المدير المالي)` : 'ابوالنصر البغدادي (المدير المالي)';

    try {
        const formData = new FormData();
        formData.append('disbursed_amount', amount);
        formData.append('disbursed_date', date);
        formData.append('payment_method', method);
        formData.append('receipt_voucher_no', voucher);
        formData.append('disbursement_notes', notes);
        formData.append('record_as_expense', recordExpense ? 'true' : 'false');
        formData.append('disbursed_by', disburserName);

        const fileInput = document.getElementById('custody-disburse-file');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append('receipt_file', fileInput.files[0]);
        }

        const res = await fetch(`/api/custody/${id}/disburse`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'تم تسجيل صرف العهدة بنجاح', 'success');
            closeModal('custody-disburse-modal');
            await loadCustody();
            if (recordExpense && typeof loadExpenses === 'function') {
                loadExpenses();
            }
        } else {
            showToast(data.error || 'فشل في تسجيل الصرف', 'error');
        }
    } catch (err) {
        console.error('Error disbursing custody:', err);
        showToast('حدث خطأ أثناء تسجيل صرف العهدة', 'error');
    }
}

function openCustodySettleModal(id) {
    const item = allCustodyRequests.find(r => r.id === id);
    if (!item) return;

    document.getElementById('custody-settle-id').value = id;
    document.getElementById('custody-settle-num').textContent = item.request_number || 'CUST';
    document.getElementById('custody-settle-emp').textContent = item.employee_name || '-';
    const disAmt = item.disbursed_amount || item.amount;
    document.getElementById('custody-settle-disbursed-disp').textContent = formatCurrency(disAmt) + ' ر.س';

    document.getElementById('custody-settle-spent').value = disAmt;
    document.getElementById('custody-settle-returned').value = '0.00';
    document.getElementById('custody-settle-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('custody-settle-notes').value = '';

    openModal('custody-settle-modal');
}

function recalcCustodySettlement() {
    const id = document.getElementById('custody-settle-id')?.value;
    const item = allCustodyRequests.find(r => String(r.id) === String(id));
    if (!item) return;

    const disAmt = parseFloat(item.disbursed_amount || item.amount) || 0;
    const spentAmt = parseFloat(document.getElementById('custody-settle-spent')?.value) || 0;
    const returned = Math.max(0, disAmt - spentAmt);
    const returnedInput = document.getElementById('custody-settle-returned');
    if (returnedInput) returnedInput.value = returned.toFixed(2);
}

async function submitCustodySettlement(e) {
    e.preventDefault();
    const id = document.getElementById('custody-settle-id')?.value;
    const spent = document.getElementById('custody-settle-spent')?.value;
    const returned = document.getElementById('custody-settle-returned')?.value;
    const date = document.getElementById('custody-settle-date')?.value;
    const notes = document.getElementById('custody-settle-notes')?.value;
    const settledByName = (currentUser && currentUser.name) ? `${currentUser.name} (المدير المالي)` : 'ابوالنصر البغدادي (المدير المالي)';

    try {
        const res = await fetch(`/api/custody/${id}/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                spent_amount: spent,
                returned_amount: returned,
                settlement_date: date,
                settlement_notes: notes,
                settled_by: settledByName
            })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'تمت تصفية العهدة وإغلاق حسابها بنجاح', 'success');
            closeModal('custody-settle-modal');
            await loadCustody();
        } else {
            showToast(data.error || 'فشل في تسوية العهدة', 'error');
        }
    } catch (err) {
        console.error('Error settling custody:', err);
        showToast('حدث خطأ أثناء تصفية العهدة', 'error');
    }
}

async function deleteCustodyRequest(id) {
    const item = allCustodyRequests.find(r => r.id === id);
    const itemNum = item ? (item.request_number || `#${id}`) : `#${id}`;
    const spentAmt = item ? (parseFloat(item.spent_amount) || 0) : 0;

    let deleteExpenses = false;
    if (spentAmt > 0) {
        const choice = confirm(`تنبيه مالي:\nالعهدة ${itemNum} مسجل عليها فواتير ومصروفات بمبلغ (${formatCurrency(spentAmt)} ر.س).\n\n• اضغط (موافق OK) لحذف العهدة مع حذف كافة الفواتير المرتبطة بها نهائياً.\n• اضغط (إلغاء Cancel) للإلغاء والتراجع.`);
        if (!choice) return;
        deleteExpenses = true;
    } else {
        if (!confirm(`هل أنت متأكد من رغبتك في حذف طلب العهدة ${itemNum} نهائياً؟`)) return;
    }

    try {
        const url = `/api/custody/${id}${deleteExpenses ? '?delete_expenses=1' : ''}`;
        const res = await fetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && (data.success || !data.error)) {
            showToast(data.message || 'تم حذف طلب العهدة بنجاح', 'info');
            await loadCustody();
            if (typeof loadExpenses === 'function') loadExpenses();
            if (typeof loadDashboard === 'function') loadDashboard();
        } else {
            showToast(data.error || 'فشل في حذف الطلب', 'error');
        }
    } catch (err) {
        console.error('Error deleting custody:', err);
        showToast('حدث خطأ أثناء الحذف', 'error');
    }
}

function printCustodyVoucher(id) {
    const item = allCustodyRequests.find(r => r.id === id);
    if (!item) return;

    const printDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const isDisbursed = item.status === 'disbursed' || item.status === 'settled';
    const docTitle = isDisbursed ? 'سند صرف عهدة نقدية' : 'إشعار طلب واعتماد عهدة نقدية';

    const voucherHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>${docTitle} - ${escapeHtml(item.request_number)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            @page { size: A5 landscape; margin: 10mm; }
            body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; color: #0f172a; padding: 10px; margin: 0; font-size: 11px; }
            .box { border: 2px solid #0f172a; border-radius: 8px; padding: 15px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
            .company { font-size: 16px; font-weight: 900; }
            .sub { font-size: 10px; color: #059669; font-weight: bold; }
            .badge { display: inline-block; background: #0f172a; color: #fff; font-weight: 800; padding: 3px 12px; border-radius: 4px; font-size: 13px; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
            .label { color: #64748b; font-weight: 600; }
            .val { font-weight: 800; color: #0f172a; }
            .amount-box { background: #ecfdf5; border: 1.5px solid #059669; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; text-align: center; }
            .amount-val { font-size: 18px; font-weight: 900; font-family: monospace; color: #059669; }
            .sigs { display: flex; justify-content: space-between; margin-top: 25px; text-align: center; font-weight: 700; }
            .sig-col { width: 30%; }
            .sig-line { margin-top: 35px; border-top: 1px dotted #64748b; padding-top: 4px; font-size: 9px; }
            .no-print { text-align: center; margin-bottom: 10px; }
            .btn { background: #059669; color: #fff; border: none; padding: 6px 16px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer; }
            @media print { .no-print { display: none; } body { padding: 0; } }
        </style>
    </head>
    <body>
        <div class="no-print">
            <button class="btn" onclick="window.print()">🖨️ اضغط لطباعة السند</button>
        </div>
        <div class="box">
            <div class="header">
                <div>
                    <div class="company">شركة مقاولات السجيني العامة</div>
                    <div class="sub">إدارة الرقابة المالية والعهد النثرية</div>
                    <div class="badge">${docTitle}</div>
                </div>
                <div style="text-align: left; font-size: 10px;">
                    <div>رقم السند: <strong style="font-family: monospace;">${escapeHtml(item.request_number)}</strong></div>
                    <div>تاريخ السند: <strong>${escapeHtml(item.disbursed_date || item.request_date)}</strong></div>
                    <div>تاريخ الطباعة: ${printDate}</div>
                </div>
            </div>

            <div class="grid">
                <div class="row"><span class="label">يُصرف إلى الموظف:</span><span class="val">${escapeHtml(item.employee_name)}</span></div>
                <div class="row"><span class="label">المشروع التابع له:</span><span class="val">${escapeHtml(item.project_name || 'مصروف عام / إداري')}</span></div>
                <div class="row"><span class="label">طريقة الصرف:</span><span class="val">${escapeHtml(item.payment_method || 'نقدي')}</span></div>
                <div class="row"><span class="label">رقم المرجع / الإشعار:</span><span class="val font-mono">${escapeHtml(item.receipt_voucher_no || '-')}</span></div>
            </div>

            <div class="amount-box">
                <div style="font-size: 10px; color: #047857; font-weight: bold; margin-bottom: 2px;">المبلغ المصروف المعتمد</div>
                <div class="amount-val">${formatCurrency(item.disbursed_amount || item.amount)} ريال سعودي</div>
            </div>

            <div class="row" style="margin-bottom: 12px; background: #fff;">
                <span class="label">الغرض وبيان الصرف:</span>
                <span class="val" style="font-weight: 600;">${escapeHtml(item.purpose)}</span>
            </div>

            ${item.status === 'settled' ? `
            <div style="background: #faf5ff; border: 1px solid #d8b4fe; border-radius: 4px; padding: 6px 10px; font-size: 10px; margin-bottom: 12px;">
                <strong>بيان التصفية:</strong> تم استهلاك مبلغ (${formatCurrency(item.spent_amount)} ر.س) ورد مبلغ (${formatCurrency(item.returned_amount)} ر.س) بتاريخ ${escapeHtml(item.settlement_date || '-')}
            </div>
            ` : ''}

            <div class="sigs">
                <div class="sig-col">
                    <div>مستلم العهدة (الموظف)</div>
                    <div class="sig-line">التوقيع: ............................</div>
                </div>
                <div class="sig-col">
                    <div>اعتماد الإدارة المالية</div>
                    <div class="sig-line">التوقيع: ............................</div>
                </div>
                <div class="sig-col">
                    <div>المدير العام / الختم</div>
                    <div class="sig-line">الختم الرسمي: ......................</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(voucherHtml);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => { printWin.print(); }, 500);
    }
}

function printCustodyReport() {
    if (!allCustodyRequests || allCustodyRequests.length === 0) {
        showToast('لا توجد بيانات عهد للطباعة', 'warning');
        return;
    }

    const printDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    let rowsHtml = '';
    let totReq = 0, totDis = 0, totSpent = 0, totRet = 0;
    allCustodyRequests.forEach((item, idx) => {
        totReq += parseFloat(item.amount) || 0;
        totDis += parseFloat(item.disbursed_amount) || 0;
        totSpent += parseFloat(item.spent_amount) || 0;
        totRet += parseFloat(item.returned_amount) || 0;

        let st = item.status === 'pending' ? 'بانتظار الاعتماد' : (item.status === 'approved' ? 'معتمدة' : (item.status === 'disbursed' ? 'جارية' : (item.status === 'settled' ? 'مصفاة' : 'مرفوضة')));

        rowsHtml += `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-family: monospace; font-weight: bold;">${escapeHtml(item.request_number)}</td>
                <td><strong>${escapeHtml(item.employee_name)}</strong></td>
                <td>${escapeHtml(item.project_name || 'عام')}</td>
                <td>${escapeHtml(item.purpose)}</td>
                <td style="text-align: left; font-family: monospace;">${formatCurrency(item.amount)}</td>
                <td style="text-align: left; font-family: monospace; font-weight: bold; color: #059669;">${item.disbursed_amount > 0 ? formatCurrency(item.disbursed_amount) : '-'}</td>
                <td style="text-align: center;">${escapeHtml(item.request_date)}</td>
                <td style="text-align: center; font-weight: bold;">${st}</td>
            </tr>
        `;
    });

    const reportHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>كشف حصر العهد النثرية ومصروفات الموظفين</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; color: #0f172a; padding: 10px; margin: 0; font-size: 10px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
            .title { font-size: 16px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; }
            th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; }
            th { background: #1e293b; color: #fff; font-weight: bold; }
            tfoot tr td { background: #f1f5f9; font-weight: 900; font-size: 10px; }
            tr:nth-child(even) { background: #f8fafc; }
            .no-print { text-align: center; margin-bottom: 10px; }
            .btn { background: #059669; color: #fff; border: none; padding: 6px 18px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer; }
            @media print { .no-print { display: none; } }
        </style>
    </head>
    <body>
        <div class="no-print">
            <button class="btn" onclick="window.print()">🖨️ طباعة الكشف</button>
        </div>
        <div class="header">
            <div>
                <div class="title">شركة مقاولات السجيني العامة</div>
                <div style="font-size: 10px; color: #059669; font-weight: bold;">تقرير كشف حصر العهد النثرية ومصروفات الموظفين</div>
            </div>
            <div style="text-align: left; font-size: 10px;">
                <div>تاريخ التقرير: ${printDate}</div>
                <div>إجمالي العهد: ${allCustodyRequests.length} عهدة</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 25px; text-align: center;">م</th>
                    <th style="width: 80px;">رقم الطلب</th>
                    <th>الموظف</th>
                    <th>المشروع</th>
                    <th>الغرض والبيان</th>
                    <th>المبلغ المطلوب</th>
                    <th>المبلغ المنصرف</th>
                    <th style="width: 70px; text-align: center;">تاريخ الطلب</th>
                    <th style="width: 80px; text-align: center;">الحالة</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="5" style="text-align: center;">الإجمالي العام</td>
                    <td style="font-family: monospace; text-align: left;">${formatCurrency(totReq)}</td>
                    <td style="font-family: monospace; text-align: left; color: #059669;">${formatCurrency(totDis)}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>

        <div style="display: flex; justify-content: space-between; margin-top: 30px; text-align: center; font-weight: bold;">
            <div style="width: 30%;">إعداد الإدارة المالية<div style="margin-top: 25px;">............................</div></div>
            <div style="width: 30%;">المراجع الداخلي<div style="margin-top: 25px;">............................</div></div>
            <div style="width: 30%;">اعتماد المدير العام<div style="margin-top: 25px;">............................</div></div>
        </div>
    </body>
    </html>
    `;

    const printWin = window.open('', '_blank', 'width=1000,height=700');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(reportHtml);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => { printWin.print(); }, 500);
    }
}

// ==========================================
// CUSTODY DISBURSEMENT FOR EXPENSES (الصرف من العهدة)
// ==========================================
let activeCustodiesList = [];
let currentViewedCustodyId = null;

async function onExpensePaymentMethodChanged(selectedCustodyId = null) {
    const payMethod = document.getElementById('expense-payment-method')?.value;
    const container = document.getElementById('expense-custody-select-container');
    if (!container) return;

    if (payMethod === 'عهدة') {
        container.classList.remove('hidden');
        await loadActiveCustodiesDropdown(selectedCustodyId);
    } else {
        container.classList.add('hidden');
        const cSelect = document.getElementById('expense-custody-id');
        if (cSelect) cSelect.value = '';
        const badge = document.getElementById('expense-custody-balance-badge');
        if (badge) badge.classList.add('hidden');
        const warn = document.getElementById('expense-custody-warning');
        if (warn) warn.classList.add('hidden');
        const info = document.getElementById('expense-custody-info');
        if (info) info.classList.add('hidden');
    }
}

async function loadActiveCustodiesDropdown(selectedId = null) {
    const select = document.getElementById('expense-custody-id');
    if (!select) return;

    select.innerHTML = '<option value="">-- جارِ تحميل العهد المتاحة... --</option>';

    try {
        const res = await fetch('/api/custody/active');
        const custodies = await res.json();
        activeCustodiesList = Array.isArray(custodies) ? custodies : [];

        if (activeCustodiesList.length === 0) {
            select.innerHTML = '<option value="">⚠️ لا توجد عهد نشطة حالياً (يرجى رفع طلب عهدة واعتماده وصرفه أولاً)</option>';
            return;
        }

        let opts = '<option value="">-- اختر العهدة المتاحة للخصم المباشر --</option>';
        activeCustodiesList.forEach(c => {
            const reqNo = c.request_number || `CUST-#${c.id}`;
            const emp = c.employee_name;
            const prj = c.project_name ? `${c.project_name}` : 'مصروف عام';
            const bal = formatCurrency(c.remaining_balance != null ? c.remaining_balance : ((c.disbursed_amount || c.amount || 0) - (c.spent_amount || 0)));
            const isSel = (selectedId && String(c.id) === String(selectedId)) ? 'selected' : '';
            opts += `<option value="${c.id}" ${isSel} data-balance="${c.remaining_balance || 0}" data-employee="${escapeHtml(emp)}" data-project="${c.project_id || ''}">${reqNo} | ${emp} | (${prj}) — المتبقي: ${bal} ر.س</option>`;
        });
        select.innerHTML = opts;

        if (selectedId) {
            select.value = selectedId;
            onExpenseCustodyChanged();
        } else if (activeCustodiesList.length === 1) {
            select.selectedIndex = 1;
            onExpenseCustodyChanged();
        }
    } catch (err) {
        console.error('Error loading active custodies:', err);
        select.innerHTML = '<option value="">تعذر تحميل قائمة العهد</option>';
    }
}

function onExpenseCustodyChanged() {
    const select = document.getElementById('expense-custody-id');
    const badge = document.getElementById('expense-custody-balance-badge');
    const info = document.getElementById('expense-custody-info');
    const empText = document.getElementById('expense-custody-emp-text');
    const projText = document.getElementById('expense-custody-proj-text');
    const warning = document.getElementById('expense-custody-warning');
    const paidByInput = document.getElementById('expense-paid-by');
    const projectSelect = document.getElementById('expense-project-id');

    if (!select || !select.value) {
        if (badge) badge.classList.add('hidden');
        if (info) info.classList.add('hidden');
        if (warning) warning.classList.add('hidden');
        return;
    }

    const custodyId = select.value;
    const custody = activeCustodiesList.find(c => String(c.id) === String(custodyId));
    if (!custody) return;

    const remaining = custody.remaining_balance != null ? custody.remaining_balance : ((custody.disbursed_amount || custody.amount || 0) - (custody.spent_amount || 0));

    // Show balance badge
    if (badge) {
        badge.innerText = `الرصيد المتاح: ${formatCurrency(remaining)} ر.س`;
        badge.classList.remove('hidden');
    }

    // Show info
    if (info && empText && projText) {
        empText.innerText = `صاحب العهدة: ${custody.employee_name}`;
        projText.innerText = custody.project_name ? `المشروع: ${custody.project_name}` : 'مصروف عام';
        info.classList.remove('hidden');
    }

    // Auto-fill paid-by if empty or contains previous custody label
    if (paidByInput && (!paidByInput.value.trim() || paidByInput.value.includes('(من العهدة)'))) {
        paidByInput.value = `${custody.employee_name} (من العهدة)`;
    }

    // Auto-align project if project not selected yet
    if (custody.project_id && projectSelect && (!projectSelect.value || projectSelect.value === '')) {
        projectSelect.value = custody.project_id;
        if (typeof onExpenseProjectChanged === 'function') onExpenseProjectChanged();
    }

    // Check expense amount vs balance
    validateExpenseAmountAgainstCustody();
}

function validateExpenseAmountAgainstCustody() {
    const select = document.getElementById('expense-custody-id');
    const warning = document.getElementById('expense-custody-warning');
    const payMethod = document.getElementById('expense-payment-method')?.value;
    if (!select || !warning || payMethod !== 'عهدة' || !select.value) {
        if (warning) warning.classList.add('hidden');
        return;
    }

    const custody = activeCustodiesList.find(c => String(c.id) === String(select.value));
    if (!custody) return;

    const amount = parseFloat(document.getElementById('expense-amount')?.value || 0);
    const editId = document.getElementById('expense-edit-id')?.value;
    
    let allowableBalance = custody.remaining_balance != null ? custody.remaining_balance : ((custody.disbursed_amount || custody.amount || 0) - (custody.spent_amount || 0));
    if (editId) {
        allowableBalance += amount;
    }

    if (amount > allowableBalance && allowableBalance >= 0) {
        warning.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i> <span>تنبيه مالي: مبلغ الفاتورة (${formatCurrency(amount)} ر.س) يتجاوز الرصيد المتاح في العهدة (${formatCurrency(allowableBalance)} ر.س)!</span>`;
        warning.classList.remove('hidden');
        if (typeof initLucide === 'function') initLucide();
    } else {
        warning.classList.add('hidden');
    }
}

async function viewCustodyExpenses(custodyId) {
    currentViewedCustodyId = custodyId;
    const tbody = document.getElementById('custody-expenses-table-body');
    const emptyState = document.getElementById('custody-expenses-empty');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-500">جارِ تحميل الفواتير...</td></tr>';
    if (emptyState) emptyState.classList.add('hidden');
    openModal('custody-expenses-modal');

    try {
        const res = await fetch(`/api/custody/${custodyId}/expenses`);
        const data = await res.json();
        if (!res.ok || !data.custody) {
            showToast('تعذر تحميل فواتير العهدة', 'error');
            closeModal('custody-expenses-modal');
            return;
        }

        const c = data.custody;
        const expenses = data.expenses || [];
        const disbursed = c.disbursed_amount || c.amount || 0;
        const totalSpent = data.total_spent || 0;
        const pendingSpent = data.pending_spent || 0;
        const remaining = Math.max(0, disbursed - totalSpent);

        // Update stats
        const titleEl = document.getElementById('custody-expenses-modal-title');
        if (titleEl) titleEl.innerText = `فواتير العهدة ${c.request_number} — ${c.employee_name}`;
        
        const subTitleEl = document.getElementById('custody-expenses-modal-subtitle');
        if (subTitleEl) subTitleEl.innerText = `الغرض: ${c.purpose} | المشروع: ${c.project_name || 'عام'}`;

        const disbEl = document.getElementById('cust-exp-disbursed');
        if (disbEl) disbEl.innerText = `${formatCurrency(disbursed)} ر.س`;

        const spentEl = document.getElementById('cust-exp-spent');
        if (spentEl) spentEl.innerText = `${formatCurrency(totalSpent)} ر.س`;

        const pendEl = document.getElementById('cust-exp-pending');
        if (pendEl) pendEl.innerText = `${formatCurrency(pendingSpent)} ر.س`;

        const remEl = document.getElementById('cust-exp-remaining');
        if (remEl) remEl.innerText = `${formatCurrency(remaining)} ر.س`;

        const countEl = document.getElementById('cust-exp-count');
        if (countEl) countEl.innerText = expenses.length.toString();

        if (expenses.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        const isFinManager = isFinancialManagerUser();
        let html = '';
        expenses.forEach(exp => {
            const isApproved = (exp.approval_status || 'approved') === 'approved';
            const isPending = exp.approval_status === 'pending';
            const isRejected = exp.approval_status === 'rejected';

            let appBadge = '';
            if (isPending) {
                appBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse" title="معلقة ولم تُخصم من رصيد العهدة حتى الآن"><i data-lucide="clock" class="w-3 h-3"></i><span>بانتظار التعميد</span></span>`;
            } else if (isRejected) {
                appBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30" title="${escapeHtml(exp.approval_notes || '')}"><i data-lucide="x-circle" class="w-3 h-3"></i><span>مرفوضة</span></span>`;
            } else {
                appBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title="${escapeHtml(exp.approved_by || 'معمد')}"><i data-lucide="shield-check" class="w-3 h-3"></i><span>معمدة ✓</span></span>`;
            }

            let appActions = '';
            if (isFinManager && isPending) {
                appActions = `
                    <button onclick="approveExpense(${exp.id})" class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] inline-flex items-center gap-0.5" title="تعميد الفاتورة وخصمها من رصيد العهدة">
                        <i data-lucide="shield-check" class="w-3 h-3"></i>
                        <span>تعميد</span>
                    </button>
                    <button onclick="rejectExpense(${exp.id})" class="p-1 text-rose-400 hover:text-white rounded hover:bg-rose-600/30" title="رفض الفاتورة">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                `;
            }

            const fileBtn = exp.invoice_file_path ? `
                <button onclick="viewInvoice('${exp.invoice_file_path}', '${escapeHtml(exp.title)}')" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white text-[10px] font-bold inline-flex items-center gap-1 transition">
                    <i data-lucide="eye" class="w-3 h-3"></i>
                    <span>عرض</span>
                </button>
            ` : '<span class="text-slate-600 text-[10px]">بدون مرفق</span>';

            html += `
                <tr class="hover:bg-slate-800/40 transition ${isPending ? 'bg-amber-500/5' : ''}">
                    <td class="p-2.5 font-mono text-slate-400 whitespace-nowrap text-xs">${escapeHtml(exp.expense_date)}</td>
                    <td class="p-2.5 font-bold text-white text-xs">${escapeHtml(exp.title)}</td>
                    <td class="p-2.5 text-slate-300 text-xs">${escapeHtml(exp.project_name || 'مصروف عام')}</td>
                    <td class="p-2.5 text-xs text-slate-400">
                        <span>${escapeHtml(exp.category || 'بند عام')}</span>
                        ${exp.supplier_name ? `<span class="text-amber-400 font-bold block text-[10px]">• ${escapeHtml(exp.supplier_name)}</span>` : ''}
                    </td>
                    <td class="p-2.5 font-mono font-bold text-rose-400 text-left text-xs whitespace-nowrap">${formatCurrency(exp.amount)} ر.س</td>
                    <td class="p-2.5 text-center whitespace-nowrap">${fileBtn}</td>
                    <td class="p-2.5 text-center whitespace-nowrap">${appBadge}</td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                            ${appActions}
                            <button onclick="editCustodyExpense(${exp.id})" class="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-750 transition" title="تعديل بيانات الفاتورة">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteCustodyExpense(${exp.id}, ${custodyId}, '${escapeHtml(exp.title || 'فاتورة')}', ${exp.amount})" class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-750 transition" title="حذف الفاتورة واسترجاع المبلغ للعهدة">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        if (typeof initLucide === 'function') initLucide();
    } catch (err) {
        console.error('Error fetching custody expenses:', err);
        showToast('حدث خطأ أثناء تحميل فواتير العهدة', 'error');
    }
}

function editCustodyExpense(expenseId) {
    closeModal('custody-expenses-modal');
    openEditExpenseModal(expenseId);
}

async function deleteCustodyExpense(expenseId, custodyId, title, amount) {
    const formattedAmt = formatCurrency(amount);
    const msg = `هل أنت متأكد من حذف الفاتورة "${title}" بمبلغ (${formattedAmt} ر.س)؟\n\nسيتم استرجاع المبلغ تلقائياً إلى رصيد العهدة وتحديث ميزانية المشروع.`;
    if (!confirm(msg)) return;

    try {
        const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && (data.success || !data.error)) {
            showToast('تم حذف الفاتورة واستعادة المبلغ لرصيد العهدة بنجاح', 'success');
            await viewCustodyExpenses(custodyId);
            await loadCustody();
            if (typeof loadExpenses === 'function') loadExpenses();
            if (typeof loadDashboard === 'function') loadDashboard();
        } else {
            showToast(data.error || 'فشل في حذف الفاتورة', 'error');
        }
    } catch (err) {
        console.error('Error deleting custody expense:', err);
        showToast('حدث خطأ أثناء حذف الفاتورة', 'error');
    }
}

function openExpenseForCustody(custodyId = null) {
    const targetId = custodyId || currentViewedCustodyId;
    closeModal('custody-expenses-modal');
    openModal('expense-modal');
    resetExpenseModal();
    setExpenseFormMode('general');
    
    const paySelect = document.getElementById('expense-payment-method');
    if (paySelect) {
        paySelect.value = 'عهدة';
        onExpensePaymentMethodChanged(targetId);
    }
}

// ========================================================
// TEAM & PERMISSIONS MANAGEMENT MODULE (إدارة الموظفين والصلاحيات)
// خاص بالمشرف العام: ابوالنصر البغدادي
// ========================================================

let cachedTeamList = [];

function isAbuAlnasr(user) {
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.id === 1) return true;
    if (user.username && user.username.toLowerCase() === 'baghdadi') return true;
    if (user.name && user.name.includes('ابوالنصر')) return true;
    return false;
}

function hasPermission(moduleKey) {
    if (!currentUser) return false;
    if (isAbuAlnasr(currentUser)) return true;
    if (moduleKey === 'team') return false; // Only Abu Al-Nasr!
    
    const perms = currentUser.permissions;
    if (!perms || perms === 'all' || perms === '*') return true;
    
    let list = [];
    if (Array.isArray(perms)) {
        list = perms;
    } else if (typeof perms === 'string') {
        try {
            const parsed = JSON.parse(perms);
            if (Array.isArray(parsed)) list = parsed;
            else list = perms.split(',').map(s => s.trim());
        } catch (e) {
            list = perms.split(',').map(s => s.trim());
        }
    }
    return list.includes(moduleKey);
}

function applyUserPermissions() {
    if (!currentUser) return;
    const isOwner = isAbuAlnasr(currentUser);
    
    // 1. Team Tab & Menu Item (Abu Al-Nasr only!)
    const navTeam = document.getElementById('nav-team');
    const menuBtnTeam = document.getElementById('menu-btn-team');
    if (navTeam) {
        if (isOwner) navTeam.classList.remove('hidden');
        else navTeam.classList.add('hidden');
    }
    if (menuBtnTeam) {
        if (isOwner) menuBtnTeam.classList.remove('hidden');
        else menuBtnTeam.classList.add('hidden');
    }

    // 2. Filter tabs in navbar
    const modules = ['dashboard', 'projects', 'tasks', 'expenses', 'suppliers', 'cashflow', 'subcontractors', 'custody', 'documents', 'reports', 'chat', 'hr'];
    modules.forEach(mod => {
        const btn = document.getElementById('nav-' + mod);
        if (btn) {
            if (hasPermission(mod)) {
                btn.style.display = '';
            } else {
                btn.style.display = 'none';
            }
        }
    });

    // 3. Filter quick actions
    const quickAuto = document.querySelector('#quick-menu button[onclick*="openAutoAllocateModal"]');
    const quickExp = document.querySelector('#quick-menu button[onclick*="expense-modal"]');
    const quickCust = document.querySelector('#quick-menu button[onclick*="custody-request-modal"]');
    const quickTsk = document.querySelector('#quick-menu button[onclick*="task-modal"]');
    const quickProj = document.querySelector('#quick-menu button[onclick*="openProjectModal"]');
    const quickDoc = document.querySelector('#quick-menu button[onclick*="document-modal"]');

    if (quickAuto) quickAuto.style.display = hasPermission('cashflow') ? '' : 'none';
    if (quickExp) quickExp.style.display = hasPermission('expenses') ? '' : 'none';
    if (quickCust) quickCust.style.display = hasPermission('custody') ? '' : 'none';
    if (quickTsk) quickTsk.style.display = hasPermission('tasks') ? '' : 'none';
    if (quickProj) quickProj.style.display = hasPermission('projects') ? '' : 'none';
    if (quickDoc) quickDoc.style.display = hasPermission('documents') ? '' : 'none';

    // 4. Redirect if currently in unauthorized tab
    if (currentTab === 'team' && !isOwner) {
        switchTab('dashboard');
    } else if (currentTab !== 'team' && !hasPermission(currentTab)) {
        const firstAllowed = modules.find(m => hasPermission(m)) || 'dashboard';
        switchTab(firstAllowed);
    }
}

async function loadTeamManagement() {
    if (!isAbuAlnasr(currentUser)) {
        showToast('هذا القسم مخصص للمشرف العام (ابوالنصر) فقط', 'warning');
        switchTab('dashboard');
        return;
    }

    try {
        const res = await fetch('/api/team');
        const team = await res.json();
        cachedTeamList = team;

        // Update stats
        const totalEl = document.getElementById('stat-team-total');
        const activeEl = document.getElementById('stat-team-active');
        const badgeEl = document.getElementById('badge-team-count');

        if (totalEl) totalEl.innerText = team.length;
        if (activeEl) activeEl.innerText = team.filter(m => (m.status || 'active') === 'active').length;
        if (badgeEl) badgeEl.innerText = team.length;

        renderTeamMembers(team);
    } catch (err) {
        console.error('Error loading team management:', err);
        showToast('حدث خطأ في تحميل قائمة الموظفين', 'error');
    }
}

const MODULE_DEFINITIONS = [
    { key: 'dashboard', label: 'الرئيسية', color: 'emerald' },
    { key: 'projects', label: 'المشاريع', color: 'blue' },
    { key: 'tasks', label: 'المهام', color: 'amber' },
    { key: 'expenses', label: 'المصاريف', color: 'rose' },
    { key: 'suppliers', label: 'الموردين', color: 'amber' },
    { key: 'cashflow', label: 'السيولة', color: 'teal' },
    { key: 'subcontractors', label: 'مقاولو الباطن', color: 'indigo' },
    { key: 'custody', label: 'العهد', color: 'amber' },
    { key: 'documents', label: 'المخططات', color: 'purple' },
    { key: 'reports', label: 'التقارير', color: 'emerald' },
    { key: 'chat', label: 'المحادثات', color: 'teal' },
    { key: 'hr', label: 'الموارد البشرية', color: 'indigo' }
];

function renderTeamMembers(members) {
    const container = document.getElementById('team-members-list');
    if (!container) return;

    if (!members || members.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-8 text-center bg-slate-850 rounded-2xl border border-slate-750 text-slate-400">
                <i data-lucide="users" class="w-10 h-10 mx-auto mb-2 text-slate-500"></i>
                <p class="font-bold text-sm">لا يوجد موظفون مطابقون لخيارات البحث</p>
            </div>
        `;
        initLucide();
        return;
    }

    const html = members.map(m => {
        const isAdmin = isAbuAlnasr(m);
        const isActive = (m.status || 'active') === 'active';
        const cleanName = (m.name || '').replace(/^(م\.|أ\.|Eng\.)\s*/, '').trim();
        const initial = cleanName.charAt(0) || 'م';

        // Parse permissions
        let permBadges = '';
        if (isAdmin || m.permissions === 'all' || !m.permissions) {
            permBadges = `
                <div class="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-300 flex items-center gap-1.5 font-bold">
                    <i data-lucide="shield-check" class="w-4 h-4 text-purple-400 shrink-0"></i>
                    <span>${isAdmin ? 'المشرف العام - كامل الصلاحيات لجميع الأقسام' : 'كامل الصلاحيات (جميع الأقسام)'}</span>
                </div>
            `;
        } else {
            const userPerms = (typeof m.permissions === 'string' ? m.permissions.split(',') : m.permissions).map(s => s.trim());
            const badges = MODULE_DEFINITIONS
                .filter(mod => userPerms.includes(mod.key))
                .map(mod => `<span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold">${mod.label}</span>`)
                .join(' ');

            permBadges = badges ? `
                <div class="space-y-1">
                    <span class="text-[10px] text-slate-400 block font-medium">الأقسام المصرح بها (${userPerms.length}):</span>
                    <div class="flex flex-wrap gap-1">${badges}</div>
                </div>
            ` : `
                <div class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold">
                    لا توجد صلاحيات ممنوحة
                </div>
            `;
        }

        const avatarColor = isAdmin 
            ? 'from-purple-600 to-indigo-600 text-white' 
            : 'from-emerald-600 to-teal-600 text-white';

        return `
            <div class="bg-slate-850 rounded-2xl border border-slate-750 hover:border-purple-500/40 p-5 shadow-lg flex flex-col justify-between space-y-4 transition">
                <div class="space-y-3">
                    <!-- Top Info Header -->
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center font-black text-lg shadow-md shrink-0">
                                ${initial}
                            </div>
                            <div class="min-w-0">
                                <h3 class="font-black text-sm text-white truncate flex items-center gap-1.5">
                                    <span>${m.name}</span>
                                    ${isAdmin ? '<i data-lucide="crown" class="w-3.5 h-3.5 text-amber-400 shrink-0" title="المشرف العام"></i>' : ''}
                                </h3>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-[11px] text-emerald-400 font-semibold truncate">${m.role || 'موظف'}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">@${m.username || 'user'}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Status Badge -->
                        <span class="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isActive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}">
                            ${isActive ? '● نشط' : '○ معطل'}
                        </span>
                    </div>

                    <!-- Contact Details -->
                    <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-750/60 space-y-1 text-[11px]">
                        <div class="flex items-center justify-between text-slate-300">
                            <span class="flex items-center gap-1.5 text-slate-400">
                                <i data-lucide="phone" class="w-3 h-3 text-slate-500"></i>
                                <span>الجوال:</span>
                            </span>
                            <span class="font-mono text-white">${m.phone || '—'}</span>
                        </div>
                        <div class="flex items-center justify-between text-slate-300 truncate">
                            <span class="flex items-center gap-1.5 text-slate-400 shrink-0">
                                <i data-lucide="mail" class="w-3 h-3 text-slate-500"></i>
                                <span>البريد:</span>
                            </span>
                            <span class="font-mono text-slate-300 truncate ml-2">${m.email || '—'}</span>
                        </div>
                    </div>

                    <!-- Permissions Section -->
                    <div class="pt-2 border-t border-slate-750">
                        ${permBadges}
                    </div>
                </div>

                <!-- Action Footer Buttons -->
                <div class="pt-3 border-t border-slate-750 flex items-center justify-end gap-2">
                    <button type="button" onclick="openEditTeamMemberModal(${m.id})" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-purple-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        <span>تعديل الصلاحيات</span>
                    </button>
                    ${!isAdmin ? `
                        <button type="button" onclick="deleteTeamMember(${m.id}, '${m.name}')" class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition" title="حذف الموظف نهائياً">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            <span>حذف</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    initLucide();
}

function filterTeamMembersTable() {
    const searchVal = (document.getElementById('team-search-input')?.value || '').trim().toLowerCase();
    const roleVal = document.getElementById('team-role-filter')?.value || '';

    const filtered = cachedTeamList.filter(m => {
        const matchesSearch = !searchVal || 
            (m.name && m.name.toLowerCase().includes(searchVal)) ||
            (m.username && m.username.toLowerCase().includes(searchVal)) ||
            (m.phone && m.phone.includes(searchVal)) ||
            (m.email && m.email.toLowerCase().includes(searchVal));

        const matchesRole = !roleVal || (m.role && m.role.includes(roleVal));
        return matchesSearch && matchesRole;
    });

    renderTeamMembers(filtered);
}

function openAddTeamMemberModal() {
    const form = document.getElementById('team-member-form');
    if (form) form.reset();
    document.getElementById('tm-id').value = '';
    document.getElementById('team-modal-title').innerText = 'إضافة موظف جديد وتحديد صلاحياته';
    document.getElementById('btn-team-submit-text').innerText = 'إضافة الموظف';
    document.getElementById('tm-username').disabled = false;
    document.getElementById('tm-password').value = '123';
    document.getElementById('tm-pwd-hint').innerText = '(123 افتراضياً)';

    // Default to all permissions for new employee
    setPermissionsPreset('all');
    openModal('team-member-modal');
}

function openEditTeamMemberModal(memberId) {
    const member = cachedTeamList.find(m => m.id === memberId);
    if (!member) return;

    const isAdmin = isAbuAlnasr(member);
    document.getElementById('tm-id').value = member.id;
    document.getElementById('tm-name').value = member.name || '';
    document.getElementById('tm-role').value = member.role || '';
    document.getElementById('tm-username').value = member.username || '';
    document.getElementById('tm-phone').value = member.phone || '';
    document.getElementById('tm-email').value = member.email || '';
    document.getElementById('tm-status').value = member.status || 'active';
    document.getElementById('tm-password').value = '';
    document.getElementById('tm-pwd-hint').innerText = '(اتركها فارغة إذا لم ترغب بتغييرها)';
    
    // Protect username and status for Abu Al-Nasr
    document.getElementById('tm-username').disabled = isAdmin;
    document.getElementById('tm-status').disabled = isAdmin;

    document.getElementById('team-modal-title').innerText = `تعديل بيانات وصلاحيات: ${member.name}`;
    document.getElementById('btn-team-submit-text').innerText = 'حفظ التعديلات';

    // Set Checkboxes
    if (isAdmin || member.permissions === 'all' || !member.permissions) {
        setPermissionsPreset('all');
    } else {
        const userPerms = (typeof member.permissions === 'string' ? member.permissions.split(',') : member.permissions).map(s => s.trim());
        document.querySelectorAll('.perm-cb').forEach(cb => {
            cb.checked = userPerms.includes(cb.value);
        });
    }

    openModal('team-member-modal');
}

function setPermissionsPreset(preset) {
    const checkboxes = document.querySelectorAll('.perm-cb');
    if (preset === 'all') {
        checkboxes.forEach(cb => cb.checked = true);
    } else if (preset === 'none') {
        checkboxes.forEach(cb => cb.checked = false);
    } else if (preset === 'engineer') {
        const allowed = ['dashboard', 'projects', 'tasks', 'custody', 'documents', 'chat'];
        checkboxes.forEach(cb => cb.checked = allowed.includes(cb.value));
    } else if (preset === 'accountant') {
        const allowed = ['dashboard', 'expenses', 'suppliers', 'cashflow', 'subcontractors', 'reports', 'chat'];
        checkboxes.forEach(cb => cb.checked = allowed.includes(cb.value));
    }
}

async function submitTeamMemberForm(e) {
    e.preventDefault();
    const id = document.getElementById('tm-id').value;
    const name = (document.getElementById('tm-name').value || '').trim();
    const role = (document.getElementById('tm-role').value || '').trim();
    const username = (document.getElementById('tm-username').value || '').trim().toLowerCase();
    const password = (document.getElementById('tm-password').value || '').trim();
    const phone = (document.getElementById('tm-phone').value || '').trim();
    const email = (document.getElementById('tm-email').value || '').trim();
    const status = document.getElementById('tm-status').value;

    // Collect permissions
    const checkedPerms = Array.from(document.querySelectorAll('.perm-cb:checked')).map(cb => cb.value);
    let permissions = 'all';
    const allCount = document.querySelectorAll('.perm-cb').length;
    if (checkedPerms.length === allCount) {
        permissions = 'all';
    } else if (checkedPerms.length === 0) {
        showToast('يرجى تحديد قسم واحد على الأقل للموظف', 'warning');
        return;
    } else {
        permissions = checkedPerms.join(',');
    }

    const payload = { name, role, username, phone, email, status, permissions };
    if (password) payload.password = password;

    const submitBtn = document.getElementById('btn-submit-team-member');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70');
    }

    try {
        const url = id ? `/api/team/${id}` : '/api/team';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && (data.success || !data.error)) {
            showToast(data.message || 'تم حفظ بيانات الموظف والصلاحيات بنجاح', 'success');
            closeModal('team-member-modal');
            await loadTeamManagement();
            if (typeof loadTeamDropdowns === 'function') await loadTeamDropdowns();
        } else {
            showToast(data.error || 'حدث خطأ في حفظ بيانات الموظف', 'error');
        }
    } catch (err) {
        console.error('Error saving team member:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-70');
        }
    }
}

async function deleteTeamMember(id, name) {
    if (!confirm(`هل أنت متأكد من حذف حساب الموظف "${name}" نهائياً من المنظومة؟\n\nلن يتمكن الموظف من تسجيل الدخول بعد الآن.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم حذف حساب الموظف بنجاح', 'success');
            await loadTeamManagement();
            if (typeof loadTeamDropdowns === 'function') await loadTeamDropdowns();
        } else {
            showToast(data.error || 'تعذر حذف الموظف', 'error');
        }
    } catch (err) {
        console.error('Error deleting team member:', err);
        showToast('حدث خطأ أثناء حذف الموظف', 'error');
    }
}






// ==========================================
// HR & WORKFORCE MANAGEMENT SYSTEM (منظومة الموارد البشرية)
// ==========================================

let hrEmployeesData = [];
let hrPayrollsData = [];
let hrLeavesData = [];
let hrAdvancesData = [];
let hrExpirationsData = [];
let currentHrPayrollDetail = null;

function switchHrSubTab(subTabId) {
    const validTabs = ['employees', 'payroll', 'leaves', 'advances', 'expirations', 'eos'];
    if (!validTabs.includes(subTabId)) subTabId = 'employees';

    // Update buttons
    validTabs.forEach(id => {
        const btn = document.getElementById(`hr-subtab-btn-${id}`);
        if (btn) {
            if (id === subTabId) {
                btn.className = 'hr-subtab-btn active-hr-subtab py-2.5 px-4 text-xs font-bold text-indigo-400 border-b-2 border-indigo-500 flex items-center gap-2 transition';
            } else {
                btn.className = 'hr-subtab-btn py-2.5 px-4 text-xs font-bold text-slate-400 hover:text-white border-b-2 border-transparent flex items-center gap-2 transition';
            }
        }
    });

    // Update contents
    document.querySelectorAll('.hr-subtab-content').forEach(c => c.classList.add('hidden'));
    const content = document.getElementById(`hr-content-${subTabId}`);
    if (content) content.classList.remove('hidden');

    initLucide();
}

async function loadHrData() {
    try {
        await Promise.allSettled([
            loadHrStats(),
            loadHrEmployees(),
            loadHrPayrolls(),
            loadHrLeaves(),
            loadHrAdvances(),
            loadHrExpirations(),
            loadHrProjectsDropdown()
        ]);
    } catch (err) {
        console.error('Error loading HR data:', err);
    }
}

async function loadHrStats() {
    try {
        const res = await fetch('/api/hr/stats');
        const data = await res.json();
        
        const empEl = document.getElementById('stat-hr-employees');
        const payEl = document.getElementById('stat-hr-payroll');
        const leaveEl = document.getElementById('stat-hr-leave');
        const expEl = document.getElementById('stat-hr-expirations');
        const advEl = document.getElementById('stat-hr-advances');
        const badgeCount = document.getElementById('badge-hr-expirations-count');
        const navAlert = document.getElementById('badge-hr-alerts') || document.getElementById('nav-hr-alert');

        const totalEmployees = data.total_active ?? data.total_employees ?? 0;
        const totalPayroll = data.monthly_payroll ?? data.total_monthly_payroll ?? 0;
        const onLeave = data.on_leave ?? data.active_leaves ?? 0;
        const expiringDocs = data.expiring_docs ?? data.expiring_docs_60d ?? 0;
        const totalAdvances = data.total_advances ?? data.remaining_advances ?? 0;

        if (empEl) empEl.innerText = totalEmployees;
        if (payEl) payEl.innerText = formatCurrency(totalPayroll);
        if (leaveEl) leaveEl.innerText = onLeave;
        if (expEl) expEl.innerText = expiringDocs;
        if (advEl) advEl.innerText = formatCurrency(totalAdvances);

        const expCount = expiringDocs;
        if (badgeCount) {
            if (expCount > 0) {
                badgeCount.innerText = expCount;
                badgeCount.classList.remove('hidden');
            } else {
                badgeCount.classList.add('hidden');
            }
        }

        if (navAlert) {
            if (expCount > 0) {
                navAlert.innerText = expCount;
                navAlert.classList.remove('hidden');
            } else {
                navAlert.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error('Error loading HR stats:', err);
    }
}

async function loadHrProjectsDropdown() {
    try {
        const select = document.getElementById('hr-emp-project');
        if (!select) return;
        const res = await fetch('/api/projects');
        const projects = await res.json();
        
        let html = '<option value="">-- الإدارة العامة (بدون مشروع محدد) --</option>';
        if (Array.isArray(projects)) {
            projects.forEach(p => {
                html += `<option value="${p.id}">${p.name || ('مشروع #' + p.id)}</option>`;
            });
        }
        select.innerHTML = html;
    } catch (err) {
        console.warn('Could not load projects for HR modal:', err);
    }
}

async function loadHrEmployees() {
    try {
        const res = await fetch('/api/hr/employees');
        const list = await res.json();
        hrEmployeesData = Array.isArray(list) ? list : [];
        renderHrEmployees();
        populateHrEmployeeSelects();
    } catch (err) {
        console.error('Error loading HR employees:', err);
        showToast('تعذر تحميل بيانات الموظفين', 'error');
    }
}

function filterHrEmployees() {
    renderHrEmployees();
}

function renderHrEmployees() {
    const container = document.getElementById('hr-employees-list');
    if (!container) return;

    const search = (document.getElementById('hr-search-input')?.value || '').trim().toLowerCase();
    const deptFilter = document.getElementById('hr-department-filter')?.value || '';
    const statusFilter = document.getElementById('hr-status-filter')?.value || '';

    let filtered = hrEmployeesData.filter(emp => {
        if (deptFilter && emp.department !== deptFilter) return false;
        if (statusFilter && emp.status !== statusFilter) return false;
        if (search) {
            const matchName = (emp.name || '').toLowerCase().includes(search);
            const matchTitle = (emp.job_title || '').toLowerCase().includes(search);
            const matchNid = (emp.national_id || '').toLowerCase().includes(search);
            if (!matchName && !matchTitle && !matchNid) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-8 text-center bg-slate-850 rounded-2xl border border-slate-750 text-slate-400">
                <i data-lucide="users" class="w-10 h-10 mx-auto mb-2 text-slate-500"></i>
                <p class="font-bold text-sm">لا يوجد موظفون مطابقون لخيارات البحث</p>
                <button type="button" onclick="openAddHrEmployeeModal()" class="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>إضافة موظف جديد</span>
                </button>
            </div>
        `;
        initLucide();
        return;
    }

    const html = filtered.map(emp => {
        const cleanName = (emp.name || '').replace(/^(م\.|أ\.|Eng\.)\s*/, '').trim();
        const initial = cleanName.charAt(0) || 'م';
        const basicSalary = parseFloat(emp.basic_salary) || 0;
        const housing = parseFloat(emp.housing_allowance) || 0;
        const transport = parseFloat(emp.transport_allowance) || 0;
        const other = parseFloat(emp.other_allowances !== undefined && emp.other_allowances !== null ? emp.other_allowances : (emp.other_allowance || 0)) || 0;
        const totalSalary = basicSalary + housing + transport + other;

        const iqamaEnd = emp.iqama_expiry_date || emp.iqama_expiry || '';
        const contractEnd = emp.contract_end_date || emp.contract_end || '';
        const vacationBal = emp.vacation_balance ?? emp.annual_leave_balance ?? 30;

        let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">● على رأس العمل</span>';
        if (emp.status === 'on_leave') {
            statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">○ في إجازة</span>';
        } else if (emp.status === 'terminated') {
            statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">✕ منتهي خدماته</span>';
        }

        return `
            <div class="bg-slate-850 rounded-2xl border border-slate-750 hover:border-indigo-500/40 p-5 shadow-lg flex flex-col justify-between space-y-4 transition">
                <div class="space-y-3">
                    <!-- Top Info Header -->
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-black text-lg text-white shadow-md shrink-0">
                                ${initial}
                            </div>
                            <div class="min-w-0">
                                <h3 class="font-black text-sm text-white truncate">${emp.name}</h3>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-[11px] text-indigo-400 font-semibold truncate">${emp.job_title}</span>
                                    <span class="text-[10px] text-slate-400 font-medium">(${emp.nationality || 'سعودي'})</span>
                                </div>
                            </div>
                        </div>
                        <div class="shrink-0">
                            ${statusBadge}
                        </div>
                    </div>

                    <!-- Department & ID -->
                    <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">${emp.department || 'إدارة عامة'}</span>
                        ${emp.national_id ? `<span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">هوية: ${emp.national_id}</span>` : ''}
                        ${emp.phone ? `<span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">${emp.phone}</span>` : ''}
                    </div>

                    <!-- Salary Breakdown -->
                    <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-[10px] text-slate-400 block">الراتب الأساسي</span>
                            <span class="font-black text-white font-mono">${formatCurrency(basicSalary)}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-emerald-400 block font-bold">إجمالي الراتب + البدلات</span>
                            <span class="font-black text-emerald-400 font-mono">${formatCurrency(totalSalary)}</span>
                        </div>
                    </div>

                    <!-- Document Expiry Dates -->
                    <div class="space-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                        ${iqamaEnd ? `
                            <div class="flex items-center justify-between">
                                <span>انتهاء الإقامة/الهوية:</span>
                                <span class="font-mono text-slate-300 font-semibold">${iqamaEnd}</span>
                            </div>
                        ` : ''}
                        ${contractEnd ? `
                            <div class="flex items-center justify-between">
                                <span>انتهاء العقد:</span>
                                <span class="font-mono text-slate-300 font-semibold">${contractEnd}</span>
                            </div>
                        ` : ''}
                        ${emp.join_date ? `
                            <div class="flex items-center justify-between text-[10px] text-slate-500">
                                <span>تاريخ المباشرة:</span>
                                <span class="font-mono">${emp.join_date}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Action Footer -->
                <div class="flex items-center justify-between pt-3 border-t border-slate-750/70 text-xs">
                    <div class="text-[10px] text-slate-400">
                        <span>رصيد الإجازات: </span>
                        <span class="text-amber-400 font-bold font-mono">${vacationBal} يوم</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="openEditHrEmployeeModal(${emp.id})" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            <span>تعديل</span>
                        </button>
                        <button type="button" onclick="deleteHrEmployee(${emp.id}, '${emp.name.replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition" title="حذف الموظف">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    initLucide();
}

function populateHrEmployeeSelects() {
    const leaveSelect = document.getElementById('leave-emp-select');
    const advSelect = document.getElementById('adv-emp-select');
    const eosSelect = document.getElementById('eos-emp-select');

    let optionsHtml = '<option value="">-- اختر موظفاً --</option>';
    let eosOptionsHtml = '<option value="">-- اختر موظفاً مسجلاً (تعبئة تلقائية) --</option>';

    hrEmployeesData.forEach(emp => {
        optionsHtml += `<option value="${emp.id}">${emp.name} - ${emp.job_title} (${emp.department || 'عام'})</option>`;
        eosOptionsHtml += `<option value="${emp.id}">${emp.name} - ${emp.job_title}</option>`;
    });

    if (leaveSelect) leaveSelect.innerHTML = optionsHtml;
    if (advSelect) advSelect.innerHTML = optionsHtml;
    if (eosSelect) eosSelect.innerHTML = eosOptionsHtml;
}

function openAddHrEmployeeModal() {
    const form = document.getElementById('hr-employee-form');
    if (form) form.reset();
    document.getElementById('hr-emp-id').value = '';
    document.getElementById('hr-emp-modal-title').innerText = 'إضافة موظف جديد للموارد البشرية';
    openModal('hr-employee-modal');
}

function openEditHrEmployeeModal(id) {
    const emp = hrEmployeesData.find(e => e.id === id);
    if (!emp) return;

    document.getElementById('hr-emp-id').value = emp.id;
    document.getElementById('hr-emp-name').value = emp.name || '';
    document.getElementById('hr-emp-title').value = emp.job_title || '';
    document.getElementById('hr-emp-nationality').value = emp.nationality || '';
    document.getElementById('hr-emp-nid').value = emp.national_id || '';
    document.getElementById('hr-emp-dept').value = emp.department || 'المشاريع الهندسية';
    document.getElementById('hr-emp-project').value = emp.project_id || '';
    document.getElementById('hr-emp-phone').value = emp.phone || '';
    document.getElementById('hr-emp-email').value = emp.email || '';
    document.getElementById('hr-emp-status').value = emp.status || 'active';

    document.getElementById('hr-emp-basic').value = emp.basic_salary || 0;
    document.getElementById('hr-emp-housing').value = emp.housing_allowance || 0;
    document.getElementById('hr-emp-transport').value = emp.transport_allowance || 0;
    document.getElementById('hr-emp-other').value = emp.other_allowances ?? emp.other_allowance ?? 0;

    document.getElementById('hr-emp-bank').value = emp.bank_name || '';
    document.getElementById('hr-emp-iban').value = emp.iban || emp.bank_iban || '';

    document.getElementById('hr-emp-joindate').value = emp.join_date || '';
    document.getElementById('hr-emp-contract-end').value = emp.contract_end_date || emp.contract_end || '';
    document.getElementById('hr-emp-iqama-end').value = emp.iqama_expiry_date || emp.iqama_expiry || '';
    document.getElementById('hr-emp-insurance-end').value = emp.insurance_expiry_date || emp.medical_insurance_expiry || '';
    document.getElementById('hr-emp-passport-end').value = emp.passport_expiry_date || emp.passport_expiry || '';

    document.getElementById('hr-emp-modal-title').innerText = 'تعديل بيانات الموظف: ' + emp.name;
    openModal('hr-employee-modal');
}

async function submitHrEmployeeForm(e) {
    e.preventDefault();
    const id = document.getElementById('hr-emp-id').value;
    const submitBtn = document.getElementById('btn-submit-employee');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70');
    }

    const payload = {
        name: document.getElementById('hr-emp-name').value.trim(),
        job_title: document.getElementById('hr-emp-title').value.trim(),
        nationality: document.getElementById('hr-emp-nationality').value.trim() || 'سعودي',
        national_id: document.getElementById('hr-emp-nid').value.trim(),
        department: document.getElementById('hr-emp-dept').value,
        project_id: document.getElementById('hr-emp-project').value || null,
        phone: document.getElementById('hr-emp-phone').value.trim(),
        email: document.getElementById('hr-emp-email').value.trim(),
        status: document.getElementById('hr-emp-status').value,

        basic_salary: parseFloat(document.getElementById('hr-emp-basic').value) || 0,
        housing_allowance: parseFloat(document.getElementById('hr-emp-housing').value) || 0,
        transport_allowance: parseFloat(document.getElementById('hr-emp-transport').value) || 0,
        other_allowance: parseFloat(document.getElementById('hr-emp-other').value) || 0,

        bank_name: document.getElementById('hr-emp-bank').value.trim(),
        bank_iban: document.getElementById('hr-emp-iban').value.trim(),

        join_date: document.getElementById('hr-emp-joindate').value || null,
        contract_end: document.getElementById('hr-emp-contract-end').value || null,
        iqama_expiry: document.getElementById('hr-emp-iqama-end').value || null,
        medical_insurance_expiry: document.getElementById('hr-emp-insurance-end').value || null,
        passport_expiry: document.getElementById('hr-emp-passport-end').value || null
    };

    try {
        const url = id ? `/api/hr/employees/${id}` : '/api/hr/employees';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && (data.success || !data.error)) {
            showToast(data.message || 'تم حفظ بيانات الموظف بنجاح', 'success');
            closeModal('hr-employee-modal');
            await loadHrData();
        } else {
            showToast(data.error || 'حدث خطأ في حفظ بيانات الموظف', 'error');
        }
    } catch (err) {
        console.error('Error saving HR employee:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-70');
        }
    }
}

async function deleteHrEmployee(id, name) {
    if (!confirm(`هل أنت متأكد من حذف سجل الموظف "${name}" نهائياً من الموارد البشرية؟`)) {
        return;
    }

    try {
        const res = await fetch(`/api/hr/employees/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم حذف الموظف بنجاح', 'success');
            await loadHrData();
        } else {
            showToast(data.error || 'تعذر حذف الموظف', 'error');
        }
    } catch (err) {
        console.error('Error deleting HR employee:', err);
        showToast('حدث خطأ أثناء حذف الموظف', 'error');
    }
}

// ----------------- PAYROLL MANAGEMENT -----------------
function isFinancialManagerUser() {
    try {
        const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || localStorage.getItem('segieny_current_user') || '{}');
        if (!u) return false;
        const r = (u.role || '').toLowerCase();
        const un = (u.username || '').toLowerCase();
        const n = (u.name || '').toLowerCase();
        // صلاحية حصرية للمدير المالي (أ. ابوالنصر البغدادي)
        if (r.includes('مدير مالي') || r.includes('المدير المالي') || r.includes('financial')) return true;
        if (un === 'baghdadi') return true;
        if (n.includes('ابوالنصر') || n.includes('البغدادي')) return true;
        return false;
    } catch(e) {
        return false;
    }
}

async function loadHrPayrolls() {
    try {
        const res = await fetch('/api/hr/payrolls');
        const list = await res.json();
        hrPayrollsData = Array.isArray(list) ? list : [];
        renderHrPayrolls();
    } catch (err) {
        console.error('Error loading HR payrolls:', err);
    }
}

function renderHrPayrolls() {
    const container = document.getElementById('hr-payrolls-list');
    if (!container) return;

    if (hrPayrollsData.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center bg-slate-850 rounded-2xl border border-slate-750 text-slate-400">
                <i data-lucide="file-spreadsheet" class="w-10 h-10 mx-auto mb-2 text-slate-500"></i>
                <p class="font-bold text-sm">لم يتم إصدار أي مسيرات رواتب بعد</p>
                <button type="button" onclick="openGeneratePayrollModal()" class="mt-3 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition">
                    <i data-lucide="sparkles" class="w-4 h-4"></i>
                    <span>إصدار مسير الرواتب الأول</span>
                </button>
            </div>
        `;
        initLucide();
        return;
    }

    const canApprove = isFinancialManagerUser();

    const html = hrPayrollsData.map(p => {
        let statusBadge = `
            <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5">
                <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                <span>بانتظار تعميد المدير المالي</span>
            </span>
        `;
        if (p.status === 'approved') {
            statusBadge = `
                <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1.5">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
                    <span>معمد من المدير المالي</span>
                </span>
            `;
        } else if (p.status === 'paid') {
            statusBadge = `
                <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5">
                    <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                    <span>تم الصرف والتحويل</span>
                </span>
            `;
        }

        return `
            <div class="bg-slate-850 p-5 rounded-2xl border border-slate-750 hover:border-emerald-500/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition">
                <div class="flex items-center gap-4">
                    <div class="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        <i data-lucide="calendar" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-black text-sm text-white">مسير رواتب: <span class="font-mono text-emerald-400">${p.month_year || p.month || ''}</span></h4>
                            ${statusBadge}
                        </div>
                        <p class="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                            <span>${escapeHtml(p.notes || 'مسير الرواتب الشهرية والبدلات وخصم السلف')}</span>
                            ${p.created_by ? `<span class="text-slate-500">•</span><span class="text-slate-300 font-sans">أنشئ بواسطة: <strong class="text-slate-200">${escapeHtml(p.created_by)}</strong></span>` : ''}
                            ${p.approved_by ? `<span class="text-slate-500">•</span><span class="text-emerald-400 font-sans">تعميد: <strong>${escapeHtml(p.approved_by)}</strong></span>` : ''}
                        </p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div>
                        <span class="text-[10px] text-slate-400 block font-medium">عدد الموظفين</span>
                        <span class="font-black text-sm text-white font-mono">${p.employees_count ?? p.total_employees ?? 0} موظف</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 block font-medium">صافي المسير</span>
                        <span class="font-black text-base text-emerald-400 font-mono">${formatCurrency(p.total_net)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="viewHrPayrollDetails(${p.id})" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition">
                            <i data-lucide="eye" class="w-4 h-4 text-emerald-400"></i>
                            <span>عرض المسير</span>
                        </button>
                        ${p.status === 'draft' ? (canApprove ? `
                            <button type="button" onclick="updateHrPayrollStatus(${p.id}, 'approved')" class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-blue-950/40 transition" title="تعميد مسير الرواتب بصفة المدير المالي">
                                <i data-lucide="shield-check" class="w-4 h-4"></i>
                                <span>تعميد المسير (المدير المالي)</span>
                            </button>
                        ` : `
                            <span class="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center gap-1" title="تعميد المسير صلاحية حصرية للمدير المالي (أ. ابوالنصر البغدادي)">
                                <i data-lucide="lock" class="w-3 h-3"></i>
                                <span>بانتظار تعميد المالي</span>
                            </span>
                        `) : ''}
                        ${p.status === 'approved' ? (canApprove ? `
                            <button type="button" onclick="updateHrPayrollStatus(${p.id}, 'paid')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition">
                                <i data-lucide="banknote" class="w-4 h-4"></i>
                                <span>تأكيد الصرف</span>
                            </button>
                        ` : `
                            <span class="px-2.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold text-[11px] flex items-center gap-1">
                                <i data-lucide="check" class="w-3 h-3"></i>
                                <span>معمد وجاهز للصرف</span>
                            </span>
                        `) : ''}
                        <button type="button" onclick="deleteHrPayroll(${p.id})" class="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition" title="حذف المسير">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    initLucide();
}

function openGeneratePayrollModal() {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    const monthInput = document.getElementById('hr-payroll-month');
    if (monthInput) monthInput.value = currentMonth;
    openModal('hr-generate-payroll-modal');
}

async function submitGeneratePayroll(e) {
    e.preventDefault();
    const month = document.getElementById('hr-payroll-month').value;
    const notes = document.getElementById('hr-payroll-notes').value.trim();
    const btn = document.getElementById('btn-submit-payroll-gen');

    if (!month) {
        showToast('يرجى تحديد الشهر والسنة', 'warning');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-70');
    }

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    const created_by = u.name ? `${u.name} (${u.role || 'فريق العمل'})` : 'المسؤول الإداري';

    try {
        const res = await fetch('/api/hr/payrolls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, notes, created_by })
        });
        const data = await res.json();

        if (res.ok && (data.success || !data.error)) {
            showToast(data.message || 'تم إصدار مسير الرواتب بنجاح وهو الآن بانتظار تعميد المدير المالي', 'success');
            closeModal('hr-generate-payroll-modal');
            await loadHrData();
            if (data.id) {
                await viewHrPayrollDetails(data.id);
            }
        } else {
            showToast(data.error || 'حدث خطأ في إصدار المسير', 'error');
        }
    } catch (err) {
        console.error('Error generating payroll:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70');
        }
    }
}

async function viewHrPayrollDetails(id) {
    try {
        const res = await fetch(`/api/hr/payrolls/${id}`);
        const data = await res.json();
        if (!res.ok || data.error) {
            showToast(data.error || 'تعذر تحميل تفاصيل المسير', 'error');
            return;
        }

        currentHrPayrollDetail = data;
        const payroll = data.payroll || data;
        const items = data.items || payroll.items || [];
        const canApprove = isFinancialManagerUser();

        document.getElementById('hr-payroll-view-title').innerText = `مسير رواتب شهر: ${payroll.month_year || payroll.month || ''}`;
        const createdInfo = payroll.created_by ? ` • أنشئ بواسطة: ${payroll.created_by}` : '';
        document.getElementById('hr-payroll-view-date').innerText = `تاريخ الإنشاء: ${payroll.created_at || ''}${createdInfo}`;

        // Status badge
        const statusEl = document.getElementById('hr-payroll-view-status');
        if (payroll.status === 'draft') {
            statusEl.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5';
            statusEl.innerHTML = '<i data-lucide="clock" class="w-3.5 h-3.5"></i><span>بانتظار تعميد المدير المالي</span>';
        } else if (payroll.status === 'approved') {
            statusEl.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1.5';
            statusEl.innerHTML = `<i data-lucide="shield-check" class="w-3.5 h-3.5"></i><span>معمد من المدير المالي (${payroll.approved_by || 'أ. ابوالنصر البغدادي'})</span>`;
        } else {
            statusEl.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5';
            statusEl.innerHTML = '<i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i><span>تم الصرف والتحويل البنكي</span>';
        }

        // Totals
        document.getElementById('payroll-sum-basic').innerText = formatCurrency(payroll.total_basic || 0);
        document.getElementById('payroll-sum-allowances').innerText = formatCurrency(payroll.total_allowances || 0);
        document.getElementById('payroll-sum-advances').innerText = formatCurrency(payroll.total_advances || payroll.total_deductions || 0);
        document.getElementById('payroll-sum-net').innerText = formatCurrency(payroll.total_net || 0);

        // Render table items
        const tbody = document.getElementById('hr-payroll-items-body');
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="p-6 text-center text-slate-400">لا توجد بنود مسجلة في هذا المسير</td></tr>';
        } else {
            tbody.innerHTML = items.map((it, idx) => {
                const totalExtraAllow = (parseFloat(it.housing_allowance) || 0) + (parseFloat(it.transport_allowance) || 0) + (parseFloat(it.other_allowances) || 0);
                const itAllowances = parseFloat(it.allowances !== undefined && it.allowances !== null ? it.allowances : totalExtraAllow) || 0;
                const itBonus = (parseFloat(it.bonus_amount || 0) + parseFloat(it.overtime_amount || 0));
                const itDeductions = parseFloat(it.deductions || 0);
                const itAdvances = parseFloat(it.advances_deducted !== undefined && it.advances_deducted !== null ? it.advances_deducted : (it.advances_deduction || 0)) || 0;
                const itIban = it.iban || it.bank_iban || 'غير مسجل';

                return `
                    <tr class="hover:bg-slate-800/50 transition">
                        <td class="p-3 text-slate-400 font-mono">${idx + 1}</td>
                        <td class="p-3 font-bold text-white font-sans">
                            <div>${it.employee_name}</div>
                            ${it.notes ? `<div class="text-[10px] text-amber-400 font-sans mt-0.5 flex items-center gap-1"><i data-lucide="info" class="w-3 h-3 flex-shrink-0"></i><span>${it.notes}</span></div>` : ''}
                        </td>
                        <td class="p-3 text-slate-300 font-sans">${it.job_title || '-'}</td>
                        <td class="p-3 font-mono">${formatCurrency(it.basic_salary)}</td>
                        <td class="p-3 font-mono">${formatCurrency(itAllowances)}</td>
                        <td class="p-3 font-mono">${itBonus > 0 ? `<span class="text-emerald-400 font-bold">+${formatCurrency(itBonus)}</span>` : '<span class="text-slate-500">-</span>'}</td>
                        <td class="p-3 font-mono">${itDeductions > 0 ? `<span class="text-rose-400 font-bold">-${formatCurrency(itDeductions)}</span>` : '<span class="text-slate-500">-</span>'}</td>
                        <td class="p-3 font-mono">${itAdvances > 0 ? `<span class="text-amber-400 font-bold">-${formatCurrency(itAdvances)}</span>` : '<span class="text-slate-500">-</span>'}</td>
                        <td class="p-3 font-black text-emerald-400 text-xs font-mono">${formatCurrency(it.net_salary)}</td>
                        <td class="p-3 text-slate-400 text-[10px] font-mono">${itIban}</td>
                        <td class="p-3 text-center">
                            ${payroll.status !== 'paid' ? `
                                <button type="button" onclick="openEditPayrollItemModal(${it.id})" class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 font-bold text-[11px] flex items-center gap-1 mx-auto transition" title="تعديل الراتب والبدلات والخصومات لهذا الموظف">
                                    <i data-lucide="edit-3" class="w-3 h-3"></i>
                                    <span>تعديل</span>
                                </button>
                            ` : `
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400">
                                    تم الصرف
                                </span>
                            `}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Actions Container
        const actContainer = document.getElementById('payroll-action-container');
        if (payroll.status === 'draft') {
            if (canApprove) {
                actContainer.innerHTML = `
                    <button type="button" onclick="updateHrPayrollStatus(${payroll.id}, 'approved')" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black flex items-center gap-2 shadow-lg shadow-blue-950/40 transition">
                        <i data-lucide="shield-check" class="w-4 h-4"></i>
                        <span>تعميد واعتماد المسير (المدير المالي)</span>
                    </button>
                `;
            } else {
                actContainer.innerHTML = `
                    <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-bold">
                        <i data-lucide="lock" class="w-4 h-4 text-amber-400 shrink-0"></i>
                        <span>المسير بانتظار تعميد المدير المالي (أ. ابوالنصر البغدادي). التعميد متاح حصرياً للمدير المالي.</span>
                    </div>
                `;
            }
        } else if (payroll.status === 'approved') {
            if (canApprove) {
                actContainer.innerHTML = `
                    <button type="button" onclick="updateHrPayrollStatus(${payroll.id}, 'paid')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition">
                        <i data-lucide="banknote" class="w-4 h-4"></i>
                        <span>تأكيد صرف الرواتب وخصم السلف</span>
                    </button>
                `;
            } else {
                actContainer.innerHTML = `
                    <span class="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <i data-lucide="shield-check" class="w-4 h-4 text-blue-400"></i>
                        <span>المسير معمد رسمياً من المدير المالي وهو قيد الصرف والتحويل البنكي</span>
                    </span>
                `;
            }
        } else {
            actContainer.innerHTML = `
                <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                    <span>تم صرف وتحويل هذا المسير لجميع الموظفين بنجاح</span>
                </span>
            `;
        }

        openModal('hr-payroll-detail-modal');
        initLucide();
    } catch (err) {
        console.error('Error viewing payroll details:', err);
        showToast('تعذر عرض تفاصيل المسير', 'error');
    }
}

async function updateHrPayrollStatus(id, newStatus) {
    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    
    if ((newStatus === 'approved' || newStatus === 'paid') && !isFinancialManagerUser()) {
        showToast('عفواً، تعميد مسير الرواتب هو صلاحية حصرية للمدير المالي (أ. ابوالنصر البغدادي).', 'error');
        return;
    }

    const label = newStatus === 'approved' ? 'تعميد مسير الرواتب بصفة المدير المالي' : 'تأكيد صرف الرواتب وخصم السلف';
    if (!confirm(`هل أنت متأكد من ${label}؟`)) return;

    try {
        const res = await fetch(`/api/hr/payrolls/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus,
                user_id: u.id,
                user_role: u.role,
                user_name: u.name,
                approved_by: u.name ? `${u.name} (المدير المالي)` : 'ابوالنصر البغدادي (المدير المالي)'
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم تحديث حالة المسير بنجاح', 'success');
            await loadHrData();
            if (document.getElementById('hr-payroll-detail-modal')?.classList.contains('hidden') === false) {
                await viewHrPayrollDetails(id);
            }
        } else {
            showToast(data.error || 'تعذر تحديث حالة المسير', 'error');
        }
    } catch (err) {
        console.error('Error updating payroll status:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

async function deleteHrPayroll(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المسير؟')) return;

    try {
        const res = await fetch(`/api/hr/payrolls/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم حذف المسير بنجاح', 'success');
            closeModal('hr-payroll-detail-modal');
            await loadHrData();
        } else {
            showToast(data.error || 'تعذر حذف المسير', 'error');
        }
    } catch (err) {
        console.error('Error deleting payroll:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

// ----------------- EDIT PAYROLL ITEM -----------------
function openEditPayrollItemModal(itemId) {
    if (!currentHrPayrollDetail) return;
    const items = currentHrPayrollDetail.items || currentHrPayrollDetail.payroll?.items || [];
    const item = items.find(it => it.id === itemId || String(it.id) === String(itemId));
    if (!item) {
        showToast('تعذر العثور على بيانات الموظف في هذا المسير', 'error');
        return;
    }

    document.getElementById('edit-payroll-item-id').value = item.id;
    document.getElementById('edit-payroll-emp-title').innerText = `الموظف: ${item.employee_name} (${item.job_title || 'موظف'})`;
    document.getElementById('edit-item-basic').value = item.basic_salary ?? 0;
    
    // Total allowances
    const allowances = item.allowances ?? (parseFloat(item.housing_allowance || 0) + parseFloat(item.transport_allowance || 0) + parseFloat(item.other_allowances || 0));
    document.getElementById('edit-item-allowances').value = allowances;
    
    // Overtime / Bonus
    const bonus = parseFloat(item.bonus_amount || 0) + parseFloat(item.overtime_amount || 0);
    document.getElementById('edit-item-bonus').value = bonus || 0;

    // Deductions
    document.getElementById('edit-item-deductions').value = item.deductions ?? 0;

    // Advances deducted
    document.getElementById('edit-item-advances').value = item.advances_deducted ?? 0;

    // Notes
    document.getElementById('edit-item-notes').value = item.notes || '';

    recalcEditItemNet();
    openModal('hr-edit-payroll-item-modal');
    initLucide();
}

function recalcEditItemNet() {
    const basic = parseFloat(document.getElementById('edit-item-basic')?.value || 0);
    const allowances = parseFloat(document.getElementById('edit-item-allowances')?.value || 0);
    const bonus = parseFloat(document.getElementById('edit-item-bonus')?.value || 0);
    const deductions = parseFloat(document.getElementById('edit-item-deductions')?.value || 0);
    const advances = parseFloat(document.getElementById('edit-item-advances')?.value || 0);

    const earnings = basic + allowances + bonus;
    const totalDeductions = deductions + advances;
    const net = Math.round((earnings - totalDeductions) * 100) / 100;

    const earnEl = document.getElementById('edit-preview-earnings');
    const dedEl = document.getElementById('edit-preview-deductions');
    const netEl = document.getElementById('edit-preview-net');

    if (earnEl) earnEl.innerText = formatCurrency(earnings);
    if (dedEl) dedEl.innerText = formatCurrency(totalDeductions);
    if (netEl) {
        netEl.innerText = formatCurrency(net);
        if (net < 0) {
            netEl.className = 'font-mono font-black text-base text-rose-500';
        } else {
            netEl.className = 'font-mono font-black text-base text-emerald-400';
        }
    }
}

async function submitEditPayrollItem(event) {
    if (event) event.preventDefault();

    const itemId = document.getElementById('edit-payroll-item-id')?.value;
    if (!itemId) return;

    const btn = document.getElementById('btn-submit-payroll-item-edit');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-70');
    }

    const payload = {
        basic_salary: parseFloat(document.getElementById('edit-item-basic')?.value || 0),
        allowances: parseFloat(document.getElementById('edit-item-allowances')?.value || 0),
        bonus_amount: parseFloat(document.getElementById('edit-item-bonus')?.value || 0),
        overtime_amount: 0,
        deductions: parseFloat(document.getElementById('edit-item-deductions')?.value || 0),
        advances_deducted: parseFloat(document.getElementById('edit-item-advances')?.value || 0),
        notes: document.getElementById('edit-item-notes')?.value?.trim() || ''
    };

    try {
        const res = await fetch(`/api/hr/payroll-items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showToast(data.message || 'تم تحديث راتب الموظف وإعادة احتساب المسير بنجاح', 'success');
            closeModal('hr-edit-payroll-item-modal');
            
            // Reload payroll modal details
            const pId = currentHrPayrollDetail?.id || currentHrPayrollDetail?.payroll?.id;
            if (pId) {
                await viewHrPayrollDetails(pId);
            }
            // Also refresh overall payrolls list and HR dashboard
            await loadHrPayrolls();
            await loadHrStats();
        } else {
            showToast(data.error || 'حدث خطأ أثناء حفظ التعديل', 'error');
        }
    } catch (err) {
        console.error('Error updating payroll item:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70');
        }
    }
}

// ----------------- LEAVES & TIME OFF -----------------
async function loadHrLeaves() {
    try {
        const res = await fetch('/api/hr/leaves');
        const list = await res.json();
        hrLeavesData = Array.isArray(list) ? list : [];
        renderHrLeaves();
    } catch (err) {
        console.error('Error loading leaves:', err);
    }
}

function renderHrLeaves() {
    const tbody = document.getElementById('hr-leaves-table-body');
    if (!tbody) return;

    if (hrLeavesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">لا توجد إجازات مسجلة حالياً</td></tr>';
        return;
    }

    tbody.innerHTML = hrLeavesData.map(l => `
        <tr class="hover:bg-slate-800/40 transition">
            <td class="p-3.5 font-bold text-white font-sans">${l.employee_name}</td>
            <td class="p-3.5"><span class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">${l.leave_type}</span></td>
            <td class="p-3.5 font-mono">${l.start_date}</td>
            <td class="p-3.5 font-mono">${l.end_date}</td>
            <td class="p-3.5 text-center font-mono font-bold text-amber-400">${l.days_count} يوم</td>
            <td class="p-3.5">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${l.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}">
                    ${l.status === 'approved' ? 'معتمدة' : l.status}
                </span>
            </td>
            <td class="p-3.5 text-slate-400 font-sans">${l.notes || '-'}</td>
            <td class="p-3.5 text-center">
                <button type="button" onclick="deleteHrLeave(${l.id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="حذف طلب الإجازة">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </td>
        </tr>
    `).join('');

    initLucide();
}

function openAddLeaveModal() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('leave-start-date').value = today;
    document.getElementById('leave-end-date').value = today;
    document.getElementById('leave-days-count').value = '1';
    document.getElementById('leave-notes').value = '';
    openModal('hr-leave-modal');
}

function calculateLeaveDays() {
    const startVal = document.getElementById('leave-start-date').value;
    const endVal = document.getElementById('leave-end-date').value;
    if (startVal && endVal) {
        const d1 = new Date(startVal);
        const d2 = new Date(endVal);
        const diffMs = d2 - d1;
        const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
        document.getElementById('leave-days-count').value = diffDays;
    }
}

async function submitHrLeaveForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-leave');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-70');
    }

    const payload = {
        employee_id: parseInt(document.getElementById('leave-emp-select').value),
        leave_type: document.getElementById('leave-type').value,
        start_date: document.getElementById('leave-start-date').value,
        end_date: document.getElementById('leave-end-date').value,
        days_count: parseInt(document.getElementById('leave-days-count').value) || 1,
        notes: document.getElementById('leave-notes').value.trim()
    };

    try {
        const res = await fetch('/api/hr/leaves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم تسجيل الإجازة واعتمادها بنجاح', 'success');
            closeModal('hr-leave-modal');
            await loadHrData();
        } else {
            showToast(data.error || 'حدث خطأ في تسجيل الإجازة', 'error');
        }
    } catch (err) {
        console.error('Error adding leave:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70');
        }
    }
}

async function deleteHrLeave(id) {
    if (!confirm('هل أنت متأكد من حذف سجل هذه الإجازة واستعادة رصيد الأيام للموظف؟')) return;

    try {
        const res = await fetch(`/api/hr/leaves/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم حذف الإجازة بنجاح', 'success');
            await loadHrData();
        } else {
            showToast(data.error || 'تعذر حذف الإجازة', 'error');
        }
    } catch (err) {
        console.error('Error deleting leave:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

// ----------------- ADVANCES & LOANS -----------------
async function loadHrAdvances() {
    try {
        const res = await fetch('/api/hr/advances');
        const list = await res.json();
        hrAdvancesData = Array.isArray(list) ? list : [];
        renderHrAdvances();
    } catch (err) {
        console.error('Error loading advances:', err);
    }
}

function renderHrAdvances() {
    const tbody = document.getElementById('hr-advances-table-body');
    if (!tbody) return;

    if (hrAdvancesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">لا توجد سلف نشطة حالياً</td></tr>';
        return;
    }

    tbody.innerHTML = hrAdvancesData.map(a => `
        <tr class="hover:bg-slate-800/40 transition">
            <td class="p-3.5 font-bold text-white font-sans">${a.employee_name}</td>
            <td class="p-3.5 font-black text-white font-mono">${formatCurrency(a.amount)}</td>
            <td class="p-3.5 font-mono text-slate-300">${a.request_date || a.advance_date || ''}</td>
            <td class="p-3.5 font-mono text-amber-400 font-bold">${formatCurrency(a.monthly_deduction)}</td>
            <td class="p-3.5 font-mono text-emerald-400">${formatCurrency(a.paid_amount || 0)}</td>
            <td class="p-3.5 font-mono text-rose-400 font-black">${formatCurrency(a.remaining_amount || 0)}</td>
            <td class="p-3.5">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === 'active' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}">
                    ${a.status === 'active' ? 'قيد السداد' : 'تم السداد'}
                </span>
            </td>
            <td class="p-3.5 text-center">
                <button type="button" onclick="deleteHrAdvance(${a.id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="حذف السلفة">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </td>
        </tr>
    `).join('');

    initLucide();
}

function openAddAdvanceModal() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('adv-date').value = today;
    document.getElementById('adv-amount').value = '';
    document.getElementById('adv-monthly-deduction').value = '';
    document.getElementById('adv-notes').value = '';
    openModal('hr-advance-modal');
}

async function submitHrAdvanceForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-advance');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-70');
    }

    const payload = {
        employee_id: parseInt(document.getElementById('adv-emp-select').value),
        amount: parseFloat(document.getElementById('adv-amount').value) || 0,
        monthly_deduction: parseFloat(document.getElementById('adv-monthly-deduction').value) || 0,
        advance_date: document.getElementById('adv-date').value || null,
        notes: document.getElementById('adv-notes').value.trim()
    };

    try {
        const res = await fetch('/api/hr/advances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم صرف السلفة وجدولتها بنجاح', 'success');
            closeModal('hr-advance-modal');
            await loadHrData();
        } else {
            showToast(data.error || 'حدث خطأ في صرف السلفة', 'error');
        }
    } catch (err) {
        console.error('Error adding advance:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70');
        }
    }
}

async function deleteHrAdvance(id) {
    if (!confirm('هل أنت متأكد من حذف هذه السلفة نهائياً؟')) return;

    try {
        const res = await fetch(`/api/hr/advances/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم حذف السلفة بنجاح', 'success');
            await loadHrData();
        } else {
            showToast(data.error || 'تعذر حذف السلفة', 'error');
        }
    } catch (err) {
        console.error('Error deleting advance:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

// ----------------- EXPIRATIONS & COMPLIANCE -----------------
async function loadHrExpirations() {
    try {
        const res = await fetch('/api/hr/expirations');
        const list = await res.json();
        hrExpirationsData = Array.isArray(list) ? list : [];
        renderHrExpirations();
    } catch (err) {
        console.error('Error loading expirations:', err);
    }
}

function renderHrExpirations() {
    const container = document.getElementById('hr-expirations-list');
    if (!container) return;

    if (hrExpirationsData.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-8 text-center bg-slate-850 rounded-2xl border border-slate-750 text-slate-400">
                <i data-lucide="check-circle" class="w-10 h-10 mx-auto mb-2 text-emerald-400"></i>
                <p class="font-bold text-sm text-emerald-300">جميع الوثائق والإقامات سارية المفعول لأكثر من 60 يوماً</p>
                <p class="text-xs text-slate-400 mt-1">لا توجد أي وثيقة تحتاج إلى تجديد عاجل حالياً.</p>
            </div>
        `;
        initLucide();
        return;
    }

    const html = hrExpirationsData.map(doc => {
        let urgencyBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">متبقي ' + doc.days_left + ' يوم</span>';
        let cardBorder = 'border-slate-750 hover:border-slate-650';

        if (doc.urgency === 'critical') {
            urgencyBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">حرجة: متبقي ' + doc.days_left + ' يوم</span>';
            cardBorder = 'border-rose-900/40 bg-gradient-to-br from-rose-950/20 via-slate-850 to-slate-850 hover:border-rose-500/50';
        } else if (doc.urgency === 'warning') {
            urgencyBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">تحذير: متبقي ' + doc.days_left + ' يوم</span>';
            cardBorder = 'border-amber-900/30 bg-gradient-to-br from-amber-950/15 via-slate-850 to-slate-850 hover:border-amber-500/50';
        }

        return `
            <div class="rounded-2xl border ${cardBorder} p-4 shadow-lg space-y-3 transition">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="p-2 rounded-xl bg-slate-800 text-slate-300 shrink-0">
                            <i data-lucide="clock" class="w-4 h-4"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-xs text-white truncate">${doc.employee_name}</h4>
                            <span class="text-[10px] text-slate-400 block">${doc.job_title} (${doc.department || 'عام'})</span>
                        </div>
                    </div>
                    ${urgencyBadge}
                </div>

                <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
                    <span class="text-slate-400 font-medium">${doc.doc_type}</span>
                    <span class="font-bold font-mono text-white">${doc.expiry_date}</span>
                </div>

                <div class="flex items-center justify-between text-[11px] pt-1">
                    <span class="text-slate-400">${doc.phone ? 'جوال: ' + doc.phone : ''}</span>
                    <button type="button" onclick="openEditHrEmployeeModal(${doc.employee_id})" class="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition">
                        <span>تحديث التاريخ</span>
                        <i data-lucide="external-link" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    initLucide();
}

// ----------------- END OF SERVICE CALCULATOR -----------------
function onEosEmployeeSelected() {
    const empId = document.getElementById('eos-emp-select').value;
    if (!empId) return;

    const emp = hrEmployeesData.find(e => e.id == empId);
    if (!emp) return;

    // Fill salary
    document.getElementById('eos-basic-salary').value = emp.basic_salary || 0;
    const allowances = (parseFloat(emp.housing_allowance) || 0) + (parseFloat(emp.transport_allowance) || 0) + (parseFloat(emp.other_allowances || emp.other_allowance || 0));
    document.getElementById('eos-allowances').value = allowances;

    // Calculate duration from join_date
    if (emp.join_date) {
        const join = new Date(emp.join_date);
        const today = new Date();
        if (today > join) {
            let years = today.getFullYear() - join.getFullYear();
            let months = today.getMonth() - join.getMonth();
            let days = today.getDate() - join.getDate();

            if (days < 0) {
                months -= 1;
                days += 30;
            }
            if (months < 0) {
                years -= 1;
                months += 12;
            }

            document.getElementById('eos-years').value = Math.max(0, years);
            document.getElementById('eos-months').value = Math.max(0, months);
            document.getElementById('eos-days').value = Math.max(0, days);
        }
    }

    calculateEosDirectly();
}

async function calculateEosDirectly() {
    const basicSalary = parseFloat(document.getElementById('eos-basic-salary').value) || 0;
    const allowances = parseFloat(document.getElementById('eos-allowances').value) || 0;
    const years = parseFloat(document.getElementById('eos-years').value) || 0;
    const months = parseFloat(document.getElementById('eos-months').value) || 0;
    const days = parseFloat(document.getElementById('eos-days').value) || 0;
    const contractType = document.getElementById('eos-contract-type').value;
    const reason = document.getElementById('eos-reason').value;

    if (basicSalary <= 0 && allowances <= 0) {
        showToast('يرجى إدخال الراتب الأساسي لحساب نهاية الخدمة', 'warning');
        return;
    }

    try {
        const res = await fetch('/api/hr/eos-calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                basic_salary: basicSalary,
                allowances: allowances,
                years: years,
                months: months,
                days: days,
                contract_type: contractType,
                reason: reason
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            const elRes = document.getElementById('eos-result-amount');
            if (elRes) elRes.innerText = Number(data.final_eos_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const elMult = document.getElementById('eos-multiplier-badge');
            if (elMult) elMult.innerText = `${Math.round(data.multiplier * 100)}% استحقاق (${data.reduction_note})`;
            const elNote = document.getElementById('eos-reduction-note');
            if (elNote) elNote.innerText = `تم احتساب المستحقات بناءً على راتب أساسي وبدلات قدرها ${formatCurrency(data.total_salary)} ومدة خدمة ${data.total_years_fraction} سنة وفق المادتين 84 و 85 من نظام العمل السعودي.`;

            const elWage = document.getElementById('eos-display-wage') || document.getElementById('eos-base-salary-display');
            if (elWage) elWage.innerText = formatCurrency(data.total_salary);
            const elServ = document.getElementById('eos-display-service') || document.getElementById('eos-years-display');
            if (elServ) elServ.innerText = `${data.total_years_fraction} سنة`;
            const elF5 = document.getElementById('eos-display-first5') || document.getElementById('eos-step1-amount');
            if (elF5) elF5.innerText = formatCurrency(data.first_5_years_amount);
            const elB5 = document.getElementById('eos-display-beyond5') || document.getElementById('eos-step2-amount');
            if (elB5) elB5.innerText = formatCurrency(data.after_5_years_amount);
        } else {
            showToast(data.error || 'تعذر حساب مكافأة نهاية الخدمة', 'error');
        }
    } catch (err) {
        console.error('Error calculating EOS:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
}


// ==========================================
// EXPENSE REQUESTS MODULE (طلبات الصرف والمصاريف للموظفين والموردين والمقاولين)
// ==========================================

let currentExpensesActiveSubtab = 'invoices';
let currentExpenseRequests = [];
let currentExpenseRequestStatusFilter = '';
let currentViewedExpenseRequest = null;
let cachedSuppliersList = null;
let cachedSubcontractorsList = null;

function switchExpensesSubtab(subtab) {
    currentExpensesActiveSubtab = subtab;
    const btnInvoices = document.getElementById('subtab-btn-expenses-invoices');
    const btnRequests = document.getElementById('subtab-btn-expenses-requests');
    const contentInvoices = document.getElementById('subtab-content-expenses-invoices');
    const contentRequests = document.getElementById('subtab-content-expenses-requests');

    if (subtab === 'requests') {
        if (btnRequests) {
            btnRequests.className = 'flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all bg-amber-600 text-white shadow-lg shadow-amber-950/40';
        }
        if (btnInvoices) {
            btnInvoices.className = 'flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-750';
        }
        if (contentInvoices) contentInvoices.classList.add('hidden');
        if (contentRequests) contentRequests.classList.remove('hidden');
        loadExpenseRequests();
        populateExpenseRequestDropdowns();
    } else {
        if (btnInvoices) {
            btnInvoices.className = 'flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all bg-emerald-600 text-white shadow-lg shadow-emerald-950/40';
        }
        if (btnRequests) {
            btnRequests.className = 'flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-750';
        }
        if (contentRequests) contentRequests.classList.add('hidden');
        if (contentInvoices) contentInvoices.classList.remove('hidden');
        loadExpenses();
    }
    initLucide();
}

async function populateExpenseRequestDropdowns() {
    // 1. Projects dropdowns
    const projs = allProjectsList || [];
    const projSelects = ['req-project-id', 'req-filter-project'];
    projSelects.forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const curVal = sel.value;
        let html = selId === 'req-filter-project' ? '<option value="">جميع المشاريع</option>' : '<option value="">مصروف عام / إداري (بدون مشروع)</option>';
        projs.forEach(p => {
            html += `<option value="${p.id}" ${String(curVal) === String(p.id) ? 'selected' : ''}>${escapeHtml(p.name)} (${p.code || 'PRJ'})</option>`;
        });
        sel.innerHTML = html;
    });

    // 2. Default requester name and date
    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    const reqNameInput = document.getElementById('req-requester-name');
    if (reqNameInput && !reqNameInput.value) {
        reqNameInput.value = u.name || '';
    }
    const dateInput = document.getElementById('req-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // 3. Populate beneficiary select
    handleBeneficiaryTypeChange();
}

async function handleBeneficiaryTypeChange() {
    const type = document.getElementById('req-beneficiary-type')?.value || 'عام';
    const wrapper = document.getElementById('req-beneficiary-select-wrapper');
    const select = document.getElementById('req-beneficiary-select');
    const label = document.getElementById('req-beneficiary-select-label');
    const nameInput = document.getElementById('req-beneficiary-name');
    const categorySelect = document.getElementById('req-category');
    const purposeTextarea = document.getElementById('req-purpose');

    if (!wrapper || !select) return;

    if (type === 'مورد') {
        wrapper.classList.remove('hidden');
        if (label) label.innerText = 'اختر المورد من القائمة:';
        if (categorySelect) categorySelect.value = 'مواد بناء';
        if (purposeTextarea && !purposeTextarea.value) {
            purposeTextarea.placeholder = 'مثال: دفعة توريد حديد تسليح، فاتورة خرسانة جاهزة، شراء مواد سباكة...';
        }

        // Fetch suppliers if not cached
        if (!cachedSuppliersList) {
            try {
                const res = await fetch('/api/suppliers');
                cachedSuppliersList = await res.json();
            } catch (e) {
                cachedSuppliersList = [];
            }
        }
        let opts = '<option value="">-- اختر المورد --</option>';
        (cachedSuppliersList || []).forEach(s => {
            opts += `<option value="${s.id}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)} ${s.company_name ? '(' + escapeHtml(s.company_name) + ')' : ''}</option>`;
        });
        opts += '<option value="__manual__">➕ مورد آخر (كتابة يدوية)</option>';
        select.innerHTML = opts;

    } else if (type === 'مقاول') {
        wrapper.classList.remove('hidden');
        if (label) label.innerText = 'اختر مقاول الباطن من القائمة:';
        if (categorySelect) categorySelect.value = 'عمالة ومقاولين باطن';
        if (purposeTextarea && !purposeTextarea.value) {
            purposeTextarea.placeholder = 'مثال: مستخلص الدفعة الثانية لأعمال اللياسة، مصنعيات دهانات الدور الأول...';
        }

        // Fetch subcontractors if not cached
        if (!cachedSubcontractorsList) {
            try {
                const res = await fetch('/api/subcontractors');
                cachedSubcontractorsList = await res.json();
            } catch (e) {
                cachedSubcontractorsList = [];
            }
        }
        let opts = '<option value="">-- اختر مقاول الباطن --</option>';
        (cachedSubcontractorsList || []).forEach(sub => {
            opts += `<option value="${sub.id}" data-name="${escapeHtml(sub.name)}">${escapeHtml(sub.name)} ${sub.trade ? '(' + escapeHtml(sub.trade) + ')' : ''}</option>`;
        });
        opts += '<option value="__manual__">➕ مقاول آخر (كتابة يدوية)</option>';
        select.innerHTML = opts;

    } else if (type === 'موظف') {
        wrapper.classList.remove('hidden');
        if (label) label.innerText = 'اختر الموظف / المهندس:';
        if (categorySelect) categorySelect.value = 'نثريات وإداريات';
        if (purposeTextarea && !purposeTextarea.value) {
            purposeTextarea.placeholder = 'مثال: عهدة سريعة لشراء نثريات الموقع، سلفة مؤقتة، مصاريف إنجاز معاملة...';
        }

        let opts = '<option value="">-- اختر الموظف --</option>';
        const members = (typeof teamMembers !== 'undefined' && teamMembers) ? teamMembers : [];
        members.forEach(m => {
            opts += `<option value="${m.id}" data-name="${escapeHtml(m.name)}">${escapeHtml(m.name)} (${escapeHtml(m.role || 'عضو')})</option>`;
        });
        opts += '<option value="__manual__">➕ موظف آخر (كتابة يدوية)</option>';
        select.innerHTML = opts;

    } else {
        // عام / أخرى
        wrapper.classList.add('hidden');
        if (categorySelect) categorySelect.value = 'نثريات وإداريات';
        if (purposeTextarea && !purposeTextarea.value) {
            purposeTextarea.placeholder = 'مثال: سداد رسوم رخصة البناء، إيجار معدة دكاكة، صيانة سيارة الموقع...';
        }
        if (nameInput) {
            nameInput.focus();
        }
    }
}

function handleBeneficiarySelectChange() {
    const select = document.getElementById('req-beneficiary-select');
    const nameInput = document.getElementById('req-beneficiary-name');
    if (!select || !nameInput) return;

    const selectedOpt = select.options[select.selectedIndex];
    if (selectedOpt && selectedOpt.value && selectedOpt.value !== '__manual__') {
        nameInput.value = selectedOpt.getAttribute('data-name') || selectedOpt.text;
    } else if (selectedOpt && selectedOpt.value === '__manual__') {
        nameInput.value = '';
        nameInput.placeholder = 'اكتب اسم الجهة أو المستفيد هنا...';
        nameInput.focus();
    }
}

function setExpenseRequestStatusFilter(status) {
    currentExpenseRequestStatusFilter = status;
    document.querySelectorAll('.req-filter-btn').forEach(btn => {
        btn.classList.remove('bg-amber-500/20', 'text-amber-400');
        btn.classList.add('text-slate-400');
    });
    const activeBtn = document.getElementById(`req-filter-${status || 'all'}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-amber-500/20', 'text-amber-400');
        activeBtn.classList.remove('text-slate-400');
    }
    loadExpenseRequests();
}

async function loadExpenseRequests() {
    const status = currentExpenseRequestStatusFilter || '';
    const bType = document.getElementById('req-filter-beneficiary-type')?.value || '';
    const projId = document.getElementById('req-filter-project')?.value || '';
    const search = document.getElementById('req-search-input')?.value || '';

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');

    let url = `/api/expense-requests?`;
    if (u && u.id) url += `user_id=${encodeURIComponent(u.id)}&`;
    if (u && u.role) url += `user_role=${encodeURIComponent(u.role)}&`;
    if (u && u.name) url += `user_name=${encodeURIComponent(u.name)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;
    if (bType) url += `beneficiary_type=${encodeURIComponent(bType)}&`;
    if (projId) url += `project_id=${encodeURIComponent(projId)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        let requests = data.requests || [];

        // Client-side guard: Only show user's own requests unless General Manager or Financial Manager
        if (!canUserSeeAllExpenses() && u && u.name) {
            const myName = u.name.trim().toLowerCase();
            const myId = String(u.id || '');
            requests = requests.filter(r => {
                const reqId = String(r.requester_id || '');
                const reqName = (r.requester_name || '').toLowerCase();
                const benName = (r.beneficiary_name || '').toLowerCase();
                const aName = (r.assigned_disburser_name || '').toLowerCase();
                const aId = String(r.assigned_disburser_id || '');
                return (myId && (reqId === myId || aId === myId)) ||
                       reqName.includes(myName) || benName.includes(myName) || aName.includes(myName);
            });
        }

        currentExpenseRequests = requests;
        const summary = data.summary || {};

        // Update KPIs
        const elPendingSum = document.getElementById('req-kpi-pending-sum');
        if (elPendingSum) elPendingSum.innerText = formatCurrency(summary.pending_amount || 0);
        const elPendingCount = document.getElementById('req-kpi-pending-count');
        if (elPendingCount) elPendingCount.innerText = `${summary.pending_count || 0} طلب معلق`;

        const elApprovedSum = document.getElementById('req-kpi-approved-sum');
        if (elApprovedSum) elApprovedSum.innerText = formatCurrency(summary.approved_amount || 0);
        const elApprovedCount = document.getElementById('req-kpi-approved-count');
        if (elApprovedCount) elApprovedCount.innerText = `${summary.approved_count || 0} طلب جاهز للصرف`;

        const elDisbursedSum = document.getElementById('req-kpi-disbursed-sum');
        if (elDisbursedSum) elDisbursedSum.innerText = formatCurrency(summary.disbursed_amount || 0);
        const elDisbursedCount = document.getElementById('req-kpi-disbursed-count');
        if (elDisbursedCount) elDisbursedCount.innerText = `${summary.disbursed_count || 0} طلب مصروف ومرحل`;

        const elRejectedCount = document.getElementById('req-kpi-rejected-count');
        if (elRejectedCount) elRejectedCount.innerText = String(summary.rejected_count || 0);

        // Filter Counts
        const cAll = document.getElementById('req-count-all');
        if (cAll) cAll.innerText = summary.total_count || 0;
        const cPending = document.getElementById('req-count-pending');
        if (cPending) cPending.innerText = summary.pending_count || 0;
        const cApproved = document.getElementById('req-count-approved');
        if (cApproved) cApproved.innerText = summary.approved_count || 0;
        const cDisbursed = document.getElementById('req-count-disbursed');
        if (cDisbursed) cDisbursed.innerText = summary.disbursed_count || 0;
        const cRejected = document.getElementById('req-count-rejected');
        if (cRejected) cRejected.innerText = summary.rejected_count || 0;

        // Header Pending Badge
        const headerBadge = document.getElementById('badge-expense-requests-pending');
        if (headerBadge) {
            const pCount = summary.pending_count || 0;
            if (pCount > 0) {
                headerBadge.innerText = `${pCount} معلق`;
                headerBadge.classList.remove('hidden');
            } else {
                headerBadge.classList.add('hidden');
            }
        }

        // Role Banner
        const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
        const userBadge = document.getElementById('expense-req-user-badge');
        const permDesc = document.getElementById('expense-req-permission-desc');
        if (userBadge) userBadge.innerText = `${u.name || 'مستخدم'} (${u.role || 'عضو'})`;
        if (permDesc) {
            if (isFinancialManagerUser()) {
                permDesc.innerText = 'تملك صلاحية التعميد والصرف الفعلي لطلبات المصاريف';
                permDesc.className = 'text-emerald-400 font-semibold';
            } else {
                permDesc.innerText = 'يمكنك تقديم طلبات الصرف ومتابعة تعميدها وصرفها من المدير المالي';
                permDesc.className = 'text-amber-400 font-semibold';
            }
        }

        // Populate Assigned Disburser Filter Dropdown
        const assignedSel = document.getElementById('req-filter-assigned');
        if (assignedSel) {
            const currentVal = assignedSel.value;
            const uniqueAssigned = Array.from(new Set(currentExpenseRequests.map(r => r.assigned_disburser_name).filter(Boolean)));
            assignedSel.innerHTML = '<option value="">جميع المكلفين بالصرف</option>';
            uniqueAssigned.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.innerText = `👤 ${name}`;
                if (name === currentVal) opt.selected = true;
                assignedSel.appendChild(opt);
            });
        }

        renderExpenseRequestsTable(currentExpenseRequests);
    } catch (err) {
        console.error('Error loading expense requests:', err);
    }
}

function applyExpenseRequestFilters() {
    const search = (document.getElementById('req-search-input')?.value || '').trim().toLowerCase();
    const assignedFilter = (document.getElementById('req-filter-assigned')?.value || '').trim();

    let filtered = currentExpenseRequests;
    if (assignedFilter) {
        filtered = filtered.filter(r => (r.assigned_disburser_name || '').includes(assignedFilter));
    }
    if (search) {
        filtered = filtered.filter(r => {
            return (r.request_number || '').toLowerCase().includes(search) ||
                   (r.beneficiary_name || '').toLowerCase().includes(search) ||
                   (r.requester_name || '').toLowerCase().includes(search) ||
                   (r.purpose || '').toLowerCase().includes(search) ||
                   (r.assigned_disburser_name || '').toLowerCase().includes(search) ||
                   (r.project_name || '').toLowerCase().includes(search);
        });
    }
    renderExpenseRequestsTable(filtered);
}

function renderExpenseRequestsTable(requests) {
    const tbody = document.getElementById('expense-requests-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isFinManager = isFinancialManagerUser();
    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');

    if (!requests || requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center py-12 text-slate-500">
                    <div class="flex flex-col items-center gap-2">
                        <i data-lucide="inbox" class="w-8 h-8 text-slate-600"></i>
                        <span class="text-sm font-semibold">لا توجد طلبات صرف مطابقة للفلاتر المحددة</span>
                        <p class="text-[11px] text-slate-600">يمكنك الضغط على زر "رفع طلب صرف جديد" لإنشاء طلب لمورد أو مقاول أو موظف.</p>
                    </div>
                </td>
            </tr>
        `;
        initLucide();
        return;
    }

    requests.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition duration-150';

        // Beneficiary Type Icon & Badge
        let bIcon = 'building';
        let bColor = 'text-slate-400 bg-slate-800 border-slate-700';
        if (r.beneficiary_type === 'مورد') {
            bIcon = 'truck';
            bColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        } else if (r.beneficiary_type === 'مقاول') {
            bIcon = 'hard-hat';
            bColor = 'text-blue-400 bg-blue-500/10 border-blue-500/30';
        } else if (r.beneficiary_type === 'موظف') {
            bIcon = 'user';
            bColor = 'text-purple-400 bg-purple-500/10 border-purple-500/30';
        }

        // Priority Badge
        let pBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">عادي</span>';
        if (r.priority === 'عاجل') {
            pBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚡ عاجل</span>';
        } else if (r.priority === 'طارئ') {
            pBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">🚨 طارئ</span>';
        }

        // Check if current user is the assigned disburser (e.g. Nawaf)
        const isAssignedToCurrentUser = (u.id && r.assigned_disburser_id && String(u.id) === String(r.assigned_disburser_id)) ||
                                        (u.name && r.assigned_disburser_name && (r.assigned_disburser_name.includes(u.name) || u.name.includes(r.assigned_disburser_name)));

        // Disburser Assignment Badge / Status
        let disburserHtml = '';
        if (r.assigned_disburser_name) {
            const canDisburseReq = (r.status === 'approved') && (isFinManager || isAssignedToCurrentUser);
            disburserHtml = `
                <div class="inline-flex flex-col items-center gap-1">
                    <div class="inline-flex items-center gap-1.5 flex-wrap justify-center">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <i data-lucide="send" class="w-3 h-3 text-amber-400"></i>
                            <span>${escapeHtml(r.assigned_disburser_name)}</span>
                        </span>
                        ${canDisburseReq ? `
                            <button type="button" onclick="openDisburseExpenseRequestModal(${r.id})" title="تنفيذ الصرف وتأكيد السداد" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow transition animate-pulse hover:animate-none">
                                <i data-lucide="wallet" class="w-3 h-3"></i>
                                <span>صرف 💵</span>
                            </button>
                        ` : ''}
                    </div>
                    <span class="text-[9px] text-slate-400 truncate max-w-[120px]" title="${escapeHtml(r.disbursement_source || '')}">${escapeHtml(r.disbursement_source || 'عهدة / كاش')}</span>
                </div>
            `;
        } else if (r.status === 'disbursed') {
            disburserHtml = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                    <i data-lucide="check" class="w-3 h-3"></i>
                    <span>${escapeHtml(r.disbursed_by || 'الخزينة')}</span>
                </span>
            `;
        } else if (r.status === 'approved') {
            disburserHtml = `<span class="text-amber-400/80 text-[10px] font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">الخزينة / بانتظار الصرف</span>`;
        } else {
            disburserHtml = `<span class="text-slate-500 text-[11px]">-</span>`;
        }

        // Status Badge
        let statusBadge = '';
        if (r.status === 'pending') {
            statusBadge = `
                <div class="inline-flex flex-col items-center">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        <span>بانتظار التعميد</span>
                    </span>
                    <span class="text-[9px] text-slate-500 mt-0.5">المدير المالي</span>
                </div>
            `;
        } else if (r.status === 'approved') {
            statusBadge = `
                <div class="inline-flex flex-col items-center">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        <i data-lucide="shield-check" class="w-3 h-3"></i>
                        <span>معمد (جاهز للصرف)</span>
                    </span>
                    <span class="text-[9px] text-blue-400/80 mt-0.5 truncate max-w-[120px]" title="${escapeHtml(r.approved_by || '')}">عُمّد: ${escapeHtml(r.approved_by || 'المدير المالي')}</span>
                </div>
            `;
        } else if (r.status === 'disbursed') {
            statusBadge = `
                <div class="inline-flex flex-col items-center">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <i data-lucide="check-circle-2" class="w-3 h-3"></i>
                        <span>تم الصرف (مرحل)</span>
                    </span>
                    <span class="text-[9px] text-emerald-400/80 mt-0.5">${escapeHtml(r.disbursed_date || '')}</span>
                </div>
            `;
        } else if (r.status === 'rejected') {
            statusBadge = `
                <div class="inline-flex flex-col items-center">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <i data-lucide="x-circle" class="w-3 h-3"></i>
                        <span>مرفوض</span>
                    </span>
                    <span class="text-[9px] text-rose-400/80 mt-0.5 truncate max-w-[120px]" title="${escapeHtml(r.approval_notes || '')}">${escapeHtml(r.approval_notes || 'مرفوض')}</span>
                </div>
            `;
        }

        // Attachment Link
        let attachLink = '<span class="text-slate-600">-</span>';
        if (r.attachment_path) {
            attachLink = `
                <a href="${r.attachment_path}" target="_blank" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-indigo-300 transition text-[11px] font-bold" title="عرض المرفق المبدئي">
                    <i data-lucide="paperclip" class="w-3 h-3"></i>
                    <span>مستند</span>
                </a>
            `;
        }

        // Action Buttons
        let actionsHtml = `<div class="flex items-center justify-center gap-1.5 flex-wrap">`;
        actionsHtml += `
            <button onclick="viewExpenseRequestDetails(${r.id})" class="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white transition" title="عرض كافة التفاصيل">
                <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
        `;

        if (r.status === 'pending') {
            if (isFinManager) {
                actionsHtml += `
                    <button onclick="openExpenseRequestApprovalModal(${r.id}, 'approve')" class="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 shadow transition" title="تعميد وتوجيه أمر الصرف">
                        <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
                        <span>تعميد وتوجيه</span>
                    </button>
                    <button onclick="rejectExpenseRequest(${r.id})" class="px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition" title="رفض الطلب">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                `;
            }
        } else if (r.status === 'approved') {
            // Disburse button for Financial Manager or Assigned Disburser (Nawaf)
            if (isFinManager || isAssignedToCurrentUser) {
                actionsHtml += `
                    <button onclick="openDisburseExpenseRequestModal(${r.id})" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[11px] flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition animate-bounce-subtle" title="تسجيل الصرف والخصم المالي الفوري">
                        <i data-lucide="wallet" class="w-3.5 h-3.5"></i>
                        <span>💵 صرف المبلغ</span>
                    </button>
                `;
            }
            if (isFinManager) {
                actionsHtml += `
                    <button onclick="openExpenseRequestApprovalModal(${r.id}, 'assign_only')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-400 hover:text-amber-300 transition" title="توجيه أو تغيير المكلف بالصرف">
                        <i data-lucide="send" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="rejectExpenseRequest(${r.id})" class="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="إلغاء الاعتماد">
                        <i data-lucide="undo-2" class="w-3.5 h-3.5"></i>
                    </button>
                `;
            }
        } else if (r.status === 'disbursed' && r.generated_expense_id) {
            actionsHtml += `
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20" title="تم ترحيله إلى المصروفات برقم فاتورة #${r.generated_expense_id}">
                    <i data-lucide="receipt" class="w-3 h-3"></i>
                    <span>فاتورة #${r.generated_expense_id}</span>
                </span>
            `;
        }

        // Delete button for pending
        if ((isFinManager || (u.id && r.requester_id === u.id)) && r.status === 'pending') {
            actionsHtml += `
                <button onclick="deleteExpenseRequest(${r.id})" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition" title="حذف الطلب">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            `;
        }

        actionsHtml += `</div>`;

        tr.innerHTML = `
            <td class="p-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">
                ${escapeHtml(r.request_number)}
            </td>
            <td class="p-3.5 text-slate-400 whitespace-nowrap">
                ${escapeHtml(r.request_date)}
            </td>
            <td class="p-3.5 font-bold text-white whitespace-nowrap">
                ${escapeHtml(r.requester_name)}
            </td>
            <td class="p-3.5">
                <div class="flex items-center gap-1.5">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${bColor}">
                        <i data-lucide="${bIcon}" class="w-3 h-3"></i>
                        <span>${escapeHtml(r.beneficiary_type)}</span>
                    </span>
                    <strong class="text-white text-xs">${escapeHtml(r.beneficiary_name)}</strong>
                </div>
            </td>
            <td class="p-3.5 text-slate-300">
                ${r.project_name ? `<span class="font-bold text-white">${escapeHtml(r.project_name)}</span> <span class="text-[10px] text-slate-500 font-mono">(${escapeHtml(r.project_code || 'PRJ')})</span>` : '<span class="text-slate-500">عام / إداري</span>'}
            </td>
            <td class="p-3.5 max-w-xs truncate" title="${escapeHtml(r.purpose)}">
                <span class="text-slate-200">${escapeHtml(r.purpose)}</span>
            </td>
            <td class="p-3.5 font-mono font-black text-amber-400 text-sm whitespace-nowrap">
                ${formatCurrency(r.amount)}
            </td>
            <td class="p-3.5 text-center">
                ${disburserHtml}
            </td>
            <td class="p-3.5 text-center">
                ${pBadge}
            </td>
            <td class="p-3.5 text-center">
                ${attachLink}
            </td>
            <td class="p-3.5 text-center">
                ${statusBadge}
            </td>
            <td class="p-3.5 text-center whitespace-nowrap">
                ${actionsHtml}
            </td>
        `;

        tbody.appendChild(tr);
    });

    initLucide();
}

async function submitExpenseRequest(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-expense-request');
    if (btn) btn.disabled = true;

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    const form = document.getElementById('expense-request-form');
    const formData = new FormData();

    formData.append('requester_name', document.getElementById('req-requester-name')?.value || u.name || '');
    formData.append('requester_id', u.id || '');
    formData.append('project_id', document.getElementById('req-project-id')?.value || '');
    formData.append('beneficiary_type', document.getElementById('req-beneficiary-type')?.value || 'عام');
    
    // Beneficiary ID if selected from list
    const select = document.getElementById('req-beneficiary-select');
    if (select && select.value && select.value !== '__manual__') {
        formData.append('beneficiary_id', select.value);
    }
    formData.append('beneficiary_name', document.getElementById('req-beneficiary-name')?.value || '');
    formData.append('category', document.getElementById('req-category')?.value || 'نثريات وإداريات');
    formData.append('amount', document.getElementById('req-amount')?.value || 0);
    formData.append('purpose', document.getElementById('req-purpose')?.value || '');
    formData.append('priority', document.getElementById('req-priority')?.value || 'عادي');
    formData.append('request_date', document.getElementById('req-date')?.value || '');
    formData.append('notes', document.getElementById('req-notes')?.value || '');

    const fileInput = document.getElementById('req-attachment-file');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('attachment', fileInput.files[0]);
    }

    try {
        const res = await fetch('/api/expense-requests', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showToast(data.message || 'تم رفع طلب الصرف بنجاح وهو بانتظار تعميد المدير المالي!', 'success');
            closeModal('expense-request-modal');
            form.reset();
            loadExpenseRequests();
        } else {
            showToast(data.error || 'تعذر رفع طلب الصرف', 'error');
        }
    } catch (err) {
        console.error('Error submitting expense request:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function openExpenseRequestApprovalModal(id, mode = 'approve') {
    if (!isFinancialManagerUser()) {
        showToast('عفواً، صلاحية تعميد وتوجيه طلبات الصرف مقتصرة حصرياً على المدير المالي (أ. ابوالنصر البغدادي).', 'error');
        return;
    }

    const req = currentExpenseRequests.find(r => r.id === id);
    if (!req) return;

    // Ensure team members are loaded
    if (!Array.isArray(allTeamMembers) || allTeamMembers.length === 0) {
        try {
            const res = await fetch('/api/team');
            allTeamMembers = await res.json();
        } catch (e) {
            console.error('Error fetching team members:', e);
        }
    }

    document.getElementById('approval-req-id').value = req.id;
    document.getElementById('approval-mode').value = mode;

    document.getElementById('approval-req-number').innerText = req.request_number;
    document.getElementById('approval-req-requester').innerText = req.requester_name;
    document.getElementById('approval-req-beneficiary').innerText = `(${req.beneficiary_type}) ${req.beneficiary_name}`;
    document.getElementById('approval-req-project').innerText = req.project_name || 'عام / إداري';
    document.getElementById('approval-req-amount-badge').innerText = formatCurrency(req.amount);
    document.getElementById('approval-req-purpose').innerText = req.purpose;

    // Set modal titles
    const titleEl = document.getElementById('approval-modal-title');
    const btnText = document.getElementById('btn-submit-approval-text');
    if (mode === 'assign_only') {
        if (titleEl) titleEl.innerText = 'توجيه وتكليف أمر الصرف';
        if (btnText) btnText.innerText = 'حفظ وتوجيه أمر الصرف';
    } else {
        if (titleEl) titleEl.innerText = 'تعميد وتوجيه أمر الصرف';
        if (btnText) btnText.innerText = 'تأكيد التعميد وإرسال أمر الصرف';
    }

    // Populate team members dropdown
    const select = document.getElementById('approval-assignee-select');
    if (select) {
        select.innerHTML = '';

        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.innerText = '🏢 الإدارة المالية / الخزينة العامة (صرف مركزي مباشر)';
        select.appendChild(optDefault);

        if (Array.isArray(allTeamMembers) && allTeamMembers.length > 0) {
            allTeamMembers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.dataset.name = m.name;
                opt.dataset.role = m.role || '';
                opt.innerText = `👤 ${m.name} (${m.role || 'عضو فريق'})`;

                if (req.assigned_disburser_id && String(req.assigned_disburser_id) === String(m.id)) {
                    opt.selected = true;
                } else if (!req.assigned_disburser_id && req.assigned_disburser_name && req.assigned_disburser_name.includes(m.name)) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        }

        const optCustom = document.createElement('option');
        optCustom.value = '__custom__';
        optCustom.innerText = '✏️ جهة أخرى / تحديد مسؤول آخر يدوياً...';
        if (req.assigned_disburser_name && !Array.from(select.options).some(o => o.dataset.name === req.assigned_disburser_name)) {
            optCustom.selected = true;
        }
        select.appendChild(optCustom);
    }

    onApprovalAssigneeChange();

    const sourceSelect = document.getElementById('approval-source-select');
    if (sourceSelect) {
        sourceSelect.value = req.disbursement_source || 'عهدة شخصية';
    }
    const notesInput = document.getElementById('approval-assignment-notes');
    if (notesInput) {
        notesInput.value = req.assignment_notes || '';
    }
    const adminNotesInput = document.getElementById('approval-admin-notes');
    if (adminNotesInput) {
        adminNotesInput.value = req.approval_notes || '';
    }

    openModal('expense-request-approval-modal');
    initLucide();
}

function onApprovalAssigneeChange() {
    const select = document.getElementById('approval-assignee-select');
    const customInput = document.getElementById('approval-custom-assignee');
    const btnText = document.getElementById('btn-submit-approval-text');
    const mode = document.getElementById('approval-mode')?.value || 'approve';

    if (!select) return;

    if (select.value === '__custom__') {
        if (customInput) customInput.classList.remove('hidden');
    } else {
        if (customInput) {
            customInput.classList.add('hidden');
            customInput.value = '';
        }
    }

    const selectedOpt = select.options[select.selectedIndex];
    const name = selectedOpt ? (selectedOpt.dataset.name || selectedOpt.text.replace(/^[^\s]+\s+/, '')) : '';

    if (btnText) {
        if (mode === 'assign_only') {
            btnText.innerText = select.value ? `توجيه أمر الصرف إلى (${name})` : 'حفظ التوجيه (الخزينة العامة)';
        } else {
            btnText.innerText = select.value ? `تعميد وإرسال أمر صرف لـ (${name})` : 'تأكيد التعميد والصرف من الخزينة';
        }
    }
}

async function submitExpenseRequestApproval(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-approval-assign');
    if (btn) btn.disabled = true;

    const id = document.getElementById('approval-req-id')?.value;
    const mode = document.getElementById('approval-mode')?.value || 'approve';
    const select = document.getElementById('approval-assignee-select');
    const customInput = document.getElementById('approval-custom-assignee');
    const sourceSelect = document.getElementById('approval-source-select');
    const assignNotes = document.getElementById('approval-assignment-notes')?.value || '';
    const adminNotes = document.getElementById('approval-admin-notes')?.value || '';

    let assignedId = null;
    let assignedName = '';

    if (select.value === '__custom__') {
        assignedName = customInput ? customInput.value.trim() : '';
    } else if (select.value) {
        assignedId = select.value;
        const opt = select.options[select.selectedIndex];
        assignedName = opt ? (opt.dataset.name || opt.text) : '';
    }

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    const endpoint = (mode === 'assign_only') ? `/api/expense-requests/${id}/assign` : `/api/expense-requests/${id}/approve`;

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: u.id,
                user_role: u.role,
                user_name: u.name,
                assigned_disburser_id: assignedId,
                assigned_disburser_name: assignedName,
                disbursement_source: sourceSelect ? sourceSelect.value : '',
                assignment_notes: assignNotes.trim(),
                approval_notes: adminNotes.trim()
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم الاعتماد وتوجيه أمر الصرف بنجاح!', 'success');
            closeModal('expense-request-approval-modal');
            loadExpenseRequests();
        } else {
            showToast(data.error || 'تعذر استكمال العملية', 'error');
        }
    } catch (err) {
        console.error('Error submitting approval/assignment:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function rejectExpenseRequest(id) {
    if (!isFinancialManagerUser()) {
        showToast('عفواً، صلاحية رفض طلبات الصرف مقتصرة على المدير المالي (أ. ابوالنصر البغدادي).', 'error');
        return;
    }

    const reason = prompt('يرجى كتابة سبب رفض هذا الطلب:');
    if (reason === null) return;
    if (!reason.trim()) {
        showToast('يرجى توضيح سبب الرفض', 'warning');
        return;
    }

    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    try {
        const res = await fetch(`/api/expense-requests/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: u.id,
                user_role: u.role,
                user_name: u.name,
                rejection_notes: reason.trim()
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم رفض طلب الصرف وتحديث الحالة', 'info');
            loadExpenseRequests();
        } else {
            showToast(data.error || 'تعذر رفض الطلب', 'error');
        }
    } catch (e) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

function openDisburseExpenseRequestModal(id) {
    const req = currentExpenseRequests.find(r => r.id === id);
    if (!req) return;

    const isFinManager = isFinancialManagerUser();
    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');

    // Check if user is Financial Manager OR the assigned disburser (e.g. Nawaf)
    const isAssigned = (u.id && req.assigned_disburser_id && String(u.id) === String(req.assigned_disburser_id)) ||
                       (u.name && req.assigned_disburser_name && (req.assigned_disburser_name.includes(u.name) || u.name.includes(req.assigned_disburser_name)));

    if (!isFinManager && !isAssigned) {
        showToast(`عفواً، تسجيل الصرف الفعلي متاح للمدير المالي أو المكلف بالصرف (${req.assigned_disburser_name || 'غير محدد'}).`, 'error');
        return;
    }

    document.getElementById('disburse-req-id').value = req.id;
    document.getElementById('disburse-req-number').innerText = req.request_number;
    document.getElementById('disburse-req-requester').innerText = req.requester_name;
    document.getElementById('disburse-req-beneficiary').innerText = `${req.beneficiary_type}: ${req.beneficiary_name}`;
    document.getElementById('disburse-req-project').innerText = req.project_name || 'عام / إداري';
    document.getElementById('disburse-req-amount-badge').innerText = formatCurrency(req.amount);
    document.getElementById('disburse-req-purpose').innerText = req.purpose;

    // Disburser banner & paid_by input
    const banner = document.getElementById('disburse-assigned-banner');
    const assignedNameEl = document.getElementById('disburse-assigned-name');
    const assignedSourceEl = document.getElementById('disburse-assigned-source');
    const paidByInput = document.getElementById('disburse-paid-by');

    if (req.assigned_disburser_name) {
        if (banner) banner.classList.remove('hidden');
        if (assignedNameEl) assignedNameEl.innerText = req.assigned_disburser_name;
        if (assignedSourceEl) assignedSourceEl.innerText = req.disbursement_source ? `(المصدر: ${req.disbursement_source})` : '';
        if (paidByInput) paidByInput.value = req.assigned_disburser_name;
    } else {
        if (banner) banner.classList.add('hidden');
        if (paidByInput) paidByInput.value = (u && u.name) ? u.name : 'الإدارة المالية';
    }

    document.getElementById('disburse-actual-amount').value = req.amount;
    document.getElementById('disburse-actual-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('disburse-payment-method').value = (req.disbursement_source && req.disbursement_source.includes('نقدي')) ? 'نقدي' : 'تحويل بنكي';
    document.getElementById('disburse-bank-name').value = 'البنك الأهلي السعودي (حساب الشركة)';
    document.getElementById('disburse-transfer-ref').value = '';
    document.getElementById('disburse-notes').value = req.assignment_notes || '';

    openModal('expense-request-disburse-modal');
    initLucide();
}

async function submitExpenseRequestDisbursement(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-disburse');
    if (btn) btn.disabled = true;

    const id = document.getElementById('disburse-req-id').value;
    const u = currentUser || JSON.parse(localStorage.getItem('segieny_auth_user') || '{}');
    const formData = new FormData();

    formData.append('user_id', u.id || '');
    formData.append('user_role', u.role || '');
    formData.append('user_name', u.name || '');
    formData.append('paid_by', document.getElementById('disburse-paid-by')?.value || '');
    formData.append('disbursed_amount', document.getElementById('disburse-actual-amount')?.value || 0);
    formData.append('disbursed_date', document.getElementById('disburse-actual-date')?.value || '');
    formData.append('payment_method', document.getElementById('disburse-payment-method')?.value || 'تحويل بنكي');
    formData.append('bank_name', document.getElementById('disburse-bank-name')?.value || '');
    formData.append('transfer_reference', document.getElementById('disburse-transfer-ref')?.value || '');
    formData.append('disbursement_notes', document.getElementById('disburse-notes')?.value || '');

    const fileInput = document.getElementById('disburse-receipt-file');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('receipt_file', fileInput.files[0]);
    }

    try {
        const res = await fetch(`/api/expense-requests/${id}/disburse`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showToast(data.message || 'تم صرف المبلغ وترحيله للمصروفات والكاش فلو بنجاح!', 'success');
            closeModal('expense-request-disburse-modal');
            loadExpenseRequests();
            if (typeof loadExpenses === 'function') loadExpenses();
            if (typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof loadDashboard === 'function') loadDashboard();
        } else {
            showToast(data.error || 'تعذر إتمام عملية الصرف', 'error');
        }
    } catch (err) {
        console.error('Error disbursing expense request:', err);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function viewExpenseRequestDetails(id) {
    try {
        const res = await fetch(`/api/expense-requests/${id}`);
        const req = await res.json();
        currentViewedExpenseRequest = req;

        document.getElementById('detail-req-number').innerText = req.request_number;
        const container = document.getElementById('detail-req-content');
        if (!container) return;

        let statusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
        let statusText = '⏳ بانتظار تعميد المدير المالي';
        if (req.status === 'approved') {
            statusColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
            statusText = '🛡️ معمد من المدير المالي (جاهز للصرف)';
        } else if (req.status === 'disbursed') {
            statusColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
            statusText = '💵 تم الصرف الفعلي وترحيله للمصروفات والكاش فلو';
        } else if (req.status === 'rejected') {
            statusColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
            statusText = '❌ تم رفض الطلب من المدير المالي';
        }

        container.innerHTML = `
            <!-- Top Status Strip -->
            <div class="p-3.5 rounded-xl border flex items-center justify-between ${statusColor}">
                <div class="flex items-center gap-2">
                    <i data-lucide="info" class="w-4 h-4"></i>
                    <strong class="text-xs font-bold">${statusText}</strong>
                </div>
                <span class="font-mono text-sm font-black">${formatCurrency(req.amount)}</span>
            </div>

            <!-- General Details Grid -->
            <div class="grid grid-cols-2 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                    <span class="text-slate-400 block text-[11px]">مقدم الطلب:</span>
                    <strong class="text-white text-xs">${escapeHtml(req.requester_name)}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[11px]">تاريخ الطلب:</span>
                    <strong class="text-white text-xs">${escapeHtml(req.request_date)}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[11px]">المستفيد / جهة الصرف:</span>
                    <strong class="text-amber-400 text-xs">(${escapeHtml(req.beneficiary_type)}) ${escapeHtml(req.beneficiary_name)}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[11px]">المشروع:</span>
                    <strong class="text-white text-xs">${escapeHtml(req.project_name || 'عام / إداري')}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[11px]">تصنيف المصروف:</span>
                    <strong class="text-slate-200 text-xs">${escapeHtml(req.category || 'نثريات')}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[11px]">درجة الأهمية:</span>
                    <strong class="text-white text-xs">${escapeHtml(req.priority || 'عادي')}</strong>
                </div>
            </div>

            <!-- Purpose & Description -->
            <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span class="text-slate-400 block text-[11px] font-bold">البيان وسبب الصرف:</span>
                <p class="text-slate-200 text-xs leading-relaxed whitespace-pre-line">${escapeHtml(req.purpose)}</p>
                ${req.notes ? `<p class="text-[11px] text-slate-400 pt-2 border-t border-slate-850 mt-2">ملاحظات: ${escapeHtml(req.notes)}</p>` : ''}
            </div>

            <!-- Initial Attachment -->
            ${req.attachment_path ? `
                <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i data-lucide="paperclip" class="w-4 h-4 text-indigo-400"></i>
                        <span class="text-slate-300 text-xs">المرفق المبدئي (عرض سعر / فاتورة):</span>
                    </div>
                    <a href="${req.attachment_path}" target="_blank" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition">
                        <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                        <span>عرض المرفق</span>
                    </a>
                </div>
            ` : ''}

            <!-- Approval Box -->
            ${req.approved_by ? `
                <div class="p-4 bg-slate-950 rounded-xl border border-blue-500/30 space-y-2">
                    <div class="flex items-center justify-between border-b border-slate-850 pb-2">
                        <span class="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                            <i data-lucide="shield-check" class="w-4 h-4"></i>
                            <span>بيانات تعميد المدير المالي</span>
                        </span>
                        <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(req.approved_at || '')}</span>
                    </div>
                    <div class="text-xs text-slate-300">
                        تم بواسطة: <strong class="text-white">${escapeHtml(req.approved_by)}</strong>
                    </div>
                    ${req.approval_notes ? `<div class="text-xs text-slate-400">ملاحظات التعميد: <span class="text-slate-200">${escapeHtml(req.approval_notes)}</span></div>` : ''}
                </div>
            ` : ''}

            <!-- Assigned Disburser Box (أمر التكليف بالصرف) -->
            ${req.assigned_disburser_name ? `
                <div class="p-4 bg-slate-950 rounded-xl border border-amber-500/40 space-y-2">
                    <div class="flex items-center justify-between border-b border-slate-850 pb-2">
                        <span class="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <i data-lucide="send" class="w-4 h-4"></i>
                            <span>أمر وتوجيه الصرف (الجهة المكلفة)</span>
                        </span>
                        <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(req.assigned_at || '')}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-slate-400 block text-[10px]">المكلف بالصرف:</span>
                            <strong class="text-amber-300">${escapeHtml(req.assigned_disburser_name)}</strong>
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[10px]">الجهة المصروف منها / المصدر:</span>
                            <strong class="text-white">${escapeHtml(req.disbursement_source || 'عهدة / كاش')}</strong>
                        </div>
                    </div>
                    ${req.assignment_notes ? `<div class="text-xs text-slate-300 pt-2 border-t border-slate-850 mt-1">توجيهات الصرف للمكلف: <span class="text-amber-200 font-semibold">${escapeHtml(req.assignment_notes)}</span></div>` : ''}
                </div>
            ` : ''}

            <!-- Disbursement Details Box -->
            ${req.status === 'disbursed' ? `
                <div class="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-3">
                    <div class="flex items-center justify-between border-b border-slate-850 pb-2">
                        <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <i data-lucide="wallet" class="w-4 h-4"></i>
                            <span>بيانات الصرف المالي الفعلي</span>
                        </span>
                        <span class="text-sm font-black text-emerald-400 font-mono">${formatCurrency(req.disbursed_amount || req.amount)}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-slate-400 block text-[10px]">تاريخ الصرف:</span>
                            <strong class="text-white">${escapeHtml(req.disbursed_date || '')}</strong>
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[10px]">طريقة الصرف:</span>
                            <strong class="text-white">${escapeHtml(req.payment_method || 'تحويل بنكي')}</strong>
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[10px]">الحساب / الخزينة:</span>
                            <strong class="text-white">${escapeHtml(req.bank_name || '-')}</strong>
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[10px]">رقم المرجع / الحوالة:</span>
                            <strong class="text-amber-400 font-mono">${escapeHtml(req.transfer_reference || '-')}</strong>
                        </div>
                    </div>
                    <div class="text-xs text-slate-300">
                        صُرف بواسطة: <strong class="text-white">${escapeHtml(req.disbursed_by || 'المدير المالي')}</strong>
                    </div>
                    ${req.disbursement_notes ? `<div class="text-[11px] text-slate-400">ملاحظات الصرف: <span class="text-slate-200">${escapeHtml(req.disbursement_notes)}</span></div>` : ''}
                    
                    ${req.disbursement_receipt_path ? `
                        <div class="pt-2 border-t border-slate-850 flex items-center justify-between">
                            <span class="text-[11px] text-slate-400">إشعار التحويل البنكي / سند الصرف:</span>
                            <a href="${req.disbursement_receipt_path}" target="_blank" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition">
                                <i data-lucide="file-check" class="w-3.5 h-3.5"></i>
                                <span>عرض إشعار التحويل</span>
                            </a>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        `;

        openModal('expense-request-detail-modal');
        initLucide();
    } catch (err) {
        showToast('تعذر تحميل تفاصيل الطلب', 'error');
    }
}

async function deleteExpenseRequest(id) {
    if (!confirm('هل أنت متأكد من حذف طلب الصرف هذا؟')) return;
    try {
        const res = await fetch(`/api/expense-requests/${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || 'تم حذف طلب الصرف بنجاح', 'success');
            loadExpenseRequests();
        } else {
            showToast(data.error || 'تعذر حذف طلب الصرف', 'error');
        }
    } catch (e) {
        showToast('فشل في الاتصال بالخادم', 'error');
    }
}

function printSingleExpenseRequest() {
    if (!currentViewedExpenseRequest) return;
    const req = currentViewedExpenseRequest;
    const printWin = window.open('', '_blank');
    const isDisbursed = req.status === 'disbursed';

    printWin.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>إذن صرف مصروف - ${escapeHtml(req.request_number)}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; line-height: 1.6; }
                .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
                .company-name { font-size: 20px; font-weight: 900; color: #047857; margin-bottom: 4px; }
                .doc-title { font-size: 16px; font-weight: bold; color: #334155; }
                .meta-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
                .meta-table td { padding: 6px 10px; }
                .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 8px 12px; }
                .data-table th { background: #f1f5f9; text-align: right; }
                .amount-box { font-size: 18px; font-weight: 900; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
                .sig-box { text-align: center; width: 30%; }
                .sig-line { margin-top: 40px; border-top: 1px dashed #94a3b8; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-name">شركة مقاولات السجيني</div>
                <div class="doc-title">إذن وسند صرف مصروفات مالي (${escapeHtml(req.request_number)})</div>
            </div>

            <table class="meta-table">
                <tr>
                    <td><strong>رقم الطلب:</strong> ${escapeHtml(req.request_number)}</td>
                    <td><strong>تاريخ الطلب:</strong> ${escapeHtml(req.request_date)}</td>
                    <td><strong>حالة الطلب:</strong> ${escapeHtml(req.status === 'disbursed' ? 'تم الصرف الفعلي' : (req.status === 'approved' ? 'معمد بانتظار الصرف' : 'معلق'))}</td>
                </tr>
                <tr>
                    <td><strong>مقدم الطلب:</strong> ${escapeHtml(req.requester_name)}</td>
                    <td><strong>جهة الصرف / المستفيد:</strong> (${escapeHtml(req.beneficiary_type)}) ${escapeHtml(req.beneficiary_name)}</td>
                    <td><strong>المشروع:</strong> ${escapeHtml(req.project_name || 'عام / إداري')}</td>
                </tr>
            </table>

            <div class="amount-box">
                المبلغ المطلوب: ${formatCurrency(req.amount)}
                ${isDisbursed ? `<br><small style="font-size:12px;color:#0f766e;">المبلغ المنصرف فعلياً: ${formatCurrency(req.disbursed_amount || req.amount)} بتأريخ ${escapeHtml(req.disbursed_date || '')}</small>` : ''}
            </div>

            <table class="data-table">
                <tr>
                    <th style="width: 25%;">البيان وسبب الصرف:</th>
                    <td>${escapeHtml(req.purpose)}</td>
                </tr>
                <tr>
                    <th>تصنيف المصروف:</th>
                    <td>${escapeHtml(req.category || 'نثريات وإداريات')}</td>
                </tr>
                ${req.approved_by ? `
                <tr>
                    <th>التعميد والاعتماد:</th>
                    <td>عُمّد بواسطة: ${escapeHtml(req.approved_by)} بتاريخ ${escapeHtml(req.approved_at || '')} ${req.approval_notes ? ' - ملاحظات: ' + escapeHtml(req.approval_notes) : ''}</td>
                </tr>` : ''}
                ${isDisbursed ? `
                <tr>
                    <th>بيانات الصرف:</th>
                    <td>طريقة الصرف: ${escapeHtml(req.payment_method)} | الحساب: ${escapeHtml(req.bank_name || '-')} | رقم المرجع: ${escapeHtml(req.transfer_reference || '-')} | صرف بواسطة: ${escapeHtml(req.disbursed_by || '')}</td>
                </tr>` : ''}
            </table>

            <div class="signatures">
                <div class="sig-box">
                    <strong>مقدم الطلب</strong>
                    <div class="sig-line">${escapeHtml(req.requester_name)}</div>
                </div>
                <div class="sig-box">
                    <strong>المدير المالي (التعميد)</strong>
                    <div class="sig-line">أ. ابوالنصر البغدادي</div>
                </div>
                <div class="sig-box">
                    <strong>المستلم / الصارف</strong>
                    <div class="sig-line">${escapeHtml(req.beneficiary_name)}</div>
                </div>
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
}

