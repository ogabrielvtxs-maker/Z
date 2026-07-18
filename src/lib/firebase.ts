import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc,
  getDocFromServer,
  query,
  where
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword
} from "firebase/auth";
import { User, StudyCycle, WeeklyReport, ContentItem, SyllabusSection, PerformanceLog, CoordQuestion, PasswordResetRequest, EssaySubmission, EssayTheme } from "../types";

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

// Initialize Auth and Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// We DO NOT add Gmail scopes globally to googleProvider because it triggers 
// security warnings for normal students. They will be added dynamically when the admin authorizes Gmail.

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      const storedToken = localStorage.getItem("gmail_oauth_token");
      if (storedToken) {
        cachedAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("gmail_oauth_token");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Standard Google login for normal users (NO GMAIL SCOPES)
export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const cleanProvider = new GoogleAuthProvider();
    // Default scopes only: profile and email
    const result = await signInWithPopup(auth, cleanProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || "";
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Special Google login with Gmail scopes for the Admin
export const googleSignInWithGmail = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const gmailProvider = new GoogleAuthProvider();
    gmailProvider.addScope("https://mail.google.com/");
    gmailProvider.addScope("https://www.googleapis.com/auth/gmail.send");
    gmailProvider.addScope("https://www.googleapis.com/auth/gmail.compose");
    
    const result = await signInWithPopup(auth, gmailProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem("gmail_oauth_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Gmail authorization error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem("gmail_oauth_token");
  }
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("gmail_oauth_token");
};

// Password reset with on-the-fly fallback for users that only exist in Firestore database
export const sendResetPasswordEmail = async (email: string): Promise<boolean> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: any) {
    console.warn("Error in standard sendPasswordResetEmail, trying on-the-fly registration fallback:", error);
    const errorCode = error.code || "";
    const errorMessage = error.message || "";
    
    // Check if the user does not exist in Firebase Auth
    if (
      errorCode === "auth/user-not-found" || 
      errorCode === "auth/invalid-credential" || 
      errorMessage.includes("user-not-found") ||
      errorMessage.includes("invalid-credential")
    ) {
      try {
        // Create a secure temporary Firebase Auth account for them
        const tempPassword = Math.random().toString(36).slice(-10) + "Aa1!";
        await createUserWithEmailAndPassword(auth, email, tempPassword);
        await auth.signOut(); // Sign out the newly created session
        
        // Try sending password reset email again now that they exist in Auth
        await sendPasswordResetEmail(auth, email);
        return true;
      } catch (createErr) {
        console.error("Failed to create user on-the-fly for password reset fallback:", createErr);
      }
    }
    throw error;
  }
};

// Email/Password login helper
export const firebaseSignInWithEmailAndPassword = async (email: string, password: string): Promise<FirebaseUser> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

// Email/Password register helper
export const firebaseCreateUserWithEmailAndPassword = async (email: string, password: string): Promise<FirebaseUser> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
};

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
  const firebaseUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseUser ? firebaseUser.uid : null,
      email: firebaseUser ? firebaseUser.email : null,
      emailVerified: firebaseUser ? firebaseUser.emailVerified : null,
      isAnonymous: firebaseUser ? firebaseUser.isAnonymous : null,
      tenantId: firebaseUser ? firebaseUser.tenantId : null,
      providerInfo: firebaseUser ? firebaseUser.providerData.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) : []
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

export async function fetchUserByEmailFromFirestore(email: string): Promise<User | null> {
  const path = "users";
  try {
    const q = query(collection(db, path), where("email", "==", email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as User;
    }
  } catch (error) {
    console.error("Error fetching user by email from Firestore:", error);
  }
  return null;
}

export async function fetchUserFromFirestore(userId: string): Promise<User | null> {
  const path = `users/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, "users", userId));
    if (docSnap.exists()) {
      return docSnap.data() as User;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    console.error(`Error fetching user ${userId} from Firestore:`, error);
  }
  return null;
}

export async function saveUserToFirestore(user: User): Promise<void> {
  const path = `users/${user.id}`;
  try {
    // Sanitize user object to remove any undefined properties which Firestore rejects
    const cleanUser = { ...user };
    Object.keys(cleanUser).forEach((key) => {
      const k = key as keyof User;
      if (cleanUser[k] === undefined) {
        delete cleanUser[k];
      }
    });
    await setDoc(doc(db, "users", user.id), cleanUser);
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
    const sanitizedCycle = cleanUndefined(cycle);
    await setDoc(doc(db, "study_cycles", studentId), sanitizedCycle);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving study cycle for student ${studentId}:`, error);
  }
}

