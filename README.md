<p align="center">
  <img src="public/FRAIwLabelBackground.png" alt="FRAI" width="100%"/>
</p>

# Local Development Setup Guide - Laravel Herd

**FRAI** is an AI-powered Facility Request System that leverages large language models and vector search for intelligent, context-aware functionality.

---

## 1. Database Setup
Since you are using the free version of Herd, you must ensure PostgreSQL is installed and running on your machine independently.

### Install & Connect
1.  Ensure **PostgreSQL** is installed (via Homebrew, Postgres.app, or direct installer).
2.  Open your preferred database management tool (e.g., **pgAdmin**, **TablePlus**, or **DBeaver**).
3.  Create a new database for the project (e.g., `frai_db`).

### Enable pgvector
To support vector embeddings, you must manually enable the `pgvector` extension on your specific database:
1.  Open a **SQL Query** window in your database tool.
2.  Select your project database.
3.  Run the following command:
    ```sql
    CREATE EXTENSION IF NOT EXISTS vector;
    ```
    *Note: If this fails, ensure the pgvector binary is installed on your system.*

### Update `.env`
Update your project's `.env` file with your local PostgreSQL credentials:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=frai_db
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

---

## 2. Ollama & Models
Ollama provides the local LLM and embedding capabilities.

1.  **Install Ollama:** Download from [ollama.com](https://ollama.com).
2.  **Download LLM:**
    *or whatever model you want
    ```bash
    ollama pull qwen2.5:3b
    ```
3.  **Download Embedding Model:**
    ```bash
    ollama pull nomic-embed-text
    ```

---

## 3. Application Configuration
Configure the application to communicate with your local Ollama instance:

```env
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_URL=http://localhost:11434
```

---

## 4. Initialization
Run these commands in your terminal to prepare the application:

1.  **Install Dependencies:**
    ```bash
    composer install
    ```
2.  **Run Migrations:**
    ```bash
    php artisan migrate:fresh --seed
    ```
3. **Run the Queue**
    For the Notifications and other non blocking proccess to work
    ```
    php artisan queue:work
    ```
4. **Run Ollama**
    ```
    ollama serve
    ```
5.  **Index Application Rules:**
    *you only need to do this once or when you change models
    Process your project data into the vector database by running:
    ```bash
    php artisan app:index-rules
    ```

---

## Troubleshooting
* **Database Connection:** Ensure the PostgreSQL service is active on your system. If you use a non-standard port (not 5432), update the `DB_PORT` in your `.env`.
* **Vector Errors:** If `app:index-rules` throws a "type 'vector' does not exist" error, double-check that you ran the `CREATE EXTENSION` query on the **correct** database.
* **Ollama Status:** Ensure the Ollama app is running in your menu bar/system tray, or the models won't be reachable.

# Local Development Setup Guide - Docker

Work in progress!