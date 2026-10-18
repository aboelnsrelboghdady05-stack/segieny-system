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
        'hr_advances': get_all('hr_advances')
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
    
    // Always sync or initialize LocalStorage
    if (!localStorage.getItem('segieny_standalone_db_v4')) {{
        localStorage.setItem('segieny_standalone_db_v4', JSON.stringify(INITIAL_DB));
    }}
    
    function getDB() {{
        try {{
            return JSON.parse(localStorage.getItem('segieny_standalone_db_v4')) || INITIAL_DB;
        }} catch(e) {{
            return INITIAL_DB;
        }}
    }}
    
    function saveDB(data) {{
        localStorage.setItem('segieny_standalone_db_v4', JSON.stringify(data));
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
            const user = db.team_members.find(u => u.phone === body.phone && u.national_id === body.national_id) || {{
                id: 1,
                name: 'ابوالنصر البغدادي',
                role: 'المدير المالي العام',
                phone: body.phone,
                national_id: body.national_id,
                is_admin: 1
            }};
            localStorage.setItem('segieny_user', JSON.stringify(user));
            return new Response(JSON.stringify({{ success: true, user: user }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/auth/logout')) {{
            localStorage.removeItem('segieny_user');
            return new Response(JSON.stringify({{ success: true }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/auth/user')) {{
            const u = localStorage.getItem('segieny_user');
            if (u) return new Response(JSON.stringify({{ authenticated: true, user: JSON.parse(u) }}), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
            return new Response(JSON.stringify({{ authenticated: false }}), {{ status: 401, headers: {{ 'Content-Type': 'application/json' }} }});
        }}
        if (urlStr.includes('/api/auth/users')) {{
            return new Response(JSON.stringify(db.team_members), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 2. Project details
        if (urlStr.match(/\\/api\\/projects\\/\\d+$/) && method === 'GET') {{
            const parts = urlStr.split('/');
            const id = parseInt(parts[parts.length - 1]);
            const proj = db.projects.find(p => p.id === id);
            if (!proj) return new Response(JSON.stringify({{ error: 'Not found' }}), {{ status: 404, headers: {{ 'Content-Type': 'application/json' }} }});
            
            const detailed = Object.assign({{}}, proj, {{
                phases: db.project_phases.filter(ph => ph.project_id === id).map(ph => Object.assign({{}}, ph, {{
                    items: db.phase_items.filter(it => it.phase_id === ph.id)
                }})),
                expenses: db.expenses.filter(e => e.project_id === id),
                client_payments: db.client_payments.filter(cp => cp.project_id === id)
            }});
            return new Response(JSON.stringify(detailed), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
        }}

        // 3. Projects list
        if (urlStr.includes('/api/projects') && method === 'GET') {{
            const projsWithStats = db.projects.map(p => {{
                const pExps = db.expenses.filter(e => e.project_id === p.id);
                const spent = pExps.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                return Object.assign({{}}, p, {{
                    total_spent: spent,
                    remaining_budget: Math.max(0, (p.contract_value || 0) - spent),
                    expenses_count: pExps.length
                }});
            }});
            return new Response(JSON.stringify(projsWithStats), {{ status: 200, headers: {{ 'Content-Type': 'application/json' }} }});
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
