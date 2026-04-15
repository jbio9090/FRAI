No problem. If you’re sticking with the free version of Herd, you’ll just manage your PostgreSQL instance externally (like a standard local install or via Docker). 

Here is the refactored guide focusing on a manual database setup.

---

# Local Development Setup Guide

This guide outlines the steps to set up your local development environment for **FRAI** using **Laravel Herd**, a standalone **PostgreSQL** installation (with **pgvector**), and **Ollama**.

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
    ```bash
    ollama pull qwen3:0.6b
    ```
3.  **Download Embedding Model:**
    ```bash
    ollama pull nomic-embed-text
    ```

---

## 3. Application Configuration
Configure the application to communicate with your local Ollama instance:

```env
OLLAMA_MODEL=qwen3:0.6b
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
3.  **Index Application Rules:**
    *you only need to do this once
    Process your project data into the vector database by running:
    ```bash
    php artisan app:index-rules
    ```
4. **Run the Queue**
    For the Notifications and other non blocking proccess to work
    ```
    php artisan queue:work
    ```

5. **Run Ollama**
    ```
    ollama serve
    ```

---

## Troubleshooting
* **Database Connection:** Ensure the PostgreSQL service is active on your system. If you use a non-standard port (not 5432), update the `DB_PORT` in your `.env`.
* **Vector Errors:** If `app:index-rules` throws a "type 'vector' does not exist" error, double-check that you ran the `CREATE EXTENSION` query on the **correct** database.
* **Ollama Status:** Ensure the Ollama app is running in your menu bar/system tray, or the models won't be reachable.