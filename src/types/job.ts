export type Job = {
  id: string;
  userId: string;
  title: string;
  description?: string;
  address: string;
  zip: string;
  tip: number;
  standingOffer: boolean;
  endDate?: any; // Firestore Timestamp or null
  creationDate?: any; // Firestore Timestamp
};