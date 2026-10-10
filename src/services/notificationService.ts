import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { NotificationItem, NotificationType } from '../types';

export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  link?: string
): Promise<void> {
  try {
    const notifData: Omit<NotificationItem, 'id'> = {
      userId,
      title,
      message,
      type,
      read: false,
      link: link || '',
      createdAt: new Date().toISOString(),
    };
    await addDoc(collection(db, 'notifications'), notifData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications');
  }
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  try {
    const notifRef = doc(db, 'notifications', notifId);
    await updateDoc(notifRef, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
  }
}
