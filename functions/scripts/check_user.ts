import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

async function main() {
  const phone = '+628120000000';
  const email = 'test@example.com'; // or whatever email they used
  console.log(`Checking for phone: ${phone} and email: ${email}`);

  try {
    const userByPhone = await auth.getUserByPhoneNumber(phone).catch(() => null);
    if (userByPhone) {
      console.log(`[Auth] Found user by phone: ${userByPhone.uid} (${userByPhone.email})`);
    } else {
      console.log(`[Auth] No user found with phone ${phone}`);
    }

    const snapshot = await db.collection('users').where('phone', '==', phone).get();
    if (!snapshot.empty) {
      console.log(`[Firestore] Found ${snapshot.size} users with phone ${phone}:`);
      snapshot.forEach(doc => console.log(doc.id, doc.data()));
    } else {
      console.log(`[Firestore] No users found with phone ${phone}`);
    }
  } catch (e) {
    console.error(e);
  }
}

main();
