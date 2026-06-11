#!/usr/bin/env python3
"""
AgroFin Backend API Test Suite
Tests multi-user data isolation, auth, and admin user management
"""
import requests
import json
import time
from typing import Dict, Optional

# Base URL from .env
BASE_URL = "https://hybrid-harvest-2.preview.emergentagent.com/api"

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
    
    def add_pass(self, test_name: str):
        self.passed.append(test_name)
        print(f"✅ PASS: {test_name}")
    
    def add_fail(self, test_name: str, reason: str):
        self.failed.append((test_name, reason))
        print(f"❌ FAIL: {test_name}")
        print(f"   Reason: {reason}")
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Total Passed: {len(self.passed)}")
        print(f"Total Failed: {len(self.failed)}")
        if self.failed:
            print("\nFailed Tests:")
            for name, reason in self.failed:
                print(f"  - {name}: {reason}")
        print("="*80)
        return len(self.failed) == 0

result = TestResult()

def make_request(method: str, endpoint: str, token: Optional[str] = None, 
                 json_data: Optional[Dict] = None, params: Optional[Dict] = None):
    """Helper to make API requests"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    try:
        if method == 'GET':
            resp = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == 'POST':
            resp = requests.post(url, headers=headers, json=json_data, timeout=10)
        elif method == 'PUT':
            resp = requests.put(url, headers=headers, json=json_data, timeout=10)
        elif method == 'PATCH':
            resp = requests.patch(url, headers=headers, json=json_data, timeout=10)
        elif method == 'DELETE':
            resp = requests.delete(url, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return resp
    except Exception as e:
        print(f"Request error: {e}")
        return None

print("="*80)
print("AGROFIN BACKEND API TEST SUITE")
print("="*80)
print(f"Base URL: {BASE_URL}\n")

# Store test data
admin_token = None
priya_user = None
priya_token = None
rohan_user = None
rohan_token = None

# ============================================================================
# 1. AUTH FLOW TESTS
# ============================================================================
print("\n" + "="*80)
print("1. AUTH FLOW TESTS")
print("="*80)

# Test 1.1: GET /api/auth/me without token → 401
print("\n[Test 1.1] GET /api/auth/me without token should return 401")
resp = make_request('GET', '/auth/me')
if resp and resp.status_code == 401:
    result.add_pass("Auth: /auth/me without token returns 401")
else:
    result.add_fail("Auth: /auth/me without token returns 401", 
                   f"Expected 401, got {resp.status_code if resp else 'no response'}")

# Test 1.2: POST /api/auth/login with admin credentials
print("\n[Test 1.2] POST /api/auth/login with admin/admin123")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'admin',
    'password': 'admin123'
})
if resp and resp.status_code == 200:
    data = resp.json()
    if 'token' in data and 'user' in data:
        admin_token = data['token']
        admin_user = data['user']
        print(f"   Admin user: {admin_user}")
        result.add_pass("Auth: admin login returns token and user")
    else:
        result.add_fail("Auth: admin login returns token and user", 
                       f"Missing token or user in response: {data}")
else:
    result.add_fail("Auth: admin login returns token and user", 
                   f"Expected 200, got {resp.status_code if resp else 'no response'}")

# Test 1.3: GET /api/auth/me with valid token
print("\n[Test 1.3] GET /api/auth/me with valid admin token")
if admin_token:
    resp = make_request('GET', '/auth/me', token=admin_token)
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'user' in data and data['user']['username'] == 'admin':
            result.add_pass("Auth: /auth/me with valid token returns user")
        else:
            result.add_fail("Auth: /auth/me with valid token returns user", 
                           f"Unexpected user data: {data}")
    else:
        result.add_fail("Auth: /auth/me with valid token returns user", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Auth: /auth/me with valid token returns user", "No admin token available")

# Test 1.4: POST /api/auth/login with wrong password
print("\n[Test 1.4] POST /api/auth/login with wrong password")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'admin',
    'password': 'wrongpassword'
})
if resp and resp.status_code == 401:
    result.add_pass("Auth: login with wrong password returns 401")
else:
    result.add_fail("Auth: login with wrong password returns 401", 
                   f"Expected 401, got {resp.status_code if resp else 'no response'}")

# ============================================================================
# 2. PER-USER DATA ISOLATION TESTS
# ============================================================================
print("\n" + "="*80)
print("2. PER-USER DATA ISOLATION TESTS")
print("="*80)

# Test 2.1: Create user 'priya_test'
print("\n[Test 2.1] Create user 'priya_test' as admin")
if admin_token:
    resp = make_request('POST', '/users', token=admin_token, json_data={
        'username': 'priya_test',
        'displayName': 'Priya',
        'password': 'pass1234',
        'role': 'user'
    })
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'user' in data:
            priya_user = data['user']
            print(f"   Created user: {priya_user}")
            result.add_pass("User creation: priya_test created successfully")
        else:
            result.add_fail("User creation: priya_test created successfully", 
                           f"Missing user in response: {data}")
    else:
        result.add_fail("User creation: priya_test created successfully", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}: {resp.text if resp else ''}")
else:
    result.add_fail("User creation: priya_test created successfully", "No admin token available")

# Test 2.2: Create user 'rohan_test'
print("\n[Test 2.2] Create user 'rohan_test' as admin")
if admin_token:
    resp = make_request('POST', '/users', token=admin_token, json_data={
        'username': 'rohan_test',
        'displayName': 'Rohan',
        'password': 'pass1234',
        'role': 'user'
    })
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'user' in data:
            rohan_user = data['user']
            print(f"   Created user: {rohan_user}")
            result.add_pass("User creation: rohan_test created successfully")
        else:
            result.add_fail("User creation: rohan_test created successfully", 
                           f"Missing user in response: {data}")
    else:
        result.add_fail("User creation: rohan_test created successfully", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User creation: rohan_test created successfully", "No admin token available")

# Test 2.3: Login as priya_test
print("\n[Test 2.3] Login as priya_test")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'priya_test',
    'password': 'pass1234'
})
if resp and resp.status_code == 200:
    data = resp.json()
    if 'token' in data:
        priya_token = data['token']
        result.add_pass("Auth: priya_test login successful")
    else:
        result.add_fail("Auth: priya_test login successful", f"Missing token: {data}")
else:
    result.add_fail("Auth: priya_test login successful", 
                   f"Expected 200, got {resp.status_code if resp else 'no response'}")

# Test 2.4: GET /api/data as priya - should return seeded data
print("\n[Test 2.4] GET /api/data as priya_test (should have seeded data)")
if priya_token:
    resp = make_request('GET', '/data', token=priya_token)
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'data' in data:
            priya_data = data['data']
            # Check for seeded data arrays
            has_accounts = len(priya_data.get('accounts', [])) > 0
            has_expenses = len(priya_data.get('expenses', [])) > 0
            has_incomes = len(priya_data.get('incomes', [])) > 0
            print(f"   Priya's data: {len(priya_data.get('accounts', []))} accounts, "
                  f"{len(priya_data.get('expenses', []))} expenses, "
                  f"{len(priya_data.get('incomes', []))} incomes")
            if has_accounts and has_expenses and has_incomes:
                result.add_pass("Data isolation: priya gets seeded data")
            else:
                result.add_fail("Data isolation: priya gets seeded data", 
                               "Seeded data arrays are empty")
        else:
            result.add_fail("Data isolation: priya gets seeded data", f"Missing data: {data}")
    else:
        result.add_fail("Data isolation: priya gets seeded data", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data isolation: priya gets seeded data", "No priya token available")

# Test 2.5: PUT /api/data as priya with modified data
print("\n[Test 2.5] PUT /api/data as priya_test with marker expense")
if priya_token and priya_data:
    # Add a marker expense
    modified_data = priya_data.copy()
    modified_data['expenses'] = priya_data.get('expenses', []) + [{
        'id': 'priya_marker_x1',
        'label': 'Priya marker',
        'category': 'Household',
        'amount': 9999,
        'date': '2025-01-01'
    }]
    resp = make_request('PUT', '/data', token=priya_token, json_data={'data': modified_data})
    if resp and resp.status_code == 200:
        result.add_pass("Data persistence: priya PUT data successful")
    else:
        result.add_fail("Data persistence: priya PUT data successful", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data persistence: priya PUT data successful", 
                   "No priya token or data available")

# Test 2.6: GET /api/data as priya again - should contain marker
print("\n[Test 2.6] GET /api/data as priya_test (verify marker persisted)")
if priya_token:
    resp = make_request('GET', '/data', token=priya_token)
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'data' in data:
            expenses = data['data'].get('expenses', [])
            has_marker = any(e.get('label') == 'Priya marker' for e in expenses)
            if has_marker:
                result.add_pass("Data persistence: priya's marker expense persisted")
            else:
                result.add_fail("Data persistence: priya's marker expense persisted", 
                               f"Marker not found in expenses: {expenses}")
        else:
            result.add_fail("Data persistence: priya's marker expense persisted", 
                           f"Missing data: {data}")
    else:
        result.add_fail("Data persistence: priya's marker expense persisted", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data persistence: priya's marker expense persisted", 
                   "No priya token available")

# Test 2.7: Login as rohan_test
print("\n[Test 2.7] Login as rohan_test")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'rohan_test',
    'password': 'pass1234'
})
if resp and resp.status_code == 200:
    data = resp.json()
    if 'token' in data:
        rohan_token = data['token']
        result.add_pass("Auth: rohan_test login successful")
    else:
        result.add_fail("Auth: rohan_test login successful", f"Missing token: {data}")
else:
    result.add_fail("Auth: rohan_test login successful", 
                   f"Expected 200, got {resp.status_code if resp else 'no response'}")

# Test 2.8: GET /api/data as rohan - should NOT contain Priya's marker
print("\n[Test 2.8] GET /api/data as rohan_test (should NOT have Priya's marker)")
if rohan_token:
    resp = make_request('GET', '/data', token=rohan_token)
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'data' in data:
            rohan_data = data['data']
            expenses = rohan_data.get('expenses', [])
            has_priya_marker = any(e.get('label') == 'Priya marker' for e in expenses)
            print(f"   Rohan's expenses: {[e.get('label') for e in expenses]}")
            if not has_priya_marker:
                result.add_pass("Data isolation: rohan does NOT see priya's marker")
            else:
                result.add_fail("Data isolation: rohan does NOT see priya's marker", 
                               "Priya's marker found in Rohan's data - DATA LEAK!")
        else:
            result.add_fail("Data isolation: rohan does NOT see priya's marker", 
                           f"Missing data: {data}")
    else:
        result.add_fail("Data isolation: rohan does NOT see priya's marker", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data isolation: rohan does NOT see priya's marker", 
                   "No rohan token available")

# Test 2.9: As rohan, try to access priya's data - should get 403
print("\n[Test 2.9] GET /api/data?userId=<priya.id> as rohan (should be 403)")
if rohan_token and priya_user:
    resp = make_request('GET', '/data', token=rohan_token, 
                       params={'userId': priya_user['id']})
    if resp and resp.status_code == 403:
        result.add_pass("Data isolation: non-admin cannot access other user's data (403)")
    else:
        result.add_fail("Data isolation: non-admin cannot access other user's data (403)", 
                       f"Expected 403, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data isolation: non-admin cannot access other user's data (403)", 
                   "Missing rohan token or priya user")

# Test 2.10: As admin, access priya's data - should succeed
print("\n[Test 2.10] GET /api/data?userId=<priya.id> as admin (should succeed)")
if admin_token and priya_user:
    resp = make_request('GET', '/data', token=admin_token, 
                       params={'userId': priya_user['id']})
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'data' in data:
            expenses = data['data'].get('expenses', [])
            has_marker = any(e.get('label') == 'Priya marker' for e in expenses)
            if has_marker:
                result.add_pass("Data isolation: admin can access priya's data with marker")
            else:
                result.add_fail("Data isolation: admin can access priya's data with marker", 
                               "Marker not found in priya's data when accessed by admin")
        else:
            result.add_fail("Data isolation: admin can access priya's data with marker", 
                           f"Missing data: {data}")
    else:
        result.add_fail("Data isolation: admin can access priya's data with marker", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data isolation: admin can access priya's data with marker", 
                   "Missing admin token or priya user")

# Test 2.11: Re-login as priya and verify data persistence
print("\n[Test 2.11] Re-login as priya_test and verify marker still exists")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'priya_test',
    'password': 'pass1234'
})
if resp and resp.status_code == 200:
    data = resp.json()
    new_priya_token = data.get('token')
    if new_priya_token:
        resp = make_request('GET', '/data', token=new_priya_token)
        if resp and resp.status_code == 200:
            data = resp.json()
            expenses = data['data'].get('expenses', [])
            has_marker = any(e.get('label') == 'Priya marker' for e in expenses)
            if has_marker:
                result.add_pass("Data persistence: priya's data persists after re-login")
            else:
                result.add_fail("Data persistence: priya's data persists after re-login", 
                               "Marker lost after re-login")
        else:
            result.add_fail("Data persistence: priya's data persists after re-login", 
                           f"GET failed: {resp.status_code if resp else 'no response'}")
    else:
        result.add_fail("Data persistence: priya's data persists after re-login", 
                       "Re-login failed to return token")
else:
    result.add_fail("Data persistence: priya's data persists after re-login", 
                   f"Re-login failed: {resp.status_code if resp else 'no response'}")

# ============================================================================
# 3. ADMIN USER MANAGEMENT TESTS
# ============================================================================
print("\n" + "="*80)
print("3. ADMIN USER MANAGEMENT TESTS")
print("="*80)

# Test 3.1: As non-admin (priya), try GET /api/users - should get 403
print("\n[Test 3.1] GET /api/users as priya (non-admin) - should be 403")
if priya_token:
    resp = make_request('GET', '/users', token=priya_token)
    if resp and resp.status_code == 403:
        result.add_pass("User management: non-admin cannot list users (403)")
    else:
        result.add_fail("User management: non-admin cannot list users (403)", 
                       f"Expected 403, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User management: non-admin cannot list users (403)", 
                   "No priya token available")

# Test 3.2: As admin, GET /api/users - should list all users
print("\n[Test 3.2] GET /api/users as admin")
if admin_token:
    resp = make_request('GET', '/users', token=admin_token)
    if resp and resp.status_code == 200:
        data = resp.json()
        if 'users' in data:
            users = data['users']
            usernames = [u['username'] for u in users]
            print(f"   Users: {usernames}")
            has_admin = 'admin' in usernames
            has_priya = 'priya_test' in usernames
            has_rohan = 'rohan_test' in usernames
            if has_admin and has_priya and has_rohan:
                result.add_pass("User management: admin can list all users")
            else:
                result.add_fail("User management: admin can list all users", 
                               f"Missing expected users. Found: {usernames}")
        else:
            result.add_fail("User management: admin can list all users", 
                           f"Missing users array: {data}")
    else:
        result.add_fail("User management: admin can list all users", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User management: admin can list all users", "No admin token available")

# Test 3.3: As admin, PATCH /api/users/<priya.id> {active: false}
print("\n[Test 3.3] PATCH /api/users/<priya.id> {active: false} as admin")
if admin_token and priya_user:
    resp = make_request('PATCH', f'/users/{priya_user["id"]}', 
                       token=admin_token, json_data={'active': False})
    if resp and resp.status_code == 200:
        result.add_pass("User management: admin can deactivate user")
    else:
        result.add_fail("User management: admin can deactivate user", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User management: admin can deactivate user", 
                   "Missing admin token or priya user")

# Test 3.4: Try to login as priya (inactive) - should get 401
print("\n[Test 3.4] Login as priya_test (inactive) - should be 401")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'priya_test',
    'password': 'pass1234'
})
if resp and resp.status_code == 401:
    result.add_pass("User management: inactive user cannot login (401)")
else:
    result.add_fail("User management: inactive user cannot login (401)", 
                   f"Expected 401, got {resp.status_code if resp else 'no response'}")

# Test 3.5: As admin, reactivate priya and change password
print("\n[Test 3.5] PATCH /api/users/<priya.id> {active: true, password: 'newpw99'}")
if admin_token and priya_user:
    resp = make_request('PATCH', f'/users/{priya_user["id"]}', 
                       token=admin_token, json_data={'active': True, 'password': 'newpw99'})
    if resp and resp.status_code == 200:
        result.add_pass("User management: admin can reactivate and reset password")
    else:
        result.add_fail("User management: admin can reactivate and reset password", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User management: admin can reactivate and reset password", 
                   "Missing admin token or priya user")

# Test 3.6: Login as priya with new password
print("\n[Test 3.6] Login as priya_test with new password 'newpw99'")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'priya_test',
    'password': 'newpw99'
})
if resp and resp.status_code == 200:
    data = resp.json()
    if 'token' in data:
        priya_token = data['token']
        result.add_pass("User management: login with new password successful")
    else:
        result.add_fail("User management: login with new password successful", 
                       f"Missing token: {data}")
else:
    result.add_fail("User management: login with new password successful", 
                   f"Expected 200, got {resp.status_code if resp else 'no response'}")

# Test 3.7: Try login as priya with old password - should fail
print("\n[Test 3.7] Login as priya_test with old password 'pass1234' - should be 401")
resp = make_request('POST', '/auth/login', json_data={
    'username': 'priya_test',
    'password': 'pass1234'
})
if resp and resp.status_code == 401:
    result.add_pass("User management: old password no longer works (401)")
else:
    result.add_fail("User management: old password no longer works (401)", 
                   f"Expected 401, got {resp.status_code if resp else 'no response'}")

# Test 3.8: As admin, change priya's role to admin
print("\n[Test 3.8] PATCH /api/users/<priya.id> {role: 'admin'}")
if admin_token and priya_user:
    resp = make_request('PATCH', f'/users/{priya_user["id"]}', 
                       token=admin_token, json_data={'role': 'admin'})
    if resp and resp.status_code == 200:
        result.add_pass("User management: admin can change user role to admin")
    else:
        result.add_fail("User management: admin can change user role to admin", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User management: admin can change user role to admin", 
                   "Missing admin token or priya user")

# Test 3.9: As priya (now admin), GET /api/users - should succeed
print("\n[Test 3.9] GET /api/users as priya (now admin) - should succeed")
if priya_token:
    resp = make_request('GET', '/users', token=priya_token)
    if resp and resp.status_code == 200:
        result.add_pass("User management: promoted user can access admin endpoints")
    else:
        result.add_fail("User management: promoted user can access admin endpoints", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User management: promoted user can access admin endpoints", 
                   "No priya token available")

# Test 3.10: As admin, DELETE /api/users/<rohan.id>
print("\n[Test 3.10] DELETE /api/users/<rohan.id> as admin")
if admin_token and rohan_user:
    resp = make_request('DELETE', f'/users/{rohan_user["id"]}', token=admin_token)
    if resp and resp.status_code == 200:
        result.add_pass("User management: admin can delete user")
        # Verify rohan is gone
        resp = make_request('GET', '/users', token=admin_token)
        if resp and resp.status_code == 200:
            users = resp.json().get('users', [])
            usernames = [u['username'] for u in users]
            if 'rohan_test' not in usernames:
                result.add_pass("User management: deleted user not in list")
            else:
                result.add_fail("User management: deleted user not in list", 
                               "rohan_test still appears in user list")
    else:
        result.add_fail("User management: admin can delete user", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("User management: admin can delete user", 
                   "Missing admin token or rohan user")

# Test 3.11: As admin, try to DELETE self - should get 400
print("\n[Test 3.11] DELETE /api/users/<admin.id> (self-delete) - should be 400")
if admin_token:
    # Get admin user ID
    resp = make_request('GET', '/auth/me', token=admin_token)
    if resp and resp.status_code == 200:
        admin_id = resp.json()['user']['id']
        resp = make_request('DELETE', f'/users/{admin_id}', token=admin_token)
        if resp and resp.status_code == 400:
            result.add_pass("User management: admin cannot delete self (400)")
        else:
            result.add_fail("User management: admin cannot delete self (400)", 
                           f"Expected 400, got {resp.status_code if resp else 'no response'}")
    else:
        result.add_fail("User management: admin cannot delete self (400)", 
                       "Could not get admin user ID")
else:
    result.add_fail("User management: admin cannot delete self (400)", 
                   "No admin token available")

# ============================================================================
# 4. DATA INTEGRITY EDGE CASES
# ============================================================================
print("\n" + "="*80)
print("4. DATA INTEGRITY EDGE CASES")
print("="*80)

# Test 4.1: PUT with malformed data (non-array fields, extra fields)
print("\n[Test 4.1] PUT /api/data with malformed payload")
if priya_token:
    malformed_data = {
        'expenses': 'not-an-array',  # Should be coerced to []
        'incomes': [{'id': 'i1', 'source': 'X', 'amount': 100, 'date': '2025-01-01', 'category': 'Salary'}],
        'accounts': [],
        'crops': [],
        'loans': [],
        'peers': [],
        'assets': [],
        'junk': 'ignore me'  # Should be ignored
    }
    resp = make_request('PUT', '/data', token=priya_token, json_data={'data': malformed_data})
    if resp and resp.status_code == 200:
        # Verify the data was cleaned
        resp = make_request('GET', '/data', token=priya_token)
        if resp and resp.status_code == 200:
            data = resp.json()['data']
            expenses = data.get('expenses', None)
            incomes = data.get('incomes', None)
            has_junk = 'junk' in data
            
            if isinstance(expenses, list) and len(expenses) == 0:
                result.add_pass("Data integrity: non-array expenses coerced to []")
            else:
                result.add_fail("Data integrity: non-array expenses coerced to []", 
                               f"expenses not coerced: {expenses}")
            
            if isinstance(incomes, list) and len(incomes) == 1:
                result.add_pass("Data integrity: valid incomes array preserved")
            else:
                result.add_fail("Data integrity: valid incomes array preserved", 
                               f"incomes not preserved: {incomes}")
            
            if not has_junk:
                result.add_pass("Data integrity: extra fields ignored")
            else:
                result.add_fail("Data integrity: extra fields ignored", 
                               "junk field was stored")
        else:
            result.add_fail("Data integrity: malformed data handling", 
                           "Could not verify cleaned data")
    else:
        result.add_fail("Data integrity: malformed data handling", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data integrity: malformed data handling", "No priya token available")

# Test 4.2: Rapid PUTs (last-write wins)
print("\n[Test 4.2] Two rapid PUTs (last-write wins)")
if priya_token:
    first_data = {
        'accounts': [{'id': 'a1', 'name': 'first', 'balance': 1, 'type': 'bank', 'color': '#000'}],
        'incomes': [],
        'expenses': [],
        'crops': [],
        'loans': [],
        'peers': [],
        'assets': []
    }
    second_data = {
        'accounts': [{'id': 'a2', 'name': 'second', 'balance': 2, 'type': 'bank', 'color': '#000'}],
        'incomes': [],
        'expenses': [],
        'crops': [],
        'loans': [],
        'peers': [],
        'assets': []
    }
    
    resp1 = make_request('PUT', '/data', token=priya_token, json_data={'data': first_data})
    resp2 = make_request('PUT', '/data', token=priya_token, json_data={'data': second_data})
    
    if resp1 and resp2 and resp1.status_code == 200 and resp2.status_code == 200:
        resp = make_request('GET', '/data', token=priya_token)
        if resp and resp.status_code == 200:
            data = resp.json()['data']
            accounts = data.get('accounts', [])
            if len(accounts) == 1 and accounts[0]['name'] == 'second':
                result.add_pass("Data integrity: last-write wins on rapid PUTs")
            else:
                result.add_fail("Data integrity: last-write wins on rapid PUTs", 
                               f"Expected 'second', got: {accounts}")
        else:
            result.add_fail("Data integrity: last-write wins on rapid PUTs", 
                           "Could not verify final data")
    else:
        result.add_fail("Data integrity: last-write wins on rapid PUTs", 
                       "One or both PUTs failed")
else:
    result.add_fail("Data integrity: last-write wins on rapid PUTs", "No priya token available")

# Test 4.3: GET data for user with no userData doc (auto-create)
print("\n[Test 4.3] GET /api/data for deleted user (auto-create empty doc)")
if admin_token and rohan_user:
    # rohan was deleted, so his userData should be gone
    # Try to access it as admin - should auto-create empty doc
    resp = make_request('GET', '/data', token=admin_token, 
                       params={'userId': rohan_user['id']})
    if resp and resp.status_code == 200:
        data = resp.json()['data']
        # Should have empty arrays
        all_empty = all(len(data.get(k, [])) == 0 for k in 
                       ['accounts', 'incomes', 'expenses', 'crops', 'loans', 'peers', 'assets'])
        if all_empty:
            result.add_pass("Data integrity: auto-create empty doc for missing userData")
        else:
            result.add_fail("Data integrity: auto-create empty doc for missing userData", 
                           f"Expected empty arrays, got: {data}")
    else:
        result.add_fail("Data integrity: auto-create empty doc for missing userData", 
                       f"Expected 200, got {resp.status_code if resp else 'no response'}")
else:
    result.add_fail("Data integrity: auto-create empty doc for missing userData", 
                   "Missing admin token or rohan user")

# ============================================================================
# CLEANUP
# ============================================================================
print("\n" + "="*80)
print("CLEANUP")
print("="*80)

# Delete test users
print("\n[Cleanup] Deleting test users")
if admin_token and priya_user:
    resp = make_request('DELETE', f'/users/{priya_user["id"]}', token=admin_token)
    if resp and resp.status_code == 200:
        print("   ✓ Deleted priya_test")
    else:
        print(f"   ✗ Failed to delete priya_test: {resp.status_code if resp else 'no response'}")

# rohan was already deleted in test 3.10

# ============================================================================
# FINAL SUMMARY
# ============================================================================
print("\n")
all_passed = result.summary()

if all_passed:
    print("\n🎉 ALL TESTS PASSED!")
    exit(0)
else:
    print("\n⚠️  SOME TESTS FAILED - See details above")
    exit(1)
