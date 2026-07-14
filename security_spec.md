# Security Specification & Threat Model (ABAC & Zero-Trust)

This specification details the security invariants and threat modeling for the PMBA Study Platform database collections, followed by the "Dirty Dozen" adversarial payloads designed to test these rules under high-stress scenarios.

---

## 1. Data Invariants & Access Matrix

### Entities & Collections Matrix

| Collection | Schema | Read Policy | Write Policy | Major Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `/users/{userId}` | `User` | Authenticated users (Self) & Admins | Authenticated user (Self) & Admins | Users cannot escalate their own privileges (`isAdmin`, `isApproved` cannot be altered by self). |
| `/study_cycles/{studentId}` | `StudyCycle` | Assigned Student & Admins | Assigned Student & Admins | Cannot write study cycles for a different student. |
| `/reports/{reportId}` | `WeeklyReport` | Assigned Student (`studentId`) & Admins | Admins Only | Non-admins cannot create or overwrite reports. |
| `/shared_content/{itemId}` | `ContentItem` | Any Authenticated User | Admins Only | Read-only for students. System resources are strictly immutable to non-coordinators. |
| `/syllabus_progress/{studentId}` | `SyllabusProgress` | Assigned Student & Admins | Assigned Student & Admins | Students can update their own progress. |
| `/performance_logs_{studentId}/{logId}` | `PerformanceLog` | Assigned Student & Admins | Assigned Student & Admins | Logs can only be written to matching `{studentId}` log collection. |
| `/coordination_questions/{questionId}`| `CoordQuestion` | Any Authenticated User | Admins Only | Students can read and practice questions, but only admins can write/delete. |
| `/private_student_notes/{studentId}` | `PrivateStudentNotes` | Assigned Student Only | Assigned Student Only | Private journals are restricted purely to the owner. Even admins should have no access to private student reflections. |

---

## 2. The "Dirty Dozen" Malicious Payloads

The following 12 JSON payloads attempt to bypass identity, integrity, state transition, or privilege boundaries. Each of these MUST return `PERMISSION_DENIED`.

### Payload 1: Privilege Escalation via User Registration
*   **Vector**: A user registers and attempts to self-assign `isAdmin` or `isApproved` flags.
*   **Target Path**: `/users/attacker_uid_123` (as authenticated user `attacker_uid_123`)
*   **Payload**:
```json
{
  "id": "attacker_uid_123",
  "name": "Attacker",
  "email": "attacker@gmail.com",
  "accessCFO": true,
  "accessSoldado": true,
  "isAdmin": true,
  "isApproved": true,
  "createdAt": "2026-07-13T03:50:00.000Z"
}
```

### Payload 2: RBAC Tampering during Update
*   **Vector**: An existing non-admin user attempts to set `isAdmin: true` on their profile.
*   **Target Path**: `/users/student_uid_456` (as authenticated user `student_uid_456`)
*   **Payload**:
```json
{
  "id": "student_uid_456",
  "name": "Good Student",
  "email": "student@gmail.com",
  "accessCFO": true,
  "accessSoldado": false,
  "isAdmin": true,
  "isApproved": true,
  "createdAt": "2026-05-10T12:00:00.000Z"
}
```

### Payload 3: Identity Spoofing in Study Cycle Write
*   **Vector**: Authenticated user `student_a` attempts to overwrite study cycle records for `student_b`.
*   **Target Path**: `/study_cycles/student_b` (as authenticated user `student_a`)
*   **Payload**:
```json
{
  "id": "student_b_cycle",
  "studentId": "student_b",
  "studentName": "Student B",
  "weekNumber": 1,
  "days": [],
  "unlockedAt": "2026-07-13T00:00:00.000Z",
  "isCompleted": false
}
```

### Payload 4: Rogue Report Creation by Non-Admin
*   **Vector**: A regular student attempts to create an official weekly tactical report on behalf of the administration.
*   **Target Path**: `/reports/fake_report_999` (as authenticated user `student_a`)
*   **Payload**:
```json
{
  "id": "fake_report_999",
  "studentId": "student_a",
  "weekNumber": 4,
  "content": "You are doing great! Signed: The Elite Team",
  "createdAt": "2026-07-13T00:00:00.000Z",
  "updatedAt": "2026-07-13T00:00:00.000Z"
}
```

### Payload 5: Unauthorized Injection into Shared Content
*   **Vector**: A student attempts to inject a malicious video URL or resource link into the shared materials database.
*   **Target Path**: `/shared_content/malicious_link_001` (as authenticated user `student_a`)
*   **Payload**:
```json
{
  "id": "malicious_link_001",
  "title": "Hacked!",
  "subtitle": "Click here for free answers",
  "type": "link",
  "url": "https://malicious-website.com/exploit",
  "category": "both",
  "createdAt": "2026-07-13T00:00:00.000Z"
}
```

