"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          background: "#4B0049",
          color: "#ffffff",
          borderRadius: "16px",
          fontSize: "14px",
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(139, 0, 139, 0.35)",
        },
        success: {
          iconTheme: { primary: "#2E9E4F", secondary: "#ffffff" },
        },
        error: {
          iconTheme: { primary: "#D62839", secondary: "#ffffff" },
        },
      }}
    />
  );
}
