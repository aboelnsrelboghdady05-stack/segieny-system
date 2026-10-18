"""
Turso Cloud SQLite Adapter
A lightweight, drop-in replacement for sqlite3 that connects directly to Turso
via its high-performance HTTP pipeline protocol without requiring native C/Rust extensions.
"""

import os
import json
import base64
import collections.abc
from datetime import datetime, date
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class TursoRow(collections.abc.Mapping):
    """
    Emulates sqlite3.Row with support for:
    - Dict-like key access: row['name'] or row['NAME'] (case-insensitive)
    - Index access: row[0], row[-1]
    - Mapping protocol: dict(row), **row, row.keys(), row.values(), row.items()
    """
    __slots__ = ('_cols', '_values', '_map', '_lower_map')

    def __init__(self, cols, values):
        self._cols = list(cols)
        self._values = list(values)
        self._map = {c: v for c, v in zip(self._cols, self._values)}
        self._lower_map = {c.lower(): v for c, v in zip(self._cols, self._values)}

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        if key in self._map:
            return self._map[key]
        key_l = str(key).lower()
        if key_l in self._lower_map:
            return self._lower_map[key_l]
        raise KeyError(key)

    def __iter__(self):
        return iter(self._cols)

    def __len__(self):
        return len(self._cols)

    def keys(self):
        return list(self._cols)

    def values(self):
        return list(self._values)

    def items(self):
        return [(c, self._map[c]) for c in self._cols]

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def __repr__(self):
        return f'<TursoRow {dict(self)}>'


def _to_turso_val(v):
    if v is None:
        return {'type': 'null'}
    elif isinstance(v, bool):
        return {'type': 'integer', 'value': '1' if v else '0'}
    elif isinstance(v, int):
        return {'type': 'integer', 'value': str(v)}
    elif isinstance(v, float):
        return {'type': 'float', 'value': v}
    elif isinstance(v, (datetime, date)):
        return {'type': 'text', 'value': v.isoformat()}
    elif isinstance(v, bytes):
        return {'type': 'blob', 'base64': base64.b64encode(v).decode('ascii')}
    else:
        return {'type': 'text', 'value': str(v)}


def _from_turso_val(item):
    if not isinstance(item, dict):
        return item
    t = item.get('type')
    if t == 'null':
        return None
    elif t == 'integer':
        return int(item['value'])
    elif t == 'float':
        return float(item['value'])
    elif t == 'text':
        return item['value']
    elif t == 'blob':
        return base64.b64decode(item['base64'])
    return item.get('value')


class TursoDatabaseError(Exception):
    pass


class TursoCursor:
    def __init__(self, connection):
        self.connection = connection
        self.description = None
        self.lastrowid = None
        self.rowcount = -1
        self._rows = []
        self._idx = 0

    def execute(self, sql, parameters=()):
        args = [_to_turso_val(p) for p in parameters]
        stmt = {'sql': sql}
        if args:
            stmt['args'] = args
        
        results = self.connection._execute_pipeline([{'type': 'execute', 'stmt': stmt}])
        res = results[0]
        if res.get('type') == 'error':
            raise TursoDatabaseError(res['error'].get('message', 'Turso query error'))

        resp = res.get('response', {}).get('result', {})
        raw_cols = resp.get('cols', [])
        col_names = [c['name'] for c in raw_cols]

        if col_names:
            self.description = tuple((name, None, None, None, None, None, None) for name in col_names)
        else:
            self.description = None

        self.lastrowid = resp.get('last_insert_rowid')
        self.rowcount = resp.get('affected_row_count', -1)

        raw_rows = resp.get('rows', [])
        parsed_rows = []
        for r in raw_rows:
            parsed_rows.append(TursoRow(col_names, [_from_turso_val(c) for c in r]))

        self._rows = parsed_rows
        self._idx = 0
        return self

    def executemany(self, sql, seq_of_parameters):
        requests = []
        for p in seq_of_parameters:
            args = [_to_turso_val(v) for v in p]
            stmt = {'sql': sql}
            if args:
                stmt['args'] = args
            requests.append({'type': 'execute', 'stmt': stmt})

        if not requests:
            self.rowcount = 0
            return self

        total_affected = 0
        # Chunk into batches of 100
        for i in range(0, len(requests), 100):
            batch = requests[i:i+100]
            results = self.connection._execute_pipeline(batch)
            for r in results:
                if r.get('type') == 'error':
                    raise TursoDatabaseError(r['error'].get('message', 'Turso query error'))
                total_affected += r.get('response', {}).get('result', {}).get('affected_row_count', 0)

        self.rowcount = total_affected
        self._rows = []
        self._idx = 0
        self.description = None
        return self

    def fetchone(self):
        if self._idx < len(self._rows):
            row = self._rows[self._idx]
            self._idx += 1
            return row
        return None

    def fetchall(self):
        if self._idx == 0:
            res = list(self._rows)
        else:
            res = self._rows[self._idx:]
        self._idx = len(self._rows)
        return res

    def fetchmany(self, size=None):
        if size is None:
            size = 1
        end = min(self._idx + size, len(self._rows))
        res = self._rows[self._idx:end]
        self._idx = end
        return res

    def __iter__(self):
        return iter(self._rows)

    def close(self):
        self._rows = []
        self._idx = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class TursoConnection:
    _shared_session = None

    def __init__(self, database_url, auth_token):
        # Normalize database URL
        clean_url = database_url.strip()
        if clean_url.startswith('libsql://'):
            clean_url = 'https://' + clean_url[len('libsql://'):]
        if not clean_url.endswith('/v2/pipeline'):
            clean_url = clean_url.rstrip('/') + '/v2/pipeline'

        self.endpoint = clean_url
        self.auth_token = auth_token.strip()
        self.row_factory = None

        if TursoConnection._shared_session is None:
            session = requests.Session()
            retries = Retry(
                total=3,
                backoff_factor=0.3,
                status_forcelist=[500, 502, 503, 504]
            )
            adapter = HTTPAdapter(pool_connections=10, pool_maxsize=20, max_retries=retries)
            session.mount('https://', adapter)
            session.mount('http://', adapter)
            TursoConnection._shared_session = session

        self.session = TursoConnection._shared_session

    def _execute_pipeline(self, requests_list):
        payload = {'requests': requests_list}
        headers = {
            'Authorization': f'Bearer {self.auth_token}',
            'Content-Type': 'application/json'
        }
        resp = self.session.post(self.endpoint, json=payload, headers=headers, timeout=30)
        if resp.status_code != 200:
            raise TursoDatabaseError(f"HTTP {resp.status_code}: {resp.text}")
        data = resp.json()
        return data.get('results', [])

    def cursor(self):
        return TursoCursor(self)

    def execute(self, sql, parameters=()):
        cur = self.cursor()
        return cur.execute(sql, parameters)

    def executemany(self, sql, seq_of_parameters):
        cur = self.cursor()
        return cur.executemany(sql, seq_of_parameters)

    def commit(self):
        # Turso HTTP pipeline auto-commits each statement
        pass

    def rollback(self):
        pass

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def connect(database_url, auth_token):
    return TursoConnection(database_url, auth_token)
