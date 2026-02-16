export type UserProfile = {
  uid: string;
  name: string;
  phone: string;
  address: string;
  zip: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
};