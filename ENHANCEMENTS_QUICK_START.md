# Quick Start Guide - System Enhancements

## 🚀 Quick Start (5 Minutes)

This guide shows you how to use the new enhancements immediately.

---

## Prerequisites

✅ Backend running on `http://localhost:5000`  
✅ Admin account logged in  
✅ MongoDB running

---

## 1. ⚡ Test Pagination

### Get Paginated States
```bash
# First page (10 items)
curl "http://localhost:5000/api/states?page=1&limit=10"

# Second page with sorting
curl "http://localhost:5000/api/states?page=2&limit=10&sort=name:asc"

# Search California with pagination
curl "http://localhost:5000/api/states?page=1&limit=5&search=california"
```

### From Frontend
```typescript
// In your component
const fetchStates = async (page = 1) => {
  const response = await api.get(`/api/states?page=${page}&limit=10&sort=name:asc`);
  console.log(response.data.pagination); // Pagination metadata
  setStates(response.data.states);
};
```

---

## 2. 🎯 Test Bulk Operations

### Login as Admin First
```bash
# Get your admin token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

Copy the token from response.

### Bulk Activate States
```bash
export TOKEN="your-admin-token-here"

curl -X POST http://localhost:5000/api/states/bulk/toggle-active \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stateIds": ["state_id_1", "state_id_2"],
    "isActive": true
  }'
```

### Bulk Update Prices
```bash
curl -X POST http://localhost:5000/api/states/bulk/update-price \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stateIds": ["state_id_1", "state_id_2"],
    "medicalCardPrice": 150
  }'
```

### Bulk Delete (Use Cautiously!)
```bash
curl -X POST http://localhost:5000/api/states/bulk/delete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stateIds": ["test_state_id"]
  }'
```

---

## 3. 📥📤 Test CSV Import/Export

### Export All States to CSV
```bash
curl -X GET "http://localhost:5000/api/states/export/csv" \
  -H "Authorization: Bearer $TOKEN" \
  --output states-export.csv

# View the exported file
cat states-export.csv
```

### Prepare CSV File for Import

Create `new-states.csv`:
```csv
code,name,abbreviation,region,medicalCardPrice,isActive,notes
TX,Texas,TX,South,140,true,Medical cannabis program
CO,Colorado,CO,West,160,true,Recreational legal
MA,Massachusetts,MA,Northeast,145,true,Adult-use legal
```

### Import States from CSV
```bash
curl -X POST http://localhost:5000/api/states/import/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@new-states.csv"
```

**Response**:
```json
{
  "success": true,
  "message": "Import completed: 3 imported, 0 skipped",
  "imported": 3,
  "skipped": 0,
  "errors": []
}
```

---

## 4. 📊 Check Logs

### View Error Logs
```bash
# Today's error log
cat backend/logs/error-2026-01-24.log

# Full application log (if LOG_ALL=true)
cat backend/logs/app-2026-01-24.log
```

### Enable Full Logging

Add to `backend/.env`:
```env
LOG_ALL=true
```

Restart backend to see all API requests/responses logged.

---

## 5. 🎨 Frontend Usage

### Use Shared Types
```typescript
import type { User, State, Appointment } from '@/types'

// Now you have full type safety
const [user, setUser] = useState<User | null>(null)
const [states, setStates] = useState<State[]>([])
```

### Call Bulk Operations
```typescript
// In your Redux slice or component
const bulkActivateStates = async (stateIds: string[]) => {
  const response = await api.post('/api/states/bulk/toggle-active', {
    stateIds,
    isActive: true
  });
  
  toast.success(response.data.message);
  // Refresh states list
  dispatch(getStates());
};
```

### Download CSV Export
```typescript
const exportStatesToCSV = async () => {
  const response = await api.get('/api/states/export/csv', {
    responseType: 'blob'
  });
  
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'states-export.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
};
```

### Upload CSV Import
```typescript
const importStatesFromCSV = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/api/states/import/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  if (response.data.success) {
    toast.success(response.data.message);
    dispatch(getStates()); // Refresh list
  } else {
    toast.error(response.data.message);
    console.error('Import errors:', response.data.errors);
  }
};
```

---

## 6. 🧪 Quick Test Checklist

- [ ] Pagination works (get states with `?page=1&limit=5`)
- [ ] Sorting works (get states with `?sort=name:desc`)
- [ ] Search works (get states with `?search=california`)
- [ ] Bulk activate/deactivate works
- [ ] Bulk price update works
- [ ] CSV export downloads file
- [ ] CSV import uploads and validates
- [ ] Error logs created in `backend/logs/`
- [ ] TypeScript types work in IDE autocomplete
- [ ] No console errors in frontend

---

## 📝 Sample CSV Template

Download this template for importing states:

```csv
code,name,abbreviation,region,medicalCardPrice,isActive,notes
AL,Alabama,AL,South,120,true,Medical program
AK,Alaska,AK,West,180,true,Recreational legal
AZ,Arizona,AZ,West,150,true,Medical and recreational
AR,Arkansas,AR,South,130,false,Medical only
CA,California,CA,West,150,true,Full adult-use program
```

**Field Rules**:
- `code`: 2 characters, unique, uppercase
- `name`: Full state name, required
- `abbreviation`: 2 characters, uppercase
- `region`: Must be one of: Northeast, Midwest, South, West, Territory
- `medicalCardPrice`: Number >= 0
- `isActive`: true/false or 1/0
- `notes`: Optional

---

## 🔧 Troubleshooting

### "401 Unauthorized" on bulk operations
→ You need to be logged in as admin. Get fresh token from `/api/auth/login`

### "CSV validation failed"
→ Check that all required fields are present and match the schema  
→ Check response.errors array for specific validation messages

### No logs being created
→ Make sure backend has write permissions to `logs/` directory  
→ Errors are always logged; app logs need `LOG_ALL=true`

### Pagination not working
→ Make sure you pass `page` parameter in query string  
→ Without `page`, returns all data (backward compatible)

---

## 🎯 Next Steps

1. **Frontend UI**: Build pagination controls, bulk select checkboxes, CSV upload form
2. **Testing**: Write unit tests for new utilities
3. **Documentation**: Add API examples to Postman collection
4. **Monitoring**: Set up log rotation and monitoring

---

## 📞 Need Help?

1. Check [ENHANCEMENTS_SUMMARY.md](./ENHANCEMENTS_SUMMARY.md) for detailed docs
2. Review error logs in `backend/logs/`
3. Test endpoints with Postman/Insomnia
4. Check browser console for frontend errors

---

**Ready!** All enhancements are live and ready to use! 🚀