export async function deleteStudyCycleFromFirestore(studentId: string): Promise<void> {
  const path = `study_cycles/${studentId}`;
  try {
    await deleteDoc(doc(db, "study_cycles", studentId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting study cycle for student ${studentId}:`, error);
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

export async function fetchStudentReportsFromFirestore(studentId: string): Promise<WeeklyReport[]> {
  const path = "reports";
  try {
    const q = query(collection(db, "reports"), where("studentId", "==", studentId));
    const querySnapshot = await getDocs(q);
    const reports: WeeklyReport[] = [];
    querySnapshot.forEach((docSnap) => {
      reports.push(docSnap.data() as WeeklyReport);
    });
    return reports;
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error(`Error fetching reports for student ${studentId}:`, error);
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

// Helper function to recursively remove undefined properties before writing to Firestore
export function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
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
    const sanitizedSections = cleanUndefined(sections);
    await setDoc(doc(db, "syllabus_progress", studentId), { studentId, sections: sanitizedSections, updatedAt: new Date().toISOString() });
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

// --- COORDINATION QUESTIONS ---

export async function fetchCoordQuestionsFromFirestore(): Promise<CoordQuestion[]> {
  const path = "coordination_questions";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const questions: CoordQuestion[] = [];
    querySnapshot.forEach((docSnap) => {
      questions.push(docSnap.data() as CoordQuestion);
    });
    // Sort oldest first (chronological order)
    return questions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error("Error fetching coordination questions from Firestore:", error);
    return [];
  }
}

export async function saveCoordQuestionToFirestore(question: CoordQuestion): Promise<void> {
  const path = `coordination_questions/${question.id}`;
  try {
    await setDoc(doc(db, "coordination_questions", question.id), question);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving coordination question ${question.id}:`, error);
  }
}

export async function deleteCoordQuestionFromFirestore(questionId: string): Promise<void> {
  const path = `coordination_questions/${questionId}`;
  try {
    await deleteDoc(doc(db, "coordination_questions", questionId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting coordination question ${questionId}:`, error);
  }
}

// --- PRIVATE STUDENT NOTES ---

export async function fetchPrivateStudentNotesFromFirestore(studentId: string): Promise<string> {
  try {
    const docSnap = await getDoc(doc(db, "private_student_notes", studentId));
    if (docSnap.exists()) {
      return docSnap.data().notes || "";
    }
    return "";
  } catch (error) {
    console.error(`Error fetching private notes for ${studentId}:`, error);
    return "";
  }
}

export async function savePrivateStudentNotesToFirestore(studentId: string, notes: string): Promise<void> {
  try {
    await setDoc(doc(db, "private_student_notes", studentId), {
      studentId,
      notes,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error saving private notes for ${studentId}:`, error);
  }
}

// --- PASSWORD RESET REQUESTS ---

export async function fetchPasswordResetRequestsFromFirestore(): Promise<PasswordResetRequest[]> {
  const path = "password_reset_requests";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const reqs: PasswordResetRequest[] = [];
    querySnapshot.forEach((docSnap) => {
      reqs.push(docSnap.data() as PasswordResetRequest);
    });
    return reqs;
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error("Error fetching password reset requests from Firestore:", error);
    return [];
  }
}

export async function savePasswordResetRequestToFirestore(request: PasswordResetRequest): Promise<void> {
  const path = `password_reset_requests/${request.id}`;
  try {
    await setDoc(doc(db, "password_reset_requests", request.id), request);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving password reset request ${request.id} to Firestore:`, error);
  }
}

export async function deletePasswordResetRequestFromFirestore(requestId: string): Promise<void> {
  const path = `password_reset_requests/${requestId}`;
  try {
    await deleteDoc(doc(db, "password_reset_requests", requestId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting password reset request ${requestId} from Firestore:`, error);
  }
}