### Payload 6: Snooping on Another Student's Performance Logs
*   **Vector**: Authenticated user `student_a` attempts to list/read performance error logs belonging to `student_b`.
*   **Target Path**: `/performance_logs_student_b` (as authenticated user `student_a`)
*   **Operation**: `LIST` query or `GET` doc request

### Payload 7: Denial of Wallet via Giant Document ID Insertion
*   **Vector**: An attacker attempts to inject a huge, complex document ID string containing thousands of bytes to exhaust storage indexes.
*   **Target Path**: `/users/MALICIOUS_ID_` + "A" * 2000 (as authenticated user)
*   **Payload**: Valid User fields but malicious path ID string.

### Payload 8: Write Poisoning in Performance Logs
*   **Vector**: Student attempts to log performance logs for another user's sub-collection to mess up stats.
*   **Target Path**: `/performance_logs_student_b/log_xyz` (as authenticated user `student_a`)
*   **Payload**:
```json
{
  "id": "log_xyz",
  "studentId": "student_b",
  "date": "2026-07-13",
  "subject": "CRASE",
  "topic": "Uso obrigatório",
  "reasonForError": "Distração",
  "questionsAttempted": 1000,
  "questionsCorrect": 999
}
```

### Payload 9: Rogue Question Injection in Coordination Questions
*   **Vector**: A student tries to bypass admin authorization to write/create custom coordinator questions.
*   **Target Path**: `/coordination_questions/rogue_question_1` (as authenticated user `student_a`)
*   **Payload**:
```json
{
  "id": "rogue_question_1",
  "statement": "Is this system hacked?",
  "options": ["Yes", "No"],
  "correctOptionIndex": 0,
  "explanation": "No comment.",
  "createdAt": "2026-07-13T00:00:00.000Z",
  "subject": "Direito Penal"
}
```

### Payload 10: Private Notes Snatching
*   **Vector**: An attacker or even an admin tries to peek at the highly sensitive private study reflections/diaries of a student.
*   **Target Path**: `/private_student_notes/student_a` (as authenticated admin `admin_user`)
*   **Operation**: `GET` request.

### Payload 11: Schema-Breaking Invalid Type Write
*   **Vector**: A user attempts to write an invalid datatype (e.g. string instead of number) for `questionsAttempted` in performance log.
*   **Target Path**: `/performance_logs_student_a/log_777` (as authenticated user `student_a`)
*   **Payload**:
```json
{
  "id": "log_777",
  "studentId": "student_a",
  "date": "2026-07-13",
  "subject": "CRASE",
  "topic": "Crase",
  "reasonForError": "Sem atenção",
  "questionsAttempted": "Thousand",
  "questionsCorrect": 5
}
```

### Payload 12: Time Tampering on Syllabus Updates
*   **Vector**: Student attempts to supply custom client timestamps on syllabus updates to bypass historical or audit tracking.
*   **Target Path**: `/syllabus_progress/student_a` (as authenticated user `student_a`)
*   **Payload**:
```json
{
  "studentId": "student_a",
  "sections": [],
  "updatedAt": "2000-01-01T00:00:00.000Z"
}
```

---

## 3. Test Suite Architecture (`firestore.rules.test.ts`)

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

