import { useState, useEffect, ReactNode } from "react";
import { 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon, 
  Trash2,
  Maximize2,
  Calendar
} from "lucide-react";
import { User, Property } from "../types";
import { cn } from "../lib/utils";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";

interface PhotoDocumentation {
  id: string;
  title: string;
  date: string;
  url: string;
  propertyId: string;
}

/**
 * PropertyCondition Component
 */
export default function PropertyCondition({ user }: { user: User }) {
  const [photos, setPhotos] = useState<PhotoDocumentation[]>([]);
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (!user.id) return;

    const init = async () => {
      // Find property first
      const propQuery = query(
        collection(db, "properties"),
        user.role === "tenant" ? where("tenantId", "==", user.id) : where("landlordId", "==", user.id)
      );
      const propSnap = await getDocs(propQuery);
      
      if (!propSnap.empty) {
        const propData = { id: propSnap.docs[0].id, ...propSnap.docs[0].data() } as Property;
        setProperty(propData);

        // Listen to photos for this property
        const photosQuery = query(collection(db, "propertyPhotos"), where("propertyId", "==", propData.id));
        const unsubscribe = onSnapshot(photosQuery, (snapshot) => {
          setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PhotoDocumentation[]);
        }, (err) => handleFirestoreError(err, OperationType.LIST, "propertyPhotos"));

        return unsubscribe;
      }
    };

    const unsubPromise = init();
    return () => { unsubPromise.then(un => un && un()); };
  }, [user.id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">תיעוד מצב הנכס (Move-in)</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">תיעוד ויזואלי מקיף של הנכס למניעת חילוקי דעות עתידיים</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-sleek-blue hover:bg-blue-700 active:scale-95 transition-all">
          <Camera size={20} />
          <span>הוסף תמונה חדשה</span>
        </button>
      </div>

      {/* 2. PHOTO GALLERY GRID */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
        
        {/* Upload Placeholder */}
        <button className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-slate-400 hover:bg-white hover:border-blue-300 hover:text-blue-500 transition-all group overflow-hidden relative">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <ImageIcon size={40} className="mb-3 opacity-40 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest px-4 text-center">העלה צילום חדש לתיק הנכס</span>
        </button>
      </div>

      {/* 3. INSTRUCTIONAL BANNER */}
      <div className="rounded-2xl bg-orange-50 border border-orange-100 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="h-14 w-14 rounded-2xl bg-white border border-orange-100 flex items-center justify-center text-orange-500 shadow-sm shrink-0">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-orange-900 tracking-tight">הנחיות לתיעוד אפקטיבי</h3>
            <p className="text-sm text-orange-800/80 mt-2 leading-relaxed font-medium">
              מומלץ לצלם את כל החדרים מזוויות רחבות, בדגש על פגמים קיימים בקירות או בריצוף. 
              אל תשכח לצלם את מונה החשמל והמים ביום קבלת המפתח. 
              <span className="block mt-2 font-black text-[12px] uppercase tracking-wider">כל הצילומים נשמרים בענן לצמיתות ומשמשים הוכחה משפטית בעת הצורך.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI Sub-Components for Clean Code
// -----------------------------------------------------------------------------

function PhotoCard({ photo }: any) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white shadow-sleek border border-slate-200 transition-all hover:shadow-xl hover:-translate-y-1">
      {/* Image Container with Aspect Ratio */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img 
          src={photo.url} 
          alt={photo.title} 
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
          referrerPolicy="no-referrer" 
        />
      </div>
      
      {/* Content Info */}
      <div className="p-5">
        <p className="font-black text-slate-900 text-sm tracking-tight">{photo.title}</p>
        <div className="flex items-center gap-2 mt-2">
          <Calendar size={12} className="text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{photo.date}</p>
        </div>
      </div>

      {/* Hover Overlay Actions */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 bg-slate-900/60 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-[2px]">
        <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-all backdrop-blur-md">
          <Maximize2 size={18} />
        </button>
        <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-500/80 text-white hover:bg-red-600 transition-all border border-red-400 shadow-lg">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Verfied Badge */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-green-600 rounded-lg p-1.5 shadow-sm border border-green-100 group-hover:scale-110 transition-transform">
        <CheckCircle2 size={14} />
      </div>
    </div>
  );
}
