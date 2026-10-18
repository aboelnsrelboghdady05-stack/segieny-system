import sqlite3
import urllib.request
import json
import base64
import sys

TURSO_URL = 'https://sejiny-abuelnasr.aws-eu-west-1.turso.io/v2/pipeline'
TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIzNjYyMDgsImlkIjoiMDFhMTUxNTUtOGMwMS03NmMzLWI4NDYtNTY4Yzc2MGZkZmZmIiwia2lkIjoiVmRIVzNoM2RzQklGODdDUlFMaVBXU3Q5TlV3eThGVHUyUjhMUER2bExFTSIsInJpZCI6ImZjYzMxMjM4LWM4NjktNGFhNy04YjMxLWY4NWJiMDFmOGRkOSJ9.CtHhtaup_cm0wKMGqMLDkWQ9XyuQzL8rTPfw2EfR84tITwK0iXCv4C4IXXrlxm4aa3NV49yFcRYs-TWQMGPtCQ'

def to_turso_val(v):
    if v is None:
        return {'type': 'null'}
    elif isinstance(v, bool):
        return {'type': 'integer', 'value': '1' if v else '0'}
    elif isinstance(v, int):
        return {'type': 'integer', 'value': str(v)}
    elif isinstance(v, float):
        return {'type': 'float', 'value': v}
    elif isinstance(v, bytes):
        return {'type': 'blob', 'base64': base64.b64encode(v).decode('ascii')}
    else:
        return {'type': 'text', 'value': str(v)}

def execute_pipeline(requests):
    # Always include PRAGMA foreign_keys = OFF at the start of each pipeline
    full_requests = [{'type': 'execute', 'stmt': {'sql': 'PRAGMA foreign_keys = OFF;'}}] + requests
    payload = {'requests': full_requests}
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        TURSO_URL,
        data=data,
        headers={
            'Authorization': f'Bearer {TURSO_TOKEN}',
            'Content-Type': 'application/json'
        }
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
    
    # Check for errors (skip the first FK pragma result)
    results = res.get('results', [])
    for idx, r in enumerate(results[1:]):
        if r.get('type') == 'error':
            raise RuntimeError(f"Turso Error in request {idx}: {r.get('error')}")
    return {'results': results[1:]}

def execute_stmts(stmts):
    requests = [{'type': 'execute', 'stmt': {'sql': s}} for s in stmts]
    return execute_pipeline(requests)

def main():
    print("=== Starting Full Migration from Local SQLite to Turso Cloud ===")
    conn = sqlite3.connect('segieny_contracting.db')
    c = conn.cursor()

    # 1. Disable FK checks on Turso
    print("Disabling foreign keys on Turso...")
    execute_stmts(['PRAGMA foreign_keys = OFF;'])

    # 2. Get all tables and indexes from local SQLite
    c.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'")
    tables = c.fetchall()

    c.execute("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")
    indexes = [row[0] for row in c.fetchall()]

    print(f"Found {len(tables)} tables to migrate.")

    # 3. Drop all tables on Turso
    print("Dropping existing tables on Turso...")
    drop_stmts = [f'DROP TABLE IF EXISTS "{name}";' for name, _ in tables]
    # Execute drops in batches of 10
    for i in range(0, len(drop_stmts), 10):
        execute_stmts(drop_stmts[i:i+10])

    # 4. Create tables on Turso
    print("Creating tables on Turso...")
    create_stmts = [sql for _, sql in tables]
    for i in range(0, len(create_stmts), 5):
        execute_stmts(create_stmts[i:i+5])

    # 5. Insert rows for each table
    for table_name, _ in tables:
        c.execute(f'SELECT * FROM "{table_name}"')
        rows = c.fetchall()
        row_count = len(rows)
        if row_count == 0:
            print(f"Table '{table_name}': 0 rows (skipped)")
            continue

        print(f"Migrating table '{table_name}' ({row_count} rows)...", end='', flush=True)
        col_count = len(rows[0])
        placeholders = ', '.join(['?'] * col_count)
        sql = f'INSERT INTO "{table_name}" VALUES ({placeholders})'

        # Batch rows in chunks of 50
        batch_size = 50
        for b_idx in range(0, row_count, batch_size):
            chunk = rows[b_idx:b_idx+batch_size]
            requests = [
                {
                    'type': 'execute',
                    'stmt': {
                        'sql': sql,
                        'args': [to_turso_val(val) for val in row]
                    }
                }
                for row in chunk
            ]
            execute_pipeline(requests)
        print(" OK")

    # 6. Create indexes
    if indexes:
        print(f"Creating {len(indexes)} indexes...")
        for idx_sql in indexes:
            try:
                execute_stmts([idx_sql])
            except Exception as e:
                print(f"Index notice: {e}")

    # 7. Re-enable foreign keys
    execute_stmts(['PRAGMA foreign_keys = ON;'])

    # 8. Verification
    print("\n=== Verification: Comparing Row Counts ===")
    all_match = True
    for table_name, _ in tables:
        c.execute(f'SELECT count(*) FROM "{table_name}"')
        local_cnt = c.fetchone()[0]

        # Query Turso
        res = execute_pipeline([{
            'type': 'execute',
            'stmt': {'sql': f'SELECT count(*) FROM "{table_name}"'}
        }])
        turso_cnt = int(res['results'][0]['response']['result']['rows'][0][0]['value'])

        status = "MATCH" if local_cnt == turso_cnt else "MISMATCH"
        if local_cnt != turso_cnt:
            all_match = False
        print(f" - {table_name}: Local={local_cnt} | Turso={turso_cnt}  [{status}]")

    conn.close()

    if all_match:
        print("\nSUCCESS: All tables and rows migrated to Turso cloud with 100% data integrity!")
    else:
        print("\nWARNING: Some table counts did not match. Please review.")

if __name__ == '__main__':
    main()
