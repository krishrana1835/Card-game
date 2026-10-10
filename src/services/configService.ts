import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SystemConfig } from '../types';

export const DEFAULT_CONFIG: SystemConfig = {
  startingGrant: 10000000, // 10,000,000 Rs
  bankInterestRate: 12,
  bankIntervalMinutes: 5,
  maxBankLoan: 50000000, // 50,000,000 Rs
  bankLoanPerPot: 50000000, // 50,000,000 Rs per pot, resets every pot
  minBootAmount: 500000, // 500,000 Rs min starting pot
  maxTransfer: 50000000, // 50,000,000 Rs
  updatedBy: 'system',
  updatedAt: new Date().toISOString(),
};

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const configRef = doc(db, 'system_config', 'config');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      return { ...DEFAULT_CONFIG, ...(snap.data() as SystemConfig) };
    }
    // Initialize default config if not present
    await setDoc(configRef, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'system_config/config');
    return DEFAULT_CONFIG;
  }
}

export async function updateSystemConfig(
  newConfig: Partial<SystemConfig>,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  try {
    const configRef = doc(db, 'system_config', 'config');
    const current = await getSystemConfig();
    const updated: SystemConfig = {
      ...current,
      ...newConfig,
      updatedBy: adminEmail,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(configRef, updated);

    // Audit log
    await addDoc(collection(db, 'audit_logs'), {
      action: 'UPDATE_SYSTEM_CONFIG',
      performedBy: adminUid,
      performedByEmail: adminEmail,
      details: newConfig,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'system_config/config');
  }
}
