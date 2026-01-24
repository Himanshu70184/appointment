# Test Credentials & Dummy Data

## 🧪 Payment Testing

### Test Credit Cards (Development Mode)

The system automatically detects `NODE_ENV=development` and accepts these test cards:

| Card Type | Card Number | Expiration | CVV | Billing ZIP |
|-----------|-------------|------------|-----|-------------|
| **Visa** (Primary) | `4111111111111111` | Any future date (e.g., `12/28`) | `123` | `12345` |
| Visa (Alt) | `4007000000027` | `12/28` | `123` | `12345` |
| **Mastercard** | `5424000000000015` | `12/28` | `123` | `12345` |
| Mastercard (Alt) | `5105105105105100` | `12/28` | `123` | `12345` |
| American Express | `378282246310005` | `12/28` | `1234` | `12345` |
| Discover | `6011111111111117` | `12/28` | `123` | `12345` |

### Recommended Test Card
**Use this for quick testing:**
```
Card Number:    4111111111111111
Expiration:     12/28
CVV:            123
Billing Address: 123 Test St
City:           Test City
State:          NY
ZIP:            12345
```

---

## 📋 Sample Patient Booking Data

### Regular Patient (18+)
```
First Name:     John
Last Name:      Doe
Email:          john.doe.test@example.com
Phone:          5551234567
Date of Birth:  01/15/1995 (Age: 31)
Password:       Test123!
```

### Minor Patient (<18)
```
First Name:     Jane
Last Name:      Smith
Email:          jane.smith.test@example.com
Phone:          5559876543
Date of Birth:  06/20/2010 (Age: 15)
Password:       Test123!

Guardian Info:
  Name:         Mary Smith
  Phone:        5551112222
  Address:      456 Guardian Ave, Test City, NY 12345
```

---

## 👤 Pre-existing Test Accounts

If you ran `npm run create-test-data`:

### Admin Account
```
Email:    admin@test.com
Password: admin123
Role:     Admin (can approve minor appointments)
```

### Doctor Accounts
```
Email:    doctor1@test.com
Password: doctor123
State:    PA (Pennsylvania)

Email:    doctor2@test.com
Password: doctor123
State:    CA (California)
```

### Patient Accounts
```
Email:    patient1@test.com
Password: patient123

Email:    patient2@test.com
Password: patient123
```

---

## 🏥 Test States & Medical Cards

### Active States
- Pennsylvania (PA)
- California (CA)
- New York (NY)
- Florida (FL)
- Texas (TX)

### Medical Card Types
- **Med Card Initial Certification** - $75.00
- **Med Card Renewal** - $50.00
- **Med Card Follow-up** - $40.00

---

## 🎫 Test Coupons

If you have coupons in the system, create test ones:

### Sample Coupon Codes
```
Code:          SAVE10
Type:          Percentage
Discount:      10%
Valid Until:   12/31/2026

Code:          FLAT20
Type:          Fixed Amount
Discount:      $20.00
Valid Until:   12/31/2026
```

To create coupons, use the admin portal at `/coupons` after logging in as admin.

---

## 🔄 Complete Test Booking Flow

### Step 1: Start Booking
1. Visit: `http://localhost:3000/patient/book`
2. Select State: **Pennsylvania**
3. Select Card Type: **Med Card Initial Certification - $75.00**
4. Pick any available date and time slot

### Step 2: Patient Information
```
First Name:       Test
Last Name:        User
Email:            testuser123@example.com
Phone:            5551234567
Date of Birth:    05/15/1990 (Adult - no guardian needed)
Password:         Test123!
Confirm Password: Test123!
```

### Step 3: Payment Information
```
Card Number:      4111111111111111
Expiration Date:  12/28
CVV:              123
Billing Address:  123 Test Street
City:             Harrisburg
State:            PA
ZIP:              12345
```

### Step 4: Optional - Apply Coupon
```
Coupon Code: SAVE10 (if exists)
```

### Step 5: Submit & Complete
- Click "Book Appointment & Pay"
- ✅ Redirected to intake form
- Fill out medical intake
- ✅ Appointment confirmed!

---

## 🧒 Testing Minor Approval Flow

### Book as Minor
1. Use Date of Birth: `06/20/2010` (Age 15)
2. Fill guardian information:
   ```
   Guardian Name:    Parent Name
   Guardian Phone:   5559999999
   Guardian Address: 789 Parent Ave, Test City, PA 12345
   ```
3. Complete payment with test card
4. ✅ Status will be **"approval"** (pending admin review)

### Admin Approval
1. Login as admin: `admin@test.com` / `admin123`
2. Go to: `http://localhost:3000/appointments`
3. Find appointment with status **"approval"**
4. Click "Approve Guardian"
5. ✅ Status changes to **"scheduled"**
6. Patient receives notification

---

## 🚨 Testing Error Scenarios

### Invalid Card (Test Mode)
```
Card Number: 1234567890123456
Expected:    ❌ "Invalid test card" error
```

### Expired Card
```
Card Number:  4111111111111111
Expiration:   01/20 (past date)
Expected:     ❌ Should fail validation
```

### Slot Conflict
1. Book appointment for specific time
2. Try booking same time/doctor again
3. Expected: ❌ "Slot already booked" error

### Intake Deadline
1. Book appointment for today (if possible)
2. Wait until 30 minutes before or less
3. Try to submit intake
4. Expected: ❌ "Deadline passed" error

---

## 🔧 Development Commands

### Backend
```bash
cd backend
npm run dev                    # Start dev server
npm run create-test-data       # Populate test accounts
```

### Frontend
```bash
cd frontend
npm run dev                    # Start Next.js dev server
npm run build                  # Production build
npm run lint                   # Check for errors
```

### Database
```bash
# If using MongoDB locally
mongosh
use ehr_appointment
db.users.find()                # View users
db.appointments.find()         # View appointments
db.payments.find()             # View payments
```

---

## 🎯 Quick Test Checklist

- [ ] Book regular patient appointment
- [ ] Book minor patient appointment
- [ ] Admin approve minor appointment
- [ ] Submit intake form
- [ ] Apply coupon code
- [ ] Test payment with valid test card
- [ ] Test payment with invalid card
- [ ] Check intake deadline enforcement
- [ ] Verify email notifications
- [ ] Test guest checkout (existing email)

---

## 🐛 Troubleshooting

### "Payment failed" Error
**Check:**
- `NODE_ENV=development` in `.env`
- Using valid test card: `4111111111111111`
- Card format: 16 digits, no spaces

### "Slot already booked" Error
**Solution:**
- Choose a different time slot
- Or delete existing appointment from database

### "Intake deadline passed" Error
**Solution:**
- Book appointment for tomorrow or later
- Submit intake form immediately after booking

### Backend not detecting test mode
**Check `.env` file:**
```env
NODE_ENV=development
```

---

## 📞 Support

If you encounter issues:
1. Check console logs (both frontend & backend)
2. Verify `.env` configuration
3. Clear browser cache/cookies
4. Restart both servers

---

**Last Updated:** January 24, 2026  
**Valid For:** Development/Testing Environment Only  
**Production:** Use real Authorize.Net credentials and remove test mode
