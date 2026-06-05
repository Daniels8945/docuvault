# DocuVault Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Start the Backend (Terminal 1)

```bash
cd docuvault/backend
python -m venv venv

# Activate virtual environment:
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install --break-system-packages -r requirements.txt
python main.py
```

✅ Backend running at `http://localhost:8000`

### Step 2: Start the Frontend (Terminal 2)

```bash
cd docuvault/frontend
npm install
npm run dev
```

✅ Frontend running at `http://localhost:5173`

### Step 3: Open Your Browser

Navigate to: `http://localhost:5173`

You're ready to go! 🎉

## 📝 What's Pre-configured?

### Organizations
- **Onction Services Limited** - Trading Operations, Legal & Compliance
- **Josephine Consulting Limited** - Strategic Documents  
- **Temitayo Awosika Help Foundation** - Program Documents

### Default User
- **Name**: Olaoluwa
- **Role**: Admin
- **Email**: olaoluwa@onction.com

## 🎯 Quick Actions

1. **Upload a Document**
   - Click "Upload Document" button
   - Drag & drop or select files
   - Add tags (optional)
   - Click "Upload"

2. **Organize in Folders**
   - Click on any folder
   - Upload documents to that folder
   - Use breadcrumbs to navigate back

3. **Submit for Approval**
   - Click on any document
   - Click "Submit for Approval"
   - View in Approvals section

4. **Approve Documents** (Admin only)
   - Go to Approvals page
   - Click on pending document
   - Click "Approve Document"

5. **Search Documents**
   - Use the search bar at the top
   - Search by name or tags
   - Results update in real-time

## 📁 Where Are Files Stored?

Documents are stored in: `backend/uploads/`  
Database is stored in: `backend/docuvault.db`

## 🔧 Troubleshooting

### Backend won't start?
- Make sure Python 3.9+ is installed
- Check if port 8000 is available
- Try: `pip install --break-system-packages fastapi uvicorn sqlmodel python-multipart pydantic`

### Frontend won't start?
- Make sure Node.js 18+ is installed
- Check if port 5173 is available
- Try: `rm -rf node_modules && npm install`

### Can't upload files?
- Check backend is running
- Check browser console for errors
- Verify `uploads/` directory exists in backend folder

## 🎨 Customization

### Change Organization Names
Edit `backend/database.py` in the `init_db()` function

### Change Ports
- **Backend**: Edit `main.py` bottom line: `uvicorn.run(app, host="0.0.0.0", port=8000)`
- **Frontend**: Edit `vite.config.js`: `server: { port: 5173 }`

### Change Color Scheme
Edit `frontend/src/index.css` color classes

## 📚 Next Steps

1. Read full README.md for detailed documentation
2. Check API docs at `http://localhost:8000/docs`
3. Customize for your organization
4. Deploy to production

## 🆘 Need Help?

- Check the full README.md
- Visit API documentation at `/docs`
- Review component code in `frontend/src/components/`

Happy document managing! 📄✨



So create a documet on how i setup everythin and