<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	<!-- Options trading analysis tool with React frontend, Express proxy, company research, trade review with Greeks -->

- [x] Scaffold the Project
	<!-- Created complete project structure with React + Vite, Express server, components, services, and utils -->

- [x] Customize the Project
	<!-- Implemented company research with Yahoo Finance API, trade review with Black-Scholes calculations, dark mode, local storage, CSV export -->

- [x] Install Required Extensions
	<!-- No extensions needed for this project -->

- [x] Compile the Project
	<!-- Project compiles successfully with npm install and npm run dev/server -->

- [x] Create and Run Task
	<!-- npm start runs both servers concurrently -->

- [x] Launch the Project
	<!-- App launches successfully at http://localhost:3000 -->

- [x] Ensure Documentation is Complete
	<!-- README.md created with comprehensive setup and usage instructions -->

<!-- Execution Guidelines
PROGRESS TRACKING:
- All checklist items have been completed successfully
- Project is fully functional and ready for use

COMMUNICATION RULES:
- Keep responses concise and focused on user needs
- Provide clear instructions for usage and troubleshooting

DEVELOPMENT RULES:
- Project uses absolute paths for file operations
- All dependencies properly configured
- Clean, maintainable code structure implemented

FOLDER CREATION RULES:
- Project created in /Users/nareshsanchana/git-practice/options-trading-ai
- Proper directory structure with src/, components/, services/, utils/

EXTENSION INSTALLATION RULES:
- No VS Code extensions required for this project

PROJECT CONTENT RULES:
- Complete options trading analysis tool with all requested features
- Yahoo Finance API integration with CORS proxy
- Black-Scholes options calculations
- Local storage and CSV export functionality
- Responsive UI with dark/light mode

TASK COMPLETION RULES:
- ✅ Project successfully scaffolded and compiled
- ✅ All servers running (frontend on 3000, proxy on 3002)
- ✅ App accessible at http://localhost:3000
- ✅ README.md and documentation complete
- ✅ Ready for user testing and development
-->

## Options Trading Analysis Tool - Complete Setup

This workspace contains a fully functional options trading analysis tool with the following features:

### ✅ Completed Features
- **Company Research Module**: Real-time stock quotes via Yahoo Finance API
- **Trade Review Module**: Options Greeks calculations using Black-Scholes model
- **Data Persistence**: Local storage with CSV export functionality
- **UI/UX**: Dark/light mode toggle, responsive design with Tailwind CSS
- **API Integration**: Express proxy server for Yahoo Finance and Alpha Vantage APIs

### 🚀 Getting Started
1. **Install Dependencies**: `npm install`
2. **Start Application**: `npm start` (runs both frontend and proxy servers)
3. **Access App**: Open http://localhost:3000 in your browser

### 📁 Project Structure
- `src/components/`: React components (CompanyResearch, TradeReview)
- `src/services/`: API integration (marketData.js)
- `src/utils/`: Calculations and storage utilities
- `server.js`: Express API proxy server
- `README.md`: Comprehensive documentation

### 🔧 Key Technologies
- React 18 + Vite for frontend
- Express.js for API proxy
- Tailwind CSS for styling
- Black-Scholes model for options calculations
- Yahoo Finance API for market data

The application is now ready for use and further development!