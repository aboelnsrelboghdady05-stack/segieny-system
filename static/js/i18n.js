// ==========================================
// شركة مقاولات السجيني - المنظومة الرقمية
// Internationalization (i18n) Engine
// Bilingual Support: Arabic (العربية) & English
// ==========================================

let currentLang = localStorage.getItem('segieny_lang') || 'ar';

// Complete Bilingual Pairs for UI text translation
const bilingualPairs = [
    // Header & Brand
    ["شركة مقاولات السجيني | المنظومة الرقمية لإدارة المشاريع والمصاريف", "Al-Segieny Contracting | Digital Project & Cost Management"],
    ["شركة السجيني", "Al-Segieny"],
    ["للمقاولات العامة", "General Contracting"],
    ["المنظومة السحابية لمتابعة المشاريع والمهام والمصروفات", "Cloud Platform for Projects, Tasks & Expenses"],
    ["وضع داكن", "Dark Mode"],
    ["وضع فاتح", "Light Mode"],
    ["تفعيل الوضع الداكن", "Switch to Dark Mode"],
    ["تفعيل الوضع الفاتح", "Switch to Light Mode"],
    ["تبديل المظهر", "Toggle Theme"],
    ["تم تفعيل الوضع الفاتح بنجاح", "Switched to Light Mode successfully"],
    ["تم تفعيل الوضع الداكن بنجاح", "Switched to Dark Mode successfully"],
    
    // Navigation Tabs
    ["الرئيسية", "Dashboard"],
    ["المشاريع", "Projects"],
    ["المهام والتاسكات", "Tasks & Activities"],
    ["المهام", "Tasks"],
    ["المصاريف والفواتير", "Expenses & Invoices"],
    ["الموردين وعروض الأسعار", "Suppliers & Quotations"],
    ["إدارة الموردين وعروض أسعار التوريد", "Suppliers & Supply Quotations Management"],
    ["قائمة الموردين وأرصدتهم", "Suppliers List & Balances"],
    ["عروض الأسعار وبنود التوريد", "Quotations & Supply Items"],
    ["سجل زيادات وفروقات الأسعار", "Price Variances & Escalation Log"],
    ["التدفق النقدي والسيولة", "Cash Flow & Liquidity"],
    ["مقاولو الباطن", "Subcontractors"],
    ["العهد النثرية", "Petty Cash & Custody"],
    ["إدارة العهد النثرية ومصروفات الموظفين", "Petty Cash & Employee Custody Management"],
    ["رفع طلب عهدة جديد", "New Custody Request"],
    ["رصيد العهد الجارية (النشطة)", "Active Custody Balance"],
    ["بانتظار اعتماد المدير المالي", "Pending Finance Approval"],
    ["معتمدة (جاهزة للصرف)", "Approved (Ready for Payout)"],
    ["إجمالي العهد المنصرفة", "Total Disbursed Custody"],
    ["المخططات", "Blueprints & Docs"],
    ["المستندات", "Documents"],
    ["التقارير المفصلة", "Detailed Reports"],
    ["محادثات الفريق", "Team Chat"],

    // Cash Flow & Liquidity
    ["إدارة التدفق النقدي وتوقعات السيولة", "Cash Flow & Liquidity Forecast Management"],
    ["محاكي موقف الكاش عند كل مرحلة", "Phase Cash Position Simulator"],
    ["جدول التدفق النقدي التراكمي للمراحل", "Cumulative Phase Cash Flow Table"],
    ["موقف السيولة المقارن لكافة مشاريع الشركة", "Company Portfolio Cash Position Comparison"],
    ["منحنى تطور السيولة النقدية التراكمية", "Cumulative Cash Flow Trajectory Curve"],
    ["السيولة النقدية الحالية", "Current Available Liquidity"],
    ["الدفعة القادمة للتحصيل", "Next Inflow Due"],
    ["المطلوب صرفه للمرحلة", "Remaining Cost to Complete Phase"],
    ["الكاش المتوقع بعد المرحلة", "Projected Cash After Phase"],
    ["صافي الكاش النهائي المتوقع", "Final Projected Net Cash"],
    ["طباعة تقرير السيولة", "Print Liquidity Report"],
    
    // Project Phases & WBS Breakdown
    ["مراحل وتكاليف المشروع", "Phases & Costs (WBS)"],
    ["مراحل وتاسكات المشروع (WBS)", "Project Phases & Tasks (WBS)"],
    ["تعديل نسبة الإنجاز والوزن والتكلفة وسعر البيع لكل مرحلة وتاسك", "Adjust progress %, weight, cost & selling price per phase & task"],
    ["إجمالي سعر البيع (العقد):", "Total Selling Price (Contract):"],
    ["إجمالي سعر البيع (العقود):", "Total Selling Price (Contracts):"],
    ["إجمالي التكلفة التقديرية:", "Total Estimated Cost:"],
    ["الأرباح المتوقعة والهامش:", "Expected Profit & Margin:"],
    ["مجموع أوزان المراحل:", "Total Phase Weights:"],
    ["+ إضافة مرحلة جديدة", "+ Add New Phase"],
    ["إضافة مرحلة جديدة للمشروع", "Add New Project Phase"],
    ["تعديل بيانات المرحلة", "Edit Phase Details"],
    ["اسم المرحلة *", "Phase Name *"],
    ["ترتيب المرحلة", "Phase Order"],
    ["وزن المرحلة من المشروع (%) *", "Phase Weight in Project (%) *"],
    ["التكلفة التقديرية (ر.س)", "Estimated Cost (SAR)"],
    ["سعر البيع للعميل (ر.س)", "Selling Price to Client (SAR)"],
    ["نسبة إنجاز المرحلة الحالية (%):", "Current Phase Progress (%):"],
    ["المرحلة التابع لها (اختياري)", "Associated Phase (Optional)"],
    ["بدون مرحلة محددة", "No specific phase"],
    ["تكلفة المهمة التقديرية (ر.س)", "Estimated Task Cost (SAR)"],
    ["سعر بيع المهمة للعميل (ر.س)", "Task Selling Price to Client (SAR)"],
    ["+ تاسك للمرحلة", "+ Task for Phase"],
    ["نسبة إنجاز المرحلة:", "Phase Progress:"],

    // Client Payments & Milestones
    ["دفعات واستحقاقات العميل", "Client Payments & Milestones"],
    ["دفعات العميل والتحصيل", "Client Installments & Collections"],
    ["إجمالي الدفعات (شامل الضريبة):", "Total Milestones (Inc. VAT):"],
    ["المحصل فعلياً (المستلم):", "Actually Collected (Received):"],
    ["المتبقي غير المحصل:", "Remaining Uncollected:"],
    ["نسبة التحصيل:", "Collection Rate:"],
    ["جدول استحقاقات ودفعات العميل المعتمدة", "Approved Client Milestones & Installments"],
    ["متابعة الدفعات المستحقة طبقاً لمراحل التنفيذ وتسجيل سندات القبض والتحصيل", "Track due installments by milestones and record receipt vouchers"],
    ["+ إضافة دفعة جديدة", "+ Add New Installment"],
    ["إضافة دفعة واستحقاق عميل", "Add Client Payment Milestone"],
    ["تعديل دفعة واستحقاق العميل", "Edit Client Payment Milestone"],
    ["تسجيل استلام دفعة من العميل", "Record Client Payment Receipt"],
    ["تأكيد تسجيل التحصيل", "Confirm Collection"],
    ["مرحلة / شرط استحقاق الدفعة *", "Milestone / Payment Condition *"],
    ["القيمة شاملة الضريبة 15% (ر.س) *", "Amount Inc. 15% VAT (SAR) *"],
    ["القيمة بدون ضريبة (ر.س)", "Amount Exc. VAT (SAR)"],
    ["قيمة الضريبة (15%)", "VAT Amount (15%)"],
    ["تاريخ الاستحقاق المتوقع", "Expected Due Date"],
    ["المبلغ المحصل فعلياً (ر.س) *", "Actually Collected Amount (SAR) *"],
    ["تاريخ التحصيل *", "Collection Date *"],
    ["رقم سند القبض / المرجع البنكي", "Receipt Voucher No / Bank Ref"],
    ["ملاحظات الاستلام", "Collection Notes"],
    ["المحصل من العملاء", "Client Collections"],
    ["دفعات واستحقاقات العملاء والسيولة", "Client Milestones & Cash Flow"],
    ["تقرير دفعات واستحقاقات العملاء والتدفق النقدي", "Client Installments & Cash Flow Report"],
    ["تصدير تقرير الدفعات (Excel)", "Export Milestones (Excel)"],
    
    // Header Actions
    ["إجراء سريع", "Quick Action"],
    ["تسجيل مصروف مع فاتورة", "Add Expense with Invoice"],
    ["إسناد مهمة جديدة", "Assign New Task"],
    ["إضافة مشروع جديد", "Add New Project"],
    ["رفع مخطط أو مستند", "Upload Blueprint / Doc"],
    ["التنبيهات والإشعارات", "Notifications & Alerts"],
    ["تحديد كـ مقروء", "Mark all as read"],
    ["تبديل حساب الموظف (اليوزر):", "Switch Employee Account (User):"],
    ["اختر موظفاً لتجربة المحادثات والصلاحيات باسمه", "Select an employee to test permissions & chat as them"],
    
    // Dashboard KPIs & Sections
    ["إجمالي قيمة العقود", "Total Contract Value"],
    ["مشاريع قيد التنفيذ", "Active Projects"],
    ["إجمالي المصروفات المنفقة", "Total Incurred Expenses"],
    ["فواتير ومستخلصات معتمدة", "Audited Invoices & Certificates"],
    ["إنجاز المهام والموقع", "Site & Task Completion"],
    ["مهمة مكتملة", "completed tasks"],
    ["مستحقات مقاولي الباطن", "Subcontractor Payables"],
    ["متبقي صرف مستخلصات", "Remaining Certificates"],
    ["المشاريع الحالية ونسب الإنجاز", "Current Projects & Progress"],
    ["متابعة دقيقة لنسبة التنفيذ والميزانية المنصرفة لكل موقع", "Accurate tracking of site progress and spent budget per site"],
    ["عرض الكل", "View All"],
    ["توزيع المصروفات", "Expenses Breakdown"],
    ["حسب بنود البناء والتوريدات", "By Construction & Supply Items"],
    ["أحدث المهام والتاسكات الميدانية", "Recent Site Tasks"],
    ["+ إسناد مهمة", "+ Assign Task"],
    ["أحدث فواتير ومصروفات المشاريع", "Recent Project Invoices & Expenses"],
    ["+ تسجيل فاتورة", "+ Log Invoice"],
    
    // Projects Tab
    ["مشاريع شركة السجيني", "Al-Segieny Company Projects"],
    ["متابعة كافة مواقع العمل، الميزانيات، العقود، ونسب الإنجاز الفعلي", "Monitor all sites, budgets, contracts, and actual completion rates"],
    ["ابحث باسم المشروع أو العميل...", "Search by project name or client..."],
    ["بحث باسم المشروع، العميل، أو الكود...", "Search by project name, client, or code..."],
    ["مشروع جديد", "New Project"],
    ["العميل:", "Client:"],
    ["الموقع:", "Location:"],
    ["قيمة العقد:", "Contract Value:"],
    ["إجمالي المنصرف:", "Total Spent:"],
    ["المنصرف:", "Spent:"],
    ["الميزانية:", "Budget:"],
    ["نسبة الإنجاز الفعلي:", "Site Progress Rate:"],
    ["مهام منجزة:", "Completed Tasks:"],
    ["مخططات ومستندات:", "Drawings & Docs:"],
    ["تفاصيل المشروع والفواتير", "Project Details & Invoices"],
    ["تحديث نسبة الإنجاز", "Update Progress"],
    ["حذف المشروع", "Delete Project"],
    ["لا توجد مشاريع مسجلة حالياً", "No projects registered currently"],
    
    // Tasks Tab
    ["المهام والتاسكات وأوامر الشغل", "Tasks & Site Work Orders"],
    ["إرسال المهام لمهندسي المواقع والمشرفين ومتابعة نسب إنجاز كل بند", "Assign tasks to site engineers and supervisors & monitor completion"],
    ["تصفية بالمشروع:", "Filter by Project:"],
    ["جميع المشاريع", "All Projects"],
    ["الحالة:", "Status:"],
    ["جميع الحالات", "All Statuses"],
    ["الأولوية:", "Priority:"],
    ["جميع الأولويات", "All Priorities"],
    ["الموظف المسند إليه:", "Assigned Employee:"],
    ["جميع المهندسين والمشرفين", "All Engineers & Supervisors"],
    ["قيد الانتظار والتجهيز", "Pending & Preparation"],
    ["جاري التنفيذ بالموقع", "In Progress on Site"],
    ["مكتملة ومستلمة من الاستشاري", "Completed & Consultant-Approved"],
    ["قيد الانتظار", "Pending"],
    ["جاري التنفيذ", "In Progress"],
    ["مكتملة ومستلمة", "Completed"],
    ["مكتملة", "Completed"],
    ["عاجل جداً", "Urgent"],
    ["طارئ وعاجل", "Urgent & Emergency"],
    ["مرتفع", "High"],
    ["أولوية مرتفعة", "High Priority"],
    ["متوسط", "Medium"],
    ["متوسطة", "Medium"],
    ["أولوية عادية", "Normal Priority"],
    ["منخفض", "Low"],
    ["منخفضة", "Low"],
    ["الإنجاز:", "Progress:"],
    ["تعديل النسبة", "Edit Progress"],
    ["حذف المهمة", "Delete Task"],
    
    // Expenses Tab
    ["إدارة المصاريف وفواتير المشاريع", "Expenses & Invoices Management"],
    ["توثيق كافة النفقات المالية، الشيكات، العهد، مع أرشفة صور الفواتير والإيصالات", "Document all expenses, checks, petty cash, with attached invoices"],
    ["تصدير Excel", "Export Excel"],
    ["تسجيل مصروف + إرفاق فاتورة", "Log Expense + Attach Invoice"],
    ["مجموع المصروفات المعروضة:", "Total Displayed Expenses:"],
    ["عدد الفواتير والمستندات المرفقة:", "Attached Invoices & Documents:"],
    ["أكبر بند إنفاق:", "Top Spending Category:"],
    ["بند الصرف (التصنيف):", "Expense Category:"],
    ["جميع البنود", "All Categories"],
    ["من تاريخ:", "From Date:"],
    ["إلى تاريخ:", "To Date:"],
    ["التاريخ", "Date"],
    ["المشروع", "Project"],
    ["بيان المصروف", "Expense Description"],
    ["البند / التصنيف", "Category"],
    ["المبلغ", "Amount"],
    ["طريقة الدفع", "Payment Method"],
    ["المستلم / الصارف", "Beneficiary / Paid To"],
    ["الفاتورة / الإيصال", "Invoice / Voucher"],
    ["الفاتورة", "Invoice"],
    ["إجراءات", "Actions"],
    ["عرض الفاتورة", "View Invoice"],
    ["بدون مرفق", "No Voucher"],
    ["حذف المصروف", "Delete Expense"],
    ["لا توجد مصروفات مسجلة مطابقة لمعايير البحث", "No expenses matching filter criteria"],
    
    // Subcontractors Tab
    ["مقاولين الباطن والعمالة الميدانية", "Subcontractors & Field Labor"],
    ["إدارة حسابات الحرفيين (حدادين، نجارين، سباكين، مبيضين محارة) والمستخلصات المسددة", "Manage craftsman accounts and disbursed payment certificates"],
    ["تسجيل مقاول جديد", "Register New Subcontractor"],
    ["الهاتف:", "Phone:"],
    ["المسدد من الاتفاق", "Disbursed of Contract"],
    ["إجمالي الاتفاق:", "Total Contract:"],
    ["المتبقي:", "Remaining:"],
    ["صرف مستخلص / دفعة", "Issue Payment Certificate"],
    ["لا يوجد مقاولو باطن مسجلون حالياً", "No subcontractors registered currently"],
    
    // Documents Tab
    ["المخططات الهندسية والمستندات", "Engineering Blueprints & Documents"],
    ["أرشيف رقمي للرسومات المعمارية والإنشائية، التراخيص، والتقارير الفنية", "Digital archive for drawings, permits, and engineering reports"],
    ["رفع مخطط / مستند جديد", "Upload New Blueprint / Document"],
    ["رفع بواسطة:", "Uploaded by:"],
    ["معاينة وتحميل", "Preview & Download"],
    ["لا توجد مخططات أو مستندات مرفوعة حالياً", "No blueprints or documents uploaded currently"],
    
    // Reports Tab
    ["التقارير المالية والتنفيذية المفصلة", "Detailed Financial & Execution Reports"],
    ["كشوفات حساب شاملة، نسب الإنجاز الميداني مقابل الصرف المالي، ومستخلصات مقاولي الباطن", "Comprehensive balance sheets, progress vs spent rates, and subcontractor certificates"],
    ["طباعة التقرير الرسمي (A4)", "Print Official Report (A4)"],
    ["تصدير ملف Excel شامل", "Export Full Excel"],
    ["المشروع المستهدف:", "Target Project:"],
    ["جميع مشاريع الشركة", "All Company Projects"],
    ["كل المدة", "All Time"],
    ["هذا الشهر", "This Month"],
    ["هذا الربع", "This Quarter"],
    ["إجمالي الميزانيات", "Total Budgets"],
    ["إجمالي المنصرف", "Total Spent"],
    ["المتبقي من الميزانية", "Remaining Budget"],
    ["نسبة استهلاك الميزانية", "Budget Burn Rate"],
    ["إنجاز المهام الميدانية", "Field Tasks Progress"],
    ["الفواتير المؤرشفة", "Archived Invoices"],
    ["التقرير المالي والتنفيذي للمشاريع", "Project Financial & Execution Report"],
    ["توزيع بنود الصرف والمواد", "Breakdown of Items & Materials"],
    ["كشف حساب مقاولي الباطن والعمالة", "Subcontractor & Labor Statement"],
    ["سجل الفواتير والمصروفات المؤرشفة", "Archived Invoices & Expenses Register"],
    ["مقارنة الميزانيات التقديرية بالمصاريف والأرباح (المراحل والبنود)", "Budget vs Actual Expenses & P&L (WBS & BOQ)"],
    ["تقرير مقارنة الميزانية التقديرية بالمصروفات الفعلية والأرباح والخسائر", "Estimated Budget vs Actual Expenses and P&L Statement"],
    ["مقارنة التكلفة التقديرية (الميزانية المحطوطة) لكل بند ومرحلة مع المصاريف الفعلية، وإيضاح التجاوز أو الوفورات وصافي الربح", "Comparison of estimated budget for each item and phase with actual expenses, highlighting overruns, savings, and net profit"],
    ["تصدير تقرير المقايسة والميزانية (Excel)", "Export BOQ & Budget (Excel)"],
    ["المرحلة التابعة (اختياري)", "Associated Phase (Optional)"],
    ["بند الأعمال المرتبط بالمصروف (اختياري)", "Linked Work Item (Optional)"],
    ["وحدة القياس", "Unit of Measure"],
    ["الكمية المقدرة *", "Estimated Quantity *"],
    ["التكلفة التقديرية (الميزانية المحطوطة) *", "Estimated Cost (Set Budget) *"],
    ["سعر تكلفة الوحدة (ر.س):", "Unit Cost Price (SAR):"],
    ["إجمالي ميزانية البند (الكمية × الوحدة):", "Total Item Budget (Qty × Unit):"],
    ["سعر البيع للعميل (المستخلص) *", "Client Selling Price (Billing) *"],
    ["سعر بيع الوحدة للعميل (ر.س):", "Unit Selling Price (SAR):"],
    ["إجمالي سعر بيع البند (الكمية × الوحدة):", "Total Item Selling Price (Qty × Unit):"],
    ["الربح التقديري المتوقع:", "Expected Estimated Profit:"],
    ["تجاوز الميزانية", "Over Budget"],
    ["ضمن الميزانية", "Within Budget"],
    ["جدول الموقف المالي والتنفيذي لكل موقع", "Financial & Execution Status per Site"],
    ["مقارنة نسبة الصرف المالي بنسبة الإنجاز الفعلي على أرض الواقع", "Comparison of financial expenditure vs actual on-site progress"],
    ["الكود", "Code"],
    ["المالك / الموقع", "Client / Site"],
    ["قيمة العقد", "Contract Value"],
    ["المنصرف الفعلي", "Actual Spent"],
    ["المتبقي من الميزانية", "Remaining Budget"],
    ["نسبة الصرف", "Spent Rate"],
    ["الإنجاز الفعلي", "Actual Progress"],
    ["مؤشر الانحراف", "Variance Index"],
    ["حالة الميزانية", "Budget Status"],
    ["لا توجد بيانات مشاريع متوافقة مع التصفية", "No project data matching the filter"],
    ["لا توجد مصاريف مدرجة", "No expenses listed"],
    ["لا يوجد مقاولو باطن مسجلون", "No subcontractors registered"],
    ["لا توجد فواتير أو مصروفات مسجلة", "No invoices or expenses recorded"],
    ["متزن", "Balanced"],
    ["زيادة صرف", "Budget Overrun"],
    ["معاينة الفاتورة", "Preview Voucher"],
    
    // Chat Tab
    ["محادثات وغرف عمل الفريق", "Team Chat & Project Rooms"],
    ["تواصل داخلي فوري بين مهندسي المشاريع والإدارة مع مشاركة المرفقات", "Real-time communication between site engineers & management with file attachments"],
    ["غرف وقنوات المحادثة", "Channels & Rooms"],
    ["القناة العامة للشركة", "General Company Room"],
    ["غرفة النقاش والتنسيق العامة لشركة السجيني", "General coordination room for Al-Segieny Company"],
    ["غرف المشاريع الإنشائية", "Project Rooms"],
    ["المحادثات المباشرة (الزملاء)", "Direct Messages (Colleagues)"],
    ["متصل الآن", "Active Now"],
    ["اكتب رسالتك لزملائك في هذا المشروع...", "Type your message to teammates in this project..."],
    ["اكتب رسالتك هنا...", "Type your message here..."],
    ["إرسال", "Send"],
    ["إرفاق ملف أو مخطط", "Attach file or blueprint"],
    
    // Modals
    ["تسجيل مصروف جديد وإرفاق الفاتورة", "Log New Expense & Attach Voucher"],
    ["المشروع التابع له المصروف *", "Project Associated with Expense *"],
    ["المبلغ المطلوب صرفه (ر.س) *", "Amount to Disburse (SAR) *"],
    ["بند الصرف (التصنيف) *", "Expense Category *"],
    ["بيان المصروف بالتفصيل *", "Detailed Description *"],
    ["طريقة الدفع", "Payment Method"],
    ["القائم بالصرف", "Paid By"],
    ["المدفوع له (المورد/المقاول)", "Paid To (Supplier/Contractor)"],
    ["تاريخ الصرف", "Expense Date"],
    ["انقر هنا لإرفاق صورة الفاتورة أو الإيصال أو ملف PDF", "Click here to attach invoice image, receipt or PDF"],
    ["يدعم الصور (JPG, PNG) وملفات PDF حتى 32 ميجابايت", "Supports JPG, PNG and PDF files up to 32MB"],
    ["ملاحظات إضافية", "Additional Notes"],
    ["إلغاء", "Cancel"],
    ["حفظ المصروف والفاتورة", "Save Expense & Voucher"],
    
    ["إسناد مهمة / أمر شغل جديد", "Assign New Task / Site Work Order"],
    ["المشروع التابع له *", "Associated Project *"],
    ["عنوان المهمة أو البند *", "Task Title or Work Item *"],
    ["المسؤول عن التنفيذ (مهندس/مشرف) *", "Assigned Site Engineer / Supervisor *"],
    ["الأولوية", "Priority"],
    ["تاريخ البدء", "Start Date"],
    ["الموعد النهائي للتسليم", "Deadline / Due Date"],
    ["حالة المهمة", "Task Status"],
    ["نسبة الإنجاز الحالية:", "Current Progress Rate:"],
    ["وصف المهمة وملاحظات الاستشاري", "Task Description & Consultant Remarks"],
    ["حفظ المهمة", "Save Task"],
    
    ["إضافة مشروع جديد للشركة", "Add New Project to Company"],
    ["اسم المشروع *", "Project Name *"],
    ["العميل / المالك *", "Client / Owner *"],
    ["موقع المشروع *", "Project Location *"],
    ["قيمة العقد الإجمالية (الميزانية ر.س) *", "Total Contract Value (Budget SAR) *"],
    ["مدير المشروع المسؤول", "Assigned Project Manager"],
    ["تاريخ استلام الموقع (البدء)", "Site Handover Date (Start)"],
    ["تاريخ التسليم المتوقع", "Expected Delivery Date"],
    ["ملاحظات ومواصفات عامة للمشروع", "Project Scope & General Specifications"],
    ["إنشاء المشروع", "Create Project"],
    
    ["تسجيل مقاول باطن / حرفي", "Register Subcontractor / Craftsman"],
    ["اسم المقاول / المعلم *", "Contractor / Master Craftsman *"],
    ["التخصص / المهنة *", "Trade / Specialty *"],
    ["رقم الهاتف", "Phone Number"],
    ["المشروع المخصص له", "Assigned Project"],
    ["إجمالي قيمة الاتفاق (ر.س)", "Total Agreement Value (SAR)"],
    ["ملاحظات العقد أو شروط الصرف", "Contract Notes & Payment Terms"],
    ["حفظ بيانات المقاول", "Save Subcontractor"],
    
    ["صرف مستخلص / دفعة لمقاول", "Disburse Payment Certificate / Advance"],
    ["المبلغ المصروف (ر.س) *", "Disbursed Amount (SAR) *"],
    ["نوع الدفعة", "Payment Type"],
    ["مستخلص جاري عن أعمال", "Progress Payment Certificate"],
    ["سلفة نقدية", "Cash Advance"],
    ["مستخلص ختامي وتصفية", "Final Settlement Certificate"],
    ["إرفاق سند القبض / الإيصال الموقع", "Attach Signed Receipt / Voucher"],
    ["ملاحظات الصرف والبنود المستلمة", "Disbursement Notes & Accepted Items"],
    ["قيد المستخلص وترحيل المصروف", "Record Certificate & Post Expense"],
    
    ["رفع مخطط أو مستند هندسي", "Upload Engineering Blueprint or Document"],
    ["اسم أو وصف المستند *", "Document Name or Title *"],
    ["تصنيف المستند", "Document Category"],
    ["الملف (PDF أو صور عالية الدقة) *", "File (PDF or High-Res Image) *"],
    ["رفع وأرشفة الملف", "Upload & Archive File"],
    
    // Project Details Drawer
    ["طباعة تقرير المشروع", "Print Project Report"],
    ["قيمة العقد (الميزانية):", "Contract Value (Budget):"],
    ["المتبقي من الميزانية:", "Remaining Budget:"],
    ["سجل مصروفات المشروع وفواتيره", "Project Expenses & Invoices Ledger"],
    ["+ إضافة مصروف لهذا المشروع", "+ Add Expense for this Project"],
    ["مهام المشروع التنفيذية", "Project Field Tasks"],
    ["+ إسناد مهمة لهذا المشروع", "+ Assign Task for this Project"],
    ["البيان", "Description"],
    ["المستلم", "Beneficiary"],
    ["تحميل", "Download"],
    
    // Categories & Materials
    ["مواد بناء", "Building Materials"],
    ["مواد بناء (حديد، أسمنت، خرسانة، طوب/بلك)", "Building Materials (Steel, Cement, Concrete, Blocks)"],
    ["مواد بناء (حديد، أسمنت، طوب، رمل...)", "Building Materials (Steel, Cement, Bricks, Sand...)"],
    ["خرسانة وحديد", "Concrete & Steel"],
    ["رواتب وأجور", "Salaries & Wages"],
    ["عمالة ومقاولين باطن", "Labor & Subcontractors"],
    ["عمالة ومقاولين باطن (يوميات ومستخلصات)", "Labor & Subcontractors (Wages & Certificates)"],
    ["معدات وآليات", "Heavy Equipment & Machinery"],
    ["معدات وآليات (أوناش، سقالات، حفار)", "Heavy Equipment (Cranes, Scaffolding, Excavator)"],
    ["معدات وآليات (أوناش، حفارات، خلاطات)", "Heavy Equipment (Cranes, Excavators, Mixers)"],
    ["محروقات ونقل", "Fuel & Transport"],
    ["محروقات ونقل وتشوينات", "Fuel, Transport & Hauling"],
    ["تراخيص وتأمينات", "Permits & Insurance"],
    ["تراخيص وتأمينات وهندسي", "Permits, Insurance & Engineering"],
    ["تراخيص وموافقات وتأمينات", "Permits, Approvals & Insurance"],
    ["نثريات وإداريات", "Petty Cash & Admin"],
    ["نثريات وضيافة ومصاريف موقع", "Petty Cash, Hospitality & Site Expenses"],
    ["نثريات وضيافة ومصاريف مكتب", "Petty Cash, Hospitality & Office Expenses"],
    ["مقاولو باطن", "Subcontractors"],
    ["تراخيص ورسوم حكومية", "Permits & Gov Fees"],
    ["نثريات وموقع", "Site & Petty Expenses"],
    ["أخرى", "Other"],
    
    // Trades / Specialties
    ["حدادة مسلحة", "Rebar & Structural Steel"],
    ["نجارة مسلحة وشدات", "Formwork & Concrete Carpentry"],
    ["أعمال مباني وطوب", "Masonry & Block Work"],
    ["بياض محارة ولياسة", "Plastering & Rendering"],
    ["سباكة وصرف صحي", "Plumbing & Drainage"],
    ["كهرباء وتأسيس", "Electrical Rough-in"],
    ["هياكل معدنية ستيل", "Structural Steel Framing"],
    ["أعمال عزل", "Thermal & Water Insulation"],
    ["أعمال عزل مائي وحراري", "Waterproofing & Thermal Insulation"],
    ["رخام وسيراميك", "Marble & Ceramic Tiling"],
    ["رخام وسيراميك وأرضيات", "Marble, Ceramics & Flooring"],
    ["تشطيبات وديكور", "Finishes & Decor"],
    ["كهرباء وسباكة", "MEP Works"],
    
    // Roles & Key Team Members
    ["المدير العام", "General Manager (CEO)"],
    ["المدير المالي", "Financial Director (CFO)"],
    ["مدير المشاريع", "Project Director"],
    ["مدير مشاريع أول", "Senior Project Manager"],
    ["مهندس موقع وتنفيذ", "Site & Execution Engineer"],
    ["مدير الحسابات والمشتريات", "Accounting & Procurement Manager"],
    ["مشرف عام المواقع والتشغيل", "Site General Supervisor"],
    ["ابوالنصر البغدادي", "Abuelnasr Al-Baghdadi"],
    ["مهندس جهاد", "Eng. Jihad"],
    ["نواف سجيني", "Nawaf Segieny"],
    ["فاروق محمد", "Farouk Mohamed"],
    ["م. عبد العزيز السجيني", "Eng. Abdulaziz Al-Segieny"],
    ["م. تركي القحطاني", "Eng. Turki Al-Qahtani"],
    ["م. سلطان الشمري", "Eng. Sultan Al-Shammari"],
    ["أ. فهد العتيبي", "Fahad Al-Otaibi"],
    ["أبو خالد الدوسري", "Abu Khalid Al-Dossary"],
    
    // Payment Methods
    ["تحويل بنكي", "Bank Transfer"],
    ["تحويل بنكي / سريع (سداد)", "Bank Transfer / SADAD"],
    ["مدى", "Mada Card"],
    ["بطاقة مدى / إلكتروني", "Mada / Electronic Card"],
    ["شيك", "Bank Cheque"],
    ["شيك مصرفي", "Bank Cheque"],
    ["نقدي", "Cash"],
    ["نقدي (كاش / عهدة)", "Cash / Petty Cash"],
    
    // Document Types
    ["مخططات معمارية", "Architectural Blueprints"],
    ["مخططات إنشائية", "Structural Blueprints"],
    ["مخططات إنشائية وتسليح", "Structural & Rebar Drawings"],
    ["مخططات كهروميكانيك MEP", "MEP Blueprints"],
    ["تراخيص وعقود", "Permits & Contracts"],
    ["تراخيص بناء وعقود قانونية", "Building Permits & Legal Contracts"],
    ["تقارير جسات تربة", "Soil Investigation Reports"],
    ["تقارير جسات واختبارات خرسانة", "Soil Tests & Concrete Lab Reports"],
    ["فواتير ومستخلصات مجمعة", "Consolidated Invoices & Certificates"]
];