describe("Firestore Security Rules Fortress Audit", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "vivid-aria-8xhgq",
      firestore: {
        rules: require("fs").readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("P1: Blocks privilege escalation on user registration", async () => {
    const studentDb = testEnv.authenticatedContext("attacker_uid_123").firestore();
    const docRef = doc(studentDb, "users/attacker_uid_123");
    await assertFails(
      setDoc(docRef, {
        id: "attacker_uid_123",
        name: "Attacker",
        email: "attacker@gmail.com",
        accessCFO: true,
        accessSoldado: true,
        isAdmin: true, // Malicious
        isApproved: true, // Malicious
        createdAt: "2026-07-13T03:50:00.000Z",
      })
    );
  });

  test("P2: Blocks RBAC modification on profile update", async () => {
    const studentDb = testEnv.authenticatedContext("student_uid_456").firestore();
    const docRef = doc(studentDb, "users/student_uid_456");
    await assertFails(
      setDoc(docRef, {
        id: "student_uid_456",
        name: "Good Student",
        email: "student@gmail.com",
        accessCFO: true,
        accessSoldado: false,
        isAdmin: true, // Privilege elevation attempted
        isApproved: true,
        createdAt: "2026-05-10T12:00:00.000Z",
      })
    );
  });

  test("P3: Blocks writing study cycles for other students", async () => {
    const aliceDb = testEnv.authenticatedContext("student_a").firestore();
    const bobDocRef = doc(aliceDb, "study_cycles/student_b");
    await assertFails(
      setDoc(bobDocRef, {
        id: "student_b_cycle",
        studentId: "student_b",
        studentName: "Student B",
        weekNumber: 1,
        days: [],
        unlockedAt: "2026-07-13T00:00:00.000Z",
        isCompleted: false,
      })
    );
  });

  test("P4: Blocks non-admins from writing weekly reports", async () => {
    const studentDb = testEnv.authenticatedContext("student_a").firestore();
    const reportRef = doc(studentDb, "reports/fake_report_999");
    await assertFails(
      setDoc(reportRef, {
        id: "fake_report_999",
        studentId: "student_a",
        weekNumber: 4,
        content: "Hacked",
        createdAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z",
      })
    );
  });

  test("P5: Blocks students from inserting into shared content", async () => {
    const studentDb = testEnv.authenticatedContext("student_a").firestore();
    const contentRef = doc(studentDb, "shared_content/malicious_link_001");
    await assertFails(
      setDoc(contentRef, {
        id: "malicious_link_001",
        title: "Hacked",
        subtitle: "Exploit",
        type: "link",
        url: "https://malicious-website.com",
        category: "both",
        createdAt: "2026-07-13T00:00:00.000Z",
      })
    );
  });

  test("P6 & P8: Blocks unauthorized access to performance logs of other users", async () => {
    const aliceDb = testEnv.authenticatedContext("student_a").firestore();
    const bobLogRef = doc(aliceDb, "performance_logs_student_b/log_xyz");
    await assertFails(getDoc(bobLogRef));
    await assertFails(
      setDoc(bobLogRef, {
        id: "log_xyz",
        studentId: "student_b",
        date: "2026-07-13",
        subject: "CRASE",
        topic: "Uso",
        reasonForError: "Erro",
        questionsAttempted: 10,
        questionsCorrect: 8,
      })
    );
  });

  test("P7: Blocks excessively long or poisoned ID patterns", async () => {
    const studentDb = testEnv.authenticatedContext("student_a").firestore();
    const superLongId = "a".repeat(200);
    const docRef = doc(studentDb, `users/${superLongId}`);
    await assertFails(
      setDoc(docRef, {
        id: superLongId,
        name: "Test",
        email: "test@gmail.com",
        accessCFO: true,
        accessSoldado: true,
        isAdmin: false,
        isApproved: false,
        createdAt: "2026-07-13T00:00:00.000Z",
      })
    );
  });

  test("P9: Blocks non-admins from adding coordinator questions", async () => {
    const studentDb = testEnv.authenticatedContext("student_a").firestore();
    const questionRef = doc(studentDb, "coordination_questions/rogue_question_1");
    await assertFails(
      setDoc(questionRef, {
        id: "rogue_question_1",
        statement: "Rogue",
        options: ["A", "B"],
        correctOptionIndex: 0,
        explanation: "None",
        createdAt: "2026-07-13T00:00:00.000Z",
        subject: "Penal",
      })
    );
  });

  test("P10: Blocks admins from snooping on student's private reflections", async () => {
    // Admins are authenticated but do not own the student's note
    const adminDb = testEnv.authenticatedContext("admin_uid", { email: "gabrielj0s239@gmail.com" }).firestore();
    const studentNoteRef = doc(adminDb, "private_student_notes/student_a");
    await assertFails(getDoc(studentNoteRef));
  });

  test("P11: Rejects performance log schema violation (datatype mismatch)", async () => {
    const studentDb = testEnv.authenticatedContext("student_a").firestore();
    const logRef = doc(studentDb, "performance_logs_student_a/log_777");
    await assertFails(
      setDoc(logRef, {
        id: "log_777",
        studentId: "student_a",
        date: "2026-07-13",
        subject: "CRASE",
        topic: "Crase",
        reasonForError: "Sem atenção",
        questionsAttempted: "Thousand", // Invalid type (must be number)
        questionsCorrect: 5,
      })
    );
  });

  test("P12: Blocks client-provided temporal forgery on syllabus progress", async () => {
    const studentDb = testEnv.authenticatedContext("student_a").firestore();
    const progressRef = doc(studentDb, "syllabus_progress/student_a");
    await assertFails(
      setDoc(progressRef, {
        studentId: "student_a",
        sections: [],
        updatedAt: "2000-01-01T00:00:00.000Z", // Non-matching / stale time
      })
    );
  });
});
```
