
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      "/api/beds": {
        target: "https://script.google.com",
        changeOrigin: true,
        secure: true,
        followRedirects: true,

        rewrite: () =>
          "/macros/s/AKfycbxXTrKXSIXRGC06xaPQhlPqvr9Dnr8yPSXqJudgUk5VqIyv6W1exPOp708oC471_5gW/exec",
      },
    },
  },
});