export async function adminUpdateUserPassword(
  studentEmail: string,
  oldPassword: string,
  newPassword: string,
  adminEmail: string,
  adminPassword: string
): Promise<void> {
  const authInstance = auth;
  try {
    // 1. Sign in as student with their old password
    const studentResult = await signInWithEmailAndPassword(authInstance, studentEmail, oldPassword);
    if (studentResult.user) {
      // 2. Update their password in Firebase Auth
      await updatePassword(studentResult.user, newPassword);
    }
  } catch (error: any) {
    console.warn("Could not sign in as student or update password. Attempting to create user on Firebase Auth in case they don't exist:", error);
    
    // If they didn't exist, we can register them now
    try {
      await createUserWithEmailAndPassword(authInstance, studentEmail, newPassword);
    } catch (regErr) {
      console.error("Failed to create user on-the-fly during admin password reset:", regErr);
      throw new Error("Falha ao sincronizar a senha no serviço de autenticação do Firebase: " + (error.message || error));
    }
  } finally {
    // 3. Always sign out the student session and restore the admin session
    try {
      await authInstance.signOut();
    } catch (soErr) {
      console.error("Error signing out student session:", soErr);
    }
    
    // 4. Sign back in as the administrator
    if (adminEmail && adminPassword) {
      try {
        await signInWithEmailAndPassword(authInstance, adminEmail, adminPassword);
      } catch (adminLoginErr) {
        console.error("Failed to restore administrator session in Firebase Auth:", adminLoginErr);
        throw new Error("Sua senha foi alterada com sucesso no banco de dados, mas a sessão administrativa do Firebase foi desconectada. Por favor, faça login novamente.");
      }
    }
  }
}

// Validate Connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export async function migrateStudentData(oldId: string, newId: string, updatedProfile: User): Promise<void> {
  console.log(`Starting data migration from ${oldId} to ${newId}...`);
  try {
    // 1. Save new user profile to Firestore
    await saveUserToFirestore(updatedProfile);
    
    // 2. Migrate Study Cycle
    const oldCycle = await fetchStudyCycleFromFirestore(oldId);
    if (oldCycle) {
      const newCycle = { ...oldCycle, studentId: newId };
      await saveStudyCycleToFirestore(newId, newCycle);
      await deleteStudyCycleFromFirestore(oldId);
      console.log("Migrated Study Cycle from Firestore");
    }

    // 3. Migrate Syllabus Progress
    const oldSyllabus = await fetchSyllabusProgressFromFirestore(oldId);
    if (oldSyllabus) {
      await saveSyllabusProgressToFirestore(newId, oldSyllabus);
      await deleteDoc(doc(db, "syllabus_progress", oldId));
      console.log("Migrated Syllabus Progress from Firestore");
    }

    // 4. Migrate Performance Logs
    const oldLogs = await fetchPerformanceLogsFromFirestore(oldId);
    if (oldLogs && oldLogs.length > 0) {
      for (const log of oldLogs) {
        const newLog = { ...log, studentId: newId };
        await savePerformanceLogToFirestore(newId, newLog);
        await deletePerformanceLogFromFirestore(oldId, log.id);
      }
      console.log(`Migrated ${oldLogs.length} Performance Logs from Firestore`);
    }

    // 5. Migrate Private Notes
    const oldNotes = await fetchPrivateStudentNotesFromFirestore(oldId);
    if (oldNotes) {
      await savePrivateStudentNotesToFirestore(newId, oldNotes);
      await deleteDoc(doc(db, "private_student_notes", oldId));
      console.log("Migrated Private Notes from Firestore");
    }

    // 6. Migrate Weekly Reports in Firestore
    try {
      const q = query(collection(db, "reports"), where("studentId", "==", oldId));
      const querySnapshot = await getDocs(q);
      for (const docSnap of querySnapshot.docs) {
        const report = docSnap.data() as WeeklyReport;
        const updatedReport = { ...report, studentId: newId };
        await saveReportToFirestore(updatedReport);
      }
      console.log(`Migrated reports from Firestore`);
    } catch (err) {
      console.error("Error migrating reports in Firestore:", err);
    }

    // 7. Delete old user profile
    await deleteUserFromFirestore(oldId);
    console.log("Deleted old user profile from Firestore");

  } catch (err) {
    console.error("Error migrating student data in Firestore:", err);
  }

  // 8. LocalStorage Renaming
  try {
    // Study Cycle
    const localCycle = localStorage.getItem(`study_cycle_${oldId}`);
    if (localCycle) {
      try {
        const parsed = JSON.parse(localCycle);
        parsed.studentId = newId;
        localStorage.setItem(`study_cycle_${newId}`, JSON.stringify(parsed));
      } catch (e) {
        localStorage.setItem(`study_cycle_${newId}`, localCycle);
      }
      localStorage.removeItem(`study_cycle_${oldId}`);
    }

    // Syllabus Progress
    const localSyllabus = localStorage.getItem(`syllabus_progress_${oldId}`);
    if (localSyllabus) {
      localStorage.setItem(`syllabus_progress_${newId}`, localSyllabus);
      localStorage.removeItem(`syllabus_progress_${oldId}`);
    }

    // Performance Logs
    const localLogs = localStorage.getItem(`performance_logs_${oldId}`);
    if (localLogs) {
      try {
        const parsed = JSON.parse(localLogs) as PerformanceLog[];
        const updated = parsed.map(log => ({ ...log, studentId: newId }));
        localStorage.setItem(`performance_logs_${newId}`, JSON.stringify(updated));
      } catch (e) {
        localStorage.setItem(`performance_logs_${newId}`, localLogs);
      }
      localStorage.removeItem(`performance_logs_${oldId}`);
    }

    // Daily Study Goal
    const localGoal = localStorage.getItem(`daily_study_goal_hours_${oldId}`);
    if (localGoal) {
      localStorage.setItem(`daily_study_goal_hours_${newId}`, localGoal);
      localStorage.removeItem(`daily_study_goal_hours_${oldId}`);
    }

    // Pomodoro seconds today
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`pomodoro_study_seconds_${oldId}_`)) {
        const val = localStorage.getItem(key);
        if (val) {
          const datePart = key.replace(`pomodoro_study_seconds_${oldId}_`, "");
          localStorage.setItem(`pomodoro_study_seconds_${newId}_${datePart}`, val);
          localStorage.removeItem(key);
          // decrement i because we removed an item from localStorage
          i--;
        }
      }
    }
    console.log("Migrated local storage data");
  } catch (err) {
    console.error("Error migrating local storage data:", err);
  }
}

