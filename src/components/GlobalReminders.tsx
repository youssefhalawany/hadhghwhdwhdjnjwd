"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

export default function GlobalReminders() {
  useEffect(() => {
    // We only want to trigger reminders once per specific time frame to avoid spamming
    let lastReminderTriggered = "";

    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Formulate a key for the current minute so we only trigger once
      const currentMinuteKey = `${hours}:${minutes}`;

      if (lastReminderTriggered === currentMinuteKey) return;

      // 12 AM Reminder (Midnight)
      if (hours === 0 && minutes === 0) {
        lastReminderTriggered = currentMinuteKey;
        toast.custom((t: any) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-l-red-500 overflow-hidden`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    🚨 Midnight Reminder
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Don't forget to send sales on the group and the end cash sheet!
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-300 text-right dir-rtl" dir="rtl">
                    لا تنس إرسال المبيعات على الجروب وشيت تقفيل النقدية!
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-slate-200 dark:border-slate-800">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-red-600 hover:text-red-500 focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 30000 }); // Show for 30 seconds
      }

      // Hourly Reminder (Top of the hour, excluding midnight)
      if (minutes === 0 && hours !== 0) {
        lastReminderTriggered = currentMinuteKey;
        toast.custom((t: any) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden border border-blue-500/20`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    🧼 Hourly Reminder
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
                    cleaning Time
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-slate-200 dark:border-slate-800">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Done
              </button>
            </div>
          </div>
        ), { duration: 15000 });
      }
    };

    // Check immediately, then every 30 seconds to catch the exact minute
    checkTime();
    const intervalId = setInterval(checkTime, 30000);

    return () => clearInterval(intervalId);
  }, []);

  return null; // This component doesn't render anything itself
}
