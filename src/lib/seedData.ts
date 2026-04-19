import { db } from "../firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, limit } from "firebase/firestore";

export async function seedProxyData(userId?: string, role?: string) {
  console.log("Seeding proxy data...");
  
  // Landlord ID: either the passed ID (if landlord) or a demo one
  const landlordId = (role === "landlord" && userId) ? userId : "demo_landlord_id";
  // Tenant ID: either the passed ID (if tenant) or a demo one
  const tenantId = (role === "tenant" && userId) ? userId : "demo_tenant_id";

  // Properties
  const properties = [
    {
      address: "שדרות רוטשילד 45, תל אביב",
      rent: 8500,
      status: "occupied",
      landlordId,
      tenantId,
      description: "דירת 3 חדרים מרווחת בלב העיר, נוף פתוח לשדרה.",
      imageUrl: "https://picsum.photos/seed/apartment1/800/600",
      createdAt: serverTimestamp()
    },
    {
      address: "הירקון 12, רמת גן",
      rent: 6200,
      status: "vacant",
      landlordId,
      description: "דירת סטודיו מעוצבת, קרובה לפארק הירקון.",
      imageUrl: "https://picsum.photos/seed/apartment2/800/600",
      createdAt: serverTimestamp()
    },
    {
      address: "רחוב הנביאים 8, ירושלים",
      rent: 7800,
      status: "maintenance",
      landlordId,
      description: "בניין היסטורי משופץ, תקרות גבוהות.",
      imageUrl: "https://picsum.photos/seed/apartment3/800/600",
      createdAt: serverTimestamp()
    }
  ];

  const propertyPromises = properties.map(async (prop) => {
    const docRef = await addDoc(collection(db, "properties"), prop);
    
    const associatedPromises = [];
    if (prop.status === "occupied") {
      const payments = [
        {
          propertyId: docRef.id,
          propertyAddress: prop.address,
          landlordId,
          tenantId,
          amount: prop.rent,
          date: "2024-03-01",
          status: "paid",
          type: "rent",
          createdAt: serverTimestamp()
        },
        {
          propertyId: docRef.id,
          propertyAddress: prop.address,
          landlordId,
          tenantId,
          amount: prop.rent,
          date: "2024-04-01",
          status: "pending",
          type: "rent",
          createdAt: serverTimestamp()
        }
      ];
      for (const p of payments) {
        associatedPromises.push(addDoc(collection(db, "payments"), p));
      }

      associatedPromises.push(addDoc(collection(db, "contracts"), {
        propertyId: docRef.id,
        propertyAddress: prop.address,
        landlordId,
        tenantId,
        startDate: "2024-01-01",
        endDate: "2025-01-01",
        rentAmount: prop.rent,
        status: "active",
        createdAt: serverTimestamp()
      }));
    }
    return Promise.all(associatedPromises);
  });

  const serviceCalls = [
    {
      propertyId: "manual_id_1",
      propertyAddress: "שדרות רוטשילד 45, תל אביב",
      tenantId,
      landlordId,
      title: "נזילה בכיור המטבח",
      status: "open",
      priority: "high",
      category: "plumbing",
      description: "המים דולפים מהסיפון מתחת לכיור.",
      createdAt: serverTimestamp()
    },
    {
      propertyId: "manual_id_1",
      propertyAddress: "שדרות רוטשילד 45, תל אביב",
      tenantId,
      landlordId,
      title: "מזגן לא מקרר",
      status: "in_progress",
      priority: "medium",
      category: "general",
      description: "ביחידה הפנימית יוצא אוויר אבל הוא לא קר.",
      createdAt: serverTimestamp()
    }
  ];

  const serviceCallPromises = serviceCalls.map(call => addDoc(collection(db, "serviceCalls"), call));

  await Promise.all([...propertyPromises, ...serviceCallPromises]);

  return "Success";
}
