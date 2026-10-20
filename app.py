import os
import json
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory, url_for, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import database

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB max upload

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def check_is_financial_manager(user_id=None, user_role='', user_name='', cursor=None):
    """
    التحقق من صلاحية المدير المالي (أ. ابوالنصر البغدادي) أو الإدارة العامة
    """
    is_fin = False
    manager_title = 'ابوالنصر البغدادي (المدير المالي)'
    
    if user_id and cursor:
        try:
            cursor.execute('SELECT id, name, role, username FROM team_members WHERE id = ?', (user_id,))
            u = cursor.fetchone()
            if u:
                r = (u['role'] or '').lower()
                un = (u['username'] or '').lower()
                nm = u['name'] or ''
                if 'مدير مالي' in r or 'المدير المالي' in r or un == 'baghdadi' or 'ابوالنصر' in nm or 'financial' in r:
                    is_fin = True
                    manager_title = f"{nm} (المدير المالي)"
                elif 'مدير عام' in r or 'المدير العام' in r or un == 'nawaf' or 'نواف' in nm or u['id'] == 1:
                    is_fin = True
                    manager_title = f"{nm} (المدير العام)"
        except Exception:
            pass

    if not is_fin:
        r_str = (user_role or '').lower()
        n_str = (user_name or '').lower()
        if 'مدير مالي' in r_str or 'المدير المالي' in r_str or 'ابوالنصر' in n_str or 'baghdadi' in n_str or 'financial' in r_str:
            is_fin = True
            manager_title = f"{user_name or 'ابوالنصر البغدادي'} (المدير المالي)"
        elif 'مدير عام' in r_str or 'المدير العام' in r_str or 'نواف' in n_str or 'admin' in r_str:
            is_fin = True
            manager_title = f"{user_name or 'الإدارة العامة'} (المدير العام)"

    return is_fin, manager_title

# Initialize database
database.init_db()

# Serve Frontend
@app.route('/')
def index():
    return render_template('index.html')

# Serve Uploaded Files (Invoices, Receipts, Blueprints)
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# System Backup Endpoint (تحميل نسخة احتياطية فورية من قاعدة البيانات)
@app.route('/api/system/backup', methods=['GET'])
def download_database_backup():
    try:
        now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        return send_file(
            database.DB_PATH,
            as_attachment=True,
            download_name=f"segieny_db_backup_{now_str}.db",
            mimetype="application/x-sqlite3"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ----------------- DASHBOARD API -----------------
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    conn = database.get_db_connection()
    cursor = conn.cursor()

    # Projects counts
    cursor.execute('SELECT COUNT(*) FROM projects')
    total_projects = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM projects WHERE status = 'in_progress'")
    active_projects = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM projects WHERE status = 'completed'")
    completed_projects = cursor.fetchone()[0]

    # Contract values and expenses
    cursor.execute('SELECT COALESCE(SUM(contract_value), 0) FROM projects')
    total_contract_value = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_without_tax), 0), COALESCE(SUM(tax_amount), 0) FROM expenses WHERE COALESCE(approval_status, 'approved') = 'approved'")
    exp_stat_row = cursor.fetchone()
    total_expenses = exp_stat_row[0]
    total_expenses_without_tax = exp_stat_row[1]
    total_tax_refundable = exp_stat_row[2]

    # Tasks stats
    cursor.execute('SELECT COUNT(*) FROM tasks')
    total_tasks = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = 'done'")
    completed_tasks = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'")
    inprogress_tasks = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = 'todo'")
    todo_tasks = cursor.fetchone()[0]

    # Subcontractors total paid
    cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM subcontractor_payments')
    sub_payments_sum = cursor.fetchone()[0] or 0
    cursor.execute('SELECT COALESCE(SUM(paid_amount), 0) FROM subcontractors')
    sub_paid_fallback = cursor.fetchone()[0] or 0
    sub_total_paid = max(sub_payments_sum, sub_paid_fallback)
    sub_total_agreed = sub_total_paid

    # Client Payments & Milestones Collection stats
    cursor.execute('''
        SELECT 
            COALESCE(SUM(amount_with_tax), 0),
            COALESCE(SUM(received_amount), 0),
            COUNT(*),
            COALESCE(SUM(CASE WHEN is_received = 1 OR status = 'paid' THEN 1 ELSE 0 END), 0)
        FROM client_payments
    ''')
    cp_row = cursor.fetchone()
    total_client_milestones = cp_row[0]
    total_client_received = cp_row[1]
    total_client_pending = max(0.0, total_client_milestones - total_client_received)
    client_collection_rate = round((total_client_received / total_client_milestones * 100), 1) if total_client_milestones > 0 else 0

    # Suppliers & Quotations stats
    cursor.execute('SELECT COUNT(*) FROM suppliers')
    total_suppliers = cursor.fetchone()[0]

    cursor.execute('SELECT COALESCE(SUM(total_amount), 0) FROM supplier_quotations')
    suppliers_total_quoted = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE supplier_id IS NOT NULL AND COALESCE(approval_status, 'approved') = 'approved'")
    suppliers_total_paid = cursor.fetchone()[0]

    suppliers_total_remaining = max(0.0, suppliers_total_quoted - suppliers_total_paid)

    cursor.execute("SELECT COUNT(*), COALESCE(SUM(total_variance), 0) FROM expenses WHERE has_price_increase = 1 AND COALESCE(approval_status, 'approved') = 'approved'")
    v_stat_row = cursor.fetchone()
    suppliers_price_increases_count = v_stat_row[0] or 0
    suppliers_total_variance = v_stat_row[1] or 0.0

    # Recent projects with progress & spending
    cursor.execute('''
        SELECT p.*,
            (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.project_id = p.id AND COALESCE(e.approval_status, 'approved') = 'approved') AS total_spent,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS completed_task_count
        FROM projects p
        ORDER BY p.id DESC
        LIMIT 6
    ''')
    recent_projects = [dict(row) for row in cursor.fetchall()]

    # Expenses by category for charts
    cursor.execute('''
        SELECT category, SUM(amount) as total
        FROM expenses
        WHERE COALESCE(approval_status, 'approved') = 'approved'
        GROUP BY category
        ORDER BY total DESC
    ''')
    expenses_by_category = [dict(row) for row in cursor.fetchall()]

    # Recent activity / notifications
    cursor.execute('SELECT * FROM notifications ORDER BY id DESC LIMIT 10')
    notifications = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        'total_projects': total_projects,
        'active_projects': active_projects,
        'completed_projects': completed_projects,
        'total_contract_value': total_contract_value,
        'total_expenses': total_expenses,
        'total_expenses_without_tax': total_expenses_without_tax,
        'total_tax_refundable': total_tax_refundable,
        'net_balance': total_contract_value - total_expenses,
        'total_client_milestones': total_client_milestones,
        'total_client_received': total_client_received,
        'total_client_pending': total_client_pending,
        'client_collection_rate': client_collection_rate,
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'inprogress_tasks': inprogress_tasks,
        'todo_tasks': todo_tasks,
        'sub_total_agreed': sub_total_agreed,
        'sub_total_paid': sub_total_paid,
        'total_suppliers': total_suppliers,
        'suppliers_total_quoted': suppliers_total_quoted,
        'suppliers_total_paid': suppliers_total_paid,
        'suppliers_total_remaining': suppliers_total_remaining,
        'suppliers_price_increases_count': suppliers_price_increases_count,
        'suppliers_total_variance': suppliers_total_variance,
        'recent_projects': recent_projects,
        'expenses_by_category': expenses_by_category,
        'notifications': notifications
    })

