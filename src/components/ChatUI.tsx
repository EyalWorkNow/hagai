import { useState, useRef, useEffect } from "react";
import { Send, User, Home, Shield, MoreVertical, Paperclip, Smile } from "lucide-react";
import { User as AppUser } from "../types";
import { cn } from "../lib/utils";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs } from "firebase/firestore";

/**
 * ChatUI Component
 */
export default function ChatUI({ user }: { user: AppUser }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [partner, setPartner] = useState<AppUser | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch conversation partner and messages
  useEffect(() => {
    if (!user.id) return;

    const initChat = async () => {
      // Find someone to talk to (Simplified: first associated property's other party)
      const propQuery = query(
        collection(db, "properties"),
        user.role === "tenant" ? where("tenantId", "==", user.id) : where("landlordId", "==", user.id)
      );
      const propSnap = await getDocs(propQuery);
      
      if (!propSnap.empty) {
        const propData = propSnap.docs[0].data();
        const partnerId = user.role === "tenant" ? propData.landlordId : propData.tenantId;
        
        if (partnerId) {
          // Listen to messages for this chat topic
          const chatTopic = [user.id, partnerId].sort().join("_");
          const msgQuery = query(
            collection(db, "messages"),
            where("topicId", "==", chatTopic),
            orderBy("createdAt", "asc")
          );
          
          const unsubscribe = onSnapshot(msgQuery, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          });

          return unsubscribe;
        }
      }
    };

    const unsubPromise = initChat();
    return () => { unsubPromise.then(un => un && un()); };
  }, [user.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user.id) return;

    // Simplified: find the first partner again or keep it in state
    const propQuery = query(
      collection(db, "properties"),
      user.role === "tenant" ? where("tenantId", "==", user.id) : where("landlordId", "==", user.id)
    );
    const propSnap = await getDocs(propQuery);
    if (propSnap.empty) return;
    
    const propData = propSnap.docs[0].data();
    const partnerId = user.role === "tenant" ? propData.landlordId : propData.tenantId;
    const chatTopic = [user.id, partnerId].sort().join("_");

    try {
      await addDoc(collection(db, "messages"), {
        topicId: chatTopic,
        senderId: user.id,
        text: input,
        createdAt: serverTimestamp()
      });
      setInput("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "messages");
    }
  };

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col rounded-3xl bg-white shadow-sleek-lg border border-slate-200 overflow-hidden animate-in fade-in duration-500">
      
      {/* 1. CHAT HEADER */}
      <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sleek-blue relative group overflow-hidden">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {user.role === "tenant" ? <Home size={22} /> : <User size={22} />}
          </div>
          <div>
            <p className="font-black text-slate-900 tracking-tight text-base leading-none">
              {user.role === "tenant" ? "אברהם (המשכיר שלך)" : "ישראל (השוכר)"}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">זמין כעת לשיחה</span>
            </div>
          </div>
        </div>
        <button className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-all">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* 2. MESSAGES AREA */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} currentUserId={user.id} />
        ))}
      </div>

      {/* 3. INPUT AREA */}
      <div className="p-5 bg-white border-t border-slate-100">
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-3xl p-1.5 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
          <button className="h-11 w-11 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <Paperclip size={20} />
          </button>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="רשום הודעה חדשה..." 
            className="flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none font-medium text-slate-900" 
          />
          
          <button className="h-11 w-11 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <Smile size={20} />
          </button>
          
          <button 
            onClick={handleSend}
            className="flex h-11 px-6 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-sleek-blue hover:bg-blue-700 active:scale-95 transition-all group"
          >
            <span>שלח</span>
            <Send size={16} className="rotate-180 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Message UI Component
// -----------------------------------------------------------------------------

function ChatMessage({ msg, currentUserId }: any) {
  const isMine = msg.senderId === currentUserId;
  const isSystem = msg.sender === "system";

  const time = msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "...";

  if (isSystem) {
    return (
      <div className="flex justify-center w-full my-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-full bg-slate-100 px-6 py-2 text-[10px] text-slate-400 font-black border border-slate-200 uppercase tracking-widest shadow-sm">
           <Shield size={12} className="inline ml-2 -mt-0.5" />
           {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col max-w-[80%] animate-in slide-in-from-bottom-2 duration-300",
      isMine ? "mr-auto items-start" : "ml-auto items-end"
    )}>
      <div className={cn(
        "px-5 py-3 text-sm font-medium shadow-sleek relative group",
        isMine 
          ? "bg-blue-600 text-white rounded-2xl rounded-br-none" 
          : "bg-white text-slate-900 rounded-2xl rounded-bl-none border border-slate-100"
      )}>
        {msg.text}
        <div className={cn(
          "absolute top-0 w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity",
          isMine ? "right-[-10px] border-l-8 border-l-blue-600 border-b-8 border-b-transparent" : "left-[-10px] border-r-8 border-r-white border-b-8 border-b-transparent"
        )}></div>
      </div>
      <span className="mt-2 text-[9px] text-slate-400 font-black uppercase tracking-widest px-1">{time}</span>
    </div>
  );
}
