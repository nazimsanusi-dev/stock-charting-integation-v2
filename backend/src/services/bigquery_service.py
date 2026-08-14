import json
from js import fetch
from pyodide.ffi import to_js

class BigQueryService:
    def __init__(self, project_id: str, access_token: str):
        self.project_id = project_id
        self.access_token = access_token
        self.endpoint = f"https://bigquery.googleapis.com/bigquery/v2/projects/{self.project_id}/queries"

    async def _execute_query(self, sql: str):
        payload = json.dumps({"query": sql, "useLegacySql": False})
        
        init_opts = {
            "method": "POST",
            "headers": {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
            },
            "body": payload
        }
        
        # Guna js.fetch untuk Cloudflare Workers
        response = await fetch(self.endpoint, to_js(init_opts))
        text_data = await response.text()
        data = json.loads(text_data)

        if "rows" not in data:
            return []
            
        fields = [f["name"] for f in data["schema"]["fields"]]
        rows = []
        for r in data["rows"]:
            row_dict = {fields[i]: cell["v"] for i, cell in enumerate(r["f"])}
            rows.append(row_dict)
        return rows

    async def get_subsector_ranks(self):
        return await self._execute_query("""
            SELECT date, rank, subsector_id, subsector_name, score, status, return_20d, return_5d, close_index, num_stocks
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ranks`
            ORDER BY rank ASC
        """)

    async def get_subsector_heatmap(self):
        return await self._execute_query("""
            SELECT subsector_id, subsector_name, sector_name, score, return_5d, return_20d, num_stocks
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_heatmap`
        """)

    async def get_subsector_bulk_ohlc(self):
        raw_rows = await self._execute_query("""
            SELECT subsector_id, date, open, high, low, close
            FROM `etl-stock-screener-bursa.bursa_dataset.subsector_ohlc`
            ORDER BY date ASC
        """)
        
        result = {}
        for row in raw_rows:
            sub_id = row["subsector_id"]
            if sub_id not in result:
                result[sub_id] = []
            result[sub_id].append(row)
        return result