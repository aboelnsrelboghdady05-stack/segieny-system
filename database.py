import sqlite3
import os
from datetime import datetime, date
import turso_db

TURSO_DATABASE_URL = os.environ.get('TURSO_DATABASE_URL', 'https://sejiny-abuelnasr.aws-eu-west-1.turso.io')
TURSO_AUTH_TOKEN = os.environ.get('TURSO_AUTH_TOKEN', 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIzNjYyMDgsImlkIjoiMDFhMTUxNTUtOGMwMS03NmMzLWI4NDYtNTY4Yzc2MGZkZmZmIiwia2lkIjoiVmRIVzNoM2RzQklGODdDUlFMaVBXU3Q5TlV3eThGVHUyUjhMUER2bExFTSIsInJpZCI6ImZjYzMxMjM4LWM4NjktNGFhNy04YjMxLWY4NWJiMDFmOGRkOSJ9.CtHhtaup_cm0wKMGqMLDkWQ9XyuQzL8rTPfw2EfR84tITwK0iXCv4C4IXXrlxm4aa3NV49yFcRYs-TWQMGPtCQ')

DB_PATH = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), 'segieny_contracting.db'))
os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)

def get_db_connection():
    if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN:
        return turso_db.connect(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Projects table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        client_name TEXT NOT NULL,
        location TEXT NOT NULL,
        contract_value REAL NOT NULL DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress', -- planning, in_progress, delayed, completed
        progress_percent INTEGER NOT NULL DEFAULT 0,
        manager_name TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Project Phases table (مراحل المشروع)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS project_phases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        order_num INTEGER DEFAULT 1,
        weight_percent REAL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        progress_percent REAL DEFAULT 0,
        status TEXT DEFAULT 'in_progress',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    ''')

    # Phase Items table (بنود كل مرحلة - عند اكتمال البنود تكتمل المرحلة)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS phase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phase_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        item_code TEXT,
        title TEXT NOT NULL,
        unit TEXT DEFAULT 'مقطوعية',
        quantity REAL DEFAULT 1,
        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        progress_percent REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, done
        assigned_to TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    ''')

    # Tasks table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        phase_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
        status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, review, done
        progress_percent INTEGER NOT NULL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        start_date TEXT,
        due_date TEXT,
        completion_notes TEXT,
        created_by TEXT,
        is_approved INTEGER DEFAULT 0,
        approved_by TEXT,
        approved_at TIMESTAMP,
        approval_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
    )
    ''')

    # Ensure schema migrations if tables previously existed
    cursor.execute('PRAGMA table_info(tasks)')
    task_cols = [r[1] for r in cursor.fetchall()]
    if 'phase_id' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN phase_id INTEGER REFERENCES project_phases(id) ON DELETE SET NULL')
    if 'cost_price' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN cost_price REAL DEFAULT 0')
    if 'selling_price' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN selling_price REAL DEFAULT 0')
    if 'created_by' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN created_by TEXT')
    if 'is_approved' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN is_approved INTEGER DEFAULT 0')
    if 'approved_by' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN approved_by TEXT')
    if 'approved_at' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN approved_at TIMESTAMP')
    if 'approval_notes' not in task_cols:
        cursor.execute('ALTER TABLE tasks ADD COLUMN approval_notes TEXT')

    cursor.execute('PRAGMA table_info(phase_items)')
    item_cols = [r[1] for r in cursor.fetchall()]
    if 'unit_cost' not in item_cols:
        cursor.execute('ALTER TABLE phase_items ADD COLUMN unit_cost REAL DEFAULT 0')
    if 'unit_selling' not in item_cols:
        cursor.execute('ALTER TABLE phase_items ADD COLUMN unit_selling REAL DEFAULT 0')

    # Projects budget mode migration (boq vs manual)
    cursor.execute('PRAGMA table_info(projects)')
    proj_cols = [r[1] for r in cursor.fetchall()]
    if 'budget_mode' not in proj_cols:
        cursor.execute("ALTER TABLE projects ADD COLUMN budget_mode TEXT DEFAULT 'boq'")
    if 'manual_remaining_budget' not in proj_cols:
        cursor.execute("ALTER TABLE projects ADD COLUMN manual_remaining_budget REAL")

    # Expenses table (with invoice file upload & phase/item linking)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        phase_id INTEGER,
        item_id INTEGER,
        title TEXT NOT NULL,
        category TEXT NOT NULL, -- مواد بناء, عمالة ومقاولين باطن, معدات وآليات, محروقات ونقل, تراخيص وتأمينات, نثريات وإداريات
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'نقدي', -- نقدي, تحويل بنكي, شيك, عهدة
        paid_by TEXT,
        paid_to TEXT,
        expense_date TEXT NOT NULL,
        invoice_file_path TEXT,
        invoice_file_name TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL,
        FOREIGN KEY (item_id) REFERENCES phase_items(id) ON DELETE SET NULL
    )
    ''')

    cursor.execute('PRAGMA table_info(expenses)')
    exp_cols = [r[1] for r in cursor.fetchall()]
    if 'phase_id' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN phase_id INTEGER REFERENCES project_phases(id) ON DELETE SET NULL')
    if 'item_id' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN item_id INTEGER REFERENCES phase_items(id) ON DELETE SET NULL')
    if 'is_tax_invoice' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN is_tax_invoice INTEGER DEFAULT 0')
    if 'tax_rate' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN tax_rate REAL DEFAULT 0.15')
    if 'amount_without_tax' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN amount_without_tax REAL DEFAULT 0')
    if 'tax_amount' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN tax_amount REAL DEFAULT 0')
    if 'supplier_id' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL')
    if 'quotation_id' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN quotation_id INTEGER REFERENCES supplier_quotations(id) ON DELETE SET NULL')
    if 'quotation_item_id' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN quotation_item_id INTEGER REFERENCES supplier_quotation_items(id) ON DELETE SET NULL')
    if 'item_quantity' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN item_quantity REAL DEFAULT 1')
    if 'unit_price' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN unit_price REAL DEFAULT 0')
    if 'quoted_unit_price' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN quoted_unit_price REAL DEFAULT 0')
    if 'price_variance' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN price_variance REAL DEFAULT 0')
    if 'total_variance' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN total_variance REAL DEFAULT 0')
    if 'has_price_increase' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN has_price_increase INTEGER DEFAULT 0')
    if 'items_json' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN items_json TEXT')
    if 'payment_status' not in exp_cols:
        cursor.execute("ALTER TABLE expenses ADD COLUMN payment_status TEXT DEFAULT 'paid'")
    if 'payment_date' not in exp_cols:
        cursor.execute("ALTER TABLE expenses ADD COLUMN payment_date TEXT DEFAULT NULL")
    if 'approval_status' not in exp_cols:
        try: cursor.execute("ALTER TABLE expenses ADD COLUMN approval_status TEXT DEFAULT 'approved'")
        except: pass
    if 'approved_by' not in exp_cols:
        try: cursor.execute("ALTER TABLE expenses ADD COLUMN approved_by TEXT")
        except: pass
    if 'approved_at' not in exp_cols:
        try: cursor.execute("ALTER TABLE expenses ADD COLUMN approved_at TEXT")
        except: pass
    if 'approval_notes' not in exp_cols:
        try: cursor.execute("ALTER TABLE expenses ADD COLUMN approval_notes TEXT")
        except: pass
    if 'created_by' not in exp_cols:
        try: cursor.execute("ALTER TABLE expenses ADD COLUMN created_by TEXT")
        except: pass
    cursor.execute("UPDATE expenses SET approval_status = 'approved', approved_by = COALESCE(approved_by, 'ابوالنصر البغدادي (المدير المالي)') WHERE approval_status IS NULL OR approval_status = ''")
    cursor.execute("UPDATE expenses SET paid_amount = amount WHERE paid_amount IS NULL AND (payment_status = 'paid' OR payment_status IS NULL)")
    cursor.execute("UPDATE expenses SET paid_amount = 0.0 WHERE payment_status = 'unpaid' AND (paid_amount > 0 OR paid_amount IS NULL) AND NOT EXISTS (SELECT 1 FROM supplier_payments WHERE supplier_payments.expense_id = expenses.id)")
    cursor.execute("UPDATE expenses SET payment_date = expense_date WHERE payment_date IS NULL AND payment_status = 'paid'")

    # Ensure all expenses with quotation_id or matching supplier name are properly linked to supplier_id
    cursor.execute('''
        UPDATE expenses 
        SET supplier_id = (SELECT supplier_id FROM supplier_quotations WHERE supplier_quotations.id = expenses.quotation_id)
        WHERE supplier_id IS NULL AND quotation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM supplier_quotations WHERE supplier_quotations.id = expenses.quotation_id AND supplier_quotations.supplier_id IS NOT NULL
        )
    ''')
    cursor.execute('''
        UPDATE expenses
        SET supplier_id = (SELECT id FROM suppliers WHERE TRIM(suppliers.name) = TRIM(expenses.paid_to))
        WHERE supplier_id IS NULL AND paid_to IS NOT NULL AND TRIM(paid_to) != '' AND EXISTS (
            SELECT 1 FROM suppliers WHERE TRIM(suppliers.name) = TRIM(expenses.paid_to)
        )
    ''')

    # Expense Line Items table (بنود وأصناف الفاتورة المتعددة)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS expense_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        quotation_item_id INTEGER,
        item_name TEXT NOT NULL,
        unit TEXT DEFAULT 'طن',
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0,
        quoted_unit_price REAL DEFAULT 0,
        price_variance REAL DEFAULT 0,
        total_variance REAL DEFAULT 0,
        has_price_increase INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (quotation_item_id) REFERENCES supplier_quotation_items(id) ON DELETE SET NULL
    )
    ''')

    # Suppliers & Vendors (الموردين وموردي مواد البناء)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL, -- حديد تسليح, خرسانة جاهزة, بلك وإسمنت, سباكة وصحي, كهرباء وإنارة, عزل ومواد كيميائية, تشطيبات وديكور, خشب ونجارة, عام
        phone TEXT,
        tax_number TEXT,
        contact_person TEXT,
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Supplier Quotations / Supply Agreements (عروض أسعار واتفاقيات التوريد)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS supplier_quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        project_id INTEGER,
        quotation_number TEXT,
        quotation_date TEXT,
        title TEXT NOT NULL,
        tax_type TEXT DEFAULT 'exclusive', -- exclusive (+15%), inclusive (15% in price), zero (0%)
        tax_rate REAL DEFAULT 0.15,
        amount_without_tax REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'active', -- active, completed, cancelled
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
    ''')

    # Migration for supplier_quotations tax columns
    cursor.execute("PRAGMA table_info(supplier_quotations)")
    sq_cols = [c[1] for c in cursor.fetchall()]
    if 'tax_type' not in sq_cols:
        cursor.execute("ALTER TABLE supplier_quotations ADD COLUMN tax_type TEXT DEFAULT 'exclusive'")
    if 'tax_rate' not in sq_cols:
        cursor.execute("ALTER TABLE supplier_quotations ADD COLUMN tax_rate REAL DEFAULT 0.15")
    if 'amount_without_tax' not in sq_cols:
        cursor.execute("ALTER TABLE supplier_quotations ADD COLUMN amount_without_tax REAL DEFAULT 0")
    if 'tax_amount' not in sq_cols:
        cursor.execute("ALTER TABLE supplier_quotations ADD COLUMN tax_amount REAL DEFAULT 0")

    # Supplier Quotation Items (بنود عرض السعر وأسعار الوحدة المتفق عليها)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS supplier_quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'طن', -- طن, م3, م2, حبة, لفة, متر, كيس, مقطوعية
        unit_price REAL NOT NULL DEFAULT 0,
        quantity REAL NOT NULL DEFAULT 1,
        total_price REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quotation_id) REFERENCES supplier_quotations(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    )
    ''')

    # Supplier Payments / Vouchers (سداد دفعات الموردين وسندات الصرف)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        project_id INTEGER,
        expense_id INTEGER,
        quotation_id INTEGER,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'تحويل بنكي',
        payment_type TEXT NOT NULL DEFAULT 'دفعة تحت الحساب',
        reference_number TEXT,
        receipt_file_path TEXT,
        receipt_file_name TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
        FOREIGN KEY (quotation_id) REFERENCES supplier_quotations(id) ON DELETE SET NULL
    )
    ''')

    # Subcontractors & Daily Laborers
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subcontractors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        name TEXT NOT NULL,
        trade TEXT NOT NULL, -- حدادة مسلحة, نجارة, خرسانات, مباني, محارة, سباكة, كهرباء, تشطيبات
        phone TEXT,
        agreed_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
    ''')

    # Subcontractor Payments / Work Certificates (مستخلصات ويوميات)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subcontractor_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subcontractor_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_type TEXT NOT NULL DEFAULT 'مستخلص', -- مستخلص, دفعة إنجاز, يوميات, سلفة
        payment_method TEXT NOT NULL DEFAULT 'نقدي',
        receipt_file_path TEXT,
        receipt_file_name TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subcontractor_id) REFERENCES subcontractors(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('PRAGMA table_info(subcontractor_payments)')
    subpay_cols = [r[1] for r in cursor.fetchall()]
    if 'payment_method' not in subpay_cols:
        cursor.execute("ALTER TABLE subcontractor_payments ADD COLUMN payment_method TEXT DEFAULT 'نقدي'")
    if 'expense_id' not in subpay_cols:
        cursor.execute("ALTER TABLE subcontractor_payments ADD COLUMN expense_id INTEGER")

    # Client Payments & Milestones (دفعات واستحقاقات العميل)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS client_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        payment_number INTEGER DEFAULT 1,
        milestone_name TEXT NOT NULL,
        percentage REAL DEFAULT 0,
        amount_with_tax REAL NOT NULL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        amount_without_tax REAL NOT NULL DEFAULT 0,
        due_date TEXT,
        received_date TEXT,
        received_amount REAL DEFAULT 0,
        is_received INTEGER DEFAULT 0, -- 0 = pending, 1 = received
        status TEXT DEFAULT 'pending', -- pending, partially_paid, paid
        payment_method TEXT DEFAULT 'تحويل بنكي', -- تحويل بنكي, شيك, نقدي
        receipt_voucher_no TEXT,
        receipt_file_path TEXT,
        receipt_file_name TEXT,
        phase_id INTEGER,
        payment_type TEXT DEFAULT 'contract', -- contract (تعاقدية), extra_work (أعمال إضافية وفروق أسعار خامات)
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
    )
    ''')

    cursor.execute('PRAGMA table_info(client_payments)')
    cp_cols = [r[1] for r in cursor.fetchall()]
    if 'payment_type' not in cp_cols:
        cursor.execute("ALTER TABLE client_payments ADD COLUMN payment_type TEXT DEFAULT 'contract'")

    cursor.execute("""
        UPDATE client_payments 
        SET payment_type = 'extra_work'
        WHERE (payment_type = 'contract' OR payment_type IS NULL) 
          AND (
            milestone_name LIKE '%تغير%' 
            OR milestone_name LIKE '%تغيير%' 
            OR milestone_name LIKE '%إضاف%' 
            OR milestone_name LIKE '%اضاف%' 
            OR milestone_name LIKE '%فروق أسعار%'
            OR milestone_name LIKE '%فرق سعر%'
            OR id IN (34, 35)
          )
    """)

    # Client Receipt Vouchers (سندات قبض دفعات العملاء - للتسديد والتوزيع التلقائي)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS client_receipt_vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        voucher_number TEXT,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'تحويل بنكي',
        received_by TEXT,
        notes TEXT,
        allocations_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    ''')

    # Project Documents & Blueprints (المخططات والتراخيص)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL, -- مخططات معمارية, مخططات إنشائية, تراخيص وعقود, تقارير هندسية, فواتير معتمدة
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        uploaded_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    ''')

    # Team Members
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL, -- مدير مشاريع, مهندس موقع, محاسب مالي, مشرف تنفيذ, مدير عام
        phone TEXT,
        email TEXT,
        status TEXT DEFAULT 'active',
        username TEXT,
        password TEXT DEFAULT '123'
    )
    ''')

    cursor.execute('PRAGMA table_info(team_members)')
    tm_cols = [r[1] for r in cursor.fetchall()]
    if 'username' not in tm_cols:
        cursor.execute('ALTER TABLE team_members ADD COLUMN username TEXT')
    if 'password' not in tm_cols:
        cursor.execute("ALTER TABLE team_members ADD COLUMN password TEXT DEFAULT '123'")
    if 'permissions' not in tm_cols:
        cursor.execute("ALTER TABLE team_members ADD COLUMN permissions TEXT DEFAULT 'all'")

    # Backfill default usernames, passwords & permissions
    cursor.execute("UPDATE team_members SET username = 'baghdadi', password = COALESCE(password, '123'), permissions = 'all' WHERE id = 1 AND (username IS NULL OR username = '' OR permissions IS NULL OR permissions = '')")
    cursor.execute("UPDATE team_members SET username = 'jihad', password = COALESCE(password, '123'), permissions = COALESCE(permissions, 'all') WHERE id = 2 AND (username IS NULL OR username = '')")
    cursor.execute("UPDATE team_members SET name = 'نواف سجيني', username = 'nawaf', email = 'nawaf@segieny.sa', password = COALESCE(password, '123'), permissions = COALESCE(permissions, 'all') WHERE id = 3 OR username = 'farouk' OR name = 'فاروق محمد'")
    cursor.execute("UPDATE team_members SET password = '123' WHERE password IS NULL OR password = ''")
    cursor.execute("UPDATE team_members SET permissions = 'all' WHERE permissions IS NULL OR permissions = ''")

    # Notifications / Alerts
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        type TEXT NOT NULL, -- task, expense, warning, info
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Internal Chat Messages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT,
        recipient_id INTEGER, -- NULL for channels
        channel_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'project', 'direct'
        project_id INTEGER, -- if channel_type == 'project'
        message TEXT NOT NULL,
        attachment_path TEXT,
        attachment_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES team_members(id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    ''')

    # Custody Requests & Petty Cash (إدارة العهد النثرية وطلبات الصرف للموظفين)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS custody_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_number TEXT UNIQUE,
        employee_name TEXT NOT NULL,
        employee_id INTEGER,
        project_id INTEGER,
        amount REAL NOT NULL,
        purpose TEXT NOT NULL,
        request_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, disbursed, settled
        approved_by TEXT,
        approved_at TIMESTAMP,
        approval_notes TEXT,
        disbursed_amount REAL DEFAULT 0,
        disbursed_date TEXT,
        payment_method TEXT DEFAULT 'نقدي', -- نقدي, تحويل بنكي, شيك
        disbursed_by TEXT,
        disbursement_notes TEXT,
        receipt_voucher_no TEXT,
        receipt_file_path TEXT,
        receipt_file_name TEXT,
        spent_amount REAL DEFAULT 0,
        returned_amount REAL DEFAULT 0,
        settlement_date TEXT,
        settlement_notes TEXT,
        settled_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (employee_id) REFERENCES team_members(id) ON DELETE SET NULL
    )
    ''')

    cursor.execute('PRAGMA table_info(expenses)')
    exp_cols = [r[1] for r in cursor.fetchall()]
    if 'custody_id' not in exp_cols:
        cursor.execute('ALTER TABLE expenses ADD COLUMN custody_id INTEGER REFERENCES custody_requests(id) ON DELETE SET NULL')

    # Expense & Payment Requests (طلبات الصرف والمصاريف للموظفين، الموردين، والمقاولين)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS expense_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_number TEXT UNIQUE,
        requester_id INTEGER,
        requester_name TEXT NOT NULL,
        project_id INTEGER,
        beneficiary_type TEXT NOT NULL DEFAULT 'عام', -- مورد, مقاول, موظف, عام
        beneficiary_id INTEGER,
        beneficiary_name TEXT NOT NULL,
        category TEXT DEFAULT 'نثريات وإداريات',
        amount REAL NOT NULL,
        purpose TEXT NOT NULL,
        priority TEXT DEFAULT 'عادي', -- عادي, عاجل, طارئ
        request_date TEXT NOT NULL,
        notes TEXT,
        attachment_path TEXT,
        attachment_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, disbursed, rejected
        approved_by TEXT,
        approved_at TIMESTAMP,
        approval_notes TEXT,
        disbursed_by TEXT,
        disbursed_at TIMESTAMP,
        disbursed_date TEXT,
        disbursed_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'تحويل بنكي', -- تحويل بنكي, نقدي, شيك
        bank_name TEXT,
        transfer_reference TEXT,
        disbursement_receipt_path TEXT,
        disbursement_receipt_name TEXT,
        disbursement_notes TEXT,
        generated_expense_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (requester_id) REFERENCES team_members(id) ON DELETE SET NULL,
        FOREIGN KEY (generated_expense_id) REFERENCES expenses(id) ON DELETE SET NULL
    )
    ''')

    if 'expense_request_id' not in exp_cols:
        try:
            cursor.execute('ALTER TABLE expenses ADD COLUMN expense_request_id INTEGER REFERENCES expense_requests(id) ON DELETE SET NULL')
        except Exception:
            pass

    # HR Tables (إدارة الموارد البشرية وشؤون الموظفين)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hr_employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_member_id INTEGER,
        name TEXT NOT NULL,
        national_id TEXT,
        nationality TEXT DEFAULT 'سعودي',
        job_title TEXT NOT NULL,
        department TEXT DEFAULT 'المشاريع الهندسية',
        project_id INTEGER,
        phone TEXT,
        email TEXT,
        join_date TEXT,
        contract_type TEXT DEFAULT 'محدد المدة',
        contract_end_date TEXT,
        iqama_expiry_date TEXT,
        insurance_expiry_date TEXT,
        passport_expiry_date TEXT,
        basic_salary REAL DEFAULT 0,
        housing_allowance REAL DEFAULT 0,
        transport_allowance REAL DEFAULT 0,
        other_allowances REAL DEFAULT 0,
        bank_name TEXT DEFAULT 'مصرف الراجحي',
        iban TEXT,
        status TEXT DEFAULT 'active',
        vacation_balance INTEGER DEFAULT 30,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hr_payrolls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month_year TEXT NOT NULL,
        total_basic REAL DEFAULT 0,
        total_allowances REAL DEFAULT 0,
        total_deductions REAL DEFAULT 0,
        total_advances REAL DEFAULT 0,
        total_net REAL DEFAULT 0,
        employees_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft', -- draft, approved, paid
        approved_by TEXT,
        payment_date TEXT,
        notes TEXT,
        created_by TEXT,
        approved_at TEXT,
        approval_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cursor.execute('PRAGMA table_info(hr_payrolls)')
    hr_payroll_cols = [r[1] for r in cursor.fetchall()]
    if 'created_by' not in hr_payroll_cols:
        try: cursor.execute('ALTER TABLE hr_payrolls ADD COLUMN created_by TEXT')
        except: pass
    if 'approved_at' not in hr_payroll_cols:
        try: cursor.execute('ALTER TABLE hr_payrolls ADD COLUMN approved_at TEXT')
        except: pass
    if 'approval_notes' not in hr_payroll_cols:
        try: cursor.execute('ALTER TABLE hr_payrolls ADD COLUMN approval_notes TEXT')
        except: pass

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hr_payroll_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payroll_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        job_title TEXT,
        basic_salary REAL DEFAULT 0,
        allowances REAL DEFAULT 0,
        overtime_amount REAL DEFAULT 0,
        bonus_amount REAL DEFAULT 0,
        deductions REAL DEFAULT 0,
        advances_deducted REAL DEFAULT 0,
        net_salary REAL NOT NULL,
        iban TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        FOREIGN KEY (payroll_id) REFERENCES hr_payrolls(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hr_leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        leave_type TEXT NOT NULL, -- سنوية, مرضية, اضطرارية, زواج, أخرى
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        days_count INTEGER NOT NULL DEFAULT 1,
        status TEXT DEFAULT 'approved', -- pending, approved, rejected
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hr_advances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        amount REAL NOT NULL,
        request_date TEXT NOT NULL,
        monthly_deduction REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL NOT NULL,
        status TEXT DEFAULT 'active', -- active, settled, pending
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
    )
    ''')

    # Cloud-persistent file storage (survives Render restarts and redeployments)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS system_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        file_data TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER DEFAULT 0,
        uploaded_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()

    # Seed initial data if empty
    cursor.execute('SELECT COUNT(*) FROM projects')
    if cursor.fetchone()[0] == 0:
        seed_demo_data(cursor)
        conn.commit()

    # Seed HR employees if empty
    cursor.execute('SELECT COUNT(*) FROM hr_employees')
    if cursor.fetchone()[0] == 0:
        seed_hr_demo_data(cursor)
        conn.commit()

    # Ensure corporate / HQ non-project account exists for G&A expenses and owner withdrawals
    cursor.execute("SELECT id FROM projects WHERE code = 'HQ-GEN'")
    if not cursor.fetchone():
        cursor.execute('''
            INSERT INTO projects (name, code, client_name, location, contract_value, start_date, end_date, status, progress_percent, manager_name, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            '🏢 الإدارة العامة ومسحوبات الشركاء (خارج المشاريع)',
            'HQ-GEN',
            'شركة السجيني للمقاولات',
            'المقر الرئيسي - الإدارة العامة',
            0.0,
            '2026-01-01',
            '2030-12-31',
            'in_progress',
            100,
            'ابوالنصر البغدادي',
            'حساب عام لتسجيل المصاريف الإدارية والعمومية وتكاليف المقر ومسحوبات صاحب الشركة والشركاء لخصمها من الكاش فلو دون التأثير على أرباح مشاريع المقاولات'
        ))
        hq_id = cursor.lastrowid
        cursor.execute('''
            INSERT INTO project_phases (project_id, name, order_num, weight_percent, cost_price, selling_price, progress_percent, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (hq_id, 'مسحوبات صاحب الشركة / الشركاء', 1, 50.0, 0.0, 0.0, 100, 'in_progress', 'مسحوبات نقدية وتوزيعات تحت الحساب للمالك أو الشركاء'))
        cursor.execute('''
            INSERT INTO project_phases (project_id, name, order_num, weight_percent, cost_price, selling_price, progress_percent, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (hq_id, 'مصاريف إدارية وعمومية وتشغيل المقر', 2, 50.0, 0.0, 0.0, 100, 'in_progress', 'إيجار المقر، فواتير الكهرباء والإنترنت، الضيافة، والقرطاسية'))
        conn.commit()

    # Company settings (e.g. opening cash balance)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS company_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    cursor.execute("INSERT OR IGNORE INTO company_settings (key, value) VALUES ('opening_cash_balance', '300000.0')")
    conn.commit()

    conn.close()

def seed_demo_data(cursor):
    # Team Members (Saudi Arabia) - The 3 Main Users
    team = [
        ('ابوالنصر البغدادي', 'المدير المالي', '0501234567', 'baghdadi@segieny.sa'),
        ('مهندس جهاد', 'مدير المشاريع', '0552345678', 'jihad@segieny.sa'),
        ('نواف سجيني', 'المدير العام', '0503334455', 'nawaf@segieny.sa'),
    ]
    cursor.executemany('INSERT INTO team_members (name, role, phone, email) VALUES (?, ?, ?, ?)', team)

    # Sample Saudi Projects
    projects = [
        (
            'مشروع برج العليا السكني الإداري',
            'PRJ-SA-2026-01',
            'شركة أصول العقارية الاستثمارية',
            'الرياض - طريق الملك فهد - حي العليا',
            14500000.0,
            '2026-01-10',
            '2026-12-30',
            'in_progress',
            65,
            'مهندس جهاد',
            'برج متكامل أرضي + 12 دور متكرر مع مواقف سفلية طبقاً لكود البناء السعودي'
        ),
        (
            'فيلا حي النرجس الفاخرة (مودرن)',
            'PRJ-SA-2026-02',
            'الشيخ فهد بن عبد الله',
            'الرياض - حي النرجس شمال طريق الملك سلمان',
            4800000.0,
            '2026-02-01',
            '2026-08-15',
            'in_progress',
            45,
            'مهندس جهاد',
            'تشطيبات VIP ديلوكس، تكييف مركزي، حمام سباحة، ولاندسكيب ذكي'
        ),
        (
            'مجمع المستودعات اللوجستية الحديثة',
            'PRJ-SA-2026-03',
            'شركة المخازن اللوجستية السعودية',
            'المنطقة الصناعية الثانية - الدمام',
            18000000.0,
            '2026-03-01',
            '2027-02-28',
            'in_progress',
            25,
            'فاروق محمد',
            'هياكل حديدية ومستودعات تبريد وأرضيات خرسانية مهبطة طبقاً لمتطلبات الدفاع المدني'
        )
    ]
    cursor.executemany('''
    INSERT INTO projects (name, code, client_name, location, contract_value, start_date, end_date, status, progress_percent, manager_name, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', projects)

    # Sample Tasks
    tasks = [
        (1, 'صب خرسانة سقف الدور السادس جاهزة C35', 'مطابقة حديد التسليح واستلام الاستشاري قبل صب الخرسانة الجاهزة المقاومة للأملاح', 'مهندس جهاد', 'urgent', 'in_progress', 75, '2026-09-25', '2026-10-02', 'تم الانتهاء من فحص الشدات والحديد وبانتظار موعد الضخ'),
        (1, 'توريد بلك بركاني عازل لأعمال المباني', 'التعاقد مع مصنع البلك لتوريد 30 ألف بلكة بركانية عازلة مطابقة لمواصفات كود البناء', 'مهندس جهاد', 'high', 'done', 100, '2026-09-20', '2026-09-24', 'تم التوريد والتخزين في موقع العمل'),
        (1, 'تأسيس شبكة الكهرباء الذكية (Smart Home)', 'تمديد مواسير EMT والعلس طبقاً للرسومات الهندسية المعتمدة من شركة الكهرباء السعودية', 'مهندس جهاد', 'medium', 'in_progress', 50, '2026-09-22', '2026-10-05', 'العمل جاري في الأدوار الإدارية'),
        (2, 'عزل مائي وحراري معتمد للأسطح وخزان المياه', 'اختبار العزل المائي بالغمر لمدة 72 ساعة والتأكد التام من عدم وجود تسريب', 'مهندس جهاد', 'high', 'in_progress', 60, '2026-09-28', '2026-10-04', 'تم فرد طبقات البولي يوريثان وجاري الاختبار'),
        (2, 'مراجعة واعتماد التدفقات المالية وتوريد الرخام', 'اعتماد العينات الرسمية والتحقق من الفواتير والاعتمادات البنكية', 'ابوالنصر البغدادي', 'medium', 'todo', 0, '2026-10-01', '2026-10-10', 'في انتظار توقيع المالك على عينة الرخام'),
        (3, 'تسوية ودك تربة أرضية المستودعات اللوجستية', 'أعمال الحفر وتوريد دفان صب بيز (Sub-base) والدك الميكانيكي', 'مهندس جهاد', 'urgent', 'done', 100, '2026-09-10', '2026-09-26', 'تم إجراء اختبار الكثافة الموقعي ونجح بنسبة 98.5%'),
        (3, 'تصنيع وتركيب الجمالونات الفولاذية (Steel Structure)', 'التعاقد مع المصنع المعتمد لتصنيع الهياكل المعدنية والبراغي عالية الإجهاد', 'فاروق محمد', 'high', 'in_progress', 30, '2026-09-15', '2026-10-25', 'تم اعتماد الرسومات التشغيلية وجاري التصنيع بالدمام')
    ]
    cursor.executemany('''
    INSERT INTO tasks (project_id, title, description, assigned_to, priority, status, progress_percent, start_date, due_date, completion_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', tasks)

    # Sample Expenses in SAR (ريال سعودي)
    expenses = [
        (1, 'توريد خرسانة جاهزة 220 متر مكعب (C35)', 'مواد بناء', 385000.0, 'تحويل بنكي', 'ابوالنصر البغدادي', 'شركة اليمامة للخرسانة الجاهزة', '2026-09-22', None, 'فاتورة_خرسانة_اليمامة_9041.pdf', 'دفعة خرسانة سقف الدور السادس'),
        (1, 'حديد تسليح سابك 35 طن (أقطار 16 و 14 مم)', 'مواد بناء', 1150000.0, 'شيك مصرفي', 'ابوالنصر البغدادي', 'شركة الراجحي للصناعات الحديدية', '2026-09-15', None, 'فاتورة_حديد_سابك_7712.pdf', 'حديد تسليح عالي المقاومة فئة 60'),
        (1, 'أجور وعمالة يوميات حدادة ونجارة', 'عمالة ومقاولين باطن', 28500.0, 'نقدي', 'مهندس جهاد', 'مؤسسة صابر للحدادة', '2026-09-28', None, 'سند_قبض_عمالة_44.jpg', 'أجور أسبوعية لمجموعات الموقع'),
        (1, 'إيجار مضخة خرسانة ورافعة برجية (Crane)', 'معدات وآليات', 24000.0, 'عهدة', 'مهندس جهاد', 'مؤسسة الزامل للمعدات الثقيلة', '2026-09-24', None, 'ايصال_ايجار_معدات_512.jpg', 'تشوين ورفع مواد للأدوار العليا'),
        (2, 'توريد مواد عزل حراري ومائي معتمدة من كود البناء', 'مواد بناء', 68000.0, 'تحويل سريع', 'ابوالنصر البغدادي', 'شركة عوازل الخليج', '2026-09-26', None, 'فاتورة_عوازل_الخليج_3301.pdf', 'لفائف ممبرين وبرايمر وبوليسترين عازل'),
        (2, 'أعمال مصنعية سباكة مدفونة وعزل حمامات', 'عمالة ومقاولين باطن', 35000.0, 'نقدي', 'مهندس جهاد', 'مؤسسة أنظمة السباكة المتقدمة', '2026-09-29', None, 'سند_صرف_سباكة_89.jpg', 'دفعة تحت الحساب لأعمال التأسيس'),
        (3, 'توريد صب بيز ودفان معتمد (150 رد تريلا)', 'مواد بناء', 245000.0, 'تحويل بنكي', 'ابوالنصر البغدادي', 'كسارات ومحاجر الشرقية', '2026-09-18', None, 'فاتورة_كسارات_الشرقية_661.pdf', 'طبقات إحلال وتأسيس أرضية المستودع'),
        (3, 'إيجار جليدر وبوبكات ومداحل 20 طن', 'معدات وآليات', 42000.0, 'نقدي', 'مهندس جهاد', 'شركة مقطورات ومعدات الدمام', '2026-09-20', None, 'سند_قبض_معدات_993.jpg', 'تسوية ودك الموقع العام')
    ]
    cursor.executemany('''
    INSERT INTO expenses (project_id, title, category, amount, payment_method, paid_by, paid_to, expense_date, invoice_file_path, invoice_file_name, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', expenses)

    # Subcontractors in Saudi Arabia
    subcontractors = [
        (1, 'مؤسسة صابر للحدادة المسلحة', 'حدادة مسلحة وتجهيز', '0501122334', 680000.0, 480000.0, 'مقاول حدادة مع العمالة والمعدات'),
        (1, 'شركة روافد نجد للشدات والخرسانة', 'نجارة وشدات معدنية', '0554433221', 590000.0, 420000.0, 'شدات نظامية حديثة لكامل البرج'),
        (2, 'مؤسسة أنظمة السباكة المتقدمة', 'سباكة وتغذية وصرف', '0567788990', 145000.0, 65000.0, 'تأسيس وتشطيب السباكة وشبكة الري الآلي'),
        (3, 'المصنع السعودي للهياكل الفولاذية', 'هياكل حديدية (Steel)', '0541122445', 4200000.0, 1350000.0, 'تصنيع وتركيب جمالونات المستودعات اللوجستية')
    ]
    cursor.executemany('''
    INSERT INTO subcontractors (project_id, name, trade, phone, agreed_amount, paid_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', subcontractors)

    # Notifications in SAR
    notifications = [
        (1, 'task', 'مهمة قاربت على الانتهاء', 'موعد صب سقف الدور السادس في برج العليا محدد له غداً، يرجى استلام فحص حديد التسليح.'),
        (1, 'expense', 'تم تسجيل مصروف جديد', 'تم قيد فاتورة خرسانة جاهزة بمبلغ 385,000 ر.س على مشروع برج العليا.'),
        (2, 'warning', 'ملاحظة الموقع', 'يرجى استكمال اختبار عزل الأسطح بفيلا النرجس وتوثيقه لدى الاستشاري.')
    ]
    cursor.executemany('''
    INSERT INTO notifications (project_id, type, title, message)
    VALUES (?, ?, ?, ?)
    ''', notifications)

    # Initial Chat Messages between the 3 users
    messages = [
        (3, 'فاروق محمد', 'المدير العام', None, 'general', None, 'السلام عليكم ورحمة الله وبركاته، تم اليوم اعتماد مستخلصات الدفعة السادسة لبرج العليا، بالتوفيق لجميع فرق العمل بالمواقع.', None, None),
        (2, 'مهندس جهاد', 'مدير المشاريع', None, 'general', None, 'وعليكم السلام يا أستاذ فاروق، تم التنسيق مع شركة اليمامة لتوريد خرسانة صبة السقف غداً الفجر بمشيئة الله.', None, None),
        (1, 'ابوالنصر البغدادي', 'المدير المالي', None, 'general', None, 'تم تحويل دفعة مقاول الحدادة صابر ومستخلصات الشدات وسندات القبض مؤرشفة بنظام الفواتير بالريال السعودي.', None, None),
        (2, 'مهندس جهاد', 'مدير المشاريع', None, 'project', 1, 'يا أستاذ فاروق ويا أستاذ أبوالنصر، الاستشاري اعتمد استلام حديد التسليح لسقف الدور السادس والموقع جاهز للصب.', None, None),
        (1, 'ابوالنصر البغدادي', 'المدير المالي', None, 'project', 1, 'ممتاز، تم قيد الاعتماد المالي للخرسانة الجاهزة وضخ الدفعة فور انتهاء الصب واعتماد المهندس جهاد.', None, None),
        (3, 'فاروق محمد', 'المدير العام', None, 'project', 3, 'بارك الله فيكم جميعاً، نرجو الاستمرار بنفس الكفاءة ومتابعة نسب الإنجاز أولاً بأول.', None, None)
    ]
    cursor.executemany('''
    INSERT INTO messages (sender_id, sender_name, sender_role, recipient_id, channel_type, project_id, message, attachment_path, attachment_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', messages)

def seed_hr_demo_data(cursor):
    # Initial Employees for Saudi Contracting HR
    employees = [
        (1, 'ابوالنصر البغدادي', '1098765432', 'سعودي', 'المدير المالي', 'الإدارة المالية', None, '0501234567', 'baghdadi@segieny.sa', '2022-01-01', 'غير محدد المدة', '2028-12-31', '2028-12-31', '2027-06-30', '2029-05-15', 18000.0, 4500.0, 1500.0, 1000.0, 'مصرف الراجحي', 'SA0380000000123456789012', 'active', 30, 'المشرف المالي العام على كافة حسابات الشركة والمشاريع'),
        (2, 'مهندس جهاد', '2233445566', 'أردني', 'مدير المشاريع', 'إدارة المشاريع', 1, '0552345678', 'jihad@segieny.sa', '2022-03-15', 'محدد المدة', '2027-03-14', '2027-04-10', '2027-01-20', '2028-02-18', 16000.0, 4000.0, 1500.0, 1000.0, 'البنك الأهلي السعودي', 'SA4410000000987654321098', 'active', 28, 'إدارة ومتابعة كافة المواقع والمشاريع ونسب الإنجاز'),
        (3, 'نواف سجيني', '1012345678', 'سعودي', 'المدير العام', 'الإدارة العليا', None, '0503334455', 'nawaf@segieny.sa', '2020-01-01', 'غير محدد المدة', '2030-12-31', '2030-12-31', '2027-12-31', '2029-10-10', 25000.0, 6000.0, 2000.0, 2000.0, 'بنك الرياض', 'SA5520000000554433221100', 'active', 30, 'المدير التنفيذي العام لمجموعة السجيني للمقاولات'),
        (None, 'م. فادي القحطاني', '1088776655', 'سعودي', 'مهندس موقع أول', 'المشاريع الهندسية', 1, '0569871234', 'fadi@segieny.sa', '2023-06-01', 'محدد المدة', '2027-05-31', '2026-11-20', '2026-11-15', '2028-04-12', 12000.0, 3000.0, 1200.0, 500.0, 'مصرف الإنماء', 'SA1205000000112233445566', 'active', 21, 'مهندس مقيم بمشروع برج العليا السكني'),
        (None, 'م. طارق الزهراني', '1077665544', 'سعودي', 'مهندس مكتب فني وحصر', 'المشاريع الهندسية', 2, '0543219876', 'tareq@segieny.sa', '2024-01-15', 'محدد المدة', '2027-01-14', '2026-12-05', '2027-02-28', '2028-09-30', 10500.0, 2500.0, 1000.0, 500.0, 'مصرف الراجحي', 'SA9880000000998877665544', 'active', 25, 'إعداد المخططات التنفيذية وحصر الكميات للمشاريع'),
        (None, 'سليمان عبد الرحيم', '2345678901', 'مصري', 'مشرف عام تنفيذ', 'التشغيل والمواقع', 1, '0508899776', 'soliman@segieny.sa', '2023-02-10', 'محدد المدة', '2027-02-09', '2026-11-05', '2026-11-10', '2027-08-20', 7500.0, 1500.0, 800.0, 400.0, 'البنك العربي الوطني', 'SA3340000000445566778899', 'active', 18, 'الإشراف الميداني اليومي على مقاولي الباطن والعمالة'),
        (None, 'بابو راجيش كومار', '2456789012', 'هندي', 'مراقب حدادة وخرسانات', 'التشغيل والمواقع', 1, '0551122998', 'rajesh@segieny.sa', '2023-09-01', 'محدد المدة', '2026-11-12', '2026-11-12', '2026-11-12', '2027-05-10', 4500.0, 1000.0, 500.0, 200.0, 'البنك السعودي للاستثمار', 'SA7760000000778899001122', 'active', 15, 'استلام وتدقيق أعمال الحدادة المسلحة ومتابعة الصبات')
    ]

    cursor.executemany('''
    INSERT INTO hr_employees (team_member_id, name, national_id, nationality, job_title, department, project_id, phone, email, join_date, contract_type, contract_end_date, iqama_expiry_date, insurance_expiry_date, passport_expiry_date, basic_salary, housing_allowance, transport_allowance, other_allowances, bank_name, iban, status, vacation_balance, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', employees)

    # Sample Leaves
    leaves = [
        (4, 'م. فادي القحطاني', 'سنوية', '2026-11-01', '2026-11-15', 14, 'approved', 'إجازة سنوية معتمدة للتجديد والاستجمام'),
        (6, 'سليمان عبد الرحيم', 'اضطرارية', '2026-10-10', '2026-10-12', 2, 'approved', 'ظرف عائلي طارئ')
    ]
    cursor.executemany('''
    INSERT INTO hr_leaves (employee_id, employee_name, leave_type, start_date, end_date, days_count, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', leaves)

    # Sample Advances
    advances = [
        (6, 'سليمان عبد الرحيم', 6000.0, '2026-08-01', 1500.0, 3000.0, 3000.0, 'active', 'سلفة تجديد رسوم دراسية - تُخصم شهرياً بقيمة 1,500 ر.س'),
        (7, 'بابو راجيش كومار', 3000.0, '2026-09-01', 1000.0, 1000.0, 2000.0, 'active', 'سلفة مصاريف علاجية - تُخصم شهرياً بقيمة 1,000 ر.س')
    ]
    cursor.executemany('''
    INSERT INTO hr_advances (employee_id, employee_name, amount, request_date, monthly_deduction, paid_amount, remaining_amount, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', advances)

def get_setting(key, default=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('CREATE TABLE IF NOT EXISTS company_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('SELECT value FROM company_settings WHERE key = ?', (key,))
    row = cursor.fetchone()
    conn.close()
    if row and row['value'] is not None:
        return row['value']
    return default

def set_setting(key, value):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('CREATE TABLE IF NOT EXISTS company_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('''
        INSERT INTO company_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    ''', (key, str(value)))
    conn.commit()
    conn.close()