// --- ESSAY SYSTEM (REDAÇÃO) ---

export async function saveEssaySubmissionToFirestore(submission: EssaySubmission): Promise<void> {
  const path = `essay_submissions/${submission.id}`;
  try {
    const cleaned = cleanUndefined(submission);
    await setDoc(doc(db, "essay_submissions", submission.id), cleaned);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving essay submission ${submission.id}:`, error);
  }
}

export async function fetchEssaySubmissionsForStudent(studentId: string): Promise<EssaySubmission[]> {
  const path = "essay_submissions";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const submissions: EssaySubmission[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as EssaySubmission;
      if (data.studentId === studentId) {
        submissions.push(data);
      }
    });
    return submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error(`Error fetching essay submissions for student ${studentId}:`, error);
    return [];
  }
}

export async function fetchAllEssaySubmissions(): Promise<EssaySubmission[]> {
  const path = "essay_submissions";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const submissions: EssaySubmission[] = [];
    querySnapshot.forEach((docSnap) => {
      submissions.push(docSnap.data() as EssaySubmission);
    });
    return submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error("Error fetching all essay submissions:", error);
    return [];
  }
}

export async function deleteEssaySubmissionFromFirestore(submissionId: string): Promise<void> {
  const path = `essay_submissions/${submissionId}`;
  try {
    await deleteDoc(doc(db, "essay_submissions", submissionId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting essay submission ${submissionId}:`, error);
  }
}

// --- ESSAY THEMES (TEMAS DE REDAÇÃO) ---

export async function saveEssayThemeToFirestore(theme: EssayTheme): Promise<void> {
  const path = `essay_themes/${theme.id}`;
  try {
    const cleaned = cleanUndefined(theme);
    await setDoc(doc(db, "essay_themes", theme.id), cleaned);
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.error(`Error saving essay theme ${theme.id}:`, error);
  }
}

export async function fetchEssayThemesFromFirestore(): Promise<EssayTheme[]> {
  const path = "essay_themes";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const themes: EssayTheme[] = [];
    querySnapshot.forEach((docSnap) => {
      themes.push(docSnap.data() as EssayTheme);
    });
    return themes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error("Error fetching essay themes:", error);
    return [];
  }
}

export async function deleteEssayThemeFromFirestore(themeId: string): Promise<void> {
  const path = `essay_themes/${themeId}`;
  try {
    await deleteDoc(doc(db, "essay_themes", themeId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    console.error(`Error deleting essay theme ${themeId}:`, error);
  }
}


