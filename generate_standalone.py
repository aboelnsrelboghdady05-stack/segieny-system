import sqlite3, json, os, re

def build_standalone():
    # 1. Connect to DB and extract all data
    conn = sqlite3.connect('segieny_contracting.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    def get_all(table):
        try:
            c.execute(f"SELECT * FROM {table}")
            return [dict(r) for r in c.fetchall()]
        except Exception:
            return []

    db_dump = {
        'projects': get_all('projects'),
        'project_phases': get_all('project_phases'),
        'phase_items': get_all('phase_items'),
        'expenses': get_all('expenses'),
        'expense_items': get_all('expense_items'),
        'suppliers': get_all('suppliers'),
        'supplier_quotations': get_all('supplier_quotations'),
        'supplier_payments': get_all('supplier_payments'),
        'subcontractors': get_all('subcontractors'),
        'client_payments': get_all('client_payments'),
        'team_members': get_all('team_members'),
        'custody_requests': get_all('custody_requests'),
        'notifications': get_all('notifications'),
        'hr_employees': get_all('hr_employees'),
        'hr_payrolls': get_all('hr_payrolls'),
        'hr_payroll_items': get_all('hr_payroll_items'),
        'hr_leaves': get_all('hr_leaves'),
        'hr_advances': get_all('hr_advances'),
        'company_settings': get_all('company_settings')
    }
    conn.close()

    # 2. Read templates/index.html
    with open('templates/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 3. Read static/css/app.css
    with open('static/css/app.css', 'r', encoding='utf-8') as f:
        custom_css = f.read()

    # 4. Read static/js/i18n.js
    with open('static/js/i18n.js', 'r', encoding='utf-8') as f:
        i18n_js = f.read()

    # 5. Read static/js/app.js
    with open('static/js/app.js', 'r', encoding='utf-8') as f:
        app_js = f.read()

    # 6. Build Client API Bridge
    client_api_bridge = f"""// ==========================================
// SEGIENY STANDALONE OFFLINE / LIVE API BRIDGE
// ==========================================
(function() {{
    const INITIAL_DB = {json.dumps(db_dump, ensure_ascii=False)};
    
    function getDB() {{
        try {{
            const stored = JSON.parse(localStorage.getItem('segieny_standalone_db_v5'));
            if (!stored) return INITIAL_DB;

            const merged = Object.assign({{}}, INITIAL_DB);

            // 1. Team members (users): combine and preserve added users like fatima
            const teamMap = new Map();
            (INITIAL_DB.team_members || []).forEach(m => teamMap.set(String(m.id || m.username).toLowerCase(), m));
            (stored.team_members || []).forEach(m => teamMap.set(String(m.id || m.username).toLowerCase(), m));
            merged.team_members = Array.from(teamMap.values());

            // 2. HR employees: preserve user modifications & additions
            if (stored.hr_employees && Array.isArray(stored.hr_employees) && stored.hr_employees.length > 0) {{
                merged.hr_employees = stored.hr_employees;
            }} else {{
                merged.hr_employees = INITIAL_DB.hr_employees || [];
            }}

            // 3. Client payments: preserve user collection payments
            if (stored.client_payments && Array.isArray(stored.client_payments) && stored.client_payments.length > 0) {{
                const payMap = new Map();
                (INITIAL_DB.client_payments || []).forEach(cp => payMap.set(Number(cp.id), cp));
                (stored.client_payments || []).forEach(cp => {{
                    const existing = payMap.get(Number(cp.id));
                    if (existing) {{
                        payMap.set(Number(cp.id), Object.assign({{}}, existing, cp));
                    }} else {{
                        payMap.set(Number(cp.id), cp);
                    }}
                }});
                merged.client_payments = Array.from(payMap.values());
            }} else {{
                merged.client_payments = INITIAL_DB.client_payments || [];
            }}

            // 4. Expenses: preserve existing plus latest
            const expMap = new Map();
            (INITIAL_DB.expenses || []).forEach(e => expMap.set(Number(e.id), e));
            (stored.expenses || []).forEach(e => {{
                if (!expMap.has(Number(e.id))) expMap.set(Number(e.id), e);
            }});
            merged.expenses = Array.from(expMap.values());

            // 5. Projects
            const projMap = new Map();
            (INITIAL_DB.projects || []).forEach(p => projMap.set(Number(p.id), p));
            (stored.projects || []).forEach(p => {{
                const base = projMap.get(Number(p.id));
                if (base) {{
                    projMap.set(Number(p.id), Object.assign({{}}, base, p));
                }} else {{
                    projMap.set(Number(p.id), p);
                }}
            }});
            merged.projects = Array.from(projMap.values());

            return merged;
        }} catch(e) {{
            return INITIAL_DB;
        }}
    }}
    
    function saveDB(data) {{
        try {{
            localStorage.setItem('segieny_standalone_db_v5', JSON.stringify(data));
        }} catch(e) {{
            console.error('Error saving standalone DB:', e);
        }}
    }}

    const originalFetch = window.fetch;
    
    window.fetch = async function(url, options = {{}}) {{
        const urlStr = typeof url === 'string' ? url : (url.url || '');
        const method = (options.method || 'GET').toUpperCase();
        
        let body = {{}};
        if (options.body) {{
            if (options.body instanceof FormData) {{
                options.body.forEach((val, key) => {{
                    body[key] = val;
                }});
            }} else if (typeof options.body === 'string') {{
                try {{
                    body = JSON.parse(options.body);
                }} catch(e) {{
                    body = {{}};
                }}
            }}
        }}

        // If it's not an API call, let normal fetch handle it
        if (!urlStr.includes('/api/')) {{
            return originalFetch.apply(this, arguments);
        }}

        const db = getDB();

        // 1. Auth routes
        if (urlStr.includes('/api/auth/login')) {{
            const rawUser = String(body.username || body.phone || '').trim().toLowerCase();
            const rawPass = String(body.password || body.national_id || '').trim();

            function norm(s) {{
                return String(s || '').toLowerCase()
                    .replace(/[أإآ]/g, 'ا')
                    .replace(/ة/g, 'ه')
                    .replace(/[\\s\\.\\-_]/g, '');
            }}
            const nUser = norm(rawUser);

            let matched = (db.team_members || []).find(m => {{
                const u = norm(m.username);
                const n = norm(m.name);
                const r = norm(m.role);
                const p = norm(m.phone);
                const e = norm(m.email);
                if (['admin', 'root', 'abuelnasr', 'aboelnsr', '1', 'المديرالمالي', 'مديرمالي'].includes(nUser) && (m.id === 1 || u === 'baghdadi')) return true;
                if (['jihad', 'جهاد', 'مهندسجهاد', 'مجهاد'].includes(nUser) && (u === 'jihad' || n.includes('جهاد'))) return true;
                if (['nawaf', 'نواف', 'سجيني', 'نوافسجيني', 'المديرالعام'].includes(nUser) && (u === 'nawaf' || n.includes('نواف') || n.includes('سجيني'))) return true;
                if (nUser && (nUser === u || n.includes(nUser) || nUser.includes(n) || nUser === p || e.includes(nUser) || r.includes(nUser))) return true;
                return false;
            }});

            if (!matched) {{
                matched = (db.team_members || []).find(m => m.id === 1) || {{
                    id: 1,
                    name: 'ابوالنصر البغدادي',
                    role: 'المدير المالي',
                    username: 'baghdadi',
                    phone: '0501234567',
                    email: 'baghdadi@segieny.sa',
                    status: 'active',
                    permissions: 'all',
                    is_admin: true
                }};
            }}

            const validPasswords = ['123', 'admin', '123456', '1234', 'baghdadi', String(matched.password || '123')];
            if (!validPasswords.includes(rawPass)) {{
                return new Response(JSON.stringify({{ error: 'كلمة المرور غير صحيحة، يرجى كتابة 123' }}), {{ status: 401, headers: {{ 'Content-Type': 'application/json' }} }});
            }}

            const user = Object.assign({{}}, matched);
            user.is_admin = (user.id === 1 || String(user.username).toLowerCase() === 'baghdadi' || (user.name && user.name.includes('ابوالنصر')));
            if (user.is_admin) user.permissions = 'all';
            delete user.password;

            localStorage.setItem('segieny_user', JSON.stringify(user));
            localStorage.setItem('segieny_auth_user', JSON.stringify(user));
            localStorage.setItem('segieny_current_user', JSON.stringify(user));
            sessionStorage.setItem('segieny_session_active', 'true');

            return new Response(JSON.stringify({{ success: true, user: user }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/auth/logout')) {{
            localStorage.removeItem('segieny_user');
            localStorage.removeItem('segieny_auth_user');
            localStorage.removeItem('segieny_current_user');
            sessionStorage.removeItem('segieny_session_active');
            return new Response(JSON.stringify({{ success: true }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/auth/user')) {{
            const u = localStorage.getItem('segieny_auth_user') || localStorage.getItem('segieny_user');
            if (u) return new Response(JSON.stringify({{ authenticated: true, user: JSON.parse(u) }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            return new Response(JSON.stringify({{ authenticated: false }}), {{ status: 401, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/auth/users') || urlStr.includes('/api/team')) {{
            db.team_members = db.team_members || [];
            if (method === 'GET') {{
                const list = db.team_members.map(m => Object.assign({{}}, m, {{
                    is_admin: (m.id === 1 || String(m.username).toLowerCase() === 'baghdadi' || (m.name && m.name.includes('ابوالنصر')))
                }}));
                return new Response(JSON.stringify(list), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'POST') {{
                const newMember = Object.assign({{
                    id: (db.team_members.length ? Math.max(...db.team_members.map(m => Number(m.id) || 0)) : 0) + 1,
                    status: 'active',
                    permissions: body.permissions || 'all'
                }}, body);
                db.team_members.push(newMember);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تمت إضافة المستخدم بنجاح', id: newMember.id }}), {{ status: 201, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'PUT') {{
                const id = parseInt(urlStr.split('/').pop());
                const idx = db.team_members.findIndex(m => m.id === id);
                if (idx !== -1) {{
                    db.team_members[idx] = Object.assign(db.team_members[idx], body);
                    saveDB(db);
                    return new Response(JSON.stringify({{ success: true, message: 'تم تحديث بيانات المستخدم بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                return new Response(JSON.stringify({{ error: 'المستخدم غير موجود' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'DELETE') {{
                const id = parseInt(urlStr.split('/').pop());
                db.team_members = db.team_members.filter(m => m.id !== id);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم حذف المستخدم بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            return new Response(JSON.stringify({{ success: true }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 2. Project details
        if (urlStr.match(/\\/api\\/projects\\/\\d+$/) && method === 'GET') {{
            const parts = urlStr.split('/');
            const id = parseInt(parts[parts.length - 1]);
            const proj = db.projects.find(p => p.id === id);
            if (!proj) return new Response(JSON.stringify({{ error: 'Not found' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
            
            const pExps = (db.expenses || []).filter(e => e.project_id === id);
            const spent = pExps.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            const phases = (db.project_phases || []).filter(ph => ph.project_id === id).map(ph => {{
                const items = (db.phase_items || []).filter(it => it.phase_id === ph.id);
                const itCost = items.reduce((s, it) => s + (parseFloat(it.cost_price) || 0), 0);
                return Object.assign({{}}, ph, {{
                    items: items,
                    effective_cost: itCost > 0 ? itCost : (parseFloat(ph.cost_price) || 0),
                    effective_selling: parseFloat(ph.selling_price) || 0,
                    actual_spent: (db.expenses || []).filter(e => e.phase_id === ph.id).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
                }});
            }});
            const totPhasesCost = phases.reduce((s, ph) => s + (ph.effective_cost || 0), 0);
            const totPhasesSelling = phases.reduce((s, ph) => s + (ph.effective_selling || 0), 0);
            const contractVal = parseFloat(proj.contract_value) || 0;
            const effectiveSelling = contractVal > 0 ? contractVal : totPhasesSelling;

            const isManualBudget = proj.budget_mode === 'manual' && proj.manual_remaining_budget !== null && proj.manual_remaining_budget !== undefined;
            const remainingBudget = isManualBudget ? parseFloat(proj.manual_remaining_budget) : Math.max(0, totPhasesCost > 0 ? totPhasesCost - spent : contractVal - spent);
            const totalEstBudget = isManualBudget ? (spent + parseFloat(proj.manual_remaining_budget)) : totPhasesCost;

            const detailed = Object.assign({{}}, proj, {{
                phases: phases,
                total_spent: spent,
                total_phases_cost: totalEstBudget,
                total_phases_selling: effectiveSelling,
                total_phases_profit: effectiveSelling - totalEstBudget,
                remaining_budget: remainingBudget,
                budget_mode: proj.budget_mode || 'boq',
                manual_remaining_budget: proj.manual_remaining_budget,
                expenses: pExps,
                client_payments: (db.client_payments || []).filter(cp => cp.project_id === id)
            }});
            return new Response(JSON.stringify(detailed), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // Quick update for budget mode
        if (urlStr.match(/\\/api\\/projects\\/\\d+\\/budget-mode$/) && method === 'POST') {{
            const parts = urlStr.split('/');
            const id = parseInt(parts[parts.length - 2]);
            const proj = (db.projects || []).find(p => p.id === id);
            if (proj) {{
                proj.budget_mode = body.budget_mode || 'boq';
                proj.manual_remaining_budget = (body.budget_mode === 'manual' && body.manual_remaining_budget !== null && body.manual_remaining_budget !== undefined && body.manual_remaining_budget !== '') ? parseFloat(body.manual_remaining_budget) : null;
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم تحديث ميزانية المشروع بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            return new Response(JSON.stringify({{ error: 'المشروع غير موجود' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.match(/\\/api\\/projects\\/\\d+$/) && method === 'PUT') {{
            const parts = urlStr.split('/');
            const id = parseInt(parts[parts.length - 1]);
            const existing = (db.projects || []).find(p => p.id === id);
            if (existing) {{
                Object.assign(existing, body);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم تحديث بيانات المشروع بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            return new Response(JSON.stringify({{ error: 'المشروع غير موجود' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.includes('/api/projects') && method === 'POST') {{
            const newProj = Object.assign({{
                id: (db.projects.length ? Math.max(...db.projects.map(p => p.id)) : 0) + 1,
                created_at: new Date().toISOString()
            }}, body);
            db.projects.unshift(newProj);
            saveDB(db);
            return new Response(JSON.stringify({{ success: true, message: 'تم إنشاء المشروع بنجاح', id: newProj.id }}), {{ status: 201, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 3. Projects list
        if (urlStr.includes('/api/projects') && method === 'GET') {{
            const projsWithStats = db.projects.map(p => {{
                const pExps = (db.expenses || []).filter(e => e.project_id === p.id);
                const spent = pExps.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                const pPhases = (db.project_phases || []).filter(ph => ph.project_id === p.id);
                const pPhasesCost = pPhases.reduce((s, ph) => s + (parseFloat(ph.cost_price) || 0), 0);
                const isManualBudget = p.budget_mode === 'manual' && p.manual_remaining_budget !== null && p.manual_remaining_budget !== undefined;
                const bBase = isManualBudget ? (spent + parseFloat(p.manual_remaining_budget)) : (pPhasesCost > 0 ? pPhasesCost : (parseFloat(p.contract_value) || 0));
                const remaining = isManualBudget ? parseFloat(p.manual_remaining_budget) : Math.max(0, bBase - spent);
                return Object.assign({{}}, p, {{
                    total_spent: spent,
                    total_phases_cost: pPhasesCost,
                    remaining_budget: remaining,
                    expenses_count: pExps.length
                }});
            }});
            return new Response(JSON.stringify(projsWithStats), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 3.5 Client Payments (استحقاقات وتحصيلات العملاء)
        if (urlStr.includes('/api/client-payments')) {{
            db.client_payments = db.client_payments || [];

            // Receive payment
            if (urlStr.match(/\\/api\\/client-payments\\/\\d+\\/receive$/) && method === 'POST') {{
                const parts = urlStr.split('/');
                const id = parseInt(parts[parts.length - 2]);
                const cp = db.client_payments.find(p => p.id === id);
                if (cp) {{
                    const recAmt = body.received_amount !== undefined ? (parseFloat(body.received_amount) || 0) : (parseFloat(cp.amount_with_tax) || 0);
                    cp.is_received = 1;
                    cp.received_amount = recAmt;
                    cp.received_date = body.received_date || new Date().toISOString().split('T')[0];
                    cp.status = 'paid';
                    cp.notes = body.notes || cp.notes || '';
                    saveDB(db);
                    return new Response(JSON.stringify({{ success: true, message: 'تم تسجيل تحصيل الدفعة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                return new Response(JSON.stringify({{ error: 'الدفعة غير موجودة' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
            }}

            // Reset payment receipt
            if (urlStr.match(/\\/api\\/client-payments\\/\\d+\\/reset$/) && method === 'POST') {{
                const parts = urlStr.split('/');
                const id = parseInt(parts[parts.length - 2]);
                const cp = db.client_payments.find(p => p.id === id);
                if (cp) {{
                    cp.is_received = 0;
                    cp.received_amount = 0.0;
                    cp.received_date = null;
                    cp.status = 'pending';
                    saveDB(db);
                    return new Response(JSON.stringify({{ success: true, message: 'تم إلغاء تحصيل الدفعة وإعادتها لحالة الانتظار' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                return new Response(JSON.stringify({{ error: 'الدفعة غير موجودة' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
            }}

            // Auto-allocate preview
            if (urlStr.includes('/auto-allocate-preview')) {{
                const mPrj = urlStr.match(/project_id=([^&]+)/);
                const mAmt = urlStr.match(/amount=([^&]+)/);
                const projId = mPrj ? parseInt(mPrj[1]) : 0;
                let remainAlloc = mAmt ? (parseFloat(mAmt[1]) || 0) : 0;
                const pays = db.client_payments.filter(cp => cp.project_id === projId).sort((a,b) => (a.payment_number || 0) - (b.payment_number || 0));
                const plan = [];
                pays.forEach(cp => {{
                    const due = parseFloat(cp.amount_with_tax) || 0;
                    const curRecv = parseFloat(cp.received_amount) || 0;
                    const need = Math.max(0, due - curRecv);
                    if (need > 0 && remainAlloc > 0) {{
                        const alloc = Math.min(need, remainAlloc);
                        remainAlloc -= alloc;
                        plan.push({{
                            id: cp.id,
                            name: cp.name,
                            payment_number: cp.payment_number,
                            amount_with_tax: due,
                            currently_received: curRecv,
                            allocated: alloc,
                            remaining_after: need - alloc,
                            will_be_fully_paid: (curRecv + alloc) >= due
                        }});
                    }}
                }});
                return new Response(JSON.stringify({{ success: true, plan: plan, surplus: remainAlloc }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}

            // Auto-allocate execution
            if (urlStr.includes('/auto-allocate') && method === 'POST') {{
                const projId = parseInt(body.project_id);
                let remainAlloc = parseFloat(body.amount) || 0;
                const recDate = body.payment_date || new Date().toISOString().split('T')[0];
                const pays = db.client_payments.filter(cp => cp.project_id === projId).sort((a,b) => (a.payment_number || 0) - (b.payment_number || 0));
                pays.forEach(cp => {{
                    if (remainAlloc <= 0) return;
                    const due = parseFloat(cp.amount_with_tax) || 0;
                    const curRecv = parseFloat(cp.received_amount) || 0;
                    const need = Math.max(0, due - curRecv);
                    if (need > 0) {{
                        const alloc = Math.min(need, remainAlloc);
                        cp.received_amount = curRecv + alloc;
                        remainAlloc -= alloc;
                        cp.received_date = recDate;
                        cp.is_received = cp.received_amount >= due ? 1 : 0;
                        cp.status = cp.received_amount >= due ? 'paid' : 'partially_paid';
                    }}
                }});
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم تسوية وتوزيع الدفعة على المستحقات بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}

            // Update / Delete by ID
            if (urlStr.match(/\\/api\\/client-payments\\/\\d+$/)) {{
                const id = parseInt(urlStr.split('/').pop());
                if (method === 'PUT') {{
                    const cp = db.client_payments.find(p => p.id === id);
                    if (cp) {{
                        Object.assign(cp, body);
                        saveDB(db);
                        return new Response(JSON.stringify({{ success: true, message: 'تم تحديث بيانات الدفعة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                    }}
                }} else if (method === 'DELETE') {{
                    db.client_payments = db.client_payments.filter(p => p.id !== id);
                    saveDB(db);
                    return new Response(JSON.stringify({{ success: true, message: 'تم حذف الدفعة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
            }}

            // Create new payment
            if (method === 'POST') {{
                const count = db.client_payments.length ? Math.max(...db.client_payments.map(p => p.id || 0)) : 0;
                const newCp = Object.assign({{
                    id: count + 1,
                    status: 'pending',
                    is_received: 0,
                    received_amount: 0.0,
                    created_at: new Date().toISOString()
                }}, body);
                db.client_payments.push(newCp);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم حفظ الدفعة بنجاح', id: newCp.id }}), {{ status: 201, headers: {{ 'Content-Type': 'application/json' }} }});
            }}

            // List payments
            const m = urlStr.match(/project_id=([^&]+)/);
            let result = db.client_payments;
            if (m && m[1]) {{
                result = db.client_payments.filter(cp => String(cp.project_id) === String(m[1]));
            }}
            return new Response(JSON.stringify({{ success: true, payments: result }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 4. Expenses
        if (urlStr.includes('/api/expenses') && method === 'GET') {{
            const exps = db.expenses.map(e => {{
                const p = db.projects.find(pj => pj.id === e.project_id);
                const s = db.suppliers.find(sp => sp.id === e.supplier_id);
                const cust = e.custody_id ? db.custody_requests.find(c => c.id === e.custody_id) : null;
                return Object.assign({{}}, e, {{
                    project_name: p ? p.name : null,
                    project_code: p ? p.code : null,
                    supplier_name: s ? s.name : null,
                    custody_employee_name: cust ? cust.employee_name : null,
                    custody_request_number: cust ? cust.request_number : null
                }});
            }});
            return new Response(JSON.stringify(exps), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.includes('/api/expenses') && method === 'POST') {{
            const newExp = Object.assign({{
                id: (db.expenses.length ? Math.max(...db.expenses.map(e => e.id)) : 0) + 1,
                created_at: new Date().toISOString()
            }}, body);

            if (newExp.custody_id) {{
                const cId = parseInt(newExp.custody_id);
                const cust = (db.custody_requests || []).find(c => c.id === cId);
                if (cust) {{
                    cust.spent_amount = (parseFloat(cust.spent_amount) || 0) + (parseFloat(newExp.amount) || 0);
                }}
            }}

            db.expenses.unshift(newExp);
            saveDB(db);
            return new Response(JSON.stringify({{ success: true, message: 'تم حفظ المصروف بنجاح', id: newExp.id }}), {{ status: 201, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.match(/\\/api\\/expenses\\/\\d+$/) && method === 'PUT') {{
            const parts = urlStr.split('/');
            const id = parseInt(parts[parts.length - 1]);
            const existing = (db.expenses || []).find(e => e.id === id);
            if (existing) {{
                const oldAmt = parseFloat(existing.amount) || 0;
                const oldCustId = existing.custody_id ? parseInt(existing.custody_id) : null;
                const newAmt = body.amount !== undefined ? (parseFloat(body.amount) || 0) : oldAmt;
                const newCustId = body.custody_id ? parseInt(body.custody_id) : (body.payment_method === 'عهدة' ? oldCustId : null);

                // Adjust custody balances
                if (oldCustId && oldCustId === newCustId) {{
                    const cust = (db.custody_requests || []).find(c => c.id === oldCustId);
                    if (cust) cust.spent_amount = Math.max(0, (parseFloat(cust.spent_amount) || 0) + (newAmt - oldAmt));
                }} else {{
                    if (oldCustId) {{
                        const oldCust = (db.custody_requests || []).find(c => c.id === oldCustId);
                        if (oldCust) oldCust.spent_amount = Math.max(0, (parseFloat(oldCust.spent_amount) || 0) - oldAmt);
                    }}
                    if (newCustId) {{
                        const newCust = (db.custody_requests || []).find(c => c.id === newCustId);
                        if (newCust) newCust.spent_amount = (parseFloat(newCust.spent_amount) || 0) + newAmt;
                    }}
                }}

                Object.assign(existing, body);
                existing.amount = newAmt;
                existing.custody_id = newCustId;
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم تحديث بيانات المصروف بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            return new Response(JSON.stringify({{ error: 'المصروف غير موجود' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.match(/\\/api\\/expenses\\/\\d+$/) && method === 'DELETE') {{
            const parts = urlStr.split('/');
            const id = parseInt(parts[parts.length - 1]);
            const exp = (db.expenses || []).find(e => e.id === id);
            if (exp && exp.custody_id) {{
                const cust = (db.custody_requests || []).find(c => c.id === parseInt(exp.custody_id));
                if (cust) {{
                    cust.spent_amount = Math.max(0, (parseFloat(cust.spent_amount) || 0) - (parseFloat(exp.amount) || 0));
                }}
            }}
            db.expenses = (db.expenses || []).filter(e => e.id !== id);
            saveDB(db);
            return new Response(JSON.stringify({{ success: true, message: 'تم حذف المصروف واسترجاع المبلغ للعهدة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 5. Custody Active endpoint
        if (urlStr.includes('/api/custody/active')) {{
            const active = (db.custody_requests || []).filter(c => c.status === 'disbursed' || c.status === 'approved').map(c => {{
                const p = (db.projects || []).find(pj => pj.id === c.project_id);
                const disbursed = parseFloat(c.disbursed_amount) || parseFloat(c.amount) || 0;
                const spent = parseFloat(c.spent_amount) || 0;
                return Object.assign({{}}, c, {{
                    project_name: p ? p.name : null,
                    project_code: p ? p.code : null,
                    remaining_balance: Math.max(0, disbursed - spent)
                }});
            }});
            return new Response(JSON.stringify(active), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 6. Custody Expenses endpoint
        if (urlStr.includes('/expenses') && urlStr.includes('/api/custody/')) {{
            const parts = urlStr.split('?')[0].split('/');
            const id = parseInt(parts[parts.indexOf('custody') + 1]);
            const cust = (db.custody_requests || []).find(c => c.id === id);
            const p = cust ? (db.projects || []).find(pj => pj.id === cust.project_id) : null;
            const custodyWithProj = cust ? Object.assign({{}}, cust, {{ project_name: p ? p.name : null, project_code: p ? p.code : null }}) : null;
            const exps = (db.expenses || []).filter(e => e.custody_id && parseInt(e.custody_id) === id).map(e => {{
                const ep = (db.projects || []).find(pj => pj.id === e.project_id);
                const es = (db.suppliers || []).find(s => s.id === e.supplier_id);
                return Object.assign({{}}, e, {{
                    project_name: ep ? ep.name : null,
                    supplier_name: es ? es.name : null
                }});
            }});
            const totalSpent = exps.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            const disbursed = cust ? (parseFloat(cust.disbursed_amount) || parseFloat(cust.amount) || 0) : 0;
            return new Response(JSON.stringify({{
                custody: custodyWithProj,
                expenses: exps,
                count: exps.length,
                total_spent: totalSpent,
                remaining_balance: Math.max(0, disbursed - totalSpent)
            }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 7. Custody (العهد)
        if (urlStr.includes('/api/custody')) {{
            if (method === 'GET') {{
                const parts = urlStr.split('?')[0].split('/');
                const lastPart = parts[parts.length - 1];
                if (lastPart !== 'custody' && !isNaN(parseInt(lastPart))) {{
                    const id = parseInt(lastPart);
                    const item = (db.custody_requests || []).find(r => r.id === id);
                    if (item) {{
                        const p = (db.projects || []).find(pj => pj.id === item.project_id);
                        const cWithP = Object.assign({{}}, item, {{
                            project_name: p ? p.name : null,
                            project_code: p ? p.code : null,
                            remaining_balance: Math.max(0, (parseFloat(item.disbursed_amount) || parseFloat(item.amount) || 0) - (parseFloat(item.spent_amount) || 0))
                        }});
                        return new Response(JSON.stringify({{ success: true, custody: cWithP, ...cWithP }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                    }}
                    return new Response(JSON.stringify({{ error: 'غير موجود' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
                }}

                const reqs = db.custody_requests.map(c => {{
                    const p = db.projects.find(pj => pj.id === c.project_id);
                    return Object.assign({{}}, c, {{
                        project_name: p ? p.name : null,
                        project_code: p ? p.code : null
                    }});
                }});
                const summary = {{
                    total_count: reqs.length,
                    pending_count: reqs.filter(r => r.status === 'pending').length,
                    pending_amount: reqs.filter(r => r.status === 'pending').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
                    approved_count: reqs.filter(r => r.status === 'approved').length,
                    approved_amount: reqs.filter(r => r.status === 'approved').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
                    disbursed_count: reqs.filter(r => r.status === 'disbursed').length,
                    total_disbursed_active: reqs.filter(r => r.status === 'disbursed').reduce((s, r) => s + (parseFloat(r.disbursed_amount) || 0), 0),
                    settled_count: reqs.filter(r => r.status === 'settled').length,
                    total_settled_spent: reqs.filter(r => r.status === 'settled').reduce((s, r) => s + (parseFloat(r.spent_amount) || 0), 0),
                    grand_total_disbursed: reqs.reduce((s, r) => s + (parseFloat(r.disbursed_amount) || 0), 0)
                }};
                return new Response(JSON.stringify({{ requests: reqs, summary: summary }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            
            if (method === 'PUT') {{
                const parts = urlStr.split('?')[0].split('/');
                const id = parseInt(parts[parts.length - 1]);
                const item = (db.custody_requests || []).find(r => r.id === id);
                if (item) {{
                    if (body.employee_name !== undefined) item.employee_name = body.employee_name;
                    if (body.project_id !== undefined) item.project_id = body.project_id ? parseInt(body.project_id) : null;
                    if (body.amount !== undefined) item.amount = parseFloat(body.amount) || item.amount;
                    if (body.purpose !== undefined) item.purpose = body.purpose;
                    if (body.request_date !== undefined) item.request_date = body.request_date;
                    if (body.notes !== undefined) item.notes = body.notes;
                    saveDB(db);
                    return new Response(JSON.stringify({{ success: true, message: 'تم تحديث بيانات العهدة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                return new Response(JSON.stringify({{ error: 'طلب العهدة غير موجود' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
            }}

            if (method === 'POST') {{
                if (urlStr.includes('/approve')) {{
                    const id = parseInt(urlStr.split('/')[3]);
                    const item = db.custody_requests.find(r => r.id === id);
                    if (item) {{
                        item.status = 'approved';
                        item.approved_by = body.approved_by || 'المدير المالي';
                        item.approved_at = new Date().toISOString();
                        saveDB(db);
                    }}
                    return new Response(JSON.stringify({{ message: 'تم اعتماد طلب العهدة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                if (urlStr.includes('/reject')) {{
                    const id = parseInt(urlStr.split('/')[3]);
                    const item = db.custody_requests.find(r => r.id === id);
                    if (item) {{
                        item.status = 'rejected';
                        item.approval_notes = body.rejection_notes || '';
                        saveDB(db);
                    }}
                    return new Response(JSON.stringify({{ message: 'تم رفض طلب العهدة' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                if (urlStr.includes('/disburse')) {{
                    const id = parseInt(urlStr.split('/')[3]);
                    const item = db.custody_requests.find(r => r.id === id);
                    if (item) {{
                        item.status = 'disbursed';
                        item.disbursed_amount = parseFloat(body.disbursed_amount) || item.amount;
                        item.disbursed_date = body.disbursed_date || new Date().toISOString().split('T')[0];
                        item.payment_method = body.payment_method || 'نقدي';
                        item.receipt_voucher_no = body.receipt_voucher_no || '';
                        item.disbursement_notes = body.disbursement_notes || '';
                        item.disbursed_by = body.disbursed_by || 'المدير المالي';
                        
                        if (body.record_as_expense && item.project_id) {{
                            db.expenses.unshift({{
                                id: (db.expenses.length ? Math.max(...db.expenses.map(e => e.id)) : 0) + 1,
                                project_id: item.project_id,
                                title: `عهدة منصرفة - ${{item.employee_name}} (${{item.purpose}})`,
                                category: 'نثريات وإداريات',
                                amount: item.disbursed_amount,
                                payment_method: 'عهدة',
                                paid_by: item.disbursed_by,
                                paid_to: item.employee_name,
                                expense_date: item.disbursed_date,
                                is_tax_invoice: 0,
                                amount_without_tax: item.disbursed_amount,
                                tax_amount: 0,
                                payment_status: 'paid'
                            }});
                        }}
                        saveDB(db);
                    }}
                    return new Response(JSON.stringify({{ message: 'تم تسجيل صرف العهدة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                if (urlStr.includes('/settle')) {{
                    const id = parseInt(urlStr.split('/')[3]);
                    const item = db.custody_requests.find(r => r.id === id);
                    if (item) {{
                        item.status = 'settled';
                        item.spent_amount = parseFloat(body.spent_amount) || item.disbursed_amount;
                        item.returned_amount = parseFloat(body.returned_amount) || 0;
                        item.settlement_date = body.settlement_date || new Date().toISOString().split('T')[0];
                        item.settlement_notes = body.settlement_notes || '';
                        item.settled_by = body.settled_by || 'المدير المالي';
                        saveDB(db);
                    }}
                    return new Response(JSON.stringify({{ message: 'تمت تصفية وإغلاق العهدة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                
                // Create new custody
                const count = db.custody_requests.length + 1;
                const newCust = {{
                    id: count,
                    request_number: `CUST-2026-${{String(count).padStart(4, '0')}}`,
                    employee_name: body.employee_name || 'موظف',
                    project_id: body.project_id ? parseInt(body.project_id) : null,
                    amount: parseFloat(body.amount) || 0,
                    purpose: body.purpose || '',
                    request_date: body.request_date || new Date().toISOString().split('T')[0],
                    notes: body.notes || '',
                    status: 'pending'
                }};
                db.custody_requests.unshift(newCust);
                saveDB(db);
                return new Response(JSON.stringify({{ message: 'تم رفع طلب العهدة بنجاح، بانتظار الاعتماد', id: newCust.id, request_number: newCust.request_number }}), {{ status: 201, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            
            if (method === 'DELETE') {{
                const parts = urlStr.split('?')[0].split('/');
                const id = parseInt(parts[parts.length - 1]);
                const deleteExpenses = urlStr.includes('delete_expenses=1') || urlStr.includes('delete_expenses=true');
                if (deleteExpenses) {{
                    db.expenses = (db.expenses || []).filter(e => parseInt(e.custody_id) !== id);
                }} else {{
                    (db.expenses || []).forEach(e => {{
                        if (parseInt(e.custody_id) === id) e.custody_id = null;
                    }});
                }}
                db.custody_requests = (db.custody_requests || []).filter(r => r.id !== id);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم حذف طلب العهدة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
        }}
        
        // 8. Suppliers & Subcontractors & Tasks & Notifications
        if (urlStr.includes('/api/suppliers')) {{
            return new Response(JSON.stringify(db.suppliers), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/subcontractors')) {{
            return new Response(JSON.stringify(db.subcontractors), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/tasks')) {{
            return new Response(JSON.stringify(db.tasks || []), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/notifications')) {{
            return new Response(JSON.stringify(db.notifications || []), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        
        // 9. Dashboard Stats
        if (urlStr.includes('/api/dashboard/stats')) {{
            const totContract = db.projects.reduce((s, p) => s + (parseFloat(p.contract_value) || 0), 0);
            const totSpent = db.expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            const totRecv = db.client_payments.reduce((s, cp) => s + (parseFloat(cp.received_amount) || 0), 0);
            const stats = {{
                total_projects: db.projects.length,
                total_contract_value: totContract,
                total_spent: totSpent,
                remaining_budget: Math.max(0, totContract - totSpent),
                total_received: totRecv,
                total_pending: Math.max(0, totContract - totRecv),
                total_invoices: db.expenses.length,
                active_custody_balance: db.custody_requests.filter(c => c.status === 'disbursed').reduce((s, c) => s + (parseFloat(c.disbursed_amount) || 0), 0)
            }};
            return new Response(JSON.stringify(stats), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 9.5 Cash Flow & Settings Offline Routes
        if (urlStr.includes('/api/settings/opening-cash')) {{
            db.company_settings = db.company_settings || [];
            if (method === 'POST') {{
                const val = parseFloat(body.opening_cash_balance !== undefined ? body.opening_cash_balance : 300000.0);
                const s = db.company_settings.find(x => x.key === 'opening_cash_balance');
                if (s) {{
                    s.value = String(val);
                }} else {{
                    db.company_settings.push({{ key: 'opening_cash_balance', value: String(val) }});
                }}
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, opening_cash_balance: val, message: 'تم تحديث الرصيد الافتتاحي للسيولة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            const s = db.company_settings.find(x => x.key === 'opening_cash_balance');
            const val = s ? parseFloat(s.value) : 300000.0;
            return new Response(JSON.stringify({{ success: true, opening_cash_balance: val }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.includes('/api/cashflow')) {{
            db.company_settings = db.company_settings || [];
            const s = db.company_settings.find(x => x.key === 'opening_cash_balance');
            const opening_cash = s ? parseFloat(s.value) : 300000.0;

            let prjId = null;
            let simNum = 1;
            try {{
                const u = new URL(urlStr, window.location.href);
                prjId = u.searchParams.get('project_id');
                simNum = parseInt(u.searchParams.get('simulate_phase') || '1');
            }} catch(e) {{
                const mPrj = urlStr.match(/project_id=([^&]+)/);
                if (mPrj) prjId = mPrj[1];
                const mSim = urlStr.match(/simulate_phase=([^&]+)/);
                if (mSim) simNum = parseInt(mSim[1]) || 1;
            }}

            let company_tot_contract = 0, company_tot_received = 0, company_tot_spent = 0, company_tot_pending_inflow = 0, company_tot_remaining_cost = 0, company_tot_final_cash = 0;
            const all_projects_cashflow = [];

            (db.projects || []).forEach(p => {{
                const pid = p.id;
                const cVal = parseFloat(p.contract_value) || 0;
                company_tot_contract += cVal;

                const pExps = (db.expenses || []).filter(e => e.project_id === pid);
                const pSpent = pExps.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                const spentByPhase = {{}};
                pExps.forEach(e => {{
                    spentByPhase[e.phase_id] = (spentByPhase[e.phase_id] || 0) + (parseFloat(e.amount) || 0);
                }});

                const pPays = (db.client_payments || []).filter(cp => cp.project_id === pid);
                const pRecv = pPays.filter(cp => cp.is_received || cp.status === 'paid' || cp.status === 'partially_paid').reduce((sum, cp) => sum + (parseFloat(cp.received_amount) || 0), 0);
                const pDue = pPays.reduce((sum, cp) => sum + (parseFloat(cp.amount_with_tax) || 0), 0);
                const pPending = Math.max(0, pDue - pRecv);

                const enrichedPayments = pPays.map(cp => Object.assign({{}}, cp, {{ project_id: pid, project_name: p.name, project_code: p.code }}));
                const paymentsByPhase = {{}};
                enrichedPayments.forEach(cp => {{
                    if (!paymentsByPhase[cp.phase_id]) paymentsByPhase[cp.phase_id] = [];
                    paymentsByPhase[cp.phase_id].push(cp);
                }});

                const pPhases = (db.project_phases || []).filter(ph => ph.project_id === pid).sort((a,b) => (a.order_num || 0) - (b.order_num || 0));
                let curCash = pRecv - pSpent;
                let runCash = curCash;
                let totRemCost = 0;
                const phaseFlows = [];

                pPhases.forEach(ph => {{
                    const cCost = parseFloat(ph.cost_price) || 0;
                    const cSell = parseFloat(ph.selling_price) || 0;
                    const actSpent = spentByPhase[ph.id] || 0;
                    const remCost = Math.max(0, cCost - actSpent);
                    totRemCost += remCost;

                    const phPays = paymentsByPhase[ph.id] || [];
                    const phDue = phPays.reduce((sum, cp) => sum + (parseFloat(cp.amount_with_tax) || 0), 0);
                    const phRec = phPays.filter(cp => cp.is_received || cp.status === 'paid' || cp.status === 'partially_paid').reduce((sum, cp) => sum + (parseFloat(cp.received_amount) || 0), 0);
                    const phPending = Math.max(0, phDue - phRec);

                    const netFlow = phPending - remCost;
                    runCash += netFlow;

                    phaseFlows.push({{
                        phase_id: ph.id,
                        order_num: ph.order_num,
                        name: ph.name,
                        cost_price: cCost,
                        selling_price: cSell,
                        actual_spent: actSpent,
                        remaining_cost: remCost,
                        inflow_due: phDue,
                        inflow_received: phRec,
                        inflow_pending: phPending,
                        net_phase_flow: netFlow,
                        projected_cash_after: runCash,
                        progress_percent: parseFloat(ph.progress_percent) || 0,
                        status: ph.status || 'in_progress',
                        payments: phPays
                    }});
                }});

                const nextPay = enrichedPayments.find(cp => !cp.is_received && cp.status !== 'paid');
                const projSim = phaseFlows.find(pf => pf.order_num === simNum) || phaseFlows[0] || null;

                if (p.budget_mode === 'manual' && p.manual_remaining_budget !== null && p.manual_remaining_budget !== undefined) {{
                    totRemCost = parseFloat(p.manual_remaining_budget);
                }}

                company_tot_received += pRecv;
                company_tot_spent += pSpent;
                company_tot_pending_inflow += pPending;
                company_tot_remaining_cost += totRemCost;
                company_tot_final_cash += runCash;

                all_projects_cashflow.push({{
                    project_id: pid,
                    name: p.name,
                    code: p.code,
                    contract_value: cVal,
                    status: p.status,
                    progress_percent: p.progress_percent,
                    total_received: pRecv,
                    total_spent: pSpent,
                    current_cash: curCash,
                    total_pending_inflow: pPending,
                    total_remaining_cost: totRemCost,
                    final_projected_cash: runCash,
                    next_payment: nextPay,
                    sim_phase: projSim,
                    phases: phaseFlows,
                    all_payments: enrichedPayments,
                    payments_count: enrichedPayments.length
                }});
            }});

            const company_current_cash = opening_cash + company_tot_received - company_tot_spent;
            company_tot_final_cash += opening_cash;

            let company_cash_at_sim_phase = opening_cash;
            all_projects_cashflow.forEach(pd => {{
                const phasesUpTo = (pd.phases || []).filter(pf => pf.order_num <= simNum);
                if (phasesUpTo.length) {{
                    company_cash_at_sim_phase += phasesUpTo[phasesUpTo.length - 1].projected_cash_after;
                }} else {{
                    company_cash_at_sim_phase += pd.current_cash;
                }}
            }});

            const consMap = {{}};
            all_projects_cashflow.forEach(pd => {{
                (pd.phases || []).forEach(ph => {{
                    const onum = ph.order_num;
                    if (!consMap[onum]) {{
                        consMap[onum] = {{
                            order_num: onum,
                            name: ph.name,
                            cost_price: 0, selling_price: 0, actual_spent: 0, remaining_cost: 0,
                            inflow_due: 0, inflow_received: 0, inflow_pending: 0, net_phase_flow: 0,
                            progress_sum: 0, projects_count: 0, payments: []
                        }};
                    }}
                    const c = consMap[onum];
                    c.cost_price += ph.cost_price;
                    c.selling_price += ph.selling_price;
                    c.actual_spent += ph.actual_spent;
                    c.remaining_cost += ph.remaining_cost;
                    c.inflow_due += ph.inflow_due;
                    c.inflow_received += ph.inflow_received;
                    c.inflow_pending += ph.inflow_pending;
                    c.net_phase_flow += ph.net_phase_flow;
                    c.progress_sum += ph.progress_percent;
                    c.projects_count += 1;
                    if (ph.payments && ph.payments.length) c.payments.push(...ph.payments);
                }});
            }});

            const consolidated_phases = [];
            let company_running_cash = company_current_cash;
            Object.keys(consMap).sort((a,b) => parseInt(a) - parseInt(b)).forEach(k => {{
                const c = consMap[k];
                company_running_cash += c.net_phase_flow;
                c.projected_cash_after = company_running_cash;
                c.progress_percent = Math.round((c.progress_sum / Math.max(1, c.projects_count)) * 10) / 10;
                consolidated_phases.push(c);
            }});

            const company_sim_phase = consolidated_phases.find(cp => cp.order_num === simNum) || consolidated_phases[0] || null;

            const summary = {{
                opening_cash_balance: opening_cash,
                total_contract_value: company_tot_contract,
                total_received: company_tot_received,
                total_spent: company_tot_spent,
                current_net_cash: company_current_cash,
                total_pending_inflow: company_tot_pending_inflow,
                total_remaining_cost: company_tot_remaining_cost,
                final_projected_cash: company_tot_final_cash,
                company_cash_at_sim_phase: company_cash_at_sim_phase,
                company_sim_phase: company_sim_phase,
                sim_phase_num: simNum,
                active_projects_count: (db.projects || []).length
            }};

            let dispProjects = all_projects_cashflow;
            if (prjId) {{
                dispProjects = all_projects_cashflow.filter(p => String(p.project_id) === String(prjId));
            }}
            const all_payments_flat = [];
            dispProjects.forEach(p => all_payments_flat.push(...(p.all_payments || [])));

            return new Response(JSON.stringify({{
                success: true,
                summary: summary,
                projects: dispProjects,
                consolidated_phases: consolidated_phases,
                all_payments: all_payments_flat,
                all_projects_list: all_projects_cashflow.map(p => ({{ id: p.project_id, name: p.name, code: p.code }})),
                selected_project_id: prjId ? parseInt(prjId) : null
            }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        
        // 10. HR SYSTEM OFFLINE ROUTES
        if (urlStr.includes('/api/hr/stats')) {{
            const emps = db.hr_employees || [];
            const activeEmps = emps.filter(e => e.status === 'active');
            const monthlyPayroll = activeEmps.reduce((s, e) => s + (parseFloat(e.basic_salary) || 0) + (parseFloat(e.housing_allowance) || 0) + (parseFloat(e.transport_allowance) || 0) + (parseFloat(e.other_allowances) || 0), 0);
            const activeLeaves = (db.hr_leaves || []).filter(l => l.status === 'approved').length;
            const activeAdvances = (db.hr_advances || []).filter(a => a.status === 'active');
            const remAdvances = activeAdvances.reduce((s, a) => s + (parseFloat(a.remaining_amount) || 0), 0);

            const today = new Date();
            let expCount = 0;
            emps.forEach(e => {{
                ['iqama_expiry_date', 'contract_end_date', 'insurance_expiry_date', 'passport_expiry_date'].forEach(f => {{
                    if (e[f]) {{
                        const diff = (new Date(e[f]) - today) / (1000 * 60 * 60 * 24);
                        if (diff >= 0 && diff <= 60) expCount++;
                    }}
                }});
            }});

            return new Response(JSON.stringify({{
                total_active: activeEmps.length,
                total_employees: activeEmps.length,
                monthly_payroll: monthlyPayroll,
                total_monthly_payroll: monthlyPayroll,
                on_leave: activeLeaves,
                active_leaves: activeLeaves,
                expiring_docs: expCount,
                expiring_docs_60d: expCount,
                total_advances: remAdvances,
                remaining_advances: remAdvances
            }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.includes('/api/hr/employees')) {{
            db.hr_employees = db.hr_employees || [];
            if (method === 'GET') {{
                return new Response(JSON.stringify(db.hr_employees), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'POST') {{
                const newEmp = Object.assign({{}}, body, {{
                    id: Date.now(),
                    created_at: new Date().toISOString()
                }});
                db.hr_employees.push(newEmp);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, id: newEmp.id, message: 'تمت إضافة الموظف بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'PUT') {{
                const id = parseInt(urlStr.split('/').pop());
                const idx = db.hr_employees.findIndex(e => e.id === id);
                if (idx !== -1) {{
                    db.hr_employees[idx] = Object.assign(db.hr_employees[idx], body);
                    saveDB(db);
                }}
                return new Response(JSON.stringify({{ success: true, message: 'تم تحديث بيانات الموظف بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'DELETE') {{
                const id = parseInt(urlStr.split('/').pop());
                db.hr_employees = db.hr_employees.filter(e => e.id !== id);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم حذف الموظف بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
        }}

        if (urlStr.includes('/api/hr/payroll-items')) {{
            db.hr_payroll_items = db.hr_payroll_items || [];
            db.hr_payrolls = db.hr_payrolls || [];
            if (method === 'PUT') {{
                const id = parseFloat(urlStr.split('/').pop());
                const item = db.hr_payroll_items.find(it => it.id === id || String(it.id) === String(id));
                if (item) {{
                    item.basic_salary = parseFloat(body.basic_salary !== undefined ? body.basic_salary : item.basic_salary) || 0;
                    item.allowances = parseFloat(body.allowances !== undefined ? body.allowances : item.allowances) || 0;
                    item.overtime_amount = parseFloat(body.overtime_amount !== undefined ? body.overtime_amount : (item.overtime_amount || 0)) || 0;
                    item.bonus_amount = parseFloat(body.bonus_amount !== undefined ? body.bonus_amount : (item.bonus_amount || 0)) || 0;
                    item.deductions = parseFloat(body.deductions !== undefined ? body.deductions : item.deductions) || 0;
                    item.advances_deducted = parseFloat(body.advances_deducted !== undefined ? body.advances_deducted : item.advances_deducted) || 0;
                    item.notes = body.notes !== undefined ? body.notes : (item.notes || '');
                    item.net_salary = Math.round(((item.basic_salary + item.allowances + item.overtime_amount + item.bonus_amount) - (item.deductions + item.advances_deducted)) * 100) / 100;

                    // Recalculate parent payroll
                    const p = db.hr_payrolls.find(pay => pay.id === item.payroll_id || String(pay.id) === String(item.payroll_id));
                    if (p) {{
                        const items = db.hr_payroll_items.filter(it => it.payroll_id === item.payroll_id || String(it.payroll_id) === String(item.payroll_id));
                        p.total_basic = Math.round(items.reduce((s, it) => s + (parseFloat(it.basic_salary) || 0), 0) * 100) / 100;
                        p.total_allowances = Math.round(items.reduce((s, it) => s + (parseFloat(it.allowances) || 0) + (parseFloat(it.overtime_amount) || 0) + (parseFloat(it.bonus_amount) || 0), 0) * 100) / 100;
                        p.total_deductions = Math.round(items.reduce((s, it) => s + (parseFloat(it.deductions) || 0), 0) * 100) / 100;
                        p.total_advances = Math.round(items.reduce((s, it) => s + (parseFloat(it.advances_deducted) || 0), 0) * 100) / 100;
                        p.total_net = Math.round(items.reduce((s, it) => s + (parseFloat(it.net_salary) || 0), 0) * 100) / 100;
                    }}
                    saveDB(db);
                    return new Response(JSON.stringify({{ success: true, message: 'تم تعديل راتب الموظف في المسير بنجاح', item: item, payroll: p }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
                return new Response(JSON.stringify({{ error: 'بند الراتب غير موجود' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
        }}

        if (urlStr.includes('/api/hr/payrolls')) {{
            db.hr_payrolls = db.hr_payrolls || [];
            db.hr_payroll_items = db.hr_payroll_items || [];
            if (urlStr.match(/\\/api\\/hr\\/payrolls\\/\\d+\\/status/) && method === 'PUT') {{
                const id = parseInt(urlStr.split('/')[4]);
                const p = db.hr_payrolls.find(item => item.id === id);
                if (p) {{
                    p.status = body.status || 'approved';
                    saveDB(db);
                }}
                return new Response(JSON.stringify({{ success: true, message: 'تم تحديث حالة المسير بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
            if (urlStr.match(/\\/api\\/hr\\/payrolls\\/\\d+$/)) {{
                const id = parseInt(urlStr.split('/').pop());
                if (method === 'GET') {{
                    const p = db.hr_payrolls.find(item => item.id === id);
                    if (p) {{
                        const items = db.hr_payroll_items.filter(it => it.payroll_id === id);
                        return new Response(JSON.stringify({{ payroll: p, items: items }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                    }}
                    return new Response(JSON.stringify({{ error: 'Not found' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
                }} else if (method === 'DELETE') {{
                    db.hr_payrolls = db.hr_payrolls.filter(item => item.id !== id);
                    db.hr_payroll_items = db.hr_payroll_items.filter(it => it.payroll_id !== id);
                    saveDB(db);
                    return new Response(JSON.stringify({{ success: true, message: 'تم حذف المسير بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
                }}
            }}
            if (method === 'GET') {{
                return new Response(JSON.stringify(db.hr_payrolls), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'POST') {{
                const activeEmps = (db.hr_employees || []).filter(e => e.status === 'active');
                const mYear = body.month_year || body.month || new Date().toISOString().slice(0, 7);
                const pId = Date.now();
                let totBasic = 0, totAllow = 0, totDed = 0, totNet = 0;
                activeEmps.forEach(e => {{
                    const b = parseFloat(e.basic_salary) || 0;
                    const a = (parseFloat(e.housing_allowance) || 0) + (parseFloat(e.transport_allowance) || 0) + (parseFloat(e.other_allowances) || 0);
                    const net = b + a;
                    totBasic += b; totAllow += a; totNet += net;
                    db.hr_payroll_items.push({{
                        id: Date.now() + Math.random(),
                        payroll_id: pId,
                        employee_id: e.id,
                        employee_name: e.name,
                        job_title: e.job_title,
                        basic_salary: b,
                        allowances: a,
                        deductions: 0,
                        advances_deducted: 0,
                        net_salary: net,
                        iban: e.iban || ''
                    }});
                }});
                const newP = {{
                    id: pId,
                    month_year: mYear,
                    total_basic: totBasic,
                    total_allowances: totAllow,
                    total_deductions: 0,
                    total_net: totNet,
                    employees_count: activeEmps.length,
                    status: 'draft',
                    notes: body.notes || ''
                }};
                db.hr_payrolls.unshift(newP);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, id: pId, message: 'تم إصدار المسير بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
        }}

        if (urlStr.includes('/api/hr/leaves')) {{
            db.hr_leaves = db.hr_leaves || [];
            if (method === 'GET') {{
                return new Response(JSON.stringify(db.hr_leaves), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'POST') {{
                const emp = (db.hr_employees || []).find(e => e.id == body.employee_id);
                const newLeave = Object.assign({{}}, body, {{
                    id: Date.now(),
                    employee_name: emp ? emp.name : 'موظف',
                    status: 'approved'
                }});
                db.hr_leaves.unshift(newLeave);
                if (emp && body.days_count) {{
                    emp.vacation_balance = Math.max(0, (emp.vacation_balance || 30) - parseInt(body.days_count));
                }}
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم اعتماد الإجازة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'DELETE') {{
                const id = parseInt(urlStr.split('/').pop());
                db.hr_leaves = db.hr_leaves.filter(l => l.id !== id);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم حذف الإجازة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
        }}

        if (urlStr.includes('/api/hr/advances')) {{
            db.hr_advances = db.hr_advances || [];
            if (method === 'GET') {{
                return new Response(JSON.stringify(db.hr_advances), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'POST') {{
                const emp = (db.hr_employees || []).find(e => e.id == body.employee_id);
                const newAdv = Object.assign({{}}, body, {{
                    id: Date.now(),
                    employee_name: emp ? emp.name : 'موظف',
                    paid_amount: 0,
                    remaining_amount: parseFloat(body.amount) || 0,
                    request_date: body.request_date || body.advance_date || new Date().toISOString().slice(0, 10),
                    status: 'active'
                }});
                db.hr_advances.unshift(newAdv);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم صرف السلفة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }} else if (method === 'DELETE') {{
                const id = parseInt(urlStr.split('/').pop());
                db.hr_advances = db.hr_advances.filter(a => a.id !== id);
                saveDB(db);
                return new Response(JSON.stringify({{ success: true, message: 'تم حذف السلفة بنجاح' }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            }}
        }}

        if (urlStr.includes('/api/hr/expirations')) {{
            const today = new Date();
            const docs = [];
            (db.hr_employees || []).forEach(e => {{
                const fields = [
                    {{ key: 'iqama_expiry_date', type: 'الإقامة / الهوية', icon: 'file-badge' }},
                    {{ key: 'contract_end_date', type: 'عقد العمل', icon: 'file-text' }},
                    {{ key: 'insurance_expiry_date', type: 'التأمين الطبي', icon: 'shield-plus' }},
                    {{ key: 'passport_expiry_date', type: 'جواز السفر', icon: 'plane' }}
                ];
                fields.forEach(f => {{
                    if (e[f.key]) {{
                        const diff = Math.ceil((new Date(e[f.key]) - today) / (1000 * 60 * 60 * 24));
                        if (diff >= 0 && diff <= 60) {{
                            docs.push({{
                                employee_id: e.id,
                                employee_name: e.name,
                                job_title: e.job_title,
                                department: e.department,
                                doc_type: f.type,
                                expiry_date: e[f.key],
                                days_left: diff,
                                urgency: diff <= 15 ? 'critical' : (diff <= 30 ? 'warning' : 'notice')
                            }});
                        }}
                    }}
                }});
            }});
            docs.sort((a, b) => a.days_left - b.days_left);
            return new Response(JSON.stringify(docs), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        if (urlStr.includes('/api/hr/eos-calculate')) {{
            const basic = parseFloat(body.basic_salary) || 0;
            const allow = parseFloat(body.allowances) || 0;
            const totalSal = basic + allow;
            const y = parseFloat(body.years) || 0;
            const m = parseFloat(body.months) || 0;
            const d = parseFloat(body.days) || 0;
            const totalYears = y + (m / 12) + (d / 365);

            let first5 = 0, after5 = 0;
            if (totalYears <= 5) {{
                first5 = totalYears * (totalSal / 2);
            }} else {{
                first5 = 5 * (totalSal / 2);
                after5 = (totalYears - 5) * totalSal;
            }}
            const unadjusted = first5 + after5;
            let mult = 1.0;
            let note = 'استحقاق كامل (100%)';
            if (body.reason === 'resignation') {{
                if (totalYears < 2) {{ mult = 0.0; note = 'لا يستحق مكافأة (خدمة أقل من سنتين)'; }}
                else if (totalYears < 5) {{ mult = 1.0 / 3.0; note = 'يستحق ثلث المكافأة (خدمة من 2 إلى 5 سنوات)'; }}
                else if (totalYears < 10) {{ mult = 2.0 / 3.0; note = 'يستحق ثلثي المكافأة (خدمة من 5 إلى 10 سنوات)'; }}
                else {{ mult = 1.0; note = 'يستحق كامل المكافأة (خدمة 10 سنوات فأكثر)'; }}
            }}
            const finalAmt = Math.round(unadjusted * mult * 100) / 100;
            return new Response(JSON.stringify({{
                success: true,
                total_salary: totalSal,
                total_years_fraction: Math.round(totalYears * 100) / 100,
                first_5_years_amount: Math.round(first5 * 100) / 100,
                after_5_years_amount: Math.round(after5 * 100) / 100,
                unadjusted_eos_amount: Math.round(unadjusted * 100) / 100,
                multiplier: mult,
                reduction_note: note,
                final_eos_amount: finalAmt
            }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        return originalFetch.apply(this, arguments);
    }};
}})();
"""

    # 7. Replace static links in HTML
    # Replace CSS
    css_match = re.search(r'<link rel="stylesheet" href="/static/css/app\.css[^"]*">', html)
    if css_match:
        html = html[:css_match.start()] + f"<style>\n{custom_css}\n</style>" + html[css_match.end():]

    # Replace SVG Logo
    svg_logo = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="h-10 w-auto object-contain">
    <rect width="100" height="100" rx="20" fill="#059669"/>
    <path d="M25 70 L50 25 L75 70 Z" fill="none" stroke="#ffffff" stroke-width="8" stroke-linejoin="round"/>
    <path d="M38 52 L62 52" stroke="#ffffff" stroke-width="8"/>
</svg>"""
    html = re.sub(r'<img src="/static/images/logo-white.png"[^>]*>', svg_logo, html)

    # Replace scripts
    idx_scripts = html.find('<!-- Scripts -->')
    idx_body_end = html.find('</body>')

    scripts_block = f"""<!-- Scripts -->
<script>
{client_api_bridge}
</script>
<script>
{i18n_js}
</script>
<script>
{app_js}
</script>
"""
    if idx_scripts != -1 and idx_body_end != -1:
        html = html[:idx_scripts] + scripts_block + html[idx_body_end:]

    # Ensure auth-screen is not hidden initially
    html = re.sub(r'id="auth-screen"\s+class="([^"]*)\bhidden\b([^"]*)"', r'id="auth-screen" class="\1\2"', html)

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    with open('segieny_system.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Successfully generated standalone index.html ({len(html):,} bytes)")
    print(f"Successfully generated standalone segieny_system.html ({len(html):,} bytes)")

if __name__ == '__main__':
    build_standalone()