// Build Bi-directional Maps
const arToEnMap = new Map();
const enToArMap = new Map();

bilingualPairs.forEach(([ar, en]) => {
    arToEnMap.set(ar.trim(), en.trim());
    enToArMap.set(en.trim(), ar.trim());
});

// Helper to translate single phrase or word
function tr(phrase) {
    if (!phrase) return '';
    const clean = String(phrase).trim();
    if (currentLang === 'en') {
        return arToEnMap.get(clean) || clean;
    } else {
        return enToArMap.get(clean) || clean;
    }
}

// Translate key from dictionary
function t(key, fallback = '') {
    return tr(key) || fallback || key;
}

// Toggle language
function toggleLanguage() {
    const newLang = currentLang === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
}

// Set language and update entire DOM
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('segieny_lang', lang);
    
    // Update HTML dir and lang
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    
    // Toggle font classes
    const body = document.body;
    if (lang === 'en') {
        body.classList.remove('font-cairo');
        body.classList.add('font-sans');
    } else {
        body.classList.remove('font-sans');
        body.classList.add('font-cairo');
    }
    
    // Update language toggle button text
    const langBtnText = document.getElementById('lang-toggle-text');
    if (langBtnText) {
        langBtnText.innerText = (lang === 'ar') ? 'English' : 'العربية';
    }

    // Apply translations across all DOM elements
    applyTranslations();

    // Re-populate dropdowns
    if (typeof loadProjectsDropdowns === 'function') {
        loadProjectsDropdowns();
    }
    if (typeof loadTeamDropdowns === 'function') {
        loadTeamDropdowns();
    }

    // Re-render current active tab to update dynamic content, tables, and currencies
    if (typeof switchTab === 'function') {
        switchTab(currentTab);
    }
    
    // Update User Switcher UI
    if (typeof updateUserUI === 'function') {
        updateUserUI();
    }
    
    // Update Theme Switcher UI
    if (typeof applyTheme === 'function') {
        applyTheme(localStorage.getItem('segieny_theme') || 'dark', false);
    }
    
    // Re-initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Deep Walk and Translate DOM Text Nodes
