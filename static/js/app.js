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
    const tabNames = ['dashboard', 'projects', 'tasks', 'expenses', 'suppliers', 'cashflow', 'subcontractors', 'documents', 'reports', 'chat'];
    const idx = tabNames.indexOf(tabId);
    if (idx !== -1 && mobileTabs[idx]) {
        mobileTabs[idx].classList.remove('bg-slate-800', 'text-slate-300');
        mobileTabs[idx].classList.add('bg-emerald-600', 'text-white');
    }

    // Trigger tab-specific data load
    if (tabId === 'dashboard') loadDashboard();
    else if (tabId === 'projects') loadProjects();
    else if (tabId === 'tasks') loadTasks();
    else if (tabId === 'expenses') loadExpenses();
    else if (tabId === 'suppliers') loadSuppliersData();
    else if (tabId === 'cashflow') loadCashFlow();
    else if (tabId === 'subcontractors') loadSubcontractors();
    else if (tabId === 'documents') loadDocuments();
    else if (tabId === 'reports') loadDetailedReports();
    else if (tabId === 'chat') initChatTab();

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

// ----------------- EXPENSE TAX & VAT CALCULATIONS -----------------
function onExpenseTaxTypeChanged() {
    const isTax = document.getElementById('tax-choice-yes')?.checked;
    const taxSec = document.getElementById('tax-calculation-section');
    const nonTaxSec = document.getElementById('nontax-section');
    const yesBox = document.getElementById('tax-option-yes-container');
    const noBox = document.getElementById('tax-option-no-container');
    const badge = document.getElementById('tax-status-badge');

    if (isTax) {
        if (taxSec) taxSec.classList.remove('hidden');
        if (nonTaxSec) nonTaxSec.classList.add('hidden');
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
}

function syncNonTaxAmount() {
    const amt = document.getElementById('expense-amount-nontax')?.value || '';
    if (document.getElementById('expense-amount')) document.getElementById('expense-amount').value = amt;
    if (document.getElementById('expense-amount-without-tax')) document.getElementById('expense-amount-without-tax').value = amt;
    if (document.getElementById('expense-tax-amount')) document.getElementById('expense-tax-amount').value = '0.00';
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

        const subRemaining = data.sub_total_agreed - data.sub_total_paid;
        document.getElementById('stat-subcontractor-balance').innerText = formatCurrency(subRemaining);

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
function renderExpenseChart(categoryData) {
    const ctx = document.getElementById('expensesPieChart');
    if (!ctx) return;

    const labels = (categoryData || []).map(c => c.category);
    const amounts = (categoryData || []).map(c => c.total);

    const colors = [
        '#10b981', // emerald
        '#f59e0b', // amber
        '#3b82f6', // blue
        '#ec4899', // pink
        '#8b5cf6', // purple
        '#64748b'  // slate
    ];

    if (expensesChartInstance) {
        expensesChartInstance.destroy();
    }

    expensesChartInstance = new Chart(ctx, {
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
                    display: false
                },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            cutout: '68%'
        }
    });

    // Populate custom legend
    const legendEl = document.getElementById('chart-legend');
    if (legendEl) {
        legendEl.innerHTML = '';
        labels.forEach((lbl, i) => {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-1.5 truncate';
            item.innerHTML = `
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${colors[i % colors.length]}"></span>
                <span class="text-slate-300 truncate">${lbl}</span>
            `;
            legendEl.appendChild(item);
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
        const isGeneralManager = (currentUser && (currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
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

    todoTasks.forEach(t => todoCol && todoCol.appendChild(renderCard(t)));
    inprogressTasks.forEach(t => inprogressCol && inprogressCol.appendChild(renderCard(t)));
    pendingTasks.forEach(t => pendingCol && pendingCol.appendChild(renderCard(t)));
    doneTasks.forEach(t => doneCol && doneCol.appendChild(renderCard(t)));

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
    const isGeneralManager = (currentUser && (currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
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
            const isGeneralManager = (currentUser && (currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
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
        const isGeneralManager = (currentUser && (currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
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
    const isGeneralManager = (currentUser && (currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
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
async function loadExpenses() {
    const projId = document.getElementById('expense-filter-project')?.value || '';
    const cat = document.getElementById('expense-filter-category')?.value || '';
    const fromDate = document.getElementById('expense-filter-from')?.value || '';
    const toDate = document.getElementById('expense-filter-to')?.value || '';

    let url = `/api/expenses?`;
    if (projId) url += `project_id=${projId}&`;
    if (cat) url += `category=${encodeURIComponent(cat)}&`;
    if (fromDate) url += `from_date=${fromDate}&`;
    if (toDate) url += `to_date=${toDate}&`;

    try {
        const res = await fetch(url);
        const expenses = await res.json();
        renderExpensesTable(expenses);
    } catch (err) {
        console.error('Error loading expenses:', err);
    }
}

function renderExpensesTable(expenses) {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    let totalSum = 0;
    let totalNoTax = 0;
    let totalTax = 0;
    let receiptsCount = 0;
    const catCounts = {};

    if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="p-6 text-center text-slate-500">${isEn ? 'No expenses matching the search criteria' : 'لا توجد مصروفات مسجلة مطابقة لمعايير البحث'}</td></tr>`;
    }

    expenses.forEach(e => {
        totalSum += e.amount;
        const noTax = (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount;
        totalNoTax += noTax;
        totalTax += (e.tax_amount || 0);
        if (e.invoice_file_path) receiptsCount++;
        catCounts[e.category] = (catCounts[e.category] || 0) + e.amount;

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

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/60 transition';
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
            <td class="p-3.5 whitespace-nowrap text-slate-400">${typeof tr === 'function' ? tr(e.payment_method || 'نقدي') : (e.payment_method || 'نقدي')}</td>
            <td class="p-3.5 whitespace-nowrap text-slate-300">
                ${e.paid_to || e.paid_by || '-'}
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
                <div class="flex items-center justify-center gap-1">
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
        const remaining = s.agreed_amount - s.paid_amount;
        const paidPercent = s.agreed_amount > 0 ? Math.round((s.paid_amount / s.agreed_amount) * 100) : 0;
        const card = document.createElement('div');
        card.className = 'bg-slate-850 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-blue-500/50 transition-all shadow-xl';
        card.innerHTML = `
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
                <p>${isEn ? 'Project:' : 'المشروع:'} <strong class="text-slate-200">${s.project_name || (isEn ? 'All Sites' : 'عام لجميع المواقع')}</strong></p>
                <p>${isEn ? 'Phone:' : 'الهاتف:'} <strong class="text-slate-200 font-mono">${s.phone || '-'}</strong></p>
                ${s.notes ? `<p class="italic">${s.notes}</p>` : ''}
            </div>

            <!-- Payment progress -->
            <div>
                <div class="flex items-center justify-between text-xs mb-1">
                    <span class="text-slate-400">${isEn ? `Paid of Contract (${paidPercent}%):` : `المسدد من الاتفاق (${paidPercent}%):`}</span>
                    <strong class="text-emerald-400">${formatCurrency(s.paid_amount)}</strong>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div class="bg-blue-500 h-full rounded-full" style="width: ${paidPercent}%"></div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-750">
                <div class="bg-slate-800 p-2 rounded-xl">
                    <span class="text-[10px] text-slate-400 block">${isEn ? 'Total Contract:' : 'إجمالي الاتفاق:'}</span>
                    <strong class="text-white">${formatCurrency(s.agreed_amount)}</strong>
                </div>
                <div class="bg-slate-800 p-2 rounded-xl">
                    <span class="text-[10px] text-slate-400 block">${isEn ? 'Remaining:' : 'المتبقي:'}</span>
                    <strong class="text-amber-400">${formatCurrency(remaining)}</strong>
                </div>
            </div>

            <!-- Action: Pay مستخلص -->
            <div class="pt-2 border-t border-slate-750">
                <button onclick="openSubPaymentModal(${s.id}, '${s.name}')" class="w-full py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition">
                    <i data-lucide="badge-dollar-sign" class="w-4 h-4"></i>
                    <span>${isEn ? 'Issue Payment Certificate' : 'صرف مستخلص / دفعة'}</span>
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
    document.getElementById('sub-agreed-amount').value = s.agreed_amount || 0;
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

function openSubPaymentModal(subId, subName) {
    document.getElementById('sub-pay-id').value = subId;
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    document.getElementById('sub-pay-target-name').innerText = `${isEn ? 'Beneficiary:' : 'المستفيد:'} ${subName}`;
    openModal('sub-payment-modal');
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
        grid.innerHTML = `<div class="col-span-4 text-center py-12 text-slate-500">${isEn ? 'No blueprints or documents uploaded currently' : 'لا توجد مخططات أو مستندات مرفوعة حالياً'}</div>`;
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
        formData.append('category', document.getElementById('expense-category').value);
        formData.append('payment_method', document.getElementById('expense-payment-method').value);
        formData.append('paid_by', document.getElementById('expense-paid-by').value);
        formData.append('paid_to', document.getElementById('expense-paid-to').value);
        formData.append('expense_date', document.getElementById('expense-date').value);
        formData.append('payment_date', document.getElementById('expense-payment-date')?.value || '');
        formData.append('notes', document.getElementById('expense-notes').value);
        formData.append('payment_status', document.getElementById('expense-payment-status')?.value || 'paid');
        formData.append('paid_amount', document.getElementById('expense-paid-amount')?.value || '');

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
            if (data.has_price_increase) {
                showToast(`⚠️ تنبيه: تم رصد زيادة بسعر الفاتورة عن عرض السعر بمقدار +${formatCurrency(data.total_variance)} ر.س!`, 'warning');
            } else {
                showToast(editId ? 'تم تحديث بيانات المصروف والفاتورة بنجاح!' : 'تم تسجيل المصروف وأرشفة الفاتورة بنجاح!');
            }
            closeModal('expense-modal');
            resetExpenseModal();
            loadDashboard();
            if (currentTab === 'expenses') loadExpenses();
            if (currentTab === 'suppliers' && typeof loadSuppliersData === 'function') loadSuppliersData();
            if (currentTab === 'cashflow' && typeof loadCashFlow === 'function') loadCashFlow();
            if (typeof currentProjectDetailData !== 'undefined' && currentProjectDetailData) openProjectDetails(currentProjectDetailData.id);
            if (typeof currentSelectedSupplierDetailId !== 'undefined' && currentSelectedSupplierDetailId) openSupplierDetailModal(currentSelectedSupplierDetailId);
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
    if (typeof resetExpenseTaxFields === 'function') resetExpenseTaxFields();
    if (typeof resetExpenseSupplierFields === 'function') resetExpenseSupplierFields();
    if (typeof clearInvoiceFile === 'function') clearInvoiceFile();

    const pStatEl = document.getElementById('expense-payment-status');
    if (pStatEl) pStatEl.value = 'paid';
    const pAmtCont = document.getElementById('expense-paid-amount-container');
    if (pAmtCont) pAmtCont.classList.add('hidden');
    const pAmtEl = document.getElementById('expense-paid-amount');
    if (pAmtEl) pAmtEl.value = '';

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

        if (document.getElementById('expense-title')) document.getElementById('expense-title').value = exp.title || '';
        if (document.getElementById('expense-category')) document.getElementById('expense-category').value = exp.category || 'مواد بناء';
        if (document.getElementById('expense-payment-method')) document.getElementById('expense-payment-method').value = exp.payment_method || 'تحويل بنكي';
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
        notes: document.getElementById('project-notes').value.trim()
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
    const formData = new FormData();
    formData.append('amount', document.getElementById('sub-pay-amount').value);
    formData.append('payment_type', document.getElementById('sub-pay-type').value);
    formData.append('payment_date', document.getElementById('sub-pay-date').value);
    formData.append('notes', document.getElementById('sub-pay-notes').value);

    const fileInput = document.getElementById('sub-pay-receipt-file');
    if (fileInput.files.length > 0) {
        formData.append('receipt_file', fileInput.files[0]);
    }

    const res = await fetch(`/api/subcontractors/${subId}/payments`, {
        method: 'POST',
        body: formData
    });
    const data = await res.json();
    if (data.success) {
        showToast('تم قيد المستخلص وترحيله للمصروفات');
        closeModal('sub-payment-modal');
        document.getElementById('sub-payment-form').reset();
        loadSubcontractors();
        loadDashboard();
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
    const titleEl = document.getElementById('lightbox-title');
    const downloadLink = document.getElementById('lightbox-download-link');

    titleEl.innerText = title || 'معاينة الفاتورة والمستند';
    downloadLink.href = filePath;

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

// ----------------- PROJECT DETAILS MODAL -----------------
async function openProjectDetails(projectId) {
    currentProjectIdForModal = projectId;
    try {
        const res = await fetch(`/api/projects/${projectId}`);
        const p = await res.json();
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
        if ((p.expenses || []).length === 0) {
            expTbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-500">لا توجد مصاريف مسجلة لهذا المشروع بعد</td></tr>`;
        } else {
            p.expenses.forEach(e => {
                const isTaxInv = e.is_tax_invoice === 1 || e.tax_amount > 0;
                const taxBadge = isTaxInv ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <i data-lucide="shield-check" class="w-3 h-3"></i>
                        <span>ضريبية 15%</span>
                    </span>
                    <div class="text-[10px] text-emerald-400 font-bold mt-0.5">مسترد: ${formatCurrency(e.tax_amount || 0)}</div>
                ` : `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">بدون ضريبة</span>`;

                const noTax = (e.amount_without_tax && e.amount_without_tax > 0) ? e.amount_without_tax : e.amount;

                const tr = document.createElement('tr');
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
                        <div class="flex items-center justify-center gap-1">
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
                const isGeneralManager = (currentUser && (currentUser.name === 'فاروق محمد' || currentUser.role === 'المدير العام'));
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
    }
}

// Render Phases Tab
function renderProjectPhasesTab(p) {
    const phasesCont = document.getElementById('detail-phases-container');
    if (!phasesCont) return;
    phasesCont.innerHTML = '';

    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    // Summary Cards
    const totalSelling = p.total_phases_selling || 0;
    const totalCost = p.total_phases_cost || 0;
    const totalProfit = totalSelling - totalCost;
    const profitMargin = totalSelling > 0 ? ((totalProfit / totalSelling) * 100).toFixed(1) : 0;
    const sumWeights = (p.phases || []).reduce((acc, ph) => acc + (parseFloat(ph.weight_percent) || 0), 0);

    document.getElementById('detail-phases-selling').innerText = formatCurrency(totalSelling);
    document.getElementById('detail-phases-cost').innerText = formatCurrency(totalCost);
    document.getElementById('detail-phases-profit').innerText = `${formatCurrency(totalProfit)} (${profitMargin}%)`;
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
        const isPaid = cp.is_received === 1 || cp.status === 'paid';
        const isPartiallyPaid = !isPaid && (cp.received_amount > 0 || cp.status === 'partially_paid');
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition border-b border-slate-800/60';
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-400 text-center">${cp.payment_number || '-'}</td>
            <td class="p-3">
                <strong class="text-white block text-xs">${cp.milestone_name}</strong>
                ${cp.notes ? `<span class="text-[10px] text-slate-400 block">${cp.notes}</span>` : ''}
                ${cp.receipt_voucher_no ? `<span class="text-[10px] text-emerald-400 font-mono block">سند: ${cp.receipt_voucher_no}</span>` : ''}
            </td>
            <td class="p-3 text-center font-bold text-amber-400 font-mono">${cp.percentage ? `${cp.percentage}%` : '-'}</td>
            <td class="p-3 font-black text-emerald-400 font-mono">${formatCurrency(cp.amount_with_tax)}</td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">${formatCurrency(cp.tax_amount)}</td>
            <td class="p-3 text-blue-400 font-mono text-[11px] font-bold">${formatCurrency(cp.amount_without_tax)}</td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">${cp.due_date || '-'}</td>
            <td class="p-3 text-center">
                ${isPaid ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                        <i data-lucide="check-check" class="w-3 h-3"></i>
                        <span>${isEn ? 'Collected' : 'تم التحصيل'} (${formatCurrency(cp.received_amount)})</span>
                    </span>
                    ${cp.received_date ? `<span class="block text-[9px] text-slate-500 font-mono mt-0.5">${cp.received_date}</span>` : ''}
                ` : isPartiallyPaid ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                        <i data-lucide="alert-circle" class="w-3 h-3"></i>
                        <span>${isEn ? 'Partial' : 'محصل جزئياً'} (${formatCurrency(cp.received_amount)})</span>
                    </span>
                ` : `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-bold text-[10px]">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        <span>${isEn ? 'Pending' : 'قيد الانتظار'}</span>
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
    
    openModal('client-payment-modal');
}

function openEditClientPaymentModal(paymentId) {
    if (!currentProjectDetailData || !currentProjectDetailData.client_payments) return;
    const cp = currentProjectDetailData.client_payments.find(x => x.id === paymentId);
    if (!cp) return;
    
    document.getElementById('cp-id').value = cp.id;
    document.getElementById('cp-project-id').value = currentProjectDetailData.id;
    const selGroup = document.getElementById('cp-project-select-group');
    if (selGroup) selGroup.classList.add('hidden');
    document.getElementById('client-payment-modal-title').innerText = 'تعديل دفعة واستحقاق العميل';
    document.getElementById('cp-number').value = cp.payment_number;
    document.getElementById('cp-percentage').value = cp.percentage || '';
    document.getElementById('cp-milestone').value = cp.milestone_name;
    document.getElementById('cp-amount-with-tax').value = cp.amount_with_tax;
    document.getElementById('cp-amount-without-tax').value = cp.amount_without_tax;
    document.getElementById('cp-tax-amount').value = cp.tax_amount;
    document.getElementById('cp-due-date').value = cp.due_date || '';
    document.getElementById('cp-notes').value = cp.notes || '';
    
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
    const payload = {
        project_id: projectId,
        payment_number: parseInt(document.getElementById('cp-number').value) || 1,
        percentage: parseFloat(document.getElementById('cp-percentage').value) || 0,
        milestone_name: document.getElementById('cp-milestone').value,
        amount_with_tax: parseFloat(document.getElementById('cp-amount-with-tax').value) || 0,
        amount_without_tax: parseFloat(document.getElementById('cp-amount-without-tax').value) || 0,
        tax_amount: parseFloat(document.getElementById('cp-tax-amount').value) || 0,
        due_date: document.getElementById('cp-due-date').value,
        notes: document.getElementById('cp-notes').value
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
    // 4. Fallback: Fetch directly from API
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
        document.getElementById('rec-payment-id').value = cp.id;
        document.getElementById('rec-milestone-title').innerText = `${cp.project_name || cp.project_code || ''} - ${cp.milestone_name} (دفعة رقم ${cp.payment_number})`;
        document.getElementById('rec-total-due').innerText = formatMoney(cp.amount_with_tax);
        document.getElementById('rec-amount').value = cp.is_received ? cp.received_amount : (cp.amount_with_tax - (cp.received_amount || 0));
        document.getElementById('rec-date').value = cp.received_date || new Date().toISOString().split('T')[0];
        document.getElementById('rec-method').value = cp.payment_method || 'تحويل بنكي';
        document.getElementById('rec-voucher-no').value = cp.receipt_voucher_no || '';
        document.getElementById('rec-notes').value = cp.notes || '';
    } else {
        document.getElementById('rec-payment-id').value = paymentId || '';
        document.getElementById('rec-milestone-title').innerText = milestoneTitle || 'تسجيل استلام الدفعة';
        document.getElementById('rec-total-due').innerText = dueAmount ? formatMoney(dueAmount) : '0 ر.س';
        document.getElementById('rec-amount').value = dueAmount || 0;
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
            openProjectDetailModal(projectId);
            loadDashboardStats();
        } else {
            showToast(data.error || 'فشل حذف الدفعة', 'error');
        }
    } catch (err) {
        console.error('Error deleting client payment:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
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

function printProjectReport() {
    window.print();
}

// ----------------- EXPORT TO EXCEL (SHEETJS) -----------------
async function exportExpensesToExcel() {
    try {
        const res = await fetch('/api/expenses');
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
        const selects = ['expense-project-id', 'task-project-id', 'sub-project-id', 'doc-project-id', 'task-filter-project', 'expense-filter-project', 'rep-filter-project'];
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
    if (ctx) {
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
            <td class="p-3 text-center whitespace-nowrap">
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

function switchReportSubTab(subTabId) {
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

function printOfficialReport() {
    // Show all report panes during print so the printed report is truly complete
    document.querySelectorAll('.rep-pane').forEach(el => el.classList.remove('hidden'));
    window.print();
    // Restore active sub-tab after print dialog closes
    setTimeout(() => {
        switchReportSubTab('projects');
    }, 1000);
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
        
        let rowsHtml = '';
        if ((proj.payments || []).length === 0) {
            rowsHtml = `<tr><td colspan="8" class="p-4 text-center text-slate-500">${isEn ? 'No payment milestones for this project' : 'لا توجد دفعات مسجلة لهذا المشروع'}</td></tr>`;
        } else {
            rowsHtml = proj.payments.map(cp => {
                const isPaid = cp.is_received === 1 || cp.status === 'paid';
                const isPart = !isPaid && (cp.received_amount > 0 || cp.status === 'partially_paid');
                return `
                    <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/60">
                        <td class="p-3 text-center font-mono font-bold text-slate-400">${cp.payment_number || '-'}</td>
                        <td class="p-3">
                            <strong class="text-white text-xs block">${cp.milestone_name}</strong>
                            ${cp.receipt_voucher_no ? `<span class="text-[10px] text-emerald-400 font-mono block">سند: ${cp.receipt_voucher_no}</span>` : ''}
                        </td>
                        <td class="p-3 text-center font-bold text-amber-400 font-mono">${cp.percentage ? `${cp.percentage}%` : '-'}</td>
                        <td class="p-3 font-black text-emerald-400 font-mono">${formatCurrency(cp.amount_with_tax)}</td>
                        <td class="p-3 text-slate-400 font-mono text-[11px]">${formatCurrency(cp.tax_amount)}</td>
                        <td class="p-3 text-blue-400 font-mono text-[11px] font-bold">${formatCurrency(cp.amount_without_tax)}</td>
                        <td class="p-3 text-slate-400 font-mono text-[11px]">${cp.due_date || '-'}</td>
                        <td class="p-3 text-center">
                            ${isPaid ? `
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                                    <i data-lucide="check-check" class="w-3 h-3"></i>
                                    <span>${isEn ? 'Collected' : 'محصل بالكامل'} (${formatCurrency(cp.received_amount)})</span>
                                </span>
                            ` : isPart ? `
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
                                    <span>${isEn ? 'Partial' : 'محصل جزئياً'} (${formatCurrency(cp.received_amount)})</span>
                                </span>
                            ` : `
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-bold text-[10px]">
                                    <span>${isEn ? 'Pending' : 'قيد التحصيل'}</span>
                                </span>
                            `}
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
                </div>
                <div class="flex items-center gap-4 text-xs font-mono">
                    <span class="text-slate-400">${isEn ? 'Contract Value (Inc. Tax):' : 'قيمة العقد شامل الضريبة:'} <strong class="text-white">${formatCurrency(proj.total_milestones_with_tax || proj.contract_value)}</strong></span>
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
                            <th class="p-2.5 text-emerald-400">${isEn ? 'Amount (Inc. Tax)' : 'القيمة شاملة الضريبة'}</th>
                            <th class="p-2.5 text-slate-400">${isEn ? 'VAT 15%' : 'الضريبة (15%)'}</th>
                            <th class="p-2.5 text-blue-400">${isEn ? 'Amount (Exc. Tax)' : 'القيمة بدون ضريبة'}</th>
                            <th class="p-2.5 text-slate-400">${isEn ? 'Due Date' : 'تاريخ الاستحقاق'}</th>
                            <th class="p-2.5 text-center">${isEn ? 'Status' : 'حالة التحصيل'}</th>
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

// User switching and active session management
function initCurrentUser() {
    const saved = localStorage.getItem('segieny_current_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing stored user:', e);
        }
    }
    // Validate if the stored user exists in active team members list
    fetch('/api/team')
        .then(res => res.json())
        .then(team => {
            allTeamMembers = team;
            const valid = team.find(m => m.id === currentUser.id && m.name === currentUser.name);
            if (valid) {
                currentUser = { id: valid.id, name: valid.name, role: valid.role, phone: valid.phone || '' };
            } else if (team.length > 0) {
                currentUser = { id: team[0].id, name: team[0].name, role: team[0].role, phone: team[0].phone || '' };
                localStorage.setItem('segieny_current_user', JSON.stringify(currentUser));
            }
            updateUserUI();
            renderUserSwitcher(team);
        })
        .catch(err => {
            updateUserUI();
        });
}

function updateUserUI() {
    const nameEl = document.getElementById('active-user-name');
    const roleEl = document.getElementById('active-user-role');
    const charEl = document.getElementById('user-avatar-char');
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    if (nameEl) nameEl.innerText = isEn && typeof tr === 'function' ? tr(currentUser.name) : currentUser.name;
    if (roleEl) roleEl.innerText = isEn && typeof tr === 'function' ? tr(currentUser.role) : currentUser.role;
    if (charEl) {
        const displayName = isEn && typeof tr === 'function' ? tr(currentUser.name) : currentUser.name;
        const cleanName = displayName.replace(/^(م\.|أ\.|Eng\.)\s*/, '').trim();
        charEl.innerText = cleanName.charAt(0) || 'أ';
    }
}

async function loadTeamMembersForSwitcher() {
    try {
        const res = await fetch('/api/team');
        const team = await res.json();
        allTeamMembers = team;
        renderUserSwitcher(team);
    } catch (err) {
        console.error('Error loading team for switcher:', err);
    }
}

function renderUserSwitcher(team) {
    const list = document.getElementById('user-switch-list');
    if (!list) return;
    list.innerHTML = '';
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';

    team.forEach(m => {
        const isCurrent = m.id === currentUser.id;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `w-full text-right p-2 rounded-xl flex items-center justify-between text-xs transition ${isCurrent ? 'bg-emerald-600/20 text-emerald-400 font-bold border border-emerald-500/30' : 'hover:bg-slate-800 text-slate-300'}`;
        item.onclick = () => switchCurrentUser(m);
        const displayName = isEn && typeof tr === 'function' ? tr(m.name) : m.name;
        const cleanName = displayName.replace(/^(م\.|Eng\.)\s*/, '');
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full ${isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'} flex items-center justify-center text-[10px] font-bold">
                    ${cleanName.charAt(0)}
                </div>
                <div>
                    <span class="block text-white font-medium">${displayName}</span>
                    <span class="block text-[10px] text-slate-400">${isEn && typeof tr === 'function' ? tr(m.role) : m.role}</span>
                </div>
            </div>
            ${isCurrent ? '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>' : ''}
        `;
        list.appendChild(item);
    });

    initLucide();
}

function switchCurrentUser(member) {
    currentUser = {
        id: member.id,
        name: member.name,
        role: member.role,
        phone: member.phone || ''
    };
    localStorage.setItem('segieny_current_user', JSON.stringify(currentUser));
    const isEn = typeof currentLang !== 'undefined' && currentLang === 'en';
    
    updateUserUI();
    renderUserSwitcher(allTeamMembers);
    toggleUserMenu();

    const displayName = isEn && typeof tr === 'function' ? tr(currentUser.name) : currentUser.name;
    const displayRole = isEn && typeof tr === 'function' ? tr(currentUser.role) : currentUser.role;
    showToast(isEn ? `Active account switched to: ${displayName} (${displayRole})` : `تم تبديل الحساب الحالي إلى: ${displayName} (${displayRole})`);

    // If chat tab is active, refresh chat
    if (currentTab === 'chat') {
        loadChatChannels();
        loadChatMessages();
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
    const curCash = activeProject ? activeProject.current_cash : summary.current_net_cash;
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
        kpiPhaseProjDescEl.innerText = simPhaseData ? `رصيد الخزينة بنهاية المرحلة ${simPhaseData.order_num}` : 'رصيد الخزينة التراكمي للشركة';
    }

    const kpiFinalCashEl = document.getElementById('cf-kpi-final-cash');
    if (kpiFinalCashEl) {
        kpiFinalCashEl.innerText = formatMoney(finalCash);
        kpiFinalCashEl.className = `text-xl font-black mt-1 ${finalCash >= 0 ? 'text-emerald-300' : 'text-rose-400'}`;
    }
    const kpiFinalCashDescEl = document.getElementById('cf-kpi-final-cash-desc');
    if (kpiFinalCashDescEl) {
        kpiFinalCashDescEl.innerText = activeProject ? `صافي أرباح كاش مشروع ${activeProject.code}` : 'صافي رصيد كاش الشركة بعد التسليم الكامل';
    }

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
                <td class="p-3 text-center">${actionHtml}</td>
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
                <td class="p-3" colspan="2"></td>
            </tr>
        `;
    }

    initLucide();
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




