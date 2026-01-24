# Quick Start Guide - States Management Feature

## 🚀 5-Minute Setup

### Step 1: Start the Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Should see: Server running on port 5000

# Terminal 2 - Frontend  
cd frontend
npm run dev
# Should see: Ready on http://localhost:3000
```

### Step 2: Login as Admin
1. Open http://localhost:3000
2. Click "Login"
3. Email: `admin@test.com`
4. Password: `admin123`
5. Click "Sign In"

### Step 3: Access States Management
1. Look at the sidebar on the left
2. Find "States" menu item (only visible to admins)
3. Click it
4. You should see the States Management page

## 📋 What You Can Do

### ➕ Add a New State
1. Click "+ Add New State" button (top right)
2. Fill in the form:
   - **State Code**: `NY` (2 letters)
   - **State Name**: `New York`
   - **Abbreviation**: `NY`
   - **Region**: Select from dropdown
   - **Medical Card Price**: Enter price (e.g., 175)
   - **Notes**: (optional) Any notes
3. Click "Create State"
4. Success message appears ✓

### ✏️ Edit a State
1. Find the state in the table
2. Click "Edit" button
3. Modal opens with filled data
4. **Note**: Code field cannot be changed
5. Update other fields as needed
6. Click "Update State"
7. Changes appear in table immediately

### 🗑️ Delete a State
1. Find the state in the table
2. Click "Delete" button
3. Confirm deletion dialog appears
4. Click "OK" to confirm
5. State removed from list

### 🔄 Toggle Active/Inactive
1. Find the state in the table
2. Click the status badge (green "✓ Active" or gray "○ Inactive")
3. Status changes instantly
4. Useful to disable without deleting

### 🔍 Search & Filter
1. **Search**: Type in the search box to find states by name, code, or abbreviation
2. **Status Filter**: Show All, Active Only, or Inactive Only
3. **Sort**: Sort by Name, Code, or Region
4. Results update instantly as you type/select

## 📊 Dashboard Statistics

At the top of the page, you'll see 4 stat cards:

| Card | Shows |
|------|-------|
| Total States | Count of all states |
| Active States | Count of enabled states |
| Inactive States | Count of disabled states |
| Avg Price | Average medical card price |

## 🎯 Common Workflows

### Scenario 1: Add Multiple New States
1. Click "+ Add New State"
2. Fill form and click "Create State"
3. Repeat step 1-2 for each state
4. All states appear in table

### Scenario 2: Disable a State Temporarily
1. Find state in table
2. Click status badge to toggle inactive
3. State now shows gray "○ Inactive"
4. No deletion needed

### Scenario 3: Update Pricing
1. Find state in table
2. Click "Edit"
3. Change "Medical Card Price"
4. Click "Update State"
5. Price updates in table

### Scenario 4: Find Specific State Quickly
1. Use search box to find state
2. Filter by status if needed
3. Sort if needed
4. State appears in filtered results

## ❌ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| "States" not in sidebar | Make sure you're logged in as admin (admin@test.com) |
| Form won't submit | Check error messages below fields. Code and name must be unique |
| States list empty | Click "+ Add New State" to create your first state |
| Edit button doesn't work | Make sure you're admin and modal should appear |
| Success message disappears | It auto-dismisses after 3 seconds (intentional) |

## 📱 Mobile Friendly

The States Management page works on mobile:
- Table scrolls horizontally on small screens
- Buttons resize for touch
- Sidebar collapses on mobile
- Modal is full-width on small devices

## 🔐 Important Notes

⚠️ **Admin Only Feature**
- Only users with admin role can access states management
- Regular patients/doctors cannot see "States" menu
- API blocks non-admin requests automatically

⚠️ **Data Integrity**
- State codes are immutable (cannot change after creation)
- Deleting a state removes it permanently
- No undo function - be careful with deletions

## 🎓 API Testing (Optional)

If you want to test via API (Postman/Thunder Client):

### Create State
```
POST http://localhost:5000/api/states
Authorization: Bearer <your-admin-token>
Content-Type: application/json

{
  "code": "TX",
  "name": "Texas",
  "abbreviation": "TX",
  "region": "South",
  "medicalCardPrice": 160
}
```

### Get All States
```
GET http://localhost:5000/api/states
```

### Delete State
```
DELETE http://localhost:5000/api/states/<state-id>
Authorization: Bearer <your-admin-token>
```

## 🎉 You're All Set!

That's it! You can now manage states from the admin dashboard. 

**Next Steps**:
- Create a few test states
- Try searching and filtering
- Toggle some states on/off
- Edit state details
- Check the statistics update

For more detailed information, see:
- [STATES_FEATURE_README.md](./STATES_FEATURE_README.md) - Complete documentation
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details

---

**Questions?** Check the troubleshooting section above or review the detailed documentation files.