function applyTranslations() {
    // 1. Explicit data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            const mapped = tr(key);
            if (mapped) el.innerText = mapped;
        }
    });

    // 2. Walk all text elements across the page
    const textSelectors = 'h1, h2, h3, h4, h5, h6, p, span, button, label, th, td, option, a, strong, div';
    document.querySelectorAll(textSelectors).forEach(el => {
        // Skip containers that contain complex child elements
        if (el.children.length === 0) {
            const trimmed = el.innerText.trim();
            if (trimmed) {
                const translated = tr(trimmed);
                if (translated && translated !== trimmed) {
                    el.innerText = translated;
                }
            }
        } else {
            // For elements with children (e.g. <button><i ...></i><span>Text</span></button>)
            // Walk direct text nodes
            for (let node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const raw = node.nodeValue.trim();
                    if (raw) {
                        const translated = tr(raw);
                        if (translated && translated !== raw) {
                            node.nodeValue = node.nodeValue.replace(raw, translated);
                        }
                    }
                }
            }
        }
    });

    // 3. Inputs & Textareas Placeholders
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
        const ph = el.getAttribute('placeholder');
        if (ph) {
            const translated = tr(ph.trim());
            if (translated) el.setAttribute('placeholder', translated);
        }
    });

    // 4. Elements with titles / tooltips
    document.querySelectorAll('[title]').forEach(el => {
        const title = el.getAttribute('title');
        if (title && !title.includes('/')) {
            const translated = tr(title.trim());
            if (translated) el.setAttribute('title', translated);
        }
    });
}
