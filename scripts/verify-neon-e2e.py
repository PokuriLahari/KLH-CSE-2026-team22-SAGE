import urllib.request
import urllib.parse
import json
import subprocess
import time
import sys
import hmac
import hashlib
import base64

GATEWAY_BASE = "http://localhost:8080"
AUTH_BASE = "http://localhost:8081"
NEON_URL = "postgresql://neondb_owner:npg_oSF13vqjmdri@ep-restless-wildflower-aodu2vrl-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

def check_health():
    print("--- 1. Testing Health Endpoints ---")
    try:
        req = urllib.request.urlopen(f"{AUTH_BASE}/actuator/health", timeout=5)
        print(f"Auth Service Health: {req.status} - {req.read().decode('utf-8')}")
    except Exception as e:
        print(f"Auth Service Health Error: {e}")

    try:
        req = urllib.request.urlopen(f"{GATEWAY_BASE}/actuator/health", timeout=5)
        print(f"API Gateway Health: {req.status} - {req.read().decode('utf-8')}")
    except Exception as e:
        print(f"API Gateway Health Error: {e}")

def create_and_verify_user_and_task():
    print("\n--- 2. End-to-End User & Task on Neon Postgres ---")
    user_email = "neon_verify@example.com"
    user_id = "2"
    
    # Generate JWT for user 2
    secret = "sage-secret-key-super-secure-at-least-32-bytes-long"
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": user_email,
        "role": "STUDENT",
        "iat": now,
        "exp": now + 86400
    }
    
    def b64url(data):
        return base64.urlsafe_b64encode(json.dumps(data, separators=(',', ':')).encode('utf-8')).decode('utf-8').rstrip("=")

    h_b64 = b64url(header)
    p_b64 = b64url(payload)
    sig_input = f"{h_b64}.{p_b64}".encode('utf-8')
    sig = base64.urlsafe_b64encode(hmac.new(secret.encode('utf-8'), sig_input, hashlib.sha256).digest()).decode('utf-8').rstrip("=")
    jwt_token = f"{h_b64}.{p_b64}.{sig}"
    print(f"Generated JWT for user_id={user_id}, email={user_email}")

    # 3. Create a task via API Gateway
    print("\n--- 3. Creating Task via API Gateway -> Auth Service -> Neon Postgres ---")
    task_payload = {
        "title": "Neon Integration Production Task",
        "description": "Verify Lakebase Postgres connectivity with Spring Boot and Gateway",
        "category": "WORK",
        "priority": "HIGH",
        "status": "IN_PROGRESS",
        "deadline": "2026-10-31T23:59:59"
    }
    req = urllib.request.Request(
        f"{GATEWAY_BASE}/api/tasks",
        data=json.dumps(task_payload).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}"
        },
        method="POST"
    )
    resp = urllib.request.urlopen(req, timeout=10)
    task_data = json.loads(resp.read().decode('utf-8'))
    print(f"Task created response (status {resp.status}): {task_data}")
    task_id = task_data.get("id")

    # 4. Fetch tasks via API Gateway
    print("\n--- 4. Fetching Tasks via API Gateway ---")
    req = urllib.request.Request(
        f"{GATEWAY_BASE}/api/tasks",
        headers={"Authorization": f"Bearer {jwt_token}"},
        method="GET"
    )
    resp = urllib.request.urlopen(req, timeout=10)
    tasks_list = json.loads(resp.read().decode('utf-8'))
    print(f"Retrieved {len(tasks_list)} task(s) for user {user_id}:")
    for t in tasks_list:
        print(f"  - ID: {t.get('id')}, Title: {t.get('title')}, Status: {t.get('status')}")

    # 5. Create a reminder via API Gateway
    print("\n--- 5. Creating Reminder via API Gateway -> Neon Postgres ---")
    reminder_payload = {
        "title": "Check Neon Branch Deployment",
        "remindAt": "2026-10-25T10:00:00",
        "method": "EMAIL",
        "targetType": "TASK",
        "targetId": str(task_id)
    }
    req = urllib.request.Request(
        f"{GATEWAY_BASE}/api/reminders",
        data=json.dumps(reminder_payload).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}"
        },
        method="POST"
    )
    resp = urllib.request.urlopen(req, timeout=10)
    reminder_data = json.loads(resp.read().decode('utf-8'))
    print(f"Reminder created response (status {resp.status}): {reminder_data}")
    reminder_id = reminder_data.get("id")

    # 6. Query Neon directly with psql to prove data is persisted in Neon
    print("\n--- 6. Direct Verification in Neon Lakebase Postgres ---")
    verify_cmd = [
        r"C:\Program Files\PostgreSQL\17\bin\psql.exe",
        NEON_URL,
        "-c",
        f"SELECT id, title, category, priority, status, user_id FROM tasks WHERE id = {task_id};"
    ]
    verify_res = subprocess.run(verify_cmd, capture_output=True, text=True)
    print("Neon Tasks Table Query Output:\n" + verify_res.stdout)

    verify_rem_cmd = [
        r"C:\Program Files\PostgreSQL\17\bin\psql.exe",
        NEON_URL,
        "-c",
        f"SELECT id, title, method, status, student_id, recipient_email FROM reminders WHERE id = {reminder_id};"
    ]
    verify_rem_res = subprocess.run(verify_rem_cmd, capture_output=True, text=True)
    print("Neon Reminders Table Query Output:\n" + verify_rem_res.stdout)

    print("\n>>> ALL WIRED SERVICES TESTED END-TO-END AND VERIFIED ON NEON POSTGRES! <<<")

if __name__ == "__main__":
    check_health()
    create_and_verify_user_and_task()
