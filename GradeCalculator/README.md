# GradeCalculator

A web-based GPA calculator with AI-powered syllabus parsing.

## Project Structure

```
GradeCalculator/
├── backend/                    # ASP.NET Core API
│   └── GradeCalculator.API/
│       ├── Controllers/        # API endpoints
│       ├── Models/             # Database entities
│       ├── DTOs/               # Request/Response objects
│       ├── Services/           # Business logic
│       ├── Data/               # Database context
│       └── Configuration/      # Settings classes
│
└── frontend/                   # Static HTML/CSS/JS
    ├── css/                    # Stylesheets
    ├── js/                     # JavaScript modules
    └── index.html              # Main entry point
```

## Getting Started

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend/GradeCalculator.API
   ```

2. Restore packages:
   ```bash
   dotnet restore
   ```

3. Update `appsettings.json` with your API keys:
   - OpenAI API key (for syllabus parsing)
   - Google OAuth credentials (optional, for production auth)

4. Run the API:
   ```bash
   dotnet run
   ```

The API will start at `http://localhost:5000`

### Frontend Setup

1. Open `frontend/index.html` in a browser, OR

2. Use a local server (recommended):
   ```bash
   cd frontend
   npx serve .
   ```

3. Update `js/config.js` if your API runs on a different port

## Features

- **Class Management**: Create and manage classes with credit hours
- **Customizable Grade Scale**: Adjust A+/A/A- thresholds per class
- **Categories**: Organize grades by Assignments, Quizzes, Exams, etc.
- **Grade Rules**: Drop lowest, count highest, weight by score
- **What-If Mode**: See how future grades affect your GPA
- **AI Syllabus Parsing**: Paste your syllabus to auto-fill class info

## Tech Stack

- **Backend**: C# / ASP.NET Core 8
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Database**: SQLite (file-based)
- **AI**: OpenAI GPT-4o mini

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/classes | Get all classes |
| POST | /api/classes | Create a class |
| PUT | /api/classes/{id} | Update a class |
| DELETE | /api/classes/{id} | Delete a class |
| POST | /api/categories | Create a category |
| POST | /api/grades | Create a grade |
| POST | /api/syllabus/parse | Parse syllabus with AI |

## License

MIT
"# grade-calculator" 
