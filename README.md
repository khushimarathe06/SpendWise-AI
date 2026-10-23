# SpendWise AI

SpendWise AI is a personal finance tracker built with React and Vite. Its API uses Express and MongoDB with Mongoose. Transactions, budgets, and savings goals are stored per account. The AI Advisor sends requests through the backend so its Gemini API key stays on the server.

## Project folders

- `src/` — React pages and components.
- `server/` — the active Express API, MongoDB models, and API routes.
- `backend/` — an older dependency folder; it does not contain the active API server.

## Run locally on Windows

You need Node.js and a MongoDB connection string. Open the project folder in VS Code.

1. In the VS Code terminal, install the frontend packages:

   ```powershell
   npm install
   ```

2. Install the backend packages:

   ```powershell
   cd server
   npm install
   ```

3. In the `server` folder, create a file named `.env` with these settings. Keep this file private and do not commit it:

   ```dotenv
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_long_random_secret
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-3.8-flash
   PORT=5000
   CORS_ORIGINS=http://localhost:5173
   ```

   `GEMINI_API_KEY` is optional if you do not want to use the AI Advisor. `GEMINI_MODEL` is optional; it defaults to `gemini-3.8-flash`. To allow more than one local frontend origin, list them in `CORS_ORIGINS`, separated by commas.

4. Start the backend in one terminal, from the `server` folder:

   ```powershell
   npm run dev
   ```

5. Open a second terminal at the project root and start the frontend:

   ```powershell
   npm run dev
   ```

6. Open the local address printed by Vite, usually `http://localhost:5173`.

The frontend uses `http://localhost:5000/api` by default. To use a different API address, create a root-level `.env` file and set `VITE_API_URL`, for example:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Restart Vite after changing this setting. Keep private keys in `server/.env`; frontend environment values are included in the browser build and must not contain secrets.

## Checks

Run these from the project root:

```powershell
npm run lint
npm run build
```

The Express server is started with `npm run dev` or `npm start` from `server/`.

Run the backend validation tests from `server/`:

```powershell
npm test
```

These tests check authentication, input validation, and account-scoped reads and writes using a temporary local test server and mocked database methods. They do not connect to MongoDB or change account records.
