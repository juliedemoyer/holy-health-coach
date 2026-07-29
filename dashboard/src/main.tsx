import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import "./index.css";
import { AuthGuard } from "@/components/AuthGuard";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Vitals } from "@/pages/Vitals";
import { Training } from "@/pages/Training";
import { Nutrition } from "@/pages/Nutrition";
import { Body } from "@/pages/Body";
import { Marathons } from "@/pages/Marathons";
import { Regressions } from "@/pages/Regressions";
import { Journal } from "@/pages/Journal";
import { Knowledge } from "@/pages/Knowledge";
import { SignIn } from "@/pages/SignIn";
import { Public } from "@/pages/Public";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/public" element={<Public />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<Home />} />
          <Route path="vitals" element={<Vitals />} />
          <Route path="training" element={<Training />} />
          <Route path="nutrition" element={<Nutrition />} />
          <Route path="body" element={<Body />} />
          <Route path="marathons" element={<Marathons />} />
          <Route path="regressions" element={<Regressions />} />
          <Route path="journal" element={<Journal />} />
          <Route path="knowledge" element={<Knowledge />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
