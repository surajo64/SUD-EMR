# SUD EMR System

MERN Stack Electronic Medical Record System.

## Prerequisites
- Node.js
- MongoDB (Ensure it is running at `mongodb://127.0.0.1:27017` or update `backend/.env`)

## Setup

### Backend
1. Navigate to `backend` folder.
2. Run `npm install`.
3. Create `.env` file (already created).
4. Run `npm run dev` to start the server.
5. Run `node seeder.js` to seed initial data (Admin, Doctor, Pharmacist).

### Frontend
1. Navigate to `frontend` folder.
2. Run `npm install`.
3. Run `npm run dev` to start the development server.

## Features Implemented
- Project Structure (Backend & Frontend)
- Authentication (Login, Register, JWT)
- Patient Management (Basic Model & Routes)
- Tailwind CSS Setup

## Next Steps
- Complete Doctor, Pharmacy, Lab, and Radiology modules.
- Connect Frontend to Backend APIs for all features.