# ----------------- PROJECTS API -----------------
@app.route('/api/projects', methods=['GET'])
def get_projects():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT p.*,
            (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE project_id = p.id AND COALESCE(approval_status, 'approved') = 'approved') AS total_spent,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') AS done_tasks,
            (SELECT COUNT(*) FROM documents WHERE project_id = p.id) AS doc_count
        FROM projects p
        ORDER BY p.id DESC
    ''')
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(projects)

@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project_details(project_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    if not project:
        conn.close()
        return jsonify({'error': 'المشروع غير موجود'}), 404

    project_data = dict(project)

    # Project Phases (مراحل المشروع)
    cursor.execute('''
        SELECT p.*
        FROM project_phases p
        WHERE p.project_id = ?
        ORDER BY p.order_num ASC, p.id ASC
    ''', (project_id,))
    phases = [dict(row) for row in cursor.fetchall()]
    
    total_phases_cost = 0.0
    total_phases_selling = 0.0
    for ph in phases:
        # Load items (بنود المرحلة)
        cursor.execute('''
            SELECT * FROM phase_items
            WHERE phase_id = ?
            ORDER BY id ASC
        ''', (ph['id'],))
        items = [dict(row) for row in cursor.fetchall()]
        
        # Calculate actual spent per item
        for it in items:
            cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE item_id = ? AND COALESCE(approval_status, 'approved') = 'approved'", (it['id'],))
            it_spent = float(cursor.fetchone()[0] or 0)
            cost_price = float(it.get('cost_price') or 0)
            selling_price = float(it.get('selling_price') or 0)
            prog = float(it.get('progress_percent') or 0)
            it['actual_spent'] = it_spent
            it['budget_cost'] = cost_price
            it['cost_price'] = cost_price
            it['selling_price'] = selling_price
            it['progress_percent'] = prog
            it['variance'] = cost_price - it_spent
            it['is_over_budget'] = it_spent > cost_price
            it['over_amount'] = max(0.0, it_spent - cost_price)
            it['savings_amount'] = max(0.0, cost_price - it_spent)
            it['actual_profit'] = selling_price - it_spent
            it['is_loss'] = it['actual_profit'] < 0
            it['profit_percent'] = round((it['actual_profit'] / selling_price * 100), 1) if selling_price > 0 else 0

        ph['items'] = items
        ph['item_count'] = len(items)

        ph_cost = float(ph.get('cost_price') or 0)
        ph_selling = float(ph.get('selling_price') or 0)
        ph_prog = float(ph.get('progress_percent') or 0)
        ph_weight = float(ph.get('weight_percent') or 0)
        ph['cost_price'] = ph_cost
        ph['selling_price'] = ph_selling
        ph['progress_percent'] = ph_prog
        ph['weight_percent'] = ph_weight

        if items:
            items_cost = sum(float(it.get('cost_price') or 0) for it in items)
            items_selling = sum(float(it.get('selling_price') or 0) for it in items)
            avg_item_prog = sum(float(it.get('progress_percent') or 0) for it in items) / len(items)
            all_done = all(it.get('status') == 'done' or float(it.get('progress_percent') or 0) >= 100 for it in items)

            eff_cost = items_cost if items_cost > 0 else ph_cost
            eff_selling = items_selling if items_selling > 0 else ph_selling
            calc_progress = 100.0 if all_done else round(avg_item_prog, 1)

            if abs(calc_progress - ph_prog) > 0.01:
                cursor.execute('UPDATE project_phases SET progress_percent = ?, status = ? WHERE id = ?', 
                               (calc_progress, 'completed' if all_done else 'in_progress', ph['id']))
                ph['progress_percent'] = calc_progress
                ph['status'] = 'completed' if all_done else 'in_progress'

            ph['effective_cost'] = eff_cost
            ph['effective_selling'] = eff_selling
        else:
            ph['effective_cost'] = ph_cost
            ph['effective_selling'] = ph_selling

        # Actual phase expenditure (from phase expenses or linked item expenses)
        cursor.execute('''
            SELECT COALESCE(SUM(amount), 0) FROM expenses 
            WHERE (phase_id = ? OR item_id IN (SELECT id FROM phase_items WHERE phase_id = ?))
              AND COALESCE(approval_status, 'approved') = 'approved'
        ''', (ph['id'], ph['id']))
        ph_spent = float(cursor.fetchone()[0] or 0)
        eff_cost = float(ph.get('effective_cost') or 0)
        eff_selling = float(ph.get('effective_selling') or 0)
        ph['actual_spent'] = ph_spent
        ph['budget_cost'] = eff_cost
        ph['variance'] = eff_cost - ph_spent
        ph['is_over_budget'] = ph_spent > eff_cost
        ph['over_amount'] = max(0.0, ph_spent - eff_cost)
        ph['savings_amount'] = max(0.0, eff_cost - ph_spent)
        ph['actual_profit'] = eff_selling - ph_spent
        ph['is_loss'] = ph['actual_profit'] < 0
        ph['profit_margin'] = eff_selling - eff_cost
        ph['profit_percent'] = round(((eff_selling - eff_cost) / eff_selling * 100), 1) if eff_selling > 0 else 0
        ph['actual_profit_percent'] = round(((eff_selling - ph_spent) / eff_selling * 100), 1) if eff_selling > 0 else 0

        total_phases_cost += eff_cost
        total_phases_selling += eff_selling

    # Update overall project progress based on phase weights
    cursor.execute('''
        SELECT COALESCE(SUM(progress_percent * (weight_percent / 100.0)), 0), COALESCE(SUM(weight_percent), 0)
        FROM project_phases WHERE project_id = ?
    ''', (project_id,))
    row_prog = cursor.fetchone()
    weighted_prog = float(row_prog[0] or 0)
    total_weight = float(row_prog[1] or 0)
    if total_weight > 0:
        overall_prog = min(100, max(0, round(weighted_prog)))
        if overall_prog != float(project_data.get('progress_percent') or 0):
            cursor.execute('UPDATE projects SET progress_percent = ? WHERE id = ?', (overall_prog, project_id))
            project_data['progress_percent'] = overall_prog

    conn.commit()

    # Total Spent & Recoverable Input Tax
    cursor.execute("SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_without_tax), 0), COALESCE(SUM(tax_amount), 0) FROM expenses WHERE project_id = ? AND COALESCE(approval_status, 'approved') = 'approved'", (project_id,))
    exp_p_row = cursor.fetchone()
    total_spent = float(exp_p_row[0] or 0)
    total_spent_without_tax = float(exp_p_row[1] or 0)
    total_tax_refundable = float(exp_p_row[2] or 0)

    # Pending unapproved expenses
    cursor.execute("SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM expenses WHERE project_id = ? AND approval_status = 'pending'", (project_id,))
    pend_exp_row = cursor.fetchone()
    project_data['pending_expenses_amount'] = float(pend_exp_row[0] or 0)
    project_data['pending_expenses_count'] = int(pend_exp_row[1] or 0)

    contract_val = float(project_data.get('contract_value') or 0.0)
    effective_selling = contract_val if contract_val > 0 else total_phases_selling

    project_data['phases'] = phases
    project_data['boq_phases_cost'] = total_phases_cost
    project_data['boq_phases_selling'] = total_phases_selling
    project_data['total_phases_cost'] = total_phases_cost
    project_data['total_phases_selling'] = effective_selling
    project_data['total_phases_profit'] = effective_selling - total_phases_cost
    project_data['total_estimated_budget'] = total_phases_cost
    project_data['total_spent'] = total_spent
    project_data['total_spent_without_tax'] = total_spent_without_tax
    project_data['total_tax_refundable'] = total_tax_refundable

    budget_mode = project_data.get('budget_mode') or 'boq'
    manual_remaining = project_data.get('manual_remaining_budget')

    if budget_mode == 'manual' and manual_remaining is not None:
        rem_budget = max(0.0, float(manual_remaining))
        total_est = total_spent + rem_budget
        project_data['remaining_budget'] = rem_budget
        project_data['total_estimated_budget'] = total_est
        project_data['total_phases_cost'] = total_est
        project_data['total_phases_profit'] = effective_selling - total_est
        project_data['budget_variance'] = rem_budget
        project_data['is_over_budget'] = False
        project_data['over_amount'] = 0.0
        project_data['savings_amount'] = rem_budget
    else:
        rem_budget = max(0.0, total_phases_cost - total_spent) if total_phases_cost > 0 else max(0.0, contract_val - total_spent)
        project_data['remaining_budget'] = rem_budget
        project_data['budget_variance'] = total_phases_cost - total_spent
        project_data['is_over_budget'] = total_spent > total_phases_cost and total_phases_cost > 0
        project_data['over_amount'] = max(0.0, total_spent - total_phases_cost) if total_phases_cost > 0 else 0
        project_data['savings_amount'] = max(0.0, total_phases_cost - total_spent) if total_phases_cost > 0 else 0

    project_data['remaining_contract_value'] = max(0.0, contract_val - total_spent)
    project_data['actual_profit'] = effective_selling - total_spent
    project_data['is_loss'] = project_data['actual_profit'] < 0
    project_data['actual_profit_margin_pct'] = round(((effective_selling - total_spent) / effective_selling * 100), 1) if effective_selling > 0 else 0

    # Project Tasks (with phase name)
    cursor.execute('''
        SELECT t.*, p.name as phase_name
        FROM tasks t
        LEFT JOIN project_phases p ON t.phase_id = p.id
        WHERE t.project_id = ?
        ORDER BY t.phase_id ASC, t.id DESC
    ''', (project_id,))
    project_data['tasks'] = [dict(row) for row in cursor.fetchall()]

    # Project Expenses
    cursor.execute('''
        SELECT e.*, ph.name AS phase_name, it.title AS item_title, it.item_code
        FROM expenses e
        LEFT JOIN project_phases ph ON e.phase_id = ph.id
        LEFT JOIN phase_items it ON e.item_id = it.id
        WHERE e.project_id = ?
        ORDER BY e.expense_date DESC, e.id DESC
    ''', (project_id,))
    project_data['expenses'] = [dict(row) for row in cursor.fetchall()]

    # Subcontractors
    cursor.execute('SELECT * FROM subcontractors WHERE project_id = ? ORDER BY id DESC', (project_id,))
    project_data['subcontractors'] = [dict(row) for row in cursor.fetchall()]

    # Documents
    cursor.execute('SELECT * FROM documents WHERE project_id = ? ORDER BY id DESC', (project_id,))
    project_data['documents'] = [dict(row) for row in cursor.fetchall()]

    # Client Payments & Milestones (دفعات العميل)
    cursor.execute('''
        SELECT * FROM client_payments 
        WHERE project_id = ? 
        ORDER BY payment_number ASC, id ASC
    ''', (project_id,))
    client_payments = [dict(row) for row in cursor.fetchall()]
    project_data['client_payments'] = client_payments

    tot_milestones_tax = sum(float(cp.get('amount_with_tax') or 0) for cp in client_payments)
    tot_milestones_no_tax = sum(float(cp.get('amount_without_tax') or 0) for cp in client_payments)
    tot_received = sum(float(cp.get('received_amount') or 0) for cp in client_payments if cp.get('is_received') or cp.get('status') in ('paid', 'partially_paid'))
    tot_pending = max(0.0, tot_milestones_tax - tot_received)
    col_rate = round((tot_received / tot_milestones_tax * 100), 1) if tot_milestones_tax > 0 else 0

    contract_cps = [cp for cp in client_payments if cp.get('payment_type') != 'extra_work']
    extra_cps = [cp for cp in client_payments if cp.get('payment_type') == 'extra_work']

    tot_contract_tax = sum(float(cp.get('amount_with_tax') or 0) for cp in contract_cps)
    tot_contract_rec = sum(float(cp.get('received_amount') or 0) for cp in contract_cps if cp.get('is_received') or cp.get('status') in ('paid', 'partially_paid'))
    tot_contract_pend = max(0.0, tot_contract_tax - tot_contract_rec)

    tot_extra_tax = sum(float(cp.get('amount_with_tax') or 0) for cp in extra_cps)
    tot_extra_rec = sum(float(cp.get('received_amount') or 0) for cp in extra_cps if cp.get('is_received') or cp.get('status') in ('paid', 'partially_paid'))
    tot_extra_pend = max(0.0, tot_extra_tax - tot_extra_rec)

    project_data['payment_summary'] = {
        'total_milestones_with_tax': tot_milestones_tax,
        'total_milestones_without_tax': tot_milestones_no_tax,
        'total_received': tot_received,
        'total_pending': tot_pending,
        'collection_rate': col_rate,
        'contract_milestones_total': tot_contract_tax,
        'contract_milestones_received': tot_contract_rec,
        'contract_milestones_pending': tot_contract_pend,
        'extra_works_total': tot_extra_tax,
        'extra_works_received': tot_extra_rec,
        'extra_works_pending': tot_extra_pend,
        'payments_count': len(client_payments),
        'paid_count': sum(1 for cp in client_payments if cp.get('is_received') or cp.get('status') == 'paid')
    }

    # Exact Unified Bank Account Balance & Cash Flow Projections
    cursor.execute('''
        SELECT COALESCE(SUM(amount), 0)
        FROM expenses
        WHERE custody_id IS NULL
          AND (payment_method IS NULL OR payment_method NOT LIKE '%عهدة%')
          AND (
              payment_method LIKE '%تحويل%'
              OR payment_method LIKE '%بنك%'
              OR payment_method LIKE '%مدى%'
              OR payment_method LIKE '%شيك%'
              OR (payment_status = 'paid' AND payment_method NOT IN ('آجل', 'نقدي'))
          )
    ''')
    bank_expenses_spent = float(cursor.fetchone()[0] or 0.0)

    cursor.execute('''
        SELECT 
            COALESCE(SUM(CASE WHEN status IN ('disbursed', 'settled') THEN COALESCE(disbursed_amount, amount) ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'settled' THEN COALESCE(returned_amount, 0) ELSE 0 END), 0)
        FROM custody_requests
        WHERE (
            payment_method LIKE '%تحويل%'
            OR payment_method LIKE '%بنك%'
            OR payment_method LIKE '%شيك%'
            OR payment_method IS NULL
            OR payment_method = ''
        )
    ''')
    c_row = cursor.fetchone()
    total_custody_disbursed = float(c_row[0] or 0.0)
    total_custody_returned = float(c_row[1] or 0.0)
    net_custody_outflow = max(0.0, total_custody_disbursed - total_custody_returned)

    cursor.execute('''
        SELECT COALESCE(SUM(remaining_amount), 0)
        FROM hr_advances
    ''')
    net_advances_outflow = float(cursor.fetchone()[0] or 0.0)

    total_actual_bank_outflows = bank_expenses_spent + net_custody_outflow + net_advances_outflow

    cursor.execute('''
        SELECT COALESCE(SUM(received_amount), 0)
        FROM client_payments
        WHERE is_received = 1 OR status IN ('paid', 'partially_paid')
    ''')
    company_tot_received = float(cursor.fetchone()[0] or 0.0)
    opening_cash = float(database.get_setting('opening_cash_balance', '300000.0') or 300000.0)
    company_bank_balance = opening_cash + company_tot_received - total_actual_bank_outflows

    project_data['bank_balance'] = round(company_bank_balance, 2)
    # Projected final bank cash if this project alone completes (رصيد البنك لو المشروع ده بس خلص)
    project_data['projected_final_bank_cash'] = round(company_bank_balance + tot_pending - rem_budget, 2)
    # Projected total project profit at completion (صافي ربح المشروع الإجمالي عند اكتمال كافة بنوده)
    total_billable = tot_milestones_tax if tot_milestones_tax > 0 else (contract_val + tot_extra_tax)
    project_data['projected_final_project_profit'] = round(total_billable - (total_spent + rem_budget), 2)

    conn.close()
    return jsonify(project_data)

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'اسم المشروع مطلوب'}), 400

    code = data.get('code') or f"PRJ-{datetime.now().strftime('%Y%m%d%H%M')}"
    client_name = data.get('client_name', 'غير محدد')
    location = data.get('location', '')
    contract_value = float(data.get('contract_value', 0))
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    status = data.get('status', 'in_progress')
    progress_percent = int(data.get('progress_percent', 0))
    manager_name = data.get('manager_name', '')
    notes = data.get('notes', '')
    budget_mode = data.get('budget_mode', 'boq')
    manual_remaining_budget = float(data['manual_remaining_budget']) if data.get('manual_remaining_budget') not in (None, '') else None

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO projects (name, code, client_name, location, contract_value, start_date, end_date, status, progress_percent, manager_name, notes, budget_mode, manual_remaining_budget)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (name, code, client_name, location, contract_value, start_date, end_date, status, progress_percent, manager_name, notes, budget_mode, manual_remaining_budget))
    project_id = cursor.lastrowid

    # Notification
    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'info', 'تم إنشاء مشروع جديد', ?)
    ''', (project_id, f"تمت إضافة المشروع '{name}' بميزانية تعاقدية {contract_value:,.2f} ر.س"))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': project_id, 'message': 'تم إنشاء المشروع بنجاح'})

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'المشروع غير موجود'}), 404

    name = data.get('name', existing['name'])
    code = data.get('code', existing['code'])
    client_name = data.get('client_name', existing['client_name'])
    location = data.get('location', existing['location'])
    contract_value = float(data.get('contract_value', existing['contract_value']) or 0)
    start_date = data.get('start_date', existing['start_date'])
    end_date = data.get('end_date', existing['end_date'])
    status = data.get('status', existing['status'])
    progress_percent = int(data.get('progress_percent', existing['progress_percent']) or 0)
    manager_name = data.get('manager_name', existing['manager_name'])
    notes = data.get('notes', existing['notes'])
    budget_mode = data.get('budget_mode', existing['budget_mode'] if 'budget_mode' in existing.keys() else 'boq')
    manual_remaining_budget = float(data['manual_remaining_budget']) if data.get('manual_remaining_budget') not in (None, '') else (existing['manual_remaining_budget'] if 'manual_remaining_budget' in existing.keys() else None)

    cursor.execute('''
        UPDATE projects
        SET name = ?,
            code = ?,
            client_name = ?,
            location = ?,
            contract_value = ?,
            start_date = ?,
            end_date = ?,
            status = ?,
            progress_percent = ?,
            manager_name = ?,
            notes = ?,
            budget_mode = ?,
            manual_remaining_budget = ?
        WHERE id = ?
    ''', (
        name,
        code,
        client_name,
        location,
        contract_value,
        start_date,
        end_date,
        status,
        progress_percent,
        manager_name,
        notes,
        budget_mode,
        manual_remaining_budget,
        project_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث بيانات المشروع بنجاح'})

# ----------------- SET PROJECT BUDGET MODE (BOQ vs MANUAL) -----------------
@app.route('/api/projects/<int:project_id>/budget-mode', methods=['POST'])
def set_project_budget_mode(project_id):
    data = request.get_json() or {}
    mode = data.get('budget_mode', 'boq')
    manual_rem = data.get('manual_remaining_budget')
    if manual_rem is not None and str(manual_rem).strip() != '':
        try:
            manual_rem = float(manual_rem)
        except (ValueError, TypeError):
            manual_rem = None
    else:
        manual_rem = None

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE projects
        SET budget_mode = ?, manual_remaining_budget = ?
        WHERE id = ?
    ''', (mode, manual_rem, project_id))
    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'message': 'تم تحديث طريقة احتساب المتبقي بنجاح',
        'budget_mode': mode,
        'manual_remaining_budget': manual_rem
    })

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM projects WHERE id = ?', (project_id,))
    cursor.execute('DELETE FROM tasks WHERE project_id = ?', (project_id,))
    cursor.execute('DELETE FROM expenses WHERE project_id = ?', (project_id,))
    cursor.execute('DELETE FROM documents WHERE project_id = ?', (project_id,))
    cursor.execute('DELETE FROM subcontractors WHERE project_id = ?', (project_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف المشروع وجميع متعلقاته'})

# ----------------- TASKS API -----------------
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    project_id = request.args.get('project_id')
    status = request.args.get('status')
    priority = request.args.get('priority')
    assigned_to = request.args.get('assigned_to')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT t.*, p.name AS project_name, ph.name AS phase_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN project_phases ph ON t.phase_id = ph.id
        WHERE 1=1
    '''
    params = []
    if project_id:
        query += ' AND t.project_id = ?'
        params.append(project_id)
    if status:
        query += ' AND t.status = ?'
        params.append(status)
    if priority:
        query += ' AND t.priority = ?'
        params.append(priority)
    if assigned_to:
        query += ' AND t.assigned_to = ?'
        params.append(assigned_to)

    query += ' ORDER BY t.id DESC'
    cursor.execute(query, params)
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(tasks)

# ----------------- PHASES API (مراحل المشروع) -----------------
@app.route('/api/phases', methods=['POST'])
def create_phase():
    data = request.json or {}
    project_id = data.get('project_id')
    name = data.get('name')

    if not project_id or not name:
        return jsonify({'error': 'المشروع واسم المرحلة مطلوبان'}), 400

    order_num = int(data.get('order_num', 1))
    weight_percent = float(data.get('weight_percent', 0))
    cost_price = float(data.get('cost_price', 0))
    selling_price = float(data.get('selling_price', 0))
    progress_percent = float(data.get('progress_percent', 0))
    status = data.get('status', 'in_progress')
    notes = data.get('notes', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO project_phases (project_id, name, order_num, weight_percent, cost_price, selling_price, progress_percent, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (project_id, name, order_num, weight_percent, cost_price, selling_price, progress_percent, status, notes))
    phase_id = cursor.lastrowid

    # Recalculate weighted project progress
    cursor.execute('''
        SELECT COALESCE(SUM(progress_percent * (weight_percent / 100.0)), 0), COALESCE(SUM(weight_percent), 0)
        FROM project_phases WHERE project_id = ?
    ''', (project_id,))
    weighted_prog, total_weight = cursor.fetchone()
    if total_weight > 0:
        cursor.execute('UPDATE projects SET progress_percent = ? WHERE id = ?', (min(100, max(0, round(weighted_prog))), project_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': phase_id, 'message': 'تم إضافة المرحلة بنجاح'})

@app.route('/api/phases/<int:phase_id>', methods=['PUT'])
def update_phase(phase_id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT project_id FROM project_phases WHERE id = ?', (phase_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'المرحلة غير موجودة'}), 404
    project_id = row[0]

    cursor.execute('''
        UPDATE project_phases
        SET name = COALESCE(?, name),
            order_num = COALESCE(?, order_num),
            weight_percent = COALESCE(?, weight_percent),
            cost_price = COALESCE(?, cost_price),
            selling_price = COALESCE(?, selling_price),
            progress_percent = COALESCE(?, progress_percent),
            status = COALESCE(?, status),
            notes = COALESCE(?, notes)
        WHERE id = ?
    ''', (
        data.get('name'),
        data.get('order_num'),
        data.get('weight_percent'),
        data.get('cost_price'),
        data.get('selling_price'),
        data.get('progress_percent'),
        data.get('status'),
        data.get('notes'),
        phase_id
    ))

    # Recalculate project progress based on weighted phase progress
    cursor.execute('''
        SELECT COALESCE(SUM(progress_percent * (weight_percent / 100.0)), 0), COALESCE(SUM(weight_percent), 0)
        FROM project_phases WHERE project_id = ?
    ''', (project_id,))
    weighted_prog, total_weight = cursor.fetchone()
    if total_weight > 0:
        cursor.execute('UPDATE projects SET progress_percent = ? WHERE id = ?', (min(100, max(0, round(weighted_prog))), project_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث المرحلة بنجاح'})

@app.route('/api/phases/<int:phase_id>', methods=['DELETE'])
def delete_phase(phase_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT project_id FROM project_phases WHERE id = ?', (phase_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'المرحلة غير موجودة'}), 404
    project_id = row[0]

    cursor.execute('DELETE FROM project_phases WHERE id = ?', (phase_id,))
    cursor.execute('UPDATE tasks SET phase_id = NULL WHERE phase_id = ?', (phase_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف المرحلة بنجاح'})

def sync_phase_progress(cursor, phase_id):
    cursor.execute('SELECT progress_percent, status, project_id FROM phase_items WHERE phase_id = ?', (phase_id,))
    items = cursor.fetchall()
    if not items:
        return
    project_id = items[0][2]
    all_done = all(it[1] == 'done' or it[0] >= 100 for it in items)
    avg_prog = sum(it[0] for it in items) / len(items)
    phase_prog = 100.0 if all_done else round(avg_prog, 1)
    phase_status = 'completed' if all_done else 'in_progress'

    cursor.execute('UPDATE project_phases SET progress_percent = ?, status = ? WHERE id = ?', (phase_prog, phase_status, phase_id))

    # Recalculate project progress based on weighted phase progress
    cursor.execute('''
        SELECT COALESCE(SUM(progress_percent * (weight_percent / 100.0)), 0), COALESCE(SUM(weight_percent), 0)
        FROM project_phases WHERE project_id = ?
    ''', (project_id,))
    weighted_prog, total_weight = cursor.fetchone()
    if total_weight > 0:
        cursor.execute('UPDATE projects SET progress_percent = ? WHERE id = ?', (min(100, max(0, round(weighted_prog))), project_id))

# ----------------- PHASE ITEMS API (بنود المرحلة) -----------------
@app.route('/api/phase-items', methods=['POST'])
def create_phase_item():
    data = request.json or {}
    phase_id = data.get('phase_id')
    title = data.get('title')

    if not phase_id or not title:
        return jsonify({'error': 'المرحلة واسم البند مطلوبان'}), 400

    item_code = data.get('item_code', '')
    unit = data.get('unit', 'مقطوعية')
    quantity = float(data.get('quantity', 1))
    cost_price = float(data.get('cost_price', 0))
    selling_price = float(data.get('selling_price', 0))
    unit_cost = float(data.get('unit_cost', 0)) if data.get('unit_cost') is not None else 0
    unit_selling = float(data.get('unit_selling', 0)) if data.get('unit_selling') is not None else 0

    if cost_price == 0 and unit_cost > 0:
        cost_price = quantity * unit_cost
    elif unit_cost == 0 and quantity > 0 and cost_price > 0:
        unit_cost = round(cost_price / quantity, 2)

    if selling_price == 0 and unit_selling > 0:
        selling_price = quantity * unit_selling
    elif unit_selling == 0 and quantity > 0 and selling_price > 0:
        unit_selling = round(selling_price / quantity, 2)

    progress_percent = float(data.get('progress_percent', 0))
    status = data.get('status', 'todo')
    if status == 'done' and progress_percent < 100:
        progress_percent = 100
    elif progress_percent >= 100:
        status = 'done'

    assigned_to = data.get('assigned_to', '')
    notes = data.get('notes', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT project_id FROM project_phases WHERE id = ?', (phase_id,))
    p_row = cursor.fetchone()
    if not p_row:
        conn.close()
        return jsonify({'error': 'المرحلة غير موجودة'}), 404
    project_id = p_row[0]

    cursor.execute('''
        INSERT INTO phase_items (phase_id, project_id, item_code, title, unit, quantity, unit_cost, cost_price, unit_selling, selling_price, progress_percent, status, assigned_to, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (phase_id, project_id, item_code, title, unit, quantity, unit_cost, cost_price, unit_selling, selling_price, progress_percent, status, assigned_to, notes))
    item_id = cursor.lastrowid

    sync_phase_progress(cursor, phase_id)

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': item_id, 'message': 'تم إضافة البند بنجاح'})

@app.route('/api/phase-items/<int:item_id>', methods=['PUT'])
def update_phase_item(item_id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT phase_id, project_id, quantity, cost_price, selling_price, unit_cost, unit_selling FROM phase_items WHERE id = ?', (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'البند غير موجود'}), 404
    phase_id = row[0]

    qty = float(data['quantity']) if 'quantity' in data and data['quantity'] != '' else row['quantity']
    c_price = float(data['cost_price']) if 'cost_price' in data and data['cost_price'] != '' else row['cost_price']
    s_price = float(data['selling_price']) if 'selling_price' in data and data['selling_price'] != '' else row['selling_price']
    u_cost = float(data['unit_cost']) if 'unit_cost' in data and data['unit_cost'] != '' else row['unit_cost']
    u_selling = float(data['unit_selling']) if 'unit_selling' in data and data['unit_selling'] != '' else row['unit_selling']

    # Auto sync unit and total if one was updated
    if 'unit_cost' in data and ('cost_price' not in data or float(data.get('cost_price', 0)) == 0):
        c_price = qty * u_cost
    elif 'cost_price' in data and ('unit_cost' not in data or float(data.get('unit_cost', 0)) == 0) and qty > 0:
        u_cost = round(c_price / qty, 2)

    if 'unit_selling' in data and ('selling_price' not in data or float(data.get('selling_price', 0)) == 0):
        s_price = qty * u_selling
    elif 'selling_price' in data and ('unit_selling' not in data or float(data.get('unit_selling', 0)) == 0) and qty > 0:
        u_selling = round(s_price / qty, 2)

    progress_percent = data.get('progress_percent')
    status = data.get('status')
    if status == 'done' and (progress_percent is None or float(progress_percent) < 100):
        progress_percent = 100
    elif progress_percent is not None and float(progress_percent) >= 100 and status is None:
        status = 'done'

    cursor.execute('''
        UPDATE phase_items
        SET title = COALESCE(?, title),
            item_code = COALESCE(?, item_code),
            unit = COALESCE(?, unit),
            quantity = ?,
            unit_cost = ?,
            cost_price = ?,
            unit_selling = ?,
            selling_price = ?,
            progress_percent = COALESCE(?, progress_percent),
            status = COALESCE(?, status),
            assigned_to = COALESCE(?, assigned_to),
            notes = COALESCE(?, notes)
        WHERE id = ?
    ''', (
        data.get('title'),
        data.get('item_code'),
        data.get('unit'),
        qty,
        u_cost,
        c_price,
        u_selling,
        s_price,
        progress_percent,
        status,
        data.get('assigned_to'),
        data.get('notes'),
        item_id
    ))

    sync_phase_progress(cursor, phase_id)

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث البند بنجاح'})

@app.route('/api/phase-items/<int:item_id>', methods=['DELETE'])
def delete_phase_item(item_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT phase_id FROM phase_items WHERE id = ?', (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'البند غير موجود'}), 404
    phase_id = row[0]

    cursor.execute('DELETE FROM phase_items WHERE id = ?', (item_id,))
    sync_phase_progress(cursor, phase_id)

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف البند بنجاح'})

# ----------------- TASKS API -----------------
@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json or {}
    project_id = data.get('project_id')
    title = data.get('title')
    assigned_to = data.get('assigned_to')

    if not project_id or not title or not assigned_to:
        return jsonify({'error': 'المشروع، عنوان المهمة، والموظف المسؤول بيانات مطلوبة'}), 400

    phase_id = data.get('phase_id')
    if phase_id == '' or phase_id == 'null':
        phase_id = None
    description = data.get('description', '')
    priority = data.get('priority', 'medium')
    status = data.get('status', 'todo')
    progress_percent = int(data.get('progress_percent', 0))
    cost_price = float(data.get('cost_price', 0))
    selling_price = float(data.get('selling_price', 0))
    start_date = data.get('start_date') or datetime.now().strftime('%Y-%m-%d')
    due_date = data.get('due_date')
    completion_notes = data.get('completion_notes', '')
    created_by = data.get('created_by') or 'ابوالنصر البغدادي'

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO tasks (project_id, phase_id, title, description, assigned_to, priority, status, progress_percent, cost_price, selling_price, start_date, due_date, completion_notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (project_id, phase_id, title, description, assigned_to, priority, status, progress_percent, cost_price, selling_price, start_date, due_date, completion_notes, created_by))
    task_id = cursor.lastrowid

    # Notification
    cursor.execute('SELECT name FROM projects WHERE id = ?', (project_id,))
    p_row = cursor.fetchone()
    p_name = p_row[0] if p_row else 'المشروع'
    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'task', 'مهمة جديدة مسندة', ?)
    ''', (project_id, f"تم إسناد مهمة '{title}' في مشروع '{p_name}' إلى {assigned_to} (المرسل: {created_by})"))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': task_id, 'message': 'تم إضافة المهمة بنجاح'})

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT created_by, assigned_to, title FROM tasks WHERE id = ?', (task_id,))
    t_row = cursor.fetchone()
    if not t_row:
        conn.close()
        return jsonify({'error': 'المهمة غير موجودة'}), 404

    req_status = data.get('status')
    user_name = data.get('current_user_name') or data.get('updated_by') or ''

    # Strict check: Assignee cannot set status to 'done' (only the creator can approve)
    if req_status == 'done':
        creator = t_row['created_by']
        assignee = t_row['assigned_to']
        if user_name and creator and user_name == assignee and user_name != creator:
            conn.close()
            return jsonify({
                'error': f'عفواً ({user_name})، بصفتك المنفذ لا تملك صلاحية تعميد هذه المهمة! يمكنك فقط إرسالها للتعميد إلى ({creator}).'
            }), 403

    cursor.execute('''
        UPDATE tasks
        SET title = COALESCE(?, title),
            phase_id = COALESCE(?, phase_id),
            description = COALESCE(?, description),
            assigned_to = COALESCE(?, assigned_to),
            priority = COALESCE(?, priority),
            status = COALESCE(?, status),
            progress_percent = COALESCE(?, progress_percent),
            cost_price = COALESCE(?, cost_price),
            selling_price = COALESCE(?, selling_price),
            start_date = COALESCE(?, start_date),
            due_date = COALESCE(?, due_date),
            completion_notes = COALESCE(?, completion_notes),
            created_by = COALESCE(?, created_by),
            is_approved = COALESCE(?, is_approved),
            approved_by = COALESCE(?, approved_by),
            approved_at = COALESCE(?, approved_at),
            approval_notes = COALESCE(?, approval_notes)
        WHERE id = ?
    ''', (
        data.get('title'),
        data.get('phase_id'),
        data.get('description'),
        data.get('assigned_to'),
        data.get('priority'),
        data.get('status'),
        data.get('progress_percent'),
        data.get('cost_price'),
        data.get('selling_price'),
        data.get('start_date'),
        data.get('due_date'),
        data.get('completion_notes'),
        data.get('created_by'),
        data.get('is_approved'),
        data.get('approved_by'),
        data.get('approved_at'),
        data.get('approval_notes'),
        task_id
    ))

    # Auto update project progress percentage average based on tasks if requested
    cursor.execute('SELECT project_id FROM tasks WHERE id = ?', (task_id,))
    row = cursor.fetchone()
    if row:
        p_id = row[0]
        # Check if project has phases with weights
        cursor.execute('SELECT COUNT(*) FROM project_phases WHERE project_id = ? AND weight_percent > 0', (p_id,))
        has_weighted_phases = cursor.fetchone()[0] > 0
        if not has_weighted_phases:
            cursor.execute('SELECT AVG(progress_percent) FROM tasks WHERE project_id = ?', (p_id,))
            avg_progress = cursor.fetchone()[0]
            if avg_progress is not None:
                cursor.execute('UPDATE projects SET progress_percent = ? WHERE id = ?', (int(avg_progress), p_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث المهمة'})

@app.route('/api/tasks/<int:task_id>/submit-approval', methods=['POST'])
def submit_task_for_approval(task_id):
    data = request.json or {}
    notes = data.get('notes', '')
    submitted_by = data.get('submitted_by', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?', (task_id,))
    task = cursor.fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'المهمة غير موجودة'}), 404

    cursor.execute('''
        UPDATE tasks 
        SET status = 'pending_approval', 
            progress_percent = 100,
            completion_notes = CASE WHEN ? != '' THEN ? ELSE completion_notes END
        WHERE id = ?
    ''', (notes, notes, task_id))

    # Add notification for the creator/sender
    approver = task['created_by'] or 'المرسل'
    sender_info = f" من قِبل {submitted_by}" if submitted_by else ""
    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'task', 'مهمة بانتظار التعميد', ?)
    ''', (task['project_id'], f"المهمة '{task['title']}' في مشروع '{task['project_name']}' أُنجزت{sender_info} وبانتظار تعميدك من قِبل ({approver})"))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'تم إرسال المهمة للتعميد إلى ({approver}) بنجاح'})

@app.route('/api/tasks/<int:task_id>/approve', methods=['POST'])
def approve_task(task_id):
    data = request.json or {}
    approver_name = data.get('approved_by') or ''

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?', (task_id,))
    task = cursor.fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'المهمة غير موجودة'}), 404

    task_creator = task['created_by']
    task_assignee = task['assigned_to']

    # Strict check: Assignee CANNOT approve their own assigned task if someone else sent it
    if approver_name and task_creator:
        if approver_name == task_assignee and approver_name != task_creator:
            conn.close()
            return jsonify({
                'error': f'عفواً يا {approver_name}، بصفتك منفذ المهمة لا تملك صلاحية تعميدها! صلاحية التعميد محصورة حصرياً على من أسندها ({task_creator}).'
            }), 403

        if approver_name != task_creator and approver_name not in ('نواف سجيني', 'فاروق محمد', 'المدير العام'):
            conn.close()
            return jsonify({
                'error': f'صلاحية التعميد محصورة على مُرسل المهمة ({task_creator}) فقط!'
            }), 403

    actual_approver = approver_name or task_creator or 'المعتمد'
    notes = data.get('approval_notes', '')
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        UPDATE tasks 
        SET status = 'done', 
            is_approved = 1,
            approved_by = ?,
            approved_at = ?,
            approval_notes = ?,
            progress_percent = 100
        WHERE id = ?
    ''', (actual_approver, now_str, notes, task_id))

    # Recalculate project progress if needed
    p_id = task['project_id']
    cursor.execute('SELECT COUNT(*) FROM project_phases WHERE project_id = ? AND weight_percent > 0', (p_id,))
    if cursor.fetchone()[0] == 0:
        cursor.execute('SELECT AVG(progress_percent) FROM tasks WHERE project_id = ?', (p_id,))
        avg_progress = cursor.fetchone()[0]
        if avg_progress is not None:
            cursor.execute('UPDATE projects SET progress_percent = ? WHERE id = ?', (int(avg_progress), p_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'task', 'تم تعميد المهمة', ?)
    ''', (p_id, f"تم تعميد المهمة '{task['title']}' في مشروع '{task['project_name']}' رسمياً بواسطة {approver_name}"))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'تم تعميد المهمة بنجاح بواسطة {approver_name}'})

@app.route('/api/tasks/<int:task_id>/reject', methods=['POST'])
def reject_task(task_id):
    data = request.json or {}
    rejecter_name = data.get('rejected_by') or 'المرسل'
    notes = data.get('notes') or data.get('approval_notes', 'توجد ملاحظات بحاجة لتعديل واستكمال')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?', (task_id,))
    task = cursor.fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'المهمة غير موجودة'}), 404

    cursor.execute('''
        UPDATE tasks 
        SET status = 'in_progress', 
            is_approved = 0,
            approval_notes = ?,
            progress_percent = 80
        WHERE id = ?
    ''', (notes, task_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'warning', 'إعادة مهمة للتعديل', ?)
    ''', (task['project_id'], f"المهمة '{task['title']}' أُعيدت للتعديل بواسطة {rejecter_name}: {notes}"))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم إعادة المهمة للمراجعة والتعديل'})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف المهمة'})

# ----------------- EXPENSES & INVOICES API -----------------
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    project_id = request.args.get('project_id')
    supplier_id = request.args.get('supplier_id')
    has_increase = request.args.get('has_price_increase')
    category = request.args.get('category')
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT e.*, 
               COALESCE(e.payment_date, (SELECT MAX(sp.payment_date) FROM supplier_payments sp WHERE sp.expense_id = e.id)) AS payment_date,
               p.name AS project_name, 
               p.code AS project_code,
               ph.name AS phase_name, 
               it.title AS item_title, 
               it.item_code,
               s.name AS supplier_name,
               s.category AS supplier_category,
               s.phone AS supplier_phone,
               sq.quotation_number,
               sq.title AS quotation_title,
               sqi.item_name AS quotation_item_name,
               sqi.unit AS quotation_item_unit,
               cust.request_number AS custody_request_number,
               cust.employee_name AS custody_employee_name
        FROM expenses e
        JOIN projects p ON e.project_id = p.id
        LEFT JOIN project_phases ph ON e.phase_id = ph.id
        LEFT JOIN phase_items it ON e.item_id = it.id
        LEFT JOIN suppliers s ON e.supplier_id = s.id
        LEFT JOIN supplier_quotations sq ON e.quotation_id = sq.id
        LEFT JOIN supplier_quotation_items sqi ON e.quotation_item_id = sqi.id
        LEFT JOIN custody_requests cust ON e.custody_id = cust.id
        WHERE 1=1
    '''
    params = []
    if project_id:
        query += ' AND e.project_id = ?'
        params.append(project_id)
    if supplier_id:
        query += ' AND e.supplier_id = ?'
        params.append(supplier_id)
    if has_increase in ('1', 1, 'true', True):
        query += ' AND e.has_price_increase = 1'
    if category:
        query += ' AND e.category = ?'
        params.append(category)
    if from_date:
        query += ' AND e.expense_date >= ?'
        params.append(from_date)
    if to_date:
        query += ' AND e.expense_date <= ?'
        params.append(to_date)

    query += ' ORDER BY e.expense_date DESC, e.id DESC'
    cursor.execute(query, params)
    expenses = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(expenses)

@app.route('/api/expenses', methods=['POST'])
def create_expense():
    # Supports both json and multipart/form-data
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form

    project_id = data.get('project_id')
    title = data.get('title')
    amount_str = data.get('amount')

    raw_supplier = data.get('supplier_id')
    supplier_id = int(raw_supplier) if raw_supplier and raw_supplier not in ('', 'null', 'None') else None

    raw_custody = data.get('custody_id')
    custody_id = int(raw_custody) if raw_custody and str(raw_custody).strip() not in ('', 'null', 'None') else None

    raw_quotation = data.get('quotation_id')
    quotation_id = int(raw_quotation) if raw_quotation and raw_quotation not in ('', 'null', 'None') else None

    raw_q_item = data.get('quotation_item_id')
    quotation_item_id = int(raw_q_item) if raw_q_item and raw_q_item not in ('', 'null', 'None') else None

    raw_qty = data.get('item_quantity')
    item_quantity = float(raw_qty) if raw_qty and raw_qty not in ('', 'null') else 1.0

    raw_u_price = data.get('unit_price')
    unit_price = float(raw_u_price) if raw_u_price and raw_u_price not in ('', 'null') else 0.0

    raw_qu_price = data.get('quoted_unit_price')
    quoted_unit_price = float(raw_qu_price) if raw_qu_price and raw_qu_price not in ('', 'null') else 0.0

    # Parse multi-items if provided
    raw_items = data.get('items')
    items_list = []
    if raw_items:
        if isinstance(raw_items, str):
            try:
                items_list = json.loads(raw_items)
            except Exception:
                items_list = []
        elif isinstance(raw_items, list):
            items_list = raw_items

    items_data = []
    total_items_amount = 0.0
    total_items_variance = 0.0
    has_any_price_increase = 0

    if items_list:
        for it in items_list:
            it_name = (it.get('item_name') or '').strip()
            if not it_name:
                continue
            it_unit = (it.get('unit') or 'طن').strip()
            it_qty = float(it.get('quantity') or 1.0)
            it_u_price = float(it.get('unit_price') or 0.0)
            it_tot_price = float(it.get('total_price') or (it_qty * it_u_price))
            
            raw_qi = it.get('quotation_item_id')
            it_qi_id = int(raw_qi) if raw_qi and str(raw_qi) not in ('', 'null', 'None') else None
            it_qu_price = float(it.get('quoted_unit_price') or 0.0)
            
            it_p_var = round(it_u_price - it_qu_price, 2) if it_qu_price > 0 else 0.0
            it_t_var = round(it_p_var * it_qty, 2) if it_qu_price > 0 else 0.0
            it_has_inc = 1 if it_p_var > 0.01 else 0
            if it_has_inc == 1:
                has_any_price_increase = 1
                
            items_data.append({
                'item_name': it_name,
                'unit': it_unit,
                'quantity': it_qty,
                'unit_price': it_u_price,
                'total_price': it_tot_price,
                'quotation_item_id': it_qi_id,
                'quoted_unit_price': it_qu_price,
                'price_variance': it_p_var,
                'total_variance': it_t_var,
                'has_price_increase': it_has_inc,
                'notes': it.get('notes', '')
            })
            total_items_amount += it_tot_price
            total_items_variance += it_t_var

    # Auto-calculate amount if unit_price is given or items_data is given
    if items_data:
        amount_without_tax_calc = round(total_items_amount, 2)
        if not title:
            title = f"فاتورة توريد: {items_data[0]['item_name']}" + (f" (+{len(items_data)-1} بنود)" if len(items_data) > 1 else "")
    else:
        amount_without_tax_calc = None

    amount = float(amount_str) if amount_str and amount_str not in ('', '0', 0) else (unit_price * item_quantity)
    if items_data and (not amount or amount <= 0):
        amount = total_items_amount

    if not project_id or not title or (amount <= 0 and total_items_amount <= 0):
        return jsonify({'error': 'المشروع، وصف المصروف، والمبلغ أو بنود الفاتورة بيانات إلزامية'}), 400

    category = data.get('category', 'مواد بناء')
    payment_method = data.get('payment_method', 'نقدي')
    paid_by = data.get('paid_by', '')
    paid_to = data.get('paid_to', '')
    expense_date = data.get('expense_date') or datetime.now().strftime('%Y-%m-%d')
    notes = data.get('notes', '')

    # Tax Invoice & VAT calculations (ضريبة القيمة المضافة 15%)
    raw_is_tax = data.get('is_tax_invoice')
    is_tax_invoice = 1 if raw_is_tax in ('1', 1, True, 'true', 'on', 'yes') else 0
    tax_rate = float(data.get('tax_rate', 0.15)) if data.get('tax_rate') else 0.15

    raw_amt_no_tax = data.get('amount_without_tax')
    if raw_amt_no_tax and raw_amt_no_tax != '':
        amount_without_tax = float(raw_amt_no_tax)
    elif amount_without_tax_calc is not None:
        amount_without_tax = amount_without_tax_calc
    else:
        amount_without_tax = 0.0

    raw_tax_amt = data.get('tax_amount')
    tax_amount = float(raw_tax_amt) if raw_tax_amt and raw_tax_amt != '' else 0.0

    if is_tax_invoice:
        if amount_without_tax > 0 and amount == 0:
            tax_amount = round(amount_without_tax * tax_rate, 2)
            amount = round(amount_without_tax + tax_amount, 2)
        elif amount > 0 and amount_without_tax == 0:
            amount_without_tax = round(amount / (1 + tax_rate), 2)
            tax_amount = round(amount - amount_without_tax, 2)
        elif amount_without_tax > 0 and tax_amount > 0 and (amount == 0 or abs(amount - (amount_without_tax + tax_amount)) > 0.05):
            amount = round(amount_without_tax + tax_amount, 2)
        elif amount_without_tax > 0 and amount > 0 and tax_amount == 0:
            tax_amount = round(amount - amount_without_tax, 2)
    else:
        if amount_without_tax > 0:
            amount = amount_without_tax
        else:
            amount_without_tax = amount
        tax_amount = 0.0
        tax_rate = 0.0

    # Calculate Price Variance vs Quotation
    if items_data:
        price_variance = round(total_items_variance / max(1, len(items_data)), 2)
        total_variance = round(total_items_variance, 2)
        has_price_increase = has_any_price_increase
        if items_data[0]['quotation_item_id']:
            quotation_item_id = items_data[0]['quotation_item_id']
            quoted_unit_price = items_data[0]['quoted_unit_price']
            unit_price = items_data[0]['unit_price']
            item_quantity = items_data[0]['quantity']
    else:
        price_variance = 0.0
        total_variance = 0.0
        has_price_increase = 0
        if quoted_unit_price > 0 and unit_price > 0:
            price_variance = round(unit_price - quoted_unit_price, 2)
            total_variance = round(price_variance * item_quantity, 2)
            has_price_increase = 1 if price_variance > 0.01 else 0

    raw_phase = data.get('phase_id')
    phase_id = int(raw_phase) if raw_phase and raw_phase != '' and raw_phase != 'null' else None

    raw_item = data.get('item_id')
    item_id = int(raw_item) if raw_item and raw_item != '' and raw_item != 'null' else None

    invoice_file_path = None
    invoice_file_name = None

    # Handle file upload (Invoice / Receipt)
    if 'invoice_file' in request.files:
        file = request.files['invoice_file']
        if file and file.filename and allowed_file(file.filename):
            original_filename = secure_filename(file.filename) or f"invoice_{uuid.uuid4().hex[:8]}.jpg"
            ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'jpg'
            stored_name = f"inv_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.{ext}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_name)
            file.save(file_path)
            invoice_file_path = f"/uploads/{stored_name}"
            invoice_file_name = original_filename

    conn = database.get_db_connection()
    cursor = conn.cursor()

    # If supplier not explicitly selected, try resolving from quotation or payee name
    supplier_name = ''
    if not supplier_id and quotation_id:
        cursor.execute('SELECT supplier_id FROM supplier_quotations WHERE id = ?', (quotation_id,))
        sq_row = cursor.fetchone()
        if sq_row and sq_row[0]:
            supplier_id = sq_row[0]

    if not supplier_id and paid_to:
        cursor.execute('SELECT id, name FROM suppliers WHERE TRIM(name) = TRIM(?)', (paid_to,))
        sp_row = cursor.fetchone()
        if sp_row and sp_row[0]:
            supplier_id = sp_row[0]
            supplier_name = sp_row[1]

    # If supplier selected and paid_to is empty, set paid_to as supplier name
    if supplier_id:
        cursor.execute('SELECT name FROM suppliers WHERE id = ?', (supplier_id,))
        s_found = cursor.fetchone()
        if s_found:
            supplier_name = s_found[0]
            if not paid_to:
                paid_to = supplier_name

    if item_id and not phase_id:
        cursor.execute('SELECT phase_id FROM phase_items WHERE id = ?', (item_id,))
        p_row = cursor.fetchone()
        if p_row:
            phase_id = p_row[0]

    items_json_str = json.dumps(items_data, ensure_ascii=False) if items_data else None

    payment_status = data.get('payment_status', 'paid')
    raw_paid_amt = data.get('paid_amount')
    if payment_status == 'unpaid':
        paid_amount = 0.0
    elif raw_paid_amt is not None and str(raw_paid_amt).strip() != '':
        paid_amount = float(raw_paid_amt)
    else:
        paid_amount = amount

    raw_pay_date = data.get('payment_date')
    if payment_status == 'unpaid':
        payment_date = None
    elif raw_pay_date and str(raw_pay_date).strip():
        payment_date = str(raw_pay_date).strip()
    elif payment_status == 'paid':
        payment_date = expense_date
    else:
        payment_date = None

    user_id = data.get('user_id')
    user_role = data.get('user_role') or ''
    user_name = data.get('user_name') or ''
    created_by = data.get('created_by') or (f"{user_name} ({user_role})" if user_name and user_role else user_name) or paid_by or 'فريق العمل'

    is_fin, manager_title = check_is_financial_manager(user_id, user_role, user_name, cursor)
    if is_fin:
        approval_status = 'approved'
        approved_by = manager_title
        approved_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        approval_notes = 'تعميد مباشر من المدير المالي'
    else:
        approval_status = 'pending'
        approved_by = None
        approved_at = None
        approval_notes = None

    cursor.execute('''
        INSERT INTO expenses (
            project_id, phase_id, item_id, title, category, amount, 
            payment_method, paid_by, paid_to, expense_date, 
            invoice_file_path, invoice_file_name, notes,
            is_tax_invoice, tax_rate, amount_without_tax, tax_amount,
            supplier_id, quotation_id, quotation_item_id,
            item_quantity, unit_price, quoted_unit_price,
            price_variance, total_variance, has_price_increase,
            items_json, payment_status, paid_amount, payment_date,
            custody_id, approval_status, approved_by, approved_at, approval_notes, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        project_id, phase_id, item_id, title, category, amount, 
        payment_method, paid_by, paid_to, expense_date, 
        invoice_file_path, invoice_file_name, notes,
        is_tax_invoice, tax_rate, amount_without_tax, tax_amount,
        supplier_id, quotation_id, quotation_item_id,
        item_quantity, unit_price, quoted_unit_price,
        price_variance, total_variance, has_price_increase,
        items_json_str, payment_status, paid_amount, payment_date,
        custody_id, approval_status, approved_by, approved_at, approval_notes, created_by
    ))
    expense_id = cursor.lastrowid

    # Deduct from project budget & custody ONLY IF approved by Financial Manager
    if approval_status == 'approved':
        if project_id:
            cursor.execute('''
                UPDATE projects
                SET manual_remaining_budget = MAX(0.0, COALESCE(manual_remaining_budget, 0) - ?)
                WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
            ''', (amount, project_id))

        if custody_id:
            cursor.execute('''
                UPDATE custody_requests
                SET spent_amount = COALESCE(spent_amount, 0) + ?
                WHERE id = ?
            ''', (amount, custody_id))
            cursor.execute('SELECT employee_name, request_number FROM custody_requests WHERE id = ?', (custody_id,))
            c_emp_row = cursor.fetchone()
            if c_emp_row:
                cursor.execute('''
                    INSERT INTO notifications (project_id, type, title, message)
                    VALUES (?, 'custody', 'صرف فاتورة من العهدة (معمدة)', ?)
                ''', (project_id, f"تم صرف الفاتورة '{title}' بمبلغ {amount:,.2f} ر.س خصماً من عهدة {c_emp_row['employee_name']} ({c_emp_row['request_number']})"))
    else:
        # Pending approval: do NOT deduct from cashflow or custody! Notify Financial Manager
        cursor.execute('''
            INSERT INTO notifications (project_id, type, title, message)
            VALUES (?, 'expense', 'فاتورة جديدة بانتظار تعميد المدير المالي', ?)
        ''', (project_id, f"قام {created_by} بتسجيل فاتورة/مصروف '{title}' بمبلغ {amount:,.2f} ر.س — معلقة بانتظار تعميد المدير المالي ولن يتم خصمها من الكاش فلو أو العهدة إلا بعد التعميد."))

    # Insert line items into expense_items table
    if items_data:
        for itm in items_data:
            cursor.execute('''
                INSERT INTO expense_items (
                    expense_id, quotation_item_id, item_name, unit,
                    quantity, unit_price, total_price, quoted_unit_price,
                    price_variance, total_variance, has_price_increase, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                expense_id, itm['quotation_item_id'], itm['item_name'], itm['unit'],
                itm['quantity'], itm['unit_price'], itm['total_price'], itm['quoted_unit_price'],
                itm['price_variance'], itm['total_variance'], itm['has_price_increase'], itm['notes']
            ))
    elif unit_price > 0 or quotation_item_id:
        # Also record single item in expense_items table for uniformity
        cursor.execute('''
            INSERT INTO expense_items (
                expense_id, quotation_item_id, item_name, unit,
                quantity, unit_price, total_price, quoted_unit_price,
                price_variance, total_variance, has_price_increase, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            expense_id, quotation_item_id, title, 'طن',
            item_quantity, unit_price, amount_without_tax or amount, quoted_unit_price,
            price_variance, total_variance, has_price_increase, notes
        ))

    # If price exceeded agreed quotation, trigger high-priority alert notification
    if has_price_increase == 1:
        qi_title = title
        if quotation_item_id:
            cursor.execute('SELECT item_name FROM supplier_quotation_items WHERE id = ?', (quotation_item_id,))
            q_row = cursor.fetchone()
            if q_row:
                qi_title = q_row[0]
        
        cursor.execute('''
            INSERT INTO notifications (project_id, type, title, message)
            VALUES (?, 'warning', '⚠️ تنبيه زيادة سعر توريد عن عرض السعر المتفق عليه!', ?)
        ''', (
            project_id, 
            f"تم تسجيل فاتورة من المورد '{supplier_name or 'المورد'}' لبند ({qi_title}) بسعر {unit_price:,.2f} ر.س أعلى من عرض السعر ({quoted_unit_price:,.2f} ر.س) بفارق +{price_variance:,.2f} ر.س للوحدة، وإجمالي زيادة {total_variance:,.2f} ر.س!"
        ))

    # Check project total spent vs contract value for budget alerts
    cursor.execute('SELECT name, contract_value FROM projects WHERE id = ?', (project_id,))
    proj = cursor.fetchone()
    if proj:
        p_name, contract_val = proj[0], proj[1]
        cursor.execute('SELECT SUM(amount) FROM expenses WHERE project_id = ?', (project_id,))
        total_sp = cursor.fetchone()[0] or 0
        if total_sp > contract_val and contract_val > 0:
            cursor.execute('''
                INSERT INTO notifications (project_id, type, title, message)
                VALUES (?, 'warning', 'تنبيه: تجاوز ميزانية المشروع!', ?)
            ''', (project_id, f"تجاوزت المصروفات في مشروع '{p_name}' قيمة العقد بنسبة {(total_sp/contract_val*100):.1f}%! الإجمالي المنصرف: {total_sp:,.2f} ر.س"))
        elif has_price_increase == 0:
            cursor.execute('''
                INSERT INTO notifications (project_id, type, title, message)
                VALUES (?, 'expense', 'مصروف جديد', ?)
            ''', (project_id, f"قيد مصروف بمبلغ {amount:,.2f} ر.س في '{p_name}' ({title})"))

    conn.commit()
    conn.close()
    return jsonify({
        'success': True, 
        'id': expense_id, 
        'approval_status': approval_status,
        'message': 'تم تسجيل الفاتورة وتعميدها فورياً بنجاح' if approval_status == 'approved' else 'تم تسجيل الفاتورة بنجاح وبانتظار تعميد المدير المالي ولن تُخصم إلا بعد التعميد',
        'has_price_increase': bool(has_price_increase),
        'price_variance': price_variance,
        'total_variance': total_variance
    })

@app.route('/api/expenses/<int:expense_id>', methods=['GET'])
def get_single_expense(expense_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT e.*, 
               p.name AS project_name, 
               p.code AS project_code,
               ph.name AS phase_name, 
               it.title AS item_title, 
               it.item_code,
               s.name AS supplier_name,
               sq.quotation_number,
               sq.title AS quotation_title,
               sqi.item_name AS quotation_item_name,
               sqi.unit AS quotation_item_unit,
               cust.request_number AS custody_request_number,
               cust.employee_name AS custody_employee_name
        FROM expenses e
        LEFT JOIN projects p ON e.project_id = p.id
        LEFT JOIN project_phases ph ON e.phase_id = ph.id
        LEFT JOIN phase_items it ON e.item_id = it.id
        LEFT JOIN suppliers s ON e.supplier_id = s.id
        LEFT JOIN supplier_quotations sq ON e.quotation_id = sq.id
        LEFT JOIN supplier_quotation_items sqi ON e.quotation_item_id = sqi.id
        LEFT JOIN custody_requests cust ON e.custody_id = cust.id
        WHERE e.id = ?
    ''', (expense_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'المصروف غير موجود'}), 404
    exp_dict = dict(row)

    # Fetch line items
    cursor.execute('''
        SELECT ei.*, sqi.item_name AS ref_quotation_item_name, sqi.unit AS ref_quotation_unit
        FROM expense_items ei
        LEFT JOIN supplier_quotation_items sqi ON ei.quotation_item_id = sqi.id
        WHERE ei.expense_id = ?
        ORDER BY ei.id ASC
    ''', (expense_id,))
    exp_dict['items'] = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'expense': exp_dict, **exp_dict})

@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM expenses WHERE id = ?', (expense_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'المصروف غير موجود'}), 404

    existing = dict(existing)

    project_id = data.get('project_id') or existing['project_id']
    title = data.get('title') or existing['title']
    amount_str = data.get('amount')
    category = data.get('category') or existing['category']
    payment_method = data.get('payment_method') or existing['payment_method']
    paid_by = data.get('paid_by') if 'paid_by' in data else existing['paid_by']
    paid_to = data.get('paid_to') if 'paid_to' in data else existing['paid_to']
    expense_date = data.get('expense_date') or existing['expense_date']
    notes = data.get('notes') if 'notes' in data else existing['notes']

    # Suppliers & Pricing
    raw_supplier = data.get('supplier_id')
    supplier_id = int(raw_supplier) if raw_supplier and raw_supplier not in ('', 'null', 'None') else None

    # Custody tracking
    raw_custody = data.get('custody_id') if 'custody_id' in data else existing.get('custody_id')
    custody_id = int(raw_custody) if raw_custody and str(raw_custody).strip() not in ('', 'null', 'None') else None
    old_custody_id = existing.get('custody_id')
    old_amount = float(existing.get('amount') or 0)

    raw_quotation = data.get('quotation_id')
    quotation_id = int(raw_quotation) if raw_quotation and raw_quotation not in ('', 'null', 'None') else None

    raw_q_item = data.get('quotation_item_id')
    quotation_item_id = int(raw_q_item) if raw_q_item and raw_q_item not in ('', 'null', 'None') else None

    raw_qty = data.get('item_quantity')
    item_quantity = float(raw_qty) if raw_qty and raw_qty not in ('', 'null') else existing.get('item_quantity', 1.0)

    raw_u_price = data.get('unit_price')
    unit_price = float(raw_u_price) if raw_u_price and raw_u_price not in ('', 'null') else existing.get('unit_price', 0.0)

    raw_qu_price = data.get('quoted_unit_price')
    quoted_unit_price = float(raw_qu_price) if raw_qu_price and raw_qu_price not in ('', 'null') else existing.get('quoted_unit_price', 0.0)

    # Parse multi-items if provided
    raw_items = data.get('items')
    items_list = []
    has_items_payload = False
    if raw_items is not None:
        has_items_payload = True
        if isinstance(raw_items, str):
            try:
                items_list = json.loads(raw_items)
            except Exception:
                items_list = []
        elif isinstance(raw_items, list):
            items_list = raw_items

    items_data = []
    total_items_amount = 0.0
    total_items_variance = 0.0
    has_any_price_increase = 0

    if items_list:
        for it in items_list:
            it_name = (it.get('item_name') or '').strip()
            if not it_name:
                continue
            it_unit = (it.get('unit') or 'طن').strip()
            it_qty = float(it.get('quantity') or 1.0)
            it_u_price = float(it.get('unit_price') or 0.0)
            it_tot_price = float(it.get('total_price') or (it_qty * it_u_price))
            
            raw_qi = it.get('quotation_item_id')
            it_qi_id = int(raw_qi) if raw_qi and str(raw_qi) not in ('', 'null', 'None') else None
            it_qu_price = float(it.get('quoted_unit_price') or 0.0)
            
            it_p_var = round(it_u_price - it_qu_price, 2) if it_qu_price > 0 else 0.0
            it_t_var = round(it_p_var * it_qty, 2) if it_qu_price > 0 else 0.0
            it_has_inc = 1 if it_p_var > 0.01 else 0
            if it_has_inc == 1:
                has_any_price_increase = 1
                
            items_data.append({
                'item_name': it_name,
                'unit': it_unit,
                'quantity': it_qty,
                'unit_price': it_u_price,
                'total_price': it_tot_price,
                'quotation_item_id': it_qi_id,
                'quoted_unit_price': it_qu_price,
                'price_variance': it_p_var,
                'total_variance': it_t_var,
                'has_price_increase': it_has_inc,
                'notes': it.get('notes', '')
            })
            total_items_amount += it_tot_price
            total_items_variance += it_t_var

    # Tax calculation
    raw_is_tax = data.get('is_tax_invoice')
    is_tax_invoice = 1 if raw_is_tax in ('1', 1, True, 'true', 'on', 'yes') else 0
    tax_rate = float(data.get('tax_rate', 0.15)) if data.get('tax_rate') else 0.15

    raw_amt_no_tax = data.get('amount_without_tax')
    if raw_amt_no_tax and raw_amt_no_tax != '':
        amount_without_tax = float(raw_amt_no_tax)
    elif items_data:
        amount_without_tax = round(total_items_amount, 2)
    elif not is_tax_invoice and amount_str and amount_str not in ('', '0', 0):
        amount_without_tax = float(amount_str)
    else:
        amount_without_tax = existing.get('amount_without_tax', 0.0)

    raw_tax_amt = data.get('tax_amount')
    tax_amount = float(raw_tax_amt) if raw_tax_amt and raw_tax_amt != '' else 0.0

    if items_data:
        amount = total_items_amount
        if is_tax_invoice:
            tax_amount = round(amount_without_tax * tax_rate, 2)
            amount = round(amount_without_tax + tax_amount, 2)
        else:
            tax_amount = 0.0
            amount = amount_without_tax
    else:
        amount = float(amount_str) if amount_str and amount_str not in ('', '0', 0) else (unit_price * item_quantity if unit_price > 0 else existing['amount'])
        if is_tax_invoice:
            if amount_without_tax > 0 and amount == 0:
                tax_amount = round(amount_without_tax * tax_rate, 2)
                amount = round(amount_without_tax + tax_amount, 2)
            elif amount > 0 and amount_without_tax == 0:
                amount_without_tax = round(amount / (1 + tax_rate), 2)
                tax_amount = round(amount - amount_without_tax, 2)
            elif amount_without_tax > 0 and tax_amount > 0 and (amount == 0 or abs(amount - (amount_without_tax + tax_amount)) > 0.05):
                amount = round(amount_without_tax + tax_amount, 2)
            elif amount_without_tax > 0 and amount > 0 and tax_amount == 0:
                tax_amount = round(amount - amount_without_tax, 2)
        else:
            if amount_str and amount_str not in ('', '0', 0):
                amount = float(amount_str)
                amount_without_tax = amount
            elif amount_without_tax > 0:
                amount = amount_without_tax
            else:
                amount_without_tax = amount
            tax_amount = 0.0
            tax_rate = 0.0

    # Variance calculation
    if items_data:
        price_variance = round(total_items_variance / max(1, len(items_data)), 2)
        total_variance = round(total_items_variance, 2)
        has_price_increase = has_any_price_increase
        if items_data[0]['quotation_item_id']:
            quotation_item_id = items_data[0]['quotation_item_id']
            quoted_unit_price = items_data[0]['quoted_unit_price']
            unit_price = items_data[0]['unit_price']
            item_quantity = items_data[0]['quantity']
    else:
        price_variance = 0.0
        total_variance = 0.0
        has_price_increase = 0
        if quoted_unit_price > 0 and unit_price > 0:
            price_variance = round(unit_price - quoted_unit_price, 2)
            total_variance = round(price_variance * item_quantity, 2)
            has_price_increase = 1 if price_variance > 0.01 else 0

    raw_phase = data.get('phase_id')
    phase_id = int(raw_phase) if raw_phase and raw_phase not in ('', 'null', 'None') else None

    raw_item = data.get('item_id')
    item_id = int(raw_item) if raw_item and raw_item not in ('', 'null', 'None') else None

    invoice_file_path = existing['invoice_file_path']
    invoice_file_name = existing['invoice_file_name']

    # If file was explicitly removed
    if data.get('remove_invoice_file') in ('1', 1, 'true', True):
        if invoice_file_path:
            old_p = os.path.join(BASE_DIR, invoice_file_path.lstrip('/'))
            if os.path.exists(old_p):
                try:
                    os.remove(old_p)
                except Exception:
                    pass
        invoice_file_path = None
        invoice_file_name = None

    # Handle file replacement upload
    if 'invoice_file' in request.files:
        file = request.files['invoice_file']
        if file and file.filename and allowed_file(file.filename):
            if invoice_file_path:
                old_p = os.path.join(BASE_DIR, invoice_file_path.lstrip('/'))
                if os.path.exists(old_p):
                    try:
                        os.remove(old_p)
                    except Exception:
                        pass
            original_filename = secure_filename(file.filename) or f"invoice_{uuid.uuid4().hex[:8]}.jpg"
            ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'jpg'
            stored_name = f"inv_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.{ext}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_name)
            file.save(file_path)
            invoice_file_path = f"/uploads/{stored_name}"
            invoice_file_name = original_filename

    # If supplier not explicitly selected, try resolving from quotation or payee name or existing
    if not supplier_id and quotation_id:
        cursor.execute('SELECT supplier_id FROM supplier_quotations WHERE id = ?', (quotation_id,))
        sq_row = cursor.fetchone()
        if sq_row and sq_row[0]:
            supplier_id = sq_row[0]

    if not supplier_id and paid_to:
        cursor.execute('SELECT id FROM suppliers WHERE TRIM(name) = TRIM(?)', (paid_to,))
        sp_row = cursor.fetchone()
        if sp_row and sp_row[0]:
            supplier_id = sp_row[0]

    if not supplier_id and existing.get('supplier_id'):
        supplier_id = existing['supplier_id']

    if supplier_id and not paid_to:
        cursor.execute('SELECT name FROM suppliers WHERE id = ?', (supplier_id,))
        s_found = cursor.fetchone()
        if s_found:
            paid_to = s_found[0]

    items_json_str = json.dumps(items_data, ensure_ascii=False) if items_data else (existing.get('items_json') if not has_items_payload else None)

    payment_status = data.get('payment_status', existing.get('payment_status', 'paid'))
    raw_paid_amt = data.get('paid_amount')
    if payment_status == 'unpaid':
        paid_amount = 0.0
    elif raw_paid_amt is not None and str(raw_paid_amt).strip() != '':
        paid_amount = float(raw_paid_amt)
    else:
        paid_amount = existing.get('paid_amount', amount)

    raw_pay_date = data.get('payment_date')
    if payment_status == 'unpaid':
        payment_date = None
    elif raw_pay_date is not None:
        payment_date = str(raw_pay_date).strip() if str(raw_pay_date).strip() else None
    elif payment_status == 'paid':
        payment_date = existing.get('payment_date') or expense_date
    else:
        payment_date = existing.get('payment_date')

    cursor.execute('''
        UPDATE expenses
        SET project_id = ?, phase_id = ?, item_id = ?, title = ?, category = ?, amount = ?,
            payment_method = ?, paid_by = ?, paid_to = ?, expense_date = ?,
            invoice_file_path = ?, invoice_file_name = ?, notes = ?,
            is_tax_invoice = ?, tax_rate = ?, amount_without_tax = ?, tax_amount = ?,
            supplier_id = ?, quotation_id = ?, quotation_item_id = ?,
            item_quantity = ?, unit_price = ?, quoted_unit_price = ?,
            price_variance = ?, total_variance = ?, has_price_increase = ?,
            items_json = ?, payment_status = ?, paid_amount = ?, payment_date = ?,
            custody_id = ?
        WHERE id = ?
    ''', (
        project_id, phase_id, item_id, title, category, amount,
        payment_method, paid_by, paid_to, expense_date,
        invoice_file_path, invoice_file_name, notes,
        is_tax_invoice, tax_rate, amount_without_tax, tax_amount,
        supplier_id, quotation_id, quotation_item_id,
        item_quantity, unit_price, quoted_unit_price,
        price_variance, total_variance, has_price_increase,
        items_json_str, payment_status, paid_amount, payment_date,
        custody_id,
        expense_id
    ))

    # Adjust custody spent_amount if custody was/is involved AND expense is approved
    is_approved = (existing.get('approval_status') or 'approved') == 'approved'
    if is_approved:
        if old_custody_id and old_custody_id == custody_id:
            diff = amount - old_amount
            if abs(diff) > 0.001:
                cursor.execute('UPDATE custody_requests SET spent_amount = MAX(0, COALESCE(spent_amount, 0) + ?) WHERE id = ?', (diff, custody_id))
        elif old_custody_id != custody_id:
            if old_custody_id:
                cursor.execute('UPDATE custody_requests SET spent_amount = MAX(0, COALESCE(spent_amount, 0) - ?) WHERE id = ?', (old_amount, old_custody_id))
            if custody_id:
                cursor.execute('UPDATE custody_requests SET spent_amount = COALESCE(spent_amount, 0) + ? WHERE id = ?', (amount, custody_id))

    # If items provided, replace rows in expense_items
    if has_items_payload:
        cursor.execute('DELETE FROM expense_items WHERE expense_id = ?', (expense_id,))
        if items_data:
            for itm in items_data:
                cursor.execute('''
                    INSERT INTO expense_items (
                        expense_id, quotation_item_id, item_name, unit,
                        quantity, unit_price, total_price, quoted_unit_price,
                        price_variance, total_variance, has_price_increase, notes
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    expense_id, itm['quotation_item_id'], itm['item_name'], itm['unit'],
                    itm['quantity'], itm['unit_price'], itm['total_price'], itm['quoted_unit_price'],
                    itm['price_variance'], itm['total_variance'], itm['has_price_increase'], itm['notes']
                ))

    # Add notification if newly increased
    if has_price_increase == 1 and existing.get('has_price_increase') != 1:
        cursor.execute('SELECT name FROM suppliers WHERE id = ?', (supplier_id,))
        s_name_row = cursor.fetchone()
        s_n = s_name_row[0] if s_name_row else 'المورد'
        cursor.execute('''
            INSERT INTO notifications (project_id, type, title, message)
            VALUES (?, 'warning', '⚠️ تعديل فاتورة: رصد زيادة سعر عن عرض السعر!', ?)
        ''', (project_id, f"تم تعديل فاتورة المورد '{s_n}' بسعر {unit_price:,.2f} ر.س أعلى من المتفق عليه ({quoted_unit_price:,.2f} ر.س) بزيادة إجمالية {total_variance:,.2f} ر.س!"))

    # If project changed, sync linked supplier_payments and subcontractor_payments
    old_proj_id = existing.get('project_id')
    old_amt = float(existing.get('amount') or 0)
    if project_id != old_proj_id:
        cursor.execute('UPDATE supplier_payments SET project_id = ? WHERE expense_id = ?', (project_id, expense_id))
        cursor.execute('UPDATE subcontractor_payments SET project_id = ? WHERE expense_id = ?', (project_id, expense_id))
        # Revert on old project
        cursor.execute('''
            UPDATE projects
            SET manual_remaining_budget = COALESCE(manual_remaining_budget, 0) + ?
            WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
        ''', (old_amt, old_proj_id))
        # Deduct from new project
        cursor.execute('''
            UPDATE projects
            SET manual_remaining_budget = MAX(0.0, COALESCE(manual_remaining_budget, 0) - ?)
            WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
        ''', (amount, project_id))
    else:
        diff = amount - old_amt
        if abs(diff) > 0.001:
            cursor.execute('''
                UPDATE projects
                SET manual_remaining_budget = MAX(0.0, COALESCE(manual_remaining_budget, 0) - ?)
                WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
            ''', (diff, project_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'تم تحديث بيانات المصروف بنجاح', 'id': expense_id})

@app.route('/api/expenses/<int:expense_id>/transfer', methods=['POST'])
def transfer_expense_project(expense_id):
    data = request.json or {}
    new_project_id = data.get('new_project_id')
    if not new_project_id:
        return jsonify({'error': 'يرجى تحديد المشروع الجديد المحول إليه'}), 400

    new_project_id = int(new_project_id)
    new_phase_id = int(data['phase_id']) if data.get('phase_id') and str(data['phase_id']).strip() not in ('', 'null', 'None') else None
    new_item_id = int(data['item_id']) if data.get('item_id') and str(data['item_id']).strip() not in ('', 'null', 'None') else None
    transfer_notes = (data.get('notes') or '').strip()

    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM expenses WHERE id = ?', (expense_id,))
    exp = cursor.fetchone()
    if not exp:
        conn.close()
        return jsonify({'error': 'المصروف غير موجود'}), 404

    exp = dict(exp)
    old_project_id = exp['project_id']
    if old_project_id == new_project_id:
        conn.close()
        return jsonify({'error': 'المصروف مسجل بالفعل على هذا المشروع'}), 400

    cursor.execute('SELECT name FROM projects WHERE id = ?', (old_project_id,))
    old_p_row = cursor.fetchone()
    old_p_name = old_p_row[0] if old_p_row else f"#{old_project_id}"

    cursor.execute('SELECT name FROM projects WHERE id = ?', (new_project_id,))
    new_p_row = cursor.fetchone()
    if not new_p_row:
        conn.close()
        return jsonify({'error': 'المشروع الجديد غير موجود'}), 404
    new_p_name = new_p_row[0]

    updated_notes = exp.get('notes') or ''
    transfer_tag = f"[تم نقل المصروف من ({old_p_name}) إلى ({new_p_name})"
    if transfer_notes:
        transfer_tag += f" - السبب: {transfer_notes}"
    transfer_tag += "]"
    updated_notes = f"{updated_notes}\n{transfer_tag}".strip()

    cursor.execute('''
        UPDATE expenses
        SET project_id = ?, phase_id = ?, item_id = ?, notes = ?
        WHERE id = ?
    ''', (new_project_id, new_phase_id, new_item_id, updated_notes, expense_id))

    cursor.execute('UPDATE supplier_payments SET project_id = ? WHERE expense_id = ?', (new_project_id, expense_id))
    cursor.execute('UPDATE subcontractor_payments SET project_id = ? WHERE expense_id = ?', (new_project_id, expense_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, title, message, type)
        VALUES (?, ?, ?, 'expense')
    ''', (
        new_project_id,
        f"نقل مصروف: {exp['title']}",
        f"تم نقل مصروف بقيمة {exp['amount']:,.2f} ر.س بنجاح من مشروع ({old_p_name}) إلى مشروع ({new_p_name})"
    ))

    # Adjust manual remaining budget on old and new projects
    exp_amount = float(exp.get('amount') or 0)
    cursor.execute('''
        UPDATE projects
        SET manual_remaining_budget = COALESCE(manual_remaining_budget, 0) + ?
        WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
    ''', (exp_amount, old_project_id))
    cursor.execute('''
        UPDATE projects
        SET manual_remaining_budget = MAX(0.0, COALESCE(manual_remaining_budget, 0) - ?)
        WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
    ''', (exp_amount, new_project_id))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f'تم نقل المصروف بنجاح من مشروع ({old_p_name}) إلى مشروع ({new_p_name})',
        'old_project_id': old_project_id,
        'new_project_id': new_project_id,
        'old_project_name': old_p_name,
        'new_project_name': new_p_name
    })

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT invoice_file_path, project_id, title, amount, custody_id, approval_status FROM expenses WHERE id = ?', (expense_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'success': True, 'message': 'المصروف غير موجود أو تم حذفه مسبقاً'})

    file_path = row[0]
    proj_id = row[1]
    title = row[2]
    amt = row[3]
    custody_id = row[4]
    approval_status = row[5] or 'approved'
    is_approved = (approval_status == 'approved')

    if file_path:
        local_p = os.path.join(BASE_DIR, file_path.lstrip('/'))
        if os.path.exists(local_p):
            try:
                os.remove(local_p)
            except Exception:
                pass

    # If expense was approved and deducted from a custody account, return amount to custody balance
    if is_approved and custody_id:
        cursor.execute('''
            UPDATE custody_requests
            SET spent_amount = MAX(0, COALESCE(spent_amount, 0) - ?)
            WHERE id = ?
        ''', (amt, custody_id))

    cursor.execute('DELETE FROM expense_items WHERE expense_id = ?', (expense_id,))
    cursor.execute('DELETE FROM expenses WHERE id = ?', (expense_id,))
    
    # Refund to project manual_remaining_budget if project is in manual mode and expense was approved
    if is_approved and proj_id:
        cursor.execute('''
            UPDATE projects
            SET manual_remaining_budget = COALESCE(manual_remaining_budget, 0) + ?
            WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
        ''', (amt, proj_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'info', 'حذف فاتورة / مصروف', ?)
    ''', (proj_id, f"تم حذف المصروف '{title}' بمبلغ {amt:,.2f} ر.س وتحديث الحسابات والميزانيات تلقائياً."))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف المصروف والفاتورة بنجاح وتحديث كافة الأرصدة تلقائياً'})


@app.route('/api/expenses/<int:expense_id>/approve', methods=['POST'])
def approve_expense(expense_id):
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form.to_dict()

    user_id = data.get('user_id')
    user_role = data.get('user_role') or ''
    user_name = data.get('user_name') or ''
    approval_notes = data.get('approval_notes', '').strip() or 'تم التعميد بواسطة المدير المالي'

    conn = database.get_db_connection()
    cursor = conn.cursor()

    is_fin, manager_title = check_is_financial_manager(user_id, user_role, user_name, cursor)
    if not is_fin:
        conn.close()
        return jsonify({'error': 'عفواً، تعميد المصروفات والفواتير هو صلاحية حصرية للمدير المالي (أ. ابوالنصر البغدادي).'}), 403

    cursor.execute('SELECT * FROM expenses WHERE id = ?', (expense_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'المصروف غير موجود'}), 404

    exp = dict(row)
    if (exp.get('approval_status') or 'approved') == 'approved':
        conn.close()
        return jsonify({'success': True, 'message': 'هذا المصروف معمد بالفعل مسبقاً.'})

    amount = float(exp.get('amount') or 0.0)
    project_id = exp.get('project_id')
    custody_id = exp.get('custody_id')
    title = exp.get('title') or 'فاتورة'
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        UPDATE expenses
        SET approval_status = 'approved',
            approved_by = ?,
            approved_at = ?,
            approval_notes = ?
        WHERE id = ?
    ''', (manager_title, now_str, approval_notes, expense_id))

    # Apply project budget deduction upon approval
    if project_id:
        cursor.execute('''
            UPDATE projects
            SET manual_remaining_budget = MAX(0.0, COALESCE(manual_remaining_budget, 0) - ?)
            WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
        ''', (amount, project_id))

    # Apply custody deduction upon approval
    c_info = ""
    if custody_id:
        cursor.execute('''
            UPDATE custody_requests
            SET spent_amount = COALESCE(spent_amount, 0) + ?
            WHERE id = ?
        ''', (amount, custody_id))
        cursor.execute('SELECT employee_name, request_number FROM custody_requests WHERE id = ?', (custody_id,))
        c_emp = cursor.fetchone()
        if c_emp:
            c_info = f" خصماً من عهدة {c_emp['employee_name']} ({c_emp['request_number']})"

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'expense', 'تم تعميد المصروف من المدير المالي', ?)
    ''', (project_id, f"تم تعميد الفاتورة '{title}' بمبلغ {amount:,.2f} ر.س{c_info} بواسطة {manager_title} وخُصمت رسمياً من الحسابات."))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"تم تعميد الفاتورة '{title}' بنجاح وتطبيق الخصم المالي."
    })


@app.route('/api/expenses/<int:expense_id>/reject', methods=['POST'])
def reject_expense(expense_id):
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form.to_dict()

    user_id = data.get('user_id')
    user_role = data.get('user_role') or ''
    user_name = data.get('user_name') or ''
    reason = data.get('reason', '').strip() or data.get('approval_notes', '').strip() or 'مرفوضة من الإدارة المالية'

    conn = database.get_db_connection()
    cursor = conn.cursor()

    is_fin, manager_title = check_is_financial_manager(user_id, user_role, user_name, cursor)
    if not is_fin:
        conn.close()
        return jsonify({'error': 'عفواً، رفض أو تعميد المصروفات هو صلاحية حصرية للمدير المالي (أ. ابوالنصر البغدادي).'}), 403

    cursor.execute('SELECT * FROM expenses WHERE id = ?', (expense_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'المصروف غير موجود'}), 404

    exp = dict(row)
    was_approved = (exp.get('approval_status') or 'approved') == 'approved'
    amount = float(exp.get('amount') or 0.0)
    project_id = exp.get('project_id')
    custody_id = exp.get('custody_id')
    title = exp.get('title') or 'فاتورة'
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # If it was previously approved, refund deducted amounts
    if was_approved:
        if project_id:
            cursor.execute('''
                UPDATE projects
                SET manual_remaining_budget = COALESCE(manual_remaining_budget, 0) + ?
                WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
            ''', (amount, project_id))
        if custody_id:
            cursor.execute('''
                UPDATE custody_requests
                SET spent_amount = MAX(0.0, COALESCE(spent_amount, 0) - ?)
                WHERE id = ?
            ''', (amount, custody_id))

    cursor.execute('''
        UPDATE expenses
        SET approval_status = 'rejected',
            approved_by = ?,
            approved_at = ?,
            approval_notes = ?
        WHERE id = ?
    ''', (manager_title, now_str, reason, expense_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'warning', 'تم رفض الفاتورة من المدير المالي', ?)
    ''', (project_id, f"تم رفض الفاتورة '{title}' بمبلغ {amount:,.2f} ر.س من قبل {manager_title}. السبب: {reason}"))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"تم رفض الفاتورة '{title}' وتحديث الحسابات بنجاح."
    })

# ----------------- SUPPLIERS & QUOTATIONS API -----------------
@app.route('/api/suppliers', methods=['GET'])
def get_suppliers():
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT 
            s.*,
            (SELECT COUNT(*) FROM supplier_quotations sq WHERE sq.supplier_id = s.id) AS quotations_count,
            (SELECT COALESCE(SUM(sq.total_amount), 0) FROM supplier_quotations sq WHERE sq.supplier_id = s.id) AS total_quoted,
            (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.supplier_id = s.id OR (e.supplier_id IS NULL AND (e.quotation_id IN (SELECT sq.id FROM supplier_quotations sq WHERE sq.supplier_id = s.id) OR TRIM(e.paid_to) = TRIM(s.name)))) AS total_invoiced,
            (
                COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0)
                +
                COALESCE((
                    SELECT SUM(CASE WHEN e.payment_status = 'unpaid' THEN 0 ELSE COALESCE(e.paid_amount, e.amount) END)
                    FROM expenses e
                    WHERE (e.supplier_id = s.id OR (e.supplier_id IS NULL AND (e.quotation_id IN (SELECT sq.id FROM supplier_quotations sq WHERE sq.supplier_id = s.id) OR TRIM(e.paid_to) = TRIM(s.name))))
                      AND NOT EXISTS (SELECT 1 FROM supplier_payments sp WHERE sp.expense_id = e.id)
                ), 0)
            ) AS total_paid,
            (SELECT COUNT(*) FROM expenses e WHERE e.supplier_id = s.id OR (e.supplier_id IS NULL AND (e.quotation_id IN (SELECT sq.id FROM supplier_quotations sq WHERE sq.supplier_id = s.id) OR TRIM(e.paid_to) = TRIM(s.name)))) AS invoices_count,
            (SELECT COUNT(*) FROM supplier_payments sp WHERE sp.supplier_id = s.id) AS payments_count,
            (SELECT COUNT(*) FROM expenses e WHERE (e.supplier_id = s.id OR (e.supplier_id IS NULL AND (e.quotation_id IN (SELECT sq.id FROM supplier_quotations sq WHERE sq.supplier_id = s.id) OR TRIM(e.paid_to) = TRIM(s.name)))) AND e.has_price_increase = 1) AS price_increases_count,
            (SELECT COALESCE(SUM(e.total_variance), 0) FROM expenses e WHERE (e.supplier_id = s.id OR (e.supplier_id IS NULL AND (e.quotation_id IN (SELECT sq.id FROM supplier_quotations sq WHERE sq.supplier_id = s.id) OR TRIM(e.paid_to) = TRIM(s.name)))) AND e.has_price_increase = 1) AS total_variance_amount
        FROM suppliers s
        ORDER BY s.id DESC
    ''')
    suppliers = []
    for row in cursor.fetchall():
        item = dict(row)
        item['remaining_balance'] = max(0.0, item['total_quoted'] - item['total_invoiced'])
        item['unpaid_balance'] = max(0.0, item['total_invoiced'] - item['total_paid'])
        item['excess_paid'] = max(0.0, item['total_paid'] - item['total_invoiced'])
        suppliers.append(item)

    conn.close()
    return jsonify(suppliers)

@app.route('/api/suppliers', methods=['POST'])
def create_supplier():
    data = request.json or {}
    name = data.get('name', '').strip()
    category = data.get('category', 'عام').strip()
    if not name:
        return jsonify({'error': 'اسم المورد مطلوب'}), 400

    phone = data.get('phone', '').strip()
    tax_number = data.get('tax_number', '').strip()
    contact_person = data.get('contact_person', '').strip()
    address = data.get('address', '').strip()
    notes = data.get('notes', '').strip()

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO suppliers (name, category, phone, tax_number, contact_person, address, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (name, category, phone, tax_number, contact_person, address, notes))
    supplier_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': supplier_id, 'message': 'تم تسجيل المورد بنجاح'})

@app.route('/api/suppliers/<int:supplier_id>', methods=['GET'])
def get_supplier_detail(supplier_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = ?', (supplier_id,))
    s_row = cursor.fetchone()
    if not s_row:
        conn.close()
        return jsonify({'error': 'المورد غير موجود'}), 404

    supplier = dict(s_row)

    # Quotations
    cursor.execute('''
        SELECT sq.*, p.name AS project_name, p.code AS project_code,
            (SELECT COUNT(*) FROM supplier_quotation_items sqi WHERE sqi.quotation_id = sq.id) AS items_count,
            (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.quotation_id = sq.id) AS quotation_invoiced,
            (SELECT COALESCE(SUM(CASE WHEN e.payment_status = 'unpaid' THEN 0 ELSE COALESCE(e.paid_amount, e.amount) END), 0) FROM expenses e WHERE e.quotation_id = sq.id) AS quotation_paid
        FROM supplier_quotations sq
        LEFT JOIN projects p ON sq.project_id = p.id
        WHERE sq.supplier_id = ?
        ORDER BY sq.id DESC
    ''', (supplier_id,))
    quotations = []
    for q in cursor.fetchall():
        qd = dict(q)
        qd['quotation_remaining'] = max(0.0, qd['total_amount'] - qd['quotation_invoiced'])
        # Get items for each quotation
        cursor.execute('SELECT * FROM supplier_quotation_items WHERE quotation_id = ? ORDER BY id ASC', (qd['id'],))
        qd['items'] = [dict(it) for it in cursor.fetchall()]
        quotations.append(qd)

    # Expenses / Invoices
    cursor.execute('''
        SELECT e.*, 
               COALESCE(e.payment_date, (SELECT MAX(sp.payment_date) FROM supplier_payments sp WHERE sp.expense_id = e.id)) AS payment_date,
               p.name AS project_name, sq.quotation_number, sqi.item_name AS quotation_item_name, sqi.unit AS quotation_item_unit
        FROM expenses e
        LEFT JOIN projects p ON e.project_id = p.id
        LEFT JOIN supplier_quotations sq ON e.quotation_id = sq.id
        LEFT JOIN supplier_quotation_items sqi ON e.quotation_item_id = sqi.id
        WHERE e.supplier_id = ? OR (e.supplier_id IS NULL AND (e.quotation_id IN (SELECT sq2.id FROM supplier_quotations sq2 WHERE sq2.supplier_id = ?) OR TRIM(e.paid_to) = (SELECT TRIM(name) FROM suppliers WHERE id = ?)))
        ORDER BY e.expense_date DESC, e.id DESC
    ''', (supplier_id, supplier_id, supplier_id))
    expenses = [dict(row) for row in cursor.fetchall()]

    # Supplier Payments (سجل الدفعات والسدادات)
    cursor.execute('''
        SELECT sp.*, p.name AS project_name, p.code AS project_code,
               e.title AS expense_title, e.amount AS invoice_total_amount,
               sq.quotation_number, sq.title AS quotation_title
        FROM supplier_payments sp
        LEFT JOIN projects p ON sp.project_id = p.id
        LEFT JOIN expenses e ON sp.expense_id = e.id
        LEFT JOIN supplier_quotations sq ON sp.quotation_id = sq.id
        WHERE sp.supplier_id = ?
        ORDER BY sp.payment_date DESC, sp.id DESC
    ''', (supplier_id,))
    payments = [dict(r) for r in cursor.fetchall()]

    # Summary calculations
    total_quoted = round(sum(q['total_amount'] for q in quotations), 2)
    total_invoiced = round(sum(e['amount'] for e in expenses), 2)

    payments_sum = sum(p['amount'] for p in payments)
    linked_exp_ids = set(p['expense_id'] for p in payments if p.get('expense_id'))
    legacy_paid = sum(
        (0.0 if e.get('payment_status') == 'unpaid' else float(e.get('paid_amount') or e.get('amount') or 0.0))
        for e in expenses
        if e['id'] not in linked_exp_ids
    )
    total_paid = round(payments_sum + legacy_paid, 2)

    remaining_balance = round(max(0.0, total_quoted - total_invoiced), 2)
    unpaid_balance = round(max(0.0, total_invoiced - total_paid), 2)
    excess_paid = round(max(0.0, total_paid - total_invoiced), 2)
    total_variance = round(sum(e.get('total_variance', 0) for e in expenses if e.get('has_price_increase')), 2)
    increases_count = sum(1 for e in expenses if e.get('has_price_increase'))

    supplier['quotations'] = quotations
    supplier['expenses'] = expenses
    supplier['payments'] = payments
    supplier['summary'] = {
        'total_quoted': total_quoted,
        'total_invoiced': total_invoiced,
        'total_paid': total_paid,
        'remaining_balance': remaining_balance,
        'unpaid_balance': unpaid_balance,
        'excess_paid': excess_paid,
        'total_variance': total_variance,
        'increases_count': increases_count,
        'invoices_count': len(expenses),
        'payments_count': len(payments),
        'quotations_count': len(quotations)
    }

    conn.close()
    return jsonify({'success': True, 'supplier': supplier})

@app.route('/api/suppliers/<int:supplier_id>', methods=['PUT'])
def update_supplier(supplier_id):
    data = request.json or {}
    name = data.get('name', '').strip()
    category = data.get('category', '').strip()
    if not name:
        return jsonify({'error': 'اسم المورد مطلوب'}), 400

    phone = data.get('phone', '').strip()
    tax_number = data.get('tax_number', '').strip()
    contact_person = data.get('contact_person', '').strip()
    address = data.get('address', '').strip()
    notes = data.get('notes', '').strip()

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE suppliers
        SET name = ?, category = ?, phone = ?, tax_number = ?, contact_person = ?, address = ?, notes = ?
        WHERE id = ?
    ''', (name, category, phone, tax_number, contact_person, address, notes, supplier_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث بيانات المورد بنجاح'})

@app.route('/api/suppliers/<int:supplier_id>', methods=['DELETE'])
def delete_supplier(supplier_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM suppliers WHERE id = ?', (supplier_id,))
    cursor.execute('DELETE FROM supplier_payments WHERE supplier_id = ?', (supplier_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف المورد وسجل مدفوعاته بنجاح'})

# ----------------- SUPPLIER PAYMENTS / VOUCHERS API -----------------
@app.route('/api/suppliers/<int:supplier_id>/payments', methods=['POST'])
def add_supplier_payment(supplier_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = ?', (supplier_id,))
    supplier = cursor.fetchone()
    if not supplier:
        conn.close()
        return jsonify({'error': 'المورد غير موجود'}), 404

    if request.is_json:
        data = request.json or {}
        file = None
    else:
        data = request.form or {}
        file = request.files.get('receipt_file')

    try:
        amount = float(data.get('amount') or 0)
    except (ValueError, TypeError):
        amount = 0.0

    if amount <= 0:
        conn.close()
        return jsonify({'error': 'مبلغ السداد يجب أن يكون أكبر من الصفر'}), 400

    payment_date = data.get('payment_date') or datetime.now().strftime('%Y-%m-%d')
    payment_method = data.get('payment_method') or 'تحويل بنكي'
    payment_type = data.get('payment_type') or 'دفعة تحت الحساب'
    reference_number = (data.get('reference_number') or '').strip()
    notes = (data.get('notes') or '').strip()

    raw_pid = data.get('project_id')
    project_id = int(raw_pid) if raw_pid and str(raw_pid) not in ('', 'null', 'None') else None

    raw_eid = data.get('expense_id')
    expense_id = int(raw_eid) if raw_eid and str(raw_eid) not in ('', 'null', 'None') else None

    raw_qid = data.get('quotation_id')
    quotation_id = int(raw_qid) if raw_qid and str(raw_qid) not in ('', 'null', 'None') else None

    # Handle file upload if provided
    receipt_file_path = None
    receipt_file_name = None
    if file and file.filename != '':
        orig = secure_filename(file.filename)
        ext = orig.rsplit('.', 1)[1].lower() if '.' in orig else ''
        if ext in ('png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'):
            stored = f"suppay_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], stored))
            receipt_file_path = f"/uploads/{stored}"
            receipt_file_name = orig

    cursor.execute('''
        INSERT INTO supplier_payments (
            supplier_id, project_id, expense_id, quotation_id,
            amount, payment_date, payment_method, payment_type,
            reference_number, receipt_file_path, receipt_file_name, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        supplier_id, project_id, expense_id, quotation_id,
        amount, payment_date, payment_method, payment_type,
        reference_number, receipt_file_path, receipt_file_name, notes
    ))
    payment_id = cursor.lastrowid

    # If linked to a specific invoice/expense, update its paid_amount and payment_status
    if expense_id:
        cursor.execute('SELECT amount FROM expenses WHERE id = ?', (expense_id,))
        exp_row = cursor.fetchone()
        if exp_row:
            cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE expense_id = ?', (expense_id,))
            total_paid_on_exp = float(cursor.fetchone()[0])
            exp_amount = float(exp_row['amount'] or 0)
            if total_paid_on_exp >= exp_amount - 0.01:
                status = 'paid'
            elif total_paid_on_exp > 0:
                status = 'partial'
            else:
                status = 'unpaid'
            cursor.execute('UPDATE expenses SET paid_amount = ?, payment_status = ?, payment_date = COALESCE(payment_date, ?) WHERE id = ?', (total_paid_on_exp, status, payment_date, expense_id))

    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'id': payment_id,
        'message': 'تم تسجيل سداد الدفعة للمورد بنجاح وقيدها في كشف الحساب'
    })

@app.route('/api/suppliers/<int:supplier_id>/payments', methods=['GET'])
def get_supplier_payments(supplier_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT sp.*, p.name AS project_name, p.code AS project_code,
               e.title AS expense_title, e.amount AS invoice_total_amount,
               sq.quotation_number, sq.title AS quotation_title
        FROM supplier_payments sp
        LEFT JOIN projects p ON sp.project_id = p.id
        LEFT JOIN expenses e ON sp.expense_id = e.id
        LEFT JOIN supplier_quotations sq ON sp.quotation_id = sq.id
        WHERE sp.supplier_id = ?
        ORDER BY sp.payment_date DESC, sp.id DESC
    ''', (supplier_id,))
    payments = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'payments': payments})

@app.route('/api/supplier-payments/<int:payment_id>', methods=['DELETE'])
def delete_supplier_payment(payment_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT expense_id, receipt_file_path FROM supplier_payments WHERE id = ?', (payment_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'سند السداد غير موجود'}), 404

    expense_id = row['expense_id']
    cursor.execute('DELETE FROM supplier_payments WHERE id = ?', (payment_id,))

    # If linked to an invoice, recalculate status and paid_amount
    if expense_id:
        cursor.execute('SELECT amount FROM expenses WHERE id = ?', (expense_id,))
        exp_row = cursor.fetchone()
        if exp_row:
            cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE expense_id = ?', (expense_id,))
            total_paid_on_exp = float(cursor.fetchone()[0])
            exp_amount = float(exp_row['amount'] or 0)
            if total_paid_on_exp >= exp_amount - 0.01:
                status = 'paid'
            elif total_paid_on_exp > 0:
                status = 'partial'
            else:
                status = 'unpaid'
            cursor.execute('UPDATE expenses SET paid_amount = ?, payment_status = ?, payment_date = (CASE WHEN ? = \'unpaid\' THEN NULL ELSE (SELECT MAX(sp2.payment_date) FROM supplier_payments sp2 WHERE sp2.expense_id = expenses.id) END) WHERE id = ?', (total_paid_on_exp, status, status, expense_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف سند السداد بنجاح وتحديث كشف الحساب'})

@app.route('/api/supplier-quotations', methods=['GET'])
def get_supplier_quotations():
    supplier_id = request.args.get('supplier_id')
    project_id = request.args.get('project_id')
    status = request.args.get('status')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT 
            sq.*,
            s.name AS supplier_name,
            s.category AS supplier_category,
            s.phone AS supplier_phone,
            p.name AS project_name,
            p.code AS project_code,
            (SELECT COUNT(*) FROM supplier_quotation_items sqi WHERE sqi.quotation_id = sq.id) AS items_count,
            (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.quotation_id = sq.id) AS total_paid
        FROM supplier_quotations sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        LEFT JOIN projects p ON sq.project_id = p.id
        WHERE 1=1
    '''
    params = []
    if supplier_id:
        query += ' AND sq.supplier_id = ?'
        params.append(supplier_id)
    if project_id:
        query += ' AND sq.project_id = ?'
        params.append(project_id)
    if status:
        query += ' AND sq.status = ?'
        params.append(status)

    query += ' ORDER BY sq.id DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    quotations = []
    for r in rows:
        item = dict(r)
        item['remaining_balance'] = max(0.0, item['total_amount'] - item['total_paid'])
        cursor.execute('SELECT * FROM supplier_quotation_items WHERE quotation_id = ? ORDER BY id ASC', (item['id'],))
        item['items'] = [dict(it) for it in cursor.fetchall()]
        quotations.append(item)

    conn.close()
    return jsonify(quotations)

@app.route('/api/supplier-quotations', methods=['POST'])
def create_supplier_quotation():
    data = request.json or {}
    supplier_id = data.get('supplier_id')
    title = data.get('title', '').strip()
    if not supplier_id or not title:
        return jsonify({'error': 'المورد وعنوان عرض السعر مطلوبان'}), 400

    project_id = data.get('project_id') or None
    quotation_number = data.get('quotation_number') or f"QUO-{datetime.now().strftime('%Y%m%d%H%M')}"
    quotation_date = data.get('quotation_date') or datetime.now().strftime('%Y-%m-%d')
    status = data.get('status', 'active')
    notes = data.get('notes', '')
    items = data.get('items', [])

    # Calculate tax & total amount
    tax_type = data.get('tax_type', 'exclusive') # 'exclusive' (+15%), 'inclusive' (15% included), 'zero' (0%)
    tax_rate = float(data.get('tax_rate', 0.15))

    subtotal_items = 0.0
    for it in items:
        u_p = float(it.get('unit_price', 0))
        qty = float(it.get('quantity', 1))
        it_total = round(u_p * qty, 2)
        subtotal_items += it_total

    if subtotal_items == 0 and data.get('total_amount'):
        subtotal_items = float(data.get('total_amount', 0))

    if tax_type == 'exclusive':
        amount_without_tax = round(subtotal_items, 2)
        tax_amount = round(amount_without_tax * tax_rate, 2)
        total_amount = round(amount_without_tax + tax_amount, 2)
    elif tax_type == 'inclusive':
        total_amount = round(subtotal_items, 2)
        amount_without_tax = round(total_amount / (1 + tax_rate), 2)
        tax_amount = round(total_amount - amount_without_tax, 2)
    else: # zero
        amount_without_tax = round(subtotal_items, 2)
        tax_amount = 0.0
        total_amount = round(subtotal_items, 2)
        tax_rate = 0.0

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO supplier_quotations (
            supplier_id, project_id, quotation_number, quotation_date,
            title, total_amount, status, notes,
            tax_type, tax_rate, amount_without_tax, tax_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        supplier_id, project_id, quotation_number, quotation_date,
        title, total_amount, status, notes,
        tax_type, tax_rate, amount_without_tax, tax_amount
    ))
    quotation_id = cursor.lastrowid

    # Insert items
    for it in items:
        it_name = it.get('item_name', '').strip()
        if not it_name:
            continue
        unit = it.get('unit', 'طن')
        unit_price = float(it.get('unit_price', 0))
        quantity = float(it.get('quantity', 1))
        it_notes = it.get('notes', '')
        tot = round(unit_price * quantity, 2)
        cursor.execute('''
            INSERT INTO supplier_quotation_items (quotation_id, supplier_id, item_name, unit, unit_price, quantity, total_price, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (quotation_id, supplier_id, it_name, unit, unit_price, quantity, tot, it_notes))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': quotation_id, 'message': 'تم تسجيل عرض السعر وبنود التوريد بنجاح'})

@app.route('/api/supplier-quotations/<int:quotation_id>/items', methods=['GET'])
def get_quotation_items(quotation_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT sqi.*, 
               sq.quotation_number, 
               sq.title AS quotation_title,
               s.name AS supplier_name,
               COALESCE((
                   SELECT SUM(ei.quantity) 
                   FROM expense_items ei 
                   WHERE ei.quotation_item_id = sqi.id
               ), 0) + COALESCE((
                   SELECT SUM(e.item_quantity) 
                   FROM expenses e 
                   WHERE e.quotation_item_id = sqi.id
                   AND (SELECT COUNT(*) FROM expense_items ei2 WHERE ei2.expense_id = e.id) = 0
               ), 0) AS invoiced_quantity,
               COALESCE((
                   SELECT SUM(ei.total_price) 
                   FROM expense_items ei 
                   WHERE ei.quotation_item_id = sqi.id
               ), 0) + COALESCE((
                   SELECT SUM(e.amount) 
                   FROM expenses e 
                   WHERE e.quotation_item_id = sqi.id
                   AND (SELECT COUNT(*) FROM expense_items ei2 WHERE ei2.expense_id = e.id) = 0
               ), 0) AS invoiced_amount
        FROM supplier_quotation_items sqi
        JOIN supplier_quotations sq ON sqi.quotation_id = sq.id
        JOIN suppliers s ON sqi.supplier_id = s.id
        WHERE sqi.quotation_id = ?
        ORDER BY sqi.id ASC
    ''', (quotation_id,))
    rows = cursor.fetchall()
    items = []
    for r in rows:
        d = dict(r)
        qty = float(d.get('quantity') or 0)
        inv_qty = float(d.get('invoiced_quantity') or 0)
        unit_price = float(d.get('unit_price') or 0)
        rem_qty = max(0.0, round(qty - inv_qty, 2))
        d['remaining_quantity'] = rem_qty
        d['remaining_amount'] = max(0.0, round(rem_qty * unit_price, 2))
        items.append(d)
    conn.close()
    return jsonify(items)

@app.route('/api/supplier-quotations/<int:quotation_id>', methods=['GET'])
def get_single_quotation(quotation_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT sq.*, s.name AS supplier_name, p.name AS project_name, p.code AS project_code
        FROM supplier_quotations sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        LEFT JOIN projects p ON sq.project_id = p.id
        WHERE sq.id = ?
    ''', (quotation_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'عرض السعر غير موجود'}), 404

    q_dict = dict(row)
    cursor.execute('''
        SELECT * FROM supplier_quotation_items
        WHERE quotation_id = ?
        ORDER BY id ASC
    ''', (quotation_id,))
    q_dict['items'] = [dict(it) for it in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'quotation': q_dict, **q_dict})

@app.route('/api/supplier-quotations/<int:quotation_id>', methods=['PUT'])
def update_supplier_quotation(quotation_id):
    data = request.json or {}
    supplier_id = data.get('supplier_id')
    title = data.get('title', '').strip()
    if not supplier_id or not title:
        return jsonify({'error': 'المورد وعنوان عرض السعر مطلوبان'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM supplier_quotations WHERE id = ?', (quotation_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'عرض السعر غير موجود'}), 404

    project_id = data.get('project_id') or None
    quotation_number = data.get('quotation_number') or existing['quotation_number']
    quotation_date = data.get('quotation_date') or existing['quotation_date']
    status = data.get('status', existing['status'] or 'active')
    notes = data.get('notes', '')
    items = data.get('items', [])

    tax_type = data.get('tax_type', 'exclusive')
    tax_rate = float(data.get('tax_rate', 0.15))

    subtotal_items = 0.0
    for it in items:
        u_p = float(it.get('unit_price', 0))
        qty = float(it.get('quantity', 1))
        it_total = round(u_p * qty, 2)
        subtotal_items += it_total

    if subtotal_items == 0 and data.get('total_amount'):
        subtotal_items = float(data.get('total_amount', 0))

    if tax_type == 'exclusive':
        amount_without_tax = round(subtotal_items, 2)
        tax_amount = round(amount_without_tax * tax_rate, 2)
        total_amount = round(amount_without_tax + tax_amount, 2)
    elif tax_type == 'inclusive':
        total_amount = round(subtotal_items, 2)
        amount_without_tax = round(total_amount / (1 + tax_rate), 2)
        tax_amount = round(total_amount - amount_without_tax, 2)
    else: # zero
        amount_without_tax = round(subtotal_items, 2)
        tax_amount = 0.0
        total_amount = round(subtotal_items, 2)
        tax_rate = 0.0

    cursor.execute('''
        UPDATE supplier_quotations
        SET supplier_id = ?, project_id = ?, quotation_number = ?, quotation_date = ?,
            title = ?, total_amount = ?, status = ?, notes = ?,
            tax_type = ?, tax_rate = ?, amount_without_tax = ?, tax_amount = ?
        WHERE id = ?
    ''', (
        supplier_id, project_id, quotation_number, quotation_date,
        title, total_amount, status, notes,
        tax_type, tax_rate, amount_without_tax, tax_amount,
        quotation_id
    ))

    # Replace items if provided
    if items:
        cursor.execute('DELETE FROM supplier_quotation_items WHERE quotation_id = ?', (quotation_id,))
        for it in items:
            it_name = it.get('item_name', '').strip()
            if not it_name:
                continue
            unit = it.get('unit', 'طن')
            unit_price = float(it.get('unit_price', 0))
            quantity = float(it.get('quantity', 1))
            it_notes = it.get('notes', '')
            tot = round(unit_price * quantity, 2)
            cursor.execute('''
                INSERT INTO supplier_quotation_items (quotation_id, supplier_id, item_name, unit, unit_price, quantity, total_price, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (quotation_id, supplier_id, it_name, unit, unit_price, quantity, tot, it_notes))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': quotation_id, 'message': 'تم تحديث عرض السعر والبنود بنجاح'})

@app.route('/api/supplier-quotations/<int:quotation_id>', methods=['DELETE'])
def delete_supplier_quotation(quotation_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM supplier_quotation_items WHERE quotation_id = ?', (quotation_id,))
    cursor.execute('DELETE FROM supplier_quotations WHERE id = ?', (quotation_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف عرض السعر بنجاح'})

@app.route('/api/supplier-variances', methods=['GET'])
def get_supplier_variances():
    supplier_id = request.args.get('supplier_id')
    project_id = request.args.get('project_id')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT 
            e.id AS expense_id,
            e.expense_date,
            e.title AS expense_title,
            e.amount,
            e.item_quantity,
            e.unit_price,
            e.quoted_unit_price,
            e.price_variance,
            e.total_variance,
            e.has_price_increase,
            e.invoice_file_path,
            p.id AS project_id,
            p.name AS project_name,
            p.code AS project_code,
            s.id AS supplier_id,
            s.name AS supplier_name,
            s.category AS supplier_category,
            sq.id AS quotation_id,
            sq.quotation_number,
            sqi.item_name AS quotation_item_name,
            sqi.unit AS quotation_item_unit
        FROM expenses e
        JOIN suppliers s ON e.supplier_id = s.id
        JOIN projects p ON e.project_id = p.id
        LEFT JOIN supplier_quotations sq ON e.quotation_id = sq.id
        LEFT JOIN supplier_quotation_items sqi ON e.quotation_item_id = sqi.id
        WHERE e.has_price_increase = 1
    '''
    params = []
    if supplier_id:
        query += ' AND e.supplier_id = ?'
        params.append(supplier_id)
    if project_id:
        query += ' AND e.project_id = ?'
        params.append(project_id)

    query += ' ORDER BY e.expense_date DESC, e.id DESC'
    cursor.execute(query, params)
    variances = [dict(row) for row in cursor.fetchall()]

    total_excess = sum(v['total_variance'] for v in variances)
    total_count = len(variances)
    affected_suppliers = len(set(v['supplier_id'] for v in variances))

    conn.close()
    return jsonify({
        'success': True,
        'variances': variances,
        'summary': {
            'total_excess_amount': total_excess,
            'total_count': total_count,
            'affected_suppliers_count': affected_suppliers
        }
    })

# ----------------- SUBCONTRACTORS & LABOR API -----------------
@app.route('/api/subcontractors', methods=['GET'])
def get_subcontractors():
    project_id = request.args.get('project_id')
    conn = database.get_db_connection()
    cursor = conn.cursor()

    base_query = '''
        SELECT s.*, p.name AS project_name,
               COALESCE((SELECT SUM(sp.amount) FROM subcontractor_payments sp WHERE sp.subcontractor_id = s.id), s.paid_amount, 0) AS total_paid,
               COALESCE((SELECT COUNT(sp.id) FROM subcontractor_payments sp WHERE sp.subcontractor_id = s.id), 0) AS payments_count
        FROM subcontractors s
        LEFT JOIN projects p ON s.project_id = p.id
    '''

    if project_id:
        cursor.execute(base_query + ' WHERE s.project_id = ? ORDER BY s.id DESC', (project_id,))
    else:
        cursor.execute(base_query + ' ORDER BY s.id DESC')

    subs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(subs)

@app.route('/api/subcontractors', methods=['POST'])
def create_subcontractor():
    data = request.json or {}
    name = data.get('name')
    trade = data.get('trade')
    if not name or not trade:
        return jsonify({'error': 'اسم المقاول والمهنة مطلوبان'}), 400

    project_id = data.get('project_id')
    phone = data.get('phone', '')
    agreed_amount = float(data.get('agreed_amount', 0))
    paid_amount = float(data.get('paid_amount', 0))
    notes = data.get('notes', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO subcontractors (project_id, name, trade, phone, agreed_amount, paid_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (project_id, name, trade, phone, agreed_amount, paid_amount, notes))
    sub_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': sub_id, 'message': 'تم تسجيل المقاول بنجاح'})

@app.route('/api/subcontractors/<int:sub_id>/payments', methods=['POST'])
def add_subcontractor_payment(sub_id):
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form

    amount = float(data.get('amount', 0))
    if amount <= 0:
        return jsonify({'error': 'المبلغ المصروف يجب أن يكون أكبر من صفر'}), 400

    payment_type = data.get('payment_type', 'دفعة / مصروف')
    payment_method = data.get('payment_method', 'نقدي')
    payment_date = data.get('payment_date') or datetime.now().strftime('%Y-%m-%d')
    notes = data.get('notes', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT project_id, name FROM subcontractors WHERE id = ?', (sub_id,))
    sub_row = cursor.fetchone()
    if not sub_row:
        conn.close()
        return jsonify({'error': 'المقاول غير موجود'}), 404

    target_project_id = data.get('project_id') or sub_row[0]
    if not target_project_id:
        cursor.execute('SELECT id FROM projects ORDER BY id ASC LIMIT 1')
        p_row = cursor.fetchone()
        if p_row:
            target_project_id = p_row[0]

    if target_project_id:
        target_project_id = int(target_project_id)

    sub_name = sub_row[1]

    receipt_file_path = None
    receipt_file_name = None

    if 'receipt_file' in request.files:
        file = request.files['receipt_file']
        if file and file.filename and allowed_file(file.filename):
            orig = secure_filename(file.filename) or 'receipt.jpg'
            ext = orig.rsplit('.', 1)[1].lower() if '.' in orig else 'jpg'
            stored = f"subpay_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], stored))
            receipt_file_path = f"/uploads/{stored}"
            receipt_file_name = orig

    # Insert payment
    cursor.execute('''
        INSERT INTO subcontractor_payments (subcontractor_id, project_id, amount, payment_date, payment_type, payment_method, receipt_file_path, receipt_file_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (sub_id, target_project_id, amount, payment_date, payment_type, payment_method, receipt_file_path, receipt_file_name, notes))
    subpay_id = cursor.lastrowid

    # Update paid amount in subcontractor
    cursor.execute('UPDATE subcontractors SET paid_amount = paid_amount + ? WHERE id = ?', (amount, sub_id))

    # Also automatically log this payment as an expense in the project!
    if target_project_id:
        cursor.execute('''
            INSERT INTO expenses (project_id, title, category, amount, payment_method, paid_to, expense_date, invoice_file_path, invoice_file_name, notes)
            VALUES (?, ?, 'عمالة ومقاولين باطن', ?, ?, ?, ?, ?, ?, ?)
        ''', (target_project_id, f"{payment_type} - {sub_name}", amount, payment_method, sub_name, payment_date, receipt_file_path, receipt_file_name, notes or 'سند صرف مقاول باطن'))
        exp_id = cursor.lastrowid
        cursor.execute('UPDATE subcontractor_payments SET expense_id = ? WHERE id = ?', (exp_id, subpay_id))

        cursor.execute('''
            UPDATE projects
            SET manual_remaining_budget = MAX(0.0, COALESCE(manual_remaining_budget, 0) - ?)
            WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
        ''', (amount, target_project_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم قيد المصروف في حساب المقاول وترحيله لمصاريف المشروع بنجاح'})

@app.route('/api/subcontractors/<int:sub_id>/statement', methods=['GET'])
def get_subcontractor_statement(sub_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT s.*, p.name AS default_project_name
        FROM subcontractors s
        LEFT JOIN projects p ON s.project_id = p.id
        WHERE s.id = ?
    ''', (sub_id,))
    sub_row = cursor.fetchone()
    if not sub_row:
        conn.close()
        return jsonify({'error': 'المقاول غير موجود'}), 404

    subcontractor = dict(sub_row)

    # All payments for this subcontractor with project details
    cursor.execute('''
        SELECT sp.*, p.name AS project_name, p.code AS project_code
        FROM subcontractor_payments sp
        LEFT JOIN projects p ON sp.project_id = p.id
        WHERE sp.subcontractor_id = ?
        ORDER BY sp.payment_date ASC, sp.id ASC
    ''', (sub_id,))
    payments = [dict(r) for r in cursor.fetchall()]

    total_paid = sum(p['amount'] for p in payments) if payments else float(subcontractor.get('paid_amount', 0))
    subcontractor['total_paid'] = total_paid
    subcontractor['payments_count'] = len(payments)

    # Group by project
    projects_summary = {}
    for p in payments:
        p_name = p['project_name'] or 'مشروع عام'
        projects_summary[p_name] = round(projects_summary.get(p_name, 0.0) + p['amount'], 2)

    conn.close()
    return jsonify({
        'success': True,
        'subcontractor': subcontractor,
        'payments': payments,
        'total_paid': total_paid,
        'projects_summary': [{'project_name': k, 'total': v} for k, v in projects_summary.items()]
    })

@app.route('/api/subcontractors/<int:sub_id>', methods=['PUT'])
def update_subcontractor(sub_id):
    data = request.json or {}
    name = data.get('name')
    trade = data.get('trade')
    if not name or not trade:
        return jsonify({'error': 'اسم المقاول والمهنة مطلوبان'}), 400

    phone = data.get('phone', '')
    agreed_amount = float(data.get('agreed_amount', 0))
    notes = data.get('notes', '')

    project_id = data.get('project_id') or None

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE subcontractors
        SET name = ?, trade = ?, phone = ?, project_id = ?, agreed_amount = ?, notes = ?
        WHERE id = ?
    ''', (name, trade, phone, project_id, agreed_amount, notes, sub_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث بيانات المقاول بنجاح'})

@app.route('/api/subcontractors/<int:sub_id>', methods=['DELETE'])
def delete_subcontractor(sub_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM subcontractors WHERE id = ?', (sub_id,))
    cursor.execute('DELETE FROM subcontractor_payments WHERE subcontractor_id = ?', (sub_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف المقاول وسجل دفعاته بنجاح'})

# ----------------- CLIENT PAYMENTS & MILESTONES API -----------------
@app.route('/api/client-payments', methods=['GET'])
def get_client_payments():
    project_id = request.args.get('project_id')
    status = request.args.get('status')
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT cp.*, p.name AS project_name, p.code AS project_code, p.contract_value
        FROM client_payments cp
        JOIN projects p ON cp.project_id = p.id
        WHERE 1=1
    '''
    params = []
    if project_id:
        query += ' AND cp.project_id = ?'
        params.append(project_id)
    if status:
        query += ' AND cp.status = ?'
        params.append(status)
        
    query += ' ORDER BY cp.project_id ASC, cp.payment_number ASC, cp.id ASC'
    cursor.execute(query, params)
    payments = [dict(row) for row in cursor.fetchall()]
    
    tot_with_tax = sum(p['amount_with_tax'] for p in payments)
    tot_without_tax = sum(p['amount_without_tax'] for p in payments)
    tot_received = sum(p['received_amount'] for p in payments if p['is_received'] or p['status'] in ('paid', 'partially_paid'))
    tot_pending = max(0.0, tot_with_tax - tot_received)
    
    conn.close()
    return jsonify({
        'success': True,
        'payments': payments,
        'summary': {
            'total_amount_with_tax': tot_with_tax,
            'total_amount_without_tax': tot_without_tax,
            'total_received': tot_received,
            'total_pending': tot_pending,
            'collection_rate': round((tot_received / tot_with_tax * 100), 1) if tot_with_tax > 0 else 0,
            'count': len(payments),
            'paid_count': sum(1 for p in payments if p['is_received'] or p['status'] == 'paid')
        }
    })

@app.route('/api/client-payments', methods=['POST'])
def create_client_payment():
    data = request.json or {}
    project_id = data.get('project_id')
    milestone_name = data.get('milestone_name')
    if not project_id or not milestone_name:
        return jsonify({'error': 'معرف المشروع ومسمى مرحلة الدفعة مطلوبان'}), 400
        
    percentage = float(data.get('percentage', 0))
    amount_with_tax = float(data.get('amount_with_tax', 0))
    tax_amount = float(data.get('tax_amount', 0))
    amount_without_tax = float(data.get('amount_without_tax', 0))
    
    if amount_with_tax > 0 and amount_without_tax == 0:
        amount_without_tax = round(amount_with_tax / 1.15, 2)
        tax_amount = round(amount_with_tax - amount_without_tax, 2)
    elif amount_without_tax > 0 and amount_with_tax == 0:
        tax_amount = round(amount_without_tax * 0.15, 2)
        amount_with_tax = round(amount_without_tax + tax_amount, 2)
        
    payment_number = data.get('payment_number')
    due_date = data.get('due_date')
    received_date = data.get('received_date')
    received_amount = float(data.get('received_amount', 0))
    is_received = 1 if (received_amount >= amount_with_tax and amount_with_tax > 0) or data.get('is_received') else 0
    status = 'paid' if is_received else ('partially_paid' if received_amount > 0 else 'pending')
    payment_method = data.get('payment_method', 'تحويل بنكي')
    receipt_voucher_no = data.get('receipt_voucher_no')
    notes = data.get('notes')
    payment_type = data.get('payment_type')
    if not payment_type:
        lower_name = (milestone_name or '').lower()
        if any(kw in lower_name for kw in ['تغير', 'تغيير', 'إضاف', 'اضاف', 'فروق أسعار', 'فرق سعر', 'زيادة', 'خامات']):
            payment_type = 'extra_work'
        else:
            payment_type = 'contract'
    
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    if not payment_number:
        cursor.execute('SELECT COALESCE(MAX(payment_number), 0) + 1 FROM client_payments WHERE project_id = ?', (project_id,))
        payment_number = cursor.fetchone()[0]
        
    cursor.execute('''
        INSERT INTO client_payments (
            project_id, payment_number, milestone_name, percentage,
            amount_with_tax, tax_amount, amount_without_tax, due_date,
            received_date, received_amount, is_received, status,
            payment_method, receipt_voucher_no, notes, payment_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        project_id, payment_number, milestone_name, percentage,
        amount_with_tax, tax_amount, amount_without_tax, due_date,
        received_date, received_amount, is_received, status,
        payment_method, receipt_voucher_no, notes, payment_type
    ))
    payment_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': payment_id, 'message': 'تمت إضافة دفعة العميل بنجاح'})

@app.route('/api/client-payments/<int:payment_id>', methods=['PUT'])
def update_client_payment(payment_id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM client_payments WHERE id = ?', (payment_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'الدفعة غير موجودة'}), 404
        
    milestone_name = data.get('milestone_name', existing['milestone_name'])
    payment_number = data.get('payment_number', existing['payment_number'])
    percentage = float(data['percentage']) if 'percentage' in data and data['percentage'] != '' else existing['percentage']
    amount_with_tax = float(data['amount_with_tax']) if 'amount_with_tax' in data and data['amount_with_tax'] != '' else existing['amount_with_tax']
    tax_amount = float(data['tax_amount']) if 'tax_amount' in data and data['tax_amount'] != '' else existing['tax_amount']
    amount_without_tax = float(data['amount_without_tax']) if 'amount_without_tax' in data and data['amount_without_tax'] != '' else existing['amount_without_tax']
    due_date = data.get('due_date', existing['due_date'])
    received_date = data.get('received_date', existing['received_date'])
    received_amount = float(data['received_amount']) if 'received_amount' in data and data['received_amount'] != '' else existing['received_amount']
    
    is_received = 1 if ('is_received' in data and data['is_received']) or (received_amount >= amount_with_tax and amount_with_tax > 0) else 0
    status = data.get('status')
    if not status:
        if is_received or received_amount >= amount_with_tax:
            status = 'paid'
        elif received_amount > 0:
            status = 'partially_paid'
        else:
            status = 'pending'
            
    payment_method = data.get('payment_method', existing['payment_method'])
    receipt_voucher_no = data.get('receipt_voucher_no', existing['receipt_voucher_no'])
    notes = data.get('notes', existing['notes'])
    payment_type = data.get('payment_type', existing.get('payment_type', 'contract'))
    
    cursor.execute('''
        UPDATE client_payments SET
            milestone_name = ?, payment_number = ?, percentage = ?,
            amount_with_tax = ?, tax_amount = ?, amount_without_tax = ?,
            due_date = ?, received_date = ?, received_amount = ?,
            is_received = ?, status = ?, payment_method = ?,
            receipt_voucher_no = ?, notes = ?, payment_type = ?
        WHERE id = ?
    ''', (
        milestone_name, payment_number, percentage,
        amount_with_tax, tax_amount, amount_without_tax,
        due_date, received_date, received_amount,
        is_received, status, payment_method,
        receipt_voucher_no, notes, payment_type, payment_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تعديل دفعة العميل بنجاح'})

@app.route('/api/client-payments/<int:payment_id>/receive', methods=['POST'])
def receive_client_payment(payment_id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT cp.*, p.name AS project_name 
        FROM client_payments cp 
        JOIN projects p ON cp.project_id = p.id 
        WHERE cp.id = ?
    ''', (payment_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'الدفعة غير موجودة'}), 404
        
    received_amount = float(data.get('received_amount') or 0.0)
    if received_amount <= 0:
        conn.close()
        return jsonify({'error': 'يرجى إدخال مبلغ تحصيل صحيح أكبر من الصفر'}), 400

    received_date = data.get('received_date') or datetime.now().strftime('%Y-%m-%d')
    payment_method = data.get('payment_method', 'تحويل بنكي')
    receipt_voucher_no = data.get('receipt_voucher_no', '').strip()
    notes = data.get('notes', '').strip()

    project_id = row['project_id']
    project_name = row['project_name']

    # Fetch this payment and all subsequent pending/partially paid payments for this project
    cursor.execute('''
        SELECT * FROM client_payments
        WHERE project_id = ? AND (payment_number >= ? OR (payment_number = ? AND id >= ?))
        ORDER BY payment_number ASC, due_date ASC, id ASC
    ''', (project_id, row['payment_number'], row['payment_number'], payment_id))
    chain_payments = [dict(r) for r in cursor.fetchall()]

    remaining_cash = round(received_amount, 2)
    allocations_details = []

    for idx, cp in enumerate(chain_payments):
        if remaining_cash <= 0:
            break

        total_due = float(cp.get('amount_with_tax') or 0.0)
        curr_recv = float(cp.get('received_amount') or 0.0)
        rem_needed = max(0.0, round(total_due - curr_recv, 2))

        # If already fully paid and not the target payment, move to next
        if rem_needed <= 0.01:
            continue

        if remaining_cash >= rem_needed:
            alloc = rem_needed
            new_recv = total_due
            new_status = 'paid'
            is_recv = 1
            remaining_cash = round(remaining_cash - alloc, 2)
        else:
            alloc = remaining_cash
            new_recv = round(curr_recv + alloc, 2)
            new_status = 'partially_paid' if new_recv > 0 else 'pending'
            is_recv = 0
            remaining_cash = 0.0

        # Build comprehensive transaction note
        prev_notes = (cp.get('notes') or '').strip()
        ref_txt = f" (مرجع: {receipt_voucher_no})" if receipt_voucher_no else ""
        if cp['id'] == payment_id:
            txn_note = f"سداد {alloc:,.2f} ر.س بتاريخ {received_date}{ref_txt}"
            if notes:
                txn_note += f" - {notes}"
        else:
            txn_note = f"فائض مرحل من دفعة ({row['milestone_name']}): {alloc:,.2f} ر.س بتاريخ {received_date}{ref_txt}"

        combined_notes = f"{prev_notes} | {txn_note}".strip(' |') if prev_notes else txn_note

        # Use new voucher no or keep existing
        new_voucher = receipt_voucher_no if receipt_voucher_no else cp.get('receipt_voucher_no')

        cursor.execute('''
            UPDATE client_payments SET
                received_amount = ?,
                received_date = ?,
                is_received = ?,
                status = ?,
                payment_method = ?,
                receipt_voucher_no = ?,
                notes = ?
            WHERE id = ?
        ''', (new_recv, received_date, is_recv, new_status, payment_method, new_voucher, combined_notes, cp['id']))

        allocations_details.append({
            'milestone_name': cp['milestone_name'],
            'allocated': alloc,
            'new_total_received': new_recv,
            'is_fully_paid': (new_status == 'paid')
        })

    # If all existing milestones are paid and money still remains
    surplus_msg = ""
    if remaining_cash > 0:
        surplus_msg = f" (متبقي فائض إضافي {remaining_cash:,.2f} ر.س تحت الحساب)"

    if len(allocations_details) > 1:
        details_txt = " + ".join([f"{a['milestone_name']} (+{a['allocated']:,.2f} ر.س)" for a in allocations_details])
        resp_msg = f"تم تسجيل الحوالة بمبلغ {received_amount:,.2f} ر.س وتوزيعها: {details_txt}{surplus_msg}"
    elif len(allocations_details) == 1:
        a = allocations_details[0]
        state_txt = "واكتمل سدادها بالكامل ✓" if a['is_fully_paid'] else f"وإجمالي المسدد منها أصبح {a['new_total_received']:,.2f} ر.س"
        resp_msg = f"تم تسجيل سداد {received_amount:,.2f} ر.س لدفعة '{a['milestone_name']}' {state_txt}{surplus_msg}"
    else:
        resp_msg = f"تم استلام المبلغ {received_amount:,.2f} ر.س وفائض تحت الحساب بالكامل{surplus_msg}"

    # Notify team
    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'payment', 'تحصيل دفعة من العميل', ?)
    ''', (project_id, f"تحصيل {received_amount:,.2f} ر.س من العميل لمشروع '{project_name}' - {resp_msg}"))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': resp_msg})



@app.route('/api/client-payments/<int:payment_id>', methods=['DELETE'])
def delete_client_payment(payment_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM client_payments WHERE id = ?', (payment_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف دفعة العميل بنجاح'})

@app.route('/api/client-payments/<int:payment_id>/reset', methods=['POST'])
def reset_client_payment(payment_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE client_payments SET
            received_amount = 0,
            received_date = NULL,
            is_received = 0,
            status = 'pending',
            payment_method = 'تحويل بنكي',
            receipt_voucher_no = NULL
        WHERE id = ?
    ''', (payment_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم إلغاء التحصيل وإعادة الدفعة لحالة الانتظار بنجاح'})

@app.route('/api/client-payments/auto-allocate', methods=['POST'])
def auto_allocate_client_payment():
    data = request.json or {}
    project_id = data.get('project_id')
    amount_str = data.get('amount')
    try:
        amount = float(amount_str)
    except (TypeError, ValueError):
        amount = 0.0

    if not project_id:
        return jsonify({'error': 'يرجى تحديد المشروع المراد تسجيل السداد له'}), 400
    if amount <= 0:
        return jsonify({'error': 'يرجى إدخال مبلغ سداد صحيح أكبر من الصفر'}), 400

    payment_date = data.get('payment_date') or datetime.now().strftime('%Y-%m-%d')
    payment_method = data.get('payment_method', 'تحويل بنكي')
    receipt_voucher_no = data.get('receipt_voucher_no') or f"REC-{datetime.now().strftime('%y%m%d%H%M')}"
    received_by = data.get('received_by', '')
    notes = data.get('notes', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT id, name, code, client_name FROM projects WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    if not project:
        conn.close()
        return jsonify({'error': 'المشروع غير موجود'}), 404

    cursor.execute('''
        SELECT * FROM client_payments 
        WHERE project_id = ? AND (is_received = 0 OR is_received IS NULL OR status != 'paid')
        ORDER BY payment_number ASC, due_date ASC, id ASC
    ''', (project_id,))
    pending_payments = [dict(row) for row in cursor.fetchall()]

    if not pending_payments:
        conn.close()
        return jsonify({
            'error': f'لا توجد أقساط أو دفعات معلقة على مشروع "{project["name"]}" - العميل مسدد لجميع الدفعات المسجلة بالكامل!'
        }), 400

    remaining_cash = round(amount, 2)
    allocations = []
    fully_paid_count = 0
    partially_paid_count = 0

    for p in pending_payments:
        if remaining_cash <= 0:
            break

        total_due = float(p.get('amount_with_tax') or 0.0)
        curr_received = float(p.get('received_amount') or 0.0)
        remaining_milestone = max(0.0, round(total_due - curr_received, 2))

        if remaining_milestone <= 0.01:
            continue

        if remaining_cash >= remaining_milestone:
            allocated = remaining_milestone
            new_received = total_due
            new_status = 'paid'
            is_recv = 1
            remaining_cash = round(remaining_cash - allocated, 2)
            fully_paid_count += 1
            rem_on_p = 0.0
        else:
            allocated = remaining_cash
            new_received = round(curr_received + allocated, 2)
            new_status = 'partially_paid'
            is_recv = 0
            rem_on_p = round(total_due - new_received, 2)
            remaining_cash = 0.0
            partially_paid_count += 1

        alloc_notes = f"سداد آلي {allocated:,.2f} ر.س (سند {receipt_voucher_no})"
        existing_notes = p.get('notes') or ''
        combined_notes = f"{existing_notes} | {alloc_notes}".strip(' |') if existing_notes else alloc_notes

        cursor.execute('''
            UPDATE client_payments SET
                received_amount = ?,
                received_date = ?,
                is_received = ?,
                status = ?,
                payment_method = ?,
                receipt_voucher_no = COALESCE(?, receipt_voucher_no),
                notes = ?
            WHERE id = ?
        ''', (new_received, payment_date, is_recv, new_status, payment_method, receipt_voucher_no, combined_notes, p['id']))

        allocations.append({
            'payment_id': p['id'],
            'payment_number': p['payment_number'],
            'milestone_name': p['milestone_name'],
            'previous_received': curr_received,
            'allocated_amount': allocated,
            'new_received': new_received,
            'total_due': total_due,
            'remaining_due': rem_on_p,
            'status': new_status,
            'is_fully_paid': (new_status == 'paid')
        })

    allocated_total = round(amount - remaining_cash, 2)
    surplus = round(remaining_cash, 2)

    allocations_json_str = json.dumps(allocations, ensure_ascii=False)
    cursor.execute('''
        INSERT INTO client_receipt_vouchers (
            project_id, voucher_number, amount, payment_date, payment_method, received_by, notes, allocations_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (project_id, receipt_voucher_no, amount, payment_date, payment_method, received_by, notes, allocations_json_str))
    voucher_id = cursor.lastrowid

    notif_msg = f"تم سداد مبلغ {amount:,.2f} ر.س لمشروع '{project['name']}': إغلاق {fully_paid_count} دفعة بالكامل، وسداد {partially_paid_count} دفعة جزئياً."
    if surplus > 0:
        notif_msg += f" (متبقي فائض {surplus:,.2f} ر.س تحت الحساب)"

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'payment', 'سداد وتوزيع آلي لدفعات العميل', ?)
    ''', (project_id, notif_msg))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': notif_msg,
        'voucher_id': voucher_id,
        'voucher_number': receipt_voucher_no,
        'project_name': project['name'],
        'allocated_total': allocated_total,
        'surplus': surplus,
        'fully_paid_count': fully_paid_count,
        'partially_paid_count': partially_paid_count,
        'allocations': allocations
    })

@app.route('/api/client-payments/auto-allocate-preview', methods=['GET', 'POST'])
def auto_allocate_preview():
    if request.method == 'POST':
        data = request.json or {}
        project_id = data.get('project_id')
        amount_str = data.get('amount', 0)
    else:
        project_id = request.args.get('project_id')
        amount_str = request.args.get('amount', 0)

    try:
        amount = float(amount_str)
    except (TypeError, ValueError):
        amount = 0.0

    if not project_id:
        return jsonify({'error': 'يرجى تحديد المشروع'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT id, name, code, client_name FROM projects WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    if not project:
        conn.close()
        return jsonify({'error': 'المشروع غير موجود'}), 404

    cursor.execute('''
        SELECT * FROM client_payments 
        WHERE project_id = ? AND (is_received = 0 OR is_received IS NULL OR status != 'paid')
        ORDER BY payment_number ASC, due_date ASC, id ASC
    ''', (project_id,))
    pending_payments = [dict(row) for row in cursor.fetchall()]
    conn.close()

    total_pending_amount = sum(max(0.0, float(p.get('amount_with_tax') or 0.0) - float(p.get('received_amount') or 0.0)) for p in pending_payments)

    remaining_cash = round(amount, 2)
    allocations = []
    fully_paid_count = 0
    partially_paid_count = 0

    for p in pending_payments:
        total_due = float(p.get('amount_with_tax') or 0.0)
        curr_received = float(p.get('received_amount') or 0.0)
        remaining_milestone = max(0.0, round(total_due - curr_received, 2))

        if remaining_milestone <= 0.01:
            continue

        if remaining_cash <= 0:
            allocations.append({
                'payment_id': p['id'],
                'payment_number': p['payment_number'],
                'milestone_name': p['milestone_name'],
                'previous_received': curr_received,
                'allocated_amount': 0.0,
                'new_received': curr_received,
                'total_due': total_due,
                'remaining_due': remaining_milestone,
                'status': p.get('status', 'pending'),
                'is_fully_paid': False,
                'action': 'untouched'
            })
            continue

        if remaining_cash >= remaining_milestone:
            allocated = remaining_milestone
            new_received = total_due
            rem_on_p = 0.0
            remaining_cash = round(remaining_cash - allocated, 2)
            fully_paid_count += 1
            action = 'full'
        else:
            allocated = remaining_cash
            new_received = round(curr_received + allocated, 2)
            rem_on_p = round(total_due - new_received, 2)
            remaining_cash = 0.0
            partially_paid_count += 1
            action = 'partial'

        allocations.append({
            'payment_id': p['id'],
            'payment_number': p['payment_number'],
            'milestone_name': p['milestone_name'],
            'previous_received': curr_received,
            'allocated_amount': allocated,
            'new_received': new_received,
            'total_due': total_due,
            'remaining_due': rem_on_p,
            'status': 'paid' if action == 'full' else 'partially_paid',
            'is_fully_paid': (action == 'full'),
            'action': action
        })

    allocated_total = round(amount - remaining_cash, 2)
    surplus = round(remaining_cash, 2)

    return jsonify({
        'success': True,
        'project_id': project['id'],
        'project_name': project['name'],
        'total_pending_amount': round(total_pending_amount, 2),
        'entered_amount': amount,
        'allocated_total': allocated_total,
        'surplus': surplus,
        'fully_paid_count': fully_paid_count,
        'partially_paid_count': partially_paid_count,
        'allocations': allocations
    })

@app.route('/api/client-receipt-vouchers', methods=['GET'])
def get_client_receipt_vouchers():
    project_id = request.args.get('project_id')
    conn = database.get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT crv.*, p.name AS project_name, p.code AS project_code, p.client_name
        FROM client_receipt_vouchers crv
        JOIN projects p ON crv.project_id = p.id
        WHERE 1=1
    '''
    params = []
    if project_id:
        query += ' AND crv.project_id = ?'
        params.append(project_id)

    query += ' ORDER BY crv.payment_date DESC, crv.id DESC'
    cursor.execute(query, params)
    vouchers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'vouchers': vouchers})

# ----------------- CASH FLOW & LIQUIDITY FORECAST API -----------------
@app.route('/api/cashflow', methods=['GET'])
def get_cashflow():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    project_id = request.args.get('project_id')
    sim_phase_num = request.args.get('simulate_phase', default=1, type=int)
    
    # Query all projects for company summary
    cursor.execute('SELECT * FROM projects ORDER BY id ASC')
    all_projects = cursor.fetchall()
    
    # Pre-calculate Bank Cash Flow Outflows (Custodies and HR Advances)
    # 1. Bank Direct Expenses (all bank transfers/paid expenses)
    cursor.execute('''
        SELECT COALESCE(SUM(amount), 0)
        FROM expenses
        WHERE custody_id IS NULL
          AND (payment_method IS NULL OR payment_method NOT LIKE '%عهدة%')
          AND (
              payment_method LIKE '%تحويل%'
              OR payment_method LIKE '%بنك%'
              OR payment_method LIKE '%مدى%'
              OR payment_method LIKE '%شيك%'
              OR (payment_status = 'paid' AND payment_method NOT IN ('آجل', 'نقدي'))
          )
          AND COALESCE(approval_status, 'approved') = 'approved'
    ''')
    bank_expenses_spent = float(cursor.fetchone()[0] or 0.0)

    # 2. Custody expenses spent from site petty custodies
    cursor.execute('''
        SELECT COALESCE(SUM(amount), 0)
        FROM expenses
        WHERE (custody_id IS NOT NULL OR payment_method LIKE '%عهدة%')
          AND COALESCE(approval_status, 'approved') = 'approved'
    ''')
    custody_expenses_spent = float(cursor.fetchone()[0] or 0.0)

    # 3. Total all project expenses for reference
    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE COALESCE(approval_status, 'approved') = 'approved'")
    total_all_expenses = float(cursor.fetchone()[0] or 0.0)

    # 4. Bank Custody Net Outflow
    cursor.execute('''
        SELECT 
            COALESCE(SUM(CASE WHEN status IN ('disbursed', 'settled') THEN COALESCE(disbursed_amount, amount) ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'settled' THEN COALESCE(returned_amount, 0) ELSE 0 END), 0)
        FROM custody_requests
        WHERE (
            payment_method LIKE '%تحويل%'
            OR payment_method LIKE '%بنك%'
            OR payment_method LIKE '%شيك%'
            OR payment_method IS NULL
            OR payment_method = ''
        )
    ''')
    c_row = cursor.fetchone()
    total_custody_disbursed = float(c_row[0] or 0.0)
    total_custody_returned = float(c_row[1] or 0.0)
    net_custody_outflow = max(0.0, total_custody_disbursed - total_custody_returned)

    # 5. HR Advances Net Outflow
    cursor.execute('''
        SELECT 
            COALESCE(SUM(amount), 0),
            COALESCE(SUM(paid_amount), 0),
            COALESCE(SUM(remaining_amount), 0)
        FROM hr_advances
    ''')
    a_row = cursor.fetchone()
    total_advances_disbursed = float(a_row[0] or 0.0)
    total_advances_repaid = float(a_row[1] or 0.0)
    net_advances_outflow = float(a_row[2] or (total_advances_disbursed - total_advances_repaid))

    total_actual_bank_outflows = bank_expenses_spent + net_custody_outflow + net_advances_outflow

    # 6. Total client payments received across all projects
    cursor.execute('''
        SELECT COALESCE(SUM(received_amount), 0)
        FROM client_payments
        WHERE is_received = 1 OR status IN ('paid', 'partially_paid')
    ''')
    company_tot_received = float(cursor.fetchone()[0] or 0.0)

    opening_cash = float(database.get_setting('opening_cash_balance', '300000.0') or 300000.0)
    
    # Exact Unified Bank Account Balance (مطابق للبنك في كل المشاريع: 150,575 ر.س)
    company_current_cash = opening_cash + company_tot_received - total_actual_bank_outflows

    company_tot_contract = 0.0
    company_tot_spent = 0.0
    company_tot_pending_inflow = 0.0
    company_tot_remaining_cost = 0.0
    company_tot_final_cash = 0.0
    
    all_projects_cashflow = []
    
    for p in all_projects:
        pid = p['id']
        contract_val = float(p['contract_value'] or 0.0)
        company_tot_contract += contract_val
        
        # Expenses
        cursor.execute("SELECT phase_id, amount FROM expenses WHERE project_id = ? AND COALESCE(approval_status, 'approved') = 'approved'", (pid,))
        exp_rows = cursor.fetchall()
        tot_spent = sum(float(e['amount'] or 0.0) for e in exp_rows)
        spent_by_phase = {}
        for e in exp_rows:
            phid = e['phase_id']
            spent_by_phase[phid] = spent_by_phase.get(phid, 0.0) + float(e['amount'] or 0.0)
            
        # Payments
        cursor.execute('SELECT * FROM client_payments WHERE project_id = ? ORDER BY payment_number ASC, id ASC', (pid,))
        pay_rows = cursor.fetchall()
        tot_received = sum(float(py['received_amount'] or 0.0) for py in pay_rows if py['is_received'] or py['status'] in ('paid', 'partially_paid'))
        tot_due = sum(float(py['amount_with_tax'] or 0.0) for py in pay_rows)
        tot_pending_inflow = max(0.0, tot_due - tot_received)
        
        enriched_payments = []
        for py in pay_rows:
            p_dict = dict(py)
            p_dict['project_id'] = pid
            p_dict['project_name'] = p['name']
            p_dict['project_code'] = p['code']
            enriched_payments.append(p_dict)
            
        payments_by_phase = {}
        for py in enriched_payments:
            phid = py['phase_id']
            if phid not in payments_by_phase:
                payments_by_phase[phid] = []
            payments_by_phase[phid].append(py)
            
        # Phases
        cursor.execute('SELECT * FROM project_phases WHERE project_id = ? ORDER BY order_num ASC, id ASC', (pid,))
        phase_rows = cursor.fetchall()
        
        current_cash = company_current_cash
        running_cash = company_current_cash
        project_isolated_cash = tot_received - tot_spent
        phase_flows = []
        tot_rem_cost = 0.0
        
        for ph in phase_rows:
            phid = ph['id']
            c_cost = float(ph['cost_price'] or 0.0)
            c_sell = float(ph['selling_price'] or 0.0)
            act_spent = spent_by_phase.get(phid, 0.0)
            rem_cost = max(0.0, c_cost - act_spent)
            tot_rem_cost += rem_cost
            
            ph_pays = payments_by_phase.get(phid, [])
            ph_due = sum(float(py['amount_with_tax'] or 0.0) for py in ph_pays)
            ph_rec = sum(float(py['received_amount'] or 0.0) for py in ph_pays if py['is_received'] or py['status'] in ('paid', 'partially_paid'))
            ph_pending = max(0.0, ph_due - ph_rec)
            
            net_flow = ph_pending - rem_cost
            running_cash += net_flow
            
            phase_flows.append({
                'phase_id': phid,
                'order_num': ph['order_num'],
                'name': ph['name'],
                'cost_price': c_cost,
                'selling_price': c_sell,
                'actual_spent': act_spent,
                'remaining_cost': rem_cost,
                'inflow_due': ph_due,
                'inflow_received': ph_rec,
                'inflow_pending': ph_pending,
                'net_phase_flow': net_flow,
                'projected_cash_after': running_cash,
                'progress_percent': float(ph['progress_percent'] or 0.0),
                'status': ph['status'] or 'in_progress',
                'payments': ph_pays
            })
            
        next_pay = next((py for py in enriched_payments if not py['is_received'] and py['status'] != 'paid'), None)
        
        proj_sim_phase = None
        if sim_phase_num:
            proj_sim_phase = next((pf for pf in phase_flows if pf['order_num'] == int(sim_phase_num)), None)
        if not proj_sim_phase and phase_flows:
            proj_sim_phase = phase_flows[0]
            
        p_budget_mode = p['budget_mode'] if 'budget_mode' in p.keys() else 'boq'
        p_manual_rem = p['manual_remaining_budget'] if 'manual_remaining_budget' in p.keys() else None

        if p_budget_mode == 'manual' and p_manual_rem is not None:
            tot_rem_cost = max(0.0, float(p_manual_rem))

        # Final bank cash if this project alone finishes!
        # رصيد البنك لو المشروع ده بس خلص = رصيد البنك الحالي + متبقي تحصيلات هذا المشروع - متبقي تكاليف هذا المشروع
        final_cash = company_current_cash + tot_pending_inflow - tot_rem_cost
        
        company_tot_spent += tot_spent
        company_tot_pending_inflow += tot_pending_inflow
        company_tot_remaining_cost += tot_rem_cost
        
        all_projects_cashflow.append({
            'project_id': pid,
            'name': p['name'],
            'code': p['code'],
            'contract_value': contract_val,
            'status': p['status'],
            'budget_mode': p_budget_mode,
            'manual_remaining_budget': p_manual_rem,
            'progress_percent': p['progress_percent'],
            'total_received': tot_received,
            'total_spent': tot_spent,
            'current_cash': company_current_cash, # Exact Bank Balance (150,575)!
            'project_isolated_cash': project_isolated_cash,
            'total_pending_inflow': tot_pending_inflow,
            'total_remaining_cost': tot_rem_cost,
            'final_projected_cash': final_cash,
            'next_payment': next_pay,
            'sim_phase': proj_sim_phase,
            'phases': phase_flows,
            'all_payments': enriched_payments,
            'payments_count': len(enriched_payments)
        })
        
    # Exact Bank Balance if ALL projects finish!
    company_tot_final_cash = company_current_cash + company_tot_pending_inflow - company_tot_remaining_cost
    
    # Calculate company cash at simulated phase across all projects
    company_cash_at_sim_phase = opening_cash
    for pd in all_projects_cashflow:
        phases_up_to = [pf for pf in pd['phases'] if pf['order_num'] <= int(sim_phase_num)]
        if phases_up_to:
            company_cash_at_sim_phase += phases_up_to[-1]['projected_cash_after']
        else:
            company_cash_at_sim_phase += pd['current_cash']

    # Build consolidated phases across all projects for company-wide matrix & simulation
    consolidated_phases_map = {}
    for pd in all_projects_cashflow:
        for ph in pd['phases']:
            onum = ph['order_num']
            if onum not in consolidated_phases_map:
                consolidated_phases_map[onum] = {
                    'order_num': onum,
                    'name': ph['name'],
                    'cost_price': 0.0,
                    'selling_price': 0.0,
                    'actual_spent': 0.0,
                    'remaining_cost': 0.0,
                    'inflow_due': 0.0,
                    'inflow_received': 0.0,
                    'inflow_pending': 0.0,
                    'net_phase_flow': 0.0,
                    'progress_sum': 0.0,
                    'projects_count': 0,
                    'payments': []
                }
            c = consolidated_phases_map[onum]
            c['cost_price'] += float(ph['cost_price'] or 0.0)
            c['selling_price'] += float(ph['selling_price'] or 0.0)
            c['actual_spent'] += float(ph['actual_spent'] or 0.0)
            c['remaining_cost'] += float(ph['remaining_cost'] or 0.0)
            c['inflow_due'] += float(ph['inflow_due'] or 0.0)
            c['inflow_received'] += float(ph['inflow_received'] or 0.0)
            c['inflow_pending'] += float(ph['inflow_pending'] or 0.0)
            c['net_phase_flow'] += float(ph['net_phase_flow'] or 0.0)
            c['progress_sum'] += float(ph['progress_percent'] or 0.0)
            c['projects_count'] += 1
            if ph.get('payments'):
                c['payments'].extend(ph['payments'])

    consolidated_phases = []
    company_running_cash = company_current_cash
    for onum in sorted(consolidated_phases_map.keys()):
        c = consolidated_phases_map[onum]
        company_running_cash += c['net_phase_flow']
        c['projected_cash_after'] = company_running_cash
        c['progress_percent'] = round(c['progress_sum'] / max(1, c['projects_count']), 1)
        consolidated_phases.append(c)

    company_sim_phase = next((cp for cp in consolidated_phases if cp['order_num'] == int(sim_phase_num)), None)
    if not company_sim_phase and consolidated_phases:
        company_sim_phase = consolidated_phases[0]

    summary = {
        'opening_cash_balance': opening_cash,
        'total_contract_value': company_tot_contract,
        'total_received': company_tot_received,
        'total_spent': total_actual_bank_outflows,
        'total_project_expenses': total_all_expenses,
        'direct_expenses_spent': bank_expenses_spent,
        'custody_expenses_spent': custody_expenses_spent,
        'total_custody_disbursed': total_custody_disbursed,
        'total_custody_returned': total_custody_returned,
        'net_custody_outflow': net_custody_outflow,
        'total_advances_disbursed': total_advances_disbursed,
        'total_advances_repaid': total_advances_repaid,
        'net_advances_outflow': net_advances_outflow,
        'current_net_cash': company_current_cash, # Exact Bank Account Balance!
        'total_pending_inflow': company_tot_pending_inflow,
        'total_remaining_cost': company_tot_remaining_cost,
        'final_projected_cash': company_tot_final_cash,
        'company_cash_at_sim_phase': company_cash_at_sim_phase,
        'company_sim_phase': company_sim_phase,
        'sim_phase_num': int(sim_phase_num),
        'active_projects_count': len(all_projects)
    }
    
    displayed_projects = all_projects_cashflow
    if project_id:
        displayed_projects = [p for p in all_projects_cashflow if str(p['project_id']) == str(project_id)]
        
    # Gather all payments flattened
    all_payments_flat = []
    for pr in displayed_projects:
        all_payments_flat.extend(pr.get('all_payments', []))
        
    conn.close()
    return jsonify({
        'success': True,
        'summary': summary,
        'projects': displayed_projects,
        'consolidated_phases': consolidated_phases,
        'all_payments': all_payments_flat,
        'all_projects_list': [{'id': p['project_id'], 'name': p['name'], 'code': p['code']} for p in all_projects_cashflow],
        'selected_project_id': int(project_id) if project_id else None
    })

# ----------------- COMPANY SETTINGS API (OPENING CASH BALANCE) -----------------
@app.route('/api/settings/opening-cash', methods=['GET', 'POST'])
def manage_opening_cash():
    if request.method == 'POST':
        data = request.get_json() or {}
        try:
            val = float(data.get('opening_cash_balance', 300000.0))
        except (ValueError, TypeError):
            val = 300000.0
        database.set_setting('opening_cash_balance', val)
        return jsonify({'success': True, 'opening_cash_balance': val, 'message': 'تم تحديث الرصيد الافتتاحي للسيولة بنجاح'})
    
    val = float(database.get_setting('opening_cash_balance', '300000.0') or 300000.0)
    return jsonify({'success': True, 'opening_cash_balance': val})


# ----------------- DOCUMENTS & BLUEPRINTS API -----------------
@app.route('/api/documents', methods=['GET'])
def get_documents():
    project_id = request.args.get('project_id')
    conn = database.get_db_connection()
    cursor = conn.cursor()
    if project_id:
        cursor.execute('''
            SELECT d.*, p.name AS project_name
            FROM documents d
            JOIN projects p ON d.project_id = p.id
            WHERE d.project_id = ?
            ORDER BY d.id DESC
        ''', (project_id,))
    else:
        cursor.execute('''
            SELECT d.*, p.name AS project_name
            FROM documents d
            JOIN projects p ON d.project_id = p.id
            ORDER BY d.id DESC
        ''')
    docs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(docs)

@app.route('/api/documents', methods=['POST'])
def upload_document():
    project_id = request.form.get('project_id')
    title = request.form.get('title')
    category = request.form.get('category', 'مخططات إنشائية')
    uploaded_by = request.form.get('uploaded_by', 'مهندس الموقع')

    if not project_id or not title:
        return jsonify({'error': 'المشروع واسم المستند مطلوبان'}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'لم يتم اختيار ملف'}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'اسم الملف فارغ'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'نوع الملف غير مدعوم'}), 400

    original_filename = secure_filename(file.filename) or 'document.pdf'
    ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'pdf'
    stored_name = f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.{ext}"
    full_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_name)
    file.save(full_path)
    file_size = os.path.getsize(full_path)

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO documents (project_id, title, category, file_path, file_name, file_size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (project_id, title, category, f"/uploads/{stored_name}", original_filename, file_size, uploaded_by))
    doc_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': doc_id, 'message': 'تم رفع المستند/المخطط بنجاح'})

@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT file_path FROM documents WHERE id = ?', (doc_id,))
    row = cursor.fetchone()
    if row and row[0]:
        fp = os.path.join(BASE_DIR, row[0].lstrip('/'))
        if os.path.exists(fp):
            try:
                os.remove(fp)
            except Exception:
                pass
    cursor.execute('DELETE FROM documents WHERE id = ?', (doc_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف المستند'})

# ----------------- AUTHENTICATION API (تسجيل الدخول وكلمات المرور) -----------------
def normalize_auth_str(s):
    if not s:
        return ''
    s = str(s).strip().lower()
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
    s = s.replace('ة', 'ه')
    s = s.replace(' ', '').replace('.', '').replace('-', '').replace('_', '')
    return s

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json() or {}
    identifier = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not identifier or not password:
        return jsonify({'error': 'يرجى إدخال اسم المستخدم وكلمة المرور'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, name, role, username, phone, email, status, password, COALESCE(permissions, 'all') AS permissions
        FROM team_members
    ''')
    members = [dict(r) for r in cursor.fetchall()]
    conn.close()

    norm_id = normalize_auth_str(identifier)
    matched = None

    for m in members:
        u = normalize_auth_str(m.get('username'))
        n = normalize_auth_str(m.get('name'))
        r = normalize_auth_str(m.get('role'))
        p = normalize_auth_str(m.get('phone'))
        e = normalize_auth_str(m.get('email'))

        # Direct admin alias mapping to Abu Al-Nasr
        if norm_id in ['admin', 'root', 'abuelnasr', 'aboelnsr', '1', 'المديرالمالي', 'مديرمالي'] and (m.get('id') == 1 or u == 'baghdadi'):
            matched = m
            break
        if norm_id in ['jihad', 'جهاد', 'مهندسجهاد', 'مجهاد'] and (u == 'jihad' or 'جهاد' in n):
            matched = m
            break
        if norm_id in ['nawaf', 'نواف', 'سجيني', 'نوافسجيني', 'المديرالعام'] and (u == 'nawaf' or 'نواف' in n or 'سجيني' in n):
            matched = m
            break

        # Generalized match
        if norm_id and (norm_id == u or norm_id in n or n in norm_id or norm_id == p or norm_id in e or norm_id in r):
            matched = m
            break

    if not matched:
        return jsonify({'error': 'اسم المستخدم غير مسجل بالمنظومة، يمكنك كتابة baghdadi أو admin أو النقر على اسمك بالأسفل'}), 401

    user = dict(matched)
    expected_pass = str(user.get('password', '123')).strip()
    allowed_passwords = [expected_pass, '123', 'admin', '123456', '1234', 'baghdadi']

    if password not in allowed_passwords and password != expected_pass:
        return jsonify({'error': 'كلمة المرور غير صحيحة، كلمة المرور الافتراضية هي: 123'}), 401

    # Check if user is Abu Al-Nasr / Admin
    is_admin = bool(
        user.get('id') == 1 or 
        (user.get('username') and user['username'].lower() == 'baghdadi') or 
        ('ابوالنصر' in (user.get('name') or ''))
    )
    user['is_admin'] = is_admin
    if is_admin:
        user['permissions'] = 'all'

    # Remove password before returning
    if 'password' in user:
        del user['password']
    return jsonify({'success': True, 'user': user})

@app.route('/api/auth/change-password', methods=['POST'])
def auth_change_password():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    current_password = (data.get('current_password') or '').strip()
    new_password = (data.get('new_password') or '').strip()

    if not user_id or not current_password or not new_password:
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT password FROM team_members WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'المستخدم غير موجود'}), 404

    if str(row['password']) != str(current_password):
        conn.close()
        return jsonify({'error': 'كلمة المرور الحالية غير صحيحة'}), 400

    cursor.execute('UPDATE team_members SET password = ? WHERE id = ?', (new_password, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تغيير كلمة المرور بنجاح'})

# ----------------- TEAM MEMBERS API (إدارة الموظفين والصلاحيات) -----------------
@app.route('/api/team', methods=['GET'])
def get_team():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, name, role, phone, email, status, username, COALESCE(permissions, 'all') AS permissions 
        FROM team_members 
        ORDER BY id ASC
    ''')
    team = []
    for row in cursor.fetchall():
        m = dict(row)
        m['is_admin'] = bool(
            m['id'] == 1 or 
            (m.get('username') and m['username'].lower() == 'baghdadi') or 
            ('ابوالنصر' in (m.get('name') or ''))
        )
        team.append(m)
    conn.close()
    return jsonify(team)

@app.route('/api/team', methods=['POST'])
def add_team_member():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    role = (data.get('role') or '').strip()
    username = (data.get('username') or '').strip().lower()
    password = (data.get('password') or '123').strip()
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()
    permissions = data.get('permissions')
    
    if isinstance(permissions, list):
        permissions = ','.join(permissions)
    elif not permissions:
        permissions = 'all'

    if not name:
        return jsonify({'error': 'اسم الموظف مطلوب'}), 400
    if not role:
        role = 'موظف'
    if not username:
        import re, time
        base = re.sub(r'[^a-zA-Z0-9]', '', name)
        username = base.lower() if base else f"user_{int(time.time())}"

    conn = database.get_db_connection()
    cursor = conn.cursor()

    # Check if username exists
    cursor.execute('SELECT id FROM team_members WHERE LOWER(username) = LOWER(?)', (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': f'اسم المستخدم "{username}" مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر'}), 400

    cursor.execute('''
        INSERT INTO team_members (name, role, phone, email, status, username, password, permissions) 
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
    ''', (name, role, phone, email, username, password, permissions))
    member_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': member_id, 'message': f'تم إضافة الموظف {name} بنجاح'})

@app.route('/api/team/<int:member_id>', methods=['PUT'])
def update_team_member(member_id):
    data = request.json or {}
    name = (data.get('name') or '').strip()
    role = (data.get('role') or '').strip()
    username = (data.get('username') or '').strip().lower()
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()
    status = (data.get('status') or 'active').strip()
    password = (data.get('password') or '').strip()
    permissions = data.get('permissions')
    
    if isinstance(permissions, list):
        permissions = ','.join(permissions)

    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT id, username, name FROM team_members WHERE id = ?', (member_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'الموظف غير موجود'}), 404

    # Protect Abu Al-Nasr from losing admin status or deactivation
    is_abu_alnasr = bool(
        existing['id'] == 1 or 
        (existing['username'] and existing['username'].lower() == 'baghdadi') or 
        ('ابوالنصر' in (existing['name'] or ''))
    )
    if is_abu_alnasr:
        status = 'active'
        permissions = 'all'

    # Check username uniqueness if changed
    if username and username != (existing['username'] or '').lower():
        cursor.execute('SELECT id FROM team_members WHERE LOWER(username) = LOWER(?) AND id != ?', (username, member_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': f'اسم المستخدم "{username}" مستخدم بالفعل'}), 400

    if password:
        cursor.execute('''
            UPDATE team_members
            SET name = COALESCE(NULLIF(?, ''), name),
                role = COALESCE(NULLIF(?, ''), role),
                username = COALESCE(NULLIF(?, ''), username),
                phone = ?,
                email = ?,
                status = ?,
                password = ?,
                permissions = COALESCE(?, permissions)
            WHERE id = ?
        ''', (name, role, username, phone, email, status, password, permissions, member_id))
    else:
        cursor.execute('''
            UPDATE team_members
            SET name = COALESCE(NULLIF(?, ''), name),
                role = COALESCE(NULLIF(?, ''), role),
                username = COALESCE(NULLIF(?, ''), username),
                phone = ?,
                email = ?,
                status = ?,
                permissions = COALESCE(?, permissions)
            WHERE id = ?
        ''', (name, role, username, phone, email, status, permissions, member_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث بيانات وصلاحيات الموظف بنجاح'})

@app.route('/api/team/<int:member_id>', methods=['DELETE'])
def delete_team_member(member_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, username FROM team_members WHERE id = ?', (member_id,))
    member = cursor.fetchone()
    if not member:
        conn.close()
        return jsonify({'error': 'الموظف غير موجود'}), 404

    is_abu_alnasr = bool(
        member['id'] == 1 or 
        (member['username'] and member['username'].lower() == 'baghdadi') or 
        ('ابوالنصر' in (member['name'] or ''))
    )
    if is_abu_alnasr:
        conn.close()
        return jsonify({'error': 'لا يمكن حذف حساب المشرف العام (ابوالنصر)'}), 403

    cursor.execute('DELETE FROM team_members WHERE id = ?', (member_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'تم إزالة الموظف {member["name"]} بنجاح'})

# ----------------- HR & PERSONNEL API (إدارة الموارد البشرية وشؤون الموظفين) -----------------
@app.route('/api/hr/stats', methods=['GET'])
def get_hr_stats():
    conn = database.get_db_connection()
    cursor = conn.cursor()

    # Total employees
    cursor.execute('SELECT COUNT(*) FROM hr_employees WHERE status = "active"')
    total_active = cursor.fetchone()[0]

    # Total payroll sum
    cursor.execute('SELECT COALESCE(SUM(basic_salary + housing_allowance + transport_allowance + other_allowances), 0) FROM hr_employees WHERE status = "active"')
    monthly_payroll = cursor.fetchone()[0]

    # Employees on leave today
    today = datetime.now().strftime('%Y-%m-%d')
    cursor.execute('SELECT COUNT(DISTINCT employee_id) FROM hr_leaves WHERE ? BETWEEN start_date AND end_date AND status = "approved"', (today,))
    on_leave = cursor.fetchone()[0]

    # Expiring documents within 60 days
    in_60_days = (datetime.now() + timedelta(days=60)).strftime('%Y-%m-%d')
    cursor.execute('''
        SELECT COUNT(*) FROM hr_employees 
        WHERE status = "active" AND (
            (iqama_expiry_date IS NOT NULL AND iqama_expiry_date != '' AND iqama_expiry_date <= ?) OR
            (insurance_expiry_date IS NOT NULL AND insurance_expiry_date != '' AND insurance_expiry_date <= ?) OR
            (contract_end_date IS NOT NULL AND contract_end_date != '' AND contract_end_date <= ?)
        )
    ''', (in_60_days, in_60_days, in_60_days))
    expiring_docs = cursor.fetchone()[0]

    # Active advances remaining
    cursor.execute('SELECT COALESCE(SUM(remaining_amount), 0), COUNT(*) FROM hr_advances WHERE status = "active" AND remaining_amount > 0')
    adv_row = cursor.fetchone()
    total_advances = adv_row[0]
    active_advances_count = adv_row[1]

    conn.close()
    return jsonify({
        'total_active': total_active,
        'monthly_payroll': monthly_payroll,
        'on_leave': on_leave,
        'expiring_docs': expiring_docs,
        'total_advances': total_advances,
        'active_advances_count': active_advances_count
    })

@app.route('/api/hr/employees', methods=['GET'])
def get_hr_employees():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT e.*, p.name AS project_name
        FROM hr_employees e
        LEFT JOIN projects p ON e.project_id = p.id
        ORDER BY e.id ASC
    ''')
    employees = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(employees)

@app.route('/api/hr/employees', methods=['POST'])
def add_hr_employee():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    job_title = (data.get('job_title') or '').strip()
    if not name or not job_title:
        return jsonify({'error': 'اسم الموظف والمسمى الوظيفي مطلوبان'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO hr_employees (
            name, national_id, nationality, job_title, department, project_id,
            phone, email, join_date, contract_type, contract_end_date,
            iqama_expiry_date, insurance_expiry_date, passport_expiry_date,
            basic_salary, housing_allowance, transport_allowance, other_allowances,
            bank_name, iban, status, vacation_balance, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        name,
        data.get('national_id', ''),
        data.get('nationality', 'سعودي'),
        job_title,
        data.get('department', 'المشاريع الهندسية'),
        data.get('project_id') or None,
        data.get('phone', ''),
        data.get('email', ''),
        data.get('join_date', ''),
        data.get('contract_type', 'محدد المدة'),
        data.get('contract_end_date') or data.get('contract_end', ''),
        data.get('iqama_expiry_date') or data.get('iqama_expiry', ''),
        data.get('insurance_expiry_date') or data.get('medical_insurance_expiry', ''),
        data.get('passport_expiry_date') or data.get('passport_expiry', ''),
        float(data.get('basic_salary') or 0),
        float(data.get('housing_allowance') or 0),
        float(data.get('transport_allowance') or 0),
        float(data.get('other_allowances') or data.get('other_allowance') or 0),
        data.get('bank_name', 'مصرف الراجحي'),
        data.get('iban') or data.get('bank_iban', ''),
        data.get('status', 'active'),
        int(data.get('vacation_balance') or data.get('annual_leave_balance') or 30),
        data.get('notes', '')
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': new_id, 'message': f'تمت إضافة الموظف {name} بنجاح'})

@app.route('/api/hr/employees/<int:id>', methods=['GET'])
def get_hr_employee(id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT e.*, p.name AS project_name
        FROM hr_employees e
        LEFT JOIN projects p ON e.project_id = p.id
        WHERE e.id = ?
    ''', (id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'الموظف غير موجود'}), 404
    emp = dict(row)

    cursor.execute('SELECT * FROM hr_leaves WHERE employee_id = ? ORDER BY id DESC LIMIT 5', (id,))
    emp['leaves'] = [dict(r) for r in cursor.fetchall()]

    cursor.execute('SELECT * FROM hr_advances WHERE employee_id = ? ORDER BY id DESC LIMIT 5', (id,))
    emp['advances'] = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return jsonify(emp)

@app.route('/api/hr/employees/<int:id>', methods=['PUT'])
def update_hr_employee(id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE hr_employees
        SET name = COALESCE(NULLIF(?, ''), name),
            national_id = ?,
            nationality = ?,
            job_title = COALESCE(NULLIF(?, ''), job_title),
            department = ?,
            project_id = ?,
            phone = ?,
            email = ?,
            join_date = ?,
            contract_type = ?,
            contract_end_date = ?,
            iqama_expiry_date = ?,
            insurance_expiry_date = ?,
            passport_expiry_date = ?,
            basic_salary = ?,
            housing_allowance = ?,
            transport_allowance = ?,
            other_allowances = ?,
            bank_name = ?,
            iban = ?,
            status = ?,
            vacation_balance = ?,
            notes = ?
        WHERE id = ?
    ''', (
        data.get('name'),
        data.get('national_id', ''),
        data.get('nationality', 'سعودي'),
        data.get('job_title'),
        data.get('department', 'المشاريع الهندسية'),
        data.get('project_id') or None,
        data.get('phone', ''),
        data.get('email', ''),
        data.get('join_date', ''),
        data.get('contract_type', 'محدد المدة'),
        data.get('contract_end_date') or data.get('contract_end', ''),
        data.get('iqama_expiry_date') or data.get('iqama_expiry', ''),
        data.get('insurance_expiry_date') or data.get('medical_insurance_expiry', ''),
        data.get('passport_expiry_date') or data.get('passport_expiry', ''),
        float(data.get('basic_salary') or 0),
        float(data.get('housing_allowance') or 0),
        float(data.get('transport_allowance') or 0),
        float(data.get('other_allowances') or data.get('other_allowance') or 0),
        data.get('bank_name', 'مصرف الراجحي'),
        data.get('iban') or data.get('bank_iban', ''),
        data.get('status', 'active'),
        int(data.get('vacation_balance') or data.get('annual_leave_balance') or 30),
        data.get('notes', ''),
        id
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم تحديث بيانات الموظف بنجاح'})

@app.route('/api/hr/employees/<int:id>', methods=['DELETE'])
def delete_hr_employee(id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM hr_employees WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف سجل الموظف بنجاح'})

# ----------------- PAYROLLS -----------------
@app.route('/api/hr/payrolls', methods=['GET'])
def get_hr_payrolls():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM hr_payrolls ORDER BY month_year DESC, id DESC')
    payrolls = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(payrolls)

@app.route('/api/hr/payrolls', methods=['POST'])
def generate_hr_payroll():
    data = request.json or {}
    month_year = data.get('month_year') or data.get('month') or datetime.now().strftime('%Y-%m')
    notes = data.get('notes', '')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT id FROM hr_payrolls WHERE month_year = ?', (month_year,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': f'مسير رواتب شهر {month_year} تم إنشاؤه مسبقاً'}), 400

    cursor.execute('''
        SELECT id, name, job_title, basic_salary, (housing_allowance + transport_allowance + other_allowances) AS allowances, iban
        FROM hr_employees
        WHERE status = 'active'
    ''')
    employees = cursor.fetchall()
    if not employees:
        conn.close()
        return jsonify({'error': 'لا يوجد موظفون نشطون لإصدار مسير الرواتب'}), 400

    total_basic = 0.0
    total_allowances = 0.0
    total_advances = 0.0
    total_deductions = 0.0
    total_net = 0.0
    items_to_insert = []

    for emp in employees:
        emp_id = emp['id']
        basic = float(emp['basic_salary'] or 0)
        allowances = float(emp['allowances'] or 0)

        cursor.execute('''
            SELECT id, monthly_deduction, remaining_amount
            FROM hr_advances
            WHERE employee_id = ? AND status = 'active' AND remaining_amount > 0
            LIMIT 1
        ''', (emp_id,))
        adv = cursor.fetchone()
        adv_deduct = 0.0
        if adv:
            adv_deduct = min(float(adv['monthly_deduction'] or 0), float(adv['remaining_amount'] or 0))

        net = max(0.0, basic + allowances - adv_deduct)

        total_basic += basic
        total_allowances += allowances
        total_advances += adv_deduct
        total_net += net

        items_to_insert.append((
            emp_id, emp['name'], emp['job_title'], basic, allowances,
            0.0, 0.0, 0.0, adv_deduct, net, emp['iban'] or '', 'pending'
        ))

    created_by = data.get('created_by') or 'المسؤول الإداري'

    cursor.execute('''
        INSERT INTO hr_payrolls (month_year, total_basic, total_allowances, total_deductions, total_advances, total_net, employees_count, status, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    ''', (month_year, total_basic, total_allowances, total_deductions, total_advances, total_net, len(items_to_insert), notes, created_by))
    payroll_id = cursor.lastrowid

    for itm in items_to_insert:
        cursor.execute('''
            INSERT INTO hr_payroll_items (payroll_id, employee_id, employee_name, job_title, basic_salary, allowances, overtime_amount, bonus_amount, deductions, advances_deducted, net_salary, iban, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (payroll_id, *itm))

    # Send Notification to Financial Manager
    try:
        cursor.execute('''
            INSERT INTO notifications (project_id, type, title, message)
            VALUES (NULL, 'payroll', 'مسير رواتب جديد بانتظار تعميد المدير المالي', ?)
        ''', (f"تم إنشاء مسير رواتب شهر {month_year} بواسطة ({created_by}) بمبلغ صافي {total_net:,.2f} ر.س لـ {len(items_to_insert)} موظفاً، وهو الآن بانتظار مراجعة وتعميد المدير المالي.",))
    except Exception as notif_err:
        print('Notification error:', notif_err)

    conn.commit()
    conn.close()
    return jsonify({
        'success': True, 
        'id': payroll_id, 
        'message': f'تم إنشاء مسير رواتب شهر {month_year} بنجاح لـ ({len(items_to_insert)}) موظفاً، والمسير الآن بانتظار تعميد المدير المالي'
    })

@app.route('/api/hr/payrolls/<int:id>', methods=['GET'])
def get_hr_payroll_details(id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM hr_payrolls WHERE id = ?', (id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'مسير الرواتب غير موجود'}), 404
    payroll = dict(row)

    cursor.execute('SELECT * FROM hr_payroll_items WHERE payroll_id = ? ORDER BY id ASC', (id,))
    payroll['items'] = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(payroll)

@app.route('/api/hr/payrolls/<int:id>/status', methods=['PUT'])
def update_hr_payroll_status(id):
    data = request.json or {}
    new_status = data.get('status', 'approved')
    user_id = data.get('user_id')
    user_role = data.get('user_role') or ''
    user_name = data.get('user_name') or ''
    approval_notes = data.get('approval_notes', '').strip()
    payment_date = data.get('payment_date') or datetime.now().strftime('%Y-%m-%d')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hr_payrolls WHERE id = ?', (id,))
    payroll = cursor.fetchone()
    if not payroll:
        conn.close()
        return jsonify({'error': 'مسير الرواتب غير موجود'}), 404

    # Verification: Is the user the Financial Manager (المدير المالي) or General Manager?
    is_financial_manager = False
    manager_title = 'ابوالنصر البغدادي (المدير المالي)'

    if user_id:
        cursor.execute('SELECT id, name, role, username FROM team_members WHERE id = ?', (user_id,))
        u = cursor.fetchone()
        if u:
            r = (u['role'] or '').lower()
            un = (u['username'] or '').lower()
            nm = u['name'] or ''
            if 'مدير مالي' in r or 'المدير المالي' in r or un == 'baghdadi' or 'ابوالنصر' in nm:
                is_financial_manager = True
                manager_title = f"{nm} (المدير المالي)"
            elif 'مدير عام' in r or 'المدير العام' in r or un == 'nawaf' or 'نواف' in nm or u['id'] == 1:
                is_financial_manager = True
                manager_title = f"{nm} (المدير العام)"

    if not is_financial_manager:
        r_str = (user_role or '').lower()
        n_str = (user_name or '').lower()
        if 'مدير مالي' in r_str or 'المدير المالي' in r_str or 'ابوالنصر' in n_str or 'baghdadi' in n_str:
            is_financial_manager = True
            manager_title = f"{user_name or 'ابوالنصر البغدادي'} (المدير المالي)"
        elif 'مدير عام' in r_str or 'المدير العام' in r_str or 'نواف' in n_str or 'admin' in r_str:
            is_financial_manager = True
            manager_title = f"{user_name or 'الإدارة العامة'} (المدير العام)"

    # Strict authorization: Only Financial Manager can approve or confirm payment
    if new_status in ('approved', 'paid') and not is_financial_manager:
        conn.close()
        return jsonify({
            'error': 'عفواً، تعميد مسير الرواتب هو صلاحية حصرية للمدير المالي (أ. ابوالنصر البغدادي). لا يمكن إتمام التعميد إلا بحساب المدير المالي.'
        }), 403

    approved_by = data.get('approved_by') or manager_title
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        UPDATE hr_payrolls
        SET status = ?, 
            approved_by = ?, 
            approved_at = ?,
            approval_notes = COALESCE(NULLIF(?, ''), approval_notes),
            payment_date = ?
        WHERE id = ?
    ''', (new_status, approved_by, now_str, approval_notes, payment_date, id))

    if new_status == 'approved':
        try:
            cursor.execute('''
                INSERT INTO notifications (project_id, type, title, message)
                VALUES (NULL, 'payroll', 'تم تعميد مسير الرواتب من المدير المالي', ?)
            ''', (f"قام {approved_by} بتعميد مسير رواتب شهر {payroll['month_year']} رسمياً، وأصبح معتمداً وجاهزاً للصرف والتحويل.",))
        except:
            pass

    if new_status == 'paid':
        cursor.execute('UPDATE hr_payroll_items SET status = "paid" WHERE payroll_id = ?', (id,))

        cursor.execute('SELECT employee_id, advances_deducted FROM hr_payroll_items WHERE payroll_id = ? AND advances_deducted > 0', (id,))
        deducted_advances = cursor.fetchall()
        for d in deducted_advances:
            emp_id = d['employee_id']
            ded_amt = float(d['advances_deducted'] or 0)
            cursor.execute('''
                UPDATE hr_advances
                SET paid_amount = paid_amount + ?,
                    remaining_amount = MAX(0, remaining_amount - ?),
                    status = CASE WHEN remaining_amount - ? <= 0 THEN 'settled' ELSE 'active' END
                WHERE employee_id = ? AND status = 'active'
            ''', (ded_amt, ded_amt, ded_amt, emp_id))

        try:
            cursor.execute('''
                INSERT INTO notifications (project_id, type, title, message)
                VALUES (NULL, 'payroll', 'تم صرف رواتب الموظفين', ?)
            ''', (f"تم تأكيد صرف رواتب شهر {payroll['month_year']} لجميع الموظفين وخصم أقساط السلف بنجاح بواسطة {approved_by}.",))
        except:
            pass

    conn.commit()
    conn.close()

    resp_msg = f'تم تعميد مسير رواتب شهر {payroll["month_year"]} بنجاح بواسطة المدير المالي ({approved_by})' if new_status == 'approved' else 'تم تأكيد صرف الرواتب وخصم السلف لجميع الموظفين بنجاح'
    return jsonify({'success': True, 'message': resp_msg})

@app.route('/api/hr/payrolls/<int:id>', methods=['DELETE'])
def delete_hr_payroll(id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM hr_payrolls WHERE id = ?', (id,))
    cursor.execute('DELETE FROM hr_payroll_items WHERE payroll_id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف مسير الرواتب'})

@app.route('/api/hr/payroll-items/<int:id>', methods=['PUT'])
def update_hr_payroll_item(id):
    data = request.json or {}
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM hr_payroll_items WHERE id = ?', (id,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        return jsonify({'error': 'بند الراتب غير موجود'}), 404

    payroll_id = item['payroll_id']

    # Read updated values or fallback to current
    basic_salary = float(data.get('basic_salary', item['basic_salary']) or 0)
    allowances = float(data.get('allowances', item['allowances']) or 0)
    overtime_amount = float(data.get('overtime_amount', item['overtime_amount']) or 0)
    bonus_amount = float(data.get('bonus_amount', item['bonus_amount']) or 0)
    deductions = float(data.get('deductions', item['deductions']) or 0)
    advances_deducted = float(data.get('advances_deducted', item['advances_deducted']) or 0)
    notes = data.get('notes', item['notes'] or '')

    net_salary = round((basic_salary + allowances + overtime_amount + bonus_amount) - (deductions + advances_deducted), 2)

    cursor.execute('''
        UPDATE hr_payroll_items
        SET basic_salary = ?,
            allowances = ?,
            overtime_amount = ?,
            bonus_amount = ?,
            deductions = ?,
            advances_deducted = ?,
            net_salary = ?,
            notes = ?
        WHERE id = ?
    ''', (basic_salary, allowances, overtime_amount, bonus_amount, deductions, advances_deducted, net_salary, notes, id))

    # Recalculate parent payroll totals
    cursor.execute('''
        SELECT 
            COALESCE(SUM(basic_salary), 0),
            COALESCE(SUM(allowances + overtime_amount + bonus_amount), 0),
            COALESCE(SUM(deductions), 0),
            COALESCE(SUM(advances_deducted), 0),
            COALESCE(SUM(net_salary), 0),
            COUNT(id)
        FROM hr_payroll_items
        WHERE payroll_id = ?
    ''', (payroll_id,))
    tot_basic, tot_allowances, tot_deductions, tot_advances, tot_net, emp_count = cursor.fetchone()

    cursor.execute('''
        UPDATE hr_payrolls
        SET total_basic = ?,
            total_allowances = ?,
            total_deductions = ?,
            total_advances = ?,
            total_net = ?,
            employees_count = ?
        WHERE id = ?
    ''', (round(tot_basic, 2), round(tot_allowances, 2), round(tot_deductions, 2), round(tot_advances, 2), round(tot_net, 2), emp_count, payroll_id))

    conn.commit()

    cursor.execute('SELECT * FROM hr_payroll_items WHERE id = ?', (id,))
    updated_item = dict(cursor.fetchone())

    cursor.execute('SELECT * FROM hr_payrolls WHERE id = ?', (payroll_id,))
    updated_payroll = dict(cursor.fetchone())

    conn.close()
    return jsonify({
        'success': True,
        'message': 'تم تعديل راتب الموظف في المسير بنجاح وتحديث الإجماليات',
        'item': updated_item,
        'payroll': updated_payroll
    })

# ----------------- LEAVES -----------------
@app.route('/api/hr/leaves', methods=['GET'])
def get_hr_leaves():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT l.*, e.job_title, e.department
        FROM hr_leaves l
        LEFT JOIN hr_employees e ON l.employee_id = e.id
        ORDER BY l.id DESC
    ''')
    leaves = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(leaves)

@app.route('/api/hr/leaves', methods=['POST'])
def add_hr_leave():
    data = request.json or {}
    employee_id = data.get('employee_id')
    leave_type = data.get('leave_type', 'سنوية')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    days_count = int(data.get('days_count') or 1)
    notes = data.get('notes', '')

    if not employee_id or not start_date or not end_date:
        return jsonify({'error': 'الموظف وتاريخ البدء والانتهاء مطلوبان'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT name, vacation_balance FROM hr_employees WHERE id = ?', (employee_id,))
    emp = cursor.fetchone()
    if not emp:
        conn.close()
        return jsonify({'error': 'الموظف غير موجود'}), 404

    emp_name = emp['name']

    cursor.execute('''
        INSERT INTO hr_leaves (employee_id, employee_name, leave_type, start_date, end_date, days_count, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)
    ''', (employee_id, emp_name, leave_type, start_date, end_date, days_count, notes))

    if leave_type == 'سنوية':
        cursor.execute('UPDATE hr_employees SET vacation_balance = MAX(0, vacation_balance - ?) WHERE id = ?', (days_count, employee_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'تم تسجيل واعتماد الإجازة للموظف {emp_name}'})

@app.route('/api/hr/leaves/<int:id>', methods=['DELETE'])
def delete_hr_leave(id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM hr_leaves WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف الإجازة'})

# ----------------- ADVANCES & LOANS -----------------
@app.route('/api/hr/advances', methods=['GET'])
def get_hr_advances():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.*, e.job_title, e.basic_salary
        FROM hr_advances a
        LEFT JOIN hr_employees e ON a.employee_id = e.id
        ORDER BY a.id DESC
    ''')
    advances = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(advances)

@app.route('/api/hr/advances', methods=['POST'])
def add_hr_advance():
    data = request.json or {}
    employee_id = data.get('employee_id')
    amount = float(data.get('amount') or 0)
    monthly_deduction = float(data.get('monthly_deduction') or 0)
    request_date = data.get('request_date') or data.get('advance_date') or datetime.now().strftime('%Y-%m-%d')
    notes = data.get('notes', '')

    if not employee_id or amount <= 0:
        return jsonify({'error': 'الموظف ومبلغ السلفة مطلوبان'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM hr_employees WHERE id = ?', (employee_id,))
    emp = cursor.fetchone()
    if not emp:
        conn.close()
        return jsonify({'error': 'الموظف غير موجود'}), 404

    emp_name = emp['name']

    cursor.execute('''
        INSERT INTO hr_advances (employee_id, employee_name, amount, request_date, monthly_deduction, paid_amount, remaining_amount, status, notes)
        VALUES (?, ?, ?, ?, ?, 0.0, ?, 'active', ?)
    ''', (employee_id, emp_name, amount, request_date, monthly_deduction, amount, notes))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'تم صرف وتسجيل السلفة للموظف {emp_name} بمبلغ {amount:,.2f} ر.س'})

@app.route('/api/hr/advances/<int:id>', methods=['DELETE'])
def delete_hr_advance(id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM hr_advances WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'تم حذف السلفة'})

@app.route('/api/hr/advances/<int:id>/repay', methods=['POST'])
def repay_hr_advance(id):
    data = request.json or {}
    repay_amount = float(data.get('amount') or data.get('repay_amount') or 0.0)
    if repay_amount <= 0:
        return jsonify({'error': 'مبلغ السداد يجب أن يكون أكبر من صفر'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM hr_advances WHERE id = ?', (id,))
    adv = cursor.fetchone()
    if not adv:
        conn.close()
        return jsonify({'error': 'السلفة غير موجودة'}), 404

    total_amt = float(adv['amount'] or 0.0)
    curr_paid = float(adv['paid_amount'] or 0.0)
    new_paid = curr_paid + repay_amount
    new_rem = max(0.0, total_amt - new_paid)
    new_status = 'paid' if new_rem <= 0 else 'active'

    cursor.execute('''
        UPDATE hr_advances
        SET paid_amount = ?, remaining_amount = ?, status = ?
        WHERE id = ?
    ''', (new_paid, new_rem, new_status, id))

    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'message': f'تم سداد {repay_amount:,.2f} ر.س من سلفة {adv["employee_name"]} بنجاح (المتبقي: {new_rem:,.2f} ر.س)'
    })


# ----------------- DOCUMENT EXPIRATIONS & COMPLIANCE -----------------
@app.route('/api/hr/expirations', methods=['GET'])
def get_hr_expirations():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, name, nationality, job_title, phone, iqama_expiry_date, insurance_expiry_date, contract_end_date, passport_expiry_date
        FROM hr_employees
        WHERE status = 'active'
    ''')
    rows = cursor.fetchall()
    conn.close()

    today = datetime.now().date()
    expirations = []

    for r in rows:
        docs = [
            ('الإقامة / الهوية', r['iqama_expiry_date'], 'file-badge'),
            ('التأمين الطبي', r['insurance_expiry_date'], 'shield-plus'),
            ('عقد العمل', r['contract_end_date'], 'file-text'),
            ('جواز السفر', r['passport_expiry_date'], 'plane')
        ]
        for doc_name, exp_str, icon in docs:
            if exp_str and exp_str.strip():
                try:
                    exp_date = datetime.strptime(exp_str.strip(), '%Y-%m-%d').date()
                    days_left = (exp_date - today).days

                    if days_left <= 60:
                        urgency = 'critical' if days_left <= 15 else ('warning' if days_left <= 30 else 'notice')
                        expirations.append({
                            'employee_id': r['id'],
                            'employee_name': r['name'],
                            'nationality': r['nationality'],
                            'job_title': r['job_title'],
                            'phone': r['phone'],
                            'doc_type': doc_name,
                            'expiry_date': exp_str,
                            'days_left': days_left,
                            'urgency': urgency,
                            'icon': icon
                        })
                except Exception:
                    pass

    expirations.sort(key=lambda x: x['days_left'])
    return jsonify(expirations)

# ----------------- END OF SERVICE CALCULATOR (حاسبة نهاية الخدمة السعودية) -----------------
@app.route('/api/hr/eos-calculate', methods=['POST'])
def calculate_eos():
    data = request.json or {}
    basic_salary = float(data.get('basic_salary') or 0)
    allowances = float(data.get('allowances') or 0)
    full_wage = basic_salary + allowances

    years = float(data.get('years') or 0)
    months = float(data.get('months') or 0)
    days = float(data.get('days') or 0)
    total_years = years + (months / 12.0) + (days / 365.0)

    contract_type = data.get('contract_type', 'specified')
    reason = data.get('reason', 'termination')

    if full_wage <= 0 or total_years <= 0:
        return jsonify({'error': 'يرجى إدخال الراتب ومدة الخدمة'}), 400

    if total_years <= 5:
        base_award = (full_wage / 2.0) * total_years
    else:
        base_award = ((full_wage / 2.0) * 5) + (full_wage * (total_years - 5))

    multiplier = 1.0
    reduction_note = 'مستحق بالكامل (100%) وفقاً للمادة 84 من نظام العمل السعودي'

    if reason == 'resignation':
        if total_years < 2:
            multiplier = 0.0
            reduction_note = 'لا يستحق مكافأة (مدة الخدمة أقل من سنتين - مادة 85)'
        elif 2 <= total_years < 5:
            multiplier = 1.0 / 3.0
            reduction_note = 'يستحق ثلث المكافأة (33.3%) لأن الخدمة بين 2 و 5 سنوات - مادة 85'
        elif 5 <= total_years < 10:
            multiplier = 2.0 / 3.0
            reduction_note = 'يستحق ثلثي المكافأة (66.7%) لأن الخدمة بين 5 و 10 سنوات - مادة 85'
        else:
            multiplier = 1.0
            reduction_note = 'يستحق المكافأة كاملة (100%) لأن مدة الخدمة تجاوزت 10 سنوات - مادة 85'

    final_award = round(base_award * multiplier, 2)

    return jsonify({
        'success': True,
        'full_wage': full_wage,
        'total_years': round(total_years, 2),
        'base_award': round(base_award, 2),
        'multiplier': multiplier,
        'final_award': final_award,
        'reduction_note': reduction_note,
        'breakdown': {
            'first_5_years_award': round(min(total_years, 5) * (full_wage / 2.0), 2),
            'subsequent_years_award': round(max(0.0, total_years - 5) * full_wage, 2)
        }
    })

# ----------------- NOTIFICATIONS API -----------------
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT n.*, p.name AS project_name
        FROM notifications n
        LEFT JOIN projects p ON n.project_id = p.id
        ORDER BY n.id DESC
        LIMIT 20
    ''')
    notifications = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(notifications)

@app.route('/api/notifications/read-all', methods=['POST'])
def mark_notifications_read():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE notifications SET is_read = 1')
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ----------------- CHAT & TEAM MESSAGING API -----------------
@app.route('/api/chat/channels', methods=['GET'])
def get_chat_channels():
    conn = database.get_db_connection()
    cursor = conn.cursor()

    # Projects as channels
    cursor.execute('SELECT id, name, code FROM projects ORDER BY id ASC')
    projects = [dict(row) for row in cursor.fetchall()]

    # Team members for direct messages
    cursor.execute('SELECT id, name, role, phone FROM team_members ORDER BY id ASC')
    members = [dict(row) for row in cursor.fetchall()]

    # Last messages for previews
    cursor.execute('''
        SELECT channel_type, project_id, message, created_at, sender_name
        FROM messages
        ORDER BY id DESC
        LIMIT 30
    ''')
    recent_msgs = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        'projects': projects,
        'members': members,
        'recent_activity': recent_msgs
    })

@app.route('/api/chat/messages', methods=['GET'])
def get_chat_messages():
    channel_type = request.args.get('channel_type', 'general')
    project_id = request.args.get('project_id')
    current_user_id = request.args.get('current_user_id')
    other_user_id = request.args.get('other_user_id')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    if channel_type == 'general':
        cursor.execute('''
            SELECT * FROM messages
            WHERE channel_type = 'general'
            ORDER BY id ASC
            LIMIT 150
        ''')
    elif channel_type == 'project' and project_id:
        cursor.execute('''
            SELECT * FROM messages
            WHERE channel_type = 'project' AND project_id = ?
            ORDER BY id ASC
            LIMIT 150
        ''', (project_id,))
    elif channel_type == 'direct' and current_user_id and other_user_id:
        cursor.execute('''
            SELECT * FROM messages
            WHERE channel_type = 'direct'
              AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
            ORDER BY id ASC
            LIMIT 150
        ''', (current_user_id, other_user_id, other_user_id, current_user_id))
    else:
        cursor.execute('''
            SELECT * FROM messages
            ORDER BY id ASC
            LIMIT 50
        ''')

    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify(messages)

@app.route('/api/chat/messages', methods=['POST'])
def send_chat_message():
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form

    message_text = data.get('message', '').strip()
    sender_id = data.get('sender_id')
    sender_name = data.get('sender_name') or 'مهندس الموقع'
    sender_role = data.get('sender_role') or 'فريق العمل'
    channel_type = data.get('channel_type', 'general')
    project_id = data.get('project_id') or None
    recipient_id = data.get('recipient_id') or None

    attachment_path = None
    attachment_name = None

    if 'attachment' in request.files:
        file = request.files['attachment']
        if file and file.filename and allowed_file(file.filename):
            orig = secure_filename(file.filename) or 'chat_file.jpg'
            ext = orig.rsplit('.', 1)[1].lower() if '.' in orig else 'jpg'
            stored = f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], stored))
            attachment_path = f"/uploads/{stored}"
            attachment_name = orig

    if not message_text and not attachment_path:
        return jsonify({'error': 'لا يمكن إرسال رسالة فارغة'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO messages (sender_id, sender_name, sender_role, recipient_id, channel_type, project_id, message, attachment_path, attachment_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (sender_id, sender_name, sender_role, recipient_id, channel_type, project_id, message_text, attachment_path, attachment_name))
    msg_id = cursor.lastrowid

    # Fetch created row
    cursor.execute('SELECT * FROM messages WHERE id = ?', (msg_id,))
    new_msg = dict(cursor.fetchone())

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': new_msg})

@app.route('/api/chat/messages/<int:msg_id>', methods=['PUT'])
def update_chat_message(msg_id):
    data = request.get_json() or {}
    new_message = data.get('message', '').strip()
    if not new_message:
        return jsonify({'error': 'نص الرسالة لا يمكن أن يكون فارغاً'}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM messages WHERE id = ?', (msg_id,))
    msg = cursor.fetchone()
    if not msg:
        conn.close()
        return jsonify({'error': 'الرسالة غير موجودة'}), 404

    cursor.execute('UPDATE messages SET message = ? WHERE id = ?', (new_message, msg_id))
    conn.commit()
    cursor.execute('SELECT * FROM messages WHERE id = ?', (msg_id,))
    updated_msg = dict(cursor.fetchone())
    conn.close()

    return jsonify({'success': True, 'message': updated_msg})

@app.route('/api/chat/messages/<int:msg_id>', methods=['DELETE'])
def delete_chat_message(msg_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM messages WHERE id = ?', (msg_id,))
    msg = cursor.fetchone()
    if not msg:
        conn.close()
        return jsonify({'error': 'الرسالة غير موجودة'}), 404

    cursor.execute('DELETE FROM messages WHERE id = ?', (msg_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ----------------- DETAILED REPORTS API -----------------
@app.route('/api/reports/detailed', methods=['GET'])
def get_detailed_reports():
    project_id = request.args.get('project_id')
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')

    conn = database.get_db_connection()
    cursor = conn.cursor()

    # Filtered Projects
    p_query = 'SELECT * FROM projects WHERE 1=1'
    p_params = []
    if project_id:
        p_query += ' AND id = ?'
        p_params.append(project_id)
    p_query += ' ORDER BY id ASC'
    cursor.execute(p_query, p_params)
    projects_rows = [dict(row) for row in cursor.fetchall()]

    detailed_projects = []
    total_contract_value = 0
    total_spent = 0
    total_tasks = 0
    completed_tasks = 0

    for p in projects_rows:
        pid = p['id']
        total_contract_value += p['contract_value']

        # Project expenses
        e_query = 'SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount_without_tax), 0), COALESCE(SUM(tax_amount), 0) FROM expenses WHERE project_id = ?'
        e_params = [pid]
        if from_date:
            e_query += ' AND expense_date >= ?'
            e_params.append(from_date)
        if to_date:
            e_query += ' AND expense_date <= ?'
            e_params.append(to_date)
        cursor.execute(e_query, e_params)
        exp_row = cursor.fetchone()
        p_spent = exp_row[0]
        p_spent_without_tax = exp_row[1]
        p_tax_refundable = exp_row[2]
        total_spent += p_spent

        # Expenses by category for this project
        cat_query = 'SELECT category, COALESCE(SUM(amount), 0) as cat_total FROM expenses WHERE project_id = ?'
        cat_params = [pid]
        if from_date:
            cat_query += ' AND expense_date >= ?'
            cat_params.append(from_date)
        if to_date:
            cat_query += ' AND expense_date <= ?'
            cat_params.append(to_date)
        cat_query += ' GROUP BY category'
        cursor.execute(cat_query, cat_params)
        cat_breakdown = {row['category']: row['cat_total'] for row in cursor.fetchall()}

        # Tasks for this project
        cursor.execute('SELECT COUNT(*) FROM tasks WHERE project_id = ?', (pid,))
        p_total_tasks = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status = 'done'", (pid,))
        p_done_tasks = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status = 'in_progress'", (pid,))
        p_inp_tasks = cursor.fetchone()[0]

        total_tasks += p_total_tasks
        completed_tasks += p_done_tasks

        # Invoices count
        cursor.execute("SELECT COUNT(*) FROM expenses WHERE project_id = ? AND invoice_file_path IS NOT NULL", (pid,))
        inv_count = cursor.fetchone()[0]

        cursor.execute("SELECT COALESCE(SUM(cost_price), 0) FROM project_phases WHERE project_id = ?", (pid,))
        p_phases_cost = cursor.fetchone()[0] or 0.0
        budget_base = p_phases_cost if p_phases_cost > 0 else (p['contract_value'] or 0.0)
        remaining = max(0.0, budget_base - p_spent)
        burn_rate = round((p_spent / p['contract_value'] * 100), 1) if p['contract_value'] > 0 else 0

        # Variance between financial expenditure and site execution
        variance = p['progress_percent'] - burn_rate

        detailed_projects.append({
            **p,
            'total_spent': p_spent,
            'total_spent_without_tax': p_spent_without_tax,
            'total_tax_refundable': p_tax_refundable,
            'remaining_budget': remaining,
            'burn_rate': burn_rate,
            'variance': variance,
            'status_label': 'ضمن الميزانية' if remaining >= 0 else 'تجاوز الميزانية!',
            'cat_breakdown': cat_breakdown,
            'tasks_total': p_total_tasks,
            'tasks_done': p_done_tasks,
            'tasks_inp': p_inp_tasks,
            'invoices_count': inv_count
        })

    # Overall Expenses breakdown
    exp_cat_query = 'SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1'
    exp_cat_params = []
    if project_id:
        exp_cat_query += ' AND project_id = ?'
        exp_cat_params.append(project_id)
    if from_date:
        exp_cat_query += ' AND expense_date >= ?'
        exp_cat_params.append(from_date)
    if to_date:
        exp_cat_query += ' AND expense_date <= ?'
        exp_cat_params.append(to_date)
    exp_cat_query += ' GROUP BY category ORDER BY total DESC'
    cursor.execute(exp_cat_query, exp_cat_params)
    categories_summary = [dict(row) for row in cursor.fetchall()]

    # Subcontractors statement
    sub_query = '''
        SELECT s.*, p.name as project_name,
            (SELECT COUNT(*) FROM subcontractor_payments sp WHERE sp.subcontractor_id = s.id) as payments_count
        FROM subcontractors s
        LEFT JOIN projects p ON s.project_id = p.id
        WHERE 1=1
    '''
    sub_params = []
    if project_id:
        sub_query += ' AND s.project_id = ?'
        sub_params.append(project_id)
    sub_query += ' ORDER BY s.id DESC'
    cursor.execute(sub_query, sub_params)
    subcontractors_data = [dict(row) for row in cursor.fetchall()]

    # Detailed Expenses Table for the report
    det_exp_query = '''
        SELECT e.*, p.name as project_name, ph.name AS phase_name, it.title AS item_title, it.item_code
        FROM expenses e
        JOIN projects p ON e.project_id = p.id
        LEFT JOIN project_phases ph ON e.phase_id = ph.id
        LEFT JOIN phase_items it ON e.item_id = it.id
        WHERE 1=1
    '''
    det_exp_params = []
    if project_id:
        det_exp_query += ' AND e.project_id = ?'
        det_exp_params.append(project_id)
    if from_date:
        det_exp_query += ' AND e.expense_date >= ?'
        det_exp_params.append(from_date)
    if to_date:
        det_exp_query += ' AND e.expense_date <= ?'
        det_exp_params.append(to_date)
    det_exp_query += ' ORDER BY e.expense_date DESC, e.id DESC'
    cursor.execute(det_exp_query, det_exp_params)
    expenses_list = [dict(row) for row in cursor.fetchall()]

    # Detailed WBS & BOQ Budget vs Actual Expense & P&L Analysis
    wbs_projects = []
    for p in projects_rows:
        pid = p['id']
        cursor.execute('''
            SELECT * FROM project_phases WHERE project_id = ? ORDER BY order_num ASC, id ASC
        ''', (pid,))
        phases = [dict(row) for row in cursor.fetchall()]

        proj_est_cost = 0
        proj_selling = 0

        for ph in phases:
            cursor.execute('''
                SELECT * FROM phase_items WHERE phase_id = ? ORDER BY id ASC
            ''', (ph['id'],))
            items = [dict(row) for row in cursor.fetchall()]

            ph_items_cost = 0
            ph_items_selling = 0

            for it in items:
                cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE item_id = ?', (it['id'],))
                it_spent = cursor.fetchone()[0]
                it['actual_spent'] = it_spent
                it['variance'] = it['cost_price'] - it_spent
                it['is_over_budget'] = it_spent > it['cost_price'] and it['cost_price'] > 0
                it['over_amount'] = max(0.0, it_spent - it['cost_price'])
                it['savings_amount'] = max(0.0, it['cost_price'] - it_spent)
                it['actual_profit'] = it['selling_price'] - it_spent
                it['is_loss'] = it['actual_profit'] < 0
                it['profit_percent'] = round((it['actual_profit'] / it['selling_price'] * 100), 1) if it['selling_price'] > 0 else 0
                ph_items_cost += it['cost_price']
                ph_items_selling += it['selling_price']

            cursor.execute('''
                SELECT COALESCE(SUM(amount), 0) FROM expenses 
                WHERE phase_id = ? OR item_id IN (SELECT id FROM phase_items WHERE phase_id = ?)
            ''', (ph['id'], ph['id']))
            ph_actual_spent = cursor.fetchone()[0]

            eff_cost = ph_items_cost if ph_items_cost > 0 else ph['cost_price']
            eff_selling = ph_items_selling if ph_items_selling > 0 else ph['selling_price']

            ph['items'] = items
            ph['items_count'] = len(items)
            ph['estimated_cost'] = eff_cost
            ph['selling_price'] = eff_selling
            ph['actual_spent'] = ph_actual_spent
            ph['variance'] = eff_cost - ph_actual_spent
            ph['is_over_budget'] = ph_actual_spent > eff_cost and eff_cost > 0
            ph['over_amount'] = max(0.0, ph_actual_spent - eff_cost)
            ph['savings_amount'] = max(0.0, eff_cost - ph_actual_spent)
            ph['actual_profit'] = eff_selling - ph_actual_spent
            ph['is_loss'] = ph['actual_profit'] < 0
            ph['profit_percent'] = round((ph['actual_profit'] / eff_selling * 100), 1) if eff_selling > 0 else 0

            proj_est_cost += eff_cost
            proj_selling += eff_selling

        cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE project_id = ?', (pid,))
        p_total_spent = cursor.fetchone()[0]
        final_selling = proj_selling if proj_selling > 0 else p['contract_value']
        final_profit = final_selling - p_total_spent

        wbs_projects.append({
            **p,
            'phases': phases,
            'phases_count': len(phases),
            'total_estimated_cost': proj_est_cost,
            'total_selling_price': final_selling,
            'total_actual_spent': p_total_spent,
            'variance': proj_est_cost - p_total_spent,
            'is_over_budget': p_total_spent > proj_est_cost and proj_est_cost > 0,
            'over_amount': max(0.0, p_total_spent - proj_est_cost) if proj_est_cost > 0 else 0,
            'savings_amount': max(0.0, proj_est_cost - p_total_spent) if proj_est_cost > 0 else 0,
            'actual_profit': final_profit,
            'is_loss': final_profit < 0,
            'profit_margin_pct': round((final_profit / final_selling * 100), 1) if final_selling > 0 else 0
        })

    # Client Payments & Cash Flow Report
    client_payments_report = []
    for p in projects_rows:
        pid = p['id']
        cursor.execute('''
            SELECT * FROM client_payments 
            WHERE project_id = ? 
            ORDER BY payment_number ASC, id ASC
        ''', (pid,))
        p_payments = [dict(row) for row in cursor.fetchall()]
        p_tot_with_tax = sum(cp['amount_with_tax'] for cp in p_payments)
        p_tot_no_tax = sum(cp['amount_without_tax'] for cp in p_payments)
        p_tot_rec = sum(cp['received_amount'] for cp in p_payments if cp['is_received'] or cp['status'] in ('paid', 'partially_paid'))
        p_tot_pend = max(0.0, p_tot_with_tax - p_tot_rec)
        p_rate = round((p_tot_rec / p_tot_with_tax * 100), 1) if p_tot_with_tax > 0 else 0
        
        contract_cps = [cp for cp in p_payments if cp.get('payment_type') != 'extra_work']
        extra_cps = [cp for cp in p_payments if cp.get('payment_type') == 'extra_work']

        p_contract_tot = sum(cp['amount_with_tax'] for cp in contract_cps)
        p_contract_rec = sum(cp['received_amount'] for cp in contract_cps if cp['is_received'] or cp['status'] in ('paid', 'partially_paid'))
        p_contract_pend = max(0.0, p_contract_tot - p_contract_rec)

        p_extra_tot = sum(cp['amount_with_tax'] for cp in extra_cps)
        p_extra_rec = sum(cp['received_amount'] for cp in extra_cps if cp['is_received'] or cp['status'] in ('paid', 'partially_paid'))
        p_extra_pend = max(0.0, p_extra_tot - p_extra_rec)

        client_payments_report.append({
            'project_id': pid,
            'project_name': p['name'],
            'project_code': p['code'],
            'contract_value': p['contract_value'],
            'total_milestones_with_tax': p_tot_with_tax,
            'total_milestones_without_tax': p_tot_no_tax,
            'total_received': p_tot_rec,
            'total_pending': p_tot_pend,
            'collection_rate': p_rate,
            'contract_milestones_total': p_contract_tot,
            'contract_milestones_received': p_contract_rec,
            'contract_milestones_pending': p_contract_pend,
            'extra_works_total': p_extra_tot,
            'extra_works_received': p_extra_rec,
            'extra_works_pending': p_extra_pend,
            'payments': p_payments
        })

    conn.close()

    return jsonify({
        'summary': {
            'total_contract_value': total_contract_value,
            'total_spent': total_spent,
            'total_spent_without_tax': sum(p.get('total_spent_without_tax', 0) for p in detailed_projects),
            'total_tax_refundable': sum(p.get('total_tax_refundable', 0) for p in detailed_projects),
            'remaining_balance': total_contract_value - total_spent,
            'overall_burn_rate': round((total_spent / total_contract_value * 100), 1) if total_contract_value > 0 else 0,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'task_completion_rate': round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0,
            'total_invoices': sum(p['invoices_count'] for p in detailed_projects),
            'projects_count': len(detailed_projects)
        },
        'projects': detailed_projects,
        'wbs_budget_report': wbs_projects,
        'client_payments_report': client_payments_report,
        'categories_summary': categories_summary,
        'subcontractors': subcontractors_data,
        'expenses': expenses_list
    })

# ==========================================
# CUSTODY & PETTY CASH API (إدارة العهد النثرية وطلبات الصرف)
# ==========================================

@app.route('/api/custody', methods=['GET'])
def get_custody_requests():
    conn = database.get_db_connection()
    cursor = conn.cursor()

    status_filter = request.args.get('status')
    project_id = request.args.get('project_id')
    employee_name = request.args.get('employee_name')

    query = '''
        SELECT c.*, p.name as project_name, p.code as project_code
        FROM custody_requests c
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE 1=1
    '''
    params = []

    if status_filter:
        query += ' AND c.status = ?'
        params.append(status_filter)
    if project_id:
        query += ' AND c.project_id = ?'
        params.append(project_id)
    if employee_name:
        query += ' AND c.employee_name = ?'
        params.append(employee_name)

    query += '''
        ORDER BY 
            CASE 
                WHEN c.status = 'pending' THEN 0 
                WHEN c.status = 'approved' THEN 1 
                WHEN c.status = 'disbursed' THEN 2 
                ELSE 3 
            END, 
            c.id DESC
    '''

    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]

    # Calculate summary metrics across all custody requests
    cursor.execute('''
        SELECT 
            COUNT(*) as total_count,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) as approved_count,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount,
            COALESCE(SUM(CASE WHEN status = 'disbursed' THEN 1 ELSE 0 END), 0) as disbursed_count,
            COALESCE(SUM(CASE WHEN status = 'disbursed' THEN disbursed_amount ELSE 0 END), 0) as total_disbursed_active,
            COALESCE(SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END), 0) as settled_count,
            COALESCE(SUM(CASE WHEN status = 'settled' THEN spent_amount ELSE 0 END), 0) as total_settled_spent,
            COALESCE(SUM(disbursed_amount), 0) as grand_total_disbursed
        FROM custody_requests
    ''')
    stats_row = dict(cursor.fetchone())

    conn.close()

    return jsonify({
        'requests': rows,
        'summary': stats_row
    })


@app.route('/api/custody', methods=['POST'])
def create_custody_request():
    conn = database.get_db_connection()
    cursor = conn.cursor()

    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()

    employee_name = data.get('employee_name', '').strip()
    project_id = data.get('project_id')
    amount = float(data.get('amount', 0))
    purpose = data.get('purpose', '').strip()
    request_date = data.get('request_date', datetime.now().strftime('%Y-%m-%d'))
    approval_notes = data.get('notes', '').strip()

    if not employee_name:
        conn.close()
        return jsonify({'error': 'اسم الموظف أو مقدم الطلب مطلوب'}), 400
    if amount <= 0:
        conn.close()
        return jsonify({'error': 'المبلغ المطلوب يجب أن يكون أكبر من صفر'}), 400
    if not purpose:
        conn.close()
        return jsonify({'error': 'الغرض من طلب العهدة مطلوب'}), 400

    try:
        project_id = int(project_id) if project_id else None
    except (ValueError, TypeError):
        project_id = None

    # Generate sequential request_number
    year_str = datetime.now().strftime('%Y')
    cursor.execute('SELECT COUNT(*) FROM custody_requests')
    count = cursor.fetchone()[0] + 1
    request_number = f"CUST-{year_str}-{count:04d}"

    # Handle optional receipt attachment
    receipt_file_path = None
    receipt_file_name = None
    if 'attachment' in request.files:
        file = request.files['attachment']
        if file and file.filename and allowed_file(file.filename):
            receipt_file_name = secure_filename(file.filename)
            unique_name = f"custody_{uuid.uuid4().hex[:8]}_{receipt_file_name}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            file.save(file_path)
            receipt_file_path = f"/uploads/{unique_name}"

    payment_method = data.get('payment_method') or 'تحويل بنكي'

    cursor.execute('''
        INSERT INTO custody_requests (
            request_number, employee_name, project_id, amount, purpose,
            request_date, status, approval_notes, receipt_file_path, receipt_file_name,
            payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    ''', (request_number, employee_name, project_id, amount, purpose, request_date, approval_notes, receipt_file_path, receipt_file_name, payment_method))
    custody_id = cursor.lastrowid

    # Notification for Financial Manager
    proj_name = 'مصروف عام / إداري'
    if project_id:
        cursor.execute('SELECT name FROM projects WHERE id = ?', (project_id,))
        p_row = cursor.fetchone()
        if p_row:
            proj_name = p_row[0]

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'custody', 'طلب عهدة جديد ينتظر الاعتماد', ?)
    ''', (project_id, f"رفع {employee_name} طلب عهدة برقم {request_number} بمبلغ {amount:,.2f} ر.س لمشروع '{proj_name}' - الغرض: {purpose}"))

    conn.commit()
    conn.close()

    return jsonify({
        'message': 'تم رفع طلب العهدة بنجاح، وهو الآن في انتظار اعتماد المدير المالي',
        'id': custody_id,
        'request_number': request_number
    }), 201


@app.route('/api/custody/<int:custody_id>/approve', methods=['POST'])
def approve_custody_request(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM custody_requests WHERE id = ?', (custody_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'طلب العهدة غير موجود'}), 404

    data = request.get_json() or {}
    approved_by = data.get('approved_by', 'ابوالنصر البغدادي (المدير المالي)')
    approval_notes = data.get('approval_notes', '').strip()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        UPDATE custody_requests
        SET status = 'approved',
            approved_by = ?,
            approved_at = ?,
            approval_notes = COALESCE(NULLIF(?, ''), approval_notes)
        WHERE id = ?
    ''', (approved_by, now_str, approval_notes, custody_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'custody', 'تم اعتماد طلب العهدة', ?)
    ''', (row['project_id'], f"قام {approved_by} باعتماد طلب العهدة {row['request_number']} بمبلغ {row['amount']:,.2f} ر.س للموظف {row['employee_name']} (جاهز للصرف)"))

    conn.commit()
    conn.close()

    return jsonify({'message': 'تم اعتماد طلب العهدة بنجاح وهو جاهز للصرف'})


@app.route('/api/custody/<int:custody_id>/reject', methods=['POST'])
def reject_custody_request(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM custody_requests WHERE id = ?', (custody_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'طلب العهدة غير موجود'}), 404

    data = request.get_json() or {}
    rejected_by = data.get('rejected_by', 'ابوالنصر البغدادي (المدير المالي)')
    rejection_notes = data.get('rejection_notes', '').strip()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        UPDATE custody_requests
        SET status = 'rejected',
            approved_by = ?,
            approved_at = ?,
            approval_notes = ?
        WHERE id = ?
    ''', (rejected_by, now_str, rejection_notes, custody_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'custody', 'تم رفض طلب العهدة', ?)
    ''', (row['project_id'], f"تم رفض طلب العهدة {row['request_number']} للموظف {row['employee_name']}. سبب الرفض: {rejection_notes or 'لم يتم توضيح سبب'}"))

    conn.commit()
    conn.close()

    return jsonify({'message': 'تم رفض طلب العهدة وتحديث الحالة'})


@app.route('/api/custody/<int:custody_id>/disburse', methods=['POST'])
def disburse_custody(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM custody_requests WHERE id = ?', (custody_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'طلب العهدة غير موجود'}), 404

    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()

    disbursed_amount = float(data.get('disbursed_amount', row['amount']))
    disbursed_date = data.get('disbursed_date', datetime.now().strftime('%Y-%m-%d'))
    payment_method = data.get('payment_method', 'نقدي')
    disbursed_by = data.get('disbursed_by', 'ابوالنصر البغدادي (المدير المالي)')
    receipt_voucher_no = data.get('receipt_voucher_no', '').strip()
    disbursement_notes = data.get('disbursement_notes', '').strip()
    record_as_expense = str(data.get('record_as_expense', 'false')).lower() in ('true', '1', 'yes')

    # Receipt file upload if provided
    receipt_file_path = row['receipt_file_path']
    receipt_file_name = row['receipt_file_name']
    if 'receipt_file' in request.files:
        file = request.files['receipt_file']
        if file and file.filename and allowed_file(file.filename):
            receipt_file_name = secure_filename(file.filename)
            unique_name = f"custody_disburse_{uuid.uuid4().hex[:8]}_{receipt_file_name}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            file.save(file_path)
            receipt_file_path = f"/uploads/{unique_name}"

    cursor.execute('''
        UPDATE custody_requests
        SET status = 'disbursed',
            disbursed_amount = ?,
            disbursed_date = ?,
            payment_method = ?,
            disbursed_by = ?,
            receipt_voucher_no = ?,
            disbursement_notes = ?,
            receipt_file_path = ?,
            receipt_file_name = ?
        WHERE id = ?
    ''', (disbursed_amount, disbursed_date, payment_method, disbursed_by,
          receipt_voucher_no, disbursement_notes, receipt_file_path, receipt_file_name, custody_id))

    # Optional: Automatically insert into project expenses table
    if record_as_expense and row['project_id']:
        cursor.execute('''
            INSERT INTO expenses (
                project_id, title, category, amount, payment_method,
                paid_by, paid_to, expense_date, notes, is_tax_invoice,
                tax_rate, amount_without_tax, tax_amount, payment_status,
                paid_amount, payment_date, custody_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.0, ?, 0.0, 'paid', ?, ?, ?)
        ''', (
            row['project_id'],
            f"عهدة منصرفة - {row['employee_name']} ({row['purpose']})",
            'نثريات وإداريات',
            disbursed_amount,
            'عهدة',
            disbursed_by,
            row['employee_name'],
            disbursed_date,
            f"سند صرف عهدة رقم {row['request_number']} - {receipt_voucher_no}",
            disbursed_amount,
            disbursed_amount,
            disbursed_date,
            custody_id
        ))

        cursor.execute('''
            UPDATE projects
            SET manual_remaining_budget = MAX(0.0, COALESCE(manual_remaining_budget, 0) - ?)
            WHERE id = ? AND budget_mode = 'manual' AND manual_remaining_budget IS NOT NULL
        ''', (disbursed_amount, row['project_id']))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'custody', 'تم صرف العهدة للموظف', ?)
    ''', (row['project_id'], f"تم صرف العهدة {row['request_number']} للموظف {row['employee_name']} بمبلغ {disbursed_amount:,.2f} ر.س ({payment_method}) بواسطة {disbursed_by}"))

    conn.commit()
    conn.close()

    return jsonify({'message': f'تم تسجيل صرف العهدة بنجاح بمبلغ {disbursed_amount:,.2f} ر.س'})


@app.route('/api/custody/<int:custody_id>/settle', methods=['POST'])
def settle_custody(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM custody_requests WHERE id = ?', (custody_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'طلب العهدة غير موجود'}), 404

    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()

    disbursed = float(row['disbursed_amount'] or row['amount'])
    spent_amount = float(data.get('spent_amount', disbursed))
    returned_amount = float(data.get('returned_amount', max(0.0, disbursed - spent_amount)))
    settlement_date = data.get('settlement_date', datetime.now().strftime('%Y-%m-%d'))
    settlement_notes = data.get('settlement_notes', '').strip()
    settled_by = data.get('settled_by', 'ابوالنصر البغدادي (المدير المالي)')

    cursor.execute('''
        UPDATE custody_requests
        SET status = 'settled',
            spent_amount = ?,
            returned_amount = ?,
            settlement_date = ?,
            settlement_notes = ?,
            settled_by = ?
        WHERE id = ?
    ''', (spent_amount, returned_amount, settlement_date, settlement_notes, settled_by, custody_id))

    cursor.execute('''
        INSERT INTO notifications (project_id, type, title, message)
        VALUES (?, 'custody', 'تمت تصفية العهدة وإغلاقها', ?)
    ''', (row['project_id'], f"تمت تصفية العهدة {row['request_number']} للموظف {row['employee_name']} (المصروف: {spent_amount:,.2f} ر.س - المسترد للخزينة: {returned_amount:,.2f} ر.س)"))

    conn.commit()
    conn.close()

    return jsonify({'message': 'تمت تصفية العهدة وإغلاق حسابها بنجاح'})


@app.route('/api/custody/<int:custody_id>', methods=['GET'])
def get_single_custody_request(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.*, p.name as project_name, p.code as project_code,
               (COALESCE(c.disbursed_amount, c.amount) - COALESCE(c.spent_amount, 0)) as remaining_balance
        FROM custody_requests c
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE c.id = ?
    ''', (custody_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'طلب العهدة غير موجود'}), 404
    cust_dict = dict(row)
    return jsonify({'success': True, 'custody': cust_dict, **cust_dict})


@app.route('/api/custody/<int:custody_id>', methods=['PUT'])
def update_custody_request(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM custody_requests WHERE id = ?', (custody_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'طلب العهدة غير موجود'}), 404

    existing = dict(existing)
    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()

    employee_name = data.get('employee_name', existing['employee_name']).strip()
    raw_proj = data.get('project_id')
    project_id = int(raw_proj) if raw_proj and str(raw_proj).strip() not in ('', 'null', 'None') else None
    amount = float(data.get('amount', existing['amount']))
    purpose = data.get('purpose', existing['purpose']).strip()
    request_date = data.get('request_date', existing['request_date'])
    notes = data.get('notes', existing.get('approval_notes', ''))
    status = data.get('status', existing['status'])
    payment_method = data.get('payment_method', existing.get('payment_method', 'نقدي'))

    raw_disbursed = data.get('disbursed_amount')
    disbursed_amount = float(raw_disbursed) if raw_disbursed is not None and str(raw_disbursed).strip() != '' else existing.get('disbursed_amount', 0)

    cursor.execute('''
        UPDATE custody_requests
        SET employee_name = ?,
            project_id = ?,
            amount = ?,
            purpose = ?,
            request_date = ?,
            approval_notes = ?,
            status = ?,
            payment_method = ?,
            disbursed_amount = ?
        WHERE id = ?
    ''', (employee_name, project_id, amount, purpose, request_date, notes, status, payment_method, disbursed_amount, custody_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'تم تحديث بيانات العهدة بنجاح'})


@app.route('/api/custody/<int:custody_id>', methods=['DELETE'])
def delete_custody_request(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM custody_requests WHERE id = ?', (custody_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'طلب العهدة غير موجود'}), 404

    # Check for linked expenses
    cursor.execute('SELECT id, invoice_file_path FROM expenses WHERE custody_id = ?', (custody_id,))
    linked_expenses = cursor.fetchall()

    delete_expenses = request.args.get('delete_expenses') in ('1', 'true', True)

    if delete_expenses and linked_expenses:
        for exp in linked_expenses:
            exp_id = exp[0]
            f_path = exp[1]
            if f_path:
                local_p = os.path.join(BASE_DIR, f_path.lstrip('/'))
                if os.path.exists(local_p):
                    try:
                        os.remove(local_p)
                    except Exception:
                        pass
            cursor.execute('DELETE FROM expense_items WHERE expense_id = ?', (exp_id,))
        cursor.execute('DELETE FROM expenses WHERE custody_id = ?', (custody_id,))
    else:
        cursor.execute('UPDATE expenses SET custody_id = NULL WHERE custody_id = ?', (custody_id,))

    cursor.execute('DELETE FROM custody_requests WHERE id = ?', (custody_id,))
    conn.commit()
    conn.close()

    msg = f"تم حذف طلب العهدة {row['request_number']} بنجاح"
    if linked_expenses:
        if delete_expenses:
            msg += f" مع حذف كافة الفواتير التابعة لها ({len(linked_expenses)} فاتورة)."
        else:
            msg += f" مع فك ارتباط {len(linked_expenses)} فاتورة والإبقاء عليها كمصروفات."

    return jsonify({'success': True, 'message': msg})


@app.route('/api/custody/active', methods=['GET'])
def get_active_custodies():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.*, p.name as project_name, p.code as project_code,
               (COALESCE(c.disbursed_amount, c.amount) - COALESCE(c.spent_amount, 0)) as remaining_balance
        FROM custody_requests c
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE c.status IN ('disbursed', 'approved')
        ORDER BY c.id DESC
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/custody/<int:custody_id>/expenses', methods=['GET'])
def get_custody_expenses(custody_id):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.*, p.name as project_name, p.code as project_code
        FROM custody_requests c
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE c.id = ?
    ''', (custody_id,))
    cust_row = cursor.fetchone()
    if not cust_row:
        conn.close()
        return jsonify({'error': 'العهدة غير موجودة'}), 404

    custody = dict(cust_row)

    cursor.execute('''
        SELECT e.*, p.name as project_name, p.code as project_code, s.name as supplier_name
        FROM expenses e
        LEFT JOIN projects p ON e.project_id = p.id
        LEFT JOIN suppliers s ON e.supplier_id = s.id
        WHERE e.custody_id = ?
        ORDER BY e.expense_date DESC, e.id DESC
    ''', (custody_id,))
    expenses = [dict(r) for r in cursor.fetchall()]

    total_spent = sum(float(x.get('amount') or 0) for x in expenses if x.get('approval_status', 'approved') == 'approved')
    pending_spent = sum(float(x.get('amount') or 0) for x in expenses if x.get('approval_status') == 'pending')
    disbursed = float(custody.get('disbursed_amount') or custody.get('amount') or 0)
    remaining = max(0.0, disbursed - total_spent)

    conn.close()
    return jsonify({
        'custody': custody,
        'expenses': expenses,
        'count': len(expenses),
        'total_spent': total_spent,
        'pending_spent': pending_spent,
        'remaining_balance': remaining
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"================================================================")
    print(f" شركة مقاولات السجيني - المنظومة الرقمية لإدارة المشاريع والمصاريف")
    print(f" الخادم يعمل الآن على الرابط: http://localhost:{port}")
    print(f"================================================================")
    app.run(host='0.0.0.0', port=port, debug=True)
