This guide outlines the steps to set up your local development environment for FRAI using **Laravel Herd**, **PostgreSQL** (with **pgvector**), and **Ollama** for AI-powered features.

---

## 1. Database Setup (Herd Pro)
Laravel Herd (Pro) makes it incredibly easy to manage services like PostgreSQL.

1.  Open **Herd Settings** and navigate to the **Services** tab.
2.  Add a new **PostgreSQL** service.
3.  Ensure the service is running on the default port `5432`.
4.  **Install pgvector:** * Herd's PostgreSQL service typically includes `pgvector` by default. 
    * To enable it, connect to your database (using TablePlus or Herd's CLI) and run:
    ```sql
    CREATE EXTENSION IF NOT EXISTS vector;
    ```

### Update `.env`
Configure your Laravel application to use the PostgreSQL service:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=your_database_name
DB_USERNAME=root
DB_PASSWORD=
```

---

## 2. Ollama & Models
Ollama handles your local LLMs and embedding models.

1.  **Download & Install Ollama** from [ollama.com](https://ollama.com).
2.  **Pull the LLM:**
    Open your terminal and run:
    ```bash
    ollama pull qwen3:0.6b
    ```
3.  **Pull the Embedding Model:**
    Run the following to pull the Nomic embedding model:
    ```bash
    ollama pull nomic-embed-text
    ```

---

## 3. Application Configuration
Ensure your application is configured to talk to Ollama. If you are using a package like `laravelextra/ollama` or `langchain-laravel`, add the following to your `.env`:

```env
OLLAMA_MODEL=qwen3:0.6b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_URL=http://localhost:11434
```

---

## 4. Initialization
Once your database is migrated and Ollama is running with the required models, initialize your project's index/rules.

1.  **Install Composer Dependencies:**
    ```bash
    composer install
    ```

2.  **Run Migrations:**
    ```bash
    php artisan migrate
    ```

3.  **Index Application Rules:**
    Run the specific command to process your project rules into the vector database:
    ```bash
    php artisan app:index-rules
    ```

---

## Troubleshooting
* **Postgres Connection:** If you cannot connect, double-check that the PostgreSQL service is started in the Herd dashboard.
* **Ollama Connectivity:** Run `ollama list` in your terminal to verify that `qwen3:0.6b` and `nomic-embed-text` are successfully downloaded.
* **Extension Errors:** If `app:index-rules` fails with a "vector type does not exist" error, re-run the `CREATE EXTENSION vector;` command in your database.