#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  AgroFin: multi-user personal finance + farm OS. Each user must have their own isolated
  financial data (accounts, incomes, expenses, crops, loans, peers, assets). Admin role can
  create/activate/deactivate users, change roles, reset passwords, and "Manage As" any user
  to edit their data. Data must be persisted in MongoDB and survive reload/logout.

backend:
  - task: "Auth: default admin auto-seed + login + token verification"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js, /app/lib/agrofin/auth.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "On first request /api ensures a default admin (username 'admin', password 'admin123'). POST /api/auth/login returns HMAC-signed token. GET /api/auth/me validates token. Inactive users cannot log in."

  - task: "Per-user data isolation (GET/PUT /api/data?userId=...)"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Each user has a single document in 'userData' collection keyed by userId. GET returns own data; admins can pass ?userId= to fetch any user's data. PUT replaces 7 arrays (accounts, incomes, expenses, crops, loans, peers, assets). Non-admins cannot fetch/modify another user's data (must return 403). Data must persist across logout/login."

  - task: "Admin user CRUD: list, create, patch (active/role/password), delete"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/users creates new user with seeded data document. PATCH /api/users/:id supports {active, role, displayName, password}. DELETE /api/users/:id removes user and their userData. Non-admin must get 403. Admin cannot delete self."

frontend:
  - task: "Login screen + auth gate + per-user data loading"
    implemented: true
    working: "NA"
    file: "/app/components/agrofin/AgroFinApp.jsx, /app/lib/agrofin/store.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Unauthenticated users see LoginScreen. After login, data loads for me.id. Logout clears token + local state. Admin can 'Manage As' another user; state then loads/saves for that userId."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Auth: default admin auto-seed + login + token verification"
    - "Per-user data isolation (GET/PUT /api/data?userId=...)"
    - "Admin user CRUD: list, create, patch (active/role/password), delete"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Please verify the AgroFin multi-user backend. Critical scenarios:
      1) Auth flow:
         a) GET /api/auth/me without token → 401.
         b) POST /api/auth/login with admin/admin123 → returns token + user.
         c) GET /api/auth/me with bearer token → returns user.
         d) Login with wrong password or inactive user → 401.
      2) Per-user data isolation:
         a) As admin, POST /api/users to create user 'priya' (password 'pass1234'); confirm
            she gets a seeded userData document.
         b) Login as priya; GET /api/data → her seeded data.
         c) PUT /api/data with modified data; GET /api/data again → changes persisted.
         d) Create a second user 'rohan'; login as rohan; his data must be totally
            independent (his own seed/empty, NOT priya's).
         e) As priya, try GET /api/data?userId=<rohan.id> → expect 403 forbidden.
         f) As admin, GET /api/data?userId=<priya.id> → returns priya's data (admin allowed).
         g) Logout priya, login again → data still intact (persistence check).
      3) Admin user management:
         a) As non-admin, GET /api/users → 403.
         b) As admin, PATCH /api/users/<priya.id> {active:false}; then login as priya → 401.
         c) Reactivate; reset password via PATCH {password:'newpw'}; login with new password.
         d) Change role to 'admin' via PATCH; verify GET /api/users now allowed for priya.
         e) DELETE /api/users/<rohan.id> as admin; userData for rohan must also be removed
            (subsequent GET /api/data?userId=<rohan.id> as admin should auto-create empty doc).
         f) Admin DELETE on self → 400.
      4) Data integrity:
         a) PUT /api/data with malformed payload (non-array fields) → request stored only
            the 7 known array fields; extra fields ignored.
         b) Multiple rapid PUTs simulate the debounced save; last-write wins, no data loss
            between users.
      Base URL: use NEXT_PUBLIC_BASE_URL from /app/.env (https://hybrid-harvest-2.preview.emergentagent.com)
      and prefix all calls with /api. Auth tokens go in 'Authorization: Bearer <token>' header.
