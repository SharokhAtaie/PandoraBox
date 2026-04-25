# PandoraBox Coding API Guide

PandoraBox exposes two coding surfaces:

1. Native REST endpoints under `http://127.0.0.1:7777/api`.
2. A tool-call API facade under `/api/tools` that can invoke every MCP tool from normal code.

Use native REST endpoints for common app operations. Use the tool-call facade when you want exact MCP parity from scripts.

## Tool-Call API

### List Tools

```bash
curl -sS http://127.0.0.1:7777/api/tools
```

Returns the MCP tool catalog in JSON form.

### Call Any Tool

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  -d '{"arguments":{"limit":5,"include_decoded_body":true}}' \
  http://127.0.0.1:7777/api/tools/list_requests
```

Request shape:

```json
{
  "arguments": {
    "tool_arg": "value"
  }
}
```

Response shape:

```json
{
  "result": {
    "tool": "specific result payload"
  },
  "mcp": {
    "content": [
      {
        "type": "text",
        "text": "{ ... original MCP text content ... }"
      }
    ]
  }
}
```

For PandoraBox tools that return JSON text, `result` is parsed JSON. `mcp` keeps the original MCP `CallToolResult`.

## JavaScript Example

```js
const base = 'http://127.0.0.1:7777/api'

async function callTool(name, args = {}) {
  const res = await fetch(`${base}/tools/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arguments: args }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const { result } = await callTool('list_requests', {
  limit: 10,
  include_decoded_body: true,
})

console.log(result.requests[0]?.readable_response_body)
```

## Python Example

```python
import requests

BASE = "http://127.0.0.1:7777/api"

def call_tool(name, **arguments):
    r = requests.post(f"{BASE}/tools/{name}", json={"arguments": arguments})
    r.raise_for_status()
    return r.json()["result"]

result = call_tool("get_request", id=47, decoded=True)
print(result["response"]["readable_body"])
```

## Useful Tool Calls From Code

### Read Captured Traffic

```json
POST /api/tools/list_requests
{
  "arguments": {
    "host": "api.example.com",
    "limit": 20,
    "include_decoded_body": true
  }
}
```

### Replay A Request

```json
POST /api/tools/replay_request
{
  "arguments": {
    "request_id": 47,
    "modified_headers_json": "{\"X-Test\":\"1\"}",
    "decoded": true
  }
}
```

### Run Converter

```json
POST /api/tools/converter_transform
{
  "arguments": {
    "input": "SGVsbG8=",
    "algorithm": "base64_decode"
  }
}
```

### Delete A Sitemap Host

```json
POST /api/tools/delete_sitemap_host
{
  "arguments": {
    "host": "api.example.com"
  }
}
```

## Native REST API

Native endpoints are still available and useful for direct app operations:

- `GET /api/proxy/status`
- `GET /api/requests`
- `GET /api/requests/{id}`
- `DELETE /api/requests/{id}`
- `POST /api/requests/delete-bulk`
- `GET /api/intercept/queue`
- `PUT /api/intercept/toggle`
- `POST /api/intercept/forward/{id}`
- `POST /api/intercept/drop/{id}`
- `POST /api/replay`
- `GET /api/project`
- `PUT /api/project`
- `GET /api/converter`
- `POST /api/converter/transform`
- `POST /api/converter/stack/run`
- `GET /api/organizer/folders`

Prefer the tool-call API when you need exact MCP feature parity. Prefer native REST for tight app integration and lower-level UI workflows.

## Notes

- The API server runs on the UI/API port, default `7777`.
- Tool calls respect the same project and MCP access rules as normal MCP.
- Response bodies remain base64 in raw fields for fidelity. Use `decoded: true` or `include_decoded_body: true` to get readable body fields.
