# Claira — AI Chat App (MERN) 

A full-stack AI chat application built with the MERN stack . Features JWT authentication, persistent chat history, and a sleek dark UI.

---

## 🗂 Project Structure

```
ai-chat-app/
├── backend/
│   ├── models/
│   │   ├── User.js          # User schema (bcrypt password hashing)
│   │   └── Chat.js          # Chat & message schema
│   ├── routes/
│   │   ├── auth.js          # Register & Login routes
│   │   └── chat.js          # AI chat routes
│   ├── middleware/
│   │   └── authMiddleware.js # JWT protection middleware
│   ├── server.js            # Express app entry point
│   ├── .env.example         # Environment variables template
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.jsx  # Global auth state
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   └── Chat.jsx         # Main chat UI
    │   ├── App.jsx              # Routes + protected routes
    │   ├── main.jsx
    │   └── index.css            # Global styles & CSS variables
    ├── index.html
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))


---

### 1. Clone & setup backend

```bash
cd backend

```


Start backend:
```bash
npm run dev
```

---

### 2. Setup frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173`

---

## ✨ Features

- 🔐 **JWT Authentication** — Register & login with secure password hashing
- 💾 **Chat History** — All conversations saved to MongoDB
- 📝 **Markdown Rendering** — AI responses render code blocks, lists, etc.
- 🗂 **Sidebar** — Browse and switch between past conversations
- 🗑️ **Delete Chats** — Remove conversations from history
- 📱 **Collapsible Sidebar** — Clean mobile-friendly layout
- ⌨️ **Auto-resize Input** — Textarea grows as you type

---

## 🛠 Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | React 18, React Router  |
| Styling   | Custom CSS Variables    |
| Backend   | Node.js, Express        |
| Database  | MongoDB, Mongoose       |
| Auth      | JWT, bcryptjs           |
| AI        | GEMINI API    |
| Dev Tool  | Vite, Nodemon           |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint             | Description       |
|--------|----------------------|-------------------|
| POST   | /api/auth/register   | Register new user |
| POST   | /api/auth/login      | Login user        |

### Chat (Protected — requires Bearer token)
| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| POST   | /api/chat/message     | Send message, get AI reply |
| GET    | /api/chat/history     | Get all user chats       |
| GET    | /api/chat/:id         | Get single chat          |
| DELETE | /api/chat/:id         | Delete a chat            |

---

## 🌐 Deployment

**Backend** → [Render](https://render.com) or [Railway](https://railway.app)  
**Frontend** → [Vercel](https://vercel.com) (set `VITE_API_URL` if different domain)  
**Database** → [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier)

---

## 📄 License

MIT — free to use for your resume and portfolio!
