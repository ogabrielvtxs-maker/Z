import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc
} from "firebase/firestore";
import { User, StudyCycle, WeeklyReport, ContentItem, SyllabusSection, PerformanceLog } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyDGQm2JPIEU4UkfkxKrF5dqPESKtp10XxQ",
  authDomain: "vivid-aria-8xhgq.firebaseapp.com",
  projectId: "vivid-aria-8xhgq",
  storageBucket: "vivid-aria-8xhgq.firebasestorage.app",
  messagingSenderId: "412926314455",
  appId: "1:412926314455:web:5d1353fd6630691e53ed92"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom databaseId provided in config
export const db = getFirestore(app, "ai-studio-plataformadeestu-226b8942-b6d3-4981-aa96-003231131d4e");

// --- FIRESTORE ERROR HANDLING MECHANISM ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- USERS MANAGEMENT ---

export async function fetchUsersFromFirestore(): Promise<User[]> {
  const path = "users";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const users: User[] = [];
    querySnapshot.forEach((docSnap) => {
      users.push(docSnap.data() as User);
    });
    return users;
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error("Error fetching users from Firestore:", error);
    return [];
  }
}

export async function saveUserToFirestore(user: User): Promise<void> {
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, "users", user.id), user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving user ${user.id} to Firestore:`, error);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, "users", userId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting user ${userId} from Firestore:`, error);
  }
}

// --- STUDY CYCLES ---

export async function fetchStudyCycleFromFirestore(studentId: string): Promise<StudyCycle | null> {
  const path = `study_cycles/${studentId}`;
  try {
    const docSnap = await getDoc(doc(db, "study_cycles", studentId));
    if (docSnap.exists()) {
      return docSnap.data() as StudyCycle;
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    console.error(`Error fetching study cycle for student ${studentId}:`, error);
    return null;
  }
}

export async function saveStudyCycleToFirestore(studentId: string, cycle: StudyCycle): Promise<void> {
  const path = `study_cycles/${studentId}`;
  try {
    await setDoc(doc(db, "study_cycles", studentId), cycle);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving study cycle for student ${studentId}:`, error);
  }
}

// --- WEEKLY REPORTS (CORREIO) ---

export async function fetchAllReportsFromFirestore(): Promise<WeeklyReport[]> {
  const path = "reports";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const reports: WeeklyReport[] = [];
    querySnapshot.forEach((docSnap) => {
      reports.push(docSnap.data() as WeeklyReport);
    });
    return reports;
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error("Error fetching reports from Firestore:", error);
    return [];
  }
}

export async function saveReportToFirestore(report: WeeklyReport): Promise<void> {
  const path = `reports/${report.id}`;
  try {
    await setDoc(doc(db, "reports", report.id), report);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving report ${report.id} to Firestore:`, error);
  }
}

export async function deleteReportFromFirestore(reportId: string): Promise<void> {
  const path = `reports/${reportId}`;
  try {
    await deleteDoc(doc(db, "reports", reportId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting report ${reportId} from Firestore:`, error);
  }
}

// --- SHARED CONTENT (CONTENT AREA) ---

export async function fetchSharedContentFromFirestore(): Promise<ContentItem[]> {
  const path = "shared_content";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const items: ContentItem[] = [];
    querySnapshot.forEach((docSnap) => {
      items.push(docSnap.data() as ContentItem);
    });
    // Sort descending by createdAt
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error("Error fetching shared content from Firestore:", error);
    return [];
  }
}

export async function saveContentItemToFirestore(item: ContentItem): Promise<void> {
  const path = `shared_content/${item.id}`;
  try {
    await setDoc(doc(db, "shared_content", item.id), item);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving content item ${item.id} to Firestore:`, error);
  }
}

export async function deleteContentItemFromFirestore(itemId: string): Promise<void> {
  const path = `shared_content/${itemId}`;
  try {
    await deleteDoc(doc(db, "shared_content", itemId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting content item ${itemId} from Firestore:`, error);
  }
}

// --- SYLLABUS PROGRESS ---

export async function fetchSyllabusProgressFromFirestore(studentId: string): Promise<SyllabusSection[] | null> {
  const path = `syllabus_progress/${studentId}`;
  try {
    const docSnap = await getDoc(doc(db, "syllabus_progress", studentId));
    if (docSnap.exists()) {
      return docSnap.data().sections as SyllabusSection[];
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    console.error(`Error fetching syllabus progress for ${studentId}:`, error);
    return null;
  }
}

export async function saveSyllabusProgressToFirestore(studentId: string, sections: SyllabusSection[]): Promise<void> {
  const path = `syllabus_progress/${studentId}`;
  try {
    await setDoc(doc(db, "syllabus_progress", studentId), { studentId, sections, updatedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving syllabus progress for ${studentId}:`, error);
  }
}

// --- PERFORMANCE LOGS ---

export async function fetchPerformanceLogsFromFirestore(studentId: string): Promise<PerformanceLog[]> {
  const path = `performance_logs_${studentId}`;
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const logs: PerformanceLog[] = [];
    querySnapshot.forEach((docSnap) => {
      logs.push(docSnap.data() as PerformanceLog);
    });
    return logs;
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error(`Error fetching performance logs for ${studentId}:`, error);
    return [];
  }
}

export async function savePerformanceLogToFirestore(studentId: string, log: PerformanceLog): Promise<void> {
  const path = `performance_logs_${studentId}/${log.id}`;
  try {
    await setDoc(doc(db, `performance_logs_${studentId}`, log.id), log);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving performance log ${log.id} for ${studentId}:`, error);
  }
}

export async function deletePerformanceLogFromFirestore(studentId: string, logId: string): Promise<void> {
  const path = `performance_logs_${studentId}/${logId}`;
  try {
    await deleteDoc(doc(db, `performance_logs_${studentId}`, logId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting performance log ${logId} for ${studentId}:`, error);
  }
}
