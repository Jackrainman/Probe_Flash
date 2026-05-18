# 05-SQLiteER图

## 这张图回答什么问题

这张图回答：S3 服务器长期存储最小需要哪些 SQLite 表，以及这些表如何通过 workspace 和 issue 关联。它对应当前 schema 草案，用于后续实现初始化、CRUD 和读回验证。

```mermaid
erDiagram
    SCHEMA_META {
      string key PK
      string value
      string updated_at
    }

    WORKSPACES {
      string id PK
      string name
      string description
      int is_default
      string created_at
      string updated_at
    }

    ISSUES {
      string id PK
      string workspace_id FK
      string title
      string severity
      string status
      string created_at
      string updated_at
      string payload_json
    }

    RECORDS {
      string id PK
      string workspace_id FK
      string issue_id FK
      string type
      string created_at
      string payload_json
    }

    ARCHIVES {
      string workspace_id PK,FK
      string file_name PK
      string issue_id FK
      string file_path
      string generated_at
      string payload_json
    }

    ERROR_ENTRIES {
      string id PK
      string workspace_id FK
      string source_issue_id FK
      string error_code
      string category
      string created_at
      string updated_at
      string payload_json
    }

    WORKSPACES ||--o{ ISSUES : owns
    WORKSPACES ||--o{ RECORDS : scopes
    WORKSPACES ||--o{ ARCHIVES : scopes
    WORKSPACES ||--o{ ERROR_ENTRIES : scopes
    ISSUES ||--o{ RECORDS : has
    ISSUES ||--o{ ARCHIVES : archived_as
    ISSUES ||--o{ ERROR_ENTRIES : summarized_as
```

## 补充说明

业务实体保留完整 `payload_json`，投影列只服务列表、排序、约束和调试读回；默认 workspace 初始值为 `workspace-26-r1 / 26年 R1`。
