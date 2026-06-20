import { createContext, useContext } from "react";
import { useNotifications } from "./useNotifications";

const NotifCtx = createContext(null);

export function NotificationProvider({ children }) {
  const notif = useNotifications();
  return <NotifCtx.Provider value={notif}>{children}</NotifCtx.Provider>;
}

export const useNotif = () => useContext(NotifCtx);
