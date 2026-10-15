// Firebase foi removido do app (modo offline/local).
// Mantemos este módulo como um "stub" para compatibilidade com código
// legado que ainda referencia essas APIs, sem depender do SDK do Firebase.
// Nada aqui faz chamadas de rede.

export const auth: any = { currentUser: null };
export const db: any = null;
export const storage: any = null;
export const app: any = null;
export const FIREBASE_STORAGE_BUCKET = '';

const noop = (..._args: any[]) => null;

export const doc = noop;
export const setDoc = async (..._args: any[]) => null;
export const getDocs = async (..._args: any[]) => ({ docs: [] as any[], forEach: (_cb: any) => {} });
export const collection = noop;
export const deleteDoc = async (..._args: any[]) => null;
export const deleteField = () => null;
export const getDoc = async (..._args: any[]) => ({ exists: () => false, data: () => ({} as any) });
export const query = noop;
export const orderBy = noop;

export const ref = noop;
export const uploadBytes = async (..._args: any[]) => null;
export const deleteObject = async (..._args: any[]) => null;

export const onAuthStateChanged = (_auth: any, cb: any) => {
  try {
    if (typeof cb === 'function') cb(null);
  } catch {}
  return () => {};
};
export const signInWithEmailAndPassword = async () => ({});
export const createUserWithEmailAndPassword = async () => ({});
export const signOut = async () => {};
export const updateProfile = async () => {};

export type User = any;
