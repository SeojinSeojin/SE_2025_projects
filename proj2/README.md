<!-- CI/CD and quality badges -->
[![Build Status](https://github.com/yashvinshah/SE_2025_projects/actions/workflows/ci.yml/badge.svg)](https://github.com/yashvinshah/SE_2025_projects/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/yashvinshah/SE_2025_projects/graph/badge.svg?token=4FG9EPMKX0)](https://codecov.io/github/yashvinshah/SE_2025_projects)
[![ESLint](https://img.shields.io/badge/code_style-ESLint-blue.svg)](https://eslint.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](docs/LICENSE.md)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)

# Hungry Wolf 🐺
**Not Just Food, A Quest Worth Savoring**

A gamified food-delivery platform that connects customers, restaurants, and delivery partners while supporting local eateries and contributing to a Meal-for-a-Meal donation program.

## 🎯 Project Overview

Hungry Wolf is a full-stack web application built with modern technologies to create an engaging food delivery experience. The platform gamifies the ordering process with points, rewards, and social impact features.

## 🏗️ Architecture

```
hungry-wolf/
├── frontend/          # React frontend
├── backend/          # Node.js backend
└── docs/           # Documentation
```

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Start development servers:**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001

4. **Test & Coverage**
   ```bash
   npm run test
   ```


## 📋 Milestones

### Milestone 1: Onboarding ✅
- [x] Role-specific sign-up and login
- [x] Database integration with Firebase
- [x] Dashboard views for each role

### Milestone 2: Core Order Flow ✅
- [x] Customer cart and order placement
- [x] Restaurant order management
- [x] Delivery partner assignment
- [x] Rating system

### Milestone 3: Gamification ✅
- [x] Points system for orders
- [x] Points display on dashboard
- [x] Rewards and discounts

### Milestone 4: Social Impact ✅
- [x] Local Legends restaurants
- [x] Meal-for-a-Meal donation counter
- [x] Enhanced reward points for local restaurants

## 🛠️ Tech Stack

- **Frontend:** React 18, React Router, React Query
- **Backend:** Node.js, Express.js
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth
- **Styling:** CSS Modules, Responsive Design
- **State Management:** React Query + Context API

## 👥 User Roles

### Customer
- Browse restaurants and menus
- Add items to cart and place orders
- Track order status
- Rate restaurants
- Earn and redeem points

### Restaurant
- Manage menu items
- Accept/reject orders
- Update order status
- View customer ratings

### Delivery Partner
- View assigned orders
- Update delivery status
- Track earnings

## 🎮 Gamification Features

- **Points System:** Earn points for orders (10% of bill)
- **Local Legends:** Extra points (15%) for supporting local restaurants (Local Legends)
- **Social Impact:** Meal-for-a-Meal donation program

## 🔧 Development

### Project Structure
- Modular architecture for easy extension
- Clear separation of concerns
- Comprehensive documentation
- Type-safe development

### For Future Teams
This project is designed to be easily extensible. Key areas for future development:
- Payment integration
- Real-time tracking and notifications
- Advanced analytics
- Mobile app development

## 📚 Documentation

See the `docs/` directory for detailed documentation:
- API documentation
- Installation guidelines
- Code of conduct

## 🤝 Contributing

This project follows software sustainability principles:
- Clear code documentation
- Modular architecture
- Comprehensive testing
- Easy setup and deployment

## 📄 License

MIT License - see LICENSE file for details

### 🔗 Live Demo
You can see the working demo using the link below:  
[View Live Demo for Project 2](https://drive.google.com/file/d/1R85vYgjbKL3zBZsimE7ruI46UfgAdN8x/view?usp=drive_link)

[View Live demo for Project 3](https://youtu.be/l6SIhW_ra_A)

---

This repository uses continuous integration (GitHub Actions), linting (ESLint), automated testing (Jest), and coverage tracking (Codecov). All badges above are live and auto-updated on each commit.
